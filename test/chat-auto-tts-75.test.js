// 群友 2026-10-14 许愿：单聊新消息自动合成语音并念，不用手点
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const c = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8"), app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(c, /if \(!\(dsp && dsp\.autoTts\)\) return;/);
assert.match(c, /fresh\.some\(\(\[m\]\) => m && m\.role === "user"\)\) \{ ttsQRef\.current = \[\];/, "她一发消息就停");
assert.match(c, /dispRow\("新消息自动念", autoTts, setAutoTts\)/);
assert.match(app, /autoTts: !!s\.autoTts,/, "存得下来");
assert.match(app, /autoTts: !!settingsFor\(activeChar\.id\)\.autoTts/);
console.log("ok");
