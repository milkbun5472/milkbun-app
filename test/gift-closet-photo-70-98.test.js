// 她 2026-09-18：「确认一下礼物订进衣柜后合照也能用吧？还有能不能渲染成衣服的形状」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// ── ① 挂进衣柜的礼物，合照那边挑得到 ────────────────────────────
// 靠的是【两头读写的是同一份数据】：closetGiftToChar 写 carry[charId].outfit，
// 照相馆和合照都从那儿读。哪天有人给礼物另开一个柜子，这一条就该红。
test("礼物挂进的柜子，就是合照挑衣服读的那个柜子", () => {
  assert.match(app, /saveCarrySection\(charId, "outfit", merged\);/, "挂礼物没写进 outfit");
  // 合照那一枪读的
  assert.match(app, /const hisGroups = \(\(carryRef\.current \|\| \{\}\)\[char\.id\] \|\| \{\}\)\.outfit;/);
  // 照相馆挑衣服那一屏读的
  assert.match(app, /charClosetOf: cid => \(carry \|\| \{\}\)\[cid\] \|\| null,/);
  assert.match(scr, /const hisSets = closetGroups\(charCloset && charCloset\.outfit\);/);
  // 挂上去顺手钉住：不然下一次刷新衣柜就把她送的那件换掉了
  assert.match(app, /setCarryPin\(charId, "outfit", nm, true\);/);
});

// ⚠️查这件事时翻出来的：closetGiftToChar 写的 note 是「你送的」，
//   而 dressLine 会把 note 原样塞进【出图提示词】——那一栏装的该是款式颜色料子，
//   不是来路。出图那头读到「你送的」多半会给这件衣服配个礼盒或缎带。
test("「你送的」不许跟着进出图提示词", () => {
  assert.match(app, /const note = raw === "你送的" \? "" : Array\.from\(raw\)\.slice\(0, PIECE_NOTE\)\.join\(""\);/);
  // 衣柜界面上那三个字要留着——它在那儿是有用的
  assert.match(app, /sets: \[\{ name: nm, note: "你送的" \}\]/);
});

// ── ② 挂进衣柜之后，它在衣柜里就是一件衣服 ──────────────────────
// ⚠️她 2026-09-18 纠正过我一次：「我说的是礼物那边不动」——
//   我一度把【收到的礼物】那一栏里是衣服的画成了衣服，放错地方了。
//   衣服的样子属于衣柜那一栏；礼物那一栏照旧是礼盒。
test("礼物那一栏不动，还是礼盒", () => {
  const i = scr.indexOf("礼盒：品类色的小方块");
  assert.ok(i > 0, "礼盒那一路被换掉了");
  const seg = scr.slice(i, i + 900);
  assert.ok(!/clothFigure/.test(seg), "又把礼物画成衣服了（她说过这边不动）");
  assert.match(seg, /我一度把是衣服的礼物画成了衣服——放错地方了/, "把为什么不动记下来，免得下次又改回去");
});

test("挂进衣柜之后，它跟别的衣服走同一套画法", () => {
  // 衣柜那一栏每一身都走 clothTone + CLOTH_LONG + clothFigure，挂进来的礼物也是其中一身
  assert.match(scr, /const c = clothTone\(it, seq\);/);
  assert.match(scr, /const long = CLOTH_LONG\.test\(String\(it\.name \|\| ""\) \+ " " \+ String\(it\.note \|\| ""\)\);/);
  assert.match(scr, /clothFigure\(\{ tone: c, long, w: \d+, pinned: isPinned\(it\), t \}\)/);
  // 挂礼物落的就是 outfit 里的一身，所以它自动吃到上面那一套
  assert.match(app, /closet: \[\{ occasion: String\(occ \|\| "日常"\)\.trim\(\) \|\| "日常", sets: \[\{ name: nm, note: "你送的" \}\] \}\]/);
});
