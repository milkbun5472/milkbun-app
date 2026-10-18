// 通话台词照语音条写法（她 2026-10-18）：提示词两路都接上，气泡和字幕剥标记
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
test("单人、群通话都带 callVoiceHint；只有开着播报的才教标记", () => {
  assert.match(app, /callBiHint \+ callVoiceHint \+ cameraHint;/);
  assert.match(app, /sys \+ callBiHint \+ callVoiceHint \+ cameraHint,/);
  assert.match(app, /callVoiced \? \(typeof VOICE_PAUSE_MARK/);
});
test("气泡、字幕、通话记录都过 callShow", () => {
  assert.match(comp, /const text = typeof ttsMarkStrip === "function" \? ttsMarkStrip\(String\(\(line && line\.text\) \|\| ""\)\)/);
  assert.equal((comp.match(/text: callShow\(/g) || []).length, 3);
});
