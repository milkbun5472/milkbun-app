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
  assert.doesNotMatch(bar, /color: "rgba\(255,255,255/, "压条上的字写死了白色，深色主题会看不见");
});

// v63.70（她 2026-09-05：「这个黑框能不能改改，不是很百搭」）
//
// 压条原来是【整块墨色】——压在她那张暖色壁纸上就是一道黑框。
// 那块黑是 v63.08 为了「字要待在自己有底的东西上」加的；可夹板从那时起
// 就已经是不透明的纸色了，字早就有底，那一层黑是多余的。
// 判据：**它是不是一只夹子，该由【形状】说了算，不是靠涂一块深色。**
test("压条走主题自己的颜色，不再是一块压在壁纸上的黑", () => {
  const bar = rw.slice(rw.indexOf("function clampBar("), rw.indexOf("function RecentWidget("));
  assert.doesNotMatch(bar, /skinAlpha\(ink, "ff"\)/, "又涂回整块墨色了");
  assert.match(bar, /var fg = t\.ink \|\| "#3a3430";/, "字不是墨色——浅底上得用墨字");
  assert.match(bar, /skinAlpha\(ink, "0f"\)/, "压条不再跟着主题的深浅走");
  // 夹子的身份靠形状：上圆下方 + 底下那道唇线 + 两颗铆钉
  assert.match(bar, /borderRadius: "13px 13px 3px 3px"/);
  assert.match(bar, /borderBottom: "1px solid " \+ skinAlpha\(ink, "2a"\)/, "唇线没了，它就只是一条色带");
  assert.equal((bar.match(/width: 4\.5, height: 4\.5, borderRadius: 999/g) || []).length, 2, "铆钉不是两颗");
});

test("那一抹红跟着主题的强调色走，压在上面的字按亮度自己选深浅", () => {
  const w = rw.slice(rw.indexOf("function RecentWidget("), rw.indexOf("// ── 聊天框顶上那个返回键"));
  assert.match(w, /const accent = t\.accent \|\| "#b04a3f";/);
  assert.match(w, /borderLeft: "3px solid " \+ accent/, "字条左边那道还是写死的红");
  assert.match(w, /background: accent,/);
  // ⚠️写死 #fff 遇上浅色强调就白底白字，写死 t.bg2 遇上深色强调就黑底黑字
  const io = rw.slice(rw.indexOf("function inkOn(c)"), rw.indexOf("function clampBar("));
  assert.match(io, /> 150 \? "#241f1b" : "#fff"/);
  const f = new Function(io + "\nreturn inkOn;")();
  assert.equal(f("#b04a3f"), "#fff", "深红上该用白字");
  assert.equal(f("#f2d7a0"), "#241f1b", "浅黄上该用墨字");
  assert.equal(f("linear-gradient(x)"), "#fff", "认不出来的颜色该退回白字");
  assert.equal(f(undefined), "#fff");
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
  assert.match(mw, /const discSize = \(avail && room\)/, "盘的大小没跟着格子的高宽走");
  assert.match(mw, /mmss\(cur\)/, "走了多久那一行没了");
});

test("4×2 那一档：唱片旁边一摞拍立得，中间是进度，底下三颗真能按的键", () => {
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  // 拍立得只在两行高那一档出现——一行高的条子里它会被压扁
  // 宽度也跟着量出来的高度走（写死 94 的话矮格子里会顶出去）
  assert.match(mw, /h\(PolaroidStack, \{ w: Math\.max\(58, Math\.min\(94, Math\.round\(Math\.min\(\(avail \|\| 130\) \/ 1\.22, room \* 0\.27\)\)\)\), photo: card\.photo, note: card\.note, lean: 9/,
    "拍立得没挂上去 / 没往右歪 / 没跟着高度走 / 窄屏上没收窄（会压住下一首那颗键）");
  // 「大到有点超出边界的迹象」＝被卡边切掉一条，不是真画到卡外面（那会盖住旁边的格子）
  assert.match(mw, /marginRight: -22/, "它不再探出卡外了");
  assert.match(mw, /alignItems: "center", gap: square \? 9 : tall \? 9 : 11, overflow: "hidden"/, "卡不再切它，或者缝又变大了");
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

// v63.47（她 2026-09-05 发了自己手机上的真图：4×1 的字漏到卡外面、4×2 的播放键被切掉一半）
//
// 病根：尺寸是按【第几档】拍的（tall ? 126 : 62）。可是一行有多高是【量出来的】——
// 主屏把剩下的高度除以行数，每台机器都不一样；我按 82px 算出来的 126 在她那儿撑爆了。
test("卡里的尺寸从量出来的真实高宽推，不是按档位拍死的数", () => {
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  assert.match(mw, /const boxH = cellH \|\| 0;/, "高度预算不是从格子拿的");
  assert.match(mw, /const \[boxW, setBoxW\] = useState\(0\);/, "没量宽度");
  assert.match(mw, /new ResizeObserver\(measure\)/, "格子改尺寸时不会重新量");
  assert.match(mw, /ref: boxRef, onClick: onOpen/, "ref 没挂到卡上，量到的是别人");
  // 量不到（首帧）要有兜底，不然会闪一下 0
  assert.match(mw, /: \(compact \? 44 : square \? 62 : twoRow \? 110 : 58\)/, "首帧没有兜底尺寸");
  // 露不露某一层，问的是「还剩多少高度」
  assert.match(mw, /const tall = !square && \(avail \? avail >= 116 : twoRow\)/);
  assert.match(mw, /const showProg = avail \? avail >= 62/);
  assert.match(mw, /const showArtist = avail \? avail >= 46/);
});

test("窄格子里碟也不许顶破：宽度一样参与，竖排不上播放键", () => {
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  // 只按高度算的话：2×2 会顶破格子，3×2 会把中间那列挤成一个字一行
  // ⚠️口径改了（v63.66）：横排时又多了一道盖——【碟不许比它旁边那一列还高】。
  //   宽度那一道照旧在（它挡的是「顶破格子」），新增的这道挡的是「白撑着卡」。
  assert.match(mw, /Math\.min\(130, avail, Math\.round\(room \* 0\.36\), discCap\)/, "横排时碟没受宽度管");
  assert.match(mw, /const discCap = \(!square && colH\) \? Math\.max\(64, colH\) : Infinity;/, "碟没受旁边那列的高度管");
  assert.match(mw, /square \? Math\.min\(Math\.round\(avail \* 0\.45\), room, 110\)/, "竖排时碟没受宽度管");
  assert.match(mw, /const tall = !square &&/, "竖排也上了播放键——那点高度装不下，会被切掉");
  // 拍立得只在四格宽那一档露：三格宽时它一挂上去中间那列只剩三十来 px
  // v63.59：这一条不许再看【量出来的宽】，见下面那条测试
  assert.match(mw, /const showStack = tall && cols >= 4;/);
  assert.match(mw, /showStack \? h\("div", \{ style: \{ marginRight: -22/);
});

// v63.53（她 2026-09-05：「它看起来占两格的时候剪掉空的边，然后可以选在这两格是
// 居上居中还是居下」）
test("组件比格子矮时不再被拉满，多出来的空白靠哪儿由她定", () => {
  // ⚠️格子本身的高度不许动：buildLayout 是按格算落位的，动了整页排布就错了。
  //   改的只是「组件在这块格子里站哪儿」，和组件自己不再被拉满。
  assert.match(comp, /height: fixedH \|\| undefined, overflow: fixedH \? "hidden" : undefined/, "格子的高度被动过了");
  assert.match(comp, /const HOME_ALIGN_CSS = \{ top: "flex-start", center: "center", bottom: "flex-end" \};/);
  assert.match(comp, /justifyContent: HOME_ALIGN_CSS\[homeAlignOf\(key, widgetAligns\)\]/, "格子里没有按对齐站位");
  // ⚠️面板里那三个小图也有一模一样的三件套，所以这条必须钉在【格子那一处】上；
  //   而且 flex 那一层只许套在【自己决定高度】的那几个上（见下面那条）
  assert.match(comp, /HOME_SHRINK\[key\] \? \{ display: "flex", flexDirection: "column", justifyContent: HOME_ALIGN_CSS\[homeAlignOf\(key, widgetAligns\)\] \} : null/,
    "没有 flex 的话 justifyContent 是空转的；套给所有人的话会把名片压扁");
  // 认不出来的值要退回居中，不能让存档里一个脏字符串把布局搞没
  const seg = comp.slice(comp.indexOf('const HOME_ALIGN_CSS = '), comp.indexOf("function Home({"));
  const fn = new Function(seg + "\nreturn homeAlignOf;")();
  assert.equal(fn("w_music", {}), "center");
  assert.equal(fn("w_music", { w_music: "bottom" }), "bottom");
  assert.equal(fn("w_music", { w_music: "左" }), "center", "认不出来的值没退回居中");
  // 存得下来才算数
  assert.match(comp, /saveJSON\("x_homeWidgetAlign", n\)/);
  assert.match(comp, /loadJSON\("x_homeWidgetAlign", \{\}\)/);
});

test("面板里那一栏：三档、选中态不只靠颜色", () => {
  const panel = comp.slice(comp.indexOf('}, "在格子里靠哪儿"'), comp.indexOf('}, "外观样式"'));
  assert.match(panel, /HOME_ALIGNS\.map/);
  assert.match(panel, /setWidgetAlign\(styleKey, a\.id\)/, "点了不存");
  // 那三个小图里横条自己的位置就说明它站哪儿——不是三颗一样的色块
  assert.match(panel, /justifyContent: HOME_ALIGN_CSS\[a\.id\]/, "三个小图长得一样，只剩颜色能分");
  assert.match(comp, /const HOME_ALIGNS = \[\{ id: "top", zh: "靠上" \}, \{ id: "center", zh: "居中" \}, \{ id: "bottom", zh: "靠下" \}\];/);
});

test("一起听那张卡自己长多高就多高，高度预算从格子拿", () => {
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  assert.match(mw, /const boxH = cellH \|\| 0;/, "还在量自己——那是循环：内容决定高度、高度又决定内容");
  assert.match(mw, /height: "auto", minHeight: 0,/, "卡还被拉满，空边就剪不掉");
  assert.doesNotMatch(mw, /height: forced \? "100%" : "auto"/, "旧的拉满写法还在");
  assert.match(comp, /h\(MusicWidget, \{ listen: listen, player: player, homeSize: homeSize, cellH: fixedH,/, "格子高度没递给它");
});

// v63.54（她 2026-09-05：「没有变化宝宝，那个框还是一样大」）
//
// v63.53 里头那张卡确实缩了，可是【换过皮的那一层没缩】——外观样式的壳写死 height:100%，
// 于是看得见的那个框还是满格，一眼看过去一模一样。
// 判据一句话：**缩的必须是【看得见的那个框】，不是它里头那张卡。**
test("自己决定高度的组件，换过皮的那层壳也要跟着缩", () => {
  assert.match(comp, /const HOME_SHRINK = \{ w_music: true \};/);
  assert.match(comp, /style: HOME_SHRINK\[key\] \? Object\.assign\(\{\}, presetStyle, \{ height: "auto" \}\) : presetStyle/,
    "换过皮之后看得见的框还是满格");
  // 壳本来写死的就是 100%——这条钉住病根，它哪天改了这个测试要跟着重想
  const ps = comp.slice(comp.indexOf("function homeWidgetPresetStyle"), comp.indexOf("// 图上印着的那行小字"));
  assert.match(ps, /var base = \{ width: "100%", height: "100%"/, "壳的默认高度变了，HOME_SHRINK 那一处要跟着重看");
});

// v63.58（她 2026-09-05：「你觉得要不要开放可以下滑，就跟查手机那样又可以下滑又可以翻页」）
test("每一页自己能上下滑，横滑翻页照旧", () => {
  assert.match(comp, /overflowY: "auto", overscrollBehaviorY: "contain", WebkitOverflowScrolling: "touch"/,
    "页面不能上下滑");
  // 轨道要撑满高度，页面才有一个固定高度可以在里头滚
  assert.match(comp, /height: "100%",\s*\/\/ 轨道撑满/, "轨道没撑满，页面滚不起来");
  assert.match(comp, /alignItems: "stretch",/);
  // 横滑翻页靠的是方向锁：判成 h 才 preventDefault，判成 v 交给浏览器自己滚
  assert.match(comp, /if \(r\.dir !== "h"\) return;/, "方向锁没了，上下滑会被当成翻页抢走");
});

test("能滑之后一页可以多放两行，但补位空格照旧按看得见的行数补", () => {
  assert.match(comp, /const HOME_SCROLL_EXTRA_ROWS = 2;/);
  assert.match(comp, /var packRows = capRows \+ HOME_SCROLL_EXTRA_ROWS;/);
  assert.match(comp, /var ROWCAP = packRows, CAP = ROWCAP \* 4;/, "容量闸没放宽，一页照旧卡在看得见的那几行");
  // ⚠️补位空格必须还按看得见的行数：两个一起放宽的话，空页会凭空长出两排看不见的空格
  assert.match(comp, /var target = rowCapAt\(pi\) \* 4;/, "补位也跟着放宽了，空页会白白变高");
});

// v63.59（她 2026-09-05 发了实机图：那一摞拍立得在她机器上从来没出现过，我这儿次次都在）
//
// 病根：露不露拍立得判的是【量出来的宽】(boxW >= 320)。
// 375pt 宽的手机 + 一层有内边距的外观样式，量出来只有 309 —— 卡到线下面，整摞消失。
// 我沙盒默认 402pt 又没换皮，量出来 360，次次都过线，所以我永远看不到。
//
// 判据：**能用确定的数就别用量的。** 「它占几格」是主屏自己算好的，
// 每台机器都一样；量出来的宽会因为首帧、翻页动画、皮的内边距而变。
test("露不露拍立得看的是【它占几格】，不是量出来的宽", () => {
  const mw = cut("function MusicWidget(", "// 一起听那张卡的【背面】");
  assert.match(mw, /const cols = cellCols \|\| \(rows && rows\.cols\) \|\| 4;/);
  assert.match(mw, /const showStack = tall && cols >= 4;/);
  assert.doesNotMatch(mw, /boxW >= 320/, "又回去看量出来的宽了");
  // 占几格是主屏递下来的，不是组件自己猜的
  assert.match(comp, /cellH: fixedH, cellCols: span\[0\],/, "主屏没把「占几格」递下来");
  // 碟的宽度上限也要有一份不依赖测量的兜底，否则首帧那一下会算出个 0
  assert.match(mw, /const room = boxW \? Math\.max\(0, boxW - pad \* 2\)/);
  assert.match(mw, /: Math\.max\(120, Math\.round\(\(\(typeof window !== "undefined" \? window\.innerWidth : 390\)/,
    "量不到宽时没有兜底");
});

// v63.61（她 2026-09-05：「你这样把我名片弄坏了宝宝」）
//
// v63.53 我给【每一个】格子都套上了竖排 flex 对齐层。名片本来是「比一行高、
// 靠 overflow:visible 露出来」的那一种（HOME_FREE_HEIGHT 里就它一个）：
// 块级孩子只会溢出，**flex 孩子会被压扁**（flex-shrink 默认 1）——
// 93px 的内容压成 66px，底下「N 认识 · N 记忆 · N 天」那一行直接没了。
//
// 判据：**这一层只许套在需要它的那几个上。**
test("对齐层只套给自己决定高度的组件——别的照旧是块级，不许被压扁", () => {
  assert.match(comp, /HOME_SHRINK\[key\] \? \{ display: "flex", flexDirection: "column"/, "又套给所有人了");
  // 名片是唯一一个高度自由的：它比一行高，靠溢出露出来，压不得
  assert.match(comp, /const HOME_FREE_HEIGHT = \{ w_card: true \};/);
  assert.equal(/const HOME_SHRINK = \{([^}]*)\}/.exec(comp)[1].indexOf("w_card"), -1,
    "名片被登记成「自己决定高度」了，它会重新被 flex 压扁");
  // 面板里那一栏也只对这几个出现——摆一个按了没反应的钮比没有还糟
  assert.match(comp, /HOME_SHRINK\[styleKey\] \? h\("div", \{[^}]*\}[^)]*\}, "在格子里靠哪儿"\) : null/, "面板那一栏的标题没跟着收口");
  assert.match(comp, /HOME_SHRINK\[styleKey\] \? h\("div", \{ style: \{ display: "grid", gridTemplateColumns: "repeat\(3,minmax\(0,1fr\)\)", gap: 8 \} \},/, "面板那三个钮没跟着收口");
});
