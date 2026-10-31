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
// 输入框套 :where()（群里 2026-10-19）：皮肤这条原来是「composer 里的 textarea」，比她写的 [data-wk="chatinput"] 更具体，
//   她给输入框写什么都被皮肤压着——白底、描边、占位字全不生效。:where 不算分，她写什么都盖得过
':where([data-wk="composer"] input, [data-wk="composer"] textarea) {',
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
':where([data-wk="composer"] input, [data-wk="composer"] textarea)::placeholder {',
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
    + '\n:where([data-wk="composer"] input, [data-wk="composer"] textarea) {\n  border: 1px solid #dbdbdb !important;\n}';
  // ⚠️内置预设是【拷贝】进她编辑框的，不是引用：我改了内置，她手上那份不会跟着变。
  //   她 2026-09-03 就是这么撞上的——挂点全补好了，她那份 CSS 还是旧选择器，
  //   于是「感觉一个没生效」。改内置时把这个数 +1，界面就会提示她重新灌一次。
  const SKIN_VER = 6;
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
  const WK_COMMON = Object.freeze([["imgviewer", "看大图那一层（全库共用：聊天照片、通话照片、时刻、小剧场、跑团、小世界、去处、小窝）"], ["imgviewerbtns", "看大图底下那一排按钮（存相册、删除这些；里面的 button 就是一颗颗按钮）"],
    ["app", "这一页的底（最外那层）"],
    ["head", "顶栏整条"], ["headink", "顶栏的字与图标"],["bdaypin", "生日那天顶在聊天最上面那条「还没拆的信封」"],["maskknows", "面具设置里「谁认得这张」那一块"],["shoppaymask", "购物结算时「用哪张面具买」那一排"],["shoppaymaskitem", "那一排里的每张面具（data-on=\"1\" 是选中）"],["tkopaymask", "外卖结算时「用哪张面具点」那一排"],["tkopaymaskitem", "那一排里的每张面具（data-on=\"1\" 是选中）"],["walletpocket", "钱包页顶上「看哪张面具的钱」那一排"],["emomyfaces", "表情包页「画一套表情包」里「或者画你自己的」那一块"],["emomyface", "那一块里的每张面具"],["walletpocketitem", "那一排里的每张面具（data-on=\"1\" 是正在看的）"],["maskknowsitem", "那一块里的每个人（data-on=\"1\" 是认这张）"], ["headdim", "顶栏那行小副标题"], ["myvote", "擂台观战时你自己投票那一行"], ["lookundo", "美化「回到上一版／换回来」那一行"],
    ["eyebrow", "小标题眉标（那种间距拉开的小字）"],
    ["csexport", "聊天设置里「导出聊天记录」那一块"], ["proactiveblock", "聊天设置里「允许 Ta 主动发消息」底下那块说明（为什么没来找你）"], ["pastoffline", "聊天设置里「带上最近几次线下」那一块"], ["csexportbtn", "那一块里的「导出 txt」"], ["csreset", "聊天设置里「清除 / 重置…」那颗按钮"], ["callpill", "聊天里那条「通话已结束」回执的整块（多选时 data-on＝1）"], ["proactiverate", "聊天设置里「多久来找你一次」那一排（选项 data-on）"], ["csrouteoff", "线路那一格「线下见面单独走」的一颗（data-on＝1 选中）"], ["mcppick", "聊天设置 · 让 Ta 能上网 下面那一列「能用的工具」（一台 MCP 一行开关）"], ["resetpage", "清除 / 重置选择页整页"], ["resetgo", "选择页最后那颗「确定清掉」"],
    ["block", "页里一块自己有底色或边框的卡片、板、格子（凡是没单独起名的都是它；想只改某一页，前面带上那一页的最外层挂点）"],
    ["empty", "空状态那一块（还没有内容时）"],
    ["dialogmask", "屏幕正中那种弹窗后面的遮罩（data-part=\"prompt\" 是填一行字的，比如「收进时刻」；\"confirm\" 是「确定要……吗」）。弹窗卡片本身是 [data-wk=block][data-part=dialog]，确定键是 [data-wk=block][data-part=dialogok]，输入框是 [data-part=dialog] 的 input / textarea"], ["dialogtitle", "弹窗标题"], ["dialogbody", "弹窗标题下面那段说明"], ["dialogcancel", "弹窗的「取消」"],
    ["sheet", "从底下掀起来的半窗"], ["pagesheet", "原来是半窗、现在铺满整页的那些（通话记录、查找记录、记忆库、备忘录编辑……）"], ["centercard", "屏幕正中弹出来的小卡片"], ["msgbanner", "顶上掉下来的新消息横幅"], ["msgbannericon", "顶上那条提醒里 App 来的那种（小窝新发的）左边那格图标"],
    ["avatar", "头像（全 App 每一颗）"],
    ["field", "一栏设置（标题＋内容＋底下那道细线）"], ["fieldlabel", "那一栏的标题"], ["fieldline", "那一栏底下的细线"],
    ["toggle", "开关（data-on=\"1\" 是开着的）"], ["toggleknob", "开关里那颗圆钮"], ["askqiu", "「问秋秋 ›」那一行（人格档案馆和角色编辑页上）"],
    ["input", "单行输入框"], ["textarea", "多行输入框"], ["chatcsslen", "自己写 CSS 底下那行字数提醒"], ["quiethours", "API 页「我的作息 · 免打扰」那一块"], ["msgsound", "设置·通用「新消息提示音」那一块"], ["msgsoundopt", "提示音那一排选项（data-on）"], ["msgsoundvol", "提示音音量拉条"], ["quiettoggle", "免打扰总开关那一行"], ["quietpro", "免打扰里「不发主动消息」那一行"], ["quietbg", "免打扰里「后台不跑」那一行"], ["listensquare", "一起听「广场」整页"], ["listensqgen", "广场「刷一刷」按钮"], ["listensqpost", "广场上的一帖"], ["listensqplay", "帖子里那首歌（点了就放）"], ["listensqcompose", "广场上自己发帖那一块"], ["listencomment", "广场／歌评里的一条评论（点了就是回他）"], ["listensqtalk", "帖子里「歌评」按钮"], ["listensqreply", "帖子底下「评论」"], ["listensqshare", "帖子底下「转给TA」"], ["listentalk", "一首歌的歌评整页"], ["listentalkgen", "歌评页「刷歌评」按钮"], ["listentalkopen", "播放页「评」那颗键"], ["listensqmore", "帖子底下「再刷点评论」"], ["listendel", "广场／歌评里的「删除」"], ["listentalkbar", "歌评页钉在最底下的输入栏"], ["listensetbtn", "一起听顶栏右上的设置齿轮"], ["msgeditzh", "编辑消息里那一格「译文」"], ["cdavatar", "通讯录资料页的大头像（点了看原图）"], ["fopickbar", "论坛多选删帖时底栏上面那一条"], ["fopickdel", "那一条里的「删掉」"], ["fopickfav", "那一条里的「收藏」"], ["tiesnpccount", "生成配角「生成几位」1–5 那一排；按钮 data-on=1 当前"], ["stlink", "头像藏了时消息底下那行的「状态」"], ["ficregtag", "同人文书评里熟面孔名字后面那个小标"], ["loreenable", "世界书多选「启用」后问给谁那一页"], ["loreenableopt", "照原来的范围／所有角色那两行；data-part keep|all"], ["loreenablechar", "只给这几个人里的一个名字；data-on=1 选中"], ["loreenablego", "「只给这几个人用」那颗"], ["discauto", "情侣空间唱片页「进空间自动放」开关；data-on=1 开着"], ["chatloreview", "世界书「全部 / 只看没勾的」切换；data-part all|off，data-on=1 当前"], ["themehex", "设置 · 配色里每一行右边那格（色点＋能手打的色号）"], ["themenight", "主题色页「夜间配色」那一行"], ["apitest", "API 页模型底下「测一下这个模型」和结果"], ["callshotpick", "群视频点「看看画面」弹的挑人那一块"], ["callshotwho", "挑人那一块里每个人一行（data-on）"], ["callshotnav", "视频通话左上「‹ 1/3 ›」切着看拍过的几张"], ["calledit", "通话里长按编辑时铺满通话页的那一层"], ["mlhits", "消息列表搜索底下「聊天记录」那一段"], ["mlhitshead", "「聊天记录 · N 条」那一行"], ["mlhit", "搜到的一条聊天记录（点了跳过去）"], ["chatphotopick", "聊天里发真照片那一格（data-n 是挑了几张）"], ["chatphotodrop", "挑好的照片右上角的 ×"], ["chatphotomore", "「＋ 再加几张」"], ["listenchathint", "一起听选人底下那行「也可以回单聊直接找TA」"], ["slider", "滑杆"], ["laygap", "TA的聊天长相里连发间距的数字条；data-part gapIn|gapOut"]
  ]);
  // 底下这几组是【某几页专有】的（气泡、输入栏、主屏那些格子，别处没有）。
  // ⚠️一张表，一行一组【叫什么 · 哪几页 · 有哪些挂点】。第二组进来的时候
  //   不许在旁边再并排开一对 WK_XXX / WK_XXX_PAGES —— 那就是同一层写在两处，
  //   秋秋那边迟早只念到其中一份（one-public-mechanism.md）。
  const WK_SCOPED = Object.freeze([
    Object.freeze({zh:"各怀心思的约会",pages:Object.freeze(["games"]),hooks:Object.freeze([["dategamepage", "约会游戏整页最外层"],
      ["datepage", "约会游戏的外壳（顶栏和底纹共用）"], ["datemap", "商量路线的地点卡"],
      ["dateactivity", "合照／抓玩偶／逛店的活动区"], ["datemission", "你的任务纸条与翻牌结果"],
      ["datecomposer", "约会局聊天输入栏，底部安全区沿主聊天"]
    ])}),
    // 消息 app 那一页（群友 2026-10-03：「这个界面的这种是没办法美化吗」）——聊天列表、通讯录、底下四个标签
    Object.freeze({zh:"消息列表",pages:Object.freeze(["messages"]),hooks:Object.freeze([
      ["npcpromotebtn", "配角详情页「转成正式角色」那颗"], ["npcpromote", "点了转正以后问一句的那一块"], ["npcpromotego", "那一块里的「转正」"], ["npcdel", "通讯录 → 配角 → 点开一位 → 删除时弹出的那块确认（连不连聊天一起清）"],
      ["npcnew", "通讯录 → 配角 → 右上角 + 新建配角那一整页（认识谁、在谁身边）"],
      ["mlpage","消息这一页的底（聊天／通讯录／朋友圈／我 四栏共用）"],
      ["mlsearch","聊天列表顶上的搜索框"],
      ["mlrow","聊天列表的一行（data-kind=\"char\"/\"group\"，递手机录像时编出来的日常联系人是 \"daily\"；data-pinned=\"1\" 是置顶；data-unread=\"1\" 有未读）"],
      ["extmem","设置里接 MCP 那页底下「外置记忆库」那一块"],
      ["peekdaily","递手机录像里点开日常联系人时那一整页（只读）"],
      ["peekdailybubble","那一页里的一句（data-me=\"1\" 是她说的）"],
      ["mlavatar","那一行的头像（群是四宫格或群头像）"],["mlname","名字／群名"],["mllast","最后一条消息那行小字"],
      ["mltime","右边的时间"],["mlbadge","未读红点"],
      ["ctentry","通讯录顶上「群聊／标签／配角」那几个入口"],["ctletter","通讯录的字母分组条"],["ctrow","通讯录的一行联系人"],["ctmenu","通讯录长按一个人弹出的那个菜单"],["ctmenushelve","长按菜单里的「收起来」"],["ctshelf","通讯录底下「收起来的人」那一块"],["ctshelfrow","「收起来的人」里的一行（带放回来的按钮）"],
      ["mltabbar","底下那条四个标签的栏"],["mlrowmenu","长按配角聊天弹出的小菜单"],["mlrowmenuitem","小菜单里的每一项（置顶、从列表删掉）"],["mltab","每一个标签（data-tab=chats/contacts/moments/me；data-on=\"1\" 是当前那个）"]
    ])}),
    Object.freeze({zh:"朋友圈",pages:Object.freeze(["messages", "momprofile"]),hooks:Object.freeze([["momprofilepage", "朋友圈个人主页的最外层"],["mofeed", "朋友圈信息流那一整张底（整页背景要连它一起改，不然它自己的底色会盖在上面）"],["mocompose", "朋友圈信息流顶上那个「发朋友圈」按钮"], ["momask", "发朋友圈页「用哪张面具发」那一排"], ["mopost", "信息流里一条动态整块（data-me=\"1\" 是她自己发的）"], ["moname", "动态上的作者名字"], ["motext", "动态的正文文字"], ["mophotogrid", "动态的多图九宫格（两张起）；里面每格是 mophoto"], ["mocomposepics", "发朋友圈页选好的那几张图的预览"], ["mophoto", "动态配图（data-kind=\"img\" 真图，\"desc\" 是「点开看描述」的文字卡）"], ["motime", "动态下方的时间"], ["molike", "点赞按钮（data-on=\"1\" 是她点过赞）"], ["mompin", "动态下面那个「收进时刻」"], ["momtoptag", "置顶动态上那个「置顶」小标"], ["momtop", "自己那条动态下面的「置顶／取消置顶」（data-on）"], ["molikers", "点赞人名单那一行"], ["mopoll", "动态里的投票整块"], ["mopollrow", "投票里的一个选项"], ["mopollbar", "投票选项下面那根票数条"], ["mopollbtn", "发朋友圈时的「投票」按钮（data-on=\"1\" 已加）"], ["mopollopts", "发朋友圈时填选项那一块"], ["moremind", "发朋友圈页「提醒谁看」那一排（data-on=\"1\" 是点了的人）"], ["moremindline", "动态下面「提醒了 谁 看」那一行"], ["mocomments", "评论区整块浅底框"], ["mocomment", "评论区里的一条评论"], ["moprofile", "个人页封面下面的滚动正文区（data-me=\"1\" 是她自己的个人页）"], ["mocover", "个人页顶部封面整块（data-on=\"1\" 是设了封面图）"], ["mocoveradj", "封面调位置时盖在上面那一层（提示＋取消／好了）"], ["moprofilehead", "封面右下角的名字＋大头像"], ["mosign", "封面下方的签名那一行"], ["moprofilepost", "个人页里的一条动态整块"]])}),
    Object.freeze({zh:"日历",pages:Object.freeze(["calendar"]),hooks:Object.freeze([["periodpage", "经期那一页的最外层"],["calpage", "日历整页外壳"],["calmonth", "月视图"],["calmonthbar", "月份那一行（左右翻页）"],["calmonthtitle", "月份大字"],["calbtn", "日历里的按钮（data-part: prevmonth/nextmonth/period/today/edit/delete/delseq/editseq/saveseq/delday/gen/formback/formsave/formdelete）"], ["calseqedit", "改 AI 排的那一段的页"], ["calghost", "当场改日程时，被盖住的那段原安排（淡色虚线垫在下面，点不到）"],["calkey", "经期图例那一行"],["calkeyitem", "一个图例（data-part: period/fertile/ov/safe）"],["caldow", "星期表头"],["calgrid", "月历格子区"],["calday", "月历上的一天（data-today, data-period）"],["caldaynum", "日期数字圈"],["caldaylunar", "农历小字"],["caldaydots", "事件小圆点"],["calweek", "日视图整块"],["calweekday", "日视图顶上那一周的某天（data-on）"],["caltznote", "时差说明"],["caldayhead", "日视图某天的抬头（data-today）"],["caldayheadtitle", "抬头里的日期"],["calallday", "全天事件条"],["calcolumn", "某天的时间轴列"],["calhour", "时间刻度"],["calnowline", "现在那根红线"],["calnowtag", "现在时刻的小标签"],["calblock", "时间轴上的一个日程块（data-done）"],["calblocktitle", "日程块标题"],["calblocktime", "日程块时间/地点小字"],["calpeople", "看谁的日历那一排"],["calperson", "一个人的头像按钮（data-on）"],["calpersonname", "人名"],["calfab", "右下角加号"],["calfabmenu", "加号弹出的菜单"],["calfabitem", "菜单项（data-part: new/genweek/delweek/genmonth）"],["calevdetail", "日程详情"],["calevtitle", "详情标题"],["calevtime", "详情时间"],["calevdev", "偏离计划的说明框"],["calevmurmur", "那会儿的碎碎念"],["calvis", "谁能看我的日历"],["calmaskpick", "看哪张面具的日程（点「我」的头像弹出来）"],["calsheettitle", "弹页标题"],["calvisrow", "可见性的一行（data-on）"],["calgen", "AI 生成本月"],["calinput", "输入框（data-part: genprompt/startdate/enddate/starttime/endtime/title/location）"],["calform", "新增/编辑日程表单"],["calformlabel", "表单小标签"],["calrepeat", "重复选项（data-on, data-part）"],["caliconpick", "图标选格（data-on）"],["calcolorpick", "颜色选点（data-on）"]])}),
    Object.freeze({zh:"一起听那张卡的背面",pages:Object.freeze(["musiccard"]),hooks:Object.freeze([["mcardpage", "唱片旁那一摞·整页"],["mcardtop", "照片预览+按钮那一块"],["mcardbtn", "按钮（data-part: photo/removephoto/removebg）"],["mcardinput", "输入（data-part: photofile/note/bgfile）"],["mcardsectitle", "分节标题"],["mcardhint", "说明小字"],["mcardgrounds", "卡片底的选格区"],["mcardground", "一个底（data-part=id/own, data-on）"],["mcardswatch", "底的色块"],["mcardgroundname", "底的名字"],["mcardinks", "浅字/深字那一排"],["mcardink", "字色选项（data-part, data-on）"]])}),
    Object.freeze({zh:"匿名问答",pages:Object.freeze(["anon"]),hooks:Object.freeze([["anonpage", "匿名主页外壳"],["anonbody", "滚动正文"],["anonintro", "开头说明"],["anonpool", "题库那张条"],["anonpooltitle", "题库剩几条"],["anonpoolnote", "题库说明"],["anonbtn", "按钮（data-part: brew/back/refresh/genbg/genmask/fillmask（马甲自己填）/savemask/netizen/write/openbox/submit/delete/followup/top）"],["anonmaskfill", "自己填马甲那一整页"],["anongrid", "马甲卡片网格"],["anoncard", "一张马甲卡（data-part: me/char）"],["anoncardhead", "卡片上半色块"],["anoncardicon", "卡片小方图标"],["anoncardname", "马甲名"],["anoncardcount", "几则问答"],["anoncardbio", "简介"],["anoncardlatest", "最新一条"],["anonempty", "没人可问"],["anonboxpage", "某人的匿名箱整页"],["anonboxhead", "箱子顶栏"],["anonboxtitle", "顶栏标题"],["anonboxbody", "箱子滚动区"],["anonboxcover", "主页背景封面"],["anonboxid", "头像+名字那块"],["anonboxnamewrap", "名字外层"],["anonboxname", "网名"],["anonboxbgdesc", "背景描述"],["anonboxbiowrap", "简介外层"],["anonboxbio", "简介"],["anonguess", "Ta 在猜你是谁"],["anonmasklabel", "「你的马甲」小字"],["anonmaskname", "你的马甲名"],["anonmaskbio", "你的马甲简介"],["anonactions", "提问按钮那一行"],["anonpending", "箱里待答那块"],["anonnote", "说明小字"],["anonasker", "写问题那一栏"],["anonreplyto", "追问引用"],["anoninput", "问题输入框"],["anontabs", "全部/我问的/网友问的"],["anontab", "一枚筛选邮戳（data-part, data-on）"],["anonrow", "一条问答（data-from）"],["anonfrom", "谁问的标签"],["anontime", "时间"],["anonfollowsrc", "追问的出处"],["anonq", "问题"],["anona", "回答（data-part: pending/skip）"]])}),
    Object.freeze({zh:"我的匿名主页",pages:Object.freeze(["anonme"]),hooks:Object.freeze([["anmepage", "我的匿名箱整页"],["anmebody", "滚动正文"],["anmemask", "马甲卡"],["anmemaskhead", "马甲卡色块"],["anmemaskname", "马甲名"],["anmemaskbio", "马甲简介"],["anmenote", "说明小字"],["anmebtn", "按钮（data-part: genmask/ask/pick/drop/answer/reveal；pick 带 data-on）"],["anmeask", "邀人来问那块"],["anmepicks", "选人那一排"],["anmepick", "一个可选的人"],["anmelist", "问答列表"],["anmerow", "一条问答（data-answered）"],["anmemeta", "一条的抬头小字"],["anmeq", "问题"],["anmea", "我的回答"],["anmeinput", "回答输入框"],["anmeempty", "空状态"]])}),
    Object.freeze({zh:"关系",pages:Object.freeze(["ties"]),hooks:Object.freeze([["tiespage", "关系页最外层"],["tiesheadbtns", "关系页顶栏右侧按钮组"],["tieswalkentry", "顶栏「走一圈」按钮"],["tiesaddbtn", "顶栏＋新增关系按钮（主页与按条看页）"],["tiesfaces", "顶部一排人脸切换条"],["tiesface", "人脸切换条中的一张脸；data-on=1 当前选中"],["tiesfacename", "选中那张脸下方的名字"],["tiesmasks", "「我」页的面具筛子条"],["tiesmask", "面具筛子单项；data-on=1 当前选中"],["tiesempty", "空状态；data-part=page/board/net/detail 区分哪一处"],["tiesboard", "关系板画布（可拖拽缩放的区域）"],["tiesnet", "整网图画布"],["tiesnode", "板子/整网上一张人物节点的外壳"],["tiesphoto", "人物拍立得照片；data-on=1 被选中"],["tiesphotoname", "拍立得下方名字"],["tieslabel", "连线上的关系牌子；data-on=1 选中/点亮"],["tiesnetdot", "整网图连线中点的小圆点；data-on=1 选中"],["tiespanel", "选中一段关系后底部弹出的说明面板"],["tiespanelname", "面板标题（A → B）"],["tiespanelbtn", "面板按钮；data-part=edit 编辑 / walk 从这儿走 / close 收起"],["tiespanellabel", "面板里的关系名称"],["tiespanelnote", "面板里的关系描述"],["tiespanelback", "面板里「对方那头写的」一块"],["tieszoom", "右上角缩放按钮组"],["tieszoombtn", "缩放按钮；data-part=＋/－/⌖/⟲"],["tiesdetailentry", "底部「按条看 · 改配角简介」入口"],["tieswalkpage", "关系图（走一圈）整页"],["tieswalkbtn", "关系图顶栏按钮；data-part=net 全部/回到这个人（data-on=1 正在看整网）、exit 退出"],["tiestrail", "关系图路径面包屑条"],["tiestrailitem", "面包屑单项；data-on=1 当前所在"],["tiesdetailpage", "按条看详情页"],["tiesdetaillist", "详情页滚动区"],["tiesdetailcount", "详情页「N 段关系」计数"],["tiesrow", "详情页一条关系卡；data-part=npc 表示配角卡（带简介）"],["tiesrowarrow", "关系卡方向箭头"],["tiesrowlabel", "关系卡关系名称"],["tiesrownote", "关系卡描述"],["tiesrownpctag", "配角卡「只在群里出场」标签"],["tiesnpcdel", "配角卡「删除这个配角」按钮"],["tieschip", "关系卡里的人物头像+名字"],["tieschipname", "人物小片中的名字"],["tiescomphead", "新增/编辑关系弹层头部"],["tiescomptitle", "弹层标题"],["tiescompbtn", "弹层头部按钮；data-part=delete 删除 / save 保存"],["tiescomptabs", "弹层顶部三档切换（我和角色/角色之间/NPC）"],["tiesseg", "分段按钮（tab、方向、单向谁对谁）；data-part=选项值，data-on=1 选中"],["tiespickgrid", "选择角色网格"],["tiespick", "可选角色卡；data-on=1 已选"],["tiespickname", "可选角色卡名字"],["tiescomplabel", "关系名称输入框"],["tiespresets", "关系名称预设标签组"],["tiespreset", "预设标签；data-on=1 与当前名称相同"],["tiesdraftbtn", "「让 TA 写一版」按钮"],["tiesdraftwhy", "AI 起草依据说明"],["tiessplit", "「两个方向分别描述」开关；data-on=1 已开"],["tiescompdesc", "关系描述文本框"],["tiescompcount", "描述字数计数"],["tiesnpcmode", "NPC 生成/自己写 切换条"],["tiesnpcmodebtn", "NPC 模式按钮；data-part=gen/hand，data-on=1 选中"],["tiesnpcinput", "NPC 表单输入；data-part=name 名字 / rel 关系 / brief 简介 / ask 要生成谁 / knows 交情"],["tiesnpchint", "NPC 表单说明文字"],["tiesnpcsubmit", "NPC 提交按钮；data-part=add 加进来 / gen 生成"], ["tiesnpcmask", "NPC 表单里「算谁认识的人」那一栏整块"], ["tiesnpcmaskpick", "那一栏里的每一个（谁都看得见／某张面具，data-on=1 是选中的）"],["tiesnpclist", "身边已有配角列表"],["tiesnpcitem", "已有配角一行"],["tiesnpcname", "已有配角名字"],["tiesnpcknows", "「也认识我」切换；data-on=1 认识"],["tiesnpcitemdel", "已有配角删除按钮"]])}),
    Object.freeze({zh:"购物",pages:Object.freeze(["shop"]),hooks:Object.freeze([["shoppage", "购物 App 最外层"],["shophome", "首页视图"],["shopcats", "品类横向 tab 条"],["shopcat", "品类 tab；data-on=1 当前品类"],["shopcatname", "品类 tab 文字"],["shopcatbar", "选中品类下划线"],["shopgridscroll", "首页商品滚动区"],["shopgrid", "商品双列网格"],["shopcard", "商品卡"],["shopcardtag", "商品图位上的品类标"],["shopcardbody", "商品卡文字区"],["shopcardname", "商品名"],["shopcarddesc", "商品卖点标签"],["shopcardprice", "商品价格"],["shopcardsales", "商品销量"],["shopcardadd", "商品卡＋加购按钮"],["shopwishbtn", "想要（爱心）按钮；data-part=card/row/detail 所在位置，data-on=1 已想要"],["shopgenbtn", "刷商品按钮；data-part=empty 空态按钮 / more 继续看"],["shopempty", "空状态；data-part=home/cart/shipping/receiving/inventory/group/spot"],["shopcart", "购物车视图"],["shopcartlist", "购物车列表滚动区"],["shopcartrow", "购物车一行"],["shopcartcheck", "购物车行勾选圈"],["shopcartthumb", "购物车行缩略图"],["shopcartname", "购物车行商品名"],["shopcartprice", "购物车行价格"],["shopcartdel", "购物车行删除"],["shopcartbar", "购物车底部结算栏"],["shopcartall", "全选按钮；data-on=1 已全选"],["shopcarttotal", "合计金额"],["shopcheckout", "结算按钮"],["shopmy", "「我的」视图"],["shopmylist", "「我的」滚动区"],["shopsection", "分区标题；data-part=shipping/receiving/wish/inventory"],["shoporder", "订单卡；data-part=shipping 待发货 / receiving 待收货"],["shopordername", "订单商品名"],["shopordermeta", "订单副信息（价格/付款方式/送达）"],["shoporderleft", "待发货剩余时间"],["shoporderprice", "待收货价格"],["shoporderbtn", "订单按钮；data-part=use 收下 / regift 转赠 / cancel 取消订单 / return 退货"],["shopwishrow", "想要清单一行"],["shopwishthumb", "想要行色块"],["shopwishname", "想要行名称"],["shopwishprice", "想要行价格"],["shopinvgroup", "我的物品一组（按来源）"],["shopinvgrouphead", "物品组标题行"],["shopinvdreamy", "梦中物品说明文字（列表与操作面板）"],["shopinvgrid", "物品三列网格"],["shopinvtile", "物品格；data-on=1 带在身上"],["shopinvthumb", "物品格色块"],["shopinvqty", "物品数量角标"],["shopinvonme", "「带着」角标"],["shopinvname", "物品名"],["shopinvtime", "入库时间"],["shopinvtitle", "物品操作面板标题"],["shopinvact", "物品操作面板一个动作行"],["shopinvactname", "动作名"],["shopinvactsub", "动作说明"],["shopdetailmask", "商品详情遮罩"],["shopdetail", "商品详情面板"],["shopdetailhero", "详情大图位"],["shopdetailclose", "详情关闭按钮"],["shopdetailprice", "详情价格"],["shopdetailsales", "详情销量"],["shopdetailname", "详情商品名"],["shopdetaildesc", "详情卖点标签"],["shopdetailnote", "详情说明文字"],["shopask", "「拿给TA看看」区块"],["shopaskbtn", "「拿给TA看看」按钮"],["shopasklabel", "「拿给谁看」标题"],["shopaskchar", "可选角色胶囊"],["shopdetailbar", "详情底部按钮栏"],["shopdetailbtn", "详情按钮；data-part=cart 加入购物车 / buy 去结算"],["shopnav", "底部导航栏"],["shopnavtab", "底部导航项；data-part=home/cart/my，data-on=1 当前"],["shopnavlabel", "导航项文字"],["shopnavbadge", "导航角标；data-part=cart 数量 / my 红点"],["shopsheetbtn", "结算方式大按钮；data-on=1 主按钮（余额购买）"],["shopsheethint", "群送礼弹层说明"],["shoppickrow", "选人行；data-part=char/group/member/kinship/spot/regift"],["shoppickname", "选人行名字"],["shopkinleft", "亲属卡剩余额度"]])}),
    Object.freeze({zh:"外卖",pages:Object.freeze(["takeout"]),hooks:Object.freeze([["tkopage", "外卖 App 最外层"],["tkonear", "附近视图"],["tkoslots", "饭点标尺条"],["tkoetarow", "结算页「几点送到」那一行"],["tkoeta", "送达时间的选项（尽快／一两小时后／自己挑）；data-on=1 是选中的"],["tkoetatime", "自己挑钟点的那个时间框"],["tkoslot", "饭点格；data-on=1 当前选中"],["tkoslotname", "饭点名"],["tkoslottime", "饭点时段"],["tkoslotbar", "饭点下方刻度条"],["tkoslotnow", "「现在」圆点"],["tkoshoplist", "店铺列表滚动区"],["tkoempty", "空状态；data-part=near/targets/riding/arrived/log"],["tkogenbtn", "空态刷新店铺按钮"],["tkoshopcard", "店铺卡"],["tkoshopcardword", "店铺卡色块上的字"],["tkoshopcardname", "店铺名"],["tkoshopcardmeta", "店铺时效/起送价行"],["tkoshopcarddishes", "店铺卡菜品标签组"],["tkoshopcarddish", "店铺卡菜品标签"],["tkotag", "通用小标签（品类/菜品描述）"],["tkoshoppage", "店铺页"],["tkoshopscroll", "店铺页滚动区"],["tkoshophead", "店铺页头图文字区"],["tkoshopname", "店铺页店名"],["tkoshopchip", "店铺页胶囊；data-part=kind 品类 / eta 时效"],["tkodishes", "菜品列表"],["tkodish", "菜品卡；data-on=1 已点"],["tkodishword", "菜品色块上的字"],["tkodishname", "菜品名"],["tkodishdesc", "菜品描述容器"],["tkodishqty", "已点份数"],["tkoqtybtn", "加减份数；data-part=plus/minus"],["tkobagbar", "底部购物袋结算栏"],["tkobagicon", "购物袋图标；data-on=1 有东西"],["tkobagcount", "购物袋数量角标"],["tkobagtotal", "购物袋金额/还没点"],["tkobageta", "购物袋送达时间"],["tkobagpay", "去结算按钮；data-on=1 可点"],["tkopaypage", "付款页"],["tkopayscroll", "付款页滚动区"],["tkoreceipt", "小票整体"],["tkoreceiptbody", "小票正文"],["tkoreceiptshop", "小票店名"],["tkoreceipteta", "小票送达时间"],["tkoreceiptline", "小票一行菜品"],["tkoreceipttotal", "小票合计行"],["tkoremark", "给店家的备注输入框"],["tkoreceiptedge", "小票锯齿边"],["tkosection", "分区标题"],["tkopaymode", "付款方式卡；data-part=buy/paylater/kinship/forchar，data-on=1 展开"],["tkopaymodebtn", "付款方式卡按钮"],["tkopaymodename", "付款方式名"],["tkopaymodesub", "付款方式说明"],["tkopaygo", "「付款」胶囊"],["tkopaytargets", "展开后的选人区"],["tkosay", "给TA点单时的留言输入框"],["tkopickrow", "选人行；data-part=group 表示群"],["tkopickname", "选人行名字"],["tkopickextra", "选人行附加信息（额度等）"],["tkoorders", "订单视图"],["tkoorderlist", "订单滚动区"],["tkoorder", "订单卡"],["tkoordershop", "订单店名"],["tkoorderprice", "订单价格"],["tkoorderitems", "订单菜品"],["tkoorderpay", "订单付款方式"],["tkoremarktext", "订单备注文字"],["tkonote", "TA写在单子上的话"],["tkoride", "骑手在路上区块"],["tkoridetime", "剩余时间"],["tkoridebar", "配送进度条"],["tkoarrived", "已送达行"],["tkoarrivedtext", "已送达文字"],["tkoeatbtn", "「吃掉」按钮"],["tkolog", "吃过的列表卡"],["tkologrow", "吃过的一条；data-on=1 已展开"],["tkologname", "吃过的名称"],["tkologtime", "吃过的日期"],["tkologitems", "展开后的菜品"],["tkologmeta", "展开后的价格/时间"],["tkonav", "底部导航栏"],["tkonavtab", "导航项；data-part=near/orders，data-on=1 当前"],["tkonavlabel", "导航项文字"],["tkonavbadge", "订单红点"]])}),
    Object.freeze({zh:"随身物",pages:Object.freeze(["carry"]),hooks:Object.freeze([["carrypage", "随身物主页最外层；data-part=empty 无角色 / box 选人柜"],["carryboxframe", "选人柜外框"],["carryboxlist", "选人柜内滚动区"],["carryboxchar", "选人柜里的角色"],["carryboxcharname", "选人柜角色名"],["carrydoor", "柜门；data-part=left/right，data-on=1 已拉开"],["carryboxhint", "柜门下方提示"],["carrymine", "顶栏右侧「我的物品」，进购物「我的」页"], ["carrymycloset", "随身物顶上「我的衣柜」那颗（点进你自己的衣柜）"],["carryregen", "重新翻按钮；data-part=page 主页 / all 全部页 / section 单栏页"],["carrycabinet", "主页柜子区"],["carrycabinetbody", "柜身"],["carrywho", "柜顶当前角色/换人按钮"],["carrywhoname", "当前角色名"],["carrywhoswitch", "「换个人」文字"],["carrydrawers", "抽屉列"],["carrydrawer", "抽屉；data-part=栏目key，data-on=1 有新内容"],["carrydrawername", "抽屉名"],["carrydrawercount", "抽屉件数"],["carrydrawernew", "抽屉新内容红点"],["carrydrawerswatches", "抽屉色块预览"],["carrydrawernames", "抽屉内物品名预览"],["carrypickrow", "切换角色弹层一行"],["carrypickname", "切换角色名字"],["carryallpage", "一次看全部页"],["carrytabs", "全部页栏目跳转条"],["carrytab", "栏目跳转签；data-part=栏目key"],["carrytabname", "栏目签文字"],["carryallscroll", "全部页滚动区"],["carryallsec", "全部页一栏；data-part=栏目key"],["carryallsechead", "一栏标题行"],["carryallsecname", "一栏标题"],["carrysecpage", "单栏页；data-part=栏目key"],["carrysecscroll", "单栏页滚动区"],["carryempty", "空状态；data-part=gifts/closet/stuff/list/chars"],["carrysectionnote", "栏内小眉标"],["forumaltrename", "论坛·角色小号主页：「换个网名」"],["forumaltedit", "那一块改网名的小框"],["forumalthandle", "改网名框里的 @id 那一格"],["forumaltregen", "改网名框里「让它起一个」"],["forumaltsave", "改网名框里「存」"],["carryclosetadd", "随身物·TA的衣柜：最底下添衣服那一块"],["carryclosetkw", "添衣服的关键词框"],["carryclosethangopen", "「自己挂一身 ＋」"],["carryclosethang", "自己挂一身那张小表"],["carryclosethangsave", "「挂进去」"],["carrypinhint", "随身物·衣柜：顶上那句「点开 → 钉住」的提示"],["carrypin", "钉住◆标记"],["carrygiftbox", "礼物栏底盒"],["carrygiftgroup", "礼物按月一组"],["carrygiftgrouphead", "礼物组标题行"],["carrygiftgroupname", "礼物组月份"],["carrygift", "礼物一行"],["carrygiftthumb", "礼盒图"],["carrygiftname", "礼物名"],["carrygifttime", "礼物收到时间"],["carrycloset", "衣柜栏整体"],["carryoccasion", "衣柜一个场合"],["carryoccasionname", "场合名"],["carryoccasioncount", "场合套数"],["carrybay", "挂杆格"],["carryhanger", "挂着的一身；data-on=1 已钉住"],["carryhangername", "衣服名"],["carryhangernote", "衣服说明"],["carrymorebtn", "「再添几身」按钮"],["carrystuff", "物件栏整体"],["carrystuffbox", "物件底盒"],["carrycard", "物件卡；data-on=1 已钉住"],["carrycardname", "物件名"],["carrycardnote", "物件说明"],["carryrow", "列表式一行；data-on=1 已钉住"],["carryrowname", "列表行名称"],["carryrownote", "列表行说明"],["carrycasemask", "物件详情遮罩"],["carrycase", "物件详情柜框"],["carrycaseinner", "柜框内层"],["carrysheettitle", "详情标题"],["carrysheetnote", "详情说明"],["carrysheetlabel", "详情小标签；data-part=en/zh"],["carrythink", "TA的想法区"],["carrythinklabel", "想法标题"],["carrythinktext", "想法正文"],["carrysheetactions", "详情操作区"],["carrysheetbtn", "详情按钮；data-part=wear 让他换上 / pin 钉住（data-on=1 已钉）/ peek 摆到他面前 / delete 删掉"],["carrysheethint", "操作说明"],["carrygiftmeta", "礼物详情收到日期"],["carrygiftbtn", "礼物详情按钮；data-part=think 让TA说说 / closet 挂进衣柜 / peek 聊天里提起"],["carrygiftcloset", "挂进衣柜区"],["carrygifthint", "挂进衣柜提示"],["carrygiftocc", "场合选择按钮"],["carrygiftpeek", "聊天里提起区"]])}),
    Object.freeze({zh:"我的衣柜",pages:Object.freeze(["mycloset"]),hooks:Object.freeze([["closetpage", "我的衣柜最外层"],["closetsetpin", "一身衣服上的「钉住」；data-on=1 已钉住（出图每张都穿它）"],["closetpinned", "顶上那行「现在钉着」"],["closetaddtoggle", "顶栏自己挂一身按钮；data-on=1 表单已展开"],["closetrail", "顶部挂衣杆"],["closetscroll", "滚动区"],["closetintro", "说明文字"],["closetgen", "生成卡片"],["closetgeninput", "关键词输入"],["closetgenbtn", "配四身按钮；data-on=1 生成中"],["closetgenhint", "生成说明"],["closetadd", "手动添加表单"],["closetaddinput", "添加表单输入；data-part=occasion/name/note"],["closetaddbtn", "挂进去按钮"],["closetlist", "衣柜列表"],["closetcount", "总件数"],["closetgroup", "场合分组"],["closetgrouphead", "分组标题行"],["closetgroupbar", "分组色条"],["closetgroupname", "场合名"],["closetset", "一身衣服卡"],["closetsetname", "衣服名"],["closetsetdrop", "拿掉按钮"],["closetsetnote", "衣服描述"],["closetempty", "空衣柜状态"]])}),
    Object.freeze({zh:"亲属卡账单",pages:Object.freeze(["kincard"]),hooks:Object.freeze([["kinbillpage", "亲属卡账单页最外层；data-part=empty 卡片不存在"],["kinbillscroll", "滚动区"],["kinbillface", "卡面容器"],["kinbillraise", "申请加额度区"],["kinbillraisebtn", "申请加额度按钮"],["kinbillraiseform", "加额度表单"],["kinbillraisehint", "加额度说明"],["kinbillraiseinput", "金额输入"],["kinbillraisego", "表单按钮；data-part=send 发送 / cancel 取消"],["kinbillledger", "账单区"],["kinbilltitle", "「刷卡账单」标题"],["kinbillempty", "无账单状态"],["kinbillrow", "账单一行"],["kinbillrowname", "账单项目名"],["kinbillrowtime", "账单时间"],["kinbillrowamount", "账单金额"],["kinbillquit", "解绑区"],["kinbillquitbtn", "解绑入口按钮"],["kinbillquitform", "解绑表单"],["kinbillquithint", "解绑说明"],["kinbillquitinput", "留言输入"],["kinbillquitgo", "解绑按钮；data-part=confirm 确认 / cancel 再想想"]])}),
    Object.freeze({zh:"给TA的亲属卡",pages:Object.freeze(["mykin"]),hooks:Object.freeze([["mykinpage", "我给TA的亲属卡页最外层（选人/开卡/管理三态共用）"],["mykinscroll", "滚动区"],["mykinlabel", "小节标题"],["mykinpicks", "选人网格"],["mykinpick", "可选角色；data-on=1 已开过卡"],["mykinpickname", "角色名"],["mykinpickhas", "「已开」标记"],["mykinface", "卡面容器；data-part=new 开卡预览 / issued 已开卡（data-on=1 冻结中）"],["mykininput", "输入框（额度/留言/新额度）"],["mykindaily", "「平时花钱也能刷」开关行"],["mykindailyname", "开关标题"],["mykindailysub", "开关说明"],["mykingo", "递卡按钮容器"],["mykinbtn", "操作按钮；data-part=按钮文字，data-on=1 主按钮"],["mykinfrozen", "冻结中提示"],["mykinactions", "冻结/平时刷/收回按钮组"],["mykinlimit", "调额度行"],["mykinrow", "账单一行"],["mykinrowname", "账单项目"],["mykinrowtime", "账单时间与来源"],["mykinrowamount", "账单金额"],["mykinrowask", "账单行「问问」按钮"],["mykinempty", "无账单状态"]])}),
    Object.freeze({zh:"收藏",pages:Object.freeze(["favorites"]),hooks:Object.freeze([["favpage", "收藏首页最外层"],["favlist", "首页滚动区"],["favstack", "一摞（某角色的收藏）"],["favstackbtn", "一摞的点击卡"],["favstackname", "角色名"],["favstackcount", "剪下张数"],["favdetailpage", "某角色收藏详情页"],["favdetaillist", "详情滚动区"],["favcard", "一张剪报；data-part=me 我说的 / char 角色说的"],["favcardhead", "剪报头部行"],["favcardmeta", "说话人与时间"],["favdelbtn", "「揭下来」按钮"],["favsticker", "表情图"],["favvoicehead", "语音头部（时长+播放）"],["favtext", "剪报正文；data-part=text/voice/photo"]])}),
    Object.freeze({zh:"表情包",pages:Object.freeze(["emotes"]),hooks:Object.freeze([["emopage", "表情包页最外层"],["emoscroll", "滚动区"],["emonote", "小节标题行"],["emonotetext", "小节标题文字"],["emoaddpack", "「新开一版」按钮"],["emopacks", "版面横向列表"],["emopack", "一版；data-on=1 当前选中"],["emopackcover", "版面封面"],["emopackname", "版面名"],["emoempty", "空状态；data-part=packs 无版 / emotes 版内无图"],["emopacktitle", "版名输入框"],["emoswitchrow", "开关行；data-part=global 谁都能用 / mine 我自己也能发"],["emoswitchname", "开关标题"],["emoswitchsub", "开关说明"],["emoswitch", "开关；data-part=global/mine，data-on=1 开"],["emochars", "绑定角色组"],["emochar", "角色姓名贴；data-on=1 已绑定"],["emoglobalhint", "谁都能用时的提示"],["emotools", "表情网格右上工具组"],["emotoolbtn", "工具按钮；data-part=cover 设成封面 / select 挑几张（data-on=1 挑选中）"],["emogrid", "表情网格"],["emotile", "表情格；data-on=1 被挑中"],["emotilecard", "表情格卡片"],["emotilecover", "封面角标"],["emotilecheck", "挑中勾"],["emotilename", "表情关键词"],["emodelsel", "删除所选按钮"],["emomove", "挑几张时「挪到」那一块"],["emomoveto", "挪到哪一版的按钮"],["emomovemode", "挪过去／复制一份切换；data-part move|copy，data-on=1 当前"],["emohelp", "导入格式说明框"],["emofilebtn", "选文件按钮；data-part=list 清单文件 / images 相册图片"],["emofilehint", "选文件说明"],["emostaged", "待上传图片区"],["emostagedhint", "待上传说明"],["emostagedtile", "待上传一张"],["emostageddrop", "待上传移除按钮"],["emostagedinput", "待上传关键词输入"],["emostagedbtn", "待上传按钮；data-part=clear 清空 / save 贴上"],["emoimporttext", "清单粘贴文本框"],["emoimportbtn", "导入按钮"],["emodelpack", "撕掉这一版按钮"]])}),
    Object.freeze({zh:"直播",pages:Object.freeze(["live"]),hooks:Object.freeze([["livepage", "直播首页整页"],["liveonair", "首页「正在播」的一条直播"],["liveonairtitle", "正在播那条的标题（谁在播什么）"],["liveonairtime", "正在播那条已播时长"],["livejoin", "进直播间按钮；data-part=me 本号进 / mask 马甲进"],["livedoor", "首页大入口卡（看直播／自己开播）"],["livedoortitle", "大入口卡标题"],["liveempty", "没有角色时的空状态"],["liveselfcfg", "「角色自己开播」开关按钮"],["livereplay", "回放列表的一行"],["livereplaytitle", "回放标题"],["livereplaytime", "回放时间/信息行"],["livereplaydel", "删回放按钮"],["livemissed", "「错过的」那一行（TA 播了你没去）"],["liverecap", "「看高光」按钮"],["liveinvitebtn", "路人主播直播间里「叫 TA 一起看」按钮"],["liveinvite", "点开后挑人那一排"],["liverank", "直播首页「本周礼物榜」那一块"],["liverankrow", "礼物榜的一行"],["livesetup", "开播/看播设置页整页"],["livelabel", "设置页各段小标题"],["livechip", "设置页选项胶囊；data-on=1 选中"],["livecharlist", "选角色那一排的容器"],["livecharpick", "选角色头像按钮；data-on=1 已选"],["livecharname", "选角色头像下的名字"],["livefield", "设置页输入框；data-part=title 标题 / topic 话题"],["livestart", "开始直播按钮"],["liveroom", "直播间整页"],["liveshare", "直播间右上「分享」按钮"],["livestage", "直播间顶上浮着的主播信息条"],["livestagetitle", "画面区左上直播间名"],["livestagesub", "画面区左上副行（在播/已下播）"],["livehostline", "画面区主播最新一句"],["livepk", "PK 进度条区"],["livefanbar", "粉丝团/榜一/房管信息条"],["liveitem", "带货商品条"],["livebuy", "商品条「买」按钮"],["livemsglist", "弹幕/消息滚动区"],["livemsg", "一条弹幕；data-kind=gift/enter/event/private/reg/host/me/rival 等类型，data-me=1 是你发的"],["livemsgname", "弹幕前的发送者名字"],["liveban", "弹幕旁「禁言」按钮"],["livebusy", "正在回复的占位提示"],["livecompose", "底部输入区"],["livesonglist", "点歌列表浮层"],["livesong", "点歌列表里的一首"],["liveselfpick", "「TA 们会自己开播」下面挑人那一排"],["liveselfchip", "挑谁会自己开播的一个人；data-on=1 会播"],["liveautodot", "自动往下播开着时 ⋯ 上的小红点"],["livevoicepick", "进直播间前「开声音」那一行；data-on=1 开"],["livevoicebtn", "直播间 ⋯ 里「声音」开关；data-on=1 开着"],["livebg", "直播间画出来的那张底图"],["livedrawbtn", "⋯ 里「画出来」"],["livemid", "全屏直播间中间那块（镜头、动作，字多了能滚）"],["livecapcard", "全屏直播间中间偏下那张字幕卡"],["livegiftbanner", "从左边滑出来的礼物横幅"],["livemorebtn", "底栏「⋯」按钮；data-on=1 打开"],["livemoreitem", "⋯ 菜单里的一项"],["livemoremenu", "⋯ 菜单（连麦、叫 TA 一起看、点歌）"],["livelinkbtn", "连麦按钮；data-on=1 连麦中（点了断开）"],["liveautobtn", "直播间「自动往下播」开关（data-on=\"1\" 开着）"],["liveautosec", "自动往下播旁边那个「N 秒」"],["liveautoslider", "点「N 秒」才弹出来的那根拉条"],["livestrangers", "直播首页「路人主播」那一块"],["livebrowse", "「随便逛逛」按钮"],["livestcard", "路人主播的一张卡（刷到的、关注的）"],["livestpage", "路人主播的主页"],["livestfollow", "主页上的关注按钮"],["livesttie", "主页上「用自己的号／用马甲」那一格交情"],["livestbtn", "私信、申请加好友按钮"],["livestdm", "跟路人主播的私信页"],["livestlv", "路人主播主页上名字旁边的小数字等级"],["livestclub", "主页上展开那行粉丝团（团名 · 这一级叫什么）"],["livestclubroll", "「让他重新起名」"],["livetitle", "直播间标题那一行（顶栏下面，点一下展开全文）"],["livescene", "画面上「镜头里的样子」那行（变了才换）"],["liveact", "画面上「此刻在干嘛」那行（每一拍换）"],["livecapdots", "字幕下面那排小点（这一拍几句、放到第几句）"],["livesongbtn", "点歌按钮"],["livegiftbtn", "打开礼物面板按钮"],["liveinput", "发弹幕输入框"],["livesend", "发送按钮"],["livegiftpanel", "礼物面板"],["livegift", "礼物格；data-on=1 选中"],["livegiftdel", "自定义礼物的删除叉"],["livegiftmake", "「自定义」礼物格；data-on=1 正在自定义"],["livegiftform", "自定义礼物表单行"],["livegiftinput", "自定义礼物输入；data-part=name 名称 / amount 金额"],["livegiftkeep", "「留着下次用」切换；data-on=1 留"],["livegiftsend", "送出礼物按钮"], ["livegiftcancel", "礼物栏「不送了」"],["livedanmaku", "背景飘屏弹幕层"],["liveshareview", "分享到聊天的选择页"],["livesharelist", "分享页角色列表容器"],["livesharechar", "分享页角色头像按钮"],["livesharerow", "分享页聊天/群房间行"],["livecard", "聊天里的直播回放卡片"],["livecardtitle", "回放卡片标题"],["livecardline", "回放卡片里的一条弹幕"]])}),
    Object.freeze({zh:"片刻",pages:Object.freeze(["shua"]),hooks:Object.freeze([["shuapage", "刷刷整页外壳"],["shuatabbar", "底部导航栏"],["shuatab", "底部导航按钮；data-on=1 当前页"],["shuapostfab", "底栏中间「发一条」按钮"],["shuafeedtab", "首页「关注/推荐/同城」页签；data-on=1 当前"],["shuacity", "同城城市选择；data-on=1 当前城市"],["shuarefreshbtn", "刷新/换一批按钮"],["shuafeed", "竖屏视频流滚动区"],["shuagrid", "横屏双列视频网格"],["shuaempty", "各处空状态"],["shuavcard", "竖屏一条视频卡"],["shuascene", "无图时的画面文字描述"],["shuarailbtn", "竖屏右侧操作按钮（赞/评/藏/分享等）；data-on=1 已点亮"],["shuaauthorbtn", "作者头像/作者按钮"],["shuamorebtn", "「更多」按钮"],["shuamoremenu", "更多菜单浮层"],["shuamoreitem", "更多菜单项；data-part=draw 出图 / del 删除"],["shuacaption", "竖屏卡底部文案区"],["shuaauthor", "竖屏卡作者名"],["shuacmtpage", "评论页整页"],["shuacmt", "一条评论；data-me=1 你写的"],["shuacmtname", "评论者名字"],["shuacmttext", "评论正文"],["shuacompose", "底部输入区"],["shuainput", "评论/弹幕输入框"],["shuasend", "发送按钮"],["shuarefresh", "「刷新」页整页"],["shuabig", "刷新页大按钮"],["shuabigtitle", "大按钮标题"],["shuacharpick", "选角色头像；data-on=1 已选"],["shuacharname", "选角色头像下名字"],["shuarealfriends", "「认识TA的人来评」勾选；data-on=1 开"],["shuapost", "发视频页整页"],["shuasameref", "拍同款时的原视频引用框"],["shualivedoor", "发布页「开直播」入口"],["shuafield", "发布页多行输入"],["shuachip", "「画面里有没有你」选项；data-on=1 选中"],["shuawithpick", "同框角色头像；data-on=1 选中"],["shuapostbtn", "发布按钮"],["shuabcard", "横屏视频卡"],["shuabcardtitle", "横屏卡标题"],["shuabcardsub", "横屏卡作者/信息行"],["shuacharge", "充电面板一个档位"],["shuachargegrid", "充电档位网格"],["shuachargeinput", "自定义充电金额输入"],["shuachargebtn", "自定义充电确认"],["shuabdetail", "横屏视频详情页整页"],["shuabinfo", "详情页信息卡"],["shuabtitle", "详情页标题"],["shuatag", "话题标签"],["shuaactbar", "详情页操作按钮行"],["shuaact", "详情页操作按钮；data-on=1 已点亮"],["shuabcmts", "详情页评论区"],["shuareply", "评论下的回复；data-me=1 你写的"],["shuareplybtn", "「回复」按钮"],["shuadmtoggle", "弹幕/评论切换；data-on=1 弹幕模式"],["shuahot", "热门话题条"],["shuahotchip", "热门话题；data-on=1 当前筛选"],["shuaprofile", "作者主页整页"],["shuaprofilehead", "主页头部（头像+数据）"],["shuabio", "主页简介"],["shuatile", "作品网格的一格"],["shuasharepage", "分享到聊天页"],["shuasharerow", "分享页聊天/房间行"], ["shuasharelist", "片刻转发：选人列表"],["shuasharechar", "分享页角色头像按钮"],["shuaseriesfollow", "横着看详情页系列旁「追更」按钮；data-on=1 已追更"],["shuamaskrow", "「我」页「用哪张面具发」那一排"],["shuamask", "挑面具的一颗；data-on=1 现在用的"],["shuatogether", "分享页「拉 TA 一起看」开关；data-on=1 开"],["shuafavs", "收藏视频流页"],["shuamine", "我的作品视频流页"],["shualive", "直播页签容器"],["shuafavpage", "收藏夹整页"],["shuafolderbar", "文件夹横排"],["shuafolder", "文件夹签；data-on=1 打开中"],["shuafoldername", "文件夹名字"],["shuafolderinput", "新建文件夹名输入"],["shuafolderok", "新建文件夹确认"],["shuafavitem", "收藏夹里的一条"],["shuamsgpage", "消息页整页"],["shuanote", "一条通知；data-on=1 未读"],["shuanotetext", "通知正文"],["shuanotetime", "通知时间"],["shuanotevid", "消息那一条底下「是哪条视频」，点进去就是那条"],["shuaone", "从消息点进来的那一条视频整页"],["shuamepage", "「我」页整页"],["shuahandle", "账号名输入；data-part=alt 小号名"],["shuacppost","情侣号下面「让TA往这个号发一条」那颗键"],["shuacprow", "情侣号一行"],["shuaskinrow", "「首页样子」设置行"],["shuaskin", "竖着刷/横着看切换；data-on=1 当前"],["shuaworks", "我的作品网格"],["shuashare", "聊天里的视频分享卡"],["shuashareauthor", "分享卡作者名"]])}),
    Object.freeze({zh:"梦境",pages:Object.freeze(["dream"]),hooks:Object.freeze([["drmpage", "入梦首页整页"],["drmnewbtn", "「新入一场梦」按钮"],["drmloops", "「TA昨晚真做的梦」区"],["drmloop", "一场可推门的梦"],["drmlooptitle", "梦标题行"],["drmloopsub", "梦副行"],["drmempty", "没有存档的空状态"],["drmsave", "一条梦存档卡"],["drmsavemark", "存档状态标记"],["drmsavetitle", "存档标题"],["drmsavesub", "存档副行"],["drmsetup", "入梦设置页整页"],["drmlabel", "设置页小标题"],["drmcharpick", "选人按钮；data-part=dreamer 做梦的人 / guest 梦里的客人，data-on=1 已选"],["drminject", "「注入最近聊天」开关行；data-on=1 开"],["drmkeyword", "三个关键词输入框"],["drmstartbar", "底部开始栏"],["drmstartbtn", "开始入梦按钮"],["drmkeep", "醒来带出的物件卡"],["drmkeepname", "物件名"],["drmkeepbtn", "带走按钮"],["drmplay", "梦境进行页整页"],["drmfeed", "梦境滚动区"],["drmrecur", "复现梦的提示"],["drmscene", "一幕"],["drmscenetext", "一幕正文"],["drmchosen", "「你选择了」那块"],["drmrewind", "回到这一幕按钮"],["drmcontrols", "底部选项区"],["drmwaiting", "正在生成的提示"],["drmoption", "一个选项按钮"],["drmretry", "重试按钮"],["drmwakebtn", "醒来按钮"],["drmending", "结局块；data-part=good 好梦 / true 直梦 / bad 噩梦 / woke 主动醒来"],["drmendmark", "结局落款"],["drmagain", "重回某一幕按钮"]])}),
    Object.freeze({zh:"解梦馆",pages:Object.freeze(["dreamjournal"]),hooks:Object.freeze([["djpage", "梦境日记整页"],["djtabs", "页签行"],["djtab", "页签；data-on=1 当前"],["djmotifbtn", "右上「常客」按钮；data-on=1 展开"],["djmotifs", "潜意识常客面板"],["djmotif", "母题小签"],["djmic", "语音输入按钮；data-on=1 录音中"],["djcompose", "记梦卡"],["djinput", "记梦输入框"],["djaddbtn", "记录按钮；data-part=dream 梦 / fragment 碎片 / none 没做梦"],["djday", "日期分组标题"],["djentry", "一条梦记录卡"],["djkind", "记录类型小签"],["djtext", "梦正文"],["djexpand", "展开/收起解读"],["djinterpretbtn", "「请人解」按钮；data-on=1 选人中"],["djcharpick", "选解梦角色按钮"],["djreading", "一条解读"],["djreadingname", "解读者名字"],["djreadingtext", "解读正文"],["djreadingsign", "解读里的征兆"],["djdel", "删除按钮"],["djempty", "空状态"],["djsign", "征兆页一张征兆卡"],["djsigntitle", "征兆标题"],["djnight", "「TA们的梦」按夜分组标题"],["djtheir", "TA的一场梦卡"],["djcharname", "做梦者名字"],["djenter", "进梦按钮"],["djgenerate", "生成梦按钮"],["djwakeline", "醒来那句"]])}),
    Object.freeze({zh:"塔罗",pages:Object.freeze(["tarot"]),hooks:Object.freeze([["tarotpage", "塔罗首页整页"],["tarotsky", "首页星空（玩法入口）"],["tarotsearch", "历史搜索框"],["tarotclear", "清空搜索"],["tarotchips", "历史筛选签行"],["tarotchip", "历史筛选签；data-on=1 当前"],["tarotgroup", "按类分组"],["tarothist", "一条历史记录"],["tarothisttitle", "历史标题行"],["tarothistsub", "历史副行"],["tarotmore", "展开更多"],["tarotempty", "空状态"],["tarotsetup", "起卦设置页整页"],["tarotblurb", "玩法说明"],["tarotdailyall", "「全部角色都解读」开关；data-on=1 开"],["tarotcharpick", "选角色；data-on=1 已选"],["tarotspreadgroup", "牌阵分组；data-on=1 当前"],["tarotspread", "牌阵格；data-on=1 选中"],["tarotspreadnew", "「自定义牌阵」按钮"],["tarotspreadedit", "自定义牌阵编辑框"],["tarotspreadsave", "保存牌阵"],["tarotowner", "谁来问；data-on=1 选中"],["tarotinput", "输入框；data-part=spreadname/positions/question/choice/followup"],["tarotgate", "角色答应/拒绝提示"],["tarotbar", "底部固定按钮栏"],["tarotgo", "开始按钮"],["tarotbusy", "生成中整页"],["tarotdeal", "洗牌抽牌页"],["tarotshuffle", "重新洗牌"],["tarotslot", "牌位格"],["tarotback", "牌背"],["tarotpending", "当前选中提示"],["tarotconfirm", "确认这张"],["tarotfinish", "抽完翻牌"],["tarotresult", "解读结果页"],["tarotforward", "转发到聊天按钮"],["tarotspreadrow", "摊开的牌行"],["tarotcard", "一张牌"],["tarotcardbtn", "牌面按钮；data-on=0 背面朝上"],["tarotcardname", "牌名"],["tarotcardmeaning", "牌义"],["tarotcardpos", "牌位名"],["tarotread", "逐张解读"],["tarotsupp", "补牌"],["tarotsuppbtn", "补一张按钮"],["tarotsummary", "总结卡"],["tarotthought", "角色心声"],["tarotfollow", "小桌边继续聊区"],["tarotbubble", "追问气泡；data-me=1 你问的"],["tarotsend", "追问发送"],["tarotdaily", "每日运势页"],["tarotentry", "一位角色的解读"],["tarotentrytext", "解读正文"],["tarotwhere", "转发去哪"],["tarotroom", "转发目标房间；data-on=1 选中"]])}),
    Object.freeze({zh:"陪伴",pages:Object.freeze(["companion"]),hooks:Object.freeze([["comppage", "陪伴页整页"],["compcharbar", "角色选择横排"],["compchip", "胶囊按钮（角色/表情/戳/语音选项）；data-on=1 选中"],["compempty", "没有角色的空状态"],["compstage", "小人舞台区"],["compbubble", "小人头顶对话气泡"],["compstatus", "加载/失败提示层"],["compretry", "重试按钮"],["comppanel", "下方设置面板"],["compmood", "心情说明文字"],["compfloat", "悬浮开关大按钮；data-on=1 正在悬浮"],["compfloatpet", "屏幕上的悬浮小人"],["compdrag", "悬浮小人拖动区"],["compresize", "悬浮小人缩放角"]])}),
    Object.freeze({zh:"小游戏",pages:Object.freeze(["games"]),hooks:Object.freeze([["gamepage", "小游戏柜整页"],["gameopen", "还摊在桌上的存档条"],["gameopentitle", "存档标题"],["gameopenbtn", "存档按钮；data-part=go 继续 / drop 收了"],["gameintro", "柜子说明"],["gameshelf", "一层架子"],["gamelid", "游戏盒"],["gamelidtitle", "游戏盒名"],["gamelidsub", "人数/说明"],["gamesetup", "开局设置页整页"],["gamedesc", "玩法卡"],["gameseg", "分段选择器"],["gamesegbtn", "分段按钮；data-on=1 选中"],["gametoggle", "开关行"],["gametogglelabel", "开关行标题"],["gameswitch", "开关；data-on=1 开"],["gamestepper", "加减器"],["gameunorule", "UNO 规则卡；data-on=1 选中"],["gamecharpick", "选角色行；data-on=1 已选"],["gamecharname", "角色名"],["gameempty", "空状态"],["gamegod", "神职签；data-on=1 选中"],["gamegodbtn", "神职按钮；data-part=random 随机 / clear 清空"],["gamewolfrole", "狼阵营选项；data-on=1 选中"],["gamestartbar", "底部开始栏"],["gamestart", "开始按钮"],["gamewip", "开发中页"],["gamewipback", "返回按钮"],["gameplay", "对局整页；data-part=spy/wolf/guess/td/monopoly/avalon/uno，data-kind=loading/error 加载/出错页"],["gameroster", "座位排；data-part=monopoly 大富翁那排"],["gameseat", "座位；data-on=1 高亮/轮到，data-dead=1 出局"],["gameavatar", "玩家头像"],["gamelog", "对局记录滚动区；data-part=游戏"],["gamelogline", "系统/投票/信息行；data-kind=行类型，data-me=1 你说的"],["gamemsg", "玩家发言行；data-kind=类型，data-me=1 你"],["gamemsgname", "发言者名字"],["gamebubble", "发言气泡；data-me=1 你，data-part=question 提问"],["gameverdict", "主持人判定"],["gamestar", "今晚之星卡"],["gamerole", "你的身份提示"],["gametarget", "选目标按钮；data-on=1 选中"],["gameactions", "底部操作区；data-part=游戏，UNO 另有 data-kind=chat/hand"],["gameinput", "输入框；data-part=clue/lastguess/speech/cheer/guess/question/ask/answer/chat/trade/votesay/talk"],["gamecheer", "台下插话行"], ["gomoku", "五子棋整页"], ["gomokuboard", "五子棋棋盘（一张 svg）"], ["gomokutalk", "五子棋顶上 TA 说话那一块"], ["gomokustatus", "五子棋棋盘下面「轮到谁」那行字"], ["chess", "国际象棋整页"], ["chessboard", "国际象棋棋盘（8×8 那一整块）"], ["chesssq", "国际象棋棋盘上的一格"], ["chesscaps", "国际象棋棋盘上下两条「吃掉的子」"], ["chesstalk", "国际象棋顶上 TA 说话那一块"], ["chessmoves", "国际象棋棋盘下面走过的步数那行"], ["chesssend", "国际象棋底下「说／让TA说」那颗"], ["chesswhy", "国际象棋点了走不了的格子时说为什么的那行"], ["chessstatus", "国际象棋棋盘下面「轮到谁」那行字"], ["xiangqi", "中国象棋整页"], ["xiangqiboard", "中国象棋棋盘（一张 svg）"], ["jungleboard", "斗兽棋棋盘（一张 svg）"], ["junglecaps", "斗兽棋棋盘上下吃掉的子那一排"], ["xiangqicaps", "中国象棋棋盘上下两条「吃掉的子」"], ["xiangqitalk", "中国象棋顶上 TA 说话那一块"], ["xiangqimoves", "中国象棋棋盘下面走过的步数那行"], ["xiangqisend", "中国象棋底下「说／让TA说」那颗"], ["xiangqiwhy", "中国象棋点了走不了的格子时说为什么的那行"], ["xiangqistatus", "中国象棋棋盘下面「轮到谁」那行字"], ["go", "围棋整页"], ["goboard", "围棋棋盘（一张 svg）"], ["gotalk", "围棋顶上 TA 说话那一块"], ["gosend", "围棋底下「说／让TA说」那颗"], ["gostatus", "围棋棋盘下面「轮到谁」／数子结果那行字"], ["gosize", "围棋开局设置里「九／十三／十九路」那一块"], ["boardteach", "象棋、国际象棋、围棋开局设置里「教学」那一格"], ["boardstone", "五子棋／围棋棋盘上的一颗子（data-side＝b 黑 / w 白）"], ["gamestone", "棋盘外面那种小圆子（「轮到谁」旁边、吃子那排；data-side＝b/w）"], ["gomokuundo", "五子棋「悔一步」按钮"], ["gametalk", "五子棋、你画我猜里的对话区（一句一个气泡）"], ["gametalkrow", "对话区的一行（data-me=\"1\" 是你说的，在右边）"], ["draw", "你画我猜整页"], ["drawpool", "你画我猜开局前的词库页"], ["drawpoolgen", "词库「生成一批」按钮"], ["drawbegin", "词库页「开始」按钮"], ["drawcanvas", "你画我猜的画布（TA 画的和你画的都是它）"], ["drawtalk", "你画我猜顶上说话那一块"], ["drawtools", "你画的时候的颜色、撤销、清空那一排"], ["drawstatus", "画布下面「轮到谁、画到第几段」那行字"], ["drawchat", "画布下面说话 / 猜词那一行"], ["drawsend", "说话那一行的按钮（说 / 接着画 / 揭晓 / 给 TA 看）"], ["drawnext", "这一张结束后「下一张」按钮"], ["gomokuchat", "五子棋棋盘下面跟 TA 说话的那一行"], ["gomokusend", "五子棋说话那一行的发送键（空着按＝让 TA 开口）"], ["gomokuplay", "五子棋状态行下面那句「谁开始认真/随手/让着下了」"], ["gomokubrain", "五子棋开局前「谁来想棋」：本地棋手 / TA 自己下"], ["gomokustrength", "五子棋观战开局前「各自怎么下」（认真 / 随手）那一块"],["gamecheersend", "插话发送"],["gamekeepmem", "存进记忆按钮；data-on=1 已存"],["gameend", "终局那一块（收进记忆 + 战报）"],["gamestake", "开局页「彩头」那一栏"],["gamestakeend", "终局写着彩头和谁该兑现的那一块"],["gamelastcfg", "开局页「照上次那桌摆」按钮"],["gameskillpin", "开局页「牌技」那一块（每人一排四档）"],["gamevoice", "台词旁那颗念出来的小 ▶"],["gameredo", "「他们这轮说砸了，重说一遍」那颗小字键"],["gamereport", "终局「战报发给」那一排人名（data-on=1 已发）"], ["gamereportall", "「战报发给」那一排最前面的「全发」"], ["gamereportgroup", "「战报发给」里发到群的那几颗（虚线边，data-on=1 已发）"],["gamestats", "小游戏柜里的战绩本"],["gamestatsrow", "战绩本里一个人那一行（data-on=1 展开）"],["gameunocard", "UNO 牌；data-on=1 手牌"],["gamevs", "小游戏对阵条（五子棋、你画我猜、骗子骰、故事接龙共用）"],["gamevsseat", "对阵条上一个人（data-on＝1 轮到 TA；data-out＝1 出局）"],["gameliarreveal", "骗子骰：开了以后摊在桌上的全部骰子"],["gameliarcup", "骗子骰：我杯里的骰子"],["drawcover", "你画我猜：开局页封面"],["drawword", "你画我猜：画纸角上「你画：某某」"],["drawhistory", "你画我猜：终局每一张的记录"],["gamedatetheme", "约会开局页「这是一次什么样的约会」那一块"],["gameliardie", "骗子骰：一颗骰子（data-on＝1 亮骰时算进叫价的那几颗）"],["gameliarbid", "骗子骰：桌中间现在叫到几个几"],["gameliarbidbtn", "骗子骰：「叫」按钮"],["gameliaropen", "骗子骰：「开！」按钮"],["gameliarnext", "骗子骰：「摇下一轮」"],["gamecard", "牌桌三样：一张扑克牌（data-on=1 高亮）"],["gamefelt", "牌桌三样：中间那块绒布桌面（data-part=poker/oldmaid/blackjack）"],["gamecardbrain", "UNO／德州／21 点开局页「谁来出牌」那一块"],["gamecardbubble", "牌桌座位底下那句刚说的话（小气泡）"],["gamecardchips", "牌桌座位上的筹码／手牌数那一行"],["gamebjdealer", "21 点开局页「谁坐庄」那一块"],["gamepktruth", "德州开局页「输的人答一个真心话」开关"],["gamepktruthbox", "德州一手打完后真心话那一块（问 / 答）"],["gameddzlast", "斗地主：桌中间最后一手牌"],["gameddzhand", "斗地主：我的手牌（点一下举起来）"],["gameddzbid", "斗地主：叫分那一排"],["gameddzhint", "斗地主：提示"],["gameddzpass", "斗地主：不出"],["gameddzplay", "斗地主：出牌"],["gameddznext", "斗地主：下一局"],["gamepokerhands", "德州扑克：牌型大小说明"],["gamepokernext", "德州扑克：发下一手"],["gamepokerfold", "德州扑克：弃牌"],["gamepokercall", "德州扑克：跟注／过牌"],["gamepokerraise", "德州扑克：加注"],["gamepokerallin", "德州扑克：全下"],["gameoldmaidmine", "抽鬼牌：我的手牌"],["gamebjhands", "21 点：规则说明"],["gamebjnext", "21 点：发下一手"],["gamebjhit", "21 点：要牌"],["gamebjstand", "21 点：停牌"],["gamebjdouble", "21 点：加倍"],["gamestorypaper", "故事接龙：那张写故事的纸"],["gamestoryline", "故事接龙：一个人写的那一句（data-part＝me/ta）"],["gamestoryword", "故事接龙：这次要用上的词"],["gamestorysend", "故事接龙：发出这一句"],["gamestorycopy", "故事接龙：复制全文"],["lingxipair", "心有灵犀：这一轮要连的两个词"],["lingxireveal", "心有灵犀：刚亮出来的两个词（data-hit＝1 算对上）"], ["lingxirevcard", "心有灵犀：对话里夹着的每一轮亮词卡（data-hit＝1 算对上）"],["lingxisame", "心有灵犀：「算我们一样／撤回」"],["lingxithought", "心有灵犀：TA 是怎么想的（亮词后才有）"],["lingxihist", "心有灵犀：往期"],["lingxihisttalk", "心有灵犀：往期里那一轮写词前聊的"],["lingxitalk", "心有灵犀：写词前聊两句那一行"],["lingxichat", "心有灵犀：聊两句的「说」"],["lingxibar", "心有灵犀：底下那一栏"],["lingxisend", "心有灵犀：亮词"],["lingxiend", "心有灵犀：结束"],["lingxiagain", "心有灵犀：再来一局"],["gamehand", "UNO 手牌排"],["gamepicker", "选择弹窗遮罩"],["gamepickerbox", "选择弹窗"],["gamepickertitle", "弹窗标题"],["gamepickerclose", "弹窗关闭"],["gameplayercard", "玩家资料卡遮罩"],["gameplayerbox", "资料卡"],["gameplayername", "资料卡名字"],["gameplayerclose", "资料卡关闭"],["tetturn", "俄罗斯方块板子上面那行（合作时写着轮到谁）"], ["tetrismode", "俄罗斯方块开局页「你玩 TA 看 / 对战」和 TA 水平"], ["tetboard", "俄罗斯方块的板子（data-part＝me 你的 / ta TA 的）"], ["tetpad", "俄罗斯方块底下的操作键（data-part＝l / rot / r / down / drop）"], ["tetbar", "俄罗斯方块底下那一栏"], ["tetstart", "「开始 / 再来一局」"], ["q25host", "25 问开局页「谁出题」那一排"], ["mindbtn", "25 问（我出题／TA 出题）底下的按钮"], ["mindcount", "25 问那 25 个小格（问过的填色）"], ["mindbar", "25 问底下那一栏（写答案、问问题、点是不是）"], ["drawbrain", "你画我猜开局前「TA 怎么画」：一口气画好 / 一段一段想"]])}),
    Object.freeze({zh:"小世界",pages:Object.freeze(["fairyGarden"]),hooks:Object.freeze([["fairypage", "小世界那一场的最外层"],["cdaykitchenpeek", "完成后放大真实成品与已保存摆盘，只看不改"],["cdaykitchenguide", "操作道具下方的步骤纸卡，保留大画面和原固定底栏"],["cdaykitchennext", "按真实食材与步骤给出的操作说明"],["cdaykitchennextaction", "当前可执行的下一步按钮，44px；data-part为动作或道具"],["cdaykitchenoperation", "真实切菜／操作成功或未完成的反馈"],["cdaykitchenresult", "实际成品的切块、火候、口感、调味与已记口味偏好"],["cdaykitchenplanner", "这一桌里的菜单提议纸签"],["cdaykitchenmenuwish", "本次菜单想法，整页输入"],["cdaykitchenmenugen", "按完整人设一次生成三份菜单／只重存已生成结果"],["cdaykitchenmenusuggestion", "尚未采用的菜单候选"],["cdaykitchenmenuadopt", "采用整份候选菜单，仍能手改"],["cdaykitchenmenupick", "回菜谱手动挑这一桌"],["cdaykitchenmenuname", "这一桌的名字"],["cdaykitchenmenunamesave", "保存菜单名字"],["cdaykitchenrecipename", "实际菜品版本的名字"],["cdaykitchenaddins", "详情额外配料选择区"],["cdaykitchenaddin", "配料复选框；data-part为食材id"],["cdaykitchencoop", "现场配合动作折叠区，保持原HUD滚动"],["cdaykitchenmoment", "真实厨房配合按钮；data-part为公共动作id"],["cdaykitchenmomentnote", "实际完成的小互动与口味事实"],["cdaykitchencoopchat", "打开独立做饭聊天，不立即调用模型"],["cdaykitchenliveaddin", "半途加一份实际配料，44px原生选择框"],["cdaykitchenliveseason", "当前锅的调味选择；data-part为口味轴"],["cdaykitchenloved", "由用户标记TA爱吃的版本"],["cdaykitchenfirst", "最早保留的真实共同料理"],["cdaykitchenrecent", "做饭聊天里的当前真实小事"],["cdaykitchenmomentreply", "主动聊刚才／问口味意见，一次模型请求"],["cdaykitchenproposal", "厨房对话里的配合提议，点后实际执行"],["cdaycustomrecipe", "共同菜谱的命名版本入口"],["cdaykitchencustomname", "餐盒里的菜谱命名"],["cdaykitchencustoms", "共同菜谱索引"],["cdaykitchenfeedback", "已共餐的实际口味反馈"],["cdaykitchengarnish", "成品点缀选择"],["cdaykitchenheat", "原慢煮火候滑杆"],["cdaykitchenhud", "原厨房现场纸卡，唯一滚动区域"],["cdaykitchenpack", "装好或取出TA便当"],["cdaykitchenpreferences", "记住手选分工与口味"],["cdaykitchenremember", "记下真实版本、分工、摆盘与共同小事"],["cdaykitchentoolselect", "大画面的道具／一起做一小下分组选择，44px原生框"],["cdaykitchenzoom", "放大当前需要操作的道具"],["cdaythought", "日程下的此刻念头片段"],["cdaythoughttext", "念头正文，长文在片段内滚动"],["cdaythoughtrefresh", "手动换一句或重存已生成念头，44px触区"],["cdaythoughtswitch", "当前角色独立念头开关，role=switch"],["cdayclocknote", "当前活动时间来源"],["cdayclock", "活动时间选择"],["cdayclockmode", "活动跟角色钟或现实时间；data-part=auto/real"],["cdayphase", "复合日程当前阶段与下一步提示"],["cdaypositionscope", "调整单阶段或整段日程"],["cdaypositionstage", "选择要纠正的日程阶段"],["cdaypositionopen", "日程改位置入口"],["cdaypositionpage", "手动改位置整页"],["cdaypositionauto", "恢复日程自动匹配"],["cdaypositionscene", "日程场景选择"],["cdaypositionspot", "日程具体位置按钮"],["cdaypositionsave", "日程位置保存"],["cdaypage", "TA的一天整页"],["cdaybody", "挑人/日程/小家样式滚动区"],["cdaypick", "角色选择行"],["cdayscene", "日程场景区域"],["cdaynow", "当前日程纸卡"],["cdayrow", "日程时间轴；data-on=1 正在预览"],["cdaytools", "聊天/生活或约会/日程/更多固定底栏"],["cdaychatopen", "TA的一天主聊天入口"],["cdaychat", "覆盖场景下半部的主聊天窗"],["cdaychatbar", "主聊天窗标题与完整聊天/收起"],["cdaymoreopen", "底栏更多入口"],["cdaymore", "更多整页：镜头、样貌、小家与场景"],["cdaycamera", "更多里的四种镜头，data-part为ta/me/both/overview"],["cdayalbumopen", "小家相册入口"],["cdaykitchenopen", "小家厨房入口"],["cdaypreferencesopen", "装修灵感入口"],["cdaylifepage", "小家日常整页，data-part为album/kitchen/preferences"],["cdayphotoframe", "相册取景框与说明"],["cdayphotopreview", "拍照前真实预览"],["cdayphotorefresh", "重新取景按钮"],["cdayphoto", "同框照片详情"],["cdayphotoitem", "相册列表照片"],["cdayphotoshoot", "拍真实同框"],["cdayphotonote", "照片便签"],["cdayphotonotesave", "保存照片便签"],["cdayphotodelete", "删除照片"],["cdaykitchenprogress", "现场料理进度"],["cdaykitchencarry", "已装好的便当提示"],["cdaykitchenstate", "厨房待办状态"],["cdaykitchencontinue", "继续现场料理"],["cdaykitchenfinish", "收好料理或收拾餐桌"],["cdaykitchenshare", "聊选中这一桌，打开独立厨房聊天书签"],["cdaykitchencancel", "收起待办保留材料"],["cdayingredient", "补食材，data-part为食材编号"],["cdaykitchencontent", "厨房章节正文；data-part=book/menu/pantry/boxes/recipe；聊天独立在cdaykitchenchat"],["cdaykitchentabs", "厨房的菜谱书签行"],["cdaykitchenboard", "重新放大砧板"],["cdaykitchenplate", "做好后端上桌"],["cdaykitchentaste", "继续尝这桌菜"],["cdaykitchenoffer", "夹一口给TA"],["cdaykitchenresume", "回到料理现场"],["cdaykitchenwork", "旧步骤的现场操作"],["cdaykitchenfocus", "对准厨房台面或锅边"],["cdaykitchenswap", "厨房两人换手"],["cdaykitchenaway", "慢煮时先去忙别的"],["cdaykitchenmode", "切换自动或一起动手"],["cdaycuttools", "所有厨房道具放大操作共用的原底栏"],["cdaycutback", "退出放大道具回原台面"],["cdaycutpan", "砧板上的这批食材下锅"],["cdaykitchenchat", "独立厨房聊天整页正文"],["cdaykitchenmsgs", "厨房对话唯一滚动记录区"],["cdaykitchenolder", "展开较早的厨房对话"],["cdaykitchenmsg", "厨房气泡；data-me=1用户"],["cdaykitchencompose", "厨房输入底栏，56px与0.4底安全区"],["cdaykitcheninput", "厨房输入框，16px字号"],["cdaykitchensend", "发送厨房消息"],["cdaykitchenreply", "厨房失败重试或保存已生成回复"],["cdaykitchentab", "厨房章节书签；data-part为章节，aria-current=page当前"],["cdayrecipeopen", "翻开菜谱详情；data-part为配方编号"],["cdaykitchensearch", "按菜名或食材搜索"],["cdaykitchencategory", "六类菜谱选择"],["cdaykitchenfavorites", "只看常做收藏"],["cdaykitchenfavorite", "收藏当前菜谱"],["cdaykitchenmenu", "加入或移掉今天这一桌"],["cdaykitchenshop", "补齐单道或一桌缺料"],["cdaykitchencourse", "餐盒勾选成品；data-part为餐盒编号"],["cdaykitchenservetable", "把勾选的一到三道成品端上桌"],["cdayrecipe", "料理做法，data-part为配方编号"],["cdaydish", "两人份餐盒"],["cdaydecorwish", "手动装修想法"],["cdaydecorwishsave", "记住装修想法"],["cdaydecorapply", "选推荐配色"],["cdaydecorchoose", "进入装修自己挑家具"],["cdaylifenotice", "小家日常操作回执"],["cdaymenubody", "更多/生活的唯一滚动正文，分别记住位置"],["cdaymenusection", "操作分类及标题"],["cdaylifeopen", "同处后的生活或约会入口"],["cdayscheduleopen", "底栏日程入口"],["cdayfollow", "不在家时底栏跟随入口"],["cdayreturn", "试玩返回日程或预览回到此刻"],["cdaynext", "示例下一段"],["cdaynextplace", "专业试玩换场景"],["cdayplaces", "更多页/选人页的新场景摆位试玩入口"],["cdayoutingsopen", "更多里的自由去逛入口"],["cdayoutings", "自由去逛整页"],["cdayoutingmode", "自由逛同行选择组"],["cdayoutingchoice", "同行小票按钮；data-part=solo/together，aria-checked选中"],["cdaystylepage", "小家样式整页"],["cdaybook", "今天的日程整页"],["cdaydestination", "真实地点入口；data-part=地点"],["cdayoutingreturn", "自由逛返回TA当前安排"],["cdayoutingplan", "自由逛时TA原安排的状态行"],["cdayplacepoint", "动作位置选择；数字对应场景标号"],["cdayvisitopen", "回小家或非工作地点走进来的按钮"],["cdayvisitnote", "现场进屋/走动/坐下状态行"],["cdayvisitactivity", "进屋后的独自生活动作选择"],["cdaychorewho", "家务由我或TA来做"], ["cdaybathwho", "谁使用浴室"], ["cdaybathaction", "浴室动作；data-part=shower/wash-hands/toilet"],["cdaychore", "沿实际家具执行家务；data-part为家务编号"],["cdaypair", "各自的双人动作气质；data-part=ta/me"],["cdaypairwho", "亲密互动由我或TA先靠近的选择；原菜单下分轻轻亲近、坐着相处、躺着相处"],["cdaysocial", "自动小互动和一起转场；data-part=autoInteractions/followDates"],["cdaymotion", "两人的动作气质；data-part=motions/visitorMotions"],["cdayinteraction", "生活或约会整页；个人活动、按地点的双人动作、结束和离开；data-action 为动作"],["cdaymeopen", "我的样貌入口"],["cdaymelook", "共用衣柜与现场预览整页"],["cdayprofessionalopen", "职业场景摆件入口"],["cdayprofessional", "按角色与地点选择陈设、配色整页；data-professional 为陈设、data-professional-style 为配色"],["cdayhomestyle", "更多页的小家样式入口"],["cdaystyle", "小家样式选项；aria-pressed=true 正在用"],["cdaydecorate", "布置小家入口"],["cdaysavelayout", "顶栏保存小家布置"],["cdayeditnote", "装修操作和摆放结果提示"],["cdayfurniture", "选择家具；含已收纳物件"],["cdayedittools", "旋转/收纳/撤销/全景及装修子页返回底栏"],["cdaydecoractions", "添家具/单件搭配/房间墙地入口；data-part=catalog/piece/room"],["cdaydecorpanel", "装修整页子面板"],["cdaydecorbody", "家具库/单件搭配/房间墙地单滚动正文"],["cdaydecornotice", "装修子页操作结果提示"],["cdaycatalogitem", "家具目录卡；data-part=款式，含同模型预览"],["cdaypiecepick", "单件配色的家具选择"],["cdaypiececolors", "单件常用颜色选项"],["cdaypiececolor", "单件主要颜色"],["cdaypiecepreview", "160方形实际家具配色预览，居中完整轮廓"],["cdaypartcolors", "部件配色列表"],["cdaypartcolor", "单个部件色块与六位色号，data-part为部件"],["cdaypartreset", "恢复单个部件原配色；data-part为部件"],["cdaypartsreset", "恢复所有部件原配色"],["cdaymaterial", "单件材质选择"],["cdayusefurniture", "日程使用这件家具；aria-pressed=true 正在用"],["cdaymountwall", "挂饰后墙/左墙原生选择"],["cdaymountposition", "挂饰左右高低两列调整键"],["cdaysizeoptions", "房间尺寸选项列表"],["cdayroomsize", "房间尺寸卡；data-part=compact/roomy/loft"],["cdayoriginaldecor", "保留原装饰勾选；data-part=originalRugs/originalWallDecor"],["cdaywall", "墙面选择；data-part=款式"],["cdayfloor", "地板选择；data-part=款式"],["cdaywallcolor", "墙面自选颜色"],["cdayfloorcolor", "地板自选颜色"],["fgpage", "选世界/选档整页"],["fgbody", "选择页滚动区"],["fgworld", "世界入口；data-part=soon 即将开放"],["fgworldname", "世界名"],["fgsaves", "存档列表"],["fgsave", "一档存档"],["fgsavename", "存档名"],["fgsavesub", "存档副行"],["fgsavedel", "删档按钮"],["fgnewbtn", "新开一段按钮"],["fgcard", "选择卡按钮"],["fgpick", "挑同行者列表"],["fgpickrow", "同行者行"],["fgpickpage", "挑人整页"],["fgstalled", "卡住提示页"],["fggarden", "庭院整页"],["fghead", "庭院顶栏"],["fgpill", "顶栏胶囊；data-part=back/book/dress/chat/newroom，chat 的 data-on=1 聊天开"],["fgloading", "加载提示"],["fgbook", "花册层"],["fgbooktabs", "花册侧签列"],["fgbooktab", "花册侧签；data-on=1 当前"],["fgbookpage", "花册页；data-part=bond/invite/crew/bottle/museum/things/shards/notes"],["fgbondcard", "相处卡"],["fgguide", "带路开关；data-on=1 开"],["fgitem", "花册条目卡；data-part=kind/gift/food/crew/bottlewait/museum/work/thing/shard/cast/seed/note，data-on=1 已钉"],["fgitemrow", "条目内一行"],["fgdoorrow", "邀请携带项行"],["fgdoor", "携带项开关；data-on=1 带"],["fgbtn", "花册按钮；data-part=invite/cancel/editcrew/moveout/bottle/ready/thingact"],["fgcrewpick", "邀请邻居按钮"],["fgbottlebook", "漂流信册"],["fgpagebtn", "翻页；data-part=prev/next"],["fgframebtn", "看相框按钮"],["fgpin", "钉住按钮"],["fgempty", "空状态"],["fgdress", "样貌层"],["fgdresspanel", "样貌面板"],["fgdresstabs", "样貌对象页签行"],["fgdresstab", "样貌对象；data-on=1 当前，data-part=train 列车里那排"],["fgchat", "庭院聊天层；data-on=1 展开"],["fgchattoggle", "聊天展开/收起"],["fgmsgs", "聊天记录区；data-part=pet 宠物街区"],["fgmsg", "一条消息；data-me=1 你，data-part=pet 宠物街区"],["fgmsgname", "消息署名"],["fgbubble", "消息正文；data-me=1 你"],["fgretry", "重试"],["fgcompose", "输入栏；data-part=pet 宠物街区"],["fginput", "输入框；data-part=chat/invitename/bottle/bottlesearch/backnote"],["fgsend", "发送"],["fgswitch", "列车开关；data-on=1 开"],["fgrailway", "铁路目的地页"],["fgrailwaydest", "目的地按钮"],["fgbacknotes", "相框背面留言"],["fgframesheet", "相框详情页"],["fgalbum", "旅行相册页"],["fgpetpage", "宠物街区整页"],["fgtrainpage", "远行列车整页"],["fgtrainactions", "列车顶栏按钮组"],["fgtrainpanel", "列车子页面"]])}),
    Object.freeze({zh:"跑团",pages:Object.freeze(["trpg"]),hooks:Object.freeze([["trpgpage", "跑团首页整页"],["trpgtabs", "首页页签行"],["trpgtab", "页签；data-on=1 当前"],["trpglist", "列表滚动区"],["trpgcamp", "团卡；data-on=0 已完结"],["trpgcamptitle", "团标题"],["trpgcampsub", "团简介"],["trpgcampdel", "删团"],["trpgsquad", "小分队卡"],["trpgsquadname", "分队名"],["trpgsquaddel", "解散"],["trpgmember", "分队成员行"],["trpgmembername", "成员名"],["trpgempty", "空状态"],["trpgsheet", "「＋」底部菜单"],["trpgsheetbtn", "菜单按钮"],["trpgcreate", "新开跑团页"],["trpgbody", "新开页滚动区"],["trpgsquadnew", "组建小分队页"],["trpgscript", "导入剧本页"],["trpgscriptpreview", "剧本拆栏预览"],["trpgcharpick", "拉队友；data-on=1 已选"],["trpggallery", "图库页"],["trpgphoto", "图库格"],["trpgplay", "游戏中整页"],["trpgfeed", "剧情滚动区"],["trpgmsg", "剧情消息；data-kind=gm/user/chat/photo/roll/sys/apart/letter，data-me=1 你"],["trpgmsgtext", "守密人正文"],["trpgchatline", "闲聊簇里一行；data-me=1 你"],["trpgbubble", "你的气泡；data-me=1"],["trpgepisode", "章节卡"],["trpgbusy", "推演中提示"],["trpgended", "完结提示"],["trpgdock", "底部操作坞"],["trpgnight", "夜谈话头；data-on=1 未接"],["trpgretry", "重试区"],["trpgtable", "行动表"],["trpgtablerow", "行动表行；data-me=1 你"],["trpgchoices", "选项横排"],["trpgchoice", "选项卡"],["trpgchoicetext", "选项正文"],["trpgexplore", "自由活动区"],["trpghand", "手牌区"],["trpghandcard", "手牌；data-on=1 打出"],["trpgsplit", "分头行动区"],["trpgnote", "咬耳朵区"],["trpgplus", "「＋」工具区"],["trpgtool", "工具按钮；data-part=dice/note/chat，data-on=1 开"],["trpgcompose", "输入栏"],["trpgplusbtn", "「＋」；data-on=1 开"],["trpghandbtn", "手牌；data-on=1 开"],["trpginput", "输入；data-part=main/note/split/squadname/script/scriptraw"],["trpgsend", "行动按钮"],["trpgmap", "地图层"],["trpgceremony", "检定仪式层"],["trpgceremonybtn", "仪式按钮"],["trpgpeek", "偷看按钮"]])}),
    Object.freeze({zh:"小剧场",pages:Object.freeze(["theater"]),hooks:Object.freeze([["thrpage", "小剧场首页整页"],["thrlist", "角色列表区"],["thrclapper", "场记板"],["thrclappertitle", "场记板标题"],["thrchar", "角色行；data-on=1 展开"],["thrcharname", "角色名"],["thrcharsub", "线数"],["thrnote", "角色便签"],["thrnotebtn", "便签按钮"],["thrlines", "某角色的线列表页"],["thrline", "一条线卡；data-on=0 已完结"],["thrlinetitle", "线名"],["thrlinesub", "线状态"],["thrlinedel", "删线"],["thrnew", "新开 if 线页"],["thrcard", "卡片；data-part=char/keyword"],["thrinput", "输入；data-part=keyword/edit/goal/note/main"],["thrdiff", "难度；data-on=1 选中"],["thrdraft", "设定草稿卡"],["thrdrafttitle", "草稿标题"],["thrbtn", "按钮；data-part=accept 开演"],["thrpresets", "收藏设定页"],["thrpresettitle", "设定名"],["thrpreset", "文风预设；data-on=1 选中"],["thrplay", "演出页整页"],["thrgoal", "本轮目标条；data-on=1 展开"],["thrpanel", "设定面板"],["thrroundgoal", "各轮目标行"],["thrbanner", "提示卡；data-part=pending/fail"],["thrfeed", "演出滚动区"],["thract", "幕标题"],["thrmsg", "消息；data-part=narration/user/char，data-me=1 你"],["thrbusy", "生成中"],["thrended", "谢幕区"],["thrplus", "工具区"],["thrtool", "工具；data-part=dice/note/photo/stage，data-on=1 开"],["thrplusbtn", "「＋」；data-on=1 开"],["thrcompose", "输入栏"],["thrsend", "发送"],["thrsheet", "底部菜单；data-part=photo/msg"],["thrsheetbtn", "菜单按钮"],["thrgallery", "剧照图库"],["thrgalchar", "图库角色格"],["thrgalname", "图库角色名"],["thrphotos", "某角色剧照页"],["thrphoto", "剧照格"],["thrempty", "空状态"]])}),
    Object.freeze({zh:"月度印象",pages:Object.freeze(["impression"]),hooks:Object.freeze([["imppage", "月度印象首页"],["impintro", "首页说明"],["impchars", "角色相册网格"],["impchar", "角色相册"],["impcharname", "角色名"],["impcharsub", "张数"],["impempty", "空状态"],["impcharpage", "某角色相册页"],["impgrid", "月份网格"],["impmonth", "月份相片"],["impmonthlabel", "月份手写签"],["impmonthsub", "副行"],["impemptyslot", "空相角位"],["impfoot", "页脚说明"],["impbtn", "按钮；data-part=save/rewrite/redraw/writeback/del/withart/backfill，withart 的 data-on=1 带图"],["impdetail", "单张详情页"],["impflip", "翻转卡；data-on=1 背面"],["impfront", "正面"],["impback", "背面"],["impbackrow", "背面一段"],["impplate", "相片底板"],["imptag", "图上标签"],["impcaption", "说明区"],["impcardname", "署名"],["impcardtitle", "标题"],["impquote", "引语"],["impactions", "按钮行"]])}),
    Object.freeze({zh:"秋声",pages:Object.freeze(["yanqiu"]),hooks:Object.freeze([["yqpage", "言秋留言墙整页"],["yqhead", "顶栏"],["yqback", "返回"],["yqtitle", "标题"],["yqsub", "副标题"],["yqrefresh", "刷新"],["yqlist", "滚动区"],["yqintro", "说明"],["yqempty", "空状态"],["yqcard", "一张纸条"],["yqnote", "纸条本体"],["yqmood", "心情戳"],["yqauthor", "署名"],["yqtext", "正文"],["yqlike", "压叶按钮；data-on=1 已压"],["yqdate", "日期"],["yqcomments", "批注区"],["yqcomment", "批注；data-me=1 你"],["yqinput", "批注输入"],["yqsend", "批注发送"]])}),
    Object.freeze({zh:"文风台",pages:Object.freeze(["stylelab"]),hooks:Object.freeze([["slpage", "文风台整页"],["sltabs", "页签行"],["sltab", "页签；data-on=1 当前"],["slbody", "内容区"],["slbuild", "组装页"],["slpresets", "预设排"],["slplate", "预设牌；data-on=1 选中"],["sltools", "工具排"],["sltool", "工具按钮"],["slrow", "说明行"],["slname", "预设名输入"],["slsectitle", "段标题"],["slslot", "已选槽"],["slslotmod", "槽里的模块"],["slslotname", "模块名"],["slmove", "挪动；data-part=up/down"],["slremove", "取出"],["sllib", "模块库"],["slcat", "分类"],["slcatbtn", "分类头；data-on=1 展开"],["slcatbody", "分类内容"],["slmod", "模块行"],["slmodbtn", "模块按钮；data-on=1 已选"],["slmoddel", "删自定义模块"],["slcatdel", "导入的那一组底下「删掉这一整组」"], ["slmodedit", "改模块：那颗「改」（data-part=open）和就地展开的那张稿子"], ["slmodsave", "改模块稿子里的「存好」"], ["slmodreset", "内置模块「恢复原样」"], ["slmodnew", "「＋ 自己写一个模块」"],["slfree", "手写区"],["slfreeinput", "手写输入"],["slfreepos", "位置；data-on=1 选中"],["slpreview", "组装预览"],["slfullbtn", "看全文；data-on=1 展开"],["slpreviewtext", "预览正文"],["slactions", "操作行"],["slactbtn", "操作；data-part=dup/del"],["sltest", "试跑页"],["slcharpick", "谁来写；data-on=1 选中"],["slscenes", "场景列表"],["slscene", "场景"],["slscenebtn", "场景按钮；data-on=1 选中"],["slrun", "开跑按钮"],["slruns", "结果区"],["slresult", "结果卡"],["slresulttext", "结果正文"],["slresultfoot", "结果底行"],["slexpand", "展开"],["slempty", "空状态"]])}),
    Object.freeze({zh:"秋秋小窝",pages:Object.freeze(["nest"]),hooks:Object.freeze([["nestpage", "小窝首页整页"], ["nestupbtn", "右上角「传一个」"], ["nestwatchline", "管理中才有的那行：新消息提醒最近一次查得怎么样"], ["nestwatchnow", "那一行右边的「现在查一次」"], ["nestgatebtn", "管理中那一行的「门」"], ["nestgate", "新地址的门：整页"], ["nestgateconf", "门：口令和审核那一块"], ["nestgatepass", "门：设口令／换口令"], ["nestgateapprove", "门：审核开关"], ["nestgaterow", "门：一台设备（data-on＝ok/pending/off）"], ["nestgateok", "门：通过／恢复"], ["nestgateoff", "门：停用"], ["nestgatemore", "门：再往下看"], ["nestverifybtn", "管理中那一行的「验」"], ["nestverify", "进群验证：整页"], ["nestverifyconf", "验证：群链接和开关那一块"], ["nestverifylink", "验证：设群链接／换链接"], ["nestverifyon", "验证：总开关"], ["nestverifyrow", "验证：一条记录（data-on＝1 过了）"], ["nestverifymore", "验证：再往下看"], ["nestverifyshot", "验证：那一条上的「看留底」"], ["nestverifyshotview", "验证：留底看图整页"], ["nestverifydropone", "验证：删掉这一张留底"], ["nestverifydropall", "验证：清空全部留底"], ["moveshell", "旧地址关门后的搬家页：整页"], ["moveshellnote", "搬家页顶上那段说明"], ["moveshellgo", "搬家页「去新家」那颗"], ["nestretry", "小窝拿不到东西时的「再试一次」"], ["nestslow", "网太慢时墙顶上那一行「先给你看上次的」"], ["nestdocbody", "文档点进去那一整份正文"], ["nestdoccopy", "文档的「复制全文」"], ["nestdocsave", "文档的「存成文件」"], ["nestcubbies", "分类格子柜那一整块"], ["nestcubby", "格子柜里的一格；data-on=1 选中"], ["nestsort", "「新的在前／旧的在前」切换"], ["nestwall", "首页那面纸条墙（两列）"], ["nestslip", "墙上的一张纸条（data-kind＝哪一类）"], ["nestslipbig", "详情页顶上那张揭下来的大纸条"], ["nestpolaroid", "纸条上别着的那张预览小图"], ["nestimports", "大纸条底边「被导入 N 次」（只有作者自己看得到）"], ["nestshots", "详情里「长这样」那一排预览截图"], ["nestshotsave", "看小窝预览大图时的「存到手机」"], ["nestshotavatar", "人设的预览大图里「用这张当头像，导入这个人设」"], ["nestshotpick", "上传页「预览截图」那一块"], ["nestshotadd", "上传页「＋ 加截图」"], ["nestsearch", "搜索框（同时搜东西和人）"], ["nestpeople", "搜索时那一排搜到的人"], ["nestme", "「我」那一格：登录了是名字，没登录是「登录」"], ["nestbell", "铃铛：收到的小纸条"], ["nestdot", "铃铛上的红点数字"], ["nestdetail", "点进一条之后的整页"], ["nestpreview", "详情里那块内容预览"], ["nestimport", "「导进我的手机」按钮"], ["nestcopy", "「复制」按钮"], ["nestactions", "详情页底下那一排按钮"], ["nestfile", "上传页「选文件」按钮"], ["nestfilechip", "选了文件之后那条「已选…」"], ["nestplace", "CSS「放哪儿」那一块"], ["nestplaceall", "「全 App」按钮"], ["nestplacetabs", "聊天窗／群聊／线下那几格"], ["nestplacerow", "放哪儿列表里的一个人或一个群（data-on=\"1\" 是勾上的）"], ["nestplacego", "「放进勾上的 N 个」那颗按钮"], ["nestedit", "自己贴的那件「编辑」按钮"], ["nestbadge", "名字旁边那枚称号印章"], ["nestbadgeset", "自己的页里挂称号那一块（管理模式）"], ["nestbadgesave", "称号「保存」"], ["nestreturn", "「退回给作者改」（管理模式）"], ["nestreturnform", "写退回原因那一块"], ["nestreturncancel", "退回「算了」"], ["nestreturnsend", "「退回给作者」确认"], ["nestreturned", "被退回的那件上的原因条"], ["nestreturnedchip", "纸条上「退回了」那个章"], ["nestdelete", "删除按钮"], ["nestsign", "大纸条底下的署名「— 谁」"], ["nestfollow", "关注键；data-on=1 已关注"], ["nestlike", "点赞；data-on=1 点过"], ["nestfav", "收藏；data-on=1 收过"], ["nestbook", "留言簿整块（横格纸）"], ["nestnote", "留言簿里的一条"], ["nestclip", "回某一条的那张回形针小便签"], ["nestreply", "「回她」"], ["nesterase", "「擦掉」"], ["nestcompose", "写一句那一栏"], ["nestsignbtn", "「签上」按钮"], ["nestloginask", "没登录时那颗「登录以后才能签」"], ["nestprofile", "某人的页整页"], ["nestcard", "借书证那张卡"], ["nestperson", "关注列表里的一个人"], ["nestpw", "「改密码」"], ["nestlogout", "「退出登录」"], ["nestban", "管理员的「停用这个号」"], ["nestnotices", "收到的小纸条整页"], ["nestnotice", "一张小纸条；data-on=1 没看过"], ["nestlogin", "登录／注册整页"], ["nestloginbtn", "登录／注册按钮"], ["nestforgot", "「忘了密码？用恢复码」"], ["nestrecovery", "注册后给恢复码那一页"], ["nestreccopy", "恢复码「复制」"], ["nestrecok", "「我存好了」"], ["nestupload", "「传一个上去」整页"], ["nestsend", "「传上去」按钮"], ["nestcubbyfold", "首页格子柜收起时那一行「换一格」"], ["nestpostwrite", "写一帖时的正文框"], ["nestpostbody", "帖子点进去的正文"], ["nestpoststatus", "帖子上盖的章；data-st＝got 收到了／fixed 修好了"], ["nestpostmark", "管理员给帖子盖章那一排"], ["nestmark", "盖章那一排里的一颗"], ["nestbtn", "小窝里其余的圆角按钮"]])}),
    Object.freeze({zh:"秋秋",pages:Object.freeze(["assistant"]),hooks:Object.freeze([["qqpage", "秋秋整页"],["qqbar", "角色信息条"],["qqtitle", "名字"],["qqstatus", "状态"],["qqclear", "清空；data-part=dock 浮窗"],["qqsetupbtn", "设置按钮"],["qqfeed", "对话区；data-part=dock 浮窗"],["qqempty", "空状态"],["qqmsg", "消息行；data-me=1 你"],["qqbubble", "气泡；data-me=1 你"],["qqavatar", "秋秋头像"],["qqcopy", "气泡下面的「复制」（data-me=\"1\" 是我那侧，\"0\" 是秋秋那侧）"], ["qqthinking", "「在想…」那一行"], ["qqcancel", "「在想…」旁边的「✕ 取消」"], ["qqregen", "取消之后那颗「重新生成」"],["qqquick", "快捷问题；data-part=dock 浮窗"],["qqcompose", "输入栏；data-part=dock 浮窗"],["qqinput", "输入框；data-part=dock 浮窗"],["qqsend", "发送；data-part=dock 浮窗"],["qqattach", "附件预览；data-part=pic/file"],["qqattachbtn", "附件按钮；data-part=pic/file"],["qqpatch", "改动卡"],["qqpatchtitle", "改动标题"],["qqpatchfoot", "改动底行"],["qqpatchbtn", "改动按钮；data-part=apply/skip/undo/reapply（撤回后重新应用）/copy（复制）"],["qqasking", "追问提示"],["qqaskbtn", "追问按钮；data-part=send/drop"],["qqsetup", "设置页"],["qqname", "名字输入"],["qqavatardel", "删头像"],["qqballswitch", "小球开关；data-on=1 开"],["qqapi", "线路；data-on=1 选中"],["qqprompt", "提示词输入"],["qqbtn", "设置页按钮"],["qqundolist", "改动记录区"],["qqundorow", "改动记录；data-on=0 已退回"],["qqundobtn", "退回"],["qqdockball", "浮球"],["qqdock", "浮窗"],["qqdockbar", "浮窗顶条"],["qqdocktitle", "浮窗标题"],["qqdockclose", "浮窗收起"]])}),
    Object.freeze({zh:"攻略",pages:Object.freeze(["codex"]),hooks:Object.freeze([["codexpage", "攻略整页最外层"],["cxpage", "攻略目录页"],["cxask", "问秋秋卡；data-part=top 目录顶 / detail 详情底"],["cxsearch", "搜索框"], ["cxhits", "搜索结果那一列（搜的时候代替目录）"], ["cxhit", "其中一节结果，点了跳过去"], ["cxhitwhere", "结果顶上「哪个 app › 哪一节」那行小字"], ["cxhitline", "结果里提到这个词的那一句"], ["cxmark", "搜到的字的底色"],["cxempty", "空状态"],["cxcat", "章"],["cxcattitle", "章名"],["cxrow", "一行"],["cxrowbtn", "行按钮"],["cxrowname", "名"],["cxrowsub", "摘要"],["cxdetail", "详情页"],["cxsec", "一节"],["cxsectitle", "节标题"],["cxwhere", "在哪儿"],["cxpara", "正文段"],["cxlist", "分点列表"],["cxli", "分点"],["cxtable", "表格"]])}),
    Object.freeze({zh:"记账",pages:Object.freeze(["ledger"]),hooks:Object.freeze([["ledgerpage", "记账各页的最外层；data-part 区分哪一页"],["ldgfielddialogsubmit", "fielddialogsubmit 的外层容器"],["ldgfielddialogtap", "fielddialog 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ldgfielddialogbtn", "fielddialog 的按钮；data-part 区分同名多处：图标 /cancel/3"],["ldgfielddialoginput", "fielddialog 的输入框；data-part 区分同名多处：1"],["ldgcategoryglyph", "categoryglyph 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgcattile", "cattile 的外层容器；data-on=\"1\" 为当前选中/激活"],["ldgjellyglyph", "jellyglyph 的外层容器"],["ldgbar", "bar 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ldgcells", "cells 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgmonthnavbtn", "monthnav 的按钮；data-part 区分同名多处：上个月/下个月"],["ldgcandyseg", "candyseg 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：换币种"],["ldgpage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgkeychain", "keychain 的外层容器"],["ldgkeychainminibarcode", "keychainminibarcode 的外层容器"],["ldgwallethomeykkey", "wallethomeykkey 的外层容器"],["ldgwallethomeyk", "wallethomeyk 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgwallethomeykbtn", "wallethomeyk 的按钮；data-part 区分同名多处：1/togglehide/motto/4/editbudget/bills"],["ldgwallethomebigkey", "wallethomebigkey 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgwallethomebtn", "wallethome 的按钮；data-part 区分同名多处：togglehide/motto/editbudget/bills"],["ldgsparkle", "sparkle 的外层容器"],["ldgheart", "heart 的外层容器"],["ldgbunny", "bunny 的外层容器"],["ldgclip", "clip 的外层容器"],["ldgwordmark", "wordmark 的外层容器"],["ldgstripslot", "stripslot 的外层容器"],["ldgreceipt", "receipt 的外层容器"],["ldgbarcode", "barcode 的外层容器"],["ldgdonut", "donut 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgcurview", "curview 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8（rN=同组件第N个返回分支/列表项）"],["ldgcurviewbtn", "curview 的按钮；data-part 区分同名多处：改预算"],["ldgbillsviewbtn", "billsview 的按钮；data-part 区分同名多处：搜索账单/不再只看"],["ldgbillsviewinput", "billsview 的输入框；data-part 区分同名多处：搜备注、分类或金额"],["ldgbillsview", "billsview 的外层容器"],["ldggoalsview", "goalsview 的外层容器"],["ldggoalsviewbtn", "goalsview 的按钮；data-part 区分同名多处：1/2/3/删掉这个目标/5；data-on=\"1\" 为当前选中/激活"],["ldgyearviewbtn", "yearview 的按钮；data-part 区分同名多处：上一年/下一年/3"],["ldgyearview", "yearview 的外层容器"],["ldgcalview", "calview 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgmeviewbtn", "meview 的按钮；data-part 区分同名多处：1/2"],["ldgmeview", "meview 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgtxnrow", "txnrow 的外层容器"],["ldgtxnview", "txnview 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ldgtxnviewbtn", "txnview 的按钮；data-part 区分同名多处：改这一笔/删掉这一笔/3/比如 12.5/5/6"],["ldgledgersharepicker", "ledgersharepicker 的外层容器"],["ldgledgersharepickerbtn", "ledgersharepicker 的按钮；data-part 区分同名多处：1"],["ldgcommentpicker", "commentpicker 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgcommentpickertap", "commentpicker 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ldgcommentpickerbtn", "commentpicker 的按钮；data-part 区分同名多处：1/2"],["ldgaddsheetbtn", "addsheet 的按钮；data-part 区分同名多处：1/2/3/4/清空金额/6"],["ldgaddsheetsave", "addsheetsave 的外层容器"],["ldgaddsheet", "addsheet 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ldgaddsheetinput", "addsheet 的输入框；data-part 区分同名多处：备注：这一笔是什么（可留/日期"],["ldgsettingssheetbtn", "settingssheet 的按钮；data-part 区分同名多处：1/2/3/4/比如 0.19/6/7/比如 800…"],["ldgsettingssheet", "settingssheet 的外层容器；data-part 区分同名多处：r2/r3/r4/r5（rN=同组件第N个返回分支/列表项）"],["ldgrecureditorinput", "recureditor 的输入框；data-part 区分同名多处：1"],["ldgrecureditorbtn", "recureditor 的按钮；data-part 区分同名多处：1/删掉这条周期账单/3；data-on=\"1\" 为当前选中/激活"],["ldgrecureditorsave", "recureditorsave 的外层容器"],["ldgaccteditorinput", "accteditor 的输入框；data-part 区分同名多处：1"],["ldgaccteditorbtn", "accteditor 的按钮；data-part 区分同名多处：1/删掉这个账户/3；data-on=\"1\" 为当前选中/激活"],["ldgaccteditorsave", "accteditorsave 的外层容器"]])}),
    Object.freeze({zh:"备忘录",pages:Object.freeze(["memo"]),hooks:Object.freeze([["memocommentpickertap", "commentpicker 的可点的行/卡片/格子；data-part 区分同名多处：close/2"],["memocommentpickerbtn", "commentpicker 的按钮；data-part 区分同名多处：1/2/close/4"],["memovisiblepickertap", "visiblepicker 的可点的行/卡片/格子；data-part 区分同名多处：close/2"],["memovisiblepickerbtn", "visiblepicker 的按钮；data-part 区分同名多处：1/2"],["memocommentblock", "commentblock 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["memocommentblockbtn", "commentblock 的按钮；data-part 区分同名多处：1/2"],["memoreminderformbtn", "reminderform 的按钮；data-part 区分同名多处：1/2/3"],["memoreminderforminput", "reminderform 的输入框；data-part 区分同名多处：要提醒的事（如 交房租 /备注（可空）/3/4/5"],["memonoteformbtn", "noteform 的按钮；data-part 区分同名多处：1/2"],["memonoteforminput", "noteform 的输入框；data-part 区分同名多处：标题"],["memonoteformtext", "noteform 的多行输入框；data-part 区分同名多处：随手记点什么…"],["memopagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["memopage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"]])}),
    Object.freeze({zh:"去处",pages:Object.freeze(["dwell"]),hooks:Object.freeze([["dwellcitymap", "citymap 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["dwelldatealbumcardbtn", "datealbumcard 的按钮；data-part 区分同名多处：1"],["dwellbackdrop", "backdrop 的外层容器"],["dwellpage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["dwellplacehero", "placehero 的外层容器"],["dwellpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["dwellsurface", "surface 的外层容器"]])}),
    Object.freeze({zh:"好友地图",pages:Object.freeze(["map"]),hooks:Object.freeze([["mapmapcanvas", "mapcanvas 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["mapworldmap", "worldmap 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mapworldmapzoombtn", "worldmapzoom 的按钮"],["mapworldmapbtn", "worldmap 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["mapworldmapinput", "worldmap 的输入框；data-part 区分同名多处：1/2"],["mapworldmaptext", "worldmap 的多行输入框；data-part 区分同名多处：1"],["mapworldmapkey", "worldmapkey 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["mapnodeaddchip", "nodeaddchip 的外层容器"], ["mapnodeaddmode", "加地点页里「怎么添」那一排选项"], ["mapnodeaddfor", "加地点页里「替谁添」那一排人"], ["mapworldpanel", "世界面板那一层整页（data-part 区分是哪块面板）"], ["mapworldpanelbtn", "世界面板里的按钮"], ["mapworldpanelselect", "世界面板里的下拉选择"], ["mapworldpeople", "世界面板里一个人那张卡（data-part=away 是不在这张图上的人）"], ["mapworldlayout", "世界面板里一块地方的摆放卡"], ["mapschedonly", "世界面板里「日程只用这张图」那一行"], ["mapworldtools", "架空地图底下那一排工具栏"], ["mapworldtoolsbtn", "底栏工具里的一颗按钮（data-part 区分哪一颗）"],["mapnodeadd", "nodeadd 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mapnodeaddbtn", "nodeadd 的按钮；data-part 区分同名多处：1/2/3"],["mapnodeaddinput", "nodeadd 的输入框；data-part 区分同名多处：这块地方叫什么（≤8字）/地点叫什么/想要什么样的？（可空）"],["mapnodeaddtext", "nodeadd 的多行输入框；data-part 区分同名多处：这儿眼下正有什么事（一句"],["mapworldform", "worldform 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mapworldforminput", "worldform 的输入框；data-part 区分同名多处：一个名字/这张是哪儿"],["mapworldformtext", "worldform 的多行输入框；data-part 区分同名多处：写多少都行：这地方靠什么"],["mapworldformbtn", "worldform 的按钮；data-part 区分同名多处：1/2/del"],["mapstorymap", "storymap 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["mapstorymapbtn", "storymap 的按钮；data-part 区分同名多处：1"],["mappage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["mappageinput", "整页（入口组件） 的输入框；data-part 区分同名多处：搜任何地方：店名 / 地/搜城市名，如 上海 / "],["mappagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"]])}),
    Object.freeze({zh:"同人文",pages:Object.freeze(["fanfic"]),hooks:Object.freeze([["ficartpage", "同人文看图那一层的最外层"],["ficpage", "同人文首页的最外层（那层纸；改同人文的背景改这里）"],["ficpaperswatch", "paperswatch 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficpaperswatchone", "paperswatchone 的外层容器"],["ficcastpicker", "castpicker 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficwaytag", "waytag 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficficcarddot", "ficcarddot 的外层容器"],["ficficcardstatrow", "ficcardstatrow 的外层容器"],["ficficcardtap", "ficcard 的可点的行/卡片/格子；data-part 区分同名多处：1/2"],["ficficcardstaple", "ficcardstaple 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ficficmotionstyles", "ficmotionstyles 的外层容器"],["fictabbarrule", "tabbarrule 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["fictabbar", "tabbar 的外层容器；data-on=\"1\" 为当前选中/激活"],["fictabbarbtn", "tabbar 的按钮；data-part 区分同名多处：新建世界观"],["ficgensheetsec", "gensheetsec 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficgensheetbtn", "gensheet 的按钮；data-part 区分同名多处：1/2/3/4；data-on=\"1\" 为当前选中/激活"],["ficgensheet", "gensheet 的外层容器；data-part 区分同名多处：r2/r3/r4/r5（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficgensheetinput", "gensheet 的输入框；data-part 区分同名多处：1/或者自己写：同门、一个乐"],["ficgensheettext", "gensheet 的多行输入框；data-part 区分同名多处：自由发挥"],["ficgensheetselect", "gensheet 的下拉选择；data-part 区分同名多处：1/2"],["fictabsheet", "tabsheet 的外层容器"],["fictabsheettap", "tabsheet 的可点的行/卡片/格子；data-part 区分同名多处：1"],["fictabsheetinput", "tabsheet 的输入框；data-part 区分同名多处：世界观名（如『民国』『星"],["fictabsheettext", "tabsheet 的多行输入框；data-part 区分同名多处：世界观描述（= 生成时的"],["fictabsheetbtn", "tabsheet 的按钮；data-part 区分同名多处：1/2"],["fictabsheetauthortag", "tabsheetauthortag 的外层容器"],["ficreadermetarow", "readermetarow 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficreaderbtn", "reader 的按钮；data-part 区分同名多处：换书页/2/3/4/r5/6/7/8…（rN=同组件第N个返回分支/列表项）"],["ficreaderpager", "readerpager 的外层容器"],["ficreader", "reader 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6（rN=同组件第N个返回分支/列表项）"],["ficreadertext", "reader 的多行输入框；data-part 区分同名多处：接着往下写…"],["ficreaderinput", "reader 的输入框；data-part 区分同名多处：写条书评…/回复…"],["ficreadertap", "reader 的可点的行/卡片/格子；data-part 区分同名多处：1/2"],["ficghostpage", "ghostpage 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficghostpageoptrow", "ghostpageoptrow 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficghostpagebtn", "ghostpage 的按钮；data-part 区分同名多处：askback/2/3"],["ficghostpagetext", "ghostpage 的多行输入框；data-part 区分同名多处：想看的走向、想让谁出场、"],["ficfilepagebtn", "filepage 的按钮；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficfilepage", "filepage 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficfilepageinput", "filepage 的输入框；data-part 区分同名多处：这间房叫什么"],["ficfwdsheet", "fwdsheet 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ficfwdsheettap", "fwdsheet 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ficpublishfinalcp", "publishfinalcp 的外层容器"],["ficpublishselect", "publish 的下拉选择；data-part 区分同名多处：1/2/3"],["ficpublish", "publish 的外层容器"],["ficpublishinput", "publish 的输入框；data-part 区分同名多处：标题/标签，用空格或逗号分隔（"],["ficpublishtext", "publish 的多行输入框；data-part 区分同名多处：正文…"],["ficpublishbtn", "publish 的按钮；data-part 区分同名多处：1"],["ficminerow", "minerow 的外层容器"],["ficminestat", "minestat 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficminebtn", "mine 的按钮；data-part 区分同名多处：1"],["ficminepublished", "minepublished 的外层容器"],["ficminecp", "minecp 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficminecpbtn", "minecp 的按钮；data-part 区分同名多处：1/2/3/4/5"],["ficminecpinput", "minecp 的输入框；data-part 区分同名多处：备注名（可空，默认用名字"],["ficminecpselect", "minecp 的下拉选择；data-part 区分同名多处：1/2"],["ficminesettings", "minesettings 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficminesettingsbtn", "minesettings 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8"],["ficminesettingsinput", "minesettings 的输入框；data-part 区分同名多处：给这套实验取名/来源备注（作者 / 链接/文风名（如 冷冽白描 //4"],["ficminesettingstext", "minesettings 的多行输入框；data-part 区分同名多处：额外说明：例如少写全知判/例如：分别多年后在医院走/文风描述，越具体越好，想"],["ficmeeditsheet", "meeditsheet 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficmeeditsheettap", "meeditsheet 的可点的行/卡片/格子；data-part 区分同名多处：1"],["ficmeeditsheetbtn", "meeditsheet 的按钮；data-part 区分同名多处：1/2/3"],["ficmeeditsheetinput", "meeditsheet 的输入框；data-part 区分同名多处：昵称/id（@handle，不/3"],["ficmeeditsheettext", "meeditsheet 的多行输入框；data-part 区分同名多处：个人简介 / 太太的一句"],["ficrpapp", "rpapp 的外层容器；data-part 区分同名多处：r2/r3/r4/r5（rN=同组件第N个返回分支/列表项）"],["ficrpappbtn", "rpapp 的按钮；data-part 区分同名多处：1/2/3"],["ficrpspinecap", "rpspinecap 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficrpspine", "rpspine 的外层容器；data-on=\"1\" 为当前选中/激活"],["ficrpthreadsrcpara", "rpthreadsrcpara 的外层容器"],["ficrpthread", "rpthread 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficrpthreadpara", "rpthreadpara 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficrpthreadbtn", "rpthread 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["ficrpthreadtext", "rpthread 的多行输入框；data-part 区分同名多处：写下你的行动 / 说的话"],["ficrpthreadheatmark", "rpthreadheatmark 的外层容器"],["ficauthorspage", "authorspage 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）"],["ficauthorspagebtn", "authorspage 的按钮；data-part 区分同名多处：1/2"],["ficauthorspagetext", "authorspage 的多行输入框；data-part 区分同名多处：写什么类型、什么文风、磕"],["ficauthorspageauthorface", "authorspageauthorface 的外层容器"],["ficauthorspagezhengtally", "authorspagezhengtally 的外层容器"],["ficauthorspageauthorseal", "authorspageauthorseal 的外层容器"],["ficauthorhomestat", "authorhomestat 的外层容器"],["ficauthorhomesec", "authorhomesec 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["ficauthorhome", "authorhome 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["ficauthorhomebtn", "authorhome 的按钮；data-part 区分同名多处：1/2/3/4/5"],["ficbottomnav", "bottomnav 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["ficpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2/3/4/5/6"],["ficpageinput", "整页（入口组件） 的输入框；data-part 区分同名多处：搜标题、笔名、CP 里的"]])}),
    Object.freeze({zh:"一起读",pages:Object.freeze(["read"]),hooks:Object.freeze([["foregen", "论坛帖子「全部回复」那一行的「换一批」"], ["forumnoticeallread", "论坛「回复」页顶上「全部标为已读」"], ["moregen", "朋友圈动态底下「换一批」"], ["readreplyquote", "讨论框底下那条「回 TA 批的：……」"], ["readfull", "书页底下翻页条上那颗「全屏／退出全屏」"], ["readpage", "整页（入口组件） 的外层容器"],["readpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1/2"],["readshelfboard", "shelfboard 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readpageinput", "整页（入口组件） 的输入框；data-part 区分同名多处：1"],["readreaderbtn", "reader 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["readreader", "reader 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readannobook", "annobook 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["readannobookbtn", "annobook 的按钮；data-part 区分同名多处：1/remember"],["readselexplainsheet", "selexplainsheet 的外层容器"],["readselexplainsheettap", "selexplainsheet 的可点的行/卡片/格子；data-part 区分同名多处：close"],["readselexplainsheetbtn", "selexplainsheet 的按钮；data-part 区分同名多处：close"],["readnotesheet", "notesheet 的外层容器"],["readnotesheettap", "notesheet 的可点的行/卡片/格子；data-part 区分同名多处：close"],["readnotesheettext", "notesheet 的多行输入框；data-part 区分同名多处：写下你对这句的想法…（T"],["readnotesheetbtn", "notesheet 的按钮；data-part 区分同名多处：close/2"],["readstepperbtn", "stepper 的按钮；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readpartnerpicker", "partnerpicker 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["readpartnerpickertap", "partnerpicker 的可点的行/卡片/格子；data-part 区分同名多处：1"],["readpartnerpickerbtn", "partnerpicker 的按钮；data-part 区分同名多处：close"],["readdiscusssheet", "discusssheet 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["readdiscusssheetbtn", "discusssheet 的按钮；data-part 区分同名多处：end/返回/send"],["readdiscusssheetinput", "discusssheet 的输入框；data-part 区分同名多处：说说你的看法…"]])}),
    Object.freeze({zh:"一起看",pages:Object.freeze(["watch"]),hooks:Object.freeze([["watchpage", "整页（入口组件） 的外层容器"],["watchticket", "ticket 的外层容器"],["watchticketbtn", "ticket 的按钮；data-part 区分同名多处：open/改名/删掉这部"],["watchimportpageinput", "importpage 的输入框；data-part 区分同名多处：1/粘贴 B 站或 YouT/叫它什么"],["watchimportpagebtn", "importpage 的按钮；data-part 区分同名多处：1"],["watchpickpartner", "pickpartner 的外层容器"],["watchpickpartnerbtn", "pickpartner 的按钮；data-part 区分同名多处：1"],["watchcinemalayer", "cinemalayer 的外层容器"],["watchcinemalayerbtn", "cinemalayer 的按钮；data-part 区分同名多处：退出影院模式/2"],["watchcinemalayerinput", "cinemalayer 的输入框；data-part 区分同名多处：小声说一句…"],["watchscreeningbtn", "screening 的按钮；data-part 区分同名多处：1/2/3"],["watchscreening", "screening 的外层容器"],["watchscreeninginput", "screening 的输入框；data-part 区分同名多处：1/TA 多久可能自己开一次口/小声说一句…"]])}),
    Object.freeze({zh:"周刊",pages:Object.freeze(["weekly"]),hooks:Object.freeze([["weeklypage", "周刊工具那一层的最外层"],["wklyphoto", "周刊里的照片（封面照、专访照、画报）"], ["wklyshoot", "周刊里「拍这期封面／拍一张专访照」那颗"], ["wklycoverphoto", "周刊封面上那张照片"], ["wklypics", "本周画报那一页"], ["wklypic", "画报里的一张（data-part＝wide 整幅 / half 并排）"], ["wklyivopener", "专访开篇（data-part＝photo 有专访照 / type 纯排版）"], ["wklyivquote", "专访里放大的那句引文"], ["wklyivlead", "专访导语"], ["wklycoverhero", "头版拍了封面照时压着头条的那张大图"], ["wklyweeklymotionstyles", "weeklymotionstyles 的外层容器"],["wklypageturnnav", "pageturnnav 的外层容器"],["wklypageturnnavbtn", "pageturnnav 的按钮；data-part 区分同名多处：1/2"],["wklymasthead", "masthead 的外层容器"],["wklysectionrule", "sectionrule 的外层容器"],["wklyregenbtn", "regen 的按钮"],["wklycountdown", "countdown 的外层容器"],["wklycoverpage", "coverpage 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）"],["wklycoverpagebtn", "coverpage 的按钮；data-part 区分同名多处：周刊工具"],["wklyweeklytoolssheet", "weeklytoolssheet 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["wklyweeklytoolssheetbtn", "weeklytoolssheet 的按钮；data-part 区分同名多处：shelf/refresh/3/4/close"],["wklyregenrow", "regenrow 的外层容器"],["wklycoversection", "coversection 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["wklyinterviewentry", "interviewentry 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["wklymediadetail", "mediadetail 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）"],["wklymediadetailpairedarticle", "mediadetailpairedarticle 的外层容器"],["wklymediadetailwidearticle", "mediadetailwidearticle 的外层容器"],["wklymediadetailmasthead", "mediadetailmasthead 的外层容器"],["wklymediadetailmanifestolayout", "mediadetailmanifestolayout 的外层容器"],["wklymediadetaildossierlayout", "mediadetaildossierlayout 的外层容器"],["wklymediadetailclassiclayout", "mediadetailclassiclayout 的外层容器"],["wklymediadetailnoteslayout", "mediadetailnoteslayout 的外层容器"],["wklymediadetailstandardlayout", "mediadetailstandardlayout 的外层容器"],["wklymediadetailscoreboardlayout", "mediadetailscoreboardlayout 的外层容器"],["wklyissueview", "issueview 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["wklyshelf", "shelf 的外层容器；data-part 区分同名多处：r2/r3/r4（rN=同组件第N个返回分支/列表项）"],["wklyshelfbtn", "shelf 的按钮；data-part 区分同名多处：1/2/3"],["wklynewsroomhome", "newsroomhome 的外层容器"],["wklynewsroomhomebtn", "newsroomhome 的按钮；data-part 区分同名多处：1/refresh"],["wklypage", "整页（入口组件） 的外层容器"],["wklypagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1"]])}),
    Object.freeze({zh:"擂台",pages:Object.freeze(["debate"]),hooks:Object.freeze([["debpage", "整页（入口组件） 的外层容器；data-part 区分同名多处：r2（rN=同组件第N个返回分支/列表项）"],["debpagebtn", "整页（入口组件） 的按钮；data-part 区分同名多处：1"],["debsetup", "setup 的外层容器；data-part 区分同名多处：r2/r3（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["debsetuptext", "setup 的多行输入框；data-part 区分同名多处：例：该不该为爱情放弃事业/例：谁先把对方逗笑 / "],["debsetupbtn", "setup 的按钮；data-part 区分同名多处：1/2/3/4/5"],["debarena", "arena 的外层容器；data-part 区分同名多处：r2/r3/r4/r5/r6/r7/r8/r9…（rN=同组件第N个返回分支/列表项）；data-on=\"1\" 为当前选中/激活"],["debarenabtn", "arena 的按钮；data-part 区分同名多处：1/2/3/4/5/6/7/8…"],["debarenaturncard", "arenaturncard 的外层容器"],["debarenapartof", "arenapartof 的外层容器"],["debarenafocusblock", "arenafocusblock 的外层容器"], ["debyield", "台上那段话下面的「松口／换边了」；data-on=1 是换了边"], ["debrule", "这一轮末尾立的下一轮临时规矩卡"], ["debslip", "这一轮你递过的纸条那一行"], ["debslipbtn", "底部「递纸条」按钮"], ["debslipedit", "写纸条那一块（选给谁＋输入框）"], ["debdraw", "摆台子里「从你们的事里抽一题」那一块"], ["debdrawbtn", "抽题按钮"], ["debdrawpick", "抽出来的一道题；data-on=1 是选中的"], ["debbench", "摆台子里「台下坐谁」那一排"], ["debbenchpick", "台下坐谁的一个人；data-on=1 是挑上了"], ["debvotemore", "台下投票里收起来的「其余几票的理由」"], ["debrematch", "收台后「换边再吵一场」按钮"], ["debmejudge", "你当裁判时每轮写判语那一块"], ["debmyverdict", "你当裁判时收台判谁赢那一块"],["debarenalegacyaudience", "arenalegacyaudience 的外层容器"],["debarenainput", "arena 的输入框；data-part 区分同名多处：你要站的那一边…"],["debarenatext", "arena 的多行输入框；data-part 区分同名多处：1"]])}),
    // 挂点补课第一批（她 2026-10-08：「审计一下还有哪些页面没有挂点」→「按你的顺序来」）
    Object.freeze({zh:"查手机",pages:Object.freeze(["phone"]),hooks:Object.freeze([["phonelockpage", "TA手机锁屏那一页的最外层"],["palbuminfo","查手机相册点开一张后，照片底下那段字（标题、介绍、TA的想法）的底；改浅色记得连字色一起改"],["phonelockclear","TA手机锁屏上通知那摞右上角的「× 清除」"],["phoneapppage", "TA手机里某个 app 打开后的最外层；data-part 区分哪个"],["phonepage","整页最外层（data-view=\"list\" 选人那页／\"desk\" 手机桌面）"],["phonerow","选人那页的一行（data-id＝角色 id）"],["phoneicon","桌面上一颗 app 图标（data-app＝哪个 app）"],["phonenotyetdot","图标右下角「还没生成」的虚线小圈"],["phonenotyet","点进还没生成的 app 那一页（带「生成」键）"],["phonewidget","桌面上的组件卡（data-app＝点了去哪个 app）"],["papp","点开之后每个小 app 的最外层（data-app＝哪个 app；微信联系人资料页另带 data-view=\"contact\"）。小 app 自己的顶栏是通用的 head，用 [data-wk=\"papp\"] [data-wk=\"head\"] 圈"],["ptab","小 app 里的分页／分区按钮（data-on=\"1\" 选中）"],["pitem","小 app 主列表里的一行／一张卡（聊天行、联系人 data-kind=\"contact\"、朋友圈、照片、书、商品、订单、帖子、歌、邮件、通话短信……）"],["ptitle","一行里的标题／名字（目前微信有）"],["ptext","一行里的正文／预览（目前微信有）"],["ptime","时间那行小字（目前微信有）"],["pdetail","点开一条之后的详情页（聊天线程、文章、书页、笔记）"],["pbubble","小 app 聊天里的一个气泡（data-me=\"1\" 是机主自己发的）"],["pinput","小 app 里的输入栏（你替TA打字／看TA玩时TA正在打字那一栏）"],["pnotevoice","便签里录音详情的 ▶ 播放键（配了音色才有）"],["pbtn","小 app 里单独能改的按钮（data-part＝send 发送／peek 转发给TA／act 音乐里的动作键）"]])}),
    Object.freeze({zh:"一起听",pages:Object.freeze(["listen"]),hooks:Object.freeze([["listenpage","整页最外层（data-tab＝play/cloud/mine/home 当前在哪一栏）"],["listenboard","设置那一栏「添加歌曲」那块板（链接/ID、本地、接口、Cookie 都在里面）"],["listenkeepalive","设置那一栏「静音保活」那一行（data-on=1 正放着）"],["listencoverall","播放页封面左下「每首都用这张」（开着时带 ✓）"],["listentitle","播放页的歌名"],["listenartist","歌名下面那行歌手"],["listenctrl","收藏／加歌单那排圆钮"],["listenlyric","歌词页（当前那句 data-lyric-active=\"1\"）"],["floatlyricbtn","播放页「浮」那颗键"],["floatlyricset","播放页浮窗歌词那块小设置"],["floatlyricpos","浮窗歌词位置上／中／下那三颗（data-on）"],["floatlyricstep","浮窗歌词大小、浓淡的 − ＋"],["floatlyric","浮在各页上的那行歌词"],["listentab","底下四个标签（data-tab＝哪一栏；data-on=\"1\" 是当前那个）"],["listenbtn","每一颗圆钮（播放／上一首／收藏／加歌单这些）"],["listenprogress","播放页那根进度条"],["listensong","歌单里的一首歌那一行（data-on=\"1\" 正在放）"],["listenqueue","正在播放队列里的一行（data-on=\"1\" 正在放）"],["listenchip","「我的」里那排分隔卡（data-on=\"1\" 选中）"],["listenplaylist","一个歌单那一行"]])}),
    Object.freeze({zh:"我的钱包",pages:Object.freeze(["wallet"]),hooks:Object.freeze([["walletasksbtn", "钱包顶上「请示档案」那一条（跟你要过钱才有）"], ["askreceipt", "请示档案里的一张批条小票（data-status＝pending 等批／approved 准了／denied 没准）"], ["walletpage","整页最外层（data-view=\"main\" 钱包／\"cards\" 亲属卡包）"],["walletbalance","余额那个大数字"],["walletrecur","余额下面「固定进出」那一块"],["walletrecurrow","固定进出的一行；data-dir=in 进账 / out 支出"],["walletrecuradd","「＋ 加一条」；data-dir 同上"],["walletrecuredit","改一条的那张单子"],["walletrecurname","名字输入框"],["walletrecuramt","金额输入框"],["walletrecursave","保存"],["walletslip","夹层里的一张小票（data-in=\"1\" 是进账）"],["walletmonth","我的钱包：本月进账／花出去那两格"],["walletkind","我的钱包按类分开的一块（data-kind＝transfer/redpacket/shop/live/kinship_out/manual/misc）"],["walletproof","点开一笔后露出来的凭证（时间、类别、出处、余额）"],["wallettrace","凭证里「去聊天里看这一笔」那颗键"],["walletdel","凭证里「删掉这一笔」那颗键"],["walletclear","小票最底下「清空全部流水」"],["walletcur","余额旁边「用什么钱」那颗键"],["walletkin","卡包里的一张亲属卡（data-mine=\"1\" 是你给出去的）"],["walletnote","余额那叠钞票（两个钱包共用这一叠）"],["walletpocket","皮夹里的一格隔层（TA的钱包选人页每一行也是这一格）"],["walletcardsbtn","右上角「亲属卡」"],["walletedit","余额旁「改」那颗"],["walletentry","余额旁边那颗「记一笔」"],["walletentryform","记一笔那张小单子（花出去/收进来、花在哪、多少）"],["walleteditor","改余额那张单据"],["walletsec","「夹层里的小票」「我给出去的」这种小标题"],["walletslipname","小票上的名目"],["walletslipamt","小票上的金额（data-in=\"1\" 进账）"],["walletempty","空着时那句话"],["walletkinadd","「给 TA 一张亲属卡」那颗虚线按钮"]])}),
    Object.freeze({zh:"钱包",pages:Object.freeze(["cwallet"]),hooks:Object.freeze([["cwalletpage", "TA钱包整页最外层"], ["cwundo", "TA钱包「为你花的」每一笔右边那颗「撤销」（钱退回他钱包）"],["cwpage","整页最外层（data-view=\"list\" 选人／\"char\" 某个人的钱包）"],["cwrow","选人那页的一行（data-id＝角色 id）"],["cwbalance","TA的余额大数字"],["cwsec","「日常消费」「送礼与转账」这些小节标题"],["cwline","一笔记录（data-kind=\"daily\" 日常／\"flow\" 送礼转账）"],["cwrowname","选人页一行里的名字"],["cwcurbtn","右上角币种符号"],["cwedit","余额旁「改」那颗"],["cweditor","改余额那张单据"],["cwbox","每一块撕下来的单据（收入来源／存款概览／理财…）"],["cwsum","存款概览里「本月收入／花费／剩余」一行"],["cwnote","每块底下那句斜体说明"],["cwincome","收入来源的一行"],["cwacct","「钱放在哪儿」的一行"],["cwdebt","欠账的一行（data-done=\"1\" 已了）"],["cwdebtbtn","「还清／收回这笔」"],["cwfold","能收起的那两块的标题（data-part=forher 为你花的／daily 日常消费）"],["cwitem","「为你花的」里的一笔"],["cwcurpage","「用什么钱」整页"],["cwcurpreset","币种那排预设（data-on=\"1\" 选中）"]])}),
    Object.freeze({zh:"世界书",pages:Object.freeze(["lore"]),hooks:Object.freeze([["lorepage","整页最外层（活页夹底）"],["loreintro","顶上那句说明和在用几条"],["lorefilter","搜索框和那排章那一块"],["loreview","按去向／角色／分类那三张分隔页标签（data-on=\"1\" 是翻到的）"],["lorestamp","一枚筛选章（data-on=\"1\" 是选中的）"],["lorecard","一条词条（data-off=\"1\" 是停用的）"],["loretitle","词条标题"],["lorebody","词条正文那两行"],["loreswitch","词条右边的启用开关（data-on=\"1\" 开着）"],["loreedit","点开一条之后的编辑页整页"],["loreedlabel","编辑页里每一栏的标题"],["lorecat","编辑页那排分类（data-on=\"1\" 选中）"],["loresave","编辑页底下「保存」"]])}),
    Object.freeze({zh:"记忆库",pages:Object.freeze(["memlib"]),hooks:Object.freeze([["mempage","整页最外层（记忆盒底）"],["memtab","顶上全部／未了／常驻那三张索引签（data-tab；data-on=\"1\" 当前）"],["memwho","按角色筛的那排头像（data-on=\"1\" 当前）"],["memroom","主线／各个小房间那排页签（data-on=\"1\" 当前）"],["memdate","每张卡左边的日期和情绪点"],["memcard","一张记忆索引卡（data-open=\"1\" 未了；data-pinned=\"1\" 常驻）"],["memtext","卡上那段记忆正文"],["memtool","右上角那两颗（data-part=cfg 设置／add 新增）"],["memindex","「XX 的记忆索引」那一块"],["memstat","索引里在册／常驻／未了／留档那一格（data-part）"],["memsearch","搜索框"],["memcfgrow","召回设置里的一行"],["memcfgswitch","召回设置里的开关（data-on）"],["memcfgval","召回设置里滑条右边那个数"],["memedhead","编辑记忆顶上那行"],["memedsave","编辑记忆的保存（对勾）"],["memedwho","编辑记忆里关联角色那排（data-on）"],["memedswitch","编辑记忆里的开关（data-part=pin 置顶／open 未了）"],["memedemo","情绪坐标那一块"],["memeddel","「删除这条记忆」"]])}),
    // 人格档案馆（她 2026-10-08：「那一页是不是没有挂点」）
    Object.freeze({zh:"人格档案馆",pages:Object.freeze(["cast"]),hooks:Object.freeze([["cardimportpage", "导入角色卡那一层的最外层"],["castshelved","档案馆里收起来的人身上那个「放回来」标记"],["castpage","整页最外层（桌面底纹铺在这儿）"],["castcount","顶上「共 N 份卷宗」那一行"],["castcard","一份卷宗卡（data-id＝角色 id）"],["castspine","卡左边那道带角色颜色的书脊"],["castavatar","贴在卡上的头像相框"],["castname","卡上的名字"],["castsum","名字下面那两行人设摘要"],["castinfo","卡底下时区／生日／人设字数那一栏"],["castheart","卡最底下「心上」那一条"]])}),
    // 编角色卡那一页（她 2026-10-08：「还有编角色卡那边也要」）
    Object.freeze({zh:"编角色卡",pages:Object.freeze(["castForm"]),hooks:Object.freeze([["castfpage","整页最外层（桌面底色）"],["castfsave","右上角「存档」"],["castfcover","最上面那张卷宗封面卡"],["castfavatar","封面上的头像相框"],["castfphotomenu","点封面照片弹出来的那张小单子（换图、生成、存、锁脸、移除）"],["castflang","人物卷宗「常用语言」那一排；每颗 data-on=1 选中"],["castfname","名字那一栏"],["castftag","一句话标签那一栏"],["castfcolor","「这份卷宗什么颜色」那一排色块"],["castfsec","下面几大块（data-no＝01 人物底稿／02 时间坐标／03 视觉档案／04 声音档案；里面的输入框用 textarea、input 选）"],["castfdel","最底下删除按钮"],["castfreset","完全重置按钮"]])}),
    Object.freeze({zh:"资料卡",pages:Object.freeze(["contact"]),hooks:Object.freeze([["cdpage", "整页最外层（带角色颜色的纸底）"], ["cdhead", "头部一行（头像、名字、简介）"], ["cdname", "角色名大字"], ["cdtagline", "名字下面那行简介"], ["cdage", "年龄和生日那一行"], ["cdaffinity", "好感度那一块"], ["cdrules", "「长期准则」整块"], ["cdrule", "单条准则卡片"], ["cdactions", "底部操作按钮那一组"], ["cdbtn", "单个操作按钮（data-kind=chat/state/desires；心上那颗 data-on=\"1\" 是有念想）"]])}),
    Object.freeze({zh:"设置",pages:Object.freeze(["config"]),hooks:Object.freeze([["configpage", "设置每一页的最外层（那层格子底纹；改设置的背景改这里）"],["cfhome", "设置首页那一列入口的容器"], ["lazygate", "用到才加载的功能还没装好时那一页「在打开……」"], ["lazyretry", "那一页网断了时的「再试一次」"],["charphotos", "数据页「TA 们拍的照片」那一块"], ["charphotowho", "照片按人分的那一行"], ["charphoto", "照片格子里的一张"], ["charphotosave", "看大图时「保存到手机（原图）」"],["maskrest", "虚拟时间里某张面具的「先歇着」那一行"], ["calllog", "设置 · 调用记录与缓存 里的「模型调用记录」整块"], ["mcprelay", "设置 · 文字模型 · MCP 那一页里「转接」那一块"], ["relaymodels", "视频转接那一页里可选的模型那一片"], ["calllogrow", "调用记录的一行（data-ok=\"1\" 成功，\"0\" 失败或断开）"], ["calllogtok", "调用记录那行里的输入／输出 token"], ["failretry", "调用记录页顶上「失败了自动再试一次」那一行"], ["cfrow", "首页的一行入口（data-page＝通往哪个子页，如 api/look/data）"], ["cfrowtitle", "首页一行的标题"], ["cfrowstate", "首页一行右下那行灰色状态小字"], ["cfrowdot", "首页一行右边的小红点（「更新了什么」有新的一天、或者有没点过「知道了」的公告时亮）"], ["cldays", "「更新了什么」那一页的整列"], ["clday", "其中一天（data-on=1 摊开着）"], ["cldayhead", "那一天的标题行（日期、几条、箭头）"], ["clitems", "摊开后那一串"], ["clitem", "其中一条"], ["clmore", "最底下「再往前看」"], ["clsearch", "「更新了什么」顶上的搜索框"], ["clmark", "搜到的那几个字的底色"], ["clfull", "搜到的一条只显示了一段时，后面那个「看整条」"], ["clnew", "「更新了什么」最上面那几则还没点过「知道了」的新公告"], ["clnewone", "其中一则（整则摊开着）"], ["clnewtitle", "这一则的标题"], ["clnewok", "这一则底下那颗「知道了」"], ["clnotices", "「更新了什么」顶上折着的「秋秋的公告」（公共版才有；data-on=1 摊开着）"], ["clnoticeshead", "那一行标题"], ["clnotice", "其中一则（data-on=1 看着全文）"], ["clnoticetitle", "一则公告的标题行"], ["clnoticebody", "一则公告的全文"], ["cfnote", "首页底部那张说明卡"], ["cfmark", "方角汉字栏号牌（首页每行、子页每格都有）"], ["cfgrid", "子页里两列格子的网格"], ["cftile", "子页里的单个入口格子（data-wide=\"1\" 是占满一行的宽格）"], ["cfpanel", "子页内容外面那张卡片框（data-flush=\"1\" 没内边距）"], ["composerlift", "外观与壁纸里「输入栏往上抬」那一格"]])}),
    Object.freeze({zh:"论坛",pages:Object.freeze(["forum"]),hooks:Object.freeze([["pmphoto", "私信里对方发来的那张照片"],["forummutual","角色主页上「你们互相关注」那一行"],["forumfollowing","角色主页上「TA 关注了：…」那一行"],["pmmsgdel","论坛私信里点中一条后底下那一行（取消／删掉这条）"],["fwdpm","转发面板里「论坛私信」那一列"],["pmwechat","论坛私信里「加个微信 / 去微信聊」那颗键"],["forummaskrow","论坛「我」页「用哪张面具发」那一排"],["forummask","挑面具的一颗；data-on=1 现在用的"],["forumpage","论坛整页最外层（底色在这儿改；data-nav＝home/search/notice/pm/me，data-sub＝1 是点进帖子、主页这些里层）"],["foboards","主页顶上一排版块（吧）"],["foboardowner","开吧／编辑吧那张卡里「吧主」那排人（data-on=1 是选中的那个）"],["forules","版块下面那条吧规横杠"],["fosort","「正在聊／最新发帖／热榜」那一排"],["fonav","论坛底栏整条"],["fonavtab","底栏的一颗（data-part＝home/search/notice/pm/me，data-on＝1 当前）"],["fopostpage","点进一个帖子后的整页"],["fopostcard","帖子详情顶上楼主那一大张卡"],["fochip", "版块切换的小标签（data-on=\"1\" 是当前那个）"], ["forow", "帖子流里的一张帖子卡（data-me=\"1\" 我发的，data-anon=\"1\" 匿名）"], ["fonotes", "论坛双列时那块瀑布流"], ["foboardsort", "吧那一排最后「排序」那颗"], ["foboardsortpage", "吧排序、藏起来那一页"], ["foboardsortrow", "排序页里一个吧一行"], ["foboardhide", "那一行的「藏起来／放出来」"], ["foboardreset", "排序页底下「恢复默认」"], ["fomorephotos", "发帖时配图那一列"], ["foaddphoto", "配图那一列「再加一张」"], ["folayout", "论坛「我」页里「首页排版」那两颗（单列 / 双列，data-on=\"1\" 是选中的那颗）"], ["fonewhead", "「新帖在这里」「新回复在这里」那一行（点了展开，aria-expanded=\"true\" 是开着）"], ["fonote", "双列时的一张卡片"], ["foname", "帖子卡上的作者名"], ["fobody", "帖子卡正文预览"], ["foacts", "帖子卡底部操作栏"], ["fofloor", "帖子详情里的一层楼（data-me=\"1\" 我的，data-new=\"1\" 新楼）"], ["foreplies", "楼中楼回复框"], ["fosend", "详情页底部回复栏的发送键"], ["fofab", "右下角悬浮的发帖键"], ["foxhsbar", "小红书笔记底下赞／收藏／评论那一排"], ["foxhsbody", "小红书笔记正文（#话题 标了色）"], ["foauthor", "评论区里作者本人那枚「作者」小签"], ["foxhsmore", "评论下「展开 N 条回复」"], ["foxhsprofile", "小红书模式下主页的获赞与收藏和双列笔记"], ["foxhsproftab", "主页「笔记／收藏／赞过」的一栏；data-on=1 当前"], ["foxhsmycmts", "小红书主页「我评论过的」那一列"], ["foxhsmycmt", "「我评论过的」里的一条"], ["foauthorliked", "评论下「作者赞过」"], ["foxhsphoto", "发笔记时最上面放图那块"], ["foxhstopics", "发笔记时挑 #话题 那一排"], ["foxhstop", "小红书模式首页顶上「关注／发现／收藏」那一块"], ["foxhstoptab", "那三个大栏的一个；data-on=1 当前"], ["foxhstopicrow", "「发现」下面那排话题"], ["foxhstopic", "一个话题；data-on=1 当前"], ["foxhsnotice", "消息页那三栏"], ["foxhsnoticetab", "消息页的一栏；data-on=1 当前"], ["foxhslikerow", "「赞和收藏」里一篇笔记"], ["foxhsfanrow", "「新增关注」里一个人"], ["foxhssearchsort", "搜索结果「最热／最新」"], ["foxhsphotos", "多图笔记左右滑的那一块"], ["foxhspageno", "多图右上角「1/3」"]])}),
    Object.freeze({zh:"日记",pages:Object.freeze(["diary"]),hooks:Object.freeze([["diunread", "日记列表里那一篇的「没看」小红点（TA 新写、还没翻到的）"],["diallread", "「全部标为已读」：目录页顶上那颗，和翻开某一本时列表顶上那颗（data-part=\"book\"）"],["diarypage", "日记各页的最外层；data-part 区分哪一页"],["diauthor", "日记本列表里每个人的一行（data-on=\"1\" 当前那本，data-me=\"1\" 我自己）"], ["diname", "那一行里的名字"], ["dirow", "一篇日记（data-me=\"1\" 我写的）"], ["didate", "日记左侧的日期块"], ["dititle", "日记标题"], ["dibody", "日记正文预览"], ["dimarks", "条目下方的小标记行（划掉/秘密/贴纸、几人看过）"], ["dipen", "右上角写日记的铅笔键"], ["dipage", "翻页阅读时的单页日记"], ["dicover", "日记本封面那一整页（底纸在这儿改；data-paper＝白纸 paper/横线 lined/方格 grid/布纹 cloth/夜空 night/木纹 wood）"], ["dibook", "封面上那本日记本"], ["dipaperbtn", "封面「换纸」那颗"], ["dipaper", "换纸那一排（按钮 data-on=1 是现在这张）"], ["dibg", "日记目录页和全文页的整页底纸（data-paper 同上）"]])}),
    Object.freeze({zh:"情侣空间",pages:Object.freeze(["us"]),hooks:Object.freeze([["uspage", "情侣空间各个小本、各个房间的最外层；data-part 区分哪一页（coupleletters、ifroom……）"],["capsulepage", "时光胶囊整页最外层；data-part 区分哪一页"],["qareplies", "问答小本一页底下的留言串（两份都打开后才有）"],["letterrel", "TA 写来的空间申请信底下「想跟你开一个某某空间」那行"], ["spacebook", "空间里一本本子的整页（data-kind＝blackcase/advisor/choices/safe）"], ["spacebooknew", "本子顶上「记一条」"], ["spacebookta", "本子顶上「让 TA 开一条」"], ["spacebookform", "记一条时展开的那张表"], ["spacebookitem", "本子里的一条（data-kind＝哪本，长相各不同；data-closed=1 已收尾）"], ["spacebookline", "一条底下往下接的一句（data-me=1 你写的）"], ["spacebookstamp", "本子一条右上角那枚章（在案／待审／已和解／已定／认了）"], ["spacebookopen", "卷宗、诉状点开后那一整份"], ["spacebookreply", "点开后底下接话那一块（卷宗是一排墨章）"], ["spacebookask", "一条底下「让 TA 接」"], ["usplaque", "空间门口那块门牌（称号／谁说了算／护短；被涂改过的旧字划掉）"], ["usplaqueta", "门牌底下「把笔递给 TA」"], ["usthing", "「东西在谁那儿」条子上的一样（data-at＝me 在我这儿／ta 在 TA 那儿）"], ["uslight", "留灯那盏灯（data-who＝me 我留的／ta TA 留的；data-on=1 亮着）"], ["usfamrole", "选家人时展开的「TA 是你的谁」那一排"], ["usrel", "挑空间关系的一行（恋人／闺蜜／挚友／家人；data-on=1 选中）"], ["usrelbox", "空间设置里「你们是什么关系」那一块"], ["uscouple", "情侣列表的一行（data-on=\"1\" 在一起，否则邀请中；data-new=\"1\" 有新东西）"], ["usrelchip", "情侣列表里非恋人那几行名字边上的小火漆＋空间名"], ["usname", "列表行里的角色名"], ["uspair", "空间内页封面上那两枚头像的外框（整组挪位置）"], ["usavatar", "空间内页封面上的一枚头像（带环；data-who=\"ta\" 是他、\"me\" 是我）。默认我那枚往左压 18px 叠着，想拉开成两个整圆：[data-wk=\"usavatar\"][data-who=\"me\"]{margin-left:12px !important}"], ["uscount", "列表行里「在一起 N 天」的天数大字"], ["usdays", "空间内页「在一起 N 天」那一组"], ["usnow", "「TA 此刻」那张便签"], ["uspaper", "往上滚时盖住封面的那张底纸（颜色、透明度、磨砂都在它身上，写的时候要加 !important）"], ["uswall", "墙上的功能卡片（data-kind＝模块）"], ["usspine", "「收着的」那一列书脊入口（data-kind＝letters/exdiary/qa/capsule…；data-new=\"1\" 有新内容）"], ["useyebrow", "各区块的小眉标标题"], ["jarpage", "存钱罐那一整页"], ["jarglass", "存钱罐页顶上那只玻璃罐"], ["jarrow", "存钱罐流水的一行（data-who=\"me\" 是你放的／取的）"]])}),
    Object.freeze({zh:"时刻",pages:Object.freeze(["shike"]),hooks:Object.freeze([["shikepage","时刻外层整页（横着滑那一层）"],["shikecard","横着滑的那张整屏 CG 卡（data-on=\"1\" 是当前停着的）"],["shikedetail","点进一个人以后的那一页"],["shikebigsave", "看大图里「保存到手机」"], ["shikeitem","里层横着滑的一张时刻卡（data-kind=meet/us/bday/fest/first）"],["shikesay","时刻卡上TA说的那段话"],["shikecreate","「开一张时刻」那一页"],["shikemonths","里层底下那条时间轴（一张时刻一道刻度）"],["shikemenu","里层右上角「⋯」打开的那张小菜单"],["shikeacts","时刻卡底那一行小字动作"],["shikenote","时刻卡上写着那天的事的那块底框"],["shikewith","群里那种卡上「一起的还有」那一行"],["shikesoon","卡上那个倒计时小签（data-today=\"1\" 是就在今天）"]])}),
    // 一起学 · 我来教（2026-10-03）
    Object.freeze({zh:"我来教",pages:Object.freeze(["study"]),hooks:Object.freeze([["studypage","一起学每一页的最外层（桌面那层底色；改一起学的背景改这里）"],["studycard","一起学里每一张纸卡（课程卡、课程控制台那几块、日历、新建课程的表、评语、复习卡……都是它；底色/边框改这里）"],["studyinput","一起学里的输入框和多行输入"],["studyrulesbtn","课程页右上角「规矩」那颗"],["studyrules","「上课规矩」那一整页（学习准则、教学风格）"],["studytab","一起学首页那四个 tab（认真教／一起研究／一教一学／我来教）；data-on=1 是选中那个，data-mode 是 teach/costudy/nv1/tb。四个的颜色默认跟着这一页的 tint（没给就跟 accent）转出来"],["studymatpiles","资料页上头那排隔板（全部／我传的／老师给的）"],["studymatpile","一张隔板；data-on=1 选中"],["studyunit","开一节课时排出来的那几小节卡（data-keep=\"1\" 是点了留着的）"],["tbmis","顶上那条「TA 心里想错的地方」（每颗带 data-found=\"1\" 是挖出来的）"],["tbnote","TA 的课堂笔记"],["tbmsg","课上一句（data-me=\"1\" 是你讲的）"],["tbflash","挖出来时弹的那张"],["tbquiz","随堂小测那张"],["tbreview","评教卡"],["tbleft","评教卡底下「还没挖出来的」"]])}),
    Object.freeze({zh:"番茄钟",pages:Object.freeze(["pomodoro"]),hooks:Object.freeze([["pompage", "番茄钟各页的最外层；data-part 区分哪一页"],["pomfocus","专注视频整页，底纹与视频铺满外壳"],["pomkind","设置桌上「倒计时 / 正计时 / 循环番茄」那一排（data-on=\"1\" 是选中的）"],["pommemo","便签里「从待办里挑」那一排"],["pomsneak","「溜号会被发现」那一格开关（data-on=\"1\" 开着）"],["pomhis","专注页左上「TA 在：…」那一行"],["pomgoal","收桌单子下面「做完了吗」那张便签"],["pomcal","记录页里最近八周的专注日历"],["pomcalask","日历下面「让TA点评一下」那颗键"],["pomcalnote","日历下面TA那句点评"],["pompoke","轻戳画面显示字幕的透明按钮"],["pomsubtitle","模式字幕与独立听这句按钮"],["pomtimer","底部发条倒计时与暂停控制"],["pommore","手动补充陪伴话与回看入口"],["pomvideoentry","动态陪伴图制作入口"],["pomvideoeditor","动态陪伴图整页外壳"],["motionstrip","动态形象编辑页顶上那条胶片（平时／专注时／通话时，data-on=\"1\" 是选中那格）"],["pomarchive","往期「坐过的那些」整页"],["pomarchtabs","往期顶上那排桌牌（按谁坐对面分）"],["pomarchrow","往期里的一张单子（data-done=\"1\" 是坐满了）"],["pomarchsum","往期顶上那行合计（坐了多久／几场／几场坐满）"],["pomvideostage","循环视频画面，视频保持静音、语音独立播放"]])}),
    Object.freeze({zh:"三席会客",pages:Object.freeze(["loungeapp"]),hooks:Object.freeze([["loungepage", "三席会客整页最外层"]])}),
    Object.freeze({zh:"急救台",pages:Object.freeze(["rescue"]),hooks:Object.freeze([["rescuepage", "急救台整页最外层"]])}),
    Object.freeze({zh:"值班室",pages:Object.freeze(["vpscodex"]),hooks:Object.freeze([["vpscodexpage", "值班室整页最外层"]])}),
    Object.freeze({
      zh: "聊天页", pages: Object.freeze(["thread", "gthread"]),
      hooks: Object.freeze([["heartpage", "心上那本本子的最外层"],["chatsetpage", "聊天设置整页最外层（改聊天设置的背景改这里）"],["peekcutpage", "被剪掉的聊天那一页的最外层"],
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
        ["bdaypin", "生日当天顶在最上面那条「信封可以拆了」"],
        ["row", "一整行消息（含头像）"], ["avatar", "头像"],
        ["bubble", "气泡本体（data-me=\"1\" 是她的；data-kind＝text/voice/photo…；长按菜单里那一颗带 data-preview=\"1\"）"],
        ["msg", "一条消息：data-me；data-first/data-last＝连发那一串的头/尾（\"1\"是）；data-kind；data-recent=\"1\" 刚进来（做入场动画）"],
        ["listenstay", "一起听选人底下「说的话只留在一起听里」那一格"], ["listenshare", "一起听「转给谁」整页外层"], ["listensharepage", "一起听「转给谁」选人页本体"], ["listensharelist", "一起听转发：选人列表"], ["listensharechar", "一起听转发：一个角色"], ["listensharerow", "一起听转发：选主聊天还是哪间房"],
        ["listenlog", "一起听播放页底下「刚才说的」"],
        ["shuacmtsheet", "刷刷竖着刷里从底下升起来的评论层"],
        ["shuacmtsheethead", "评论层顶上那条（把手、标题、✕）"],
        ["shuaheart", "片刻双击点赞冒出来的那颗心"],
        ["shuamorecmt", "片刻评论区「刷点评论」"],
        ["shuaemobtn", "片刻评论输入框旁的表情键"],
        ["shuaemopanel", "片刻评论里挑表情那一格"],
        ["shuacmtperson", "片刻评论里点得进主页的名字"],
        ["shuapostpic", "片刻发视频「选一张照片」"],
        ["shuacpname", "片刻情侣号卡片上的号名"],
        ["shuacpbio", "片刻情侣号卡片上的简介和粉丝那行"],
        ["shuacpchal", "片刻情侣挑战那一页"],
        ["shuacpq", "情侣挑战的题目卡"],
        ["shuacpchalgo", "情侣挑战「一起亮出来」"],
        ["shuacpchalbtn", "情侣号里「玩一个情侣挑战」"],
        ["sysnotecopy", "出戏回话小卡片右上角的「复制」"],
        ["shuaregtag", "片刻评论里熟面孔名字后面那个小标"],
        ["roomlisten", "一起听房里那条横幅上的「进去一起听」"],
        ["altavatar", "小号房间设置里给小号挑头像那一行"],
        ["setsearch", "设置页、聊天设置顶上的搜索框"],
        ["setsearchhits", "搜索结果那一列"],
        ["setsearchhit", "搜到的一行（在哪一页 › 哪一节 › 那一截原文）"],
        ["fwdmode", "转发面板顶上「合并转发／逐条转发」那两颗；data-on＝1 是选中的"],
        ["rpenvelope", "点开红包那张大红封／领完那一页（data-stage＝closed 还没拆，open 拆开了）"],
        ["rpopenbtn", "大红封正中那颗「開」"],
        ["rpamount", "拆开后那一页的金额"],
        ["rpclose", "红包下面那颗关掉的圆键"],
        ["rparc", "大红封下半截那道弧（data-part＝bottom）／拆开那页顶上的红弧（data-part＝top）"],
        ["rpavatar", "红包上发红包那人的头像"],
        ["rpfrom", "「谁发出的红包」「谁的红包」那一行"],
        ["rpwish", "红包上的祝福语"],
        ["rpstatus", "拆开那页金额下面那行（已存进钱包、等他拆开……）"],
        ["rpclaims", "群红包拆开那页底下「谁领了多少」那一块"],
        ["rpclaim", "那一块里的一行；data-me＝1 是你自己"],
        ["rpreceipt", "红包被领／退回后那张领过的红包（跟转账单分开改；data-status＝accepted／returned）"],
        ["pathint", "聊天设置里拍一拍签名下面那行「双击头像就能拍他」"],
        ["messagesource", "游戏对话上方的世界来源（data-world区分世界；旧记录显示来源未记录）"],
        ["name", "气泡上面那行名字（单聊默认藏着，排版里能打开）"],
        ["meta", "气泡边上的时间/已读那一小行"], ["time", "中间那条日期分隔"],
        ["note", "系统小字（撤回、进房这类）。只改其中一种要连 data-part 一起写：recalled 撤回、pat 拍一拍、busy 在忙、lock 换锁屏、silence 没回话、call 通话回执、callsum 通话小结；不带 data-part 就是全部一起改"], ["noteink", "系统小字的字色"],
        ["narr", "居中那行旁白／动作（data-me=\"1\" 是她做的）"], ["narrink", "旁白那行字本身"],
        ["sameroom", "顶栏那个「同处一室」键（data-on=\"1\" 是开着）"],
        ["askslip", "聊天里 TA 跟你要钱那张单子（data-status＝pending 等批／approved 准了／denied 没准）"], ["askslipimg", "单子上附的那张图（点开看大图）"],["askslipamount", "单子上的金额"], ["askslipcond", "准了时附的那句条件"], ["askslipstamp", "单子右上角那枚印章（批了／驳了）"],
        ["card", "气泡里的卡片（照片、转发、语音）。全 App 二十几种卡都叫 card：只改一种要写成 [data-wk=\"cardrow\"][data-kind=\"那种卡\"] [data-wk=\"card\"]"], ["cardrow", "单聊里一张卡片那一整行；data-kind 是卡的种类（namecard、ledger、health…）"],
        ["maskworld", "我的面具里「在哪个世界」那一栏（选项 data-on=\"1\" 选中）"],
        ["tripbook", "旅行里「订机票和酒店」那一块和它的按钮（data-part=search/me/ta/aa/kin/again）"], ["tripdate", "旅行页「哪天出发」那一行（日期选择）"], ["tripseat", "订票里选座那一块（选项 data-on）"], ["tripbookopt", "一班票或一家酒店（data-on=\"1\" 选中）"], ["tripbookpaid", "订好以后那张订单票根"],
        ["bdayletter", "生日零点那封信（信封卡）"],
        ["bdayplan", "生日暗中准备的封口信封"],
        ["offlogrestore", "「线下经过」卡上那颗「放回往期」"],
        ["gunreadjump", "群聊顶上那颗「↑ N 条新消息」（点了跳到第一条没看的）"],
        ["gnewbelow", "群聊里你在上面看时，底下那颗「↓ N 条新消息」"], ["newbelow", "单聊里你在上面看时，底下那颗「↓ N 条新消息」"], ["chatcsslist", "设置·外观里「各聊天窗的 CSS」那一页"], ["chatcssclear", "那一页每一行的「清空」"], ["gachawho", "抽卡页「谁来扳拉杆」那一排"],
        ["quote", "消息引用块（带 data-me＝这条是谁发的；data-from＝引的是谁的话：me 你的、ta 对方的，想让引用跟着被引的人的气泡配色就按它写；输入框上面那条待发送的引用也是它，多带 data-draft=\"1\"）"], ["quotedraft", "输入框上面那一整条待发送的引用"], ["msgstick", "双击TA的气泡贴上去的那个表情（压在气泡右上角；贴的是 emoji 时带 data-emoji=\"1\"）"], ["msgstickoff", "面板最上面「拿掉贴着的那个」"], ["msgstickpick", "双击气泡后铺满屏的那层（点空白处关）"], ["msgstickbar", "双击气泡后浮在它上方的深色小条"], ["msgstickemoji", "小条上那几个快捷 emoji"], ["msgstickpanel", "小条点 ⌄ 展开的深色面板"], ["msgstickgroups", "面板顶上「快捷条显示」那排"], ["msgstickgroup", "「快捷条显示」里的一栏（data-on=1 是现在用的）"], ["msgstickgroupnew", "「＋ 新建一栏」"], ["msgstickgroupedit", "每栏标题旁的「编辑」"], ["msgstickedit", "新建／编辑一栏那块"], ["msgstickpacks", "面板最上面「贴表情包 ›」"], ["msgstickown", "面板底下「打一个别的 emoji」那一格"], ["quoteclear", "待发送引用右边那个 ×"], ["quoteicon", "引用块前面那个 ❝"], ["quotetext", "引用的那句原话"], ["voice", "语音消息整块"], ["voicebar", "语音条"],
        ["translation", "外语正文和翻译区"], ["translatebutton", "翻译/收起键"], ["translatebody", "展开后的译文"],
        ["selfmeangle", "生成我的照片「自拍／别人拍的」那两格"], ["selfmehint", "照片里「生成我的自拍」底下那句说明"], ["rpsingle", "私聊红包那一张（钱走转账那套，脸是红包）；data-status＝pending 没拆／accepted 已领／returned 退回"], ["transfercard", "转账卡整张（那张纸的底、边、圆角）；data-status＝pending 待收／accepted 已收款／returned 已退回，data-receipt＝1 是收款回执那张，data-me＝1 是她转出去的"], ["transferamount", "转账卡上的金额"], ["transfercur", "转账卡金额旁的货币符号"], ["transferrule", "转账卡中间那道虚线"], ["transfernotch", "虚线两头的半圆缺口（换了卡底色要跟着改；data-part=l/r）"], ["transferfoot", "转账卡底下那一条（data-part=status 是状态行，没写是退回／收下按钮条）"], ["transferbtn", "退回／收下按钮；data-part=back/take"], ["transferlabel", "转账卡左上角「转账／收款／退还」那几个字（想换成别的字：font-size:0 再用 ::after 写 content）"],
        ["transfernote", "转账卡上的附言那一行"], ["transferseal", "转账卡上那枚印章"],
        ["photocard", "照片卡整张（相纸的底、边、影）"], ["photocap", "照片底下那行配文"],
        ["photoface", "没真图的照片卡里那块相面（米色渐变那块，改色写 background）"], ["phototext", "相面上那句描述的字"], ["photohint", "照片卡右下「点开看这张」"],
        ["composer", "底部输入栏整条"], ["narrbar", "旁白模式时输入栏上面那一条（两档＋还在生效的便签）"], ["narrkind", "旁白那两档「此刻发生了什么／往后的方向」（data-on=\"1\" 选中）"], ["dirlong", "「管接下来两轮／整场有效」那颗切换"], ["dirnote", "一条还在生效的方向便签"], ["chatback", "返回键"], ["namecard", "聊天里那张推荐名片整张"], ["namecardname", "名片上的名字"], ["namecardpick", "选名片那一页的一行"], ["wxcard", "聊天里的天气小卡片整张（data-kind＝sun/partly/cloud/fog/rain/storm/snow）"], ["wxcardsky", "天气卡上半截那块天"], ["wxcardtemp", "天气卡上的大字气温"], ["wxcardrain", "天气卡上的降雨概率小签"], ["wxcardsay", "天气卡下半截TA那一句叮嘱"], ["chatmore", "右上角更多/设置键"],
        ["chatplus", "输入栏加号键"], ["chatinput", "输入框"], ["send", "发送键"], ["chatreply", "让 TA/他们回复的 AI 键"],
        ["chatpanel", "点＋弹出来的那整块面板（底色、上边线、内边距；群友 2026-10-06 要的）"],
        ["chattool", "加号面板工具键（data-chat-tool 区分 voicemsg／sticker 等）"],
        ["chattoolicon", "加号面板每个键上面那个方块（底色、边框、圆角、大小；也带 data-chat-tool）"],
        ["chattoolglyph", "方块里的图标（svg：stroke 换颜色；换图就先 svg { display:none }，给这一格写 background）"],
        ["chattoollabel", "键底下那行字"],
        // 点头像那张心声卡（她 2026-09-22 转群里读者：「那个卡片不可以美化的嘛？」）
        ["statecard", "点头像那张心声卡整张"], ["statehead", "心声卡抬头（头像·名字·此刻心情）"],
        ["stateseen", "心声卡「看得见的」那一段（穿着＋动作）"], ["statewear", "心声卡上「穿着」那一行（点一下能改）"], ["closetpick", "改穿着时弹出来的衣柜挑选（从衣柜挑一身、打字筛）"], ["statevoice", "心声卡「心里想的」那一块"], ["statevoicedel", "心声卡上每条心声旁边的「删」"], ["statevoiceclear", "心声卡翻旧的那页顶上的「清空」"],
        ["stateaff", "心声卡底下好感那一整行（心＋好感度那几个字）"],
        // 那颗心拆开（她 2026-10-05：「要可以改图案」）：换形状写在 stateheart 上的 --sc-heart-mask，四层一起变
        ["stateheart", "好感那颗心整颗（换图案：--sc-heart-mask: url(图)；颜色 --sc-heart-ink）"], ["stateheartline", "心的描边那一圈"],
        ["stateheartbase", "心里没灌满的那块底"], ["stateheartfill", "心里灌进去的那块（水位）"], ["stateheartnum", "心中间那个好感数字"],
        // 拉黑时气泡旁那颗红色感叹号（她 2026-10-01：「跟微信一样，然后加一个美化挂点」）
        ["blockdot", "拉黑中气泡旁那颗红色感叹号（data-me=\"1\" 是她那边的）"],
        // 重 Roll 留版那一行「‹ 2/3 ›」（她 2026-10-10）
        ["rerollnav", "最后一条回复底下翻重 Roll 旧版的那一行"],
        // 时刻「发给 TA」那张小卡（她 2026-10-03）——挂在聊天页这一组，聊天页的 CSS 才抓得到它
        ["shikeshare", "聊天里那张「时刻」小卡（你从时刻里「发给 TA」的，和 TA 自己存进时刻时落的那张）"], ["gameshare", "聊天里那张小游戏战报卡"], ["stampletternote", "「今天的信」上他写的附言"], ["stampletterzh", "「今天的信」附言下的中文翻译"], ["stamptkpick", "寄一版上面那排挑券（生日券、纪念日券 / 十连券，data-on=1 是这次用的）"], ["stampstorylog", "SSR 剧情顶上「记录」"], ["stamplog", "剧情回放记录（整页）"], ["stamplogline", "记录里的一句（data-who=he/me/narr/inner）"], ["stamplogpick", "记录里「你选的」小标"], ["stamplogsay", "记录里他那句旁边的「听」"], ["stampstorysec", "剧情标题底下「第几节」"], ["stampresume", "剧情「接着看 / 从头看」那一层"], ["stampresumego", "「接着看」"], ["stampresumetop", "「从头看」"], ["stampunread", "册子里没点开过的邮票右上角那个小点"], ["stampextras", "卡页里的「番外」那一块（限定 SSR）"], ["stampextra", "番外里的一段"], ["stampextrabuy", "换番外券那一层（说明＋挑张数）"], ["stampextk", "卡页右上角番外券＋"], ["stampextrabuygo", "「用 n 印泥换」"], ["stampextranew", "番外那排最后的虚线框「写一段新番外」"], ["stampextratab", "册子里有番外的邮票右上角折起的小角"], ["stampextrawish", "写新番外时问「想看什么」那一层"], ["stampextrasend", "番外「发给他看」"], ["stampfullnav", "卡面全屏左右换面的箭头"], ["stampfullside", "卡面全屏底下「第几面」的小点"], ["stampsetcover", "卡面全屏底下「改封面 / 封面」"], ["stampextrarow", "番外列表的一行（名字＋开头一句）"], ["stampextraacts", "番外每段底下那排小按钮"], ["stampexface", "卡面下面「画番外卡面 / 看番外」那一排"], ["stampstorywide", "剧情横图背景（上半屏整张＋虚化垫底）"], ["stampextrarewrite", "番外「重写这段 · 不扣券」"], ["stamprotate", "卡面全屏「横过来看」"], ["stamprotview", "横过来看的那一层"], ["stampfullclose", "卡面全屏底下那排的「收起」"], ["stamptheater", "卡页「✦ 小剧场」那一排"], ["stamptheaterline", "那一排里的一条线"], ["stamptheaternew", "虚线框「接着演」"], ["thrvn", "小剧场新版整页"], ["thrvnbox", "新版对话框"], ["thrvnchoice", "新版选项"], ["thrvnwrite", "新版「自己写…」"], ["thrvncompose", "新版自己写那一格"], ["thrvnsend", "新版「演」"], ["thrvnlog", "新版「记录」"], ["thrvnlogview", "新版记录那一页"], ["thrvnclassic", "新版「原版」切回"], ["thrtonew", "原版目标条右边「新版」"], ["thrvngoal", "新版标题下的目标"], ["thrvnnext", "新版「开下一幕」"], ["thrvnphoto", "新版「/生成这一轮剧照」"], ["thrvnstampcover", "新版「当邮票封面」"], ["thrlinesrc", "小剧场记录顶上「全部 / 从邮票 / 自己开的」"], ["thrlinecard", "从邮票开的线标题旁的小邮票角标"], ["thrvnvoice", "新版「语音」"], ["thrvnauto", "新版「自动」"], ["thrvnlogline", "新版记录里的一句（长按分支）"], ["thrvnbranch", "新版「从这一拍分支」那一层"], ["thrvnbranchgo", "「从这一拍分支」"], ["stamptheaterquote", "卡页小剧场那排谢幕卡上的那句话"], ["stampmeltbtn", "册子右上角「融卡」"], ["stampmeltpick", "熔卡时挑中的那枚上的勾"], ["stampmeltbar", "熔卡时底下那一条"], ["stampmeltgo", "「熔掉」"], ["stampchartime", "卡池设置里角色池「时间」那一排"], ["stampthemelib", "角色池主题库那一排"], ["stampthemesave", "「＋ 存下这个主题」"], ["stampthemeedit", "主题库里的 ✎"], ["stampthemeeditbox", "主题库改主题那一块"], ["stampvideo", "SSR 卡页「让卡面动起来」"], ["stampvideoerr", "卡面动起来没成功的那行红字"], ["stampchartimetext", "角色池「自己写」时间那一格"], ["stampstoryskip", "SSR 剧情顶上「跳过」（翻到下一个选项）"], ["stampbdletter", "聊天里那封生日信（data-got=1 领过了）"], ["stampletter", "聊天里那封「今天的信」（data-got=1 领过了）"], ["stampshare", "聊天里那枚邮票小卡（从邮票册「发给他看」的；data-rarity）"], ["shikesharego", "时刻小卡右下「去时刻里看 ›」"],
        // 番茄钟收桌后 TA 放进私聊的那张小卡（群里 2026-10-05）
        ["pomoshare", "聊天里那张「一起专注」小卡（番茄钟收桌后 TA 发来的；data-done=\"1\" 是坐满了）"],
        // 拉黑提示条和解除申请卡（她 2026-10-03：「拉黑的提示搞点挂点」）
        ["blockbar", "拉黑时顶上那条提示（data-who＝me 她拉黑了TA／them TA拉黑了她）"], ["unblockdraft", "点感叹号后输入栏上面那块「求解除」草稿框"], ["blockbaricon", "提示条左边那个禁止圈"],
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
        ["offline", "线下整页（最外那层）"], ["offbody", "线下正文滚动区"], ["rerollpress","「重写」那一下（长按菜单那一行、线下卡片的 ↻）：点一下照常重写，长按给方向"],["offnarrpill","线下输入框旁「旁白 ✕」（正在写旁白）"],["offnarrbtn","线下幕后面板「切到旁白」"],["offcomposer", "线下底部输入栏"], ["offreadpin", "往期线下记录顶上「收进时刻」那一颗（点了进挑选）"],
        ["offmsg", "线下一段（data-me=\"1\" 是她写的）"], ["offcard", "线下那张卡片本体"], ["offhead", "卡片顶上那行（头像·名字·时间）"],
        ["offname", "卡片上的名字"], ["offtext", "线下正文"], ["offfontsize", "线下设置里「正文字号」那一格"], ["offsay", "正文里引号那几句台词"], ["offthought", "线下的心声那块"], ["offcastfaces", "群线下整段小说那一拍左上角叠着的头像，点开选看谁的心声"], ["offcastpick", "选看谁的心声那一排；里面每个按钮 data-on=1 是选中的"], ["goffwritemode", "群线下设置「写法」两个按钮；data-on=1 是当前选中"],
        ["offnarr", "线下旁白（data-short=\"1\" 是居中那种短的）"],
        // 通话
        ["call", "通话整页（data-video=\"1\" 是视频）"], ["callhead", "通话顶上那块"], ["calltitle", "通话标题（名字）"],
        ["callavatar", "通话中间的大头像"], ["callcamera", "用户真实摄像头小窗与开关/前后镜头切换"], ["callbody", "通话字幕滚动区"], ["callmsg", "通话里一句（带 data-me）"],
        ["lorescopemore", "世界书编辑「每一枚章具体去哪儿」那颗"], ["lorescopefull", "展开后那一块全名单"], ["lorefolder", "世界书按文件夹那一夹"], ["lorefoldall", "世界书按文件夹那页的「全部展开／全部收起」"], ["lorefoldersort", "按文件夹那页的「排顺序／排好了」（data-on）"], ["lorefoldermove", "排顺序时文件夹抬头上的上移／下移（data-part＝up|down）"], ["lorefolderswitch", "世界书整夹开关"], ["loresel", "世界书多选时每条右边的勾"], ["loreselbar", "世界书多选时底下那条操作栏"], ["loreselbtn", "世界书多选操作栏里的键"], ["loremove", "世界书「放进哪个文件夹」那张单子"], ["lorefolderfield", "世界书编辑页里「文件夹」那一格"], ["chatlore", "聊天设置里「世界书 · TA 用哪几条」"], ["chatlorefolder", "聊天设置世界书里的一夹"], ["chatloreitem", "聊天设置世界书里的一条"], ["offreplyopts", "线下最后一拍底下那几条「你可以这样接」整块"], ["offreplyopt", "其中一条回应选项（点了直接发）"], ["forumfans", "论坛「编辑我的贴吧资料」里大号粉丝数那一格"], ["callbubble", "通话里那句的气泡"], ["callact", "通话里的动作那行"], ["halfwin", "半窗聊天整块（底下那半屏）"], ["gsetpage", "群聊设置那一整页"], ["gnoticebar", "群聊顶上那条群公告"], ["gnotice", "群聊设置里写群公告那一栏"], ["gnoticeclear", "群公告「撤掉」"], ["gnoticepost", "群公告「发布」"], ["studiothemes", "照相馆「题材」那一排"], ["studiorestyle", "照相馆大图下「换画风」那一排"],  ["studiostyleadd", "换画风那排最后「＋自己写」"], ["studiomystyles","照相馆自己的画风列表（点名改、✕删）"],["studiostyleroll","「让 AI 想几种」画风那颗键"],["studiothemeroll","照相馆「让 AI 想几个题材」和它想出来的那几条"],["studiostyledesc","自己写画风那里的描述/关键词框"],["studiostyleedit", "写自定义画风的那一行"], ["studiopolaroid", "照相馆「拍立得」那颗；data-on=1 点亮"], ["polaroiddev", "拍立得还在显影时那张灰白相纸"], ["emocaptionpack", "表情包页里「给这一组每张底下印上名字」那颗"], ["studioretext", "照相馆换画风底下「重画后把封面上的字照原样印回去」那一格；data-on=1 勾上"], ["studioexpand", "照相馆「让他先把这一句写成画面」那一格；data-on=1 勾上"], ["studiomodes", "照相馆「单张／四宫格／拍立得」那一条三选一"], ["studiosingle", "那一条里「单张」那格；data-on=1 选中"], ["emosetcaption", "画表情包前那一格「每张底下印上它的名字」；data-on=1 勾上"], ["emomakeset", "表情包页顶上「让 TA 画一套自己的表情包」那一块"], ["studiopaint", "照相馆拍之前挑画风的那一排（横着划；第一个「照片」＝不换）；按钮 data-on=1 是选中的"], ["studiokinds", "照相馆墙上那排分类（全部／合照／四宫格／题材／画风／漫画）；data-on=1 是选中的"], ["studiostack", "照相馆大图里左右划的那一摞"], ["studiostackbadge", "照相馆墙上一摞右上角的张数"], ["studiothemeadd", "照相馆题材那排最后「＋自己写」"], ["studiothemeedit", "写自定义题材那一小块"], ["selcomic", "聊天多选栏里「画成漫画」那颗"], ["ficmemask", "同人文「生成」里「这篇的「我」用哪张面具」那一行"], ["homewidgethide", "主屏组件样式面板里「从桌面移走」那颗"], ["homewidgetback", "「做一件装饰」里把移走的组件放回来的那一格"], ["ficnocp", "同人文生成里「无 CP」那一格；data-on=1 选中"], ["pcontactface", "查手机微信里联系人资料页那个头像（点了换图）"], ["offtitle", "线下顶栏中间的名字（一行，长了省略）"], ["offcardacts", "线下卡片右上那排键"], ["offcardmore", "那排键最后的「⋯」；data-on=1 摊开着"], ["ficoneshot", "同人文生成里「写成完结短篇」那一格；data-on=1 选中"], ["studiofailed", "照相馆墙上「没拍成」那一摞"], ["studiofailcard", "其中一张没拍成的卡"], ["momdescedit", "朋友圈大图下「改画面描述再画」"], ["offautoshot", "线下设置里「他会自己拍照」开关；data-on=1 开着"], ["descedit", "论坛等图片下「改画面描述再画」"], ["palbumedit", "查手机相册大图下「改画面描述再画」"], ["palbumdrawhint", "查手机相册大图下「要画先收藏」那行小字（没收藏的照片才有）"], ["photodiaryedit", "照片日记底下「改画面描述再拍」"], ["diaryzh", "日记里外语那一段连着它底下的中文"], ["wxsharecardfrom", "天气页底下「天气卡按哪边发」那两颗；data-on=1 选中"], ["worldwxfollow", "天气页底下「架空世界的天气跟着现实城市」那一块"], ["setcatalog", "聊天设置（和群设置）首页那一列卡"], ["setcard", "其中一张卡（data-key＝哪一页，如 temper／motion）"], ["patsiggen", "聊天设置「拍一拍签名」右边那颗「让他起」"], ["setcardicon", "卡左边那个带字的小方块"], ["setcardtitle", "卡上的标题"], ["setcardsub", "卡上标题下那行小字"], ["setnote", "那一列底下的说明小卡"], ["setsection", "点进一页后里面一块块折叠卡；data-on=1 摊开着"], ["setsectionhead", "折叠卡顶上那一行（标题＋箭头）"], ["setsectionbody", "折叠卡摊开后的内容"], ["statetplcard", "心声卡换成自己写的 HTML 后，装那张卡的外框"], ["statetpledit", "聊天设置「衣」里「心声卡 · 自己写样子和栏目」那一块"], ["statetplhtml", "写心声卡 HTML 的那个框"], ["statetplfield", "自己加的一栏（栏名＋说明）"], ["statetpladd", "「＋ 加一栏」"], ["statetplglobal", "「把这一套存成全局」"], ["ficmove", "同人文长按一篇弹出来的挪位置那一层"], ["ficmovebtn", "那一层里「移到最上面／往上／往下」（data-part＝top/up/down）"], ["icontray", "主题工作台图标页上「认不出是哪个 App」那一排待分配的图"], ["csshookgroup", "写 CSS 那一格下面挂点的一组（每一页都有／这一页专有），点标题展开收起；data-open=1 是开着"], ["wallpreview", "换壁纸／聊天背景／线下场景图／查手机壁纸前那一整屏预览；data-part＝home/chat/offline/phonelock/phonehome"], ["studyplanform", "一起学·学习计划：没排时那张表"], ["studyplanoff", "表里「哪几天不排」的星期按钮（data-on＝选中）"], ["studyplanhead", "排好后顶上那块（进度、老师那句话、到点问我）"], ["studyplanask", "「跟老师说怎么改」那块"], ["studyplandays", "每天那一列"], ["studyplanday", "其中一天（data-on＝今天）"], ["studyplanmark", "打卡按钮（学完了／学了一半／没学）"], ["shuastat", "片刻「我」页上的作品／获赞／粉丝那三格（data-part＝works/likes/fans，后两格点了能改）"], ["gamestorymark", "故事接龙里每人那一段末尾的小号（跟底下「1 · 某某」对应）"], ["npcmoments", "配角详情页里「自己发朋友圈」那一块"], ["npcmomentson", "那一块右边的开关"], ["mediafill", "云同步里「把本机所有图片补传到云上」那颗按钮"], ["cloudsetup", "云同步登录后那块折起来的「建表内容」"], ["cloudsetupcopy", "那块里「复制建表内容」"], ["wheelfull", "全屏命运转盘整页"], ["wheeltitle", "全屏转盘顶上的主题名"], ["wheeldisc", "全屏转盘那张盘（外框，点它开转）"], ["wheelslice", "盘上每一块扇面（data-i＝第几块，从 0 数）；整套换色也可以直接设 --wheel-c1 到 --wheel-c8"], ["wheelhub", "盘正中那颗轴"], ["wheelneedle", "盘顶上那根指针"], ["wheelresult", "转完显示结果那一块"], ["wheelpalette", "编辑转盘里「扇面颜色」那一块"], ["wheelpal", "其中一个配色选项（data-on＝选中）"], ["fontscale", "主题工作台「字体」里「字号」那一格（只放大字，头像间距不动）"], ["themefit", "主题工作台「全 App 多大」上面那颗「一键适配我的手机」（别人在另一种宽度的手机上做的美化才出现）"], ["icontrayimg", "那一排里的一张；data-on=1 选中"], ["icontrayorder", "「照列表顺序排上去」"], ["iconslot", "图标列表里每个 App 那一格；data-on=1 正等着放图"], ["studyreroll", "一起学底下那颗「↻ 重说」（只在老师刚说完那一轮出现）"], ["curselfstudy", "一起学课程页「开一张新课页」下面那颗「去自习室」"], ["selfnew", "自习室列表顶上「开一间新的」"], ["selfrow", "自习室列表里的一行"], ["selfchip", "开自习室时挑人、挑课的那种小按钮（data-on=1 选中）"], ["selftask", "开自习室时「这轮做什么」那一格"], ["selfstart", "开自习室那页底下「开始」"], ["selfbar", "自习室顶上那条（谁在、计时、收桌）"], ["selfclock", "自习室顶条里那个计时"], ["selfend", "自习室顶条里「收桌」"],["selfdesks", "自习室各人进度条那一块"],["selfdesk", "一个人的进度条；data-me=1 是我自己（点一下推 25%），data-done=1 做完了"], ["selflog", "自习室中间那一列说话记录"], ["selfmsg", "自习室里一句话（data-me=1 是你说的）"], ["selfsummary", "收桌以后那张自习小结"], ["selfphoto", "自习室输入栏左边「＋」发照片"], ["selfinput", "自习室的输入框"], ["selfsend", "自习室的发送键"], ["closetmasks", "我的衣柜顶上挑面具那一排（按钮 data-on=1 是正在看的那张）"], ["closetsetmasks", "我的衣柜每身底下「也挂在」那排面具（按钮 data-on=1 是那张面具也挂着）"], ["calmaskcopy", "日历·复制别的面具日程"], ["calmaskcopyrange", "日历·复制别的面具日程"], ["calmaskcopybtn", "日历·复制别的面具日程"], ["emouncaptionpack", "表情包·撤掉印上的名字"], ["tiesnpcdraft", "关系·配角·照我的人设写草稿"], ["classimport", "日历·导入课表"], ["classimportmode", "日历·导入课表"], ["classimportgo", "日历·导入课表"], ["classimportrow", "日历·导入课表"], ["classimportsave", "日历·导入课表"], ["pdelfriend", "查手机·微信删好友"], ["pblockfriend", "查手机·微信单独拉黑这个联系人（data-on=1 已拉黑）"], ["pdelnote", "查手机·微信删好友"], ["pdissolve", "查手机·微信解散群"], ["forumfanlist", "论坛·我的粉丝里的角色"], ["zyshare", "照影"], ["zywatch", "照影观看页"], ["imgshape", "秋秋小球／模型浮窗自己的图：形状那一排（自动／裁成圆／原样）"], ["gamewithproc", "小游戏终局「连这局的过程一起」那个勾"], ["zygrouprow", "照影群卡里一个人那一行（点开看他的回放）"], ["shuasearch", "片刻刷新页的搜索框那一行"], ["shuasearchchip", "片刻首页搜过的词那颗（点了放开）"], ["shuasearchbtn", "片刻首页顶上那颗搜索（🔍）"], ["voicewave", "语音条里那排波浪（只藏它：[data-wk=voicewave]{display:none}，时长不跟着没）"], ["voicetime", "语音条里的时长数字"], ["rpopen", "群红包点开后那张单子"], ["rpfoot", "红包底下那行小字（领取红包、已被领完、你领了多少、等他拆开）"], ["rpmsg", "红包上的祝福语"], ["rpseal", "红包上那枚金印"], ["rpflap", "红包上半截的封口"], ["rpcorner", "红包右下角那个折角"], ["rponly", "群红包上「只给某某」那枚小标签"], ["rpcard", "红包整张，群红包和私聊红包都是这一张（底色是写在行内的渐变，改要带 !important）；data-status＝open 还能领／done 领过、领完或退了／locked 不是给你的；data-scope＝group 群里／single 私聊"], ["studiosize", "照相馆「尺寸」那一排（跟设置／竖／方／横；data-on 选中的那颗）"], ["slswitches", "文风台：导入的预设整列开关那一块"], ["slswitch", "文风台：其中一块（data-on 开着＝1）"], ["qqmem", "秋秋设置页「记着的」那一块"], ["qqmemrow", "里面的一条"], ["foxhstag", "小红书笔记正文里的 #话题（点了去搜）"], ["foxhsrelated", "笔记评论下面「相关推荐」那一块"], ["foxhsalbums", "小红书主页「收藏」上面那排专辑"], ["foxhsalbumpick", "收藏时问放进哪个专辑的那张"], ["askphotokind", "聊天＋照片「叫 TA 拍」那一排：自拍／拍他／合照"], ["fwdimg", "点开的聊天记录卡里那一张照片"], ["chatjumpprev", "聊天右下角「上一条」"], ["chatjumpnext", "聊天右下角「下一条」"], ["grouproles", "群主和管理员那排选择"], ["gnamer", "建群时让谁起群名那一行"], ["gmuterow", "群设置里禁言的那一行"], ["grole", "群聊名字旁的群主、管理员、禁言小牌子"], ["gtitle", "群聊名字旁的专属头衔小牌子"], ["gtitles", "群设置里专属头衔那一块"], ["gtitlerow", "群设置里每个人头衔那一行"], ["gluckybadge", "群聊顶栏群名旁的幸运字符小牌"], ["glucky", "群设置里群幸运字符那一块"], ["gluckychar", "群幸运字符的每一个字（data-on=1 点亮了）"], ["gluckycard", "抽字符时那 6 张背面朝上的卡（重选时翻过的 data-part=used）"], ["gluckyagain", "「不喜欢这张，从剩下的再翻一张」"], ["gluckybadgeset", "幸运字符「挂在名字旁边」那一行"], ["npcgender", "配角资料页「性别」那一块（按钮 data-on）"], ["npcowner", "配角资料页「在谁身边」那一块（按钮 data-on）"], ["gluckydraw", "「抽一张」那颗键"], ["gluckybook", "群幸运字符收藏本"], ["selbar", "聊天多选那一整栏（两行）"], ["selactions", "多选栏下面那一行动作按钮"], ["selrecall", "聊天多选栏里「撤回」那颗（只勾了自己发的才亮）"], ["modelfloatimg", "API 设置里「模型快速切换浮窗」底下换图那一行"], ["apistream", "API 设置里「流式」那一排（自动／关掉；按钮 data-on=1 选中）"], ["apistreamlearned", "那一排底下「这个模型上次流式被拒了」那一行（带重新试的键）"], ["studiogrid", "照相馆「四宫格」那颗；data-on=1 点亮"], ["gridcells", "四宫格／照片日记底下切开的那排小格"], ["gridcellzoom", "点一格放大后那一层"], ["photodiarydel", "照片日记底下那颗「删掉这张照片」"], ["photodiary", "日记页最底下的照片日记那一块"], ["fonewallread", "论坛「新帖在这里」底下那颗「全部标为已读」"], ["doodlebtn", "TA的照片点开后那颗「在上面画，发回去」"], ["doodle", "在照片上画的那一整页（黑底）"], ["doodletools", "画画页底下的颜色和笔、撤销、清空那一栏"], ["doodlemode", "画画页顶上「画 / 贴 / 抠」三颗；data-on=1 是现在那一档"], ["doodleask", "「圈出来问他」那颗"], ["doodleownstamp", "画画页「贴」那一档里「自己写」的输入框"], ["doodlecutname", "画画页「抠」那一档里「这张叫什么」的输入框"], ["doodlecutcap", "画画页「抠」那一档里「图上写的字」的输入框"], ["doodlecolor", "画画页颜色那排最后「自己调色」那颗"], ["ptransfer", "查手机微信里「拿他手机转账」展开的那一小块（金额、留言、转给谁）"], ["pplus", "查手机微信输入框左边「＋」展开的那一排"], ["pplusitem", "那一排里的一格（data-part＝tf 转账 / shop 购物 / takeout 外卖）"], ["neteasecookiehelp", "一起听设置里「Cookie 去哪儿拿？」那一折"], ["neteasehelp", "一起听设置里「没有接口？自己搭一个」那块网易云接口教程"], ["pcard", "查手机微信里的小卡（红包、礼物、照片、分享……；data-label＝卡名）"], ["pphoto", "查手机微信里的照片"], ["pvoice", "查手机微信里的语音条"], ["ptfcard", "查手机微信里的转账卡（data-status＝pending/accepted/returned）"], ["ptfbtn", "转账卡底下「退回 / 替TA收下」（data-part＝no/ok）"], ["asphonestrip", "拿他手机逛购物／点外卖时顶上那条黄条「正在用X的手机」"], ["asfaces", "替TA发消息时挑换谁那一排头像"], ["asface", "那一排里的一个头像（data-on=1 选中）"], ["drawerforward","抽屉里拆开那一张底下的「发给他」"], ["drawerdrawing", "抽屉里「TA画的」拆开后那张画"], ["fishrelay", "语音 API 里 Fish 那格底下「自己搭一个中转」的折叠说明"], ["msgmenu", "长按消息弹出的那一层（暗底＋菜单）"], ["photofailerr", "照片没拍成那张卡上的「原因：」一行"], ["momnews", "朋友圈顶上「N 条新消息」那一块"], ["momnewsbadge", "底栏朋友圈图标上的红色数字"], ["momnewsrow", "新消息列表里的一行"], ["momnewsclear", "新消息底下「都看过了」"], ["chatjump", "聊天往上翻时右下角那组箭头"], ["chatjumptop", "跳到最早那颗"], ["chatjumpbottom", "回到最新那颗"], ["readnarr", "一起读那排「TA 念 / 停下」（data-on=1 正在念）"], ["readpara", "一起读正文的一段（data-reading=1 是正在念的那段）"], ["readnarrstop", "设定里「TA 念：一直往下念／念完这页就停」"], ["readselread", "选中一句后的「念这句」"], ["readfont", "一起读「设定」里正文字体那一格（书宋／系统）"], ["geoplaces", "发位置那页「钉过的地方、他那个世界里的地点」那一排"], ["geomoveme", "发位置那页「把我的位置也改到这儿」；data-on=1 勾上"], ["autotts", "聊天设置里「新消息自动念」那一格"], ["ownclock", "聊天设置里「TA 自己一只钟」那一格"], ["gmyavatar", "群设置里「我在这个群里的头像」那一格"], ["gmaskpick", "群设置里「我在这个群用哪张面具」那一格；按钮 data-on=1 是选中的那张"], ["halfwinbar", "半窗顶上「放大 / 收起」那一条"], ["halfwinsize", "半窗顶条正中那根调大小的小横杠"], ["halfwinpill", "半窗收起后底下那颗小条"], ["calltf", "通话里转账那一行（带收下/退回）"], ["callactkey", "视频打字框左边那颗「动作」键（data-on=\"1\" 开着）"], ["callcomposer", "通话底部那一整块"], ["callbtns", "底下那一排大按键"], ["callmic", "说话键"], ["hangup", "挂断键"], ["zypage", "照影"], ["zychip", "照影"], ["zyq", "照影"], ["zyopt", "照影"], ["zywhy", "照影"], ["zyresult", "照影"], ["zyskip", "照影"], ["zygome", "照影"], ["zycompare", "照影"], ["zycomparebox", "照影"], ["zyrec", "照影"], ["zytest", "照影"], ["zycomparewho", "照影"], ["zytogroup", "照影"], ["zychange", "照影"], ["zyaskrow", "照影发卡头像行"], ["zyaskwho", "照影发卡头像"], ["zyqlist", "照影题目预览"], ["zyreplay", "照影回放按钮"], ["zycover", "照影一套题的封面"], ["zyedit", "照影出题页"], ["zyscore", "照影算不算分"], ["zygen", "照影AI出题框"], ["zyeditq", "照影编辑一题"], ["zysave", "照影存题按钮"], ["zyeditbtn", "照影改这套题"], ["zynew", "照影出一套题卡"], ["sellongshot", "多选·存成长图"],
        ["callstage", "单人视频铺满全屏的那层（TA 或你）"], ["callpip", "单人视频右上角那个小框"], ["calltypekey", "打字键"], ["calltype", "点打字才出来的那行输入框"]
      ])
    }),
    // 邮票册（2026-10-26）：抽卡、图鉴、一张卡、剧情对话框
    Object.freeze({
      zh: "邮票册", pages: Object.freeze(["stamps"]),
      hooks: Object.freeze([["stamppage", "整页"], ["stampvideosolo", "会动的那枚邮票上「单独看」那颗"], ["stampvideosolopage", "单独看时铺满屏幕那一层（点一下退出）"], ["stampfullvid", "邮票详情里把视频放到整页的那颗"], ["stampgift", "收到上线礼那一块"], ["stampcountdown", "限时池的倒计时"], ["stamppullbtn", "寄一封、寄一版两颗键（data-part=one/ten）"], ["stampalbum", "邮票册图鉴那一格"], ["stampitem", "一枚邮票（data-rarity=R/SR/SSR，data-back=1 是背面）"], ["stamppull", "抽卡那一层"], ["stampenvelope", "掉下来的那个信封"], ["stampcard", "一张卡打开的那页"], ["stampbox", "卡页里一块一块的框"], ["stampdraw", "画卡面那颗键"], ["stampstoryopen", "进入剧情那颗键"], ["stampstory", "剧情那一层"], ["stampstorybox", "剧情对话框"], ["stampstorywho", "对话框上说话人的名字"], ["stampstorychoice", "剧情选项（data-locked=1 是还没解锁）"], ["stampbanner", "卡池那张大海报（data-pool）"], ["stampbannertitle", "海报上的大标题"], ["stampbannerhook", "海报标题下那句钩子"], ["stamplevel", "卡页盖印升级那两颗键"], ["stampshow", "卡页上面卡那一块"], ["stampblank", "还没画卡面时卡上那层（等着显影）"], ["stampbadge", "卡上的稀有度章"], ["stamppostmark", "卡旁边的邮戳（日期、第几枚）"], ["stampstars", "卡下面的星"], ["stampgrow", "盖印养成那块面板"], ["stampcorridor", "时刻回廊那一排"], ["stampnode", "回廊里一格（data-locked=1 没解锁，data-on=1 正看着）"], ["stampsend", "「发给他看」"], ["stampcanon", "「当真」"], ["stampkeep", "「收进时刻」"], ["stampdupe", "抽到重复限定 SSR 那枚下面的「重复 · 印泥」"], ["stamprewriteall", "册子页「没写好的一起重写」"], ["stampalt", "满级 SSR 第二张卡面那几颗键"], ["stamppoke", "满级 SSR 能戳的那层"], ["stamppokesay", "戳了以后他冒出来的那句"], ["stampstorybg", "剧情右上角换背景那颗"], ["stampstoryvoice", "剧情顶上「语音」开关"], ["stampstoryauto", "剧情顶上「自动」开关"], ["stampstorysay", "对话框里他那句旁边的喇叭"], ["stampstorychoices", "屏幕中间放选项的那一块"], ["stamppokevoice", "戳一戳那句旁边的喇叭"], ["stamplinesay", "卡上台词旁边的喇叭"], ["stampstorynext", "剧情框右下角「点一下继续」"], ["stampstorysecret", "通往秘径的选项前那颗 ✦"], ["stamppokeredo", "全屏里「这一面换一批话」"], ["stampsaveimg", "全屏卡面「保存原图」"], ["stamplimitnote", "限时池、生日池保底下面那行「每人一张限定 SSR」"], ["stampwho", "抽卡撕开后、册子「全部」里邮票下面那行名字"], ["stamptrans", "剧情和卡里外语那句旁边的「译」"], ["stampzh", "外语下面那行中文"], ["stampstarsmini", "册子里每枚下面的小星"], ["stampdrawerr", "卡面没画成时那行原因"], ["stampfilter", "册子页「人／稀有度／主题」那三个下拉（data-part）"], ["stampfilterpanel", "下拉弹出的那一小块"], ["stampbdticket", "你的生日池里那张生日券"], ["stampfull", "全屏看卡面那一层"], ["stamproute", "SSR 卡页「路线」那块"], ["stamproutenode", "路线里一节（data-seen=1 走过）"], ["stampends", "结局章那一行"], ["stamphisview", "「换他的视角重读」"], ["stampweekbtn", "册子页「翻他的一周」"], ["stampweek", "「他的一周」那一页"], ["stampdaypick", "R 卡页「就它当那天的一刻」"], ["stampweekday", "「他的一周」里的一天"], ["stampweeksheet", "「他的一周」底下那页集邮页"], ["stampweekmark", "集邮页贴满后那枚周纪念邮戳"], ["stampweekmore", "「他的一周」那一天「这天还有几张」"], ["stampweekswap", "「换它当这天的一刻」"], ["stampweekpick", "「他的一周」换第几周那排"], ["stamprewrite", "卡页「重写这张卡」"], ["stampredraw", "卡页「照原来的描述重画」"], ["stamppeople", "卡池设置里挑人那一格格头像（data-on=1 勾上了）"], ["stamppity", "生日池保底进度那一条"], ["stampbeg", "生日池「去跟他求个情」"], ["stampbegline", "求情后他回的那句"], ["stampenvfrom", "信封上「来自谁」"], ["stampsender", "没撕开的邮票底下「某某来信」"], ["stamprail", "左边一列换池的小邮票"], ["stamprailitem", "其中一枚（data-on=1 是选中的）"], ["stampwallet", "右上角邮资、印泥、十连券那几颗"], ["stamppullbar", "底下两颗大键那一条"], ["stampcharpick", "角色池换人那一排头像"], ["stampgoalbum", "右上角「册子」"], ["stampgocfg", "右上角「⋯」"], ["stampcfg", "卡池设置那一页"], ["stampalbumpage", "邮票册图鉴那一页"], ["stamprules", "卡池设置里规则那几块（三档卡、概率与保底、价钱）"]])
    }),
    // 照影（她 2026-10-22「这页的美化顺便做了」）：整页、分类圆镜、每套封面、答题卡、结果和评语
    Object.freeze({
      zh: "照影", pages: Object.freeze(["zhaoying"]),
      hooks: Object.freeze([["zypage", "照影"], ["zychip", "照影"], ["zyq", "照影"], ["zyopt", "照影"], ["zywhy", "照影"], ["zyresult", "照影"], ["zyskip", "照影"], ["zygome", "照影"], ["zycompare", "照影"], ["zycomparebox", "照影"], ["zyrec", "照影"], ["zytest", "照影"], ["zycomparewho", "照影"], ["zytogroup", "照影"], ["zychange", "照影"], ["zyaskrow", "照影发卡头像行"], ["zyaskwho", "照影发卡头像"], ["zyqlist", "照影题目预览"], ["zyreplay", "照影回放按钮"], ["zycover", "照影一套题的封面"], ["zyedit", "照影出题页"], ["zyscore", "照影算不算分"], ["zygen", "照影AI出题框"], ["zyeditq", "照影编辑一题"], ["zysave", "照影存题按钮"], ["zyeditbtn", "照影改这套题"], ["zynew", "照影出一套题卡"], ["zyscene", "照影「这一次假设」那一块"], ["zyscenechip", "照影处境选项"], ["zyscenetag", "照影记录上的处境小签"], ["zyscenediff", "照影换处境那次跟平时的对照"], ["zyrecacts", "照影一次记录下面那排按钮（存成图／收进时刻／发给他看）"], ["zysendmine", "照影做完他出的题后「发给他看我的答案」"], ["zygrouprun", "照影「让一个群一起做」那一块"], ["zygroupbtn", "照影群按钮"], ["zyspread", "照影「大家怎么选」"], ["zyby", "照影封面上「某某给你出的」"], ["zychargen", "照影首页「让他给你出一套」"], ["zyreview", "照影结果下面那段评语"], ["zycats", "照影首页那排分类小圆镜"], ["zycat", "照影一面分类圆镜；data-on=1 是选中的"], ["zyeditcat", "照影出题页「放进哪一类」"], ["zybyhint", "他出的题封面下那句「谁都能做」"], ["zyknock", "看他做题时「敲一敲」弹出的说话条"], ["zytalk", "敲一敲时在那题下面留着的对话"], ["zyrev", "做完回头改了哪题"], ["zybidbars", "拍卖会「钱都花在哪」那几条"], ["zyguess", "押中没押中那一行"], ["zyguesspick", "发出去前「先押一个」"], ["zybadges", "他的徽章那一排；data-on=1 是拿到了"], ["zybadgeline", "徽章收起时那一行（几个/拿到的那几枚）"], ["zybidleft", "看他拍卖时顶上「手里还剩」"], ["zybidme", "自己做拍卖那一页（加减出价）"], ["zyscale", "滑杆题那根杆子"], ["zyfill", "填空题他填的那张纸条"], ["zypic", "看图选的一块颜色；data-on=1 是选中的"], ["zylie", "说谎题猜和揭晓那一块"], ["zylieq", "猜谎时题号那颗按钮"], ["zylietoggle", "发出去前「让他偷偷撒一题谎」"], ["zynote", "做完他出的题后想跟他说的那句"], ["zydraft", "上次做到一半的提示"], ["zykind", "出题页「题型」那排小卷子；data-on=1 是挑中的"], ["zyedititems", "出题页名次表／拍品单／对阵表"], ["zypaper", "出题页那张卷面（装订线、卷头、题目）"], ["zygenmode", "「让他出一套」写给我的／大家都能做"], ["zysendbox", "自己做完「发给谁看」那一块"], ["zyliewhy", "说谎题揭晓后「他说」那一句"], ["zyreact", "结果下面「他看完说」那一句"], ["zycomparebar", "对一对里滑杆／拍卖并排那两条"], ["zygrouplie", "群里一起做「每人偷偷撒一题谎」"], ["zystar", "打分题那五颗星"], ["zylink", "连线题那一格填的人"], ["zybalance", "出题页「配得平不平」那一行"], ["zybait", "钓鱼题做完揭开的「其实」"], ["zyrecent", "照影首页「最近做过」那一条"], ["zyrecentcard", "「最近做过」里的一张小卡"], ["zyauthors", "「自己出的」下面那排出题人"], ["zyrecentfold", "「最近做过」标题那行（点了收起／展开）"]])
    }),
    // 星测（v74.732）：整页是一片夜空，挂点都在这一页
    Object.freeze({
      zh: "星测", pages: Object.freeze(["astro"]),
      hooks: Object.freeze([["astropage", "星测整页最外层（改星测的背景改这里）"],
        ["astrotabs", "顶上那条星座连线（今日／配对／星盘／群榜／问星）"], ["astrowheel", "星盘页那张圆盘"], ["astroyear", "星盘页「这一年」（太阳回归）"], ["astrogood", "配对里「星星点头的日子」"], ["astrorank", "群榜里的一行配对"], ["astroask", "问星的答案"], ["astrosky", "今日页那行天象"], ["phoneastro", "查手机里 TA 那页星测（整页）"], ["astroshare", "聊天里那张「今日签」小卡"], ["astromoon", "今日页「月亮日记」"], ["astrohalo", "星星点头那天的星光：现在不套壳了，顶栏头像自己带 data-halo=\"1\"，想改那圈光就写 [data-halo=\"1\"]（只用 box-shadow，别动尺寸位置）"], ["astrocard", "每一块卡片"],
        ["astrolucky", "幸运色那一格"], ["astrosyn", "配对里「合盘」那一段"], ["astrosign", "配对里「星座配对」那一段"], ["astroshuku", "配对里「星宿关系」那一段"],
        ["astronote", "TA看完说的那段话"]
      ])
    }),
    // 健康（v74.732）：坐标纸底、心电图 tab
    Object.freeze({
      zh: "健康", pages: Object.freeze(["health"]),
      hooks: Object.freeze([["healthpage", "健康各个子页的最外层；data-part 区分哪一页"],
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
        ["icon", "app 图标那一格（文件夹也是）"], ["iconlabel", "图标底下那行字"], ["folderbadge", "文件夹盖子右上角的数字（里面哪个 app 有新的，加起来）"],
        ["dock", "底部 dock 那一条"],
        ["shikeotd", "主屏上那张「去年今天」小卡（时刻）"],
        ["bdaycard", "主屏顶上那张生日提醒卡（角色生日前一天和当天）"],
        ["widget", "组件卡那一格（天气、音乐、木鱼这些）"], ["decor", "装饰那一格"], ["decorcode", "装饰「自己写」画出来的那个小窗（贴进去的 HTML 在里面跑）"], ["decorcodeimgs", "「自己写」里自己传的那排图"],
        ["homeclock", "顶上时钟那一块"], ["homeclockink", "时钟的数字"], ["homedate", "时钟底下那行日期"],
        ["pager", "页码点那一行"], ["pagerarrow", "主屏整理页面时左右那两颗翻页箭头；data-part＝prev/next"], ["pagerdot", "单个页码点（data-on=\"1\" 是当前页）"],
        // 组件里面（她 2026-10-08：「具体组件也要挂点」）：一套共用的名字，哪个组件用 [data-wk="widget"][data-appkey="w_music"] 这样圈
        ["wtitle", "组件里的标题／大字（月份、温度、歌名、备忘录、名字、功德数）"], ["wsub", "次要小字（年份、天气描述、地点、歌手、签名、说明；data-part 区分）"],
        ["wlabel", "小眉标（本月支出、最近提醒、正在播放、功德、单位字、标签行）"], ["wnum", "醒目的数字或金额（支出、在一起天数、统计数、连击、倒数日）"],
        ["wrow", "组件里列表的一行（备忘条目 data-late=\"1\" 是逾期）"], ["wcell", "日历组件里的一个日子格（data-today=\"1\" 是今天）"], ["wdow", "日历组件顶上的星期格"],
        ["wbtn", "组件里的按钮（data-part＝prev/next/play/muyu）"], ["calllivest", "通话里开麦时的那行识别状态／报错（data-on＝1 正在听）"], ["sttapi", "设置·语音识别那一页整块"], ["sttprefer", "设置·语音识别：「优先用这个」勾选"], ["wxshare", "天气页底下「让他们知道我这边的天气」整块"], ["wxshareon", "那块里的总开关（data-on＝1 开着）"], ["wxsharenudge", "「会主动提醒」开关"], ["wxsharewho", "谁知道：一个人的小签（data-on＝1 勾上了）"], ["wicon", "组件里的装饰图标、唱片、头像、转盘、照片（data-part 区分）"],
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
  // ── 只放大字（她 2026-10-20：「为什么不能单独改字体」）──────────────
  //   字号是内联 px，样式表压不住；接上 fsz() 的那几页把字写成 calc(Npx * var(--app-fs))，
  //   这一个变量就能只调字、不动头像和间距。没接上的页面照旧不变（一页一页接，先线上聊天）。
  const FS_MIN = 0.85, FS_MAX = 1.5;
  const cleanFontScale = v => { const n = Math.round(Number(v) * 100) / 100; return isFinite(n) && n >= FS_MIN && n <= FS_MAX ? n : 1; };
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
  const fresh = () => ({ version: 1, name: "我的主题", icons: {}, iconPack: "", iconBare: false, fonts: { body: "", display: "" }, customFonts: [], globalCSS: "", pageCSS: {}, pageTokens: {}, pageZoom: {}, fontScale: 1, updatedAt: 0 });
  const normalize = raw => {
    const x = raw && typeof raw === "object" ? raw : {};
    const iconPack = ICON_PACKS[x.iconPack] ? String(x.iconPack) : "";
    const pageTokens = {};
    Object.keys(x.pageTokens || {}).forEach(k => { const c = cleanTokens(x.pageTokens[k]); if (Object.keys(c).length) pageTokens[k] = c; });
    const pageZoom = cleanZoom(x.pageZoom);
    const fontScale = cleanFontScale(x.fontScale);
    // 字体那两支照 FontChoice 洗（认不出的落回默认）；它没加载出来就当没挑过。
    // ⚠️顺序要紧：先把她自己传的那几支洗干净，再拿【洗完的名单】去认那两支——
    //   反过来的话，删掉一支自定义字体之后，变量还指着一个不存在的字族。
    const customFonts = g.FontChoice ? g.FontChoice.customList(x.customFonts).map(f => f.custom) : [];
    const fonts = g.FontChoice ? g.FontChoice.clean(x.fonts, customFonts) : { body: "", display: "" };
    return { ...fresh(), ...x, icons: { ...(x.icons || {}) }, iconPack, iconBare: !!x.iconBare, fonts, customFonts, pageCSS: { ...(x.pageCSS || {}) }, pageTokens, pageZoom, fontScale };
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
    try { localStorage.setItem(KEY, next); }
    catch (e) { throw new Error(/quota|exceed/i.test(String((e && (e.name + e.message)) || "")) ? "手机上的小仓库满了，这一版没存进去（主题 " + Math.round(next.length / 1024) + "K）" : "没存进去：" + ((e && e.message) || e)); }
    // 存完立刻读回来对一遍（群友 2026-10-23：点了正式应用、退出再进来，新加的字没了）：
    //   对不上就当场说，不报「已应用」
    if (localStorage.getItem(KEY) !== next) throw new Error("存进去再读出来对不上，这一版没存住");
    return n;
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
  // 顶栏让开刘海（她 2026-10-18：别人的美化换到自己手机上，「顶栏不适配会飘到最上面点不了」）：
  //   做的那台手机刘海矮（或者没有），顶栏的 padding-top / top 就照它写死了 px；刘海高的手机一用，
  //   返回键就钻进状态栏底下点不到。所以只对【顶栏那几个挂点】的规则，把顶上那一格改成
  //   「原来的值，和 刘海 + 4px，取大的那个」——原来就够低的不变，不够的自动往下让。
  //   已经自己用了安全区（env / --app-safe-top）的不动；只动顶栏，别的元素一个不碰。
  // 只认真贴着屏幕顶的那几条顶栏。原来写成「名字以 head 结尾的都算」，卡片抬头、分组标题（statehead、closetgrouphead、offhead……）
  //   也被加了一截刘海留白，刘海高的手机上它们平白空出一大块（群里 2026-10-20：「刷新了一下发现做的美化不适配了」）。
  const TOP_HOOK = /\[data-wk\s*=\s*["']?(?:head|chathead|yqhead|fghead)["']?\s*\]/i;
  const SAFE_MIN = "calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + 4px)";
  const fitTopBody = (sel, body) => {
    // 只认选中的就是顶栏本身（最后一节是 head 挂点）；顶栏里面的头像、按钮写了高度不能跟着加刘海（群里 2026-10-19：顶栏头像被拉成长条）
    const isTop = String(sel).split(",").some(one => { const last = one.trim().split(/\s*[>+~]\s*|\s+/).filter(Boolean).pop() || ""; return TOP_HOOK.test(last.replace(/::?[a-z-]+(\([^)]*\))?$/i, "")); });
    if (!isTop) return body;
    const safe = v => /safe-area|--app-safe-top/i.test(v);
    // max() 里不认不带单位的 0（写成 max(0, …) 整条作废，顶栏照样钻进状态栏）——补成 0px
    const px0 = v => /^[-+]?0+(?:\.0+)?$/.test(String(v).trim()) ? "0px" : String(v).trim();
    // 这一条自己已经算了刘海（哪儿用了安全区）＝做的人照自己手机调好了，整条不动
    if (safe(body)) return body;
    let padTop = null;   // 这一条自己写的顶上留白（原值）
    const pinned = /(^|[;\s])position\s*:\s*(fixed|absolute)\b/i.test(body);
    const out = String(body)
      .replace(/(^|[;\s])(padding-top|top)\s*:\s*([^;!]+?)\s*(!important)?\s*(?=;|$)/gi, (m, pre, prop, v, imp) => {
        if (/^(auto|inherit|initial|unset)$/i.test(v.trim())) return m;
        // top 只在顶栏自己飘起来（fixed / absolute）时才是「离屏幕顶多远」；sticky、relative 的 top 是挪动量，
        //   改了会把顶栏整条往下推出一道缝
        if (/^top$/i.test(prop) && !pinned) return m;
        if (/^padding-top$/i.test(prop)) padTop = px0(v);
        return pre + prop + ": max(" + px0(v) + ", " + SAFE_MIN + ")" + (imp ? " !important" : ""); })
      .replace(/(^|[;\s])padding\s*:\s*([^;!(]+?)\s*(!important)?\s*(?=;|$)/gi, (m, pre, v, imp) => {
        const parts = v.trim().split(/\s+/); if (!parts.length || parts.length > 4) return m;
        const full = parts.length === 1 ? [parts[0], parts[0], parts[0], parts[0]] : parts.length === 2 ? [parts[0], parts[1], parts[0], parts[1]] : parts.length === 3 ? [parts[0], parts[1], parts[2], parts[1]] : parts;
        padTop = px0(full[0]); full[0] = "max(" + padTop + ", " + SAFE_MIN + ")";
        return pre + "padding: " + full.join(" ") + (imp ? " !important" : "");
      });
    // 顶栏写死了高度（群里 2026-10-19：height: 52px + box-sizing: border-box）：顶上留白被往下挪了，高度不跟着加，字就被挤回状态栏里。
    //   只补【真被挪下去的那一截】：这一条自己写了顶上留白，就补「刘海+4 比原值多出来的」——在做的那台手机上多出来的是 0，原样
    //   （群里 2026-10-20：原值本来就让开了刘海，高度又整截加了一次，「刷新了一下发现做的美化不适配了」）；
    //   没写顶上留白：留白还是 app 自己那份刘海，换哪台手机都一样，高度不补。
    if (padTop == null) return out;
    const extra = "max(0px, " + SAFE_MIN + " - " + padTop + ")";
    return out.replace(/(^|[;\s])(height|min-height)\s*:\s*(\d+(?:\.\d+)?px)\s*(!important)?\s*(?=;|$)/gi, (m, pre, prop, v, imp) =>
      pre + prop + ": calc(" + v + " + " + extra + ")" + (imp ? " !important" : ""));
  };
  // 全局 CSS 不加作用域，但顶栏那几条也要过一遍。选择器【一个字不改】（scope 传 null）：
  //   原来是整份套一层 html，选的还是同一批元素，可每条都重了一档，全局 CSS 反过来压住了各页自己写的
  //   （:root 开头的又轻了一档）——做好的美化刷新后就变了。读不懂就原样用。
  const fitTop = css => { try { return scopeCSS(css, null); } catch (_) { return css; } };
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
        const sels = scope == null ? [head] : head.split(",").map(x => x.trim()).filter(Boolean).map(sel => {
          // body 要落到真的 body 上（群里 2026-10-19：聊天页底下那一条是 body 的米色，写 body 一直刷不到——原来被换成了 html）
          if (/^body$/i.test(sel) && /^html\b/i.test(scope)) return scope + " body";
          if (/^(html|body|:root)$/i.test(sel)) return scope;
          // html 自己身上的属性（如 html[data-screen-size="short"]）要贴在 scope 那个 html 上，不是当成它下面的元素——
          //   原来一律把开头的 html 削掉，[data-screen-size] 就被当成 html 里面的某个元素，一条都不生效
          const onHtml = /^html((?:\[[^\]]+\])+)\s*(.*)$/i.exec(sel);
          if (onHtml) return scope + onHtml[1] + (onHtml[2] ? " " + onHtml[2] : "");
          return scope + " " + sel.replace(/^(html|body|:root)\s*/i, "");
        });
        out += sels.join(",") + "{" + fitTopBody(head, body) + "}";
      }
      pos = i;
    }
    return out;
  };
  // CSS 里也只保存 iv_ 门牌。真正喂给浏览器前，从图片保险箱换成当次启动的 object URL。
  const cssImageRefs = css => [...String(css || "").matchAll(/url\(\s*(['"]?)(iv_[A-Za-z0-9_-]+)\1\s*\)/g)].map(m => m[2]);
  const resolveCSSImages = css => String(css || "").replace(/url\(\s*(['"]?)(iv_[A-Za-z0-9_-]+)\1\s*\)/g, function (_, q, ref) {
    const src = typeof g.resolveImg === "function" ? g.resolveImg(ref) : "";
    // 找不到这张图：只让这一处空着（群友 2026-10-29：别人给的美化里带着【做的人自己图库】的 iv_，
    //   原来这儿一抛，整套主题全部作废——跟这张图无关的查手机、朋友圈主页也一起没了）。
    //   图库还没读完的那一下也走这里：读完 App 会再 apply 一次（app.js 那条 imgFilled），图就补上了
    if (!src) return "none";
    return 'url("' + String(src).replace(/["\\\n\r]/g, "") + '")';
  });
  // 这份主题里哪几张 iv_ 图在这台手机的图库里找不到（工作台「正式应用」时提一句；不再整套作废）
  const missingCSSImages = p => { const n = normalize(p); const all = [n.globalCSS].concat(Object.values(n.pageCSS || {})).join("\n");
    return [...new Set(cssImageRefs(all))].filter(ref => !(typeof g.resolveImg === "function" && g.resolveImg(ref))); };
  const remapCSSImages = (css, map) => String(css || "").replace(/url\(\s*(['"]?)(iv_[A-Za-z0-9_-]+)\1\s*\)/g,
    (_, q, ref) => 'url("' + (map[ref] || ref) + '")');
  const compile = p => {
    p = normalize(p); const blocks = [];
    const bad = unsafeReason(p.globalCSS); if (bad) throw new Error(bad);
    // 换字体排在最前面：它只写 :root 那两个变量，她自己写的 CSS 想盖照样盖得住。
    const fontCSS = g.FontChoice ? g.FontChoice.cssVars(p.fonts, p.customFonts, g.resolveImg) : "";
    if (fontCSS) blocks.push("/* fonts */\n" + fontCSS);
    if (p.fontScale && p.fontScale !== 1) blocks.push("/* font scale */\n:root{--app-fs:" + p.fontScale + ";}");
    if (p.globalCSS) blocks.push("/* global */\n" + fitTop(p.globalCSS));
    // zoom 连 body 自己的宽高一起缩（群友 2026-10-11：调小以后右边、底下露出一圈灰底），
    //   所以宽高先除回去：缩完正好还是一整屏，调大也不会撑出屏外。
    // 大小排在她自己写的 CSS 【前面】：她想在 CSS 里再压一道，照样压得住。
    Object.entries(cleanZoom(p.pageZoom)).forEach(([page, z]) => {
      blocks.push("/* zoom " + page + " */\n"
        + (page === "all" ? 'html:not([data-lisa-screen="home"]) body' : 'html[data-lisa-screen="' + page + '"] body') + "{zoom:" + z + ";width:calc(100vw / " + z + ");height:calc(100vh / " + z + ");}"
        // #root 自己也写着 100vh（index.html），它在缩过的 body 里面，一样要除回去，不然底下还空一截（她 2026-10-11 截图）
        // app.js 那层 [data-wk="app"] 也内联写着 height:100vh（她 2026-10-11 第二张截图：#root 补了底下还空一截），内联的要 !important 才压得住
        + (page === "all" ? 'html:not([data-lisa-screen="home"]) #root' : 'html[data-lisa-screen="' + page + '"] #root') + "{height:calc(100vh / " + z + ");}"
        + (page === "all" ? 'html:not([data-lisa-screen="home"]) [data-wk="app"]' : 'html[data-lisa-screen="' + page + '"] [data-wk="app"]') + "{height:calc(100vh / " + z + ") !important;}");
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
    { key: "bubble", zh: "聊天气泡" },
    { key: "home", zh: "主屏布局" }
  ];
  // 主屏布局（群友 2026-10-19：「导出好像是不包含自己的桌面布局的」）：图标和组件摆在哪、文件夹、
  //   组件大小／样式／外观、贴纸、装饰、对齐、藏起来的组件——主屏自己存的就这几份，原样打包、原样写回。
  //   ⚠️默认不勾（导出、导入都是）：这是她自己的桌面，勾了才带走、勾了才盖。
  const HOME_KEYS = ["x_homeLayout", "x_homeFolders", "x_homeDecorations", "x_homeWidgetAlign", "x_homeWidgetSizes",
    "x_homeWidgetStyles", "x_homeWidgetLooks", "x_homeStickers", "x_homeHiddenWidgets"];
  const PACK_OFF_BY_DEFAULT = ["home"];
  const homeSnapshot = () => {
    const out = {};
    HOME_KEYS.forEach(k => { try { const v = typeof loadJSON === "function" ? loadJSON(k, null) : null; if (v != null) out[k] = v; } catch (_) {} });
    return Object.keys(out).length ? out : null;
  };
  const homeApply = home => {
    if (!home || typeof home !== "object") return false;
    HOME_KEYS.forEach(k => { if (k in home && typeof saveJSON === "function") saveJSON(k, home[k]); });
    return true;
  };
  const PACK_KEYS = PACK_PARTS.map(x => x.key);
  // 一份包（或一份【当前草稿】，形状一样：{profile, baseTheme, wallpaper, bubbleSkin}）
  // 里这一样到底有没有东西。导出拿它决定能挑哪几样，导入拿它决定能勾哪几样。
  const packHas = (pack, key) => {
    const p = (pack && pack.profile) || {};
    if (key === "css") return !!(p.globalCSS || Object.keys(p.pageCSS || {}).length || Object.keys(p.pageTokens || {}).length || Object.keys(p.pageZoom || {}).length);
    if (key === "icons") return !!(p.iconPack || Object.keys(p.icons || {}).length);
    if (key === "fonts") return !!((p.fonts && (p.fonts.body || p.fonts.display)) || (p.customFonts || []).length || (p.fontScale && p.fontScale !== 1));
    if (key === "base") return !!(pack && pack.baseTheme);
    if (key === "wall") return typeof (pack && pack.wallpaper) === "string" && !!pack.wallpaper;
    if (key === "bubble") return !!(pack && pack.bubbleSkin);
    if (key === "home") return !!(pack && pack.home && Object.keys(pack.home).length);
    return false;
  };
  const packParts = pack => PACK_PARTS.map(x => ({ key: x.key, zh: x.zh, has: packHas(pack, x.key) }));
  // 没传 pick 就是整套都要（存量那条路一个字都不用改）
  const cleanPick = pick => {
    const out = {};
    PACK_KEYS.forEach(k => { out[k] = pick && typeof pick === "object" ? !!pick[k] : PACK_OFF_BY_DEFAULT.indexOf(k) < 0; });
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
      customFonts: sel.fonts ? p.customFonts : blank.customFonts,
      fontScale: sel.fonts ? p.fontScale : blank.fontScale
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
    // 气泡贴纸（我的／TA 的）如果是自己传的图，也是保险箱门牌——跟着气泡那一样一起装进包（她 2026-10-17 小窝开放收图）
    const bubbleRefs = sel.bubble && extras && extras.bubbleSkin ? [extras.bubbleSkin.mySticker, extras.bubbleSkin.charSticker] : [];
    const home = sel.home ? ((extras && extras.home) || homeSnapshot()) : null;
    // 主屏贴纸、组件外观里自己传的图也是保险箱门牌：整份里认出来的都装进包
    const homeRefs = home ? (JSON.stringify(home).match(/iv_[A-Za-z0-9_-]+/g) || []) : [];
    const refs = [...new Set([...Object.values(profile.icons || {}), sel.wall ? (extras && extras.wallpaper) : "", ...cssRefs, ...fontRefs, ...bubbleRefs, ...homeRefs].filter(x => /^iv_/.test(x)))];
    for (const ref of refs) {
      try {
        const blob = await g.imgVaultFetchBlob(ref);
        if (blob) assets[ref] = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
      } catch (_) {}
    }
    // 气泡皮肤（她 2026-09-20：「界面美化分享给别人」）——它不住在 profile 里，
    // 是单独一份存档，所以这儿显式带上；对面导入时默认不盖，勾了才盖。
    const bubbleSkin = sel.bubble && extras && extras.bubbleSkin ? extras.bubbleSkin : null;
    // 记下做这份的手机多宽：对面屏幕宽窄不一样时，「一键适配我的手机」照这个比例缩放
    const myW = screenWidth();
    if (myW) profile.madeOn = { w: myW };
    return JSON.stringify({ kind: PACK_KIND, format: 1, exportedAt: new Date().toISOString(), profile,
      baseTheme: sel.base ? (extras && extras.baseTheme) : undefined,
      wallpaper: sel.wall ? (extras && extras.wallpaper) : undefined,
      bubbleSkin, home: home || undefined, assets }, null, 2);
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
    const bubbleSkin = pkg.bubbleSkin && typeof pkg.bubbleSkin === "object" ? Object.assign({}, pkg.bubbleSkin) : null;
    if (bubbleSkin) ["mySticker", "charSticker"].forEach(k => { if (map[bubbleSkin[k]]) bubbleSkin[k] = map[bubbleSkin[k]]; });
    let home = null;
    if (pkg.home && typeof pkg.home === "object") {
      try { home = JSON.parse(JSON.stringify(pkg.home).replace(/iv_[A-Za-z0-9_-]+/g, r => map[r] || r)); } catch (_) { home = null; }
      if (home) Object.keys(home).forEach(k => { if (HOME_KEYS.indexOf(k) < 0) delete home[k]; });   // 只认主屏自己那几份，别的键一个不写
    }
    return { profile: p, baseTheme: pkg.baseTheme, wallpaper: map[pkg.wallpaper] || pkg.wallpaper, bubbleSkin, home };
  };
  // 「复制给别的 AI」（群友 2026-09-30：把主题发给 DeepSeek，它说「这是空壳代码、你没有 html」）。
  //   页面是运行时拼的，本来就没有一份 html 能给；别的 AI 缺的是【挂点表】和【写法规矩】。
  //   这里把她现在的 CSS、这一页能抓的全部挂点、规矩打成一段话，她整段粘过去就能改。
  // 「换手机不走样」那几条现成写法：数值照 App 现在用的。挂点选择器的按钮和「复制给别的 AI」都读这一份。
  function sizePresets(page) {
    const chat = page === "thread" || page === "gthread";
    return (chat ? [
          ["顶栏让开刘海、换手机不飘", "调顶栏上下留白时用这条，刘海高低不同的手机都贴着状态栏下沿", '[data-wk="chathead"] {\n  padding-top: calc(var(--app-safe-top) + 6px) !important;\n  height: auto !important;\n}'],
          ["顶部按屏幕高度留白", "给顶上的装饰图让位，高手机留得多、矮手机留得少", '[data-wk="body"] {\n  padding-top: calc(var(--app-vh) * 12) !important;\n}'],
          ["气泡最宽占屏幕七成", "换宽屏、窄屏，气泡都不会撑得太满", '[data-wk="bubble"] {\n  max-width: calc(var(--app-w) * 0.72) !important;\n}'],
          ["背景图随手机铺满", "背景图不会在长手机上露白边、也不会被拉变形", '[data-wk="chat"] {\n  background-size: cover !important;\n  background-position: center !important;\n}'],
          ["小屏手机字小一号", "只在矮屏手机上生效，别的手机不变", 'html[data-screen-size="short"] [data-wk="bubble"] {\n  font-size: 13.5px !important;\n  padding: 7px 11px !important;\n}'],
          ["大屏手机头像大一点", "只在高屏手机上生效", 'html[data-screen-size="tall"] [data-wk="row"] > [data-wk="avatar"] {\n  transform: scale(1.1) !important;\n}']
        ] : [
          ["这一页背景图随手机铺满", "背景图不会露白边、不会被拉变形", '[data-wk="app"] {\n  background-size: cover !important;\n  background-position: center !important;\n}']
        ]);
  }
  const screenWidth = () => { const n = parseFloat(((screenNow() || {}).w) || ""); return isFinite(n) && n > 0 ? Math.round(n) : 0; };
  // 一键适配：这份是在宽 madeOn.w 的手机上调好的（连同它那档「全 App 多大」），换到这台就按宽度比例再乘一次。
  //   适配完把 madeOn 记成这台，再点一次不会越缩越小。差不到 3% 不算不一样。
  function fitPlan(profile, myW) {
    const made = Number(profile && profile.madeOn && profile.madeOn.w) || 0;
    myW = Number(myW) || screenWidth();
    if (!made || !myW || Math.abs(myW / made - 1) < 0.03) return null;
    const cur = (cleanZoom(profile.pageZoom)).all || 1;
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(cur * myW / made * 100) / 100));
    const pageZoom = Object.assign({}, profile.pageZoom || {});
    if (z === 1) delete pageZoom.all; else pageZoom.all = z;
    return { made: made, mine: myW, zoom: z, patch: { pageZoom: pageZoom, madeOn: { w: myW } } };
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
                                                                                                                                                                                                                                                                    const BRIEF_STAMP = {v: "v88.810",changed: "",none: "这一版没动美化挂点。"};
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
      "7. 顶栏（chathead）和底栏（composer）自带刘海／底部横条的安全区，写在 padding-top／padding-bottom 里：别对它们写 padding 简写、别把 padding-top（底栏 padding-bottom）写成死数，不然顶栏会钻进状态栏底下跟时间叠在一起。要调就写 padding-top: calc(var(--app-safe-top) + 6px) !important，底栏用 var(--app-safe-bottom)。顶栏里用 position:absolute; top:50% 居中的名字、头像，要写 top: calc(50% + var(--app-safe-top) / 2)，不然比两边按钮高半截。顶栏别写死 height（刘海高低不一样，写死就有人被压扁或空出一截）；顶栏上的装饰图挂在 [data-wk=\"chathead\"] 自己的 ::before／::after 上，用 bottom 或百分比定位，别用 position: fixed，也别从屏幕顶写一个死的 top——换台手机它就飘走了。",
      "番茄钟：pomfocus 是专注整页，视频铺满外壳、标准 Head 透明；pompoke 是轻戳透明按钮，pomsubtitle 是底部模式字幕，pomtimer 是独立发条倒计时，pommore 是手动补新话与回看入口；字幕内有新话上一句/下一句按钮，长话只在字幕正文内滚动。人物脸部留空，字幕读完收起；保留按钮层级与 0.4 底安全区，不让字幕挡住计时。pomvideoeditor 是制作整页，pomvideostage 的 video 可调 object-fit；视频与语音独立。",
      "通话：callcamera 是用户真实摄像头小窗，不替换角色背景；保留开关和前后镜头切换触区至少 40px，与头像并排，窄屏不越屏。callcomposer 继续使用 0.4 底安全区，正文为唯一主滚动区。",
      "小世界选择页[fgworld]沿左右交替的小路排列，插画是填色SVG；列车、小镇与TA的一天使用96×86的画布，庭院房子与占位圆圈使用112×112。调整svg宽高时保持原viewBox的比例，颜色分别在填色与描边上；保留[fgbody]唯一滚动正文和公共透明Head。",
      "TA的一天的[cdaypositionopen]在此刻安排卡和日程行中打开[cdaypositionpage]整页：公共透明Head、复用[cdaymenubody]唯一滚动正文、原56px与0.4底安全区保存栏。[cdaypositionscene]是44px原生场景下拉；[cdaypositionspot]两列44px按钮，aria-pressed表示手动选中；[cdaypositionauto]恢复自动匹配，自动模式不标记具体位置按钮。打开编辑页暂停原场景，返回日程保留列表滚动。\n" +
      "TA的一天界面沿奶油白纸面、鼠尾草绿控件和淡木色底光；[cdaypage]是皮肤外壳，原公共Head与56px/0.4安全区底栏保持。[cdayoutingmode]含两个同行小票[cdayoutingchoice]，data-part为solo/together、aria-checked标选中，并带勾与加厚底边；[cdaydestination]按真实地图目录两列排，每张含场景线条图标和地点名称。菜单行配柔色图标底，生活动作带图标；表单选择框仍用原生行为，字号至少16px，按钮触区44px，支持键盘焦点与减少动画。小家样式[cdaystylepage]与日程[cdaybook]分别保持唯一[cdaybody]滚动正文。\n" +
      "TA的一天生活菜单沿原[cdayinteraction]整页与[cdaymenubody]唯一滚动区，新增浴室分类；[cdaybathwho]选择我或TA，[cdaybathaction]是洗澡、洗手、厕所按钮，触区至少44px。浴室家具沿原配色和真实预览，不另建编辑页。\n" +
      "TA的一天布置小家→单件搭配沿[cdaydecorpanel]整页、[cdaydecorbody]唯一滚动与原顶底栏；[cdaypiecepreview]为160方形实际模型预览，居中保留完整轮廓。[cdaypartcolors]纵向排部件，[cdaypartcolor]的data-part为稳定部件标识，色块和原配色恢复键触区至少44px。主要颜色与独立部件分别选，玻璃透明和材质保留；选色、撤销和返回均保持同一个三维iframe。\n" +
      "TA的一天更多里的[cdaycamera]提供跟TA、跟我、看两人和全景；小家相册/厨房/装修灵感沿[cdaylifepage]整页、公共透明Head、[cdaymenubody]唯一滚动正文和56px/0.4底安全区，菜单保持三维现场。相册拍照前[cdayphotoframe]显示[cdayphotopreview]4:3真实取景、宽100%且完整显示两个人，[cdayphotorefresh]重新取景按钮触区至少44px；保存的照片与预览完全一致。相册列表两列4:3完整真实相片，详情[cdayphoto]宽100%按原比例，列表→详情→列表分别记滚动；厨房食材两列、配方与餐盒纵向列，44px触区；操作道具大画面下方[cdaykitchenguide]有当前步骤、真实操作反馈与下一步按钮，最大34%高度、内部滚动，保留原公共Head与固定底栏；[cdaykitchenresult]显示实际火候、摆盘和调味，沿原纸卡字号；[cdaykitchenhud]沿奶油纸面与原现场底边显示状态、换手、自动和看台面，新家常炒煎及沙拉的拿料、翻面、调火、淋酱和摆盘直接在三维台面拖动，所有需操作道具都沿公共Head与[cdaycuttools]底栏放大占满场景，食材篮、砧板、锅／拌碗、旋钮、酱瓶、摆盘及揉面／蒸锅／汤锅／烤箱／茶壶同一视图；[cdaykitchentoolselect]切换当前可用道具，点道具或[cdaykitchenzoom]进入，手指直接划切、拖放、绕圈、翻面或调火；厨具与食材复用现场真实几何，退出回同一台面，进度沿原存档，保留双指缩放；现场没有这些操作的计次按钮；横屏时台面控件移到右侧，取景为它留出空间；[cdaykitchencoop]是原HUD内的配合折叠区，递料、接碗、扶锅、一起揉面、贴近搅拌、擦面粉和双方尝味按真实动作执行；[cdaykitchenmomentnote]在折叠区外留下事实与[cdaykitchencoopchat]入口。[cdaykitchentoolselect]的“一起做一小下”分组也能直接开始，退出放大画面看实际小人。菜单[cdaykitchenplanner]沿厨房书页放提议纸签、完整人设批量生成与自己挑菜；[cdaykitchenmenusuggestion]采用后可换菜、替料、加料、改味与起名。名称和长文允许换行，44px选择控件沿同一安全区。[cdaykitchenshare]是餐桌与吃完记录里的手动分享按钮，沿现有按钮样式与44px触区，打开[cdaykitchenchat]独立厨房聊天书签，沿同一Head、52/44px章节书签、[cdaykitchenmsgs]唯一滚动区和[cdaykitchencompose]原底栏，不改主聊天；装修灵感先显示来源与配色，手动想法在[cdaydecorwish]，推荐不覆盖已手调的家具/饰面。24个日程地点单指旋转、双指移动或缩放，沿场景底部轻提示和原[cdaycamera]镜头入口；家具和料理目标优先接受拖动，不新增旋转工具条。新功能留在生活/更多内，场景当前安排卡保留事情与文字进度，并提供改位置入口。\n" +
      "TA的一天的主聊天窗[cdaychat]覆盖场景下半部，保持原场景尺寸，键盘打开时沿useKbLift抬升；[cdaychatbar]只有主聊天说明、完整聊天与收起，气泡/正文/输入栏沿原ChatThread的data-wk挂点，只有外层Head吃顶部安全区，输入栏底部仍为COMPOSER_PAD_BOTTOM，最近20条只是显示窗口。\n" +
      "小镇生活相册与家里的小日子沿PetPanel半窗纸、透明Head、一个滚动正文和原约56px/0.4底安全区底栏，列表两列4:3真实相片，详情完整显示图像与当时地点天气，下载与摆到家里在原按钮列表，整理删除在同页原生details折叠里；翻旧照片与列表详情返回分别保存滚动位置。家里的小日子复用原便签、库存行和动作列表，纪念日、料理、自己的角落和记忆使用原生details，展开标题至少48px，桌面与移动端都只有原一处正文滚动；位置调整两列按钮，手机不横向溢出。样式.pet-domestic-section在apps/pets/panels.css。生活相册样式.pet-living-photos、.pet-living-print、.pet-photo-remove在apps/pets/panels.css。同行遛宠安排页的习惯和老地方沿原便签、记录行及全宽路线按钮；场景拍照键复用原纸按钮和线条SVG。TA的一天装修页沿透明Head，场景在正文内，底栏约56px并用0.4底安全区；家具原生下拉选择44px，顶栏保存。页面挂点可改入口、纸质提示、选框和底栏；选中家具的三维高亮与房间材质在场景内部，页面CSS不能直接改变。小家样式选项使用 cdaystyle，aria-pressed=true 表示正在用；更多页的入口是 cdayhomestyle。3D房间材质由小家样式选择，页面CSS只控制纸页、选项与按钮。TA的一天的cdaytools固定底栏约56px并吃0.4底安全区，复用公共线条SVG，四格为聊天、生活或约会（未加入为回小家或走进来，工作地点为跟随）、日程、更多；场景没有散落的常规按钮，试玩的位置select独占底栏上方44px控件行。cdaymore是整页操作目录，cdayinteraction是整页生活选择，共用透明Head、cdaymenubody单滚动正文、cdaymenusection分类和原约56px返回栏；更多列出镜头、我的样貌、小家样式、布置和专业场景，生活与约会列出个人活动select与靠近/坐下、按当前地点提供的双人动作、结束/离开两列按钮。选动作回到场景；仅打开菜单时iframe尺寸与现场不变，背后控件不可误点。cdayvisitopen为底栏回小家或走进来键，cdaylifeopen为生活或约会键；亲密互动沿原菜单分轻轻亲近、坐着相处、躺着相处三段，两列44px按钮复用既有cdayvisitaction，cdaypairwho为共用发起方选择，说明文字只在原滚动正文内；cdayvisitnote仍在cdaynow纸卡中，三维双人位置与姿势在iframe内。TA的一天的cdayphase在原纸卡内显示正在与接下来两行；cdaypositionscope选择只改一步或整段日程，cdaypositionstage为44px原生阶段选择，后续沿原场景与位置选择，不挤场景。cdayclock在更多页的原分类里，cdayclockmode为两颗44px活动时间选择键，cdayclocknote在纸卡里提示时间来源；选中用aria-pressed，所有设置保留单滚动正文与原返回栏。TA的一天沿透明Head、角色选择与单滚动日程页、场景上的当前安排便签、约56px且0.4底安全区的底栏；cdaypage/cdaybody/cdaypick/cdayscene/cdaynow/cdayrow/cdaytools/cdayplaces/cdayplacepoint可美化对应外壳、文字与按钮；实验室、图书馆、诊室、创作工作室、排练室与车站候车区摆位试玩沿同一整页外壳、当前位置纸卡与约56px底栏，用高度44px的原生select选择动作位置，三维模型和场景在独立iframe中，顶层CSS不能穿透。实验室与图书馆的准备、做事、休息和收尾阶段文字沿cdaynow原地点行显示；专业手部动作与所持道具仍在三维场景内部。小家装修的家具库、单件搭配、房间墙地用整片场景区域的纸页覆盖层，保持原iframe与试摆：一条公共Head、单滚动正文、56px加0.4底安全区返回栏。家具库两列实景缩略图货架，纵横屏时卡片随宽度缩放；配色的常用色有文字和已选标记，自选色复用公共ColorDot色圈与色号格，材质用44px原生控件。房间大小用全宽纸卡，原有地毯与墙饰用44px勾选行；挂饰换墙用44px原生select，左右与高低用两列44px按钮。cdaysizeoptions/cdayroomsize/cdayoriginaldecor/cdaymountwall/cdaymountposition控制这些纸页表单。挂点可以改纸页、货架、卡片与表单，三维家具颜色材质、墙纸与地板由装修数据控制；顶层CSS不能替代它们。绒绒小镇聊天与状态、职业今天／零钱袋／履历、名册、镜头、街坊、周记、结伴、拆袋子、相册、家里的小日子及菜单共用PetWindow：游戏iframe始终铺满原区域，画布、镜头与场景控件不因开窗而缩小或重新排布；纸窗以absolute和z-index:10覆盖下半部，无遮罩，上方露出的场景仍能触控且持续活动。统一44px标题把手，可拖动调28%–72%并记住大小，双击恢复一半、方向键也能调；收起只移走上层窗口。共用透明Head保持绒绒小镇标题、宠物名与小镇菜单，单滚动正文和原56px/0.4底安全区底栏，详情返回与tab保留滚动位置。聊天键盘用公共抬升量只抬纸窗和输入栏，拖动边界按键盘上方可用区域计算，不挤游戏。宠物预览和TA换装保留原编辑页面。小镇周记复用同一PetPanel、透明Head、单滚动正文和原底栏，原生周选择框、换行的分类计数小卡及每天的全宽记录行；结伴逛街沿同样纸页的门牌路线按钮；两人同行遛宠物复用同一安排纸页、状态与动作列表，街边托盘沿home-actions的轻纸结构、48px按钮和原SVG，依次歇歇、追球、摸摸、继续走和一起回家。材质仍铺在聊天外壳。TA的工作沿原PetPanel实时半窗：pet-book-tabs纸页索引在同一横滑轨道排列，保持横向位置；工作往来与职业方向共用原单滚动纸页，pet-work-stages以四张小工序纸记录准备到交付，完成态同时变边线与文字。pet-resident-contract继续承载工作选择、下班回应、往来关系与职业方向，pet-book-tabs纸页索引、pet-resident-contract职业与排班卡、pet-resident-days工作日和pet-resident-hours起止时间；PetPanel仍只有一个主滚动正文及原56px/0.4安全区底栏，菜单、收入履历、作品与生活之间切换保留阅读位置。小镇现场控件在独立iframe：爪印名牌与现实天气时间共一行；出门与聊天/职业/照料册纸页分开，底下六件照料动作共用轻纸托盘与线条SVG，镜头控制收在同一细栏。布局只在apps/pets/scene-controls.css的.pet-game范围生效，顶层美化CSS不会穿透iframe，不能假装页面挂点能改三维场景控件。小世界宠物页：家装沿零钱袋原便签、库存行和按钮排版，摆放选框至少40px，已有物件各占一段，手机不横向溢出；临时兼职照片在履历册两列纸质相片中显示，方形图完整取景，图下是当天职业、名字与实际选择。全册沿同一单滚动正文和原底安全区，返回保留阅读位置。家务纯文字记录占满正文宽度，不套日期加正文的两列布局；回家拆袋子共用半窗纸底、透明Head、单滚动正文及约56px/0.4安全区底栏；实际物件在原库存行按图标、名称和份数排列，反应单独一张便签。家里的宠物用带书脊边线的小档案卡，每只单独显示名字、头像与状态，卡片内有名字外貌和职业入口；选中同时改变书脊边线与标记。名册共用PetPanel的单滚动正文及约56px底栏，返回恢复阅读位置。奶油纸底、灰粉布零钱袋与面包暖棕的印章和索引；首工纪念用墙上纸贴及履历里的同一份事件记录。照料记录、面包店/花店试工单、零钱袋/收支小票与履历册共用透明 head；自主购物用袋内便签、原生勾选开关与带金额的纸票选框，按实际购物逐张显示小票；虚线纸质职业启事按两列选职业，选中以实线和灰粉纸色标识，履历的各职业与休息在两列排列，奇数末项独占一行；各小店收藏沿原库存行展示名称与份数，公园小摊用同一职业纸页：真实库存行配减号/加号，最多三件，下一站与实际成交额在摊袋便签，收摊小票沿履历列表；公园野餐角的小摊布、货包与客人复用原猫狗模型和纸道具，没有另起面板。快递工作单用同一纸页展示包裹标签、下一站、原包裹暂存和三条门牌路线，履历用原照料记录行显示配送结果；封箱纸包与赚回的小袋子共用纸道具材质。侦探工作单的新消息便签沿原纸页展示来源、连载回数和一枚满宽模型来信按钮，保存失败的已写来信在同处显示重试收下；返回原文在同页折叠展开。侦探卷宗用三条编号线索、纸页左侧双线和末尾结论便签，猜结论仍用当前纸页上的选项，未完成线索不提前展示；书页索引有贴页形状，选中同时改变高度与边线。页面只有一处主滚动，底栏约56px并使用0.4安全区；材质铺在外壳上。宠物外貌预览保留上方模型，控件所在区域独立滚动。",
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
  // 单聊/群聊「自己写 CSS」能存多长：存的时候按这个截，编辑框按这个提醒（只这一处写数）
  const CHAT_CSS_MAX = 200000;
  g.ThemeStudio = { CHAT_CSS_MAX, histCount, undoStep, aiBrief, sizePresets, BRIEF_STAMP, KEY, appIconList, PAGES, ICON_PACKS, packList, packIconSrc, packIcon, iconBare, fresh, normalize, load, save, apply, preview, commit, cancelPreview, history, restoreHist, current, iconRef, compile, scopeCSS, unsafeReason, cssImageRefs, missingCSSImages, resolveCSSImages, remapCSSImages, exportPackage, importPackage, PACK_PARTS, PACK_KEYS, packHas, packParts, cleanPick, pickProfile, isPreviewing: () => !!previewBase, safeMode, CSS_BUILTINS, WK_COMMON, WK_SCOPED, TOKENS, TOKEN_KEYS, OWN_PALETTE, okColor, cleanTokens, tokensFor, themeFor, SLOT_MAX, pageSlots, addSlot, saveSlot, clearSlot, cssStale, SKIN_VER, ZOOM_MIN, ZOOM_MAX, cleanZoom, zoomFor, fitPlan, screenWidth, HOME_KEYS, homeSnapshot, homeApply };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { try { apply(load()); } catch (_) {} });
  else { try { apply(load()); } catch (_) {} }
})(window);
