// 时刻的开机那半（2026-10-18 瘦身第九批，从 js/shike.js 拆出来）：主屏上的「那年今天」、聊天里的时刻卡、聊天里提起的纪念日（ShikeKit）、主屏图标，这些开机就要。
//   时刻整页在 js/shike.js，点进去才加载（js/lazy-mods.js）。测试会 require 这份，所以递过去的那一包挂在 window，没有 window 时挂 globalThis。
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

  // 「认识」从哪天起算（她 2026-10-03：「认识是按来到秋秋开始算的，但在一起更早就会出现在一起 105 天、还有 11 天认识 100 天」）：
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
  function MomentArt({ img }) {
    const idbUrl = typeof useIdbImgUrl === "function" ? useIdbImgUrl(img && img.imgKey) : null;
    const src = img && img.imgKey ? idbUrl : (img && img.ref ? (typeof resolveImg === "function" ? resolveImg(img.ref) : img.ref) : null);
    return src ? h("img", { src, alt: "", style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.62)" } }) : null;
  }

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
    if (cp && cp.status === "together" && cp.since) marks(cp.since, window.spaceLover && !window.spaceLover(cp) ? "开了" + window.spaceRel(cp).space : "在一起");
    const y0 = new Date(now).getFullYear();
    [[monthDay(c.birthday), (c.remark || c.name) + " 的生日"], [monthDay(ctx.profile && ctx.profile.birthday), "你的生日"]].forEach(([md, t]) => {
      if (md) [y0, y0 + 1].forEach(y => cands.push({ ts: new Date(y, md.mo - 1, md.d).getTime(), title: t }));
    });
    const next = cands.filter(x => x.ts >= now && x.ts <= now + H).sort((x, y) => x.ts - y.ts)[0];
    return next ? Object.assign(next, { days: Math.round((next.ts - now) / DAY) }) : null;
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
    const m = pool[hashOf(c.id + ":" + d) % pool.length], dd = new Date(vtOf(m.ts, c.id));
    return "你们的相册里有一张「" + m.title + "」（" + dd.getFullYear() + " 年 " + (dd.getMonth() + 1) + " 月 " + dd.getDate() + " 日）：" + m.what.lines.slice(0, 2).join(" / ").slice(0, 160)
      + "。今天你偶尔会想起它——聊着自然想起就提一句，不合时宜就不提，别硬拐过去。";
  }

  // 去年今天（她 2026-10-03 点的第 5 条）：今天跟某张旧时刻同月同日、年份更早 → 主屏冒一张小卡。不花钱。
  //   一个人挑一张最近的那一年；几个人都有就挑第一个（主屏只冒一张，不堆）。
  const vtOf = (ts, id) => typeof vclockMap === "function" ? vclockMap(ts, id) : ts;
  function onThisDay(chars, ctx) {
    const now0 = ctx.now || Date.now();
    const pins = ctx.pins || (typeof loadJSON === "function" ? loadJSON("x_shikePins", {}) : {}) || {};
    for (const c of (chars || [])) {
      if (!c || c.npc) continue;
      // 今天、那张的日子都照这个人那只钟（虚拟时间拨过的话，「那年今日」是钟上的同月同日）
      const now = new Date(vtOf(now0, c.id)), mo = now.getMonth(), da = now.getDate(), yr = now.getFullYear();
      const hit = momentsFor(c, Object.assign({}, ctx, { pins })).find(m => { const d = new Date(vtOf(m.ts, c.id)); return d.getMonth() === mo && d.getDate() === da && d.getFullYear() < yr; });
      if (hit) return { char: c, m: hit, years: yr - new Date(vtOf(hit.ts, c.id)).getFullYear() };
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
      h("button", { "data-wk": "block", onClick: onOpen, className: "active:opacity-80 flex items-center", style: { flex: 1, minWidth: 0, gap: 12, background: "transparent", border: "none", padding: 0, textAlign: "left" } },
        src ? h("img", { src, alt: "", style: { width: 46, height: 46, borderRadius: 12, objectFit: "cover", flexShrink: 0 } }) : null,
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", letterSpacing: 2, color: t.fog } }, (item.years === 1 ? "一年前" : item.years + " 年前") + "的今天 · " + (c.remark || c.name)),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(16px * var(--app-fs, 1))", color: t.ink, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, "「" + item.m.title + "」"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, marginTop: 1 } }, "去时刻里看看 ›"))),
      h("button", { "data-wk": "block", onClick: onClose, className: "active:opacity-60", "aria-label": "收起", style: { fontFamily: F_BODY, fontSize: "calc(18px * var(--app-fs, 1))", color: t.fog, background: "transparent", border: "none", padding: "4px 6px" } }, "×"));
  }
  g.ShikeOTD = ShikeOTD;
  // 角色生日 app 内提醒（她 2026-10-31：「算了做个app内提醒吧好看点」）：
  //   前一天、当天，开机落主屏时在顶上冒一张小蛋糕卡；点卡进聊天，× 收起，当天不再冒。
  //   日子走 daysUntilBirthday（公历、农历都认），跟提示词里那句同一个函数。
  function bdaySoon(chars, now) {
    if (typeof daysUntilBirthday !== "function") return [];
    const out = [];
    for (const c of chars || []) {
      if (!c || c.npc || c.isGroup || !String(c.birthday || "").trim()) continue;
      const du = daysUntilBirthday(c.birthday, now || new Date());
      if (du === 0 || du === 1) out.push({ char: c, du });
    }
    return out.sort((a, b) => a.du - b.du).slice(0, 3);
  }
  function BdayCard({ items, onOpen, onClose }) {
    const t = useTheme();
    if (!items || !items.length) return null;
    const n = new Date(), today = items.some(it => it.du === 0);
    const dl = (n.getMonth() + 1) + " 月 " + n.getDate() + " 日";
    // 彩色糖粒：几颗小圆点撒在底上，纯 CSS 不加图
    const dots = ["#f4a7b9 8% 22%", "#ffd27a 18% 78%", "#a9d8f0 34% 14%", "#c8b6f2 62% 86%", "#f4a7b9 78% 30%", "#ffd27a 88% 70%", "#a8e0c4 50% 50%"]
      .map(d => { const [c, x, y] = d.split(" "); return "radial-gradient(circle at " + x + " " + y + ", " + c + " 0 2.2px, transparent 2.8px)"; }).join(",");
    return h("div", { "data-wk": "bdaycard", style: { position: "absolute", left: 14, right: 14, top: "calc(env(safe-area-inset-top) + 52px)", zIndex: 41,
        padding: "14px 16px 12px", borderRadius: 24, overflow: "hidden",
        background: dots + ", linear-gradient(150deg, #fff6f1 0%, #ffeef0 55%, #fff8e8 100%)",
        border: "1px solid rgba(232,178,160,.6)", boxShadow: "0 14px 36px rgba(150,80,70,.22), inset 0 1px 0 rgba(255,255,255,.9)",
        animation: "bdayIn .55s cubic-bezier(.2,.9,.3,1.2) both" } },
      h("style", null, "@keyframes bdayIn{from{opacity:0;transform:translateY(-14px) scale(.97)}to{opacity:1;transform:none}}@keyframes bdayBob{0%,100%{transform:rotate(-8deg) translateY(0)}50%{transform:rotate(-4deg) translateY(-3px)}}"),
      h("div", { "aria-hidden": "true", style: { position: "absolute", right: -6, bottom: -14, fontSize: 78, opacity: .16, animation: "bdayBob 3.2s ease-in-out infinite", pointerEvents: "none" } }, "🎂"),
      h("div", { className: "flex items-center", style: { position: "relative", justifyContent: "space-between" } },
        h("div", null,
          h("div", { style: { fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: "calc(17px * var(--app-fs, 1))", color: "#c0705f", letterSpacing: .5 } }, today ? "Happy Birthday" : "Birthday Eve"),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", letterSpacing: 2, color: "#c9a08f", marginTop: 1 } }, dl + (today ? " · 生日快乐" : " · 明天就到了"))),
        h("button", { "data-wk": "block", onClick: onClose, className: "active:opacity-60", "aria-label": "收起", style: { minWidth: 40, minHeight: 40, fontSize: "calc(18px * var(--app-fs, 1))", color: "#c9a08f", background: "transparent", border: "none", margin: "-8px -10px -8px 0" } }, "×")),
      h("div", { style: { position: "relative", height: 1, margin: "8px 0 4px", background: "linear-gradient(90deg, transparent, rgba(214,160,140,.55), transparent)" } }),
      items.map(it => {
        const c = it.char, src = typeof resolveImg === "function" ? resolveImg(c.avatarImage || c.chatAvatar || "") : "";
        const ring = { width: 50, height: 50, borderRadius: "50%", flexShrink: 0, padding: 2.5, background: it.du === 0 ? "conic-gradient(#f4a7b9, #ffd27a, #a9d8f0, #c8b6f2, #f4a7b9)" : "linear-gradient(#ecd3c4, #ecd3c4)" };
        const face = src ? h("img", { src, alt: "", style: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "2px solid #fff", boxSizing: "border-box" } })
          : h("div", { style: { width: "100%", height: "100%", borderRadius: "50%", background: "#fde4dc", border: "2px solid #fff", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 } }, "🎂");
        return h("button", { key: c.id, "data-wk": "block", onClick: () => onOpen(c), className: "active:opacity-80 flex items-center", style: { position: "relative", width: "100%", minHeight: 56, gap: 12, marginTop: 6, background: "transparent", border: "none", padding: 0, textAlign: "left" } },
          h("div", { style: ring }, face),
          h("div", { style: { minWidth: 0, flex: 1 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: "calc(17px * var(--app-fs, 1))", color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
              (it.du === 0 ? "今天是 " : "明天是 "), h("span", { style: { color: "#c0705f" } }, c.remark || c.name), " 的生日"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.sub, marginTop: 2 } }, it.du === 0 ? (typeof characterText === "function" ? characterText(c, "去跟他说一声 ›") : "去跟 TA 说一声 ›") : "还有一天，先想想怎么过 ›")),
          h("div", { style: { fontSize: 18, flexShrink: 0 } }, it.du === 0 ? "🎉" : "🎁"));
      }));
  }
  g.bdaySoon = bdaySoon;
  g.BdayCard = BdayCard;
  // 聊天里那张时刻卡（她 2026-10-06：「这个时刻卡看不完啊，而且还是很普通」）：
  //   ① 点一下展开看全（原来正文写死两行、后面直接截掉，点了也没用）；
  //   ② 长相是一张夹进本子里的纪念签：左边一条丝带、右上一枚日期圆戳、标题下一道细线、
  //      底边一排撕口——全用主题的颜色，换皮肤也跟着变。
  function ShikeShareCard({ m, isU, charId }) {
    const t = useTheme(), sk = (m && m.shike) || {}, d = new Date(sk.ts || m.ts);
    const [open, setOpen] = useState(false);
    const lines = (sk.lines || []).filter(Boolean);
    const body = lines.join("\n");
    const long = body.length > 46 || lines.length > 2;
    const ribbon = t.accent || t.tint || t.ink;
    const md = (d.getMonth() + 1) + "." + d.getDate();
    // 她 2026-10-11：「存进时刻卡略单调」——改成一枚系着绳的纪念签：
    //   左上打孔穿一截绳、纸面是淡淡的横格、标题底下一道荧光笔、
    //   每句对话把「谁说的」拎成小签名、右上一枚双圈邮戳、底边两个票根缺口。全用主题色，换皮肤跟着变。
    const say = (ln, k) => {
      const mm = /^(.{1,8}?)[：:]\s*(.+)$/.exec(String(ln));
      return h("div", { key: k, style: { display: "flex", gap: 8, alignItems: "baseline", minHeight: 26 } },
        mm ? h("span", { style: { flexShrink: 0, fontFamily: F_BODY, fontSize: "calc(10px * var(--app-fs, 1))", letterSpacing: 1, color: ribbon, padding: "1px 6px", borderRadius: 999, border: "1px solid " + ribbon, opacity: .8 } }, mm[1]) : null,
        h("span", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: "26px", color: t.ink, opacity: .82, whiteSpace: "pre-wrap", minWidth: 0 } }, mm ? mm[2] : ln));
    };
    const notch = side => h("div", { "aria-hidden": "true", style: { position: "absolute", [side]: -8, top: -8, width: 16, height: 16, borderRadius: 999, background: t.bg, border: "1px solid " + t.line } });
    return h("div", { "data-wk": "shikeshare", "data-open": open ? "1" : "0",
        onClick: () => long && setOpen(v => !v), role: long ? "button" : undefined, "aria-expanded": long ? (open ? "true" : "false") : undefined,
        style: { position: "relative", width: 248, paddingTop: 14, cursor: long ? "pointer" : "default" } },
      // 绳子：从签上的孔里绕出来
      h("svg", { "aria-hidden": "true", width: 60, height: 34, viewBox: "0 0 60 34", style: { position: "absolute", left: 6, top: -6, overflow: "visible", zIndex: 2 } },
        h("path", { d: "M17 37 C 4 24, 4 4, 22 2 S 52 8, 58 -4", fill: "none", stroke: ribbon, strokeWidth: 1.6, strokeLinecap: "round", opacity: .75 })),
      h("div", { style: { position: "relative", borderRadius: "6px 16px 16px 16px", overflow: "hidden",
          background: t.bg2, border: "1px solid " + t.line, boxShadow: "0 8px 20px rgba(40,30,20,.12), 0 1px 0 rgba(255,255,255,.6) inset" } },
        // 打孔
        h("div", { "aria-hidden": "true", style: { position: "absolute", left: 16, top: 12, width: 11, height: 11, borderRadius: 999, background: t.bg, border: "1.5px solid " + ribbon, opacity: .9, zIndex: 1 } }),
        sk.img ? h("div", { style: { position: "relative", height: 128, background: t.bg } }, h(MomentArt, { img: sk.img })) : null,
        h("div", { style: { position: "relative", padding: "12px 16px 12px 18px" } },
          // 双圈邮戳
          h("div", { "aria-hidden": "true", style: { position: "absolute", right: 10, top: 8, width: 50, height: 50, borderRadius: 999,
              border: "1px solid " + ribbon, boxShadow: "0 0 0 3px " + t.bg2 + ", 0 0 0 4px " + ribbon, color: ribbon, opacity: .62, transform: "rotate(-14deg)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.05 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(7.5px * var(--app-fs, 1))", letterSpacing: 1.5 } }, d.getFullYear()),
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(14px * var(--app-fs, 1))" } }, md),
            h("span", { style: { fontSize: "calc(7px * var(--app-fs, 1))", marginTop: 1 } }, "✦")),
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(9.5px * var(--app-fs, 1))", letterSpacing: 3, color: ribbon, paddingLeft: 18, paddingRight: 56 } }, "✦ " + (sk.byChar ? "TA 存进时刻" : "时刻")),
          // 标题：底下压一道荧光笔
          h("div", { style: { marginTop: 10, paddingRight: 50 } },
            h("span", { style: { fontFamily: F_DISPLAY, fontSize: "calc(19px * var(--app-fs, 1))", lineHeight: 1.4, color: t.ink,
                backgroundImage: "linear-gradient(transparent 62%, " + ribbon + "33 62%)", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", padding: "0 2px" } }, sk.title || "")),
          // 横格纸上的对话
          lines.length ? h("div", { style: Object.assign({ position: "relative", marginTop: 10, paddingTop: 2,
              backgroundImage: "repeating-linear-gradient(transparent 0, transparent 25px, " + t.line + " 25px, " + t.line + " 26px)" }, open || !long ? {} : { maxHeight: 80, overflow: "hidden" }) },
            lines.map(say)) : null,
          !open && long ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, lineHeight: "22px" } }, "……") : null,
          // 角落一枚大引号水印
          h("div", { "aria-hidden": "true", style: { position: "absolute", right: 10, bottom: -34, fontFamily: "Georgia, serif", fontSize: "calc(72px * var(--app-fs, 1))", color: ribbon, opacity: .08, pointerEvents: "none" } }, "\u201D")),
        // 票根那一截：两个缺口 + 虚线
        h("div", { style: { position: "relative", borderTop: "1.5px dashed " + t.line, padding: "8px 16px 9px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog } },
          notch("left"), notch("right"),
          h("span", { style: { letterSpacing: 1 } }, sk.byChar ? "TA 记下的这一刻" : "你们的一刻"),
          h("span", { style: { display: "flex", gap: 12, alignItems: "center" } },
            long ? h("span", { style: { color: ribbon } }, open ? "收起" : "展开 ›") : null,
            // 去时刻里看（她 2026-10-11：「角色写的时刻卡不能跳转」）：翻到时刻里这个人、停在这一张
            charId && typeof window !== "undefined" && window.__openShike ? h("button", { "data-wk": "shikesharego",
              onClick: e => { e.stopPropagation(); window.__openShike(charId, { key: m.shikeKey || "", title: sk.title || "", ts: sk.ts || m.ts }); },
              className: "active:opacity-60", style: { minHeight: 32, padding: "0 2px", fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: ribbon, background: "transparent", border: "none" } }, "去时刻里看 ›") : null))));
  }
  g.ShikeShareCard = ShikeShareCard;
  g.ShikeKit = { onThisDay, momentsFor, monthDay, whatHappened, dayImage, upcoming, HOLIDAYS,
    // 聊天那头用：三天内（含今天）有日子就给一句，没有就空——零调用，只是让TA知道
    chatNote: (c, ctx) => {
      const u = upcoming(c, ctx, 3);
      if (u) return (u.days === 0 ? "今天是你们的「" + u.title + "」。" : "再过 " + u.days + " 天是你们的「" + u.title + "」。") + "记不记得、要不要表示、怎么表示，全看你这个人；她没提的话，你也可以不提。";
      return oldMomentNote(c, ctx);
    } };

  // 页面那半要用的，原样递过去
  (typeof window !== "undefined" ? window : globalThis).ShikeCore = { g, useState, useMemo, DAY, dayKey, startOf, MEET_KEY, meetStart, momentsFor, MomentArt, upcoming };
})();
