// 贴纸（她 2026-09-05 发来一张手帐素材包截图：「gpt 画的这种贴纸能做一个怎么样覆盖在
// 装饰组件上的东西吗」，接着「都要」——组件和装饰都能贴，也能自己传图当贴纸）。
//
// 三件事各自有一条会静默出错的路，所以三条都钉在这儿：
//   ① 组件和装饰必须是同一份代码（一层写在两处，第二处必然落单）
//   ② 传上来的透明底 PNG 不许被压成 JPEG（透明会变成黑块，不是「差一点」是不能用）
//   ③ 百分比宽度必须写在绝对定位那一层上（写在里层会静默算成 1px，贴纸凭空消失）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const code = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 纯逻辑那几个抠出来真跑，别只对着源码做字符串匹配
const L = (() => {
  const grab = (from, to) => { const i = comp.indexOf(from), j = comp.indexOf(to); assert.ok(i > 0 && j > i, "抠不出：" + from); return comp.slice(i, j); };
  const src = grab("const HOME_STICKER_MAX =", "function stkA(")
    + "\nreturn { HOME_STICKER_MAX, HOME_STICKER_POS, HOME_STICKER_SIZES, HOME_STICKER_KINDS, HOME_STICKER_TONES, HOME_STICKER_GLYPH, normalizeHomeStickers, homeStickerNew, homeStickerBox, homeStickerScale, homeStickerTexty };";
  return new Function(src)();
})();

test("贴纸认的是【主屏那个 key】，所以组件和装饰是同一份", () => {
  // 一份存档、一个取数口、一个写入口
  assert.match(code, /loadJSON\("x_homeStickers", \{\}\)/);
  assert.match(code, /function stickersOf\(key\) \{ return normalizeHomeStickers\(stickers\[key\]\); \}/);
  assert.match(code, /function setStickersFor\(key, list\)/);
  // 渲染那一处：组件和装饰同一行判断，不是各写一段
  assert.match(code, /var stkList = \(it\.kind === "widget" \|\| it\.kind === "decor"\) \? stickersOf\(key\) : \[\];/);
  assert.match(code, /h\(HomeStickerLayer, \{ list: stkList, t: t \}\)/);
});

test("编辑器只此一份，两张面板都调它", () => {
  assert.equal((code.match(/function HomeStickerEditor\(/g) || []).length, 1, "编辑器写了不止一份");
  const calls = code.match(/h\(HomeStickerEditor, \{/g) || [];
  assert.equal(calls.length, 2, "组件面板和装饰页各一处，实际 " + calls.length);
  // 组件那一张：直接落 x_homeStickers
  assert.match(code, /h\(HomeStickerEditor, \{ list: stickersOf\(styleKey\), busy: decorBusy,\s*onChange: function \(v\) \{ setStickersFor\(styleKey, v\); \}/);
  // 装饰那一页：走适配器（新建攒草稿、重改当场落档），跟尺寸/外观同一个形状
  assert.match(code, /stickers: isNew \? decorDraftStickers : stickersOf\(key\),/);
  assert.match(code, /setStickers: isNew \? setDecorDraftStickers : function \(v\) \{ setStickersFor\(key, v\); \}/);
  assert.match(code, /h\(HomeStickerEditor, \{ list: A\.stickers, busy: decorBusy, onChange: A\.setStickers,/);
  // 预览也得看得见——不然还是闭着眼睛挑
  assert.match(code, /h\(HomeStickerLayer, \{ list: A\.stickers, t: t \}\)/);
});

test("透明底 PNG 走自己那条路，绝不许借用会压成 JPEG 的那条", () => {
  // 老那条最后一步是 image/jpeg：透明的地方会被编码成黑色
  assert.match(engine, /res\(c\.toDataURL\("image\/jpeg", q\)\);/, "老那条变了，这条前提得重验");
  const alpha = engine.slice(engine.indexOf("function resizeImageAlpha("), engine.indexOf("function resizeImageFile("));
  assert.ok(alpha, "没有保透明那条路");
  assert.match(alpha, /res\(c\.toDataURL\("image\/png"\)\);/, "贴纸这条也编码成了 JPEG");
  assert.ok(!/fillStyle|fillRect/.test(alpha), "铺了底色＝自己把透明去掉了");
  // 贴纸的上传只准走那一条
  const take = code.slice(code.indexOf("async function takeStickerPhoto("), code.indexOf("function clearDecorPhoto("));
  assert.match(take, /await resizeImageAlpha\(file, 360\)/);
  assert.ok(!/resizeImageFile/.test(take), "贴纸又去用会压成 JPEG 的那条了");
  assert.match(take, /await imgToVault\(data\)/, "图没进图库，会把 base64 塞进 5MB 的 localStorage");
});

test("百分比宽度写在【绝对定位那一层】上，不是里面那个收缩盒", () => {
  // 里层的包含块是外层，而外层 width:auto 是收缩盒——「宽度取决于内容、
  // 内容宽度又取决于宽度」，浏览器判成 auto，量出来 1px，贴纸静默消失。
  const fn = code.slice(code.indexOf("function HomeSticker({ s, t, preview })"), code.indexOf("function stkToday()"));
  assert.match(fn, /const wrap = \(ch, ex\) =>/, "wrap 收不了第二个参数，宽度没法交给外层");
  assert.match(fn, /Object\.assign\(\{ lineHeight: 0[^}]*\}, box, ex \|\| \{\}\)/, "第二个参数没合进外层样式");
  assert.match(fn, /\{ width: "100%", height: Math\.round\(17 \* k\)/, "胶带里层不是 100%");
  assert.match(fn, /\{ width: preview \? "92%" : Math\.min\(88, 52 \* k\) \+ "%" \}\);/, "胶带的百分比宽度没交给外层");
  assert.match(fn, /\{ width: preview \? "84%" : Math\.min\(72, 34 \* k\) \+ "%" \}\);/, "自传图的百分比宽度没交给外层");
  // 有字的三种要封顶，否则一格宽的装饰上会探出去被切
  assert.equal((fn.match(/maxWidth: preview \? "9\d%" : "8\d%"/g) || []).length, 3, "有字的那三种没都封顶");
});

test("胶带歪了就按歪完的框留位置（v63.84 拍立得那条的同一件事）", () => {
  const fn = code.slice(code.indexOf("function HomeSticker({ s, t, preview })"), code.indexOf("function stkToday()"));
  assert.match(fn, /const isTape = String\(s\.type\)\.slice\(0, 4\) === "tape";/);
  assert.match(fn, /homeStickerBox\(s, isTape \? 4 \+ Math\.abs\(Math\.sin\(\(Number\(s\.turn\) \|\| 0\) \* Math\.PI \/ 180\)\) \* 64 : 5\)/);
  // 真算一遍：歪得越多，离边越远
  const flat = L.homeStickerBox({ pos: "tc", turn: 0 }, 4);
  const tilt = L.homeStickerBox({ pos: "tc", turn: 20 }, 4 + Math.abs(Math.sin(20 * Math.PI / 180)) * 64);
  assert.equal(flat.top, 4);
  assert.ok(tilt.top > 20, "歪 20 度还贴着边摆，上沿会被切平一道，实际 " + tilt.top);
});

test("九个位置真的落在九个地方，不是九个名字", () => {
  assert.equal(L.HOME_STICKER_POS.length, 9);
  const tl = L.homeStickerBox({ pos: "tl", turn: 0 }), br = L.homeStickerBox({ pos: "br", turn: 0 }), mc = L.homeStickerBox({ pos: "mc", turn: 0 });
  assert.deepEqual([tl.top, tl.left, tl.bottom, tl.right], [5, 5, undefined, undefined]);
  assert.deepEqual([br.bottom, br.right, br.top, br.left], [5, 5, undefined, undefined]);
  assert.equal(mc.left, "50%");
  assert.match(mc.transform, /translate\(-50%,-50%\)/, "正中没有把自己拉回中心，会靠右下角挂着");
});

test("存档这一层：封顶、夹住、空了就把这一栏删掉", () => {
  assert.equal(L.HOME_STICKER_MAX, 3);
  const many = [1, 2, 3, 4, 5].map(function (i) { return { id: "x" + i, type: "tape" }; });
  assert.equal(L.normalizeHomeStickers(many).length, 3, "没封顶，贴到糊脸");
  assert.equal(L.normalizeHomeStickers([{ type: "tape", turn: 999 }])[0].turn, 24, "歪度没夹住");
  assert.equal(L.normalizeHomeStickers([{ type: "tape", turn: -999 }])[0].turn, -24);
  assert.deepEqual(L.normalizeHomeStickers([{ nope: 1 }, null, "x"]), [], "垃圾行没滤掉");
  assert.deepEqual(L.normalizeHomeStickers("不是数组"), []);
  assert.equal(L.normalizeHomeStickers([{ type: "strip", text: "一".repeat(60) }])[0].text.length, 18, "字数没截");
  // 一张不剩就把这一栏删掉，别攒成只进不出的坟场（phone-data-layers 那条）
  assert.match(code, /if \(v\.length\) n\[key\] = v; else delete n\[key\];/);
  // 装饰被移走，它那几张贴纸得跟着走
  const rm = code.slice(code.indexOf("function removeDecoration(id)"), code.indexOf("const kindOf = function"));
  assert.match(rm, /setStickers\(function \(prev\) \{ var n = Object\.assign\(\{\}, prev\); delete n\[id\]; saveJSON\("x_homeStickers", n\); return n; \}\);/,
    "装饰移走了，贴纸还留在存档里认不了主");
});

test("新做的那件：贴纸先攒草稿，放上桌面那一刻才归档，取消就清掉", () => {
  assert.match(code, /const \[decorDraftStickers, setDecorDraftStickers\] = useState\(\[\]\);/);
  const add = code.slice(code.indexOf("function addDecoration()"), code.indexOf("function removeDecoration(id)"));
  assert.match(add, /if \(decorDraftStickers\.length\) setStickers\(function \(prev\) \{ var n = Object\.assign\(\{\}, prev\); n\[id\] = normalizeHomeStickers\(decorDraftStickers\); saveJSON\("x_homeStickers", n\); return n; \}\);/,
    "新装饰放上桌面时没把贴纸一起落档");
  assert.match(code, /function resetDecorDraft\(\) \{ setDecorDraftStickers\(\[\]\);/, "取消之后草稿还留着，下一件会带上上一件的贴纸");
});

test("每一款贴上去的第一眼就该是它在现实里的样子", () => {
  // 胶带骑上边、夹子咬左上/上边、印和签落到角上——不是一律丢到同一个角
  assert.equal(L.homeStickerNew("tape").pos, "tc");
  assert.equal(L.homeStickerNew("clip").pos, "tl");
  assert.equal(L.homeStickerNew("wax").pos, "br");
  assert.equal(L.homeStickerNew("strip").pos, "bl");
  assert.notEqual(L.homeStickerNew("tape").turn, 0, "胶带贴得笔直就不像手贴的");
  assert.equal(L.homeStickerNew("binder").turn, 0, "燕尾夹是夹上去的，歪着反而假");
  // 会写字的只有那三种，别的给了输入框也没处显示
  assert.ok(L.homeStickerTexty("stamp") && L.homeStickerTexty("tag") && L.homeStickerTexty("strip"));
  assert.ok(!L.homeStickerTexty("tape") && !L.homeStickerTexty("clip") && !L.homeStickerTexty("photo"));
  // 每一款都在挑选单里，挑选单里也没有画不出来的款
  const listed = [];
  L.HOME_STICKER_KINDS.forEach(function (g) { g.items.forEach(function (x) { listed.push(x.id); assert.ok(x.zh, x.id + " 没有中文名"); }); });
  Object.keys(L.HOME_STICKER_GLYPH).forEach(function (k) { assert.ok(listed.indexOf("ico_" + k) >= 0, "画了却没进单子：" + k); });
  assert.ok(listed.indexOf("photo") >= 0);
  assert.equal(new Set(listed).size, listed.length, "挑选单里有重复的款");
});

test("挑选格里画的是那张贴纸本人，不是一个名字加一个方块", () => {
  const ed = code.slice(code.indexOf("function HomeStickerEditor("), code.indexOf("function HomeDecorAppearanceEditor("));
  assert.match(ed, /h\(HomeSticker, \{ s: Object\.assign\(\{\}, homeStickerNew\(x\.id\), \{ pos: "mc", size: "s", turn: 0, text: x\.id === "strip" \? "小纸条" : "" \}\), t: t, preview: true \}\)/,
    "挑选格里没画出真东西");
  assert.match(ed, /h\(HomeSticker, \{ s: Object\.assign\(\{\}, s, \{ pos: "mc", size: "s", turn: 0 \}\), t: t, preview: true \}\)/,
    "已贴清单那一行也该画出本人");
  // 位置那九格：选中态不只靠色差，小方块里那个点站在哪儿就说明贴哪儿
  assert.match(ed, /p\.y === "top" \? \{ top: 1\.5 \} : p\.y === "bottom" \? \{ bottom: 1\.5 \} : \{ top: "50%", marginTop: -2\.5 \}/);
  assert.match(ed, /background: on \? t\.bg2 : t\.fog/, "深色主题里写死白点会看不见");
  // 一格满了就不给再贴，且说清为什么
  assert.match(ed, /const full = rows\.length >= HOME_STICKER_MAX;/);
  assert.match(ed, /"一格最多贴 " \+ HOME_STICKER_MAX \+ " 张/);
});

test("颜色拼透明度前先验色号（v59.62 那条：拼出废值会整层静默消失）", () => {
  const fn = code.slice(code.indexOf("function stkA(hex, a)"), code.indexOf("const HOME_STICKER_FILLED"));
  assert.match(fn, /\^#\(\[0-9a-f\]\{6\}\)\$/i, "没验六位色号");
  assert.match(fn, /if \(!m\) return hex \|\| "#8a6f52";/, "验不过没有退路");
  const S = new vm.Script(comp.slice(comp.indexOf("function stkA(hex, a)"), comp.indexOf("const HOME_STICKER_FILLED")) + "\nstkA");
  const f = S.runInNewContext({});
  assert.equal(f("#b08968", .5), "rgba(176,137,104,0.5)");
  assert.equal(f("var(--x)", .5), "var(--x)", "非六位色号被拼成了废值");
});
