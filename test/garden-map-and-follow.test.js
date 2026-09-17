"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");
const world = rd("apps/fairy-garden/world.mjs");

// 她 2026-09-17：「地图要不要单独右上角做个 tab，然后可以显示角色和我分别在哪儿」
//              「就先走路」→「或者不传送但是点击可以自动带路」
test("图上点一处会带路，但走的是路，不是传送", () => {
  assert.match(html, /id="map-open"/);
  assert.match(html, /id="map-dialog"/);
  const draw = game.slice(game.indexOf("function openMap()"), game.indexOf("$('map-dialog').showModal();"));
  assert.doesNotMatch(draw, /host\.|callAI/, "一枪都不打：地名坐标全是 MAPS 里现成的");
  const tap = game.slice(game.indexOf("$('map-plan').addEventListener"), game.indexOf("$('map-open').onclick"));
  // ⚠️走的是 go()：从现在站的地方一步步过去。绝不许直接改 position——那就是传送
  assert.match(tap, /if\(go\(target\)\)/);
  assert.doesNotMatch(tap, /data\.position *=|actor\.position\.set/, "直接落点＝传送，走路那点节奏就没了");
  // 到了就是到了，不替她做任何事（要浇要种，她自己点）
  assert.doesNotMatch(tap, /perform\(|request\(/);
  assert.match(tap, /chasing=false/, "她指了别处，就不该还跟着他走");
  assert.match(game, /是走过去，不是一下子到/);
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
