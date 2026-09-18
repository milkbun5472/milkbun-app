"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const world = fs.readFileSync("apps/fairy-garden/world.mjs", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");

// 她 2026-09-18：「这个对话框能不能再做一层折叠，要点开才会展开高一点，
// 平时就对话框加一个小箭头，说话也不会自动弹出只有我手动才弹出」
test("说话那一层三档：收着／只留一条／点开才长高", () => {
  assert.match(host, /onClick: \(\) => openChat\(chat \? false : "bar"\)/, "点「说话」先只出一条输入");
  assert.match(host, /onClick: \(\) => openChat\(chat === "tall" \? "bar" : "tall"\)/, "小箭头才是展开");
  assert.match(host, /chat === "tall" \? h\("div", \{ ref: messages/, "记录只在展开时画");
  // ⚠️不会因为他说了什么自己弹出来
  assert.doesNotMatch(host, /openChat\(true\)/, "还有地方会自己把它弹开");
  assert.doesNotMatch(game, /host\.openChat/, "游戏那侧不许自己弹这一层");
});

// 她 2026-09-18：「从游戏界面进是不显示聊天记录的，只有从房间里面进才有」
test("两条路进来都看得到这间房的记录，而且只取最近 100 条", () => {
  assert.match(app, /const GARDEN_LOG = 100;/);
  assert.match(app, /const gardenHistory = key => \(chats\[key\] \|\| \[\]\)/);
  assert.match(app, /\.slice\(-GARDEN_LOG\)/, "整本几千条塞进那层小面板就是开局卡住");
  assert.match(app, /history: gardenHistory\(key\)/, "从房间进来那一处也走同一个");
  assert.match(app, /recordFor: gardenRecordFor/);
  assert.match(host, /props\.record \|\| \(props\.recordFor \? props\.recordFor\(storeKey\.current\) : null\)/);
  assert.equal((app.match(/kind: "garden" \}\)\)\]\)/g) || []).length, 2, "写回那一段两处，形状要一样");
});

// 她 2026-09-18：「坐下来为什么朝向还是不对」「坐上去下不来了，显示没有空地可以走」
test("朝向看家具的形状，不看她从哪边走过来", () => {
  assert.match(world, /const long = f\.w >= f\.d;/);
  assert.match(world, /const out = long \? \{ x: 0, z: 1 \} : \{ x: 1, z: 0 \};/);
  assert.match(world, /heading: Math\.atan2\(face\.x, face\.z\)/);
  assert.doesNotMatch(world, /heading: Math\.atan2\(stand\.x - f\.x, stand\.z - f\.z\)/, "又按走过来的方向定朝向了");
});

test("坐着也走得掉：起身先回到坐下之前站的那一点", () => {
  assert.match(game, /function leaveSeat\(\)\{/);
  assert.match(game, /const seat=seatsOf\(data\.map\)\[data\.seat\],back=seat&&seat\.approach;/);
  assert.match(game, /function go\(target,job=null\)\{if\(!ready\|\|acting\)return false;festivalWait=false;\s*\n[^\n]*\n[^\n]*\n[^\n]*\n leaveSeat\(\);/,
    "从家具上找路当然找不出来——先起身再找");
  assert.match(game, /function sitAt\(id\)\{seatActivity='sit';if\(data\.seat===id\)\{leaveSeat\(\);/);
});
