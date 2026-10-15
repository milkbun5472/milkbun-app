// 草稿不放小仓库（她 2026-10-15 实测：打字→左上角返回→再进来就没了；小仓库满时 setItem 悄悄失败）
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(__dirname + "/../js/components.js", "utf8");
test("DraftInput 草稿走内存＋x_drafts，不碰 localStorage", () => {
  const fn = src.slice(src.indexOf("const DRAFTS ="), src.indexOf("const ref = useRef(null);", src.indexOf("function DraftInput")));
  assert.match(fn, /loadJSON\("x_drafts", \{\}\)/);
  assert.match(fn, /saveJSON\("x_drafts", m\)/);
  assert.ok(!/localStorage/.test(fn), "草稿别再写小仓库");
  // 行为：内存那一份立刻可读（进进出出不依赖落盘）
  const store = {};
  const run = new Function("loadJSON", "saveJSON", "setTimeout", "clearTimeout", fn.slice(0, fn.indexOf("function DraftInput")) + "\nreturn { draftGet, draftPut };");
  const d = run(k => store[k] || {}, (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); }, f => f(), () => {});
  d.draftPut("chat:c1", "回来"); assert.equal(d.draftGet("chat:c1"), "回来"); assert.deepEqual(store.x_drafts, { "chat:c1": "回来" });
  d.draftPut("chat:c1", ""); assert.equal(d.draftGet("chat:c1"), "");
});
