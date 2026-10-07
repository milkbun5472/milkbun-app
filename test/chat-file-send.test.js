const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
test("chat ＋ panels (single and group) offer 文件; text files only; gbk fallback; cap", () => {
  assert.equal((comp.match(/\["file", "文件", "file"\]/g) || []).length, 2);
  assert.match(comp, /function pickTextFile\(onMsg, opts\)/);
  assert.match(comp, /inp\.accept = "\.txt,\.md/);
  assert.match(comp, /new TextDecoder\("gb18030"\)/);
  assert.match(comp, /const FILE_MAX = 12000;/);
  assert.equal((comp.match(/if \(m\.kind === "file"\) \{/g) || []).length, 2, "单聊群聊都要画文件卡");
});
test("model reads the file as a file, not as her words", () => {
  assert.match(app, /m\.kind === "file" \? "【" \+ uName \+ "发来一个文件「"/);
  ["filecard", "filename", "filebody"].forEach(k => assert.ok(ts.includes('["' + k + '", '), k));
});
test("PDF and docx via vendored, lazily loaded libraries", () => {
  assert.ok(fs.existsSync(__dirname + "/../vendor/pdf.min.js") && fs.existsSync(__dirname + "/../vendor/pdf.worker.min.js") && fs.existsSync(__dirname + "/../vendor/mammoth.browser.min.js"));
  // 2026-10-06：聊天发文件的 PDF 读法合进 core.js 那一份 extractPdfText（懒加载在 loadPdfjs 里）
  const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");
  assert.match(comp, /function pdfToText\(buf\) \{ return extractPdfText\(/);
  assert.match(core, /function loadPdfjs\(/);
  assert.match(core, /tryLoad\("vendor\/pdf\.min\.js", "vendor\/pdf\.worker\.min\.js"\)/, "先用自带那份");
  assert.match(comp, /lazyScript\("vendor\/mammoth\.browser\.min\.js"\)/);
  const idx = fs.readFileSync(__dirname + "/../index.html", "utf8");
  assert.ok(!/pdf\.min\.js|mammoth/.test(idx), "解析库不该进开机那一串");
});
