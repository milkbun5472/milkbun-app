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
test("自由度：背景、字体、贴纸都能换；按到谁认得出（贴纸在最上面）", () => {
  assert.ok(Object.keys(C.BGS).length >= 6 && Object.keys(C.FONTS).length >= 4 && C.STICKERS.length >= 12);
  assert.equal(C.defaultDeco("scrap", true).length, C.TPL.scrap.deco.length * 2);
  const boxes = [{ key: "s0", kind: "slot", x: 500, y: 500, w: 600, h: 600 }, { key: "d0", kind: "deco", x: 520, y: 520, w: 100, h: 100 }, { key: "w0", kind: "word", x: 510, y: 510, w: 300, h: 80 }];
  assert.equal(C.hitTest(boxes, 515, 515).key, "d0");
  assert.equal(C.hitTest(boxes, 300, 300).key, "s0");
  assert.equal(C.hitTest(boxes, 50, 50), null);
  assert.match(src, /touchAction: "none"/);
  assert.match(src, /position: "sticky"/);
});
