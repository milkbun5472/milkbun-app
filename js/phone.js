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
}, {
  key: "reading",
  zh: "阅读"
}, {
  key: "liked",
  zh: "赞过"
}, {
  key: "orders",
  zh: "订单"
}, {
  key: "health",
  zh: "健康"
}, {
  key: "clipboard",
  zh: "剪贴板"
}, {
  key: "calendar",
  zh: "日历"
}];
const PHONE_LABEL = PHONE_APPS.reduce((o, a) => (o[a.key] = a.zh, o), {});
// 接真数据的 app：不调模型、不存进 phones，直接读 App 里那份真的。
// 论坛读 x_forumPosts（他真发过的帖，连小号和匿名一起），
// 音乐读「一起听」里归到他名下的那张歌单（点开就能放）。
// 以前这两个各自另生成一份，等于同一个人有两套互不相干的论坛痕迹和歌单，
// 而且手机里那份点不动、也不会因为他真去发帖而变。
const PHONE_LIVE_KEYS = ["forum", "music"];
// 自己画满整屏（连顶栏和内页导航一起画）的 app：外层不套通用 Head，也不加 padding，
// 否则会叠出两层标题栏。
const FULL_BLEED_KEYS = ["wechat", "album", "reading"];
// 桌面只负责摆放入口。下面这份是兜底布局；真实桌面会按角色稳定选择不同布局。
const PHONE_DOCK_KEYS = ["calls", "wechat", "browser", "music"];
const PHONE_DESKTOP_PAGES = [
  ["notes", "album", "liked", "forum", "shopping", "orders", "calendar"],
  ["reading", "recordings", "video", "health", "clipboard", "settings"]
];
const PHONE_DESKTOP_LAYOUTS = [{
  id: "social", label: "SOCIAL",
  dock: ["calls", "wechat", "browser", "music"],
  pages: [["notes", "album", "liked", "forum", "shopping", "orders", "calendar"], ["reading", "recordings", "video", "health", "clipboard", "settings"]],
  widgets: [[{ key: "wechat", span: 2, size: "hero" }, { key: "liked" }, { key: "refresh" }], [{ key: "album" }, { key: "health" }]]
}, {
  id: "archive", label: "ARCHIVE",
  dock: ["calls", "wechat", "notes", "browser"],
  pages: [["reading", "clipboard", "calendar", "album", "music", "settings", "recordings"], ["shopping", "orders", "forum", "liked", "video", "health"]],
  widgets: [[{ key: "notes", span: 2, size: "hero" }, { key: "calendar" }, { key: "refresh" }], [{ key: "reading", span: 2, size: "wide" }, { key: "music", span: 2, size: "wide" }]]
}, {
  id: "media", label: "MEDIA",
  dock: ["calls", "wechat", "music", "album"],
  pages: [["video", "liked", "forum", "browser", "notes", "reading", "shopping"], ["recordings", "orders", "health", "clipboard", "calendar", "settings"]],
  widgets: [[{ key: "music", span: 2, size: "hero" }, { key: "album" }, { key: "refresh" }], [{ key: "video", span: 2, size: "wide" }, { key: "liked", span: 2, size: "wide" }]]
}, {
  id: "wander", label: "WANDER",
  dock: ["calls", "wechat", "browser", "album"],
  pages: [["notes", "reading", "calendar", "health", "music", "shopping", "forum"], ["orders", "liked", "recordings", "video", "clipboard", "settings"]],
  widgets: [[{ key: "browser", span: 2, size: "hero" }, { key: "reading" }, { key: "refresh" }], [{ key: "orders" }, { key: "clipboard" }]]
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
    })],
    reading: [P("M12 6.6C10.5 5.1 8 4.3 5 4.3V19c3 0 5.5.8 7 2.3 1.5-1.5 4-2.3 7-2.3V4.3c-3 0-5.5.8-7 2.3z"), P("M12 6.6V21.3")],
    liked: [P("M20.8 6.6a5 5 0 00-7-.4L12 7.8l-1.8-1.6a5 5 0 10-6.8 7.3l8.6 8.1 8.6-8.1a5 5 0 00.2-6.9z")],
    orders: [P("M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22z"), P("M9.5 7.5h5M9.5 11.5h5M9.5 15.5h3")],
    health: [P("M2.5 12.5H6l2.2-6.4 3.3 12.4 2.6-8.2 1.6 2.2h5.8")],
    clipboard: [R(6, 3.5, 12, 17.5, 2.2), R(9, 1.6, 6, 4, 1.2), P("M9.5 11.5h5M9.5 15.5h3.5")],
    calendar: [R(3, 5, 18, 16, 2.4), P("M3 10h18M8 2.6v4.4M16 2.6v4.4")]
  };
  return h(Svg, {
    size,
    color,
    sw: 1.5
  }, ...(kids[k] || []));
}

// 点开某条看细节的通用 sheet 内容（在事件里构造，需显式传 t）
const DetailSheet = (title, body, t, foot) => h("div", null, h(Eyebrow, {
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
}, body || "（无内容）"), foot || null);
const RecSheet = (it, t, foot) => h("div", null, h(Eyebrow, {
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
}, it.thought)), foot || null);
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

function WechatNavIcon({ kind, active }) {
  const color = active ? "#07c160" : "#777";
  const common = { fill: "none", stroke: color, strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = kind === "chats" ? [h("path", { ...common, d: "M4 5.5h16v11H9l-4.5 3 .9-3H4z" }), h("circle", { cx: 8, cy: 11, r: .7, fill: color }), h("circle", { cx: 12, cy: 11, r: .7, fill: color }), h("circle", { cx: 16, cy: 11, r: .7, fill: color })]
    : kind === "contacts" ? [h("circle", { ...common, cx: 12, cy: 7.2, r: 3.2 }), h("path", { ...common, d: "M5 20c.5-4.4 3-6.7 7-6.7s6.5 2.3 7 6.7" })]
    : kind === "moments" ? [h("circle", { ...common, cx: 12, cy: 12, r: 8 }), h("circle", { ...common, cx: 12, cy: 12, r: 3.2 }), h("path", { ...common, d: "M12 4v4M12 16v4M4 12h4M16 12h4" })]
    : [h("circle", { ...common, cx: 12, cy: 8, r: 3.4 }), h("path", { ...common, d: "M5.5 20c.7-4.3 3-6.4 6.5-6.4s5.8 2.1 6.5 6.4" })];
  return h("svg", { width: 24, height: 24, viewBox: "0 0 24 24" }, ...paths);
}

function WeChatViewFull({ d, char, t, profile, onBack, onRefresh, refreshing }) {
  const [tab, setTab] = useState("chats");
  const [thread, setThread] = useState(null);
  const [publicPage, setPublicPage] = useState(false);
  const [article, setArticle] = useState(null);
  const arr = a => Array.isArray(a) ? a : [];
  const actual = arr(d.actualChats), generated = arr(d.chats);
  const chats = [...actual, ...generated];
  const meName = profile && profile.name || "Lisa";
  const selfNames = new Set([char.name, d.me && d.me.wechatName, "我", "本人"].filter(Boolean));
  const person = (name, avatarImage) => ({ name: name || "?", avatarImage, color: strColor(name) });
  const avatarForMessage = (m, c) => m.avatarImage || (selfNames.has(m.from) ? char.avatarImage : m.from === meName ? profile && profile.avatarImage : c.avatarImage);
  const innerHead = (title, sub, back) => h("div", { className: "shrink-0 flex items-center gap-3 px-4 pb-3", style: { paddingTop: safeTop(16), borderBottom: `1px solid ${t.line}`, background: "rgba(248,247,243,.96)" } }, h("button", { onClick: back, className: "active:opacity-50", style: { fontSize: 26, lineHeight: 1, color: t.ink } }, "‹"), h("div", { className: "flex-1 min-w-0 text-center", style: { paddingRight: 24 } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } }, title), sub && h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog } }, sub)));
  if (thread && thread.type !== "contact") return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#ededed" } }, innerHead(thread.name, thread.type === "group" ? "群聊" : null, () => setThread(null)), h("div", { className: "flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4" }, arr(thread.messages).map((m, i) => {
    const self = selfNames.has(m.from);
    return h("div", { key: i, className: "flex items-start gap-2 " + (self ? "flex-row-reverse" : "") }, h(Avatar, { character: person(m.from, avatarForMessage(m, thread)), size: 37, radius: 7 }), h("div", { style: { maxWidth: "72%" } }, thread.type === "group" && !self && h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#888", margin: "0 4px 3px" } }, m.from), h("div", { style: { position: "relative", padding: "9px 11px", borderRadius: 5, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.55, color: "#171717", background: self ? "#95ec69" : "#fff", boxShadow: "0 1px 1px rgba(0,0,0,.05)" } }, m.text)));
  })));
  const accounts = arr(d.me && d.me.accounts);
  if (publicPage) return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#f5f5f5" } }, innerHead(article ? "文章" : "公众号", null, () => article ? setArticle(null) : setPublicPage(false)), h("div", { className: "flex-1 min-h-0 overflow-y-auto" }, article ? h("article", { style: { background: "#fff", minHeight: "100%", padding: "24px 22px 48px" } }, h("h1", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.35, color: "#191919" } }, article.title), h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#8a8a8a", marginTop: 10 } }, [article.source, article.time].filter(Boolean).join(" · ")), h("div", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 2, color: "#333", marginTop: 25, whiteSpace: "pre-wrap" } }, article.summary), h("div", { style: { marginTop: 32, padding: 18, borderRadius: 8, background: "#f7f7f7" } }, h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#8a8a8a", marginBottom: 8 } }, char.name + " 读到这里时"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.8, color: "#444" } }, article.thought))) : h("div", null, h("div", { style: { height: 118, background: "linear-gradient(135deg,#234635,#79a185)", padding: "34px 22px", color: "#fff" } }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25 } }, "订阅号消息"), h("div", { style: { fontFamily: F_BODY, fontSize: 11, opacity: .8, marginTop: 5 } }, char.name + " 最近打开过的文章")), h("div", { style: { padding: "10px 14px" } }, accounts.map((a, i) => h("button", { key: i, onClick: () => setArticle(a), className: "w-full text-left active:opacity-60", style: { padding: "17px 0", borderBottom: "1px solid #ddd" } }, h("div", { className: "flex gap-13" }, h("div", { className: "flex-1" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.45, color: "#222" } }, a.title), h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginTop: 8 } }, [a.source, a.time].filter(Boolean).join(" · "))), h("div", { style: { width: 72, height: 58, borderRadius: 5, background: `linear-gradient(135deg,${strColor(a.source)},#ddd)` } }))))))));
  const chatRow = (c, i) => h("button", { key: c.id || i, onClick: () => setThread(c), className: "w-full text-left flex items-center gap-3 active:opacity-60", style: { minHeight: 67, borderBottom: "1px solid #e5e5e5", background: "#fff", padding: "8px 14px" } }, h(Avatar, { character: person(c.name, c.avatarImage), size: 47, radius: c.type === "group" ? 8 : 7 }), h("div", { className: "flex-1 min-w-0" }, h("div", { className: "flex justify-between gap-2" }, h("span", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#191919" } }, c.name), h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#aaa" } }, c.time || "")), h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "#999", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.last || "")));
  const userContact = d.userContact || { name: meName, remark: meName, intro: "TA 把你放在最重要的位置，但这次刷新还没写下具体的话。" };
  const contacts = [{ ...userContact, name: meName, avatarImage: profile && profile.avatarImage }, ...arr(d.contacts)];
  const contactRow = (c, i) => h("button", { key: i, onClick: () => setThread({ ...c, type: "contact" }), className: "w-full flex items-center gap-3 text-left active:opacity-60", style: { minHeight: 64, padding: "8px 14px", background: "#fff", borderBottom: "1px solid #e7e7e7" } }, h(Avatar, { character: person(c.name, c.avatarImage), size: 43, radius: 7 }), h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#1c1c1c" } }, c.remark || c.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginTop: 3 } }, c.intro)));
  const searchBox = h("div", { className: "flex-1 flex items-center justify-center gap-2", style: { height: 39, borderRadius: 8, background: "#fff", border: "1px solid #e5e5e5", color: "#9a9a9a", boxShadow: "0 1px 1px rgba(0,0,0,.025)" } },
    h("svg", { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" }, h("circle", { cx: 10.5, cy: 10.5, r: 6.5 }), h("path", { d: "m16 16 4 4" })),
    h("span", { style: { fontFamily: F_BODY, fontSize: 13.5 } }, "搜索"));
  const searchHead = h("div", { className: "shrink-0 flex items-center gap-2 px-3 pb-2", style: { paddingTop: safeTop(9), background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("button", { onClick: onBack, className: "shrink-0 active:opacity-50", style: { width: 34, height: 42, fontSize: 29, lineHeight: 1, color: "#222" }, "aria-label": "返回" }, "‹"),
    searchBox,
    h("button", { onClick: onRefresh, disabled: refreshing, className: "shrink-0 active:opacity-50 disabled:opacity-35", style: { width: 34, height: 42, display: "flex", alignItems: "center", justifyContent: "center" }, "aria-label": "刷新微信" }, h(IRefresh, { size: 18, color: "#333" })));
  const contactsHead = h("div", { className: "shrink-0", style: { paddingTop: safeTop(10), background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("div", { className: "flex items-center px-3", style: { height: 43 } }, h("button", { onClick: onBack, className: "active:opacity-50", style: { width: 34, fontSize: 29, lineHeight: 1 }, "aria-label": "返回" }, "‹"), h("div", { className: "flex-1 text-center", style: { paddingRight: 34, fontFamily: F_DISPLAY, fontSize: 18, fontWeight: 700 } }, "通讯录")),
    h("div", { className: "px-3 pb-3" }, searchBox));
  const plainHead = h("div", { className: "shrink-0 flex items-center px-3 pb-2", style: { paddingTop: safeTop(12), minHeight: 54, background: "#f5f5f5", borderBottom: "1px solid #e2e2e2" } },
    h("button", { onClick: onBack, className: "active:opacity-50", style: { width: 34, fontSize: 29, lineHeight: 1 }, "aria-label": "返回" }, "‹"),
    h("div", { className: "flex-1 text-center", style: { paddingRight: 34, fontFamily: F_DISPLAY, fontSize: 18, fontWeight: 700 } }, tab === "moments" ? "朋友圈" : "我"));
  const topBar = tab === "chats" ? searchHead : tab === "contacts" ? contactsHead : plainHead;
  let body;
  if (thread && thread.type === "contact") body = null;
  if (tab === "chats") body = h("div", null, chats.map(chatRow));
  else if (tab === "contacts") body = h("div", null, h("div", { style: { padding: "7px 14px", fontFamily: F_BODY, fontSize: 11, color: "#888", background: "#f4f4f4" } }, "联系人 · " + contacts.length), contacts.map(contactRow));
  else if (tab === "moments") {
    const momentCard = (m, i) => h("div", { key: i, className: "flex gap-3", style: { padding: "15px 14px", borderBottom: "1px solid #eee" } },
      h(Avatar, { character: person(m.author), size: 40, radius: 6 }),
      h("div", { className: "flex-1 min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: "#526786" } }, m.author),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.7, color: "#222", marginTop: 5 } }, m.content),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#999", marginTop: 7 } }, m.time),
        h("div", { style: { background: "#f3f3f3", borderRadius: 4, marginTop: 8, padding: "7px 9px" } },
          arr(m.likes).length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#526786", paddingBottom: arr(m.comments).length ? 5 : 0, borderBottom: arr(m.comments).length ? "1px solid #ddd" : "none" } }, "♡ " + arr(m.likes).join("、")) : null,
          arr(m.comments).map((x, j) => h("div", { key: j, style: { fontFamily: F_BODY, fontSize: 11.8, lineHeight: 1.55, color: "#333", marginTop: 4 } }, h("b", { style: { color: "#526786" } }, x.from + "："), x.text)))));
    body = h("div", { style: { background: "#fff" } },
      h("div", { style: { height: 140, background: "linear-gradient(135deg,#4d6655,#c6c2ad)", position: "relative", marginBottom: 34 } }, h("div", { style: { position: "absolute", right: 18, bottom: -28, display: "flex", alignItems: "center", gap: 10 } }, h("span", { style: { color: "#fff", fontFamily: F_DISPLAY, fontSize: 16, textShadow: "0 1px 3px #000" } }, d.me && d.me.wechatName || char.name), h(Avatar, { character: char, size: 60, radius: 7 }))),
      arr(d.moments).map(momentCard));
  }
  else body = h("div", { style: { background: "#f5f5f5", minHeight: "100%", paddingTop: 14 } }, h("div", { className: "flex items-center gap-4", style: { background: "#fff", padding: "22px 18px" } }, h(Avatar, { character: char, size: 67, radius: 8 }), h("div", { className: "flex-1 min-w-0" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 21, color: "#1b1b1b" } }, d.me && d.me.wechatName || char.name), h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#888", marginTop: 6 } }, "微信号：" + (d.me && d.me.wechatId || "wx_" + String(char.id || "user").slice(0, 8))), h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#777", marginTop: 5 } }, d.me && d.me.signature || "还没有写个性签名"))), h("button", { onClick: () => setPublicPage(true), className: "w-full flex items-center gap-3 text-left active:opacity-60", style: { marginTop: 10, background: "#fff", padding: "16px 18px" } }, h("div", { style: { width: 34, height: 34, borderRadius: 7, background: "#07c160", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 18 } }, "文"), h("div", { className: "flex-1" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: "#222" } }, "公众号"), h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginTop: 3 } }, "最近读过 " + accounts.length + " 篇文章")), h("span", { style: { color: "#aaa", fontSize: 22 } }, "›")));
  if (thread && thread.type === "contact") return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#f5f5f5" } }, innerHead(thread.remark || thread.name, null, () => setThread(null)), h("div", { className: "flex-1 overflow-y-auto", style: { padding: "28px 20px" } }, h("div", { className: "flex items-center gap-4" }, h(Avatar, { character: person(thread.name, thread.avatarImage), size: 68, radius: 9 }), h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: "#222" } }, thread.remark || thread.name), thread.remark && thread.remark !== thread.name ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "#999", marginTop: 5 } }, "昵称：" + thread.name) : null)), h("div", { style: { background: "#fff", borderRadius: 8, padding: "18px", marginTop: 26 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#999", marginBottom: 9 } }, char.name + " 对这个人的备注与真实感想"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: "#333", whiteSpace: "pre-wrap" } }, thread.intro))));
  const navs = [["chats", "聊天"], ["contacts", "联系人"], ["moments", "朋友圈"], ["me", "我"]];
  return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#f5f5f5" } }, topBar, h("div", { className: "flex-1 min-h-0 overflow-y-auto" }, body), h("div", { className: "shrink-0 grid grid-cols-4", style: { minHeight: 61, paddingBottom: "env(safe-area-inset-bottom)", background: "rgba(250,250,250,.98)", borderTop: "1px solid #ddd" } }, navs.map(([k, label]) => h("button", { key: k, onClick: () => setTab(k), className: "flex flex-col items-center justify-center gap-0.5 active:opacity-60", style: { color: tab === k ? "#07c160" : "#777" } }, h(WechatNavIcon, { kind: k, active: tab === k }), h("span", { style: { fontFamily: F_BODY, fontSize: 10.5 } }, label)))));
}

function AlbumNavIcon({ kind, active }) {
  const stroke = active ? "#0a84ff" : "#8e8e93";
  const p = { fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === "library") return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true },
    h("rect", { ...p, x: 3.5, y: 3.5, width: 6.5, height: 6.5, rx: 1.2 }), h("rect", { ...p, x: 14, y: 3.5, width: 6.5, height: 6.5, rx: 1.2 }),
    h("rect", { ...p, x: 3.5, y: 14, width: 6.5, height: 6.5, rx: 1.2 }), h("rect", { ...p, x: 14, y: 14, width: 6.5, height: 6.5, rx: 1.2 }));
  if (kind === "collections") return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true },
    h("rect", { ...p, x: 4, y: 6, width: 13, height: 15, rx: 2.3 }), h("path", { ...p, d: "M8 3h10a2 2 0 0 1 2 2v12" }));
  return h("svg", { width: 23, height: 23, viewBox: "0 0 24 24", "aria-hidden": true }, h("path", { ...p, d: "M20.8 4.7a5.4 5.4 0 0 0-7.7 0L12 5.8l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.6a5.4 5.4 0 0 0 0-7.7Z" }));
}

// 相册：iPhone 风图库 / 精选集 / 收藏夹。
// 收藏仍独立存在 x_phoneKeep，刷新推演只换本轮相册，不覆盖 Lisa 留下的收藏。
function AlbumView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [keep, setKeep] = useState(() => loadJSON("x_phoneKeep", {}));
  const [tab, setTab] = useState("collections");
  const [opened, setOpened] = useState(null);
  const [photo, setPhoto] = useState(null);
  const scrollRef = useRef(null);
  const returnScroll = useRef({ top: 0, pending: false });
  const openPhoto = p => {
    returnScroll.current = { top: scrollRef.current ? scrollRef.current.scrollTop : 0, pending: false };
    setPhoto(p);
  };
  const closePhoto = () => {
    returnScroll.current.pending = true;
    setPhoto(null);
  };
  useEffect(() => {
    if (photo || !returnScroll.current.pending) return;
    const top = returnScroll.current.top;
    returnScroll.current.pending = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = top;
    }));
  }, [photo, opened, tab]);
  // 模型偶尔会把 items 返回成字符串或对象；a || [] 会原样放行，下一步 .map 就是白屏
  const arr = a => Array.isArray(a) ? a : [];
  const albums = [
    { key: "memory", label: "回忆" },
    { key: "favorite", label: "个人收藏" },
    { key: "saved", label: "最近保存" },
    { key: "private", label: "私密" },
    { key: "deleted", label: "最近删除" }
  ];
  const canon = v => ({ "回忆": "memory", "个人收藏": "favorite", "最近保存": "saved", "私密": "private", "最近删除": "deleted" }[v] || (["memory", "favorite", "saved", "private", "deleted"].includes(v) ? v : ""));
  const dateMs = p => {
    const n = Date.parse(String(p && (p.date || p.time) || ""));
    return Number.isFinite(n) ? n : 0;
  };
  // 模型偶尔分配失衡：25 张时机械挪动超额项，保证五册各至少 4 张；
  // 老相册不伪造照片，刷新后才升级到新版 25 张。
  const normalize = source => {
    const items = arr(source).map((p, i) => ({ ...p, _albumId: p.id || (String(p.caption || "照片") + "|" + String(p.date || p.time || "") + "|" + i), category: canon(p.category) }));
    const buckets = Object.fromEntries(albums.map(a => [a.key, []]));
    const loose = [];
    items.forEach(p => (p.category ? buckets[p.category] : loose).push(p));
    if (items.length >= 20) {
      for (const a of albums) while (buckets[a.key].length < 4) {
        let donor = albums.map(x => buckets[x.key]).sort((x, y) => y.length - x.length)[0];
        const moved = loose.shift() || (donor && donor.length > 4 ? donor.pop() : null);
        if (!moved) break;
        moved.category = a.key; buckets[a.key].push(moved);
      }
    }
    let li = 0;
    loose.forEach(p => { const k = albums[li++ % albums.length].key; p.category = k; buckets[k].push(p); });
    return albums.flatMap(a => buckets[a.key]).sort((a, b) => dateMs(b) - dateMs(a));
  };
  const items = normalize(d.items);
  // id 优先；没有 id 的旧数据用内容指纹。不要把本轮数组下标写进收藏指纹，
  // 否则同一张照片在下次刷新排序变化后会被误当成另一张。
  const sig = p => p.id || (p.caption || "") + "|" + (p.date || p.time || "") + "|" + (p.desc || "");
  const saved = arr(keep[char.id]);
  const isSaved = p => saved.some(s => sig(s) === sig(p));
  const toggle = p => setKeep(prev => {
    const list = arr(prev[char.id]);
    const exists = list.some(s => sig(s) === sig(p));
    const nl = exists ? list.filter(s => sig(s) !== sig(p)) : [{ ...p, _at: Date.now() }, ...list];
    const n = { ...prev, [char.id]: nl };
    saveJSON("x_phoneKeep", n);
    return n;
  });
  // 零 API 的程序化缩略图：按照片内容稳定生成不同色光、景深与构图；不是灰色占位，
  // 也不会为 25 张照片额外烧生图额度。若将来数据带 imageRef/imageUrl，会优先显示真图。
  const art = (it, radius) => {
    const seed = phoneStableHash((it.caption || "") + (it.desc || ""));
    const hue = seed % 360, hue2 = (hue + 45 + seed % 70) % 360;
    // imageRef 可能是本机保险箱键，不是浏览器可直接加载的网址；这里只接真正 URL。
    const img = it.imageUrl || it.imgUrl;
    return h("div", { style: { position: "absolute", inset: 0, overflow: "hidden", borderRadius: radius || 0,
      background: img ? "#ddd" : `linear-gradient(${110 + seed % 80}deg,hsl(${hue} 42% 75%),hsl(${hue2} 48% 37%))` } },
      img ? h("img", { src: img, alt: it.caption || "照片", style: { width: "100%", height: "100%", objectFit: "cover" } }) : h(React.Fragment, null,
        h("span", { style: { position: "absolute", width: "72%", height: "72%", borderRadius: "50%", left: `${-12 + seed % 35}%`, top: `${-8 + (seed >> 3) % 35}%`, background: "rgba(255,255,255,.28)", filter: "blur(10px)" } }),
        h("span", { style: { position: "absolute", width: "46%", height: "70%", borderRadius: "46% 54% 30% 70%", right: `${-8 + (seed >> 5) % 20}%`, bottom: "-12%", background: "rgba(18,18,24,.28)", transform: `rotate(${seed % 28 - 14}deg)` } }),
        h("span", { style: { position: "absolute", left: 9, right: 9, bottom: 8, color: "rgba(255,255,255,.92)", fontFamily: F_BODY, fontSize: 9.5, lineHeight: 1.25, textShadow: "0 1px 4px rgba(0,0,0,.45)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } }, it.caption || "照片")));
  };
  const tile = (it, i, rounded) => h("button", { key: sig(it) + ":" + i, onClick: () => openPhoto(it), className: "active:opacity-70", style: { position: "relative", aspectRatio: "1 / 1", overflow: "hidden", borderRadius: rounded ? 14 : 0, minWidth: 0 } }, art(it, rounded ? 14 : 0),
    isSaved(it) ? h("span", { style: { position: "absolute", top: 6, right: 6, width: 23, height: 23, borderRadius: 99, background: "rgba(255,255,255,.9)", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IHeart, { size: 13, color: "#ff375f", filled: true })) : null,
    it.category === "private" ? h("span", { style: { position: "absolute", left: 6, bottom: 6, borderRadius: 7, padding: "2px 5px", color: "#fff", background: "rgba(0,0,0,.5)", fontSize: 9 } }, "锁") : it.category === "deleted" ? h("span", { style: { position: "absolute", left: 6, bottom: 6, borderRadius: 7, padding: "2px 5px", color: "#fff", background: "rgba(0,0,0,.5)", fontSize: 9 } }, "已删除") : null);
  const grid = (list, rounded, cols) => h("div", { className: `grid ${cols === 2 ? "grid-cols-2 gap-2" : "grid-cols-3 gap-0.5"}` }, list.map((x, i) => tile(x, i, rounded)));
  const chrome = (title, sub, back) => h("div", { className: "shrink-0 flex items-center", style: { padding: `${safeTop(10)} 13px 8px`, minHeight: 56, background: "rgba(255,255,255,.97)", borderBottom: "1px solid #e5e5ea" } },
    h("button", { onClick: back || onBack, "aria-label": "返回", className: "active:opacity-50", style: { width: 36, fontSize: 29, lineHeight: 1, color: "#111" } }, "‹"),
    h("div", { className: "flex-1 min-w-0 text-center" }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, fontWeight: 700, lineHeight: 1.15, color: "#111" } }, title), sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "#8e8e93", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sub) : null),
    h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "刷新相册", className: "active:opacity-50 disabled:opacity-35", style: { width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" } }, h(IRefresh, { size: 18, color: "#333" })));
  const nav = h("div", { className: "shrink-0 grid grid-cols-3", style: { padding: "5px 20px calc(env(safe-area-inset-bottom) * 0.4 + 4px)", minHeight: 54, background: "rgba(250,250,252,.97)", borderTop: "1px solid #e5e5ea" } }, [["library", "图库"], ["collections", "精选集"], ["saved", "收藏夹"]].map(([k, label]) => h("button", { key: k, onClick: () => { setTab(k); setOpened(null); }, className: "flex flex-col items-center justify-center active:opacity-60", style: { color: tab === k ? "#0a84ff" : "#8e8e93", fontFamily: F_BODY, fontSize: 10.5 } }, h(AlbumNavIcon, { kind: k, active: tab === k }), h("span", { style: { marginTop: 2 } }, label))));
  if (photo) return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#fff" } }, chrome("照片", photo.date || photo.time || "日期未记", closePhoto), h("div", { className: "flex-1 overflow-y-auto", style: { padding: "4px 20px 30px" } },
    h("div", { style: { position: "relative", width: "100%", aspectRatio: "1 / 1.12", borderRadius: 20, overflow: "hidden", boxShadow: "0 14px 32px rgba(0,0,0,.12)" } }, art(photo, 20)),
    h("div", { className: "flex items-start justify-between gap-4", style: { padding: "22px 3px 14px" } }, h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 23, color: "#111" } }, photo.caption || "照片"), h("div", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.75, color: "#666", marginTop: 8, whiteSpace: "pre-wrap" } }, photo.desc || "没有留下介绍。")), h("button", { onClick: () => toggle(photo), className: "active:scale-90", style: { flex: "0 0 auto", width: 42, height: 42, borderRadius: 99, background: "#f2f2f7", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IHeart, { size: 20, color: isSaved(photo) ? "#ff375f" : "#777", filled: isSaved(photo) }))),
    h("div", { style: { marginTop: 8, borderRadius: 17, background: "#f2f2f7", padding: "17px 18px" } }, h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: ".16em", color: "#8e8e93", marginBottom: 9 } }, char.name + " 对这张照片的想法"), h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: "#222", whiteSpace: "pre-wrap" } }, photo.thought || "TA 没有为这张照片留下想法。")),
    onPeek ? (function () {
      // 私密和最近删除是他藏起来的；回忆/收藏/最近保存只是他没主动提起
      const hid = photo.category === "private" || photo.category === "deleted";
      return h("button", {
        onClick: () => onPeek({ tier: hid ? "hidden" : "quiet", label: photo.category === "deleted" ? "相册·最近删除" : photo.category === "private" ? "相册·私密" : "相册", title: photo.caption || "一张照片", text: [photo.desc, photo.thought].filter(Boolean).join("｜") }),
        className: "w-full active:opacity-60",
        style: { marginTop: 10, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid " + (hid ? "rgba(200,80,70,.45)" : "#d9d9de"), color: hid ? "#b6473c" : "#333" }
      }, hid ? "摆到 TA 面前 · 这是他藏起来的" : "转发给 TA · 他会知道你翻了手机");
    })() : null));
  if (opened) {
    const meta = albums.find(a => a.key === opened);
    const list = items.filter(p => p.category === opened);
    return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#fff" } }, chrome(meta ? meta.label : "相簿", list.length + " 张", () => setOpened(null)), h("div", { ref: scrollRef, className: "flex-1 overflow-y-auto", style: { padding: "8px 20px 28px" } }, grid(list, true, 3)), nav);
  }
  const library = h("div", { style: { paddingTop: 14, paddingBottom: 26 } }, (() => {
    const groups = [];
    items.forEach(p => { const raw = String(p.date || p.time || "日期未记"); const m = raw.match(/(\d{4})[-\/.年](\d{1,2})/); const label = m ? (m[1] + "年" + Number(m[2]) + "月") : "日期未记"; let g = groups.find(x => x.label === label); if (!g) { g = { label, list: [] }; groups.push(g); } g.list.push(p); });
    return groups.map((g, i) => h("section", { key: g.label + i, style: { marginBottom: 22 } }, h("div", { className: "flex justify-between", style: { padding: "0 20px 10px", fontFamily: F_DISPLAY, fontSize: 16, color: "#444" } }, h("span", null, g.label), h("span", { style: { color: "#999", fontFamily: F_BODY, fontSize: 12 } }, g.list.length)), grid(g.list, false, 3)));
  })());
  const memoryItems = items.filter(p => p.category === "memory");
  const fixedAlbums = albums.filter(a => a.key !== "memory");
  const memoryCard = p => h("button", { key: sig(p), onClick: () => openPhoto(p), className: "shrink-0 text-left active:opacity-70", style: { width: "72%", scrollSnapAlign: "start" } },
    h("div", { style: { position: "relative", height: 232, borderRadius: 22, overflow: "hidden", background: "#ddd", boxShadow: "0 12px 26px rgba(0,0,0,.10)" } },
      art(p, 22),
      h("div", { style: { position: "absolute", inset: "42% 0 0", background: "linear-gradient(transparent,rgba(0,0,0,.72))" } }),
      h("div", { style: { position: "absolute", left: 16, right: 16, bottom: 15, color: "#fff" } },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, lineHeight: 1.25 } }, p.caption || "一段回忆"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, marginTop: 5, opacity: .84 } }, p.date || p.time || "日期未记"))));
  const albumCard = a => {
    const list = items.filter(p => p.category === a.key);
    const cover = list[0];
    return h("button", { key: a.key, onClick: () => setOpened(a.key), className: "shrink-0 text-left active:opacity-65", style: { width: 145, scrollSnapAlign: "start" } },
      h("div", { style: { position: "relative", width: 145, height: 145, borderRadius: 18, overflow: "hidden", background: "#eee" } }, cover ? art(cover, 18) : null),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: "#111", marginTop: 9 } }, a.label),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "#8e8e93", marginTop: 3 } }, list.length));
  };
  const collections = h("div", { style: { padding: "18px 0 30px" } },
    h("section", null,
      h("div", { style: { padding: "0 20px 12px", fontFamily: F_DISPLAY, fontSize: 23, color: "#111" } }, "回忆"),
      h("div", { className: "flex overflow-x-auto", style: { gap: 12, padding: "0 20px 8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } }, memoryItems.map(memoryCard)),
      memoryItems.length ? null : h("div", { style: { margin: "0 20px", padding: "40px 18px", borderRadius: 20, background: "#f2f2f7", color: "#8e8e93", textAlign: "center", fontFamily: F_BODY, fontSize: 12 } }, "刷新相册后，这里会出现 TA 珍藏的回忆。")),
    h("section", { style: { marginTop: 30 } }, h("div", { style: { padding: "0 20px 12px", fontFamily: F_DISPLAY, fontSize: 23, color: "#111" } }, "相簿"),
      h("div", { className: "flex overflow-x-auto", style: { gap: 13, padding: "0 20px 8px", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } }, fixedAlbums.map(albumCard))));
  const favorites = h("div", { style: { padding: "4px 20px 30px" } }, saved.length ? grid(saved, true, 3) : h("div", { style: { textAlign: "center", padding: "70px 18px", color: "#8e8e93", fontFamily: F_BODY, fontSize: 13, lineHeight: 1.8 } }, "还没有收藏照片。\n点开一张照片，再点爱心就会一直留在这里。"));
  const title = tab === "library" ? "图库" : tab === "saved" ? "收藏夹" : "精选集";
  const sub = tab === "library" && items.length ? ((items[items.length - 1].date || items[items.length - 1].time || "") + " – " + (items[0].date || items[0].time || "")) : tab === "collections" ? "回忆与四本相簿 · 共 " + items.length + " 张" : saved.length + " 张 · 刷新也不会丢";
  return h("div", { className: "h-full min-h-0 flex flex-col", style: { background: "#fff", animation: "fadeUp .3s ease both" } }, chrome(title, sub, onBack), h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto" }, tab === "library" ? library : tab === "saved" ? favorites : collections), nav);
}

// 各 app 详情内容
// ============================================================
// 阅读 —— 五个书架、三十本书（她 2026-08-29 给了参考稿）
// 书架名不是分类标签，是【他自己给这堆书起的名字】：
// 「导师以为我在看的论文」「凌晨两点的关东煮哲学」「怎么对付某个麻烦精」——
// 一看名字就知道是谁的书架。点开一本能看到他读到哪、划了哪句、写了什么批注。
// 「我的」里是阅读档案：最爱的一本、本周读了多久、打算下一本读什么。
// ============================================================
const READ_PALETTES = [
  { card: "#dcead6", tint: "#9dbf92", ink: "#39492f", spine: ["#bcd8b1", "#e6f0e0"], text: "#33422b" },
  { card: "#ece7dd", tint: "#c3b8a3", ink: "#4a4335", spine: ["#e7e0d2", "#f6f2ea"], text: "#4a4335" },
  { card: "#d7e2ea", tint: "#93aec2", ink: "#2f3d48", spine: ["#39424c", "#232a32"], text: "#f2f4f6", dark: true },
  { card: "#efdde4", tint: "#d3aab9", ink: "#4d3a41", spine: ["#f0cfda", "#faeaf0"], text: "#4d3a41" },
  { card: "#eae4cd", tint: "#c4b98d", ink: "#4a4632", spine: ["#e4dcbe", "#f4f0e2"], text: "#4a4632" }
];
function ReadingView({ d, char, t, onBack, onRefresh, refreshing, onPeek }) {
  const [tab, setTab] = useState("shelf");
  const [book, setBook] = useState(null);
  const scrollRef = useRef(null);
  const returnScroll = useRef({ top: 0, pending: false });
  const shelves = (Array.isArray(d && d.shelves) ? d.shelves : []).filter(x => x && typeof x === "object");
  const total = shelves.reduce((n, sh) => n + (Array.isArray(sh.books) ? sh.books.length : 0), 0);
  const archive = (d && typeof d.archive === "object" && d.archive) || {};
  // 详情返回要回到原来的位置（.claude/rules/mobile-ui-layout.md §3）
  const openBook = (b, sh, i) => {
    returnScroll.current = { top: scrollRef.current ? scrollRef.current.scrollTop : 0, pending: false };
    setBook({ ...b, _shelf: sh.name || "", _no: i + 1 });
  };
  const closeBook = () => { returnScroll.current.pending = true; setBook(null); };
  useEffect(() => {
    if (book || !returnScroll.current.pending) return;
    const top = returnScroll.current.top;
    returnScroll.current.pending = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = top; }));
  }, [book, tab]);
  const PAPER = "#efece4";
  const chrome = h("div", {
    className: "shrink-0 flex items-center px-4 pb-2",
    style: { paddingTop: safeTop(10), minHeight: 54, background: PAPER }
  }, h("button", { onClick: onBack, "aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: { width: 40, height: 40, marginLeft: -8 } }, h(IArrow, { size: 19, color: "#3a3730" })),
  h("div", { className: "flex-1 min-w-0 text-center", style: { fontFamily: F_DISPLAY, fontSize: 16, color: "#3a3730" } }, char.remark || char.name),
  h("button", { onClick: onRefresh, disabled: refreshing, "aria-label": "重新推演书架", className: "active:opacity-50 disabled:opacity-35 flex items-center justify-center", style: { width: 40, height: 40 } }, h(IRefresh, { size: 18, color: "#3a3730" })));
  // 左边那一列活页装订孔
  const rings = h("div", {
    "aria-hidden": "true",
    style: { position: "absolute", left: 6, top: 16, bottom: 16, width: 14, display: "flex", flexDirection: "column", justifyContent: "space-around", pointerEvents: "none" }
  }, [0, 1, 2, 3, 4, 5, 6].map(i => h("span", { key: i, style: { width: 11, height: 11, borderRadius: 99, border: "1.5px solid rgba(120,112,96,.28)" } })));
  const spine = (b, sh, i, pal) => h("button", {
    key: i,
    onClick: () => openBook(b, sh, i),
    className: "shrink-0 active:opacity-70 text-left",
    style: {
      width: 108, height: 148, borderRadius: "3px 9px 9px 3px", position: "relative", overflow: "hidden",
      background: `linear-gradient(150deg, ${pal.spine[0]}, ${pal.spine[1]})`,
      boxShadow: "0 7px 16px rgba(60,54,40,.16)", padding: "16px 13px"
    }
  }, h("div", { "aria-hidden": "true", style: { position: "absolute", right: 0, top: 0, bottom: 0, width: 9, background: "linear-gradient(90deg,rgba(0,0,0,.06),#fdfcf8 40%,#f1efe8)" } }),
  h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, lineHeight: 1.35, color: pal.text, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", paddingRight: 6 } }, b.title || "无题"),
  h("div", { style: { position: "absolute", left: 13, bottom: 14, right: 18, fontFamily: F_BODY, fontSize: 10, color: pal.dark ? "rgba(255,255,255,.68)" : "rgba(60,54,40,.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, b.author || ""));
  const shelfCard = (sh, si) => {
    const pal = READ_PALETTES[si % READ_PALETTES.length];
    const books = Array.isArray(sh.books) ? sh.books : [];
    const no = String(si + 1).padStart(2, "0");
    return h("section", { key: si, style: { position: "relative", marginBottom: 26, paddingLeft: 26 } }, rings,
      h("div", { className: "relative" },
        h("div", { style: { background: pal.card, borderRadius: "14px 14px 0 0", padding: "14px 16px 30px", marginRight: 34 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, lineHeight: 1.25, color: pal.ink } },
            h("span", { style: { fontFamily: "'Archivo',sans-serif", fontWeight: 600, marginRight: 9 } }, no), sh.name || "没起名的一架"),
          h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: "rgba(60,54,40,.42)", marginTop: 5 } }, "/ " + (sh.slug || "shelf"))),
        h("div", { style: { position: "absolute", right: 0, top: 30, background: pal.card, borderRadius: "8px 8px 0 0", padding: "6px 10px", fontFamily: "'Archivo',sans-serif", fontSize: 10, letterSpacing: ".12em", color: "rgba(60,54,40,.5)" } }, "NO. " + no),
        h("div", {
          className: "flex gap-3 overflow-x-auto",
          style: { marginTop: -18, padding: "14px 14px 16px", borderRadius: 14, background: pal.tint + "66", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }
        }, books.length ? books.map((b, i) => spine(b, sh, i, pal))
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(60,54,40,.5)", padding: "48px 8px" } }, "这一架还是空的"))));
  };
  const shelfPage = h("div", { ref: scrollRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 16px 24px", background: PAPER } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 30, color: "#3a3730", padding: "6px 0 2px 26px" } }, "书架"),
    h("div", { className: "flex items-center gap-3", style: { padding: "10px 26px 18px" } },
      h("div", { style: { flex: 1, height: 1, background: "rgba(120,112,96,.22)" } }),
      h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(60,54,40,.5)" } }, "共 " + total + " 本书"),
      h("div", { style: { flex: 1, height: 1, background: "rgba(120,112,96,.22)" } })),
    shelves.length ? shelves.map(shelfCard) : h(Empty, { text: "书架还是空的", sub: "点右上角让他把书架摆出来" }));
  const archRow = (label, main, sub) => h("div", { className: "py-4", style: { borderBottom: "1px solid rgba(120,112,96,.16)" } },
    h("div", { className: "flex items-baseline gap-5" },
      h("span", { style: { width: 34, flexShrink: 0, fontFamily: F_BODY, fontSize: 11.5, color: "rgba(60,54,40,.5)" } }, label),
      h("div", { className: "min-w-0" },
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: "#33302a", lineHeight: 1.3 } }, main || "—"),
        sub ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(60,54,40,.5)", marginTop: 3 } }, sub) : null)));
  const fav = (archive.favorite && typeof archive.favorite === "object") ? archive.favorite : {};
  const plan = (archive.plan && typeof archive.plan === "object") ? archive.plan : {};
  const minePage = h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "10px 22px 24px", background: PAPER } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 26, color: "#3a3730", padding: "6px 0 14px" } }, "阅读档案"),
    archRow("最爱", fav.title, fav.author),
    archRow("本周", archive.weekTime, null),
    archRow("计划", plan.title, plan.author),
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "quiet", label: "阅读档案", title: "他最近在读的", text: [fav.title ? "最爱《" + fav.title + "》" : "", archive.weekTime ? "本周读了 " + archive.weekTime : "", plan.title ? "打算读《" + plan.title + "》" : ""].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 22, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid rgba(120,112,96,.3)", color: "#3a3730" }
    }, "转发给 TA · 他会知道你翻了手机") : null);
  const nav = h("div", {
    className: "shrink-0 grid grid-cols-2",
    style: { padding: "5px 30px calc(env(safe-area-inset-bottom) * 0.4 + 4px)", minHeight: 54, background: "rgba(252,251,247,.97)", borderTop: "1px solid rgba(120,112,96,.18)" }
  }, [["shelf", "书架"], ["mine", "我的"]].map(([k, label]) => h("button", {
    key: k, onClick: () => { setTab(k); setBook(null); },
    className: "flex flex-col items-center justify-center active:opacity-60",
    style: { fontFamily: F_BODY, fontSize: 10.5, color: tab === k ? "#4a6b3f" : "rgba(60,54,40,.45)" }
  }, h("div", { style: { width: 30, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: tab === k ? "rgba(157,191,146,.42)" : "transparent" } },
    h(PGlyph, { k: k === "shelf" ? "reading" : "liked", size: 15, color: tab === k ? "#3f5c36" : "rgba(60,54,40,.45)" })),
  h("span", { style: { marginTop: 2 } }, label))));
  // 一本书的详情：书签 + 书名作者 + 读到 + 划的那句 + 批注
  const detail = book ? h("div", {
    className: "absolute inset-0 flex flex-col justify-center px-4",
    style: { background: "rgba(58,55,48,.34)", zIndex: 30 },
    onClick: closeBook
  }, h("div", {
    onClick: e => e.stopPropagation(),
    style: { background: "#faf7ef", borderRadius: 16, maxHeight: "82%", overflowY: "auto", boxShadow: "0 22px 50px rgba(40,36,28,.28)" }
  }, h("div", { className: "relative flex items-center justify-between px-4", style: { minHeight: 62, borderBottom: "1px solid rgba(120,112,96,.16)" } },
    h("button", { onClick: closeBook, "aria-label": "关闭", className: "active:opacity-60 flex items-center justify-center", style: { width: 34, height: 34, borderRadius: 99, border: "1px solid rgba(120,112,96,.28)", fontSize: 15, color: "#6a6355" } }, "✕"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(60,54,40,.45)", textAlign: "right" } }, (book._shelf || "书架") + " · Vol." + String(book._no).padStart(2, "0")),
    h("div", { "aria-hidden": "true", style: { position: "absolute", left: "50%", top: -12, marginLeft: -17, width: 34, height: 42, background: "#f2efe6", clipPath: "polygon(0 0,100% 0,100% 100%,50% 76%,0 100%)" } })),
  h("div", { style: { padding: "22px 22px 26px" } },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 27, lineHeight: 1.25, color: "#2f2c26" } }, book.title || "无题"),
    h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: "rgba(60,54,40,.5)", marginTop: 7 } }, book.author || ""),
    book.readAt ? h("div", { style: { marginTop: 20, borderLeft: "3px solid #9dbf92", background: "#f4f1e8", padding: "14px 16px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(60,54,40,.45)" } }, "读到"),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: "#2f2c26", marginTop: 6 } }, book.readAt)) : null,
    book.quote ? h("div", { style: { marginTop: 12, borderLeft: "3px solid #c4b98d", background: "#f4f1e8", padding: "14px 16px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(60,54,40,.45)" } }, "他划的一句"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.85, color: "#2f2c26", marginTop: 6 } }, book.quote)) : null,
    book.note ? h("div", { style: { marginTop: 12, borderLeft: "3px solid #d3aab9", background: "#f4f1e8", padding: "14px 16px" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: "rgba(60,54,40,.45)" } }, "批注"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 15, lineHeight: 1.95, color: "#2f2c26", marginTop: 6, whiteSpace: "pre-wrap" } }, book.note)) : null,
    onPeek ? h("button", {
      onClick: () => onPeek({ tier: "quiet", label: "他读的书", title: "《" + (book.title || "") + "》" + (book.readAt ? " · " + book.readAt : ""), text: [book.quote ? "他划了：" + book.quote : "", book.note].filter(Boolean).join("｜") }),
      className: "w-full active:opacity-60",
      style: { marginTop: 20, padding: "13px 0", borderRadius: 13, fontFamily: F_BODY, fontSize: 12.5, border: "1px solid rgba(120,112,96,.3)", color: "#3a3730" }
    }, "转发给 TA · 他会知道你翻了手机") : null))) : null;
  return h("div", { className: "h-full min-h-0 flex flex-col relative", style: { background: PAPER } },
    chrome, tab === "shelf" ? shelfPage : minePage, nav, detail);
}
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
  // 模型偶尔会把 items 返回成字符串或对象；a || [] 会原样放行，下一步 .map 就是白屏
  const arr = a => Array.isArray(a) ? a : [];
  // 【偷看转发】她 2026-08-29 定的规矩：手机里的东西不常驻上下文，**转发了才注入**，
  // 而且注入时的语境必须是「她翻了他的手机」。tier 决定他该有什么反应：
  //   open   = 他本来就没瞒着（歌单、大号发的帖）
  //   quiet  = 你看得见但他没主动说（备忘录、购物、浏览器、录音、普通照片）
  //   hidden = 他压根没打算让任何人知道（小号、匿名、深夜、私密、最近删除）
  const peekFoot = (tier, label, title, text) => ctx.onPeek ? h("button", {
    onClick: () => ctx.onPeek({ tier, label, title, text }),
    className: "w-full mt-6 py-3 active:opacity-60",
    style: {
      fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13,
      border: "1px solid " + (tier === "hidden" ? "rgba(200,80,70,.45)" : t.line),
      color: tier === "hidden" ? "#b6473c" : t.ink
    }
  }, tier === "hidden" ? "摆到 TA 面前 · 这是他藏起来的" : tier === "open" ? "转发给 TA" : "转发给 TA · 他会知道你翻了手机") : null;
  if (key === "wechat") return h(WeChatViewFull, { d, char, t, profile: ctx.profile, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing });
  if (key === "notes") return wrap(arr(d.items).map((it, i) => h("button", {
    key: i,
    onClick: () => setSheet(DetailSheet(it.title, it.detail, t, peekFoot("quiet", "备忘录", it.title, it.detail))),
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
    onClick: () => setSheet(DetailSheet(it.title, (it.url ? "🔗 " + it.url + "\n\n" : "") + (it.content || ""), t, peekFoot("quiet", "浏览记录", it.title, it.content))),
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
    onClick: () => setSheet(DetailSheet(it.name, it.thought, t, peekFoot("quiet", "购物", it.name + (it.price ? " " + it.price : ""), it.thought))),
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
  if (key === "album") return h(AlbumView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  // ── 论坛：接【真论坛】，不再另生成一份光有标题的假货 ──
  // 论坛界面里她只看得见「匿名用户」和一个不认识的小号；哪些是他发的，
  // 只有翻他手机才知道。所以三个账号并排摆在这儿——查手机就是面具掉下来的地方。
  if (key === "forum") {
    const accounts = arr(ctx.forumAccounts);
    if (!accounts.length) return h(Empty, { text: "论坛还没有他的痕迹", sub: "等他去论坛发帖或回帖之后再来翻" });
    const acc = accounts.find(a => a.key === ctx.forumTab) || accounts[0];
    const fmtTs = ts => { if (!ts) return ""; const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日 " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    const tabs = h("div", { className: "flex gap-2 mb-4" }, accounts.map(a => h("button", {
      key: a.key,
      onClick: () => ctx.setForumTab && ctx.setForumTab(a.key),
      className: "active:opacity-60",
      style: {
        fontFamily: F_BODY, fontSize: 12, padding: "5px 13px", borderRadius: 999,
        border: "1px solid " + (a.key === acc.key ? t.ink : t.line),
        background: a.key === acc.key ? t.ink : "transparent",
        color: a.key === acc.key ? t.bg : t.sub
      }
    }, a.label + " · " + ((a.posts || []).length + (a.comments || []).length))));
    // 顶部只留一行小字：名字进顶栏了，这里不再重复一遍大标题（mobile-ui-layout.md §1）
    const head = h("div", { className: "mb-3", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, lineHeight: 1.7 } },
      [acc.handle || "", acc.followers != null ? acc.followers + " 关注者" : "", acc.joinTs ? fmtTs(acc.joinTs).slice(0, -6) + " 注册" : ""].filter(Boolean).join(" · "),
      acc.bio ? h("div", { style: { color: t.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, acc.bio) : null);
    const postRow = (it, i) => h("button", {
      key: "p" + i,
      onClick: () => setSheet(h("div", null,
        h(Eyebrow, { style: { marginBottom: 10 } }, (it.board || "论坛") + " · " + fmtTs(it.ts)),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 18, color: t.ink, lineHeight: 1.35 } }, it.title),
        it.body && h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.sub, marginTop: 12, lineHeight: 1.75, whiteSpace: "pre-wrap" } }, it.body),
        arr(it.replies).length ? h("div", { className: "mt-5" },
          h(Eyebrow, { style: { marginBottom: 8 } }, "楼下 " + it.replyCount + " 条"),
          arr(it.replies).map((r, j) => h("div", { key: j, className: "py-2", style: { borderTop: "1px solid " + t.line } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: r.mine ? t.accent : t.fog } }, r.name + "："),
            h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.ink, lineHeight: 1.6 } }, r.text)))) : null,
        peekFoot(acc.key === "main" ? "open" : "hidden", acc.key === "main" ? "论坛（大号）" : acc.key === "alt" ? "论坛小号「" + (acc.name || "") + "」" : "论坛匿名帖", it.title, it.body))),
      className: "w-full text-left py-3.5 active:opacity-60",
      style: line
    }, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: t.ink, lineHeight: 1.4 } }, it.title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } },
      [it.board, fmtTs(it.ts), it.replyCount ? it.replyCount + " 条回复" : "还没人回"].filter(Boolean).join(" · ")));
    const cmtRow = (it, i) => h("div", { key: "c" + i, className: "py-3.5", style: line },
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: t.ink, lineHeight: 1.65 } }, it.text),
      h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 5 } },
        "在「" + it.postTitle.slice(0, 18) + "」下 · " + fmtTs(it.ts) + (it.backCount ? " · 有 " + it.backCount + " 人回他" : "")));
    const posts = arr(acc.posts), cmts = arr(acc.comments);
    return h("div", { style: { animation: "fadeUp .3s ease both" } }, tabs, head,
      posts.length ? h("div", { className: "mb-6" }, h(Eyebrow, { style: { marginBottom: 4 } }, "发过的帖"), posts.map(postRow)) : null,
      cmts.length ? h("div", null, h(Eyebrow, { style: { marginBottom: 4 } }, "在别人楼下说的话"), cmts.map(cmtRow)) : null,
      (!posts.length && !cmts.length) ? h(Empty, { text: "这个号还是空的", sub: acc.key === "anon" ? "他还没用匿名发过什么" : "他还没用这个号露过面" }) : null);
  }
  // ── 音乐：接【一起听】里那张真歌单 ──
  // 以前这儿单独生成一份，于是同一个人有两张互不相干的歌单，
  // 手机里这张还点不动。现在读同一份数据，点开就能放，并且每首带他自己的心境。
  if (key === "music") {
    const pl = ctx.playlist;
    const songs = arr(pl && pl.songs);
    if (!songs.length) return h("div", { className: "py-6" }, h(Empty, {
      text: "他还没有歌单",
      sub: "「一起听」里给他生成一张，这里就能看到"
    }), h("button", {
      onClick: () => ctx.onGenPlaylist && ctx.onGenPlaylist(),
      disabled: !!ctx.playlistBusy,
      className: "w-full mt-4 py-3 active:opacity-60",
      style: { fontFamily: F_BODY, fontSize: 13, borderRadius: 14, border: "1px solid " + t.line, color: t.ink, opacity: ctx.playlistBusy ? .5 : 1 }
    }, ctx.playlistBusy ? "正在想他会听什么…" : "给他生成一张"));
    // 歌单名进顶栏了，这里不再放一块大字（mobile-ui-layout.md §1：普通子页面用紧凑标题栏）
    return h("div", { style: { animation: "fadeUp .3s ease both" } },
      h("div", { className: "mb-2", style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog } }, songs.length + " 首 · 和「一起听」是同一张"),
      songs.map((s, i) => {
        const note = String(s.note || "").trim();
        return h("button", {
          key: s.id || i,
          onClick: () => setSheet(h("div", null,
            h(Eyebrow, { style: { marginBottom: 8 } }, s.title),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog } }, s.artist),
            note && h("div", { style: { fontFamily: F_BODY, fontSize: 14, lineHeight: 1.85, color: t.ink, marginTop: 14 } }, note),
            h("button", {
              onClick: () => ctx.onPlaySong && ctx.onPlaySong(s),
              className: "w-full mt-6 py-3 active:opacity-60",
              style: { fontFamily: F_BODY, fontSize: 12.5, borderRadius: 13, border: "1px solid " + t.line, color: t.ink }
            }, "放这首"),
            peekFoot("open", "歌单", s.title + (s.artist ? " · " + s.artist : ""), note))),
          className: "w-full text-left py-2.5 flex items-start gap-3 active:opacity-60",
          style: { borderTop: `1px solid ${t.line}` }
        }, h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 11, color: t.fog, width: 20, paddingTop: 3 } }, String(i + 1).padStart(2, "0")),
        s.cover
          ? h("img", { src: s.cover, alt: "", style: { width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 } })
          : h("div", { style: { width: 34, height: 34, borderRadius: 6, background: t.bg2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" } }, h(PGlyph, { k: "music", size: 15, color: t.fog })),
        h("div", { className: "flex-1 min-w-0" },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink } }, s.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, marginTop: 1 } }, s.artist),
          // 心境：他为什么会循环这一首（她 2026-08-29 点名要在查手机这边看得到）
          note && h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 5, lineHeight: 1.6, paddingLeft: 8, borderLeft: "2px solid " + t.line } }, note)));
      }));
  }
  if (key === "reading") return h(ReadingView, { d, char, t, onBack: ctx.onBack, onRefresh: ctx.onRefresh, refreshing: ctx.refreshing, onPeek: ctx.onPeek });
  // ── 赞过：他不会写下来，但他会点 ──
  if (key === "liked") return wrap([
    arr(d.follows).length ? h("div", { key: "f", className: "pb-4" },
      h(Eyebrow, { style: { marginBottom: 8 } }, "他关注的"),
      h("div", { className: "flex flex-wrap gap-1.5" }, arr(d.follows).map((f, i) => h("span", {
        key: i,
        style: { fontFamily: F_BODY, fontSize: 11, color: t.sub, padding: "3px 9px", borderRadius: 999, background: t.bg2, border: "1px solid " + t.line }
      }, (f.name || "") + (f.desc ? " · " + String(f.desc).slice(0, 14) : ""))))) : null,
    arr(d.items).map((it, i) => h("button", {
      key: "i" + i,
      onClick: () => setSheet(DetailSheet((it.author || "某人") + " 的" + (it.kind || "内容"), it.content, t,
        peekFoot("quiet", "他" + (it.act || "赞") + "过的", it.author ? it.author + "：" + String(it.content || "").slice(0, 24) : it.content, it.content))),
      className: "w-full text-left py-3 active:opacity-60", style: line
    }, h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: t.ink } }, it.content),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 4 } },
      [(it.act || "赞") + "过", it.author, it.kind, it.tag, it.time].filter(Boolean).join(" · "))))
  ]);
  // ── 订单：外卖／打车／快递。备注那一栏比买了什么更暴露人 ──
  if (key === "orders") return wrap(arr(d.items).map((it, i) => h("button", {
    key: i,
    onClick: () => setSheet(DetailSheet(it.title,
      [it.type, it.time, it.addr, it.note ? "备注：" + it.note : "", it.amount != null ? fmtMoney(it.amount) : ""].filter(Boolean).join("\n"), t,
      peekFoot("quiet", it.type || "订单", it.title, [it.addr, it.note].filter(Boolean).join("｜")))),
    className: "w-full text-left py-3.5 flex items-start justify-between gap-3 active:opacity-60", style: line
  }, h("div", { className: "flex-1 min-w-0" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, color: t.ink, lineHeight: 1.4 } }, it.title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginTop: 3 } }, [it.type, it.time, it.addr].filter(Boolean).join(" · ")),
    it.note ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 4 } }, "备注：" + it.note) : null),
  it.amount != null ? h("span", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 12, color: t.ink, flexShrink: 0, paddingTop: 2 } }, fmtMoney(it.amount)) : null)));
  // ── 健康：数字自己会说话，不替它解释 ──
  if (key === "health") {
    const wk = arr(d.week);
    const hrs = wk.map(x => Number(x.hours) || 0);
    const maxH = Math.max(8, ...hrs, 0);
    const avg = hrs.length ? (hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : null;
    return wrap([
      h("div", { key: "hd", className: "flex gap-8 mb-5" },
        h("div", null, h(Eyebrow, { style: { marginBottom: 4 } }, "静息心率"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, color: t.ink } }, d.restingHr != null ? d.restingHr : "--")),
        h("div", null, h(Eyebrow, { style: { marginBottom: 4 } }, "平均睡眠"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 25, color: t.ink } }, avg != null ? avg + " h" : "--"))),
      h("div", { key: "bars", className: "flex items-end gap-2", style: { height: 104 } }, wk.map((x, i) => h("div", {
        key: i, className: "flex-1 flex flex-col items-center", style: { gap: 5 }
      }, h("div", { style: { fontFamily: "'Archivo',sans-serif", fontSize: 9, color: t.fog } }, (Number(x.hours) || 0).toFixed(1)),
      h("div", { style: { width: "100%", height: Math.round(66 * (Number(x.hours) || 0) / maxH), borderRadius: 4, background: (Number(x.hours) || 0) < 6 ? "#c2705f" : t.ink } }),
      h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: t.fog } }, x.day || "")))),
      h("div", { key: "rows", style: { marginTop: 18 } }, wk.map((x, i) => h("div", {
        key: i, className: "py-2 flex items-center justify-between gap-3", style: line
      }, h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: t.sub } }, [x.day, x.date].filter(Boolean).join(" ")),
      h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } },
        [(x.sleepStart || "?") + "–" + (x.sleepEnd || "?"), x.steps != null ? x.steps + " 步" : ""].filter(Boolean).join(" · "))))),
      d.weekNote ? h("div", { key: "n", style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, marginTop: 14, lineHeight: 1.7 } }, d.weekNote) : null,
      h("div", { key: "pk" }, peekFoot("quiet", "健康记录", "他这一周的睡眠",
        wk.map(x => (x.day || "") + " " + (x.sleepStart || "?") + " 睡 " + (Number(x.hours) || 0) + "h").join("；")))
    ]);
  }
  // ── 剪贴板：复制了却一直没发出去的那条，是「差一点就说了」的物证 ──
  if (key === "clipboard") return wrap(arr(d.items).map((it, i) => {
    const held = it.sent === false;
    return h("button", {
      key: i,
      onClick: () => setSheet(DetailSheet(it.from || "剪贴板", it.text, t,
        peekFoot(held ? "hidden" : "quiet", held ? "剪贴板里没发出去的一段" : "剪贴板", it.from || "", it.text))),
      className: "w-full text-left py-3.5 active:opacity-60", style: line
    }, h("div", {
      style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.65, color: t.ink, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }
    }, it.text), h("div", {
      style: { fontFamily: F_BODY, fontSize: 10.5, color: held ? "#b6473c" : t.fog, marginTop: 5 }
    }, [it.from, it.time, held ? "复制了，一直没发出去" : "已发出"].filter(Boolean).join(" · ")));
  }));
  // ── 日历：推迟次数比日程本身说明问题 ──
  if (key === "calendar") return wrap(arr(d.items).map((it, i) => h("button", {
    key: i,
    onClick: () => setSheet(DetailSheet(it.title,
      [it.when, it.kind, it.note, Number(it.postponed) > 0 ? "已经往后推了 " + it.postponed + " 次" : ""].filter(Boolean).join("\n"), t,
      peekFoot("quiet", it.kind === "提醒" ? "提醒事项" : "日历", it.title,
        [it.when, it.note, Number(it.postponed) > 0 ? "推迟过 " + it.postponed + " 次" : ""].filter(Boolean).join("｜")))),
    className: "w-full text-left py-3.5 flex items-start gap-3 active:opacity-60", style: line
  }, h("div", {
    style: { width: 7, height: 7, borderRadius: 9, marginTop: 6, flexShrink: 0, background: it.done ? t.line : (Number(it.postponed) >= 2 ? "#c2705f" : t.ink) }
  }), h("div", { className: "flex-1 min-w-0" },
    h("div", { style: { fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.4, color: it.done ? t.fog : t.ink, textDecoration: it.done ? "line-through" : "none" } }, it.title),
    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: Number(it.postponed) >= 2 ? "#c2705f" : t.fog, marginTop: 3 } },
      [it.when, it.kind, Number(it.postponed) > 0 ? "推迟 " + it.postponed + " 次" : ""].filter(Boolean).join(" · "))))));
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
    onClick: () => setSheet(RecSheet(it, t, peekFoot("quiet", "录音", it.name, it.transcript))),
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
    onClick: () => setSheet(DetailSheet(v.title, v.thought, t, peekFoot("hidden", "深夜看的视频", v.title, v.thought))),
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
  actualWechat,
  live
}) {
  const t = useTheme();
  const [sheet, setSheet] = useState(null);
  const [vtab, setVtab] = useState(null); // 视频子版块：day / night，默认不选
  const zh = PHONE_LABEL[appKey];
  const rawData = charData[appKey];
  const data = appKey === "wechat" && rawData ? { ...rawData, actualChats: actualWechat || [] } : rawData;
  const loading = busyKey === appKey;
  const isVideo = appKey === "video";
  const isLive = PHONE_LIVE_KEYS.indexOf(appKey) >= 0;
  const [forumTab, setForumTab] = useState("main");
  // 打开非视频版块：直接生成，失败退回上一级（不再显示中间的「生成」页）
  useEffect(() => {
    if (isVideo || isLive || charData[appKey]) return;
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
  } else if (loading && !data) content = h(Spinner, {
    label: "正在读取 " + zh + "…"
  });else if (!data && !isLive) content = h(Spinner, {
    label: "正在读取 " + zh + "…"
  });else content = renderPhoneModule(appKey, data, {
    t,
    char,
    setSheet,
    profile,
    onBack,
    onRefresh: () => onGen(char, appKey),
    refreshing: !!busyKey,
    forumTab,
    setForumTab,
    ...(live || {})
  });
  // 接真数据的 app 没有「重刷」这回事——它跟着他真去论坛发帖、真加歌单在变。
  const refreshKey = isLive ? null : isVideo ? vtab ? "video_" + vtab : null : appKey;
  const liveTitle = appKey === "music"
    ? (((live || {}).playlist || {}).name || "音乐")
    : (() => { const a = ((live || {}).forumAccounts || []).find(x => x.key === forumTab); return a ? a.label + " · " + (a.name || "") : "论坛"; })();
  return h("div", {
    className: "h-full flex flex-col",
    style: {
      background: t.bg
    }
  },
  // 紧凑标题栏：返回键 + 居中小标题 + 右侧等宽操作位（.claude/rules/mobile-ui-layout.md §1）。
  // 论坛和音乐这两页的内容本来就是一长条列表，30px 大标题＋大段留白白吃掉小半屏；
  // 名字（歌单名 / 当前账号）直接放进标题栏，正文里就不用再重复一遍
  //（她 2026-08-29：「把顶部那一大块字删了，整体在屏幕显示多一点」）。
  // 只改这两页，别的 app 维持原样——一次改一处，能亲眼验的才算数。
  isLive ? h("div", {
    className: "shrink-0 px-4 pb-2 flex items-center gap-2",
    style: { background: t.bg, paddingTop: safeTop(8) }
  }, h("button", {
    onClick: onBack, className: "active:opacity-50 flex items-center justify-center",
    style: { width: 40, height: 40, marginLeft: -8 }, "aria-label": "返回"
  }, h(IArrow, { size: 19, color: t.ink })),
  h("div", {
    className: "flex-1 min-w-0 text-center",
    style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
  }, liveTitle),
  h("div", { style: { width: 40, height: 40 } })) :
  FULL_BLEED_KEYS.indexOf(appKey) < 0 && h(Head, {
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
    className: FULL_BLEED_KEYS.indexOf(appKey) >= 0 ? "flex-1 min-h-0 overflow-hidden" : isLive ? "flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-5" : "flex-1 overflow-y-auto px-6 py-4"
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
  actualWechatFor,
  forumAccountsFor,
  playlistFor,
  onGenPlaylist,
  playlistBusyId,
  onPlaySong,
  onPeek
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
  const allNowKey = String(busyKey || "").indexOf("__all__") === 0 ? (String(busyKey).split(":")[1] || "__all__") : null;
  const isAllRun = String(busyKey || "").indexOf("__all__") === 0;
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
  // 真数据这两个不看 phones，看 App 里那份真的
  const liveForum = forumAccountsFor ? forumAccountsFor(char) : null;
  const livePlaylist = playlistFor ? playlistFor(char.id) : null;
  const liveCtx = {
    forumAccounts: liveForum,
    playlist: livePlaylist,
    onGenPlaylist: () => onGenPlaylist && onGenPlaylist(char),
    playlistBusy: playlistBusyId === char.id,
    onPlaySong: s => onPlaySong && onPlaySong(s),
    // 偷看转发：手机里的东西只有【转发了】才进他的上下文（她 2026-08-29 定的）
    onPeek: pk => onPeek && onPeek(char, pk)
  };
  const liveCount = k => k === "forum"
    ? (liveForum || []).reduce((n, a) => n + (a.posts || []).length + (a.comments || []).length, 0)
    : ((livePlaylist && livePlaylist.songs) || []).length;
  const hasData = a => PHONE_LIVE_KEYS.indexOf(a.key) >= 0 ? liveCount(a.key) > 0
    : a.key === "video" ? data.video_day || data.video_night : data[a.key];
  const appByKey = k => PHONE_APPS.find(a => a.key === k);
  const openApp = a => {
    if (!a || a.soon) return;
    markSeen(char.id, a.key);
    setOpen(a.key);
  };
  const latestLine = (value, fallback) => {
    if (!value) return fallback;
    const pool = value.chats || value.items || value.songs || value.apps || value.week;
    const x = Array.isArray(pool) && pool[0];
    return String((x && (x.last || x.title || x.caption || x.name || x.transcript || x.content || x.text || (x.day && x.hours != null ? x.day + " 睡了 " + x.hours + " 小时" : ""))) || value.desc || value.playlist || value.screenTime || value.weekNote || fallback);
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
    // 全刷时 busyKey 是 "__all__:当前那个 key"。以前不分是谁，一律当成「打开的这个正在生成」，
    // 于是全刷期间随便点哪个 app 都是一个转不完的圈，看起来就像卡死了（她 2026-08-29 报音乐打不开）。
    busyKey: allNowKey || busyKey,
    onGen: onGenApp,
    profile,
    actualWechat: actualWechatFor ? actualWechatFor(char) : [],
    live: liveCtx,
    onBack: () => setOpen(null)
  });
  const wall = strColor(char.id || char.name);
  const layout = phoneDesktopLayout(char);
  const widgetData = key => key === "video" ? (data.video_day || data.video_night) : data[key];
  const widgetCopy = key => {
    const fallback = {
      wechat: "点开看看最近和谁说过话", notes: "最近没有留下新备忘", browser: "最近没有浏览记录",
      music: "他还没有歌单", album: "相册还没翻过", video: "最近没有观看记录",
      forum: "论坛上还没有他的痕迹", reading: "最近没在读什么", liked: "还没点过什么",
      orders: "最近没下过单", health: "还没有健康记录", clipboard: "剪贴板是空的", calendar: "日历上没有安排"
    }[key] || "还没有内容";
    // 真数据这两个走自己那份，不然桌面小组件永远显示兜底话
    if (key === "music") { const sg = ((livePlaylist && livePlaylist.songs) || [])[0]; return sg ? (livePlaylist.name || "歌单") + " · " + sg.title : fallback; }
    if (key === "forum") {
      const all = (liveForum || []).reduce((a, x) => a.concat((x.posts || []).map(p => ({ ts: p.ts, s: p.title })), (x.comments || []).map(c => ({ ts: c.ts, s: c.text }))), []);
      const last = all.sort((a, b) => b.ts - a.ts)[0];
      return last ? String(last.s || "").slice(0, 40) : fallback;
    }
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
    }, isAllRun ? (allNowKey && PHONE_LABEL[allNowKey] ? "正在翻…" + PHONE_LABEL[allNowKey] : "正在翻整部手机…") : "刷新全部 App"));
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
    style: { paddingTop: safeTop(20) }
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
// ============================================================
// 同一部手机不许复读（她 2026-08-29：「差不多同一时间刷新的话素材都差不多，
// 就算功能不一样还是会说的大差不差的」）
//
// 病因在结构，不在哪个 app 的提示词写坏了：runProbe 给每个 app 发的
// system 是【引擎前言 + buildBundle(ctx) + 这个 app 的 instruction】，
// 而 buildBundle(ctx) 十二次逐字相同。同一份上下文喂十二遍，模型每次都会
// 抓住其中最显眼的那件事（昨晚那场架、这趟出门），然后换十二种格式重讲一遍：
// 备忘录里记它、搜索框里搜它、买的东西为它、听的歌为它、录音里叹它。
//
// 所以要两层一起上（规则降概率，代码才保证）：
//   ① 代码层——把这轮别的 app 已经写出来的东西回喂给下一个，明确禁止重讲。
//      这跟朋友圈那份【不许复读】和微信那份【真实会话避重】是同一个形状。
//   ② 规则层——每个 app 除了输出格式，还要有自己的【取材层】和【时间窗】，
//      让它们靠结构分开，而不是靠运气分开。
// ============================================================

// 每个 app 站的位置：他在这个 app 里是「对谁」的样子，以及往回捞多久。
// 时间窗尤其重要——现在所有 app 默认都在写「这几天」，相册本该跨年、
// 购物本该跨月，全挤在同一个窗口里，撞车是必然的。
const PHONE_ANGLE = {
  wechat: "【取材层】有别人在场时的他。这里每句话都是说给某个具体的人听的，会挑措辞、会留一手。【时间窗】这几天。",
  notes: "【取材层】完全没人看的时候，他打字给自己的。清单、待办、半句话、气话、抄下来的一行字都行，不必是完整的想法，也不必每条都有情绪。【时间窗】这一两周。",
  recordings: "【取材层】他说出口、但没打算给任何人听的。会有语气词、停顿、说到一半的句子——**只有打字打不出来、只能说出来的东西才会被录下来**，这是它和备忘录的分界。【时间窗】这一两周。",
  calls: "【取材层】他和外面世界的例行往来：工作、家里、办事、推销、打错的。这里大部分是杂事，不是感情戏。【时间窗】这一周。",
  browser: "【取材层】一个人闲着、脑子没在想正事的时候搜的东西。可以很无聊、很实用、很没道理，也可以是查一个当场想不起来的词。【时间窗】这几天。",
  shopping: "【取材层】他花钱的方式。买了什么比想了什么更暴露人；日用、囤货、冲动、给别人买的，都算。【时间窗】这一个月。",
  video: "【取材层】他消磨时间的口味，不是他的心事。【时间窗】这几天。",
  video_day: "【取材层】他消磨时间的口味，不是他的心事。刷视频多半是没在想什么的时候。【时间窗】这几天。",
  video_night: "【取材层】深夜、独自一人、没打算被任何人看见的欲望。【时间窗】这阵子。",
  album: "【取材层】过去。**相册的主体不是这几天**，而是几个月到几年沉下来的东西：旧的人、去过的地方、早就结束的事。只有一两张属于最近。【时间窗】跨月跨年。",
  reading: "【取材层】他一个人读到某一句停下来的那个瞬间。**批注和划线是不打算给任何人看的动作**，所以它比书单诚实得多；书架怎么分、怎么起名，也是他自己对自己的说法。【时间窗】跨年，一架书是攒出来的，不是这个月买的。",
  liked: "【取材层】他不会写下来、但会顺手点的东西。点赞和收藏没有措辞、不用解释，所以最诚实。【时间窗】这一两个月。",
  orders: "【取材层】他和现实生活打交道的痕迹：吃什么、几点吃、去哪、东西送到谁那儿。【时间窗】这两周。",
  health: "【取材层】纯数字，不承载情节，也不许在里面写心情——数字自己会说话。【时间窗】最近七天。",
  clipboard: "【取材层】他复制过、但不一定发出去的东西。这里最重要的不是内容，是**发没发出去**。【时间窗】这几天。",
  calendar: "【取材层】他给自己排的事，以及他一直没去做的事。【时间窗】前后两周。",
  settings: "【取材层】纯数字，不承载情节。",
  wallet: "【取材层】他的谋生方式和消费水平，是长期的底子，不是这几天的心情。【时间窗】按月。"
};

// 从已存下来的各 app 数据里抽一行代表，喂给下一个 app 当【已经写过】清单。
// 只抽标题/名字这一层，不抽正文——目的是让模型认出「这件事被人写过了」，
// 不是把别的 app 的内容再塞一份进上下文（她按次计费，也按字数付钱）。
const pArr = a => Array.isArray(a) ? a : [];
const PHONE_DIGEST_PICK = {
  wechat: d => pArr(d.chats).slice(0, 3).map(c => (c.name || "") + "：" + (c.last || ""))
    .concat(pArr(d.moments).slice(0, 2).map(m => "朋友圈「" + String(m.content || "").slice(0, 30) + "」")),
  notes: d => pArr(d.items).map(x => x.title),
  calls: d => pArr(d.items).slice(0, 4).map(x => x.name),
  browser: d => pArr(d.items).map(x => x.title),
  shopping: d => pArr(d.items).map(x => x.name + (x.price ? " " + x.price : "")),
  album: d => pArr(d.items).slice(0, 4).map(x => x.caption),
  recordings: d => pArr(d.items).map(x => x.name),
  video_day: d => pArr(d.items).map(x => x.title),
  video_night: d => pArr(d.items).map(x => x.title),
  reading: d => pArr(d.shelves).map(x => x.name).concat(pArr(d.shelves).reduce((a, sh) => a.concat(pArr(sh.books).slice(0, 2).map(b => b.title)), [])),
  liked: d => pArr(d.items).map(x => x.content),
  orders: d => pArr(d.items).map(x => x.title),
  health: () => [],
  clipboard: d => pArr(d.items).map(x => x.text),
  calendar: d => pArr(d.items).map(x => x.title),
  settings: () => [],
  wallet: () => []
};

// charData = phones[charId]，形如 { notes:{items,_at}, browser:{...}, ... }
function phoneRoundDigest(charData, exceptKey, cap) {
  const lines = [];
  Object.keys(PHONE_DIGEST_PICK).forEach(k => {
    if (k === exceptKey) return;
    const d = charData && charData[k];
    if (!d) return;
    let picked = [];
    try { picked = PHONE_DIGEST_PICK[k](d) || []; } catch (e) { picked = []; }
    picked = picked.map(x => String(x || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 4);
    if (picked.length) lines.push("- " + (PHONE_LABEL[k] || (k === "video_day" ? "视频·白天" : k === "video_night" ? "视频·深夜" : k)) + "：" + picked.join("｜"));
  });
  const max = cap || 900;
  const out = [];
  let used = 0;
  for (const l of lines) {
    const s = l.length > 120 ? l.slice(0, 120) : l;
    if (used + s.length > max) break;
    out.push(s);
    used += s.length;
  }
  return out;
}

function phoneAvoidBlock(lines) {
  if (!lines || !lines.length) return "";
  return "\n\n【同一部手机 · 不许复读】这轮他手机里别的 app 已经写了下面这些：\n" + lines.join("\n")
    + "\n**换一件别的事写。**一个人的手机里不会所有 app 都在说同一件事——备忘录记的、搜索框里搜的、买的东西、听的歌，本来就来自他生活里互不相干的角落，"
    + "很多东西跟你以为最重要的那件事根本没关系。\n"
    + "上面已经出现过的事，这里【只能写它的侧面或后果】，绝不许重讲一遍：别处写了他在等一个消息，这里可以是他等的时候顺手买的东西，但不能又写一遍他在等。\n"
    + "优先去写上面完全没提到的、属于他自己的另一条线：工作、家里、旧朋友、身体、钱、没做完的事、纯粹的无聊。";
}

function phoneProbeSpec(key, char, rel, actualWechat, avoidLines) {
  const relHint = rel && rel.length ? "关系网里的人（" + rel.join("、") + "）请优先出现。" : "";
  const S = {
    wechat: {
      instruction: "推演此刻「" + char.name + "」完整的微信。下面先给你 TA 手机里【真实已有、不可改写】的聊天摘要；你要避开其中已有会话名与原话，另外生成正好 5 个互不相同的新会话（私聊与群聊混合，至少各 2 个）。\n" + (actualWechat || "目前没有可用的真实聊天。") + "\n" + relHint + "chats 每个会话给名字、private/group 类型、最后一条、时间及最近 8-12 条有来有回的对话，不要只给三两句。contacts 正好 5 个，不含用户 Lisa：必须是与 TA 真有关系的人，含 TA 给对方的微信备注 remark 和一段具体、有个人态度的关系简介 intro。userContact 单独写 Lisa：name 固定 Lisa，但 remark 必须是 TA 真会给 Lisa 起的微信备注，intro 必须写 TA 对 Lisa 的具体认识、情感和私下评价，不能写「以主聊天为准」之类占位话。moments 正好 3 条，作者从 contacts 里选；每条给点赞名单和评论，且 comments 中必须有一条来自「" + char.name + "」本人的自然评论。me 写 TA 自己给自己取的 wechatName（不是角色本名照抄，要像 TA 真会使用的微信昵称、符合 TA 的取名风格）、wechatId 和本轮新生成的朋友圈 signature；并给最近看过的 3 篇公众号文章：标题、公众号、时间、较完整的文章摘要和 TA 看完的真实感想。所有内容贴合人物关系、近况和声纹，避免客服腔与泛泛而谈。",
      schemaHint: "{\"chats\":[{\"type\":\"private或group\",\"name\":\"会话名\",\"last\":\"最后一条\",\"time\":\"14:20\",\"messages\":[{\"from\":\"说话人\",\"text\":\"内容\"}]}],\"userContact\":{\"name\":\"Lisa\",\"remark\":\"TA给Lisa的微信备注\",\"intro\":\"TA对Lisa具体而私人的感想\"},\"contacts\":[{\"name\":\"本名\",\"remark\":\"TA的备注\",\"intro\":\"关系与感想\"}],\"moments\":[{\"author\":\"联系人\",\"time\":\"2小时前\",\"content\":\"朋友圈正文\",\"likes\":[\"姓名\"],\"comments\":[{\"from\":\"姓名\",\"text\":\"评论\"}]}],\"me\":{\"wechatName\":\"TA的微信昵称\",\"wechatId\":\"微信号\",\"signature\":\"本轮生成的朋友圈签名\",\"accounts\":[{\"title\":\"文章标题\",\"source\":\"公众号\",\"time\":\"昨晚\",\"summary\":\"较完整文章摘要\",\"thought\":\"TA的感想\"}]}}",
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
      instruction: "推演「" + char.name + "」手机相册里正好 25 张互不重复的照片。时间跨度要自然；date 必须写真实完整日期 YYYY-MM-DD HH:mm，必须带年份，禁止写周三、周五、昨天、最近等相对日期。每张分进且只分进五类之一：回忆(memory)、个人收藏(favorite)、最近保存(saved)、私密(private)、最近删除(deleted)，每类至少 4 张、不必平均。memory 是 TA 真正会反复翻看的重要瞬间，不是普通随手拍。caption 是很短的照片标题；desc 要具体写照片真正拍到了什么（人物、地点、构图、光线和细节），不能只写抽象心情；thought 单独写 TA 看到这张照片时真实、私人的想法。类别与内容要合理：私密不等于一律色情，最近删除也要写为什么舍不得或为什么删。",
      schemaHint: "{\"items\":[{\"id\":\"p01\",\"caption\":\"很短的标题\",\"date\":\"2026-08-28 18:42\",\"category\":\"memory或favorite或saved或private或deleted\",\"desc\":\"照片实际画面描述\",\"thought\":\"TA对此的私人想法\"}]}",
      maxTokens: 12000
    },
    reading: {
      instruction: "推演「" + char.name + "」手机读书 App 里的整个书架。**正好 5 个书架、正好 30 本书（每架 6 本）。**\n\n"
        + "【书架名是这个功能的灵魂】书架名**不是分类标签**——不许写「历史」「科幻」「文学」「哲学」这种。它是【他自己给这堆书起的名字】，带着他的处境、身份、私心和自嘲，像这样：「导师以为我在看的论文」「凌晨两点的关东煮哲学」「怎么对付某个麻烦精」「偶尔翻两页的杂食储备」。**一看名字就知道是谁的书架。**每架另配一个英文 slug（小写下划线，如 midnight_wander）。\n"
        + "五个里至少有一个是【只有他会有的】：跟他的职业、他正在应付的麻烦、他藏着的身份、或者某个具体的人有关。" + relHint + "\n\n"
        + "【书必须是真的】真实存在、书名和作者都对得上，而且【是他在他所处的时代和世界里拿得到的】：古代角色的架子上不许出现现代出版物，现代角色可以有古籍和译本。同一架里的书要像同一个人挑的。\n\n"
        + "【每本都要有】title、author；readAt = 他读到哪儿（「卷七·饮食果子」「第 3 章」「214 页」都行，**允许有几本写「还没翻开」或「读了两页就放下了」**）；note = 他的批注，40-90 字，第一人称。\n"
        + "批注要写他读到这里**真实想到的事**：可以跑题、可以刻薄、可以突然想到某个人、可以是很实际的念头（比如「改天带你去城南找找，看能不能把书里的几样凑齐」）。**不许写读后感、不许总结这本书讲了什么、不许出现「这本书让我明白了」「引发了我的思考」这类句子。**换个角色也说得通的批注就是写坏了。\n"
        + "quote 可选：他在这本里划的一句原文（书里的句子，不是他的话），没有就填空字符串——**多数书是没有的**。\n\n"
        + "【阅读档案 archive】favorite = 他最爱的一本（title+author，要在上面 30 本里）；weekTime = 本周读了多久（如「7小时5分」，按他的处境合理，忙的人可以只有二十分钟）；plan = 他打算下一本读的（title+author）。",
      schemaHint: "{\"shelves\":[{\"name\":\"他自己起的书架名\",\"slug\":\"english_slug\",\"books\":[{\"title\":\"书名\",\"author\":\"作者\",\"readAt\":\"卷七·饮食果子\",\"quote\":\"他划的原句，多数留空\",\"note\":\"40-90字第一人称批注\"}]}],\"archive\":{\"favorite\":{\"title\":\"书名\",\"author\":\"作者\"},\"weekTime\":\"7小时5分\",\"plan\":{\"title\":\"书名\",\"author\":\"作者\"}}}",
      maxTokens: 30000
    },
    liked: {
      instruction: "推演「" + char.name + "」在一个图文/短视频社区（类似小红书、豆瓣那种半熟人平台，不是微信）里点过赞和收藏的东西（6-9 条）。每条给 author（发的人的昵称）、kind（图文/视频/长文/评论 之一）、content（那条内容本身是什么，一句话说清）、tag（分区标签）、time、act（赞 或 收藏）。\n**点赞记录是一个人最诚实的东西**：他不会写下来，但他会点。所以这里应该出现他【不会主动跟人说、也不觉得需要解释】的部分——某种审美偏好、某个人、某类身体或情绪上的需要、一个他嘴上不承认的爱好、一条他其实想照做的建议。也可以有很没意思的（食谱、装修、通勤路线）。\n另外给 follows：他关注的 3-5 个账号，name ＋一句 desc 说明那号是干嘛的。别全是正经账号。" + relHint,
      schemaHint: "{\"follows\":[{\"name\":\"账号名\",\"desc\":\"这号是干嘛的\"}],\"items\":[{\"author\":\"发的人\",\"kind\":\"图文\",\"content\":\"内容是什么\",\"tag\":\"分区\",\"time\":\"3天前\",\"act\":\"赞\"}]}",
      maxTokens: 3000
    },
    orders: {
      instruction: "推演「" + char.name + "」最近的订单记录（6-9 条），外卖、打车、快递混在一起。每条给 type（外卖/打车/快递 之一）、title（买了什么，或「从哪到哪」）、amount（纯数字，元）、time（如「昨天 23:41」）、addr（送到哪／到哪，可留空）、note（下单备注，可留空）。\n**备注那一栏是这个 app 的重点**：「不要香菜」「放门口就行」「麻烦轻一点敲门，家里有人在睡」——这三条是三个不同的人。每条备注都要像真人当场打的字，宁可留空也不要写得像客服模板。\n金额和消费水平严格按他的身份来，别人人都点贵的。深夜的单、送到别人家的单、替别人点的单都可以有。" + relHint,
      schemaHint: "{\"items\":[{\"type\":\"外卖\",\"title\":\"买了什么或从哪到哪\",\"amount\":38,\"time\":\"昨天 23:41\",\"addr\":\"送到哪\",\"note\":\"下单备注，可空\"}]}",
      maxTokens: 2600
    },
    health: {
      instruction: "推演「" + char.name + "」最近七天的健康数据。week 正好 7 条，从七天前到昨天，每条给 day（周几）、date（M月D日）、sleepStart（入睡时间 HH:mm）、sleepEnd（醒来 HH:mm）、hours（睡了几小时，一位小数）、steps（步数整数）。另给 restingHr（静息心率整数）和 weekNote（一句话，要用健康 App 那种干巴巴的周报口吻）。\n**这些数字必须和他这七天真实经历过的事对得上**：熬夜那晚就该是三四点，出门多的那天步数就该高，心里翻腾的时候睡眠时长会短会碎，休息日可以睡到很晚。\n**不要在 weekNote 里替数字解释情绪**——数字自己会说话，写成「本周睡眠不足，可能与压力有关」就毁了。",
      schemaHint: "{\"restingHr\":62,\"weekNote\":\"干巴巴一句话\",\"week\":[{\"day\":\"周一\",\"date\":\"8月24日\",\"sleepStart\":\"01:20\",\"sleepEnd\":\"07:05\",\"hours\":5.8,\"steps\":4200}]}",
      maxTokens: 2200
    },
    clipboard: {
      instruction: "推演「" + char.name + "」手机剪贴板里最近躺着的东西（5-7 条）。每条给 text（复制的原文）、from（从哪个 app 复制的）、time、sent（true=后来发出去了；false=复制了但一直没发）。\n**必须至少有一条 sent=false，而且是他打给某个具体的人、却始终没发出去的话。**这是「差一点就说了」的物证，是这个 app 唯一重要的东西。它不必长，可以只有半句，可以很难看、很没出息、说到一半停住。\n其余的可以很杂很无聊：验证码、快递单号、店铺地址、一个人名、一句歌词、一个链接。别每条都深情。" + relHint,
      schemaHint: "{\"items\":[{\"text\":\"复制的原文\",\"from\":\"微信\",\"time\":\"昨天 02:11\",\"sent\":false}]}",
      maxTokens: 2400
    },
    calendar: {
      instruction: "推演「" + char.name + "」日历和提醒事项里的东西（6-9 条），前后两周。每条给 title、when（如「9月2日 14:00」或「每周三」）、kind（事件 或 提醒）、done（true/false）、postponed（往后推过几次，整数，多数是 0）、note（可留空）。\n**推迟次数是这个 app 的重点**：一件推了四次的小事，比四件按时完成的大事更能说明这个人。至少有一条 postponed 在 3 以上，而且它应该是件很小、很容易做完、但他就是一直不做的事。\n三种都要有：他给自己设的、和别人约好的、以及一直没去做的。" + relHint,
      schemaHint: "{\"items\":[{\"title\":\"事情\",\"when\":\"9月2日 14:00\",\"kind\":\"提醒\",\"done\":false,\"postponed\":0,\"note\":\"可空\"}]}",
      maxTokens: 2400
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
  const spec = S[key] || {
    instruction: "推演内容",
    schemaHint: "{}"
  };
  // 取材层 + 时间窗 + 不许复读：三样都拼在 instruction 上。
  // 拼在这里而不是各 app 的 instruction 里，是为了【四处一样喂】——
  // 新加一个 app 时不必记得手动补，漏不掉（.claude/rules/four-surfaces-same-context.md）。
  const angle = PHONE_ANGLE[key] ? "\n\n" + PHONE_ANGLE[key] : "";
  return { ...spec, instruction: spec.instruction + angle + phoneAvoidBlock(avoidLines) };
}
