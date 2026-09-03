// 主题工作台的预览必须跟【真页面同一套挂点】（她 2026-09-03：贴了 CSS「不行啊」）。
// 原来预览是自己编的一套 header / .message-bubble / footer，真页面上一个都没有：
// 照真页面写的 CSS 在预览里毫无反应，照预览调好的又跟上机不一样——
// 预览在骗人，比没有预览更坏。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio-ui.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("单聊预览用的挂点，跟真单聊那一屏是同一套", () => {
  const i = ui.indexOf('previewPage === "thread"');
  const seg = ui.slice(i, i + 1800);
  ["chat", "chathead", "body", "msg", "time", "row", "avatar", "bubble", "composer"].forEach(k => {
    assert.ok(seg.indexOf('data-wk="' + k + '"') >= 0, "预览里少了 data-wk=" + k);
    assert.match(comp, new RegExp('"data-wk": "' + k + '"'), "真页面里少了 data-wk=" + k);
  });
  // 我和他、图片那种气泡也要认得出——CSS 只改一侧时靠它
  assert.match(seg, /data-me="' \+ \(me \? 1 : 0\) \+ '"/);
  assert.match(seg, /data-kind="text"/);
});

test("旧写法不许一夜失效：.message-bubble 那几个 class 留着", () => {
  const i = ui.indexOf('previewPage === "thread"');
  assert.match(ui.slice(i, i + 1800), /class="message-bubble ' \+ \(me \? "me" : "them"\) \+ '"/);
});
