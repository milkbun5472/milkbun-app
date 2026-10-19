// 她 2026-10-18：音色库「补录」那一行，长 voice_id 把按键挤出屏，补录不了
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "screens-ui.js"), "utf8");
assert.match(src, /placeholder: "补录已有的 voice_id", style: Object\.assign\(\{\}, inSt, \{ flex: 1, width: "auto", minWidth: 0 \}\)/);
assert.match(src, /flexShrink: 0, minHeight: 40 \} \}, "补录"\)/);
console.log("ok");
