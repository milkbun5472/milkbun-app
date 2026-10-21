// 群友 2026-10-14：线下的时间显示也要跟虚拟时间同步，现在还是真实时间
const assert = require("node:assert/strict");
const c = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(c, /fmtStamp\(m\.ts, clockId !== undefined \? clockId : \(char \? char\.id : undefined\)\)/);
assert.match(c, /clockId: group && group\.id \? "g:" \+ group\.id : undefined/);
// 单聊、群聊气泡底下那个几点，都走 engine.js 的 fmtMsgClock，照各自的钟（单聊照角色，群照 "g:"+群id）
assert.match(c, /const fmtT = ts => fmtMsgClock\(ts, character \? character\.id : null, dsp\.timeSec\)/);
assert.match(c, /const fmtT = ts => fmtMsgClock\(ts, group && group\.id \? "g:" \+ group\.id : null, gsp\.timeSec\)/);
assert.match(require("fs").readFileSync(require("path").join(__dirname, "..", "js/engine.js"), "utf8"), /function fmtMsgClock\(ts, clockId, withSec\) \{\n  const d = new Date\(clockId != null && typeof vclockMap === "function" \? vclockMap\(ts \|\| Date\.now\(\), clockId\)/);
console.log("ok");
