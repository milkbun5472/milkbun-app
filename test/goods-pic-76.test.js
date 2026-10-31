// 购物、外卖能给东西画张图，送礼/点外卖/拿给TA看的卡带着图，TA 回话时看得到（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const ui = fs.readFileSync(path.join(__dirname, "..", "js", "screens-ui.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("按名字记图，点了才画", () => {
  assert.match(app, /const drawGoods = async \(name, desc, kind\) =>/);
  assert.match(app, /saveJSON\("x_goodsImgs", n\)/);
});
test("三种卡带图，回话时当图看", () => {
  assert.match(app, /kind: "shopask",\n      ask: [^\n]*\n      \.\.\.\(goodsImgFor\(name\) \? \{ imageRef: goodsImgFor\(name\), goodsImg: true \} : \{\}\)/);
  assert.match(app, /kind: "gift", dir: "toChar"[^\n]*goodsImgFor\(itemName\) \? \{ imageRef: goodsImgFor\(itemName\), goodsImg: true \}/);
  assert.match(app, /kind: "takeout", takeout: item\.takeout, arriveTs: _arr, ts: now, read: true, \.\.\.\(_tImg \? \{ imageRef: _tImg, goodsImg: true \} : \{\}\)/);
  assert.equal((app.match(/m\.kind === "ask" \|\| m\.goodsImg\)/g) || []).length, 2);
});
test("购物详情和外卖菜单都有「画一张」，卡上画得出图", () => {
  assert.equal((ui.match(/"data-wk": "goodsdraw"/g) || []).length, 2);
  assert.match(comp, /function GoodsPic\(\{ imgKey, style, onClick \}\)/);
  assert.match(ui, /function toneSwatch\(c, style, \.\.\.kids\)/);
});
