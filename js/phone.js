// ============================================================
// 查手机 — 仿 iOS 桌面：12 个 app，每个独立生成/刷新，点进去看细节
// ============================================================
const PHONE_APPS = [{
  key: "wechat",
  zh: "微信"
}, {
  key: "notes",
  zh: "备忘录"
}, {
  key: "calls",
  zh: "电话"
}, {
  key: "browser",
  zh: "浏览器"
}, {
  key: "shopping",
  zh: "购物"
}, {
  key: "album",
  zh: "相册"
}, {
  key: "forum",
  zh: "论坛"
}, {
  key: "music",
  zh: "音乐"
}, {
  key: "settings",
  zh: "设置"
}, {
  key: "recordings",
  zh: "录音"
}, {
  key: "video",
  zh: "视频"
}];
const PHONE_LABEL = PHONE_APPS.reduce((o, a) => (o[a.key] = a.zh, o), {});
// 桌面只负责摆放入口。下面这份是兜底布局；真实桌面会按角色稳定选择不同布局。
const PHONE_DOCK_KEYS = ["calls", "wechat", "browser", "music"];
const PHONE_DESKTOP_PAGES = [
  ["notes", "album", "shopping", "forum"],
  ["recordings", "video", "settings"]
];
const PHONE_DESKTOP_LAYOUTS = [{
  id: "social", label: "SOCIAL",
  dock: ["calls", "wechat", "browser", "music"],
  pages: [["notes", "album", "shopping", "forum"], ["recordings", "video", "settings"]],
  widgets: [[{ key: "wechat", span: 2, size: "hero" }, { key: "music" }, { key: "refresh" }], [{ key: "album" }, { key: "settings" }]]
}, {
  id: "archive", label: "ARCHIVE",
  dock: ["calls", "wechat", "notes", "browser"],
  pages: [["music", "album", "settings", "recordings"], ["shopping", "forum", "video"]],
  widgets: [[{ key: "notes", span: 2, size: "hero" }, { key: "settings" }, { key: "refresh" }], [{ key: "album", span: 2, size: "wide" }, { key: "music", span: 2, size: "wide" }]]
}, {
  id: "media", label: "MEDIA",
  dock: ["calls", "wechat", "music", "album"],
  pages: [["notes", "browser", "shopping", "forum"], ["recordings", "video", "settings"]],
  widgets: [[{ key: "music", span: 2, size: "hero" }, { key: "album" }, { key: "refresh" }], [{ key: "video", span: 2, size: "wide" }, { key: "settings", span: 2, size: "wide" }]]
}, {
  id: "wander", label: "WANDER",
  dock: ["calls", "wechat", "browser", "album"],
  pages: [["notes", "shopping", "music", "forum"], ["recordings", "video", "settings"]],
  widgets: [[{ key: "browser", span: 2, size: "hero" }, { key: "music" }, { key: "refresh" }], [{ key: "notes" }, { key: "album" }]]
}];
const phoneStableHash = value => [...String(value || "?")].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 7);
const phoneDesktopLayout = char => PHONE_DESKTOP_LAYOUTS[phoneStableHash(char && (char.id || char.name)) % PHONE_DESKTOP_LAYOUTS.length];
const strColor = s => AV_COLORS[[...String(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
const parseMins = s => {
  s = String(s || "");
  let m = 0;
  const hm = s.match(/(\d+)\s*(小时|时|h)/i),
    mm = s.match(/(\d+)\s*(分|min|m)/i);
  if (hm) m += parseInt(hm[1]) * 60;
  if (mm) m += parseInt(mm[1]);
  if (!hm && !mm) {
    const n = s.match(/\d+/);
    if (n) m = parseInt(n[0]);
  }
  return m;
};
const fmtMoney = n => "¥" + Number(n || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});
const fmtMD = d => d.getMonth() + 1 + "月" + d.getDate() + "日";
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
// 根据财务档案 + 生成日期，推算「跑动余额」：每天扣一笔日常消费，每月1号进月收入/扣固定支出
function computeLedger(w) {
  if (!w) return null;
  const pool = (w.dailyPool || []).filter(x => x && typeof x.amount === "number");
  const start = new Date((w._startDate || ymd(new Date(w._at || Date.now()))) + "T00:00:00");
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const daily = [];
  let firsts = 0,
    idx = 0;
  for (let d = new Date(start); d <= today; d = new Date(d.getTime() + dayMs)) {
    if (pool.length) {
      const p = pool[idx % pool.length];
      daily.push({
        date: fmtMD(d),
        items: p.items,
        amount: p.amount,
        ts: d.getTime()
      });
    }
    if (d.getDate() === 1 && d.getTime() !== start.getTime()) firsts++;
    idx++;
  }
  const monthly = Number(w.monthlyIncome) || 0,
    fixed = Number(w.fixedMonthly) || 0;
  const spentAll = daily.reduce((a, x) => a + x.amount, 0);
  const balance = (Number(w.baseBalance) || 0) + (Number(w.extra) || 0) + (monthly - fixed) * firsts - spentAll;
  const thisMonth = daily.filter(x => {
    const dt = new Date(x.ts);
    return dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear();
  });
  const monthSpend = fixed + thisMonth.reduce((a, x) => a + x.amount, 0);
  return {
    balance,
    monthIncome: monthly,
    monthSpend,
    remain: monthly - monthSpend,
    fixed,
    daily: daily.slice().reverse()
  };
}

// app 图标（线性，黑白）
function PGlyph({
  k,
  size = 26,
  color = "#1b1a17"
}) {
  const P = d => h("path", {
    d
  });
  const C = (cx, cy, r) => h("circle", {
    cx,
    cy,
    r
  });
  const R = (x, y, w, ht, rx) => h("rect", {
    x,
    y,
    width: w,
    height: ht,
    rx
  });
  const kids = {
    wechat: [P("M21 11.5a8.5 8.5 0 01-8.5 8.5 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 013.5 11.5 8.5 8.5 0 0112 3a8.5 8.5 0 019 8.5z")],
    notes: [R(5, 3, 14, 18, 2), P("M8 8h8M8 12h8M8 16h5")],
    calls: [P("M22 16.9v3a2 2 0 01-2.2 2A19.8 19.8 0 013.1 4.2 2 2 0 015 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L9 11.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.5c.9.3 1.8.6 2.8.7a2 2 0 011.7 2z")],
    browser: [C(12, 12, 9), P("M16.2 7.8l-2.1 6.4-6.4 2.1 2.1-6.4 6.4-2.1z")],
    shopping: [P("M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"), P("M3 6h18"), P("M16 10a4 4 0 01-8 0")],
    wallet: [R(3, 6, 18, 14, 2), P("M3 10h18"), C(17, 14, 1)],
    album: [R(3, 4, 18, 16, 2), C(8.5, 9, 1.5), P("M21 16l-5-5L5 20")],
    forum: [P("M21 15a2 2 0 01-2 2H8l-4 4V5a2 2 0 012-2h13a2 2 0 012 2z"), P("M8 9h8M8 12h5")],
    music: [P("M9 18V5l12-2v13"), C(6, 18, 3), C(18, 16, 3)],
    settings: [C(12, 12, 3), P("M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z")],
    recordings: [R(9, 2, 6, 12, 3), P("M5 10v2a7 7 0 0014 0v-2"), P("M12 19v3")],
    video: [R(2, 5, 20, 14, 3), h("polygon", {
      points: "10,9 16,12 10,15",
      fill: color,
      stroke: "none"
    })]
  };
  return h(Svg, {
    size,
    color,
    sw: 1.5
  }, ...(kids[k] || []));
}

// 点开某条看细节的通用 sheet 内容（在事件里构造，需显式传 t）
const DetailSheet = (title, body, t) => h("div", null, h(Eyebrow, {
  style: {
    marginBottom: 8
  }
}, title), h("div", {
  style: {
    fontFamily: F_BODY,
    fontSize: 14,
    lineHeight: 1.8,
    color: t.ink,
    whiteSpace: "pre-wrap"
  }
}, body || "（无内容）"));
const RecSheet = (it, t) => h("div", null, h(Eyebrow, {
  style: {
    marginBottom: 8
  }
}, it.name), h("div", {
  style: {
    fontFamily: F_BODY,
    fontSize: 14,
    lineHeight: 1.8,
    color: t.ink,
    whiteSpace: "pre-wrap"
  }
}, it.transcript || "（无转录）"), it.thought && h("div", {
  style: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: `1px solid ${t.line}`
  }
}, h(Eyebrow, {
  style: {
    marginBottom: 6
  }
}, "TA 的想法"), h("div", {
  style: {
    fontFamily: F_BODY,
    fontSize: 13,
    lineHeight: 1.7,
    color: t.sub,
    fontStyle: "italic"
  }
}, it.thought)));
const WeChatThread = (c, char, t) => h("div", null, h(Eyebrow, {
  style: {
    marginBottom: 12
  }
}, c.name), h("div", {
  className: "space-y-2"
}, (c.messages || []).map((m, i) => {
  const self = m.from === char.name || m.from === "我" || m.from === "本人";
  return h("div", {
    key: i,
    className: "flex " + (self ? "justify-end" : "justify-start")
  }, h("div", {
    style: {
      maxWidth: "76%",
      padding: "8px 12px",
      borderRadius: 14,
      fontFamily: F_BODY,
      fontSize: 13.5,
      lineHeight: 1.5,
      background: self ? "#95d16f" : "#fff",
      color: self ? "#16330a" : t.ink,
      border: self ? "none" : `1px solid ${t.line}`
    }
  }, m.text));
})));

function WeChatView({ d, char, t, setSheet, profile }) {
  const [tab, setTab] = useState("chats");
  const arr = a => Array.isArray(a) ? a : [];
  const actual = arr(d.actualChats), generated = arr(d.chats);
  const meName = profile && profile.name || "Lisa";
  const chatRow = (c, i, real) => h("button", {
    key: (real ? "r" : "g") + i + (c.id || c.name || ""),
    onClick: () => c.messages && c.messages.length && setSheet(WeChatThread(c, char, t)),
    className: "w-full text-left py-3 flex items-center gap-3 active:opacity-60",
    style: { borderTop: `1px solid ${t.line}` }
  }, h(Avatar, { character: { name: c.name, color: strColor(c.name) }, size: 43, radius: c.type === "group" ? 13 : 999 }), h("div", { className: "flex-1 min-w-0" },
    h("div", { className: "flex items-baseline justify-between gap-2" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.name), h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, c.time || "")),
    h("div", { className: "flex items-center gap-1.5", style: { marginTop: 2 } }, real && h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: 9, color: t.tint, padding: "1px 5px", borderRadius: 999, background: t.bg2 } }, "真实"), h("span", { style: { minWidth: 0, fontFamily: F_BODY, fontSize: 12.5, color: t.fog, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.last || ""))));
  const contactRow = (c, i) => h("button", {
    key: "c" + i + (c.name || ""),
    onClick: () => setSheet(h("div", null, h("div", { className: "flex items-center gap-3 mb-5" }, h(Avatar, { character: { name: c.name, color: strColor(c.name) }, size: 58, radius: 16 }), h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink } }, c.remark || c.name), h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginTop: 3 } }, c.name))), h(Eyebrow, { style: { marginBottom: 7 } }, "TA 眼里的这个人"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: t.sub } }, c.intro || "没有留下更多介绍。"))),
    className: "w-full text-left py-3 flex items-center gap-3 active:opacity-60", style: { borderTop: `1px solid ${t.line}` }
  }, h(Avatar, { character: { name: c.name, color: strColor(c.name) }, size: 42, radius: 12 }), h("div", { className: "min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink } }, c.remark || c.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.intro || c.name)));
  const moments = arr(d.moments), accounts = arr(d.me && d.me.accounts);
  let body;
  if (tab === "chats") body = h("div", null,
    actual.length ? h("div", null, h(Eyebrow, { style: { margin: "4px 0 8px" } }, "手机里已有的聊天 · " + actual.length), actual.map((c, i) => chatRow(c, i, true))) : null,
    h(Eyebrow, { style: { margin: actual.length ? "20px 0 8px" : "4px 0 8px" } }, "其他会话 · " + generated.length), generated.map((c, i) => chatRow(c, i, false)));
  else if (tab === "contacts") {
    const contacts = [{ name: meName, remark: meName, intro: "置顶联系人。你们真实的关系与共同经历，以主聊天和记忆为准。" }, ...arr(d.contacts)];
    body = h("div", null, h(Eyebrow, { style: { margin: "4px 0 8px" } }, "联系人 · " + contacts.length), contacts.map(contactRow));
  } else if (tab === "moments") body = h("div", { className: "space-y-5" }, moments.map((m, i) => h("div", { key: "m" + i, className: "flex gap-3 pb-5", style: { borderBottom: `1px solid ${t.line}` } }, h(Avatar, { character: { name: m.author, color: strColor(m.author) }, size: 40, radius: 11 }), h("div", { className: "flex-1 min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: t.tint } }, m.author), h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.65, color: t.ink, marginTop: 5 } }, m.content), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 7 } }, m.time || ""), arr(m.likes).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint, background: t.bg2, padding: "7px 9px", marginTop: 8, borderRadius: "9px 9px 0 0" } }, "♡ " + arr(m.likes).join("、")) : null, arr(m.comments).length ? h("div", { style: { background: t.bg2, padding: "5px 9px 8px", borderRadius: arr(m.likes).length ? "0 0 9px 9px" : 9 } }, arr(m.comments).map((x, j) => h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 11.8, lineHeight: 1.55, color: t.sub } }, h("b", { style: { color: t.tint } }, (x.from || "朋友") + "："), x.text))) : null))));
  else body = h("div", null, h("div", { className: "flex items-center gap-4 py-4" }, h(Avatar, { character: char, size: 68, radius: 17 }), h("div", { className: "min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, color: t.ink } }, char.remark || char.name), h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55, color: t.fog, marginTop: 5 } }, d.me && d.me.signature || "还没有写朋友圈签名。"))), h("button", {
    onClick: () => setSheet(h("div", null, h(Eyebrow, { style: { marginBottom: 14 } }, "最近读过的公众号文章"), accounts.map((a, i) => h("div", { key: i, className: "pb-5 mb-5", style: { borderBottom: `1px solid ${t.line}` } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.5, color: t.ink } }, a.title), h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } }, [a.source, a.time].filter(Boolean).join(" · ")), h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.sub, marginTop: 10 } }, a.summary), h(Eyebrow, { style: { marginTop: 14, marginBottom: 5 } }, char.name + " 看完想了什么"), h("div", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, color: t.ink, fontStyle: "italic" } }, a.thought))))), className: "w-full mt-5 p-4 flex items-center justify-between text-left active:opacity-60", style: { borderRadius: 16, border: `1px solid ${t.line}`, background: t.bg2 }
  }, h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink } }, "公众号"), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 3 } }, "最近读过 " + accounts.length + " 篇 · 点开看感想")), h(IChevR, { size: 16, color: t.fog })));
  const tabs = [["chats", "聊天"], ["contacts", "联系人"], ["moments", "朋友圈"], ["me", "我"]];
  return h("div", { style: { animation: "fadeUp .3s ease both", paddingBottom: 64 } }, body, h("div", { className: "grid grid-cols-4", style: { position: "sticky", bottom: -16, zIndex: 5, margin: "24px -24px -16px", padding: "10px 8px calc(10px + env(safe-area-inset-bottom))", background: "rgba(248,247,243,.96)", backdropFilter: "blur(16px)", borderTop: `1px solid ${t.line}` } }, tabs.map(([k, label]) => h("button", { key: k, onClick: () => setTab(k), className: "py-1 active:opacity-60", style: { fontFamily: F_BODY, fontSize: 11.5, color: tab === k ? t.tint : t.fog, fontWeight: tab === k ? 700 : 400 } }, label))));
}

// 相册：可把喜欢的照片收藏进 x_phoneKeep（按角色分组），刷新全部/单个都不会覆盖它
function AlbumView({ d, char, t, setSheet }) {
  const [keep, setKeep] = useState(() => loadJSON("x_phoneKeep", {}));
  const arr = a => a || [];
  const sig = p => (p.caption || "") + "|" + (p.desc || ""); // 照片无 id，用标题+描述判重
  const saved = arr(keep[char.id]);
  const isSaved = p => saved.some(s => sig(s) === sig(p));
  const toggle = p => setKeep(prev => {
    const list = arr(prev[char.id]);
    const exists = list.some(s => sig(s) === sig(p));
    const nl = exists ? list.filter(s => sig(s) !== sig(p)) : [{ caption: p.caption || "照片", desc: p.desc || "", _at: Date.now() }, ...list];
    const n = { ...prev, [char.id]: nl };
    saveJSON("x_phoneKeep", n);
    return n;
  });
  const tile = (it, i) => h("div", {
    key: i,
    style: { position: "relative" }
  }, h("button", {
    onClick: () => setSheet(DetailSheet(it.caption || "照片", it.desc, t)),
    className: "active:opacity-70 w-full"
  }, h("div", {
    style: {
      position: "relative",
      width: "100%",
      paddingBottom: "100%",
      borderRadius: 12,
      overflow: "hidden",
      background: "linear-gradient(135deg,#d8d3c8,#b3ada0)"
    }
  }, h("div", {
    style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }
  }, h(PGlyph, { k: "album", size: 22, color: "rgba(255,255,255,0.85)" }))), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10,
      color: t.fog,
      marginTop: 4,
      textAlign: "center",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, it.caption), it._at ? h("div", {
    style: { fontFamily: F_BODY, fontSize: 9, color: t.fog, marginTop: 1, textAlign: "center" }
  }, "收藏于 " + ymd(new Date(it._at))) : null), h("button", {
    onClick: e => { e.stopPropagation(); toggle(it); },
    className: "active:opacity-60",
    style: {
      position: "absolute",
      top: 5,
      right: 5,
      width: 24,
      height: 24,
      borderRadius: 999,
      background: "rgba(0,0,0,0.32)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, h(IHeart, { size: 13, color: "#fff", filled: isSaved(it) })));
  const grid = items => h("div", { className: "grid grid-cols-3 gap-2" }, items.map(tile));
  return h("div", {
    style: { animation: "fadeUp .3s ease both" }
  }, saved.length ? h("div", {
    style: { marginBottom: 18 }
  }, h(Eyebrow, { style: { marginBottom: 10 } }, "收藏 · " + saved.length), grid(saved)) : null, saved.length ? h(Eyebrow, { style: { marginBottom: 10 } }, "相册") : null, grid(arr(d.items)));
}

// 各 app 详情内容
function renderPhoneModule(key, d, ctx) {
  const {
    t,
    char,
    setSheet,
    vtab,
    setVtab
  } = ctx;
  const line = {
    borderTop: `1px solid ${t.line}`
  };
  const wrap = kids => h("div", {
    style: {
      animation: "fadeUp .3s ease both"
    }
  }, kids);
  const arr = a => a || [];
  if (key === "wechat") return h(WeChatView, { d, char, t, setSheet, profile: ctx.profile });
  if (key === "notes") return wrap(arr(d.items).map((it, i) => h("button", {
    key: i,
    onClick: () => setSheet(DetailSheet(it.title, it.detail, t)),
    className: "w-full text-left py-3.5 flex items-start justify-between gap-3",
    style: line
  }, h("div", {
    className: "flex-1"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.ink
    }
  }, it.title), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: t.fog,
      marginTop: 3
    }
  }, it.time)), h(IChevR, {
    size: 14,
    color: t.line,
    style: {
      marginTop: 4
    }
  }))));
  if (key === "calls") return wrap(arr(d.items).map((it, i) => {
    const missed = it.connected === false;
    const out = it.dir === "out";
    const mark = missed ? "✕" : out ? "↗" : "↙";
    return h("div", {
      key: i,
      className: "py-3 flex items-center gap-3",
      style: line
    }, h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 15,
        width: 16,
        textAlign: "center",
        color: missed ? t.accent : t.tint
      }
    }, mark), h("div", {
      className: "flex-1"
    }, h("div", {
      style: {
        fontFamily: F_DISPLAY,
        fontSize: 14.5,
        color: missed ? t.accent : t.ink
      }
    }, it.name), h("div", {
      style: {
        fontFamily: F_BODY,
        fontSize: 10.5,
        color: t.fog,
        marginTop: 2
      }
    }, (out ? "去电" : "来电") + (missed ? " · 未接" : it.duration ? " · " + it.duration : " · 已接"))), h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 10.5,
        color: t.fog
      }
    }, it.time));
  }));
  if (key === "browser") return wrap(arr(d.items).map((it, i) => h("button", {
    key: i,
    onClick: () => setSheet(DetailSheet(it.title, (it.url ? "🔗 " + it.url + "\n\n" : "") + (it.content || ""), t)),
    className: "w-full text-left py-3.5 flex items-start justify-between gap-3",
    style: line
  }, h("div", {
    className: "flex-1 min-w-0"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14.5,
      color: t.ink
    }
  }, it.title), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.tint,
      marginTop: 2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, it.url), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: t.fog,
      marginTop: 2
    }
  }, it.time)), h(IChevR, {
    size: 14,
    color: t.line,
    style: {
      marginTop: 3
    }
  }))));
  if (key === "shopping") return wrap(arr(d.items).map((it, i) => h("button", {
    key: i,
    onClick: () => setSheet(DetailSheet(it.name, it.thought, t)),
    className: "w-full text-left py-3.5 flex items-start justify-between gap-3",
    style: line
  }, h("div", {
    className: "flex-1"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14.5,
      color: t.ink
    }
  }, it.name), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: t.fog,
      marginTop: 2
    }
  }, it.time)), h("div", {
    className: "flex items-center gap-2"
  }, h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.accent
    }
  }, it.price), h(IChevR, {
    size: 14,
    color: t.line
  })))));
  if (key === "album") return h(AlbumView, { d, char, t, setSheet });
  if (key === "forum") return wrap(arr(d.items).map((it, i) => h("div", {
    key: i,
    className: "py-3.5",
    style: line
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 15,
      color: t.ink,
      lineHeight: 1.4
    }
  }, it.title), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: t.fog,
      marginTop: 4
    }
  }, it.time))));
  if (key === "music") return h("div", {
    style: {
      animation: "fadeUp .3s ease both"
    }
  }, h("div", {
    className: "mb-5"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 22,
      color: t.ink
    }
  }, d.playlist || "歌单"), d.desc && h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 12,
      color: t.fog,
      marginTop: 4
    }
  }, d.desc)), arr(d.songs).map((s, i) => h("div", {
    key: i,
    className: "py-2.5 flex items-center gap-3",
    style: {
      borderTop: `1px solid ${t.line}`
    }
  }, h("span", {
    style: {
      fontFamily: "'Archivo',sans-serif",
      fontSize: 11,
      color: t.fog,
      width: 20
    }
  }, String(i + 1).padStart(2, "0")), h(PGlyph, {
    k: "music",
    size: 15,
    color: t.fog
  }), h("div", {
    className: "flex-1 min-w-0"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14,
      color: t.ink
    }
  }, s.name), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 11,
      color: t.fog,
      marginTop: 1
    }
  }, s.artist)))));
  if (key === "settings") {
    const apps = arr(d.apps),
      mins = apps.map(a => parseMins(a.time)),
      max = Math.max(1, ...mins);
    return h("div", {
      style: {
        animation: "fadeUp .3s ease both"
      }
    }, h("div", {
      className: "mb-6 text-center py-5",
      style: {
        borderRadius: 16,
        background: t.bg2,
        border: `1px solid ${t.line}`
      }
    }, h(Eyebrow, null, "日均屏幕使用时间"), h("div", {
      style: {
        fontFamily: F_DISPLAY,
        fontSize: 30,
        color: t.ink,
        marginTop: 6
      }
    }, d.screenTime || "—")), h(Eyebrow, {
      style: {
        marginBottom: 12
      }
    }, "各 App 使用"), apps.map((a, i) => h("div", {
      key: i,
      className: "py-2.5",
      style: i > 0 ? {
        borderTop: `1px solid ${t.line}`
      } : null
    }, h("div", {
      className: "flex items-baseline justify-between mb-1.5"
    }, h("span", {
      style: {
        fontFamily: F_DISPLAY,
        fontSize: 14,
        color: t.ink
      }
    }, a.name), h("span", {
      style: {
        fontFamily: F_BODY,
        fontSize: 11,
        color: t.fog
      }
    }, a.time)), h("div", {
      style: {
        height: 6,
        borderRadius: 6,
        background: t.line,
        overflow: "hidden"
      }
    }, h("div", {
      style: {
        height: "100%",
        width: Math.round(mins[i] / max * 100) + "%",
        background: t.tint,
        borderRadius: 6
      }
    })))));
  }
  if (key === "recordings") return wrap(arr(d.items).map((it, i) => h("button", {
    key: i,
    onClick: () => setSheet(RecSheet(it, t)),
    className: "w-full text-left py-3.5 flex items-center justify-between gap-3",
    style: line
  }, h("div", {
    className: "flex items-center gap-3 flex-1 min-w-0"
  }, h("div", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 10,
      flexShrink: 0,
      background: t.bg2,
      border: `1px solid ${t.line}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, h(PGlyph, {
    k: "recordings",
    size: 16,
    color: t.tint
  })), h("div", {
    className: "flex-1 min-w-0"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 14.5,
      color: t.ink,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, it.name), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: t.fog,
      marginTop: 2
    }
  }, it.time))), h(IChevR, {
    size: 14,
    color: t.line
  }))));
  if (key === "video_day") return wrap(arr(d.items).map((v, i) => h("div", {
    key: i,
    className: "py-3 flex gap-3",
    style: {
      borderTop: `1px solid ${t.line}`
    }
  }, h("div", {
    style: {
      position: "relative",
      width: 116,
      height: 66,
      borderRadius: 8,
      flexShrink: 0,
      overflow: "hidden",
      background: "linear-gradient(135deg,#cfc9bd,#b3ada0)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, h(PGlyph, {
    k: "video",
    size: 20,
    color: "#fff"
  }), v.duration && h("div", {
    style: {
      position: "absolute",
      right: 4,
      bottom: 4,
      background: "rgba(0,0,0,.65)",
      color: "#fff",
      fontFamily: F_BODY,
      fontSize: 9.5,
      lineHeight: 1.4,
      padding: "1px 5px",
      borderRadius: 4
    }
  }, v.duration)), h("div", {
    className: "flex-1 min-w-0"
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 13.5,
      color: t.ink,
      lineHeight: 1.4,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    }
  }, v.title), h("div", {
    style: {
      fontFamily: F_BODY,
      fontSize: 10.5,
      color: t.fog,
      marginTop: 3
    }
  }, (v.up || "") + (v.tag ? " · " + v.tag : ""))))));
  if (key === "video_night") return wrap(arr(d.items).map((v, i) => h("button", {
    key: i,
    onClick: () => setSheet(DetailSheet(v.title, v.thought, t)),
    className: "w-full text-left py-3 flex gap-3",
    style: {
      borderTop: `1px solid ${t.line}`
    }
  }, h("div", {
    style: {
      position: "relative",
      width: 116,
      height: 66,
      flexShrink: 0,
      borderRadius: 8,
      overflow: "hidden",
      background: `linear-gradient(135deg, ${t.bg2}, ${t.line})`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, h("svg", {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24"
  }, h("polygon", {
    points: "9,7 9,17 17,12",
    fill: t.fog
  })), v.duration && h("div", {
    style: {
      position: "absolute",
      right: 4,
      bottom: 4,
      background: "rgba(0,0,0,.65)",
      color: "#fff",
      fontFamily: F_BODY,
      fontSize: 9.5,
      lineHeight: 1.4,
      padding: "1px 5px",
      borderRadius: 4
    }
  }, v.duration)), h("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, h("div", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 13.5,
      color: t.ink,
      lineHeight: 1.4,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    }
  }, v.title), h("div", {
    className: "flex flex-wrap gap-1.5 mt-2"
  }, arr(v.tags).map((tg, j) => h("span", {
    key: j,
    style: {
      fontFamily: F_BODY,
      fontSize: 10,
      color: t.sub,
      padding: "2px 7px",
      borderRadius: 999,
      background: t.bg2,
      border: `1px solid ${t.line}`
    }
  }, tg)))))));
  return null;
}

// 单个 app 的详情页
function PhoneApp({
  appKey,
  char,
  charData,
  busyKey,
  onGen,
  onBack,
  profile,
  actualWechat
}) {
  const t = useTheme();
  const [sheet, setSheet] = useState(null);
  const [vtab, setVtab] = useState(null); // 视频子版块：day / night，默认不选
  const zh = PHONE_LABEL[appKey];
  const rawData = charData[appKey];
  const data = appKey === "wechat" && rawData ? { ...rawData, actualChats: actualWechat || [] } : rawData;
  const loading = busyKey === appKey;
  const isVideo = appKey === "video";
  // 打开非视频版块：直接生成，失败退回上一级（不再显示中间的「生成」页）
  useEffect(() => {
    if (isVideo || charData[appKey]) return;
    let alive = true;
    Promise.resolve(onGen(char, appKey)).then(ok => { if (alive && ok === false) onBack(); });
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [appKey]);
  // 视频子版块：点击 tab 时直接生成，失败退回上一级
  const genVideo = k => Promise.resolve(onGen(char, "video_" + k)).then(ok => { if (ok === false) setVtab(null); });
  let content;
  if (isVideo) {
    const subKey = vtab ? "video_" + vtab : null;
    const subData = subKey ? charData[subKey] : null;
    const subLoading = subKey && busyKey === subKey;
    const tabBtn = (k, l) => h("button", {
      key: k,
      onClick: () => {
        setVtab(k);
        if (!charData["video_" + k] && busyKey !== "video_" + k) genVideo(k);
      },
      className: "px-5 py-2",
      style: {
        borderRadius: 999,
        fontFamily: F_BODY,
        fontSize: 13,
        background: vtab === k ? t.ink : "transparent",
        color: vtab === k ? t.bg2 : t.fog,
        border: `1px solid ${vtab === k ? t.ink : t.line}`
      }
    }, l);
    content = h("div", {
      style: {
        animation: "fadeUp .3s ease both"
      }
    }, h("div", {
      className: "flex gap-2 mb-5"
    }, tabBtn("day", "白天"), tabBtn("night", "深夜")), !vtab ? h("div", {
      style: {
        fontFamily: F_BODY,
        fontSize: 12.5,
        color: t.fog,
        textAlign: "center",
        padding: "40px 0"
      }
    }, "点「白天」或「深夜」查看 TA 在看的视频") : subLoading ? h(Spinner, {
      label: "正在读取…"
    }) : subData ? renderPhoneModule(subKey, subData, {
      t,
      char,
      setSheet
    }) : h(Spinner, {
      label: "正在读取…"
    }));
  } else if (loading) content = h(Spinner, {
    label: "正在读取 " + zh + "…"
  });else if (!data) content = h(Spinner, {
    label: "正在读取 " + zh + "…"
  });else content = renderPhoneModule(appKey, data, {
    t,
    char,
    setSheet,
    profile
  });
  const refreshKey = isVideo ? vtab ? "video_" + vtab : null : appKey;
  return h("div", {
    className: "h-full flex flex-col",
    style: {
      background: t.bg
    }
  }, h(Head, {
    zh,
    en: char.name,
    onBack,
    right: refreshKey && h("button", {
      onClick: () => onGen(char, refreshKey),
      disabled: !!busyKey,
      className: "active:opacity-50 disabled:opacity-40"
    }, h(IRefresh, {
      size: 18,
      color: t.ink
    }))
  }), h("div", {
    className: "flex-1 overflow-y-auto px-6 py-4"
  }, content), sheet && h(Sheet, {
    onClose: () => setSheet(null),
    tall: true
  }, sheet));
}

// 查手机主界面：仿桌面
function PhoneCarry({
  characters,
  phones,
  selId,
  busyKey,
  onBack,
  onSel,
  onGenApp,
  onGenAll,
  profile,
  actualWechatFor
}) {
  const t = useTheme();
  const [pick, setPick] = useState(false);
  const [open, setOpen] = useState(null);
  const [deskPage, setDeskPage] = useState(0);
  const deskRef = useRef(null);
  const [inList, setInList] = useState(true); // 先看通讯录列表，点某人才进 Ta 的手机
  // 绿点 = 有数据且还没看过；打开即消，刷新全部时重新点亮
  const [seen, setSeen] = useState(() => loadJSON("x_phoneSeen", {}));
  const isSeen = (cid, k) => !!(seen[cid] && seen[cid][k]);
  const markSeen = (cid, k) => setSeen(p => { const n = { ...p, [cid]: { ...(p[cid] || {}), [k]: true } }; saveJSON("x_phoneSeen", n); return n; });
  const clearSeen = cid => setSeen(p => { const n = { ...p }; delete n[cid]; saveJSON("x_phoneSeen", n); return n; });
  const char = characters.find(c => c.id === selId) || characters[0];
  if (!char) return h("div", {
    className: "h-full flex flex-col"
  }, h(Head, {
    zh: "查手机",
    en: "Inspect",
    onBack
  }), h(Empty, {
    text: "还没有角色",
    sub: "先去名录录入一位"
  }));
  // 通讯录列表：做成一块「手机屏」——顶部我的头像+通讯录，下面角色列表在屏内下滑；点某人才进 Ta 的手机
  if (inList) {
    const p = profile || {};
    const meAv = { name: p.name || "我", avatarImage: p.avatarImage, color: p.color || t.accent };
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "查手机", en: "Whose Phone", onBack }),
      h("div", { className: "flex-1 min-h-0 px-4 pb-6" },
        h("div", { className: "h-full flex flex-col rounded-[30px] overflow-hidden", style: { background: "linear-gradient(180deg,#fbfaf7,#f1eee7)", border: "1px solid " + t.line, boxShadow: "0 12px 34px rgba(0,0,0,0.10)" } },
          // 手机顶栏：我的头像 + 通讯录
          h("div", { className: "shrink-0 flex items-center gap-3 px-5 pt-6 pb-4", style: { borderBottom: "1px solid " + t.line } },
            h(Avatar, { character: meAv, size: 50, radius: 999 }),
            h("div", { className: "flex-1 min-w-0" },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: t.ink, lineHeight: 1.1 } }, "通讯录"),
              h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: "0.18em", color: t.fog, marginTop: 3 } }, "CONTACTS · " + characters.length))),
          // 角色列表：在手机屏内下滑
          h("div", { className: "flex-1 min-h-0 overflow-y-auto px-4 py-1" },
            characters.map(c => h("button", {
              key: c.id, onClick: () => { onSel(c.id); setOpen(null); setInList(false); },
              className: "w-full flex items-center gap-3 py-3 active:opacity-60", style: { borderBottom: "1px solid " + t.line }
            },
              h(Avatar, { character: c, size: 44, radius: 13 }),
              h("div", { className: "flex-1 min-w-0 text-left" },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 1 } }, "翻翻 Ta 的手机")),
              h("span", { style: { fontFamily: F_BODY, fontSize: 20, color: t.fog, flexShrink: 0 } }, "›")))))));
  }
  const data = phones[char.id] || {};
  const hasData = a => a.key === "video" ? data.video_day || data.video_night : data[a.key];
  const appByKey = k => PHONE_APPS.find(a => a.key === k);
  const openApp = a => {
    if (!a || a.soon) return;
    markSeen(char.id, a.key);
    setOpen(a.key);
  };
  const latestLine = (value, fallback) => {
    if (!value) return fallback;
    const pool = value.chats || value.items || value.songs || value.apps;
    const x = Array.isArray(pool) && pool[0];
    return String((x && (x.last || x.title || x.caption || x.name || x.transcript)) || value.desc || value.playlist || value.screenTime || fallback);
  };
  const appIcon = (a, compact) => h("button", {
    key: a.key,
    onClick: () => openApp(a),
    className: "flex flex-col items-center active:opacity-60",
    style: { gap: compact ? 4 : 7, minWidth: 0 }
  }, h("div", {
    className: "relative flex items-center justify-center",
    style: {
      width: compact ? 46 : 56,
      height: compact ? 46 : 56,
      borderRadius: compact ? 14 : 17,
      background: "rgba(255,255,255,.88)",
      border: "1px solid rgba(255,255,255,.72)",
      boxShadow: "0 8px 22px rgba(28,25,20,.10)"
    }
  }, h(PGlyph, { k: a.key, size: compact ? 23 : 27, color: t.ink }), hasData(a) && !isSeen(char.id, a.key) && h("span", {
    style: {
      position: "absolute", top: -3, right: -3, width: 10, height: 10,
      borderRadius: 9, background: "#78bd58", border: "2px solid rgba(255,255,255,.95)"
    }
  })), !compact && h("span", {
    style: {
      width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      fontFamily: F_BODY, fontSize: 11, color: t.ink, textShadow: "0 1px 8px rgba(255,255,255,.85)"
    }
  }, a.zh));
  if (open) return h(PhoneApp, {
    appKey: open,
    char,
    charData: data,
    busyKey: busyKey === "__all__" ? open : busyKey,
    onGen: onGenApp,
    profile,
    actualWechat: actualWechatFor ? actualWechatFor(char) : [],
    onBack: () => setOpen(null)
  });
  const wall = strColor(char.id || char.name);
  const layout = phoneDesktopLayout(char);
  const widgetData = key => key === "video" ? (data.video_day || data.video_night) : data[key];
  const widgetCopy = key => {
    const fallback = {
      wechat: "点开看看最近和谁说过话", notes: "最近没有留下新备忘", browser: "最近没有浏览记录",
      music: "还没有播放记录", album: "相册还没翻过", video: "最近没有观看记录"
    }[key] || "还没有内容";
    return latestLine(widgetData(key), fallback);
  };
  const deskWidget = spec => {
    const key = spec.key;
    const wide = spec.span === 2;
    const hero = spec.size === "hero";
    const dark = key === "music" || key === "video";
    if (key === "refresh") return h("button", {
      key,
      onClick: () => { clearSeen(char.id); onGenAll(char); }, disabled: !!busyKey,
      className: "text-left active:opacity-70 disabled:opacity-50",
      style: {
        gridColumn: wide ? "span 2" : "span 1", minHeight: hero ? 124 : 104, padding: 15, borderRadius: 23,
        background: "rgba(255,255,255,.62)", border: "1px solid rgba(255,255,255,.7)"
      }
    }, h(IRefresh, { size: 19, color: t.ink }), h("div", {
      style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, marginTop: 12 }
    }, busyKey === "__all__" ? "正在翻整部手机…" : "刷新全部 App"));
    const app = appByKey(key);
    const isScreen = key === "settings";
    return h("button", {
      key,
      onClick: () => openApp(app), className: "text-left active:opacity-70",
      style: {
        gridColumn: wide ? "span 2" : "span 1", minHeight: hero ? 124 : spec.size === "wide" ? 108 : 104,
        padding: hero ? 17 : 15, borderRadius: hero ? 25 : 23,
        background: dark ? "rgba(30,29,27,.88)" : "rgba(255,255,255,.72)",
        color: dark ? "#fff" : t.ink, border: dark ? "none" : "1px solid rgba(255,255,255,.72)",
        boxShadow: hero ? "0 12px 28px rgba(35,31,25,.09)" : "none"
      }
    }, h("div", { className: "flex items-center justify-between" },
      h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".11em", color: dark ? "rgba(255,255,255,.62)" : t.fog } }, isScreen ? "屏幕使用" : app.zh),
      h(PGlyph, { k: key, size: 19, color: dark ? "#fff" : t.ink })),
    isScreen ? h("div", {
      style: { fontFamily: F_DISPLAY, fontSize: hero ? 31 : 26, marginTop: hero ? 21 : 15 }
    }, data.settings && data.settings.screenTime || "--") : h("div", {
      style: {
        fontFamily: F_DISPLAY, fontSize: hero ? 18 : 14, lineHeight: 1.42,
        marginTop: hero ? 20 : 13, display: "-webkit-box", WebkitLineClamp: hero ? 2 : 2,
        WebkitBoxOrient: "vertical", overflow: "hidden"
      }
    }, widgetCopy(key)));
  };
  const pages = layout.pages.map((keys, pageIndex) => h("section", {
    key: pageIndex,
    className: "h-full min-w-full overflow-y-auto px-5 pt-3 pb-5",
    style: { scrollSnapAlign: "start", scrollSnapStop: "always" }
  }, h("div", { className: "grid grid-cols-2 gap-3 mb-6" }, (layout.widgets[pageIndex] || []).map(deskWidget)),
  h("div", { className: "grid grid-cols-4 gap-x-2 gap-y-6" }, keys.map(k => appIcon(appByKey(k), false)))));
  return h("div", {
    className: "h-full flex flex-col overflow-hidden",
    style: {
      background: `radial-gradient(circle at 82% 12%,rgba(255,255,255,.80),transparent 31%),linear-gradient(155deg,${wall}35 0%,#eee8dc 56%,${wall}22 100%)`
    }
  }, h("div", {
    className: "shrink-0 px-5 pb-2 flex items-center justify-between",
    style: { paddingTop: safeTop(10) }
  }, h("button", { onClick: () => setInList(true), className: "active:opacity-50", "aria-label": "返回通讯录" }, h(IArrow, { size: 19, color: t.ink })),
  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, fontWeight: 600, color: t.ink } }, new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })),
  h("button", { onClick: () => setPick(true), className: "active:opacity-50", "aria-label": "切换角色" }, h(Avatar, { character: char, size: 28, radius: 9 }))),
  h("div", { className: "shrink-0 px-5 pt-1 pb-2 flex items-end justify-between" },
  h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 28, color: t.ink, lineHeight: 1.05 } }, char.remark || char.name),
  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 5 } }, "向左滑还有一页")),
  h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, letterSpacing: ".17em", color: t.fog } }, layout.label)),
  h("div", {
    ref: deskRef,
    className: "flex-1 min-h-0 flex overflow-x-auto",
    onScroll: e => {
      const el = e.currentTarget;
      const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (n !== deskPage) setDeskPage(n);
    },
    style: { scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }
  }, pages),
  h("div", { className: "shrink-0 flex justify-center gap-1.5 py-1" }, layout.pages.map((_, i) => h("button", {
    key: i, onClick: () => deskRef.current && deskRef.current.scrollTo({ left: deskRef.current.clientWidth * i, behavior: "smooth" }),
    "aria-label": "第 " + (i + 1) + " 页",
    style: { width: i === deskPage ? 15 : 6, height: 6, borderRadius: 9, background: i === deskPage ? t.ink : "rgba(30,28,24,.25)", transition: "all .2s" }
  }))),
  h("div", { className: "shrink-0 mx-4 mb-3 px-3 py-2.5 grid grid-cols-4", style: { borderRadius: 25, background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.74)", boxShadow: "0 12px 30px rgba(35,31,25,.11)" } }, layout.dock.map(k => appIcon(appByKey(k), true))), pick && h(Sheet, {
    onClose: () => setPick(false)
  }, h(Eyebrow, {
    style: {
      marginBottom: 12
    }
  }, "切换角色"), h("div", {
    className: "space-y-1 max-h-72 overflow-y-auto"
  }, characters.map(c => h("button", {
    key: c.id,
    onClick: () => {
      onSel(c.id);
      setPick(false);
      setOpen(null);
    },
    className: "w-full flex items-center gap-3 py-2.5 active:opacity-60"
  }, h(Avatar, {
    character: c,
    size: 34,
    radius: 7
  }), h("span", {
    style: {
      fontFamily: F_DISPLAY,
      fontSize: 16,
      color: t.ink
    }
  }, c.name))))));
}

// 各 app 的推演任务
function phoneProbeSpec(key, char, rel, actualWechat) {
  const relHint = rel && rel.length ? "关系网里的人（" + rel.join("、") + "）请优先出现。" : "";
  const S = {
    wechat: {
      instruction: "推演此刻「" + char.name + "」完整的微信。下面先给你 TA 手机里【真实已有、不可改写】的聊天摘要；你要避开其中已有会话名与原话，另外生成正好 5 个互不相同的新会话（私聊与群聊混合，至少各 2 个）。\n" + (actualWechat || "目前没有可用的真实聊天。") + "\n" + relHint + "chats 每个会话给名字、private/group 类型、最后一条、时间及最近 3-6 条对话。contacts 正好 5 个，不含用户 Lisa：必须是与 TA 真有关系的人，含 TA 给对方的微信备注 remark 和一段具体关系简介 intro。moments 正好 3 条，作者从 contacts 里选；每条给点赞名单和评论，且 comments 中必须有一条来自「" + char.name + "」本人的自然评论。me 写 TA 自己的朋友圈签名，并给最近看过的 3 篇公众号文章：标题、公众号、时间、摘要和 TA 看完的真实感想。所有内容贴合人物关系、近况和声纹，避免客服腔与泛泛而谈。",
      schemaHint: "{\"chats\":[{\"type\":\"private或group\",\"name\":\"会话名\",\"last\":\"最后一条\",\"time\":\"14:20\",\"messages\":[{\"from\":\"说话人\",\"text\":\"内容\"}]}],\"contacts\":[{\"name\":\"本名\",\"remark\":\"TA的备注\",\"intro\":\"关系与简介\"}],\"moments\":[{\"author\":\"联系人\",\"time\":\"2小时前\",\"content\":\"朋友圈正文\",\"likes\":[\"姓名\"],\"comments\":[{\"from\":\"姓名\",\"text\":\"评论\"}]}],\"me\":{\"signature\":\"朋友圈签名\",\"accounts\":[{\"title\":\"文章标题\",\"source\":\"公众号\",\"time\":\"昨晚\",\"summary\":\"文章讲了什么\",\"thought\":\"TA的感想\"}]}}",
      maxTokens: 12000
    },
    notes: {
      instruction: "推演「" + char.name + "」备忘录里的几条笔记（3-5 条），每条有标题、时间，点开能看正文细节。贴合身份与当下心境。",
      schemaHint: "{\"items\":[{\"title\":\"标题\",\"time\":\"昨天 21:03\",\"detail\":\"正文\"}]}"
    },
    calls: {
      instruction: "推演「" + char.name + "」最近的通话记录（4-7 条）。" + relHint + "给出通话人、来电(in)还是拨出(out)、时间、是否接通、通话时长（未接为空）。时长要合理。",
      schemaHint: "{\"items\":[{\"name\":\"通话人\",\"dir\":\"in或out\",\"time\":\"今天 09:12\",\"connected\":true,\"duration\":\"04:32\"}]}"
    },
    browser: {
      instruction: "推演「" + char.name + "」浏览器最近的浏览记录（3-5 条），有网址和标题，点开看具体内容摘要。反映兴趣与心境。",
      schemaHint: "{\"items\":[{\"title\":\"网页标题\",\"url\":\"www...\",\"time\":\"13:40\",\"content\":\"内容摘要\"}]}"
    },
    shopping: {
      instruction: "推演「" + char.name + "」最近买过的东西（3-6 件），有名称和价格，点开看 Ta 为什么想买的想法。",
      schemaHint: "{\"items\":[{\"name\":\"商品\",\"price\":\"¥128\",\"time\":\"3天前\",\"thought\":\"想法\"}]}"
    },
    album: {
      instruction: "推演「" + char.name + "」相册里的几张照片（4-6 张）。照片本身看不到，只给一句话标题和时间，点开看这张照片内容的文字描述。",
      schemaHint: "{\"items\":[{\"caption\":\"一句话\",\"time\":\"周日 下午\",\"desc\":\"照片内容的文字描述\"}]}"
    },
    forum: {
      instruction: "推演「" + char.name + "」最近在论坛发的帖子标题（3-5 条）和时间，受最近对话与心情影响。只要标题，不需要正文。",
      schemaHint: "{\"items\":[{\"title\":\"帖子标题\",\"time\":\"2小时前\"}]}"
    },
    music: {
      instruction: "根据「" + char.name + "」的性格取一个歌单名，列出歌单里的歌（5-8 首）。必须是真实存在的歌，给出真实歌名和歌手，不要编造。",
      schemaHint: "{\"playlist\":\"歌单名\",\"desc\":\"一句话描述\",\"songs\":[{\"name\":\"歌名\",\"artist\":\"歌手\"}]}"
    },
    settings: {
      instruction: "推演「" + char.name + "」的屏幕使用时间，像 iOS：日均总时长，以及各 App 单独的使用时长（5-7 个，从多到少）。贴合性格。",
      schemaHint: "{\"screenTime\":\"6小时12分\",\"apps\":[{\"name\":\"微信\",\"time\":\"2小时3分\"}]}"
    },
    recordings: {
      instruction: "推演「" + char.name + "」录音 App 里的几条录音（3-5 条），有名字和时间，点开看录音转文字内容以及 Ta 的内心想法。",
      schemaHint: "{\"items\":[{\"name\":\"录音名\",\"time\":\"昨天 23:40\",\"transcript\":\"转文字内容\",\"thought\":\"内心想法\"}]}"
    },
    video_day: {
      instruction: "推演「" + char.name + "」白天正常刷的视频（3-5 条，仿 B站/抖音，根据性格和最近对话）。每条含：title(标题)、up(up主)、tag(分区标签)、duration(时长，如 08:24 或 12:05，符合该类视频合理长度)。",
      schemaHint: "{\"items\":[{\"title\":\"标题\",\"up\":\"up主\",\"tag\":\"分区\",\"duration\":\"08:24\"}]}"
    },
    video_night: {
      instruction: "推演「" + char.name + "」深夜私密看的小电影（3-5 条），大胆贴合人物欲望。每条含：title(标题)、duration(时长，如 00:12:34 或 01:45:20)、tags(若干标签的字符串数组)、thought(点开时显示 Ta 的想法)。时长要符合小电影的合理长度，标签 2-4 个。",
      schemaHint: "{\"items\":[{\"title\":\"标题\",\"duration\":\"00:18:42\",\"tags\":[\"tag1\",\"tag2\"],\"thought\":\"想法\"}]}"
    },
    wallet: {
      instruction: "推演「" + char.name + "」的财务档案。**最重要：收入来源与全部金额必须严格依据 TA 的人设、职业、身份和社会阶层来定，money 要贴合 TA 真实的谋生方式。** 收入来源 incomes（1-3 项，name+category+amount 数字）——category 从 TA 实际的谋生方式来：工资/自由职业/接单/做生意/兼职/学生生活费/退休金/稿费/打赏 等；**只有当人设明确是富家子弟、继承人、家境优渥时，才可以出现「家族供养/信托」这类收入，否则绝对不要默认套用家族收入。** 普通人就是普通收入、金额可以不高甚至拮据。monthlyIncome 月收入合计；fixedMonthly 每月固定支出；baseBalance 当前存款余额；investAssets 理财持有资产（普通人可能很少或为 0）；notes 各部分批注（income/savings/invest/spending，每条一句符合人设的旁白，透露财力与消费态度）；dailyPool 15-25 条日常消费模板（每条 items 一句话描述当天买了啥，amount 数字，反映其真实生活水平）；可选 gifts 送礼转账。所有金额纯数字不带符号，务必与身份匹配、不要人人都很有钱。",
      schemaHint: "{\"incomes\":[{\"name\":\"公司月薪\",\"category\":\"工资\",\"amount\":11000}],\"monthlyIncome\":11000,\"fixedMonthly\":6800,\"baseBalance\":38400,\"investAssets\":15000,\"notes\":{\"income\":\"...\",\"savings\":\"...\",\"invest\":\"...\",\"spending\":\"...\"},\"dailyPool\":[{\"items\":\"地铁+便利店午饭\",\"amount\":42}],\"gifts\":[{\"date\":\"6月20日\",\"name\":\"给朋友的生日礼物\",\"amount\":200}]}",
      maxTokens: 3200
    }
  };
  return S[key] || {
    instruction: "推演内容",
    schemaHint: "{}"
  };
}
