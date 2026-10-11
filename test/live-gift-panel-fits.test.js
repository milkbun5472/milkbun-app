// 她 2026-10-11：「我点礼物然后点不了了因为被推下去了」——不肯缩的几块加起来比屏幕高，底下的礼物面板和输入栏被挤出去
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const live = fs.readFileSync(__dirname + "/../js/live.js", "utf8");
const shua = fs.readFileSync(__dirname + "/../js/shua.js", "utf8");

test("礼物面板自己里面滚；弹幕区能让位；嵌在短视频里时直播间铺满那一格", () => {
  assert.match(live, /"data-wk": "livegiftpanel", style: \{ maxHeight: "34vh", overflowY: "auto"/);
  const i = live.indexOf('"data-wk": "livemsglist"'); assert.ok(i > 0);
  const seg = live.slice(i, i + 260);
  assert.doesNotMatch(seg, /shrink-0/, "弹幕区又不肯缩了");
  assert.match(seg, /flexShrink: 1, minHeight: 56/);
  assert.match(shua, /"data-wk": "shualive", className: "flex-1 min-h-0", style: \{ position: "relative" \} \}, h\("div", \{ style: \{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" \} \}/);
});
