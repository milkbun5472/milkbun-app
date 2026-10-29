// 她 2026-10-12：「放我的资料里太隐蔽了，不能在我的衣柜里直接选吗，然后把我的那里删掉」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), screens = (R("screens.js") + "\n" + R("screens-ui.js")), comps = R("components.js"), studio = R("theme-studio.js");

test("衣柜里每身都能钉住，写的就是出图常服那一格；再点取消", () => {
  assert.match(screens, /function MyCloset\(\{ profile, data, busy, onGen, onAdd, onDrop, onPin, onBack(?:, masks, maskKey, onMask(?:, hasIn, onToggleMask)?)? \}\)/);
  assert.match(screens, /onClick: \(\) => onPin\(pinned === pinText\(x\) \? "" : pinText\(x\)\)/);
  assert.match(app, /onPin: text => \{ const v = String\(text \|\| ""\)\.trim\(\)\.slice\(0, 200\);[\s\S]{0,400}?saveMainProfile\(\{ \.\.\.profile, photoOutfit: v \}\);/);
  assert.match(studio, /\["closetsetpin", /);
});

test("「我」的资料里不再摆出图常服那一栏，但存的时候原样带着", () => {
  assert.doesNotMatch(comps, /"出图常服（可选）：填了就每张都穿这一身。/);
  assert.match(comps, /refPhoto: refPhoto, photoOutfit: photoOutfit\.trim\(\), geoRealm: geoRealm \|\| ""/);
});
