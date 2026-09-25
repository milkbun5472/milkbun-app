// 她 2026-09-24：「一起学要不要搞可以上传文件」——先做她传资料进课程这一半。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const fn = name => { const i = src.indexOf("function " + name + "("); assert.ok(i > 0, "抠不出 " + name); return src.slice(i, src.indexOf("\n  }\n", i) + 4); };

// 桩照 addMaterial 写的那一份：课身上 materials:[{id,name,kind,chars,addedAt}]，正文进 MAT_CACHE / 那张表
function harness() {
  const ctx = { Math, JSON, Number, String, Array, Object, Set };
  vm.createContext(ctx);
  vm.runInContext("const MAT_BUDGET = 6000, MAT_CHUNK = 700; const MAT_CACHE = {};\n"
    + ["materialChunks", "chunkScore", "queryGrams", "materialText"].map(fn).join("\n")
    + "\nObject.assign(this, { pick: materialText, cache: MAT_CACHE });", ctx);
  return ctx;
}

test("资料不多就整份给老师，并且带着出处", () => {
  const H = harness();
  H.cache.m1 = "第一课 て形\n\n食べる→食べて";
  const out = H.pick({ materials: [{ id: "m1", name: "课本第三章" }] }, "て形");
  assert.match(out, /全部/);
  assert.match(out, /〔课本第三章〕/);
  assert.match(out, /食べる→食べて/);
});

test("资料多了只挑跟这节有关的几段，而且不超预算", () => {
  const H = harness();
  const filler = Array.from({ length: 40 }, (_, i) => "无关的段落" + i + "。" + "天气很好".repeat(40)).join("\n\n");
  H.cache.m1 = filler + "\n\n可能形的变化规则：五段动词词尾换成え段加る。\n\n" + filler;
  const out = H.pick({ materials: [{ id: "m1", name: "讲义" }] }, "可能形 变化规则");
  assert.match(out, /挑了跟这节有关的几段/);
  assert.match(out, /可能形的变化规则/, "最相关那段没挑上");
  assert.ok(out.length < 6000 + 1200, "塞得比预算多太多了：" + out.length);
});

test("没资料就什么都不给", () => {
  assert.equal(harness().pick({ materials: [] }, "x"), "");
});

test("读 PDF、存正文只有一份：一起读和一起学共用 core.js 那一处", () => {
  assert.match(core, /function makeTextStore\(dbName, storeName\)/);
  assert.match(core, /async function extractPdfText\(file, onProg\)/);
  assert.doesNotMatch(read, /function extractPdfText\(|function loadPdfjs\(|indexedDB\.open/, "一起读里还留着一份");
  assert.match(read, /const _store = makeTextStore\(DB_NAME, STORE\);/, "一起读的书得还在原来那张表里");
  assert.match(src, /makeTextStore\("StudyDocsDB", "docs"\)/);
});

test("老师讲课、起大纲、做闪卡三处都翻得到资料", () => {
  const p = fn("buildStudyPrompt");
  assert.match(p, /const mats = materialText\(cur,/);
  assert.match(fn("genFlashcards"), /materialText\(cur,/);
  assert.match(src, /const mats = materialText\(fresh, \[cur\.subject, focus\.trim\(\)/);
  assert.match(src, /useEffect\(function \(\) \{ const c = sess\.curriculum_id \? findCurriculum\(sess\.curriculum_id\) : null; if \(c\) loadMaterials\(c\); \}/);
});
