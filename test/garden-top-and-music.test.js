"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");
const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");

// 她 2026-09-18：「顺便收拾了吧宝宝」
// ⚠️施工规则/mobile-ui-layout.md：「禁止再放 30–40px 大标题和大块上下留白」。
//   独立打开这一页时那条顶栏正是那个形状（眉标 + 27px 衬线标题 + 角标）。
//   从小手机进来时整条 header 是 display:none 的，那边的紧凑栏是 Head。
test("庭院自己那条顶栏是紧凑栏，不是大标题加眉标", () => {
  assert.ok(!html.includes("一处会慢慢长大的地方"), "眉标还在");
  assert.ok(!/<h1[^>]*>[\s\S]*?<small>/.test(html), "「试玩」角标还在");
  assert.ok(!css.includes(".eyebrow"), "眉标的样式没跟着删");
  const sizes = [...css.matchAll(/h1\{[^}]*font-size:(\d+)px/g)].map(m => Number(m[1]));
  assert.ok(sizes.length, "找不到 h1 的字号");
  for (const px of sizes) assert.ok(px <= 20, "h1 又被撑回 " + px + "px 了");
});

// ⚠️同一个字号原来写在四处（基准 + 三个媒体查询），后面的赢——
//   于是「改小了」在窄屏上根本不生效（施工规则/one-public-mechanism.md）。
test("h1 的字号不许再有第二个说了算的地方", () => {
  assert.ok(!css.includes("h1 small"), "角标样式还留着");
  assert.ok(!css.includes("h1 #place-title"), "#place-title 现在就是那个 h1，这条没有对象了");
  assert.ok(!css.includes("body.depths h1 small"));
});

// 天气卡里那颗「说句话」只在嵌入时露面，而嵌入时 Head 上已经有一颗「说话」
test("同一件事不许摆两颗按钮", () => {
  assert.ok(!html.includes('id="host-talk"'), "天气卡里那颗还在");
  assert.ok(!game.includes("host-talk"), "游戏那头还在给它挂事件");
  assert.match(host, /chat \? "收起" : "说话"/, "Head 上那颗才是唯一的那颗");
});

// 她 2026-09-18：「音乐栏压着画面」
test("庭院把行动栏占掉的那一截报出去，悬浮播放器就不压在上面", () => {
  assert.match(game, /host\.floatClear\(Math\.max\(0,innerHeight-sceneBottom\(\)\)\)/,
    "报的必须是 sceneBottom 那一个数——气泡和悬浮工具共用同一条线");
  assert.match(host, /floatClear: px => \{ if \(window\.FloatKeepClear\) window\.FloatKeepClear\.set\(px\); \}/);
  assert.match(comp, /window\.FloatKeepClear = \{ set: setFloatKeepClear/);
});

// ⚠️禁区要跟着这一屏一起走：不撤的话，出了庭院它还悬在半空
test("离开庭院要把禁区撤掉", () => {
  assert.match(host, /alive\.current = false; serial\.current\+\+; if \(window\.FloatKeepClear\) window\.FloatKeepClear\.set\(0\);/);
});
