// 她 2026-10-16：「日记生图能不能搞删除」——删照片不删日记，图库那份一起清，按钮先问一句（她 2026-10-16「为什么不搞提示框」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = (fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8"));
test("删照片日记：只拿掉 photoStrip，清掉图库那张，按钮先确认", () => {
  const i = app.indexOf("const delPhotoDiary = "), j = app.indexOf("const addMyDiaryEntry", i);
  assert.ok(i > 0 && j > i, "抠不出 delPhotoDiary");
  const f = app.slice(i, j);
  assert.match(f, /const \{ photoStrip, \.\.\.rest \} = e; return rest;/);
  assert.match(f, /idbImgDel\(key\)/);
  assert.doesNotMatch(f, /requestAppConfirm|confirm\(/);
  assert.match(app, /onDelPhotoDiary: delPhotoDiary/);
  assert.match(scr, /"data-wk": "photodiarydel", onClick: \(\) => requestAppConfirm\([^\n]*onDelPhoto\(entry\)/);
});
