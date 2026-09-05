// 她 2026-09-05：「这个字条放背景上看不见，然后宝宝你看看这几个组件也改改样式，太普通了」。
//
// 判据还是那一条（tabs-not-plain-pills.md）：**这个东西原样搬到另一个 app 里还成立吗？**
// 成立 → 写坏了。所以每一条判词都对着【它是个什么东西】问，不对着"有没有改过"问。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => path.resolve(__dirname, "..", f);
const comp = fs.readFileSync(P("js/components.js"), "utf8");
const rw = fs.readFileSync(P("js/recent-widget.js"), "utf8");
const html = fs.readFileSync(P("index.html"), "utf8");
const cut = (a, b) => { const i = comp.indexOf(a), j = comp.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return comp.slice(i, j); };

test("字条夹自己有底：铺了照片壁纸也看得见", () => {
  const w = rw.slice(rw.indexOf("function RecentWidget("), rw.indexOf("function UnreadBack("));
  // 原来夹板是 ink 4% 的一层薄色，壁纸一铺整只夹子就没了，只剩三张白纸飘在树林上
  assert.doesNotMatch(w, /background: skinAlpha\(ink, "0a"\)/, "夹板又变回那层看不见的薄色了");
  assert.match(w, /background: paper,/, "夹板得铺主题的纸色，不能只靠一层半透明");
  assert.match(w, /useOnWallpaper\(\)/, "没问「底下是不是壁纸」，就没法在花底子上加厚");
  assert.match(w, /onWall \? "0 10px 26px/, "壁纸上要更重的投影把夹子从背景里拎出来");
});

test("标题和未读挪到压条上——字要待在自己有底的东西上", () => {
  const bar = rw.slice(rw.indexOf("function clampBar("), rw.indexOf("function RecentWidget("));
  assert.match(bar, /title/, "标题没写在压条上");
  assert.match(bar, /unread \+ " 条没看"/, "未读数没写在压条上");
  // 压条是墨色的，字一律 t.bg——深色主题里 ink 是浅的，写死 #fff 就是白底白字
  assert.match(bar, /var fg = t\.bg \|\| "#fff";/);
  assert.doesNotMatch(bar, /color: "rgba\(255,255,255/, "压条上的字写死了白色，深色主题会看不见");
});

test("转盘是一个圆，不是一张饼图——而且大小跟着格子走", () => {
  const disc = cut("function WheelDisc(", "// 转盘顶上那根【簧片指针】");
  // v63.18 她要「直接改成圆的变大，不要外面的框了」：木框和铜钉是【撤掉】的，
  // 不是留在原地调透明度——所以这两条判的是它们真的不在了。
  assert.doesNotMatch(disc, /wkWheelRim/, "外面那圈木框又回来了");
  assert.doesNotMatch(disc, /nails\.push/, "框上那圈铜钉又回来了");
  assert.match(comp, /const R = 48;/, "扇区没铺满，盘中间会空一圈");
  // 撤掉框之后，让它仍然不是饼图的是这几样
  assert.match(disc, /stroke: "rgba\(58,44,30,\.5\)"/, "扇区之间又变回白线了");
  assert.match(disc, /url\(#wkWheelHub\)/, "正中那颗铜轴没了");
  assert.doesNotMatch(comp, /const WHEEL_COLORS = \["#f2cfd2"/, "又退回那八个糖果色了");
  // 盘不许写死像素：写死的话格子调大它还是那么小
  const wid = cut("function WheelWidget(", "// 电子木鱼小组件");
  // v63.41 她澄清「不要框」指的是外面那张方卡：GlassCard 整个撤掉，只剩一个圆
  assert.doesNotMatch(wid, /h\(GlassCard/, "那张方卡又回来了");
  // ⚠️撤了卡字就直接落在壁纸上，必须走 glassLabelInk，不然亮壁纸上墨字会糊掉
  assert.match(wid, /glassLabelInk\(onWall, t\)/, "字没做壁纸适配，亮壁纸上会看不清");
  assert.match(wid, /h\(WheelDisc, \{ items: items, angle: 0, spinning: false, size: "100%"/, "盘又被钉死成固定像素了");
  assert.doesNotMatch(wid, /width: 86, height: 86/, "那个写死的 86px 还在");
});

test("指针是一根簧片，不是一个填色三角", () => {
  const nd = cut("function WheelNeedle(", "// 全屏大转盘");
  assert.match(nd, /url\(#wkNeedle\)/);
  // 小组件和全屏共用同一根：只写一处，别哪天只改了其中一个
  const uses = comp.match(/h\(WheelNeedle, \{ size: [^}]+\}\)/g) || [];
  assert.equal(uses.length, 2, "簧片指针该有两处在用（小组件 + 全屏），实际 " + uses.length);
  assert.match(nd, /typeof size === "number" \? Math\.max\(16, size \* 0\.2\) : size/, "簧片不认 \"100%\"，跟着盘一起放大就做不到");
  assert.doesNotMatch(comp, /borderTop: "18px solid #e8b04d"/, "全屏那个填色三角还在");
  assert.doesNotMatch(comp, /borderTop: "8px solid " \+ t\.accent/, "小组件那个填色三角还在");
});

test("一起听是一张压在唱机上的黑胶，碟心贴着照片、唱臂搭在盘面上", () => {
  const vd = cut("function VinylDisc(", "function MusicWidget(");
  assert.match(vd, /repeating-radial-gradient\(circle at 50% 50%, #24242a/, "碟上的纹路没了");
  assert.match(vd, /const armDeg = 9 \* Math\.max/, "唱臂不跟着进度走，那它就只是个装饰");
  assert.match(vd, /transformOrigin: "84px 12px"/, "唱臂的支点跑了，会被卡片裁掉");
  assert.match(vd, /background: cover \? "center\/cover no-repeat url\(" \+ cover/, "碟心那张照片没贴上去");
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  assert.doesNotMatch(mw, /inset -6px 0 10px -6px/, "纸套还留在原地");
  assert.match(mw, /const tall = !!\(rows && rows\.rows >= 2\)/, "盘的大小没跟着格子走");
  assert.match(mw, /tall \? 126 : 62/, "两行高的大卡该给大盘");
  assert.match(mw, /mmss\(cur\)/, "走了多久那一行没了");
});

test("4×2 那一档：唱片旁边一摞拍立得，中间是进度，底下三颗真能按的键", () => {
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  // 拍立得只在两行高那一档出现——一行高的条子里它会被压扁
  assert.match(mw, /h\(PolaroidStack, \{ w: 94, photo: card\.photo, note: card\.note, lean: 9/, "拍立得没挂上去，或者没放大 / 没往右歪");
  // 「大到有点超出边界的迹象」＝被卡边切掉一条，不是真画到卡外面（那会盖住旁边的格子）
  assert.match(mw, /marginRight: -22/, "它不再探出卡外了");
  assert.match(mw, /alignItems: "center", gap: compact \? 9 : square \? 9 : tall \? 9 : 14, overflow: "hidden"/, "卡不再切它，或者缝又变大了");
  const ps = cut("function PolaroidStack(", "function MusicWidget(");
  // 「一摞」＝后面真的压着两张，不是一张方图加个影子
  assert.equal((ps.match(/"aria-hidden": true, style: sheet\(/g) || []).length, 2, "后面那两张没了，就不是一摞了");
  assert.match(ps, /fontFamily: F_SCRIPT/, "白边上那句不是花体");
  assert.match(comp, /const F_SCRIPT = "'Dancing Script'/, "花体没定义");
  assert.match(fs.readFileSync(P("index.html"), "utf8"), /Dancing\+Script:wght@400;600/, "花体没加载，写出来还是衬线体");
  // 三颗键必须真的接到播放器上，不是画着好看的
  assert.match(mw, /ctlBtn\("上一首", tri\(-1, ink\), onPrev\)/);
  assert.match(mw, /ctlBtn\("下一首", tri\(1, ink\), onNext\)/);
  assert.match(mw, /onToggle, true\)/);
  assert.match(mw, /const stop = fn => function \(e\) \{ e\.stopPropagation\(\); e\.preventDefault\(\);/, "按键会顺手把一起听整个打开");
  const app = fs.readFileSync(P("js/app.js"), "utf8");
  const homeProps = app.slice(app.indexOf("React.createElement(Home, {"), app.indexOf("onEditProfile: () => setProfileOpen(true)"));
  assert.match(homeProps, /onTogglePlay: togglePlay/, "播停没接到真的播放器");
  assert.match(homeProps, /onNextSong: \(\) => stepSong\(1\)/);
  assert.match(homeProps, /onPrevSong: \(\) => stepSong\(-1\)/);
});

test("卡片的底能换，换深底之后字跟着换——不然直接看不见", () => {
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  assert.match(comp, /const MUSIC_GROUNDS = \[/);
  assert.match(mw, /const gr = musicPhotoGround\(card\) \|\| musicGround\(card\.bg\);/, "自定义底图没接上");
  // 自己的图：明暗不知道，所以盖一层反方向的薄纱 + 字色由她选，不猜
  const pg = cut("function musicPhotoGround(card)", "function PolaroidStack(");
  assert.match(pg, /const darkText = card\.bgInk === "dark";/);
  assert.match(pg, /veil = darkText \? "rgba\(250,246,238,\.55\)" : "rgba\(26,22,18,\.46\)"/, "薄纱没跟着字色反过来，字会糊在图上");
  // ⚠️每一档深底都必须自带 ink/sub：只换 background 的话夜色和木桌上是墨字压深底
  const gs = cut("const MUSIC_GROUNDS = [", "const musicGround =");
  ["night", "wood", "moss", "kraft", "paper"].forEach(id => {
    const row = gs.split("\n").find(l => l.indexOf('id: "' + id + '"') >= 0);
    assert.ok(row && /ink:/.test(row) && /sub:/.test(row), id + " 这一档没给字色，换上去字会看不见");
  });
  assert.match(mw, /color: ink,/, "标题还在用主题的墨色，不认卡片的底");
});

test("那一页是整页，而且铺着自己的底", () => {
  const ed = cut("function MusicCardEdit(", "// 全局悬浮迷你播放器");
  assert.match(ed, /className: "h-full flex flex-col"/, "不是整页（no-half-sheet）");
  assert.match(ed, /pageSkin\("paper", t\)/, "又拿米白当外壳了");
  assert.match(ed, /bg: "transparent", onBack: onClose/, "顶栏没透上来，顶上会横一道平色带");
  assert.match(ed, /className: "flex-1 min-h-0 overflow-y-auto"/, "正文不是唯一的滚动容器");
  // 选中的底不能只靠一个色差（色弱/阳光下只剩形状可依）
  assert.match(ed, /on \? "2px solid " \+ t\.ink : "1px solid " \+ t\.line/);
  assert.match(ed, /\(on \? "· " : ""\) \+ g\.zh/, "选中态只靠边框，没给第二个记号");
});

test("木鱼放在蒲团上，不是浮在一块发白的玻璃碟上", () => {
  const my = cut("function MuyuWidget(", "// 情侣空间轮播组件");
  assert.match(my, /id: "wkPuTuan"/);
  assert.match(my, /stroke: "#c99a5e"/, "蒲团的绲边没了");
  assert.doesNotMatch(my, /radial-gradient\(ellipse at 50% 36%/, "又退回那层发白的玻璃托盘了");
});

test("地图上那行版权缩回角落，但一个字都没删", () => {
  // 选择器和缩字号必须是同一条规则：分开判的话，只把选择器改坏、规则体留着也照样过
  assert.match(html, /\.wk-mapwidget \.leaflet-control-attribution \{[^}]*font-size: 6\.5px !important/,
    "没有这条，Leaflet 默认那行会横穿整张图");
  // ⚠️Esri 的免 key 瓦片要求署名：只许缩小，不许删
  assert.match(fs.readFileSync(P("js/map.js"), "utf8"), /attribution: 'Tiles &copy; Esri'/, "署名不许删");
});
