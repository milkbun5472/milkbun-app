// 星测页面那半（2026-10-18 瘦身第九批）：开机那半在 js/astro-core.js（测试里要先 require 它）。
// ============================================================
// 星测（v74.590，她 2026-10-03 画在「每日看」文件夹里那一格：
//   「星座配对指数 / 星宿关系 / 每日运势 / 幸运色」）
//
// 三样都是【算】出来的，不调模型、不花钱：
//   · 星座：公历生日 → 十二宫；两人配对看相隔几宫（同元素、相生、对宫、刑……）
//   · 星宿：宿曜二十七宿。农历生日 → 本命宿；两人关系看相隔几宿（命/业胎/荣亲/友衰/安坏/危成）
//   · 每日：星座 + 今天的日期当种子，同一天打开永远是同一份
// 只有「让 TA 看看」那一下才调一次模型（runProbe voice，跟解梦馆同一条路，人设/心情/反八股整份白得）。
//
// 她定的三条（2026-10-03）：配对【我和角色、角色和角色】都能配；
//   点评照塔罗那样「点了才算」；没填生日的就说不知道、点一下去档案填，不瞎编。
// ============================================================
(function () {
  const { g, SIGNS, signMatch, SHUKU, shukuRelation, birthInfo, dayKeyOf, daily, rev, planetLongitudes, PLANETS, PL_ZH, PL_THEME, lonDiff, CITIES, cityCC, searchPlace, BIRTH_KEY, loadBirth, birthDateOf, natalChart, KEYS_FOR, synastry, transits, transitLine, synLine, noonOf, skyNote, goodDays, pairGoodDays, solarReturn, askStars, SIGN_SCHEMA, signInstruction, todayFacts, AstroSignCard, signName, SKY_BASE, sky, STARS, Stars, sparkle, Spark, Panel, ZodiacWheel } = (typeof window !== "undefined" ? window : globalThis).AstroCore;
  const ELEMENTS = ["火", "土", "风", "水"];
  const signDeg = lon => ({ sign: Math.floor(rev(lon) / 30), deg: Math.floor(rev(lon) % 30) });
  function saveBirth(all) { saveJSON(BIRTH_KEY, all); return all; }
  const yearLine = x => "这一年的" + PL_ZH[x.a] + x.asp.zh + "你的" + PL_ZH[x.b] + "：" + PL_THEME[x.b] + "这块" + x.asp.verb;
  // ── 月亮日记（第 5 条）：今天月亮在哪个星座 + 一个情绪小词；她顺手记的心情就是健康 app 心情那一格（同一份）──
  const MOON_WORD = ["冲劲", "安稳", "好奇", "想家", "想被看见", "挑剔", "想讲和", "很深", "想跑远", "收着", "抽离", "迷糊"];
  const moonSignOn = dk => Math.floor(rev(planetLongitudes(noonOf(dk)).moon) / 30);

  const ASK_KEY = "x_astro_asks", SIGN_KEY = "x_astro_signs";
  const loadAsks = () => { try { const v = loadJSON(ASK_KEY, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } };

  // ── 存 ────────────────────────────────────────────────────
  // x_astro_notes：TA的点评。{ "<种类>|<日期或配对>|<谁说的>": { text, ts } }，只留最近 120 条。
  const NOTE_KEY = "x_astro_notes";
  function loadNotes() { try { const v = loadJSON(NOTE_KEY, {}); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
  function saveNote(key, text) {
    const all = loadNotes();
    all[key] = { text: String(text || ""), ts: Date.now() };
    const keys = Object.keys(all).sort((a, b) => (all[b].ts || 0) - (all[a].ts || 0));
    keys.slice(120).forEach(k => delete all[k]);
    saveJSON(NOTE_KEY, all);
    return all;
  }

  // ── 提示词（只给【她看到的那份算出来的结果】，怎么说由他自己）──
  const voiceTail = () => (typeof probeVoiceTail === "function" ? probeVoiceTail() : "");

  // ── 画 ────────────────────────────────────────────────────
  const { useState, useMemo } = React;

  // tab 长成一段星座连线（tabs-not-plain-pills）：三颗星连着一根线，选中那颗大、亮、带光晕，
  // 走到它为止那段线是实的，后面是虚的。
  function StarTabs({ tabs, cur, onPick, S }) {
    const idx = tabs.findIndex(x => x[0] === cur);
    // 线从第一颗星的圆心连到最后一颗：n 格均分，圆心在每格正中
    const n = tabs.length, edge = 50 / n, span = 100 - 2 * edge;
    return h("div", { "data-wk": "astrotabs", style: { position: "relative", display: "flex", padding: "6px 0 4px" } },
      h("div", { style: { position: "absolute", left: edge + "%", width: span + "%", top: 22, height: 0, borderTop: "1px dashed " + S.line } }),
      h("div", { style: { position: "absolute", left: edge + "%", width: (n > 1 ? idx / (n - 1) : 0) * span + "%", top: 22, height: 0, borderTop: "1.5px solid " + S.tint } }),
      tabs.map((tb, i) => {
        const on = tb[0] === cur;
        return h("button", { key: tb[0], onClick: () => onPick(tb[0]), "aria-pressed": on, className: "active:opacity-70",
          style: { flex: 1, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, background: "transparent", border: "none", position: "relative" } },
          h("span", { style: { width: on ? 14 : 8, height: on ? 14 : 8, marginTop: on ? 9 : 12, borderRadius: 99, background: on ? S.tint : (i < idx ? S.tint : S.bg2),
            border: "1px solid " + (on || i < idx ? S.tint : S.line), boxShadow: on ? "0 0 0 4px " + S.tint + "33, 0 0 14px " + S.tint : "none", transition: "all .2s" } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: on ? 13.5 : 12.5, color: on ? S.ink : S.sub, fontWeight: on ? 600 : 400 } }, tb[1]));
      }));
  }

  // 一张真的星盘（第 1 条）：外圈十二宫，里圈每颗星按出生那一刻的黄经落位；贴得太近的往里错开一层
  const PL_GLYPH = { sun: "日", moon: "月", mercury: "水", venus: "金", mars: "火", jupiter: "木", saturn: "土", uranus: "天", neptune: "海", pluto: "冥", asc: "升" };
  function ChartWheel({ S, chart }) {
    const W = 300, C = 150, R = 128;
    const ang = lon => (rev(lon) - 90) * Math.PI / 180;
    const keys = PLANETS.map(x => x[0]).concat(chart.lon.asc != null ? ["asc"] : []);
    const placed = [];
    keys.slice().sort((a, b) => rev(chart.lon[a]) - rev(chart.lon[b])).forEach(k => {
      let ring = 0; while (ring < 4 && placed.some(p => p.ring === ring && lonDiff(p.lon, chart.lon[k]) < 11)) ring++;
      placed.push({ k, lon: chart.lon[k], ring });
    });
    return h("svg", { "data-wk": "astrowheel", viewBox: "0 0 " + W + " " + W, style: { width: "min(86%, 300px)", display: "block", margin: "0 auto" } },
      h("circle", { cx: C, cy: C, r: R, fill: "none", stroke: S.line, strokeWidth: 0.8 }),
      h("circle", { cx: C, cy: C, r: R - 24, fill: "none", stroke: S.line, strokeWidth: 0.6 }),
      h("circle", { cx: C, cy: C, r: 34, fill: "none", stroke: S.line, strokeWidth: 0.5, strokeDasharray: "1.5 4" }),
      SIGNS.map((sg, i) => { const a = ang(i * 30), m = ang(i * 30 + 15);
        return h("g", { key: i },
          h("line", { x1: C + Math.cos(a) * (R - 24), y1: C + Math.sin(a) * (R - 24), x2: C + Math.cos(a) * R, y2: C + Math.sin(a) * R, stroke: S.line, strokeWidth: 0.6 }),
          h("text", { x: C + Math.cos(m) * (R - 12), y: C + Math.sin(m) * (R - 12) + 3.5, textAnchor: "middle", fontSize: 9.5, fill: S.fog, fontFamily: F_BODY }, sg[0])); }),
      placed.map(p => { const a = ang(p.lon), rr = R - 38 - p.ring * 15;
        return h("g", { key: p.k },
          h("line", { x1: C + Math.cos(a) * (R - 24), y1: C + Math.sin(a) * (R - 24), x2: C + Math.cos(a) * (rr + 8), y2: C + Math.sin(a) * (rr + 8), stroke: p.k === "asc" ? S.accent : S.tint, strokeWidth: 0.6, opacity: 0.6 }),
          h("circle", { cx: C + Math.cos(a) * rr, cy: C + Math.sin(a) * rr, r: 8.5, fill: S.bg2, stroke: p.k === "asc" ? S.accent : S.tint, strokeWidth: 0.8 }),
          h("text", { x: C + Math.cos(a) * rr, y: C + Math.sin(a) * rr + 3.6, textAnchor: "middle", fontSize: 9.5, fill: S.ink, fontFamily: F_BODY }, PL_GLYPH[p.k])); }),
      h("path", { d: sparkle(C, C, 14), fill: S.tint, opacity: 0.8 }));
  }

  // 出生信息：整页（no-half-sheet），时间＋城市；城市不在列表里的自己填经纬度和时区
  function BirthPage({ S, person, value, onBack, onSave }) {
    const [time, setTime] = useState(value.time || "");
    const [q, setQ] = useState("");
    const [city, setCity] = useState(value.city ? { name: value.city, lat: value.lat, lon: value.lon, tz: value.tz, cc: value.cc } : null);
    const [tzEdit, setTzEdit] = useState(value.tz != null ? String(value.tz) : "");
    const [dstAuto, setDstAuto] = useState(value.dst !== false);
    const [found, setFound] = useState(null);
    const [searching, setSearching] = useState(false);
    const [searchErr, setSearchErr] = useState("");
    const pick = c => { setCity(c); setTzEdit(String(c.tz)); };
    const runSearch = async () => {
      const qq = q.trim(); if (!qq || searching) return;
      setSearching(true); setSearchErr("");
      try { const rows = await searchPlace(qq); setFound(rows); if (!rows.length) setSearchErr("没搜到——换个写法，或者从下面的列表里挑"); }
      catch (e) { setFound(null); setSearchErr("连不上地名搜索，先从下面的列表里挑：" + String((e && e.message) || e).slice(0, 60)); }
      finally { setSearching(false); }
    };
    const [own, setOwn] = useState(!!(value.city && !CITIES.some(c => c[0] === value.city)));
    const [lat, setLat] = useState(own && value.lat != null ? String(value.lat) : "");
    const [lon, setLon] = useState(own && value.lon != null ? String(value.lon) : "");
    const [tz, setTz] = useState(own && value.tz != null ? String(value.tz) : "8");
    const hit = CITIES.filter(c => !q.trim() || c[0].indexOf(q.trim()) >= 0);
    const list = hit.length ? hit : CITIES;    // 搜的是县镇、列表里没有时，常用城市别跟着空掉
    const inSt = { width: "100%", outline: "none", padding: "10px 0", fontFamily: F_BODY, fontSize: 15, background: "transparent", color: S.ink, border: "none", borderBottom: "1px solid " + S.line, colorScheme: "dark" };
    const label = tx => h("div", { className: "flex items-center", style: { gap: 7, margin: "18px 0 4px" } }, h(Spark, { size: 9, color: S.tint }), h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, letterSpacing: ".18em" } }, tx));
    const save = () => {
      const out = {};
      if (/^\d{1,2}:\d{2}$/.test(time)) out.time = time;
      if (own) { const a = parseFloat(lat), b = parseFloat(lon), z = parseFloat(tz); if (isFinite(a) && isFinite(b)) Object.assign(out, { city: "自定", lat: a, lon: b, tz: isFinite(z) ? z : 8 }); }
      else if (city) Object.assign(out, { city: city.name, lat: city.lat, lon: city.lon, tz: isFinite(parseFloat(tzEdit)) ? parseFloat(tzEdit) : city.tz, cc: city.cc || "" });
      if (!dstAuto) out.dst = false;
      onSave(Object.keys(out).length ? out : null);
    };
    return h("div", { "data-wk": "astropage", "data-part": "birthpage", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: STARS, backgroundSize: "320px 380px" } },
      h(Head, { zh: "出生信息", sub: person.name, onBack: onBack, ink: S.ink, bg: "transparent", noLine: true,
        right: h("button", { "data-wk": "block", onClick: save, className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 14, color: S.tint, background: "transparent", border: "none", minHeight: 40 } }, "存") }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "0 20px 28px" } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.7, marginTop: 6 } }, "只存在星测里，不改档案。日期还是用档案里那个生日（要带年份）。"),
        label("几点出生"),
        h("input", { type: "time", value: time, onChange: e => setTime(e.target.value), style: inSt }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 4 } }, "不知道就空着：按正午算，没有上升，月亮可能差一点。"),
        label("在哪儿出生"),
        own ? h("div", null,
          h("input", { "data-wk": "input", value: lat, onChange: e => setLat(e.target.value), placeholder: "纬度（北纬为正，比如 39.9）", inputMode: "decimal", style: inSt }),
          h("input", { "data-wk": "input", value: lon, onChange: e => setLon(e.target.value), placeholder: "经度（东经为正，比如 116.4）", inputMode: "decimal", style: inSt }),
          h("input", { "data-wk": "input", value: tz, onChange: e => setTz(e.target.value), placeholder: "时区（东八区写 8）", inputMode: "decimal", style: inSt }))
          : h("div", null,
            h("div", { className: "flex items-center", style: { gap: 10 } },
              h("input", { "data-wk": "input", value: q, onChange: e => setQ(e.target.value), onKeyDown: e => { if (e.key === "Enter") runSearch(); }, placeholder: city ? "已选：" + city.name + "（输入县、镇、村都行）" : "输入出生的地方：县、镇、村都行", style: Object.assign({}, inSt, { flex: 1 }) }),
              h("button", { "data-wk": "block", onClick: runSearch, disabled: searching || !q.trim(), className: "active:opacity-70 disabled:opacity-40", style: { fontFamily: F_BODY, fontSize: 13.5, color: S.tint, background: "transparent", border: "none", minHeight: 40, padding: "0 4px" } }, searching ? "搜…" : "搜")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 4 } }, "点「搜」会把这个地名发给 OpenStreetMap 查经纬度，只发地名。不想联网就直接在下面列表里挑。"),
            searchErr ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.accent, marginTop: 6 } }, searchErr) : null,
            found && found.length ? h("div", { style: { marginTop: 6 } }, found.map((c, i) => { const on = city && city.lat === c.lat && city.lon === c.lon; return h("button", { key: i, onClick: () => pick(c), className: "active:opacity-70",
              style: { display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left", padding: "8px 0", background: "transparent", border: "none", borderBottom: "1px solid " + S.line } },
              h("span", { style: { marginTop: 3 } }, h(Spark, { size: 8, color: on ? S.tint : S.line })),
              h("span", { style: { flex: 1, minWidth: 0 } },
                h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 13.5, color: on ? S.ink : S.sub, fontWeight: on ? 600 : 400 } }, c.name),
                h("span", { style: { display: "block", fontFamily: F_BODY, fontSize: 10.5, color: S.fog, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.full))); })) : null,
            city ? h("div", { className: "flex items-center", style: { gap: 8, marginTop: 10, fontFamily: F_BODY, fontSize: 12, color: S.sub } },
              h("span", null, city.name + " · " + (city.lat < 0 ? "南纬 " : "北纬 ") + Math.abs(+city.lat).toFixed(2) + " · " + (city.lon < 0 ? "西经 " : "东经 ") + Math.abs(+city.lon).toFixed(2) + " · 时区"),
              h("input", { "data-wk": "input", value: tzEdit, onChange: e => setTzEdit(e.target.value), inputMode: "decimal", style: { width: 46, outline: "none", background: "transparent", color: S.ink, border: "none", borderBottom: "1px solid " + (city.guessed ? S.accent : S.line), fontFamily: F_BODY, fontSize: 13, textAlign: "center" } }),
              null) : null,
            city && city.guessed ? h("div", { style: { fontFamily: F_BODY, color: S.accent, fontSize: 11, marginTop: 4 } }, "这个国家有好几个时区，是按经度猜的，对一下（标准时间，不含夏令时）") : null,
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, margin: "14px 0 2px" } }, "常用城市（不联网）"),
            h("div", { style: { display: "flex", flexWrap: "wrap", gap: "2px 14px", marginTop: 4 } },
              list.map(c => { const on = city && city.name === c[0]; return h("button", { key: c[0], onClick: () => pick({ name: c[0], lat: c[1], lon: c[2], tz: c[3], cc: cityCC(c) }), className: "active:opacity-70",
                style: { display: "flex", alignItems: "center", gap: 4, minHeight: 34, background: "transparent", border: "none", fontFamily: F_BODY, fontSize: 13.5, color: on ? S.ink : S.sub, fontWeight: on ? 600 : 400 } },
                on ? h(Spark, { size: 8, color: S.tint }) : null, c[0]); }))),
        h("button", { "data-wk": "block", onClick: () => setOwn(!own), className: "active:opacity-70", style: { marginTop: 12, fontFamily: F_BODY, fontSize: 12, color: S.tint, background: "transparent", border: "none", borderBottom: "1px dotted " + S.tint, padding: "6px 0 1px" } },
          own ? "从城市列表里选" : "列表里没有 · 自己填经纬度"),
        h("div", { className: "flex items-center justify-between", style: { marginTop: 16, gap: 12 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.6 } }, "自动算中国夏令时", h("div", { style: { fontSize: 10.5, color: S.fog } }, "大陆 1986~1991 年夏天出生的，按钟表上的时间填就行，这边自动换算。国外的夏令时没算。")),
          h("button", { "data-wk": "block", onClick: () => setDstAuto(!dstAuto), "aria-pressed": dstAuto, className: "active:opacity-70 shrink-0", style: { fontFamily: F_BODY, fontSize: 12, color: dstAuto ? S.tint : S.fog, background: "transparent", border: "none", borderBottom: "1px dotted " + (dstAuto ? S.tint : S.line), minHeight: 36 } }, dstAuto ? "开着" : "关了")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 10, lineHeight: 1.7 } }, "古代、架空的角色挑一个最接近的地方就行。"),
        value && (value.time || value.city) ? h("button", { "data-wk": "block", onClick: () => onSave(null), className: "active:opacity-70", style: { marginTop: 22, fontFamily: F_BODY, fontSize: 12.5, color: S.fog, background: "transparent", border: "none" } }, "清掉这份出生信息") : null));
  }

  function AstroApp(props) {
    const S = sky();
    const t = useTheme();
    const chars = (props.characters || []).filter(c => c && !c.isGroup);
    const profile = props.profile || {};
    const meName = profile.name || "我";
    const [tab, setTab] = useState(() => (typeof takeOpenSub === "function" && takeOpenSub("astro", ["today", "chart", "pair", "group"])) || "today");
    const [notes, setNotes] = useState(loadNotes);
    const [busy, setBusy] = useState("");
    const today = dayKeyOf();
    // 「人」：我 + 角色们，统一成 { id, name, birthday, char }
    const people = useMemo(() => [{ id: "me", name: meName, birthday: profile.birthday, char: null }]
      .concat(chars.map(c => ({ id: c.id, name: c.remark || c.name, birthday: c.birthday, char: c }))), [chars.length, profile.birthday, meName]);
    const byId = id => people.find(p => p.id === id) || people[0];
    const [pa, setPa] = useState("me");
    const [pb, setPb] = useState(chars[0] ? chars[0].id : "me");
    const [commenter, setCommenter] = useState(chars[0] ? chars[0].id : "");
    // 出生时间、城市：只存在星测自己这儿（x_astro_birth），不改档案（她 2026-10-03：「不能就在星测里面设置城市啥的吗」）
    const [birth, setBirth] = useState(loadBirth);
    const [editing, setEditing] = useState("");
    const [chartWho, setChartWho] = useState(chars[0] ? chars[0].id : "me");   // 星盘页看谁
    const groups = (props.groups || []).filter(gp => gp && (gp.memberIds || []).length >= 2);
    const [gid, setGid] = useState(groups[0] ? groups[0].id : "");
    const [askText, setAskText] = useState("");
    const [asks, setAsks] = useState(loadAsks);
    const [signs, setSigns] = useState(() => loadJSON(SIGN_KEY, {}) || {});
    const [moonTick, setMoonTick] = useState(0);
    // 今日签：手动抽一张（跟自动那一路同一份提示词）
    const drawSign = async c => {
      const key = "sign|" + today + "|" + c.id;
      if (busy) return;
      const p = props.apiFor ? props.apiFor(c.id) : null, ctx = props.ctxFor ? props.ctxFor(c) : null;
      if (!p || !ctx || typeof runProbe !== "function") { props.toast && props.toast("先到设置配置 API"); return; }
      const facts = todayFacts(profile, birth, today); if (!facts) { props.toast && props.toast("先填上你的生日"); return; }
      setBusy(key);
      try {
        const prev = signs[key];
        const d = await runProbe(p, ctx, { voice: true, tag: "astro", instruction: signInstruction(meName, facts) + (prev ? "\n〔重抽〕上一张写的是「" + prev.title + "：" + prev.text + "」，这张换一个。" : "") + voiceTail(), schemaHint: SIGN_SCHEMA, maxTokens: 65000 });
        if (!d || !String(d.title || d.text || "").trim()) throw new Error("TA 这回没抽出来，再点一次");
        const next = Object.assign({}, signs, { [key]: { title: String(d.title || "").trim().slice(0, 12), text: String(d.text || "").trim().slice(0, 120), by: c.remark || c.name, ts: Date.now() } });
        const ks = Object.keys(next).sort((a, b) => (next[b].ts || 0) - (next[a].ts || 0)); ks.slice(60).forEach(k => delete next[k]);
        setSigns(next); saveJSON(SIGN_KEY, next);
      } catch (e) { props.toast && props.toast("没抽成：" + String((e && e.message) || e).slice(0, 120)); }
      finally { setBusy(""); }
    };
    const chartOf = p => p ? natalChart(p.birthday, birth[p.id]) : null;
    const birthLink = p => {
      const b = birth[p.id];
      const label = b && (b.time || b.city) ? [b.time, b.city].filter(Boolean).join(" · ") : "填出生时间和城市";
      return h("button", { onClick: () => setEditing(p.id), className: "active:opacity-70",
        style: { fontFamily: F_BODY, fontSize: 11, color: b ? S.sub : S.tint, background: "transparent", border: "none", borderBottom: "1px dotted " + (b ? S.line : S.tint), padding: "6px 0 1px", minHeight: 30 } }, label);
    };

    const missing = (p) => h("button", { onClick: () => p.char ? props.onEditChar && props.onEditChar(p.char) : props.onEditProfile && props.onEditProfile(),
      className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: S.tint, background: "transparent", border: "none", borderBottom: "1px dashed " + S.tint, padding: "6px 0 2px", marginTop: 4, minHeight: 32 } },
      (p.id === "me" ? "还不知道你的生日" : "还不知道 " + p.name + " 的生日") + " · 去填");

    const ask = async (key, char, instruction) => {
      if (!char || busy) return;
      const p = props.apiFor ? props.apiFor(char.id) : null;
      const ctx = props.ctxFor ? props.ctxFor(char) : null;
      if (!p || !ctx || typeof runProbe !== "function") { props.toast && props.toast("先到设置配置 API"); return; }
      setBusy(key);
      try {
        // 「再看看」＝重 Roll：把上一回的话给 TA，别换个说法再说一遍（她 2026-10-03 问配对能不能重 roll）
        const prev = notes[key] && notes[key].text;
        const reroll = prev ? "\n〔重看〕你上一回看完说的是：『" + String(prev).slice(0, 300) + "』。这回重新看一遍，别把同一番话换个说法再说，换个你在意的点，或者干脆改主意。" : "";
        const d = await runProbe(p, ctx, { voice: true, instruction: instruction + reroll + voiceTail(), schemaHint: "{\"text\":\"你想对她说的话\"}", maxTokens: 65000, tag: "astro" });
        const txt = String((d && d.text) || "").trim();
        if (!txt) throw new Error("TA 这回没说出话来，再点一次");
        setNotes(saveNote(key, txt));
      } catch (e) { props.toast && props.toast("没看成：" + String((e && e.message) || e).slice(0, 120)); }
      finally { setBusy(""); }
    };

    const noteBox = (key, char) => {
      const n = notes[key];
      return n ? h("div", { "data-wk": "astronote", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
        h("div", { className: "flex items-center gap-2", style: { marginBottom: 6 } },
          char && typeof Avatar !== "undefined" ? h(Avatar, { character: char, size: 22, radius: 7 }) : null,
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: S.sub } }, (char ? (char.remark || char.name) : "TA") + " 看了看")),
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: S.ink, lineHeight: 1.7, whiteSpace: "pre-wrap", userSelect: "text", WebkitUserSelect: "text" } }, n.text)) : null;
    };
    const askBtn = (key, char, instruction, label) => char ? h("button", { onClick: () => ask(key, char, instruction), disabled: !!busy, className: "active:opacity-80 disabled:opacity-50",
      style: { marginTop: 10, width: "100%", minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent", border: "none",
        borderTop: "1px solid " + S.line, color: S.tint, fontFamily: F_BODY, fontSize: 13.5, letterSpacing: ".06em" } },
      h(Spark, { size: 9, color: S.tint }),
      busy === key ? (char.remark || char.name) + " 在看…" : (notes[key] ? "让 " + (char.remark || char.name) + " 再看看" : (label || "让 " + (char.remark || char.name) + " 看看")),
      h(Spark, { size: 9, color: S.tint })) : null;

    const pickRow = (list, val, set, label) => h("div", { style: { marginBottom: 10 } },
      label ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginBottom: 6 } }, label) : null,
      h("div", { style: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 } },
        // 一个人就是一颗星：头像外一圈光，选中的那颗亮、名字上墨；没选的暗着（tabs-not-plain-pills：不是一排药丸）
        list.map(p => { const on = val === p.id; return h("button", { key: p.id, onClick: () => set(p.id), "aria-pressed": on, className: "active:opacity-70 shrink-0",
          style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 56, padding: "4px 2px", background: "transparent", border: "none", color: on ? S.ink : S.fog, fontFamily: F_BODY, fontSize: 11.5 } },
          h("span", { style: { display: "inline-flex", borderRadius: 999, padding: 2, boxShadow: on ? "0 0 0 1.5px " + S.tint + ", 0 0 16px " + S.tint + "88" : "none", opacity: on ? 1 : 0.62, transition: "all .2s" } },
            typeof Avatar !== "undefined" ? h(Avatar, { character: p.char || { name: p.name, avatarImage: profile.avatarImage, color: profile.color || "#8a8fb5" }, size: 38, radius: 999 }) : null),
          h("span", { style: { maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)); })));

    // ---- 今日 ----
    const meInfo = birthInfo(profile.birthday);
    const day0 = meInfo && meInfo.sign >= 0 ? daily(meInfo.sign, today) : null;
    // 有星盘就按行运算几颗星和那一句；幸运色、幸运数字照旧按日子（那两样本来就没有天文上的说法）
    const meChart = chartOf(people[0]);
    const tr = day0 && meChart ? transits(meChart, new Date()) : null;
    const day = !day0 ? null : !tr ? day0 : Object.assign({}, day0, { all: tr.all, love: tr.love, work: tr.work, money: tr.money,
      line: tr.hits.length ? transitLine(tr.hits[0]) + "。" : "今天天上没有哪颗星贴近你的星盘，平平稳稳的一天。" });
    const chartRows = (chart) => h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "4px 14px", fontFamily: F_BODY, fontSize: 12.5 } },
      PLANETS.map(x => x[0]).concat(chart.lon.asc != null ? ["asc"] : []).map(k => {
        const sd = signDeg(chart.lon[k]);
        return h("div", { key: k, className: "flex justify-between", style: { padding: "5px 0", borderBottom: "1px solid " + S.line } },
          h("span", { style: { color: S.sub } }, PL_ZH[k]),
          h("span", { style: { color: S.ink } }, SIGNS[sd.sign][0] + " " + sd.deg + "°" + (k === "moon" && chart.moonUnsure ? "？" : "")));
      }));
    const chartNote = chart => chart.dst ? "那天大陆在实行夏令时，已自动按东九区换算。" : !chart.hasPlace ? "没填出生城市，按东八区算；没有上升。" : !chart.hasTime ? "没填出生时间，按当天正午算：没有上升，月亮可能差一点。" : "";
    const todayView = h("div", { className: "flex flex-col" },
      h(ZodiacWheel, { S: S, sign: meInfo ? meInfo.sign : -1 }),
      h(Panel, { S: S, title: "今日" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, today.replace(/-/g, " · ") + " · " + meName),
        skyNote(new Date()) ? h("div", { "data-wk": "astrosky", style: { fontFamily: F_BODY, fontSize: 12, color: S.tint, marginTop: 4 } }, "今天的天象：" + skyNote(new Date())) : null,
        !day ? h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: S.ink, marginTop: 4 } }, "还算不出你今天的运势"), missing(people[0])) : h("div", null,
          h("div", { className: "flex items-baseline justify-between", style: { marginTop: 4 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: S.ink } }, signName(meInfo.sign) + (meInfo.signApprox ? "（约）" : "")),
            h(Stars, { n: day.all, color: S.tint })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: S.ink, lineHeight: 1.7, marginTop: 8 } }, day.line),
          tr && tr.hits.length > 1 ? h("div", { style: { marginTop: 8 } }, tr.hits.slice(1, 4).map((x, i) => h("div", { key: i, className: "flex items-center", style: { gap: 7, fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.8 } },
            h(Spark, { size: 7, color: x.asp.tone < 0 ? S.accent : S.tint, op: 0.7 }), transitLine(x)))) : null,
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, tr ? "按今天天上的行星和你的星盘算" : "只按星座和日期算 · 填上带年份的生日和出生信息会按行运算"),
          h("div", { style: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", marginTop: 12, fontFamily: F_BODY, fontSize: 12.5, color: S.sub, alignItems: "center" } },
            "爱情", h(Stars, { n: day.love, color: S.accent }), "事业", h(Stars, { n: day.work, color: S.accent }), "财运", h(Stars, { n: day.money, color: S.accent })),
          h("div", { className: "flex gap-3", style: { marginTop: 14 } },
            h("div", { "data-wk": "astrolucky", style: { flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "6px 0" } },
              h("span", { style: { width: 28, height: 28, borderRadius: 99, background: day.color.hex, boxShadow: "0 0 0 3px " + S.bg + "," + "0 0 12px " + day.color.hex } }),
              h("div", null, h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog } }, "幸运色"), h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink } }, day.color.name))),
            h("div", { style: { width: 92, padding: "6px 0 6px 14px", borderLeft: "1px solid " + S.line } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog } }, "幸运数字"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: S.ink } }, day.number))))),
      h(Panel, { S: S, title: "你的星盘" },
        meChart ? h("div", null, chartRows(meChart), chartNote(meChart) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, chartNote(meChart)) : null)
          : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: S.sub, lineHeight: 1.7 } }, birthDateOf(profile.birthday) ? "" : "生日要带上年份（比如 1999-05-08）才排得出星盘。"),
        h("div", null, birthLink(people[0]))),
      day && chars.length ? h(Panel, { S: S, title: "让谁看看" },
        pickRow(people.filter(p => p.char), commenter, setCommenter, ""),
        (() => {
          const c = (byId(commenter) || {}).char;
          if (!c) return null;
          const ci = birthInfo(c.birthday);
          const key = "day|" + today + "|" + c.id;
          const ins = meName + "把她今天的星座运势拿给你看（这是按星座和日期算出来的，不是你编的）：\n"
            + "她是" + signName(meInfo.sign) + "；综合 " + day.all + " 星，爱情 " + day.love + "、事业 " + day.work + "、财运 " + day.money + " 星；幸运色" + day.color.name + "，幸运数字 " + day.number + "；那一句是「" + day.line + "」。\n"
            + (tr && tr.hits.length ? "今天的行运：" + tr.hits.slice(0, 4).map(transitLine).join("；") + "。\n" : "")
            // 配对那一句不放这儿（她 2026-10-03：「今日说说怎么还能看见配对的信息」）——配对有自己那一页，今日就只说今日
            + (ci && ci.sign >= 0 ? "你是" + signName(ci.sign) + "。" : "") + "\n"
            + "看完说说你的想法。信不信星座、当不当真、顺着哪一点说，全由你这个人决定。";
          return h("div", null, noteBox(key, c), askBtn(key, c, ins));
        })()) : null,
      // 今日签：挑个人替你抽，抽完能转发回你们的聊天
      day && chars.length ? h(Panel, { S: S, title: "今日签" }, (() => {
        const c = (byId(commenter) || {}).char; if (!c) return pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁替你抽");
        const key = "sign|" + today + "|" + c.id, got = signs[key];
        return h("div", null, pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁替你抽"),
          got ? h("div", { style: { display: "flex", justifyContent: "center", margin: "6px 0 4px" } }, h(AstroSignCard, { m: { astro: got } })) : null,
          h("div", { className: "flex", style: { gap: 8, marginTop: 8 } },
            h("button", { "data-wk": "block", onClick: () => drawSign(c), disabled: !!busy, className: "active:opacity-80 disabled:opacity-50", style: { flex: 1, minHeight: 44, background: "transparent", border: "1px solid " + S.tint, borderRadius: 3, color: S.tint, fontFamily: F_BODY, fontSize: 13.5 } },
              busy === key ? (c.remark || c.name) + " 在抽…" : got ? "再抽一张" : "让 " + (c.remark || c.name) + " 抽一张"),
            got && props.onShareSign ? h("button", { "data-wk": "block", onClick: () => props.onShareSign(c, got), className: "active:opacity-80", style: { flex: 1, minHeight: 44, background: S.tint, border: "none", borderRadius: 3, color: S.bg, fontFamily: F_BODY, fontSize: 13.5 } }, "转发回聊天") : null));
      })()) : null,
      // 月亮日记
      h(Panel, { S: S, title: "月亮日记" }, (() => {
        const ms = moonSignOn(today), H = g.Health, hd = H && H.load ? H.load() : null, mine = hd && hd.mood ? hd.mood[today] : null, MZ = (H && H.MOOD_ZH) || ["很糟", "低落", "一般", "不错", "很好"];
        const setMood = (v, note) => { if (!H) return; const d0 = H.load(); d0.mood = Object.assign({}, d0.mood, { [today]: Object.assign({}, (d0.mood || {})[today] || {}, v != null ? { v } : {}, note != null ? { note: String(note).slice(0, 60) } : {}) }); H.save(d0); setMoonTick(x => x + 1); try { g.dispatchEvent(new CustomEvent("qq-health-updated")); } catch (e) {} };
        const days = []; for (let i = 13; i >= 0; i--) { const dk = dayKeyOf(new Date(Date.now() - i * 864e5)); days.push({ dk, ms: moonSignOn(dk), mood: hd && hd.mood && hd.mood[dk] }); }
        return h("div", { "data-wk": "astromoon" },
          h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink, lineHeight: 1.7 } }, "今天月亮在" + SIGNS[ms][0] + "座 · 「" + MOON_WORD[ms] + "」"),
          h("div", { className: "flex", style: { gap: 6, marginTop: 10 } }, MZ.map((z, v) => { const on = mine && mine.v === v;
            return h("button", { "data-wk": "block", key: v, onClick: () => setMood(v), "aria-pressed": on, className: "active:opacity-70", style: { flex: 1, minHeight: 40, background: on ? S.tint : "transparent", color: on ? S.bg : S.sub, border: "1px solid " + (on ? S.tint : S.line), borderRadius: 3, fontFamily: F_BODY, fontSize: 12 } }, z); })),
          h("input", { "data-wk": "input", defaultValue: (mine && mine.note) || "", key: today + "|" + moonTick, placeholder: "今天心里是什么样子（跟健康 app 的心情是同一格）", onBlur: e => setMood(null, e.target.value), "aria-label": "今天的心情",
            style: { width: "100%", minWidth: 0, minHeight: 40, marginTop: 8, padding: "8px 10px", background: "transparent", border: "1px solid " + S.line, borderRadius: 3, color: S.ink, fontFamily: F_BODY, fontSize: 13 } }),
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 12 } }, days.map(x => h("div", { key: x.dk, title: x.dk, style: { textAlign: "center", padding: "6px 0", borderRadius: 3, background: x.dk === today ? S.bg2 : "transparent" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: S.fog } }, x.dk.slice(8)),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.sub, marginTop: 2 } }, SIGNS[x.ms][0]),
            h("div", { "data-wk": "block", style: { width: 7, height: 7, borderRadius: 99, margin: "4px auto 0", background: x.mood && x.mood.v != null ? [S.accent, S.accent, S.fog, S.tint, S.tint][x.mood.v] : "transparent", border: x.mood && x.mood.v != null ? "none" : "1px solid " + S.line, opacity: x.mood && x.mood.v != null ? 0.4 + x.mood.v * 0.15 : 1 } })))),
          h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, "两周里月亮走过的星座和你的心情，翻回来看看对不对得上"));
      })()));

    // ---- 配对 ----
    const A = byId(pa), B = byId(pb);
    const ai = birthInfo(A.birthday), bi = birthInfo(B.birthday);
    const sm = ai && bi ? signMatch(ai.sign, bi.sign) : null;
    const sr = ai && bi ? shukuRelation(ai.shuku, bi.shuku) : null;
    const syn = synastry(chartOf(A), chartOf(B));
    const pairChar = A.char || B.char;          // 谁来点评：左边是角色就左边，否则右边那位
    const pairOther = pairChar === A.char ? B : A;
    const pairKey = "pair|" + [A.id, B.id].join("~") + "|" + (pairChar ? pairChar.id : "");
    const whoLine = (p, info) => h("div", { style: { flex: 1, textAlign: "center" } },
      typeof Avatar !== "undefined" ? h("div", { style: { display: "flex", justifyContent: "center" } }, h(Avatar, { character: p.char || { name: p.name, avatarImage: profile.avatarImage, color: profile.color || "#8a8fb5" }, size: 44, radius: 999 })) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink, marginTop: 6 } }, p.name),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: S.sub, marginTop: 2 } },
        info && info.sign >= 0 ? signName(info.sign) + (info.signApprox ? "（约）" : "") : "星座未知",
        " · ", info && info.shuku >= 0 ? SHUKU[info.shuku] + "宿" : "宿未知"),
      info ? h("div", null, birthLink(p)) : null,
      !info ? missing(p) : (info.shukuNeedsYear ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 4 } }, "生日带上年份才算得出宿") : null));
    const pairView = h("div", { className: "flex flex-col" },
      h(Panel, { S: S, title: "挑两个人" },
        pickRow(people, pa, setPa, "左边"),
        pickRow(people, pb, setPb, "右边"),
        pa === pb ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.fog } }, "两边选了同一个人——换一个再看") : null),
      pa === pb ? null : h(Panel, { S: S, title: "两颗星之间" },
        h("div", { className: "flex items-start" }, whoLine(A, ai),
          h("div", { style: { alignSelf: "center", textAlign: "center", padding: "0 4px" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 26, color: S.tint } }, syn ? syn.score : sm ? sm.score : "?"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: S.fog } }, syn ? "合盘" : "星座")),
          whoLine(B, bi)),
        // 合盘：两张星盘之间合得最紧的那几组（她要的「更严谨」那一层）
        h("div", { "data-wk": "astrosyn", style: { marginTop: 14, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "合盘（两张星盘之间的相位）"),
          syn ? h("div", { style: { marginTop: 4 } },
            syn.list.length ? syn.list.slice(0, 6).map((x, i) => h("div", { key: i, className: "flex items-center", style: { gap: 8, fontFamily: F_BODY, fontSize: 13, color: S.ink, lineHeight: 1.9 } },
              h(Spark, { size: 8, color: x.tone < 0 ? S.accent : S.tint, op: 0.85 }),
              h("span", null, synLine(x, A.name, B.name)),
              h("span", { style: { color: S.fog, fontSize: 11 } }, x.tone > 0 ? "顺" : x.tone < 0 ? "磨" : ""))) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "两张盘之间没什么贴得近的相位——不怎么互相牵动。"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, "金色是顺的，粉色是磨的；" + ([chartOf(A), chartOf(B)].some(c => !c.hasTime) ? "有人没填出生时间，月亮和上升没全算进去。" : "两个人的出生时间都在。")))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4, lineHeight: 1.7 } }, "两个人都要有带年份的生日才合得了盘；再填上出生时间和城市会更准。")),
        h("div", { "data-wk": "astrosign", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "星座配对"),
          sm ? h("div", null,
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: S.ink, marginTop: 2 } }, sm.aspect + " · " + sm.score),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7, marginTop: 4 } }, sm.note))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "两个人的星座都知道了才能配")),
        h("div", { "data-wk": "astroshuku", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "星宿关系（宿曜）"),
          sr ? h("div", null,
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: S.ink, marginTop: 2 } }, (sr.pair === "命" ? "命命" : sr.pair) + (sr.distance ? " · " + sr.distance : "")),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, marginTop: 2 } }, sr.pair === "命" ? "同一个宿" : A.name + " 是 " + B.name + " 的「" + sr.theirs + "」，" + B.name + " 是 " + A.name + " 的「" + sr.mine + "」"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7, marginTop: 4 } }, sr.note))
            : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "两个人的本命宿都算得出来才能看")),
        // 你俩的好日子（第 6 条）：接下来一个月里，行运对两个人都顺的那三天。日历上也会标出来，TA 也知道
        h("div", { "data-wk": "astrogood", style: { marginTop: 12, paddingTop: 12, borderTop: "1px dashed " + S.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "星星点头的日子（接下来一个月）"),
          (() => { const gd = goodDays(chartOf(A), chartOf(B), new Date(), 30);
            if (!chartOf(A) || !chartOf(B)) return h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "两个人都排得出星盘才算得出来（生日要带年份）");
            if (!gd.length) return h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, marginTop: 4 } }, "这一个月天上没给你俩特别的好日子——那就哪天都行");
            return h("div", { className: "flex", style: { gap: 8, marginTop: 6 } }, gd.map(x => h("div", { key: x.day, style: { flex: 1, textAlign: "center", padding: "8px 0", border: "1px solid " + S.line, borderRadius: 3 } },
              h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: S.tint } }, x.day.slice(5).replace("-", ".")),
              h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: S.fog, marginTop: 2 } }, "周" + "日一二三四五六"[noonOf(x.day).getDay()])))); })(),
          (A.id === "me" || B.id === "me") && pairChar ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, "这几天也会标在 " + (pairChar.remark || pairChar.name) + " 的日历上，TA 也知道。") : null),
        pairChar && (sm || sr || syn) ? (() => {
          const ins = "这是按生日算出来的「你」和「" + pairOther.name + "」的配对（不是你编的）：\n"
            + (sm ? "星座：你是" + signName((pairChar === A.char ? ai : bi).sign) + "，" + pairOther.name + "是" + signName((pairChar === A.char ? bi : ai).sign) + "，「" + sm.aspect + "」，配对指数 " + sm.score + "。\n" : "")
            + (sr ? "宿曜：" + (sr.pair === "命" ? "你俩同一个宿（命命）" : "你俩是「" + sr.pair + "」" + (sr.distance ? "（" + sr.distance + "）" : "")) + "。\n" : "")
            + (syn && syn.list.length ? "合盘（" + syn.score + "）里最紧的几组：" + syn.list.slice(0, 5).map(x => synLine(x, pairChar === A.char ? "你" : A.name, pairChar === B.char ? "你" : B.name)).join("；") + "。\n" : "")
            + (pairOther.id === "me" ? meName + "把这个拿给你看。" : meName + "把你和" + pairOther.name + "的这份配对拿给你看。") + "\n"
            + "说说你怎么看。当真不当真、顺着哪一点说、要不要反驳，全由你这个人和你们的关系决定。";
          return h("div", null, noteBox(pairKey, pairChar), askBtn(pairKey, pairChar, ins));
        })() : null));

    // ---- 星盘（第 1、5 条）：一张真的盘 + 这一年（太阳回归）+ 让 TA 看看 ----
    const CP = byId(chartWho), cChart = chartOf(CP);
    const yr = (() => { if (!cChart) return null; const now = new Date(); const sr0 = solarReturn(cChart, now.getFullYear());
      return sr0 && sr0.when > new Date(now.getTime() + 15 * 864e5) ? solarReturn(cChart, now.getFullYear() - 1) : sr0; })();
    const nearBday = yr && Math.abs(new Date() - yr.when) < 7 * 864e5;
    const chartReader = CP.char || (byId(commenter) || {}).char;
    const chartFacts = cChart ? KEYS_FOR(cChart).map(k => { const sd = signDeg(cChart.lon[k]); return PL_ZH[k] + "在" + SIGNS[sd.sign][0] + "座"; }).join("、") : "";
    const chartView = h("div", { className: "flex flex-col" },
      h(Panel, { S: S, title: "看谁的盘" }, pickRow(people, chartWho, setChartWho, "")),
      h(Panel, { S: S, title: CP.name + " 的星盘" },
        cChart ? h("div", null, h(ChartWheel, { S: S, chart: cChart }), h("div", { style: { marginTop: 8 } }, chartRows(cChart)),
          h("div", { style: { marginTop: 8 } }, KEYS_FOR(cChart).slice(0, 7).map(k => h("div", { key: k, style: { fontFamily: F_BODY, fontSize: 12, color: S.sub, lineHeight: 1.8 } },
            h("span", { style: { color: S.tint } }, PL_ZH[k]), " 管" + PL_THEME[k]))),
          chartNote(cChart) ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, chartNote(cChart)) : null)
          : h("div", null, h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7 } }, "生日要带上年份才排得出星盘。"), birthDateOf(CP.birthday) ? null : missing(CP)),
        h("div", null, birthLink(CP)),
        cChart && !CP.char && chars.length ? h("div", { style: { marginTop: 10 } }, pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁看你的盘")) : null,
        cChart && chartReader ? (() => {
          const key = "natal|" + CP.id + "|" + chartReader.id;
          const ins = (CP.char ? "这是按你的生日算出来的你自己的星盘（不是你编的）：" : meName + "把她自己的星盘拿给你看（按她的生日算的）：") + chartFacts + "。\n"
            + (CP.char ? "看看你自己的盘，说说你的想法：对得上就对得上，对不上、不信、觉得好笑，都照你自己来。" : "说说你怎么看她的盘。信不信、顺着哪一点说，全由你这个人决定。");
          return h("div", null, noteBox(key, chartReader), askBtn(key, chartReader, ins, CP.char ? "让 " + (CP.char.remark || CP.char.name) + " 看看自己的盘" : null));
        })() : null),
      yr ? h(Panel, { S: S, title: (nearBday ? "生日这周 · " : "") + CP.name + " 的这一年" },
        h("div", { "data-wk": "astroyear", style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, "从 " + yr.day.replace(/-/g, ".") + " 太阳回到出生那一刻的位置算起（太阳回归）"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink, lineHeight: 1.8, marginTop: 6 } }, "这一年的月亮落在" + SIGNS[yr.moonSign][0] + "座——心里那块地方，这一年是" + SIGNS[yr.moonSign][0] + "座的样子。"),
        yr.list.slice(0, 4).map((x, i) => h("div", { key: i, className: "flex items-center", style: { gap: 7, fontFamily: F_BODY, fontSize: 12.5, color: S.sub, lineHeight: 1.9 } },
          h(Spark, { size: 7, color: x.tone < 0 ? S.accent : S.tint, op: 0.8 }), yearLine(x))),
        chartReader ? (() => {
          const key = "year|" + CP.id + "|" + yr.day + "|" + chartReader.id;
          const ins = (CP.char ? "这是按你的生日算的你这一年的运（太阳回归，从 " + yr.day + " 起）：" : meName + "把她这一年的运拿给你看（太阳回归，从 " + yr.day + " 起）：")
            + "这一年的月亮在" + SIGNS[yr.moonSign][0] + "座；" + yr.list.slice(0, 4).map(yearLine).join("；") + "。\n" + (nearBday ? "这几天正好是" + (CP.char ? "你" : "她") + "的生日前后。" : "") + "说说你的想法，怎么说全由你自己。";
          return h("div", null, noteBox(key, chartReader), askBtn(key, chartReader, ins));
        })() : null) : null);

    // ---- 群榜（第 2 条）：一个群里两两配对，最合的、最冲的。全靠算 ----
    const G = groups.find(x => x.id === gid) || null;
    const gPeople = G ? [people[0]].concat((G.memberIds || []).map(id => people.find(p => p.id === id)).filter(Boolean)) : [];
    const gPairs = [];
    for (let i = 0; i < gPeople.length; i++) for (let j = i + 1; j < gPeople.length; j++) {
      const a = gPeople[i], b = gPeople[j], ia = birthInfo(a.birthday), ib = birthInfo(b.birthday);
      const syn2 = synastry(chartOf(a), chartOf(b)), sm2 = ia && ib ? signMatch(ia.sign, ib.sign) : null;
      const sc = syn2 ? syn2.score : sm2 ? sm2.score : null;
      if (sc != null) gPairs.push({ a, b, score: sc, by: syn2 ? "合盘" : "星座", why: syn2 && syn2.list[0] ? synLine(syn2.list[0], a.name, b.name) : sm2 ? sm2.aspect : "" });
    }
    gPairs.sort((x, y) => y.score - x.score);
    const unknown = gPeople.filter(p => !birthInfo(p.birthday));
    const rankRow = (x, i, tone) => h("div", { key: x.a.id + x.b.id, "data-wk": "astrorank", className: "flex items-center", style: { gap: 10, padding: "9px 0", borderBottom: "1px solid " + S.line } },
      h("div", { style: { width: 22, fontFamily: F_DISPLAY, fontSize: 15, color: tone } }, i + 1),
      h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: S.ink } }, x.a.name + " × " + x.b.name),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, x.by + (x.why ? " · " + x.why : ""))),
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: tone } }, x.score));
    const groupView = h("div", { className: "flex flex-col" },
      !groups.length ? h(Panel, { S: S, title: "群榜" }, h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "还没有群——建个群再来排。"))
        : h(Panel, { S: S, title: "哪个群" }, h("div", { style: { display: "flex", gap: 8, overflowX: "auto" } }, groups.map(gp => { const on = gp.id === gid;
          return h("button", { key: gp.id, onClick: () => setGid(gp.id), "aria-pressed": on, className: "active:opacity-70 shrink-0",
            style: { minHeight: 40, padding: "0 12px", background: "transparent", border: "none", borderBottom: "2px solid " + (on ? S.tint : "transparent"), color: on ? S.ink : S.fog, fontFamily: F_BODY, fontSize: 13 } }, gp.name || "群"); }))),
      G ? h(Panel, { S: S, title: "最合的" }, gPairs.length ? gPairs.slice(0, 3).map((x, i) => rankRow(x, i, S.tint)) : h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub } }, "生日都不知道，排不了")) : null,
      G && gPairs.length > 3 ? h(Panel, { S: S, title: "最冲的" }, gPairs.slice(-Math.min(2, gPairs.length - 3)).reverse().map((x, i) => rankRow(x, i, S.accent)),
        // 星座吵架（第 7 条）：她在群里起个头，最冲的那一对照着星盘吵——群里照常接话，会调一次群聊
        (() => { const low = gPairs[gPairs.length - 1]; if (!props.onShareToGroup || low.a.id === "me" || low.b.id === "me") return null;
          return h("button", { onClick: () => props.onShareToGroup(G.id, "〔星测〕群榜上最冲的是 " + low.a.name + " 和 " + low.b.name + "（" + low.score + " 分" + (low.why ? "：" + low.why : "") + "）——你俩照着星盘吵一架给我看看？"),
            className: "active:opacity-80", style: { width: "100%", minHeight: 44, marginTop: 10, background: "transparent", border: "1px dashed " + S.accent, borderRadius: 3, color: S.accent, fontFamily: F_BODY, fontSize: 13.5 } },
            "让 " + low.a.name + " 和 " + low.b.name + " 在群里吵一架"); })()) : null,
      G && unknown.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, padding: "0 4px 8px" } }, "不知道生日、没排进来的：" + unknown.map(p => p.name).join("、")) : null,
      G && gPairs.length && props.onShareToGroup ? h("button", { onClick: () => {
          const top = gPairs[0], low = gPairs.length > 1 ? gPairs[gPairs.length - 1] : null;
          props.onShareToGroup(G.id, "〔星测 · 群配对榜〕最合：" + gPairs.slice(0, 3).map(x => x.a.name + "×" + x.b.name + " " + x.score).join("、") + (low && low !== top ? "；最冲：" + low.a.name + "×" + low.b.name + " " + low.score : "") + "。按生日算的，图个乐～");
        }, className: "active:opacity-80", style: { width: "100%", minHeight: 44, background: "transparent", border: "1px solid " + S.tint, borderRadius: 3, color: S.tint, fontFamily: F_BODY, fontSize: 13.5, marginTop: 4 } }, "发到「" + (G.name || "群") + "」里，让大家看看") : null);

    // ---- 问星（第 4 条）：写一件事，按今天的行运抽一句；同一天同一问，答案不变 ----
    const lastAsk = asks[0] && asks[0].day === today ? asks[0] : null;
    const doAsk = () => {
      const res = askStars(askText, meChart, meInfo ? meInfo.sign : -1, today);
      if (!res) { props.toast && props.toast(askText.trim() ? "先填上你的生日才问得了星星" : "先写下想问的事"); return; }
      const next = [res].concat(asks.filter(x => !(x.q === res.q && x.day === res.day))).slice(0, 12);
      setAsks(next); try { saveJSON(ASK_KEY, next); } catch (e) {}
      setAskText("");
    };
    const askView = h("div", { className: "flex flex-col" },
      h(Panel, { S: S, title: "问星星一件事" },
        h("textarea", { "data-wk": "textarea", value: askText, onChange: e => setAskText(e.target.value), rows: 3, placeholder: "比如：这周适合跟他表白吗？", "aria-label": "想问的事",
          style: { width: "100%", minWidth: 0, padding: 12, borderRadius: 3, border: "1px solid " + S.line, background: "transparent", color: S.ink, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6 } }),
        h("button", { "data-wk": "block", onClick: doAsk, className: "active:opacity-80", style: { width: "100%", minHeight: 44, marginTop: 8, background: S.tint, color: S.bg, border: "none", borderRadius: 3, fontFamily: F_BODY, fontSize: 14, letterSpacing: ".1em" } }, "抽一句"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 6 } }, meChart ? "按今天天上的行星和你的星盘挑；同一天同一个问题，答案不会变" : "没有带年份的生日，只按星座的日运来")),
      lastAsk ? h(Panel, { S: S, title: "星星说" },
        h("div", { "data-wk": "astroask", style: { fontFamily: F_BODY, fontSize: 12, color: S.fog } }, "「" + lastAsk.q + "」 · 问的是" + lastAsk.area),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 24, color: S.tint, marginTop: 6 } }, lastAsk.verdict),
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: S.sub, lineHeight: 1.7, marginTop: 4 } }, lastAsk.line),
        chars.length ? h("div", { style: { marginTop: 10 } }, pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁看看")) : null,
        (() => { const c = (byId(commenter) || {}).char; if (!c) return null;
          const key = "ask|" + today + "|" + lastAsk.q.slice(0, 40) + "|" + c.id;
          const ins = meName + "拿一件事问了星星：「" + lastAsk.q + "」。按今天的行运抽出来的是「" + lastAsk.verdict + "」（" + lastAsk.line + "）。这是算出来的，不是你编的。\n她把这个拿给你看。说说你怎么想——问的是什么事、你信不信、要不要接她这个话，全由你这个人决定。";
          return h("div", null, noteBox(key, c), askBtn(key, c, ins)); })()) : null,
      asks.filter(x => x !== lastAsk).length ? h(Panel, { S: S, title: "问过的" }, asks.filter(x => x !== lastAsk).slice(0, 8).map((x, i) => h("div", { key: i, style: { padding: "7px 0", borderBottom: "1px solid " + S.line } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: S.ink } }, x.q),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginTop: 2 } }, x.day.replace(/-/g, ".") + " · " + x.verdict)))) : null);

    if (editing) return h(BirthPage, { S: S, person: byId(editing), value: birth[editing] || {}, onBack: () => setEditing(""),
      onSave: v => { const all = Object.assign({}, loadBirth()); if (v) all[editing] = v; else delete all[editing]; setBirth(saveBirth(all)); setEditing(""); } });
    const tabs = [["today", "今日"], ["pair", "配对"], ["chart", "星盘"], ["group", "群榜"], ["ask", "问星"]];
    return h("div", { "data-wk": "app", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: STARS, backgroundSize: "320px 380px" } },
      h(Head, { zh: "星测", onBack: props.onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "shrink-0" }, h(StarTabs, { tabs: tabs, cur: tab, onPick: setTab, S: S })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 16px 24px" } },
        tab === "today" ? todayView : tab === "pair" ? pairView : tab === "chart" ? chartView : tab === "group" ? groupView : askView,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, textAlign: "center", marginTop: 18, lineHeight: 1.6 } },
          "按生日算的，图个乐。让 TA 看看才会调用一次模型。")));
  }
  // ── 星星点头的日子，聊天顶栏那颗头像亮一圈（第 6 条，她：「也可以但是搞好看点」）──
  //   一圈金色细光慢慢转，三颗小星沿着轨道走；平常日子什么都没有。系统开了「减少动态」就只留一圈静光。
  //   判据只问 pairGoodDays 那一处（星测配对页、日历、角色那一行都是它），今天在不在那三天里。
  function isGoodDay(char) {
    try { const prof = loadJSON("x_profile", {}) || {}; const dk = dayKeyOf();
      return !!(char && char.id && pairGoodDays(prof.birthday, char.id, char.birthday, new Date(), 30).some(x => x.day === dk)); } catch (e) { return false; }
  }
  function AstroHalo({ size, children }) {
    const S = SKY_BASE, R = size / 2 + 5, W = size + 14;
    return h("span", { "data-wk": "astrohalo", title: "星星点头的日子", style: { position: "relative", display: "inline-flex", flexShrink: 0 } },
      h("style", null, "@keyframes qqHaloSpin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.qq-halo-spin{animation:none!important}}"),
      h("span", { "aria-hidden": "true", style: { position: "absolute", left: -7, top: -7, width: W, height: W, borderRadius: 999, boxShadow: "0 0 10px 1px " + S.tint + "55", pointerEvents: "none" } }),
      h("svg", { "aria-hidden": "true", className: "qq-halo-spin", viewBox: "0 0 " + W + " " + W, width: W, height: W,
        style: { position: "absolute", left: -7, top: -7, pointerEvents: "none", animation: "qqHaloSpin 14s linear infinite" } },
        h("defs", null, h("linearGradient", { id: "qqHaloG", x1: "0", y1: "0", x2: "1", y2: "1" },
          h("stop", { offset: "0%", stopColor: "#f6e3a1" }), h("stop", { offset: "55%", stopColor: S.tint }), h("stop", { offset: "100%", stopColor: S.accent }))),
        h("circle", { cx: W / 2, cy: W / 2, r: R, fill: "none", stroke: "url(#qqHaloG)", strokeWidth: 1.4, strokeDasharray: "2 3.2", opacity: 0.95 }),
        [0, 120, 240].map(deg => { const a = (deg - 90) * Math.PI / 180, x = W / 2 + Math.cos(a) * R, y = W / 2 + Math.sin(a) * R;
          return h("path", { key: deg, d: sparkle(x, y, deg ? 3.2 : 4.4), fill: deg ? "#f6e3a1" : "#fff7d6" }); })),
      children);
  }
  g.AstroHalo = AstroHalo; g.Astro.isGoodDay = isGoodDay;
  g.AstroApp = AstroApp;
})();
