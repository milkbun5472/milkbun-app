// Lisa-phone 主题工作台：图标皮肤 + 页面作用域 CSS + 可撤销预览。
// 素材只存 x_imgvault；配置只保存 iv_ 引用，避免 localStorage 被图片撑爆。
(function (g) {
  "use strict";
  const KEY = "x_theme_studio";
  const STYLE_ID = "lisa-theme-studio-style";
  const PREVIEW_MS = 30000;
  const APP_ICONS = [
    ["cast","人格档案馆"],["ties","关系"],["phone","查手机"],["shop","购物"],["carry","随身物"],
    ["cwallet","钱包"],["lore","世界书"],["memlib","记忆库"],["diary","日记"],["memo","备忘录"],
    ["study","一起学"],["fanfic","同人文"],["weekly","周刊"],["read","一起读"],["debate","擂台"],
    ["dream","梦境"],["tarot","塔罗"],["pomodoro","番茄钟"],["games","小游戏"],
    ["dreamjournal","解梦馆"],["yanqiu","秋声"],["rescue","互救台"],["vpscodex","值班室"],
    ["loungeapp","三席会客"],["theater","小剧场"],["trpg","跑团"],["impression","月度印象"],
    ["assistant","帮手"],["stylelab","文风台"],["chat","消息"],["moments","朋友圈"],["forum","论坛"],["config","设置"]
  ];
  const PAGES = [
    ["all","全 App"],["home","主屏"],["thread","单聊（含线下浮层）"],["gthread","群聊（含群线下浮层）"],
    ["messages","朋友圈"],["forum","论坛"],["config","设置"],["games","小游戏"],["fanfic","同人文"],["trpg","跑团"]
  ];
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
'[data-wk="chathead"] {',
'  background: ' + o.head + ' !important;',
'  border-bottom: 1px solid ' + o.line + ' !important;',
'  color: ' + o.headInk + ' !important;',
'}',
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
  const WECHAT_CSS = chatSkinCSS({ bg:"#ededed", head:"#ededed", line:"#d9d9d9", headInk:"#111111",
    timeBg:"transparent", timeInk:"#b2b2b2", timeRadius:"0", timePad:"0", avatar:"4px", radius:"5px", shadow:"none",
    theirBg:"#ffffff", theirInk:"#111111", myBg:"#95ec69", myInk:"#111111",
    tail:true, gap:6, rowGap:10, card:"4px", photo:"4px",
    metaSize:"9.5px", metaInk:"#b2b2b2", metaTop:"3px", metaInBubble:false,
    footBg:"#f7f7f7", inputBg:"#ffffff", inputRadius:"5px", inputInk:"#111111", inputHint:"#b2b2b2", send:"#07c160", sendInk:"#ffffff", sendRadius:"4px" });

  // LINE：底是一块干净的蓝灰，没有底纹；气泡特别圆、留白也大；
  // 最认脸的是【已读和时间甩在气泡外面】，字比别家还小一号。
  const LINE_CSS = chatSkinCSS({ bg:"#8ca0b3", head:"#5b6b7c", line:"rgba(0,0,0,.16)", headInk:"#ffffff",
    timeBg:"rgba(0,0,0,.30)", timeInk:"#ffffff", timeRadius:"999px", timePad:"4px 11px", avatar:"999px", radius:"20px", shadow:"none",
    theirBg:"#ffffff", theirInk:"#1f1f1f", myBg:"#06c755", myInk:"#ffffff",
    tail:true, gap:6, rowGap:9, card:"18px", photo:"18px",
    metaSize:"8.5px", metaInk:"rgba(255,255,255,.85)", metaTop:"3px", metaInBubble:false,
    footBg:"#ffffff", inputBg:"#f2f4f6", inputRadius:"999px", inputInk:"#1f1f1f", inputHint:"#98a2ab", send:"#06c755", sendInk:"#ffffff", sendRadius:"999px" });

  // Telegram：底是一整片暖紫渐变（它默认就是一张渐变壁纸，不是平色）；
  // 气泡不带尖角、几乎不留投影，密度最紧；已读和时间【在气泡里】。
  const TELEGRAM_CSS = chatSkinCSS({ bg:"#8f7bb8",
    bgArt:"linear-gradient(150deg,#b39ddb 0%,#9575cd 34%,#7e8fd0 68%,#64b5c6 100%)", bgSize:"cover",
    head:"#ffffff", line:"#e4e7ea", headInk:"#0f1419",
    timeBg:"rgba(0,0,0,.26)", timeInk:"#ffffff", timeRadius:"999px", timePad:"3px 9px", avatar:"999px", radius:"13px",
    shadow:"0 1px 1px rgba(16,35,47,.10)",
    theirBg:"#ffffff", theirInk:"#0f1419", myBg:"#effdde", myInk:"#0f1419",
    tail:false, gap:3, rowGap:8, card:"11px", photo:"11px",
    metaSize:"9px", metaInk:"rgba(90,120,90,.75)", metaTop:"0", metaInBubble:true,
    footBg:"#ffffff", inputBg:"#f1f3f5", inputRadius:"16px", inputInk:"#0f1419", inputHint:"#8b959e", send:"#3390ec", sendInk:"#ffffff", sendRadius:"999px" });

  // WhatsApp：认得出的那个米底【上面有一层浅浅的涂鸦】——这才是它最认脸的地方，
  // 光靠米色跟别家分不开。气泡方得多，已读和时间也【在气泡里】。
  const WHATSAPP_CSS = chatSkinCSS({ bg:"#efeae2", bgArt:wave("d3c9b8"), bgSize:"120px 120px",
    head:"#f0f2f5", line:"#d9d4cc", headInk:"#111b21",
    timeBg:"#ffffff", timeInk:"#54656f", timeRadius:"7px", timePad:"5px 11px", avatar:"999px", radius:"8px",
    shadow:"0 1px 1px rgba(11,20,26,.13)",
    theirBg:"#ffffff", theirInk:"#111b21", myBg:"#d9fdd3", myInk:"#111b21",
    tail:true, gap:4, rowGap:9, card:"8px", photo:"7px",
    metaSize:"9px", metaInk:"rgba(17,27,33,.45)", metaTop:"0", metaInBubble:true,
    footBg:"#f0f2f5", inputBg:"#ffffff", inputRadius:"22px", inputInk:"#111b21", inputHint:"#8696a0", send:"#00a884", sendInk:"#ffffff", sendRadius:"999px" });

  // Insta DM：白底、气泡特别圆、自己那侧紫蓝渐变白字，没有尖角。
  // ⚠️发送键不许透明：图标颜色是写死的 #fff，透明底＝白图标落在白底上，
  //   她 2026-09-03 就报了「ins 的发送键看不到」。同 tabs-not-plain-pills.md
  //   那条「绝不许写死 #fff」的坑。
  const INSTA_CSS = chatSkinCSS({ bg:"#ffffff", head:"#ffffff", line:"#efefef", headInk:"#111111",
    timeBg:"transparent", timeInk:"#8e8e8e", timeRadius:"0", timePad:"0", avatar:"999px", radius:"22px", shadow:"none",
    theirBg:"#efefef", theirInk:"#111111", myBg:"linear-gradient(135deg,#4f5bd5,#8134af)", myInk:"#ffffff",
    tail:false, gap:3, rowGap:9, card:"20px", photo:"20px",
    metaSize:"9px", metaInk:"#8e8e8e", metaTop:"3px", metaInBubble:false,
    footBg:"#ffffff", inputBg:"#ffffff", inputRadius:"999px", inputInk:"#111111", inputHint:"#8e8e8e", send:"#0095f6", sendInk:"#ffffff", sendRadius:"999px" })
    + '\n[data-wk="composer"] input,\n[data-wk="composer"] textarea {\n  border: 1px solid #dbdbdb !important;\n}';
  // ⚠️内置预设是【拷贝】进她编辑框的，不是引用：我改了内置，她手上那份不会跟着变。
  //   她 2026-09-03 就是这么撞上的——挂点全补好了，她那份 CSS 还是旧选择器，
  //   于是「感觉一个没生效」。改内置时把这个数 +1，界面就会提示她重新灌一次。
  const SKIN_VER = 4;
  const stamp = (nm, css) => "/* 内置 · " + nm + " · v" + SKIN_VER + " */\n" + css;
  const CHAT_SKINS = [["仿微信", WECHAT_CSS], ["仿 LINE", LINE_CSS], ["仿 Telegram", TELEGRAM_CSS],
    ["仿 WhatsApp", WHATSAPP_CSS], ["仿 Insta DM", INSTA_CSS]].map(([nm, css]) => [nm, stamp(nm, css)]);
  // 编辑框里那段是不是某套内置的【旧版本】：认得出就报出名字和新版本号
  const cssStale = text => {
    const m = /^\/\* 内置 · (.+?) · v(\d+) \*\//.exec(String(text || "").trim());
    if (!m) return null;                       // 不是从内置灌来的（或者她自己删了那行），不管
    return Number(m[2]) < SKIN_VER ? { name: m[1], from: Number(m[2]), to: SKIN_VER } : null;
  };
  const CSS_BUILTINS = { thread: CHAT_SKINS, gthread: CHAT_SKINS };
  const SLOT_KEY = "x_themeCssSlots";
  const SLOT_MAX = 5;
  const loadSlots = () => { try { const v = JSON.parse(localStorage.getItem(SLOT_KEY) || "{}"); return (v && typeof v === "object") ? v : {}; } catch (_) { return {}; } };
  const pageSlots = page => { const a = loadSlots()[page]; return Array.isArray(a) ? a.slice(0, SLOT_MAX) : []; };
  const saveSlot = (page, i, name, css) => {
    const all = loadSlots(); const a = Array.isArray(all[page]) ? all[page].slice(0, SLOT_MAX) : [];
    while (a.length < SLOT_MAX) a.push(null);
    a[i] = { name: String(name || ("预设 " + (i + 1))).slice(0, 12), css: String(css || "") };
    all[page] = a; try { localStorage.setItem(SLOT_KEY, JSON.stringify(all)); } catch (_) {}
    return a;
  };
  const clearSlot = (page, i) => {
    const all = loadSlots(); const a = Array.isArray(all[page]) ? all[page].slice(0, SLOT_MAX) : [];
    while (a.length < SLOT_MAX) a.push(null);
    a[i] = null; all[page] = a; try { localStorage.setItem(SLOT_KEY, JSON.stringify(all)); } catch (_) {}
    return a;
  };
  const fresh = () => ({ version: 1, name: "我的主题", icons: {}, globalCSS: "", pageCSS: {}, updatedAt: 0 });
  const normalize = raw => {
    const x = raw && typeof raw === "object" ? raw : {};
    return { ...fresh(), ...x, icons: { ...(x.icons || {}) }, pageCSS: { ...(x.pageCSS || {}) } };
  };
  const load = () => { try { return normalize(JSON.parse(localStorage.getItem(KEY) || "null")); } catch (_) { return fresh(); } };
  const save = p => { const n = normalize({ ...p, updatedAt: Date.now() }); localStorage.setItem(KEY, JSON.stringify(n)); return n; };
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
          return scope + " " + sel.replace(/^(html|body|:root)\s*/i, "");
        });
        out += sels.join(",") + "{" + body + "}";
      }
      pos = i;
    }
    return out;
  };
  const compile = p => {
    p = normalize(p); const blocks = [];
    const bad = unsafeReason(p.globalCSS); if (bad) throw new Error(bad);
    if (p.globalCSS) blocks.push("/* global */\n" + p.globalCSS);
    Object.entries(p.pageCSS || {}).forEach(([page, css]) => {
      if (!css || page === "all") return;
      blocks.push("/* " + page + " */\n" + scopeCSS(css, 'html[data-lisa-screen="' + page.replace(/[^a-zA-Z0-9_-]/g, "") + '"]'));
    });
    return blocks.join("\n");
  };
  let active = load(), previewBase = null, timer = 0;
  const safeMode = () => {
    try { return new URLSearchParams(location.search).get("safe-theme") === "1"; }
    catch (_) { return false; }
  };
  const emit = () => g.dispatchEvent(new CustomEvent("lisa-theme-change", { detail: active }));
  const apply = p => {
    const n = normalize(p), css = safeMode() ? "" : compile(n);
    let st = document.getElementById(STYLE_ID);
    if (!st) { st = document.createElement("style"); st.id = STYLE_ID; document.head.appendChild(st); }
    st.textContent = css; active = n; emit(); return n;
  };
  const cancelPreview = () => { clearTimeout(timer); timer = 0; const base = previewBase; previewBase = null; if (base) apply(base); };
  const preview = p => {
    if (!previewBase) previewBase = load(); clearTimeout(timer); apply(p);
    timer = setTimeout(cancelPreview, PREVIEW_MS); return PREVIEW_MS;
  };
  const commit = p => { clearTimeout(timer); timer = 0; const n = save(p || active); previewBase = null; return apply(n); };
  const iconRef = key => (active.icons || {})[key] || "";
  const exportPackage = async extras => {
    const profile = normalize(extras && extras.profile || load()), assets = {};
    const refs = [...new Set([...Object.values(profile.icons || {}), extras && extras.wallpaper].filter(x => /^iv_/.test(x)))];
    for (const ref of refs) {
      try {
        const blob = await g.imgVaultFetchBlob(ref);
        if (blob) assets[ref] = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
      } catch (_) {}
    }
    return JSON.stringify({ kind: "lisa-theme", format: 1, exportedAt: new Date().toISOString(), profile, baseTheme: extras && extras.baseTheme, wallpaper: extras && extras.wallpaper, assets }, null, 2);
  };
  const importPackage = async text => {
    const pkg = JSON.parse(text); if (!pkg || pkg.kind !== "lisa-theme") throw new Error("不是 Lisa-phone 主题包");
    const map = {};
    for (const [oldRef, data] of Object.entries(pkg.assets || {})) { try { map[oldRef] = await g.imgToVault(data); } catch (_) {} }
    const p = normalize(pkg.profile); Object.keys(p.icons).forEach(k => { if (map[p.icons[k]]) p.icons[k] = map[p.icons[k]]; });
    return { profile: p, baseTheme: pkg.baseTheme, wallpaper: map[pkg.wallpaper] || pkg.wallpaper };
  };
  g.ThemeStudio = { KEY, APP_ICONS, PAGES, fresh, normalize, load, save, apply, preview, commit, cancelPreview, iconRef, compile, scopeCSS, unsafeReason, exportPackage, importPackage, isPreviewing: () => !!previewBase, safeMode, CSS_BUILTINS, SLOT_MAX, pageSlots, saveSlot, clearSlot, cssStale, SKIN_VER };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { try { apply(load()); } catch (_) {} });
  else { try { apply(load()); } catch (_) {} }
})(window);
