// 线下：上一拍怎么起笔的摆在离生成最近的地方（2026-11-01：连着两拍「江风往领口里灌」）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const f = new Function(eng.slice(eng.indexOf("function offlineLastOpening"), eng.indexOf("async function generateOffline(")) + "; return { offlineLastOpening, offlineOpeningTail };")();
test("取上一拍第一句", () => {
  const msgs = [{ role: "user", content: "说来听听" }, { role: "char", content: "江风卷着水汽直往领口里钻，我把下巴缩进去。「都说了没许！」" }, { role: "user", content: "对不对" }];
  assert.equal(f.offlineLastOpening(msgs), "江风卷着水汽直往领口里钻，我把下巴缩进去。");
  assert.match(f.offlineOpeningTail(msgs), /〔起笔〕上一拍是这样开头的：「江风卷着水汽/);
  assert.equal(f.offlineOpeningTail([]), "");
});
test("单人和群线下的尾巴都接上，重写那轮不加", () => {
  assert.match(eng, /rerollTail \+ \(session\.rerollAvoid \? "" : offlineOpeningTail\(session\.msgs\)\)/);
  assert.match(eng, /const gTail = [^\n]*gContinueCue \+ \(session\.rerollAvoid \? "" : offlineOpeningTail\(session\.msgs\)\)/);
});
