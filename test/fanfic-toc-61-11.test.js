// 同人文 feed 里的一篇不再是一张框（她 2026-09-03：「每一篇文显示的样式也改改吧，
// 现在还是一个个框」）。上面那排书脊已经把一版做成「抽出来翻开的一本」，
// 翻开一本书底下就该是这一本的【目录页】：编号 → 篇名 → 引导点 → 字数（页码那一格）。
// 判据同 .claude/rules/tabs-not-plain-pills.md：换个 app 还成立的形状＝没设计。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");

const seg = (() => {
  const a = src.indexOf("  function FicCard(props) {");
  const b = src.indexOf("\n  // ---------- 世界观分版", a);
  assert.ok(a > 0 && b > a, "找不到 FicCard");
  return src.slice(a, b);
})();

test("不是框：没有描边、没有圆角、没有底色块", () => {
  assert.ok(!/borderRadius/.test(seg), "条目上又出现圆角框");
  assert.ok(!/border:\s*"1px solid/.test(seg), "条目上又描了一圈边");
  assert.ok(!/\bbackground:\s*c?\.?bg\b/.test(seg), "条目又铺了整块底色");
  assert.ok(!/pageSkin\(/.test(seg), "条目又自己上了一层纸皮（那是页面的事）");
});

test("是目录：引导点一路点到右边那格字数", () => {
  assert.match(seg, /borderBottom:\s*"1px dotted "\s*\+\s*t\.line/, "没有目录的引导点");
  assert.match(seg, /const pageNo = /, "右边没有页码那一格");
  assert.match(seg, /fmtNum\(words\) \+ " 字"/, "页码那一格不是字数");
  assert.match(seg, /borderBottom:\s*"1px solid "\s*\+\s*t\.line/, "条目之间没有发丝线");
});

test("有我＝页边一道朱线，而不是每篇都描边", () => {
  assert.match(seg, /const redEdge = hasMe \?/, "页边朱线没了");
  assert.match(seg, /background:\s*t\.accent/);
  assert.ok(/redEdge/.test(seg.split("if (isLead)")[1] || ""), "头条那一支没接朱线");
});

test("卷首靠字号和双线压屏，不是靠一块深底", () => {
  const lead = seg.slice(seg.indexOf("if (isLead)"));
  assert.match(lead, /fontSize: 24/, "卷首标题没有比别的大一截");
  assert.ok(!/background:/.test(lead.split("return h(\"button\"")[1].slice(0, 400)), "卷首又铺了一块深底");
  assert.match(lead, /props\.leadLabel \|\| "TOP OF THE FEED"/);
});

test("序号还是【此刻排第几】算出来的，不存到文章上", () => {
  assert.match(seg, /const no = String\(idx \+ 1\)\.padStart\(2, "0"\);/);
  assert.doesNotMatch(src, /f\.(dark|isDark|cardTone|seq|no)\s*=/);
});

test("不写死黑白", () => {
  assert.ok(!/#(fff|ffffff|000|000000)\b/i.test(seg), "写死了黑白，换主题就废");
});
