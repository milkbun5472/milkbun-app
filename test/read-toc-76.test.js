const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js/read.js"), "utf8");

// 群里 2026-11-04：一起读只能一页页翻，要能选目录
test("一起读：翻页条上有目录；目录是整页，认章节，能填页码跳", () => {
  assert.match(src, /setTocOpen\(true\)/);
  assert.match(src, /tocOpen \? h\(ReadToc,/);
  assert.match(src, /function ReadToc\(props\)/);
  assert.match(src, /position: "fixed", inset: 0, zIndex: 60 \}[\s\S]{0,200}"data-wk": "readtoc"/);
});
test("章节标题认得出来，正文里的长句不算", () => {
  const m = src.match(/const TOC_RE = (\/.*\/i);/);
  const re = eval(m[1]);
  ["第一章 雨夜", "第12回", "序章", "番外：冬", "Chapter 3"].forEach(x => assert.ok(re.test(x), x));
  ["他说第一章写得不好", "那天下雨"].forEach(x => assert.ok(!re.test(x), x));
});
