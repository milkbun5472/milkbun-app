// 打电话时语音只念原文，不念中译（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("通话自动播报、预取、手点回听都走 sayTextOf", () => {
  assert.match(c, /synth\(sayTextOf\(m\), spk2\.voiceId\)/);
  assert.match(c, /synth\(sayTextOf\(nx\.m\), nx\.spk\.voiceId\)/);
  assert.match(c, /tp\.toggle\(messageKey, sayTextOf\(m\), spk\.voiceId/);
  assert.ok(!/synth\(m\.content|synth\(nx\.m\.content|tp\.toggle\(messageKey, m\.content/.test(c));
});
