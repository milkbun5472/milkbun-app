const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const E = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), U = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
test("语音多一家 OpenAI 格式：/v1/audio/speech，设置页能选", () => {
  assert.match(E, /const TTS_PROVIDERS = \[[^\]]*"openai"/);
  assert.match(E, /if \(a\.provider === "openai"\) return !!a\.oaKey;/);
  assert.match(E, /"\/v1\/audio\/speech"/);
  assert.match(E, /response_format: "mp3"/);
  assert.match(U, /\["openai", "OpenAI 格式"\]/);
  assert.match(U, /set\(\{ oaBase: /); assert.match(U, /set\(\{ oaKey: /);
});
