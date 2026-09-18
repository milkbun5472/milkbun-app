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
test("朝向看它摆在那儿是冲着什么，不看她从哪边走过来", () => {
  // 她 2026-09-18 报了两遍：「坐下来为什么朝向还是不对」「喂这不对吧」
  // ⚠️2026-09-18 改成治本那一版（言秋的方子）：座位记在家具自己的坐标系里，
  //   家具写了 heading 就照它；没写的才用下面这套推一个。
  assert.match(world, /const yaw = Number\.isFinite\(f\.heading\) \? f\.heading : derivedYaw\(map, f\);/);
  assert.match(world, /function derivedYaw\(map, f\)\{/);
  assert.match(world, /const FACING = new Set\(\['table', 'roundtable', 'dining', 'desk', 'hearth', 'island', 'kitchen'\]\);/);
  assert.match(world, /return look \* 100 \+ open;/, "先看有没有可看的，再看空不空");
  assert.match(world, /heading: yaw, companion: share,/, "坐着的朝向就是家具自己的朝向");
  assert.doesNotMatch(world, /heading: Math\.atan2\(stand\.x - f\.x, stand\.z - f\.z\)/, "又按走过来的方向定朝向了");
  assert.match(world, /const on = \{ x: f\.x \+ fwd\.x \* deep \* \.18, z: f\.z \+ fwd\.z \* deep \* \.18 \};/, "坐垫是相对它自己算出来的");
});

test("坐着也走得掉：起身先回到坐下之前站的那一点", () => {
  assert.match(game, /function leaveSeat\(\)\{/);
  assert.match(game, /const seat=seatsOf\(data\.map\)\[data\.seat\],back=seat&&seat\.approach;/);
  assert.match(game, /function go\(target,job=null\)\{if\(!ready\|\|acting\)return false;festivalWait=false;\s*\n[^\n]*\n[^\n]*\n[^\n]*\n leaveSeat\(\);/,
    "从家具上找路当然找不出来——先起身再找");
  assert.match(game, /function sitAt\(id\)\{seatActivity='sit';if\(data\.seat===id\)\{leaveSeat\(\);/);
});

// 她 2026-09-18：「这个池塘坐不了啊」「他人在公告板前还是很难点到，范围能不能扩大点」
test("座位点得着：地上那一处也能点，不是只有行动栏那颗按钮", () => {
  const world2 = fs.readFileSync("apps/fairy-garden/world.mjs", "utf8");
  assert.match(world2, /export function seatAt\(map, p, pad = 1\.3\)\{/);
  assert.match(game, /\{const id=seatAt\(data\.map,point\);if\(id&&!acting\)\{if\(openSeatSite\(id\)\)return;sitAt\(id\);return;\}\}/);
  // ⚠️只此一份：写死的和从家具推出来的都在 seatsOf 里，这儿一起认
  assert.match(world2, /for \(const \[id, seat\] of Object\.entries\(seatsOf\(map\)\)\)\{/);
});

test("点的时候放宽一圈，走路和动作那两道闸照旧用原来的圈", () => {
  const rules = fs.readFileSync("apps/fairy-garden/rules.js", "utf8");
  assert.match(rules, /function nearInteraction\(map,p,depth,pad\)\{/);
  assert.match(game, /const TAP_PAD=\.9;/);
  assert.match(game, /nearInteraction\(data\.map,point,data\.depth,TAP_PAD\)/);
  // 判定本身没被放宽：actionError／targetFor 那条路仍旧问 hitInteraction
  assert.match(rules, /function hitInteraction\(map,p,depth\)\{/);
  assert.doesNotMatch(game, /hitInteraction\([^)]*TAP_PAD/);
});
