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

  // 「认识」从哪天起算（她 2026-10-03：「认识是按来到秋秋机开始算的，但在一起更早就会出现在一起 105 天、还有 11 天认识 100 天」）：
  //   App 里最早一条聊天/记忆只是「来到这里」那天；在一起的日子早于它，认识至少得从在一起那天算。取两者更早的那个。
  // 她自己定的「认识那天」（她 2026-10-03：「搞个隐蔽的修改键，点数字可以改」）——定了就以它为准，不再推
  const MEET_KEY = "x_shikeMeet";
  const meetOverride = id => { try { const v = (typeof loadJSON === "function" ? loadJSON(MEET_KEY, {}) : {}) || {}; return Number(v[id]) || 0; } catch (e) { return 0; } };
  function meetStart(c, ctx) {
    const own = meetOverride(c.id);
    if (own) return own;
    const chat = (ctx.chats || {})[c.id] || [];
    const seen = [...chat.map(m => Number(m && m.ts) || 0), ...(ctx.lib || []).filter(e => e && (e.charIds || []).indexOf(c.id) >= 0).map(e => Number(e.ts) || 0)].filter(x => x > 0);
    const cp = (ctx.couples || {})[c.id];
    if (cp && cp.status === "together" && Number(cp.since) > 0) seen.push(Number(cp.since));
    return seen.length ? Math.min.apply(null, seen) : 0;
  }
  // ── 一个人的全部时刻（只算到今天为止） ─────────────────────
  function momentsFor(c, ctx) {
    const now = ctx.now || Date.now(), today = startOf(now);
    const chat = (ctx.chats || {})[c.id] || [];
    const lib = ctx.lib || [];
    const firstTs = meetStart(c, ctx);
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
    // 群里的时刻（她 2026-10-03 点的第 8 条）：两种，都同时出现在在场每个人名下——
    //   ① 群里圈一段收进来的（x_shikeGroupPins，记着当时说话的那几位 cids）；
    //   ② 节日那天你和TA都在同一个群里说过话 → 「和『群名』一起过的元旦」。
    const nm = id => { const x = (ctx.allChars || []).find(y => y && y.id === id); return x ? (x.remark || x.name) : ""; };
    const others = cids => (cids || []).filter(id => id !== c.id).map(nm).filter(Boolean);
    const gpins = (ctx.groupPins || []).filter(p => p && p.ts && (p.cids || []).indexOf(c.id) >= 0).map(p => {
      const raw = (p.lines || []).map(r => (r.role === "user" ? ctx.uName : (r.name || "")) + (r.role === "user" || r.name ? "：" : "") + String(r.text || "").replace(/\s+/g, " ").slice(0, 160));
      return { key: "gpin_" + p.id, gpinId: p.id, ts: Number(p.ts), title: p.title || "群里的一刻", kind: "group", with: others(p.cids), group: p.groupName || "",
        what: { kind: p.summary ? "summary" : "pin", lines: p.summary ? [p.summary] : raw.slice(0, 40) }, raw, summary: p.summary || "", img: null };
    });
    const gfest = [];
    (ctx.groups || []).filter(g => g && (g.memberIds || []).indexOf(c.id) >= 0).forEach(g => {
      const gc = (ctx.groupChats || {})[g.id] || [];
      if (!gc.length) return;
      const y0 = new Date(Number(gc[0].ts) || now).getFullYear();
      for (let y = y0; y <= thisYear; y++) HOLIDAYS.forEach(([mo, dd, name]) => {
        const a = new Date(y, mo - 1, dd).getTime(), b = a + DAY;
        if (a > today) return;
        const day = gc.filter(m => m && !m.recalled && m.content && Number(m.ts) >= a && Number(m.ts) < b);
        if (!day.some(m => m.role === "user") || !day.some(m => m.senderId === c.id)) return;
        const said = day.filter(m => m.role === "user" || m.senderId).slice().sort((x, z) => String(z.content).length - String(x.content).length).slice(0, 4)
          .sort((x, z) => x.ts - z.ts).map(m => (m.role === "user" ? ctx.uName : (m.senderName || nm(m.senderId))) + "：" + String(m.content).replace(/\s+/g, " ").slice(0, 70));
        const ids = Array.from(new Set(day.map(m => m.senderId).filter(Boolean)));
        gfest.push({ key: "gfest_" + g.id + "_" + dayKey(a), ts: a, title: "和「" + (g.name || "群") + "」一起过的" + name, kind: "group", with: others(ids), group: g.name || "",
          what: { kind: "chat", lines: said }, img: null });
      });
    });
    return dated.concat(pinned, world, gpins, gfest).sort((x, y) => y.ts - x.ts);
  }

  // ── 界面 ───────────────────────────────────────────────────
  const loadCovers = () => { try { return (typeof loadJSON === "function" ? loadJSON(COVER_KEY, {}) : {}) || {}; } catch (e) { return {}; } };
  const KIND_ZH = { meet: "认识", us: "我们", bday: "生日", fest: "节日", first: "第一次", pin: "收着的", kept: "TA 存的", manual: "我开的", group: "群里", world: "那天的世界" };
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
    const first = meetStart(c, ctx);
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
    const first = meetStart(c, ctx);
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
    const fileRef = React.useRef(null), pickFor = React.useRef(null), mRef = React.useRef(null);
    const [exporting, setExporting] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [actsOpen, setActsOpen] = useState({});
    // 卡也是旧的在左、新的在右（她 2026-10-03：跟刻度一个方向）；一打开就停在最新那张
    React.useEffect(() => {
      if (!openId) return;
      const n = (all[openId] || []).length; if (!n) return;
      const go = () => { const el = mRef.current; if (!el) return; el.scrollLeft = el.scrollWidth; setMIdx(n - 1); };
      const t1 = setTimeout(go, 0); return () => clearTimeout(t1);
    }, [openId]);
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
      groups: props.groups, groupChats: props.groupChats, allChars: props.characters,
      groupPins: (typeof loadJSON === "function" ? loadJSON("x_shikeGroupPins", []) : []) || [],
      pins: (typeof loadJSON === "function" ? loadJSON("x_shikePins", {}) : {}) || {} };
    // 群里收的那些存在一处（x_shikeGroupPins），在场几个人名下都显示同一张——总结、删也是改这一处
    const editGroupPins = fn => { const all = (typeof loadJSON === "function" ? loadJSON("x_shikeGroupPins", []) : []) || []; try { saveJSON("x_shikeGroupPins", fn(all)); } catch (e) {} setPinTick(x => x + 1); };
    const editPins = (cid, fn) => { const all = (typeof loadJSON === "function" ? loadJSON("x_shikePins", {}) : {}) || {}; all[cid] = fn(all[cid] || []); try { saveJSON("x_shikePins", all); } catch (e) {} setPinTick(x => x + 1); };
    const all = useMemo(() => {
      const m = {}; chars.forEach(c => { m[c.id] = momentsFor(c, ctx); }); return m;
      // eslint-disable-next-line
    }, [chars.length, props.chats, props.memLib, props.couples, props.calendar, props.groupChats, pinTick]);
    const cur = chars.find(c => c.id === openId);
    // 卡面默认用【人格档案馆那张】（她 2026-10-03：「能不能选人格档案馆的头像而不是聊天头像」）；
    //   TA在聊天里自己换的那张(chatAvatar)只在档案那张空着时兜底。
    const coverOf = c => covers[c.id] || c.avatarImage || c.chatAvatar || "";
    const srcOf = c => (typeof resolveImg === "function" ? resolveImg(coverOf(c)) : coverOf(c));
    const setCover = (id, v) => { const n = Object.assign({}, covers); if (v) n[id] = v; else delete n[id]; setCovers(n); try { saveJSON(COVER_KEY, n); } catch (e) {} };
    // 点「认识 N 天」那一行就能改认识那天（隐蔽的修改键）。清空＝回到自动推算
    const editMeet = (c, e) => {
      if (e) e.stopPropagation();
      if (typeof requestAppPrompt !== "function") return;
      const cur0 = meetStart(c, ctx);
      requestAppPrompt("你们哪天认识的？", "写成 2024-05-20 这样。清空就回到自动算（从在一起那天或者来到这里那天）。", cur0 ? dayKey(cur0) : "", v => {
        const all = (typeof loadJSON === "function" ? loadJSON(MEET_KEY, {}) : {}) || {};
        const str = String(v || "").trim();
        if (!str) delete all[c.id];
        else {
          const a = str.split(/[-/.年月日\s]+/).map(Number).filter(x => !isNaN(x));
          const ts = a.length >= 3 ? new Date(a[0], a[1] - 1, a[2], 12).getTime() : NaN;
          if (!ts || isNaN(ts) || ts > Date.now()) { props.toast && props.toast("日期没认出来，写成 2024-05-20 这样"); return; }
          all[c.id] = ts;
        }
        try { saveJSON(MEET_KEY, all); } catch (e2) {}
        setPinTick(x => x + 1);
      }, "定下来");
    };
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
      try {
        const txt = await props.onSummarizePin(cur, m);
        if (txt && m.gpinId) editGroupPins(list => list.map(p => p.id === m.gpinId ? Object.assign({}, p, { summary: txt }) : p));
        else if (txt) editPins(cur.id, list => list.map(p => p.id === m.pinId ? Object.assign({}, p, { summary: txt }) : p));
      }
      finally { setSumming(""); }
    };
    const dropPin = m => {
      const go = () => m.gpinId ? editGroupPins(list => list.filter(p => p.id !== m.gpinId)) : editPins(cur.id, list => list.filter(p => p.id !== m.pinId));
      if (typeof requestAppConfirm === "function") requestAppConfirm("删掉这张时刻？", "只删这张卡，聊天记录不动。", go, "删掉"); else go();
    };
    const saveCreate = () => {
      const f = creating || {}, a = String(f.date || "").split("-").map(Number);
      if (!cur || !a[0] || !String(f.title || "").trim()) { props.toast && props.toast("写个日子和名字"); return; }
      const ts = new Date(a[0], a[1] - 1, a[2], 12).getTime();
      editPins(cur.id, list => [{ id: "pin_" + Date.now(), ts, title: String(f.title).trim().slice(0, 30), manual: true, role: "manual",
        lines: String(f.text || "").trim() ? [{ role: "manual", text: String(f.text).trim().slice(0, 2000) }] : [] }].concat(list));
      setCreating(null);
    };
    // 合成一页长图（她 2026-10-03 点的第 7 条）：封面 + 一张张时刻（日期、名目、那天的几句、有图就配图），画在 canvas 上存下来。
    //   不花钱；图从图库里现取。⚠️canvas 一边不能太长（iOS 约 16384px），超了就只拼最近那些，末尾写一句。
    const loadImg = async ref => {
      try {
        let url = null;
        if (ref && ref.imgKey && typeof idbImgGet === "function") { const b = await idbImgGet(ref.imgKey); if (b) url = URL.createObjectURL(b); }
        else if (ref && ref.ref) url = typeof resolveImg === "function" ? resolveImg(ref.ref) : ref.ref;
        else if (typeof ref === "string") url = typeof resolveImg === "function" ? resolveImg(ref) : ref;
        if (!url) return null;
        return await new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = url; });
      } catch (e) { return null; }
    };
    const wrap = (ctx2, text, maxW) => { const out = []; let line = ""; for (const ch of String(text)) { if (ch === "\n" || ctx2.measureText(line + ch).width > maxW) { out.push(line); line = ch === "\n" ? "" : ch; } else line += ch; } if (line) out.push(line); return out; };
    const exportLong = async (c, items) => {
      if (exporting) return;
      setExporting(true);
      try {
        const W = 1080, PAD = 72, MAXH = 15000;
        const cv = document.createElement("canvas"), g2 = cv.getContext("2d");
        const font = (px, disp) => (disp ? "600 " : "") + px + "px " + (disp ? "serif" : "sans-serif");
        // 先量高度
        g2.font = font(30);
        const blocks = [];
        let H = 760, cut = 0;
        for (const m of items) {
          const lines = [].concat(...(m.what.lines || []).slice(0, 4).map(x => wrap(g2, x, W - PAD * 2 - 40)));
          const img = (arts[c.id] || {})[m.key] ? { ref: arts[c.id][m.key] } : m.img;
          const bh = 220 + lines.length * 46 + (img ? 420 : 0) + 60;
          if (H + bh > MAXH) { cut = items.length - blocks.length; break; }
          blocks.push({ m, lines, img, h: bh }); H += bh;
        }
        H += cut ? 120 : 80;
        cv.width = W; cv.height = H;
        g2.fillStyle = "#f7f2ea"; g2.fillRect(0, 0, W, H);
        const cover = await loadImg(coverOf(c));
        if (cover) { const r = Math.max(W / cover.width, 640 / cover.height); g2.drawImage(cover, (W - cover.width * r) / 2, (640 - cover.height * r) / 2, cover.width * r, cover.height * r); }
        else { g2.fillStyle = c.color || "#6b5b4b"; g2.fillRect(0, 0, W, 640); }
        const grd = g2.createLinearGradient(0, 300, 0, 640); grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(1, "rgba(0,0,0,.6)"); g2.fillStyle = grd; g2.fillRect(0, 300, W, 340);
        g2.fillStyle = "#fff"; g2.font = font(76, true); g2.fillText(c.remark || c.name, PAD, 560);
        g2.font = font(30); g2.fillText(daysLine(c, ctx) + "  ·  " + items.length + " 个时刻", PAD, 610);
        let y = 720;
        for (const b of blocks) {
          const d = new Date(b.m.ts);
          g2.fillStyle = "#9a8a78"; g2.font = font(28); g2.fillText(d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate() + "  ·  " + (KIND_ZH[b.m.kind] || ""), PAD, y + 40);
          g2.fillStyle = "#2e261d"; g2.font = font(48, true); g2.fillText(b.m.title.slice(0, 20), PAD, y + 110);
          let yy = y + 170;
          if (b.img) { const im = await loadImg(b.img); if (im) { const bw = W - PAD * 2, bh2 = 400, r = Math.max(bw / im.width, bh2 / im.height);
            g2.save(); g2.beginPath(); g2.rect(PAD, yy, bw, bh2); g2.clip(); g2.drawImage(im, PAD + (bw - im.width * r) / 2, yy + (bh2 - im.height * r) / 2, im.width * r, im.height * r); g2.restore(); yy += 420; } }
          g2.fillStyle = "#5a4e42"; g2.font = font(30);
          b.lines.forEach(l => { g2.fillText(l, PAD + 20, yy + 30); yy += 46; });
          g2.strokeStyle = "#e3d8c8"; g2.beginPath(); g2.moveTo(PAD, y + b.h - 20); g2.lineTo(W - PAD, y + b.h - 20); g2.stroke();
          y += b.h;
        }
        g2.fillStyle = "#9a8a78"; g2.font = font(26);
        g2.fillText(cut ? "（太长了，只拼了最近的 " + blocks.length + " 张，还有 " + cut + " 张在 App 里）" : "—— 时刻", PAD, y + 50);
        const ok = typeof saveImgOriginal === "function" ? await saveImgOriginal(cv.toDataURL("image/jpeg", 0.9), (c.remark || c.name) + "的时刻") : false;
        if (!ok && props.toast) props.toast("没存成，再试一次");
      } catch (e) { props.toast && props.toast("没拼成：" + String((e && e.message) || e).slice(0, 80)); }
      finally { setExporting(false); }
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
      const list = (all[cur.id] || []).slice().reverse();
      const mcard = (m, i) => {
        const d = new Date(m.ts);
        return h("div", { key: m.key, "data-wk": "shikeitem", "data-kind": m.kind, className: "shrink-0",
          style: { position: "relative", height: "100%", width: "min(80vw, 400px)", borderRadius: 24, overflow: "hidden", scrollSnapAlign: "center",
            background: cur.color || t.ink, boxShadow: "0 16px 36px rgba(30,22,14,.26)", transform: i === mIdx ? "none" : "scale(.95)", transition: "transform .25s" } },
          art(cur, { filter: "blur(2px) brightness(.55)", transform: "scale(1.06)" }),
          ((arts[cur.id] || {})[m.key] || m.img) ? h(MomentArt, { img: (arts[cur.id] || {})[m.key] ? { ref: arts[cur.id][m.key] } : m.img }) : null,
          h("div", { style: { position: "absolute", inset: 10, borderRadius: 16, border: "1px solid rgba(255,255,255,.45)", pointerEvents: "none" } }),
          h("div", { style: { position: "absolute", inset: 0, padding: "34px 28px 30px", display: "flex", flexDirection: "column", color: "#fff", textAlign: "left" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, letterSpacing: 3, color: "rgba(255,255,255,.72)" } }, KIND_ZH[m.kind] + " · 第 " + (i + 1) + " 个时刻"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 44, lineHeight: 1.05, marginTop: 14 } }, (d.getMonth() + 1) + "." + d.getDate()),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: "rgba(255,255,255,.75)", marginTop: 4 } }, d.getFullYear() + " 年"),
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, lineHeight: 1.3, marginTop: 18 } }, m.title),
            m.with && m.with.length ? h("div", { "data-wk": "shikewith", style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(255,255,255,.8)", marginTop: 6 } }, "一起的还有：" + m.with.join("、")) : null,
            // 底框压矮、沉到卡底（她 2026-10-03：「底框可以再矮一点」）：上面留给画，字只占一小截，多了就在框里滚
            h("div", { style: { flex: 1, minHeight: 12 } }),
            h("div", { "data-wk": "shikenote", className: "min-h-0", style: { maxHeight: "20%", flexShrink: 1, overflowY: "auto", background: "rgba(0,0,0,.28)", border: "1px solid rgba(255,255,255,.18)",
              borderRadius: 12, padding: "8px 12px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 2, color: "rgba(255,255,255,.65)", marginBottom: 5 } },
                rawOpen[m.key] ? "原话" : m.what.kind === "mem" ? "那天记下的事" : m.what.kind === "chat" ? "那天你们说的话" : m.what.kind === "summary" ? "那一段" : m.what.kind === "pin" ? "收着的原话" : "那一天"),
              ((rawOpen[m.key] && m.raw) ? m.raw : m.what.lines).length
                ? ((rawOpen[m.key] && m.raw) ? m.raw : m.what.lines).map((x, k) => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.6, color: "rgba(255,255,255,.95)", marginBottom: 4, whiteSpace: "pre-wrap" } }, x))
                : h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: "rgba(255,255,255,.7)" } }, "那天没留下记录。"),
              // 「让 TA 说说」（她 2026-10-03 点的第 5 条）：TA用自己的口气回忆这一天，点了才调一次
              (notes[cur.id] || {})[m.key] ? h("div", { "data-wk": "shikesay", style: { marginTop: 12, paddingTop: 10, borderTop: "1px dashed rgba(255,255,255,.3)" } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 2, color: "rgba(255,255,255,.65)", marginBottom: 6 } }, (cur.remark || cur.name) + " 说"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.75, color: "#fff", whiteSpace: "pre-wrap" } }, (notes[cur.id] || {})[m.key])) : null,
              null),
            // 卡底一行小字动作（不再是一排药丸——她 2026-10-03：「很占位置而且丑」）：像展签底下那行小注，点哪个字就是哪个
            // 收起来（她 2026-10-03：「卡里面的设置也收一收」）：平时只露一个「⋯」，点开才是那行小字
            !actsOpen[m.key] ? h("button", { onClick: () => setActsOpen(o => Object.assign({}, o, { [m.key]: true })), className: "active:opacity-60", "aria-label": "展开动作",
              style: { alignSelf: "flex-end", marginTop: 6, fontSize: 18, lineHeight: 1, color: "rgba(255,255,255,.8)", background: "transparent", border: "none", padding: "2px 2px" } }, "⋯") :
            h("div", { "data-wk": "shikeacts", className: "flex items-center", style: { flexWrap: "wrap", marginTop: 8, rowGap: 4 } },
              [props.onRecall ? [saying === m.key ? "TA 在想…" : ((notes[cur.id] || {})[m.key] ? "再说说" : "让 TA 说说"), () => recall(m), !!saying] : null,
               props.onSendMoment ? ["发给 TA", () => props.onSendMoment(cur, m)] : null,
               (m.pinId || m.gpinId) && m.raw && m.raw.length > 3 && !m.summary && props.onSummarizePin ? [summing === m.key ? "总结中…" : "总结", () => summarize(m), !!summing] : null,
               m.summary ? [rawOpen[m.key] ? "看总结" : "看原话", () => setRawOpen(o => Object.assign({}, o, { [m.key]: !o[m.key] }))] : null,
               props.onDrawMoment ? [drawing === m.key ? "正在画…" : "画一张", () => draw(m), !!drawing] : null,
               ["贴图", () => { pickFor.current = m; fileRef.current && fileRef.current.click(); }],
               (arts[cur.id] || {})[m.key] ? ["拿掉图", () => setArt(cur.id, m.key, null)] : null,
               (m.pinId || m.gpinId) ? ["删掉", () => dropPin(m)] : null,
               ["收起", () => setActsOpen(o => Object.assign({}, o, { [m.key]: false }))]
              ].filter(Boolean).map((a, k) => h(React.Fragment, { key: k },
                k ? h("span", { style: { color: "rgba(255,255,255,.35)", margin: "0 8px", fontSize: 11 } }, "·") : null,
                h("button", { onClick: a[1], disabled: !!a[2], className: "active:opacity-60",
                  style: { fontFamily: F_BODY, fontSize: 12, color: "rgba(255,255,255,.88)", background: "transparent", border: "none", padding: "4px 0", opacity: a[2] ? .5 : 1 } }, a[0]))))));
      };
      // 目录（她 2026-10-03 点的第 6 条）：按「几年几月」分组，点一下滑到那个月的第一张
      const months = [];
      list.forEach((m, k) => { const d = new Date(m.ts), lab = d.getFullYear() + "." + (d.getMonth() + 1); if (!months.some(x => x.lab === lab)) months.push({ lab, k }); });
      const curLab = list[mIdx] ? (new Date(list[mIdx].ts).getFullYear() + "." + (new Date(list[mIdx].ts).getMonth() + 1)) : "";
      const jump = k => { const el = mRef.current; if (!el) return; const w = el.firstChild ? el.firstChild.getBoundingClientRect().width + 14 : el.clientWidth; try { el.scrollTo({ left: k * w, behavior: "smooth" }); } catch (e) { el.scrollLeft = k * w; } setMIdx(k); };
      const onMScroll = e => {
        const el = e.currentTarget, w = el.firstChild ? el.firstChild.getBoundingClientRect().width + 14 : el.clientWidth;
        const k = Math.round(el.scrollLeft / Math.max(1, w));
        if (k !== mIdx) setMIdx(Math.max(0, Math.min(list.length - 1, k)));
      };
      return h("div", { className: "h-full flex flex-col", "data-wk": "shikedetail", style: Object.assign({ position: "relative" }, shell(t)) },
        h("input", { ref: fileRef, type: "file", accept: "image/*", onChange: onFile, style: { display: "none" } }),
        h(Head, { zh: cur.remark || cur.name, onBack: () => { setOpenId(null); setMIdx(0); setMenuOpen(false); }, bg: "transparent",
          right: h("button", { onClick: () => setMenuOpen(v => !v), className: "active:opacity-50", "aria-label": "更多", style: { width: 44, height: 38, fontSize: 22, color: t.ink, background: "transparent", border: "none" } }, "⋯") }),
        h("div", { className: "shrink-0", style: { textAlign: "center", padding: "2px 16px 0" } },
          h("span", { onClick: e => editMeet(cur, e), style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog, cursor: "pointer" } }, [daysLine(cur, ctx), upLine(upcoming(cur, ctx))].filter(Boolean).join(" · "))),
        // 右上角「⋯」收着那几样（她 2026-10-03：上面那几个药丸很占位置而且丑）
        menuOpen ? h("div", { onClick: () => setMenuOpen(false), style: { position: "absolute", inset: 0, zIndex: 30 } },
          h("div", { "data-wk": "shikemenu", onClick: e => e.stopPropagation(), style: { position: "absolute", right: 14, top: "calc(env(safe-area-inset-top) + 56px)", minWidth: 150, background: t.bg2, border: "1px solid " + t.line,
            borderRadius: 12, boxShadow: "0 10px 28px rgba(40,30,20,.18)", overflow: "hidden" } },
            [props.onGenCover ? [busy === cur.id ? "正在画封面…" : (covers[cur.id] ? "重画封面" : "生成封面"), () => gen(cur)] : null,
             covers[cur.id] ? ["用回头像", () => setCover(cur.id, null)] : null,
             ["开一张时刻", () => setCreating({ date: dayKey(Date.now()), title: "", text: "" })],
             list.length ? [exporting ? "正在拼…" : "存成长图", () => exportLong(cur, all[cur.id] || [])] : null,
             ["改认识那天", () => editMeet(cur)]
            ].filter(Boolean).map((a, k) => h("button", { key: k, onClick: () => { setMenuOpen(false); a[1](); }, className: "w-full active:opacity-60",
              style: { display: "block", textAlign: "left", padding: "12px 16px", fontFamily: F_BODY, fontSize: 14, color: t.ink, background: "transparent", border: "none", borderTop: k ? "1px solid " + t.line : "none" } }, a[0])))) : null,
        list.length
          ? h("div", { ref: mRef, onScroll: onMScroll, className: "flex-1 min-h-0 flex",
              style: { gap: 14, overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
                padding: "12px calc((100vw - min(80vw, 400px)) / 2) 10px" } }, list.map(mcard))
          : h("div", { className: "flex-1", style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: t.fog, textAlign: "center", padding: "60px 30px" } },
              "还没有时刻。认识满 100 天、在一起的日子、生日，还有节日那天你们说过话，都会自己出现在这里。"),
        // 底下一条展廊的时间轴（替掉原来那排月份药丸和小点）：一张时刻一道刻度，每个月第一张底下写月份，
        //   停着的那张刻度拉长上墨。点刻度直接跳过去。它就是这间展厅的墙脚线，换个 app 不成立。
        list.length > 1 ? h("div", { "data-wk": "shikemonths", className: "shrink-0", style: { position: "relative", height: 40, margin: "2px 18px calc(10px + env(safe-area-inset-bottom))", overflowX: "auto" } },
          h("div", { style: { position: "relative", height: "100%", minWidth: Math.max(list.length * 18, 100) + "px" } },
            h("div", { style: { position: "absolute", left: 0, right: 0, top: 12, height: 1, background: t.line } }),
            list.map((m, k) => {
              // 旧的在左、新的在右（她 2026-10-03）：里层 list 已经是旧→新；每个月最早那张底下写月份
              const on = k === mIdx, d = new Date(m.ts), pv = list[k - 1] ? new Date(list[k - 1].ts) : null,
                first = !pv || pv.getMonth() !== d.getMonth() || pv.getFullYear() !== d.getFullYear(),
                x = k / (list.length - 1), shift = x < .08 ? "-8px" : x > .92 ? "calc(-100% + 8px)" : "-50%";
              return h("button", { key: m.key, onClick: () => jump(k), "aria-label": d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(),
                style: { position: "absolute", left: x * 100 + "%", top: 0, width: 18, height: 40, marginLeft: -9, background: "transparent", border: "none", padding: 0 } },
                h("span", { style: { position: "absolute", left: 8, top: on ? 4 : 8, width: on ? 2 : 1, height: on ? 16 : 9, background: on ? t.ink : t.fog, borderRadius: 1 } }),
                first || on ? h("span", { style: { position: "absolute", left: 9, top: 24, transform: "translateX(" + shift + ")", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: 10, color: on ? t.ink : t.fog, fontWeight: on ? 600 : 400 } },
                  (d.getMonth() + 1) + "月") : null);
            }))) : h("div", { style: { height: "calc(14px + env(safe-area-inset-bottom))" } }));
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
          line ? h("div", { onClick: e => editMeet(c, e), style: { fontFamily: F_BODY, fontSize: 12.5, color: "rgba(255,255,255,.88)", marginTop: 8 } }, line) : null,
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
  // 聊天里那张时刻卡：小相片（有就放那天的照片）+ 日期 + 名目 + 两句
  function ShikeShareCard({ m, isU }) {
    const t = useTheme(), sk = (m && m.shike) || {}, d = new Date(sk.ts || m.ts);
    return h("div", { "data-wk": "shikeshare", style: { width: 230, borderRadius: 14, overflow: "hidden", background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 3px 10px rgba(40,30,20,.08)" } },
      sk.img ? h("div", { style: { position: "relative", height: 120, background: t.bg } }, h(MomentArt, { img: sk.img })) : null,
      h("div", { style: { padding: "10px 12px 11px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, letterSpacing: 2, color: t.fog } }, (sk.byChar ? "TA 存进时刻 · " : "时刻 · ") + d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate()),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, marginTop: 3 } }, "「" + (sk.title || "") + "」"),
        (sk.lines || []).slice(0, 2).map((x, k) => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.6, color: t.sub, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, x))));
  }
  g.ShikeShareCard = ShikeShareCard;

  g.ShikeApp = ShikeApp;
  g.ShikeKit = { onThisDay, momentsFor, monthDay, whatHappened, dayImage, upcoming, HOLIDAYS,
    // 聊天那头用：三天内（含今天）有日子就给一句，没有就空——零调用，只是让TA知道
    chatNote: (c, ctx) => {
      const u = upcoming(c, ctx, 3);
      if (u) return (u.days === 0 ? "今天是你们的「" + u.title + "」。" : "再过 " + u.days + " 天是你们的「" + u.title + "」。") + "记不记得、要不要表示、怎么表示，全看你这个人；她没提的话，你也可以不提。";
      return oldMomentNote(c, ctx);
    } };
})();
