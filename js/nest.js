// ============================================================
// 秋秋小窝（2026-10-08）
//
// 大家把自己做的东西传上来、别人点一下就导进自己的手机：
//   主题、聊天美化、CSS、世界书、文风、预设台预设、人设。
// 定下来的几条：大家自己传、传的人能删自己的、管理口令什么都能删；第一版不收图（2026-10-17 起收了：美化里的图压小了一起传）；
//   不分尺度；没有举报键；只按时间排（新的在前／旧的在前），不按导入数排。
//
// 东西存在 Cloudflare 那边（qiuqiu-nest），这一页只走秋秋自己的 /nest/ 前门——
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
  // 地址和管理口令只写在 js/nest-watch.js 那一份（开机就加载：管理员的新消息提醒要在点进来之前就响）
  const NEST = window.NestWatch.NEST;

  // 每一类一个色：列表里那枚小印章、详情顶上那条色带都用它（不靠颜色认类别，印章上还写着字）
  const KINDS = [
    { key: "theme", zh: "主题", seal: "主", color: "#a8794a", hint: "整套主题包：配色、页面 CSS、字体、气泡" },
    { key: "look", zh: "聊天美化", seal: "美", color: "#c0717f", hint: "聊天设置里「整套美化」导出的那一套，或「聊天气泡」导出的气泡包" },
    { key: "css", zh: "CSS", seal: "C", color: "#5f86a3", hint: "一段 CSS：导进来时选放给全 App，还是只给某一个聊天" },
    { key: "lore", zh: "世界书", seal: "书", color: "#71834f", hint: "一组世界书词条" },
    { key: "style", zh: "文风", seal: "文", color: "#8f72a8", hint: "线下文风库里的一条文风" },
    { key: "preset", zh: "预设", seal: "预", color: "#b38a35", hint: "文风预设台里搭好的一份预设" },
    { key: "persona", zh: "人设", seal: "人", color: "#4f8e88", hint: "一个角色的名字、一句话简介和人设正文" },
    // 文档（她 2026-10-19：「不能单独一个放各种文档可以下载复制的吗」——有人传的是一整份给角色的玩法提示词，
    //   哪一类都不是）：一段纯文字，不导进哪里，别人点进去整份看、复制、存成文件
    { key: "doc", zh: "文档", seal: "档", color: "#5d7a8c", hint: "提示词、玩法开局、教程、说明……不导进哪里，别人点进去整份复制或者存成文件" },
    // 梗与话题（她 2026-10-31，群里许愿「上传聊天梗和聊天话题的地方」）：一条一个梗/话题，一段短字＋可配截图；
    //   详情里「放进聊天」能勾好几个人，进到那几个人聊天 ＋ 面板的「话题卡」里，点一张填进输入框（只给自己用）
    { key: "topic", zh: "梗与话题", seal: "梗", color: "#b5654a", hint: "一个聊天梗、一个话题、一句能逗 TA 的话；别人能放进自己的聊天里用" },
    // 留言板（她 2026-10-16：「纯发帖子反馈之类的，给不玩 qq 的人也能反馈」）：只有一段字和截图，没有导入；
    //   不进「全部」那面墙（后端就不给），只在这一格里看
    { key: "post", zh: "留言板", seal: "言", color: "#7a6f62", hint: "想反馈的、想问的、想聊的，写一帖" }
  ];
  // 名字旁边的称号（她 2026-10-17：「管理模式的专属称号放在我名字旁边，这样评论也能让她们知道我是谁」）：
  //   一枚小小的朱红印章，后端只让管理口令挂；没挂的人这里什么都不画
  const Badge = ({ b }) => b ? h("span", { "data-wk": "nestbadge", style: { display: "inline-block", marginLeft: 5, padding: "0 5px", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", lineHeight: "16px",
    color: "#fff", background: "#a0383f", borderRadius: 3, verticalAlign: "1px", letterSpacing: .5, whiteSpace: "nowrap" } }, b) : null;
  // 她给一帖标的：收到了／修好了（后端只认管理口令改）
  const STATUS = { got: { zh: "收到了", color: "#b38a35" }, fixed: { zh: "修好了", color: "#71834f" } };
  const StatusChip = ({ st, big }) => STATUS[st] ? h("span", { "data-wk": "nestpoststatus", "data-st": st, style: { display: "inline-block", fontFamily: F_BODY, fontSize: big ? 12.5 : 11,
    color: STATUS[st].color, border: "1px solid " + STATUS[st].color, borderRadius: 4, padding: big ? "1px 7px" : "0 5px", transform: "rotate(-4deg)" } }, STATUS[st].zh) : null;
  const KIND = {}; KINDS.forEach(k => { KIND[k.key] = k; });
  const KZH = {}; KINDS.forEach(k => { KZH[k.key] = k.zh; });

  // 管理口令只活在她自己那台手机的 qq_ 键里（不跟云同步、不进存档、不进包）；读法在 js/nest-watch.js
  const ADMIN_KEY = window.NestWatch.ADMIN_KEY;
  const adminToken = window.NestWatch.adminToken;

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
    // 超时（群里 2026-10-20：「卡主不动了我以为我出问题了」「有时候进去要加载好久」）：
    //   小窝在海外，国内连过去时快时慢；原来请求没有超时，网一卡就一直转「在拿……」，看着像 app 死了。
    //   拿东西等 15 秒，传东西（带图）等 60 秒；到点就停下说清楚，页面上给「再试一次」。
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), o.body ? 60000 : 15000) : null;
    let r;
    try { r = await fetch(NEST + path, { method: o.method || "GET", headers, body: o.body ? JSON.stringify(o.body) : undefined, signal: ctl ? ctl.signal : undefined }); }
    catch (e) { throw new Error(ctl && ctl.signal.aborted ? "小窝那边太慢了，等了一会儿还没回。网好一点再试一次" : "连不上小窝，看看网络"); }
    finally { if (tm) clearTimeout(tm); }
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
    persona: ".json,.txt,.md,.docx,application/json,text/plain",
    doc: ".txt,.md,.docx,.json,text/plain"
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
      if (Object.values(d.assets || {}).some(v => /^data:(?!image\/)/i.test(String(v)))) throw new Error("这个主题包里带着字体文件，小窝不收字体：导出时把「字体」的勾去掉再存一份");
      return { payload: t, title: base, note: "主题包" };
    }
    if (kind === "look") {
      if (!d || !(d.kind === "chat-look" || (/-theme$/.test(String(d.kind || "")) && d.bubbleSkin))) throw new Error("这不是聊天美化：要聊天设置里「整套美化」导出的，或「聊天气泡」那一栏导出的 json");
      return { payload: t, title: base, note: d.kind === "chat-look" ? "整套聊天美化" : "气泡包" };
    }
    if (kind === "css") return { payload: /\.docx$/i.test(name || "") ? unWord(t) : t, title: base, note: t.length + " 字的 CSS" };
    if (kind === "lore") {
      const list = d ? (typeof loreEntriesFromJson === "function" ? loreEntriesFromJson(d) : (Array.isArray(d) ? d : (d.entries || null))) : null;
      if (d && !(list && list.length)) throw new Error("这份 json 里没有世界书词条");
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
    if (kind === "doc") return { payload: t, title: base, note: t.length + " 字的文档" };
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

  // 主屏图标 GNest 在 js/components.js（小窝整份点进去才加载，图标开机就要画）

  // ── 那一排分类：小窝是一面格子柜，每一格是一只抽屉 ─────────────
  //   选中的那只是「拉出来了」：浮起来、有影子、拉手上墨；没选的推在柜子里，暗一些、拉手是细线。
  //   CSS「放哪儿」那三格、上传页挑类别也是这面柜子（items / noAll 传进来）。
  // 管理中才有的一行：新消息提醒最近一次查得怎么样（她 2026-10-19「我还是收不到小窝提醒」——先让它看得见）
  //   查的那一套在 js/nest-watch.js；这一行只读它最近一次的结果，「现在查一次」就地再查一遍
  function WatchLine({ t, onGate, onVerify }) {
    const [, redraw] = useState(0);
    const [busy, setBusy] = useState(false);
    const W = window.NestWatch, L = W && W.lastCheck ? W.lastCheck() : null;
    const hm = ms => { const d = new Date(ms); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); };
    const txt = !L ? "新消息提醒：这次打开还没查过（开 app 十秒后查第一次，之后每十分钟）"
      : L.ok ? "新消息提醒：" + hm(L.at) + " 查过" + (L.top ? "，墙上最新一条 " + hm(L.top) : "")
      : "新消息提醒没查成（" + hm(L.at) + "）：" + L.err;
    const now = async () => { setBusy(true); try { await W.check(); W.markSeen(); } catch (e) {} setBusy(false); redraw(x => x + 1); };
    return h("div", { "data-wk": "nestwatchline", className: "shrink-0 flex items-center px-4", style: { gap: 8, paddingBottom: 6 } },
      h("div", { className: "flex-1 min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: L && !L.ok ? "#a0383f" : t.fog, lineHeight: 1.5 } }, txt),
      onVerify ? h("button", { "data-wk": "nestverifybtn", onClick: onVerify, className: "shrink-0 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.ink, border: "1px solid " + t.line, borderRadius: 999, minHeight: 26, padding: "0 9px" } }, "验") : null,
      onGate ? h("button", { "data-wk": "nestgatebtn", onClick: onGate, className: "shrink-0 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.ink, border: "1px solid " + t.line, borderRadius: 999, minHeight: 26, padding: "0 9px" } }, "门") : null,
      h("button", { "data-wk": "nestwatchnow", disabled: busy, onClick: now, className: "shrink-0 active:opacity-60",
        style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.ink, border: "1px solid " + t.line, borderRadius: 999, minHeight: 26, padding: "0 9px", opacity: busy ? .5 : 1 } }, busy ? "在查……" : "现在查一次"));
  }

  // 首页那一排能收起（她 2026-10-16：「3x3太占位置了」）：收着时只剩一行写着现在看的是哪一格，点开挑完自己收回去
  function Cubbies({ t, kind, onPick, noAll, items, cols, flush, fold }) {
    const [open, setOpen] = useState(false);
    if (fold && !open) {
      const cur = KIND[kind];
      return h("div", { "data-wk": "nestcubbies", className: "shrink-0 px-4 pt-2 pb-3" },
        h("button", { "data-wk": "nestcubbyfold", onClick: () => setOpen(true), className: "w-full flex items-center active:opacity-70",
          style: { gap: 8, minHeight: 44, padding: "0 14px", borderRadius: 12, background: hex6(t.ink) ? t.ink + "0d" : t.bg2, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } },
          h("span", { style: { width: 14, height: 3, borderRadius: 2, background: cur ? cur.color : t.ink } }),
          h("span", { style: { fontWeight: 600 } }, cur ? cur.zh : "全部"),
          h("span", { style: { marginLeft: "auto", fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog } }, "换一格 ▾")));
    }
    const pick0 = onPick;
    onPick = fold ? (k => { setOpen(false); pick0(k); }) : pick0;
    const all = items || (noAll ? [] : [{ key: "", zh: "全部" }]).concat(KINDS);
    // 排几列：整除哪个就用哪个，不留一行孤零零的两格。2026-10-19 加了「文档」以后：首页「全部」+九格＝十格排 5×2，
    //   传东西那页没有「全部」，九格排 3×3
    const n = cols || (all.length % 5 === 0 && all.length > 5 ? 5 : all.length % 4 && all.length % 3 === 0 ? 3 : 4);
    const frame = hex6(t.ink) ? t.ink + "0d" : t.bg2;
    const grid = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + n + ", 1fr)", gap: 5, padding: 5, borderRadius: 14, background: frame } },
      all.map(k => {
        const on = k.key === kind, kc = (KIND[k.key] || {}).color;
        return h("button", { key: k.key || "all", "data-wk": "nestcubby", "data-on": on ? "1" : "0", onClick: () => onPick(k.key),
          className: "active:opacity-70 flex flex-col items-center justify-center",
          style: { minHeight: 48, padding: "6px 2px 5px", borderRadius: 9, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", letterSpacing: .5,
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
    style: { minHeight: 44, padding: "0 18px", borderRadius: 12, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", fontWeight: solid ? 600 : 400,
      border: "1px solid " + (solid ? t.ink : t.line), background: solid ? t.ink : t.bg2, color: solid ? t.bg : t.ink } }, children);

  // 一枚小印章：这一类的一个字，盖在列表每一条的左边
  const Seal = ({ k, size }) => {
    const K = KIND[k] || { seal: "?", color: "#888" }, s = size || 34;
    return h("span", { "aria-hidden": true, style: { flexShrink: 0, width: s, height: s, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: tint(K.color, "1f"), color: K.color, border: "1px solid " + tint(K.color, "40"), fontFamily: F_BODY, fontSize: s * .42, fontWeight: 700 } }, K.seal);
  };
  const card = t => ({ background: t.bg2, borderRadius: 14, border: "1px solid " + t.line, boxShadow: "0 1px 2px rgba(0,0,0,.04)" });
  const label = (t, txt) => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, letterSpacing: .5, marginBottom: 8 } }, txt);

  // ── 放哪儿：全 App，或者某一个人的聊天窗／某一个群／某一个人的线下 ─────
  //   CSS 三处都能放；整套聊天美化只有聊天窗和群（线下没有那一套皮）。
  function Place({ t, props, busy, slots, onPick, onAll, onCancel, note }) {
    const [tab, setTab] = useState(slots[0]);
    const [sel, setSel] = useState([]);   // 勾上的那几个；换标签就清空，免得人和群混着放
    useEffect(() => { setSel([]); }, [tab]);
    const chars = (props.characters || []).filter(c => c && !c.npc);
    const list = tab === "group" ? (props.groups || []).map(g => ({ id: g.id, name: g.name || "未命名的群" })) : chars.map(c => ({ id: c.id, name: c.name }));
    const zh = { chat: "聊天窗", group: "群聊", offline: "线下" };
    return h("div", { "data-wk": "nestplace", style: Object.assign({ marginTop: 16, padding: 14 }, card(t)) },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 600, color: t.ink } }, "放哪儿"),
      onAll ? h(React.Fragment, null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.6 } }, "全 App：接在全局 CSS 草稿后面，预览满意再保存。只给一处：放进那个人或那个群自己的 CSS，直接生效。"),
        h("div", { className: "flex", style: { gap: 8, marginTop: 12 } },
          h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: onAll, wk: "nestplaceall" }, "全 App"),
          h(Btn, { t, disabled: busy, onClick: onCancel }, "先不放")))
      : h(React.Fragment, null,
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4, lineHeight: 1.6 } }, note || "整套换上，直接生效。不满意在那一页的设置里点「↶ 回到上一版」。"),
        h("div", { style: { marginTop: 10 } }, h(Btn, { t, disabled: busy, onClick: onCancel }, "先不放"))),
      h("div", { "data-wk": "nestplacetabs", style: { marginTop: 14 } },
        h(Cubbies, { t, kind: tab, onPick: setTab, cols: slots.length, flush: true, items: slots.map(k => ({ key: k, zh: zh[k] })) })),
      h("div", { style: { marginTop: 6 } },
        list.length ? h(React.Fragment, null, list.map(x => { const on = sel.some(y => y.id === x.id);
          return h("button", { key: x.id, "data-wk": "nestplacerow", "data-on": on ? "1" : "0", disabled: busy, onClick: () => setSel(p => on ? p.filter(y => y.id !== x.id) : p.concat([x])), className: "w-full flex items-center justify-between active:opacity-70 disabled:opacity-40",
          style: { minHeight: 46, padding: "0 4px", borderBottom: "1px solid " + t.line, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, textAlign: "left" } },
          h("span", { className: "truncate" }, x.name),
          h("span", { "aria-hidden": true, style: { flexShrink: 0, width: 20, height: 20, borderRadius: 6, border: "1.5px solid " + (on ? t.ink : t.line), background: on ? t.ink : "transparent", color: t.bg2, fontSize: 13, lineHeight: "17px", textAlign: "center" } }, on ? "✓" : "")); }),
          h("div", { style: { marginTop: 12 } }, h(Btn, { t, solid: true, wide: true, disabled: busy || !sel.length, onClick: () => onPick(tab, sel), wk: "nestplacego" }, sel.length ? "放进勾上的 " + sel.length + " 个" : "先勾要放的")))
        : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "14px 4px" } }, tab === "group" ? "还没有群" : "还没有角色")));
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
        h("span", { className: "inline-flex items-center", style: { gap: 6, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, h(StatusChip, { st: it.status, big }), it.returned ? h("span", { "data-wk": "nestreturnedchip", style: { fontFamily: F_BODY, fontSize: big ? 12.5 : 11, color: "#a0383f", border: "1px solid #a0383f", borderRadius: 4, padding: "0 5px" } }, "退回了") : null, (KZH[it.kind] || "") + " · " + fmtDay(it.created) + (it.edited ? " · 改于 " + fmtDay(it.edited) : ""))),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: big ? 20 : 15, lineHeight: 1.35, color: t.ink, marginTop: 8, wordBreak: "break-word" } }, it.title),
      // 墙上那张：有小图就别一张拍立得（白边、反着歪一点），没有就只有字
      !big && it.thumb ? h("div", { "data-wk": "nestpolaroid", style: { margin: "8px 2px 2px", padding: "5px 5px 14px", background: "#fff", boxShadow: "0 2px 6px -3px rgba(0,0,0,.35)", transform: "rotate(" + (-tilt(it.id) * 1.6) + "deg)" } },
        h("img", { src: NEST + "/img/" + it.id + "/t" + (it.edited ? "?v=" + it.edited : ""), alt: "", loading: "lazy", style: { display: "block", width: "100%", height: "auto", background: t.bg } })) : null,
      big && it.intro ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.sub || t.ink, lineHeight: 1.75, marginTop: 8, whiteSpace: "pre-wrap" } }, it.intro) : null,
      !big && it.intro ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, it.intro) : null,
      big && foot ? h("div", { style: { marginTop: 14, paddingTop: 10, borderTop: "1px dashed " + t.line } }, foot) : null,
      big ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub || t.fog, marginTop: 6 } }, "by " + (it.nick || "无名"), h(Badge, { b: it.badge })),
      big ? null : h("div", { className: "flex items-center", style: { gap: 10, marginTop: 8, fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } },
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
  function Detail({ t, id, props, me, onClose, onGone, onUser, onLogin, onEdit }) {
    const [it, setIt] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
    const [placing, setPlacing] = useState(false);   // CSS／整套聊天美化：先问放哪儿
    const [follow, setFollow] = useState(null);       // null＝还不知道
    const [tries, setTries] = useState(0);   // 「再试一次」
    useEffect(() => { let live = true; setErr(""); api("/item/" + id).then(d => { if (live) setIt(d); }).catch(e => { if (live) setErr(e.message); }); return () => { live = false; }; }, [id, tries]);
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
    // 一次放进好几处（她 2026-10-20：「搞个多选吧宝宝不要全选」）：勾几个放几个，只算一次导入
    const placeMany = async (where, picks) => {
      if (!picks || !picks.length) return;
      setBusy(true);
      try {
        const d = await api("/item/" + it.id + "?import=1");
        const done = [];
        for (const x of picks) {
          if (it.kind === "topic") {
            if (typeof window.topicCardsPut !== "function") break;
            const text = String(d.payload || "").trim(), card0 = { id: "nest:" + it.id, title: d.title || "", text, ts: Date.now() };
            window.topicCardsPut(x.id, l => [card0].concat(l.filter(y => y.id !== card0.id)).slice(0, 60)); done.push(x.name); continue;
          }
          try { if (it.kind === "css") cssInto(where, x.id, d.payload, d.title, props); else await lookInto(where, x.id, d.payload, props); done.push(x.name); } catch (_) {}
        }
        if (!done.length) throw new Error("一处都没放成");
        if (it.kind === "topic") { props.toast("放进 " + (done.length === 1 ? "「" + done[0] + "」" : done.length + " 个人") + " 的聊天了：聊天里点 ＋ →「话题卡」，点一张就填进输入框"); setPlacing(false); setBusy(false); return; }
        const what = where === "group" ? "群" : where === "offline" ? "人的线下" : "人的聊天窗";
        props.toast("已放进 " + (done.length === 1 ? "「" + done[0] + "」" : done.length + " 个" + what) + (done.length < picks.length ? "（有 " + (picks.length - done.length) + " 处没放成）" : "") + "，去那儿看看；不满意在那一页的设置里点「↶ 回到上一版」");
        setPlacing(false);
      } catch (e) { props.toast("没放进去：" + e.message); }
      setBusy(false);
    };
    const isPost = !!(it && it.kind === "post");
    const isTopic = !!(it && it.kind === "topic");   // 梗与话题：整段摆出来，「放进聊天」勾几个人
    const isDoc = !!(it && it.kind === "doc");   // 文档：没有「导入」，整份摆出来，复制 + 存成文件
    const doSave = async () => {
      const name = String(it.title || "文档").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "文档";
      try { await saveTextFile(name + ".txt", it.payload, "text/plain"); } catch (e) { props.toast("没存成：" + ((e && e.message) || "")); }
    };
    // 退回给作者（她 2026-10-17）：不删，写一句原因，作者收到小纸条，改好一保存就重新摆出来
    const [retOpen, setRetOpen] = useState(false), [retText, setRetText] = useState("");
    const doReturn = async () => {
      const reason = retText.trim(); if (!reason) { props.toast("写一句为什么退回"); return; }
      setBusy(true);
      try { await api("/admin/return", { method: "POST", body: { item: it.id, reason } }); setIt(x => Object.assign({}, x, { returned: reason })); setRetOpen(false); setRetText(""); props.toast("退回去了，作者会收到小纸条"); }
      catch (e) { props.toast(e.message); }
      setBusy(false);
    };
    const setStatus = async st => {
      try { await api("/admin/status", { method: "POST", body: { item: it.id, status: st } }); setIt(x => Object.assign({}, x, { status: st })); props.toast(st ? "标好了" : "标记擦掉了"); }
      catch (e) { props.toast(e.message); }
    };
    const doCopy = async () => {
      const ok = await copyText(it.payload);
      props.toast(ok ? (it.kind === "css" ? "CSS 已复制" : it.kind === "doc" ? "整份复制好了" : "已复制，可以贴进对应那一页的导入框") : "这台手机不让复制，长按预览里的字试试");
    };
    const doDelete = () => requestAppConfirm("删掉这条？", "从小窝里撤下来，大家都看不到了，删了找不回来。", doDeleteNow, "删掉");
    const doDeleteNow = async () => {
      setBusy(true);
      try { await api("/item/" + id, { method: "DELETE" }); props.toast("删掉了"); onGone(id); }
      catch (e) { props.toast("没删成：" + e.message); setBusy(false); }
    };
    // 赞、收藏：再点一次就收回。点心不用登录（她 2026-10-29「能不能不登录也能点赞」）——
    //   没账号就记在这台设备名下；收藏还是要账号，它是「我自己的一份清单」，换台手机得找得回来。
    const toggle = async which => {
      if (!me && which !== "like") { onLogin(); return; }
      const on = which === "like" ? !it.liked : !it.faved;
      try { const d = await api("/item/" + it.id + "/" + which, { method: on ? "POST" : "DELETE" });
        setIt(x => Object.assign({}, x, which === "like" ? { liked: on, likes: d.count } : { faved: on, favs: d.count })); }
      catch (e) { props.toast(e.message); }
    };
// 导进手机之前先给老师点个心（她 2026-10-29：「确实不喜欢为什么要导入呢」）。
    //   不是收费：点心不用登录、点完还能自己收回去；只是把「拿了东西」和「说一声喜欢」放在同一下。
    //   已经点过的照旧一下导入，不会重复问。
    const importWithHeart = () => {
      if (it.liked) { doImport(); return; }
      requestAppConfirm("先给老师点个心", "这是老师熬夜捏出来的。点一下心再导进来，TA 看得到。",
        async () => { await toggle("like"); doImport(); }, "点心并导入");
    };
    // 梗与话题也一样先点心（她 2026-10-31「这个梗为啥没有导入点赞」）：点过的直接去勾人
    const placeWithHeart = () => {
      if (it.liked) { setPlacing(true); return; }
      requestAppConfirm("先给老师点个心", "这是老师想出来的梗。点一下心再拿去用，TA 看得到。",
        async () => { await toggle("like"); setPlacing(true); }, "点心并放进聊天");
    };
        const doFollow = async () => {
      if (!me) { onLogin(); return; }
      try { await api("/user/" + it.uid + "/follow", { method: follow ? "DELETE" : "POST" }); setFollow(!follow); props.toast(follow ? "不再关注了" : "关注了，她贴新纸条时你会收到小纸条"); }
      catch (e) { props.toast(e.message); }
    };
    let preview = "";
    if (it) {
      try {
        if (it.kind === "css" || it.kind === "post" || it.kind === "doc" || it.kind === "topic") preview = it.payload;
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
      style: { gap: 5, minHeight: 44, padding: "0 14px", borderRadius: 12, border: "1px solid " + (on ? "#c0717f" : t.line), background: t.bg2, color: on ? "#c0717f" : t.ink, fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))" } }, icon, txt);
    return h("div", { "data-wk": "nestdetail", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: it ? KZH[it.kind] : "小窝", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-6" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, err,
          h("div", { style: { marginTop: 12 } }, h(Btn, { t, onClick: () => setTries(x => x + 1), wk: "nestretry" }, "再试一次"))) :
        !it ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, "在拿……") :
        h(React.Fragment, null,
          // 揭下来的那张纸条：底部是署名和关注，不放圆头像
          h(Slip, { t, it, big: true, foot: h("div", { className: "flex items-center justify-between" },
            h("button", { "data-wk": "nestsign", onClick: () => it.uid && onUser(it.uid), className: "active:opacity-60 min-w-0 truncate", style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, textAlign: "left" } }, "— " + (it.nick || "无名"), h(Badge, { b: it.badge })),
            h("div", { className: "flex items-center", style: { gap: 10, flexShrink: 0 } },
              it.uid && (!me || me.id !== it.uid) ? h("button", { "data-wk": "nestfollow", "data-on": follow ? "1" : "0", onClick: doFollow, className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: follow ? t.fog : (t.tint || t.ink) } }, follow ? "已关注" : "＋关注") : null,
              // 导入次数只给作者本人看（她 2026-10-16）：后端只在是你的东西时才带这个数，没带就不显示
              it.imports != null ? h("span", { "data-wk": "nestimports", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog } }, "被导入 " + it.imports + " 次 · 只有你看得到") : null)) }),
          // 被退回的：作者和她看得到原因
          it.returned ? h("div", { "data-wk": "nestreturned", style: { marginTop: 14, padding: "12px 14px", border: "1px solid #a0383f", borderRadius: 10, background: tint("#a0383f", "10"), fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", lineHeight: 1.7, color: t.ink } },
            h("div", { style: { fontWeight: 600, color: "#a0383f" } }, "这件被退回了，先收起来，别人看不到"),
            h("div", { style: { whiteSpace: "pre-wrap", marginTop: 4 } }, "原因：" + it.returned),
            it.mine ? h("div", { style: { fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, marginTop: 4 } }, "照着改一改，点「编辑」保存，就会重新摆回墙上原来的位置。") : null) : null,
          // 帖子：正文就摆在纸条底下，整段读，不折叠
          isPost || isDoc || isTopic ? h("div", { "data-wk": isDoc ? "nestdocbody" : isTopic ? "nesttopicbody" : "nestpostbody", style: Object.assign({ marginTop: 14, fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.85,
            whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 16 }, card(t)) }, preview) : null,
          // 动作：导入最大，赞、收藏、复制、删
          h("div", { "data-wk": "nestactions", className: "flex flex-wrap", style: { gap: 8, marginTop: 16 } },
            // 不认得的类别（小窝那头新开了一类、这台还没更新）：别硬当成包去导，说一声去更新（她 2026-10-31 截图：梗被当 json 导，报 JSON Parse error）
            !KIND[it.kind] ? h("div", { "data-wk": "nestunknownkind", className: "flex-1", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, alignSelf: "center" } }, "这一类要更新 app 才能用：把 app 关掉重开一次就好")
            : isPost ? null : isDoc ? h(Btn, { t, solid: true, wide: true, onClick: doCopy, wk: "nestdoccopy" }, "复制全文")
              : isTopic ? h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: placeWithHeart, wk: "nesttopicplace" }, it.liked ? "放进聊天" : "点个心并放进聊天")
              : h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: importWithHeart, wk: "nestimport" }, busy ? "……" : it.liked ? "导进我的手机" : "点个心并导入"),
            pill({ on: it.liked, onClick: () => toggle("like"), icon: h(IHeart, { size: 15, color: it.liked ? "#c0717f" : t.ink, filled: it.liked }), txt: it.likes || 0, wk: "nestlike" }),
            pill({ on: it.faved, onClick: () => toggle("fav"), icon: h(IBookmark, { size: 15, color: it.faved ? "#c0717f" : t.ink }), txt: it.faved ? "已收" : "收藏", wk: "nestfav" })),
          h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
            isPost ? null : isDoc ? h(Btn, { t, onClick: doSave, wk: "nestdocsave" }, "存成文件") : h(Btn, { t, onClick: doCopy, wk: "nestcopy" }, "复制"),
            (it.mine || admin) ? h(Btn, { t, disabled: busy, onClick: () => onEdit(it), wk: "nestedit" }, "编辑") : null,
            (it.mine || admin) ? h(Btn, { t, disabled: busy, onClick: doDelete, wk: "nestdelete" }, "删除") : null),
          admin && !it.returned ? (retOpen
            ? h("div", { "data-wk": "nestreturnform", style: { marginTop: 10 } },
                h("textarea", { value: retText, maxLength: 300, rows: 3, placeholder: "写给作者：为什么退回、要改哪儿", onChange: e => setRetText(e.target.value), className: "w-full outline-none",
                  style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", resize: "vertical" } }),
                h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
                  h(Btn, { t, onClick: () => setRetOpen(false), wk: "nestreturncancel" }, "算了"),
                  h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: doReturn, wk: "nestreturnsend" }, "退回给作者")))
            : h("div", { className: "flex", style: { marginTop: 8 } }, h(Btn, { t, onClick: () => setRetOpen(true), wk: "nestreturn" }, "退回给作者改"))) : null,
          // 她（管理口令）给帖子打标：别人只看得到标记，看不到这一排
          isPost && admin ? h("div", { "data-wk": "nestpostmark", className: "flex", style: { gap: 8, marginTop: 8 } },
            ["got", "fixed", ""].map(st => h(Btn, { key: st || "none", t, solid: (it.status || "") === st, onClick: () => setStatus(st), wk: "nestmark" }, st ? "标「" + STATUS[st].zh + "」" : "不标"))) : null,
          placing ? h(Place, { t, props, busy, slots: it.kind === "css" ? ["chat", "group", "offline"] : it.kind === "topic" ? ["chat"] : ["chat", "group"],
            onPick: placeMany, onAll: it.kind === "css" ? doImport : null, note: it.kind === "topic" ? "勾几个人：放进 TA 们聊天 ＋ 面板的「话题卡」里，想用的时候点一张填进输入框，自己改了再发。" : "", onCancel: () => setPlacing(false) }) : null,
          h(Shots, { t, it, props }),
          preview && !isPost && !isDoc && !isTopic ? h("div", { style: { marginTop: 18 } }, label(t, "里面是什么"),
            h("div", { "data-wk": "nestpreview", style: Object.assign({ fontFamily: it.kind === "css" ? "ui-monospace,Menlo,monospace" : F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.7,
              whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 14, maxHeight: "46vh", overflowY: "auto" }, card(t)) }, preview.slice(0, 6000))) : null,
          h(Guestbook, { t, item: it, me, props, onUser, onLogin, onCount: n => setIt(x => Object.assign({}, x, { comments: n })) }))));
  }

  // ── 预览截图：详情里那一排小相片，点开整屏看，左右翻 ─────────────────
  function Shots({ t, it, props }) {
    const [at, setAt] = useState(-1);
    if (!it.pics) return null;
    const src = k => NEST + "/img/" + it.id + "/" + k + (it.edited ? "?v=" + it.edited : "");
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
    const who = c => h("button", { onClick: () => onUser(c.uid), className: "active:opacity-60", style: { color: "inherit" } }, c.name, h(Badge, { b: c.badge }), c.uid === item.uid ? " · 主人" : "");
    const tools = c => h("span", { style: { display: "inline-flex", gap: 12 } },
      c.deleted ? null : h("button", { "data-wk": "nestreply", onClick: () => replyTo(c), className: "active:opacity-60" }, "回她"),
      c.canDelete ? h("button", { "data-wk": "nesterase", onClick: () => del(c), className: "active:opacity-60" }, "擦掉") : null);
    // 横格：每 30px 一道线，字的行高也是 30，写上去刚好落在格子里
    const ruled = { backgroundImage: "repeating-linear-gradient(" + t.bg2 + " 0 29px," + t.line + " 29px 30px)", lineHeight: "30px" };
    return h("div", { "data-wk": "nestbook", style: { marginTop: 22 } },
      h("div", { style: Object.assign({ padding: "10px 14px 8px", background: t.bg2, border: "1px solid " + t.line }, ruled) },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink } }, "留言簿" + (top.length ? " · " + (list || []).filter(c => !c.deleted).length + " 条" : "")),
        list == null ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "在翻……")
        : !top.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog } }, "还没人签过，第一句留给你。")
        : top.map(c => h("div", { key: c.id, "data-wk": "nestnote", style: { padding: "0 0 6px" } },
            h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub || t.fog } }, c.deleted ? h("span", null, "（这一条擦掉了）") : who(c), h("span", { style: { color: t.fog } }, ago(c.created))),
            c.deleted ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, wordBreak: "break-word", whiteSpace: "pre-wrap" } }, c.body),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, tools(c)),
            kids(c.id).map(r => h("div", { key: r.id, "data-wk": "nestclip", style: { position: "relative", margin: "6px 0 4px 18px", padding: "6px 10px", lineHeight: 1.6,
                background: "#faeeda", color: "#412402", transform: "rotate(" + tilt(r.id) * 0.6 + "deg)", boxShadow: "0 4px 8px -7px rgba(0,0,0,.4)" } },
              h("span", { "aria-hidden": true, style: { position: "absolute", top: -11, left: -9 } }, h(IClip, { size: 18, color: "#854f0b" })),
              h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#633806" } },
                h("span", null, who(r), r.to ? " → " + r.to : ""), h("span", null, ago(r.created))),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", wordBreak: "break-word", whiteSpace: "pre-wrap" } }, r.body),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: "#854f0b" } }, tools(r))))))),
      // 写一句：没登录就是一颗「登录以后才能签」
      h("div", { "data-wk": "nestcompose", style: { marginTop: 12 } },
        to ? h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginBottom: 6 } },
          h("span", null, "回 " + to.name + "：" + String(to.body || "").slice(0, 20)), h("button", { onClick: () => setTo(null), className: "active:opacity-60" }, "不回了")) : null,
        me ? h("div", { className: "flex", style: { gap: 8 } },
            h("input", { "data-wk": "input", ref: inputRef, value: text, maxLength: 500, onChange: e => setText(e.target.value), placeholder: to ? "回她一句" : "在留言簿上写一句",
              className: "flex-1 min-w-0 outline-none", style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "10px 13px" } }),
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
    const stat = (n, txt) => h("div", { style: { textAlign: "center" } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(18px * var(--app-fs, 1))", color: t.ink } }, n), h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog } }, txt));
    return h("div", { "data-wk": "nestprofile", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: self ? "我的小窝" : (d ? d.user.name : "小窝"), onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, err) :
        !d ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, "在拿……") :
        h(React.Fragment, null,
          // 借书证：名字、来了多少天、贴了多少、关注和粉丝
          h("div", { "data-wk": "nestcard", style: { background: t.bg2, border: "1px solid " + t.line, padding: "14px 16px", position: "relative" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, letterSpacing: 2 } }, "小 窝 借 书 证"),
            h("div", { className: "flex items-end justify-between", style: { marginTop: 8, borderBottom: "1px solid " + t.line, paddingBottom: 10 } },
              h("div", { className: "min-w-0" },
                h("div", { className: "truncate", style: { fontFamily: F_DISPLAY, fontSize: "calc(22px * var(--app-fs, 1))", color: t.ink } }, d.user.name, h(Badge, { b: d.user.badge })),
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "来了 " + daysSince(d.user.created) + " 天")),
              self ? null : h(Btn, { t, solid: !d.followed, onClick: doFollow, wk: "nestfollow" }, d.followed ? "已关注" : "＋ 关注")),
            h("div", { className: "flex justify-around", style: { marginTop: 10 } }, stat(d.items.length, "贴的"), stat(d.following, "关注"), stat(d.followers, "粉丝"))),
          self ? h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
            h(Btn, { t, onClick: changePw, wk: "nestpw" }, "改密码"), h(Btn, { t, onClick: onLogout, wk: "nestlogout" }, "退出登录")) : null,
          !self && adminToken() ? h("div", { style: { marginTop: 10 } }, h(Btn, { t, onClick: ban, wk: "nestban" }, "停用这个号")) : null,
          self && adminToken() ? h(BadgeSet, { t, props, cur: d.user.badge || "", onSet: b => setD(x => Object.assign({}, x, { user: Object.assign({}, x.user, { badge: b }) })) }) : null,
          self ? h("div", { style: { marginTop: 16 } }, h(Cubbies, { t, kind: tab, onPick: setTab, cols: 3, flush: true,
            items: [{ key: "mine", zh: "我贴的" }, { key: "favs", zh: "我收藏的" }, { key: "following", zh: "我关注的" }] })) : null,
          tab === "mine" || !self ? (d.items.length ? h(Wall, { t, items: d.items, onOpen }) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "28px 4px", textAlign: "center" } }, self ? "还没贴过，回首页右上角「＋ 传一个」。" : "她还没贴过东西。"))
          : !got ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, "在拿……")
          : got.error ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, got.error)
          : tab === "favs" ? ((got.items || []).length ? h(Wall, { t, items: got.items, onOpen }) : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "28px 4px", textAlign: "center" } }, "还没收藏过。"))
          : h("div", { style: { marginTop: 10 } }, (got.users || []).length ? got.users.map(u => h("button", { key: u.id, "data-wk": "nestperson", onClick: () => onUser(u.id), className: "w-full flex items-center justify-between active:opacity-70",
              style: { minHeight: 46, padding: "0 4px", borderBottom: "1px solid " + t.line, fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, h("span", { className: "truncate" }, u.name), h("span", { style: { color: t.fog, fontSize: "calc(12px * var(--app-fs, 1))" } }, "›")))
              : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "28px 4px", textAlign: "center" } }, "还没关注谁。")))));
  }

  // ── 收到的小纸条：谁评了你、谁回了你、谁关注了你、关注的人贴了新的 ──────────
  function Notices({ t, props, onClose, onOpen, onUser }) {
    const [list, setList] = useState(null), [err, setErr] = useState("");
    useEffect(() => { let live = true;
      api("/notices").then(d => { if (!live) return; setList(d.notices || []); api("/notices/seen", { method: "POST" }).catch(() => {}); }).catch(e => { if (live) setErr(e.message); });
      return () => { live = false; }; }, []);
    const line = n => n.kind === "reply" ? (n.title ? "在《" + n.title + "》里回了你" : "回了你") : n.kind === "comment" ? "在《" + n.title + "》的留言簿上写了一句" : n.kind === "follow" ? "关注了你" : n.kind === "return" ? "把《" + n.title + "》退回给你改一改，点进去看原因，改好了点「编辑」保存就会重新摆出来" : "贴了新纸条《" + n.title + "》";
    return h("div", { "data-wk": "nestnotices", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "收到的小纸条", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-8" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, err) :
        list == null ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "24px 4px" } }, "在拿……") :
        !list.length ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "36px 4px", textAlign: "center" } }, "还没有人给你递纸条。") :
        list.map(n => h("button", { key: n.id, "data-wk": "nestnotice", "data-on": n.seen ? "0" : "1", onClick: () => n.kind === "follow" ? onUser(n.fromUid) : onOpen(n.item),
            className: "w-full text-left active:opacity-70", style: { display: "block", marginBottom: 12, padding: "10px 12px", background: n.seen ? t.bg2 : "#faeeda", border: "1px solid " + t.line,
              transform: "rotate(" + tilt(n.id) * 0.5 + "deg)" } },
          h("div", { className: "flex justify-between", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: n.seen ? t.fog : "#633806" } }, h("span", null, n.from || (n.kind === "return" ? "小窝管理员" : "")), h("span", null, ago(n.created))),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: n.seen ? t.ink : "#412402", marginTop: 2, lineHeight: 1.6 } }, line(n)),
          n.text ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: n.seen ? t.fog : "#854f0b", marginTop: 2 } }, "「" + n.text + "」") : null))));
  }

  // ── 新地址的门（她 2026-10-28）：口令、要不要审核、进过门的设备名单；只有管理口令看得到 ──────
  //   设备是在公共版新地址（autumn-drawer）门口输口令进来的，一台一行；停用＝那台几分钟内就打不开。
  function GatePanel({ t, props, onClose }) {
    const [d, setD] = useState(null), [err, setErr] = useState(""), [q, setQ] = useState(""), [busy, setBusy] = useState("");
    const load = (qq, more) => api("/gate/list?q=" + encodeURIComponent(qq || "") + "&off=" + (more ? (d && d.devices.length) || 0 : 0))
      .then(x => { setErr(""); setD(prev => more && prev ? Object.assign({}, x, { devices: prev.devices.concat(x.devices || []) }) : x); })
      .catch(e => setErr(e.message));
    useEffect(() => { const tm = setTimeout(() => load(q), q ? 350 : 0); return () => clearTimeout(tm); }, [q]);
    const kindOf = ua => /iPhone|iPad/.test(ua) ? "苹果" : /Android/.test(ua) ? "安卓" : /Mac|Windows|Linux/.test(ua) ? "电脑" : "设备";
    const day = ms => { const x = new Date(ms); return (x.getMonth() + 1) + "·" + x.getDate(); };
    const ST = { ok: "能进", pending: "等通过", off: "已停用" };
    const setPass = () => requestAppPrompt("群口令", "新设备进门要输这一句（4 到 40 个字）。换了以后，已经进来的设备照常能用，只有新设备要用新口令。", "", async v => {
      v = String(v || "").trim(); if (!v) return;
      try { await api("/gate/conf", { method: "POST", body: { pass: v } }); props.toast("口令换好了，记得改群公告"); load(q); } catch (e) { props.toast(e.message); } });
    const setApprove = async on => {
      try { await api("/gate/conf", { method: "POST", body: { approve: on } }); props.toast(on ? "审核打开了：新设备要你点通过才能进" : "审核关了：口令对了就直接进"); load(q); } catch (e) { props.toast(e.message); } };
    const setSt = async (ids, st) => {
      setBusy(ids[0]);
      try { await api("/gate/device", { method: "POST", body: { ids, status: st } });
        setD(x => Object.assign({}, x, { devices: x.devices.map(r => ids.includes(r.id) ? Object.assign({}, r, { status: st }) : r) }));
        props.toast(st === "off" ? "停用了，几分钟内那台就打不开" : "放行了"); } catch (e) { props.toast(e.message); }
      setBusy(""); };
    const small = { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6 };
    const pill = (on, txt, fn, wk) => h("button", { "data-wk": wk, onClick: fn, className: "active:opacity-60 shrink-0",
      style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: on ? t.bg : t.ink, background: on ? t.ink : "transparent", border: "1px solid " + t.ink, borderRadius: 999, minHeight: 28, padding: "0 10px" } }, txt);
    const sameWho = d ? (who => d.devices.filter(r => r.who === who && r.status !== "off").map(r => r.id)) : () => [];
    return h("div", { "data-wk": "nestgate", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "新地址的门", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-8" },
        err ? h("div", { style: Object.assign({}, small, { padding: "24px 4px", fontSize: "calc(13px * var(--app-fs, 1))" }) }, err) :
        !d ? h("div", { style: Object.assign({}, small, { padding: "24px 4px", fontSize: "calc(13px * var(--app-fs, 1))" }) }, "在拿……") :
        h("div", null,
          h("div", { "data-wk": "nestgateconf", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "12px 12px", marginBottom: 12 } },
            h("div", { className: "flex items-center justify-between", style: { gap: 8 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, d.hasPass ? "口令已经设好" : "还没设口令：现在谁都进不来"),
              pill(false, d.hasPass ? "换口令" : "设口令", setPass, "nestgatepass")),
            h("div", { className: "flex items-center justify-between", style: { gap: 8, marginTop: 10 } },
              h("div", { style: small }, d.approve ? "审核开着：新设备填完要你点「通过」" : "审核关着：口令对了就直接进"),
              pill(d.approve, d.approve ? "审核中" : "开审核", () => setApprove(!d.approve), "nestgateapprove")),
            h("div", { style: Object.assign({}, small, { marginTop: 8 }) }, "一共 " + (d.people || 0) + " 个人、" + d.total + " 台设备" + (d.pending ? "，" + d.pending + " 台等通过" : "") + "（一个人好几台很常见）。口令被传出去时：打开审核、换口令，再把不认识的停用。")),
          h("div", { className: "flex items-center", style: { gap: 6, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "0 11px", marginBottom: 10 } },
            h(ISearch, { size: 15, color: t.fog }),
            h("input", { "data-wk": "input", value: q, onChange: e => setQ(e.target.value), placeholder: "搜 QQ 号或昵称", maxLength: 40, className: "flex-1 min-w-0 outline-none",
              style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, background: "transparent", border: "none", padding: "9px 0" } })),
          !d.devices.length ? h("div", { style: Object.assign({}, small, { padding: "28px 4px", textAlign: "center" }) }, q ? "没搜到" : "还没有设备进过门") :
          d.devices.map(r => h("div", { key: r.id, "data-wk": "nestgaterow", "data-on": r.status, className: "flex items-center",
              style: { gap: 8, padding: "10px 2px", borderBottom: "1px solid " + t.line, opacity: r.status === "off" ? .55 : 1 } },
            h("div", { className: "flex-1 min-w-0" },
              h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, r.who || "（没填）"),
              h("div", { style: small }, kindOf(r.ua || "") + " · " + day(r.created) + " 进门 · " + day(r.last) + " 最近打开 · " + (ST[r.status] || r.status))),
            r.status === "pending" ? pill(true, "通过", () => setSt([r.id], "ok"), "nestgateok") : null,
            r.status === "off" ? pill(false, busy === r.id ? "…" : "恢复", () => setSt([r.id], "ok"), "nestgateok")
              : pill(false, busy === r.id ? "…" : "停用", async () => { const rest = sameWho(r.who).filter(x => x !== r.id);
                  await setSt([r.id], "off");
                  if (rest.length) requestAppConfirm("还有 " + rest.length + " 台", "「" + r.who + "」名下还有 " + rest.length + " 台设备，也一起停掉吗？", () => setSt(rest, "off"), "一起停掉"); }, "nestgateoff"))),
          d.devices.length < d.total && !q ? h("div", { style: { textAlign: "center", marginTop: 12 } }, pill(false, "再往下看", () => load(q, true), "nestgatemore")) : null)));
  }

  // ── 进群验证（她 2026-10-28）：群链接、开关、验过的记录；只有管理口令看得到 ──────
  //   验证页是另一个站（公开的，发给还没进群的人）。图和她们的 API 密钥都不经过服务器，
  //   所以这儿看到的只有：什么时候、过没过、读出来多大、用的哪个站和哪个模型。
  function VerifyPanel({ t, props, onClose }) {
    const [d, setD] = useState(null), [err, setErr] = useState("");
    const load = more => api("/verify/log?off=" + (more ? (d && d.rows.length) || 0 : 0))
      .then(x => { setErr(""); setD(prev => more && prev ? Object.assign({}, x, { rows: prev.rows.concat(x.rows || []) }) : x); })
      .catch(e => setErr(e.message));
    useEffect(() => { load(); }, []);
    const WHY = { ok: "过了", noqq: "QQ 号没填对", blur: "字没认出来", noword: "纸上没写那个码", nophrase: "没写那句话", nonce: "暗号对不上", bad: "模型没按格式回话", nolink: "群链接还没设" };
    const when = ms => { const x = new Date(ms); return (x.getMonth() + 1) + "·" + x.getDate() + " " + x.getHours() + ":" + String(x.getMinutes()).padStart(2, "0"); };
    const small = { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6 };
    const pill = (on, txt, fn, wk) => h("button", { "data-wk": wk, onClick: fn, className: "active:opacity-60 shrink-0",
      style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: on ? t.bg : t.ink, background: on ? t.ink : "transparent", border: "1px solid " + t.ink, borderRadius: 999, minHeight: 28, padding: "0 10px" } }, txt);
    const setLink = () => requestAppPrompt("QQ 群号或链接", "验过的人看到的就是这一条。填群号就行（她们复制去 QQ 里搜），也能填加群链接。留空＝暂时不给。", d && d.link || "", async v => {
      try { await api("/verify/conf", { method: "POST", body: { link: String(v || "").trim() } }); props.toast("存好了"); load(); } catch (e) { props.toast(e.message); } });
    const setOn = async on => {
      try { await api("/verify/conf", { method: "POST", body: { on } }); props.toast(on ? "开了：验证页能用了" : "关了：验证页会说「去群里找群主」"); load(); } catch (e) { props.toast(e.message); } };
    // 留底那张：点开才去取（一次一张，不随名单一起发下来）；看完能单张删，也能一键全清
    const [shotOf, setShotOf] = useState(null);   // { id, src }
    const openShot = async id => {
      props.toast("在取……");
      try { const d = await api("/verify/shot?id=" + id); setShotOf({ id, src: "data:" + d.mime + ";base64," + d.data }); props.toast(""); }
      catch (e) { props.toast(e.message); }
    };
    const dropShot = (id, all) => requestAppConfirm(all ? "清空留底" : "删掉这一张",
      all ? "把留着的截图全删掉，删了找不回来。验证记录本身留着，还能拿来对名单。" : "删了找不回来。这条记录本身留着。",
      async () => {
        try { const r = await api("/verify/drop", { method: "POST", body: all ? { all: true } : { id } });
          props.toast(all ? "清空了（" + (r.n || 0) + " 张）" : "删了"); setShotOf(null); load(); } catch (e) { props.toast(e.message); }
      }, all ? "全删掉" : "删掉");
    return h("div", { "data-wk": "nestverify", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "进群验证", onBack: onClose, bg: "transparent" }),
      // 看留底：铺满这一页，看完关掉；不另开一层半窗（施工规则/no-half-sheet.md）
      shotOf ? h("div", { "data-wk": "nestverifyshotview", className: "absolute inset-0 flex flex-col", style: { zIndex: 40, background: t.bg } },
        h(Head, { zh: "留底", sub: "只有你看得到", onBack: () => setShotOf(null), bg: "transparent",
          right: pill(false, "删掉这张", () => dropShot(shotOf.id), "nestverifydropone") }),
        h("div", { className: "flex-1 min-h-0 overflow-auto px-4 pb-8" },
          h("img", { src: shotOf.src, alt: "留底截图", style: { width: "100%", borderRadius: 12, border: "1px solid " + t.line } }))) : null,
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-8" },
        err ? h("div", { style: Object.assign({}, small, { padding: "24px 4px", fontSize: "calc(13px * var(--app-fs, 1))" }) }, err) :
        !d ? h("div", { style: Object.assign({}, small, { padding: "24px 4px", fontSize: "calc(13px * var(--app-fs, 1))" }) }, "在拿……") :
        h("div", null,
          h("div", { "data-wk": "nestverifyconf", style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "12px 12px", marginBottom: 12 } },
            h("div", { className: "flex items-center justify-between", style: { gap: 8 } },
              h("div", { className: "min-w-0", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink } }, d.link ? "群号已经设好" : "还没设群号：验过了也拿不到"),
              pill(false, d.link ? "换一个" : "设群号", setLink, "nestverifylink")),
            d.link ? h("div", { style: Object.assign({}, small, { marginTop: 4, wordBreak: "break-all" }) }, d.link) : null,
            h("div", { className: "flex items-center justify-between", style: { gap: 8, marginTop: 10 } },
              h("div", { style: small }, d.on ? "验证页开着" : "验证页关着：谁来都只看到「去群里找群主」"),
              pill(d.on, d.on ? "开着" : "打开", () => setOn(!d.on), "nestverifyon")),
            h("div", { style: Object.assign({}, small, { marginTop: 8 }) },
              "今天来了 " + d.dayTotal + " 次，过了 " + (d.dayPassed || 0) + "；一共 " + d.total + " 次，过了 " + (d.passed || 0) + " 次、" + (d.people || 0) + " 个人（同一个号验两次只算一个人）。"),
            h("div", { style: Object.assign({}, small, { marginTop: 4 }) }, "手写那张和她们的密钥都不到这儿来。留底那张只有你看得到，" + (d.shotDays || 14) + " 天自动删。"),
            d.shots ? h("div", { className: "flex items-center justify-between", style: { gap: 8, marginTop: 10 } },
              h("div", { style: small }, "现在留着 " + d.shots + " 张截图"),
              pill(false, "清空留底", () => dropShot(0, true), "nestverifydropall")) : null),
          !d.rows.length ? h("div", { style: Object.assign({}, small, { padding: "28px 4px", textAlign: "center" }) }, "还没有人来验过") :
          d.rows.map(r => h("div", { key: r.id, "data-wk": "nestverifyrow", "data-on": r.pass ? "1" : "0", className: "flex items-center",
              style: { gap: 8, padding: "9px 2px", borderBottom: "1px solid " + t.line } },
            h("div", { className: "flex-1 min-w-0" },
              h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: r.pass ? t.ink : t.fog } },
                (r.pass ? "✓ " : "✗ ") + (WHY[r.reason] || r.reason)),
              h("div", { className: "truncate", style: small }, when(r.at) + (r.qq ? " · QQ " + r.qq : "") + (r.station ? " · " + r.station : "") + (r.model ? " · " + r.model : ""))),
            r.shot ? pill(false, "看留底", () => openShot(r.id), "nestverifyshot") : null)),
          d.rows.length < d.total ? h("div", { style: { textAlign: "center", marginTop: 12 } }, pill(false, "再往下看", () => load(true), "nestverifymore")) : null)));
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
    const field = (val, set, ph, type, max) => h("input", { "data-wk": "input", value: val, type: type || "text", maxLength: max, placeholder: ph, autoComplete: type === "password" ? (mode === "login" ? "current-password" : "new-password") : "username",
      onChange: e => set(e.target.value), className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: "calc(15px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "12px 13px", marginTop: 10 } });
    if (rec) return h("div", { "data-wk": "nestrecovery", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "你的恢复码", bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-8" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.8 } }, "忘了密码，只能靠这一串改回来。它只在这里出现这一次，小窝也看不到原文——截图或者抄到备忘录里存好。"),
        h("div", { "data-wk": "block", style: { margin: "18px 0", padding: "18px 12px", background: "#faeeda", border: "1px dashed #854f0b", textAlign: "center",
          fontFamily: "ui-monospace,Menlo,monospace", fontSize: "calc(21px * var(--app-fs, 1))", letterSpacing: 2, color: "#412402", userSelect: "all", wordBreak: "break-all" } }, rec.code),
        h("div", { className: "flex", style: { gap: 8 } },
          h(Btn, { t, wide: true, onClick: async () => props.toast((await copyText(rec.code)) ? "恢复码复制好了，记得贴到别处存着" : "复制不了，长按那串字自己选"), wk: "nestreccopy" }, "复制"),
          h(Btn, { t, solid: true, wide: true, onClick: () => onDone(rec.user), wk: "nestrecok" }, "我存好了"))));
    const tabs = [{ key: "login", zh: "登录" }, { key: "register", zh: "注册" }];
    return h("div", { "data-wk": "nestlogin", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: mode === "recover" ? "用恢复码改密码" : "小窝账号", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-8" },
        mode === "recover" ? null : h(Cubbies, { t, kind: mode, onPick: setMode, cols: 2, flush: true, items: tabs }),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.7, marginTop: 14 } },
          mode === "register" ? "不用邮箱。起个昵称（2 到 16 个字，别人看到的就是它）、设个密码；注册完会给你一串恢复码。"
          : mode === "recover" ? "填昵称、注册时给你的那串恢复码，再设一个新密码。改完旧的恢复码作废，会给你一串新的。"
          : "不登录也能逛、能导入；要贴东西、留言、点赞收藏关注，先登录。"),
        field(name, setName, "昵称", "text", 16),
        mode === "recover" ? field(code, setCode, "恢复码（像 K7QM-3XPA-…）", "text", 40) : null,
        field(pw, setPw, mode === "login" ? "密码" : "新密码（至少 6 位）", "password", 64),
        h("div", { className: "flex", style: { marginTop: 16 } }, h(Btn, { t, solid: true, wide: true, disabled: busy || !name.trim() || !pw || (mode === "recover" && !code.trim()), onClick: go, wk: "nestloginbtn" },
          busy ? "……" : mode === "login" ? "登录" : mode === "register" ? "注册" : "改好密码并登录")),
        mode === "register" ? null : h("button", { "data-wk": "nestforgot", onClick: () => setMode(mode === "recover" ? "login" : "recover"), className: "active:opacity-60",
          style: { marginTop: 14, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.tint || t.ink } }, mode === "recover" ? "← 想起来了，回去登录" : "忘了密码？用恢复码")));
  }

  // 管理模式下、自己的页里：挂名字旁边那枚称号（最多 8 个字，空着保存＝摘掉）
  function BadgeSet({ t, props, cur, onSet }) {
    const [v, setV] = useState(cur || "管理员"), [busy, setBusy] = useState(false);
    const save = async () => { setBusy(true);
      try { const d = await api("/admin/badge", { method: "POST", body: { badge: v.trim() } }); onSet(d.badge); props.toast(d.badge ? "挂上了" : "摘掉了"); } catch (e) { props.toast(e.message); }
      setBusy(false); };
    return h("div", { "data-wk": "nestbadgeset", style: { marginTop: 12, padding: 12, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12 } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, marginBottom: 8, lineHeight: 1.6 } }, "名字旁边的称号：你的署名、留言、借书证上都会带着它，大家一看就知道是你。最多 8 个字，清空再保存就是摘掉。"),
      h("div", { className: "flex", style: { gap: 8 } },
        h("input", { value: v, maxLength: 8, onChange: e => setV(e.target.value), className: "flex-1 min-w-0 outline-none",
          style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg, border: "1px solid " + t.line, borderRadius: 10, padding: "9px 12px" } }),
        h(Btn, { t, solid: true, disabled: busy, onClick: save, wk: "nestbadgesave" }, "保存")));
  }

  // ── 传一个上去 ─────────────────────────────────────────────
  //   两条路：从手机里选一份文件（每一类都行），或者从 app 里现成的挑（世界书、文风、预设、人设）。
  //   主题、聊天美化、CSS 在 app 里没有「挑一个」这回事，就是文件或者贴一份。
  // 嵌进去的图（data:image）：跟后端 embeddedImages 同一把尺子（她 2026-10-17「直接开放」）——
  //   位图（png/jpg/webp/gif）每张压到 ASSET_CHARS 以内都收，矢量图 8KB 内收；字体文件不收；整份 1.6MB。
  //   张数（ASSET_COUNT）原来是 12（群里 2026-10-22：一套 iOS 图标主题被这条挡住了——
  //   一套图标本来就二三十张）。真正的天花板是整份大小（D1 一行 2MB），张数这道闸只防一眼看出的离谱，
  //   所以张数放到 120（2026-10-28：一整套桌面美化四五十张起步，40 又挡住了）。
  //   上传前 shrinkImages 先把每张压进 ASSET_CHARS，整份还超就一档一档往小里压到放得下（fitTotal），
  //   再拿 imgProblem 查一遍，卡住了直接说是哪一样
  const SVG_MAX = 8192, ASSET_CHARS = 400 * 1024, ASSET_COUNT = 120, PAYLOAD_ALL = 1600 * 1024;
  const RASTER = ["png", "jpeg", "jpg", "webp", "gif"];
  const blobToData = blob => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(blob); });
  function embeddedImages(text) {
    const out = [], re = /data:image\/([a-z0-9.+-]+)/gi; let m;
    while ((m = re.exec(text))) {
      const st = m.index, q = text[st - 1];
      let end = (q === '"' || q === "'") ? text.indexOf(q, st) : text.indexOf(")", st);
      if (end < 0) end = text.length;
      const type = m[1].toLowerCase(), len = end - st;
      out.push({ type, len, st, end, ok: type === "svg+xml" ? len <= SVG_MAX : RASTER.indexOf(type) >= 0 && len <= ASSET_CHARS,
        near: text.slice(Math.max(0, st - 60), st).replace(/\\"/g, '"').split(/[{};]/).pop().trim().slice(-40) });
      re.lastIndex = Math.max(re.lastIndex, end);
    }
    return out;
  }
  // 压一张：太大就缩边再压，直到放得下（透明的保持 png，见 engine.js _resizeImageCore）
  async function shrinkOne(dataUrl) {
    if (dataUrl.length <= ASSET_CHARS || /^data:image\/(svg|gif)/i.test(dataUrl)) return dataUrl;
    const blob = await (await fetch(dataUrl)).blob();
    for (const [dim, q] of [[1600, .85], [1280, .82], [1024, .8], [800, .75], [640, .7]]) {
      const out = await resizeImageFile(blob, dim, q);
      if (out.length <= ASSET_CHARS) return out;
    }
    return dataUrl;   // 实在压不下去：交给 imgProblem 说清楚
  }
  async function shrinkImages(payload) {
    let text = String(payload || "");
    const big = embeddedImages(text).filter(x => x.type !== "svg+xml" && x.len > ASSET_CHARS).reverse();
    for (const x of big) {
      const src = text.slice(x.st, x.end), out = await shrinkOne(src);
      if (out !== src) text = text.slice(0, x.st) + out + text.slice(x.end);
    }
    return fitTotal(text);
  }
  // 整份还超 PAYLOAD_ALL：一档一档缩边重压，每一档先压最大的那几张（省得最多），够了就停。
  //   位置全按同一份快照算，换好的那几张最后从后往前一起换回去，前面的位置不会被挪乱。
  // 带透明的图压出来还是 png，体积下不去：浏览器会出 webp（安卓、电脑）就换成 webp，带着透明、小好几倍；
  //   iPhone 的 Safari 出不了 webp，拿回来的不是 webp 就原样不动，靠上面缩边那几档。
  async function webpIfSmaller(dataUrl, q) {
    if (!/^data:image\/png/i.test(dataUrl)) return dataUrl;
    const img = new window.Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = dataUrl; });
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    const w = c.toDataURL("image/webp", q); c.width = 0; c.height = 0;
    return /^data:image\/webp/i.test(w) && w.length < dataUrl.length ? w : dataUrl;
  }
  async function fitTotal(text) {
    const TIERS = [[1024, .78], [768, .75], [512, .72], [384, .7], [256, .7], [192, .65], [128, .6], [96, .6]];
    for (const [dim, q] of TIERS) {
      if (text.length <= PAYLOAD_ALL) return text;
      const imgs = embeddedImages(text).filter(x => x.type !== "svg+xml" && x.type !== "gif").sort((a, b) => b.len - a.len);
      let size = text.length; const swaps = [];
      for (const x of imgs) {
        if (size <= PAYLOAD_ALL) break;
        const src = text.slice(x.st, x.end);
        let out = src;
        try { out = await resizeImageFile(await (await fetch(src)).blob(), dim, q); out = await webpIfSmaller(out, q); } catch (e) {}
        if (out.length < src.length) { swaps.push([x.st, x.end, out]); size -= src.length - out.length; }
      }
      swaps.sort((a, b) => b[0] - a[0]).forEach(([st, end, out]) => { text = text.slice(0, st) + out + text.slice(end); });
    }
    return text;
  }
  function imgProblem(payload) {
    const text = String(payload || "");
    if (/data:(?:font|application\/(?:font|x-font))/i.test(text)) return "里面带着字体文件，小窝不收字体：导出时把「字体」的勾去掉再传。";
    const imgs = embeddedImages(text), bad = imgs.filter(x => !x.ok);
    if (bad.length) {
      const b = bad[0];
      return "有 " + bad.length + " 张图传不了：" + (b.type === "svg+xml" ? "一张 " + Math.ceil(b.len / 1024) + "KB 的矢量图（超过 8KB）"
        : RASTER.indexOf(b.type) >= 0 ? "一张图压到最小还是太大" : "一张 " + b.type + "（只收 png、jpg、webp、gif）")
        + (b.near ? "，在「" + b.near + "」后面" : "") + "。换一张小点的图，或者把它删掉再传。";
    }
    if (imgs.filter(x => x.type !== "svg+xml").length > ASSET_COUNT) return "图太多了，一件最多 " + ASSET_COUNT + " 张。";
    if (text.length > PAYLOAD_ALL) return "连图一共太大了（最多 " + Math.round(PAYLOAD_ALL / 1024) + "KB），少放几张图再传。";
    return "";
  }

  // ── 不用先导出：主题、聊天美化直接拿手机上正用着的那套（她 2026-10-16：老师们传之前还得先弄成文件）──
  //   主题走主题工作台导出那一支 exportPackage，只是不出文件；图标、壁纸、CSS 里的图都带上（2026-10-17 起收图），只有自己传的字体文件不带。
  async function packCurrentTheme() {
    const S = window.ThemeStudio; if (!S) throw new Error("主题工作台没加载出来，退出再进来试试");
    const p = S.normalize(S.load());
    // 图标、壁纸、CSS 里的图、气泡贴纸都带上（她 2026-10-17 小窝开放收图）；自己传的字体文件不带（太大）
    const wall = loadJSON("x_wallpaper", "");
    const pick = { css: true, base: true, bubble: true, icons: true, wall: !!wall, fonts: !(p.customFonts || []).length };
    return await S.exportPackage({ profile: p, baseTheme: loadJSON("x_theme", null) || undefined, wallpaper: wall || undefined,
      bubbleSkin: typeof bubbleSkinSnapshot === "function" ? bubbleSkinSnapshot() : null, pick });
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
  // CSS 里 url(iv_…) 是本机图库的门牌，别人手机上没有：换成图本身嵌进去（上传前再统一压小）
  async function packCss(src) {
    let css = String(src.css || "");
    const refs = [...new Set(css.match(/iv_[A-Za-z0-9_-]+/g) || [])];
    for (const ref of refs) {
      const blob = typeof imgVaultFetchBlob === "function" ? await imgVaultFetchBlob(ref).catch(() => null) : null;
      if (!blob) throw new Error("CSS 里有一张图在这台手机的图库里找不到了（" + ref + "）");
      css = css.split(ref).join(await blobToData(blob));
    }
    return css;
  }
  // 整套美化：头像框、挂件、背景这些自己传的图一起打进包（跟聊天设置里「导出」同一份 packChatLook）
  async function packLook(src) {
    if (typeof packChatLook !== "function") throw new Error("美化打包没加载出来，退出再进来试试");
    return { payload: JSON.stringify(await packChatLook(src.look, src.name)) };
  }


  // 改一件（群友 2026-10-17「仓库上传可不可以加一个再编辑」）：同一页，edit＝点进去那件（带 payload）。
  //   类别不能换；内容不碰就不发、后端原样留着；截图一张张留或换，原来的那几张用 { keep: 第几张 }。
  function Upload({ t, props, initialKind, onClose, onDone, edit, pre }) {
    const [kind, setKind] = useState(edit ? edit.kind : (initialKind || "theme"));
    const [pick, setPick] = useState({});        // 世界书可多选；其余单选（存 id → true）
    const [file, setFile] = useState(null);       // { payload, title, note, name }：选了文件就用它
    const [text, setText] = useState(edit && (edit.kind === "post" || edit.kind === "topic") ? String(edit.payload || "") : pre ? String(pre.text || "") : "");   // 主题 / 美化 / CSS：贴一份；帖子：正文
    const [title, setTitle] = useState(edit ? edit.title || "" : pre ? String(pre.title || "").slice(0, 40) : ""), [intro, setIntro] = useState(edit ? edit.intro || "" : "");
    const oldShots = edit ? Array.from({ length: edit.pics || 0 }, (_, k) => ({ keep: k, thumb: NEST + "/img/" + edit.id + "/" + k + (edit.edited ? "?v=" + edit.edited : "") })) : [];
    const [shots, setShots] = useState(oldShots);  // [{ full, thumb }]：新压好的 dataURL；改的时候原来那几张是 { keep, thumb: 地址 }
    const shotRef = useRef(null);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const first = useRef(true);
    useEffect(() => { if (first.current) { first.current = false; return; } setPick({}); setText(""); setFile(null); }, [kind]);
    const styles = (loadJSON("x_offlineStyles", []) || []).filter(s => s && s.prompt);
    const presets = window.StylePresets ? window.StylePresets.list() : [];
    const chars = (props.characters || []).filter(c => c && !c.npc && c.persona);
    const lore = props.loreEntries || [];
    const looks = kind === "look" ? lookSources((props.characters || []).filter(c => c && !c.npc)) : [];
    const csses = kind === "css" ? cssSources((props.characters || []).filter(c => c && !c.npc)) : [];
    const rows = kind === "css" ? csses.map(x => ({ id: x.id, name: x.name, sub: x.sub }))
      : kind === "theme" ? [{ id: "cur", name: "我现在用的这套主题", sub: "页面 CSS、配色、气泡、图标、壁纸一起；只有自己传的字体文件不带" }]
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
    const pasteKind = kind === "theme" || kind === "look" || kind === "css" || kind === "doc";
    const isPost = kind === "post", isTopic = kind === "topic";
    const build = async () => {
      if (isTopic) { const s = String(text || "").trim(); if (!s) throw new Error("写下这个梗或话题"); return s; }
      if (isPost) { const s = String(text || "").trim(); if (!s) throw new Error("写两句想说的吧"); return s; }
      if (edit && !file && !chosen.length && !String(text || "").trim()) return null;   // 改的时候没碰内容：不发，后端留着原来的
      if (file) return file.payload;
      if (kind === "theme" && chosen.length) return await packCurrentTheme();
      if (kind === "css" && chosen.length) return await packCss(csses.find(x => x.id === chosen[0]));
      if (kind === "look" && chosen.length) {
        return (await packLook(looks.find(x => x.id === chosen[0]))).payload;
      }
      if (pasteKind) {
        const s = String(text || "").replace(/^﻿/, "").trim();
        if (!s) throw new Error(kind === "css" ? "先选一份文件，或者把 CSS 贴进来" : kind === "doc" ? "先选一份文件，或者把内容贴进来" : "先选导出的那份文件，或者整份贴进来");
        return kind === "css" || kind === "doc" ? s : fromFile(kind, s, "").payload;
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
      if (payload != null && kind !== "post" && kind !== "topic") { try { payload = await shrinkImages(payload); } catch (e) {} }
      const ip = payload != null ? imgProblem(payload) : ""; if (ip) { props.toast(ip, 8000); return; }
      // 梗不用另起名：没填就拿正文开头那几个字
      if (isTopic && !title.trim()) setTitle(String(payload || "").replace(/\s+/g, " ").slice(0, 20));
      const title0 = isTopic && !title.trim() ? String(payload || "").replace(/\s+/g, " ").slice(0, 20) : title;
      if (!title0.trim()) { props.toast("起个名字吧"); return; }
      setBusy(true);
      if (edit) {
        try {
          const same = shots.length === oldShots.length && shots.every((x, i) => x.keep === i);
          let thumb;
          if (!same && shots.length) {
            const f0 = shots[0];
            if (f0.keep === 0 && oldShots.length) thumb = "keep";
            else if (f0.keep != null) thumb = await resizeImageFile(await (await fetch(f0.thumb)).blob(), 320, 0.7);   // 原来的第几张挪到了第一：现做一张小图
            else thumb = f0.thumb;
          }
          const d = await api("/item/" + edit.id, { method: "PUT", body: { title: title0.trim(), intro: intro.trim(),
            payload: payload == null ? undefined : payload,
            images: same ? undefined : shots.map(x => x.keep != null ? { keep: x.keep } : x.full), thumb } });
          props.toast(edit.returned ? "改好了，重新摆回墙上了" : "改好了"); onDone(edit.id, kind, { returned: "", title: title0.trim(), intro: intro.trim(), edited: d.edited, pics: shots.length, thumb: !!shots.length });
        } catch (e) { props.toast("没改成：" + e.message); setBusy(false); }
        return;
      }
      try { const d = await api("/upload", { method: "POST", body: { kind, title: title0.trim(), intro: intro.trim(), payload,
          images: shots.map(x => x.full), thumb: shots.length ? shots[0].thumb : undefined } }); props.toast("传上去了"); onDone(d.id, kind); }
      catch (e) { props.toast("没传上去：" + e.message); setBusy(false); }
    };
    const inputStyle = { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "11px 13px", resize: "none" };
    const field = (val, set, ph, max, area) => h(area ? "textarea" : "input", { value: val, maxLength: max, placeholder: ph, rows: area ? 3 : undefined,
      onChange: e => set(e.target.value), className: "w-full outline-none", style: inputStyle });
    const k = KIND[kind];
    const where = kind === "theme" ? "「设置 → 主题工作台」点「导出」存的 json（自己传的字体那一样别勾）"
      : kind === "look" ? "聊天设置里「整套美化」导出的 json，或「设置 → 聊天气泡」导出的 json（头像框、挂件、背景图都能带）"
      : kind === "css" ? ".css、.txt，或者老师给的 Word（.docx）；Word 改坏的引号和破折号会自动改回来"
      : kind === "lore" ? "世界书 json，或者一份 txt／docx（整份当一条词条）"
      : kind === "style" ? "一份 txt／docx／md，整份就是这条文风"
      : kind === "preset" ? "文风台导出的预设 json"
      : kind === "doc" ? "一份 txt／md／docx（Word 里的字会读出来），整份原样传上去"
      : "角色卡 json，或者一份 txt／docx（名字、简介、人设照档案馆导入角色卡那样认）";
    return h("div", { "data-wk": "nestupload", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: edit ? "改一改" : "传一个上去", onBack: onClose, bg: "transparent" }),
      edit ? null : h(Cubbies, { t, kind, noAll: true, onPick: setKind }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 pb-6" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, padding: "0 4px 12px" } }, edit ? (isPost ? "标题、正文、截图都能改；底下的留言和赞都留着。" : "名字、简介、截图都能改。内容不想换就别动下面这几格，原来的留着；换了以后，已经导进别人手机的那份不会跟着变，想要新的得再导一次。留言、赞、收藏都留着。") : k.hint + (isPost ? "。大家都看得到，也都能在底下回；署名就是你的小窝昵称，随时能删。" : "。美化里的图（头像框、挂件、背景、图标、贴纸）会压小了一起传；不带记忆和聊天，也不带自己传的字体文件。署名就是你的小窝昵称，随时能删。")),
        // ① 从手机文件选（帖子没有文件）
        isPost || isTopic ? null : h("div", { style: Object.assign({ padding: 14 }, card(t)) },
          h("div", { className: "flex items-center", style: { gap: 10 } },
            h(Seal, { k: kind, size: 32 }),
            h("div", { className: "min-w-0 flex-1" },
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14.5px * var(--app-fs, 1))", fontWeight: 600, color: t.ink } }, "从手机里选文件"),
              h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 2, lineHeight: 1.5 } }, where))),
          h("div", { style: { marginTop: 12 } },
            h(Btn, { t, solid: !file, onClick: () => fileRef.current && fileRef.current.click(), wk: "nestfile" }, file ? "换一份" : "选文件"),
            h("input", { ref: fileRef, type: "file", accept: ANY_FILE, style: { display: "none" }, onChange: readFile })),
          file ? h("div", { "data-wk": "nestfilechip", style: { marginTop: 10, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink, padding: "8px 10px", borderRadius: 10, background: tint(k.color, "14") } },
            "已选 " + file.name + " · 读到" + file.note) : null),
        // ② 从 app 里直接挑（七类都能挑）；主题／美化／CSS 还能整份贴
        rows ? h("div", { style: { marginTop: 14 } }, label(t, (kind === "theme" ? "或者直接用手机上正用着的" : kind === "look" ? "或者直接挑一套正用着的、存过的" : kind === "css" ? "或者直接挑一段手机上写着的" : "或者从 app 里挑") + (multi ? "（可以挑好几条）" : "")),
          h("div", { style: Object.assign({ padding: "2px 12px" }, card(t)) },
            rows.length ? rows.map((r, i) => h("button", { key: r.id, onClick: () => toggle(r.id), className: "w-full flex items-start active:opacity-70",
              style: { gap: 10, minHeight: 46, padding: "10px 0", textAlign: "left", borderTop: i ? "1px solid " + t.line : "none" } },
              h("span", { style: { flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: multi ? 5 : 999, border: "1.5px solid " + (pick[r.id] ? k.color : t.line), background: pick[r.id] ? k.color : "transparent", color: "#fff", fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: "15px", textAlign: "center" } }, pick[r.id] ? "✓" : ""),
              h("span", { className: "min-w-0" },
                h("div", { style: { fontFamily: F_BODY, fontSize: "calc(14px * var(--app-fs, 1))", color: t.ink } }, r.name),
                r.sub ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, marginTop: 1 } }, r.sub) : null)))
              : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "14px 0" } }, "手上还没有能传的" + k.zh))) : null,
        isPost ? h("div", { "data-wk": "nestpostwrite" }, label(t, "想说什么（最多 4000 字）"),
          h("textarea", { "data-wk": "textarea", value: text, maxLength: 4000, rows: 8, placeholder: "哪里不好用、想要什么、遇到了什么，都可以写；配一张截图更好懂",
            onChange: e => setText(e.target.value), className: "w-full outline-none", style: Object.assign({}, inputStyle, { resize: "vertical" }) })) : null,
        isTopic ? h("div", { "data-wk": "nesttopicwrite" }, label(t, "这个梗 / 话题（最多 1000 字）"),
          h("textarea", { "data-wk": "textarea", value: text, maxLength: 1000, rows: 6, placeholder: "比如：问 TA「如果我变成一只猫，你还会爱我吗」——看 TA 怎么接",
            onChange: e => setText(e.target.value), className: "w-full outline-none", style: Object.assign({}, inputStyle, { resize: "vertical" }) })) : null,
        pasteKind ? h("div", { style: { marginTop: 14 } }, label(t, kind === "css" ? "或者直接把 CSS 贴在这儿" : kind === "doc" ? "或者直接把整份内容贴在这儿" : "也可以把导出的那份文件内容整份贴进来"),
          // 上限跟小窝后端那一道同：整份最多 1.6MB（D1 一行 2MB）
          field(text, v => { setText(v); if (v) { setFile(null); setPick({}); } }, kind === "css" ? "[data-wk=\"bubble\"] { … }" : kind === "doc" ? "提示词、开局设定、教程……原样贴" : "{ \"kind\": … }", 1600 * 1024, true)) : null,
        // ③ 名字、简介、署名
        h("div", { style: { marginTop: 18 } }, label(t, isPost ? "标题" : isTopic ? "叫它什么（可不填，不填就用开头几个字）" : "名字"), field(title, setTitle, isPost ? "一句话说是什么事" : isTopic ? "猫猫测试" : "别人在列表里看到的名字", 40)),
        isPost ? null : h("div", { style: { marginTop: 12 } }, label(t, "说两句（可不填）"), field(intro, setIntro, "适合什么、怎么用", 200, true)),
        // ④ 预览截图：别人逛的时候先看个大概再决定要不要
        h("div", { "data-wk": "nestshotpick", style: { marginTop: 14 } }, label(t, isPost ? "截图（可不放，最多 3 张）" : isTopic ? "截图（可不放：比如你家 TA 是怎么接的）" : "预览截图（可不放，最多 3 张；第一张会贴在墙上那张纸条上）"),
          h("div", { className: "flex flex-wrap", style: { gap: 10 } },
            shots.map((x, k) => h("div", { "data-wk": "block", key: k, style: { position: "relative", padding: "4px 4px 12px", background: "#fff", boxShadow: "0 2px 6px -3px rgba(0,0,0,.35)" } },
              h("img", { src: x.thumb, alt: "", style: { display: "block", width: 76, height: 100, objectFit: "cover" } }),
              h("button", { "aria-label": "拿掉这张", onClick: () => setShots(a => a.filter((_, i) => i !== k)), className: "active:opacity-60",
                style: { position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: 999, background: t.ink, color: t.bg, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: "24px" } }, "×"))),
            shots.length < 3 ? h("button", { "data-wk": "nestshotadd", onClick: () => shotRef.current && shotRef.current.click(), className: "active:opacity-60",
              style: { width: 84, height: 116, border: "1.5px dashed " + t.line, borderRadius: 4, background: t.bg2, color: t.fog, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", lineHeight: 1.6, whiteSpace: "pre-line" } }, "＋\n加截图") : null),
          h("input", { ref: shotRef, type: "file", accept: "image/*", multiple: true, style: { display: "none" }, onChange: pickShots }))),
      h("div", { className: "shrink-0 flex px-4 pt-3", style: { paddingBottom: "calc(12px + " + COMPOSER_PAD_BOTTOM + ")", borderTop: "1px solid " + t.line, background: tint(t.bg, "f2") } },
        h(Btn, { t, solid: true, wide: true, disabled: busy, onClick: send, wk: "nestsend" }, busy ? "在传……" : edit ? "改好了" : isPost ? "贴上去" : "传上去")));
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
    // 记住上一次看到的墙（群里 2026-10-20：「有时候进去要加载好久」）：点进来先把上次那一页摆出来，
    //   后台再去拿新的，拿到了再换；网卡住时也不是白屏干等。只记每一格「最新/最旧」的第一页（搜的不记）。
    //   本机缓存，qq_ 开头：不进存档、不上云（施工规则/no-small-warehouse.md 第 5 条）。
    const WALL_KEY = (kd, so) => "qq_nestWall:" + (kd || "all") + "|" + so;
    const [stale, setStale] = useState(false);   // 眼前这页是上次记下的、新的还没拿到
    const load = async (off) => {
      setLoading(true); setErr("");
      const cacheable = !off && !qLive, ck = WALL_KEY(kind, sort);
      if (cacheable) { const old = tryJSON(lsGet(ck)); if (Array.isArray(old) && old.length) { setItems(old); setStale(true); } }
      try {
        const qs = "?sort=" + sort + (kind ? "&kind=" + kind : "") + (qLive ? "&q=" + encodeURIComponent(qLive) : "") + "&off=" + (off || 0);
        const d = await api("/list" + qs);
        const got = d.items || [];
        setItems(prev => off ? prev.concat(got) : got); setMore(got.length >= 30); setStale(false);
        if (cacheable) { try { localStorage.setItem(ck, JSON.stringify(got)); } catch (e) {} }
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
    // 从聊天的话题卡点「传到小窝」进来的（她 2026-10-31）：直接打开「传一个上去」，梗与话题、正文都填好；没登录先登录
    useEffect(() => { const pre = window.__nestPending; if (!pre) return; window.__nestPending = null;
      const v = { v: "upload", pre }; if (sessionTok()) push(v); else needLogin(v); }, []);
    // 管理口令：连点标题七下，填一次就记在这台手机上
    const onTitleTap = () => {
      taps.current += 1; if (taps.current < 7) return; taps.current = 0;
      requestAppPrompt("小窝管理", adminToken() ? "这台手机已经记着管理口令了。清空再确定就是撤掉。" : "填上管理口令，这台手机就能删任何一条；小窝里新发的东西也会提醒你（主屏图标红点、顶上一条横幅）。", adminToken(), v => {
        try { if (v && v.trim()) localStorage.setItem(ADMIN_KEY, v.trim()); else { localStorage.removeItem(ADMIN_KEY); window.NestWatch.forget(); } } catch (e) {}
        props.toast(v && v.trim() ? "记住了" : "撤掉了"); bump(x => x + 1);
      }, "确定");
    };
    const openItem = id => push({ v: "item", id }), openUser = id => push({ v: "user", id });
    const logout = async () => { try { await api("/auth/logout", { method: "POST" }); } catch (e) {} clearSession(); setMe(null); setUnread(0); setStack([]); props.toast("退出了"); };
    if (top && top.v === "edit") return h(Upload, { t, props, edit: top.item, onClose: pop,
      onDone: (id, k, patch) => { setItems(l => l.map(x => x.id === id ? Object.assign({}, x, patch) : x)); pop(); } });
    if (top && top.v === "item") return h(Detail, { key: top.id, t, id: top.id, props, me, onClose: pop, onUser: openUser, onLogin: () => needLogin(), onEdit: it => push({ v: "edit", item: it }),
      onGone: id => { setItems(l => l.filter(x => x.id !== id)); pop(); } });
    if (top && top.v === "user") return h(Profile, { key: top.id, t, uid: top.id, me, props, onClose: pop, onOpen: openItem, onUser: openUser, onLogin: () => needLogin(), onLogout: logout });
    if (top && top.v === "notices") return h(Notices, { t, props, onClose: pop, onOpen: openItem, onUser: openUser });
    if (top && top.v === "gate") return h(GatePanel, { t, props, onClose: pop });
    if (top && top.v === "verify") return h(VerifyPanel, { t, props, onClose: pop });
    if (top && top.v === "login") return h(Login, { t, props, onClose: pop, onDone: u => { const next = after.current; after.current = null; setMe(u); setStack(s => s.slice(0, -1).concat(next ? [next] : [])); } });
    if (top && top.v === "upload") return h(Upload, { t, props, initialKind: (top.pre && top.pre.kind) || kind || "theme", pre: top.pre || null, onClose: pop,
      onDone: (id, k) => { setStack([]); setSort("new"); if (k !== kind && kind) setKind(k); else load(0); } });
    const empty = (txt) => h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.fog, padding: "36px 8px", textAlign: "center", lineHeight: 1.8, whiteSpace: "pre-line" } }, txt);
    const bell = h("button", { "data-wk": "nestbell", "aria-label": "收到的小纸条", onClick: () => me ? push({ v: "notices" }) : needLogin({ v: "notices" }), className: "active:opacity-60 relative",
        style: { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", color: t.ink } },
      h(IBell, { size: 20 }),
      unread ? h("span", { "data-wk": "nestdot", style: { position: "absolute", top: 3, right: 2, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, background: "#c0503f", color: "#fff",
        fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", lineHeight: "15px", textAlign: "center" } }, unread > 99 ? "99+" : unread) : null);
    return h("div", { "data-wk": "nestpage", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "秋秋小窝", sub: adminToken() ? "管理中" : "", onBack: props.onBack, onTitleTap, bg: "transparent",
        right: h("div", { className: "flex items-center", style: { gap: 4 } }, bell,
          h("button", { "data-wk": "nestupbtn", onClick: () => me ? push({ v: "upload" }) : needLogin({ v: "upload" }), className: "active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", fontWeight: 600, color: t.bg, background: t.ink, borderRadius: 999, minHeight: 30, padding: "0 11px" } }, kind === "post" ? "＋ 写一帖" : "＋ 传一个")) }),
      adminToken() ? h(WatchLine, { t, onGate: () => push({ v: "gate" }), onVerify: () => push({ v: "verify" }) }) : null,
      h(Cubbies, { t, kind, onPick: setKind, fold: true }),
      h("div", { className: "shrink-0 flex items-center px-4 pb-3", style: { gap: 8 } },
        h("div", { "data-wk": "nestsearch", className: "flex-1 min-w-0 flex items-center", style: { gap: 6, background: t.bg2, border: "1px solid " + t.line, borderRadius: 12, padding: "0 11px" } },
          h(ISearch, { size: 15, color: t.fog }),
          h("input", { "data-wk": "input", value: q, onChange: e => setQ(e.target.value), placeholder: "搜东西，也搜人", maxLength: 40, className: "flex-1 min-w-0 outline-none",
            style: { fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: t.ink, background: "transparent", border: "none", padding: "9px 0" } })),
        h("button", { "data-wk": "nestme", onClick: () => me ? openUser(me.id) : needLogin(), className: "active:opacity-60 truncate",
          style: { flexShrink: 0, maxWidth: 96, minHeight: 40, padding: "0 12px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink } },
          me ? me.name : "登录"),
        h("button", { "data-wk": "nestsort", onClick: () => setSort(s => s === "new" ? "old" : "new"), className: "active:opacity-60",
          style: { flexShrink: 0, minHeight: 40, padding: "0 10px", borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.ink } },
          sort === "new" ? "新↓" : "旧↑")),
      h("div", { ref: listRef, className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
        people.length ? h("div", { "data-wk": "nestpeople", className: "flex flex-wrap", style: { gap: 8, padding: "4px 0 10px" } },
          people.map(u => h("button", { key: u.id, onClick: () => openUser(u.id), className: "active:opacity-60",
            style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "5px 12px" } }, "@" + u.name))) : null,
        // 拿新的没拿到，可手上有上次那一页：照旧摆着，顶上说一句、给「再试一次」
        err && stale && items.length ? h("div", { "data-wk": "nestslow", className: "flex items-center", style: { gap: 8, padding: "2px 0 10px", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.5 } },
          h("div", { className: "flex-1 min-w-0" }, "网太慢，先给你看上次的。" + err), h(Btn, { t, onClick: () => load(0), wk: "nestretry" }, "再试一次")) : null,
        err && !(stale && items.length) ? h("div", null, empty(err), h("div", { style: { textAlign: "center" } }, h(Btn, { t, onClick: () => load(0), wk: "nestretry" }, "再试一次")))
        : (!items.length && !loading) ? empty(qLive ? "没找到。" : "这面墙还空着。\n右上角「＋ 传一个」，贴第一张上去。")
        : h(Wall, { t, items, onOpen: openItem }),
        loading ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.fog, padding: "16px 4px", textAlign: "center" } }, stale ? "在拿新的……" : "在拿……")
        : more ? h("div", { style: { padding: "6px 0 14px", textAlign: "center" } }, h(Btn, { t, onClick: () => load(items.length) }, "再往下翻")) : null));
  }

  window.NestApp = NestApp;
  window.Nest = { KINDS, embeddedImages, imgProblem, shrinkImages, packCurrentTheme, lookSources, packLook, cssSources, packCss, importInto, cssInto, lookInto, fromFile, unWord, CSS_SLOTS, packLore, packStyle, packPreset, packPersona, api, setSession, clearSession, sessionTok, cachedMe, tilt };
})();
