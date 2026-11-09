// 回到 app 音乐没声、播放暂停都没用（她 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("播着进度却不走：在原位置重装这首再放；回前台、点播放、自动续放三处都看一眼", () => {
  assert.match(app, /const kickStuckAudio = \(\) => \{/);
  assert.match(app, /if \(Math\.abs\(el\.currentTime - t0\) > 0\.2\) return;/);
  assert.match(app, /el\.addEventListener\("loadedmetadata", seek\); el\.src = src; el\.load\(\);/);
  assert.match(app, /setTimeout\(kickStuckAudio, 900\)/);
  assert.match(app, /setPlayer\(p => \(\{ \.\.\.p, playing: true \}\)\); kickStuckAudio\(\); \}\n\s+else \{ userPauseRef/);
  assert.match(app, /playing: true \}\)\); kickStuckAudio\(\); \}\)/);
});
