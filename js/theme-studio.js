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
'  background: ' + o.bg + ' !important;',
'  background-image: none !important;',
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
'  padding: 4px 8px !important;',
'  border-radius: ' + o.timeRadius + ' !important;',
'}',
'',
'[data-wk="avatar"] img,',
'[data-wk="avatar"] > * {',
'  border-radius: ' + o.avatar + ' !important;',
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
'/* 气泡尖角：把一个小方块转 45 度贴在气泡边上 */',
'[data-wk="bubble"]::before {',
'  content: "" !important;',
'  position: absolute !important;',
'  top: 13px !important;',
'  width: 9px !important;',
'  height: 9px !important;',
'  transform: rotate(45deg) !important;',
'}',
'[data-wk="bubble"][data-me="0"]::before {',
'  left: -3px !important;',
'  background: ' + o.theirBg + ' !important;',
'}',
'[data-wk="bubble"][data-me="1"]::before {',
'  right: -3px !important;',
'  background: ' + o.myBg + ' !important;',
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
'[data-wk="msg"] { padding-top: ' + o.gap + 'px !important; padding-bottom: ' + o.gap + 'px !important; }',
'[data-wk="row"] { gap: 9px !important; }',
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
'  color: ' + o.headInk + ' !important;',
'  font-size: 16px !important;',
'}'
  ]).join("\n");
  // 微信：方气泡、带尖角、灰底，时间是一颗灰药丸
  const WECHAT_CSS = chatSkinCSS({ bg:"#ededed", head:"#ededed", line:"#d9d9d9", headInk:"#111111",
    timeBg:"#dadada", timeInk:"#ffffff", timeRadius:"4px", avatar:"5px", radius:"6px", shadow:"none",
    theirBg:"#ffffff", theirInk:"#111111", myBg:"#95ec69", myInk:"#111111",
    tail:true, gap:5, footBg:"#f7f7f7", inputBg:"#ffffff", inputRadius:"5px" });
  // LINE：亮绿自己、白对方，底偏蓝灰，气泡很圆、也带尖角
  const LINE_CSS = chatSkinCSS({ bg:"#d7e0ea", head:"#d7e0ea", line:"#b9c6d4", headInk:"#1f1f1f",
    timeBg:"rgba(0,0,0,.28)", timeInk:"#ffffff", timeRadius:"999px", avatar:"999px", radius:"18px", shadow:"none",
    theirBg:"#ffffff", theirInk:"#1f1f1f", myBg:"#06c755", myInk:"#ffffff",
    tail:true, gap:5, footBg:"#ffffff", inputBg:"#f2f4f6", inputRadius:"999px" });
  // Telegram：自己那侧淡到几乎白的青绿，圆角中等，没有尖角，气泡有一点点浮起
  const TELEGRAM_CSS = chatSkinCSS({ bg:"#e6ebee", head:"#ffffff", line:"#dfe4e7", headInk:"#0f1419",
    timeBg:"rgba(0,0,0,.22)", timeInk:"#ffffff", timeRadius:"999px", avatar:"999px", radius:"12px",
    shadow:"0 1px 2px rgba(16,35,47,.08)",
    theirBg:"#ffffff", theirInk:"#0f1419", myBg:"#eeffde", myInk:"#0f1419",
    tail:false, gap:4, footBg:"#ffffff", inputBg:"#f1f3f5", inputRadius:"14px" });
  // WhatsApp：认得出的那个米底，浅绿自己、白对方，带尖角
  const WHATSAPP_CSS = chatSkinCSS({ bg:"#efeae2", head:"#f0f2f5", line:"#d9d4cc", headInk:"#111b21",
    timeBg:"#ffffff", timeInk:"#54656f", timeRadius:"7px", avatar:"999px", radius:"8px",
    shadow:"0 1px 1px rgba(11,20,26,.13)",
    theirBg:"#ffffff", theirInk:"#111b21", myBg:"#d9fdd3", myInk:"#111b21",
    tail:true, gap:4, footBg:"#f0f2f5", inputBg:"#ffffff", inputRadius:"10px" });
  // Insta DM：白底、气泡特别圆、自己那侧紫蓝渐变白字，没有尖角
  const INSTA_CSS = chatSkinCSS({ bg:"#ffffff", head:"#ffffff", line:"#efefef", headInk:"#111111",
    timeBg:"transparent", timeInk:"#8e8e8e", timeRadius:"0", avatar:"999px", radius:"22px", shadow:"none",
    theirBg:"#efefef", theirInk:"#111111", myBg:"linear-gradient(135deg,#4f5bd5,#8134af)", myInk:"#ffffff",
    tail:false, gap:3, footBg:"#ffffff", inputBg:"#ffffff", inputRadius:"999px" })
    + '\n[data-wk="composer"] input,\n[data-wk="composer"] textarea {\n  border: 1px solid #dbdbdb !important;\n}';
  const CHAT_SKINS = [["仿微信", WECHAT_CSS], ["仿 LINE", LINE_CSS], ["仿 Telegram", TELEGRAM_CSS],
    ["仿 WhatsApp", WHATSAPP_CSS], ["仿 Insta DM", INSTA_CSS]];
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
  g.ThemeStudio = { KEY, APP_ICONS, PAGES, fresh, normalize, load, save, apply, preview, commit, cancelPreview, iconRef, compile, scopeCSS, unsafeReason, exportPackage, importPackage, isPreviewing: () => !!previewBase, safeMode, CSS_BUILTINS, SLOT_MAX, pageSlots, saveSlot, clearSlot };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { try { apply(load()); } catch (_) {} });
  else { try { apply(load()); } catch (_) {} }
})(window);
