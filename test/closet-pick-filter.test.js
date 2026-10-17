// 状态卡改穿着能从衣柜挑、打字筛（她 2026-10-17）；线下「穿什么」共用同一个 ClosetPick
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
const a = comp.indexOf("function closetFilter("), b = comp.indexOf("function ClosetPick(");
const closetFilter = new Function(comp.slice(a, b) + "; return closetFilter;")();
const sets = [{ name: "白衬衫", note: "棉的", occasion: "日常" }, { name: "黑色风衣", note: "", occasion: "约会" }, { name: "格子睡衣", note: "", occasion: "在家" }];
test("打字筛衣柜：名字、说明、场合都算，空格隔开要都带上", () => {
  assert.deepStrictEqual(closetFilter(sets, "衬衫").map(x => x.name), ["白衬衫"]);
  assert.deepStrictEqual(closetFilter(sets, "约会").map(x => x.name), ["黑色风衣"]);
  assert.deepStrictEqual(closetFilter(sets, "白 棉").map(x => x.name), ["白衬衫"]);
  assert.strictEqual(closetFilter(sets, "").length, 3);
  assert.strictEqual(closetFilter(sets, "西装").length, 0);
});
test("状态卡和线下都走 ClosetPick，状态卡拿得到他的衣柜", () => {
  const card = comp.slice(comp.indexOf("function StateCard("), comp.indexOf("function readOfflineStyleDocument"));
  assert.ok(card.includes("h(ClosetPick"));
  const off = comp.slice(comp.indexOf("function OfflineWardrobe("), comp.indexOf("function OfflineMode("));
  assert.ok(off.includes("h(ClosetPick"));
  assert.ok(/wearSets:[^\n]*closetSetsOf\(/.test(app));
});
