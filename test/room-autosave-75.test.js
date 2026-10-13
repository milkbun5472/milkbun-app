// 房间设置改了就存（她 2026-10-13：「右上角的保存跟装饰似的」——嵌在聊天设置里，右上角存的不是房间）
const assert = require("node:assert");
const comp = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(comp, /if \(!creating && Kit && n && n\.id\) \{ const saved = Kit\.save\(character\.id, n\);/);
console.log("ok");
