// 群友 2026-10-20：钱包「把余额改成」填个长数字，输入框把「保存」挤出屏外，改不了
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "screens-ui.js"), "utf8");
assert.equal((src.match(/inputMode: "decimal", autoFocus: true, className: "flex-1 min-w-0 outline-none/g) || []).length, 2, "两处改余额的输入框都要能缩");
assert.equal((src.match(/onClick: saveEdit, className: "shrink-0 /g) || []).length, 2, "保存键不许被挤走");
console.log("ok");
