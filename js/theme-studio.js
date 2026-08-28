// Lisa-phone 主题工作台：图标皮肤 + 页面作用域 CSS + 可撤销预览。
// 素材只存 x_imgvault；配置只保存 iv_ 引用，避免 localStorage 被图片撑爆。
(function (g) {
  "use strict";
  const KEY = "x_theme_studio";
  const STYLE_ID = "lisa-theme-studio-style";
  const PREVIEW_MS = 30000;
  const APP_ICONS = [
    ["cast","名录"],["ties","关系"],["phone","查手机"],["shop","购物"],["carry","随身物"],
    ["cwallet","钱包"],["lore","世界书"],["memlib","记忆库"],["diary","日记"],["memo","备忘录"],
    ["study","一起学"],["fanfic","同人文"],["weekly","周刊"],["read","一起读"],["debate","辩论"],
    ["dream","梦境"],["tarot","塔罗"],["pomodoro","番茄钟"],["games","小游戏"],["capsule","时光胶囊"],
    ["dreamjournal","解梦馆"],["yanqiu","秋声"],["rescue","互救台"],["vpscodex","值班室"],
    ["loungeapp","三席会客"],["theater","小剧场"],["trpg","跑团"],["impression","月度印象"],
    ["assistant","帮手"],["stylelab","文风台"],["chat","消息"],["moments","朋友圈"],["forum","论坛"],["config","设置"]
  ];
  const PAGES = [
    ["all","全 App"],["home","主屏"],["thread","单聊（含线下浮层）"],["gthread","群聊（含群线下浮层）"],
    ["messages","朋友圈"],["forum","论坛"],["config","设置"],["games","小游戏"],["fanfic","同人文"],["trpg","跑团"]
  ];
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
  g.ThemeStudio = { KEY, APP_ICONS, PAGES, fresh, normalize, load, save, apply, preview, commit, cancelPreview, iconRef, compile, scopeCSS, unsafeReason, exportPackage, importPackage, isPreviewing: () => !!previewBase, safeMode };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { try { apply(load()); } catch (_) {} });
  else { try { apply(load()); } catch (_) {} }
})(window);
