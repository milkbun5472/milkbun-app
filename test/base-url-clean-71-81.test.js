// 她 2026-09-19 转群里 nini 的截图：「这个秋秋这么这样！」「我拉取的了模型」「但是告诉我不行！」
// 屏幕上模型列表拉得出来，一发消息就弹「这条线路的接口地址填得不对……别留空格或中文占位」，
// 而她看到的那一行地址肉眼完全正常。
//
// 病根是两条路对同一个地址的洗法不一样：
//   · 拉模型走 normalizedOpenAIBase —— 开头就 .trim()，尾空格被吃掉了，所以拉得动；
//   · 真发消息走 callAI —— 只写了 .replace(/\/$/, "")，空格原样留着，
//     于是被 /^https?:\/\/\S+$/ 里的 \S+ 判死。
// 手机上粘贴网址十次有九次带一个尾空格（iOS 选中复制会捎上），从网页复制还常夹零宽字符。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const engine = P("js/engine.js"), screens = P("js/screens.js");

// 照【真正在跑的那份源码】取函数，不另抄一份实现（stub-from-the-writer）
const cleanBaseUrl = (() => {
  const i = engine.indexOf("function cleanBaseUrl(value) {");
  assert.ok(i > 0, "抠不出 cleanBaseUrl");
  const j = engine.indexOf("\n}", i);
  return new Function(engine.slice(i, j + 2) + "\nreturn cleanBaseUrl;")();
})();

test("洗得掉肉眼看不见的那几种脏", () => {
  const good = "https://example.dev";
  assert.equal(cleanBaseUrl(" https://example.dev "), good, "尾空格没洗掉——她粘贴时最常带的就是这个");
  assert.equal(cleanBaseUrl("https://example.dev/"), good, "结尾的斜杠没削");
  assert.equal(cleanBaseUrl("https://example.dev///"), good, "多个斜杠没削干净");
  assert.equal(cleanBaseUrl("​https://example.dev​"), good, "零宽字符没拆——trim() 收不掉它");
  assert.equal(cleanBaseUrl("https://example.dev　"), good, "全角空格没洗掉");
  assert.equal(cleanBaseUrl("\nhttps://example.dev\n"), good, "换行没洗掉");
  assert.equal(cleanBaseUrl(null), "", "空值该是空串，不是 \"null\"");
  assert.equal(cleanBaseUrl(undefined), "", "空值该是空串，不是 \"undefined\"");
  // ⚠️只洗两头，中间那个空格是真填错了，还得让它报错
  assert.ok(/\s/.test(cleanBaseUrl("https://ex ample.dev")), "把中间的空格也洗掉了——那是真错，不该被悄悄吞掉");
});

test("洗完之后，报错那一关放得过去", () => {
  const i = engine.indexOf("这条线路的接口地址填得不对");
  assert.ok(i > 0, "拦截那句没了");
  const line = engine.slice(engine.lastIndexOf("\n", i) + 1, engine.indexOf("\n", i));
  const re = /\/\^https\?:\\\/\\\/\\S\+\$\/i\.test\(base\)/;
  assert.ok(re.test(line), "拦截读的不是洗过的 base——洗了也白洗");
  assert.ok(/\(base \|\| "（空）"\)/.test(line), "报错回显的还是原始 baseUrl——她只会看见一行看起来没问题的地址");
});

// ⚠️同一个形状只许有一份（one-public-mechanism）：拉模型、发消息、测向量、语音
// 四条路以前各写各的洗法，漏掉哪一条都是这次这种「一半能用」的毛病。
test("四条路都走同一份洗法，没人再自己写一遍", () => {
  assert.ok(engine.includes("let base = cleanBaseUrl(value);"), "normalizedOpenAIBase 没改走公共那份");
  assert.equal((engine.match(/cleanBaseUrl\(/g) || []).length >= 7, true, "还有路没接上");
  // 老写法一处都不许留：它就是这次的病根
  assert.ok(!/\(p\.baseUrl \|\| ""\)\.replace\(\/\\\/\$\/, ""\)/.test(engine), "还留着只削斜杠不去空格的老洗法");
  assert.ok(!/c\.baseUrl\.replace\(\/\\\/\$\/, ""\)/.test(engine), "向量那条还留着老洗法");
});

test("保存的时候把地址一起洗掉，不是每次读的时候将就它", () => {
  assert.ok(/const tidy = l => l\.map\(p => Object\.assign\(\{\}, p, \{ baseUrl:/.test(screens),
    "设置页没有落盘前的清洗");
  assert.ok(screens.includes("cleanBaseUrl(p.baseUrl)"), "清洗没走 engine 那一份");
  assert.equal((screens.match(/onSave\(tidy\(/g) || []).length, 4, "有落盘的路没洗（四处：设为主用两处、保存、删除）");
  assert.ok(!/await onSave\(list,/.test(screens), "还有一处直接把没洗的 list 存进去了");
});
