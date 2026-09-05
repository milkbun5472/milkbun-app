// 聊天设置的子页（她 2026-09-05：「聊天设置里面的子页也还是白屏很无聊，先改改吧」）。
//
// 她说的是真的：子页当时是【两条发丝线 + 两行字 + 六百像素空白】。
// 这一页在现实里是什么？——它自己早就答了：「关于 XX 的七件事」，一类一个汉字索引牌。
// 那就是一叠卡片索引 / 一格一格的档案抽屉。所以：
//   · 底子是档案纸，铺在【最外面那个外壳】上、顶栏透明（mobile-ui-layout §3.5）
//   · 拉开哪一格，整页就是那一格自己的颜色——色号直接取 settingPages 那一份
//   · 右下角印那一格的汉字索引牌，顺带把底下那片空白填住
// 判据（tabs-not-plain-pills）：这一页原样搬到别的 app 里还成立吗？——不成立，别处没有「他」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const core = R("core.js"), comp = R("components.js");
const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

const K = (() => {
  const g = (from, to) => { const i = core.indexOf(from), j = core.indexOf(to); assert.ok(i > 0 && j > i, "抠不出 " + from); return core.slice(i, j); };
  const src = g("function skinRGB(hex)", "// 299/587/114")
    + g("function skinMix(a, b, k)", "function skinShade(hex, k)")
    + g("function skinGlyphLayer(ch, rgb, a, lift)", "// 特大页脚字。")
    + "\nreturn { skinMix, skinGlyphLayer, skinRGB };";
  return new Function(src)();
})();

test("汉字水印：只印汉字，拉丁字母和空的一律不印", () => {
  const L = K.skinGlyphLayer("记", "27,26,23", .055);
  assert.ok(Array.isArray(L) && L.length === 4, "没返回一层背景");
  assert.match(L[0], /^url\('data:image\/svg\+xml;utf8,/);
  assert.ok(decodeURIComponent(L[0]).includes("记"), "字没印进去");
  assert.equal(L[3], "no-repeat", "水印铺满了整页");
  // 英文那一路自有 skinWordLayer；这条只管汉字，别把两条搅在一起
  assert.equal(K.skinGlyphLayer("A", "0,0,0", .05), null);
  assert.equal(K.skinGlyphLayer("", "0,0,0", .05), null);
  assert.equal(K.skinGlyphLayer(null, "0,0,0", .05), null);
  // 只取一个字：整句话印上去就成一团黑
  assert.ok(!decodeURIComponent(K.skinGlyphLayer("记忆库", "0,0,0", .05)[0]).includes("忆"));
  // 淡到只剩影子
  assert.match(decodeURIComponent(K.skinGlyphLayer("清", "0,0,0", .055)[0]), /fill="rgba\(0,0,0,0\.055\)"/);
});

test("水印只从右边出血一点，上下不许切——切两边就不像有意压角，像没画完", () => {
  const L = K.skinGlyphLayer("性", "0,0,0", .05);
  assert.match(L[2], /^right -6px bottom 76px$/, "位置不对：底下要留够，让开悬浮球和底部安全区");
  const M = K.skinGlyphLayer("性", "0,0,0", .05, "120px");
  assert.match(M[2], /bottom 120px$/, "抬高那个口子没接上");
});

test("pageSkin 认这一层", () => {
  assert.match(core, /const gm = skinGlyphLayer\(o\.glyph, dark \? "255,255,255" : skinRGB\(th\.ink\)\.join\(","\), dark \? \.07 : \.055, o\.glyphLift\);\s*if \(gm\) layers\.push\(gm\);/,
    "pageSkin 没把汉字水印接进去");
});

test("掺色：k=0 是这个，k=1 是那个，中间真的在中间", () => {
  assert.equal(K.skinMix("#000000", "#ffffff", 0), "#000000");
  assert.equal(K.skinMix("#000000", "#ffffff", 1), "#ffffff");
  assert.equal(K.skinMix("#000000", "#ffffff", .5), "#808080");
  assert.equal(K.skinMix("#ece8e1", "#a8564a", 0), "#ece8e1");
  // 越界的比例要夹住，别算出负色号
  assert.equal(K.skinMix("#000000", "#ffffff", -3), "#000000");
  assert.equal(K.skinMix("#000000", "#ffffff", 9), "#ffffff");
  // 废色号有退路（skinRGB 兜底），不许拼出 NaN
  assert.ok(/^#[0-9a-f]{6}$/.test(K.skinMix("var(--x)", "#a8564a", .5)));
});

test("底纹铺在外壳上、顶栏透明（mobile-ui-layout §3.5）", () => {
  const i1 = code.indexOf("const curPage = settingsTab ? settingPages.find");
  assert.ok(i1 > 0, "找不到那一段");
  const seg = code.slice(i1, code.indexOf("!settingsTab && h(\"div\"", i1));
  assert.match(seg, /h\("div", \{ className: "h-full flex flex-col", style: Object\.assign\(\{ position: "fixed", inset: 0, zIndex: 240 \}, pgSkin\) \}/,
    "底纹没铺在最外面那个外壳上，顶栏那一条会露出一道平色带");
  assert.match(seg, /h\(Head, \{\s*bg: "transparent",/, "顶栏没透上来");
  assert.ok(!/backgroundAttachment/.test(seg), "底纹跟着内容滚了");
  // 外壳上不许再写死一个 background: t.bg 把底纹盖掉
  assert.ok(!/zIndex: 240, background: t\.bg \}/.test(seg));
});

test("拉开哪一格就是哪一格的颜色——色号只有一份，不另存色表", () => {
  const i0 = code.indexOf("const curPage = settingsTab ? settingPages.find");
  assert.ok(i0 > 0, "找不到那一段");
  const seg = code.slice(i0, code.indexOf("return ReactDOM.createPortal", i0));
  assert.match(seg, /const curTint = \(curPage && curPage\.tint\) \|\| t\.accent;/, "颜色没从 settingPages 里取");
  assert.match(seg, /tint: skinRGB\(curTint\)\.join\(","\)/);
  // 深色主题上同样比例几乎看不出来，得多掺一点
  assert.match(seg, /base: settingsTab \? skinMix\(t\.bg, curTint, skinIsDark\(t\.bg\) \? \.13 : \.07\) : t\.bg,/,
    "颜色不是掺进底色的，或者深色主题没有单独一档");
  // ⚠️别用 strength 来加重颜色：那会把纹理和光一起加重，页面会脏
  assert.ok(!/strength: settingsTab/.test(seg), "又拿 strength 去顶颜色了");
  // 目录页不印字，子页才印——目录页印一个字等于印错了抽屉
  assert.match(seg, /glyph: settingsTab \? \(curPage && curPage\.char\) : ""/);
  // 七件事各有各的色和字，没有重样的
  const pages = code.slice(code.indexOf("{ key: \"act\", char: \"动\""), code.indexOf("];", code.indexOf("{ key: \"act\", char: \"动\"")));
  const tints = pages.match(/tint: "#[0-9a-f]{6}"/g) || [];
  assert.ok(tints.length >= 6, "色表少了几格");
  assert.equal(new Set(tints).size, tints.length, "有两格是同一个颜色，那就分不出抽屉了");
});

test("子页那几行改成卡片：铺了纹理之后，发丝线分隔的字看着像没画完", () => {
  const seg = code.slice(code.indexOf("function SettingSection("), code.indexOf("function ChatRoomSheet("));
  assert.match(seg, /borderRadius: 15, border: "1px solid " \+ t\.line,/, "还是一条发丝线");
  assert.match(seg, /boxShadow: open \? "0 3px 14px rgba\(40,34,26,\.07\)" : "none"/, "展开的那张没浮起来");
  assert.ok(!/borderTop: "1px solid " \+ t\.line \}/.test(seg), "老那条发丝线还留着");
  // ⚠️skinAlpha 收的是【两位十六进制后缀】，不是 0-1 的小数。
  //   传小数会拼出 "#xxxxxx0.82" 这种废值，而且只在色号是六位时才坏——
  //   非六位的原样返回，于是某些主题好好的、某些主题整块底色没了（v59.62 那种长相）。
  assert.match(seg, /skinAlpha\(t\.bg2, open \? "f5" : "d4"\)/, "卡片底色没走 skinAlpha，或者传的是小数");
  const bad = comp.match(/skinAlpha\([^,]+,\s*\.?\d*\.\d+\s*\)/g) || [];
  assert.deepEqual(bad, [], "有人给 skinAlpha 传了小数：" + bad.join(" / "));
});
