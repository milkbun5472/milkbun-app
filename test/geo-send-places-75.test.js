// 她 2026-10-14：发位置能从去处／架空世界的地点里挑，加个小开关把自己位置也改过去
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8"), app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(c, /function GeoStampSheet\(\{ recent, places, onMoveMe, onClose, onSend \}\)/);
assert.match(c, /"data-wk": "geomoveme"/);
assert.match(c, /places: invitePlaces \|\| \[\],\n    onMoveMe: onSetMyPlace \|\| null,/);
assert.match(app, /pins: \{ \.\.\.\(x\.pins \|\| \{\}\), __me: p\.name \}/);
assert.match(app, /else if \(p && p\.name\) doSetGeoPlace\(p\.name\)/);
console.log("ok");
