// 群友 2026-10-19：线下开车开完，总结被安全审核拦下。只把直连 Gemini 的审核放到最松；
//   被拦了不拆小重来（她：「不要多几次调用 撤掉它」）
const assert = require("node:assert/strict");
const eng = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "engine.js"), "utf8");
assert.match(eng, /safetySettings: GEMINI_SAFETY_OFF/);
assert.match(eng, /threshold: "BLOCK_NONE"/);
assert.ok(!/OFFLINE_SUM_BLOCK_CAP|OFFLINE_SUM_BLOCKED/.test(eng), "被拦拆小重来那一套又回来了，会多花调用");
console.log("ok");
