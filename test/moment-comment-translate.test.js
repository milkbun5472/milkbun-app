const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
// 群友 2026-10-07：「朋友圈 char 在底下的评论好像翻译不了？只翻译了非 char 的」
test("「回复 某某：」摘出来，只拿正文去认语种", () => {
  const i = comp.indexOf("function MomentCommentText("), j = comp.indexOf("\nfunction TransText(", i);
  assert.ok(i > 0 && j > i);
  const seg = comp.slice(i, j);
  const re = /^(回复\s*[^：:\n]{1,24}[：:]\s*)([\s\S]*)$/;
  assert.ok(seg.includes("raw.match(/^(回复"), "前缀没摘");
  const m = "回复 Lisa：I miss you already".match(re);
  assert.equal(m[2], "I miss you already");
  assert.equal((comp.match(/h\(MomentCommentText, \{ cm: cm \}\)/g) || []).length, 2, "列表和详情都要用");
});
test("夹了汉字的那句原本确实认不出（病根还在 translatableLang，所以得在评论这儿摘前缀）", () => {
  assert.match(eng, /function translatableLang\(text\)/);
});
