// 她 2026-10-29 截图：线下中译结尾挂着「â&#x20AC;&#x201C;」——实体码＋UTF-8 被当西文读了一遍的乱码
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const i = eng.indexOf("const _CP1252_BACK"), j = eng.indexOf("async function translateToZh");
const fix = new Function(eng.slice(i, j) + ";return fixGarbledText;")();
test("截图那串还原成字，不再挂一串实体码", () => {
  const out = fix("经不起你这样折腾？ â&#x20AC;&#x201C;");
  assert.ok(!/&#|â/.test(out), out);
  assert.equal(fix("他说â€œ你好"), "他说“你好");
});
test("正常文字一个字不动", () => {
  ["普通中文，没问题", "café crème", "Je ne comprends pas ? !", "¥2000 · 已收"].forEach(x => assert.equal(fix(x), x));
});
test("译文显示那一格三处都过这道清理（随消息带来的、缓存里的、现翻的）", () => {
  assert.match(comp, /if \(zhReady && typeof fixGarbledText === "function"\) zhReady = fixGarbledText\(zhReady\);/);
  assert.match(comp, /if \(z && typeof fixGarbledText === "function"\) z = fixGarbledText\(z\);/);
  assert.match(comp, /const _z = typeof fixGarbledText === "function" \? fixGarbledText\(r\.zh\) : r\.zh;/);
});
