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

  // 卡面底下那一行：认识几天、在一起几天（跟时刻同一份算法，不另算一套）
  function daysLine(c, ctx) {
    const now = startOf(ctx.now || Date.now()), chat = (ctx.chats || {})[c.id] || [];
    const first = [...chat.map(m => Number(m && m.ts) || 0), ...(ctx.lib || []).filter(e => e && (e.charIds || []).indexOf(c.id) >= 0).map(e => Number(e.ts) || 0)]
      .filter(x => x > 0).sort((x, y) => x - y)[0];
    const cp = (ctx.couples || {})[c.id];
    const bits = [];
    if (first) bits.push("认识 " + (Math.round((now - startOf(first)) / DAY) + 1) + " 天");
    if (cp && cp.status === "together" && cp.since) bits.push("在一起 " + (Math.round((now - startOf(cp.since)) / DAY) + 1) + " 天");
    return bits.join(" · ");
  }

  // 两层（她 2026-10-03：「cg卡再高一点差不多整个屏幕高，里面的内容再点进去才有那些」）：
  //   外面一层只有一张张几乎整屏高的卡，横着滑；点一张才进去看这个人的时刻和封面按钮。
  function ShikeApp(props) {
    const t = useTheme();
    const chars = (props.characters || []).filter(c => c && !c.npc);
    const uName = (props.profile && props.profile.name) || "你";
    const [openId, setOpenId] = useState(null);
    const [covers, setCovers] = useState(loadCovers);
    const [busy, setBusy] = useState("");
    const [mIdx, setMIdx] = useState(0);
    const [idx, setIdx] = useState(0);
    const ctx = { chats: props.chats, lib: props.memLib, couples: props.couples, profile: props.profile, uName };
    const all = useMemo(() => {
      const m = {}; chars.forEach(c => { m[c.id] = momentsFor(c, ctx); }); return m;
      // eslint-disable-next-line
    }, [chars.length, props.chats, props.memLib, props.couples]);
    const cur = chars.find(c => c.id === openId);
    // 卡面默认用【人格档案馆那张】（她 2026-10-03：「能不能选人格档案馆的头像而不是聊天头像」）；
    //   TA在聊天里自己换的那张(chatAvatar)只在档案那张空着时兜底。
    const coverOf = c => covers[c.id] || c.avatarImage || c.chatAvatar || "";
    const srcOf = c => (typeof resolveImg === "function" ? resolveImg(coverOf(c)) : coverOf(c));
    const setCover = (id, v) => { const n = Object.assign({}, covers); if (v) n[id] = v; else delete n[id]; setCovers(n); try { saveJSON(COVER_KEY, n); } catch (e) {} };
    const gen = async c => {
      if (busy || !props.onGenCover) return;
      setBusy(c.id);
      try { const key = await props.onGenCover(c); if (key) setCover(c.id, key); }
      finally { setBusy(""); }
    };
    const art = (c, extra) => {
      const src = srcOf(c);
      return src ? h("img", { src, alt: "", style: Object.assign({ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }, extra || {}) })
        : h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(160deg, " + (c.color || t.tint) + ", " + t.ink + ")", fontFamily: F_DISPLAY, fontSize: 96, color: "rgba(255,255,255,.85)" } }, (c.name || "?").slice(0, 1));
    };

    if (!chars.length) return h("div", { className: "h-full flex flex-col", style: shell(t) },
      h(Head, { zh: "时刻", onBack: props.onBack, bg: "transparent" }),
      h(Empty, { text: "还没有角色", sub: "先去人格档案馆录入" }));

    // ── 里层：一个人的时刻，也做成横着滑的展览（她 2026-10-03：「里面的时刻也做成滑动的展览」）──
    //   一个时刻一张高卡：上半截是日子和名目，下半截是那天发生了什么。底图用这个人的封面压暗，一张张像展墙上的画。
    if (cur) {
      const list = all[cur.id] || [];
      const mcard = (m, i) => {
        const d = new Date(m.ts);
        return h("div", { key: m.key, "data-wk": "shikeitem", "data-kind": m.kind, className: "shrink-0",
          style: { position: "relative", height: "100%", width: "min(80vw, 400px)", borderRadius: 24, overflow: "hidden", scrollSnapAlign: "center",
            background: cur.color || t.ink, boxShadow: "0 16px 36px rgba(30,22,14,.26)", transform: i === mIdx ? "none" : "scale(.95)", transition: "transform .25s" } },
          art(cur, { filter: "blur(2px) brightness(.55)", transform: "scale(1.06)" }),
          h("div", { style: { position: "absolute", inset: 10, borderRadius: 16, border: "1px solid rgba(255,255,255,.45)", pointerEvents: "none" } }),
          h("div", { style: { position: "absolute", inset: 0, padding: "34px 28px 30px", display: "flex", flexDirection: "column", color: "#fff", textAlign: "left" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,.72)" } }, KIND_ZH[m.kind] + " · 第 " + (list.length - i) + " 个时刻"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 44, lineHeight: 1.05, marginTop: 14 } }, (d.getMonth() + 1) + "." + d.getDate()),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 4 } }, d.getFullYear() + " 年"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.3, marginTop: 18 } }, m.title),
            h("div", { className: "flex-1 min-h-0", style: { marginTop: 22, overflowY: "auto", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 2, color: "rgba(255,255,255,.65)", marginBottom: 8 } },
                m.what.kind === "mem" ? "那天记下的事" : m.what.kind === "chat" ? "那天你们说的话" : "那一天"),
              m.what.lines.length
                ? m.what.lines.map((x, k) => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,.95)", marginBottom: 6 } }, x))
                : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: "rgba(255,255,255,.7)" } }, "那天没留下记录。"))));
      };
      const onMScroll = e => {
        const el = e.currentTarget, w = el.firstChild ? el.firstChild.getBoundingClientRect().width + 14 : el.clientWidth;
        const k = Math.round(el.scrollLeft / Math.max(1, w));
        if (k !== mIdx) setMIdx(Math.max(0, Math.min(list.length - 1, k)));
      };
      return h("div", { className: "h-full flex flex-col", "data-wk": "shikedetail", style: shell(t) },
        h(Head, { zh: cur.remark || cur.name, onBack: () => { setOpenId(null); setMIdx(0); }, bg: "transparent" }),
        h("div", { className: "shrink-0 flex items-center justify-center", style: { gap: 10, padding: "4px 16px 2px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, daysLine(cur, ctx)),
          props.onGenCover ? h("button", { onClick: () => gen(cur), disabled: !!busy, className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 11.5, color: t.bg2, background: t.ink, borderRadius: 999, padding: "6px 12px", opacity: busy ? .5 : 1 } },
            busy === cur.id ? "正在画…" : (covers[cur.id] ? "重画封面" : "生成封面")) : null,
          covers[cur.id] ? h("button", { onClick: () => setCover(cur.id, null), className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 11px", background: "transparent" } }, "用回头像") : null),
        list.length
          ? h("div", { onScroll: onMScroll, className: "flex-1 min-h-0 flex",
              style: { gap: 14, overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
                padding: "12px calc((100vw - min(80vw, 400px)) / 2) 10px" } }, list.map(mcard))
          : h("div", { className: "flex-1", style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: t.fog, textAlign: "center", padding: "60px 30px" } },
              "还没有时刻。认识满 100 天、在一起的日子、生日，还有节日那天你们说过话，都会自己出现在这里。"),
        h("div", { className: "shrink-0 flex justify-center", style: { gap: 6, padding: "4px 0 calc(16px + env(safe-area-inset-bottom))" } },
          list.slice(0, 30).map((m, k) => h("span", { key: m.key, style: { width: k === mIdx ? 16 : 6, height: 6, borderRadius: 999, background: k === mIdx ? t.ink : t.line, transition: "width .2s" } }))));
    }

    // ── 外层：几乎整屏高的 CG 卡，横着滑 ──
    const onScroll = e => {
      const el = e.currentTarget, w = el.firstChild ? el.firstChild.getBoundingClientRect().width + 14 : el.clientWidth;
      const i = Math.round(el.scrollLeft / Math.max(1, w));
      if (i !== idx) setIdx(Math.max(0, Math.min(chars.length - 1, i)));
    };
    const card = (c, i) => {
      const n = (all[c.id] || []).length, line = daysLine(c, ctx);
      return h("button", { key: c.id, "data-wk": "shikecard", "data-on": i === idx ? "1" : "0", onClick: () => setOpenId(c.id),
        className: "active:opacity-95 shrink-0",
        style: { position: "relative", height: "100%", width: "min(80vw, 400px)", borderRadius: 26, overflow: "hidden", scrollSnapAlign: "center", padding: 0,
          border: "none", background: c.color || t.ink, boxShadow: "0 18px 40px rgba(30,22,14,.28)",
          transform: i === idx ? "none" : "scale(.95)", transition: "transform .25s" } },
        art(c),
        // 一圈细白框：像 CG 收藏卡压在框里
        h("div", { style: { position: "absolute", inset: 10, borderRadius: 18, border: "1px solid rgba(255,255,255,.55)", pointerEvents: "none" } }),
        h("div", { style: { position: "absolute", top: 20, right: 22, fontFamily: F_BODY, fontSize: 11, letterSpacing: 1, color: "#fff",
          background: "rgba(0,0,0,.28)", borderRadius: 999, padding: "4px 10px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" } },
          n ? n + " 个时刻" : "还没有时刻"),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "90px 26px 30px", textAlign: "left",
          background: "linear-gradient(transparent, rgba(0,0,0,.25) 30%, rgba(0,0,0,.72))" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,.7)" } }, "第 " + (i + 1) + " 张"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 34, lineHeight: 1.15, color: "#fff", marginTop: 4, textShadow: "0 2px 12px rgba(0,0,0,.35)" } }, c.remark || c.name),
          line ? h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(255,255,255,.88)", marginTop: 8 } }, line) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 14 } }, "点开看我们的时刻 ›")));
    };
    return h("div", { className: "h-full flex flex-col", "data-wk": "shikepage", style: shell(t) },
      h(Head, { zh: "时刻", onBack: props.onBack, bg: "transparent" }),
      h("div", { onScroll, className: "flex-1 min-h-0 flex",
        style: { gap: 14, overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
          padding: "12px calc((100vw - min(80vw, 400px)) / 2) 10px" } }, chars.map(card)),
      // 底下一排小点：第几张
      h("div", { className: "shrink-0 flex justify-center", style: { gap: 6, padding: "4px 0 calc(16px + env(safe-area-inset-bottom))" } },
        chars.map((c, i) => h("span", { key: c.id, style: { width: i === idx ? 16 : 6, height: 6, borderRadius: 999, background: i === idx ? t.ink : t.line, transition: "width .2s" } }))));
  }

  g.ShikeApp = ShikeApp;
  g.ShikeKit = { momentsFor, monthDay, whatHappened, HOLIDAYS };
})();
