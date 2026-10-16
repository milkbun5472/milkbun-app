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

// 2026-10-16 截图：一个气泡里换行写了六张「[表情] …」，整串当文字发了出来——按行抽
test("一个气泡里多行 [表情] 标记：逐行抽走，剩下的字留着", () => {
  assert.match(app, /w\.split\("\\n"\)\.forEach\(ln => \{\s*const m1 = ln\.match\(TAG_RE\) \|\| ln\.match\(WRAP_RE\);/);
  const TAG_RE = /^\s*[\u3010\[\uff3b]\s*\u8868\u60c5(?:\u5305)?\s*[\u3011\]\uff3d]\s*[:\uff1a]?\s*(.+)$/;
  const got = [], keep = [];
  "乖乖开门\n[表情] 老公伤心的流泪\n[表情] 亲亲😙".split("\n").forEach(ln => { const m = ln.match(TAG_RE); if (m) got.push(m[1].trim()); else keep.push(ln); });
  assert.deepEqual(got, ["老公伤心的流泪", "亲亲😙"]);
  assert.deepEqual(keep, ["乖乖开门"]);
});
