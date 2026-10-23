// 群里 2026-10-23「多选选不到这条」：开着译文的气泡，点字是去开关译文，多选永远选不中
const assert = require("node:assert/strict");
const rd = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", f), "utf8");
assert.equal((rd("js/components.js").match(/"data-sel": selMode \? "1" : undefined/g) || []).length, 2, "单聊、群聊的气泡都要挂");
assert.match(rd("index.html"), /\[data-wk="bubble"\]\[data-sel="1"\] \* \{ pointer-events: none; \}/);
console.log("ok");
