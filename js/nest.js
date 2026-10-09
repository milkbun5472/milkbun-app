// ============================================================
// 秋秋小窝（2026-10-08）
//
// 大家把自己做的东西传上来、别人点一下就导进自己的手机：
//   主题、聊天美化、CSS、世界书、文风、预设台预设、人设。
// 定下来的几条：大家自己传、传的人能删自己的、管理口令什么都能删；第一版不收图；
//   不分尺度；没有举报键。
//
// 东西存在 Cloudflare 那边（qiuqiu-nest），这一页只走秋秋机自己的 /nest/ 前门——
//   Worker 的真地址里带着账号名，不能进包。家里那份 app 也走同一个前门（那边放行了跨域）。
//
// 导进来的东西一律落进它本来就住的那个库，不另开一份：
//   主题 / 聊天美化 / CSS → 交给主题工作台（跟手动导入同一条路：先预览、挑几样、确认才落盘）
//   世界书 → saveLore；文风 → x_offlineStyles；预设 → StylePresets.importBundle；人设 → 新建一个角色
// 传上去的东西不带记忆、不带聊天、不带绑定的角色：世界书词条的 charIds、人设的长期记忆一律不发。
// ============================================================
(function () {
  const useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  const NEST = "https://qiuqiu-machine.pages.dev/nest";

  const KINDS = [
    { key: "theme", zh: "主题", hint: "整套主题包：配色、页面 CSS、字体、气泡" },
    { key: "look", zh: "聊天美化", hint: "「聊天气泡」那一栏导出的那一套" },
    { key: "css", zh: "CSS", hint: "一段 CSS，导进来放进全局 CSS 的草稿" },
    { key: "lore", zh: "世界书", hint: "一组世界书词条" },
    { key: "style", zh: "文风", hint: "线下文风库里的一条文风" },
    { key: "preset", zh: "预设", hint: "文风预设台里搭好的一份预设" },
    { key: "persona", zh: "人设", hint: "一个角色的名字、一句话简介和人设正文" }
  ];
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

  // ── 导进来：每一类落进它本来住的那个库 ──────────────────────
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

  const ago = ts => {
    const s = (Date.now() - ts) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " 分钟前";
    if (s < 86400) return Math.round(s / 3600) + " 小时前";
    if (s < 86400 * 30) return Math.round(s / 86400) + " 天前";
    const d = new Date(ts); return (d.getMonth() + 1) + " 月 " + d.getDate() + " 日";
  };

  // 外壳底纹：格子柜的木板——竖向细木纹，铺在最外那层、Head 透明透上来（mobile-ui-layout.md §3.5）。
  //   ⚠️t.ink 在深色/自定义主题下未必是六位色号，拼透明度后缀会拼出废值，验不过就退回纯色。
  const shell = t => !/^#[0-9a-f]{6}$/i.test(String(t.ink || "")) ? { background: t.bg } : { background: t.bg, backgroundImage: [
    "repeating-linear-gradient(90deg," + t.ink + "00 0 5px," + t.ink + "06 5px 6px," + t.ink + "00 6px 13px," + t.ink + "04 13px 14px)",
    "linear-gradient(180deg," + t.ink + "08," + t.ink + "00 120px)"].join(",") };

  // 图标：一个小屋檐底下三格格子
  window.GNest = p => h(Svg, p,
    h("path", { d: "M3 10l9-6 9 6" }), h("path", { d: "M5 9v11h14V9" }),
    h("path", { d: "M5 14h14" }), h("path", { d: "M12 14v6" }));

  // ── 那一排分类：小窝是一面格子柜，每一格是一类东西 ─────────────
  //   选中的那一格是「拉开了的」：往里陷、底下压一道深色的边；没选的是关着的格门。
  function Cubbies({ t, kind, onPick, noAll }) {
    // 传的时候得挑一类，「全部」那一格只在逛的时候有
    const all = (noAll ? [] : [{ key: "", zh: "全部" }]).concat(KINDS);
    return h("div", { "data-wk": "nestcubbies", className: "shrink-0 px-4 pt-3 pb-2" },
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, border: "1px solid " + t.line, borderRadius: 10, overflow: "hidden", background: t.bg2 } },
        all.map((k, i) => {
          const on = k.key === kind;
          return h("button", { key: k.key || "all", "data-wk": "nestcubby", "data-on": on ? "1" : "0", onClick: () => onPick(k.key),
            className: "active:opacity-70",
            style: { minHeight: 46, padding: "6px 2px", fontFamily: F_BODY, fontSize: 12.5, letterSpacing: 1,
              color: on ? t.ink : t.fog, fontWeight: on ? 600 : 400,
              borderRight: i % 4 === 3 || i === all.length - 1 ? "none" : "1px solid " + t.line, borderBottom: i < 4 ? "1px solid " + t.line : "none",
              background: on ? t.bg : "transparent",
              boxShadow: on ? "inset 0 3px 6px rgba(0,0,0,.10), inset 0 -3px 0 " + t.ink : "none" } },
            k.zh);
        })));
  }

  const Btn = ({ t, onClick, children, solid, disabled, wk }) => h("button", { onClick, disabled, "data-wk": wk || "nestbtn",
    className: "active:opacity-60 disabled:opacity-40",
    style: { minHeight: 40, padding: "0 16px", borderRadius: 999, fontFamily: F_BODY, fontSize: 13,
      border: "1px solid " + t.ink, background: solid ? t.ink : "transparent", color: solid ? t.bg : t.ink } }, children);

  // ── 一条东西点进去 ─────────────────────────────────────────
  function Detail({ t, id, props, onClose, onGone }) {
    const [it, setIt] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
    const [armed, setArmed] = useState(false);
    useEffect(() => { let live = true; api("/item/" + id).then(d => { if (live) setIt(d); }).catch(e => { if (live) setErr(e.message); }); return () => { live = false; }; }, [id]);
    const admin = !!adminToken();
    const doImport = async () => {
      setBusy(true);
      try {
        const d = await api("/item/" + id + "?import=1");
        const msg = importInto(d.kind, d.payload, d.title, props);
        if (msg) props.toast(msg);
      } catch (e) { props.toast("导入失败：" + e.message); }
      setBusy(false);
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
          else preview = "这是一份" + KZH[it.kind] + "包，导入时会先在主题工作台里预览，挑好要哪几样再落盘。";
        }
      } catch (e) { preview = ""; }
    }
    return h("div", { "data-wk": "nestdetail", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: it ? it.title : "小窝", sub: it ? KZH[it.kind] : "", onBack: onClose, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-8" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, err) :
        !it ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog } }, "在拿……") :
        h(React.Fragment, null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 10 } },
            (it.nick ? it.nick + " · " : "") + ago(it.created) + " · " + it.imports + " 人导过" + (it.mine ? " · 我传的" : "")),
          it.intro ? h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" } }, it.intro) : null,
          preview ? h("div", { "data-wk": "nestpreview", style: { fontFamily: it.kind === "css" ? "ui-monospace,Menlo,monospace" : F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.65,
            whiteSpace: "pre-wrap", wordBreak: "break-word", padding: 12, borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, maxHeight: "48vh", overflowY: "auto" } }, preview.slice(0, 6000)) : null,
          h("div", { className: "flex flex-wrap", style: { gap: 10, marginTop: 18 } },
            h(Btn, { t, solid: true, disabled: busy, onClick: doImport, wk: "nestimport" }, busy ? "……" : "导进我的手机"),
            (it.mine || admin) ? h(Btn, { t, disabled: busy, onClick: doDelete, wk: "nestdelete" }, armed ? "再点一下就删" : (it.mine ? "删掉我传的这个" : "删掉这一条")) : null))));
  }

  // ── 传一个上去 ─────────────────────────────────────────────
  function Upload({ t, props, initialKind, onClose, onDone }) {
    const [kind, setKind] = useState(initialKind || "theme");
    const [pick, setPick] = useState({});        // 世界书可多选；其余单选（存 id → true）
    const [text, setText] = useState("");          // 主题 / 美化 / CSS：贴一份或选文件
    const [title, setTitle] = useState(""), [intro, setIntro] = useState(""), [nick, setNick] = useState("");
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    useEffect(() => { setPick({}); setText(""); }, [kind]);
    const styles = (loadJSON("x_offlineStyles", []) || []).filter(s => s && s.prompt);
    const presets = window.StylePresets ? window.StylePresets.list() : [];
    const chars = (props.characters || []).filter(c => c && !c.npc && c.persona);
    const lore = props.loreEntries || [];
    const rows = kind === "lore" ? lore.map(e => ({ id: e.id, name: e.title || "未命名", sub: String(e.payload || "").slice(0, 40) }))
      : kind === "style" ? styles.map(s => ({ id: s.key, name: s.name, sub: String(s.prompt).slice(0, 40) }))
      : kind === "preset" ? presets.map(p => ({ id: p.id, name: p.name, sub: (p.mods || []).length + " 个模块" }))
      : kind === "persona" ? chars.map(c => ({ id: c.id, name: c.name, sub: c.tagline || "" })) : null;
    const multi = kind === "lore";
    const toggle = id => setPick(p => multi ? Object.assign({}, p, { [id]: !p[id] }) : { [id]: true });
    const chosen = Object.keys(pick).filter(k => pick[k]);
    useEffect(() => {   // 选了一样就顺手把名字填上（她还能改）
      if (!rows || title) return;
      const r = rows.find(x => x.id === chosen[0]); if (r && !multi) setTitle(String(r.name || "").slice(0, 40));
    }, [chosen.join(",")]);
    const readFile = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try { setText(await f.text()); if (!title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40)); }
      catch (err) { props.toast("这份文件读不出来"); }
    };
    const build = () => {
      if (kind === "theme" || kind === "look" || kind === "css") {
        const s = String(text || "").replace(/^﻿/, "").trim();
        if (!s) throw new Error(kind === "css" ? "先把 CSS 贴进来" : "先选导出的那份文件，或者整份贴进来");
        return s;
      }
      if (!chosen.length) throw new Error("先挑一样");
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
    const field = (val, set, ph, max, area) => h(area ? "textarea" : "input", { value: val, maxLength: max, placeholder: ph, rows: area ? 3 : undefined,
      onChange: e => set(e.target.value),
      className: "w-full outline-none", style: { fontFamily: F_BODY, fontSize: 14, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 10, padding: "10px 12px", marginTop: 8, resize: "none" } });
    const k = KINDS.find(x => x.key === kind);
    return h("div", { "data-wk": "nestupload", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "传一个上去", onBack: onClose, bg: "transparent" }),
      h(Cubbies, { t, kind, noAll: true, onPick: setKind }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pt-2 pb-8" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.6 } }, k.hint + "。不带图、不带记忆和聊天，传的人随时能删。"),
        rows ? h("div", { style: { marginTop: 12 } },
          rows.length ? rows.map(r => h("button", { key: r.id, onClick: () => toggle(r.id), className: "w-full flex items-start active:opacity-70",
            style: { gap: 10, minHeight: 44, padding: "8px 0", textAlign: "left", borderBottom: "1px solid " + t.line } },
            h("span", { style: { flexShrink: 0, marginTop: 2, width: 17, height: 17, borderRadius: multi ? 5 : 999, border: "1px solid " + (pick[r.id] ? t.ink : t.line), background: pick[r.id] ? t.ink : "transparent", color: t.bg, fontSize: 11, lineHeight: "16px", textAlign: "center" } }, pick[r.id] ? "✓" : ""),
            h("span", { className: "min-w-0" },
              h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: t.ink } }, r.name),
              r.sub ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, r.sub) : null)))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "14px 0" } }, "手上还没有能传的" + k.zh))
        : h("div", { style: { marginTop: 12 } },
            kind !== "css" ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, lineHeight: 1.6, marginBottom: 6 } },
              kind === "theme" ? "去「设置 → 主题工作台」点「导出」存一份文件，在这儿选它；带图标、壁纸、自传字体的那几样先别勾。"
                : "去「设置 → 聊天气泡」点「导出」存一份文件，在这儿选它。") : null,
            h("div", { className: "flex", style: { gap: 10 } },
              h(Btn, { t, onClick: () => fileRef.current && fileRef.current.click() }, "选文件"),
              h("input", { ref: fileRef, type: "file", accept: kind === "css" ? ".css,.txt,text/css,text/plain" : ".json,application/json,text/plain", style: { display: "none" }, onChange: readFile })),
            field(text, setText, kind === "css" ? "或者把 CSS 整段贴在这儿" : "或者把那份文件的内容整份贴在这儿", 262144, true)),
        h("div", { style: { marginTop: 18, fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "名字"),
        field(title, setTitle, "别人在列表里看到的名字", 40),
        h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "说两句（可不填）"),
        field(intro, setIntro, "适合什么、怎么用", 200, true),
        h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "署名（可不填）"),
        field(nick, setNick, "不填就不显示", 20),
        h("div", { style: { marginTop: 20 } }, h(Btn, { t, solid: true, disabled: busy, onClick: send, wk: "nestsend" }, busy ? "在传……" : "传上去"))));
  }

  // ── 小窝首页 ─────────────────────────────────────────────
  function NestApp(props) {
    const t = useTheme();
    const [kind, setKind] = useState("");
    const [sort, setSort] = useState("new");
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
    return h("div", { "data-wk": "nestpage", className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "秋秋小窝", sub: adminToken() ? "管理中" : "", onBack: props.onBack, onTitleTap, bg: "transparent",
        right: h("button", { "data-wk": "nestupbtn", onClick: () => setUploading(true), className: "active:opacity-60", style: { fontFamily: F_BODY, fontSize: 13, color: t.ink, minHeight: 40, padding: "0 4px" } }, "传一个") }),
      h(Cubbies, { t, kind, onPick: setKind }),
      h("div", { className: "shrink-0 flex items-center px-4 pb-2", style: { gap: 10 } },
        h("input", { value: q, onChange: e => setQ(e.target.value), placeholder: "找名字、简介、署名", maxLength: 40, className: "flex-1 min-w-0 outline-none",
          style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, background: t.bg2, border: "1px solid " + t.line, borderRadius: 999, padding: "8px 14px" } }),
        h("button", { "data-wk": "nestsort", onClick: () => setSort(s => s === "new" ? "hot" : "new"), className: "active:opacity-60",
          style: { flexShrink: 0, minHeight: 36, fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, sort === "new" ? "最新 ⇅" : "导得多 ⇅")),
      h("div", { ref: listRef, className: "flex-1 min-h-0 overflow-y-auto px-4 pb-8" },
        err ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px" } }, err)
        : (!items.length && !loading) ? h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: t.fog, padding: "24px 4px", lineHeight: 1.7 } },
            qLive ? "没找到。" : "这一格还空着。右上角「传一个」，放第一样进来。")
        : items.map(it => h("button", { key: it.id, "data-wk": "nestitem", "data-kind": it.kind, onClick: () => enter(it.id), className: "w-full text-left active:opacity-70",
            style: { display: "block", padding: "12px 2px", borderBottom: "1px solid " + t.line } },
            h("div", { className: "flex items-baseline", style: { gap: 8 } },
              h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 11, color: t.fog, border: "1px solid " + t.line, borderRadius: 4, padding: "0 5px" } }, KZH[it.kind] || it.kind),
              h("span", { className: "min-w-0 truncate", style: { fontFamily: F_BODY, fontSize: 15, color: t.ink } }, it.title)),
            it.intro ? h("div", { className: "truncate", style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, marginTop: 4 } }, it.intro) : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 4 } },
              (it.nick ? it.nick + " · " : "") + ago(it.created) + " · " + it.imports + " 人导过" + (it.mine ? " · 我传的" : "")))),
        loading ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog, padding: "16px 4px" } }, "在拿……")
        : more ? h("div", { style: { padding: "14px 0" } }, h(Btn, { t, onClick: () => load(items.length) }, "再往下翻")) : null));
  }

  window.NestApp = NestApp;
  window.Nest = { KINDS, importInto, packLore, packStyle, packPreset, packPersona };
})();
