// 一起读（她 2026-10-13 群里转来：「要么导入不了，要么导进去是乱码」「pdf 没办法选中」）
const assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");
// 选择框什么都给选，进来再看文件头认类型
assert.match(read, /accept: (ANY_FILE|"\*\/\*"), style: \{ display: "none" \}, onChange: onFile, "data-wk": "readpageinput"/);
assert.match(read, /const sniffPdf = headStr\.indexOf\("%PDF"\) === 0/);
assert.match(core, /async function epubToText\(buf\)/);
// txt 几种编码都认
const i = core.indexOf("function decodeTextBytes"), j = core.indexOf("async function readTextFileSmart");
const d = new Function(core.slice(i, j) + "; return decodeTextBytes;")();
assert.equal(d(Buffer.from("a741a66ea141a540acc9a143b36fac4fb4fab8d5", "hex")), "你好，世界。這是測試");
assert.equal(d(Buffer.from("c4e3bac3a3accac0bde7a1a3d5e2cac7b2e2cad4", "hex")), "你好，世界。这是测试");
assert.equal(d(Buffer.from("第一章 你好，世界", "utf16le")), "第一章 你好，世界");
assert.equal(d(Buffer.from("你好，世界", "utf8")), "你好，世界");
console.log("ok");
