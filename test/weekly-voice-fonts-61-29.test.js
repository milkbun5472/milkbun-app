// 十个媒体腔的字体要【在中文上】分得开（她 2026-09-03：「周刊现在虽然形状好看
// 但是字体还是默认的没有区分」）。原来只分了西文（Georgia/Impact/Courier…），
// 而周刊的标题正文几乎全是中文——中文一律落回系统那一款，于是十腔一个样。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "weekly.js"), "utf8");
const block = src.slice(src.indexOf("  const VOICE_LOOK = {"), src.indexOf("  function lookOf(id)"));

const cjkOf = (line) => (line.match(/'(Noto Serif SC|Noto Sans SC|ZCOOL XiaoWei|Ma Shan Zheng|Songti SC|Heiti SC|PingFang SC|STKaiti)'/g) || [])[0];

test("每一腔的标题都指定了中文字体，不靠系统兜底", () => {
  const lines = block.split("\n").filter(l => /titleFace:/.test(l));
  assert.equal(lines.length, 10, "十腔没配齐：" + lines.length);
  lines.forEach(l => assert.ok(cjkOf(l.split("titleFace:")[1]), "这一腔的标题没指定中文字体：" + l.trim().slice(0, 24)));
});

test("宋 / 楷 / 黑 三路都真的有人用，不是十腔都指向同一款", () => {
  const heads = block.split("\n").filter(l => /titleFace:/.test(l)).map(l => cjkOf(l.split("titleFace:")[1]));
  assert.ok(new Set(heads).size >= 3, "标题字体只有 " + new Set(heads).size + " 款，等于没分");
  ["'Noto Serif SC'", "'Ma Shan Zheng'", "'Noto Sans SC'", "'ZCOOL XiaoWei'"].forEach(f =>
    assert.ok(heads.includes(f) || block.includes(f), "这一路没人用：" + f));
});

test("中文字体几 MB，用到哪一款才拉哪一款，而且不重复插", () => {
  assert.match(src, /const WEEKLY_WEBFONTS = \{/);
  assert.match(src, /function ensureWeeklyFont\(stack\)/);
  assert.match(src, /if \(document\.getElementById\(id\)\) return;/, "会重复往 head 里插 link");
  assert.match(src, /ensureWeeklyFont\(L\.titleFace\); ensureWeeklyFont\(L\.bodyFace\);/, "没接在取腔调那一步上");
  // 不许预载：index.html 里不该出现这几款
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ["ZCOOL", "Ma+Shan+Zheng", "Noto+Sans+SC"].forEach(f =>
    assert.ok(!html.includes(f), "这一款被预载了，首屏白等几 MB：" + f));
});
