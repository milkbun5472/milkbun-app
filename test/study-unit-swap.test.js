// 群友 2026-10-10：叫老师按书第 17 页教、他也找好了，一句「你先自己检查一遍」又跳回大纲那串 advocate……
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(__dirname + "/../js/study.js", "utf8");

const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };

test("大纲写明说定的材料为准；说定的那份每轮都在「当前小节」里", () => {
  const outlineSlice = new Function(cut("  function outlineSlice(", "  function progressText(") + "\nreturn outlineSlice;")();
  const ol = { level: "考研", units: [{ id: "u1", title: "高频词汇", vocab: ["advocate", "affect"], grammar: [{ id: "g1", label: "核心义" }] }] };
  const before = outlineSlice(ol, "u1", "考研英语");
  assert.match(before, /以你们说定的为准/);
  assert.match(before, /词汇：advocate、affect/);
  ol.units[0] = Object.assign({}, ol.units[0], { material: "书第17页、词频≥8", vocab: ["abandon", "abstract"] });
  const after = outlineSlice(ol, "u1", "考研英语");
  assert.match(after, /这一小节你们说定改用：书第17页、词频≥8/);
  assert.match(after, /说定的词：abandon、abstract/);
  assert.doesNotMatch(after, /advocate/);
});

test("unitSwap 只换词和说明，要点 id 不动；只认老师", () => {
  const parseUnitSwap = new Function(cut("  function parseUnitSwap(", "  async function genTurn(") + "\nreturn parseUnitSwap;")();
  assert.equal(parseUnitSwap({}), null);
  const sw = parseUnitSwap({ unitSwap: { material: "第17页", vocab: ["a", "", "b"] } });
  assert.equal(sw.material, "第17页"); assert.equal(sw.vocab.join(","), "a,b");
  const sw2 = cut("    function swapUnitMaterial(", "    function recordEvidence(");
  assert.doesNotMatch(sw2, /grammar/, "要点是学习证据的外键，不许换");
  assert.match(src, /\(role === "teach" \|\| role === "nv1-teacher"\) && res && res\.unitSwap\) swapUnitMaterial\(res\.unitSwap\);/);
  assert.match(src, /return \{ unitSwap: parseUnitSwap\(d\), turns: turns,/, "三人课堂那一路也接上");
});
