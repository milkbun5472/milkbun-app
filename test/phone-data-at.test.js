// 她 2026-11-02 转群友：「查手机可以看到哪些刷新了哪些没刷新吗？一次性刷新会有失败的，但不知道是哪些」
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "phone-ui.js"), "utf8");
// 刷成功的日子：那一份自带的 _at；没刷出来：只记内存（手机数据只许 savePhoneApp 一个口子写）
assert.match(app, /const entry = \{ \.\.\.merged, _at: Date\.now\(\) \};/);
assert.match(app, /const phoneMarkFail = \(charId, key\) => \{ try \{ const F = window\.__phoneFail/);
assert.match(app, /catch \(e\) \{ phoneMarkFail\(char\.id, key\); \/\* 单个失败不中断其余 \*\/ \}/, "一键全刷里单个失败记一笔");
assert.match(app, /phoneMarkFail\(char\.id, key\);\n\s*toast\(phoneKeyLabel\(key\) \+ "生成失败：/, "单独刷失败也记");
const f = new Function(ui.slice(ui.indexOf("function phoneAppFailed("), ui.indexOf("function PhoneDataSettings(")) + "; return { phoneAppFailed, phoneAppAtLabel };")();
const at = new Date(2026, 10, 2, 8, 5).getTime(), fail = new Date(2026, 10, 2, 9, 30).getTime();
assert.equal(f.phoneAppAtLabel({ _at: at }, 0), "11月2日 08:05 刷新的");
assert.equal(f.phoneAppAtLabel({ _at: at }, fail), "11月2日 09:30 刷新没刷出来 · 现在还是 11月2日 08:05 那份");
assert.equal(f.phoneAppFailed({ _at: fail + 1 }, fail), false, "后来刷成了就不算失败");
assert.equal(f.phoneAppAtLabel(undefined, fail), "11月2日 09:30 刷新没刷出来", "从没生成过、这次也没刷出来");
assert.equal(f.phoneAppAtLabel({}, 0), "存着一份");
assert.match(ui, /"data-wk": "phonedataat"/);
console.log("ok");
