"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const comp = rd("apps/fairy-garden/companion.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const html = rd("apps/fairy-garden/index.html");

// 她 2026-09-18：「做吧宝宝」——codex 提的②：两个人各做一半，合起来才成
test("这是第一件两个人各做一半的事，不是「他在旁边于是好一点」", () => {
  assert.match(world, /全库第一件【两个人各做一半、合起来才成】的事/);
  assert.match(world, /export const STAR_SPOTS = \{ dial: 'orrery', watch: 'telescope' \};/);
  // 舞台是 codex 现成的，一个新景都不加
  assert.match(world, /这一版一个新景都不加/);
});

// ⚠️这一句就是「配合」本身
test("转的人看不见差多少，看的人转不动那个环", () => {
  assert.match(world, /转的人看不见这个数，/);
  assert.match(game, /:watching\?starReading\(data\)\+'（告诉'\+data\.companion\.name\+'该往哪边）'/);
  assert.match(game, /'你手里只有铜环，看不见光落在哪儿——听'\+data\.companion\.name\+'报。'/);
  // 她占 watch 时那两颗是【让他转】，走的仍是同一个 turnStar
  assert.match(game, /\$\('star-left'\)\.textContent=watching\?'让 TA 往左一格':'往左一格'/);
  assert.equal((game.match(/turnStar\(/g) || []).length, 1, "「他转」不许自己长出一路");
});

// ⚠️门开不开由代码判，模型只负责他怎么开口——那一枪这一版还没接
test("对没对准是个数字，这一整条一枪不打", () => {
  const seg = world.slice(world.indexOf("// ── 一起转星仪"), world.indexOf("// ── 碰见"));
  assert.doesNotMatch(seg, /callAI|host\.|await /);
  assert.match(seg, /模型只负责他怎么开口报方向/);
  assert.match(seg, /先不打枪/);
});

// ⚠️tick 在 routine 模式绕开 companionPlan——这一课这一季栽过三次了
test("「他去另一头」只写在 plannedActivity 一处", () => {
  assert.match(comp, /function starFor\(s\)\{/);
  assert.match(comp, /export function plannedActivity\(s\)\{const star=starFor\(s\);if\(star\)return star;/);
  const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.equal((code.match(/starFor\(/g) || []).length, 2, "一次定义一次调用");
  assert.match(comp, /这一课这一季栽过三次了/);
});

// count() 把负数夹成 0：往左转不动，只能一路往右绕
test("转一格那一下不许用 count()", () => {
  const fn = world.slice(world.indexOf("export function turnStar(s, step)"), world.indexOf("export function alignStar"));
  assert.doesNotMatch(fn, /count\(step/, "它把负数夹成 0，往左就转不动了");
  assert.match(fn, /const raw = Number\.isFinite\(Number\(step\)\) \? Math\.trunc\(Number\(step\)\) : 1;/);
});

// 一个人把环转对了不算数
test("两个人都在位置上才算对上，一晚一次", () => {
  assert.match(world, /if \(!atSpot\(s\.companion\.position, s\.companion\.map, starOther\(star\.role\)\)\) return s;/);
  assert.match(world, /export const starDone = s => restoreStar\(s\.star\)\.doneDay === s\.day;/);
  assert.match(world, /star:restoreStar\(d\.star\)/, "跟着存档走");
});

// 点铜环或望远镜就占那一头
test("两头的入口从 STAR_SPOTS 倒过来推，不另写一张表", () => {
  assert.match(game, /const role=Object\.keys\(STAR_SPOTS\)\.find\(k=>STAR_SPOTS\[k\]===at\.kind\);/);
  assert.match(game, /codex 哪天挪了站位，这儿跟着走/);
  assert.match(html, /id="star-dialog"/);
  assert.match(game, /\$\('star-leave'\)\.onclick/, "占了还得能收回来");
});
