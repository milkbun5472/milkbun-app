// 群友 2026-10-14 许愿：一起读里让 TA 念正文
const test = require("node:test");
const assert = require("node:assert/strict");
const r = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "read.js"), "utf8");
test("TA 念：一段一段走 ttsSpeak，只提前合成一段（ttsWarm），念完自己翻页，可设念完这页就停", () => {
  assert.match(r, /const narrPlay = async function \(pg, idx, run\)/);
  assert.match(r, /ttsWarm\(next\.text, partner\.voiceId\)/);
  assert.match(r, /book\.narrStop !== "page" && pg < totalPages - 1\) \{ gotoPage\(pg \+ 1\)/);
  assert.match(r, /"data-wk": "readnarr"/);
  assert.match(r, /tp\.toggle\("rselread", sel\.text, partner\.voiceId\)/);
});
test("太长的段落切成两三百字一截", () => {
  assert.match(r, /s0\.length <= 280 \? \[s0\]/);
});
