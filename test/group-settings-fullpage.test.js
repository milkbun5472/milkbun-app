const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("群聊设置是整页，不是半窗（no-half-sheet.md）", () => {
  const i = src.indexOf("function GroupSettingsSheet(");
  const seg = src.slice(i, src.indexOf("\nfunction ", i + 10));
  assert.doesNotMatch(seg, /return h\(Sheet, \{ onClose: onClose, tall: true \}/);
  assert.match(seg, /return ReactDOM\.createPortal\(h\("div", \{ "data-wk": "gsetpage"/);
  assert.match(seg, /h\(Head, \{ bg: "transparent", zh: "群聊设置"/);
});
