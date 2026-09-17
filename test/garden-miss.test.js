"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const game = rd("apps/fairy-garden/game.mjs");
const companion = rd("apps/fairy-garden/companion.mjs");
const host = rd("js/fairy-garden.js");
const app = rd("js/app.js");
const html = rd("apps/fairy-garden/index.html");
const css = rd("apps/fairy-garden/style.css");

// 她 2026-09-17：「攒够思念就来来到我身边，然后出一个他好像有话要说，我确认了才 call 模型」
// ⚠️整条庭院的成本观就收口在这儿：走过来一枪不打，她点头那一下才花钱。
test("走过来、站着等、等不到就回去，全程一枪不打", () => {
  const seg = world.slice(world.indexOf("// ── 他自己来找你"), world.indexOf("// ── 星井（下潜）"));
  assert.doesNotMatch(seg, /callAI|host\.|await /);
  assert.match(seg, /走过来是零调用的/);
  const tick = game.slice(game.indexOf("function missTick()"), game.indexOf("async function askMiss()"));
  assert.doesNotMatch(tick, /host\.|callAI/);
  // 那一枪只有一个入口：她点那个记号
  assert.match(game, /\$\('companion-call'\)\.onclick=\(\)=>askMiss\(\)/);
  assert.match(game, /if\(missing\|\|!missWaiting\(data\)\)return;/, "点两下就是花两次钱");
  assert.match(game, /missing=true;data=missTaken\(data\);/, "先记上今天这一次再打，顺序反了就会重复扣钱");
});

// ⚠️这个数不给她看：给了它立刻变成一根刷好感的条
test("思念那个数不许露到界面上", () => {
  assert.match(world, /这个数【不给她看】/);
  assert.doesNotMatch(game, /miss\.score|思念 *[:：]/);
  assert.doesNotMatch(host, /miss\.score/);
});

// ⚠️她不理他不许罚她
test("她不点，他回自己的日程，思念一分不扣", () => {
  assert.match(world, /export function missLetGo\(s\)\{ return withMiss\(s, \{ cameAt: 0, day: s\.day \}\); \}/);
  const letGo = world.slice(world.indexOf("export function missLetGo"), world.indexOf("export function missMaterial"));
  assert.doesNotMatch(letGo, /score/, "没理他就扣分＝在罚她");
  assert.match(game, /if\(missGaveUp\(next\)\)next=missLetGo\(next\)/);
});

// ⚠️计划有两处在定：companionPlan，以及 tick 在 routine 模式下直接用的 plannedActivity。
//   只改前一处的话，他最常处的那个模式里永远不会来（2026-09-17 实机抓到）。
test("他自己要来那一版计划只有一份，两处都认它", () => {
  assert.match(companion, /export function missPlan\(s\)/);
  const plan = companion.slice(companion.indexOf("export function companionPlan"), companion.indexOf("// One movement controller"));
  assert.ok(plan.indexOf("missPlan(s)") < plan.indexOf("c.mode==='follow'"),
    "排在后面的话，她点过一次「按自己的安排」，他就永远来不了");
  // tick 那一处也得先问它，不能绕过去
  assert.match(companion, /wants=missPlan\(s\),routine=wants\|\|\(sleeping\?companionPlan\(s\)/);
  assert.match(companion, /choiceKey=wants\?'miss:'\+s\.day/, "换成来找你之后旧路线还缓存着，他会站在原地");
  // 睡着的不叫起来
  assert.match(companion, /MAPS\.home\.beds\[s\.sleep\?\.companion\]\|\|!missWanting\(s\)/);
  assert.match(world, /!\(s\.sleep && s\.sleep\.companion\)/);
});

test("记号是能点的，气泡不是——两个不能是同一个东西", () => {
  assert.match(html, /id="companion-call"/);
  assert.match(css, /#companion-call\{[^}]*z-index:6/);
  assert.match(css, /pointer-events:none/, "气泡仍旧不吃点击");
  // 他正说着话的时候不许还挂着「有话要说」
  assert.match(game, /call\.hidden=offscreen\|\|speaking\|\|missing\|\|!missWaiting\(data\)/);
  assert.match(css, /prefers-reduced-motion/, "那一下一上的动效要能关掉");
});

// ⚠️料全放 system，user 一句触发（施工规则/prompt-send-shape.md）
test("他开口那一枪的形状跟别处一样", () => {
  const fn = host.slice(host.indexOf("async function missLine"), host.indexOf("root.FairyGardenService"));
  assert.match(fn, /\[\{ role: "user", content: "他开口。" \}\]/);
  assert.match(fn, /maxTokens: 12000/, "不许低于 8000（施工规则/max-tokens-floor.md）");
  assert.match(fn, /roleContext\(character, profile, mainline\)/, "人设那一份走公共的，不在这儿另写");
  assert.match(fn, /sharedStyle\(\)/);
  // 报错要带上模型真回了什么，不然没法查
  assert.match(fn, /e\.detail = String\(raw \|\| ""\)\.slice\(0, 1200\)/);
});

// ⚠️他得带着一件具体的东西开口，否则每次都是「我想你了」
test("凑给他的全是真发生过的东西，而且不许编", () => {
  const fn = host.slice(host.indexOf("async function missLine"), host.indexOf("root.FairyGardenService"));
  assert.match(fn, /都是你们之间真有过的/);
  assert.match(fn, /绝不许编一段你们其实没发生过的事/);
  assert.match(fn, /那句话谁来说都成立/);
  assert.match(fn, /【你手上什么都没有】/, "真没有就说没有，不许硬凑一件出来");
  // 格式示范留着，内容示范不许有（施工规则/prompt-no-content-samples.md）
  assert.match(fn, /"say":\["你开口的第一句","接着说的第二句"\]/);
});

test("他说的话跟她问出来的落在同一处，不另开一本", () => {
  const bridge = host.slice(host.indexOf("miss: async material"), host.indexOf("bloom: async rows"));
  assert.match(bridge, /record\.onTurn\(\{ text: "", reply: parts\.join/);
  // ⚠️他自己来找她那一轮没有用户那一句：照记会多出一条空气泡
  assert.match(app, /String\(turn\.text \|\| ""\)\.trim\(\) \? \[\{ role: "user"/);
});
