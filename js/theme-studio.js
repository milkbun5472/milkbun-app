// 主题工作台：图标皮肤 + 页面作用域 CSS + 可撤销预览。
// 素材只存 x_imgvault；配置只保存 iv_ 引用，避免 localStorage 被图片撑爆。
(function (g) {
  "use strict";
  const KEY = "x_theme_studio";
  const STYLE_ID = "lisa-theme-studio-style";
  const PREVIEW_MS = 30000;
  // 换图标能改哪些 app —— 名单【不在这里】：它由 components.js 的 HOME_APP_DEFS
  // 一份说了算（主屏摆的就是那一份）。她 2026-09-04 报「有些 app 都不在里面没法改，
  // 有些在里面但是不是真 app」——病根就是这儿原来自己抄了一份平行名单，然后走散了：
  //   · 去处 / 匿名问答 是真 app，这份名单里没有 → 改不了图标；
  //   · 备忘录 / 朋友圈 在这份名单里，主屏上却没有这两个 app；
  //   · dock 的消息那格 key 是 "messages"，这儿写的是 "chat" → 换了从来没生效过。
  // ⚠️兜底那份只在 components.js 还没加载时用得上（顺序上不该发生），
  //   而且【故意只留几个】：留一份完整副本，就等于又抄了一遍，迟早再走散一次。
  const APP_ICONS_FALLBACK = [["cast", "人格档案馆"], ["phone", "查手机"], ["config", "设置"]];
  const appIconList = () => {
    try { if (typeof window !== "undefined" && typeof window.HomeAppList === "function") return window.HomeAppList(); } catch (e) {}
    return APP_ICONS_FALLBACK;
  };
  // ⚠️这份名单原来是手写的十页，而作用域机制是 html[data-lisa-screen="<screen>"]，
  //   **每一页都自带这个属性**——十页是名单的限制，不是能力的限制。于是
  //   「秋秋知道你正开着查手机，却没法给查手机写样式」。而且这里把 messages
  //   标成了「朋友圈」，那一页其实是整个消息 app（聊天/通讯录/朋友圈/我 四栏）。
  //   现在从 core.js 那份【全库唯一的页名单】派生，两处再也对不上不了。
  const PAGES = [["all", "全 App"]].concat(
    Object.keys(typeof SCREEN_ZH !== "undefined" ? SCREEN_ZH : {}).map(function (k) {
      const note = (typeof SCREEN_NOTE !== "undefined" && SCREEN_NOTE[k]) || "";
      return [k, SCREEN_ZH[k] + (note ? "（" + note + "）" : "")];
    }));
  // ── 内置 CSS 预设 + 每页 5 个自己的槽位（v61.05，她 2026-09-03 点名）──────
  // 「内置」是只读的起手式：点一下把整段 CSS 灌进编辑框，她再改。
  // 「槽位」是她自己的：每一页 5 个，存在 x_themeCssSlots，跟主题档案分开——
  // 草稿反复存取不该把正在用的主题搅进去。
  // ── 内置聊天皮肤（v61.13，她 2026-09-03：「就在页面 css 里面那栏线上里面存预设，
  //    然后点击可以看见 css 预设在编辑框里可以再自己改」）──
  // 五套照各家聊天软件【浅色默认皮】配的配色，只抄颜色、圆角、气泡尖角这几件事，
  // 不碰任何图标、字体、商标——那些是人家的东西。
  // ⚠️一处画、五处用：五套的差别只有底下 SKINS 里那十几个数，骨架共用 chatSkinCSS。
  //   各写一份的话，以后 data-wk 挂点一改，就得记得改五遍——迟早漏。
  const chatSkinCSS = o => [
'[data-wk="chat"], [data-wk="body"] {',
'  background-color: ' + o.bg + ' !important;',
'  background-image: ' + (o.bgArt || "none") + ' !important;',
'  background-size: ' + (o.bgSize || "auto") + ' !important;',
'  background-attachment: scroll !important;',
'}',
'',
/* 顶栏这一整块（含底下那条此刻日程条）：底和字是配好的一对，不许拆开用。
   ⚠️里面每一格的 color 都是【行内样式】，只给外层刷一个 color 继承不下去
   （行内赢过普通规则）——所以每格各挂一个点，规则带 !important 才盖得住。
   图标的 stroke 是属性不是行内样式，同一条规则就能压住。 */
'[data-wk="chathead"] {',
'  background: ' + o.head + ' !important;',
'  border-bottom: 1px solid ' + o.line + ' !important;',
'  color: ' + o.headInk + ' !important;',
'}',
/* 顶上这一片只有两档字：正的和淡的。名字、返回键、更多、此刻在做什么都是正的；
   小箭头、副标题、NOW、时刻是淡的。挂点也就只有这两个——多一个名字就多一处会漏。 */
'[data-wk="headink"] { color: ' + o.headInk + ' !important; }',
'[data-wk="headdim"] { color: ' + o.headDim + ' !important; }',
'svg[data-wk="headink"] { stroke: ' + o.headInk + ' !important; }',
'svg[data-wk="headdim"] { stroke: ' + o.headDim + ' !important; }',
'',
'[data-wk="time"] span {',
'  display: inline-block !important;',
'  background: ' + o.timeBg + ' !important;',
'  color: ' + o.timeInk + ' !important;',
'  font-size: 11px !important;',
'  line-height: 1 !important;',
'  padding: ' + o.timePad + ' !important;',
'  border-radius: ' + o.timeRadius + ' !important;',
'}',
'',
/* 居中那几行系统小字：撤回、已读不回、拍一拍、通话挂断回执和它下面那句小结。
   它们跟时间分割条是【同一件事】——飘在聊天底上的系统提示，所以吃同一套旋钮。
   （她 2026-09-04：「语音挂断后的 summary 也是灰的在 line 皮肤看不见」，
   病根就是这几行还留着主题的灰、底却换成了皮肤的。）
   ⚠️底跟时间条同一块，字却单独一档 noteInk：时间条是【扫一眼就过】的四个字，
   各家真实配色本来就很淡（微信 #b2b2b2 压在 #ededed 上只有 1.8）；
   通话小结是【要读的一句话】，照抄那个淡度等于没修。 */
'[data-wk="note"] {',
'  background: ' + o.noteBg + ' !important;',
'  color: ' + o.noteInk + ' !important;',
'  border: none !important;',
'  border-radius: ' + (o.timeRadius === "0" ? "9px" : o.timeRadius) + ' !important;',
'  padding: ' + (o.timePad === "0" ? "3px 10px" : o.timePad) + ' !important;',
'  -webkit-backdrop-filter: none !important;',
'  backdrop-filter: none !important;',
'}',
'svg[data-wk="noteink"] { stroke: ' + o.noteInk + ' !important; }',
'',
'[data-wk="avatar"],',
'[data-wk="avatar"] img,',
'[data-wk="avatar"] > * {',
'  border-radius: ' + o.avatar + ' !important;',
'  overflow: hidden !important;',
'}',
'',
'[data-wk="bubble"] {',
'  border-radius: ' + o.radius + ' !important;',
'  padding: 10px 13px !important;',
'  font-size: 16px !important;',
'  line-height: 1.45 !important;',
'  box-shadow: ' + o.shadow + ' !important;',
'  border: none !important;',
'  position: relative !important;',
'}',
'',
'[data-wk="bubble"][data-me="0"] {',
'  background: ' + o.theirBg + ' !important;',
'  color: ' + o.theirInk + ' !important;',
'}',
'',
'[data-wk="bubble"][data-me="1"] {',
'  background: ' + o.myBg + ' !important;',
'  color: ' + o.myInk + ' !important;',
'}',
''
  ].concat(o.tail ? [
'/* 气泡尖角：一个真三角，长在气泡边上。',
'   原来是转 45 度的小方块浮在旁边——那是两块分开的东西，凑近看接不上。 */',
'[data-wk="bubble"]::before {',
'  content: "" !important;',
'  position: absolute !important;',
'  top: 12px !important;',
'  width: 0 !important;',
'  height: 0 !important;',
'  border-top: 5px solid transparent !important;',
'  border-bottom: 5px solid transparent !important;',
'}',
'[data-wk="bubble"][data-me="0"]::before {',
'  left: -5px !important;',
'  border-right: 5px solid ' + o.theirBg + ' !important;',
'}',
'[data-wk="bubble"][data-me="1"]::before {',
'  right: -5px !important;',
'  border-left: 5px solid ' + o.myBg + ' !important;',
'}',
'',
'/* 图片和表情不该套气泡底色，尖角也得收起来 */',
'[data-wk="bubble"][data-kind="photo"]::before,',
'[data-wk="bubble"][data-kind="sticker"]::before { display: none !important; }'
  ] : []).concat([
'',
'[data-wk="bubble"][data-kind="photo"],',
'[data-wk="bubble"][data-kind="sticker"] {',
'  background: transparent !important;',
'  padding: 0 !important;',
'  box-shadow: none !important;',
'}',
'',
'/* 转账、礼物、位置、亲属卡、分享…… 气泡外面那些卡片 */',
'[data-wk="card"] {',
'  border-radius: ' + o.card + ' !important;',
'  overflow: hidden !important;',
'}',
'',
'/* 发出来的照片和表情：气泡本身被扒光了，圆角得落在图上 */',
'[data-wk="bubble"] img,',
'[data-wk="bubble"][data-kind="photo"] > *,',
'[data-wk="bubble"][data-kind="sticker"] > * {',
'  border-radius: ' + o.photo + ' !important;',
'}',
'',
'/* 已读和时间：各家摆的位置完全不一样，这一处最认脸 */',
'[data-wk="meta"] {',
'  font-size: ' + o.metaSize + ' !important;',
'  color: ' + o.metaInk + ' !important;',
'  margin-top: ' + o.metaTop + ' !important;',
'}'
  ].concat(o.metaInBubble ? [
'/* 塞进气泡里：贴着那一条的右下角，跟正文挤在同一块底上 */',
'/* ⚠️不能 absolute 到 [data-wk="msg"] 上——那是【整行】，对方那侧会把已读甩到屏幕最右边。',
'   气泡和已读是同一个 flex 列的两个孩子，列宽＝气泡宽，所以 align-self:flex-end',
'   正好落在气泡右缘；再用负的上边距把它提进气泡多留出来的那截底里。 */',
'[data-wk="bubble"] { padding-bottom: 19px !important; }',
'[data-wk="meta"] {',
'  align-self: flex-end !important;',
'  margin-top: -17px !important;',
'  margin-right: 11px !important;',
'  position: relative !important;',
'  z-index: 1 !important;',
'}'
  ] : []).concat([
'',
'[data-wk="msg"] { padding-top: ' + o.gap + 'px !important; padding-bottom: ' + o.gap + 'px !important; }',
'[data-wk="row"] { gap: ' + o.rowGap + 'px !important; }',
'',
/* 此刻日程条：它自己没底色（她 v61.05 要的「跟随框的颜色」），
   所以皮肤一换，那几个字还留着主题的浅灰，压在皮肤的底上就糊了
   —— 她 2026-09-04：「这个 now 也是暗暗的」。
   跟输入框那次同一个病：一块底的字色，必须由【铺这块底的人】给。
   这一条摆在顶栏正下面，所以整条直接吃顶栏那一套（底和字是配好的一对）。
   ⚠️里面几格的 color 是行内样式，不加 !important 压不过去。 */
'[data-wk="now"][data-dev="0"] { background: ' + o.head + ' !important; }',
'[data-wk="now"] { border-bottom: 1px solid ' + o.line + ' !important; }',
'[data-wk="nowdot"] { background: ' + o.send + ' !important; }',
'',
'[data-wk="composer"] {',
'  background: ' + o.footBg + ' !important;',
'  border-top: 1px solid ' + o.line + ' !important;',
'}',
'[data-wk="composer"] input,',
'[data-wk="composer"] textarea {',
'  background: ' + o.inputBg + ' !important;',
'  border: none !important;',
'  border-radius: ' + o.inputRadius + ' !important;',
// ⚠️输入框的字色必须配【输入框自己的底】。原来这里刷的是 headInk——顶栏的字色。
//   顶栏底深的皮肤（LINE 那块蓝灰）headInk 是白的，落到浅色输入框上就是白底白字，
//   她 2026-09-03 报「这个皮肤输入框的字是白色的」。
//   同一条坑 tabs-not-plain-pills.md 里写过：一块底的字色不许从别处借。
'  color: ' + o.inputInk + ' !important;',
'  font-size: 16px !important;',
'}',
'[data-wk="composer"] input::placeholder,',
'[data-wk="composer"] textarea::placeholder {',
// 占位字不跟着走的话，浏览器拿 color 淡一层——白字淡一层还是白的
'  color: ' + o.inputHint + ' !important;',
'  opacity: 1 !important;',
'}',
'',
'[data-wk="send"] {',
'  background: ' + o.send + ' !important;',
'  color: ' + o.sendInk + ' !important;',
'  border: none !important;',
'  border-radius: ' + o.sendRadius + ' !important;',
'}'
  ])).join("\n");
  // 各家最认脸的其实不是配色，是【底】和【已读那一行摆在哪】。
  // 她 2026-09-03：「whatsapp line telegram 这几个也太像了」——是真的：
  // 三家原来都是「浅底 + 对方白气泡 + 自己一块有色气泡 + 圆头像 + 尖角」，
  // 只有色相不一样。照 tabs-not-plain-pills.md 那条判据：原样搬到另一家还成立，
  // 就等于没做。所以这一版按各家真正分得开的地方重配。
  //
  // ⚠️底纹是我自己画的几何图形，不是谁家的素材；只学「有没有底纹、什么密度」。
  const wave = c => "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E"
    + "%3Cg fill='none' stroke='%23" + c + "' stroke-width='1.6' stroke-linecap='round'%3E"
    + "%3Cpath d='M14 20h16M14 26h10'/%3E%3Ccircle cx='86' cy='22' r='7'/%3E"
    + "%3Cpath d='M20 62c4-7 12-7 16 0s12 7 16 0'/%3E%3Cpath d='M92 58v14M85 65h14'/%3E"
    + "%3Cpath d='M28 98l7-7 7 7'/%3E%3Ccircle cx='78' cy='100' r='5'/%3E%3Cpath d='M56 34h8v8h-8z'/%3E"
    + "%3C/g%3E%3C/svg%3E\")";

  // 微信：方气泡、带尖角、灰底。⚠️时刻是一行【没有底】的灰字——
  // 原来给了它一颗灰药丸配白字，那是别家的样子，一眼就出戏。
  const WECHAT_CSS = chatSkinCSS({ bg:"#ededed", head:"#ededed", line:"#d9d9d9", headInk:"#111111", headDim:"#8a8a8a",
    timeBg:"transparent", timeInk:"#b2b2b2", timeRadius:"0", timePad:"0", noteBg:"transparent", noteInk:"#6b6b6b", avatar:"4px", radius:"5px", shadow:"none",
    theirBg:"#ffffff", theirInk:"#111111", myBg:"#95ec69", myInk:"#111111",
    tail:true, gap:6, rowGap:10, card:"4px", photo:"4px",
    metaSize:"9.5px", metaInk:"#b2b2b2", metaTop:"3px", metaInBubble:false,
    footBg:"#f7f7f7", inputBg:"#ffffff", inputRadius:"5px", inputInk:"#111111", inputHint:"#b2b2b2", send:"#07c160", sendInk:"#ffffff", sendRadius:"4px" });

  // LINE：底是一块干净的蓝灰，没有底纹；气泡特别圆、留白也大；
  // 最认脸的是【已读和时间甩在气泡外面】，字比别家还小一号。
  const LINE_CSS = chatSkinCSS({ bg:"#8ca0b3", head:"#5b6b7c", line:"rgba(0,0,0,.16)", headInk:"#ffffff", headDim:"rgba(255,255,255,.62)",
    timeBg:"rgba(0,0,0,.30)", timeInk:"#ffffff", timeRadius:"999px", timePad:"4px 11px", noteBg:"rgba(0,0,0,.34)", noteInk:"#ffffff", avatar:"999px", radius:"20px", shadow:"none",
    theirBg:"#ffffff", theirInk:"#1f1f1f", myBg:"#06c755", myInk:"#ffffff",
    tail:true, gap:6, rowGap:9, card:"18px", photo:"18px",
    metaSize:"8.5px", metaInk:"rgba(255,255,255,.85)", metaTop:"3px", metaInBubble:false,
    footBg:"#ffffff", inputBg:"#f2f4f6", inputRadius:"999px", inputInk:"#1f1f1f", inputHint:"#98a2ab", send:"#06c755", sendInk:"#ffffff", sendRadius:"999px" });

  // Telegram：底是一整片暖紫渐变（它默认就是一张渐变壁纸，不是平色）；
  // 气泡不带尖角、几乎不留投影，密度最紧；已读和时间【在气泡里】。
  const TELEGRAM_CSS = chatSkinCSS({ bg:"#8f7bb8",
    bgArt:"linear-gradient(150deg,#b39ddb 0%,#9575cd 34%,#7e8fd0 68%,#64b5c6 100%)", bgSize:"cover",
    head:"#ffffff", line:"#e4e7ea", headInk:"#0f1419", headDim:"#707579",
    timeBg:"rgba(0,0,0,.26)", timeInk:"#ffffff", timeRadius:"999px", timePad:"3px 9px", noteBg:"rgba(0,0,0,.30)", noteInk:"#ffffff", avatar:"999px", radius:"13px",
    shadow:"0 1px 1px rgba(16,35,47,.10)",
    theirBg:"#ffffff", theirInk:"#0f1419", myBg:"#effdde", myInk:"#0f1419",
    tail:false, gap:3, rowGap:8, card:"11px", photo:"11px",
    metaSize:"9px", metaInk:"rgba(90,120,90,.75)", metaTop:"0", metaInBubble:true,
    footBg:"#ffffff", inputBg:"#f1f3f5", inputRadius:"16px", inputInk:"#0f1419", inputHint:"#8b959e", send:"#3390ec", sendInk:"#ffffff", sendRadius:"999px" });

  // WhatsApp：认得出的那个米底【上面有一层浅浅的涂鸦】——这才是它最认脸的地方，
  // 光靠米色跟别家分不开。气泡方得多，已读和时间也【在气泡里】。
  const WHATSAPP_CSS = chatSkinCSS({ bg:"#efeae2", bgArt:wave("d3c9b8"), bgSize:"120px 120px",
    head:"#f0f2f5", line:"#d9d4cc", headInk:"#111b21", headDim:"#667781",
    timeBg:"#ffffff", timeInk:"#54656f", timeRadius:"7px", timePad:"5px 11px", noteBg:"#ffffff", noteInk:"#54656f", avatar:"999px", radius:"8px",
    shadow:"0 1px 1px rgba(11,20,26,.13)",
    theirBg:"#ffffff", theirInk:"#111b21", myBg:"#d9fdd3", myInk:"#111b21",
    tail:true, gap:4, rowGap:9, card:"8px", photo:"7px",
    metaSize:"9px", metaInk:"rgba(17,27,33,.45)", metaTop:"0", metaInBubble:true,
    footBg:"#f0f2f5", inputBg:"#ffffff", inputRadius:"22px", inputInk:"#111b21", inputHint:"#8696a0", send:"#00a884", sendInk:"#ffffff", sendRadius:"999px" });

  // Insta DM：白底、气泡特别圆、自己那侧紫蓝渐变白字，没有尖角。
  // ⚠️发送键不许透明：图标颜色是写死的 #fff，透明底＝白图标落在白底上，
  //   她 2026-09-03 就报了「ins 的发送键看不到」。同 tabs-not-plain-pills.md
  //   那条「绝不许写死 #fff」的坑。
  const INSTA_CSS = chatSkinCSS({ bg:"#ffffff", head:"#ffffff", line:"#efefef", headInk:"#111111", headDim:"#8e8e8e",
    timeBg:"transparent", timeInk:"#8e8e8e", timeRadius:"0", timePad:"0", noteBg:"transparent", noteInk:"#737373", avatar:"999px", radius:"22px", shadow:"none",
    theirBg:"#efefef", theirInk:"#111111", myBg:"linear-gradient(135deg,#4f5bd5,#8134af)", myInk:"#ffffff",
    tail:false, gap:3, rowGap:9, card:"20px", photo:"20px",
    metaSize:"9px", metaInk:"#8e8e8e", metaTop:"3px", metaInBubble:false,
    footBg:"#ffffff", inputBg:"#ffffff", inputRadius:"999px", inputInk:"#111111", inputHint:"#8e8e8e", send:"#0095f6", sendInk:"#ffffff", sendRadius:"999px" })
    + '\n[data-wk="composer"] input,\n[data-wk="composer"] textarea {\n  border: 1px solid #dbdbdb !important;\n}';
  // ⚠️内置预设是【拷贝】进她编辑框的，不是引用：我改了内置，她手上那份不会跟着变。
  //   她 2026-09-03 就是这么撞上的——挂点全补好了，她那份 CSS 还是旧选择器，
  //   于是「感觉一个没生效」。改内置时把这个数 +1，界面就会提示她重新灌一次。
  const SKIN_VER = 5;
  const stamp = (nm, css) => "/* 内置 · " + nm + " · v" + SKIN_VER + " */\n" + css;
  const CHAT_SKINS = [["仿微信", WECHAT_CSS], ["仿 LINE", LINE_CSS], ["仿 Telegram", TELEGRAM_CSS],
    ["仿 WhatsApp", WHATSAPP_CSS], ["仿 Insta DM", INSTA_CSS]].map(([nm, css]) => [nm, stamp(nm, css)]);
  // 编辑框里那段是不是某套内置的【旧版本】：认得出就报出名字和新版本号
  const cssStale = text => {
    const m = /^\/\* 内置 · (.+?) · v(\d+) \*\//.exec(String(text || "").trim());
    if (!m) return null;                       // 不是从内置灌来的（或者她自己删了那行），不管
    return Number(m[2]) < SKIN_VER ? { name: m[1], from: Number(m[2]), to: SKIN_VER } : null;
  };
  // 消息列表的两套起手式（群友 2026-10-03：「这个界面的这种是没办法美化吗」）。
  //   只用 v74.732 补的那 12 个挂点 + 通用的 app/head，换的是颜色、圆角、间距，不碰排版。
  const listSkinCSS = o => [
    '[data-wk="app"], [data-wk="mlpage"] { background: ' + o.bg + ' !important; }',
    '[data-wk="mlsearch"] { background: ' + o.card + ' !important; border-color: ' + o.line + ' !important; border-radius: ' + o.searchRadius + ' !important; }',
    '[data-wk="mlrow"], [data-wk="ctrow"], [data-wk="ctentry"] {',
    '  background: ' + o.card + ' !important; border-bottom: ' + o.rowLine + ' !important;',
    '  margin: ' + o.rowMargin + ' !important; width: ' + o.rowWidth + ' !important; border-radius: ' + o.rowRadius + ' !important;',
    '  box-shadow: ' + o.shadow + ' !important;',
    '}',
    '[data-wk="mlrow"][data-pinned="1"] { background: ' + o.pinned + ' !important; }',
    '[data-wk="mlavatar"] > *, [data-wk="mlavatar"] img { border-radius: ' + o.avatar + ' !important; }',
    '[data-wk="mlname"] { color: ' + o.ink + ' !important; }',
    '[data-wk="mllast"], [data-wk="mltime"] { color: ' + o.dim + ' !important; }',
    '[data-wk="mlrow"][data-unread="1"] [data-wk="mllast"] { color: ' + o.accent + ' !important; }',
    '[data-wk="mlbadge"] { background: ' + o.accent + ' !important; color: ' + o.badgeInk + ' !important; }',
    '[data-wk="ctletter"] { background: transparent !important; color: ' + o.dim + ' !important; }',
    '[data-wk="mltabbar"] { background: ' + o.bar + ' !important; border-top-color: ' + o.line + ' !important; }',
    '[data-wk="mltab"] span { color: ' + o.dim + ' !important; }',
    '[data-wk="mltab"] svg { stroke: ' + o.dim + ' !important; }',
    '[data-wk="mltab"][data-on="1"] span { color: ' + o.accent + ' !important; }',
    '[data-wk="mltab"][data-on="1"] svg { stroke: ' + o.accent + ' !important; }'
  ].join("\n");
  // 奶油卡片：一行一张圆角小卡，中间留缝，像便签一张张贴着
  const LIST_CREAM_CSS = listSkinCSS({ bg:"#f6f1ea", card:"#fffdf9", line:"#ece3d6", searchRadius:"999px",
    rowLine:"none", rowMargin:"0 12px 8px", rowWidth:"calc(100% - 24px)", rowRadius:"16px", shadow:"0 2px 8px rgba(120,96,60,.08)",
    pinned:"#fff4ea", avatar:"14px", ink:"#4a3f35", dim:"#a89a8a", accent:"#d9826b", badgeInk:"#ffffff", bar:"#fffdf9" });
  // 夜色：深底浅字，整列不分卡，只留细线
  const LIST_NIGHT_CSS = listSkinCSS({ bg:"#16181d", card:"#1f2229", line:"#2c3038", searchRadius:"10px",
    rowLine:"1px solid #2c3038", rowMargin:"0", rowWidth:"100%", rowRadius:"0", shadow:"none",
    pinned:"#262a33", avatar:"999px", ink:"#e8e6e3", dim:"#8b8f98", accent:"#8fb4ff", badgeInk:"#16181d", bar:"#1b1d23" })
    + '\n[data-wk="head"], [data-wk="head"] * { color: #e8e6e3 !important; }\n[data-wk="head"] svg { stroke: #e8e6e3 !important; }';
  const LIST_SKINS = [["奶油卡片", LIST_CREAM_CSS], ["夜色", LIST_NIGHT_CSS]].map(([nm, css]) => [nm, stamp(nm, css)]);
  // 「全 App」那一栏的起手式（群友 2026-10-03：「那个全 app 的我弄了没什么效果」）。
  //   它只抓得住【共用部件】（顶栏、头像、半窗、弹卡、横幅、开关、输入框）——每页自己的卡片和底纹它碰不到，
  //   所以这一套故意只写这几样：套上就看得见，也正好当「全 App 能改什么」的范例。
  const ALL_SOFT_CSS = [
    '/* 顶栏：半透明毛玻璃，底下那道线换成淡影 */',
    '[data-wk="head"] {',
    '  background: rgba(255,255,255,.55) !important;',
    '  -webkit-backdrop-filter: blur(14px) saturate(1.2) !important;',
    '  backdrop-filter: blur(14px) saturate(1.2) !important;',
    '  border-bottom: none !important;',
    '  box-shadow: 0 1px 10px rgba(60,50,40,.06) !important;',
    '}',
    '/* 头像：全 App 每一颗都换成圆角方 */',
    '[data-wk="avatar"], [data-wk="avatar"] img { border-radius: 30% !important; }',
    '/* 半窗、屏幕正中的小卡：更大的圆角和柔影 */',
    '[data-wk="sheet"] { border-radius: 30px 30px 0 0 !important; box-shadow: 0 -8px 30px rgba(60,50,40,.12) !important; }',
    '[data-wk="centercard"] { border-radius: 24px !important; box-shadow: 0 12px 36px rgba(60,50,40,.18) !important; }',
    '/* 新消息横幅：胶囊形 */',
    '[data-wk="msgbanner"] { border-radius: 999px !important; }',
    '/* 输入框：圆一点 */',
    '[data-wk="input"], [data-wk="textarea"] { border-radius: 14px !important; }'
  ].join("\n");
  const ALL_SKINS = [["柔和毛玻璃", ALL_SOFT_CSS]].map(([nm, css]) => [nm, stamp(nm, css)]);
  const CSS_BUILTINS = { all: ALL_SKINS, thread: CHAT_SKINS, gthread: CHAT_SKINS, messages: LIST_SKINS };
  // ── 页面 CSS 真正抓得住的那几个点（v64.82）────────────────────────────
  // ⚠️这个 App 的样式【几乎全是内联 style】（每个组件从 useTheme() 拿 t.bg / t.ink
  //   自己写在 style 里）。行内样式赢过普通 CSS 规则——所以一条不带 !important 的
  //   规则，写得再对也一点效果都没有。
  // ⚠️语义钩子（data-wk）只有【WK_COMMON 那几个 + WK_SCOPED 里点了名的那几页】才有。
  //   没挂钩子的地方，在那一页上写 CSS 除非用通用选择器硬压，否则改不动任何东西。
  // 秋秋（js/assistant.js）要照这份说给模型听——它原来什么都不知道，
  //   于是自己发明了 `.theme-xxx [data-page="xxx"]` 这种选择器，写完一点不生效
  //   （她 2026-09-06：「秋秋这个能改 css 是假的，应用了也不改」）。
  // 全 App 每一页都有的那几个（挂在共用组件上，所以九十来页一起有）
  const WK_COMMON = Object.freeze([
    ["app", "这一页的底（最外那层）"],
    ["head", "顶栏整条"], ["headink", "顶栏的字与图标"], ["headdim", "顶栏那行小副标题"], ["myvote", "擂台观战时你自己投票那一行"], ["lookundo", "美化「回到上一版／换回来」那一行"],
    ["eyebrow", "小标题眉标（那种间距拉开的小字）"],
    ["csreset", "聊天设置里「清除 / 重置…」那颗按钮"], ["resetpage", "清除 / 重置选择页整页"], ["resetgo", "选择页最后那颗「确定清掉」"],
    ["empty", "空状态那一块（还没有内容时）"],
    ["sheet", "从底下掀起来的半窗"], ["pagesheet", "原来是半窗、现在铺满整页的那些（通话记录、查找记录、记忆库、备忘录编辑……）"], ["centercard", "屏幕正中弹出来的小卡片"], ["msgbanner", "顶上掉下来的新消息横幅"],
    ["avatar", "头像（全 App 每一颗）"],
    ["field", "一栏设置（标题＋内容＋底下那道细线）"], ["fieldlabel", "那一栏的标题"], ["fieldline", "那一栏底下的细线"],
    ["toggle", "开关（data-on=\"1\" 是开着的）"], ["toggleknob", "开关里那颗圆钮"], ["askqiu", "「问秋秋 ›」那一行（人格档案馆和角色编辑页上）"],
    ["input", "单行输入框"], ["textarea", "多行输入框"], ["slider", "滑杆"]
  ]);
  // 底下这几组是【某几页专有】的（气泡、输入栏、主屏那些格子，别处没有）。
  // ⚠️一张表，一行一组【叫什么 · 哪几页 · 有哪些挂点】。第二组进来的时候
  //   不许在旁边再并排开一对 WK_XXX / WK_XXX_PAGES —— 那就是同一层写在两处，
  //   秋秋那边迟早只念到其中一份（one-public-mechanism.md）。
  const WK_SCOPED = Object.freeze([
    // 消息 app 那一页（群友 2026-10-03：「这个界面的这种是没办法美化吗」）——聊天列表、通讯录、底下四个标签
    Object.freeze({zh:"消息列表",pages:Object.freeze(["messages"]),hooks:Object.freeze([
      ["npcdel", "通讯录 → 配角 → 点开一位 → 删除时弹出的那块确认（连不连聊天一起清）"],
      ["mlpage","消息这一页的底（聊天／通讯录／朋友圈／我 四栏共用）"],
      ["mlsearch","聊天列表顶上的搜索框"],
      ["mlrow","聊天列表的一行（data-kind=\"char\"/\"group\"；data-pinned=\"1\" 是置顶；data-unread=\"1\" 有未读）"],
      ["mlavatar","那一行的头像（群是四宫格或群头像）"],["mlname","名字／群名"],["mllast","最后一条消息那行小字"],
      ["mltime","右边的时间"],["mlbadge","未读红点"],
      ["ctentry","通讯录顶上「群聊／标签／配角」那几个入口"],["ctletter","通讯录的字母分组条"],["ctrow","通讯录的一行联系人"],
      ["mltabbar","底下那条四个标签的栏"],["mltab","每一个标签（data-tab=chats/contacts/moments/me；data-on=\"1\" 是当前那个）"]
    ])}),
    Object.freeze({zh:"朋友圈",pages:Object.freeze(["messages", "momprofile"]),hooks:Object.freeze([["mocompose", "朋友圈信息流顶上那个「发朋友圈」按钮"], ["mopost", "信息流里一条动态整块（data-me=\"1\" 是她自己发的）"], ["moname", "动态上的作者名字"], ["motext", "动态的正文文字"], ["mophoto", "动态配图（data-kind=\"img\" 真图，\"desc\" 是「点开看描述」的文字卡）"], ["motime", "动态下方的时间"], ["molike", "点赞按钮（data-on=\"1\" 是她点过赞）"], ["mompin", "动态下面那个「收进时刻」"], ["molikers", "点赞人名单那一行"], ["mopoll", "动态里的投票整块"], ["mopollrow", "投票里的一个选项"], ["mopollbar", "投票选项下面那根票数条"], ["mopollbtn", "发朋友圈时的「投票」按钮（data-on=\"1\" 已加）"], ["mopollopts", "发朋友圈时填选项那一块"], ["mocomments", "评论区整块浅底框"], ["mocomment", "评论区里的一条评论"], ["moprofile", "个人页封面下面的滚动正文区（data-me=\"1\" 是她自己的个人页）"], ["mocover", "个人页顶部封面整块（data-on=\"1\" 是设了封面图）"], ["mocoveradj", "封面调位置时盖在上面那一层（提示＋取消／好了）"], ["moprofilehead", "封面右下角的名字＋大头像"], ["mosign", "封面下方的签名那一行"], ["moprofilepost", "个人页里的一条动态整块"]])}),
    Object.freeze({zh:"日历",pages:Object.freeze(["calendar"]),hooks:Object.freeze([["calpage", "日历整页外壳"],["calmonth", "月视图"],["calmonthbar", "月份那一行（左右翻页）"],["calmonthtitle", "月份大字"],["calbtn", "日历里的按钮（data-part: prevmonth/nextmonth/period/today/edit/delete/delseq/delday/gen/formback/formsave/formdelete）"],["calkey", "经期图例那一行"],["calkeyitem", "一个图例（data-part: period/fertile/ov/safe）"],["caldow", "星期表头"],["calgrid", "月历格子区"],["calday", "月历上的一天（data-today, data-period）"],["caldaynum", "日期数字圈"],["caldaylunar", "农历小字"],["caldaydots", "事件小圆点"],["calweek", "日视图整块"],["calweekday", "日视图顶上那一周的某天（data-on）"],["caltznote", "时差说明"],["caldayhead", "日视图某天的抬头（data-today）"],["caldayheadtitle", "抬头里的日期"],["calallday", "全天事件条"],["calcolumn", "某天的时间轴列"],["calhour", "时间刻度"],["calnowline", "现在那根红线"],["calnowtag", "现在时刻的小标签"],["calblock", "时间轴上的一个日程块（data-done）"],["calblocktitle", "日程块标题"],["calblocktime", "日程块时间/地点小字"],["calpeople", "看谁的日历那一排"],["calperson", "一个人的头像按钮（data-on）"],["calpersonname", "人名"],["calfab", "右下角加号"],["calfabmenu", "加号弹出的菜单"],["calfabitem", "菜单项（data-part: new/genweek/delweek/genmonth）"],["calevdetail", "日程详情"],["calevtitle", "详情标题"],["calevtime", "详情时间"],["calevdev", "偏离计划的说明框"],["calevmurmur", "那会儿的碎碎念"],["calvis", "谁能看我的日历"],["calsheettitle", "弹页标题"],["calvisrow", "可见性的一行（data-on）"],["calgen", "AI 生成本月"],["calinput", "输入框（data-part: genprompt/startdate/enddate/starttime/endtime/title/location）"],["calform", "新增/编辑日程表单"],["calformlabel", "表单小标签"],["calrepeat", "重复选项（data-on, data-part）"],["caliconpick", "图标选格（data-on）"],["calcolorpick", "颜色选点（data-on）"]])}),
    Object.freeze({zh:"一起听那张卡的背面",pages:Object.freeze(["musiccard"]),hooks:Object.freeze([["mcardpage", "唱片旁那一摞·整页"],["mcardtop", "照片预览+按钮那一块"],["mcardbtn", "按钮（data-part: photo/removephoto/removebg）"],["mcardinput", "输入（data-part: photofile/note/bgfile）"],["mcardsectitle", "分节标题"],["mcardhint", "说明小字"],["mcardgrounds", "卡片底的选格区"],["mcardground", "一个底（data-part=id/own, data-on）"],["mcardswatch", "底的色块"],["mcardgroundname", "底的名字"],["mcardinks", "浅字/深字那一排"],["mcardink", "字色选项（data-part, data-on）"]])}),
    Object.freeze({zh:"匿名问答",pages:Object.freeze(["anon"]),hooks:Object.freeze([["anonpage", "匿名主页外壳"],["anonbody", "滚动正文"],["anonintro", "开头说明"],["anonpool", "题库那张条"],["anonpooltitle", "题库剩几条"],["anonpoolnote", "题库说明"],["anonbtn", "按钮（data-part: brew/back/refresh/genbg/genmask/netizen/write/openbox/submit/delete/followup/top）"],["anongrid", "马甲卡片网格"],["anoncard", "一张马甲卡（data-part: me/char）"],["anoncardhead", "卡片上半色块"],["anoncardicon", "卡片小方图标"],["anoncardname", "马甲名"],["anoncardcount", "几则问答"],["anoncardbio", "简介"],["anoncardlatest", "最新一条"],["anonempty", "没人可问"],["anonboxpage", "某人的匿名箱整页"],["anonboxhead", "箱子顶栏"],["anonboxtitle", "顶栏标题"],["anonboxbody", "箱子滚动区"],["anonboxcover", "主页背景封面"],["anonboxid", "头像+名字那块"],["anonboxnamewrap", "名字外层"],["anonboxname", "网名"],["anonboxbgdesc", "背景描述"],["anonboxbiowrap", "简介外层"],["anonboxbio", "简介"],["anonguess", "Ta 在猜你是谁"],["anonmasklabel", "「你的马甲」小字"],["anonmaskname", "你的马甲名"],["anonmaskbio", "你的马甲简介"],["anonactions", "提问按钮那一行"],["anonpending", "箱里待答那块"],["anonnote", "说明小字"],["anonasker", "写问题那一栏"],["anonreplyto", "追问引用"],["anoninput", "问题输入框"],["anontabs", "全部/我问的/网友问的"],["anontab", "一枚筛选邮戳（data-part, data-on）"],["anonrow", "一条问答（data-from）"],["anonfrom", "谁问的标签"],["anontime", "时间"],["anonfollowsrc", "追问的出处"],["anonq", "问题"],["anona", "回答（data-part: pending/skip）"]])}),
    Object.freeze({zh:"我的匿名主页",pages:Object.freeze(["anonme"]),hooks:Object.freeze([["anmepage", "我的匿名箱整页"],["anmebody", "滚动正文"],["anmemask", "马甲卡"],["anmemaskhead", "马甲卡色块"],["anmemaskname", "马甲名"],["anmemaskbio", "马甲简介"],["anmenote", "说明小字"],["anmebtn", "按钮（data-part: genmask/ask/pick/drop/answer/reveal；pick 带 data-on）"],["anmeask", "邀人来问那块"],["anmepicks", "选人那一排"],["anmepick", "一个可选的人"],["anmelist", "问答列表"],["anmerow", "一条问答（data-answered）"],["anmemeta", "一条的抬头小字"],["anmeq", "问题"],["anmea", "我的回答"],["anmeinput", "回答输入框"],["anmeempty", "空状态"]])}),
    Object.freeze({zh:"关系",pages:Object.freeze(["ties"]),hooks:Object.freeze([["tiespage", "关系页最外层"],["tiesheadbtns", "关系页顶栏右侧按钮组"],["tieswalkentry", "顶栏「走一圈」按钮"],["tiesaddbtn", "顶栏＋新增关系按钮（主页与按条看页）"],["tiesfaces", "顶部一排人脸切换条"],["tiesface", "人脸切换条中的一张脸；data-on=1 当前选中"],["tiesfacename", "选中那张脸下方的名字"],["tiesmasks", "「我」页的面具筛子条"],["tiesmask", "面具筛子单项；data-on=1 当前选中"],["tiesempty", "空状态；data-part=page/board/net/detail 区分哪一处"],["tiesboard", "关系板画布（可拖拽缩放的区域）"],["tiesnet", "整网图画布"],["tiesnode", "板子/整网上一张人物节点的外壳"],["tiesphoto", "人物拍立得照片；data-on=1 被选中"],["tiesphotoname", "拍立得下方名字"],["tieslabel", "连线上的关系牌子；data-on=1 选中/点亮"],["tiesnetdot", "整网图连线中点的小圆点；data-on=1 选中"],["tiespanel", "选中一段关系后底部弹出的说明面板"],["tiespanelname", "面板标题（A → B）"],["tiespanelbtn", "面板按钮；data-part=edit 编辑 / walk 从这儿走 / close 收起"],["tiespanellabel", "面板里的关系名称"],["tiespanelnote", "面板里的关系描述"],["tiespanelback", "面板里「对方那头写的」一块"],["tieszoom", "右上角缩放按钮组"],["tieszoombtn", "缩放按钮；data-part=＋/－/⌖/⟲"],["tiesdetailentry", "底部「按条看 · 改配角简介」入口"],["tieswalkpage", "关系图（走一圈）整页"],["tieswalkbtn", "关系图顶栏按钮；data-part=net 全部/回到这个人（data-on=1 正在看整网）、exit 退出"],["tiestrail", "关系图路径面包屑条"],["tiestrailitem", "面包屑单项；data-on=1 当前所在"],["tiesdetailpage", "按条看详情页"],["tiesdetaillist", "详情页滚动区"],["tiesdetailcount", "详情页「N 段关系」计数"],["tiesrow", "详情页一条关系卡；data-part=npc 表示配角卡（带简介）"],["tiesrowarrow", "关系卡方向箭头"],["tiesrowlabel", "关系卡关系名称"],["tiesrownote", "关系卡描述"],["tiesrownpctag", "配角卡「只在群里出场」标签"],["tiesnpcdel", "配角卡「删除这个配角」按钮"],["tieschip", "关系卡里的人物头像+名字"],["tieschipname", "人物小片中的名字"],["tiescomphead", "新增/编辑关系弹层头部"],["tiescomptitle", "弹层标题"],["tiescompbtn", "弹层头部按钮；data-part=delete 删除 / save 保存"],["tiescomptabs", "弹层顶部三档切换（我和角色/角色之间/NPC）"],["tiesseg", "分段按钮（tab、方向、单向谁对谁）；data-part=选项值，data-on=1 选中"],["tiespickgrid", "选择角色网格"],["tiespick", "可选角色卡；data-on=1 已选"],["tiespickname", "可选角色卡名字"],["tiescomplabel", "关系名称输入框"],["tiespresets", "关系名称预设标签组"],["tiespreset", "预设标签；data-on=1 与当前名称相同"],["tiesdraftbtn", "「让 TA 写一版」按钮"],["tiesdraftwhy", "AI 起草依据说明"],["tiessplit", "「两个方向分别描述」开关；data-on=1 已开"],["tiescompdesc", "关系描述文本框"],["tiescompcount", "描述字数计数"],["tiesnpcmode", "NPC 生成/自己写 切换条"],["tiesnpcmodebtn", "NPC 模式按钮；data-part=gen/hand，data-on=1 选中"],["tiesnpcinput", "NPC 表单输入；data-part=name 名字 / rel 关系 / brief 简介 / ask 要生成谁 / knows 交情"],["tiesnpchint", "NPC 表单说明文字"],["tiesnpcsubmit", "NPC 提交按钮；data-part=add 加进来 / gen 生成"],["tiesnpclist", "身边已有配角列表"],["tiesnpcitem", "已有配角一行"],["tiesnpcname", "已有配角名字"],["tiesnpcknows", "「也认识我」切换；data-on=1 认识"],["tiesnpcitemdel", "已有配角删除按钮"]])}),
    Object.freeze({zh:"购物",pages:Object.freeze(["shop"]),hooks:Object.freeze([["shoppage", "购物 App 最外层"],["shophome", "首页视图"],["shopcats", "品类横向 tab 条"],["shopcat", "品类 tab；data-on=1 当前品类"],["shopcatname", "品类 tab 文字"],["shopcatbar", "选中品类下划线"],["shopgridscroll", "首页商品滚动区"],["shopgrid", "商品双列网格"],["shopcard", "商品卡"],["shopcardtag", "商品图位上的品类标"],["shopcardbody", "商品卡文字区"],["shopcardname", "商品名"],["shopcarddesc", "商品卖点标签"],["shopcardprice", "商品价格"],["shopcardsales", "商品销量"],["shopcardadd", "商品卡＋加购按钮"],["shopwishbtn", "想要（爱心）按钮；data-part=card/row/detail 所在位置，data-on=1 已想要"],["shopgenbtn", "刷商品按钮；data-part=empty 空态按钮 / more 继续看"],["shopempty", "空状态；data-part=home/cart/shipping/receiving/inventory/group/spot"],["shopcart", "购物车视图"],["shopcartlist", "购物车列表滚动区"],["shopcartrow", "购物车一行"],["shopcartcheck", "购物车行勾选圈"],["shopcartthumb", "购物车行缩略图"],["shopcartname", "购物车行商品名"],["shopcartprice", "购物车行价格"],["shopcartdel", "购物车行删除"],["shopcartbar", "购物车底部结算栏"],["shopcartall", "全选按钮；data-on=1 已全选"],["shopcarttotal", "合计金额"],["shopcheckout", "结算按钮"],["shopmy", "「我的」视图"],["shopmylist", "「我的」滚动区"],["shopsection", "分区标题；data-part=shipping/receiving/wish/inventory"],["shoporder", "订单卡；data-part=shipping 待发货 / receiving 待收货"],["shopordername", "订单商品名"],["shopordermeta", "订单副信息（价格/付款方式/送达）"],["shoporderleft", "待发货剩余时间"],["shoporderprice", "待收货价格"],["shoporderbtn", "订单按钮；data-part=use 收下 / regift 转赠"],["shopwishrow", "想要清单一行"],["shopwishthumb", "想要行色块"],["shopwishname", "想要行名称"],["shopwishprice", "想要行价格"],["shopinvgroup", "我的物品一组（按来源）"],["shopinvgrouphead", "物品组标题行"],["shopinvdreamy", "梦中物品说明文字（列表与操作面板）"],["shopinvgrid", "物品三列网格"],["shopinvtile", "物品格；data-on=1 带在身上"],["shopinvthumb", "物品格色块"],["shopinvqty", "物品数量角标"],["shopinvonme", "「带着」角标"],["shopinvname", "物品名"],["shopinvtime", "入库时间"],["shopinvtitle", "物品操作面板标题"],["shopinvact", "物品操作面板一个动作行"],["shopinvactname", "动作名"],["shopinvactsub", "动作说明"],["shopdetailmask", "商品详情遮罩"],["shopdetail", "商品详情面板"],["shopdetailhero", "详情大图位"],["shopdetailclose", "详情关闭按钮"],["shopdetailprice", "详情价格"],["shopdetailsales", "详情销量"],["shopdetailname", "详情商品名"],["shopdetaildesc", "详情卖点标签"],["shopdetailnote", "详情说明文字"],["shopask", "「拿给TA看看」区块"],["shopaskbtn", "「拿给TA看看」按钮"],["shopasklabel", "「拿给谁看」标题"],["shopaskchar", "可选角色胶囊"],["shopdetailbar", "详情底部按钮栏"],["shopdetailbtn", "详情按钮；data-part=cart 加入购物车 / buy 去结算"],["shopnav", "底部导航栏"],["shopnavtab", "底部导航项；data-part=home/cart/my，data-on=1 当前"],["shopnavlabel", "导航项文字"],["shopnavbadge", "导航角标；data-part=cart 数量 / my 红点"],["shopsheetbtn", "结算方式大按钮；data-on=1 主按钮（余额购买）"],["shopsheethint", "群送礼弹层说明"],["shoppickrow", "选人行；data-part=char/group/member/kinship/spot/regift"],["shoppickname", "选人行名字"],["shopkinleft", "亲属卡剩余额度"]])}),
    Object.freeze({zh:"外卖",pages:Object.freeze(["takeout"]),hooks:Object.freeze([["tkopage", "外卖 App 最外层"],["tkonear", "附近视图"],["tkoslots", "饭点标尺条"],["tkoslot", "饭点格；data-on=1 当前选中"],["tkoslotname", "饭点名"],["tkoslottime", "饭点时段"],["tkoslotbar", "饭点下方刻度条"],["tkoslotnow", "「现在」圆点"],["tkoshoplist", "店铺列表滚动区"],["tkoempty", "空状态；data-part=near/targets/riding/arrived/log"],["tkogenbtn", "空态刷新店铺按钮"],["tkoshopcard", "店铺卡"],["tkoshopcardword", "店铺卡色块上的字"],["tkoshopcardname", "店铺名"],["tkoshopcardmeta", "店铺时效/起送价行"],["tkoshopcarddishes", "店铺卡菜品标签组"],["tkoshopcarddish", "店铺卡菜品标签"],["tkotag", "通用小标签（品类/菜品描述）"],["tkoshoppage", "店铺页"],["tkoshopscroll", "店铺页滚动区"],["tkoshophead", "店铺页头图文字区"],["tkoshopname", "店铺页店名"],["tkoshopchip", "店铺页胶囊；data-part=kind 品类 / eta 时效"],["tkodishes", "菜品列表"],["tkodish", "菜品卡；data-on=1 已点"],["tkodishword", "菜品色块上的字"],["tkodishname", "菜品名"],["tkodishdesc", "菜品描述容器"],["tkodishqty", "已点份数"],["tkoqtybtn", "加减份数；data-part=plus/minus"],["tkobagbar", "底部购物袋结算栏"],["tkobagicon", "购物袋图标；data-on=1 有东西"],["tkobagcount", "购物袋数量角标"],["tkobagtotal", "购物袋金额/还没点"],["tkobageta", "购物袋送达时间"],["tkobagpay", "去结算按钮；data-on=1 可点"],["tkopaypage", "付款页"],["tkopayscroll", "付款页滚动区"],["tkoreceipt", "小票整体"],["tkoreceiptbody", "小票正文"],["tkoreceiptshop", "小票店名"],["tkoreceipteta", "小票送达时间"],["tkoreceiptline", "小票一行菜品"],["tkoreceipttotal", "小票合计行"],["tkoremark", "给店家的备注输入框"],["tkoreceiptedge", "小票锯齿边"],["tkosection", "分区标题"],["tkopaymode", "付款方式卡；data-part=buy/paylater/kinship/forchar，data-on=1 展开"],["tkopaymodebtn", "付款方式卡按钮"],["tkopaymodename", "付款方式名"],["tkopaymodesub", "付款方式说明"],["tkopaygo", "「付款」胶囊"],["tkopaytargets", "展开后的选人区"],["tkosay", "给TA点单时的留言输入框"],["tkopickrow", "选人行；data-part=group 表示群"],["tkopickname", "选人行名字"],["tkopickextra", "选人行附加信息（额度等）"],["tkoorders", "订单视图"],["tkoorderlist", "订单滚动区"],["tkoorder", "订单卡"],["tkoordershop", "订单店名"],["tkoorderprice", "订单价格"],["tkoorderitems", "订单菜品"],["tkoorderpay", "订单付款方式"],["tkoremarktext", "订单备注文字"],["tkonote", "TA写在单子上的话"],["tkoride", "骑手在路上区块"],["tkoridetime", "剩余时间"],["tkoridebar", "配送进度条"],["tkoarrived", "已送达行"],["tkoarrivedtext", "已送达文字"],["tkoeatbtn", "「吃掉」按钮"],["tkolog", "吃过的列表卡"],["tkologrow", "吃过的一条；data-on=1 已展开"],["tkologname", "吃过的名称"],["tkologtime", "吃过的日期"],["tkologitems", "展开后的菜品"],["tkologmeta", "展开后的价格/时间"],["tkonav", "底部导航栏"],["tkonavtab", "导航项；data-part=near/orders，data-on=1 当前"],["tkonavlabel", "导航项文字"],["tkonavbadge", "订单红点"]])}),
    Object.freeze({zh:"随身物",pages:Object.freeze(["carry"]),hooks:Object.freeze([["carrypage", "随身物主页最外层；data-part=empty 无角色 / box 选人柜"],["carryboxframe", "选人柜外框"],["carryboxlist", "选人柜内滚动区"],["carryboxchar", "选人柜里的角色"],["carryboxcharname", "选人柜角色名"],["carrydoor", "柜门；data-part=left/right，data-on=1 已拉开"],["carryboxhint", "柜门下方提示"],["carrymine", "顶栏右侧「我的物品」，进购物「我的」页"],["carryregen", "重新翻按钮；data-part=page 主页 / all 全部页 / section 单栏页"],["carrycabinet", "主页柜子区"],["carrycabinetbody", "柜身"],["carrywho", "柜顶当前角色/换人按钮"],["carrywhoname", "当前角色名"],["carrywhoswitch", "「换个人」文字"],["carrydrawers", "抽屉列"],["carrydrawer", "抽屉；data-part=栏目key，data-on=1 有新内容"],["carrydrawername", "抽屉名"],["carrydrawercount", "抽屉件数"],["carrydrawernew", "抽屉新内容红点"],["carrydrawerswatches", "抽屉色块预览"],["carrydrawernames", "抽屉内物品名预览"],["carrypickrow", "切换角色弹层一行"],["carrypickname", "切换角色名字"],["carryallpage", "一次看全部页"],["carrytabs", "全部页栏目跳转条"],["carrytab", "栏目跳转签；data-part=栏目key"],["carrytabname", "栏目签文字"],["carryallscroll", "全部页滚动区"],["carryallsec", "全部页一栏；data-part=栏目key"],["carryallsechead", "一栏标题行"],["carryallsecname", "一栏标题"],["carrysecpage", "单栏页；data-part=栏目key"],["carrysecscroll", "单栏页滚动区"],["carryempty", "空状态；data-part=gifts/closet/stuff/list/chars"],["carrysectionnote", "栏内小眉标"],["carrypin", "钉住◆标记"],["carrygiftbox", "礼物栏底盒"],["carrygiftgroup", "礼物按月一组"],["carrygiftgrouphead", "礼物组标题行"],["carrygiftgroupname", "礼物组月份"],["carrygift", "礼物一行"],["carrygiftthumb", "礼盒图"],["carrygiftname", "礼物名"],["carrygifttime", "礼物收到时间"],["carrycloset", "衣柜栏整体"],["carryoccasion", "衣柜一个场合"],["carryoccasionname", "场合名"],["carryoccasioncount", "场合套数"],["carrybay", "挂杆格"],["carryhanger", "挂着的一身；data-on=1 已钉住"],["carryhangername", "衣服名"],["carryhangernote", "衣服说明"],["carrymorebtn", "「再添几身」按钮"],["carrystuff", "物件栏整体"],["carrystuffbox", "物件底盒"],["carrycard", "物件卡；data-on=1 已钉住"],["carrycardname", "物件名"],["carrycardnote", "物件说明"],["carryrow", "列表式一行；data-on=1 已钉住"],["carryrowname", "列表行名称"],["carryrownote", "列表行说明"],["carrycasemask", "物件详情遮罩"],["carrycase", "物件详情柜框"],["carrycaseinner", "柜框内层"],["carrysheettitle", "详情标题"],["carrysheetnote", "详情说明"],["carrysheetlabel", "详情小标签；data-part=en/zh"],["carrythink", "TA的想法区"],["carrythinklabel", "想法标题"],["carrythinktext", "想法正文"],["carrysheetactions", "详情操作区"],["carrysheetbtn", "详情按钮；data-part=pin 钉住（data-on=1 已钉）/ peek 摆到他面前 / delete 删掉"],["carrysheethint", "操作说明"],["carrygiftmeta", "礼物详情收到日期"],["carrygiftbtn", "礼物详情按钮；data-part=think 让TA说说 / closet 挂进衣柜 / peek 聊天里提起"],["carrygiftcloset", "挂进衣柜区"],["carrygifthint", "挂进衣柜提示"],["carrygiftocc", "场合选择按钮"],["carrygiftpeek", "聊天里提起区"]])}),
    Object.freeze({zh:"我的衣柜",pages:Object.freeze(["mycloset"]),hooks:Object.freeze([["closetpage", "我的衣柜最外层"],["closetaddtoggle", "顶栏自己挂一身按钮；data-on=1 表单已展开"],["closetrail", "顶部挂衣杆"],["closetscroll", "滚动区"],["closetintro", "说明文字"],["closetgen", "生成卡片"],["closetgeninput", "关键词输入"],["closetgenbtn", "配四身按钮；data-on=1 生成中"],["closetgenhint", "生成说明"],["closetadd", "手动添加表单"],["closetaddinput", "添加表单输入；data-part=occasion/name/note"],["closetaddbtn", "挂进去按钮"],["closetlist", "衣柜列表"],["closetcount", "总件数"],["closetgroup", "场合分组"],["closetgrouphead", "分组标题行"],["closetgroupbar", "分组色条"],["closetgroupname", "场合名"],["closetset", "一身衣服卡"],["closetsetname", "衣服名"],["closetsetdrop", "拿掉按钮"],["closetsetnote", "衣服描述"],["closetempty", "空衣柜状态"]])}),
    Object.freeze({zh:"亲属卡账单",pages:Object.freeze(["kincard"]),hooks:Object.freeze([["kinbillpage", "亲属卡账单页最外层；data-part=empty 卡片不存在"],["kinbillscroll", "滚动区"],["kinbillface", "卡面容器"],["kinbillraise", "申请加额度区"],["kinbillraisebtn", "申请加额度按钮"],["kinbillraiseform", "加额度表单"],["kinbillraisehint", "加额度说明"],["kinbillraiseinput", "金额输入"],["kinbillraisego", "表单按钮；data-part=send 发送 / cancel 取消"],["kinbillledger", "账单区"],["kinbilltitle", "「刷卡账单」标题"],["kinbillempty", "无账单状态"],["kinbillrow", "账单一行"],["kinbillrowname", "账单项目名"],["kinbillrowtime", "账单时间"],["kinbillrowamount", "账单金额"],["kinbillquit", "解绑区"],["kinbillquitbtn", "解绑入口按钮"],["kinbillquitform", "解绑表单"],["kinbillquithint", "解绑说明"],["kinbillquitinput", "留言输入"],["kinbillquitgo", "解绑按钮；data-part=confirm 确认 / cancel 再想想"]])}),
    Object.freeze({zh:"给TA的亲属卡",pages:Object.freeze(["mykin"]),hooks:Object.freeze([["mykinpage", "我给TA的亲属卡页最外层（选人/开卡/管理三态共用）"],["mykinscroll", "滚动区"],["mykinlabel", "小节标题"],["mykinpicks", "选人网格"],["mykinpick", "可选角色；data-on=1 已开过卡"],["mykinpickname", "角色名"],["mykinpickhas", "「已开」标记"],["mykinface", "卡面容器；data-part=new 开卡预览 / issued 已开卡（data-on=1 冻结中）"],["mykininput", "输入框（额度/留言/新额度）"],["mykindaily", "「平时花钱也能刷」开关行"],["mykindailyname", "开关标题"],["mykindailysub", "开关说明"],["mykingo", "递卡按钮容器"],["mykinbtn", "操作按钮；data-part=按钮文字，data-on=1 主按钮"],["mykinfrozen", "冻结中提示"],["mykinactions", "冻结/平时刷/收回按钮组"],["mykinlimit", "调额度行"],["mykinrow", "账单一行"],["mykinrowname", "账单项目"],["mykinrowtime", "账单时间与来源"],["mykinrowamount", "账单金额"],["mykinrowask", "账单行「问问」按钮"],["mykinempty", "无账单状态"]])}),
    Object.freeze({zh:"收藏",pages:Object.freeze(["favorites"]),hooks:Object.freeze([["favpage", "收藏首页最外层"],["favlist", "首页滚动区"],["favstack", "一摞（某角色的收藏）"],["favstackbtn", "一摞的点击卡"],["favstackname", "角色名"],["favstackcount", "剪下张数"],["favdetailpage", "某角色收藏详情页"],["favdetaillist", "详情滚动区"],["favcard", "一张剪报；data-part=me 我说的 / char 角色说的"],["favcardhead", "剪报头部行"],["favcardmeta", "说话人与时间"],["favdelbtn", "「揭下来」按钮"],["favsticker", "表情图"],["favvoicehead", "语音头部（时长+播放）"],["favtext", "剪报正文；data-part=text/voice/photo"]])}),
    Object.freeze({zh:"表情包",pages:Object.freeze(["emotes"]),hooks:Object.freeze([["emopage", "表情包页最外层"],["emoscroll", "滚动区"],["emonote", "小节标题行"],["emonotetext", "小节标题文字"],["emoaddpack", "「新开一版」按钮"],["emopacks", "版面横向列表"],["emopack", "一版；data-on=1 当前选中"],["emopackcover", "版面封面"],["emopackname", "版面名"],["emoempty", "空状态；data-part=packs 无版 / emotes 版内无图"],["emopacktitle", "版名输入框"],["emoswitchrow", "开关行；data-part=global 谁都能用 / mine 我自己也能发"],["emoswitchname", "开关标题"],["emoswitchsub", "开关说明"],["emoswitch", "开关；data-part=global/mine，data-on=1 开"],["emochars", "绑定角色组"],["emochar", "角色姓名贴；data-on=1 已绑定"],["emoglobalhint", "谁都能用时的提示"],["emotools", "表情网格右上工具组"],["emotoolbtn", "工具按钮；data-part=cover 设成封面 / select 挑几张（data-on=1 挑选中）"],["emogrid", "表情网格"],["emotile", "表情格；data-on=1 被挑中"],["emotilecard", "表情格卡片"],["emotilecover", "封面角标"],["emotilecheck", "挑中勾"],["emotilename", "表情关键词"],["emodelsel", "删除所选按钮"],["emohelp", "导入格式说明框"],["emofilebtn", "选文件按钮；data-part=list 清单文件 / images 相册图片"],["emofilehint", "选文件说明"],["emostaged", "待上传图片区"],["emostagedhint", "待上传说明"],["emostagedtile", "待上传一张"],["emostageddrop", "待上传移除按钮"],["emostagedinput", "待上传关键词输入"],["emostagedbtn", "待上传按钮；data-part=clear 清空 / save 贴上"],["emoimporttext", "清单粘贴文本框"],["emoimportbtn", "导入按钮"],["emodelpack", "撕掉这一版按钮"]])}),
    Object.freeze({zh:"直播",pages:Object.freeze(["live"]),hooks:Object.freeze([["livepage", "直播首页整页"],["liveonair", "首页「正在播」的一条直播"],["liveonairtitle", "正在播那条的标题（谁在播什么）"],["liveonairtime", "正在播那条已播时长"],["livejoin", "进直播间按钮；data-part=me 本号进 / mask 马甲进"],["livedoor", "首页大入口卡（看直播／自己开播）"],["livedoortitle", "大入口卡标题"],["liveempty", "没有角色时的空状态"],["liveselfcfg", "「角色自己开播」开关按钮"],["livereplay", "回放列表的一行"],["livereplaytitle", "回放标题"],["livereplaytime", "回放时间/信息行"],["livereplaydel", "删回放按钮"],["livemissed", "「错过的」那一行（TA 播了你没去）"],["liverecap", "「看高光」按钮"],["liveinvitebtn", "路人主播直播间里「叫 TA 一起看」按钮"],["liveinvite", "点开后挑人那一排"],["liverank", "直播首页「本周礼物榜」那一块"],["liverankrow", "礼物榜的一行"],["livesetup", "开播/看播设置页整页"],["livelabel", "设置页各段小标题"],["livechip", "设置页选项胶囊；data-on=1 选中"],["livecharlist", "选角色那一排的容器"],["livecharpick", "选角色头像按钮；data-on=1 已选"],["livecharname", "选角色头像下的名字"],["livefield", "设置页输入框；data-part=title 标题 / topic 话题"],["livestart", "开始直播按钮"],["liveroom", "直播间整页"],["liveshare", "直播间右上「分享」按钮"],["livestage", "直播间顶上浮着的主播信息条"],["livestagetitle", "画面区左上直播间名"],["livestagesub", "画面区左上副行（在播/已下播）"],["livehostline", "画面区主播最新一句"],["livepk", "PK 进度条区"],["livefanbar", "粉丝团/榜一/房管信息条"],["liveitem", "带货商品条"],["livebuy", "商品条「买」按钮"],["livemsglist", "弹幕/消息滚动区"],["livemsg", "一条弹幕；data-kind=gift/enter/event/private/reg/host/me/rival 等类型，data-me=1 是你发的"],["livemsgname", "弹幕前的发送者名字"],["liveban", "弹幕旁「禁言」按钮"],["livebusy", "正在回复的占位提示"],["livecompose", "底部输入区"],["livesonglist", "点歌列表浮层"],["livesong", "点歌列表里的一首"],["liveselfpick", "「TA 们会自己开播」下面挑人那一排"],["liveselfchip", "挑谁会自己开播的一个人；data-on=1 会播"],["liveautodot", "自动往下播开着时 ⋯ 上的小红点"],["livevoicepick", "进直播间前「开声音」那一行；data-on=1 开"],["livevoicebtn", "直播间 ⋯ 里「声音」开关；data-on=1 开着"],["livebg", "直播间画出来的那张底图"],["livedrawbtn", "⋯ 里「画出来」"],["livemid", "全屏直播间中间那块（镜头、动作，字多了能滚）"],["livecapcard", "全屏直播间中间偏下那张字幕卡"],["livegiftbanner", "从左边滑出来的礼物横幅"],["livemorebtn", "底栏「⋯」按钮；data-on=1 打开"],["livemoreitem", "⋯ 菜单里的一项"],["livemoremenu", "⋯ 菜单（连麦、叫 TA 一起看、点歌）"],["livelinkbtn", "连麦按钮；data-on=1 连麦中（点了断开）"],["liveautobtn", "直播间「自动往下播」开关（data-on=\"1\" 开着）"],["liveautosec", "自动往下播旁边那个「N 秒」"],["liveautoslider", "点「N 秒」才弹出来的那根拉条"],["livestrangers", "直播首页「路人主播」那一块"],["livebrowse", "「随便逛逛」按钮"],["livestcard", "路人主播的一张卡（刷到的、关注的）"],["livestpage", "路人主播的主页"],["livestfollow", "主页上的关注按钮"],["livesttie", "主页上「用自己的号／用马甲」那一格交情"],["livestbtn", "私信、申请加好友按钮"],["livestdm", "跟路人主播的私信页"],["livestlv", "路人主播主页上名字旁边的小数字等级"],["livestclub", "主页上展开那行粉丝团（团名 · 这一级叫什么）"],["livestclubroll", "「让他重新起名」"],["livetitle", "直播间标题那一行（顶栏下面，点一下展开全文）"],["livescene", "画面上「镜头里的样子」那行（变了才换）"],["liveact", "画面上「此刻在干嘛」那行（每一拍换）"],["livecapdots", "字幕下面那排小点（这一拍几句、放到第几句）"],["livesongbtn", "点歌按钮"],["livegiftbtn", "打开礼物面板按钮"],["liveinput", "发弹幕输入框"],["livesend", "发送按钮"],["livegiftpanel", "礼物面板"],["livegift", "礼物格；data-on=1 选中"],["livegiftdel", "自定义礼物的删除叉"],["livegiftmake", "「自定义」礼物格；data-on=1 正在自定义"],["livegiftform", "自定义礼物表单行"],["livegiftinput", "自定义礼物输入；data-part=name 名称 / amount 金额"],["livegiftkeep", "「留着下次用」切换；data-on=1 留"],["livegiftsend", "送出礼物按钮"],["livedanmaku", "背景飘屏弹幕层"],["liveshareview", "分享到聊天的选择页"],["livesharelist", "分享页角色列表容器"],["livesharechar", "分享页角色头像按钮"],["livesharerow", "分享页聊天/群房间行"],["livecard", "聊天里的直播回放卡片"],["livecardtitle", "回放卡片标题"],["livecardline", "回放卡片里的一条弹幕"]])}),
    Object.freeze({zh:"片刻",pages:Object.freeze(["shua"]),hooks:Object.freeze([["shuapage", "刷刷整页外壳"],["shuatabbar", "底部导航栏"],["shuatab", "底部导航按钮；data-on=1 当前页"],["shuapostfab", "底栏中间「发一条」按钮"],["shuafeedtab", "首页「关注/推荐/同城」页签；data-on=1 当前"],["shuacity", "同城城市选择；data-on=1 当前城市"],["shuarefreshbtn", "刷新/换一批按钮"],["shuafeed", "竖屏视频流滚动区"],["shuagrid", "横屏双列视频网格"],["shuaempty", "各处空状态"],["shuavcard", "竖屏一条视频卡"],["shuascene", "无图时的画面文字描述"],["shuarailbtn", "竖屏右侧操作按钮（赞/评/藏/分享等）；data-on=1 已点亮"],["shuaauthorbtn", "作者头像/作者按钮"],["shuamorebtn", "「更多」按钮"],["shuamoremenu", "更多菜单浮层"],["shuamoreitem", "更多菜单项；data-part=draw 出图 / del 删除"],["shuacaption", "竖屏卡底部文案区"],["shuaauthor", "竖屏卡作者名"],["shuacmtpage", "评论页整页"],["shuacmt", "一条评论；data-me=1 你写的"],["shuacmtname", "评论者名字"],["shuacmttext", "评论正文"],["shuacompose", "底部输入区"],["shuainput", "评论/弹幕输入框"],["shuasend", "发送按钮"],["shuarefresh", "「刷新」页整页"],["shuabig", "刷新页大按钮"],["shuabigtitle", "大按钮标题"],["shuacharpick", "选角色头像；data-on=1 已选"],["shuacharname", "选角色头像下名字"],["shuarealfriends", "「认识TA的人来评」勾选；data-on=1 开"],["shuapost", "发视频页整页"],["shuasameref", "拍同款时的原视频引用框"],["shualivedoor", "发布页「开直播」入口"],["shuafield", "发布页多行输入"],["shuachip", "「画面里有没有你」选项；data-on=1 选中"],["shuawithpick", "同框角色头像；data-on=1 选中"],["shuapostbtn", "发布按钮"],["shuabcard", "横屏视频卡"],["shuabcardtitle", "横屏卡标题"],["shuabcardsub", "横屏卡作者/信息行"],["shuacharge", "充电面板一个档位"],["shuachargegrid", "充电档位网格"],["shuachargeinput", "自定义充电金额输入"],["shuachargebtn", "自定义充电确认"],["shuabdetail", "横屏视频详情页整页"],["shuabinfo", "详情页信息卡"],["shuabtitle", "详情页标题"],["shuatag", "话题标签"],["shuaactbar", "详情页操作按钮行"],["shuaact", "详情页操作按钮；data-on=1 已点亮"],["shuabcmts", "详情页评论区"],["shuareply", "评论下的回复；data-me=1 你写的"],["shuareplybtn", "「回复」按钮"],["shuadmtoggle", "弹幕/评论切换；data-on=1 弹幕模式"],["shuahot", "热门话题条"],["shuahotchip", "热门话题；data-on=1 当前筛选"],["shuaprofile", "作者主页整页"],["shuaprofilehead", "主页头部（头像+数据）"],["shuabio", "主页简介"],["shuatile", "作品网格的一格"],["shuasharepage", "分享到聊天页"],["shuasharerow", "分享页聊天/房间行"],["shuasharechar", "分享页角色头像按钮"],["shuaseriesfollow", "横着看详情页系列旁「追更」按钮；data-on=1 已追更"],["shuamaskrow", "「我」页「用哪张面具发」那一排"],["shuamask", "挑面具的一颗；data-on=1 现在用的"],["shuatogether", "分享页「拉 TA 一起看」开关；data-on=1 开"],["shuafavs", "收藏视频流页"],["shuamine", "我的作品视频流页"],["shualive", "直播页签容器"],["shuafavpage", "收藏夹整页"],["shuafolderbar", "文件夹横排"],["shuafolder", "文件夹签；data-on=1 打开中"],["shuafoldername", "文件夹名字"],["shuafolderinput", "新建文件夹名输入"],["shuafolderok", "新建文件夹确认"],["shuafavitem", "收藏夹里的一条"],["shuamsgpage", "消息页整页"],["shuanote", "一条通知；data-on=1 未读"],["shuanotetext", "通知正文"],["shuanotetime", "通知时间"],["shuanotevid", "消息那一条底下「是哪条视频」，点进去就是那条"],["shuaone", "从消息点进来的那一条视频整页"],["shuamepage", "「我」页整页"],["shuahandle", "账号名输入；data-part=alt 小号名"],["shuacprow", "情侣号一行"],["shuaskinrow", "「首页样子」设置行"],["shuaskin", "竖着刷/横着看切换；data-on=1 当前"],["shuaworks", "我的作品网格"],["shuashare", "聊天里的视频分享卡"],["shuashareauthor", "分享卡作者名"]])}),
    Object.freeze({zh:"梦境",pages:Object.freeze(["dream"]),hooks:Object.freeze([["drmpage", "入梦首页整页"],["drmnewbtn", "「新入一场梦」按钮"],["drmloops", "「TA昨晚真做的梦」区"],["drmloop", "一场可推门的梦"],["drmlooptitle", "梦标题行"],["drmloopsub", "梦副行"],["drmempty", "没有存档的空状态"],["drmsave", "一条梦存档卡"],["drmsavemark", "存档状态标记"],["drmsavetitle", "存档标题"],["drmsavesub", "存档副行"],["drmsetup", "入梦设置页整页"],["drmlabel", "设置页小标题"],["drmcharpick", "选人按钮；data-part=dreamer 做梦的人 / guest 梦里的客人，data-on=1 已选"],["drminject", "「注入最近聊天」开关行；data-on=1 开"],["drmkeyword", "三个关键词输入框"],["drmstartbar", "底部开始栏"],["drmstartbtn", "开始入梦按钮"],["drmkeep", "醒来带出的物件卡"],["drmkeepname", "物件名"],["drmkeepbtn", "带走按钮"],["drmplay", "梦境进行页整页"],["drmfeed", "梦境滚动区"],["drmrecur", "复现梦的提示"],["drmscene", "一幕"],["drmscenetext", "一幕正文"],["drmchosen", "「你选择了」那块"],["drmrewind", "回到这一幕按钮"],["drmcontrols", "底部选项区"],["drmwaiting", "正在生成的提示"],["drmoption", "一个选项按钮"],["drmretry", "重试按钮"],["drmwakebtn", "醒来按钮"],["drmending", "结局块；data-part=good 好梦 / true 直梦 / bad 噩梦 / woke 主动醒来"],["drmendmark", "结局落款"],["drmagain", "重回某一幕按钮"]])}),
    Object.freeze({zh:"解梦馆",pages:Object.freeze(["dreamjournal"]),hooks:Object.freeze([["djpage", "梦境日记整页"],["djtabs", "页签行"],["djtab", "页签；data-on=1 当前"],["djmotifbtn", "右上「常客」按钮；data-on=1 展开"],["djmotifs", "潜意识常客面板"],["djmotif", "母题小签"],["djmic", "语音输入按钮；data-on=1 录音中"],["djcompose", "记梦卡"],["djinput", "记梦输入框"],["djaddbtn", "记录按钮；data-part=dream 梦 / fragment 碎片 / none 没做梦"],["djday", "日期分组标题"],["djentry", "一条梦记录卡"],["djkind", "记录类型小签"],["djtext", "梦正文"],["djexpand", "展开/收起解读"],["djinterpretbtn", "「请人解」按钮；data-on=1 选人中"],["djcharpick", "选解梦角色按钮"],["djreading", "一条解读"],["djreadingname", "解读者名字"],["djreadingtext", "解读正文"],["djreadingsign", "解读里的征兆"],["djdel", "删除按钮"],["djempty", "空状态"],["djsign", "征兆页一张征兆卡"],["djsigntitle", "征兆标题"],["djnight", "「TA们的梦」按夜分组标题"],["djtheir", "TA的一场梦卡"],["djcharname", "做梦者名字"],["djenter", "进梦按钮"],["djgenerate", "生成梦按钮"],["djwakeline", "醒来那句"]])}),
    Object.freeze({zh:"塔罗",pages:Object.freeze(["tarot"]),hooks:Object.freeze([["tarotpage", "塔罗首页整页"],["tarotsky", "首页星空（玩法入口）"],["tarotsearch", "历史搜索框"],["tarotclear", "清空搜索"],["tarotchips", "历史筛选签行"],["tarotchip", "历史筛选签；data-on=1 当前"],["tarotgroup", "按类分组"],["tarothist", "一条历史记录"],["tarothisttitle", "历史标题行"],["tarothistsub", "历史副行"],["tarotmore", "展开更多"],["tarotempty", "空状态"],["tarotsetup", "起卦设置页整页"],["tarotblurb", "玩法说明"],["tarotdailyall", "「全部角色都解读」开关；data-on=1 开"],["tarotcharpick", "选角色；data-on=1 已选"],["tarotspreadgroup", "牌阵分组；data-on=1 当前"],["tarotspread", "牌阵格；data-on=1 选中"],["tarotspreadnew", "「自定义牌阵」按钮"],["tarotspreadedit", "自定义牌阵编辑框"],["tarotspreadsave", "保存牌阵"],["tarotowner", "谁来问；data-on=1 选中"],["tarotinput", "输入框；data-part=spreadname/positions/question/choice/followup"],["tarotgate", "角色答应/拒绝提示"],["tarotbar", "底部固定按钮栏"],["tarotgo", "开始按钮"],["tarotbusy", "生成中整页"],["tarotdeal", "洗牌抽牌页"],["tarotshuffle", "重新洗牌"],["tarotslot", "牌位格"],["tarotback", "牌背"],["tarotpending", "当前选中提示"],["tarotconfirm", "确认这张"],["tarotfinish", "抽完翻牌"],["tarotresult", "解读结果页"],["tarotforward", "转发到聊天按钮"],["tarotspreadrow", "摊开的牌行"],["tarotcard", "一张牌"],["tarotcardbtn", "牌面按钮；data-on=0 背面朝上"],["tarotcardname", "牌名"],["tarotcardmeaning", "牌义"],["tarotcardpos", "牌位名"],["tarotread", "逐张解读"],["tarotsupp", "补牌"],["tarotsuppbtn", "补一张按钮"],["tarotsummary", "总结卡"],["tarotthought", "角色心声"],["tarotfollow", "小桌边继续聊区"],["tarotbubble", "追问气泡；data-me=1 你问的"],["tarotsend", "追问发送"],["tarotdaily", "每日运势页"],["tarotentry", "一位角色的解读"],["tarotentrytext", "解读正文"],["tarotwhere", "转发去哪"],["tarotroom", "转发目标房间；data-on=1 选中"]])}),
    Object.freeze({zh:"陪伴",pages:Object.freeze(["companion"]),hooks:Object.freeze([["comppage", "陪伴页整页"],["compcharbar", "角色选择横排"],["compchip", "胶囊按钮（角色/表情/戳/语音选项）；data-on=1 选中"],["compempty", "没有角色的空状态"],["compstage", "小人舞台区"],["compbubble", "小人头顶对话气泡"],["compstatus", "加载/失败提示层"],["compretry", "重试按钮"],["comppanel", "下方设置面板"],["compmood", "心情说明文字"],["compfloat", "悬浮开关大按钮；data-on=1 正在悬浮"],["compfloatpet", "屏幕上的悬浮小人"],["compdrag", "悬浮小人拖动区"],["compresize", "悬浮小人缩放角"]])}),
    Object.freeze({zh:"小游戏",pages:Object.freeze(["games"]),hooks:Object.freeze([["gamepage", "小游戏柜整页"],["gameopen", "还摊在桌上的存档条"],["gameopentitle", "存档标题"],["gameopenbtn", "存档按钮；data-part=go 继续 / drop 收了"],["gameintro", "柜子说明"],["gameshelf", "一层架子"],["gamelid", "游戏盒"],["gamelidtitle", "游戏盒名"],["gamelidsub", "人数/说明"],["gamesetup", "开局设置页整页"],["gamedesc", "玩法卡"],["gameseg", "分段选择器"],["gamesegbtn", "分段按钮；data-on=1 选中"],["gametoggle", "开关行"],["gametogglelabel", "开关行标题"],["gameswitch", "开关；data-on=1 开"],["gamestepper", "加减器"],["gameunorule", "UNO 规则卡；data-on=1 选中"],["gamecharpick", "选角色行；data-on=1 已选"],["gamecharname", "角色名"],["gameempty", "空状态"],["gamegod", "神职签；data-on=1 选中"],["gamegodbtn", "神职按钮；data-part=random 随机 / clear 清空"],["gamewolfrole", "狼阵营选项；data-on=1 选中"],["gamestartbar", "底部开始栏"],["gamestart", "开始按钮"],["gamewip", "开发中页"],["gamewipback", "返回按钮"],["gameplay", "对局整页；data-part=spy/wolf/guess/td/monopoly/avalon/uno，data-kind=loading/error 加载/出错页"],["gameroster", "座位排；data-part=monopoly 大富翁那排"],["gameseat", "座位；data-on=1 高亮/轮到，data-dead=1 出局"],["gameavatar", "玩家头像"],["gamelog", "对局记录滚动区；data-part=游戏"],["gamelogline", "系统/投票/信息行；data-kind=行类型，data-me=1 你说的"],["gamemsg", "玩家发言行；data-kind=类型，data-me=1 你"],["gamemsgname", "发言者名字"],["gamebubble", "发言气泡；data-me=1 你，data-part=question 提问"],["gameverdict", "主持人判定"],["gamestar", "今晚之星卡"],["gamerole", "你的身份提示"],["gametarget", "选目标按钮；data-on=1 选中"],["gameactions", "底部操作区；data-part=游戏，UNO 另有 data-kind=chat/hand"],["gameinput", "输入框；data-part=clue/lastguess/speech/cheer/guess/question/ask/answer/chat/trade/votesay/talk"],["gamecheer", "台下插话行"],["gamecheersend", "插话发送"],["gamekeepmem", "存进记忆按钮；data-on=1 已存"],["gameunocard", "UNO 牌；data-on=1 手牌"],["gamehand", "UNO 手牌排"],["gamepicker", "选择弹窗遮罩"],["gamepickerbox", "选择弹窗"],["gamepickertitle", "弹窗标题"],["gamepickerclose", "弹窗关闭"],["gameplayercard", "玩家资料卡遮罩"],["gameplayerbox", "资料卡"],["gameplayername", "资料卡名字"],["gameplayerclose", "资料卡关闭"]])}),
    Object.freeze({zh:"小世界",pages:Object.freeze(["fairyGarden"]),hooks:Object.freeze([["cdaypage", "TA的一天整页"],["cdaybody", "挑人/日程/小家样式滚动区"],["cdaypick", "角色选择行"],["cdayscene", "日程场景区域"],["cdaynow", "当前日程纸卡"],["cdayrow", "日程时间轴；data-on=1 正在预览"],["cdaytools", "跟随/全景/日程底栏"],["cdaychatopen", "TA的一天主聊天入口"],["cdaychat", "覆盖场景下半部的主聊天窗"],["cdaychatbar", "主聊天窗标题与完整聊天/收起"],["cdayplaces", "新场景摆位试玩入口"],["cdayplacepoint", "动作位置选择；数字对应场景标号"],["cdayvisitopen", "TA在家时的进屋按钮"],["cdayvisitnote", "现场进屋/走动/坐下状态行"],["cdayhomestyle", "小家画面里的样式入口"],["cdaystyle", "小家样式选项；aria-pressed=true 正在用"],["cdaydecorate", "布置小家入口"],["cdaysavelayout", "顶栏保存小家布置"],["cdayeditnote", "装修操作和摆放结果提示"],["cdayfurniture", "选择家具；含已收纳物件"],["cdayedittools", "旋转/收纳/撤销/全景及装修子页返回底栏"],["cdaydecoractions", "添家具/配色/墙地面入口；data-part=catalog/piece/room"],["cdaydecorpanel", "装修整页子面板"],["cdaydecorbody", "家具库/配色/墙地面单滚动正文"],["cdaydecornotice", "装修子页操作结果提示"],["cdaycatalogitem", "家具目录卡；data-part=款式，含同模型预览"],["cdaypiecepick", "单件配色的家具选择"],["cdaypiececolors", "单件常用颜色选项"],["cdaypiececolor", "单件自选颜色"],["cdaymaterial", "单件材质选择"],["cdayusefurniture", "日程使用这件家具；aria-pressed=true 正在用"],["cdaywall", "墙面选择；data-part=款式"],["cdayfloor", "地板选择；data-part=款式"],["cdaywallcolor", "墙面自选颜色"],["cdayfloorcolor", "地板自选颜色"],["fgpage", "选世界/选档整页"],["fgbody", "选择页滚动区"],["fgworld", "世界入口；data-part=soon 即将开放"],["fgworldname", "世界名"],["fgsaves", "存档列表"],["fgsave", "一档存档"],["fgsavename", "存档名"],["fgsavesub", "存档副行"],["fgsavedel", "删档按钮"],["fgnewbtn", "新开一段按钮"],["fgcard", "选择卡按钮"],["fgpick", "挑同行者列表"],["fgpickrow", "同行者行"],["fgpickpage", "挑人整页"],["fgstalled", "卡住提示页"],["fggarden", "庭院整页"],["fghead", "庭院顶栏"],["fgpill", "顶栏胶囊；data-part=back/book/dress/chat/newroom，chat 的 data-on=1 聊天开"],["fgloading", "加载提示"],["fgbook", "花册层"],["fgbooktabs", "花册侧签列"],["fgbooktab", "花册侧签；data-on=1 当前"],["fgbookpage", "花册页；data-part=bond/invite/crew/bottle/museum/things/shards/notes"],["fgbondcard", "相处卡"],["fgguide", "带路开关；data-on=1 开"],["fgitem", "花册条目卡；data-part=kind/gift/food/crew/bottlewait/museum/work/thing/shard/cast/seed/note，data-on=1 已钉"],["fgitemrow", "条目内一行"],["fgdoorrow", "邀请携带项行"],["fgdoor", "携带项开关；data-on=1 带"],["fgbtn", "花册按钮；data-part=invite/cancel/editcrew/moveout/bottle/ready/thingact"],["fgcrewpick", "邀请邻居按钮"],["fgbottlebook", "漂流信册"],["fgpagebtn", "翻页；data-part=prev/next"],["fgframebtn", "看相框按钮"],["fgpin", "钉住按钮"],["fgempty", "空状态"],["fgdress", "样貌层"],["fgdresspanel", "样貌面板"],["fgdresstabs", "样貌对象页签行"],["fgdresstab", "样貌对象；data-on=1 当前，data-part=train 列车里那排"],["fgchat", "庭院聊天层；data-on=1 展开"],["fgchattoggle", "聊天展开/收起"],["fgmsgs", "聊天记录区；data-part=pet 宠物街区"],["fgmsg", "一条消息；data-me=1 你，data-part=pet 宠物街区"],["fgmsgname", "消息署名"],["fgbubble", "消息正文；data-me=1 你"],["fgretry", "重试"],["fgcompose", "输入栏；data-part=pet 宠物街区"],["fginput", "输入框；data-part=chat/invitename/bottle/bottlesearch/backnote"],["fgsend", "发送"],["fgswitch", "列车开关；data-on=1 开"],["fgrailway", "铁路目的地页"],["fgrailwaydest", "目的地按钮"],["fgbacknotes", "相框背面留言"],["fgframesheet", "相框详情页"],["fgalbum", "旅行相册页"],["fgpetpage", "宠物街区整页"],["fgtrainpage", "远行列车整页"],["fgtrainactions", "列车顶栏按钮组"],["fgtrainpanel", "列车子页面"]])}),
    Object.freeze({zh:"跑团",pages:Object.freeze(["trpg"]),hooks:Object.freeze([["trpgpage", "跑团首页整页"],["trpgtabs", "首页页签行"],["trpgtab", "页签；data-on=1 当前"],["trpglist", "列表滚动区"],["trpgcamp", "团卡；data-on=0 已完结"],["trpgcamptitle", "团标题"],["trpgcampsub", "团简介"],["trpgcampdel", "删团"],["trpgsquad", "小分队卡"],["trpgsquadname", "分队名"],["trpgsquaddel", "解散"],["trpgmember", "分队成员行"],["trpgmembername", "成员名"],["trpgempty", "空状态"],["trpgsheet", "「＋」底部菜单"],["trpgsheetbtn", "菜单按钮"],["trpgcreate", "新开跑团页"],["trpgbody", "新开页滚动区"],["trpgsquadnew", "组建小分队页"],["trpgscript", "导入剧本页"],["trpgscriptpreview", "剧本拆栏预览"],["trpgcharpick", "拉队友；data-on=1 已选"],["trpggallery", "图库页"],["trpgphoto", "图库格"],["trpgviewer", "大图查看器"],["trpgplay", "游戏中整页"],["trpgfeed", "剧情滚动区"],["trpgmsg", "剧情消息；data-kind=gm/user/chat/photo/roll/sys/apart/letter，data-me=1 你"],["trpgmsgtext", "守密人正文"],["trpgchatline", "闲聊簇里一行；data-me=1 你"],["trpgbubble", "你的气泡；data-me=1"],["trpgepisode", "章节卡"],["trpgbusy", "推演中提示"],["trpgended", "完结提示"],["trpgdock", "底部操作坞"],["trpgnight", "夜谈话头；data-on=1 未接"],["trpgretry", "重试区"],["trpgtable", "行动表"],["trpgtablerow", "行动表行；data-me=1 你"],["trpgchoices", "选项横排"],["trpgchoice", "选项卡"],["trpgchoicetext", "选项正文"],["trpgexplore", "自由活动区"],["trpghand", "手牌区"],["trpghandcard", "手牌；data-on=1 打出"],["trpgsplit", "分头行动区"],["trpgnote", "咬耳朵区"],["trpgplus", "「＋」工具区"],["trpgtool", "工具按钮；data-part=dice/note/chat，data-on=1 开"],["trpgcompose", "输入栏"],["trpgplusbtn", "「＋」；data-on=1 开"],["trpghandbtn", "手牌；data-on=1 开"],["trpginput", "输入；data-part=main/note/split/squadname/script/scriptraw"],["trpgsend", "行动按钮"],["trpgmap", "地图层"],["trpgceremony", "检定仪式层"],["trpgceremonybtn", "仪式按钮"],["trpgpeek", "偷看按钮"]])}),
    Object.freeze({zh:"小剧场",pages:Object.freeze(["theater"]),hooks:Object.freeze([["thrpage", "小剧场首页整页"],["thrlist", "角色列表区"],["thrclapper", "场记板"],["thrclappertitle", "场记板标题"],["thrchar", "角色行；data-on=1 展开"],["thrcharname", "角色名"],["thrcharsub", "线数"],["thrnote", "角色便签"],["thrnotebtn", "便签按钮"],["thrlines", "某角色的线列表页"],["thrline", "一条线卡；data-on=0 已完结"],["thrlinetitle", "线名"],["thrlinesub", "线状态"],["thrlinedel", "删线"],["thrnew", "新开 if 线页"],["thrcard", "卡片；data-part=char/keyword"],["thrinput", "输入；data-part=keyword/edit/goal/note/main"],["thrdiff", "难度；data-on=1 选中"],["thrdraft", "设定草稿卡"],["thrdrafttitle", "草稿标题"],["thrbtn", "按钮；data-part=accept 开演"],["thrpresets", "收藏设定页"],["thrpresettitle", "设定名"],["thrpreset", "文风预设；data-on=1 选中"],["thrplay", "演出页整页"],["thrgoal", "本轮目标条；data-on=1 展开"],["thrpanel", "设定面板"],["thrroundgoal", "各轮目标行"],["thrbanner", "提示卡；data-part=pending/fail"],["thrfeed", "演出滚动区"],["thract", "幕标题"],["thrmsg", "消息；data-part=narration/user/char，data-me=1 你"],["thrbusy", "生成中"],["thrended", "谢幕区"],["thrplus", "工具区"],["thrtool", "工具；data-part=dice/note/photo/stage，data-on=1 开"],["thrplusbtn", "「＋」；data-on=1 开"],["thrcompose", "输入栏"],["thrsend", "发送"],["thrsheet", "底部菜单；data-part=photo/msg"],["thrsheetbtn", "菜单按钮"],["thrgallery", "剧照图库"],["thrgalchar", "图库角色格"],["thrgalname", "图库角色名"],["thrphotos", "某角色剧照页"],["thrphoto", "剧照格"],["thrviewer", "大图查看器"],["thrviewerbtn", "大图按钮；data-part=save/del"],["thrempty", "空状态"]])}),
    Object.freeze({zh:"月度印象",pages:Object.freeze(["impression"]),hooks:Object.freeze([["imppage", "月度印象首页"],["impintro", "首页说明"],["impchars", "角色相册网格"],["impchar", "角色相册"],["impcharname", "角色名"],["impcharsub", "张数"],["impempty", "空状态"],["impcharpage", "某角色相册页"],["impgrid", "月份网格"],["impmonth", "月份相片"],["impmonthlabel", "月份手写签"],["impmonthsub", "副行"],["impemptyslot", "空相角位"],["impfoot", "页脚说明"],["impbtn", "按钮；data-part=save/rewrite/redraw/writeback/del/withart/backfill，withart 的 data-on=1 带图"],["impdetail", "单张详情页"],["impflip", "翻转卡；data-on=1 背面"],["impfront", "正面"],["impback", "背面"],["impbackrow", "背面一段"],["impplate", "相片底板"],["imptag", "图上标签"],["impcaption", "说明区"],["impcardname", "署名"],["impcardtitle", "标题"],["impquote", "引语"],["impactions", "按钮行"]])}),
    Object.freeze({zh:"秋声",pages:Object.freeze(["yanqiu"]),hooks:Object.freeze([["yqpage", "言秋留言墙整页"],["yqhead", "顶栏"],["yqback", "返回"],["yqtitle", "标题"],["yqsub", "副标题"],["yqrefresh", "刷新"],["yqlist", "滚动区"],["yqintro", "说明"],["yqempty", "空状态"],["yqcard", "一张纸条"],["yqnote", "纸条本体"],["yqmood", "心情戳"],["yqauthor", "署名"],["yqtext", "正文"],["yqlike", "压叶按钮；data-on=1 已压"],["yqdate", "日期"],["yqcomments", "批注区"],["yqcomment", "批注；data-me=1 你"],["yqinput", "批注输入"],["yqsend", "批注发送"]])}),
    Object.freeze({zh:"文风台",pages:Object.freeze(["stylelab"]),hooks:Object.freeze([["slpage", "文风台整页"],["sltabs", "页签行"],["sltab", "页签；data-on=1 当前"],["slbody", "内容区"],["slbuild", "组装页"],["slpresets", "预设排"],["slplate", "预设牌；data-on=1 选中"],["sltools", "工具排"],["sltool", "工具按钮"],["slrow", "说明行"],["slname", "预设名输入"],["slsectitle", "段标题"],["slslot", "已选槽"],["slslotmod", "槽里的模块"],["slslotname", "模块名"],["slmove", "挪动；data-part=up/down"],["slremove", "取出"],["sllib", "模块库"],["slcat", "分类"],["slcatbtn", "分类头；data-on=1 展开"],["slcatbody", "分类内容"],["slmod", "模块行"],["slmodbtn", "模块按钮；data-on=1 已选"],["slmoddel", "删自定义模块"],["slfree", "手写区"],["slfreeinput", "手写输入"],["slfreepos", "位置；data-on=1 选中"],["slpreview", "组装预览"],["slfullbtn", "看全文；data-on=1 展开"],["slpreviewtext", "预览正文"],["slactions", "操作行"],["slactbtn", "操作；data-part=dup/del"],["sltest", "试跑页"],["slcharpick", "谁来写；data-on=1 选中"],["slscenes", "场景列表"],["slscene", "场景"],["slscenebtn", "场景按钮；data-on=1 选中"],["slrun", "开跑按钮"],["slruns", "结果区"],["slresult", "结果卡"],["slresulttext", "结果正文"],["slresultfoot", "结果底行"],["slexpand", "展开"],["slempty", "空状态"]])}),
    Object.freeze({zh:"秋秋小窝",pages:Object.freeze(["nest"]),hooks:Object.freeze([["nestpage", "小窝首页整页"], ["nestupbtn", "右上角「传一个」"], ["nestcubbies", "分类格子柜那一整块"], ["nestcubby", "格子柜里的一格；data-on=1 选中"], ["nestsort", "「新的在前／旧的在前」切换"], ["nestitem", "列表里的一条（data-kind＝哪一类）"], ["nestdetail", "点进一条之后的整页"], ["nestpreview", "详情里那块内容预览"], ["nestimport", "「导进我的手机」按钮"], ["nestcopy", "「复制」按钮"], ["nestactions", "详情页底下那一排按钮"], ["nestfile", "上传页「选文件」按钮"], ["nestfilechip", "选了文件之后那条「已选…」"], ["nestplace", "CSS「放哪儿」那一块"], ["nestplaceall", "「全 App」按钮"], ["nestplacetabs", "聊天窗／群聊／线下那几格"], ["nestplacerow", "放哪儿列表里的一个人或一个群"], ["nestdelete", "删除按钮"], ["nestupload", "「传一个上去」整页"], ["nestsend", "「传上去」按钮"], ["nestbtn", "小窝里其余的圆角按钮"]])}),
    Object.freeze({zh:"秋秋",pages:Object.freeze(["assistant"]),hooks:Object.freeze([["qqpage", "秋秋整页"],["qqbar", "角色信息条"],["qqtitle", "名字"],["qqstatus", "状态"],["qqclear", "清空；data-part=dock 浮窗"],["qqsetupbtn", "设置按钮"],["qqfeed", "对话区；data-part=dock 浮窗"],["qqempty", "空状态"],["qqmsg", "消息行；data-me=1 你"],["qqbubble", "气泡；data-me=1 你"],["qqavatar", "秋秋头像"],["qqcopy", "气泡下面的「复制」（data-me=\"1\" 是我那侧，\"0\" 是秋秋那侧）"], ["qqthinking", "「在想…」那一行"], ["qqcancel", "「在想…」旁边的「✕ 取消」"], ["qqregen", "取消之后那颗「重新生成」"],["qqquick", "快捷问题；data-part=dock 浮窗"],["qqcompose", "输入栏；data-part=dock 浮窗"],["qqinput", "输入框；data-part=dock 浮窗"],["qqsend", "发送；data-part=dock 浮窗"],["qqattach", "附件预览；data-part=pic/file"],["qqattachbtn", "附件按钮；data-part=pic/file"],["qqpatch", "改动卡"],["qqpatchtitle", "改动标题"],["qqpatchfoot", "改动底行"],["qqpatchbtn", "改动按钮；data-part=apply/skip/undo"],["qqasking", "追问提示"],["qqaskbtn", "追问按钮；data-part=send/drop"],["qqsetup", "设置页"],["qqname", "名字输入"],["qqavatardel", "删头像"],["qqballswitch", "小球开关；data-on=1 开"],["qqapi", "线路；data-on=1 选中"],["qqprompt", "提示词输入"],["qqbtn", "设置页按钮"],["qqundolist", "改动记录区"],["qqundorow", "改动记录；data-on=0 已退回"],["qqundobtn", "退回"],["qqdockball", "浮球"],["qqdock", "浮窗"],["qqdockbar", "浮窗顶条"],["qqdocktitle", "浮窗标题"],["qqdockclose", "浮窗收起"]])}),
    Object.freeze({zh:"攻略",pages:Object.freeze(["codex"]),hooks:Object.freeze([["cxpage", "攻略目录页"],["cxask", "问秋秋卡；data-part=top 目录顶 / detail 详情底"],["cxsearch", "搜索框"],["cxempty", "空状态"],["cxcat", "章"],["cxcattitle", "章名"],["cxrow", "一行"],["cxrowbtn", "行按钮"],["cxrowname", "名"],["cxrowsub", "摘要"],["cxdetail", "详情页"],["cxsec", "一节"],["cxsectitle", "节标题"],["cxwhere", "在哪儿"],["cxpara", "正文段"],["cxlist", "分点列表"],["cxli", "分点"],["cxtable", "表格"]])}),
    Object.freeze({zh:"记账",pages:Object.freeze(["ledger"]),hooks:Object.freeze([["ldgfielddialogsubmit", "fielddialogsubmit 的外层容器"],["ldgfielddialogtap", "fielddialog 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ldgfielddialogbtn", "fielddialog 的按钮；data-part 区分同名多处：图标 /cancel/3"],["ldgfielddialoginput", "fielddialog 的输入框；data-part 区分同名多处：1"],["ldgcategoryglyph", "categoryglyph 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgcattile", "cattile 的外层容器；data-on=\"1\" 为当前选中/激活"],["ldgjellyglyph", "jellyglyph 的外层容器"],["ldgbar", "bar 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ldgcells", "cells 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgmonthnavbtn", "monthnav 的按钮；data-part 区分同名多处：上个月/下个月"],["ldgcandyseg", "candyseg 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：换币种"],["ldgpage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgkeychain", "keychain 的外层容器"],["ldgkeychainminibarcode", "keychainminibarcode 的外层容器"],["ldgwallethomeykkey", "wallethomeykkey 的外层容器"],["ldgwallethomeyk", "wallethomeyk 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgwallethomeykbtn", "wallethomeyk 的按钮；data-part 区分同名多处：1/togglehide/motto/4/editbudget/bills"],["ldgwallethomebigkey", "wallethomebigkey 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgwallethomebtn", "wallethome 的按钮；data-part 区分同名多处：togglehide/motto/editbudget/bills"],["ldgsparkle", "sparkle 的外层容器"],["ldgheart", "heart 的外层容器"],["ldgbunny", "bunny 的外层容器"],["ldgclip", "clip 的外层容器"],["ldgwordmark", "wordmark 的外层容器"],["ldgstripslot", "stripslot 的外层容器"],["ldgreceipt", "receipt 的外层容器"],["ldgbarcode", "barcode 的外层容器"],["ldgdonut", "donut 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgcurview", "curview 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8（rN=同组件第N个返回分支/列表项）"],["ldgcurviewbtn", "curview 的按钮；data-part 区分同名多处：改预算"],["ldgbillsviewbtn", "billsview 的按钮；data-part 区分同名多处：搜索账单/不再只看"],["ldgbillsviewinput", "billsview 的输入框；data-part 区分同名多处：搜备注、分类或金额"],["ldgbillsview", "billsview 的外层容器"],["ldggoalsview", "goalsview 的外层容器"],["ldggoalsviewbtn", "goalsview 的按钮；data-part 区分同名多处：1/2/3/删掉这个目标/5；data-on=\"1\" 为当前选中/激活"],["ldgyearviewbtn", "yearview 的按钮；data-part 区分同名多处：上一年/下一年/3"],["ldgyearview", "yearview 的外层容器"],["ldgcalview", "calview 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgmeviewbtn", "meview 的按钮；data-part 区分同名多处：1/2"],["ldgmeview", "meview 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgtxnrow", "txnrow 的外层容器"],["ldgtxnview", "txnview 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgtxnviewbtn", "txnview 的按钮；data-part 区分同名多处：改这一笔/删掉这一笔/3/比如 12.5/5/6"],["ldgledgersharepicker", "ledgersharepicker 的外层容器"],["ldgledgersharepickerbtn", "ledgersharepicker 的按钮；data-part 区分同名多处：1"],["ldgcommentpicker", "commentpicker 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgcommentpickertap", "commentpicker 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ldgcommentpickerbtn", "commentpicker 的按钮；data-part 区分同名多处：1/2"],["ldgaddsheetbtn", "addsheet 的按钮；data-part 区分同名多处：1/2/3/4/清空金额/6"],["ldgaddsheetsave", "addsheetsave 的外层容器"],["ldgaddsheet", "addsheet 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgaddsheetinput", "addsheet 的输入框；data-part 区分同名多处：备注：这一笔是什么（可留/日期"],["ldgsettingssheetbtn", "settingssheet 的按钮；data-part 区分同名多处：1/2/3/4/比如 0.19/6/7/比如 800…"],["ldgsettingssheet", "settingssheet 的外层容器；data-part 区分同名多处：r2/r3/r4/r5（rN=同组件第N个返回分支/列表项）"],["ldgrecureditorinput", "recureditor 的输入框；data-part 区分同名多处：1"],["ldgrecureditorbtn", "recureditor 的按钮；data-part 区分同名多处：1/删掉这条周期账单/3；data-on=\"1\" 为当前选中/激活"],["ldgrecureditorsave", "recureditorsave 的外层容器"],["ldgaccteditorinput", "accteditor 的输入框；data-part 区分同名多处：1"],["ldgaccteditorbtn", "accteditor 的按钮；data-part 区分同名多处：1/删掉这个账户/3；data-on=\"1\" 为当前选中/激活"],["ldgaccteditorsave", "accteditorsave 的外层容器"]])}),
    Object.freeze({zh:"备忘录",pages:Object.freeze(["memo"]),hooks:Object.freeze([["memocommentpickertap", "commentpicker 的可点的行/卡片/格子；data-part 区分同名多处：close/2"],["memocommentpickerbtn", "commentpicker 的按钮；data-part 区分同名多处：1/2/close/4"],["memovisiblepickertap", "visiblepicker 的可点的行/卡片/格子；data-part 区分同名多处：close/2"],["memovisiblepickerbtn", "visiblepicker 的按钮；data-part 区分同名多处：1/2"],["memocommentblock", "commentblock 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["memocommentblockbtn", "commentblock 的按钮；data-part 区分同名多处：1/2"],["memoreminderformbtn", "reminderform 的按钮；data-part 区分同名多处：1/2/3"],["memoreminderforminput", "reminderform 的输入框；data-part 区分同名多处：要提醒的事（如 交房租 /备注（可空）/3/4/5"],["memonoteformbtn", "noteform 的按钮；data-part 区分同名多处：1/2"],["memonoteforminput", "noteform 的输入框；data-part 区分同名多处：标题"],["memonoteformtext", "noteform 的多行输入框；data-part 区分同名多处：随手记点什么…"],["memopagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["memopage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"]])}),
    Object.freeze({zh:"去处",pages:Object.freeze(["dwell"]),hooks:Object.freeze([["dwellcitymap", "citymap 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["dwelldatealbumcardbtn", "datealbumcard 的按钮；data-part 区分同名多处：1"],["dwellpagetap", "整页（入口组件） 的可点的行/卡片/格子；data-part 区分同名多处：1"],["dwellbackdrop", "backdrop 的外层容器"],["dwellpage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["dwellplacehero", "placehero 的外层容器"],["dwellpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["dwellsurface", "surface 的外层容器"]])}),
    Object.freeze({zh:"好友地图",pages:Object.freeze(["map"]),hooks:Object.freeze([["mapmapcanvas", "mapcanvas 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["mapworldmap", "worldmap 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mapworldmapzoombtn", "worldmapzoom 的按钮"],["mapworldmapbtn", "worldmap 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["mapworldmapinput", "worldmap 的输入框；data-part 区分同名多处：1/2"],["mapworldmaptext", "worldmap 的多行输入框；data-part 区分同名多处：1"],["mapworldmapkey", "worldmapkey 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["mapnodeaddchip", "nodeaddchip 的外层容器"],["mapnodeadd", "nodeadd 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mapnodeaddbtn", "nodeadd 的按钮；data-part 区分同名多处：1/2/3"],["mapnodeaddinput", "nodeadd 的输入框；data-part 区分同名多处：这块地方叫什么（≤8字）/地点叫什么/想要什么样的？（可空）"],["mapnodeaddtext", "nodeadd 的多行输入框；data-part 区分同名多处：这儿眼下正有什么事（一句"],["mapworldform", "worldform 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mapworldforminput", "worldform 的输入框；data-part 区分同名多处：一个名字/这张是哪儿"],["mapworldformtext", "worldform 的多行输入框；data-part 区分同名多处：写多少都行：这地方靠什么"],["mapworldformbtn", "worldform 的按钮；data-part 区分同名多处：1/2/del"],["mapstorymap", "storymap 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["mapstorymapbtn", "storymap 的按钮；data-part 区分同名多处：1"],["mappage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mappageinput", "整页（入口组件） 的输入框；data-part 区分同名多处：搜任何地方：店名 / 地/搜城市名，如 上海 / "],["mappagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"]])}),
    Object.freeze({zh:"同人文",pages:Object.freeze(["fanfic"]),hooks:Object.freeze([["ficpaperswatch", "paperswatch 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficpaperswatchone", "paperswatchone 的外层容器"],["ficcastpicker", "castpicker 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficwaytag", "waytag 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficficcarddot", "ficcarddot 的外层容器"],["ficficcardstatrow", "ficcardstatrow 的外层容器"],["ficficcardtap", "ficcard 的可点的行/卡片/格子；data-part 区分同名多处：1/2"],["ficficcardstaple", "ficcardstaple 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ficficmotionstyles", "ficmotionstyles 的外层容器"],["fictabbarrule", "tabbarrule 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["fictabbar", "tabbar 的外层容器；data-on=\"1\" 为当前选中/激活"],["fictabbarbtn", "tabbar 的按钮；data-part 区分同名多处：新建世界观"],["ficgensheetsec", "gensheetsec 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficgensheetbtn", "gensheet 的按钮；data-part 区分同名多处：1/2/3/4；data-on=\"1\" 为当前选中/激活"],["ficgensheet", "gensheet 的外层容器；data-part 区分同名多处：r2/r3/r4/r5（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficgensheetinput", "gensheet 的输入框；data-part 区分同名多处：1/或者自己写：同门、一个乐"],["ficgensheettext", "gensheet 的多行输入框；data-part 区分同名多处：自由发挥"],["ficgensheetselect", "gensheet 的下拉选择；data-part 区分同名多处：1/2"],["fictabsheet", "tabsheet 的外层容器"],["fictabsheettap", "tabsheet 的可点的行/卡片/格子；data-part 区分同名多处：1"],["fictabsheetinput", "tabsheet 的输入框；data-part 区分同名多处：世界观名（如『民国』『星"],["fictabsheettext", "tabsheet 的多行输入框；data-part 区分同名多处：世界观描述（= 生成时的"],["fictabsheetbtn", "tabsheet 的按钮；data-part 区分同名多处：1/2"],["fictabsheetauthortag", "tabsheetauthortag 的外层容器"],["ficreadermetarow", "readermetarow 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficreaderbtn", "reader 的按钮；data-part 区分同名多处：换书页/2/3/4/r5/6/7/8…（rN=同组件第N个返回分支/列表项）"],["ficreaderpager", "readerpager 的外层容器"],["ficreader", "reader 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6（rN=同组件第N个返回分支/列表项）"],["ficreadertext", "reader 的多行输入框；data-part 区分同名多处：接着往下写…"],["ficreaderinput", "reader 的输入框；data-part 区分同名多处：写条书评…/回复…"],["ficreadertap", "reader 的可点的行/卡片/格子；data-part 区分同名多处：1/2"],["ficghostpage", "ghostpage 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficghostpageoptrow", "ghostpageoptrow 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficghostpagebtn", "ghostpage 的按钮；data-part 区分同名多处：askback/2/3"],["ficghostpagetext", "ghostpage 的多行输入框；data-part 区分同名多处：想看的走向、想让谁出场、"],["ficfilepagebtn", "filepage 的按钮；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficfilepage", "filepage 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficfilepageinput", "filepage 的输入框；data-part 区分同名多处：这间房叫什么"],["ficfwdsheet", "fwdsheet 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ficfwdsheettap", "fwdsheet 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ficpublishfinalcp", "publishfinalcp 的外层容器"],["ficpublishselect", "publish 的下拉选择；data-part 区分同名多处：1/2/3"],["ficpublish", "publish 的外层容器"],["ficpublishinput", "publish 的输入框；data-part 区分同名多处：标题/标签，用空格或逗号分隔（"],["ficpublishtext", "publish 的多行输入框；data-part 区分同名多处：正文…"],["ficpublishbtn", "publish 的按钮；data-part 区分同名多处：1"],["ficminerow", "minerow 的外层容器"],["ficminestat", "minestat 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficminebtn", "mine 的按钮；data-part 区分同名多处：1"],["ficminepublished", "minepublished 的外层容器"],["ficminecp", "minecp 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficminecpbtn", "minecp 的按钮；data-part 区分同名多处：1/2/3/4/5"],["ficminecpinput", "minecp 的输入框；data-part 区分同名多处：备注名（可空，默认用名字"],["ficminecpselect", "minecp 的下拉选择；data-part 区分同名多处：1/2"],["ficminesettings", "minesettings 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficminesettingsbtn", "minesettings 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8"],["ficminesettingsinput", "minesettings 的输入框；data-part 区分同名多处：给这套实验取名/来源备注（作者 / 链接/文风名（如 冷冽白描 //4"],["ficminesettingstext", "minesettings 的多行输入框；data-part 区分同名多处：额外说明：例如少写全知判/例如：分别多年后在医院走/文风描述，越具体越好，想"],["ficmeeditsheet", "meeditsheet 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficmeeditsheettap", "meeditsheet 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ficmeeditsheetbtn", "meeditsheet 的按钮；data-part 区分同名多处：1/2/3"],["ficmeeditsheetinput", "meeditsheet 的输入框；data-part 区分同名多处：昵称/id（@handle，不/3"],["ficmeeditsheettext", "meeditsheet 的多行输入框；data-part 区分同名多处：个人简介 / 太太的一句"],["ficrpapp", "rpapp 的外层容器；data-part 区分同名多处：r2/r3/r4/r5（rN=同组件第N个返回分支/列表项）"],["ficrpappbtn", "rpapp 的按钮；data-part 区分同名多处：1/2/3"],["ficrpspinecap", "rpspinecap 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficrpspine", "rpspine 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficrpthreadsrcpara", "rpthreadsrcpara 的外层容器"],["ficrpthread", "rpthread 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficrpthreadpara", "rpthreadpara 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficrpthreadbtn", "rpthread 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["ficrpthreadtext", "rpthread 的多行输入框；data-part 区分同名多处：写下你的行动 / 说的话"],["ficrpthreadheatmark", "rpthreadheatmark 的外层容器"],["ficauthorspage", "authorspage 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）"],["ficauthorspagebtn", "authorspage 的按钮；data-part 区分同名多处：1/2"],["ficauthorspagetext", "authorspage 的多行输入框；data-part 区分同名多处：写什么类型、什么文风、磕"],["ficauthorspageauthorface", "authorspageauthorface 的外层容器"],["ficauthorspagezhengtally", "authorspagezhengtally 的外层容器"],["ficauthorspageauthorseal", "authorspageauthorseal 的外层容器"],["ficauthorhomestat", "authorhomestat 的外层容器"],["ficauthorhomesec", "authorhomesec 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficauthorhome", "authorhome 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ficauthorhomebtn", "authorhome 的按钮；data-part 区分同名多处：1/2/3/4/5"],["ficbottomnav", "bottomnav 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6"],["ficpageinput", "整页（入口组件） 的输入框；data-part 区分同名多处：搜标题、笔名、CP 里的"]])}),
    Object.freeze({zh:"一起读",pages:Object.freeze(["read"]),hooks:Object.freeze([["foregen", "论坛帖子「全部回复」那一行的「换一批」"], ["moregen", "朋友圈动态底下「换一批」"], ["readreplyquote", "讨论框底下那条「回 TA 批的：……」"], ["readfull", "书页底下翻页条上那颗「全屏／退出全屏」"], ["readpage", "整页（入口组件） 的外层容器"],["readpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2"],["readshelfboard", "shelfboard 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readpageinput", "整页（入口组件） 的输入框；data-part 区分同名多处：1"],["readreaderbtn", "reader 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["readreader", "reader 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readannobook", "annobook 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["readannobookbtn", "annobook 的按钮；data-part 区分同名多处：1/remember"],["readselexplainsheet", "selexplainsheet 的外层容器"],["readselexplainsheettap", "selexplainsheet 的可点的行/卡片/格子；data-part 区分同名多处：close"],["readselexplainsheetbtn", "selexplainsheet 的按钮；data-part 区分同名多处：close"],["readnotesheet", "notesheet 的外层容器"],["readnotesheettap", "notesheet 的可点的行/卡片/格子；data-part 区分同名多处：close"],["readnotesheettext", "notesheet 的多行输入框；data-part 区分同名多处：写下你对这句的想法…（T"],["readnotesheetbtn", "notesheet 的按钮；data-part 区分同名多处：close/2"],["readstepperbtn", "stepper 的按钮；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readpartnerpicker", "partnerpicker 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["readpartnerpickertap", "partnerpicker 的可点的行/卡片/格子；data-part 区分同名多处：1"],["readpartnerpickerbtn", "partnerpicker 的按钮；data-part 区分同名多处：close"],["readdiscusssheet", "discusssheet 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readdiscusssheetbtn", "discusssheet 的按钮；data-part 区分同名多处：end/返回/send"],["readdiscusssheetinput", "discusssheet 的输入框；data-part 区分同名多处：说说你的看法…"]])}),
    Object.freeze({zh:"一起看",pages:Object.freeze(["watch"]),hooks:Object.freeze([["watchpage", "整页（入口组件） 的外层容器"],["watchticket", "ticket 的外层容器"],["watchticketbtn", "ticket 的按钮；data-part 区分同名多处：open/改名/删掉这部"],["watchimportpageinput", "importpage 的输入框；data-part 区分同名多处：1/粘贴 B 站或 YouT/叫它什么"],["watchimportpagebtn", "importpage 的按钮；data-part 区分同名多处：1"],["watchpickpartner", "pickpartner 的外层容器"],["watchpickpartnerbtn", "pickpartner 的按钮；data-part 区分同名多处：1"],["watchcinemalayer", "cinemalayer 的外层容器"],["watchcinemalayerbtn", "cinemalayer 的按钮；data-part 区分同名多处：退出影院模式/2"],["watchcinemalayerinput", "cinemalayer 的输入框；data-part 区分同名多处：小声说一句…"],["watchscreeningbtn", "screening 的按钮；data-part 区分同名多处：1/2/3"],["watchscreening", "screening 的外层容器"],["watchscreeninginput", "screening 的输入框；data-part 区分同名多处：1/TA 多久可能自己开一次口/小声说一句…"]])}),
    Object.freeze({zh:"周刊",pages:Object.freeze(["weekly"]),hooks:Object.freeze([["wklyweeklymotionstyles", "weeklymotionstyles 的外层容器"],["wklypageturnnav", "pageturnnav 的外层容器"],["wklypageturnnavbtn", "pageturnnav 的按钮；data-part 区分同名多处：1/2"],["wklymasthead", "masthead 的外层容器"],["wklysectionrule", "sectionrule 的外层容器"],["wklyregenbtn", "regen 的按钮"],["wklycountdown", "countdown 的外层容器"],["wklycoverpage", "coverpage 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["wklycoverpagebtn", "coverpage 的按钮；data-part 区分同名多处：周刊工具"],["wklyweeklytoolssheet", "weeklytoolssheet 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["wklyweeklytoolssheetbtn", "weeklytoolssheet 的按钮；data-part 区分同名多处：shelf/refresh/3/4/close"],["wklyregenrow", "regenrow 的外层容器"],["wklycoversection", "coversection 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["wklyinterviewentry", "interviewentry 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["wklymediadetail", "mediadetail 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）"],["wklymediadetailpairedarticle", "mediadetailpairedarticle 的外层容器"],["wklymediadetailwidearticle", "mediadetailwidearticle 的外层容器"],["wklymediadetailmasthead", "mediadetailmasthead 的外层容器"],["wklymediadetailmanifestolayout", "mediadetailmanifestolayout 的外层容器"],["wklymediadetaildossierlayout", "mediadetaildossierlayout 的外层容器"],["wklymediadetailclassiclayout", "mediadetailclassiclayout 的外层容器"],["wklymediadetailnoteslayout", "mediadetailnoteslayout 的外层容器"],["wklymediadetailstandardlayout", "mediadetailstandardlayout 的外层容器"],["wklymediadetailscoreboardlayout", "mediadetailscoreboardlayout 的外层容器"],["wklyissueview", "issueview 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["wklyshelf", "shelf 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）"],["wklyshelfbtn", "shelf 的按钮；data-part 区分同名多处：1/2/3"],["wklynewsroomhome", "newsroomhome 的外层容器"],["wklynewsroomhomebtn", "newsroomhome 的按钮；data-part 区分同名多处：1/refresh"],["wklypage", "整页（入口组件） 的外层容器"],["wklypagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1"]])}),
    Object.freeze({zh:"擂台",pages:Object.freeze(["debate"]),hooks:Object.freeze([["debpage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["debpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1"],["debsetup", "setup 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["debsetuptext", "setup 的多行输入框；data-part 区分同名多处：例：该不该为爱情放弃事业/例：谁先把对方逗笑 / "],["debsetupbtn", "setup 的按钮；data-part 区分同名多处：1/2/3/4/5"],["debarena", "arena 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["debarenabtn", "arena 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["debarenaturncard", "arenaturncard 的外层容器"],["debarenapartof", "arenapartof 的外层容器"],["debarenafocusblock", "arenafocusblock 的外层容器"], ["debyield", "台上那段话下面的「松口／换边了」；data-on=1 是换了边"], ["debrule", "这一轮末尾立的下一轮临时规矩卡"], ["debslip", "这一轮你递过的纸条那一行"], ["debslipbtn", "底部「递纸条」按钮"], ["debslipedit", "写纸条那一块（选给谁＋输入框）"], ["debdraw", "摆台子里「从你们的事里抽一题」那一块"], ["debdrawbtn", "抽题按钮"], ["debdrawpick", "抽出来的一道题；data-on=1 是选中的"], ["debbench", "摆台子里「台下坐谁」那一排"], ["debbenchpick", "台下坐谁的一个人；data-on=1 是挑上了"], ["debvotemore", "台下投票里收起来的「其余几票的理由」"], ["debrematch", "收台后「换边再吵一场」按钮"], ["debmejudge", "你当裁判时每轮写判语那一块"], ["debmyverdict", "你当裁判时收台判谁赢那一块"],["debarenalegacyaudience", "arenalegacyaudience 的外层容器"],["debarenainput", "arena 的输入框；data-part 区分同名多处：你要站的那一边…"],["debarenatext", "arena 的多行输入框；data-part 区分同名多处：1"]])}),
    // 挂点补课第一批（她 2026-10-08：「审计一下还有哪些页面没有挂点」→「按你的顺序来」）
    Object.freeze({zh:"查手机",pages:Object.freeze(["phone"]),hooks:Object.freeze([["phonepage","整页最外层（data-view=\"list\" 选人那页／\"desk\" 手机桌面）"],["phonerow","选人那页的一行（data-id＝角色 id）"],["phoneicon","桌面上一颗 app 图标（data-app＝哪个 app）"],["phonenotyetdot","图标右下角「还没生成」的虚线小圈"],["phonenotyet","点进还没生成的 app 那一页（带「生成」键）"],["phonewidget","桌面上的组件卡（data-app＝点了去哪个 app）"],["papp","点开之后每个小 app 的最外层（data-app＝哪个 app；微信联系人资料页另带 data-view=\"contact\"）。小 app 自己的顶栏是通用的 head，用 [data-wk=\"papp\"] [data-wk=\"head\"] 圈"],["ptab","小 app 里的分页／分区按钮（data-on=\"1\" 选中）"],["pitem","小 app 主列表里的一行／一张卡（聊天行、联系人 data-kind=\"contact\"、朋友圈、照片、书、商品、订单、帖子、歌、邮件、通话短信……）"],["ptitle","一行里的标题／名字（目前微信有）"],["ptext","一行里的正文／预览（目前微信有）"],["ptime","时间那行小字（目前微信有）"],["pdetail","点开一条之后的详情页（聊天线程、文章、书页、笔记）"],["pbubble","小 app 聊天里的一个气泡（data-me=\"1\" 是机主自己发的）"],["pinput","小 app 里的输入栏（你替TA打字／看TA玩时TA正在打字那一栏）"],["pbtn","小 app 里单独能改的按钮（data-part＝send 发送／peek 转发给TA／act 音乐里的动作键）"]])}),
    Object.freeze({zh:"一起听",pages:Object.freeze(["listen"]),hooks:Object.freeze([["listenpage","整页最外层（data-tab＝play/cloud/mine/home 当前在哪一栏）"],["listentitle","播放页的歌名"],["listenartist","歌名下面那行歌手"],["listenctrl","收藏／加歌单那排圆钮"],["listenlyric","歌词页（当前那句 data-lyric-active=\"1\"）"],["listentab","底下四个标签（data-tab＝哪一栏；data-on=\"1\" 是当前那个）"],["listenbtn","每一颗圆钮（播放／上一首／收藏／加歌单这些）"],["listenprogress","播放页那根进度条"],["listensong","歌单里的一首歌那一行（data-on=\"1\" 正在放）"],["listenqueue","正在播放队列里的一行（data-on=\"1\" 正在放）"],["listenchip","「我的」里那排分隔卡（data-on=\"1\" 选中）"],["listenplaylist","一个歌单那一行"]])}),
    Object.freeze({zh:"我的钱包",pages:Object.freeze(["wallet"]),hooks:Object.freeze([["walletpage","整页最外层（data-view=\"main\" 钱包／\"cards\" 亲属卡包）"],["walletbalance","余额那个大数字"],["walletrecur","余额下面「固定进出」那一块"],["walletrecurrow","固定进出的一行；data-dir=in 进账 / out 支出"],["walletrecuradd","「＋ 加一条」；data-dir 同上"],["walletrecuredit","改一条的那张单子"],["walletrecurname","名字输入框"],["walletrecuramt","金额输入框"],["walletrecursave","保存"],["walletslip","夹层里的一张小票（data-in=\"1\" 是进账）"],["walletmonth","我的钱包：本月进账／花出去那两格"],["walletkind","我的钱包按类分开的一块（data-kind＝transfer/redpacket/shop/live/kinship_out/manual/misc）"],["walletproof","点开一笔后露出来的凭证（时间、类别、出处、余额）"],["wallettrace","凭证里「去聊天里看这一笔」那颗键"],["walletcur","余额旁边「用什么钱」那颗键"],["walletkin","卡包里的一张亲属卡（data-mine=\"1\" 是你给出去的）"],["walletnote","余额那叠钞票（两个钱包共用这一叠）"],["walletpocket","皮夹里的一格隔层（TA的钱包选人页每一行也是这一格）"],["walletcardsbtn","右上角「亲属卡」"],["walletedit","余额旁「改」那颗"],["walleteditor","改余额那张单据"],["walletsec","「夹层里的小票」「我给出去的」这种小标题"],["walletslipname","小票上的名目"],["walletslipamt","小票上的金额（data-in=\"1\" 进账）"],["walletempty","空着时那句话"],["walletkinadd","「给 TA 一张亲属卡」那颗虚线按钮"]])}),
    Object.freeze({zh:"钱包",pages:Object.freeze(["cwallet"]),hooks:Object.freeze([["cwpage","整页最外层（data-view=\"list\" 选人／\"char\" 某个人的钱包）"],["cwrow","选人那页的一行（data-id＝角色 id）"],["cwbalance","TA的余额大数字"],["cwsec","「日常消费」「送礼与转账」这些小节标题"],["cwline","一笔记录（data-kind=\"daily\" 日常／\"flow\" 送礼转账）"],["cwrowname","选人页一行里的名字"],["cwcurbtn","右上角币种符号"],["cwedit","余额旁「改」那颗"],["cweditor","改余额那张单据"],["cwbox","每一块撕下来的单据（收入来源／存款概览／理财…）"],["cwsum","存款概览里「本月收入／花费／剩余」一行"],["cwnote","每块底下那句斜体说明"],["cwincome","收入来源的一行"],["cwacct","「钱放在哪儿」的一行"],["cwdebt","欠账的一行（data-done=\"1\" 已了）"],["cwdebtbtn","「还清／收回这笔」"],["cwfold","能收起的那两块的标题（data-part=forher 为你花的／daily 日常消费）"],["cwitem","「为你花的」里的一笔"],["cwcurpage","「用什么钱」整页"],["cwcurpreset","币种那排预设（data-on=\"1\" 选中）"]])}),
    Object.freeze({zh:"世界书",pages:Object.freeze(["lore"]),hooks:Object.freeze([["lorepage","整页最外层（活页夹底）"],["loreintro","顶上那句说明和在用几条"],["lorefilter","搜索框和那排章那一块"],["loreview","按去向／角色／分类那三张分隔页标签（data-on=\"1\" 是翻到的）"],["lorestamp","一枚筛选章（data-on=\"1\" 是选中的）"],["lorecard","一条词条（data-off=\"1\" 是停用的）"],["loretitle","词条标题"],["lorebody","词条正文那两行"],["loreswitch","词条右边的启用开关（data-on=\"1\" 开着）"],["loreedit","点开一条之后的编辑页整页"],["loreedlabel","编辑页里每一栏的标题"],["lorecat","编辑页那排分类（data-on=\"1\" 选中）"],["loresave","编辑页底下「保存」"]])}),
    Object.freeze({zh:"记忆库",pages:Object.freeze(["memlib"]),hooks:Object.freeze([["mempage","整页最外层（记忆盒底）"],["memtab","顶上全部／未了／常驻那三张索引签（data-tab；data-on=\"1\" 当前）"],["memwho","按角色筛的那排头像（data-on=\"1\" 当前）"],["memroom","主线／各个小房间那排页签（data-on=\"1\" 当前）"],["memdate","每张卡左边的日期和情绪点"],["memcard","一张记忆索引卡（data-open=\"1\" 未了；data-pinned=\"1\" 常驻）"],["memtext","卡上那段记忆正文"],["memtool","右上角那两颗（data-part=cfg 设置／add 新增）"],["memindex","「XX 的记忆索引」那一块"],["memstat","索引里在册／常驻／未了／留档那一格（data-part）"],["memsearch","搜索框"],["memcfgrow","召回设置里的一行"],["memcfgswitch","召回设置里的开关（data-on）"],["memcfgval","召回设置里滑条右边那个数"],["memedhead","编辑记忆顶上那行"],["memedsave","编辑记忆的保存（对勾）"],["memedwho","编辑记忆里关联角色那排（data-on）"],["memedswitch","编辑记忆里的开关（data-part=pin 置顶／open 未了）"],["memedemo","情绪坐标那一块"],["memeddel","「删除这条记忆」"]])}),
    // 人格档案馆（她 2026-10-08：「那一页是不是没有挂点」）
    Object.freeze({zh:"人格档案馆",pages:Object.freeze(["cast"]),hooks:Object.freeze([["castpage","整页最外层（桌面底纹铺在这儿）"],["castcount","顶上「共 N 份卷宗」那一行"],["castcard","一份卷宗卡（data-id＝角色 id）"],["castspine","卡左边那道带角色颜色的书脊"],["castavatar","贴在卡上的头像相框"],["castname","卡上的名字"],["castsum","名字下面那两行人设摘要"],["castinfo","卡底下时区／生日／人设字数那一栏"],["castheart","卡最底下「心上」那一条"]])}),
    // 编角色卡那一页（她 2026-10-08：「还有编角色卡那边也要」）
    Object.freeze({zh:"编角色卡",pages:Object.freeze(["castForm"]),hooks:Object.freeze([["castfpage","整页最外层（桌面底色）"],["castfsave","右上角「存档」"],["castfcover","最上面那张卷宗封面卡"],["castfavatar","封面上的头像相框"],["castflang","人物卷宗「常用语言」那一排；每颗 data-on=1 选中"],["castfname","名字那一栏"],["castftag","一句话标签那一栏"],["castfcolor","「这份卷宗什么颜色」那一排色块"],["castfsec","下面几大块（data-no＝01 人物底稿／02 时间坐标／03 视觉档案／04 声音档案；里面的输入框用 textarea、input 选）"],["castfdel","最底下删除按钮"],["castfreset","完全重置按钮"]])}),
    Object.freeze({zh:"资料卡",pages:Object.freeze(["contact"]),hooks:Object.freeze([["cdpage", "整页最外层（带角色颜色的纸底）"], ["cdhead", "头部一行（头像、名字、简介）"], ["cdname", "角色名大字"], ["cdtagline", "名字下面那行简介"], ["cdage", "年龄和生日那一行"], ["cdaffinity", "好感度那一块"], ["cdrules", "「长期准则」整块"], ["cdrule", "单条准则卡片"], ["cdactions", "底部操作按钮那一组"], ["cdbtn", "单个操作按钮（data-kind=chat/state/desires；心上那颗 data-on=\"1\" 是有念想）"]])}),
    Object.freeze({zh:"设置",pages:Object.freeze(["config"]),hooks:Object.freeze([["cfhome", "设置首页那一列入口的容器"], ["calllog", "设置 · 调用记录与缓存 里的「模型调用记录」整块"], ["mcprelay", "设置 · 文字模型 · MCP 那一页里「转接」那一块"], ["calllogrow", "调用记录的一行（data-ok=\"1\" 成功，\"0\" 失败或断开）"], ["calllogtok", "调用记录那行里的输入／输出 token"], ["failretry", "调用记录页顶上「失败了自动再试一次」那一行"], ["cfrow", "首页的一行入口（data-page＝通往哪个子页，如 api/look/data）"], ["cfrowtitle", "首页一行的标题"], ["cfrowstate", "首页一行右下那行灰色状态小字"], ["cfnote", "首页底部那张说明卡"], ["cfmark", "方角汉字栏号牌（首页每行、子页每格都有）"], ["cfgrid", "子页里两列格子的网格"], ["cftile", "子页里的单个入口格子（data-wide=\"1\" 是占满一行的宽格）"], ["cfpanel", "子页内容外面那张卡片框（data-flush=\"1\" 没内边距）"], ["composerlift", "外观与壁纸里「输入栏往上抬」那一格"]])}),
    Object.freeze({zh:"论坛",pages:Object.freeze(["forum"]),hooks:Object.freeze([["forummaskrow","论坛「我」页「用哪张面具发」那一排"],["forummask","挑面具的一颗；data-on=1 现在用的"],["fochip", "版块切换的小标签（data-on=\"1\" 是当前那个）"], ["forow", "帖子流里的一张帖子卡（data-me=\"1\" 我发的，data-anon=\"1\" 匿名）"], ["fonotes", "论坛双列时那块瀑布流"], ["folayout", "论坛「我」页里「首页排版」那两颗（单列 / 双列，data-on=\"1\" 是选中的那颗）"], ["fonewhead", "「新帖在这里」「新回复在这里」那一行（点了展开，aria-expanded=\"true\" 是开着）"], ["fonote", "双列时的一张卡片"], ["foname", "帖子卡上的作者名"], ["fobody", "帖子卡正文预览"], ["foacts", "帖子卡底部操作栏"], ["fofloor", "帖子详情里的一层楼（data-me=\"1\" 我的，data-new=\"1\" 新楼）"], ["foreplies", "楼中楼回复框"], ["fosend", "详情页底部回复栏的发送键"], ["fofab", "右下角悬浮的发帖键"]])}),
    Object.freeze({zh:"日记",pages:Object.freeze(["diary"]),hooks:Object.freeze([["diauthor", "日记本列表里每个人的一行（data-on=\"1\" 当前那本，data-me=\"1\" 我自己）"], ["diname", "那一行里的名字"], ["dirow", "一篇日记（data-me=\"1\" 我写的）"], ["didate", "日记左侧的日期块"], ["dititle", "日记标题"], ["dibody", "日记正文预览"], ["dimarks", "条目下方的小标记行（划掉/秘密/贴纸、几人看过）"], ["dipen", "右上角写日记的铅笔键"], ["dipage", "翻页阅读时的单页日记"]])}),
    Object.freeze({zh:"情侣空间",pages:Object.freeze(["us"]),hooks:Object.freeze([["uscouple", "情侣列表的一行（data-on=\"1\" 在一起，否则邀请中；data-new=\"1\" 有新东西）"], ["usname", "列表行里的角色名"], ["uspair", "空间内页封面上那两枚头像的外框（整组挪位置）"], ["usavatar", "空间内页封面上的一枚头像（带环；data-who=\"ta\" 是他、\"me\" 是我）。默认我那枚往左压 18px 叠着，想拉开成两个整圆：[data-wk=\"usavatar\"][data-who=\"me\"]{margin-left:12px !important}"], ["uscount", "列表行里「在一起 N 天」的天数大字"], ["usdays", "空间内页「在一起 N 天」那一组"], ["usnow", "「TA 此刻」那张便签"], ["uspaper", "往上滚时盖住封面的那张底纸（颜色、透明度、磨砂都在它身上，写的时候要加 !important）"], ["uswall", "墙上的功能卡片（data-kind＝模块）"], ["usspine", "「收着的」那一列书脊入口（data-kind＝letters/exdiary/qa/capsule…；data-new=\"1\" 有新内容）"], ["useyebrow", "各区块的小眉标标题"]])}),
    Object.freeze({zh:"时刻",pages:Object.freeze(["shike"]),hooks:Object.freeze([["shikepage","时刻外层整页（横着滑那一层）"],["shikecard","横着滑的那张整屏 CG 卡（data-on=\"1\" 是当前停着的）"],["shikedetail","点进一个人以后的那一页"],["shikeitem","里层横着滑的一张时刻卡（data-kind=meet/us/bday/fest/first）"],["shikesay","时刻卡上TA说的那段话"],["shikecreate","「开一张时刻」那一页"],["shikemonths","里层底下那条时间轴（一张时刻一道刻度）"],["shikemenu","里层右上角「⋯」打开的那张小菜单"],["shikeacts","时刻卡底那一行小字动作"],["shikenote","时刻卡上写着那天的事的那块底框"],["shikewith","群里那种卡上「一起的还有」那一行"],["shikesoon","卡上那个倒计时小签（data-today=\"1\" 是就在今天）"]])}),
    // 一起学 · 我来教（2026-10-03）
    Object.freeze({zh:"我来教",pages:Object.freeze(["study"]),hooks:Object.freeze([["studymatpiles","资料页上头那排隔板（全部／我传的／老师给的）"],["studymatpile","一张隔板；data-on=1 选中"],["studyunit","开一节课时排出来的那几小节卡（data-keep=\"1\" 是点了留着的）"],["tbmis","顶上那条「TA 心里想错的地方」（每颗带 data-found=\"1\" 是挖出来的）"],["tbnote","TA 的课堂笔记"],["tbmsg","课上一句（data-me=\"1\" 是你讲的）"],["tbflash","挖出来时弹的那张"],["tbquiz","随堂小测那张"],["tbreview","评教卡"],["tbleft","评教卡底下「还没挖出来的」"]])}),
    Object.freeze({zh:"番茄钟",pages:Object.freeze(["pomodoro"]),hooks:Object.freeze([["pomfocus","专注视频整页，底纹与视频铺满外壳"],["pomkind","设置桌上「倒计时 / 正计时 / 循环番茄」那一排（data-on=\"1\" 是选中的）"],["pommemo","便签里「从待办里挑」那一排"],["pomsneak","「溜号会被发现」那一格开关（data-on=\"1\" 开着）"],["pomhis","专注页左上「TA 在：…」那一行"],["pomgoal","收桌单子下面「做完了吗」那张便签"],["pomcal","记录页里最近八周的专注日历"],["pomcalask","日历下面「让TA点评一下」那颗键"],["pomcalnote","日历下面TA那句点评"],["pompoke","轻戳画面显示字幕的透明按钮"],["pomsubtitle","模式字幕与独立听这句按钮"],["pomtimer","底部发条倒计时与暂停控制"],["pommore","手动补充陪伴话与回看入口"],["pomvideoentry","动态陪伴图制作入口"],["pomvideoeditor","动态陪伴图整页外壳"],["motionstrip","动态形象编辑页顶上那条胶片（平时／专注时／通话时，data-on=\"1\" 是选中那格）"],["pomarchive","往期「坐过的那些」整页"],["pomarchtabs","往期顶上那排桌牌（按谁坐对面分）"],["pomarchrow","往期里的一张单子（data-done=\"1\" 是坐满了）"],["pomarchsum","往期顶上那行合计（坐了多久／几场／几场坐满）"],["pomvideostage","循环视频画面，视频保持静音、语音独立播放"]])}),
    Object.freeze({zh:"电台",pages:Object.freeze(["radio"]),hooks:Object.freeze([
      ["radioframe","电台整页底纹与颜色（--rl-ink/--rl-accent）"],["radiomodes","收音机的模式按键排"],
      ["radioreceiver","调频接入面板"],["radiodial","频率刻度与指针"],["radiostage","接入后的全屏单句舞台（data-speaking/data-ended/data-long）"],
      ["radioportrait","说话人头像与信号环"],["radiowave","语音播放指示，只有实际播放时起伏"],
      ["radiocaption","屏幕当前一句"],["radiostatus","单句/整段结束提示"],["radiotools","舞台底部朗读/收藏/聊聊"],["radiotape","录音架和共同节目的磁带标签"]
    ])}),
    Object.freeze({
      zh: "聊天页", pages: Object.freeze(["thread", "gthread"]),
      hooks: Object.freeze([
        ["chat", "聊天页整块背景"], ["body", "正文区背景"],
        // 「Ta 眼里」那页：聊天里点顶栏名字 → Ta 眼里（群友 2026-10-05：「这个和关于我/关于我们有挂点嘛」）
        ["gazepage","整页那张手记底（data-side=\"me\" 关于我 / \"us\" 关于我们）"],["gazetitle","右上角「关于我/关于我们」大字"],
        ["gazetab","两条布书签（data-on=\"1\" 是选中的）"],["gazestatus","书签下面那行复看说明小字"],
        ["gazecard","每一块便签（data-k＝me.person 这类块名；data-empty=\"1\" 还没写）"],["gazecardname","便签标题"],["gazecardtext","便签正文"],["gazecardtime","便签底下「N 天前写的」"],
        ["gazebtn","底下的按钮（data-kind＝review 再看一遍 / redo 整份重写 / history 从前那几版 / seed 第一次写）"],
        ["gazelock","信纸里「锁住这块」（data-on＝1 已锁）"],
        ["gazedelver","信纸里删掉一版（data-part＝now 现在这版 / old 旧的那版）"],
        ["gazeusever","信纸里旧版底下的「用这版」"],
        ["gazelockmark","卡片右上「已锁」小字"],
        ["gazeletter","点开一块后的那张信纸"],["gazehistory","「从前都怎么写的」那张总表"],
        ["chathead", "顶栏整条"], ["headink", "顶栏主字与图标"], ["headdim", "顶栏次要小字"],
        ["headme", "顶栏里她自己的头像（单聊；默认 display:none，写 display:inline-flex 打开就是双人头像）"],
        ["htmlcard", "消息里那种小卡片（角色发的排版卡，iframe 本体）"],
        ["headname", "顶栏名字那一块（备注＋底下小字；开了双人头像被挡住就挪它，例如 margin-left:8px）"],
        ["now", "顶栏底下那条此刻日程"], ["nowdot", "日程条前面那个小点"],
        ["row", "一整行消息（含头像）"], ["avatar", "头像"],
        ["bubble", "气泡本体（data-me=\"1\" 是她的；data-kind＝text/voice/photo…；长按菜单里那一颗带 data-preview=\"1\"）"],
        ["msg", "一条消息：data-me；data-first/data-last＝连发那一串的头/尾（\"1\"是）；data-kind；data-recent=\"1\" 刚进来（做入场动画）"],
        ["messagesource", "游戏对话上方的世界来源（data-world区分世界；旧记录显示来源未记录）"],
        ["name", "气泡上面那行名字（单聊默认藏着，排版里能打开）"],
        ["meta", "气泡边上的时间/已读那一小行"], ["time", "中间那条日期分隔"],
        ["note", "系统小字（撤回、进房这类）"], ["noteink", "系统小字的字色"],
        ["narr", "居中那行旁白／动作（data-me=\"1\" 是她做的）"], ["narrink", "旁白那行字本身"],
        ["sameroom", "顶栏那个「同处一室」键（data-on=\"1\" 是开着）"],
        ["card", "气泡里的卡片（照片、转发、语音）"],
        ["bdayletter", "生日零点那封信（信封卡）"],
        ["bdayplan", "生日暗中准备的封口信封"],
        ["offlogrestore", "「线下经过」卡上那颗「放回往期」"],
        ["gunreadjump", "群聊顶上那颗「↑ N 条新消息」（点了跳到第一条没看的）"],
        ["gnewbelow", "群聊里你在上面看时，底下那颗「↓ N 条新消息」"],
        ["quote", "消息引用块（带 data-me；输入框上面那条待发送的引用也是它，多带 data-draft=\"1\"）"], ["quotedraft", "输入框上面那一整条待发送的引用"], ["quoteclear", "待发送引用右边那个 ×"], ["quoteicon", "引用块前面那个 ❝"], ["quotetext", "引用的那句原话"], ["voice", "语音消息整块"], ["voicebar", "语音条"],
        ["translation", "外语正文和翻译区"], ["translatebutton", "翻译/收起键"], ["translatebody", "展开后的译文"],
        ["transfercard", "转账卡整张（那张纸的底、边、圆角）"], ["transferamount", "转账卡上的金额"], ["transferlabel", "转账卡左上角「转账／收款／退还」那几个字（想换成别的字：font-size:0 再用 ::after 写 content）"],
        ["transfernote", "转账卡上的附言那一行"], ["transferseal", "转账卡上那枚印章"],
        ["photocard", "照片卡整张（相纸的底、边、影）"], ["photocap", "照片底下那行配文"],
        ["photoface", "没真图的照片卡里那块相面（米色渐变那块，改色写 background）"], ["phototext", "相面上那句描述的字"], ["photohint", "照片卡右下「点开看这张」"],
        ["composer", "底部输入栏整条"], ["narrbar", "旁白模式时输入栏上面那一条（两档＋还在生效的便签）"], ["narrkind", "旁白那两档「此刻发生了什么／往后的方向」（data-on=\"1\" 选中）"], ["dirlong", "「管接下来两轮／整场有效」那颗切换"], ["dirnote", "一条还在生效的方向便签"], ["chatback", "返回键"], ["wxcard", "聊天里的天气小卡片整张（data-kind＝sun/partly/cloud/fog/rain/storm/snow）"], ["wxcardsky", "天气卡上半截那块天"], ["wxcardtemp", "天气卡上的大字气温"], ["wxcardrain", "天气卡上的降雨概率小签"], ["wxcardsay", "天气卡下半截TA那一句叮嘱"], ["chatmore", "右上角更多/设置键"],
        ["chatplus", "输入栏加号键"], ["chatinput", "输入框"], ["send", "发送键"], ["chatreply", "让 TA/他们回复的 AI 键"],
        ["chatpanel", "点＋弹出来的那整块面板（底色、上边线、内边距；群友 2026-10-06 要的）"],
        ["chattool", "加号面板工具键（data-chat-tool 区分 voicemsg／sticker 等）"],
        ["chattoolicon", "加号面板每个键上面那个方块（底色、边框、圆角、大小；也带 data-chat-tool）"],
        ["chattoolglyph", "方块里的图标（svg：stroke 换颜色；换图就先 svg { display:none }，给这一格写 background）"],
        ["chattoollabel", "键底下那行字"],
        // 点头像那张心声卡（她 2026-09-22 转群里读者：「那个卡片不可以美化的嘛？」）
        ["statecard", "点头像那张心声卡整张"], ["statehead", "心声卡抬头（头像·名字·此刻心情）"],
        ["stateseen", "心声卡「看得见的」那一段（穿着＋动作）"], ["statevoice", "心声卡「心里想的」那一块"], ["statevoicedel", "心声卡上每条心声旁边的「删」"], ["statevoiceclear", "心声卡翻旧的那页顶上的「清空」"],
        ["stateaff", "心声卡底下好感那一整行（心＋好感度那几个字）"],
        // 那颗心拆开（她 2026-10-05：「要可以改图案」）：换形状写在 stateheart 上的 --sc-heart-mask，四层一起变
        ["stateheart", "好感那颗心整颗（换图案：--sc-heart-mask: url(图)；颜色 --sc-heart-ink）"], ["stateheartline", "心的描边那一圈"],
        ["stateheartbase", "心里没灌满的那块底"], ["stateheartfill", "心里灌进去的那块（水位）"], ["stateheartnum", "心中间那个好感数字"],
        // 拉黑时气泡旁那颗红色感叹号（她 2026-10-01：「跟微信一样，然后加一个美化挂点」）
        ["blockdot", "拉黑中气泡旁那颗红色感叹号（data-me=\"1\" 是她那边的）"],
        // 时刻「发给 TA」那张小卡（她 2026-10-03）——挂在聊天页这一组，聊天页的 CSS 才抓得到它
        ["shikeshare", "聊天里那张「时刻」小卡（你从时刻里「发给 TA」的，和 TA 自己存进时刻时落的那张）"],
        // 番茄钟收桌后 TA 放进私聊的那张小卡（群里 2026-10-05）
        ["pomoshare", "聊天里那张「一起专注」小卡（番茄钟收桌后 TA 发来的；data-done=\"1\" 是坐满了）"],
        // 拉黑提示条和解除申请卡（她 2026-10-03：「拉黑的提示搞点挂点」）
        ["blockbar", "拉黑时顶上那条提示（data-who＝me 她拉黑了TA／them TA拉黑了她）"], ["blockbaricon", "提示条左边那个禁止圈"],
        ["blockbartitle", "提示条第一行（谁拉黑了谁）"], ["blockbarhint", "提示条第二行（现在能做什么）"], ["blockbarbtn", "提示条右边的「解除」键"],
        ["filecard", "聊天里发的文件卡整张"], ["filename", "文件卡上的文件名"], ["filebody", "点开后的文件内容"],
        ["sysnote", "聊天里那张系统小纸条（data-kind＝block 拉黑／解除那几张，其余 system）"], ["sysnotelabel", "纸条上「系统／拉黑」那行小字"],
        ["sysnotetext", "纸条正文"], ["sysnoteclose", "纸条右上角那个 ✕"],
        ["unblockcard", "解除拉黑申请卡（data-from＝char TA发的／me 她发的；data-state＝pending/accepted/declined）"],
        ["unblocktitle", "申请卡上「解除拉黑申请」那行小字"], ["unblockbody", "申请理由正文"], ["unblockbtns", "「拒绝／接受」那一排"], ["unblockstatus", "已接受／已拒绝那行状态"],
        // TA写的情侣申请信（她 2026-10-02：「开个美化挂点给他」）
        ["letter", "申请信整张（data-state＝sealed 封着／open 拆开没回／accepted／declined）"],
        ["letterseal", "封着时上半截信封那块（背景、那道折痕）"], ["letterstamp", "信封正中那枚封口的心"],
        ["lettercover", "封着时底下那行「XX给你写了一封信 · 轻点拆开」"],
        ["letterbody", "拆开后信的正文"], ["letterbtns", "「再想想／答应」那一排"],
        // 线下（单人、群都走这一套，她 2026-09-30：「整体美化都要」）
        ["offline", "线下整页（最外那层）"], ["offbody", "线下正文滚动区"], ["rerollpress","「重写」那一下（长按菜单那一行、线下卡片的 ↻）：点一下照常重写，长按给方向"],["offnarrpill","线下输入框旁「旁白 ✕」（正在写旁白）"],["offnarrbtn","线下幕后面板「切到旁白」"],["offcomposer", "线下底部输入栏"],
        ["offmsg", "线下一段（data-me=\"1\" 是她写的）"], ["offcard", "线下那张卡片本体"], ["offhead", "卡片顶上那行（头像·名字·时间）"],
        ["offname", "卡片上的名字"], ["offtext", "线下正文"], ["offsay", "正文里引号那几句台词"], ["offthought", "线下的心声那块"], ["offcastfaces", "群线下整段小说那一拍左上角叠着的头像，点开选看谁的心声"], ["offcastpick", "选看谁的心声那一排；里面每个按钮 data-on=1 是选中的"], ["goffwritemode", "群线下设置「写法」两个按钮；data-on=1 是当前选中"],
        ["offnarr", "线下旁白（data-short=\"1\" 是居中那种短的）"],
        // 通话
        ["call", "通话整页（data-video=\"1\" 是视频）"], ["callhead", "通话顶上那块"], ["calltitle", "通话标题（名字）"],
        ["callavatar", "通话中间的大头像"], ["callcamera", "用户真实摄像头小窗与开关/前后镜头切换"], ["callbody", "通话字幕滚动区"], ["callmsg", "通话里一句（带 data-me）"],
        ["callbubble", "通话里那句的气泡"], ["callact", "通话里的动作那行"], ["halfwin", "半窗聊天整块（底下那半屏）"], ["gsetpage", "群聊设置那一整页"], ["halfwinbar", "半窗顶上「放大 / 收起」那一条"], ["halfwinsize", "半窗顶条正中那根调大小的小横杠"], ["halfwinpill", "半窗收起后底下那颗小条"], ["calltf", "通话里转账那一行（带收下/退回）"], ["callactkey", "视频打字框左边那颗「动作」键（data-on=\"1\" 开着）"], ["callcomposer", "通话底部那一整块"], ["callbtns", "底下那一排大按键"], ["callmic", "说话键"], ["hangup", "挂断键"],
        ["callstage", "单人视频铺满全屏的那层（TA 或你）"], ["callpip", "单人视频右上角那个小框"], ["calltypekey", "打字键"], ["calltype", "点打字才出来的那行输入框"]
      ])
    }),
    // 星测（v74.732）：整页是一片夜空，挂点都在这一页
    Object.freeze({
      zh: "星测", pages: Object.freeze(["astro"]),
      hooks: Object.freeze([
        ["astrotabs", "顶上那条星座连线（今日／配对／星盘／群榜／问星）"], ["astrowheel", "星盘页那张圆盘"], ["astroyear", "星盘页「这一年」（太阳回归）"], ["astrogood", "配对里「星星点头的日子」"], ["astrorank", "群榜里的一行配对"], ["astroask", "问星的答案"], ["astrosky", "今日页那行天象"], ["phoneastro", "查手机里 TA 那页星测（整页）"], ["astroshare", "聊天里那张「今日签」小卡"], ["astromoon", "今日页「月亮日记」"], ["astrohalo", "星星点头那天聊天顶栏头像外那圈星光"], ["astrocard", "每一块卡片"],
        ["astrolucky", "幸运色那一格"], ["astrosyn", "配对里「合盘」那一段"], ["astrosign", "配对里「星座配对」那一段"], ["astroshuku", "配对里「星宿关系」那一段"],
        ["astronote", "TA看完说的那段话"]
      ])
    }),
    // 健康（v74.732）：坐标纸底、心电图 tab
    Object.freeze({
      zh: "健康", pages: Object.freeze(["health"]),
      hooks: Object.freeze([
        ["healthtabs", "顶上那条心电图（今天／身体／这周）"], ["healthcard", "每一段"], ["healthsum", "热量环和三大营养素那一块"],
        ["healthmeals", "吃了什么那一段"], ["healthhabit", "今天最底下的小习惯（勾一勾那几样）"], ["healthpact", "这周里跟 TA 立的约（一排圆点）"], ["healthweekly", "这周里每周一封小结那一段"], ["healthwater", "喝水那一排杯子"], ["healthsport", "动了动那一段（运动和步数）"], ["healthsync", "今天最上面「手机健康 · 导入」那一行"], ["healthimport", "从手机健康导入那一页"], ["healthhome", "谁看着里「家在哪」那一段"], ["healthgateway", "谁看着里「我有自己的网关」那一段"], ["healthgatewayguide", "搭一个自己的网关那一页"], ["healthsleep", "睡觉那一段"], ["healthmood", "心情那五张脸"],
        ["healthweight", "体重那一段"], ["healthperiod", "经期那一段"], ["healthweek", "七天的热量柱"], ["healthnote", "TA看完这周说的话"]
      ])
    }),
    // 主屏（v65.05，她 2026-09-06：「主题台的 css 还是不显示」）。
    // ⚠️病根不是主题台坏了——是主屏上【一个挂点都没有】，只有最外那层 app。
    //   给主屏写的 CSS 因此抓不到任何东西，写得再对也一条不生效。
    Object.freeze({
      zh: "主屏", pages: Object.freeze(["home"]),
      hooks: Object.freeze([
        ["icon", "app 图标那一格（文件夹也是）"], ["iconlabel", "图标底下那行字"],
        ["dock", "底部 dock 那一条"],
        ["shikeotd", "主屏上那张「去年今天」小卡（时刻）"],
        ["widget", "组件卡那一格（天气、音乐、木鱼这些）"], ["decor", "装饰那一格"],
        ["homeclock", "顶上时钟那一块"], ["homeclockink", "时钟的数字"], ["homedate", "时钟底下那行日期"],
        ["pager", "页码点那一行"], ["pagerdot", "单个页码点（data-on=\"1\" 是当前页）"],
        // 组件里面（她 2026-10-08：「具体组件也要挂点」）：一套共用的名字，哪个组件用 [data-wk="widget"][data-appkey="w_music"] 这样圈
        ["wtitle", "组件里的标题／大字（月份、温度、歌名、备忘录、名字、功德数）"], ["wsub", "次要小字（年份、天气描述、地点、歌手、签名、说明；data-part 区分）"],
        ["wlabel", "小眉标（本月支出、最近提醒、正在播放、功德、单位字、标签行）"], ["wnum", "醒目的数字或金额（支出、在一起天数、统计数、连击、倒数日）"],
        ["wrow", "组件里列表的一行（备忘条目 data-late=\"1\" 是逾期）"], ["wcell", "日历组件里的一个日子格（data-today=\"1\" 是今天）"], ["wdow", "日历组件顶上的星期格"],
        ["wbtn", "组件里的按钮（data-part＝prev/next/play/muyu）"], ["wxshare", "天气页底下「让他们知道我这边的天气」整块"], ["wxshareon", "那块里的总开关（data-on＝1 开着）"], ["wxsharenudge", "「会主动提醒」开关"], ["wxsharewho", "谁知道：一个人的小签（data-on＝1 勾上了）"], ["wicon", "组件里的装饰图标、唱片、头像、转盘、照片（data-part 区分）"],
        ["wbar", "音乐组件的进度条"], ["wempty", "组件没内容时那句提示"], ["wpop", "木鱼飘起来的「+1 功德」"], ["wdots", "情侣空间组件轮播的小圆点"]
      ])
    })
  ]);
  // ── 这一页单独换几支色（v65.06）────────────────────────────────────
  // 她 2026-09-06：「全部能做主题的页面秋秋都应该可以改」。
  // ⚠️挂点（data-wk）救不了这件事：全 App 九十来页的卡片、按钮、列表都是
  //   各页自己内联写的，没有共用组件——一页一页去挂是挂不完的，也正是
  //   mobile-ui-layout.md 说的「补法不该是一页一页补」。
  //   但它们的颜色【全都是从 useTheme() 那一份 token 里取的】，而 token 只在
  //   ThemeContext.Provider 那一处发出去。所以换个法子：不改 CSS，改那一页拿到的 token。
  //   一处改，那一页所有东西跟着变——不需要任何挂点，也就每一页都成立。
  const TOKENS = Object.freeze([
    ["bg", "这一页的底色"], ["bg2", "卡片和面板的底色"],
    ["ink", "主要文字"], ["sub", "次要文字"], ["fog", "更淡的小字"],
    ["line", "分隔线与描边"], ["accent", "强调色（那一抹红）"], ["tint", "点缀色（那一抹蓝）"]
  ]);
  const TOKEN_KEYS = Object.freeze(TOKENS.map(x => x[0]));
  // 颜色只收这几种写法：它最后是被当成【行内样式的值】用的，不许夹带别的声明。
  const okColor = v => /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(String(v || "").trim())
    || /^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(String(v || "").trim())
    || /^[a-z]{3,20}$/i.test(String(v || "").trim());
  // ── 一页一个大小（她 2026-09-20：「字体大小能不能自定义啊每一个 app 单独，
  //    就跟 css 一样可以每个 app 单独调，然后做拉条选大小」）────────────────
  // ⚠️为什么是 zoom 而不是 font-size：这个 App 的字号【全是内联 px】（fontSize: 13 这种），
  //   而内联样式压得过任何样式表规则；就算用 !important 硬压，那也是把满页大小不一的字
  //   统统拍成同一个数——版面当场就塌了。要按【比例】放大，CSS 里唯一压得住内联 px 的
  //   就是 zoom：它是整块一起缩放，字、头像、间距按原比例一起变大，版面不会乱。
  //   所以这一格的名字叫「这一页多大」，不叫「字号」——它放大的是整页，不只是字。
  const ZOOM_MIN = 0.8, ZOOM_MAX = 1.4;
  const okZoom = v => { const n = Number(v); return isFinite(n) && n >= ZOOM_MIN && n <= ZOOM_MAX; };
  const cleanZoom = obj => {
    const out = {};
    Object.keys(obj || {}).forEach(k => {
      const key = String(k).replace(/[^a-zA-Z0-9_-]/g, "");
      if (!key) return;
      const n = Math.round(Number(obj[k]) * 100) / 100;
      // ⚠️主屏不放大（群友 2026-10-09：拉了「全 App 多大」以后，主屏最底下那排连设置一起被挤出屏幕，
      //   再也点不到设置改回来）。主屏是按一屏高度排死的（home-screen-layout），它也是唯一的出口——
      //   「全 App」那一条跳过主屏，单给主屏的那一条直接不收。
      if (key === "home") return;
      if (okZoom(n) && n !== 1) out[key] = n;   // 1 就是没调过，不必存
    });
    return out;
  };
  const zoomFor = page => (cleanZoom((current() || {}).pageZoom))[page] || 1;
  const cleanTokens = obj => {
    const out = {};
    Object.keys(obj || {}).forEach(k => {
      if (TOKEN_KEYS.indexOf(k) < 0) return;
      const v = String(obj[k] || "").trim();
      if (v && okColor(v)) out[k] = v;
    });
    return out;
  };
  // ⚠️问的是【此刻正生效的那一份】(active)，不是存档里那份：
  //   「先预览 30 秒」改的就是 active，读存档的话预览时这一页的颜色纹丝不动。
  const tokensFor = page => cleanTokens(((current() || {}).pageTokens || {})[page]);
  // 还不能用 pagecolor 的表：助手和工作台都读这一份。
  // 梦境及六个自带材质的页面已通过 core.js 的 pagePalette/pageColor 接入。
  // 地图瓦片属于地图服务本身，页面主题不重染地理图层。
  const OWN_PALETTE = Object.freeze({
    map: "那块底是地图本身（它就该是地图的颜色）"
  });
  // ⚠️没有覆盖时【原样把 base 还回去】：换个对象身份会让整棵树白重渲染一遍。
  //   有覆盖时也按 (页 + 那几支色 + base) 记一份，免得每次渲染都新造一个。
  let tfKey = "", tfVal = null;
  const themeFor = (page, base) => {
    const t = tokensFor(page);
    const keys = Object.keys(t);
    if (!keys.length) return base;
    const key = String(page) + "|" + JSON.stringify(t) + "|" + JSON.stringify(base || {});
    if (key === tfKey && tfVal) return tfVal;
    tfKey = key; tfVal = { ...(base || {}), ...t };
    return tfVal;
  };
  const SLOT_KEY = "x_themeCssSlots";
  // ⚠️她 2026-09-11：「页面 css 现在只能 5 套，改成可以自定义再加吧，然后可以 ❌ 删除」。
  //   原来是【五个固定格子】：存在第几格是数据的一部分，删掉一格留一个空洞。
  //   现在是【一摞，想加就加】：存＝往后添一套，删＝真的从这摞里拿掉。
  //   SLOT_MAX 留着当【上限】而不是【格数】：localStorage 是有限的，一页存到几十套
  //   就该拦一下，但那是防呆，不是她能存几套的规定。
  const SLOT_MAX = 40;
  const loadSlots = () => { try { const v = JSON.parse(localStorage.getItem(SLOT_KEY) || "{}"); return (v && typeof v === "object") ? v : {}; } catch (_) { return {}; } };
  // 老存档里是定长五格、空格记成 null（v61.05～v66.88）：读的时候把空洞挤掉就行，
  // 她存过的那几套一套都不会丢。
  const pageSlots = page => {
    const a = loadSlots()[page];
    return (Array.isArray(a) ? a : []).filter(x => x && typeof x === "object").slice(0, SLOT_MAX);
  };
  const writeSlots = (page, a) => {
    const all = loadSlots();
    all[page] = a.slice(0, SLOT_MAX);
    try { localStorage.setItem(SLOT_KEY, JSON.stringify(all)); } catch (_) {}
    return all[page];
  };
  const slotRow = (name, css, i) => ({ name: String(name || ("预设 " + (i + 1))).slice(0, 12), css: String(css || "") });
  // 添一套：存到这一摞的末尾
  const addSlot = (page, name, css) => {
    const a = pageSlots(page);
    if (a.length >= SLOT_MAX) return a;                       // 到顶了就原样返回，调用方照这个数报一句
    return writeSlots(page, a.concat([slotRow(name, css, a.length)]));
  };
  // 盖掉第 i 套（改名／重存都走它）
  const saveSlot = (page, i, name, css) => {
    const a = pageSlots(page);
    if (i < 0 || i >= a.length) return addSlot(page, name, css);
    a[i] = slotRow(name, css, i);
    return writeSlots(page, a);
  };
  // 删掉第 i 套：真的从这摞里拿掉，不留空格
  const clearSlot = (page, i) => {
    const a = pageSlots(page);
    if (i < 0 || i >= a.length) return a;
    a.splice(i, 1);
    return writeSlots(page, a);
  };
  // ── 内置整套图标（v62.42，她 2026-09-04：「能不能直接把我发给你的单个图标套进去做一套预设皮肤，
  //    随时可以用或者切换成别的」）──
  // 一套＝仓库里 img/icons/<套名>/<appKey>.webp 一叠文件 + 这里一行登记（收图用 scripts/icon-pack-add.py）。
  // 「她自己换的那一张」永远压在整套之上（appIconSrc 的顺序：她换的 → 当前整套 → 自带图 → 线稿），
  // 所以换整套不会把她单独调过的那几张盖掉。
  // ⚠️keys 必须跟目录里真有的文件一致——写了没文件就是一个 404 空框。
  //   test/icon-packs-62-42.test.js 钉着这一条：每个登记的 key 在盘上都得有那张 webp。
  // bare：这一套的图自带底（玻璃方块、圆角都画在图里）。选了它就默认不再套主屏那块玻璃，
  //   不然是两层玻璃叠着；她照样可以在工作台里把那个开关拨回去。
  const ICON_PACKS = {
    autumn: { name: "秋叶", dir: "img/icons/autumn/", bare: true, keys: ["anon", "assistant", "carry", "cast", "config", "cwallet", "debate", "diary", "dream", "dreamjournal", "dwell", "fairyGarden", "fanfic", "forum", "games", "impression", "lore", "loungeapp", "memlib", "messages", "phone", "pomodoro", "read", "rescue", "shop", "study", "stylelab", "tarot", "theater", "ties", "trpg", "vpscodex", "weekly", "yanqiu"] }
  };
  const packList = () => Object.keys(ICON_PACKS).map(k => [k, ICON_PACKS[k].name, ICON_PACKS[k].keys.length]);
  const packIconSrc = (packKey, appKey) => {
    const pk = ICON_PACKS[packKey]; if (!pk || !appKey) return "";
    return pk.keys.indexOf(appKey) > -1 ? pk.dir + appKey + ".webp" : "";
  };
  const fresh = () => ({ version: 1, name: "我的主题", icons: {}, iconPack: "", iconBare: false, fonts: { body: "", display: "" }, customFonts: [], globalCSS: "", pageCSS: {}, pageTokens: {}, pageZoom: {}, updatedAt: 0 });
  const normalize = raw => {
    const x = raw && typeof raw === "object" ? raw : {};
    const iconPack = ICON_PACKS[x.iconPack] ? String(x.iconPack) : "";
    const pageTokens = {};
    Object.keys(x.pageTokens || {}).forEach(k => { const c = cleanTokens(x.pageTokens[k]); if (Object.keys(c).length) pageTokens[k] = c; });
    const pageZoom = cleanZoom(x.pageZoom);
    // 字体那两支照 FontChoice 洗（认不出的落回默认）；它没加载出来就当没挑过。
    // ⚠️顺序要紧：先把她自己传的那几支洗干净，再拿【洗完的名单】去认那两支——
    //   反过来的话，删掉一支自定义字体之后，变量还指着一个不存在的字族。
    const customFonts = g.FontChoice ? g.FontChoice.customList(x.customFonts).map(f => f.custom) : [];
    const fonts = g.FontChoice ? g.FontChoice.clean(x.fonts, customFonts) : { body: "", display: "" };
    return { ...fresh(), ...x, icons: { ...(x.icons || {}) }, iconPack, iconBare: !!x.iconBare, fonts, customFonts, pageCSS: { ...(x.pageCSS || {}) }, pageTokens, pageZoom };
  };
  const load = () => { try { return normalize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (_) { return fresh(); } };
  // 每次正式存之前，把【被盖掉的那一版】留一份（她 2026-10-05：「美化改错了想恢复前一步，现在没办法」）。
  //   秋秋改的、自己手改的都走这一个 save，所以两边都有退路。
  // ⚠️本子是 engine.js 那一本 LookHist（单聊、群聊、线下也记在里面），这里不另记一份；
  //   这一页叫 "theme"。v74.88 那会儿单独记在 x_theme_studio_hist，头一次用时搬进来。
  const HIST_SCOPE = "theme", OLD_HIST_KEY = "x_theme_studio_hist";
  const LH = () => (typeof LookHist === "object" ? LookHist : null);
  const migrateHist = () => {
    try {
      const old = typeof loadJSON === "function" ? loadJSON(OLD_HIST_KEY, null) : null;
      if (!Array.isArray(old) || !old.length || !LH()) return;
      const book = loadJSON(LH().KEY, {}) || {};
      if (!book[HIST_SCOPE]) { book[HIST_SCOPE] = { back: old.slice(0, LH().MAX).map(x => ({ at: x.at, v: x.raw })), fwd: [] }; saveJSON(LH().KEY, book); }
      if (typeof dropStored === "function") dropStored(OLD_HIST_KEY);
    } catch (_) {}
  };
  const save = p => {
    const n = normalize({ ...p, updatedAt: Date.now() });
    const prev = localStorage.getItem(KEY), next = JSON.stringify(n);
    if (prev && LH()) {
      try { migrateHist(); const a = JSON.parse(prev), b = JSON.parse(next); delete a.updatedAt; delete b.updatedAt;
        if (JSON.stringify(a) !== JSON.stringify(b)) LH().note(HIST_SCOPE, prev, next); } catch (_) {}
    }
    localStorage.setItem(KEY, next); return n;
  };
  // 还能退几步、能换回来几步（新的在前）。undoStep("back") 退一步、undoStep("fwd") 把退掉的换回来；
  //   一直点「退一步」就一直往更早退，最多 10 版。
  const histCount = () => { migrateHist(); return LH() ? LH().count(HIST_SCOPE) : { back: 0, fwd: 0, at: 0 }; };
  const history = () => { const c = histCount(); return new Array(c.back).fill(0).map(() => ({ at: c.at })); };
  const undoStep = dir => {
    if (!LH()) return null;
    migrateHist();
    const row = LH().step(HIST_SCOPE, localStorage.getItem(KEY) || "", dir);
    if (!row) return null;
    let p; try { p = JSON.parse(row.v); } catch (_) { return null; }
    clearTimeout(timer); timer = 0; previewBase = null;
    const n = normalize({ ...p, updatedAt: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(n));   // 不走 save：退一步本身不该再记成一次新改动
    return apply(n);
  };
  const restoreHist = () => undoStep("back");
  const unsafeReason = css => {
    const s = String(css || "");
    if (/@(?:import|charset|namespace)\b/i.test(s)) return "不允许 @import / @charset / @namespace";
    if (/javascript\s*:|expression\s*\(|behavior\s*:|-moz-binding/i.test(s)) return "包含不安全的脚本式 CSS";
    let d = 0; for (const c of s) { if (c === "{") d++; else if (c === "}") d--; if (d < 0) return "花括号不配对"; }
    return d ? "花括号不配对" : "";
  };
  // 小型 CSS 扫描器：只给普通规则加页面前缀；keyframes/font-face 保持原样。
  const scopeCSS = (css, scope) => {
    css = String(css || "");
    const bad = unsafeReason(css); if (bad) throw new Error(bad);
    let out = "", pos = 0;
    while (pos < css.length) {
      const open = css.indexOf("{", pos); if (open < 0) { out += css.slice(pos); break; }
      const head = css.slice(pos, open).trim(); let depth = 1, i = open + 1;
      for (; i < css.length && depth; i++) { if (css[i] === "{") depth++; else if (css[i] === "}") depth--; }
      if (depth) throw new Error("花括号不配对");
      const body = css.slice(open + 1, i - 1);
      if (/^@(media|supports|container|layer)\b/i.test(head)) out += head + "{" + scopeCSS(body, scope) + "}";
      else if (/^@(keyframes|-webkit-keyframes|font-face|property|page)\b/i.test(head)) out += head + "{" + body + "}";
      else if (head.startsWith("@")) throw new Error("暂不支持 " + head.split(/\s/)[0]);
      else {
        const sels = head.split(",").map(x => x.trim()).filter(Boolean).map(sel => {
          if (/^(html|body|:root)$/i.test(sel)) return scope;
          // html 自己身上的属性（如 html[data-screen-size="short"]）要贴在 scope 那个 html 上，不是当成它下面的元素——
          //   原来一律把开头的 html 削掉，[data-screen-size] 就被当成 html 里面的某个元素，一条都不生效
          const onHtml = /^html((?:\[[^\]]+\])+)\s*(.*)$/i.exec(sel);
          if (onHtml) return scope + onHtml[1] + (onHtml[2] ? " " + onHtml[2] : "");
          return scope + " " + sel.replace(/^(html|body|:root)\s*/i, "");
        });
        out += sels.join(",") + "{" + body + "}";
      }
      pos = i;
    }
    return out;
  };
  // CSS 里也只保存 iv_ 门牌。真正喂给浏览器前，从图片保险箱换成当次启动的 object URL。
  const cssImageRefs = css => [...String(css || "").matchAll(/url\(\s*(['"]?)(iv_[A-Za-z0-9_-]+)\1\s*\)/g)].map(m => m[2]);
  const resolveCSSImages = css => String(css || "").replace(/url\(\s*(['"]?)(iv_[A-Za-z0-9_-]+)\1\s*\)/g, function (_, q, ref) {
    const src = typeof g.resolveImg === "function" ? g.resolveImg(ref) : "";
    if (!src) throw new Error("图片保险箱里找不到 " + ref);
    return 'url("' + String(src).replace(/["\\\n\r]/g, "") + '")';
  });
  const remapCSSImages = (css, map) => String(css || "").replace(/url\(\s*(['"]?)(iv_[A-Za-z0-9_-]+)\1\s*\)/g,
    (_, q, ref) => 'url("' + (map[ref] || ref) + '")');
  const compile = p => {
    p = normalize(p); const blocks = [];
    const bad = unsafeReason(p.globalCSS); if (bad) throw new Error(bad);
    // 换字体排在最前面：它只写 :root 那两个变量，她自己写的 CSS 想盖照样盖得住。
    const fontCSS = g.FontChoice ? g.FontChoice.cssVars(p.fonts, p.customFonts, g.resolveImg) : "";
    if (fontCSS) blocks.push("/* fonts */\n" + fontCSS);
    if (p.globalCSS) blocks.push("/* global */\n" + p.globalCSS);
    // 大小排在她自己写的 CSS 【前面】：她想在 CSS 里再压一道，照样压得住。
    Object.entries(cleanZoom(p.pageZoom)).forEach(([page, z]) => {
      blocks.push("/* zoom " + page + " */\n"
        + (page === "all" ? 'html:not([data-lisa-screen="home"]) body' : 'html[data-lisa-screen="' + page + '"] body') + "{zoom:" + z + ";}");
    });
    Object.entries(p.pageCSS || {}).forEach(([page, css]) => {
      if (!css || page === "all") return;
      blocks.push("/* " + page + " */\n" + scopeCSS(css, 'html[data-lisa-screen="' + page.replace(/[^a-zA-Z0-9_-]/g, "") + '"]'));
    });
    return resolveCSSImages(blocks.join("\n"));
  };
  let active = load(), previewBase = null, timer = 0;
  const safeMode = () => {
    try { return new URLSearchParams(location.search).get("safe-theme") === "1"; }
    catch (_) { return false; }
  };
  const emit = () => g.dispatchEvent(new CustomEvent("lisa-theme-change", { detail: active }));
  const apply = p => {
    const n = normalize(p), css = safeMode() ? "" : compile(n);
    // 字体文件得真去拉一次，光有变量是空头支票。safe-theme 那一路不拉。
    if (!safeMode() && g.FontChoice) { try { g.FontChoice.ensure(n.fonts, n.customFonts); } catch (_) {} }
    let st = document.getElementById(STYLE_ID);
    if (!st) { st = document.createElement("style"); st.id = STYLE_ID; document.head.appendChild(st); }
    st.textContent = css; active = n; emit(); return n;
  };
  const cancelPreview = () => { clearTimeout(timer); timer = 0; const base = previewBase; previewBase = null; if (base) apply(base); };
  // ms 不传就是 30 秒（工作台里那颗「先预览 30 秒」）。
  // 预览台那一路要传更长的：她是【跳到真页面上去看】，30 秒不够走一圈；
  // 那一路屏幕上一直浮着「回去改」，撤销的口子不靠这个计时器兜。
  const preview = (p, ms) => {
    const span = Number(ms) > 0 ? Number(ms) : PREVIEW_MS;
    if (!previewBase) previewBase = load(); clearTimeout(timer); apply(p);
    timer = setTimeout(cancelPreview, span); return span;
  };
  const commit = p => { clearTimeout(timer); timer = 0; const n = save(p || active); previewBase = null; return apply(n); };
  // 此刻【屏幕上真正生效的】那一份。预览期间它就是那份草稿（apply 会把 active 换掉）。
  // ⚠️预览台那一路必须靠它：她跳出去看一眼再回来，工作台是重新挂载的，
  //   要是照旧 load()，读回来的是【存档里那份】——她刚写的 CSS 当场没了。
  const current = () => active;
  const iconRef = key => (active.icons || {})[key] || "";
  // 当前整套里这个 app 那张图的路径；没选整套、或这套没画这个 app，就是空串
  const packIcon = key => packIconSrc(active.iconPack, key);
  // 图标自带底、不套主屏那块玻璃（只对「有图」的 app 生效，线稿照旧在玻璃上）
  const iconBare = () => !!active.iconBare;
  // ── 主题包分成哪几样（她 2026-09-22：「没有单独导入导出某一种美化的选项」）──
  // 导出挑哪几样、导入勾哪几样、聊天气泡那一页单独收发哪一样，三处都问这一份要。
  // ⚠️各写一份的话，以后加一样（比如贴纸）就只会加在其中一处
  //   —— 导入那头原来就是一张写死在界面里的表（one-public-mechanism）。
  const PACK_PARTS = [
    { key: "css", zh: "页面／全局 CSS" },
    { key: "icons", zh: "图标" },
    { key: "fonts", zh: "字体" },
    { key: "base", zh: "基础配色" },
    { key: "wall", zh: "壁纸" },
    { key: "bubble", zh: "聊天气泡" }
  ];
  const PACK_KEYS = PACK_PARTS.map(x => x.key);
  // 一份包（或一份【当前草稿】，形状一样：{profile, baseTheme, wallpaper, bubbleSkin}）
  // 里这一样到底有没有东西。导出拿它决定能挑哪几样，导入拿它决定能勾哪几样。
  const packHas = (pack, key) => {
    const p = (pack && pack.profile) || {};
    if (key === "css") return !!(p.globalCSS || Object.keys(p.pageCSS || {}).length || Object.keys(p.pageTokens || {}).length || Object.keys(p.pageZoom || {}).length);
    if (key === "icons") return !!(p.iconPack || Object.keys(p.icons || {}).length);
    if (key === "fonts") return !!((p.fonts && (p.fonts.body || p.fonts.display)) || (p.customFonts || []).length);
    if (key === "base") return !!(pack && pack.baseTheme);
    if (key === "wall") return typeof (pack && pack.wallpaper) === "string" && !!pack.wallpaper;
    if (key === "bubble") return !!(pack && pack.bubbleSkin);
    return false;
  };
  const packParts = pack => PACK_PARTS.map(x => ({ key: x.key, zh: x.zh, has: packHas(pack, x.key) }));
  // 没传 pick 就是整套都要（存量那条路一个字都不用改）
  const cleanPick = pick => {
    const out = {};
    PACK_KEYS.forEach(k => { out[k] = pick && typeof pick === "object" ? !!pick[k] : true; });
    return out;
  };
  // 只留她挑的那几样：没挑的退回出厂空值，而不是留在包里
  // （留着的话，对面勾一下「图标」就会连着把没打算给的 CSS 一起装走）。
  const pickProfile = (profile, sel) => {
    const blank = fresh(), p = normalize(profile);
    return Object.assign({}, p, {
      globalCSS: sel.css ? p.globalCSS : blank.globalCSS,
      pageCSS: sel.css ? p.pageCSS : blank.pageCSS,
      pageTokens: sel.css ? p.pageTokens : blank.pageTokens,
      pageZoom: sel.css ? p.pageZoom : blank.pageZoom,
      icons: sel.icons ? p.icons : blank.icons,
      iconPack: sel.icons ? p.iconPack : blank.iconPack,
      iconBare: sel.icons ? p.iconBare : blank.iconBare,
      fonts: sel.fonts ? p.fonts : blank.fonts,
      customFonts: sel.fonts ? p.customFonts : blank.customFonts
    });
  };
  // 包的名字：导出一律写 qq-theme（2026-10-08 起，原来那个名字带着人名，传到小窝里谁都看得见）；
  //   导入两个都认——她们手上存着的老文件还得能导进来。
  const PACK_KIND = "qq-theme", PACK_KINDS_READ = [PACK_KIND, ["lis", "a-theme"].join("")];
  const exportPackage = async extras => {
    const sel = cleanPick(extras && extras.pick);
    const profile = pickProfile(extras && extras.profile || load(), sel), assets = {};
    const cssRefs = cssImageRefs(profile.globalCSS).concat(...Object.values(profile.pageCSS || {}).map(cssImageRefs));
    // 她自己传的字体文件也在同一个保险箱里，所以它跟图标走同一条打包路（one-public-mechanism）。
    const fontRefs = g.FontChoice ? g.FontChoice.fileRefs(profile.fonts, profile.customFonts) : [];
    const refs = [...new Set([...Object.values(profile.icons || {}), sel.wall ? (extras && extras.wallpaper) : "", ...cssRefs, ...fontRefs].filter(x => /^iv_/.test(x)))];
    for (const ref of refs) {
      try {
        const blob = await g.imgVaultFetchBlob(ref);
        if (blob) assets[ref] = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
      } catch (_) {}
    }
    // 气泡皮肤（她 2026-09-20：「界面美化分享给别人」）——它不住在 profile 里，
    // 是单独一份存档，所以这儿显式带上；对面导入时默认不盖，勾了才盖。
    const bubbleSkin = sel.bubble && extras && extras.bubbleSkin ? extras.bubbleSkin : null;
    return JSON.stringify({ kind: PACK_KIND, format: 1, exportedAt: new Date().toISOString(), profile,
      baseTheme: sel.base ? (extras && extras.baseTheme) : undefined,
      wallpaper: sel.wall ? (extras && extras.wallpaper) : undefined,
      bubbleSkin, assets }, null, 2);
  };
  // 导进来的那份到底是什么——认得出几种常见的走错门，各给一条出路
  const whatIsThis = text => {
    const t = String(text || "").replace(/^\uFEFF/, "").trim();
    if (!t) return "这份是空的，什么都没读到";
    if (/^PK/.test(t)) return "这是一个压缩包（.zip）：先在「文件」里点开解压，再选里面那个 .json";
    if (/^</.test(t)) return "这是一个网页，不是主题包：多半是转发时被换成了预览页，请让对方直接发原文件";
    if (/[{}]/.test(t) && /[a-z-]+\s*:\s*[^;{}]+;/i.test(t))
      return "这是一份 CSS，不是主题包：去「设置 → 这个 app 长什么样 → 主题工作台」，把它整份贴进「全局 CSS」那一格（只管聊天页的就贴进聊天页那格）";
    return "读不懂这份文件：这里只认这个 app「导出」存出来的那种 json 文件";
  };
  const importPackage = async text => {
    // 读不懂的时候说人话（群友 2026-10-05：把一整份 CSS 当气泡导，弹的是「Unexpected token P in JSON」）。
    //   气泡、主题包两个导入口都走这一处，所以只在这儿认一次。
    let pkg;
    try { pkg = JSON.parse(text); } catch (_) { throw new Error(whatIsThis(text)); }
    if (!pkg || PACK_KINDS_READ.indexOf(pkg.kind) < 0) throw new Error("这不是这个 app 导出的主题包或气泡包（得是「导出」按钮存出来的那种 json 文件）");
    const map = {};
    for (const [oldRef, data] of Object.entries(pkg.assets || {})) { try { map[oldRef] = await g.imgToVault(data); } catch (_) {} }
    const p = normalize(pkg.profile); Object.keys(p.icons).forEach(k => { if (map[p.icons[k]]) p.icons[k] = map[p.icons[k]]; });
    // 字体文件进了新机器的保险箱，键会变——不换过来的话，导进来的主题字体是哑的
    (p.customFonts || []).forEach(f => { if (f && map[f.ref]) f.ref = map[f.ref]; });
    p.globalCSS = remapCSSImages(p.globalCSS, map);
    Object.keys(p.pageCSS || {}).forEach(k => { p.pageCSS[k] = remapCSSImages(p.pageCSS[k], map); });
    const bubbleSkin = pkg.bubbleSkin && typeof pkg.bubbleSkin === "object" ? pkg.bubbleSkin : null;
    return { profile: p, baseTheme: pkg.baseTheme, wallpaper: map[pkg.wallpaper] || pkg.wallpaper, bubbleSkin };
  };
  // 「复制给别的 AI」（群友 2026-09-30：把主题发给 DeepSeek，它说「这是空壳代码、你没有 html」）。
  //   页面是运行时拼的，本来就没有一份 html 能给；别的 AI 缺的是【挂点表】和【写法规矩】。
  //   这里把她现在的 CSS、这一页能抓的全部挂点、规矩打成一段话，她整段粘过去就能改。
  // 「换手机不走样」那几条现成写法：数值照 App 现在用的。挂点选择器的按钮和「复制给别的 AI」都读这一份。
  function sizePresets(page) {
    const chat = page === "thread" || page === "gthread";
    return (chat ? [
          ["顶部按屏幕高度留白", "给顶上的装饰图让位，高手机留得多、矮手机留得少", '[data-wk="body"] {\n  padding-top: calc(var(--app-vh) * 12) !important;\n}'],
          ["气泡最宽占屏幕七成", "换宽屏、窄屏，气泡都不会撑得太满", '[data-wk="bubble"] {\n  max-width: calc(var(--app-w) * 0.72) !important;\n}'],
          ["背景图随手机铺满", "背景图不会在长手机上露白边、也不会被拉变形", '[data-wk="chat"] {\n  background-size: cover !important;\n  background-position: center !important;\n}'],
          ["小屏手机字小一号", "只在矮屏手机上生效，别的手机不变", 'html[data-screen-size="short"] [data-wk="bubble"] {\n  font-size: 13.5px !important;\n  padding: 7px 11px !important;\n}'],
          ["大屏手机头像大一点", "只在高屏手机上生效", 'html[data-screen-size="tall"] [data-wk="row"] > [data-wk="avatar"] {\n  transform: scale(1.1) !important;\n}']
        ] : [
          ["这一页背景图随手机铺满", "背景图不会露白边、不会被拉变形", '[data-wk="app"] {\n  background-size: cover !important;\n  background-position: center !important;\n}']
        ]);
  }
  // 这台手机此刻量到的尺寸（给别的 AI 当参考，不是让它写死）
  function screenNow() {
    try {
      const root = document.documentElement, cs = g.getComputedStyle ? g.getComputedStyle(root) : null;
      const v = k => cs ? String(cs.getPropertyValue(k) || "").trim() : "";
      const out = { w: v("--app-w"), h: v("--app-h"), top: v("--app-safe-top"), bottom: v("--app-safe-bottom"), size: root.getAttribute ? root.getAttribute("data-screen-size") || "" : "" };
      return out.w || out.h ? out : null;
    } catch (_) { return null; }
  }
  // ── 「复制给别的 AI」那段话每次发版都要对一遍（她 2026-09-30：「每次更新这个复制给ai那段也要改」）──
  //   挂点表是从 WK_COMMON/WK_SCOPED 现拼的，代码里新挂的 data-wk 没进名单，测试 ai-brief-hooks 会红；
  //   可规矩、尺寸、现成写法是手写的——所以跟攻略一样立个戳：v 必须等于 APP_VERSION，
  //   这一版改了哪条写进 changed；这一版的改动碰不到样式，就在 none 写一句为什么。
  const BRIEF_STAMP = { v: "v75.259", changed: "", none: "只改群聊自发聊天的作息闸，没有新的可换装部件" };
  function aiBrief(page, css) {
    const grp = WK_SCOPED.filter(function (x) { return (x.pages || []).indexOf(page) >= 0; })[0];
    const line = function (r) { return '[data-wk="' + r[0] + '"]  ' + r[1]; };
    const out = [
      "我在用一个手机 App 的主题功能，想请你帮我改下面这段 CSS。先说清楚这个 App 的规矩：",
      "",
      "1. 没有 html 可以给你：页面是 App 运行时现场拼出来的。你不需要 html，也不要让我去找 html。",
      "2. 能改的每一块都有固定的挂点名字，写法是 [data-wk=\"名字\"]。只用下面列出来的挂点，别自己编类名或 id，编的抓不到任何东西。",
      "3. 样式大多是写在元素上的，所以每一条声明后面都要加 !important，不加等于没写。",
      "4. 只交回 CSS，不要 <style> 标签，不要 html，不要 JavaScript。",
      "5. 有的挂点带附加属性可以细分：data-me=\"1\" 是我这一侧、data-me=\"0\" 是对方那一侧；气泡还有 data-kind（text/voice/photo 等）。",
      "6. 想跟着屏幕大小走，可以用这几个变量：--app-w（屏宽）、--app-h（屏高）、--app-vh（屏高的百分之一）、--app-safe-top、--app-safe-bottom；html 上还有 data-screen-size=\"short\"/\"tall\" 可以分矮屏高屏。",
      "番茄钟：pomfocus 是专注整页，视频铺满外壳、标准 Head 透明；pompoke 是轻戳透明按钮，pomsubtitle 是底部模式字幕，pomtimer 是独立发条倒计时，pommore 是手动补新话与回看入口；字幕内有新话上一句/下一句按钮，长话只在字幕正文内滚动。人物脸部留空，字幕读完收起；保留按钮层级与 0.4 底安全区，不让字幕挡住计时。pomvideoeditor 是制作整页，pomvideostage 的 video 可调 object-fit；视频与语音独立。",
      "通话：callcamera 是用户真实摄像头小窗，不替换角色背景；保留开关和前后镜头切换触区至少 40px，与头像并排，窄屏不越屏。callcomposer 继续使用 0.4 底安全区，正文为唯一主滚动区。",
      "TA的一天的主聊天窗[cdaychat]覆盖场景下半部，保持原场景尺寸，键盘打开时沿useKbLift抬升；[cdaychatbar]只有主聊天说明、完整聊天与收起，气泡/正文/输入栏沿原ChatThread的data-wk挂点，只有外层Head吃顶部安全区，输入栏底部仍为COMPOSER_PAD_BOTTOM，最近20条只是显示窗口。\n" +
      "小镇生活相册与家里的小日子沿PetPanel半窗纸、透明Head、一个滚动正文和原约56px/0.4底安全区底栏，列表两列4:3真实相片，详情完整显示图像与当时地点天气，下载与摆到家里在原按钮列表，整理删除在同页原生details折叠里；翻旧照片与列表详情返回分别保存滚动位置。家里的小日子复用原便签、库存行和动作列表，纪念日、料理、自己的角落和记忆使用原生details，展开标题至少48px，桌面与移动端都只有原一处正文滚动；位置调整两列按钮，手机不横向溢出。样式.pet-domestic-section在apps/pets/panels.css。生活相册样式.pet-living-photos、.pet-living-print、.pet-photo-remove在apps/pets/panels.css。同行遛宠安排页的习惯和老地方沿原便签、记录行及全宽路线按钮；场景拍照键复用原纸按钮和线条SVG。TA的一天装修页沿透明Head，场景在正文内，底栏约56px并用0.4底安全区；家具原生下拉选择44px，顶栏保存。页面挂点可改入口、纸质提示、选框和底栏；选中家具的三维高亮与房间材质在场景内部，页面CSS不能直接改变。小家样式选项使用 cdaystyle，aria-pressed=true 表示正在用；小家画面的入口是 cdayhomestyle。3D房间材质由小家样式选择，页面CSS只控制纸页、选项与按钮。TA的一天现场双人进屋复用原cdaytools约56px及0.4底安全区底栏，四个44px按钮通过data-action=near/sit/stand/overview/leave标明动作；cdayvisitopen是场景里的44px进屋键，cdayvisitnote是原cdaynow纸卡中的状态行，三维双人位置与姿势仍在iframe内。TA的一天沿透明Head、角色选择与单滚动日程页、场景上的当前安排便签、约56px且0.4底安全区的底栏；cdaypage/cdaybody/cdaypick/cdayscene/cdaynow/cdayrow/cdaytools/cdayplaces/cdayplacepoint可美化对应外壳、文字与按钮；实验室、图书馆、诊室、创作工作室、排练室与车站候车区摆位试玩沿同一整页外壳、当前位置纸卡与约56px底栏，用高度44px的原生select选择动作位置，三维模型和场景在独立iframe中，顶层CSS不能穿透。实验室与图书馆的准备、做事、休息和收尾阶段文字沿cdaynow原地点行显示；专业手部动作与所持道具仍在三维场景内部。小家装修的家具库、单件配色、墙地面用整片场景区域的纸页覆盖层，保持原iframe与试摆：一条公共Head、单滚动正文、56px加0.4底安全区返回栏。家具库两列实景缩略图货架，纵横屏时卡片随宽度缩放；配色的常用色有文字和已选标记，自选色复用公共ColorDot色圈与色号格，材质用44px原生控件。挂点可以改纸页、货架、卡片与表单，三维家具颜色材质、墙纸与地板由装修数据控制；顶层CSS不能替代它们。绒绒小镇聊天与状态、职业今天／零钱袋／履历、名册、镜头、街坊、周记、结伴、拆袋子、相册、家里的小日子及菜单共用PetWindow：游戏iframe始终铺满原区域，画布、镜头与场景控件不因开窗而缩小或重新排布；纸窗以absolute和z-index:10覆盖下半部，无遮罩，上方露出的场景仍能触控且持续活动。统一44px标题把手，可拖动调28%–72%并记住大小，双击恢复一半、方向键也能调；收起只移走上层窗口。共用透明Head保持绒绒小镇标题、宠物名与小镇菜单，单滚动正文和原56px/0.4底安全区底栏，详情返回与tab保留滚动位置。聊天键盘用公共抬升量只抬纸窗和输入栏，拖动边界按键盘上方可用区域计算，不挤游戏。宠物预览和TA换装保留原编辑页面。小镇周记复用同一PetPanel、透明Head、单滚动正文和原底栏，原生周选择框、换行的分类计数小卡及每天的全宽记录行；结伴逛街沿同样纸页的门牌路线按钮；两人同行遛宠物复用同一安排纸页、状态与动作列表，街边托盘沿home-actions的轻纸结构、48px按钮和原SVG，依次歇歇、追球、摸摸、继续走和一起回家。材质仍铺在聊天外壳。小镇现场控件在独立iframe：爪印名牌与现实天气时间共一行；出门与聊天/职业/照料册纸页分开，底下六件照料动作共用轻纸托盘与线条SVG，镜头控制收在同一细栏。布局只在apps/pets/scene-controls.css的.pet-game范围生效，顶层美化CSS不会穿透iframe，不能假装页面挂点能改三维场景控件。小世界宠物页：家装沿零钱袋原便签、库存行和按钮排版，摆放选框至少40px，已有物件各占一段，手机不横向溢出；临时兼职照片在履历册两列纸质相片中显示，方形图完整取景，图下是当天职业、名字与实际选择。全册沿同一单滚动正文和原底安全区，返回保留阅读位置。家务纯文字记录占满正文宽度，不套日期加正文的两列布局；回家拆袋子共用半窗纸底、透明Head、单滚动正文及约56px/0.4安全区底栏；实际物件在原库存行按图标、名称和份数排列，反应单独一张便签。家里的宠物用带书脊边线的小档案卡，每只单独显示名字、头像与状态，卡片内有名字外貌和职业入口；选中同时改变书脊边线与标记。名册共用PetPanel的单滚动正文及约56px底栏，返回恢复阅读位置。奶油纸底、灰粉布零钱袋与面包暖棕的印章和索引；首工纪念用墙上纸贴及履历里的同一份事件记录。照料记录、面包店/花店试工单、零钱袋/收支小票与履历册共用透明 head；自主购物用袋内便签、原生勾选开关与带金额的纸票选框，按实际购物逐张显示小票；虚线纸质职业启事按两列选职业，选中以实线和灰粉纸色标识，履历的各职业与休息在两列排列，奇数末项独占一行；各小店收藏沿原库存行展示名称与份数，公园小摊用同一职业纸页：真实库存行配减号/加号，最多三件，下一站与实际成交额在摊袋便签，收摊小票沿履历列表；公园野餐角的小摊布、货包与客人复用原猫狗模型和纸道具，没有另起面板。快递工作单用同一纸页展示包裹标签、下一站、原包裹暂存和三条门牌路线，履历用原照料记录行显示配送结果；封箱纸包与赚回的小袋子共用纸道具材质。侦探工作单的新消息便签沿原纸页展示来源、连载回数和一枚满宽模型来信按钮，保存失败的已写来信在同处显示重试收下；返回原文在同页折叠展开。侦探卷宗用三条编号线索、纸页左侧双线和末尾结论便签，猜结论仍用当前纸页上的选项，未完成线索不提前展示；书页索引有贴页形状，选中同时改变高度与边线。页面只有一处主滚动，底栏约56px并使用0.4安全区；材质铺在外壳上。宠物外貌预览保留上方模型，控件所在区域独立滚动。",
      "7. 里面的 url(...) 图片引用原样保留，别改它们的地址。",
      "8. 背景可以用渐变（linear-gradient）。有的主题会给气泡画一个小尖角，它是气泡的 ::before 三角，用 border 颜色上色：改颜色写 border-left-color（我这侧）/ border-right-color（对方），不要就 display:none。",
      "9. 按键上的图标是 svg：换颜色写 svg { stroke: 颜色 !important; }；换成图片就先 svg { display:none !important; }，再给按键本身写 background: url(...) center / contain no-repeat 并给宽高。",
      "",
      "【每一页都有的挂点】"
    ].concat(WK_COMMON.map(line));
    if (grp) out.push("", "【这一页（" + grp.zh + "）专有的挂点】", ...grp.hooks.map(line));
    out.push("", "【App 现在用的尺寸，照这些写、别自己估】",
      "- 气泡最宽占屏幕 72%（calc(var(--app-w) * 0.72)），气泡字 14.5px，内边距上下 9px、左右 13px。",
      "- 高度和宽度一律用上面那几个变量换算，不要写死 px：同一份主题会发给不同型号的手机，写死就会有人错位。",
      "- 顶部、底部要让开刘海和横条：用 var(--app-safe-top) / var(--app-safe-bottom)。");
    const sn = screenNow();
    if (sn) out.push("- 我这台手机此刻：宽 " + (sn.w || "?") + "、高 " + (sn.h || "?") + "、顶部安全区 " + (sn.top || "0") + "、底部安全区 " + (sn.bottom || "0") + (sn.size ? "（" + sn.size + " 档）" : "") + "。只给你参考，写的时候照样用变量。");
    const ps = sizePresets(page);
    if (ps.length) { out.push("", "【现成写法，要用就原样照抄】"); ps.forEach(function (p) { out.push("/* " + p[0] + "：" + p[1] + " */", p[2]); }); }
    out.push("", "【我现在的 CSS】", String(css || "").trim() || "（还是空的，从头写）", "", "【我想改成】", "（在这里写你想要的样子）");
    return out.join("\n");
  }
  g.ThemeStudio = { histCount, undoStep, aiBrief, sizePresets, BRIEF_STAMP, KEY, appIconList, PAGES, ICON_PACKS, packList, packIconSrc, packIcon, iconBare, fresh, normalize, load, save, apply, preview, commit, cancelPreview, history, restoreHist, current, iconRef, compile, scopeCSS, unsafeReason, cssImageRefs, resolveCSSImages, remapCSSImages, exportPackage, importPackage, PACK_PARTS, PACK_KEYS, packHas, packParts, cleanPick, pickProfile, isPreviewing: () => !!previewBase, safeMode, CSS_BUILTINS, WK_COMMON, WK_SCOPED, TOKENS, TOKEN_KEYS, OWN_PALETTE, okColor, cleanTokens, tokensFor, themeFor, SLOT_MAX, pageSlots, addSlot, saveSlot, clearSlot, cssStale, SKIN_VER, ZOOM_MIN, ZOOM_MAX, cleanZoom, zoomFor };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { try { apply(load()); } catch (_) {} });
  else { try { apply(load()); } catch (_) {} }
})(window);
