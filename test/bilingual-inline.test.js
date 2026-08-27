const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => path.join(__dirname, "..", "js", f);
const engine = fs.readFileSync(R("engine.js"), "utf8");
const app = fs.readFileSync(R("app.js"), "utf8");
const comp = fs.readFileSync(R("components.js"), "utf8");

const grab = name => {
  const i = engine.indexOf("function " + name);
  assert.ok(i >= 0, name + " 没了");
  return engine.slice(i, engine.indexOf("\n}\n", i) + 3);
};
const { splitBilingual, bilingualKey, bilingualRule } =
  new Function(grab("splitBilingual") + grab("bilingualKey") + grab("bilingualRule") +
    "\nreturn { splitBilingual, bilingualKey, bilingualRule };")();

// 她 2026-08-26：「让模型生成时额外生成翻译」。免费接口把
// 「傘さすか迷うレベルで湿気すごい」翻成「您可能会迷失在雨伞中」，说这句话的人自己译不会。
test("「原文 | 中文」劈得开", () => {
  assert.deepEqual(splitBilingual("こっちは朝から小雨 | 这边从早上就在下小雨"),
    { text: "こっちは朝から小雨", zh: "这边从早上就在下小雨" });
  assert.deepEqual(splitBilingual("Hello | 你好"), { text: "Hello", zh: "你好" });
  assert.deepEqual(splitBilingual("Привет|你好"), { text: "Привет", zh: "你好" });
});

// 守卫宁可漏、不可错劈：一条正常消息被劈成两半是【看得见的】损坏。
test("带竖线的正常中文消息一根汗毛都不许动", () => {
  ["价格 3|5 元", "我5点|6点都行", "3|5", "今天天气不错"]
    .forEach(x => assert.equal(splitBilingual(x), null, x + " 不该被当成双语"));
});

test("形状不对的一律不认", () => {
  ["a|b|c", "|译文", "原文|", "same|same", "日本語 | japanese"]
    .forEach(x => assert.equal(splitBilingual(x), null, x + " 不该被当成双语"));
});

// 中译要挂在拆出来的最后一泡上，所以 key 得跟 stripTypingPeriod 削完的样子对得上
test("句尾那个句号被削掉之后，还找得回中译", () => {
  assert.equal(bilingualKey("寒いね。"), bilingualKey("寒いね"));
  assert.equal(bilingualKey("It's cold."), bilingualKey("It's cold"));
});

test("提示词单聊说「这个角色」，群里点名说是谁", () => {
  assert.ok(/这个角色/.test(bilingualRule("")));
  assert.ok(/「裴照川」/.test(bilingualRule("裴照川")));
  [bilingualRule(""), bilingualRule("阿屿")].forEach(r => {
    assert.ok(/原文 \| 中文/.test(r), "得把格式写清楚");
    assert.ok(/说中文的那些条/.test(r), "得说清中文消息不加竖线");
  });
});

// ——接线：新加的一层不许只写在一处（.claude/rules/four-surfaces-same-context.md）
const noComment = src => src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const appCode = noComment(app), compCode = noComment(comp);

test("拆双语必须排在拆气泡【之前】，不然长句会从竖线中间断开", () => {
  const i = appCode.indexOf("const _biZh = new Map();");
  assert.ok(i > 0, "单聊没接双语拆分");
  const seg = appCode.slice(i, i + 700);
  assert.ok(seg.indexOf("splitBilingual(w)") < seg.indexOf("splitLongBubble("), "顺序反了");
  assert.ok(/parts\[parts\.length - 1\]/.test(seg), "中译该挂在最后一泡上");
});

test("单聊和群聊两处都要接，一处都不许少", () => {
  assert.ok(/_biZh\.get\(bilingualKey\(words\[i\]\)\)/.test(appCode), "单聊气泡没带上 zh");
  assert.ok(/gBiZh\.get\(bilingualKey\(gBubbles\[j\]\)\)/.test(appCode), "群聊气泡没带上 zh");
  assert.ok(/const gBiHint =/.test(appCode) && /\+ gBiHint \+/.test(appCode),
    "群聊提示词声明了却没拼进 system——就是 v55.95 那个形状");
  assert.ok(/\$\{_biRuleLine\}/.test(appCode) && /const _biRuleLine =/.test(appCode),
    "单聊提示词没拼进协议");
});

test("开关按角色存得住", () => {
  assert.ok(/bilingual: !!s\.bilingual/.test(appCode), "没写进 x_chatSettings");
  assert.ok(/settings\.bilingual/.test(compCode) && /setBilingual/.test(compCode), "设置页没有这个开关");
  assert.ok(/dispRow\("外语消息自带中译"/.test(compCode), "设置页没有这一行");
});

// 她 2026-08-26：「我喜欢在旁边可以按翻译，不要放长按里面」——位置和交互一个字不许改
test("自带中译走的还是气泡旁边那个译键，不另起一套 UI", () => {
  assert.ok(/function TransText\(\{ text, isU, zhReady \}\)/.test(compCode), "TransText 没接自带中译");
  assert.ok(/zhReady \|\| \(cached && cached\.zh\)/.test(compCode), "有现成中译时该直接用");
  assert.ok(/zhReady \? \(_lang \|\| "外语"\)/.test(compCode), "探不出语种时也得给译键");
  const hits = compCode.match(/zhReady: m\.zh/g) || [];
  assert.equal(hits.length, 2, "单聊和群聊两个气泡都要把 m.zh 递进去，现在只有 " + hits.length + " 处");
});

test("自带中译不再去调免费接口", () => {
  const i = compCode.indexOf("function TransText(");
  const seg = compCode.slice(i, compCode.indexOf("\n}\n", i));
  assert.ok(/lang && !zhReady && typeof transCacheGet/.test(seg), "有自带中译时不该再查翻译缓存");
  assert.ok(/if \(zh \|\| busy\) return;/.test(seg), "run 得在已有译文时直接返回");
});
