// 整理主屏时翻页（2026-10-29 群里许愿）：两边箭头、点页码跳页；摸到图标按住一小下才拿起，滑一下就是翻页
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("整理模式有左右箭头，到头那边不出", () => {
  assert.match(src, /editMode && curLayout\.length > 1 && page > 0 && h\("button", \{ "data-wk": "pagerarrow", "data-part": "prev"/);
  assert.match(src, /page < curLayout\.length - 1 && h\("button", \{ "data-wk": "pagerarrow", "data-part": "next"/);
});
test("整理模式点页码的点跳页；平时页码不挡点击", () => {
  assert.match(src, /onClick: editMode \? function \(\) \{ goPage\(pi\); \} : undefined/);
  assert.match(src, /\(editMode \? "" : " pointer-events-none"\)/);
});
test("整理模式摸到图标不立刻拿起", () => {
  assert.match(src, /if \(editMode\) lpRef\.current = setTimeout\(function \(\) \{ lpRef\.current = null; pickUp\(\); \}, 140\)/);
});
