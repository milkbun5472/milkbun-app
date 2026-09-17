"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const css = rd("apps/fairy-garden/style.css");
const doll = JSON.parse(rd("apps/fairy-garden/doll.json"));

// 她 2026-09-17：「为啥感觉体型拉杆没用啊宝宝」
// 拉杆一直是有用的，是这一页【整页盖住了游戏】，她拖的时候一个像素都看不见。
test("换样貌那一页顶上留了一条真透明的窗", () => {
  assert.match(host, /background: "transparent", pointerEvents: "none"/);
  assert.match(host, /top: 0, height: "30%"/, "窗要是没高度，等于没开");
  assert.match(host, /top: "30%", bottom: 0, background: "#e9ecdd"/, "剩下那截才是不透明的那一页");
});

// ⚠️两边的 30% 必须对上：窗开在手机那一侧，画在游戏那一侧
test("窗的高度和游戏那边渲的那条带子是同一个数", () => {
  assert.match(game, /const PREVIEW_BAND=\.3;/);
  assert.match(game, /PREVIEW_BAND[\s\S]{0,80}和手机那一侧那条透明窗同一个比例/);
  assert.match(host, /PREVIEW_BAND/, "手机这一侧也要写着对方的名字，改一处就找得到另一处");
});

// 预览里的小人必须是【场上那一个】，不能在这儿另捏一个
test("预览用的还是同一个 createTraveler、同一份 doll.glb", () => {
  assert.match(game, /previewDolls\[who\]=d;/);
  assert.match(game, /createTraveler\(dollSource,who==='companion'\)/);
  assert.match(game, /if\(previewDolls\[who\]\)previewDolls\[who\]\.setLook\(look\)/,
    "拖滑杆的时候窗里那个要跟着一起变");
});

// 那条窗是透明的：不收起游戏自己那套壳，她看到的是小人后面压着一排按钮
test("预览的时候游戏自己那套壳收起来，关了要还回去", () => {
  assert.match(game, /document\.body\.classList\.add\('previewing'\)/);
  assert.match(game, /document\.body\.classList\.remove\('previewing'\)/);
  assert.match(css, /body\.previewing #app > \*:not\(#world\)/);
});

// 开这一页告诉游戏渲谁，切换「我／同行者」跟着换，关了要收
test("开关这一页都要通知游戏", () => {
  assert.match(game, /preview:who=>setPreview\(who\)/);
  assert.match(host, /g\.preview\(dress \? who : null\)/);
  assert.match(host, /\}, \[dress, who, loaded\]\)/);
  assert.match(host, /q\.preview\(null\)/, "这一页卸掉的时候也要收");
});

// 范围来自 doll.json（＝Blender 那份 LIMITS），不许在 JS 里另写一份
test("六根滑杆的上下限还是从 doll.json 读的", () => {
  assert.equal(doll.dims.length, 6);
  for (const d of doll.dims) assert.ok(d.min < 1 && d.max > 1, d.key + " 应该以 1 为中性");
  assert.match(host, /min: d\.min, max: d\.max/);
});
