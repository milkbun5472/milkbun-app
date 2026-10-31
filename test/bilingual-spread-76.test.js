// 一句双语被拆成几泡：中文也按句分，对不上就整段挂最后、前面不拿机翻补（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const pick = name => { const a = eng.indexOf("function " + name + "("); let d = 0, i = eng.indexOf("{", a); for (; i < eng.length; i++) { if (eng[i] === "{") d++; else if (eng[i] === "}" && --d === 0) break; } return eng.slice(a, i + 1); };
const stub = z => String(z).split(/(?<=。)/).filter(Boolean);
const spread = new Function("splitLongBubble", pick("bilingualSpread") + "\nreturn bilingualSpread;")(stub);
test("句数对得上就一泡一句", () => {
  assert.deepEqual(spread(["おやすみ", "無理しないで"], "晚安。别勉强。", true), ["晚安。", "别勉强。"]);
});
test("对不上就整段挂最后，前面是空的（不补机翻）", () => {
  const r = spread(["a", "b", "c"], "晚安。不用勉强回复我。", true);
  assert.deepEqual(r.slice(0, 2), ["", ""]);
  assert.equal(r[2], "晚安。不用勉强回复我。");
});
test("单聊、群聊都走这一份，挂了的不再拿机翻补", () => {
  assert.equal((app.match(/bilingualSpread\(parts, bi\.zh,/g) || []).length, 2);
  assert.match(app, /!_biCovered\.has\(bilingualKey\(w\)\)/);
  assert.match(app, /!gBiCovered\.has\(bilingualKey\(w\)\)/);
});
