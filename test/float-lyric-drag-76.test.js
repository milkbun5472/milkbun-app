const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const ui = fs.readFileSync("js/screens-ui.js", "utf8");
test("浮窗歌词：设置开着才能拖，松手存 free 位置", () => {
  assert.match(ui, /pointerEvents: editing \? "auto" : "none"/);
  assert.match(ui, /setFloatLyricPrefs\(\{ pos: "free", fx:/);
  assert.match(ui, /useEffect\(\(\) => \{ setFloatLyricEdit\(!!flOpen\); return \(\) => setFloatLyricEdit\(false\); \}, \[flOpen\]\)/);
});
