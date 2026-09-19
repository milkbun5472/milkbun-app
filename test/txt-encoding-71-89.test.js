// 放 txt 进来别变方块（她 2026-09-19：「为啥一起读放 txt 会乱码」）。
//
// 病根：`File.text()` 和 `FileReader.readAsText()` 都只按 UTF-8 解，解不动也不抛错，
// 无效字节静默换成 U+FFFD。中文 txt 大多是 GBK/GB18030，于是整本书全是方块而代码全绿。
//
// 桩照着【真的那一份】来：decodeTextBytes 从 core.js 源码里抠出来跑，不在测试里抄一份
// （stub-from-the-writer.md）。切片两头钉的是函数名，不是注释（anchor-on-code.md）。
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const core = read("js/core.js");

const i = core.indexOf("function decodeTextBytes(");
const j = core.indexOf("async function readTextFileSmart(", i);
assert.ok(i > 0 && j > i, "core.js 里抠不出 decodeTextBytes / readTextFileSmart");
const decodeTextBytes = new Function("return (" + core.slice(i, j).trim() + ")")();

// ---- 1. GBK 的中文别变方块 ----
// 「一起读」四个字的 GB18030 字节，手写死在这儿：这是外部事实，不是本仓某段代码的影子。
const gbk = Buffer.from([0xD2, 0xBB, 0xC6, 0xF0, 0xB6, 0xC1]);
assert.strictEqual(decodeTextBytes(gbk), "一起读", "GBK 的中文没解对");
assert.ok(!decodeTextBytes(gbk).includes("�"), "GBK 解出来带替换字符＝还在乱码");

// ---- 2. UTF-8 仍然原样 ----
assert.strictEqual(decodeTextBytes(Buffer.from("第一章 他锁屏了", "utf8")), "第一章 他锁屏了");

// ---- 3. 三种 BOM 都认，并且不留在正文里 ----
assert.strictEqual(decodeTextBytes(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from("目录", "utf8")])), "目录");
assert.strictEqual(decodeTextBytes(Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from("目录", "utf16le")])), "目录");
const be = Buffer.from("目录", "utf16le"); be.swap16();
assert.strictEqual(decodeTextBytes(Buffer.concat([Buffer.from([0xFE, 0xFF]), be])), "目录");

// ---- 4. 空文件不炸 ----
assert.strictEqual(decodeTextBytes(Buffer.alloc(0)), "");

// ---- 5. 三个入口都得走这一处，谁都不许再留一条只认 UTF-8 的老路 ----
// （one-public-mechanism.md：公共那层开了，已有的几处也要搬过去，不能并存两套）
const readJs = read("js/read.js");
const k = readJs.indexOf("const onFile = async function (e) {");
const k2 = readJs.indexOf("const patchBook = function (id, patch) {");
assert.ok(k > 0, "read.js 里抠不出 onFile");
const onFile = readJs.slice(k, k2 > k ? k2 : k + 3000);
assert.ok(/readTextFileSmart\(f\)/.test(onFile), "一起读传 txt 没走 readTextFileSmart");
assert.ok(!/await f\.text\(\)/.test(onFile), "一起读还留着 f.text()——它只认 UTF-8");

const comp = read("js/components.js");
const c1 = comp.indexOf("async function readOfflineStyleDocument(file) {");
assert.ok(c1 > 0, "components.js 里抠不出 readOfflineStyleDocument");
const offline = comp.slice(c1, c1 + 1200);
assert.ok(/readTextFileSmart\(file\)/.test(offline), "线下文风/设定集的 txt 没走 readTextFileSmart");
assert.ok(!/await file\.text\(\)/.test(offline), "线下文风还留着 file.text()——它只认 UTF-8");

const screens = read("js/screens.js");
const s1 = screens.indexOf("function EmoteMatrix(");
const s2 = screens.indexOf("const note = (zh, right, top)", s1);
assert.ok(s1 > 0 && s2 > s1, "screens.js 里抠不出 EmoteMatrix 的 readFile");
const emote = screens.slice(s1, s2);
assert.ok(/readTextFileSmart\(f\)/.test(emote), "表情包导入没走 readTextFileSmart");
assert.ok(!/readAsText\(/.test(emote), "表情包导入还留着 readAsText——它只认 UTF-8");

console.log("✓ txt 编码：GBK/UTF-8/三种 BOM 都认，三个入口共用 core.js 那一处");
