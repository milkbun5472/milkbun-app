// 群友 2026-10-07：「能设置动描字数吗」「能不能选择把小房间设成一进来的页面」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const A = R("app.js"), C = R("components.js"), E = R("engine.js");

test("动描一小段：ACT_MEANING 不动，开了才补一句", () => {
  assert.match(E, /const ACTLINE_LONG_RULE = "【动描写多长】/);
  assert.match(A, /\(_actDesc && _s\.actLong \? "\\n\\n" \+ ACTLINE_LONG_RULE : ""\)/);
  assert.match(A, /\(_gActDesc && gs\.actLong \? "\\n\\n" \+ ACTLINE_LONG_RULE : ""\)/);
  assert.match(A, /actLong: !!s\.actLong,/);
  assert.match(C, /const \[actLong, setActLong\] = useState\(!!settings\.actLong\);/);
  assert.match(C, /const \[gActLong, setGActLong\] = useState\(!!gs\.actLong\);/);
  assert.match(C, /onSave\(\{ actLong: gActLong,/);
});
test("状态卡动作长了不撑爆：最多四行，点开看全", () => {
  assert.match(C, /function ClampText\(\{ text, lines, style \}\)/);
  assert.match(C, /WebkitLineClamp: lines/);
  assert.match(C, /h\(ClampText, \{ style: \{ fontFamily: F_DISPLAY, fontSize: 15[^\n]*text: S\(state\.action\) \}\)/);
});
test("点进来先进哪间房：主聊天 / 上次 / 指定，房没了回主聊天", () => {
  assert.match(A, /const pick = \(settingsFor\(activeChar\.id\) \|\| \{\}\)\.enterRoom;/);
  assert.match(A, /pick === "last" \? \(loadJSON\("x_lastRoom", \{\}\) \|\| \{\}\)\[activeChar\.id\]/);
  assert.match(A, /return r && !r\.main \? rid : "main";/);
  assert.match(A, /saveJSON\("x_lastRoom", m\)/);
  assert.match(A, /enterRoom: typeof s\.enterRoom === "string"/);
  assert.match(C, /"点进来先进哪间房"/);
});
