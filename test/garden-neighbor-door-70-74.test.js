"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const world = fs.readFileSync("apps/fairy-garden/world.mjs", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");

// 她 2026-09-18 的 b：「邀请邻居进来是不是也能直接设置他们的房间」
test("门上那几条开关不在庭院里写第二份，直接问 ChatRooms.GROUPS", () => {
  assert.match(host, /Kit && Kit\.GROUPS && Kit\.GROUPS\.cognition/);
  assert.match(host, /\.filter\(\(\[k\]\) => k !== "mainDelta"\)/, "只有「回这间房先补看主聊天」没有对象");
  assert.doesNotMatch(world, /formalMemory|innerLife|otherScenes/, "world.mjs 里抄了一份键名");
  assert.match(world, /那几条开关【不在这儿写第二份】/);
});

// ⚠️默认全关，和庭院房那个预设一个口径
test("请 TA 搬进来那一下就能定，默认什么都不带", () => {
  assert.match(world, /export const restoreDoor = raw => Object\.fromEntries/);
  assert.match(world, /export function setNeighborDoor\(s, charId, door, name\)/);
  assert.match(world, /export function moveIn\(s, \{ charId, name, look, door \}\)/);
  assert.match(game, /setNeighborDoor:\(charId,door,name\)=>/);
});

// ⚠️⚠️两道闸：door 管 TA 自己的主线记忆，neighborView 管这一档里的私事
test("邻居的主线记忆走房间那道闸，不另写一套过滤", () => {
  assert.match(app, /const neighborBundleFor = \(charId, door\) => \{/);
  assert.match(app, /gateByDoor\(ctxFor\(char, \{ chat: true \}\), \{ cognition: \{ \.\.\.\(door \|\| \{\}\) \} \}\)/);
  assert.match(app, /const gateByDoor = \(ctx, door\) => \{\s*\n\s*return window\.ChatRooms\.gateCtx\(ctx, door\);\s*\n\s*\};/,
    "三条路共用这一处，多一处手抄件就是改一处漏一处");
  assert.equal((app.match(/ChatRooms\.gateCtx\(/g) || []).length, 1);
  assert.equal((app.match(/neighborBundle: neighborBundleFor/g) || []).length, 2, "两个入口都要接上");
});

test("发给邻居的是裁好的那一份，不是 snapshot", () => {
  assert.match(world, /export function neighborView\(s, charId\)/);
  assert.match(world, /同行者那条线，门开得再大也一个字都不给|这一档里的私事/);
  assert.match(game, /view:neighborView\(data,nb\.charId\)/);
  assert.doesNotMatch(game, /neighborSay\(\{[^}]*snapshot\(\)/, "把整份 snapshot 递给邻居了");
  // 村里最近发生的事也不给：那张表里混着同行者的事
  assert.doesNotMatch(world.slice(world.indexOf("export function neighborView"),
    world.indexOf("export function neighborTalkError")), /recentHappenings/);
});

// 她 2026-09-18 的 a：走近了能搭话
test("走近了才说得上话，一天一位一次，而且重开也挡得住", () => {
  assert.match(world, /export function neighborTalkError\(s, charId\)/);
  assert.match(world, /neighborTalks\|\|\{\}|neighborTalks \|\| \{\}/);
  assert.match(world, /neighborTalks:restoreDayMarks\(d\.neighborTalks\)/, "restoreState 不收＝刷新一下就能再打一枪");
  assert.match(html, /id="neighbor-say"/);
  assert.match(game, /\$\('neighbor-say'\)\.onclick=sayToNeighbor/);
  // ⚠️这一枪要打十几秒，回来之后得重新核一遍
  assert.match(game, /if\(neighborTalkError\(data,nb\.charId\)\)\{say\('说话的劲头过去了/);
});

// ⚠️反八股那一堆不是记忆，是文风地板，在哪儿都该有
test("这一枪照给文风地板，而且料全在 system", () => {
  const fn = host.slice(host.indexOf("async function neighborLine("), host.indexOf("// 他自己走过来、她点了头"));
  assert.match(fn, /sharedStyle\(\)/);
  assert.match(fn, /【完整角色人设】/, "人设给全文，不许截断");
  assert.match(fn, /callAI\(active, sys, \[\{ role: "user", content: "说句话。" \}\]/, "料全放 system");
  assert.match(fn, /maxTokens: 65535/);
  assert.match(fn, /你不知道她和同住那位之间的事/, "围栏也要在提示词里说一遍");
});
