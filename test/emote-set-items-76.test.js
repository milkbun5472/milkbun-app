// 自己的表情包老说「没挑够九个」（2026-10-30）：提示词补上 JSON 形状，解析认裸数组和别的键名
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
const a = s.indexOf("  const emoteSetItems = "), b = s.indexOf("  const makeMyEmoteSet = ");
const f = new Function(s.slice(a, b) + ";return emoteSetItems;")();
const nine = Array.from({ length: 9 }, (_, i) => ({ name: "表情" + i, look: "画" + i }));
test("items、裸数组、别的键名都认", () => {
  assert.equal(f({ items: nine }).length, 9);
  assert.equal(f(nine).length, 9);
  assert.equal(f({ emotes: nine }).length, 9);
});
test("两套都走这一份，她那套写明 JSON 形状", () => {
  assert.equal((s.match(/const items = emoteSetItems\(d\);/g) || []).length, 2);
  assert.match(s, /只输出这个形状的 JSON：\{\\"items\\"/);
});
