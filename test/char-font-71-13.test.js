// 她 2026-09-18：「宝宝字体能不能聊天里的字体按角色单独设置啊」
//
// 走的是【已经有的那条缝】：applyChatLook（components.js）——这个聊天窗自己那几层
// 长相本来就在那儿层层压上去，皮肤、气泡、背景图都是。字体只是多加一层。
// 而全 App 的字只有 --f-body / --f-display 两个变量（core.js），所以「只给 TA 换字」
// 就是在这一个窗口的作用域里把那两个变量改掉——一处气泡代码都不用动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../js/font-choice.js");

const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

const SCOPE = 'html[data-lisa-screen="thread"][data-lisa-char="c1"]';

test("挑了就只盖这一个窗口，作用域比全局那份具体", () => {
  const css = F.cssVars({ body: "heiti" }, [], null, SCOPE);
  assert.ok(css.includes(SCOPE + " {"), "没限死到这个人这一页");
  assert.ok(!css.includes(":root"), "限了作用域还发 :root，会盖掉所有人的");
  // 不传作用域还是 :root（主题工作台那条路一个字都不变）
  assert.ok(F.cssVars({ body: "heiti" }).includes(":root {"));
});

// ⚠️@font-face 是【声明一支字】，不是给谁用。加了作用域就没有任何字族被声明，
//   变量指过去也是空的——屏幕上会变成没有字。
test("@font-face 永远不加作用域，只有变量那一块限", () => {
  const cus = [{ id: "a1", kind: "file", name: "文楷", ref: "iv_z" }];
  const css = F.cssVars({ body: "u:a1" }, cus, () => "blob:x", SCOPE);
  assert.ok(css.indexOf("@font-face") < css.indexOf(SCOPE), "@font-face 该排在变量前面");
  assert.ok(!/html\[data-lisa-screen[^\n]*@font-face/.test(css), "@font-face 被套上作用域了");
  assert.ok(css.includes("@font-face {\n  font-family: 'lisa-u-a1'"), "@font-face 没发出来");
  assert.ok(css.includes(SCOPE + " {\n  --f-body: 'lisa-u-a1'"), "变量没限到这个窗口");
});

test("接的是已经有的那几层，没另开一条路", () => {
  const i = comp.indexOf("function applyChatLook(next)"), j = comp.indexOf("function applyBubbleSkinCSS(", i);
  assert.ok(i > 0 && j > i, "抠不出 applyChatLook");
  const seg = comp.slice(i, j);
  assert.ok(seg.includes('put("wk-char-font-css"'), "字体没进 applyChatLook 那一摞");
  // 离开这个聊天窗要整块发空，不然上一个人的字会留在页面上
  assert.ok(/put\("wk-char-font-css", \(scope && L\.fontCSS\) \? L\.fontCSS : ""\);/.test(seg),
    "没有 scope 时该发空——不然换个人还留着上一个人的字");
  assert.ok(app.includes("fontCSS: charFontCSS(s.font, scope)"), "app 那头没把这个人的字传进来");
});

test("名单只有一份：聊天窗这儿不另抄字体表", () => {
  assert.ok(comp.includes("F.facesWith(cus)"), "设置页自己拼了一份名单");
  assert.ok(app.includes("window.FontChoice.cssVars("), "app 自己编了一份字体 CSS");
  // 自己传的那几支存在主题那份里，聊天窗只是读它
  assert.ok(app.includes("window.ThemeStudio.current()") && app.includes("_prof.customFonts"), "app 没去读自己传的那几支");
  // 只看「只给 TA 换字」那一块：别处早有一处转盘标签写死了 Noto Sans SC，跟字体名单无关
  const a = comp.indexOf("只给 TA 换字"), b = comp.indexOf("只给 TA 换气泡", a);
  assert.ok(a > 0 && b > a, "抠不出「只给 TA 换字」那一块");
  assert.ok(!/Noto Sans SC|ZCOOL|Ma Shan Zheng|Fraunces/.test(comp.slice(a, b)), "那一块里出现了具体字体名——名单只归 FontChoice 管");
});

// ⚠️这一条跟皮肤、气泡那两格是同一条规矩：没有「跟随全局」就退不回去，
//   改一次就永远脱离全局了。
test("第一档永远是跟随全局，退得回去", () => {
  assert.equal(F.FACES[0].key, "");
  assert.ok(comp.includes('f.key ? f.zh : "跟随全局"'), "第一档的字样改成了别的，退不回去");
  assert.equal(F.cssVars({ body: "", display: "" }, [], null, SCOPE), "", "两支都跟随全局就该一个字都不发");
  // 只挑了正文时，标题仍旧跟随全局
  const css = F.cssVars({ body: "heiti", display: "" }, [], null, SCOPE);
  assert.ok(css.includes("--f-body") && !css.includes("--f-display"));
});

test("存档里存的是洗过的那两支，删掉的自定义字体不许留在某个人身上", () => {
  assert.ok(/\n      font,\n/.test(comp), "这个人的字没跟着设置一起存");
  assert.ok(/\n            font: \(window\.FontChoice/.test(app), "存档那头没接住这个人的字，点了保存会变回去");
  assert.deepEqual({ ...F.clean({ body: "u:没了", display: "heiti" }, []) }, { body: "", display: "heiti" });
  assert.equal(F.cssVars({ body: "u:没了" }, [], () => "blob:x", SCOPE), "", "字体删了，某个人的窗口还指着它");
});
