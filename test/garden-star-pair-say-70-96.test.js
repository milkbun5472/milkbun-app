"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const world = fs.readFileSync("apps/fairy-garden/world.mjs", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");
const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");

// 她 2026-09-18：「123 都做吧宝宝，3 可以开个临时打字框然后邻居回复就走气泡」

// ── ① 他报方向那一句用他自己的腔调 ──────────────────────────────────
test("差哪一档由代码判，模型只换前半句怎么说", () => {
  assert.match(world, /export const starBand = s =>/);
  assert.match(world, /export function starReading\(s, voice\)/);
  assert.match(world, /'往' \+ \(starGap\(s\) > 0 \? '右' : '左'\) \+ '边。'/,
    "方向那半句永远是代码接的");
  assert.match(game, /speak\(starReading\(data,starVoice\)\)/);
  assert.match(host, /不要写往左往右/, "宿主那一枪明说了方向不归它写");
});

test("那四句一位角色只问一次，存在这一档里", () => {
  assert.match(host, /async function starLines\(\{ active, character, profile, mainline \}\)/);
  assert.match(host, /have = \(current\(\)\.stars \|\| \{\}\)\[cid\]/);
  assert.match(host, /if \(have && have\.status === "ready"\) return have\.lines;/);
  assert.match(host, /if \(busyRef\.current\) return null;/, "她正在转环，报不出就先用白话");
  assert.match(game, /if\(role==='dial'\)pullStarVoice\(\);/, "他在台上报方向的时候才问");
  assert.match(game, /if\(starVoiceAsked\|\|!host\|\|!host\.starVoice\)return;/, "一档一次");
});

// ── ② 邻居之间站住说两句 ────────────────────────────────────────────
test("只有她在场看得见才打这一枪，近不近不在游戏里另定一个数", () => {
  assert.match(game, /Math\.hypot\(me\.x-a\.at\.x,me\.z-a\.at\.z\)<=PAIR_WATCH/);
  assert.match(game, /if\(pairTalkError\(data,a\.id,b\.id,watcher\)\)return;/);
  assert.match(game, /if\(a\.id!=='me'&&b\.id!=='me'\)pairTalk\(a,b\);/);
  assert.doesNotMatch(game, /const PAIR_WATCH|PAIR_WATCH=/, "这个数只在 world.mjs 写一处");
});

// ⚠️一枪里坐着两个角色：谁的主线记忆都不给，各人的人设各占一段
test("两位的人设各占一段，谁的主线都不给", () => {
  assert.match(host, /async function pairLines\(\{ active, profile, a, b, view \}\)/);
  assert.match(host, /const seg = \(who, label\) =>/);
  const pairBody = host.slice(host.indexOf("async function pairLines"));
  assert.doesNotMatch(pairBody.slice(0, pairBody.indexOf("\n  }\n")),
    /mainline|bundle/, "两个人合成一块共享注入＝把 A 的记忆喂给 B");
  assert.match(game, /view:pairView\(data,a\.id,b\.id\)/);
});

test("这两句回来还要重新核一遍，她可能已经走开", () => {
  assert.match(game, /if\(pairTalkError\(data,a\.id,b\.id,data\.map===a\.map\)\)return;/);
  assert.match(game, /data=notePairTalk\(data,a\.id,b\.id,lines\[0\]&&lines\[0\]\.text\);/);
  assert.match(game, /for\(const line of lines\)if\(line\.text\)speak\(\[line\.text\],line\.who\);/);
});

// ── ③ 走近了说句话：临时打字框，回话走气泡 ──────────────────────────
test("是个临时打字框，不是一屏聊天", () => {
  assert.match(html, /<div id="neighbor-box" hidden>/);
  assert.match(html, /<input id="neighbor-input" maxlength="80"/);
  assert.match(html, /id="neighbor-send"/);
  assert.match(html, /id="neighbor-cancel"/);
  assert.match(css, /#neighbor-box/);
  assert.match(game, /不做成一屏聊天/);
  assert.doesNotMatch(html, /neighbor-log|neighbor-history/, "不许长成一个会话窗口");
});

test("她说的那句和 TA 回的那几句都走气泡", () => {
  assert.match(game, /if\(said\)speak\(\[said\],'me'\);/);
  assert.match(game, /speak\(lines,nb\.charId\);/);
  assert.match(game, /\$\('neighbor-say'\)\.onclick=openNeighborBox;/);
  assert.match(game, /\$\('neighbor-send'\)\.onclick=sayToNeighbor;/);
  assert.match(game, /\$\('neighbor-cancel'\)\.onclick=closeNeighborBox;/);
  assert.match(game, /e\.key==='Enter'/);
  assert.match(game, /e\.key==='Escape'/);
});

// ⚠️气泡挂在【说话的那个人】头上：以前谁说都挂同行者头上
test("邻居那句挂在那位邻居头上，不挂同行者", () => {
  assert.match(game, /function bubbleAt\(\)\{/);
  assert.match(game, /restoreNeighbors\(data\.neighbors\)\.find\(x=>String\(x\.charId\)===String\(bubbleWho\)\)/);
  assert.match(game, /const canShow=bubbleWho==='companion'\?!offscreen:!!other;/);
});

test("她那句原样送进那一枪，不在游戏里凑一段提示词", () => {
  assert.match(game, /host\.neighborSay\(\{charId:nb\.charId,door:\{\.\.\.nb\.door\},view:neighborView\(data,nb\.charId\),said\}\)/);
  assert.match(host, /neighborSay: async \(\{ charId, door, view, said \}\) =>/);
  assert.match(host, /async function neighborLine\(\{ active, character, profile, bundle, view, said \}\)/);
  assert.match(host, /said \? "【她刚说】\\n" \+ said/, "料全放 system（施工规则/prompt-send-shape.md）");
  const nbBody = host.slice(host.indexOf("async function neighborLine"));
  assert.match(nbBody.slice(0, nbBody.indexOf("\n  }\n")),
    /\[\{ role: "user", content: "说句话。" \}\]/, "user 那栏只留一句触发");
});

test("走开了、或者今天已经聊过，框自己收起来", () => {
  assert.match(game, /if\(\(!nb\|\|err\|\|sayingTo\)&&!\$\('neighbor-box'\)\.hidden\)closeNeighborBox\(\);/);
});
