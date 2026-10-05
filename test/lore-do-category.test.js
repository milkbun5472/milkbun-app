const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");

// 她 2026-10-05：冰箱 HTML 世界书 Gemini 能出、Sonnet 不出——世界书被当成事实交出去，模型只是「知道」。
// 「照做」一类换成指令口气，八个去向都走 loreText 这一处。
function loadLore() {
  const i = eng.indexOf("function loreText(");
  const j = eng.indexOf("function loreEntryState(", i);
  assert.ok(i > 0 && j > i, "抠不出 loreLine/loreText");
  const selectLore = (entries) => entries;
  return new Function("selectLore", eng.slice(i, j) + "\nreturn { loreLine, loreText };")(selectLore);
}
const { loreText } = loadLore();

test("照做那一类换成指令口气，HTML 单独一条发", () => {
  const out = loreText([{ category: "照做", title: "冰箱小卡", payload: "提到冰箱就发 <div>…</div>" }]);
  assert.match(out, /^〔照做 · 冰箱小卡〕/);
  assert.match(out, /输出指令/);
  assert.match(out, /单独作为一条消息/);
  assert.match(out, /提到冰箱就发/);
});

test("其他分类还是原来的样子", () => {
  assert.equal(loreText([{ category: "地点", title: "港口", payload: "宵禁" }]), "〔港口〕宵禁");
});

test("执行准则里写了照做是例外，编辑页能选照做", () => {
  const i = eng.indexOf("const WORLDBOOK_RULE"), j = eng.indexOf("const CHARCARD_RULE", i);
  assert.ok(i > 0 && j > i);
  assert.match(eng.slice(i, j), /〔照做〕的条目不是事实/);
  assert.match(scr, /const LORE_CATEGORIES = \[[^\]]*"照做"/);
});
