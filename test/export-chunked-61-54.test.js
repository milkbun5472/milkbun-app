// v61.54 导出分片（她 2026-09-03 丢档：备份按钮按了没反应，病根=几十 MB 一次 postMessage 噎死 WK 通道）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const swift = fs.readFileSync(path.join(__dirname, "..", "tools", "ios-shell", "LisaPhone", "LisaPhone", "AppDelegate.swift"), "utf8");

test("网页侧：大文本走 begin/chunk/end 分片，失败会 abort", () => {
  assert.match(eng, /const CHUNK = 3 \* 1024 \* 1024;/);
  for (const op of ["begin", "chunk", "end", "abort"]) assert.match(eng, new RegExp('op: "' + op + '"'));
  assert.match(eng, /text\.slice\(i, i \+ CHUNK\)/);
});

test("壳侧：nativeExport 认识四个 op，且旧的整段路径仍在", () => {
  for (const op of ['case "begin":', 'case "chunk":', 'case "end":', 'case "abort":']) assert.ok(swift.includes(op), op);
  assert.ok(swift.includes("presentExport(filename: rawName, text: text, replyHandler: replyHandler)"));
  assert.ok(swift.includes("parts.joined()"));
});
