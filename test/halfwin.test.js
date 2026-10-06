const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("半窗：加号里开，和整屏用同一个 ChatThread", () => {
  assert.match(cmp, /\["halfwin", "半窗", "halfwin"\]/);
  assert.match(app, /else if \(screen === "thread" && activeChar\) body = mkThread\(\);/);
  assert.match(app, /mkThread\(\{ key: "half::" \+ activeChar\.id, halfMode: true/);
});
test("半窗：TA这一轮读得到上半屏那一页", () => {
  assert.match(app, /const _halfSeen = halfWinRef\.current && halfWinRef\.current\.charId === charId && screenRef\.current !== "thread" \? halfWinScreenText\(\) : null;/);
  assert.match(app, /\+ _halfHint \+ _stateBootstrapHint/);
  assert.match(app, /closest\("\[data-halfwin\],\[data-assistant-dock\]"\)/, "读屏幕时跳过半窗自己和秋秋浮球");
});
test("半窗里聊天顶栏不留刘海安全区", () => {
  assert.match(cmp, /paddingTop: halfMode \? 6 : safeTop\(20\),/);
});
test("半窗像秋秋小屏一样整块拖：顶条挪位置，小横杠调大小，记住", () => {
  assert.match(app, /"data-wk": "halfwinbar", onPointerDown: e => dragOn\(e, "move"\)/);
  assert.match(app, /"data-wk": "halfwinsize", "aria-label": "按住拖调大小", onPointerDown: e => \{ e\.stopPropagation\(\); dragOn\(e, "size"\); \}/);
  assert.match(app, /localStorage\.setItem\("x_halfWinBox"/);
});
test("收起后的小条也能拖，拖过那一下不算点", () => {
  assert.match(app, /localStorage\.setItem\("x_halfWinPill"/);
  assert.match(app, /if \(!halfPillDragged\.current\) setHalfWin\(w => w \? \{ \.\.\.w, min: false \} : w\);/);
});
