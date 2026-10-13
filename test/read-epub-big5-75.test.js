// 一起读：epub / docx 能导；繁体 Big5 的 txt 不再乱码（她 2026-10-13 群里转来）
const assert = require("node:assert");
const fs = require("node:fs"), path = require("node:path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");
assert.match(core, /async function epubToText\(buf\)/);
assert.match(read, /text = await epubToText\(await f\.arrayBuffer\(\)\)/);
assert.match(read, /accept: "[^"]*\.epub[^"]*\.docx/);
const i = core.indexOf("function decodeTextBytes"), j = core.indexOf("async function readTextFileSmart");
const decodeTextBytes = new Function(core.slice(i, j) + "; return decodeTextBytes;")();
assert.equal(decodeTextBytes(Buffer.from("a741a66ea141a540ac c9a143b36fac4fb4fab8d5".replace(/ /g, ""), "hex")), "你好，世界。這是測試");
assert.equal(decodeTextBytes(Buffer.from("c4e3bac3a3accac0bde7a1a3d5e2cac7b2e2cad4", "hex")), "你好，世界。这是测试");
assert.equal(decodeTextBytes(Buffer.from("你好，世界", "utf8")), "你好，世界");
console.log("ok");
