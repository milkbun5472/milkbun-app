const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("JSON 里只交了表情、话写在 JSON 外面：外面那段当她收到的话，不报「没回上来」", () => {
  assert.match(app, /const _outside = \(_a >= 0 && _b > _a \? \(_rs\.slice\(0, _a\) \+ "\\n" \+ _rs\.slice\(_b \+ 1\)\) : ""\)/);
  assert.match(app, /if \(_outside && !_jsonBits && !protocolFieldRe\.test\(_outside\)\)/);
  assert.match(app, /if \(_lines\.length\) parsed\.word = _lines\.slice\(0, 12\);/);
});
