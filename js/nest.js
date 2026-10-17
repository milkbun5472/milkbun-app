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
    { key: "persona", zh: "人设", seal: "人", color: "#4f8e88", hint: "一个角色的名字、一句话简介和人设正文" },
    // 留言板（她 2026-10-16：「纯发帖子反馈之类的，给不玩 qq 的人也能反馈」）：只有一段字和截图，没有导入；
    //   不进「全部」那面墙（后端就不给），只在这一格里看
    { key: "post", zh: "留言板", seal: "言", color: "#7a6f62", hint: "想反馈的、想问的、想聊的，写一帖" }
  ];
  // 她给一帖标的：收到了／修好了（后端只认管理口令改）
  const STATUS = { got: { zh: "收到了", color: "#b38a35" }, fixed: { zh: "修好了", color: "#71834f" } };
  const StatusChip = ({ st, big }) => STATUS[st] ? h("span", { "data-wk": "nestpoststatus", "data-st": st, style: { display: "inline-block", fontFamily: F_BODY, fontSize: big ? 12.5 : 11,
    color: STATUS[st].color, border: "1px solid " + STATUS[st].color, borderRadius: 4, padding: big ? "1px 7px" : "0 5px", transform: "rotate(-4deg)" } }, STATUS[st].zh) : null;
  const KIND = {}; KINDS.forEach(k => { KIND[k.key] = k; });
  const KZH = {}; KINDS.forEach(k => { KZH[k.key] = k.zh; });

  // 管理口令只活在她自己那台手机的 qq_ 键里（不跟云同步、不进存档、不进包）
  const ADMIN_KEY = "qq_nestAdmin";
  const adminToken = () => { try { return localStorage.getItem(ADMIN_KEY) || ""; } catch (e) { return ""; } };

  // 小窝账号（她 2026-10-16：昵称+密码+恢复码；不登录能逛能导入，不能传不能评）。
  //   登录令牌是这台手机的凭据：放 qq_ 键——不进存档、不上云、不跟着导出走（no-small-warehouse.md 第 5 条），
  //   换手机就重新登录一次。名字缓存一份，进页面先显示，再去后端核对。
  const TOK_KEY = "qq_nestTok", ME_KEY = "qq_nestMe";
  const lsGet = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const sessionTok = () => lsGet(TOK_KEY);
  const cachedMe = () => { const v = tryJSON(lsGet(ME_KEY)); return v && v.id ? v : null; };
  function setSession(token, user) {
    try { localStorage.setItem(TOK_KEY, token); localStorage.setItem(ME_KEY, JSON.stringify({ id: user.id, name: user.name, created: user.created })); } catch (e) {}
  }
  function clearSession() { try { localStorage.removeItem(TOK_KEY); localStorage.removeItem(ME_KEY); } catch (e) {} }

  async function api(path, opts) {
    const o = opts || {};
    const headers = { "x-qq-device": typeof qqDeviceId === "function" ? qqDeviceId() : "" };
    const adm = adminToken(); if (adm) headers["x-qq-admin"] = adm;
    const tk = sessionTok(); if (tk) headers.authorization = "Bearer " + tk;
    if (o.body) headers["content-type"] = "application/json";
    let r;
    try { r = await fetch(NEST + path, { method: o.method || "GET", headers, body: o.body ? JSON.stringify(o.body) : undefined }); }
    catch (e) { throw new Error("连不上小窝，看看网络"); }
    let d = null; try { d = await r.json(); } catch (e) {}
    // 拿着令牌还被说「要登录」：令牌过期了或者在别处被作废了，清掉，下次照没登录处理
    if (r.status === 401 && tk) clearSession();
    // 前门没接上时会回整张网页（200 但不是 json）——别把它当成「空的小窝」
    if (r.ok && d == null) throw new Error("小窝的门没接上，晚点再来");
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
  function importInto(kind, payload, title, props, opts) {
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
      props.onAddChar(Object.assign({ name: String(d.name || title).slice(0, 20), tagline: String(d.tagline || "").slice(0, 40), persona: String(d.persona || d.description || "") },
        opts && opts.avatarImage ? { avatarImage: opts.avatarImage } : {}));
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
    const n = cols || (all.length % 4 && all.length % 3 === 0 ? 3 : 4);   // 「全部」+八格＝九格，排成 3×3
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

  // ── 账号那几样小图标（铃铛、书签、回形针）：跟上面 GNest 一样只画线 ──────────
  const IBell = p => h(Svg, p, h("path", { d: "M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" }), h("path", { d: "M10 20a2 2 0 004 0" }));
  const IBookmark = p => h(Svg, p, h("path", { d: "M7 4h10v16l-5-3.5L7 20z" }));
  const IClip = p => h(Svg, p, h("path", { d: "M16 7l-6.5 6.5a2 2 0 002.8 2.8L19 9.6a4 4 0 00-5.7-5.7L6.6 10.6a6 6 0 008.5 8.5L20 14.2" }));

  // 一张纸条歪多少：照 id 算，同一张每次都歪成一样，不会一刷新就乱抖
  const tilt = id => { let n = 0; for (const ch of String(id || "")) n = (n * 31 + ch.charCodeAt(0)) % 997; return ((n % 5) - 2) * 0.55; };
  const fmtDay = ts => { const d = new Date(ts || 0); return (d.getMonth() + 1) + "·" + d.getDate(); };
  const daysSince = ts => Math.max(1, Math.ceil((Date.now() - (ts || Date.now())) / 86400e3));

  // ── 一张纸条（她 2026-10-16 定的 A：布告栏剪贴，跟「我们的空间」里的本子、票根一家）──────
  //   顶上一截胶带（这一类的颜色），左上角盖这一类的章，标题用衬线，底下「by 谁」和赞、留言数。
  function Slip({ t, it, onOpen, big, foot }) {
    const K = KIND[it.kind] || { color: t.fog, seal: "?" };
    return h(big ? "div" : "button", { "data-wk": big ? "nestslipbig" : "nestslip", "data-kind": it.kind, onClick: big ? undefined : () => onOpen(it.id),
      className: big ? "" : "active:opacity-70",
      style: { position: "relative", display: big ? "block" : "inline-block", width: "100%", breakInside: "avoid", textAlign: "left",
        margin: big ? "8px 0 0" : "0 0 16px", padding: big ? "20px 16px 14px" : "14px 11px 11px",
        background: t.bg2, border: "1px solid " + t.line, transform: "rotate(" + tilt(it.id) * (big ? .5 : 1) + "deg)",
        boxShadow: "0 1px 0 " + t.line + ", 0 6px 12px -10px rgba(0,0,0,.35)" } },
      h("span", { "aria-hidden": true, style: { position: "absolute", top: big ? -9 : -7, left: "50%", marginLeft: big ? -30 : -22, width: big ? 60 : 44, height: big ? 16 : 13,
        background: tint(K.color, "55"), transform: "rotate(" + (-tilt(it.id) * 2) + "deg)" } }),
      h("div", { className: "flex items-center justify-between" },
        h("span", { "aria-hidden": true, style: { width: big ? 32 : 26, height: big ? 32 : 26, borderRadius: 999, border: "1.5px solid " + K.color, color: K.color,
          display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: F_BODY, fontSize: big ? 14 : 12, fontWeight: 700, transform: "rotate(-8deg)" } }, K.seal),
        h("span", { className: "inline-flex items-center", style: { gap: 6, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, h(StatusChip, { st: it.status, big }), (KZH[it.kind] || "") + " · " + fmtDay(it.created))),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: big ? 20 : 15, lineHeight: 1.35, color: t.ink, marginTop: 8, wordBreak: "break-word" } }, it.title),
      // 墙上那张：有小图就别一张拍立得（白边、反着歪一点），没有就只有字
      !big && it.thumb ? h("div", { "data-wk": "nestpolaroid", style: { margin: "8px 2px 2px", padding: "5px 5px 14px", background: "#fff", boxShadow: "0 2px 6px -3px rgba(0,0,0,.35)", transform: "rotate(" + (-tilt(it.id) * 1.6) + "deg)" } },
        h("img", { src: NEST + "/img/" + it.id + "/t", alt: "", loading: "lazy", style: { display: "block", width: "100%", height: "auto", background: t.bg } })) : null,
      big && it.intro ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.sub || t.ink, lineHeight: 1.75, marginTop: 8, whiteSpace: "pre-wrap" } }, it.intro) : null,
      !big && it.intro ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, lineHeight: 1.5, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.intro) : null,
      big && foot ? h("div", { style: { marginTop: 14, paddingTop: 10, borderTop: "1px dashed " + t.line } }, foot) : null,
      big ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub || t.fog, marginTop: 6 } }, "by " + (it.nick || "无名")),
      big ? null : h("div", { className: "flex items-center", style: { gap: 10, marginTop: 8, fontFamily: F_BODY, fontSize: 11.5, color: t.fog } },
        h("span", { className: "inline-flex items-center", style: { gap: 3, color: it.liked ? "#c0717f" : t.fog } }, h(IHeart, { size: 13, color: it.liked ? "#c0717f" : t.fog, filled: it.liked }), it.likes || 0),
        h("span", null, "留言 " + (it.comments || 0)),
        it.mine ? h("span", { style: { marginLeft: "auto" } }, "我贴的") : null));
  }
  // 一面墙：两列，纸条高矮不一，各自往下排（不是一格一格的方阵）。
  //   左右轮流放：最新的在左上、第二新的在右上——不用 CSS 分栏，那样会先把左边一整列排满，第二新的跑到第一张底下去
  const Wall = ({ t, items, onOpen }) => h("div", { "data-wk": "nestwall", className: "flex items-start", style: { gap: 14, paddingTop: 10 } },
    [0, 1].map(col => h("div", { key: col, className: "flex-1 min-w-0" },
      items.filter((_, i) => i % 2 === col).map(it => h(Slip, { key: it.id, t, it, onOpen })))));

  // ── 一条东西点进去（她 2026-10-16 定的 B：揭下来的那张纸条 + 一本留言簿）──────────
  function Detail({ t, id, props, me, onClose, onGone, onUser, onLogin }) {
    const [it, setIt] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
    const [armed, setArmed] = useState(false);
    const [placing, setPlacing] = useState(false);   // CSS／整套聊天美化：先问放哪儿
    const [follow, setFollow] = useState(null);       // null＝还不知道
    useEffect(() => { let live = true; api("/item/" + id).then(d => { if (live) setIt(d); }).catch(e => { if (live) setErr(e.message); }); return () => { live = false; }; }, [id]);
    useEffect(() => { if (!it || !it.uid || !me || me.id === it.uid) return; let live = true;
      api("/user/" + it.uid).then(d => { if (live) setFollow(!!d.followed); }).catch(() => {}); return () => { live = false; }; }, [it && it.uid, me && me.id]);
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
    const isPost = !!(it && it.kind === "post");
    const setStatus = async st => {
      try { await api("/admin/status", { method: "POST", body: { item: it.id, status: st } }); setIt(x => Object.assign({}, x, { status: st })); props.toast(st ? "标好了" : "标记擦掉了"); }
      catch (e) { props.toast(e.message); }
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
    // 赞、收藏：再点一次就收回；没登录先去登录
    const toggle = async which => {
      if (!me) { onLogin(); return; }
      const on = which === "like" ? !it.liked : !it.faved;
      try { const d = await api("/item/" + it.id + "/" + which, { method: on ? "POST" : "DELETE" });
        setIt(x => Object.assign({}, x, which === "like" ? { liked: on, likes: d.count } : { faved: on, favs: d.count })); }
      catch (e) { props.toast(e.message); }
    };
    const doFollow = async () => {
      if (!me) { onLogin(); return; }
      try { await api("/user/" + it.uid + "/follow", { method: follow ? "DELETE" : "POST" }); setFollow(!follow); props.toast(follow ? "不再关注了" : "关注了，她贴新纸条时你会收到小纸条"); }
      catch (e) { props.toast(e.message); }
    };
    let preview = "";
    if (it) {
      try {
        if (it.kind === "css" || it.kind === "post") preview = it.payload;
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
    const pill = ({ on, onClick, icon, txt, wk }) => h("button", { "data-wk": wk || undefined, "data-on": on ? "1" : "0", onClick, className: "active:opacity-60 inline-flex items-center justify-center",
      style: { gap: 5, minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid " + (on ? "#c0717f" : t.line), background: t.bg2, color: on ? "#c0717f" : t.ink, fontFamily: F_BODY, fontSize: 13.5 } }, icon, txt);
    return h("div", { "data-wk": "nestdetail", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: it ? KZH[it.kind] : "小窝", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-6" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, err) :
        !it ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, "在拿……") :
        h(React.Fragment, null,
          // 揭下来的那张纸条：底部是署名和关注，不放圆头像
          h(Slip, { t, it, big: true, foot: h("div", { className: "flex items-center justify-between" },
            h("button", { "data-wk": "nestsign", onClick: () => it.uid && onUser(it.uid), className: "active:opacity-60 min-w-0 truncate", style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, textAlign: "left" } }, "— " + (it.nick || "无名")),
            h("div", { className: "flex items-center", style: { gap: 10, flexShrink: 0 } },
              it.uid && (!me || me.id !== it.uid) ? h("button", { "data-wk": "nestfollow", "data-on": follow ? "1" : "0", onClick: doFollow, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 12.5, color: follow ? t.fog : (t.tint || t.ink) } }, follow ? "已关注" : "＋关注") : null,
              // 导入次数只给作者本人看（她 2026-10-16）：后端只在是你的东西时才带这个数，没带就不显示
              it.imports != null ? h("span", { "data-wk": "nestimports", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, "被导入 " + it.imports + " 次 · 只有你看得到") : null)) }),
          // 帖子：正文就摆在纸条底下，整段读，不折叠
          isPost ? h("div", { "data-wk": "nestpostbody", style: Object.assign({ marginTop: 14, fontFamily: F_BODY, fontSize: 14.5, color: t.ink, lineHeight: 1.85,
            whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 16 }, card(t)) }, preview) : null,
          // 动作：导入最大，赞、收藏、复制、删
          h("div", { "data-wk": "nestactions", className: "flex flex-wrap", style: { gap: 8, marginTop: 16 } },
            isPost ? null : h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: doImport, wk: "nestimport" }, busy ? "……" : "导进我的手机"),
            pill({ on: it.liked, onClick: () => toggle("like"), icon: h(IHeart, { size: 15, color: it.liked ? "#c0717f" : t.ink, filled: it.liked }), txt: it.likes || 0, wk: "nestlike" }),
            pill({ on: it.faved, onClick: () => toggle("fav"), icon: h(IBookmark, { size: 15, color: it.faved ? "#c0717f" : t.ink }), txt: it.faved ? "已收" : "收藏", wk: "nestfav" })),
          h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
            isPost ? null : h(Btn, { t, onClick: doCopy, wk: "nestcopy" }, "复制"),
            (it.mine || admin) ? h(Btn, { t, disabled: busy, onClick: doDelete, wk: "nestdelete" }, armed ? "再点就删" : "删除") : null),
          // 她（管理口令）给帖子打标：别人只看得到标记，看不到这一排
          isPost && admin ? h("div", { "data-wk": "nestpostmark", className: "flex", style: { gap: 8, marginTop: 8 } },
            ["got", "fixed", ""].map(st => h(Btn, { key: st || "none", t, solid: (it.status || "") === st, onClick: () => setStatus(st), wk: "nestmark" + (st || "none") }, st ? "标「" + STATUS[st].zh + "」" : "不标"))) : null,
          placing ? h(Place, { t, props, busy, slots: it.kind === "css" ? ["chat", "group", "offline"] : ["chat", "group"],
            onPick: placeOne, onAll: it.kind === "css" ? doImport : null, onCancel: () => setPlacing(false) }) : null,
          h(Shots, { t, it, props }),
          preview && !isPost ? h("div", { style: { marginTop: 18 } }, label(t, "里面是什么"),
            h("div", { "data-wk": "nestpreview", style: Object.assign({ fontFamily: it.kind === "css" ? "ui-monospace,Menlo,monospace" : F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.7,
              whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 14, maxHeight: "46vh", overflowY: "auto" }, card(t)) }, preview.slice(0, 6000))) : null,
          h(Guestbook, { t, item: it, me, props, onUser, onLogin, onCount: n => setIt(x => Object.assign({}, x, { comments: n })) }))));
  }

  // ── 预览截图：详情里那一排小相片，点开整屏看，左右翻 ─────────────────
  function Shots({ t, it, props }) {
    const [at, setAt] = useState(-1);
    if (!it.pics) return null;
    const src = k => NEST + "/img/" + it.id + "/" + k;
    const ks = Array.from({ length: it.pics }, (_, k) => k);
    // 存：小窝的图是后端地址，saveImgOriginal 也认网址了（engine.js）
    const save = item => window.saveImgOriginal ? window.saveImgOriginal(item.src, it.title || "小窝").then(ok => props.toast(ok ? "存下来了" : "这张没存成，再试一次")) : props.toast("这台设备存不了图");
    // 人设配套的头像（她 2026-10-16「写人设把配套人设头像放上去之类的可以选择保存使用」）：
    //   这张拉下来进图库（iv_ 门牌），跟人设一起建成新角色——跟手动导入是同一条路，只多带一张头像
    const asAvatar = async item => {
      try {
        const r = await fetch(item.src); if (!r.ok) throw new Error("取不到图");
        const key = await imgToVault(await blobToDataUrl(await r.blob()));
        const d = await api("/item/" + it.id + "?import=1");
        const msg = importInto(d.kind, d.payload, d.title, props, { avatarImage: key });
        setAt(-1); if (msg) props.toast(msg);
      } catch (e) { props.toast("没导进去：" + e.message); }
    };
    return h("div", { "data-wk": "nestshots", style: { marginTop: 18 } },
      label(t, "长这样"),
      h("div", { className: "flex", style: { gap: 10, overflowX: "auto", paddingBottom: 6 } },
        ks.map(k => h("button", { key: k, onClick: () => setAt(k), className: "active:opacity-70", style: { flexShrink: 0, padding: "6px 6px 18px", background: "#fff",
            boxShadow: "0 3px 8px -5px rgba(0,0,0,.4)", transform: "rotate(" + ((k % 2 ? 1 : -1) * 1.2) + "deg)" } },
          h("img", { src: src(k), alt: "预览 " + (k + 1), loading: "lazy", style: { display: "block", height: 190, width: "auto", maxWidth: 260, objectFit: "cover", background: t.bg } })))),
      at >= 0 ? h(ImageViewer, { at, onClose: () => setAt(-1), items: ks.map(k => ({ src: src(k) })),
        actions: () => [{ label: "存到手机", wk: "nestshotsave", onClick: save },
          it.kind === "persona" ? { label: "用这张当头像，导入这个人设", wk: "nestshotavatar", onClick: asAvatar } : null] }) : null);
  }

  // ── 留言簿：横格纸；一条留言写在格子上，回某一条是一张别着回形针的小便签 ──────────
  function Guestbook({ t, item, me, props, onUser, onLogin, onCount }) {
    const [list, setList] = useState(null), [text, setText] = useState(""), [to, setTo] = useState(null), [busy, setBusy] = useState(false);
    const inputRef = useRef(null);
    const load = () => api("/item/" + item.id + "/comments").then(d => { setList(d.comments || []); onCount((d.comments || []).filter(c => !c.deleted).length); }).catch(e => setList([]));
    useEffect(() => { load(); }, [item.id]);
    const send = async () => {
      if (!me) { onLogin(); return; }
      const body = text.trim(); if (!body) return;
      setBusy(true);
      try { await api("/item/" + item.id + "/comments", { method: "POST", body: { body, parent: to ? to.id : undefined } }); setText(""); setTo(null); await load(); }
      catch (e) { props.toast(e.message); }
      setBusy(false);
    };
    const del = c => requestAppConfirm("擦掉这一条？", c.mine ? "擦掉的是你自己写的这条。" : "你是这件东西的主人，能擦掉别人在你留言簿上写的。", async () => {
      try { await api("/comment/" + c.id, { method: "DELETE" }); await load(); } catch (e) { props.toast(e.message); }
    }, "擦掉");
    const replyTo = c => { if (!me) { onLogin(); return; } setTo(c); setTimeout(() => inputRef.current && inputRef.current.focus(), 0); };
    const top = (list || []).filter(c => !c.parent), kids = id => (list || []).filter(c => c.parent === id);
    const who = c => h("button", { onClick: () => onUser(c.uid), className: "active:opacity-60", style: { color: "inherit" } }, c.name + (c.uid === item.uid ? " · 主人" : ""));
    const tools = c => h("span", { style: { display: "inline-flex", gap: 12 } },
      c.deleted ? null : h("button", { "data-wk": "nestreply", onClick: () => replyTo(c), className: "active:opacity-60" }, "回她"),
      c.canDelete ? h("button", { "data-wk": "nesterase", onClick: () => del(c), className: "active:opacity-60" }, "擦掉") : null);
    // 横格：每 30px 一道线，字的行高也是 30，写上去刚好落在格子里
    const ruled = { backgroundImage: "repeating-linear-gradient(" + t.bg2 + " 0 29px," + t.line + " 29px 30px)", lineHeight: "30px" };
    return h("div", { "data-wk": "nestbook", style: { marginTop: 22 } },
      h("div", { style: Object.assign({ padding: "10px 14px 8px", background: t.bg2, border: "1px solid " + t.line }, ruled) },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, "留言簿" + (top.length ? " · " + (list || []).filter(c => !c.deleted).length + " 条" : "")),
        list == null ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "在翻……")
        : !top.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "还没人签过，第一句留给你。")
        : top.map(c => h("div", { key: c.id, "data-wk": "nestnote", style: { padding: "0 0 6px" } },
            h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 12, color: t.sub || t.fog } }, c.deleted ? h("span", null, "（这一条擦掉了）") : who(c), h("span", { style: { color: t.fog } }, ago(c.created))),
            c.deleted ? null : h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, wordBreak: "break-word", whiteSpace: "pre-wrap" } }, c.body),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, tools(c)),
            kids(c.id).map(r => h("div", { key: r.id, "data-wk": "nestclip", style: { position: "relative", margin: "6px 0 4px 18px", padding: "6px 10px", lineHeight: 1.6,
                background: "#faeeda", color: "#412402", transform: "rotate(" + tilt(r.id) * 0.6 + "deg)", boxShadow: "0 4px 8px -7px rgba(0,0,0,.4)" } },
              h("span", { "aria-hidden": true, style: { position: "absolute", top: -11, left: -9 } }, h(IClip, { size: 18, color: "#854f0b" })),
              h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: "#633806" } },
                h("span", null, who(r), r.to ? " → " + r.to : ""), h("span", null, ago(r.created))),
              h("div", { style: { fontFamily: F_BODY, fontSize: 13, wordBreak: "break-word", whiteSpace: "pre-wrap" } }, r.body),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#854f0b" } }, tools(r))))))),
      // 写一句：没登录就是一颗「登录以后才能签」
      h("div", { "data-wk": "nestcompose", style: { marginTop: 12 } },
        to ? h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 6 } },
          h("span", null, "回 " + to.name + "：" + String(to.body || "").slice(0, 20)), h("button", { onClick: () => setTo(null), className: "active:opacity-60" }, "不回了")) : null,
        me ? h("div", { className: "flex", style: { gap: 8 } },
            h("input", { ref: inputRef, value: text, maxLength: 500, onChange: e => setText(e.target.value), placeholder: to ? "回她一句" : "在留言簿上写一句",
              className: "flex-1 min-w-0 outline-none", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 13px" } }),
            h(Btn, { t, solid: true, disabled: busy || !text.trim(), onClick: send, wk: "nestsignbtn" }, busy ? "……" : "签上"))
          : h(Btn, { t, wide: true, onClick: onLogin, wk: "nestloginask" }, "登录以后才能签")));
  }

  // ── 一个人的页：顶上一张借书证，底下是她贴过的纸条墙 ─────────────────
  function Profile({ t, uid, me, props, onClose, onOpen, onUser, onLogin, onLogout }) {
    const [d, setD] = useState(null), [err, setErr] = useState(""), [tab, setTab] = useState("mine"), [extra, setExtra] = useState(null);
    const self = !!(me && me.id === uid);
    useEffect(() => { let live = true; setD(null); api("/user/" + uid).then(x => { if (live) setD(x); }).catch(e => { if (live) setErr(e.message); }); return () => { live = false; }; }, [uid]);
    // 拿回来的那份记着是哪一格的：切格子那一下，画面会先拿着上一格的数据画一遍（effect 晚一拍才清），
    //   「我收藏的」那份里没有人的名单，拿去画「我关注的」就炸了（她 2026-10-16 截图：extra.users.length）
    useEffect(() => { if (!self || tab === "mine") { setExtra(null); return; } let live = true; setExtra(null);
      api("/me/" + (tab === "favs" ? "favs" : "following")).then(x => { if (live) setExtra(Object.assign({ tab }, x)); }).catch(e => { if (live) setExtra({ tab, error: e.message }); }); return () => { live = false; }; }, [tab, self]);
    const got = extra && extra.tab === tab ? extra : null;
    const doFollow = async () => {
      if (!me) { onLogin(); return; }
      try { await api("/user/" + uid + "/follow", { method: d.followed ? "DELETE" : "POST" }); setD(x => Object.assign({}, x, { followed: !x.followed, followers: x.followers + (x.followed ? -1 : 1) })); }
      catch (e) { props.toast(e.message); }
    };
    const ban = () => requestAppConfirm("停用这个号？", "停用后她不能再传、不能再留言，已经贴的东西还在（要删去那一条里删）。", async () => {
      try { await api("/admin/ban", { method: "POST", body: { user: uid } }); props.toast("停用了"); } catch (e) { props.toast(e.message); }
    }, "停用");
    const changePw = () => requestAppPrompt("改密码", "先填现在的密码。", "", old => {
      if (!old) return;
      requestAppPrompt("改密码", "再填新密码（至少 6 位）。", "", async neu => {
        if (!neu) return;
        try { await api("/auth/password", { method: "POST", body: { old, password: neu } }); props.toast("改好了"); } catch (e) { props.toast(e.message); }
      }, "改好");
    }, "下一步");
    const stat = (n, txt) => h("div", { style: { textAlign: "center" } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, n), h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, txt));
    return h("div", { "data-wk": "nestprofile", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: self ? "我的小窝" : (d ? d.user.name : "小窝"), onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, err) :
        !d ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, "在拿……") :
        h(React.Fragment, null,
          // 借书证：名字、来了多少天、贴了多少、关注和粉丝
          h("div", { "data-wk": "nestcard", style: { background: t.bg2, border: "1px solid " + t.line, padding: "14px 16px", position: "relative" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, letterSpacing: 2 } }, "小 窝 借 书 证"),
            h("div", { className: "flex items-end justify-between", style: { marginTop: 8, borderBottom: "1px solid " + t.line, paddingBottom: 10 } },
              h("div", { className: "min-w-0" },
                h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: 22, color: t.ink } }, d.user.name),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2 } }, "来了 " + daysSince(d.user.created) + " 天")),
              self ? null : h(Btn, { t, solid: !d.followed, onClick: doFollow, wk: "nestfollow" }, d.followed ? "已关注" : "＋ 关注")),
            h("div", { className: "flex justify-around", style: { marginTop: 10 } }, stat(d.items.length, "贴的"), stat(d.following, "关注"), stat(d.followers, "粉丝"))),
          self ? h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
            h(Btn, { t, onClick: changePw, wk: "nestpw" }, "改密码"), h(Btn, { t, onClick: onLogout, wk: "nestlogout" }, "退出登录")) : null,
          !self && adminToken() ? h("div", { style: { marginTop: 10 } }, h(Btn, { t, onClick: ban, wk: "nestban" }, "停用这个号")) : null,
          self ? h("div", { style: { marginTop: 16 } }, h(Cubbies, { t, kind: tab, onPick: setTab, cols: 3, flush: true,
            items: [{ key: "mine", zh: "我贴的" }, { key: "favs", zh: "我收藏的" }, { key: "following", zh: "我关注的" }] })) : null,
          tab === "mine" || !self ? (d.items.length ? h(Wall, { t, items: d.items, onOpen }) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "28px 4px", textAlign: "center" } }, self ? "还没贴过，回首页右上角「＋ 传一个」。" : "她还没贴过东西。"))
          : !got ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, "在拿……")
          : got.error ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, got.error)
          : tab === "favs" ? ((got.items || []).length ? h(Wall, { t, items: got.items, onOpen }) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "28px 4px", textAlign: "center" } }, "还没收藏过。"))
          : h("div", { style: { marginTop: 10 } }, (got.users || []).length ? got.users.map(u => h("button", { key: u.id, "data-wk": "nestperson", onClick: () => onUser(u.id), className: "w-full flex items-center justify-between active:opacity-70",
              style: { minHeight: 46, padding: "0 4px", borderBottom: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 14, color: t.ink } }, h("span", { className: "truncate" }, u.name), h("span", { style: { color: t.fog, fontSize: 12 } }, "›")))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "28px 4px", textAlign: "center" } }, "还没关注谁。")))));
  }

  // ── 收到的小纸条：谁评了你、谁回了你、谁关注了你、关注的人贴了新的 ──────────
  function Notices({ t, props, onClose, onOpen, onUser }) {
    const [list, setList] = useState(null), [err, setErr] = useState("");
    useEffect(() => { let live = true;
      api("/notices").then(d => { if (!live) return; setList(d.notices || []); api("/notices/seen", { method: "POST" }).catch(() => {}); }).catch(e => { if (live) setErr(e.message); });
      return () => { live = false; }; }, []);
    const line = n => n.kind === "reply" ? (n.title ? "在《" + n.title + "》里回了你" : "回了你") : n.kind === "comment" ? "在《" + n.title + "》的留言簿上写了一句" : n.kind === "follow" ? "关注了你" : "贴了新纸条《" + n.title + "》";
    return h("div", { "data-wk": "nestnotices", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "收到的小纸条", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, err) :
        list == null ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, "在拿……") :
        !list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "36px 4px", textAlign: "center" } }, "还没有人给你递纸条。") :
        list.map(n => h("button", { key: n.id, "data-wk": "nestnotice", "data-on": n.seen ? "0" : "1", onClick: () => n.kind === "follow" ? onUser(n.fromUid) : onOpen(n.item),
            className: "w-full text-left active:opacity-70", style: { display: "block", marginBottom: 12, padding: "10px 12px", background: n.seen ? t.bg2 : "#faeeda", border: "1px solid " + t.line,
              transform: "rotate(" + tilt(n.id) * 0.5 + "deg)" } },
          h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: 12, color: n.seen ? t.fog : "#633806" } }, h("span", null, n.from), h("span", null, ago(n.created))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: n.seen ? t.ink : "#412402", marginTop: 2, lineHeight: 1.6 } }, line(n)),
          n.text ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: n.seen ? t.fog : "#854f0b", marginTop: 2 } }, "「" + n.text + "」") : null))));
  }

  // ── 登录／注册／用恢复码改密码；注册和恢复之后先给她看恢复码，确认存好了才进 ──────
  function Login({ t, props, onClose, onDone }) {
    const [mode, setMode] = useState("login"), [name, setName] = useState(""), [pw, setPw] = useState(""), [code, setCode] = useState("");
    const [busy, setBusy] = useState(false), [rec, setRec] = useState(null);   // rec：{ code, user }
    const go = async () => {
      setBusy(true);
      try {
        const path = mode === "login" ? "/auth/login" : mode === "register" ? "/auth/register" : "/auth/recover";
        const d = await api(path, { method: "POST", body: { name: name.trim(), password: pw, code } });
        setSession(d.token, d.user);
        if (d.recovery) setRec({ code: d.recovery, user: d.user }); else { props.toast("回来啦，" + d.user.name); onDone(d.user); }
      } catch (e) { props.toast(e.message); }
      setBusy(false);
    };
    const field = (val, set, ph, type, max) => h("input", { value: val, type: type || "text", maxLength: max, placeholder: ph, autoComplete: type === "password" ? (mode === "login" ? "current-password" : "new-password") : "username",
      onChange: e => set(e.target.value), className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: 15, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px 13px", marginTop: 10 } });
    if (rec) return h("div", { "data-wk": "nestrecovery", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "你的恢复码", bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.8 } }, "忘了密码，只能靠这一串改回来。它只在这里出现这一次，小窝也看不到原文——截图或者抄到备忘录里存好。"),
        h("div", { style: { margin: "18px 0", padding: "18px 12px", background: "#faeeda", border: "1px dashed #854f0b", textAlign: "center",
          fontFamily: "ui-monospace,Menlo,monospace", fontSize: 21, letterSpacing: 2, color: "#412402", userSelect: "all", wordBreak: "break-all" } }, rec.code),
        h("div", { className: "flex", style: { gap: 8 } },
          h(Btn, { t, wide: true, onClick: async () => props.toast((await copyText(rec.code)) ? "恢复码复制好了，记得贴到别处存着" : "复制不了，长按那串字自己选"), wk: "nestreccopy" }, "复制"),
          h(Btn, { t, solid: true, wide: true, onClick: () => onDone(rec.user), wk: "nestrecok" }, "我存好了"))));
    const tabs = [{ key: "login", zh: "登录" }, { key: "register", zh: "注册" }];
    return h("div", { "data-wk": "nestlogin", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: mode === "recover" ? "用恢复码改密码" : "小窝账号", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-8" },
        mode === "recover" ? null : h(Cubbies, { t, kind: mode, onPick: setMode, cols: 2, flush: true, items: tabs }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.7, marginTop: 14 } },
          mode === "register" ? "不用邮箱。起个昵称（2 到 16 个字，别人看到的就是它）、设个密码；注册完会给你一串恢复码。"
          : mode === "recover" ? "填昵称、注册时给你的那串恢复码，再设一个新密码。改完旧的恢复码作废，会给你一串新的。"
          : "不登录也能逛、能导入；要贴东西、留言、点赞收藏关注，先登录。"),
        field(name, setName, "昵称", "text", 16),
        mode === "recover" ? field(code, setCode, "恢复码（像 K7QM-3XPA-…）", "text", 40) : null,
        field(pw, setPw, mode === "login" ? "密码" : "新密码（至少 6 位）", "password", 64),
        h("div", { className: "flex", style: { marginTop: 16 } }, h(Btn, { t, solid: true, wide: true, disabled: busy || !name.trim() || !pw || (mode === "recover" && !code.trim()), onClick: go, wk: "nestloginbtn" },
          busy ? "……" : mode === "login" ? "登录" : mode === "register" ? "注册" : "改好密码并登录")),
        mode === "register" ? null : h("button", { "data-wk": "nestforgot", onClick: () => setMode(mode === "recover" ? "login" : "recover"), className: "active:opacity-60",
          style: { marginTop: 14, fontFamily: F_BODY, fontSize: 12.5, color: t.tint || t.ink } }, mode === "recover" ? "← 想起来了，回去登录" : "忘了密码？用恢复码")));
  }

  // ── 传一个上去 ─────────────────────────────────────────────
  //   两条路：从手机里选一份文件（每一类都行），或者从 app 里现成的挑（世界书、文风、预设、人设）。
  //   主题、聊天美化、CSS 在 app 里没有「挑一个」这回事，就是文件或者贴一份。
  // ── 不用先导出：主题、聊天美化直接拿手机上正用着的那套（她 2026-10-16：老师们传之前还得先弄成文件）──
  //   主题走主题工作台导出那一支 exportPackage，只是不出文件；图标图片、壁纸、自己传的字体不带（小窝不收图）。
  async function packCurrentTheme() {
    const S = window.ThemeStudio; if (!S) throw new Error("主题工作台没加载出来，退出再进来试试");
    const p = S.normalize(S.load());
    const pick = { css: true, base: true, bubble: true, wall: false,
      icons: !Object.keys(p.icons || {}).length, fonts: !(p.customFonts || []).length };
    const text = await S.exportPackage({ profile: p, baseTheme: loadJSON("x_theme", null) || undefined,
      bubbleSkin: typeof bubbleSkinSnapshot === "function" ? bubbleSkinSnapshot() : null, pick });
    if (Object.keys((JSON.parse(text).assets) || {}).length) throw new Error("你现在这套 CSS 里用了自己传的图，小窝先不收图：去主题工作台导出时把带图的那几样去掉，再选那份文件");
    return text;
  }
  // 聊天美化能挑的：「我存的美化」那一架、每个人的聊天窗、每个群，正用着的那一套
  function lookSources(chars) {
    const out = [], cs = loadJSON("x_chatSettings", {}) || {};
    (typeof chatLookShelf === "function" ? chatLookShelf() : []).forEach(x => out.push({ id: "s:" + x.id, name: x.name, sub: "我存的美化", look: chatLookClean(x.look) }));
    chars.forEach(c => { const L = chatLookClean(cs[c.id]); if (Object.keys(L).length) out.push({ id: "c:" + c.id, name: (cs[c.id].remark || c.name) + "的聊天窗", sub: "这个聊天窗现在用着的那一套", look: L }); });
    (loadJSON("x_groups", []) || []).forEach(g => { const L = g && chatLookClean({ chatBg: g.chatBg, layout: g.layout, customCSS: g.customCSS });
      if (L && Object.keys(L).length) out.push({ id: "g:" + g.id, name: (g.name || "群聊") + "（群）", sub: "群里只有背景、排版和 CSS", look: L }); });
    return out;
  }
  // CSS 能挑的：主题工作台的全局 CSS 和每一页的、每个聊天窗／群／线下自己写的那段
  function cssSources(chars) {
    const out = [], S = window.ThemeStudio, cs = loadJSON("x_chatSettings", {}) || {}, os = loadJSON("x_offlineSettings", {}) || {};
    const zh = {}; ((S && S.PAGES) || []).forEach(x => { zh[x[0]] = x[1]; });
    const put = (id, name, sub, css) => { css = String(css || "").trim(); if (css) out.push({ id, name, sub: sub + " · " + css.length + " 字", css }); };
    const p = S ? S.normalize(S.load()) : {};
    put("t:all", "全 App 的 CSS", "主题工作台", p.globalCSS);
    Object.keys(p.pageCSS || {}).forEach(k => put("t:" + k, (zh[k] || k) + "那一页的 CSS", "主题工作台", p.pageCSS[k]));
    chars.forEach(c => { const nm = (cs[c.id] && cs[c.id].remark) || c.name;
      put("c:" + c.id, nm + "的聊天窗", "只给 TA 写的 CSS", cs[c.id] && cs[c.id].customCSS);
      put("o:" + c.id, nm + "的线下", "线下自己写的 CSS", os[c.id] && os[c.id].customCSS); });
    (loadJSON("x_groups", []) || []).forEach(g => g && put("g:" + g.id, (g.name || "群聊") + "（群）", "群里自己写的 CSS", g.customCSS));
    return out;
  }
  function packCss(src) {
    if (/iv_[A-Za-z0-9_-]+/.test(src.css)) throw new Error("这段 CSS 里用了自己传的图，小窝先不收图：把图去掉再传");
    return src.css;
  }
  // 背景是自己传的图就不带（其余照带）；CSS 里还引用着自己的图就不收
  function packLook(src) {
    const look = Object.assign({}, src.look); let dropped = false;
    if (/iv_|^data:/.test(String(look.chatBg || ""))) { delete look.chatBg; dropped = true; }
    if (/iv_[A-Za-z0-9_-]+/.test(JSON.stringify(look))) throw new Error("这套的 CSS 或气泡里用了自己传的图，小窝先不收图：把图去掉再传");
    if (!Object.keys(look).length) throw new Error("这套里只有一张背景图，小窝不收图，没有别的可传");
    return { payload: JSON.stringify({ kind: "chat-look", v: 1, name: src.name, look, assets: {} }), dropped };
  }

  function Upload({ t, props, initialKind, onClose, onDone }) {
    const [kind, setKind] = useState(initialKind || "theme");
    const [pick, setPick] = useState({});        // 世界书可多选；其余单选（存 id → true）
    const [file, setFile] = useState(null);       // { payload, title, note, name }：选了文件就用它
    const [text, setText] = useState("");          // 主题 / 美化 / CSS：贴一份
    const [title, setTitle] = useState(""), [intro, setIntro] = useState("");
    const [shots, setShots] = useState([]);        // [{ full, thumb }]：已经压好的 dataURL；第一张顺手做墙上那张小图
    const shotRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    useEffect(() => { setPick({}); setText(""); setFile(null); }, [kind]);
    const styles = (loadJSON("x_offlineStyles", []) || []).filter(s => s && s.prompt);
    const presets = window.StylePresets ? window.StylePresets.list() : [];
    const chars = (props.characters || []).filter(c => c && !c.npc && c.persona);
    const lore = props.loreEntries || [];
    const looks = kind === "look" ? lookSources((props.characters || []).filter(c => c && !c.npc)) : [];
    const csses = kind === "css" ? cssSources((props.characters || []).filter(c => c && !c.npc)) : [];
    const rows = kind === "css" ? csses.map(x => ({ id: x.id, name: x.name, sub: x.sub }))
      : kind === "theme" ? [{ id: "cur", name: "我现在用的这套主题", sub: "页面 CSS、配色、气泡一起；图标图片、壁纸、自己传的字体不带" }]
      : kind === "look" ? looks.map(x => ({ id: x.id, name: x.name, sub: x.sub }))
      : kind === "lore" ? lore.map(e => ({ id: e.id, name: e.title || "未命名", sub: String(e.payload || "").slice(0, 40) }))
      : kind === "style" ? styles.map(s => ({ id: s.key, name: s.name, sub: String(s.prompt).slice(0, 40) }))
      : kind === "preset" ? presets.map(p => ({ id: p.id, name: p.name, sub: (p.mods || []).length + " 个模块" }))
      : kind === "persona" ? chars.map(c => ({ id: c.id, name: c.name, sub: c.tagline || "" })) : null;
    const multi = kind === "lore";
    const toggle = id => { setFile(null); setText(""); setPick(p => multi ? Object.assign({}, p, { [id]: !p[id] }) : { [id]: true }); };
    const chosen = Object.keys(pick).filter(k => pick[k]);
    useEffect(() => {   // 选了一样就顺手把名字填上（她还能改）
      if (!rows || title || multi || kind === "theme" || kind === "css") return;
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
    // 截图：一张一张压，压完还太大的（极少数，比如带透明的 PNG）就说一声跳过
    const dataBytes = u => Math.round((String(u).length - String(u).indexOf(",") - 1) * 3 / 4);
    const pickShots = async e => {
      const files = [...(e.target.files || [])]; e.target.value = "";
      const room = 3 - shots.length; if (!files.length) return;
      if (files.length > room) props.toast("预览图最多 3 张，多的先没放");
      const got = [];
      for (const f of files.slice(0, Math.max(0, room))) {
        try {
          let full = await resizeImageFile(f, 900, 0.78);
          if (dataBytes(full) > 250 * 1024) full = await resizeImageFile(f, 720, 0.62);
          const thumb = await resizeImageFile(f, 320, 0.7);
          if (dataBytes(full) > 250 * 1024 || dataBytes(thumb) > 46 * 1024) { props.toast("有一张图压完还是太大，换一张试试"); continue; }
          got.push({ full, thumb });
        } catch (err) { props.toast("有一张图读不出来"); }
      }
      if (got.length) setShots(x => x.concat(got).slice(0, 3));
    };
    const pasteKind = kind === "theme" || kind === "look" || kind === "css";
    const isPost = kind === "post";
    const build = async () => {
      if (isPost) { const s = String(text || "").trim(); if (!s) throw new Error("写两句想说的吧"); return s; }
      if (file) return file.payload;
      if (kind === "theme" && chosen.length) return await packCurrentTheme();
      if (kind === "css" && chosen.length) return packCss(csses.find(x => x.id === chosen[0]));
      if (kind === "look" && chosen.length) {
        const r = packLook(looks.find(x => x.id === chosen[0]));
        if (r.dropped) props.toast("背景是自己传的图，没带上；其余照传");
        return r.payload;
      }
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
      try { payload = await build(); } catch (e) { props.toast(e.message); return; }
      if (!title.trim()) { props.toast("起个名字吧"); return; }
      setBusy(true);
      try { const d = await api("/upload", { method: "POST", body: { kind, title: title.trim(), intro: intro.trim(), payload,
          images: shots.map(x => x.full), thumb: shots.length ? shots[0].thumb : undefined } }); props.toast("传上去了"); onDone(d.id, kind); }
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
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.6, padding: "0 4px 12px" } }, k.hint + (isPost ? "。大家都看得到，也都能在底下回；署名就是你的小窝昵称，随时能删。" : "。东西本身不带图、不带记忆和聊天（想让人看看长什么样，底下放截图）；署名就是你的小窝昵称，随时能删。")),
        // ① 从手机文件选（帖子没有文件）
        isPost ? null : h("div", { style: Object.assign({ padding: 14 }, card(t)) },
          h("div", { className: "flex items-center", style: { gap: 10 } },
            h(Seal, { k: kind, size: 32 }),
            h("div", { className: "min-w-0 flex-1" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, fontWeight: 600, color: t.ink } }, "从手机里选文件"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 2, lineHeight: 1.5 } }, where))),
          h("div", { style: { marginTop: 12 } },
            h(Btn, { t, solid: !file, onClick: () => fileRef.current && fileRef.current.click(), wk: "nestfile" }, file ? "换一份" : "选文件"),
            h("input", { ref: fileRef, type: "file", accept: ANY_FILE, style: { display: "none" }, onChange: readFile })),
          file ? h("div", { "data-wk": "nestfilechip", style: { marginTop: 10, fontFamily: F_BODY, fontSize: 12.5, color: t.ink, padding: "8px 10px", borderRadius: 10, background: tint(k.color, "14") } },
            "已选 " + file.name + " · 读到" + file.note) : null),
        // ② 从 app 里直接挑（七类都能挑）；主题／美化／CSS 还能整份贴
        rows ? h("div", { style: { marginTop: 14 } }, label(t, (kind === "theme" ? "或者直接用手机上正用着的" : kind === "look" ? "或者直接挑一套正用着的、存过的" : kind === "css" ? "或者直接挑一段手机上写着的" : "或者从 app 里挑") + (multi ? "（可以挑好几条）" : "")),
          h("div", { style: Object.assign({ padding: "2px 12px" }, card(t)) },
            rows.length ? rows.map((r, i) => h("button", { key: r.id, onClick: () => toggle(r.id), className: "w-full flex items-start active:opacity-70",
              style: { gap: 10, minHeight: 46, padding: "10px 0", textAlign: "left", borderTop: i ? "1px solid " + t.line : "none" } },
              h("span", { style: { flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: multi ? 5 : 999, border: "1.5px solid " + (pick[r.id] ? k.color : t.line), background: pick[r.id] ? k.color : "transparent", color: "#fff", fontSize: 11, lineHeight: "15px", textAlign: "center" } }, pick[r.id] ? "✓" : ""),
              h("span", { className: "min-w-0" },
                h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, r.name),
                r.sub ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 1 } }, r.sub) : null)))
              : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "14px 0" } }, "手上还没有能传的" + k.zh))) : null,
        isPost ? h("div", { "data-wk": "nestpostwrite" }, label(t, "想说什么（最多 4000 字）"),
          h("textarea", { value: text, maxLength: 4000, rows: 8, placeholder: "哪里不好用、想要什么、遇到了什么，都可以写；配一张截图更好懂",
            onChange: e => setText(e.target.value), className: "w-full outline-none", style: Object.assign({}, inputStyle, { resize: "vertical" }) })) : null,
        pasteKind ? h("div", { style: { marginTop: 14 } }, label(t, kind === "css" ? "或者直接把 CSS 贴在这儿" : "也可以把导出的那份文件内容整份贴进来"),
          field(text, v => { setText(v); if (v) { setFile(null); setPick({}); } }, kind === "css" ? "[data-wk=\"bubble\"] { … }" : "{ \"kind\": … }", 262144, true)) : null,
        // ③ 名字、简介、署名
        h("div", { style: { marginTop: 18 } }, label(t, isPost ? "标题" : "名字"), field(title, setTitle, isPost ? "一句话说是什么事" : "别人在列表里看到的名字", 40)),
        isPost ? null : h("div", { style: { marginTop: 12 } }, label(t, "说两句（可不填）"), field(intro, setIntro, "适合什么、怎么用", 200, true)),
        // ④ 预览截图：别人逛的时候先看个大概再决定要不要
        h("div", { "data-wk": "nestshotpick", style: { marginTop: 14 } }, label(t, isPost ? "截图（可不放，最多 3 张）" : "预览截图（可不放，最多 3 张；第一张会贴在墙上那张纸条上）"),
          h("div", { className: "flex flex-wrap", style: { gap: 10 } },
            shots.map((x, k) => h("div", { key: k, style: { position: "relative", padding: "4px 4px 12px", background: "#fff", boxShadow: "0 2px 6px -3px rgba(0,0,0,.35)" } },
              h("img", { src: x.thumb, alt: "", style: { display: "block", width: 76, height: 100, objectFit: "cover" } }),
              h("button", { "aria-label": "拿掉这张", onClick: () => setShots(a => a.filter((_, i) => i !== k)), className: "active:opacity-60",
                style: { position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: 999, background: t.ink, color: t.bg, fontSize: 13, lineHeight: "24px" } }, "×"))),
            shots.length < 3 ? h("button", { "data-wk": "nestshotadd", onClick: () => shotRef.current && shotRef.current.click(), className: "active:opacity-60",
              style: { width: 84, height: 116, border: "1.5px dashed " + t.line, borderRadius: 4, background: t.bg2, color: t.fog, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, whiteSpace: "pre-line" } }, "＋\n加截图") : null),
          h("input", { ref: shotRef, type: "file", accept: "image/*", multiple: true, style: { display: "none" }, onChange: pickShots }))),
      h("div", { className: "shrink-0 flex px-4 pt-3", style: { paddingBottom: "calc(12px + " + COMPOSER_PAD_BOTTOM + ")", borderTop: "1px solid " + t.line, background: tint(t.bg, "f2") } },
        h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: send, wk: "nestsend" }, busy ? "在传……" : isPost ? "贴上去" : "传上去")));
  }

  // ── 小窝首页：一面贴满纸条的墙 ────────────────────────────────
  //   顶上：铃铛（收到的小纸条，红点＝没看过的）、「＋ 传一个」；分类抽屉；搜索（同时搜东西和人）；
  //   「我」那一格：登录了就是我的借书证，没登录就是去登录。
  //   页面一层一层叠：首页 → 详情／某人的页／小纸条／登录 → 再往里；返回回到上一层，列表位置不丢。
  function NestApp(props) {
    const t = useTheme();
    const [kind, setKind] = useState("");
    const [sort, setSort] = useState("new");      // new：新的在前；old：旧的在前（她 2026-10-16：只要「最新」这一种排法）
    const [q, setQ] = useState(""), [qLive, setQLive] = useState("");
    const [items, setItems] = useState([]), [more, setMore] = useState(false), [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(false), [err, setErr] = useState("");
    const [stack, setStack] = useState([]);        // [{ v: "item"|"user"|"notices"|"login"|"upload", id }]
    const [me, setMe] = useState(cachedMe), [unread, setUnread] = useState(0);
    const [, bump] = useState(0);
    const listRef = useRef(null), scrollAt = useRef(0), taps = useRef(0), after = useRef(null);
    const top = stack[stack.length - 1] || null;
    const push = v => { if (!stack.length && listRef.current) scrollAt.current = listRef.current.scrollTop; setStack(s => s.concat([v])); };
    const pop = () => setStack(s => s.slice(0, -1));
    // 我是谁 + 红点：进页面、回到首页时都核对一次（令牌过期了就退回没登录）
    const refreshMe = () => { if (!sessionTok()) { setMe(null); setUnread(0); return; }
      api("/me").then(d => { if (d.user) { setMe(d.user); setUnread(d.unread || 0); } else { clearSession(); setMe(null); setUnread(0); } }).catch(() => {}); };
    useEffect(() => { refreshMe(); }, []);
    useEffect(() => { if (!top) refreshMe(); }, [stack.length]);
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
    useEffect(() => { load(0); }, [kind, sort, qLive, me && me.id]);
    useEffect(() => { const id = setTimeout(() => setQLive(q.trim()), 400); return () => clearTimeout(id); }, [q]);
    // 搜的时候顺手搜人：名字对得上的放在墙上面那一排
    useEffect(() => { if (!qLive) { setPeople([]); return; } let live = true; api("/users?q=" + encodeURIComponent(qLive)).then(d => { if (live) setPeople(d.users || []); }).catch(() => {}); return () => { live = false; }; }, [qLive]);
    // 详情返回时回到原来滚到的位置（mobile-ui-layout.md §3）
    useEffect(() => { if (!top && listRef.current) listRef.current.scrollTop = scrollAt.current; }, [top]);
    // 要登录才能做的事：先去登录，登完接着做
    const needLogin = then => { after.current = then || null; push({ v: "login" }); };
    // 管理口令：连点标题七下，填一次就记在这台手机上
    const onTitleTap = () => {
      taps.current += 1; if (taps.current < 7) return; taps.current = 0;
      requestAppPrompt("小窝管理", adminToken() ? "这台手机已经记着管理口令了。清空再确定就是撤掉。" : "填上管理口令，这台手机就能删任何一条。", adminToken(), v => {
        try { if (v && v.trim()) localStorage.setItem(ADMIN_KEY, v.trim()); else localStorage.removeItem(ADMIN_KEY); } catch (e) {}
        props.toast(v && v.trim() ? "记住了" : "撤掉了"); bump(x => x + 1);
      }, "确定");
    };
    const openItem = id => push({ v: "item", id }), openUser = id => push({ v: "user", id });
    const logout = async () => { try { await api("/auth/logout", { method: "POST" }); } catch (e) {} clearSession(); setMe(null); setUnread(0); setStack([]); props.toast("退出了"); };
    if (top && top.v === "item") return h(Detail, { key: top.id, t, id: top.id, props, me, onClose: pop, onUser: openUser, onLogin: () => needLogin(),
      onGone: id => { setItems(l => l.filter(x => x.id !== id)); pop(); } });
    if (top && top.v === "user") return h(Profile, { key: top.id, t, uid: top.id, me, props, onClose: pop, onOpen: openItem, onUser: openUser, onLogin: () => needLogin(), onLogout: logout });
    if (top && top.v === "notices") return h(Notices, { t, props, onClose: pop, onOpen: openItem, onUser: openUser });
    if (top && top.v === "login") return h(Login, { t, props, onClose: pop, onDone: u => { const next = after.current; after.current = null; setMe(u); setStack(s => s.slice(0, -1).concat(next ? [next] : [])); } });
    if (top && top.v === "upload") return h(Upload, { t, props, initialKind: kind || "theme", onClose: pop,
      onDone: (id, k) => { setStack([]); setSort("new"); if (k !== kind && kind) setKind(k); else load(0); } });
    const empty = (txt) => h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "36px 8px", textAlign: "center", lineHeight: 1.8, whiteSpace: "pre-line" } }, txt);
    const bell = h("button", { "data-wk": "nestbell", "aria-label": "收到的小纸条", onClick: () => me ? push({ v: "notices" }) : needLogin({ v: "notices" }), className: "active:opacity-60 relative",
        style: { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.ink } },
      h(IBell, { size: 20 }),
      unread ? h("span", { "data-wk": "nestdot", style: { position: "absolute", top: 3, right: 2, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, background: "#c0503f", color: "#fff",
        fontFamily: F_BODY, fontSize: 10, lineHeight: "15px", textAlign: "center" } }, unread > 99 ? "99+" : unread) : null);
    return h("div", { "data-wk": "nestpage", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "秋秋小窝", sub: adminToken() ? "管理中" : "", onBack: props.onBack, onTitleTap, bg: "transparent",
        right: h("div", { className: "flex items-center", style: { gap: 4 } }, bell,
          h("button", { "data-wk": "nestupbtn", onClick: () => me ? push({ v: "upload" }) : needLogin({ v: "upload" }), className: "active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: 12.5, fontWeight: 600, color: t.bg, background: t.ink, borderRadius: 999, minHeight: 30, padding: "0 11px" } }, kind === "post" ? "＋ 写一帖" : "＋ 传一个")) }),
      h(Cubbies, { t, kind, onPick: setKind }),
      h("div", { className: "shrink-0 flex items-center px-4 pb-3", style: { gap: 8 } },
        h("div", { "data-wk": "nestsearch", className: "flex-1 min-w-0 flex items-center", style: { gap: 6, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "0 11px" } },
          h(ISearch, { size: 15, color: t.fog }),
          h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "搜东西，也搜人", maxLength: 40, className: "flex-1 min-w-0 outline-none",
            style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: "transparent", border: "none", padding: "9px 0" } })),
        h("button", { "data-wk": "nestme", onClick: () => me ? openUser(me.id) : needLogin(), className: "active:opacity-60 truncate",
          style: { flexShrink: 0, maxWidth: 96, minHeight: 40, padding: "0 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12.5, color: t.ink } },
          me ? me.name : "登录"),
        h("button", { "data-wk": "nestsort", onClick: () => setSort(s => s === "new" ? "old" : "new"), className: "active:opacity-60",
          style: { flexShrink: 0, minHeight: 40, padding: "0 10px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 12.5, color: t.ink } },
          sort === "new" ? "新↓" : "旧↑")),
      h("div", { ref: listRef, className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
        people.length ? h("div", { "data-wk": "nestpeople", className: "flex flex-wrap", style: { gap: 8, padding: "4px 0 10px" } },
          people.map(u => h("button", { key: u.id, onClick: () => openUser(u.id), className: "active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "5px 12px" } }, "@" + u.name))) : null,
        err ? empty(err)
        : (!items.length && !loading) ? empty(qLive ? "没找到。" : "这面墙还空着。\n右上角「＋ 传一个」，贴第一张上去。")
        : h(Wall, { t, items, onOpen: openItem }),
        loading ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 4px", textAlign: "center" } }, "在拿……")
        : more ? h("div", { style: { padding: "6px 0 14px", textAlign: "center" } }, h(Btn, { t, onClick: () => load(items.length) }, "再往下翻")) : null));
  }

  window.NestApp = NestApp;
  window.Nest = { KINDS, packCurrentTheme, lookSources, packLook, cssSources, packCss, importInto, cssInto, lookInto, fromFile, unWord, CSS_SLOTS, packLore, packStyle, packPreset, packPersona, api, setSession, clearSession, sessionTok, cachedMe, tilt };
})();
