// 一起学五种模式课上都能发文件（她 2026-11-04）
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const s = R("study.js");
test("共用一份：图当图，文档读成字；有课程收进资料", () => {
  assert.match(s, /async function studyDocEntry\(file, typed, curId\) \{/);
  assert.match(s, /if \(curId\) \{\n\s*await saveMaterialText\(curId, name, got\.kind, t\);/);
  assert.match(s, /t\.slice\(0, DOC_CAP\)/);
});
test("课页、自习室、我来教三处输入栏都接上", () => {
  assert.equal((s.match(/accept: "image\/\*," \+ ANY_FILE/g) || []).length, 2);
  assert.equal((s.match(/if \(!isImgFile\(file\)\) \{/g) || []).length, 2);
  assert.match(s, /"data-wk": "tbfile"/);
  assert.match(R("theme-studio.js"), /"tbfile"/);
});
test("气泡只露文件名和字数", () => {
  assert.equal((s.match(/docShow\(m, "content"\)/g) || []).length, 2);
  assert.match(s, /m\.doc \? docShow\(m, "text"\) : voiceShow\(m\.text\)/);
});
