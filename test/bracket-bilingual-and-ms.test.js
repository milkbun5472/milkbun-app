// 她 2026-10-17 群里粤语截图：「原文【中文】」也认成译文；免费线路多一家微软
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const s = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
global.translatableLang = () => ""; global.toSimplified = x => x.replace(/[睇邊個頭髮點樣夠曬陽]/g, "x");
const a = s.indexOf("function hanLineLang("), b = s.indexOf("// 模型把中译另起了一行");
const c = s.indexOf("function joinBilingualLines("), d = s.indexOf("// 这一条的中译已经在文本里了");
const m0 = s.indexOf("const BI_MARK_RE"), m1 = s.indexOf("function hanLineLang(") > m0 ? s.indexOf("function hanLineLang(") : s.indexOf("function splitBilingual(");
const api = new Function(s.slice(a, b) + s.slice(c, d) + "; return { splitBilingual, joinBilingualLines };")();
test("粤语【普通话】劈成原文＋译文", () => {
  assert.deepStrictEqual(api.splitBilingual("睇就睇,邊個怕你睇【看就看,谁怕你看】"), { text: "睇就睇,邊個怕你睇", zh: "看就看,谁怕你看" });
  assert.deepStrictEqual(api.splitBilingual("ありがとう【谢谢】"), { text: "ありがとう", zh: "谢谢" });
});
test("普通中文、发东西的标记、括号里是粤语的都不劈", () => {
  assert.equal(api.splitBilingual("今天好累【真的】"), null);
  assert.equal(api.splitBilingual("好开心【表情】"), null);
  assert.equal(api.splitBilingual("睇就睇【睇就睇咗】"), null);
});
test("【 被拆到两行的先接回一行", () => {
  assert.deepStrictEqual(api.joinBilingualLines(["頭髮都未吹好【头发", "都还没吹好】"], true), ["頭髮都未吹好【头发都还没吹好】"]);
});
test("免费线路：Google → 微软 → MyMemory → 模型（模型要明说才叫）", () => {
  const fn = s.slice(s.indexOf("async function translateToZh"), s.indexOf("async function translateToZh") + 1800);
  const i = ["_transGoogle", "_transMicrosoft", "_transMyMemory", "_transModel"].map(x => fn.indexOf(x));
  assert.ok(i[0] > 0 && i[1] > i[0] && i[2] > i[1] && i[3] > i[2]);
  assert.match(s, /&from=" \+ src/);
});
