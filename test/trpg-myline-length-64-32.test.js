// 跑团暗线那句被切在半截上（她 2026-09-06 截图：「…真正死因，并亲手」，正好第 44 个字）。
//
// ⚠️她当时的判断是「maxtoken 不够，开到 65535」——但这一支【本来就全是】TOK_MAX=65535，
//   一处都没差。截断在【前端这把尺子】上：模型那边要的是「一句话的秘密目标」，
//   中文一句话四五十字太常见，44 保证每一条都断。
//   所以这条测试钉两件事：那把尺子放开了，而且这一支的 maxTokens 一处都没被往下调。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "trpg.js"), "utf8");

test("暗线那把尺子够一句中文话", () => {
  const m = src.match(/const MYLINE_MAX = (\d+);/);
  assert.ok(m, "没有那把尺子");
  assert.ok(Number(m[1]) >= 100, "还是太短，一句中文话装不下（现在是 " + m[1] + "）");
  // 模型给的候选和她自己写的那条，用的必须是【同一把】尺子
  assert.match(src, /p\.myline : \[\]\)\.map\(x => String\(x \|\| ""\)\.trim\(\)\.slice\(0, MYLINE_MAX\)\)/,
    "模型给的候选还压在写死的数上");
  assert.match(src, /myline: v\.slice\(0, MYLINE_MAX\)/, "她自己写的那条还压在写死的数上");
  // 暗线那两处不许再出现写死的长度（别处的 slice(0,44) 是支线笔记，不归这条管）
  src.split("\n").filter(l => l.indexOf("myline") >= 0).forEach(l => {
    assert.equal(/myline[^\n]*(?:trim\(\)|v)\.slice\(0, \d+\)/.test(l), false, "暗线那把尺子又被写死了：" + l.trim().slice(0, 90));
  });
});

test("这一支的 maxTokens 一处都没往下调", () => {
  assert.match(src, /const TOK_MAX = 65535;/);
  const calls = src.match(/maxTokens: [A-Za-z_0-9]+/g) || [];
  assert.ok(calls.length > 0, "找不到任何调用");
  calls.forEach(c => assert.equal(c, "maxTokens: TOK_MAX", "有一处没走 TOK_MAX：" + c));
});
