// 每天替她抽的今日签不算「上次说话」（她 2026-11-04：今日签一来，主动那道 45 分钟的闸又从头数）
const test = require("node:test");
const assert = require("node:assert/strict");
const a = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("一份判据，主动那两处都问它", () => {
  assert.match(a, /const autoPostNotTalk = m => !!m && \(m\.kind === "system" \|\| m\.kind === "stampletter" \|\| m\.kind === "stampbdletter" \|\| \(m\.kind === "astroshare" && m\.role === "char"\)\);/);
  assert.equal((a.match(/!isOocMsg\(m\) && !autoPostNotTalk\(m\)/g) || []).length, 2);
});
