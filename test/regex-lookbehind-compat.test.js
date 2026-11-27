// 旧 iPhone（iOS 16.4 以前）不认往前看正则，写成字面量整个脚本就装不进来（群友 2026-11-27 白屏）
const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const reLB = require("../js/regex-compat.js");
const dir = path.join(__dirname, "../js");
test("js 里不许再有往前看的正则字面量，也不许直接 new RegExp 带往前看", () => {
  const bad = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== "regex-compat.js")) {
    fs.readFileSync(path.join(dir, f), "utf8").split("\n").forEach((l, i) => {
      if (l.trim().startsWith("//")) return;
      if (/\(\?<[=!]/.test(l) && !/globalThis\.reLB \|\| RegExp\)\(/.test(l)) bad.push(f + ":" + (i + 1));
    });
  }
  assert.deepStrictEqual(bad, []);
});
test("旧系统那条路：往前看整截拿掉，括号和字符类里的括号都认得", () => {
  assert.strictEqual(reLB.strip("(?<![0-9])1[0-7]岁"), "1[0-7]岁");
  assert.strictEqual(reLB.strip("(?<=[（(][^（）()]{2,14}[）)])\\s+(?=x)"), "\\s+(?=x)");
  assert.strictEqual(reLB.strip("a(?<=(b|c))d|(?<!拍一)拍"), "ad|拍");
  new RegExp(reLB.strip("(?<=[\\u4e00-\\u9fff]{3}[了吧])\\s+(?=[\\u4e00-\\u9fff])"), "g");
});
test("index.html 最先装 regex-compat", () => {
  const h = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.ok(h.indexOf("js/regex-compat.js") >= 0 && h.indexOf("js/regex-compat.js") < h.indexOf('src="js/'+"character-pronoun"));
});
