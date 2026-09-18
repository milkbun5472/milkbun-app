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

// ── ② 是衣服的礼物画成衣服 ──────────────────────────────────
test("是衣服就画成衣服，不是就还是礼盒", () => {
  assert.match(scr, /closetGiftLike\(g\.name, g\.cat\)\n\s*\/\/ ⚠️装在一个 40×40 的格子里居中缩放/);
  assert.match(scr, /clothFigure\(\{ tone: clothTone\(\{ name: g\.name, note: "" \}, gi\), long: CLOTH_LONG\.test/);
  // ⚠️不是一律画成衣服：这一栏里还有桂花糖、唱片、手链，全画成衣服就是说谎
  assert.match(scr, /: h\("div", \{ className: "shrink-0 relative", style: \{ width: 40, height: 40, borderRadius: 7/, "礼盒那一路没留着");
  // 认不认是衣服跟「能不能挂进衣柜」是同一把尺子——不然会出现「按钮说能挂、图上却是个盒子」
  assert.equal((scr.match(/function closetGiftLike\(/g) || []).length, 1);
  assert.match(scr, /closetGiftLike\(openGift\.name, openGift\.cat\)/, "挂衣柜那个判定换了别的尺子");
});

test("小格子里那件衣服要跟礼盒一样高，不然一列下来行高参差", () => {
  assert.match(scr, /style: \{ width: 40, height: 40 \} \},\n\s*h\("div", \{ style: \{ transform: "scale\(\.72\)", transformOrigin: "center" \} \}/);
});
