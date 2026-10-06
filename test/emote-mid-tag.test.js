// 她 2026-10-06 截图：「我爱听[表情] 老公开心的歪嘴笑」整句当文字发了出来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("夹在句子后面的 [表情] 标记拆成文字＋表情", () => {
  const line = app.split("\n").find(l => l.includes("const MID_TAG ="));
  assert.ok(line, "没有 MID_TAG");
  const re = new Function(line.trim().replace(/^const MID_TAG = /, "return ").replace(/;$/, ""))();
  const m = "我爱听[表情] 老公开心的歪嘴笑".match(re);
  assert.equal(m[1], "我爱听");
  assert.equal(m[2], "老公开心的歪嘴笑");
  const m2 = "我笨在哪儿你说清楚\n[表情] 白色小狗一脸疑惑".match(re);
  assert.equal(m2[2], "白色小狗一脸疑惑");
  assert.equal("[表情] 摸头".match(re), null, "开头的那种归原来那道管");
  assert.equal("今天好开心".match(re), null);
});
