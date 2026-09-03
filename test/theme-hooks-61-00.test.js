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

test("挂点只是名字，不带任何样式——加了不该改变现在的长相", () => {
  // data-wk 那几行里不许夹带 style / className
  const lines = comp.split("\n").filter(l => l.indexOf('"data-wk"') >= 0);
  assert.ok(lines.length >= 9, "挂点行数不对");
  lines.forEach(l => {
    assert.ok(l.indexOf("style:") < 0, "挂点那一行顺手改了样式：" + l.trim());
    assert.ok(l.indexOf("className:") < 0, "挂点那一行顺手改了 class：" + l.trim());
  });
});
