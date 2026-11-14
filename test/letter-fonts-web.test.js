// 她 2026-11-02：「情书换不了字体」——圆体／楷体／行楷这些是苹果电脑自带的，iPhone 没有，全落到苹方
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "screens-ui.js"), "utf8");   // 2026-11-14 情书那几页搬到页面那半了
const seg = src.slice(src.indexOf("const LETTER_FONTS = ["), src.indexOf("const LETTER_PAPERS = ["));
const doc = { head: { kids: [], appendChild(x) { this.kids.push(x); } }, createElement: () => ({}) };
const { LETTER_FONTS, letterFontCss } = new Function("document", seg + "; return { LETTER_FONTS, letterFontCss };")(doc);
// 每一支（除了宋体，思源宋体本来就加载着）都有一支网上字体顶着，而且排在通用兜底前面
LETTER_FONTS.filter(f => f.css && f.key !== "serif").forEach(f => {
  assert.ok(f.web, f.label + " 没有网上字体顶着");
  const fam = decodeURIComponent(f.web.split(":")[0]).replace(/\+/g, " ");
  assert.ok(f.css.includes("'" + fam + "'"), f.label + " 的字体栈里没写 " + fam);
});
// 选中才拉，同一支只挂一次
letterFontCss("round"); letterFontCss("round"); letterFontCss("wawa");
assert.equal(doc.head.kids.length, 1, "圆体和娃娃稚气都是站酷快乐，只拉一次");
assert.match(doc.head.kids[0].href, /^https:\/\/fonts\.googleapis\.com\/css2\?family=ZCOOL\+KuaiLe&display=swap$/);
letterFontCss("serif");
assert.equal(doc.head.kids.length, 1, "宋体不另拉");
console.log("ok");
