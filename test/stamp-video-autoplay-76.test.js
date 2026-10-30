const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/stamps.js", "utf8");
test("卡面视频挂上就补静音、自己 play()：iPhone 不靠 autoPlay", () => {
  assert.match(src, /const kickVid = v => \{ if \(!v\) return; v\.muted = true; v\.defaultMuted = true;/);
  assert.match(src, /const loopVid = \(url, extra\) => h\("video", \{ ref: kickVid,/);
});
test("卡面视频能单独用系统播放器放（排查用）", () => {
  assert.match(src, /单独播放这段视频（带进度条）/);
});
test("翻到哪一面动哪一面：满级、番外各存各的视频，备份也带上", () => {
  assert.match(src, /onClick: \(\) => runStampVideo\(card, toast, true, side, sideKey\)/);
  assert.match(src, /const vSlot = side === "main" \? card\.video : \(card\.videos \|\| \{\}\)\[side\];/);
  assert.match(src, /\{ videos: Object\.assign\(\{\}, cur\.videos \|\| \{\}, \{ \[slot\]: r\.draftRef \}\) \}/);
  const va = fs.readFileSync(__dirname + "/../js/video-api.js", "utf8");
  assert.match(va, /if \(c && c\.videos\) Object\.values\(c\.videos\)\.forEach/);
});
