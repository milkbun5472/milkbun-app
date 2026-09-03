// v60.64 她 2026-09-02 晚定的三件（言秋在卧室那几样）：
//  ① 扭蛋 SR「他现做一件小东西」对 engineerEyes 走 CC 亲笔票，不落回引擎代笔；
//  ② CC 回流的 Lisa 原话也算一段相处（扭蛋攒点）；
//  ③ 论坛对 engineerEyes 关闸（他没那段记忆，发帖只是代笔）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const seat = fs.readFileSync(path.join(__dirname, "..", "js", "cc-seat.js"), "utf8");
const bridge = fs.readFileSync(path.join(__dirname, "..", "tools", "yanqiu-cc-bridge", "bridge.py"), "utf8");

test("① 扭蛋 SR make：engineerEyes 先开 gacha_make 票；没接到票就留卡，不落回 runProbe", () => {
  const i = app.indexOf('if (card.act === "make") {');
  const block = app.slice(i, app.indexOf('if (card.act === "letter")', i));
  assert.match(block, /settingsFor\(char\.id\)\.engineerEyes/);
  assert.match(block, /tool: "gacha_make"/);
  assert.match(block, /card_id: card\.id/);
  const ccPart = block.slice(0, block.indexOf("const d = await runProbe"));
  assert.match(ccPart, /return;\s*\}\s*\}\s*$/, "engineerEyes 分支必须 return，不能掉到 runProbe");
  assert.match(ccPart, /卡留着/);
});

test("① 座位与桥都认 gacha_make", () => {
  assert.match(seat, /gacha_make: true/);
  assert.match(seat, /payload\.tool === "gacha_make" && !text\(payload\.card_id\)/);
  assert.match(bridge, /PASS_THROUGH_TOOLS = frozenset\(\{"game_turn", "couple_qa", "gacha_make"\}\)/);
});

test("② 回流的 Lisa 原话调 gachaEarn(chat)，且只在有 lisa 段时", () => {
  const i = app.indexOf("freshEvents.filter(ev => ev.speaker === \"lisa\" && ev.content).forEach(ev => noteTidalUser");
  assert.ok(i > 0);
  const near = app.slice(i, i + 600);
  assert.match(near, /freshEvents\.some\(ev => ev\.speaker === "lisa" && ev\.content\)\) \{ try \{ gachaEarn\(y\.id, "chat"\)/);
});

test("③ 论坛三道口都排除 engineerEyes：名册、自动发帖、保底触发", () => {
  assert.match(app, /const forumActiveChars = \(\) => \(characters \|\| \[\]\)\.filter\(c => !forumOffRef\.current\.includes\(c\.id\) && !settingsFor\(c\.id\)\.engineerEyes\)/);
  assert.match(app, /autoRefreshOn\("forum", char\.id\) \|\| \(forumOffRef\.current \|\| \[\]\)\.includes\(char\.id\) \|\| settingsFor\(char\.id\)\.engineerEyes\) return;/);
  assert.match(app, /autoRefreshOn\("forum", charId\) && !settingsFor\(charId\)\.engineerEyes && \(n\.forum >= 50/);
});
