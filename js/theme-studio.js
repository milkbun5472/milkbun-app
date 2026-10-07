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
      ["mlpage","消息这一页的底（聊天／通讯录／朋友圈／我 四栏共用）"],
      ["mlsearch","聊天列表顶上的搜索框"],
      ["mlrow","聊天列表的一行（data-kind=\"char\"/\"group\"；data-pinned=\"1\" 是置顶；data-unread=\"1\" 有未读）"],
      ["mlavatar","那一行的头像（群是四宫格或群头像）"],["mlname","名字／群名"],["mllast","最后一条消息那行小字"],
      ["mltime","右边的时间"],["mlbadge","未读红点"],
      ["ctentry","通讯录顶上「群聊／标签／配角」那几个入口"],["ctletter","通讯录的字母分组条"],["ctrow","通讯录的一行联系人"],
      ["mltabbar","底下那条四个标签的栏"],["mltab","每一个标签（data-tab=chats/contacts/moments/me；data-on=\"1\" 是当前那个）"]
    ])}),
    Object.freeze({zh:"朋友圈",pages:Object.freeze(["messages", "momprofile"]),hooks:Object.freeze([["mocompose", "朋友圈信息流顶上那个「发朋友圈」按钮"], ["mopost", "信息流里一条动态整块（data-me=\"1\" 是她自己发的）"], ["moname", "动态上的作者名字"], ["motext", "动态的正文文字"], ["mophoto", "动态配图（data-kind=\"img\" 真图，\"desc\" 是「点开看描述」的文字卡）"], ["motime", "动态下方的时间"], ["molike", "点赞按钮（data-on=\"1\" 是她点过赞）"], ["mompin", "动态下面那个「收进时刻」"], ["molikers", "点赞人名单那一行"], ["mocomments", "评论区整块浅底框"], ["mocomment", "评论区里的一条评论"], ["moprofile", "个人页封面下面的滚动正文区（data-me=\"1\" 是她自己的个人页）"], ["mocover", "个人页顶部封面整块（data-on=\"1\" 是设了封面图）"], ["moprofilehead", "封面右下角的名字＋大头像"], ["mosign", "封面下方的签名那一行"], ["moprofilepost", "个人页里的一条动态整块"]])}),
    Object.freeze({zh:"资料卡",pages:Object.freeze(["contact"]),hooks:Object.freeze([["cdpage", "整页最外层（带角色颜色的纸底）"], ["cdhead", "头部一行（头像、名字、简介）"], ["cdname", "角色名大字"], ["cdtagline", "名字下面那行简介"], ["cdage", "年龄和生日那一行"], ["cdaffinity", "好感度那一块"], ["cdrules", "「长期准则」整块"], ["cdrule", "单条准则卡片"], ["cdactions", "底部操作按钮那一组"], ["cdbtn", "单个操作按钮（data-kind=chat/state/desires；心上那颗 data-on=\"1\" 是有念想）"]])}),
    Object.freeze({zh:"设置",pages:Object.freeze(["config"]),hooks:Object.freeze([["cfhome", "设置首页那一列入口的容器"], ["cfrow", "首页的一行入口（data-page＝通往哪个子页，如 api/look/data）"], ["cfrowtitle", "首页一行的标题"], ["cfrowstate", "首页一行右下那行灰色状态小字"], ["cfnote", "首页底部那张说明卡"], ["cfmark", "方角汉字栏号牌（首页每行、子页每格都有）"], ["cfgrid", "子页里两列格子的网格"], ["cftile", "子页里的单个入口格子（data-wide=\"1\" 是占满一行的宽格）"], ["cfpanel", "子页内容外面那张卡片框（data-flush=\"1\" 没内边距）"]])}),
    Object.freeze({zh:"论坛",pages:Object.freeze(["forum"]),hooks:Object.freeze([["fochip", "版块切换的小标签（data-on=\"1\" 是当前那个）"], ["forow", "帖子流里的一张帖子卡（data-me=\"1\" 我发的，data-anon=\"1\" 匿名）"], ["fonotes", "论坛双列时那块瀑布流"], ["folayout", "论坛「我」页里「首页排版」那两颗（单列 / 双列，data-on=\"1\" 是选中的那颗）"], ["fonewhead", "「新帖在这里」「新回复在这里」那一行（点了展开，aria-expanded=\"true\" 是开着）"], ["fonote", "双列时的一张卡片"], ["foname", "帖子卡上的作者名"], ["fobody", "帖子卡正文预览"], ["foacts", "帖子卡底部操作栏"], ["fofloor", "帖子详情里的一层楼（data-me=\"1\" 我的，data-new=\"1\" 新楼）"], ["foreplies", "楼中楼回复框"], ["fosend", "详情页底部回复栏的发送键"], ["fofab", "右下角悬浮的发帖键"]])}),
    Object.freeze({zh:"日记",pages:Object.freeze(["diary"]),hooks:Object.freeze([["diauthor", "日记本列表里每个人的一行（data-on=\"1\" 当前那本，data-me=\"1\" 我自己）"], ["diname", "那一行里的名字"], ["dirow", "一篇日记（data-me=\"1\" 我写的）"], ["didate", "日记左侧的日期块"], ["dititle", "日记标题"], ["dibody", "日记正文预览"], ["dimarks", "条目下方的小标记行（划掉/秘密/贴纸、几人看过）"], ["dipen", "右上角写日记的铅笔键"], ["dipage", "翻页阅读时的单页日记"]])}),
    Object.freeze({zh:"情侣空间",pages:Object.freeze(["us"]),hooks:Object.freeze([["uscouple", "情侣列表的一行（data-on=\"1\" 在一起，否则邀请中；data-new=\"1\" 有新东西）"], ["usname", "列表行里的角色名"], ["uscount", "列表行里「在一起 N 天」的天数大字"], ["usdays", "空间内页「在一起 N 天」那一组"], ["usnow", "「TA 此刻」那张便签"], ["uspaper", "往上滚时盖住封面的那张底纸（颜色、透明度、磨砂都在它身上，写的时候要加 !important）"], ["uswall", "墙上的功能卡片（data-kind＝模块）"], ["usspine", "「收着的」那一列书脊入口（data-kind＝letters/exdiary/qa/capsule…；data-new=\"1\" 有新内容）"], ["useyebrow", "各区块的小眉标标题"]])}),
    Object.freeze({zh:"时刻",pages:Object.freeze(["shike"]),hooks:Object.freeze([["shikepage","时刻外层整页（横着滑那一层）"],["shikecard","横着滑的那张整屏 CG 卡（data-on=\"1\" 是当前停着的）"],["shikedetail","点进一个人以后的那一页"],["shikeitem","里层横着滑的一张时刻卡（data-kind=meet/us/bday/fest/first）"],["shikesay","时刻卡上TA说的那段话"],["shikecreate","「开一张时刻」那一页"],["shikemonths","里层底下那条时间轴（一张时刻一道刻度）"],["shikemenu","里层右上角「⋯」打开的那张小菜单"],["shikeacts","时刻卡底那一行小字动作"],["shikenote","时刻卡上写着那天的事的那块底框"],["shikewith","群里那种卡上「一起的还有」那一行"],["shikesoon","卡上那个倒计时小签（data-today=\"1\" 是就在今天）"]])}),
    // 一起学 · 我来教（2026-10-03）
    Object.freeze({zh:"我来教",pages:Object.freeze(["study"]),hooks:Object.freeze([["studyunit","开一节课时排出来的那几小节卡（data-keep=\"1\" 是点了留着的）"],["tbmis","顶上那条「TA 心里想错的地方」（每颗带 data-found=\"1\" 是挖出来的）"],["tbnote","TA 的课堂笔记"],["tbmsg","课上一句（data-me=\"1\" 是你讲的）"],["tbflash","挖出来时弹的那张"],["tbquiz","随堂小测那张"],["tbreview","评教卡"],["tbleft","评教卡底下「还没挖出来的」"]])}),
    Object.freeze({zh:"番茄钟",pages:Object.freeze(["pomodoro"]),hooks:Object.freeze([["pomfocus","专注视频整页，底纹与视频铺满外壳"],["pompoke","轻戳画面显示字幕的透明按钮"],["pomsubtitle","模式字幕与独立听这句按钮"],["pomtimer","底部发条倒计时与暂停控制"],["pommore","手动补充陪伴话与回看入口"],["pomvideoentry","动态陪伴图制作入口"],["pomvideoeditor","动态陪伴图整页外壳"],["motionstrip","动态形象编辑页顶上那条胶片（平时／专注时／通话时，data-on=\"1\" 是选中那格）"],["pomarchive","往期「坐过的那些」整页"],["pomarchtabs","往期顶上那排桌牌（按谁坐对面分）"],["pomarchrow","往期里的一张单子（data-done=\"1\" 是坐满了）"],["pomarchsum","往期顶上那行合计（坐了多久／几场／几场坐满）"],["pomvideostage","循环视频画面，视频保持静音、语音独立播放"]])}),
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
        ["quote", "消息引用块（带 data-me；输入框上面那条待发送的引用也是它，多带 data-draft=\"1\"）"], ["quotedraft", "输入框上面那一整条待发送的引用"], ["quoteclear", "待发送引用右边那个 ×"], ["quoteicon", "引用块前面那个 ❝"], ["quotetext", "引用的那句原话"], ["voice", "语音消息整块"], ["voicebar", "语音条"],
        ["translation", "外语正文和翻译区"], ["translatebutton", "翻译/收起键"], ["translatebody", "展开后的译文"],
        ["transfercard", "转账卡整张（那张纸的底、边、圆角）"], ["transferamount", "转账卡上的金额"], ["transferlabel", "转账卡左上角「转账／收款／退还」那几个字（想换成别的字：font-size:0 再用 ::after 写 content）"],
        ["transfernote", "转账卡上的附言那一行"], ["transferseal", "转账卡上那枚印章"],
        ["photocard", "照片卡整张（相纸的底、边、影）"], ["photocap", "照片底下那行配文"],
        ["photoface", "没真图的照片卡里那块相面（米色渐变那块，改色写 background）"], ["phototext", "相面上那句描述的字"], ["photohint", "照片卡右下「点开看这张」"],
        ["composer", "底部输入栏整条"], ["chatback", "返回键"], ["chatmore", "右上角更多/设置键"],
        ["chatplus", "输入栏加号键"], ["chatinput", "输入框"], ["send", "发送键"], ["chatreply", "让 TA/他们回复的 AI 键"],
        ["chatpanel", "点＋弹出来的那整块面板（底色、上边线、内边距；群友 2026-10-06 要的）"],
        ["chattool", "加号面板工具键（data-chat-tool 区分 voicemsg／sticker 等）"],
        ["chattoolicon", "加号面板每个键上面那个方块（底色、边框、圆角、大小；也带 data-chat-tool）"],
        ["chattoolglyph", "方块里的图标（svg：stroke 换颜色；换图就先 svg { display:none }，给这一格写 background）"],
        ["chattoollabel", "键底下那行字"],
        // 点头像那张心声卡（她 2026-09-22 转群里读者：「那个卡片不可以美化的嘛？」）
        ["statecard", "点头像那张心声卡整张"], ["statehead", "心声卡抬头（头像·名字·此刻心情）"],
        ["stateseen", "心声卡「看得见的」那一段（穿着＋动作）"], ["statevoice", "心声卡「心里想的」那一块"],
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
        ["offline", "线下整页（最外那层）"], ["offbody", "线下正文滚动区"], ["offcomposer", "线下底部输入栏"],
        ["offmsg", "线下一段（data-me=\"1\" 是她写的）"], ["offcard", "线下那张卡片本体"], ["offhead", "卡片顶上那行（头像·名字·时间）"],
        ["offname", "卡片上的名字"], ["offtext", "线下正文"], ["offsay", "正文里引号那几句台词"], ["offthought", "线下的心声那块"],
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
        ["pager", "页码点那一行"], ["pagerdot", "单个页码点（data-on=\"1\" 是当前页）"]
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
        + (page === "all" ? "body" : 'html[data-lisa-screen="' + page + '"] body') + "{zoom:" + z + ";}");
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
    return JSON.stringify({ kind: "lisa-theme", format: 1, exportedAt: new Date().toISOString(), profile,
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
    if (!pkg || pkg.kind !== "lisa-theme") throw new Error("这不是这个 app 导出的主题包或气泡包（得是「导出」按钮存出来的那种 json 文件）");
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
  const BRIEF_STAMP = { v: "v74.967", changed: "folayout 挪到论坛「我」页的「首页排版」那两颗", none: "" };
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
      "小镇生活相册与家里的小日子沿PetPanel半窗纸、透明Head、一个滚动正文和原约56px/0.4底安全区底栏，列表两列4:3真实相片，详情完整显示图像与当时地点天气，下载与摆到家里在原按钮列表，整理删除在同页原生details折叠里；翻旧照片与列表详情返回分别保存滚动位置。家里的小日子复用原便签、库存行和动作列表，纪念日、料理、自己的角落和记忆使用原生details，展开标题至少48px，桌面与移动端都只有原一处正文滚动；位置调整两列按钮，手机不横向溢出。样式.pet-domestic-section在apps/pets/panels.css。生活相册样式.pet-living-photos、.pet-living-print、.pet-photo-remove在apps/pets/panels.css。同行遛宠安排页的习惯和老地方沿原便签、记录行及全宽路线按钮；场景拍照键复用原纸按钮和线条SVG。绒绒小镇聊天默认上下各半，可拖44px标题里的细把手调28%–72%并记住大小，双击回到一半、方向键也能调；键盘缩短区域时两边都保留可用高度。状态、职业今天／零钱袋／履历、名册、镜头、街坊、周记、结伴、拆袋子与菜单复用聊天的PetWindow上下半窗，场景真实继续活动；统一44px把手和收起按钮、单滚动正文、原56px/0.4底栏，详情返回与tab保留滚动位置。宠物预览和TA换装保留原编辑页面。小镇周记复用同一PetPanel、透明Head、单滚动正文和原底栏，原生周选择框、换行的分类计数小卡及每天的全宽记录行；结伴逛街沿同样纸页的门牌路线按钮；两人同行遛宠物复用同一安排纸页、状态与动作列表，街边托盘沿home-actions的轻纸结构、48px按钮和原SVG，依次歇歇、追球、摸摸、继续走和一起回家，不加遮罩，键盘短窗共用原托盘收起边界。聊天使用上下相邻的场景与聊天区，没有遮罩，保留上方场景触控；聊天有44px紧凑标题和收起按钮、唯一滚动正文、约56px与0.4底安全区输入栏，键盘用公共抬升量缩短当前区域。半窗矮于340px时场景暂收镜头栏，保留照料动作和单行提示；键盘使场景矮于200px时暂收名牌天气与照料托盘，收起键盘或聊天恢复。材质仍铺在聊天外壳。小镇现场控件在独立iframe：爪印名牌与现实天气时间共一行；出门与聊天/职业/照料册纸页分开，底下六件照料动作共用轻纸托盘与线条SVG，镜头控制收在同一细栏。布局只在apps/pets/scene-controls.css的.pet-game范围生效，顶层美化CSS不会穿透iframe，不能假装页面挂点能改三维场景控件。小世界宠物页：家装沿零钱袋原便签、库存行和按钮排版，摆放选框至少40px，已有物件各占一段，手机不横向溢出；临时兼职照片在履历册两列纸质相片中显示，方形图完整取景，图下是当天职业、名字与实际选择。全册沿同一单滚动正文和原底安全区，返回保留阅读位置。家务纯文字记录占满正文宽度，不套日期加正文的两列布局；回家拆袋子共用半窗纸底、透明Head、单滚动正文及约56px/0.4安全区底栏；实际物件在原库存行按图标、名称和份数排列，反应单独一张便签。家里的宠物用带书脊边线的小档案卡，每只单独显示名字、头像与状态，卡片内有名字外貌和职业入口；选中同时改变书脊边线与标记。名册共用PetPanel的单滚动正文及约56px底栏，返回恢复阅读位置。奶油纸底、灰粉布零钱袋与面包暖棕的印章和索引；首工纪念用墙上纸贴及履历里的同一份事件记录。照料记录、面包店/花店试工单、零钱袋/收支小票与履历册共用透明 head；自主购物用袋内便签、原生勾选开关与带金额的纸票选框，按实际购物逐张显示小票；虚线纸质职业启事按两列选职业，选中以实线和灰粉纸色标识，履历的各职业与休息在两列排列，奇数末项独占一行；各小店收藏沿原库存行展示名称与份数，公园小摊用同一职业纸页：真实库存行配减号/加号，最多三件，下一站与实际成交额在摊袋便签，收摊小票沿履历列表；公园野餐角的小摊布、货包与客人复用原猫狗模型和纸道具，没有另起面板。快递工作单用同一纸页展示包裹标签、下一站、原包裹暂存和三条门牌路线，履历用原照料记录行显示配送结果；封箱纸包与赚回的小袋子共用纸道具材质。侦探工作单的新消息便签沿原纸页展示来源、连载回数和一枚满宽模型来信按钮，保存失败的已写来信在同处显示重试收下；返回原文在同页折叠展开。侦探卷宗用三条编号线索、纸页左侧双线和末尾结论便签，猜结论仍用当前纸页上的选项，未完成线索不提前展示；书页索引有贴页形状，选中同时改变高度与边线。页面只有一处主滚动，底栏约56px并使用0.4安全区；材质铺在外壳上。宠物外貌预览保留上方模型，控件所在区域独立滚动。",
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
