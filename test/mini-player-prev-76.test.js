// 悬浮播放条有「上一首」（2026-11-02 群里许愿）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("MiniPlayer 收 onPrev、画一颗上一首；app 接到 stepSong(-1)", () => {
  assert.match(comp, /function MiniPlayer\(\{ song, playing, loading, onOpen, onToggle, onNext, onPrev, onClose \}\)/);
  assert.match(comp, /onPrev \? h\("button", \{ "aria-label": "上一首"/);
  assert.match(app, /onPrev: \(\) => stepSong\(-1\),/);
});

// 加了「上一首」以后歌名不许被挤没（她 2026-11-02）
{
  const assert = require("node:assert/strict");
  const comp = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
  assert.match(comp, /"data-wk": "miniplayertitle", style: \{ flex: "1 1 auto", minWidth: 64,/);
  assert.match(comp, /gap: 5, maxWidth: "88vw", touchAction: "none"/);
}
