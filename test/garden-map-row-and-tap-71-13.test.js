"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("apps/fairy-garden/index.html", "utf8");
const css = fs.readFileSync("apps/fairy-garden/style.css", "utf8");
const game = fs.readFileSync("apps/fairy-garden/game.mjs", "utf8");

// 她 2026-09-18：「下面春1/14日重复了删了吧，然后把地图这块的胶囊放上去紧凑点」
test("日子只写在天气卡上一处，季节手册并进地图那一排", () => {
  const nav = html.slice(html.indexOf('<nav class="map-controls"'), html.indexOf("</nav>"));
  assert.match(nav, /id="season-open"/, "那颗要住进地图那一排里");
  assert.doesNotMatch(html, /季节手册">春|>春 · 1\/14 天</, "手册按钮上不许再印一遍日子");
  assert.equal((game.match(/\$\('season-open'\)\.textContent/g) || []).length, 0,
    "日子写在 #date 那一处就够了，这儿再写就是同一句话占两块地方");
  assert.match(game, /\$\('season-open'\)\.title=`季节手册 · \$\{season\.name\} \$\{season\.day\}\/14 天`/,
    "日子退到 title 里，点不着也说得清");
  assert.doesNotMatch(css, /\.season-open\{position:absolute/, "它不再自己占一块地方");
  // 她 2026-09-18：「地图这个胶囊还是太下了」——和天气那几行并排，不自己再占一行
  assert.match(css, /body\.embedded \.map-controls\{top:calc\(6px \+ var\(--head-clear,0px\)\)\}/);
  assert.match(css, /body\.embedded \.weather\{max-width:calc\(100% - 150px\)\}/, "窄屏上天气那几行要让出位置，不许压到一起");
});

// 她 2026-09-18：「现在他叫我打水我点击不了啊，一点就点到他身上」
// ⚠️他挡在井前面的时候，点井不能变成点他：手指底下有能做的事就做那件事。
test("地上那些能做的事排在他前面", () => {
  const fn = game.slice(game.indexOf("function tapMap("), game.indexOf("const viewControls=installViewControls"));
  assert.match(fn, /const tappedCompanion=!!\(companionAvatar\?\.root\.visible&&ray\.intersectObject\(companionAvatar\.root,true\)\.length\);/);
  // 判他这一下必须排在「地上有没有东西」之后
  const decide = fn.indexOf("const tappedCompanion");
  const ground = fn.indexOf("hitInteraction(data.map,point,data.depth)");
  const open = fn.indexOf("if(tappedCompanion){openCompanion();return;}");
  assert.ok(decide < ground && ground < open, "又把他排回最前面了");
  // 什么都没点着的时候还是开他那一页（点他这件事不能丢）
  assert.match(fn, /else if\(tappedCompanion\)openCompanion\(\);/);
});
