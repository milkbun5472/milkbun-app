// 她 2026-11-18：「这堆小人这么大会不会导致手机发热变卡」——悬浮那只降到 12 帧，打字／滑动时先定住
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
test("悬浮小人 12 帧、打字滑动不画；外面递 scrolling 进去", () => {
  const pet = R("apps/companion/pet.mjs"), cp = R("js/companion.js");
  assert.match(pet, /const FRAME=mode==='float'\?1\/12:1\/40;/);
  assert.match(pet, /if\(mode==='float'&&\(ctx\.typing\|\|ctx\.scrolling\)&&!held\)return;/);
  assert.match(pet, /scrolling:!!m\.scrolling/);
  assert.match(cp, /function useScrolling\(\)/);
  assert.match(cp, /returnSeq: p\.returnSeq, typing, scrolling, weather, life/);
});
