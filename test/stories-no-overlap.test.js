const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"); const vm = require("vm");
test("限时动态卡：小贴纸、表情不压在字上", () => {
  const ctx = { window: { addEventListener() {} }, React: { createElement() {}, useState: () => [0, () => {}], useEffect() {} }, console, localStorage: { getItem: () => null, setItem() {} } };
  ctx.window.window = ctx.window; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync("js/stories.js", "utf8"), ctx);
  const L = ctx.window.Stories.layoutFrom({ texts: [{ t: "椰子鸡煨透了砂锅一揭全是甜味", x: 0.5, y: 0.2, size: 80 }], chips: [{ type: "mood", text: "黏人得逞", x: 0.2, y: 0.2 }], stickers: [{ ch: "🍲", x: 0.7, y: 0.2, size: 110 }] }, false);
  const tx = L.free.filter(f => f.type === "text" && f.tstyle !== "strip"), chip = L.free.find(f => f.tstyle === "strip"), d = L.deco[0];
  const bx = (x, y, w, h) => [x - w / 2, x + w / 2, y - h / 2, y + h / 2], hit = (a, b) => a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];
  const tb = tx.map(f => bx(f.x, f.y, Array.from(f.text).length * f.size * 1.02, f.size * 1.3));
  assert.ok(!tb.some(b => hit(b, bx(chip.x, chip.y, Array.from(chip.text).length * 44 + 40, 66))), "贴纸不压字");
  assert.ok(!tb.some(b => hit(b, bx(d.x, d.y, d.size * 1.1, d.size * 1.1))), "表情不压字");
});
