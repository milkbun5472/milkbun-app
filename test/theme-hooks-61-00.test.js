// 主题工作室的挂点（v61.00）。她 2026-09-03 要一份「仿微信」的 CSS 贴进
// 「单聊」那一页，可这一屏的气泡全是内联样式、一个 class 都没有——
// 用户只能写 [style*="pre-wrap"] 这种一碰就碎的选择器。
//
// ⚠️这些 data-wk 是【对外的名字】：别人照着它写好的主题存在自己机器上，
// 改名或删掉就等于把人家的主题弄坏了。所以钉在这儿。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("单聊那一屏该有的挂点，一个都不许少", () => {
  ["chat", "chathead", "body", "msg", "time", "row", "avatar", "bubble", "composer"]
    .forEach(k => assert.match(comp, new RegExp('"data-wk": "' + k + '"'), "少了 data-wk=" + k));
});

test("我和他分得开，图片那种气泡也认得出", () => {
  // 气泡和整条消息都带 data-me，CSS 才能只改一侧
  assert.match(comp, /"data-wk": "msg", "data-me": isU \? "1" : "0"/);
  assert.match(comp, /"data-wk": "bubble", "data-me": isU \? "1" : "0", "data-kind": m\.kind \|\| "text"/);
});

test("挂点只是一个写死的名字，夹带不了任何东西", () => {
  // 原来这条是靠「data-wk 那一行里不许出现 style:」来保证「加挂点不改长相」的。
  // 那是个代理判据，只在【挂点都落在没样式的元素上】时才成立。
  // v61.39 起挂点要落到卡片盒子、群聊外壳这些【本来就带样式】的元素上——
  // 皮肤要改的恰恰就是它们。照旧那么查，等于禁止给任何有样式的东西挂点。
  // 改成查真正查得到的那一半：名字必须是写死的字符串字面量，
  // 拼不进变量、模板串或表达式，也就带不进任何值。
  const all = [...comp.matchAll(/"data-wk":\s*([^,\n]+)/g)].map(m => m[1].trim());
  assert.ok(all.length >= 30, "挂点只剩 " + all.length + " 个，是不是被删了");
  const bad = all.filter(v => !/^"[a-z]+"$/.test(v));
  assert.deepEqual(bad, [], "这些挂点不是写死的名字，能把值夹带进 DOM：\n  " + bad.join("\n  "));
});
