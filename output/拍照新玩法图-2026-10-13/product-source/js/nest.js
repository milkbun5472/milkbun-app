// ============================================================
// 秋秋小窝（2026-10-08）
//
// 大家把自己做的东西传上来、别人点一下就导进自己的手机：
//   主题、聊天美化、CSS、世界书、文风、预设台预设、人设。
// 定下来的几条：大家自己传、传的人能删自己的、管理口令什么都能删；第一版不收图；
//   不分尺度；没有举报键；只按时间排（新的在前／旧的在前），不按导入数排。
//
// 东西存在 Cloudflare 那边（qiuqiu-nest），这一页只走秋秋机自己的 /nest/ 前门——
//   Worker 的真地址里带着账号名，不能进包。家里那份 app 也走同一个前门（那边放行了跨域）。
//
// 导进来的东西一律落进它本来就住的那个库，不另开一份：
//   主题 / 气泡包 → 交给主题工作台（跟手动导入同一条路：先预览、挑几样、确认才落盘）
//   CSS → 全 App（主题工作台草稿）或者只放给某个人的聊天窗／某个群／某个人的线下
//   整套聊天美化（chat-look）→ 放给某个人的聊天窗／某个群
//   世界书 → saveLore；文风 → x_offlineStyles；预设 → StylePresets.importBundle；人设 → 新建一个角色
// 传上去的东西不带记忆、不带聊天、不带绑定的角色：世界书词条的 charIds、人设的长期记忆一律不发。
// 每一类都能直接从手机文件里选（她 2026-10-08：「为啥不能全部直接从自己手机的文件里面选」）。
// ============================================================
(function () {
  const useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  const NEST = "https://qiuqiu-machine.pages.dev/nest";

  // 每一类一个色：列表里那枚小印章、详情顶上那条色带都用它（不靠颜色认类别，印章上还写着字）
  const KINDS = [
    { key: "theme", zh: "主题", seal: "主", color: "#a8794a", hint: "整套主题包：配色、页面 CSS、字体、气泡" },
    { key: "look", zh: "聊天美化", seal: "美", color: "#c0717f", hint: "聊天设置里「整套美化」导出的那一套，或「聊天气泡」导出的气泡包" },
    { key: "css", zh: "CSS", seal: "C", color: "#5f86a3", hint: "一段 CSS：导进来时选放给全 App，还是只给某一个聊天" },
    { key: "lore", zh: "世界书", seal: "书", color: "#71834f", hint: "一组世界书词条" },
    { key: "style", zh: "文风", seal: "文", color: "#8f72a8", hint: "线下文风库里的一条文风" },
    { key: "preset", zh: "预设", seal: "预", color: "#b38a35", hint: "文风预设台里搭好的一份预设" },
    { key: "persona", zh: "人设", seal: "人", color: "#4f8e88", hint: "一个角色的名字、一句话简介和人设正文" }
  ];
  const KIND = {}; KINDS.forEach(k => { KIND[k.key] = k; });
  const KZH = {}; KINDS.forEach(k => { KZH[k.key] = k.zh; });

  // 管理口令只活在她自己那台手机的 qq_ 键里（不跟云同步、不进存档、不进包）
  const ADMIN_KEY = "qq_nestAdmin";
  const adminToken = () => { try { return localStorage.getItem(ADMIN_KEY) || ""; } catch (e) { return ""; } };

  async function api(path, opts) {
    const o = opts || {};
    const headers = { "x-qq-device": typeof qqDeviceId === "function" ? qqDeviceId() : "" };
    const adm = adminToken(); if (adm) headers["x-qq-admin"] = adm;
    if (o.body) headers["content-type"] = "application/json";
    let r;
    try { r = await fetch(NEST + path, { method: o.method || "GET", headers, body: o.body ? JSON.stringify(o.body) : undefined }); }
    catch (e) { throw new Error("连不上小窝，看看网络"); }
    let d = null; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && d.error) || ("小窝没接住（" + r.status + "）"));
    return d || {};
  }

  // ── 把手上的东西打成要传的那一份 ─────────────────────────────
  //   每一类只挑「别人导进去用得上」的字段；记忆、聊天、绑定一律不带。
  const LORE_FIELDS = ["title", "keyword", "category", "payload", "regex", "enabled", "alwaysOn", "ensemble", "priority", "scope"];
  function packLore(entries) {
    return JSON.stringify({ kind: "qq-lore", entries: (entries || []).map(e => {
      const o = {}; LORE_FIELDS.forEach(k => { if (e[k] !== undefined) o[k] = e[k]; }); return o;
    }) });
  }
  const packStyle = s => JSON.stringify({ kind: "qq-style", name: s.name || "", prompt: s.prompt || "" });
  function packPreset(p) {
    const SP = window.StylePresets;
    const mine = SP ? SP.userModules() : [];
    const used = mine.filter(m => (p.mods || []).indexOf(m.id) >= 0)
      .map(m => ({ id: m.id, cat: m.cat, catZh: m.catZh, catHint: m.catHint, name: m.name, hint: m.hint, text: m.text }));
    return JSON.stringify({ modules: used, presets: [{ id: p.id, name: p.name, mods: (p.mods || []).slice(), free: p.free || "", freePos: p.freePos || "after" }] });
  }
  const packPersona = c => JSON.stringify({ kind: "qq-persona", name: c.name || "", tagline: c.tagline || "", persona: c.persona || "" });

  // Word 会把 CSS 里的符号「改好看」：弯引号、长破折号、全角标点——原样贴进去整段失效。
  //   只换这几样，别的一个字不动。
  const unWord = s => String(s || "")
    .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/[—–]/g, "--")
    .replace(/｛/g, "{").replace(/｝/g, "}").replace(/：/g, ":").replace(/；/g, ";").replace(/ /g, " ");

  // ── 从手机里选的那份文件 → 要传的那一份 ─────────────────────
  //   每一类认 app 自己导出的那种文件；文风、人设、世界书、CSS 还认 txt / docx / md 这种纯文字。
  //   返回 { payload, title, note }，note 是给她看的一句「读到了什么」。
  const ACCEPT = {
    theme: ".json,application/json",
    look: ".json,application/json",
    css: ".css,.txt,.docx,text/css,text/plain",
    lore: ".json,.txt,.md,.docx,application/json,text/plain",
    style: ".txt,.md,.docx,.json,text/plain",
    preset: ".json,application/json",
    persona: ".json,.txt,.md,.docx,application/json,text/plain"
  };
  const stem = name => String(name || "").replace(/\.[a-z0-9]+$/i, "").trim().slice(0, 40);
  async function readAny(file) {
    if (/\.docx$/i.test(file.name || "")) {
      if (typeof readOfflineStyleDocument !== "function") throw new Error("这台手机读不了 docx，存成 txt 再选");
      return await readOfflineStyleDocument(file);
    }
    return (await file.text()).replace(/^﻿/, "");
  }
  const tryJSON = s => { try { return JSON.parse(s); } catch (e) { return null; } };
  function fromFile(kind, text, name) {
    const t = String(text || "").trim(), base = stem(name), d = tryJSON(t);
    if (!t) throw new Error("这份文件是空的");
    if (kind === "theme") {
      if (!d || !/-theme$/.test(String(d.kind || ""))) throw new Error("这不是主题包：去「设置 → 主题工作台」点「导出」存出来的那种 json");
      if (d.assets && Object.keys(d.assets).length) throw new Error("这个主题包里带着图（图标、壁纸或字体文件），小窝先不收图：导出时把那几样的勾去掉再存一份");
      return { payload: t, title: base, note: "主题包" };
    }
    if (kind === "look") {
      if (!d || !(d.kind === "chat-look" || (/-theme$/.test(String(d.kind || "")) && d.bubbleSkin))) throw new Error("这不是聊天美化：要聊天设置里「整套美化」导出的，或「聊天气泡」那一栏导出的 json");
      if (d.assets && Object.keys(d.assets).length) throw new Error("这套美化里带着图（背景图、头像框这些），小窝先不收图：去掉图再导出一份");
      return { payload: t, title: base, note: d.kind === "chat-look" ? "整套聊天美化" : "气泡包" };
    }
    if (kind === "css") return { payload: /\.docx$/i.test(name || "") ? unWord(t) : t, title: base, note: t.length + " 字的 CSS" };
    if (kind === "lore") {
      const list = d ? (Array.isArray(d) ? d : (d.entries || null)) : null;
      if (d && !list) throw new Error("这份 json 里没有世界书词条");
      if (list) return { payload: packLore(list), title: base, note: list.length + " 条词条" };
      return { payload: packLore([{ title: base || "导入设定", payload: t, category: "世界观", alwaysOn: true, enabled: true }]), title: base, note: "整份当成一条词条（" + t.length + " 字）" };
    }
    if (kind === "style") {
      if (d && d.prompt) return { payload: packStyle({ name: d.name || base, prompt: d.prompt }), title: d.name || base, note: "一条文风" };
      return { payload: packStyle({ name: base, prompt: t }), title: base, note: t.length + " 字的文风" };
    }
    if (kind === "preset") {
      if (!d || (!Array.isArray(d.modules) && !Array.isArray(d.presets))) throw new Error("这不是预设台的预设：要文风台里导出的那种 json（里面有 modules 或 presets）");
      return { payload: t, title: base || ((d.presets || [])[0] || {}).name || "", note: (d.presets || []).length + " 份预设" + ((d.modules || []).length ? "、" + d.modules.length + " 个模块" : "") };
    }
    if (kind === "persona") {
      // 角色卡认法跟档案馆「导入角色卡」同一份（json 卡、带小标题的 txt 都认）；只取名字、简介、正文
      const c = typeof parseCharCard === "function" ? parseCharCard(t) : null;
      const nm = String((c && c.name) || (d && d.name) || base).slice(0, 20);
      const persona = String((c && c.persona) || (d && (d.persona || d.description)) || t);
      return { payload: packPersona({ name: nm, tagline: (c && c.tagline) || (d && d.tagline) || "", persona }), title: nm, note: "人设「" + nm + "」，" + persona.length + " 字" };
    }
    throw new Error("不认得的类别");
  }

  // ── 导进来：每一类落进它本来住的那个库 ──────────────────────
  //   CSS 和整套聊天美化要先问放哪儿，不走这一条（见 Detail 的 placing）。
  function importInto(kind, payload, title, props) {
    const d = kind === "css" ? null : JSON.parse(payload);
    if (kind === "theme" || kind === "look" || kind === "css") {
      // 交给主题工作台：它打开时接过这一份，跟手动导入同一条路（先预览、确认才落盘）
      window.__nestHandoff = { kind, text: payload, title };
      props.onOpenThemeStudio();
      return "";
    }
    if (kind === "lore") {
      const now = Date.now();
      const list = (d.entries || []).map((e, i) => Object.assign({}, e, { id: "le_nest_" + now + "_" + i, charIds: [], ts: now + i }));
      props.onAddLore(list);
      return "已放进世界书：" + list.length + " 条（没绑角色，去世界书里按需要绑）";
    }
    if (kind === "style") {
      const cur = loadJSON("x_offlineStyles", []);
      const key = "custom_" + Date.now();
      const next = (Array.isArray(cur) ? cur : []).concat([{ key, name: d.name || title, prompt: d.prompt, custom: true, imported: true }]);
      if (!saveJSON("x_offlineStyles", next)) throw new Error("没存进去，再试一次");
      return "已放进文风库：「" + (d.name || title) + "」";
    }
    if (kind === "preset") {
      // id 一律换新：别人那份预设的 id 跟她自己的撞上，importBundle 会原地盖掉她那份
      const SP = window.StylePresets; if (!SP) throw new Error("预设台还没加载好");
      const stamp = Date.now().toString(36), remap = {};
      const modules = (d.modules || []).map((m, i) => { const id = "um_nest_" + stamp + "_" + i; remap[m.id] = id; return Object.assign({}, m, { id }); });
      const presets = (d.presets || []).map((p, i) => Object.assign({}, p, { id: "sp_nest_" + stamp + "_" + i, mods: (p.mods || []).map(x => remap[x] || x) }));
      const r = SP.importBundle({ modules, presets });
      return "已放进预设台：" + r.presets + " 份预设" + (r.modules ? "、" + r.modules + " 个模块" : "");
    }
    if (kind === "persona") {
      props.onAddChar({ name: String(d.name || title).slice(0, 20), tagline: String(d.tagline || "").slice(0, 40), persona: String(d.persona || d.description || "") });
      return "";
    }
    throw new Error("不认得的类别");
  }

  // CSS 放进某一个人／某一个群自己那一格（她 2026-10-08：「想要 css 应用在单一个聊天怎么弄」）。
  //   接在那一格原有内容的后面，不顶掉；写入口就是聊天设置自己用的那几个（app.js 递进来），不另开一条路。
  //   这三格都记着「↶ 回到上一版」（engine.js 的 LookHist 在落盘那一刻自己记），不满意在那一页退回去。
  const CSS_SLOTS = { chat: "这个人的聊天窗", group: "这个群", offline: "这个人的线下" };
  function cssInto(where, id, css, title, props) {
    const TS = window.ThemeStudio;
    const bad = TS && TS.unsafeReason ? TS.unsafeReason(css) : "";
    if (bad) throw new Error("这段 CSS 放不进去：" + bad);
    const cur = String((props.lookOf(where, id) || {}).customCSS || "");
    const next = (cur.trim() ? cur.replace(/\s+$/, "") + "\n\n" : "") + "/* 小窝：" + String(title || "").replace(/\*\//g, "") + " */\n" + css;
    props.onPatchLook(where, id, { customCSS: next });
  }
  // 整套聊天美化放给一个聊天：跟聊天设置里「导入一套」同一份拆包（importChatLook），整套换上。
  //   群里用不上皮肤／气泡／字那三样，跳过（跟群设置里导入的规矩一样）。
  const GROUP_LOOK_KEYS = ["chatBg", "layout", "customCSS"];
  async function lookInto(where, id, text, props) {
    const look = await importChatLook(text);
    const patch = {};
    Object.keys(look).forEach(k => { if (where !== "group" || GROUP_LOOK_KEYS.indexOf(k) >= 0) patch[k] = look[k]; });
    if (!Object.keys(patch).length) throw new Error("这套美化里没有群里用得上的东西（群里只吃背景、排版、CSS）");
    props.onPatchLook(where, id, patch);
  }

  const ago = ts => {
    const s = (Date.now() - ts) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " 分钟前";
    if (s < 86400) return Math.round(s / 3600) + " 小时前";
    if (s < 86400 * 30) return Math.round(s / 86400) + " 天前";
    const d = new Date(ts); return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  };

  // 外壳底纹：格子柜的木板——竖向细木纹，铺在最外那层、Head 透明透上来（mobile-ui-layout.md §3.5）。
  //   ⚠️t.ink 在深色/自定义主题下未必是六位色号，拼透明度后缀会拼出废值，验不过就退回纯色。
  const hex6 = c => /^#[0-9a-f]{6}$/i.test(String(c || ""));
  const shell = t => !hex6(t.ink) ? { background: t.bg } : { background: t.bg, backgroundImage: [
    "repeating-linear-gradient(90deg," + t.ink + "00 0 5px," + t.ink + "05 5px 6px," + t.ink + "00 6px 13px," + t.ink + "03 13px 14px)",
    "linear-gradient(180deg," + t.ink + "07," + t.ink + "00 160px)"].join(",") };
  const tint = (c, a) => hex6(c) ? c + a : c;

  // 图标：一个小屋檐底下三格格子
  window.GNest = p => h(Svg, p,
    h("path", { d: "M3 10l9-6 9 6" }), h("path", { d: "M5 9v11h14V9" }),
    h("path", { d: "M5 14h14" }), h("path", { d: "M12 14v6" }));

  // ── 那一排分类：小窝是一面格子柜，每一格是一只抽屉 ─────────────
  //   选中的那只是「拉出来了」：浮起来、有影子、拉手上墨；没选的推在柜子里，暗一些、拉手是细线。
  //   CSS「放哪儿」那三格、上传页挑类别也是这面柜子（items / noAll 传进来）。
  function Cubbies({ t, kind, onPick, noAll, items, cols, flush }) {
    const all = items || (noAll ? [] : [{ key: "", zh: "全部" }]).concat(KINDS);
    const n = cols || 4;
    const frame = hex6(t.ink) ? t.ink + "0d" : t.bg2;
    const grid = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + n + ", 1fr)", gap: 5, padding: 5, borderRadius: 14, background: frame } },
      all.map(k => {
        const on = k.key === kind, kc = (KIND[k.key] || {}).color;
        return h("button", { key: k.key || "all", "data-wk": "nestcubby", "data-on": on ? "1" : "0", onClick: () => onPick(k.key),
          className: "active:opacity-70 flex flex-col items-center justify-center",
          style: { minHeight: 48, padding: "6px 2px 5px", borderRadius: 9, fontFamily: F_BODY, fontSize: 12.5, letterSpacing: .5,
            color: on ? t.ink : t.fog, fontWeight: on ? 600 : 400,
            background: on ? t.bg2 : "transparent",
            boxShadow: on ? "0 1px 0 " + t.line + ", 0 4px 10px -6px rgba(0,0,0,.35)" : "none",
            transform: on ? "translateY(-1px)" : "none", transition: "all .15s" } },
          h("span", null, k.zh),
          // 抽屉拉手：选中的上墨（带这一类的色），没选的一道细线
          h("span", { style: { marginTop: 5, width: on ? 18 : 12, height: on ? 3 : 2, borderRadius: 2,
            background: on ? (kc || t.ink) : t.line, transition: "all .15s" } }));
      }));
    return flush ? grid : h("div", { "data-wk": "nestcubbies", className: "shrink-0 px-4 pt-2 pb-3" }, grid);
  }

  const Btn = ({ t, onClick, children, solid, disabled, wk, wide }) => h("button", { onClick, disabled, "data-wk": wk || "nestbtn",
    className: "active:opacity-60 disabled:opacity-40" + (wide ? " flex-1" : ""),
    style: { minHeight: 44, padding: "0 18px", borderRadius: 12, fontFamily: F_BODY, fontSize: 14, fontWeight: solid ? 600 : 400,
      border: "1px solid " + (solid ? t.ink : t.line), background: solid ? t.ink : t.bg2, color: solid ? t.bg : t.ink } }, children);

  // 一枚小印章：这一类的一个字，盖在列表每一条的左边
  const Seal = ({ k, size }) => {
    const K = KIND[k] || { seal: "?", color: "#888" }, s = size || 34;
    return h("span", { "aria-hidden": true, style: { flexShrink: 0, width: s, height: s, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: tint(K.color, "1f"), color: K.color, border: "1px solid " + tint(K.color, "40"), fontFamily: F_BODY, fontSize: s * .42, fontWeight: 700 } }, K.seal);
  };
  const card = t => ({ background: t.bg2, borderRadius: 14, border: "1px solid " + t.line, boxShadow: "0 1px 2px rgba(0,0,0,.04)" });
  const label = (t, txt) => h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, letterSpacing: .5, marginBottom: 8 } }, txt);

  // ── 放哪儿：全 App，或者某一个人的聊天窗／某一个群／某一个人的线下 ─────
  //   CSS 三处都能放；整套聊天美化只有聊天窗和群（线下没有那一套皮）。
  function Place({ t, props, busy, slots, onPick, onAll, onCancel }) {
    const [tab, setTab] = useState(slots[0]);
    const chars = (props.characters || []).filter(c => c && !c.npc);
    const list = tab === "group" ? (props.groups || []).map(g => ({ id: g.id, name: g.name || "未命名的群" })) : chars.map(c => ({ id: c.id, name: c.name }));
    const zh = { chat: "聊天窗", group: "群聊", offline: "线下" };
    return h("div", { "data-wk": "nestplace", style: Object.assign({ marginTop: 16, padding: 14 }, card(t)) },
      h("div", { style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 600, color: t.ink } }, "放哪儿"),
      onAll ? h(React.Fragment, null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 4, lineHeight: 1.6 } }, "全 App：接在全局 CSS 草稿后面，预览满意再保存。只给一处：放进那个人或那个群自己的 CSS，直接生效。"),
        h("div", { className: "flex", style: { gap: 8, marginTop: 12 } },
          h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: onAll, wk: "nestplaceall" }, "全 App"),
          h(Btn, { t, disabled: busy, onClick: onCancel }, "先不放")))
      : h(React.Fragment, null,
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 4, lineHeight: 1.6 } }, "整套换上，直接生效。不满意在那一页的设置里点「↶ 回到上一版」。"),
        h("div", { style: { marginTop: 10 } }, h(Btn, { t, disabled: busy, onClick: onCancel }, "先不放"))),
      h("div", { "data-wk": "nestplacetabs", style: { marginTop: 14 } },
        h(Cubbies, { t, kind: tab, onPick: setTab, cols: slots.length, flush: true, items: slots.map(k => ({ key: k, zh: zh[k] })) })),
      h("div", { style: { marginTop: 6 } },
        list.length ? list.map(x => h("button", { key: x.id, "data-wk": "nestplacerow", disabled: busy, onClick: () => onPick(tab, x.id, x.name), className: "w-full flex items-center justify-between active:opacity-70 disabled:opacity-40",
          style: { minHeight: 46, padding: "0 4px", borderBottom: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 14, color: t.ink, textAlign: "left" } },
          h("span", { className: "truncate" }, x.name), h("span", { style: { color: t.fog, fontSize: 12.5, flexShrink: 0 } }, "放这儿 ›")))
        : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "14px 4px" } }, tab === "group" ? "还没有群" : "还没有角色")));
  }

  // ── 一条东西点进去 ─────────────────────────────────────────
  function Detail({ t, id, props, onClose, onGone }) {
    const [it, setIt] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
    const [armed, setArmed] = useState(false);
    const [placing, setPlacing] = useState(false);   // CSS／整套聊天美化：先问放哪儿
    useEffect(() => { let live = true; api("/item/" + id).then(d => { if (live) setIt(d); }).catch(e => { if (live) setErr(e.message); }); return () => { live = false; }; }, [id]);
    const admin = !!adminToken();
    const isChatLook = !!(it && it.kind === "look" && (tryJSON(it.payload) || {}).kind === "chat-look");
    const needsPlace = !!(it && (it.kind === "css" || isChatLook));
    const doImport = async () => {
      if (needsPlace && !placing) { setPlacing(true); return; }
      setBusy(true);
      try {
        const d = await api("/item/" + id + "?import=1");
        const msg = importInto(d.kind, d.payload, d.title, props);
        if (msg) props.toast(msg);
      } catch (e) { props.toast("导入失败：" + e.message); }
      setBusy(false);
    };
    // 放进某一个人／群：照样记一次导入
    const placeOne = async (where, wid, name) => {
      setBusy(true);
      try {
        const d = await api("/item/" + it.id + "?import=1");
        if (it.kind === "css") cssInto(where, wid, d.payload, d.title, props);
        else await lookInto(where, wid, d.payload, props);
        props.toast("已放进「" + name + "」" + (where === "group" ? "这个群" : where === "offline" ? "的线下" : "的聊天窗") + "，去那儿看看；不满意在那一页的设置里点「↶ 回到上一版」");
        setPlacing(false);
      } catch (e) { props.toast("没放进去：" + e.message); }
      setBusy(false);
    };
    const doCopy = async () => {
      const ok = await copyText(it.payload);
      props.toast(ok ? (it.kind === "css" ? "CSS 已复制" : "已复制，可以贴进对应那一页的导入框") : "这台手机不让复制，长按预览里的字试试");
    };
    const doDelete = async () => {
      if (!armed) { setArmed(true); return; }
      setBusy(true);
      try { await api("/item/" + id, { method: "DELETE" }); props.toast("删掉了"); onGone(id); }
      catch (e) { props.toast("没删成：" + e.message); setBusy(false); setArmed(false); }
    };
    let preview = "";
    if (it) {
      try {
        if (it.kind === "css") preview = it.payload;
        else {
          const d = JSON.parse(it.payload);
          if (it.kind === "lore") preview = (d.entries || []).map(e => "【" + (e.title || "未命名") + "】" + String(e.payload || "").slice(0, 140)).join("\n\n");
          else if (it.kind === "style") preview = d.prompt;
          else if (it.kind === "persona") preview = (d.tagline ? d.tagline + "\n\n" : "") + (d.persona || d.description || "");
          else if (it.kind === "preset") preview = (d.presets || []).map(p => p.name + "：" + (p.mods || []).length + " 个模块" + (p.free ? "，另有一段手写" : "")).join("\n") + ((d.modules || []).length ? "\n\n自带模块：" + d.modules.map(m => m.name).join("、") : "");
          else if (isChatLook) preview = "一整套聊天美化，里面有：" + Object.keys(d.look || {}).map(k => ({ skin: "皮肤", bubble: "气泡", font: "字体", chatBg: "背景", layout: "排版", customCSS: "CSS" })[k] || k).join("、") + "。\n导进来时选放给哪个人的聊天窗或哪个群。";
          else preview = "这是一份" + KZH[it.kind] + "包，导进来会先在主题工作台里预览，挑好要哪几样再换上。";
        }
      } catch (e) { preview = ""; }
    }
    const K = it ? KIND[it.kind] : null;
    return h("div", { "data-wk": "nestdetail", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: it ? KZH[it.kind] : "小窝", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-6" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, err) :
        !it ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, "在拿……") :
        h(React.Fragment, null,
          h("div", { style: Object.assign(card(t), { padding: 16, borderTop: "4px solid " + K.color }) },
            h("div", { className: "flex items-center", style: { gap: 12 } },
              h(Seal, { k: it.kind, size: 40 }),
              h("div", { className: "min-w-0" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 18, fontWeight: 600, color: t.ink, lineHeight: 1.3, wordBreak: "break-word" } }, it.title),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 3 } },
                  (it.nick ? it.nick + " · " : "") + ago(it.created) + (it.mine ? " · 我传的" : "")))),
            it.intro ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" } }, it.intro) : null),
          preview ? h("div", { style: { marginTop: 14 } }, label(t, "里面是什么"),
            h("div", { "data-wk": "nestpreview", style: Object.assign({ fontFamily: it.kind === "css" ? "ui-monospace,Menlo,monospace" : F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.7,
              whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 14, maxHeight: "46vh", overflowY: "auto" }, card(t)) }, preview.slice(0, 6000))) : null,
          placing ? h(Place, { t, props, busy, slots: it.kind === "css" ? ["chat", "group", "offline"] : ["chat", "group"],
            onPick: placeOne, onAll: it.kind === "css" ? doImport : null, onCancel: () => setPlacing(false) }) : null)),
      // 底下那一排动作：跟聊天输入栏同一个底部安全区（mobile-ui-layout.md §2）
      it && !placing ? h("div", { "data-wk": "nestactions", className: "shrink-0 flex px-4 pt-3", style: { gap: 8, paddingBottom: "calc(12px + " + COMPOSER_PAD_BOTTOM + ")", borderTop: "1px solid " + t.line, background: tint(t.bg, "f2") } },
        h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: doImport, wk: "nestimport" }, busy ? "……" : "导进我的手机"),
        h(Btn, { t, disabled: busy, onClick: doCopy, wk: "nestcopy" }, "复制"),
        (it.mine || admin) ? h(Btn, { t, disabled: busy, onClick: doDelete, wk: "nestdelete" }, armed ? "再点就删" : "删除") : null) : null);
  }

  // ── 传一个上去 ─────────────────────────────────────────────
  //   两条路：从手机里选一份文件（每一类都行），或者从 app 里现成的挑（世界书、文风、预设、人设）。
  //   主题、聊天美化、CSS 在 app 里没有「挑一个」这回事，就是文件或者贴一份。
  function Upload({ t, props, initialKind, onClose, onDone }) {
    const [kind, setKind] = useState(initialKind || "theme");
    const [pick, setPick] = useState({});        // 世界书可多选；其余单选（存 id → true）
    const [file, setFile] = useState(null);       // { payload, title, note, name }：选了文件就用它
    const [text, setText] = useState("");          // 主题 / 美化 / CSS：贴一份
    const [title, setTitle] = useState(""), [intro, setIntro] = useState(""), [nick, setNick] = useState("");
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    useEffect(() => { setPick({}); setText(""); setFile(null); }, [kind]);
    const styles = (loadJSON("x_offlineStyles", []) || []).filter(s => s && s.prompt);
    const presets = window.StylePresets ? window.StylePresets.list() : [];
    const chars = (props.characters || []).filter(c => c && !c.npc && c.persona);
    const lore = props.loreEntries || [];
    const rows = kind === "lore" ? lore.map(e => ({ id: e.id, name: e.title || "未命名", sub: String(e.payload || "").slice(0, 40) }))
      : kind === "style" ? styles.map(s => ({ id: s.key, name: s.name, sub: String(s.prompt).slice(0, 40) }))
      : kind === "preset" ? presets.map(p => ({ id: p.id, name: p.name, sub: (p.mods || []).length + " 个模块" }))
      : kind === "persona" ? chars.map(c => ({ id: c.id, name: c.name, sub: c.tagline || "" })) : null;
    const multi = kind === "lore";
    const toggle = id => { setFile(null); setPick(p => multi ? Object.assign({}, p, { [id]: !p[id] }) : { [id]: true }); };
    const chosen = Object.keys(pick).filter(k => pick[k]);
    useEffect(() => {   // 选了一样就顺手把名字填上（她还能改）
      if (!rows || title || multi) return;
      const r = rows.find(x => x.id === chosen[0]); if (r) setTitle(String(r.name || "").slice(0, 40));
    }, [chosen.join(",")]);
    const readFile = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try {
        const got = fromFile(kind, await readAny(f), f.name);
        setFile(Object.assign({ name: f.name }, got)); setPick({}); setText("");
        if (!title && got.title) setTitle(got.title);
      } catch (err) { props.toast((err && err.message) || "这份文件读不出来"); }
    };
    const pasteKind = kind === "theme" || kind === "look" || kind === "css";
    const build = () => {
      if (file) return file.payload;
      if (pasteKind) {
        const s = String(text || "").replace(/^﻿/, "").trim();
        if (!s) throw new Error(kind === "css" ? "先选一份文件，或者把 CSS 贴进来" : "先选导出的那份文件，或者整份贴进来");
        return kind === "css" ? s : fromFile(kind, s, "").payload;
      }
      if (!chosen.length) throw new Error("先选一份文件，或者从下面挑一样");
      if (kind === "lore") return packLore(lore.filter(e => pick[e.id]));
      if (kind === "style") return packStyle(styles.find(s => s.key === chosen[0]));
      if (kind === "preset") return packPreset(presets.find(p => p.id === chosen[0]));
      return packPersona(chars.find(c => c.id === chosen[0]));
    };
    const send = async () => {
      let payload;
      try { payload = build(); } catch (e) { props.toast(e.message); return; }
      if (!title.trim()) { props.toast("起个名字吧"); return; }
      setBusy(true);
      try { const d = await api("/upload", { method: "POST", body: { kind, title: title.trim(), intro: intro.trim(), nick: nick.trim(), payload } }); props.toast("传上去了"); onDone(d.id, kind); }
      catch (e) { props.toast("没传上去：" + e.message); setBusy(false); }
    };
    const inputStyle = { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", resize: "none" };
    const field = (val, set, ph, max, area) => h(area ? "textarea" : "input", { value: val, maxLength: max, placeholder: ph, rows: area ? 3 : undefined,
      onChange: e => set(e.target.value), className: "w-full outline-none", style: inputStyle });
    const k = KIND[kind];
    const where = kind === "theme" ? "「设置 → 主题工作台」点「导出」存的 json（图标、壁纸、自传字体那几样别勾）"
      : kind === "look" ? "聊天设置里「整套美化」导出的 json，或「设置 → 聊天气泡」导出的 json（都别带图）"
      : kind === "css" ? ".css、.txt，或者老师给的 Word（.docx）；Word 改坏的引号和破折号会自动改回来"
      : kind === "lore" ? "世界书 json，或者一份 txt／docx（整份当一条词条）"
      : kind === "style" ? "一份 txt／docx／md，整份就是这条文风"
      : kind === "preset" ? "文风台导出的预设 json"
      : "角色卡 json，或者一份 txt／docx（名字、简介、人设照档案馆导入角色卡那样认）";
    return h("div", { "data-wk": "nestupload", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "传一个上去", onBack: onClose, bg: "transparent" }),
      h(Cubbies, { t, kind, noAll: true, onPick: setKind }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.6, padding: "0 4px 12px" } }, k.hint + "。不带图、不带记忆和聊天，传的人随时能删。"),
        // ① 从手机文件选
        h("div", { style: Object.assign({ padding: 14 }, card(t)) },
          h("div", { className: "flex items-center", style: { gap: 10 } },
            h(Seal, { k: kind, size: 32 }),
            h("div", { className: "min-w-0 flex-1" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600, color: t.ink } }, "从手机里选文件"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, where))),
          h("div", { style: { marginTop: 12 } },
            h(Btn, { t, solid: !file, onClick: () => fileRef.current && fileRef.current.click(), wk: "nestfile" }, file ? "换一份" : "选文件"),
            h("input", { ref: fileRef, type: "file", accept: ACCEPT[kind], style: { display: "none" }, onChange: readFile })),
          file ? h("div", { "data-wk": "nestfilechip", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 12.5, color: t.ink, padding: "8px 10px", borderRadius: 10, background: tint(k.color, "14") } },
            "已选 " + file.name + " · 读到" + file.note) : null),
        // ② 贴一份（主题／美化／CSS）或者从 app 里挑（其余四类）
        pasteKind ? h("div", { style: { marginTop: 14 } }, label(t, kind === "css" ? "或者直接把 CSS 贴在这儿" : "或者把那份文件的内容整份贴进来"),
          field(text, v => { setText(v); if (v) setFile(null); }, kind === "css" ? "[data-wk=\"bubble\"] { … }" : "{ \"kind\": … }", 262144, true))
        : h("div", { style: { marginTop: 14 } }, label(t, "或者从 app 里挑" + (multi ? "（可以挑好几条）" : "")),
          h("div", { style: Object.assign({ padding: "2px 12px" }, card(t)) },
            rows.length ? rows.map((r, i) => h("button", { key: r.id, onClick: () => toggle(r.id), className: "w-full flex items-start active:opacity-70",
              style: { gap: 10, minHeight: 46, padding: "10px 0", textAlign: "left", borderTop: i ? "1px solid " + t.line : "none" } },
              h("span", { style: { flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: multi ? 5 : 999, border: "1.5px solid " + (pick[r.id] ? k.color : t.line), background: pick[r.id] ? k.color : "transparent", color: "#fff", fontSize: 11, lineHeight: "15px", textAlign: "center" } }, pick[r.id] ? "✓" : ""),
              h("span", { className: "min-w-0" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, r.name),
                r.sub ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 1 } }, r.sub) : null)))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "14px 0" } }, "手上还没有能传的" + k.zh))),
        // ③ 名字、简介、署名
        h("div", { style: { marginTop: 18 } }, label(t, "名字"), field(title, setTitle, "别人在列表里看到的名字", 40)),
        h("div", { style: { marginTop: 12 } }, label(t, "说两句（可不填）"), field(intro, setIntro, "适合什么、怎么用", 200, true)),
        h("div", { style: { marginTop: 12 } }, label(t, "署名（可不填）"), field(nick, setNick, "不填就不显示", 20))),
      h("div", { className: "shrink-0 flex px-4 pt-3", style: { paddingBottom: "calc(12px + " + COMPOSER_PAD_BOTTOM + ")", borderTop: "1px solid " + t.line, background: tint(t.bg, "f2") } },
        h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: send, wk: "nestsend" }, busy ? "在传……" : "传上去")));
  }

  // ── 小窝首页 ─────────────────────────────────────────────
  function NestApp(props) {
    const t = useTheme();
    const [kind, setKind] = useState("");
    const [sort, setSort] = useState("new");      // new：新的在前；old：旧的在前
    const [q, setQ] = useState(""), [qLive, setQLive] = useState("");
    const [items, setItems] = useState([]), [more, setMore] = useState(false);
    const [loading, setLoading] = useState(false), [err, setErr] = useState("");
    const [open, setOpen] = useState(""), [uploading, setUploading] = useState(false);
    const [, bump] = useState(0);
    const listRef = useRef(null), scrollAt = useRef(0), taps = useRef(0);
    const load = async (off) => {
      setLoading(true); setErr("");
      try {
        const qs = "?sort=" + sort + (kind ? "&kind=" + kind : "") + (qLive ? "&q=" + encodeURIComponent(qLive) : "") + "&off=" + (off || 0);
        const d = await api("/list" + qs);
        const got = d.items || [];
        setItems(prev => off ? prev.concat(got) : got); setMore(got.length >= 30);
      } catch (e) { setErr(e.message); }
      setLoading(false);
    };
    useEffect(() => { load(0); }, [kind, sort, qLive]);
    useEffect(() => { const id = setTimeout(() => setQLive(q.trim()), 400); return () => clearTimeout(id); }, [q]);
    // 详情返回时回到原来滚到的位置（mobile-ui-layout.md §3）
    useEffect(() => { if (!open && !uploading && listRef.current) listRef.current.scrollTop = scrollAt.current; }, [open, uploading]);
    const enter = id => { if (listRef.current) scrollAt.current = listRef.current.scrollTop; setOpen(id); };
    // 管理口令：连点标题七下，填一次就记在这台手机上
    const onTitleTap = () => {
      taps.current += 1; if (taps.current < 7) return; taps.current = 0;
      requestAppPrompt("小窝管理", adminToken() ? "这台手机已经记着管理口令了。清空再确定就是撤掉。" : "填上管理口令，这台手机就能删任何一条。", adminToken(), v => {
        try { if (v && v.trim()) localStorage.setItem(ADMIN_KEY, v.trim()); else localStorage.removeItem(ADMIN_KEY); } catch (e) {}
        props.toast(v && v.trim() ? "记住了" : "撤掉了"); bump(x => x + 1);
      }, "确定");
    };
    if (open) return h(Detail, { t, id: open, props, onClose: () => setOpen(""), onGone: id => { setItems(l => l.filter(x => x.id !== id)); setOpen(""); } });
    if (uploading) return h(Upload, { t, props, initialKind: kind || "theme", onClose: () => setUploading(false),
      onDone: (id, k) => { setUploading(false); setSort("new"); if (k !== kind && kind) setKind(k); else load(0); } });
    const empty = (txt) => h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "36px 8px", textAlign: "center", lineHeight: 1.8, whiteSpace: "pre-line" } }, txt);
    return h("div", { "data-wk": "nestpage", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "秋秋小窝", sub: adminToken() ? "管理中" : "", onBack: props.onBack, onTitleTap, bg: "transparent",
        right: h("button", { "data-wk": "nestupbtn", onClick: () => setUploading(true), className: "active:opacity-60",
          style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, color: t.bg, background: t.ink, borderRadius: 999, minHeight: 30, padding: "0 11px" } }, "＋ 传一个") }),
      h(Cubbies, { t, kind, onPick: setKind }),
      h("div", { className: "shrink-0 flex items-center px-4 pb-3", style: { gap: 8 } },
        h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "搜名字、简介、署名", maxLength: 40, className: "flex-1 min-w-0 outline-none",
          style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "9px 13px" } }),
        h("button", { "data-wk": "nestsort", onClick: () => setSort(s => s === "new" ? "old" : "new"), className: "active:opacity-60",
          style: { flexShrink: 0, minHeight: 40, padding: "0 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12.5, color: t.ink } },
          sort === "new" ? "新的在前 ↓" : "旧的在前 ↑")),
      h("div", { ref: listRef, className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
        err ? empty(err)
        : (!items.length && !loading) ? empty(qLive ? "没找到。" : "这一格还空着。\n右上角「＋ 传一个」，放第一样进来。")
        : items.map(it => h("button", { key: it.id, "data-wk": "nestitem", "data-kind": it.kind, onClick: () => enter(it.id), className: "w-full text-left active:opacity-70 flex",
            style: Object.assign({ gap: 12, padding: 13, marginBottom: 10 }, card(t)) },
            h(Seal, { k: it.kind }),
            h("div", { className: "min-w-0 flex-1" },
              h("div", { className: "flex items-center", style: { gap: 6 } },
                h("span", { className: "min-w-0 truncate", style: { fontFamily: F_BODY, fontSize: 15, fontWeight: 600, color: t.ink } }, it.title),
                it.mine ? h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 10.5, color: t.fog, border: "1px solid " + t.line, borderRadius: 999, padding: "0 6px" } }, "我传的") : null),
              it.intro ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 3, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.intro) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 5 } },
                KZH[it.kind] + (it.nick ? " · " + it.nick : "") + " · " + ago(it.created))))),
        loading ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 4px", textAlign: "center" } }, "在拿……")
        : more ? h("div", { style: { padding: "6px 0 14px", textAlign: "center" } }, h(Btn, { t, onClick: () => load(items.length) }, "再往下翻")) : null));
  }

  window.NestApp = NestApp;
  window.Nest = { KINDS, importInto, cssInto, lookInto, fromFile, unWord, CSS_SLOTS, packLore, packStyle, packPreset, packPersona };
})();
