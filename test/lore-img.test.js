// 她 2026-10-07：「生图额外读到专门的世界书」——只在画图时发，聊天里一个字都不带
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const s = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const a = s.indexOf("function loreScopeOn"), b = s.indexOf("function loreLine");
const f = new Function("getQueryVec", "_loreVecCache", "cosSim", "loreKeywordHit",
  s.slice(a, b) + ";return {selectLore, loreText: (e,o)=>selectLore(e,o).map(x=>x.payload).join('|'), loreImgText, imgLorePart};")(
  () => null, () => new Map(), () => 0, (e, t) => String(t).includes(e.keyword));
const E = [
  { id: 1, category: "世界观", payload: "港口城有宵禁", alwaysOn: true },
  { id: 2, category: "生图", payload: "厚涂油画风", alwaysOn: true },
  { id: 3, category: "生图", payload: "海边要画灯塔", alwaysOn: false, keyword: "海边" },
  { id: 4, category: "生图", payload: "只给甲", alwaysOn: true, charIds: ["甲"] }
];

test("聊天那一口拿不到生图条目", () => {
  assert.equal(f.loreText(E, { scope: "chat", charIds: ["甲"], text: "海边" }), "港口城有宵禁");
});

test("画图只拿生图条目：常驻都带、关键词对画面描述、认绑定角色", () => {
  assert.equal(f.loreImgText(E, ["乙"], "咖啡店"), "厚涂油画风");
  assert.equal(f.loreImgText(E, ["甲"], "海边散步"), "厚涂油画风\n海边要画灯塔\n只给甲");
});

test("两处拼画面要求都接上；排在身份锁和未成年锁后面", () => {
  const photo = s.slice(s.indexOf("function buildPhotoPrompt"), s.indexOf("function buildScenePrompt"));
  assert.ok(photo.indexOf("if (_imgLore) parts.push(_imgLore)") > photo.indexOf("if (isMinor) parts.push"));
  assert.ok(photo.indexOf("if (_imgLore) parts.push(_imgLore)") > photo.indexOf("if (visualCanon) parts.push"));
  assert.match(s.slice(s.indexOf("function buildScenePrompt")), /imgLorePart\(\[char && char\.id\]\.filter/);
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /window\.__loreImg = \(charIds, sceneText\) => loreImgText\(loreRef\.current, charIds, sceneText\)/);
});
