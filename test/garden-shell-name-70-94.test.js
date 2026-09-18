"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const host = fs.readFileSync("js/fairy-garden.js", "utf8");
const core = fs.readFileSync("js/core.js", "utf8");
const comp = fs.readFileSync("js/components.js", "utf8");
const manual = fs.readFileSync("js/assistant-manual.js", "utf8");

// 她 2026-09-18：「壳是我专门叫你加的！改名字就叫小世界吧」
// ⚠️壳里装着好几个世界，再叫「微光庭院」就成了
//   「一个叫微光庭院的地方，进去挑世界，第一个世界也叫微光庭院」。
test("壳叫小世界，主屏那颗图标也是", () => {
  assert.match(host, /h\(Head, \{ zh: "小世界", sub: sub,/, "壳那三页的顶栏");
  assert.match(core, /fairyGarden: "小世界"/);
  assert.match(comp, /fairyGarden: \{ kind: "app", zh: "小世界"/);
  assert.match(manual, /\{ id: "fairyGarden", zh: "小世界", where: "主屏独立图标"/);
  // 手册搜「微光庭院」也要搜得到——名字换了，东西还是那个
  assert.match(manual, /kw: \["小世界", "微光庭院"/);
});

// ⚠️进了世界以后仍旧是【那个世界自己的名字】：GardenSession 那三处不许跟着改
test("进了世界还是微光庭院，世界自己的名字没被抹掉", () => {
  assert.equal((host.match(/h\(Head, \{ zh: "微光庭院"/g) || []).length, 3,
    "GardenSession 里那三处（等一下再进来／选人／同行中）是世界自己的名字");
  assert.match(host, /\{ id: "garden", name: "微光庭院"/, "世界表里那一条");
  // 一间房＝一个庭院存档，那个预设也还叫微光庭院
  assert.match(fs.readFileSync("js/chat-rooms.js", "utf8"), /garden: \{ label: "微光庭院"/);
});

// ⚠️原来那颗图标是【一栋小房子】——画的是世界 #1，不是壳
test("图标不再指认某一个世界", () => {
  assert.doesNotMatch(host, /M4 12l8-8 8 8M6 10v10h12V10/, "小房子那条路径还在");
  assert.match(host, /root\.GFairyGarden = p => h\(Svg, p, h\("path", \{\s*\n?\s*d: "M5 14a4 4 0 1 0 8 0/);
  assert.match(host, /不该再指认某一个世界/);
});
