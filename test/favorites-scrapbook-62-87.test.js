// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债⑥第二样：收藏。
//
// 审计：两层外壳都是 background:t.bg 平色，卡片是圆角描边卡 + 头像行——
// 「所有列表页」的样子，原样搬到别的 app 里照样成立，按判据就是写坏了。
// 这一页现实里是【一本剪贴簿】：值得留的东西剪下来，用角贴按在卡纸上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const seg = src.slice(src.indexOf("const SCRAP_PAPER ="), src.indexOf("// 随身物品 Carry"));
const kraftSrc = src.slice(src.indexOf("const KRAFT = t =>"), src.indexOf("\n// 四角那四枚照片角贴"));
const KRAFT = new Function("return " + kraftSrc.replace(/^const KRAFT = /, "").replace(/;\s*$/, ""))();

test("两层外壳都铺牛皮卡纸，顶栏透上来，正文是唯一那个滚动容器", () => {
  assert.equal((seg.match(/className: "h-full flex flex-col", style: KRAFT\(t\)/g) || []).length, 2,
    "名册页和某人那页，两层都要铺");
  assert.equal((seg.match(/bg: "transparent"/g) || []).length, 2, "有顶栏还在刷平色");
  assert.equal((seg.match(/className: "flex-1 min-h-0 overflow-y-auto/g) || []).length, 2);
  // 闸里那句 return { background: t.bg } 是合法的兜底，只问组件本体
  const body = seg.slice(seg.indexOf("function Favorites("));
  assert.doesNotMatch(body, /background: t\.bg\b/, "还有一层退回平色了");
  assert.doesNotMatch(kraftSrc, /backgroundAttachment/, "内容在动、底不该动");
});

test("t.ink 不是六位色号时整层退回纯色", () => {
  ["rgb(9,9,9)", "white", "#abc", "", undefined].forEach(ink =>
    assert.equal(KRAFT({ ink: ink, bg: "#f7f3ea" }).background, "#f7f3ea", String(ink) + " 没退回纯色"));
});

test("牛皮纸是交叉纤维 + 四边压暗，跟相册那张黑卡纸分得开", () => {
  const bg = KRAFT({ ink: "#2b2620", bg: "#f7f3ea" }).background;
  assert.match(bg, /repeating-linear-gradient\(74deg/, "缺一个方向的纤维");
  assert.match(bg, /repeating-linear-gradient\(-66deg/, "纤维只有一个方向，那是布不是牛皮纸");
  assert.match(bg, /radial-gradient\(130% 90% at 50% 50%/, "缺四边的暗角");
  assert.ok(/,#f7f3ea$/.test(bg), "主题底色没压在最后一层");
  // 相册那张（cpSkin 的 album）是单向细纹 + 整体压暗；这张必须不是同一个东西
  const album = src.slice(src.indexOf("album: ["), src.indexOf("album: [") + 220);
  assert.match(album, /repeating-linear-gradient\(41deg/);
  assert.ok(!bg.includes("41deg"), "牛皮纸抄了相册那张卡纸的纹");
});

test("每条是剪下来贴上去的一张：四角角贴 + 按 id 定死的一点点歪", () => {
  assert.match(seg, /const SCRAP_CORNERS = \[\["top", "left"\], \["top", "right"\], \["bottom", "left"\], \["bottom", "right"\]\];/,
    "四个角要齐，少一个就不是角贴了");
  assert.match(seg, /SCRAP_CORNERS\.map\(\(\[v, hz\]\) => scrapCorner\(v, hz\)\)/, "卡片上没贴角贴");
  // 三角形靠 border 画：上下那一边给实色，左右那一边给 transparent
  const cn = src.slice(src.indexOf("const scrapCorner ="), src.indexOf("const SCRAP_CORNERS"));
  assert.match(cn, /width: 0, height: 0/, "不是用 border 画的三角");
  assert.match(cn, /v === "top" \? \{ borderTop: "13px solid " \+ SCRAP_TAPE \} : \{ borderBottom: "13px solid " \+ SCRAP_TAPE \}/);
  assert.match(cn, /hz === "left" \? \{ borderRight: "13px solid transparent" \} : \{ borderLeft: "13px solid transparent" \}/);
  assert.match(seg, /transform: "rotate\(" \+ tiltById\(f\.id\) \+ "deg\)"/, "贴上去的东西一张都不歪");
  assert.doesNotMatch(seg, /borderRadius: 14, border: "1px solid " \+ t\.line/, "旧那张圆角描边卡还在");
});

test("名册是一人一摞，厚度看得见——不是一条 borderBottom", () => {
  assert.match(seg, /n > 1 && h\("div", \{ "aria-hidden": "true"/, "第二张纸的边没画");
  assert.match(seg, /n > 2 && h\("div", \{ "aria-hidden": "true"/, "第三张纸的边没画");
  // 只剪了一张的那摞不该凭空多出两张纸
  assert.match(seg, /const n = \(byChar\[c\.id\] \|\| \[\]\)\.length;/);
  assert.doesNotMatch(seg, /borderBottom: "1px solid " \+ t\.line \} \}[\s\S]{0,80}h\(Avatar/, "还在拿一条分割线当行");
});

test("纸色写死，纸上的字色也一起写死", () => {
  // 深色主题里 t.ink 是浅色，写在浅纸上就是浅纸浅字（v59.62 那一课）
  assert.match(src, /const SCRAP_PAPER = "#fdfaf1", SCRAP_INK = "#3a3226", SCRAP_FOG = "#a3987e",/);
  const paper = seg.split("\n").filter(l => l.includes("SCRAP_PAPER"));
  assert.ok(paper.length >= 4, "白纸只有 " + paper.length + " 处？");
  // ⚠️别只查「跟 background: SCRAP_PAPER 同一行」的那几处：卡片的底和卡片里的字
  //   本来就不在同一行，那样查等于没查（第一版就是这么漏掉名字那一行的）。
  //   这一页每一个字都落在纸上，所以整段组件里一个主题色都不该有。
  const body = seg.slice(seg.indexOf("function Favorites("));
  body.split("\n").forEach(l => assert.ok(!/color: t\.(ink|fog|sub|accent)\b/.test(l),
    "纸上写了主题色：" + l.trim().slice(0, 100)));
  assert.ok(body.includes("color: SCRAP_INK") && body.includes("color: SCRAP_FOG"));
});

test("这一页的英文副标题清掉了，换成说得出数目的中文", () => {
  assert.ok(!seg.includes('en: "Saved'), "旧那行英文副标题还在");
  assert.ok(!/h\(Head, \{ zh: "收藏", en: c\.name/.test(seg), "还在拿 en 当副标题使");
  assert.match(seg, /sub: chars\.length \? chars\.length \+ " 摞 · 共 " \+ favs\.length \+ " 张" : null/);
  assert.match(seg, /sub: \(c\.remark \|\| c\.name\) \+ " · " \+ list\.length \+ " 张"/);
});
