// 弹窗说留了悄悄话，抽屉里却是空的（群友 2026-10-13）：真放进去了才报
const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("genWhisper 回报有没有真放进抽屉，主动那一路没放成就不弹", () => {
  assert.match(app, /return drawerWhisper\(char\.id, String\(d && d\.whisper \|\| ""\)\.trim\(\)\);/);
  assert.match(app, /else if \(type === "whisper"\) \{ if \(!\(await genWhisper\(char\)\)\) return; notifyApp\("whisper"\);/);
});
