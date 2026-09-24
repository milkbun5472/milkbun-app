"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");
const host = rd("js/fairy-garden.js");
const app = rd("js/app.js");

// 她 2026-09-17：「我直接点击花圃但是没水了我要打开展开行动才能看到提示」
test("行动栏收起来的时候，那句提示照样看得见", () => {
  assert.match(html, /id="say-note"/);
  assert.match(css, /#say-note\{position:absolute/);
  assert.match(game, /const note=\$\('say-note'\),folded=\$\('panel-content'\)\.hidden;/);
  assert.match(game, /那句提示原来只长在行动栏里面/);
  // ⚠️只有 say() 这一处写提示
  assert.equal((game.match(/\$\('say-note'\)/g) || []).length, 1, "两处各写一份，迟早一处改了另一处还留着旧话");
});

// 她 2026-09-17：「我自己说话也要气泡」
test("她自己说的那句也浮在她头顶上", () => {
  assert.match(html, /id="player-bubble"/);
  assert.match(css, /#player-bubble\{background/);
  assert.match(game, /function speak\(lines,who='companion'\)\{/);
  // ⚠️谁说的就挂谁头上：她、同行者，或者路上那位邻居
  assert.match(game, /const from=who==='me'\?'me':\(who&&restoreNeighbors\(data\.neighbors\)\.some/);
  // ⚠️同一个人还在说就接在后面，别把没冒完的冲掉（她 2026-09-18：「最后一个气泡不会显示」）
  assert.match(game, /if\(talking\)\{bubbleQueue=\[\.\.\.bubbleQueue,\.\.\.rows\]\.slice\(0,12\);return;\}/);
  assert.match(game, /mine\.hidden=!speaking\|\|bubbleWho!=='me'\|\|!actor;/);
  assert.match(host, /game\(\)\.speak\(text, "me"\)/);
  // ⚠️两只气泡走同一段队列、同一套停顿
  assert.equal((game.match(/function nextBubble\(\)/g) || []).length, 1);
  assert.match(game, /两只气泡走同一段队列、同一套停顿/);
});

// 她 2026-09-17：「从游戏里开新档它不会主动创建房间」
test("在庭院里挑另一个人，就替她把那间房开出来", () => {
  assert.match(app, /const openGardenRoomFor = \(charId, world="garden"\) => openPresetRoomFor\(charId, "garden"/);
  // ⚠️她 2026-09-18 第三遍：「开新档也是跳到旧存档房间」——认领旧那间那一路撤了，
  //   一间房＝一个庭院存档，开新档就该开新房间（见 garden-open-room-71-03）。
  assert.doesNotMatch(app, /const live = Kit\.list\(charId\)/);
  assert.match(app, /setChatRoomsPreset\(preset\); setChatRoomsOpen\(true\);/,
    "要把她送到【新建那一页】，不是在这儿照着 PRESETS 自己拼一份悄悄建掉");
  assert.doesNotMatch(app, /Kit\.PRESETS\.garden/, "房间怎么建只有那一页说了算");
  assert.match(app, /roomPresetIntentRef\.current = preset;/,
    "换角色那个 effect 一看见角色变了就关面板，意图得放在 ref 里跨过去");
  assert.equal((app.match(/onNewGardenRoom: openGardenRoomFor/g) || []).length, 2, "首页那个入口和房间里那个都要能开");
  // ⚠️setActiveChar 存的是角色对象不是 id
  assert.match(app, /const who = \(characters \|\| \[\]\)\.find\(c => c && String\(c\.id\) === String\(charId\)\);/);
  assert.doesNotMatch(app, /setActiveChar\(charId\)/);
});
