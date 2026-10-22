// 施工规则/typing-hot-path.md：会长高的输入框全库只用 fitTextarea，不许再「先 height=auto 再读 scrollHeight」
const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "js");
test("全库没有「先 height=auto 再读 scrollHeight」的自动长高", () => {
  const bad = [];
  fs.readdirSync(dir).filter(f => f.endsWith(".js")).forEach(f => {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    if (/style\.height\s*=\s*["']auto["'][^\n]{0,120}scrollHeight/.test(src)) bad.push(f);
  });
  assert.deepEqual(bad, [], "改用 fitTextarea(el, maxH)：" + bad.join("、"));
});
test("fitTextarea 是公共那一份，三处输入框都接上；量高度时样式按框缓存", () => {
  const comp = fs.readFileSync(path.join(dir, "components.js"), "utf8"), ff = fs.readFileSync(path.join(dir, "fanfic.js"), "utf8");
  assert.match(comp, /function fitTextarea\(el, maxH\)/);
  assert.match(comp, /const fit = \(\) => fitTextarea\(ref\.current, DRAFT_MAX_H\);/);
  assert.match(comp, /const grow = \(\) => fitTextarea\(ref\.current,/);
  assert.match(ff, /fitTextarea\(taRef\.current, 130\)/);
  assert.match(comp, /if \(!c \|\| c\.w !== w\) \{/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "施工规则", "typing-hot-path.md")));
});
