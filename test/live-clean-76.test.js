// 直播间清屏看画面（2026-11-01 群里许愿）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "live.js"), "utf8");
test("有画面时顶上有「清屏」，清屏只留画面、点一下回来", () => {
  assert.match(src, /bgSrc \? h\("button", \{ "data-wk": "liveclean", onClick: \(\) => setClean\(true\)/);
  assert.match(src, /if \(clean && bgSrc\) return h\("div", \{ "data-wk": "liveroom", "data-part": "clean", onClick: \(\) => setClean\(false\)/);
});
