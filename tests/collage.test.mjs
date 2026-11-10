import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../js/collage.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const scr = readFileSync(new URL("../js/screens.js", import.meta.url), "utf8");
const idx = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ctx = { console, React: { createElement() {} }, window: {} }; vm.createContext(ctx); vm.runInContext(src, ctx);
const C = ctx.window.Collage;
test("三种样式，一人一半格子和字都翻倍", () => {
  assert.deepEqual([...C.ORDER], ["polaroid", "scrap", "lock"]);
  for (const k of C.ORDER) assert.equal(C.TPL[k].slots.length, C.TPL[k].n);
  assert.equal(C.slotCount({ tpl: "scrap", split: true }), 10);
  assert.equal(C.wordCount({ tpl: "lock", split: true }), 4);
});
test("接进合照墙；TA 来摆一次调用、存下来挂墙/换锁屏/TA 下一轮知道", () => {
  assert.match(idx, /js\/collage\.js\?v=/);
  assert.match(scr, /"data-part": "collageopen"/);
  assert.match(scr, /onArrange: onCollageArrange \? \(list, tpl, split\) => onCollageArrange\(partner\.id, list, tpl, split\)/);
  assert.match(app, /const collageArrange = async \(charId, list, tpl, split\)/);
  assert.match(app, /await setCharLockscreen\(charId, \{ key: hisKey/);
  assert.match(app, /waitForHer\(charId, \{ collageDone:/);
  assert.match(app, /gardenMineHint \+ collageHint \+ letterHint/);
});
