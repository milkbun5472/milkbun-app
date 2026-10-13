// 一起读：txt 的几种编码都认（简体 GBK、繁体 Big5、没 BOM 的 UTF-16、UTF-8）；顺带 epub / docx 也能导（她 2026-10-13 群里转来）
const assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");
assert.match(core, /async function epubToText\(buf\)/);
assert.match(read, /text = await epubToText\(await f\.arrayBuffer\(\)\)/);
const i = core.indexOf("function decodeTextBytes"), j = core.indexOf("async function readTextFileSmart");
const d = new Function(core.slice(i, j) + "; return decodeTextBytes;")();
assert.equal(d(Buffer.from("a741a66ea141a540acc9a143b36fac4fb4fab8d5", "hex")), "你好，世界。這是測試");
assert.equal(d(Buffer.from("c4e3bac3a3accac0bde7a1a3d5e2cac7b2e2cad4", "hex")), "你好，世界。这是测试");
assert.equal(d(Buffer.from("第一章 你好，世界", "utf16le")), "第一章 你好，世界");
assert.equal(d(Buffer.from("你好，世界", "utf8")), "你好，世界");
console.log("ok");
