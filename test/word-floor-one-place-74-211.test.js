// 她 2026-09-28：「小剧场也加一个字数，统一一下公共设置字数拉条，不要一样一处」。
// 原来三处各写各的：线下一根 0–8000 的拉条、同人文一个自己 clamp 的数字框、小剧场一份都没有。
// 按 one-public-mechanism 办：开公共的（style-presets 管算法、components 管长相），
// 已有的两处也搬过去，小剧场新接上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const sp = R("style-presets.js"), comp = R("components.js"), fic = R("fanfic.js"), th = R("theater.js");

global.window = global.window || {};
require("../js/style-presets.js");
const SP = global.window.StylePresets;

test("算法只有一份：clamp / 数字数 / 那句规则", () => {
  assert.equal(typeof SP.clampWordFloor, "function");
  assert.equal(typeof SP.countWords, "function");
  assert.equal(SP.WORD_FLOOR_MAX, 20000);
  assert.equal(SP.clampWordFloor(0), 0, "0＝没设");
  assert.equal(SP.clampWordFloor(50), 200, "地板 200");
  assert.equal(SP.clampWordFloor(99999), 20000);
  assert.equal(SP.countWords("你 好\n吗"), 3, "空白不算");
});

test("公共那一层能表达各处的分寸：同人文一章不给上限", () => {
  assert.match(SP.wordRule(1500), /不少于 1500 字、不超过 2025 字/);
  assert.match(SP.wordRule(1500, { cap: false }), /不少于 1500 字（按中文字符算）/);
  assert.ok(!/不超过/.test(SP.wordRule(1500, { cap: false })), "搬过来时不许顺手给同人文压个上限");
});

test("同人文不再保留第二套算法，只转交", () => {
  assert.match(fic, /function clampMinChars\(v\) \{ const sp = _SP\(\); return sp \? sp\.clampWordFloor\(v\) : 0; \}/);
  assert.match(fic, /sp \? sp\.countWords\(text\)/);
  assert.ok(!/return Math\.max\(200, Math\.min\(MIN_CHARS_MAX, n\)\);/.test(fic), "旧的那份 clamp 要撤掉");
});

test("界面只有一段，四处共用", () => {
  assert.match(comp, /function WordFloorSection\(\{ value, onChange, title, note, hint, max \}\)/);
  assert.equal((comp.match(/h\(WordFloorSection, \{/g) || []).length, 2, "单人线下和群线下两处都搬过去了");
  assert.match(fic, /h\(window\.WordFloorSection, \{/, "同人文搬过去了");
  assert.match(th, /h\(window\.WordFloorSection, \{/, "小剧场新接上");
  // 各处兜底不一样，所以 hint/note 由调用点给
  assert.match(fic, /hint: "约 " \+ minCharsFor\(cfg\) \+ " 字"/);
});

test("小剧场三处接齐：设置 → 存档 → 提示词", () => {
  assert.match(th, /title: "每拍最少写多少字"/);
  assert.match(th, /minWords: e2\.minWords \|\| 0, rounds:/, "存不进这条 if 线就是白设");
  assert.match(th, /minWords: line\.minWords \|\| 0, goal: round\.goal/, "打开编辑时要带现值");
  assert.match(th, /window\.StylePresets\.wordRule\(window\.StylePresets\.clampWordFloor\(line\.minWords\)\)/, "发进提示词那一句要走公共那份");
});
