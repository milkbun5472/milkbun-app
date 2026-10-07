const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const study = fs.readFileSync(path.join(__dirname, "..", "js", "study.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 群友 2026-10-06：「为什么它一直识别 pdf 识别不出页数」——各页拼成一长串，页码全丢了
test("PDF 读出来每页标页码；聊天发文件和一起学共用这一份读法", () => {
  assert.match(core, /pages\.push\(opts\.pageMarks \? "〔PDF 第 " \+ p \+ " 页〕\\n" \+ body : body\);/);
  assert.match(study, /extractPdfText\(f, onProg, \{ pageMarks: true \}\)/);
  assert.match(comp, /function pdfToText\(buf\) \{ return extractPdfText\(buf, null, \{ pageMarks: true/);
  assert.ok(!/async function pdfToText/.test(comp), "聊天那份自己抄的 PDF 读法又回来了");
});

function loadStudy() {
  const i = study.indexOf("function materialChunks("), j = study.indexOf("function chunkScore(", i);
  assert.ok(i > 0 && j > i, "抠不出 materialChunks/askedPages");
  return new Function("MAT_CHUNK", study.slice(i, j) + "\nreturn { materialChunks, askedPages, cnToInt };")(40);
}
test("切开的后半截也带页码；她说「第十七页」认得出", () => {
  const K = loadStudy();
  const txt = "〔PDF 第 16 页〕\nabandon ability able about above abroad absence absolute absorb\n\n〔PDF 第 17 页〕\nbacon badge baggage";
  const ch = K.materialChunks("词汇书", txt);
  assert.ok(ch.length >= 3);
  assert.equal(ch[0].page, 16);
  assert.match(ch[1].text, /^〔PDF 第 16 页·接上〕/);
  assert.equal(ch[ch.length - 1].page, 17);
  assert.deepEqual([...K.askedPages("第十七页根本没有a开头的单词")], [17]);
  assert.deepEqual([...K.askedPages("翻到第 23 页")], [23]);
  assert.equal(K.cnToInt("一百零五"), 105);
});
