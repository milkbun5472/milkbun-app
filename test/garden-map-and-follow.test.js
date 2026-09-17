"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");
const world = rd("apps/fairy-garden/world.mjs");

// 她 2026-09-17：「地图要不要单独右上角做个 tab，然后可以显示角色和我分别在哪儿」「就先走路」
test("地图只说谁在哪儿，点了不会把人传送过去", () => {
  assert.match(html, /id="map-open"/);
  assert.match(html, /id="map-dialog"/);
  const fn = game.slice(game.indexOf("function openMap()"), game.indexOf("$('map-dialog').showModal();"));
  assert.doesNotMatch(fn, /go\(|request\(|perform\(/, "图上能点着走＝它成了传送盘，走路那点节奏就没了");
  assert.match(game, /这张图只看，不带路/);
  assert.doesNotMatch(fn, /host\.|callAI/, "一枪都不打：地名坐标全是 MAPS 里现成的");
});

// 人不在这张图上时要说清他在哪儿，不能让那个点凭空消失
test("他去了别的地图，图上要写明白他在哪儿", () => {
  const fn = game.slice(game.indexOf("function openMap()"), game.indexOf("$('map-dialog').showModal();"));
  assert.match(fn, /person\.map!=='garden'.*rows\.push\(who\+'在'\+MAPS\[person\.map\]\.name/);
});

// ⚠️广场／摊位／湖的两个岸挨着大地方，整张 sites 倒出来字会叠在一起
test("图上只标她真会去的那几处，不是把 sites 整张表倒出来", () => {
  assert.match(game, /const MAP_SPOTS=\[/);
  assert.doesNotMatch(game, /Object\.values\(MAPS\.garden\.sites\)\.map\(v=>v\.target\)/);
  assert.match(game, /不是把 sites 整张表倒出来/);
});

// 她 2026-09-17：「能不能有让他取消跟着我和我跟着他的选项」
test("一起走那三件摆在行动栏里，不再埋在弹层", () => {
  assert.match(html, /id="walk-together"/);
  assert.match(html, /id="follow-him"/);
  assert.match(game, /\$\('walk-together'\)\.textContent=following\?'不用跟着我了':'叫他一起走'/);
  assert.match(game, /\$\('follow-him'\)\.textContent=chasing\?'不跟了':'我跟着他走'/);
});

// ⚠️「我跟着他」不是传送，是一步一步走；她自己点地面就把主动权收回去
test("跟着他走是真走路，点一下地面就不跟了", () => {
  assert.match(game, /function chaseTick\(\)/);
  assert.match(game, /go\(\{x:c\.position\.x,z:c\.position\.z\}\)/);
  assert.match(game, /function tapMap\(clientX,clientY\)\{chasing=false;/);
  assert.match(game, /c\.map!==data\.map\)\{chasing=false;.*你得自己走那扇门/);
  // ⚠️声明要排在 ui() 前面：ui() 里就读它（这仓库栽过一次 TDZ）
  assert.ok(game.indexOf("let chasing=false;") < game.indexOf("function ui()"), "又是一个 TDZ");
});

// 她 2026-09-17：「公告栏搞个时效吧然后四天刷新一次，接了没做也没了」
test("板子四天一换，剩几天要写在她第一眼看得见的地方", () => {
  assert.match(world, /QUEST_CYCLE = 4/);
  assert.match(world, /export const questCycle = day =>/);
  assert.match(world, /export function expireQuests\(s\)/);
  assert.match(world, /expireQuests\(shoreAfterThaw\(missNewDay/, "过期只在跨天那一处结算");
  assert.match(game, /这块板子还剩 '\+boardLeft\(\)\+' 天，到期没交的会被撕下来/);
  assert.match(game, /板子换了，没做完的 \$\{dropped\} 件撕下来了/, "东西没了却不吭声＝坑她");
});
