// 一起听：每首都用同一张封面（群里 2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
test("固定的那张压过每首歌自己的封面", () => {
  assert.match(ui, /const coverSrc = now \? \(coverFixed \|\| nowCover \|\| discImg \|\| ""\) : "";/);
  assert.match(ui, /onSetFixedCover\(coverFixed \? "" : coverSrc\)/);
  assert.match(ui, /minHeight: 40/);
  assert.match(app, /onSetFixedCover: v => saveListen\(p => \(\{ \.\.\.p, coverFixed: v \|\| "" \}\)\)/);
  assert.match(ts, /"listencoverall"/);
});
