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
    const day = (chat || []).filter(m => m && !m.recalled && m.content && (m.role === "user" || m.role === "assistant")
      && (!m.kind || m.kind === "voice") && Number(m.ts) >= a && Number(m.ts) < b);
    // 你一句、TA一句，各挑那天最有分量的两句（另一个窗口 2026-10-03 的建议）：
    //   「分量」先粗认成【长度】——寒暄短、真说事的长。挑完按时间排回去，读起来还是那天的顺序。
    const top = role => day.filter(m => m.role === role).slice().sort((x, y) => String(y.content).length - String(x.content).length).slice(0, 2);
    const said = top("user").concat(top("assistant")).sort((x, y) => x.ts - y.ts)
      .map(m => (m.role === "user" ? uName : charName) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 70));
    // 那天还发生了什么（不是话，是事）：约会那张卡、刻进唱片的歌、写的情书
    const extra = (chat || []).filter(m => m && Number(m.ts) >= a && Number(m.ts) < b).map(m =>
      m.kind === "datememory" ? "那天你们见了面" + (m.place ? "，在" + (m.place.name || m.place) : "") + "。"
      : m.kind === "carved" ? "那天刻进唱片：" + ((m.song && (m.song.title || m.song)) || m.content || "一首歌") + "。"
      : m.kind === "loveletter" ? "那天 " + charName + " 写了一封情书。" : null).filter(Boolean).slice(0, 2);
    const lines = extra.concat(said);
    return lines.length ? { kind: said.length ? "chat" : "event", lines } : { kind: "none", lines: [] };
  }
  const hasTrace = (charId, ts, lib, chat) => whatHappened(charId, "", "", ts, lib, chat).kind !== "none";
  // 那天聊天里的照片（她 2026-10-03 点的第 1 条）：TA的自拍/合照优先，其次她发的照片。拿来当这张时刻卡的底图。
  function dayImage(ts, chat) {
    const a = startOf(ts), b = a + DAY;
    const day = (chat || []).filter(m => m && !m.recalled && Number(m.ts) >= a && Number(m.ts) < b);
    const shot = day.find(m => (m.kind === "selfie" || m.kind === "duo") && m.imgKey);
    if (shot) return { imgKey: shot.imgKey };
    const pic = day.find(m => m.kind === "photo" && m.imageRef);
    return pic ? { ref: pic.imageRef } : null;
  }

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
    const fromYear = firstTs ? new Date(firstTs).getFullYear() : new Date(now).getFullYear();
    const thisYear = new Date(now).getFullYear();
    const bdays = [[monthDay(c.birthday), (c.remark || c.name) + " 的生日"], [monthDay(ctx.profile && ctx.profile.birthday), "你的生日"]];
    for (let y = fromYear; y <= thisYear; y++) {
      bdays.forEach(([md, title]) => { if (md) { const ts = new Date(y, md.mo - 1, md.d).getTime(); if (!firstTs || ts >= startOf(firstTs)) add(ts, title, "bday", true); } });
      HOLIDAYS.forEach(([mo, d, name]) => add(new Date(y, mo - 1, d).getTime(), name, "fest", false));
    }
    // ⚠️「第一次」和「在一起第 N 天」不在这儿立（她 2026-10-03：「第一次就留给情侣空间不然重复了也无聊」）——
    //   情侣空间那本「第一次们」(js/couple-firsts.js) 已经从同一批记录里推这些，这里再立一份就是两套各认各的。
    //   卡面和倒计时照旧认得在一起的日子（那是「往前看」，不是再摆一遍）。
    // 她自己收进来的（聊天长按「收进时刻」）：机器认不出的心动瞬间，由她来挑。一条一张，不跟别的并
    const pins = ((ctx.pins || {})[c.id]) || [];
    // 同一天撞了好几个（生日正好是在一起一周年）就并成一张
    const byDay = {};
    out.forEach(m => { const k = dayKey(m.ts); if (byDay[k]) { if (byDay[k].title.indexOf(m.title) < 0) byDay[k].title += " · " + m.title; } else byDay[k] = Object.assign({}, m); });
    const dated = Object.values(byDay).map(m => Object.assign(m, { what: whatHappened(c.id, c.remark || c.name, ctx.uName, m.ts, lib, chat), img: dayImage(m.ts, chat) }));
    // 收进来的有三种：一句（旧）、一段（多选/首尾圈进来的，lines）、她自己开的卡（manual，没有说话人）。
    //   一段有了 summary 就先给 summary，原话留着能翻回去看（raw）。
    const speaker = r => r.role === "user" ? ctx.uName : r.role === "manual" ? "" : (r.name || c.remark || c.name);
    const lineOf = r => { const who = speaker(r); return (who ? who + "：" : "") + String(r.text || "").replace(/\s+/g, " ").slice(0, 160); };
    const pinned = pins.filter(p => p && p.ts).map(p => {
      const raw = Array.isArray(p.lines) && p.lines.length ? p.lines.map(lineOf) : [lineOf(p)];
      return { key: "pin_" + p.id, pinId: p.id, ts: Number(p.ts), title: p.title || "收着的一刻", kind: p.manual ? "manual" : p.byChar ? "kept" : "pin",
        what: { kind: p.summary ? "summary" : "pin", lines: p.summary ? [p.summary] : raw.slice(0, 40) }, raw, summary: p.summary || "",
        img: p.imgKey ? { imgKey: p.imgKey } : p.imageRef ? { ref: p.imageRef } : dayImage(p.ts, chat) };
    });
    // 日历里的世界事件（她 2026-10-03）：已经过去的、而且那天你们真有来往的，才算你们俩的时刻
    const world = [];
    Object.keys((ctx.calendar && ctx.calendar.world) || {}).forEach(k => {
      const a = String(k).split("-").map(Number); if (a.length < 3 || !a[0]) return;
      const ts = new Date(a[0], a[1] - 1, a[2]).getTime();
      if (ts > today || !hasTrace(c.id, ts, lib, chat)) return;
      const evs = (ctx.calendar.world[k] || []).filter(e => e && e.title);
      if (!evs.length) return;
      world.push({ key: "world_" + dayKey(ts), ts, title: evs.map(e => e.title).slice(0, 2).join(" · "), kind: "world",
        what: whatHappened(c.id, c.remark || c.name, ctx.uName, ts, lib, chat), img: dayImage(ts, chat) });
    });
    return dated.concat(pinned, world).sort((x, y) => y.ts - x.ts);
  }

  // ── 界面 ───────────────────────────────────────────────────
  const loadCovers = () => { try { return (typeof loadJSON === "function" ? loadJSON(COVER_KEY, {}) : {}) || {}; } catch (e) { return {}; } };
  const KIND_ZH = { meet: "认识", us: "我们", bday: "生日", fest: "节日", first: "第一次", pin: "收着的", kept: "TA 存的", manual: "我开的", world: "那天的世界" };
  // 时刻卡的底图：那天的照片（自拍在 IDB 图库里，用 useIdbImgUrl 取；她发的照片是 iv_ 门牌）
  function MomentArt({ img }) {
    const idbUrl = typeof useIdbImgUrl === "function" ? useIdbImgUrl(img && img.imgKey) : null;
    const src = img && img.imgKey ? idbUrl : (img && img.ref ? (typeof resolveImg === "function" ? resolveImg(img.ref) : img.ref) : null);
    return src ? h("img", { src, alt: "", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.62)" } }) : null;
  }
  // 外壳铺纸：它是一本按日子贴卡的相册（last-flat-shells：不许拿 t.bg 当外壳）
  const shell = t => (typeof pageSkin === "function" ? pageSkin("paper", t) : { background: t.bg2 });

  // 往前看：接下来 60 天里最近的一个日子（认识/在一起的整数天和周年、两个人的生日）。
  //   卡面上挂倒计时；也递给聊天那头，让TA自己决定记不记得、怎么表示。
  function upcoming(c, ctx, horizon) {
    const now = startOf(ctx.now || Date.now()), H = (horizon || 60) * DAY, chat = (ctx.chats || {})[c.id] || [];
    const first = [...chat.map(m => Number(m && m.ts) || 0), ...(ctx.lib || []).filter(e => e && (e.charIds || []).indexOf(c.id) >= 0).map(e => Number(e.ts) || 0)].filter(x => x > 0).sort((x, y) => x - y)[0];
    const cands = [];
    const marks = (base, label) => {
      if (!base) return; const b = startOf(base);
      DAY_MARKS.filter(n => n > 1).forEach(n => cands.push({ ts: b + (n - 1) * DAY, title: label + "第 " + n + " 天" }));
      for (let y = 1; y < 50; y++) { const d = new Date(b); d.setFullYear(d.getFullYear() + y); cands.push({ ts: d.getTime(), title: label + " " + y + " 周年" }); if (d.getTime() > now + H) break; }
    };
    marks(first, "认识");
    const cp = (ctx.couples || {})[c.id];
    if (cp && cp.status === "together" && cp.since) marks(cp.since, "在一起");
    const y0 = new Date(now).getFullYear();
    [[monthDay(c.birthday), (c.remark || c.name) + " 的生日"], [monthDay(ctx.profile && ctx.profile.birthday), "你的生日"]].forEach(([md, t]) => {
      if (md) [y0, y0 + 1].forEach(y => cands.push({ ts: new Date(y, md.mo - 1, md.d).getTime(), title: t }));
    });
    const next = cands.filter(x => x.ts >= now && x.ts <= now + H).sort((x, y) => x.ts - y.ts)[0];
    return next ? Object.assign(next, { days: Math.round((next.ts - now) / DAY) }) : null;
  }
  const upLine = u => u ? (u.days === 0 ? "今天 · " + u.title : "还有 " + u.days + " 天 · " + u.title) : "";

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
    const [notes, setNotes] = useState(() => { try { return (typeof loadJSON === "function" ? loadJSON("x_shikeNotes", {}) : {}) || {}; } catch (e) { return {}; } });
    const [saying, setSaying] = useState("");
    // 每张时刻卡自己的图（她 2026-10-03 点的第 3、4 条）：画一张 / 自己贴一张。{ charId: { momentKey: iv_ } }
    const [arts, setArts] = useState(() => { try { return (typeof loadJSON === "function" ? loadJSON("x_shikeArt", {}) : {}) || {}; } catch (e) { return {}; } });
    const [drawing, setDrawing] = useState("");
    const fileRef = React.useRef(null), pickFor = React.useRef(null);
    const setArt = (cid, key, v) => { const n = Object.assign({}, arts); n[cid] = Object.assign({}, n[cid] || {}); if (v) n[cid][key] = v; else delete n[cid][key]; setArts(n); try { saveJSON("x_shikeArt", n); } catch (e) {} };
    const draw = async m => {
      if (drawing || !props.onDrawMoment || !cur) return;
      setDrawing(m.key);
      try { const k = await props.onDrawMoment(cur, m); if (k) setArt(cur.id, m.key, k); } finally { setDrawing(""); }
    };
    const onFile = async e => {
      const f = e.target.files && e.target.files[0], m = pickFor.current; e.target.value = "";
      if (!f || !m || !cur) return;
      try {
        const data = typeof resizeImageFile === "function" ? await resizeImageFile(f, 1400, 0.9) : null;
        const k = data && typeof imgToVault === "function" ? await imgToVault(data) : data;
        if (k) setArt(cur.id, m.key, k);
      } catch (err) { props.toast && props.toast("没贴上：" + String((err && err.message) || err).slice(0, 80)); }
    };
    const [idx, setIdx] = useState(0);
    // 收着的那些在这儿改（总结、删、自己开一张）后要重算，pinTick 就是那一下
    const [pinTick, setPinTick] = useState(0);
    const [rawOpen, setRawOpen] = useState({});
    const [summing, setSumming] = useState("");
    const [creating, setCreating] = useState(null);
    const ctx = { chats: props.chats, lib: props.memLib, couples: props.couples, profile: props.profile, uName, offlines: props.offlines, calendar: props.calendar,
      pins: (typeof loadJSON === "function" ? loadJSON("x_shikePins", {}) : {}) || {} };
    const editPins = (cid, fn) => { const all = (typeof loadJSON === "function" ? loadJSON("x_shikePins", {}) : {}) || {}; all[cid] = fn(all[cid] || []); try { saveJSON("x_shikePins", all); } catch (e) {} setPinTick(x => x + 1); };
    const all = useMemo(() => {
      const m = {}; chars.forEach(c => { m[c.id] = momentsFor(c, ctx); }); return m;
      // eslint-disable-next-line
    }, [chars.length, props.chats, props.memLib, props.couples, props.calendar, pinTick]);
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
    const recall = async m => {
      if (saying || !props.onRecall || !cur) return;
      setSaying(m.key);
      try {
        const txt = await props.onRecall(cur, m);
        if (txt) { const n = Object.assign({}, notes); n[cur.id] = Object.assign({}, n[cur.id] || {}, { [m.key]: txt }); setNotes(n); try { saveJSON("x_shikeNotes", n); } catch (e) {} }
      } finally { setSaying(""); }
    };
    const summarize = async m => {
      if (summing || !props.onSummarizePin || !cur) return;
      setSumming(m.key);
      try { const txt = await props.onSummarizePin(cur, m); if (txt) editPins(cur.id, list => list.map(p => p.id === m.pinId ? Object.assign({}, p, { summary: txt }) : p)); }
      finally { setSumming(""); }
    };
    const dropPin = m => {
      const go = () => editPins(cur.id, list => list.filter(p => p.id !== m.pinId));
      if (typeof requestAppConfirm === "function") requestAppConfirm("删掉这张时刻？", "只删这张卡，聊天记录不动。", go, "删掉"); else go();
    };
    const saveCreate = () => {
      const f = creating || {}, a = String(f.date || "").split("-").map(Number);
      if (!cur || !a[0] || !String(f.title || "").trim()) { props.toast && props.toast("写个日子和名字"); return; }
      const ts = new Date(a[0], a[1] - 1, a[2], 12).getTime();
      editPins(cur.id, list => [{ id: "pin_" + Date.now(), ts, title: String(f.title).trim().slice(0, 30), manual: true, role: "manual",
        lines: String(f.text || "").trim() ? [{ role: "manual", text: String(f.text).trim().slice(0, 2000) }] : [] }].concat(list));
      setCreating(null); setMIdx(0);
    };
    const chip = dim => ({ fontFamily: F_BODY, fontSize: 11.5, color: "#fff", background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 999, padding: "6px 12px", opacity: dim ? .5 : 1 });
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
    // 自己开一张（她 2026-10-03）：挑个日子、起个名、写几句。按日子排进去——插在两张中间，后面的序号就跟着变
    if (cur && creating) {
      const inSt = { width: "100%", outline: "none", padding: "10px 12px", borderRadius: 10, fontFamily: F_BODY, fontSize: 14, background: t.bg2, color: t.ink, border: "1px solid " + t.line };
      const set = k => e => { const v = e.target.value; setCreating(o => Object.assign({}, o, { [k]: v })); };
      return h("div", { className: "h-full flex flex-col", "data-wk": "shikecreate", style: shell(t) },
        h(Head, { zh: "开一张时刻", onBack: () => setCreating(null), bg: "transparent" }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "12px 16px calc(24px + env(safe-area-inset-bottom))" } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, marginBottom: 6 } }, "哪一天"),
          h("input", { type: "date", value: creating.date || "", onChange: set("date"), style: inSt }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, margin: "14px 0 6px" } }, "叫它什么"),
          h("input", { value: creating.title || "", onChange: set("title"), maxLength: 30, placeholder: "比如「一起看了第一场雪」", style: inSt }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: t.fog, margin: "14px 0 6px" } }, "那天发生了什么（可以不写）"),
          h("textarea", { value: creating.text || "", onChange: set("text"), rows: 6, style: Object.assign({}, inSt, { resize: "vertical", lineHeight: 1.6 }) }),
          h("button", { onClick: saveCreate, className: "w-full active:opacity-70", style: { marginTop: 18, padding: "12px 0", borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: 15, border: "none" } }, "放进时刻")));
    }
    if (cur) {
      const list = all[cur.id] || [];
      const mcard = (m, i) => {
        const d = new Date(m.ts);
        return h("div", { key: m.key, "data-wk": "shikeitem", "data-kind": m.kind, className: "shrink-0",
          style: { position: "relative", height: "100%", width: "min(80vw, 400px)", borderRadius: 24, overflow: "hidden", scrollSnapAlign: "center",
            background: cur.color || t.ink, boxShadow: "0 16px 36px rgba(30,22,14,.26)", transform: i === mIdx ? "none" : "scale(.95)", transition: "transform .25s" } },
          art(cur, { filter: "blur(2px) brightness(.55)", transform: "scale(1.06)" }),
          ((arts[cur.id] || {})[m.key] || m.img) ? h(MomentArt, { img: (arts[cur.id] || {})[m.key] ? { ref: arts[cur.id][m.key] } : m.img }) : null,
          h("div", { style: { position: "absolute", inset: 10, borderRadius: 16, border: "1px solid rgba(255,255,255,.45)", pointerEvents: "none" } }),
          h("div", { style: { position: "absolute", inset: 0, padding: "34px 28px 30px", display: "flex", flexDirection: "column", color: "#fff", textAlign: "left" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,.72)" } }, KIND_ZH[m.kind] + " · 第 " + (list.length - i) + " 个时刻"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 44, lineHeight: 1.05, marginTop: 14 } }, (d.getMonth() + 1) + "." + d.getDate()),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 4 } }, d.getFullYear() + " 年"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.3, marginTop: 18 } }, m.title),
            h("div", { className: "flex-1 min-h-0", style: { marginTop: 22, overflowY: "auto", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)",
              borderRadius: 14, padding: "14px 16px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 2, color: "rgba(255,255,255,.65)", marginBottom: 8 } },
                rawOpen[m.key] ? "原话" : m.what.kind === "mem" ? "那天记下的事" : m.what.kind === "chat" ? "那天你们说的话" : m.what.kind === "summary" ? "那一段" : m.what.kind === "pin" ? "收着的原话" : "那一天"),
              ((rawOpen[m.key] && m.raw) ? m.raw : m.what.lines).length
                ? ((rawOpen[m.key] && m.raw) ? m.raw : m.what.lines).map((x, k) => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, color: "rgba(255,255,255,.95)", marginBottom: 6, whiteSpace: "pre-wrap" } }, x))
                : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: "rgba(255,255,255,.7)" } }, "那天没留下记录。"),
              // 「让 TA 说说」（她 2026-10-03 点的第 5 条）：TA用自己的口气回忆这一天，点了才调一次
              (notes[cur.id] || {})[m.key] ? h("div", { "data-wk": "shikesay", style: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(255,255,255,.3)" } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 2, color: "rgba(255,255,255,.65)", marginBottom: 6 } }, (cur.remark || cur.name) + " 说"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, color: "#fff", whiteSpace: "pre-wrap" } }, (notes[cur.id] || {})[m.key])) : null,
              props.onRecall ? h("button", { onClick: () => recall(m), disabled: !!saying, className: "active:opacity-70",
                style: { marginTop: 12, fontFamily: F_BODY, fontSize: 12, color: "#fff", background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "7px 14px", opacity: saying && saying !== m.key ? .5 : 1 } },
                saying === m.key ? "TA 在想…" : ((notes[cur.id] || {})[m.key] ? "再让 TA 说说" : "让 TA 说说")) : null),
            // 换这张卡的图：画一张（走生图，一次一张额度）／自己贴一张／拿掉换回当天照片或封面
            h("div", { className: "flex", style: { gap: 8, marginTop: 12, flexWrap: "wrap" } },
              // 收进来的那一长段：总结成一段（调一次），总结过的能翻回原话；收进来的和自己开的能删
              m.pinId && m.raw && m.raw.length > 3 && !m.summary && props.onSummarizePin ? h("button", { onClick: () => summarize(m), disabled: !!summing, className: "active:opacity-70", style: chip(summing && summing !== m.key) },
                summing === m.key ? "正在总结…" : "总结成一段") : null,
              m.summary ? h("button", { onClick: () => setRawOpen(o => Object.assign({}, o, { [m.key]: !o[m.key] })), className: "active:opacity-70", style: chip(false) },
                rawOpen[m.key] ? "看总结" : "看原话") : null,
              m.pinId ? h("button", { onClick: () => dropPin(m), className: "active:opacity-70", style: chip(false) }, "删掉这张") : null,
              // 发给 TA（她 2026-10-03 点的第 1 条）：卡片进聊天，TA 接着跟你聊那天
              props.onSendMoment ? h("button", { onClick: () => props.onSendMoment(cur, m), className: "active:opacity-70", style: chip(false) }, "发给 TA") : null,
              props.onDrawMoment ? h("button", { onClick: () => draw(m), disabled: !!drawing, className: "active:opacity-70", style: chip(drawing && drawing !== m.key) },
                drawing === m.key ? "正在画…" : "画一张") : null,
              h("button", { onClick: () => { pickFor.current = m; fileRef.current && fileRef.current.click(); }, className: "active:opacity-70", style: chip(false) }, "贴一张"),
              (arts[cur.id] || {})[m.key] ? h("button", { onClick: () => setArt(cur.id, m.key, null), className: "active:opacity-70", style: chip(false) }, "拿掉") : null)));
      };
      const onMScroll = e => {
        const el = e.currentTarget, w = el.firstChild ? el.firstChild.getBoundingClientRect().width + 14 : el.clientWidth;
        const k = Math.round(el.scrollLeft / Math.max(1, w));
        if (k !== mIdx) setMIdx(Math.max(0, Math.min(list.length - 1, k)));
      };
      return h("div", { className: "h-full flex flex-col", "data-wk": "shikedetail", style: shell(t) },
        h("input", { ref: fileRef, type: "file", accept: "image/*", onChange: onFile, style: { display: "none" } }),
        h(Head, { zh: cur.remark || cur.name, onBack: () => { setOpenId(null); setMIdx(0); }, bg: "transparent" }),
        h("div", { className: "shrink-0 flex items-center justify-center", style: { gap: 10, padding: "4px 16px 2px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, [daysLine(cur, ctx), upLine(upcoming(cur, ctx))].filter(Boolean).join(" · ")),
          props.onGenCover ? h("button", { onClick: () => gen(cur), disabled: !!busy, className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 11.5, color: t.bg2, background: t.ink, borderRadius: 999, padding: "6px 12px", opacity: busy ? .5 : 1 } },
            busy === cur.id ? "正在画…" : (covers[cur.id] ? "重画封面" : "生成封面")) : null,
          covers[cur.id] ? h("button", { onClick: () => setCover(cur.id, null), className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, border: "1px solid " + t.line, borderRadius: 999, padding: "6px 11px", background: "transparent" } }, "用回头像") : null,
          h("button", { onClick: () => setCreating({ date: dayKey(Date.now()), title: "", text: "" }), className: "active:opacity-70",
            style: { fontFamily: F_BODY, fontSize: 11.5, color: t.ink, border: "1px solid " + t.ink, borderRadius: 999, padding: "6px 11px", background: "transparent" } }, "＋ 开一张")),
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
          (function () { const u = upcoming(c, ctx); return u ? h("div", { "data-wk": "shikesoon", "data-today": u.days === 0 ? "1" : "0",
            style: { display: "inline-block", fontFamily: F_BODY, fontSize: 12, color: u.days === 0 ? "#3a2a1a" : "#fff", background: u.days === 0 ? "#f6d58a" : "rgba(255,255,255,.18)",
              border: "1px solid rgba(255,255,255,.35)", borderRadius: 999, padding: "4px 11px", marginTop: 10 } }, upLine(u)) : null; })(),
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

  // TA 偶尔自己想起一张旧的（她 2026-10-03 点的第 2 条）：大约五天一次、每人错开，挑两周以前的一张。
  //   同一天里挑的永远是同一张（按日子算，不随机），所以这一天聊几轮都是同一件事，不会一轮一个回忆。
  //   只是递一句「你们有过这么一天」——聊着自然想起就提，不想提就不提，零调用。
  const hashOf = str => { let x = 0; for (const ch of String(str)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };
  function oldMomentNote(c, ctx) {
    const now = ctx.now || Date.now(), d = Math.floor(startOf(now) / DAY);
    if ((d + hashOf(c.id)) % 5 !== 0) return "";
    const pins = ctx.pins || (typeof loadJSON === "function" ? loadJSON("x_shikePins", {}) : {}) || {};
    const pool = momentsFor(c, Object.assign({}, ctx, { pins, uName: ctx.uName || "她" })).filter(m => m.ts < startOf(now) - 14 * DAY && (m.what.lines || []).length);
    if (!pool.length) return "";
    const m = pool[hashOf(c.id + ":" + d) % pool.length], dd = new Date(m.ts);
    return "你们的相册里有一张「" + m.title + "」（" + dd.getFullYear() + " 年 " + (dd.getMonth() + 1) + " 月 " + dd.getDate() + " 日）：" + m.what.lines.slice(0, 2).join(" / ").slice(0, 160)
      + "。今天你偶尔会想起它——聊着自然想起就提一句，不合时宜就不提，别硬拐过去。";
  }

  // 去年今天（她 2026-10-03 点的第 5 条）：今天跟某张旧时刻同月同日、年份更早 → 主屏冒一张小卡。不花钱。
  //   一个人挑一张最近的那一年；几个人都有就挑第一个（主屏只冒一张，不堆）。
  function onThisDay(chars, ctx) {
    const now = new Date(ctx.now || Date.now()), mo = now.getMonth(), da = now.getDate(), yr = now.getFullYear();
    const pins = ctx.pins || (typeof loadJSON === "function" ? loadJSON("x_shikePins", {}) : {}) || {};
    for (const c of (chars || [])) {
      if (!c || c.npc) continue;
      const hit = momentsFor(c, Object.assign({}, ctx, { pins })).find(m => { const d = new Date(m.ts); return d.getMonth() === mo && d.getDate() === da && d.getFullYear() < yr; });
      if (hit) return { char: c, m: hit, years: yr - new Date(hit.ts).getFullYear() };
    }
    return null;
  }
  function ShikeOTD({ item, onOpen, onClose }) {
    const t = useTheme();
    if (!item) return null;
    const c = item.char, src = typeof resolveImg === "function" ? resolveImg(c.avatarImage || c.chatAvatar || "") : "";
    return h("div", { "data-wk": "shikeotd", style: { position: "absolute", left: 16, right: 16, bottom: "calc(118px + env(safe-area-inset-bottom))", zIndex: 40,
        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 18, background: "rgba(255,252,246,.94)", border: "1px solid " + t.line,
        boxShadow: "0 10px 30px rgba(40,30,20,.22)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } },
      h("button", { onClick: onOpen, className: "active:opacity-80 flex items-center", style: { flex: 1, minWidth: 0, gap: 12, background: "transparent", border: "none", padding: 0, textAlign: "left" } },
        src ? h("img", { src, alt: "", style: { width: 46, height: 46, borderRadius: 12, objectFit: "cover", flexShrink: 0 } }) : null,
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 2, color: t.fog } }, (item.years === 1 ? "一年前" : item.years + " 年前") + "的今天 · " + (c.remark || c.name)),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "「" + item.m.title + "」"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.sub, marginTop: 1 } }, "去时刻里看看 ›"))),
      h("button", { onClick: onClose, className: "active:opacity-60", "aria-label": "收起", style: { fontFamily: F_BODY, fontSize: 18, color: t.fog, background: "transparent", border: "none", padding: "4px 6px" } }, "×"));
  }
  g.ShikeOTD = ShikeOTD;

  g.ShikeApp = ShikeApp;
  g.ShikeKit = { onThisDay, momentsFor, monthDay, whatHappened, dayImage, upcoming, HOLIDAYS,
    // 聊天那头用：三天内（含今天）有日子就给一句，没有就空——零调用，只是让TA知道
    chatNote: (c, ctx) => {
      const u = upcoming(c, ctx, 3);
      if (u) return (u.days === 0 ? "今天是你们的「" + u.title + "」。" : "再过 " + u.days + " 天是你们的「" + u.title + "」。") + "记不记得、要不要表示、怎么表示，全看你这个人；她没提的话，你也可以不提。";
      return oldMomentNote(c, ctx);
    } };
})();
