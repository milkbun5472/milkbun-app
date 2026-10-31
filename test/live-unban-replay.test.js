// 片刻直播：往下播间隔放到 10 分钟、房管能解禁、主播那句能再听（群友 2026-10-31）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "live.js"), "utf8");
test("自动往下播间隔上限 600 秒", () => {
  assert.match(src, /Math\.min\(600, Number\(props_autoSec\) \|\| 25\)/);
  assert.match(src, /type: "range", min: 10, max: 600, step: 10/);
});
test("房管能解禁：被禁的那人弹幕右边「解禁」", () => {
  assert.match(src, /const unban = n => addEvent\(x => \(\{ \.\.\.x, banned: arr\(x\.banned\)\.filter\(y => y !== n\) \}\)/);
  assert.match(src, /onBan: ban, onUnban: unban,/);
  assert.match(src, /"data-wk": "liveunban", onClick: \(\) => onUnban\(l\.name\)/);
});
test("主播那句能再听", () => {
  assert.match(src, /isHost && replayC && l\.text \? h\("button", \{ "data-wk": "livereplay"/);
});
test("主播不自己下播：形状里没有 end，也不认 d.end", () => {
  assert.doesNotMatch(src, /"end":false/);
  assert.doesNotMatch(src, /d\.end === true/);
  assert.doesNotMatch(src, /你要不要下播 end/);
});
