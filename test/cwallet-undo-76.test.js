// 她 2026-10-23：他钱包「为你花的」里的小票删不了（旅行扣了两次）——撤销一笔：拿掉这一行，钱退回去
const assert = require("node:assert/strict");
const rd = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", f), "utf8");
const app = rd("app.js"), ui = rd("screens-ui.js");
assert.match(app, /const undoCharWalletEntry = \(charId, entryId\) =>/);
assert.match(app, /balance: r2\(\(Number\(cur\.balance\) \|\| 0\) - \(Number\(e\.delta\) \|\| 0\)\)/);
assert.match(app, /onUndoEntry: undoCharWalletEntry,/);
assert.match(ui, /"data-wk": "cwundo"/);
assert.match(rd("assistant-manual.js"), /钱按原数退回他的钱包/);
console.log("ok");
