// ============================================================
// 时刻（shike）——回头看文件夹里，和周刊、月度印象并排的第三格
// 她 2026-10-03 定的三条：
//   ① 放「回头看」；
//   ② 第一版只认【纪念日和节日】（认识、在一起、生日、几个固定节日），不调模型、不花钱；
//   ③ 横着滑是【选角色】——每人一张 CG 卡摆上去，卡面默认用 TA 的头像，
//      想要就点「生成封面」画一张（这一下才走生图）。
// 每个时刻点开写着那天和谁、做了什么：从记忆库里那天的条目摘，没有就摘那天的聊天原话，
// 都没有就老实说「那天没留下记录」——不编。
// ============================================================
(function () {
  "use strict";
  const g = typeof window !== "undefined" ? window : globalThis;
  const useState = React.useState, useMemo = React.useMemo;
  const COVER_KEY = "x_shikeCover";

  // 图标：一张卡片上一颗星
  g.GShike = p => h(Svg, p,
    h("rect", { x: 5, y: 3, width: 14, height: 18, rx: 2.5 }),
    h("path", { d: "M12 8.2l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" }));

  // ── 日子 ───────────────────────────────────────────────────
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, "0");
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const startOf = ts => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  // 生日只认公历月日（「1997-03-15」「03-15」「3月15日」）；农历的认不出就不立，不瞎换算
  function monthDay(s) {
    const str = String(s || "");
    if (/农历|阴历/.test(str)) return null;
    const m = str.match(/(?:\d{4}\s*[-/.年]\s*)?(\d{1,2})\s*[-/.月]\s*(\d{1,2})/);
    if (!m) return null;
    const mo = Number(m[1]), d = Number(m[2]);
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? { mo, d } : null;
  }
  // 固定的公历节日。⚠️只在那天你们真有来往时才立（节日本身不是你们的事）
  const HOLIDAYS = [[1, 1, "元旦"], [2, 14, "情人节"], [5, 20, "520"], [10, 31, "万圣节"], [12, 24, "平安夜"], [12, 25, "圣诞节"], [12, 31, "跨年夜"]];
  const DAY_MARKS = [1, 100, 200, 520, 1000];

  // ── 那天发生了什么：记忆库优先，其次聊天原话 ────────────────
  function whatHappened(charId, charName, uName, ts, lib, chat) {
    const a = startOf(ts), b = a + DAY;
    const mems = (lib || []).filter(e => e && e.text && !e.archived && Number(e.ts) >= a && Number(e.ts) < b
      && (((e.charIds || []).indexOf(charId) >= 0) || (Array.isArray(e.knownBy) && e.knownBy.indexOf(charId) >= 0)))
      .slice(0, 3).map(e => String(e.text).replace(/\s+/g, " ").slice(0, 90));
    if (mems.length) return { kind: "mem", lines: mems };
    const said = (chat || []).filter(m => m && !m.recalled && m.content && (m.role === "user" || m.role === "assistant")
      && m.kind !== "system" && Number(m.ts) >= a && Number(m.ts) < b)
      .slice(0, 3).map(m => (m.role === "user" ? uName : charName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 60));
    return said.length ? { kind: "chat", lines: said } : { kind: "none", lines: [] };
  }
  const hasTrace = (charId, ts, lib, chat) => whatHappened(charId, "", "", ts, lib, chat).kind !== "none";

  // ── 一个人的全部时刻（只算到今天为止） ─────────────────────
  function momentsFor(c, ctx) {
    const now = ctx.now || Date.now(), today = startOf(now);
    const chat = (ctx.chats || {})[c.id] || [];
    const lib = ctx.lib || [];
    const firstTs = [
      ...chat.map(m => Number(m && m.ts) || 0),
      ...lib.filter(e => e && ((e.charIds || []).indexOf(c.id) >= 0)).map(e => Number(e.ts) || 0)
    ].filter(x => x > 0).sort((x, y) => x - y)[0];
    const out = [];
    const add = (ts, title, kind, always) => {
      if (!ts || startOf(ts) > today) return;
      if (!always && !hasTrace(c.id, ts, lib, chat)) return;
      out.push({ key: kind + "_" + dayKey(ts), ts: startOf(ts), title, kind });
    };
    if (firstTs) {
      const f = startOf(firstTs);
      add(f, "第一次说上话", "meet", true);
      DAY_MARKS.filter(n => n > 1).forEach(n => add(f + (n - 1) * DAY, "认识第 " + n + " 天", "meet", true));
      for (let y = 1; y < 50; y++) { const d = new Date(f); d.setFullYear(d.getFullYear() + y); if (d.getTime() > today) break; add(d.getTime(), "认识 " + y + " 周年", "meet", true); }
    }
    const cp = (ctx.couples || {})[c.id];
    if (cp && cp.status === "together" && cp.since) {
      const s = startOf(cp.since);
      add(s, "在一起了", "us", true);
      DAY_MARKS.filter(n => n > 1).forEach(n => add(s + (n - 1) * DAY, "在一起第 " + n + " 天", "us", true));
      for (let y = 1; y < 50; y++) { const d = new Date(s); d.setFullYear(d.getFullYear() + y); if (d.getTime() > today) break; add(d.getTime(), "在一起 " + y + " 周年", "us", true); }
    }
    const fromYear = firstTs ? new Date(firstTs).getFullYear() : new Date(now).getFullYear();
    const thisYear = new Date(now).getFullYear();
    const bdays = [[monthDay(c.birthday), (c.remark || c.name) + " 的生日"], [monthDay(ctx.profile && ctx.profile.birthday), "你的生日"]];
    for (let y = fromYear; y <= thisYear; y++) {
      bdays.forEach(([md, title]) => { if (md) { const ts = new Date(y, md.mo - 1, md.d).getTime(); if (!firstTs || ts >= startOf(firstTs)) add(ts, title, "bday", true); } });
      HOLIDAYS.forEach(([mo, d, name]) => add(new Date(y, mo - 1, d).getTime(), name, "fest", false));
    }
    // 同一天撞了好几个（生日正好是在一起一周年）就并成一张
    const byDay = {};
    out.forEach(m => { const k = dayKey(m.ts); if (byDay[k]) { if (byDay[k].title.indexOf(m.title) < 0) byDay[k].title += " · " + m.title; } else byDay[k] = Object.assign({}, m); });
    return Object.values(byDay).sort((x, y) => y.ts - x.ts)
      .map(m => Object.assign(m, { what: whatHappened(c.id, c.remark || c.name, ctx.uName, m.ts, lib, chat) }));
  }

  // ── 界面 ───────────────────────────────────────────────────
  const loadCovers = () => { try { return (typeof loadJSON === "function" ? loadJSON(COVER_KEY, {}) : {}) || {}; } catch (e) { return {}; } };
  const KIND_ZH = { meet: "认识", us: "我们", bday: "生日", fest: "节日" };
  // 外壳铺纸：它是一本按日子贴卡的相册（last-flat-shells：不许拿 t.bg 当外壳）
  const shell = t => (typeof pageSkin === "function" ? pageSkin("paper", t) : { background: t.bg2 });

  function ShikeApp(props) {
    const t = useTheme();
    const chars = (props.characters || []).filter(c => c && !c.npc);
    const uName = (props.profile && props.profile.name) || "你";
    const [sel, setSel] = useState(chars[0] ? chars[0].id : null);
    const [covers, setCovers] = useState(loadCovers);
    const [busy, setBusy] = useState("");
    const [openKey, setOpenKey] = useState(null);
    const ctx = { chats: props.chats, lib: props.memLib, couples: props.couples, profile: props.profile, uName };
    const all = useMemo(() => {
      const m = {}; chars.forEach(c => { m[c.id] = momentsFor(c, ctx); }); return m;
      // eslint-disable-next-line
    }, [chars.length, props.chats, props.memLib, props.couples]);
    const cur = chars.find(c => c.id === sel) || chars[0];
    const coverOf = c => covers[c.id] || c.chatAvatar || c.avatarImage || "";
    const setCover = (id, v) => { const n = Object.assign({}, covers); if (v) n[id] = v; else delete n[id]; setCovers(n); try { saveJSON(COVER_KEY, n); } catch (e) {} };
    const gen = async c => {
      if (busy || !props.onGenCover) return;
      setBusy(c.id);
      try { const key = await props.onGenCover(c); if (key) setCover(c.id, key); }
      finally { setBusy(""); }
    };

    if (!chars.length) return h("div", { className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "时刻", onBack: props.onBack, bg: "transparent" }),
      h(Empty, { text: "还没有角色", sub: "先去人格档案馆录入" }));

    // 横着滑的 CG 卡：一人一张
    const card = c => {
      const on = cur && c.id === cur.id;
      const src = typeof resolveImg === "function" ? resolveImg(coverOf(c)) : coverOf(c);
      const n = (all[c.id] || []).length;
      return h("button", { key: c.id, "data-wk": "shikecard", "data-on": on ? "1" : "0", onClick: () => { setSel(c.id); setOpenKey(null); },
        className: "active:opacity-90 shrink-0",
        style: { position: "relative", width: "62vw", maxWidth: 260, aspectRatio: "3 / 4", borderRadius: 18, overflow: "hidden", scrollSnapAlign: "center",
          border: on ? "2px solid " + t.ink : "1px solid " + t.line, background: c.color || t.bg2, boxShadow: on ? "0 10px 26px rgba(40,30,20,.22)" : "0 4px 12px rgba(40,30,20,.08)",
          transform: on ? "none" : "scale(.94)", transition: "transform .2s, box-shadow .2s", padding: 0 } },
        src ? h("img", { src, alt: "", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } })
          : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 64, color: "rgba(255,255,255,.85)" } }, (c.name || "?").slice(0, 1)),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "40px 14px 12px", textAlign: "left", background: "linear-gradient(transparent, rgba(0,0,0,.62))" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: "#fff" } }, c.remark || c.name),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "rgba(255,255,255,.82)", marginTop: 2 } }, n ? n + " 个时刻" : "还没有时刻")));
    };

    const list = cur ? (all[cur.id] || []) : [];
    const row = m => {
      const open = openKey === m.key, d = new Date(m.ts);
      return h("div", { key: m.key, "data-wk": "shikeitem", "data-kind": m.kind, onClick: () => setOpenKey(open ? null : m.key),
        style: { background: t.bg2, border: "1px solid " + t.line, borderRadius: 14, padding: "12px 14px", marginBottom: 10, cursor: "pointer" } },
        h("div", { className: "flex items-baseline justify-between", style: { gap: 10 } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: t.ink } }, m.title),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, whiteSpace: "nowrap" } }, d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate() + " · " + KIND_ZH[m.kind])),
        open ? h("div", { style: { marginTop: 9, paddingTop: 9, borderTop: "1px dashed " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: t.fog, marginBottom: 5 } },
            m.what.kind === "mem" ? "那天记下的事" : m.what.kind === "chat" ? "那天你们说的话" : ""),
          m.what.lines.length
            ? m.what.lines.map((x, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.65, color: t.sub } }, x))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: t.fog } }, "那天没留下记录。")) : null);
    };

    return h("div", { className: "h-full flex flex-col", "data-wk": "shikepage", style: shell(t) },
      h(Head, { zh: "时刻", onBack: props.onBack, bg: "transparent" }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { paddingBottom: "calc(24px + env(safe-area-inset-bottom))" } },
        h("div", { className: "flex", style: { gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", padding: "14px 19vw 10px", WebkitOverflowScrolling: "touch" } }, chars.map(card)),
        cur ? h("div", { className: "flex justify-center", style: { gap: 10, padding: "2px 16px 14px" } },
          props.onGenCover ? h("button", { onClick: () => gen(cur), disabled: !!busy, className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 12, color: t.bg2, background: t.ink, borderRadius: 999, padding: "8px 16px", opacity: busy ? .5 : 1 } },
            busy === cur.id ? "正在画…" : (covers[cur.id] ? "重新生成封面" : "生成封面")) : null,
          covers[cur.id] ? h("button", { onClick: () => setCover(cur.id, null), className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 12, color: t.sub, border: "1px solid " + t.line, borderRadius: 999, padding: "8px 14px", background: "transparent" } }, "用回头像") : null) : null,
        h("div", { style: { padding: "0 16px" } },
          list.length ? list.map(row)
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: t.fog, textAlign: "center", padding: "30px 10px" } },
                "还没有时刻。认识满 100 天、在一起的日子、生日，还有节日那天你们说过话，都会自己出现在这里。"))));
  }

  g.ShikeApp = ShikeApp;
  g.ShikeKit = { momentsFor, monthDay, whatHappened, HOLIDAYS };
})();
