import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import vm from "node:vm";
const src = readFileSync(new URL("../js/engine.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const ctx = { console, setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, documentElement: { style: {} } }, navigator: {} }; ctx.window = ctx; ctx.addEventListener = () => {}; ctx.removeEventListener = () => {}; vm.createContext(ctx); vm.runInContext(src, ctx);
test("抽记忆时给模型看的「记过了」里有跟这段对话沾边的旧事", () => {
  const lib = [];
  for (let i = 0; i < 80; i++) lib.push({ id: "n" + i, text: "小雨 第" + i + "天聊了些日常琐事", tags: ["日常"], ts: Date.now() - i * 3600e3 });
  lib.push({ id: "old", text: "小雨 不吃香菜，一闻到就难受", tags: ["饮食", "香菜"], ts: Date.now() - 60 * 86400e3 });
  const out = ctx.memExtractAvoidList(lib, "今晚吃火锅吗？锅里别放香菜啊", 40);
  assert.ok(out.length <= 40);
  assert.ok(out.includes("小雨 不吃香菜，一闻到就难受"), "两个月前那条没带上");
  assert.ok(out.includes(lib[0].text), "最新的那条也要在");
});
test("单聊、群聊、群线下抽取都用它", () => {
  assert.equal((app.match(/memExtractAvoidList\(/g) || []).length, 3);
});
test("全是嗯嗯好的不抽；有正经内容才抽", () => {
  assert.equal(ctx.memExtractWorthy([{ content: "嗯嗯" }, { content: "好" }, { content: "哈哈哈" }, { content: "[微笑]" }, { content: "晚安～" }]), false);
  assert.equal(ctx.memExtractWorthy([{ content: "嗯" }, { content: "我下个月要搬去杭州了，公司把我调过去" }]), true);
  assert.equal((app.match(/memExtractWorthy\(/g) || []).length, 3);
});
test("开了向量：换了说法的旧事也进「记过了」", () => {
  const lib = [];
  for (let i = 0; i < 60; i++) lib.push({ id: "n" + i, text: "小雨 第" + i + "天的日常", ts: Date.now() - i * 3600e3 });
  lib.push({ id: "dark", text: "小雨晚上不敢一个人关灯睡觉", ts: Date.now() - 90 * 86400e3 });
  const vec = new Map(lib.map(e => [e.id, { v: e.id === "dark" ? [1, 0] : [0, 1], m: "m" }]));
  ctx._memVecCache = () => vec;
  const without = ctx.memExtractAvoidList(lib, "她说她怕黑", 40, null);
  const withVec = ctx.memExtractAvoidList(lib, "她说她怕黑", 40, { v: [1, 0], m: "m" });
  assert.ok(withVec.includes("小雨晚上不敢一个人关灯睡觉"));
  assert.ok(withVec.length <= 40 && without.length <= 40);
});
test("很久以前的换句话重复也能扫出来，只标请复核；进展不算重复", () => {
  const M = (globalThis.__nd = (() => { const c = { console }; c.globalThis = c; vm.createContext(c); vm.runInContext(readFileSync(new URL("../js/memory-near-duplicate.js", import.meta.url), "utf8"), c); return c.MemoryNearDuplicate; })());
  const d = 86400e3, n = Date.now();
  const g = M.scan([
    { id: "a", source: "auto", text: "小雨不吃香菜，闻到就难受", charIds: ["c"], ts: n - 60 * d },
    { id: "b", source: "auto", text: "小雨不吃香菜，一闻到就难受", charIds: ["c"], ts: n },
    { id: "c", source: "auto", text: "小雨计划下周去看海", charIds: ["c"], ts: n - 30 * d },
    { id: "e", source: "auto", text: "小雨已经去看过海了", charIds: ["c"], ts: n }]);
  assert.equal(g.length, 1);
  assert.equal(g[0].matchKind, "near_any_time"); assert.equal(g[0].confidence, "review");
});
test("齿轮页里点得到「找重复记忆」", () => {
  const ui = readFileSync(new URL("../js/screens-ui.js", import.meta.url), "utf8");
  assert.match(ui, /onFindDuplicates: onScanDuplicates \? \(\) => setDuplicatePreview\(onScanDuplicates\(\)\) : null/);
  assert.match(ui, /"data-part": "memdup"/);
});
