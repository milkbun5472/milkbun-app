"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const rd = p => fs.readFileSync(p, "utf8");
const world = rd("apps/fairy-garden/world.mjs");
const rules = rd("apps/fairy-garden/rules.js");
const game = rd("apps/fairy-garden/game.mjs");
const host = rd("js/fairy-garden.js");
const html = rd("apps/fairy-garden/index.html");

// 她 2026-09-17：「花册也是在图鉴里面种而不是在家里的花园，也要改改」
test("种一句要走到花圃那儿种，不在册子里种", () => {
  assert.match(world, /s\.map !== 'garden' \? '花圃在庭院里。'/);
  assert.match(world, /if\(kind==='sow'\)return seedError\(s\)/);
  // ⚠️钉的是「三件事同一个站位」，不是那个坐标本身——坐标 2026-09-18 往南挪过
  //   0.4（她：「种后面的花圃会穿模」），钉死数字的话挪一次就红一次。
  const three = rules.match(/garden:(\{x:[-\d.]+,z:[-\d.]+\}),note:(\{x:[-\d.]+,z:[-\d.]+\}),sow:(\{x:[-\d.]+,z:[-\d.]+\})/);
  assert.ok(three, "garden／note／sow 三件事不在同一处写着了");
  assert.equal(three[2], three[1], "跟收花笺同一个站位");
  assert.equal(three[3], three[1], "跟收花笺同一个站位");
  assert.match(rules, /note:'home',sow:'home'/, "新站位不写清在哪一区，rules.js 加载当场就崩");
  assert.match(html, /id="sow-dialog"/);
  assert.match(game, /\$\('sow'\)\.onclick=\(\)=>request\('sow'\)/);
  assert.match(world, /sow:'种下一句'/, "日记里也要认得这一趟");
});

// ⚠️同一件事只留一个门：桥上再留一个 sow，就是一层活在两处
test("册子里那半截种花的界面撤干净了", () => {
  assert.doesNotMatch(host, /seedKind|seedAsk/);
  assert.doesNotMatch(host, /g\.sow\(/);
  assert.doesNotMatch(game, /^ sow:\(kind,ask\)/m, "桥上那个入口也要撤，不然还是两个门");
  assert.match(host, /走到花圃那儿种一句下去/, "册子上要说清去哪儿种");
});

// 翻册子的地方不再是动手的地方
test("花册那一格只剩地里的和花笺", () => {
  const seg = host.slice(host.indexOf("走到花圃那儿种一句下去"), host.indexOf('bookTab === "museum"') > 0 ? host.length : host.length);
  assert.ok(!/种下去/.test(host), "册子里还留着种下去那颗按钮");
});
