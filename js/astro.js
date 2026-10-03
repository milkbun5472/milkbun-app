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
  "use strict";
  const g = typeof window !== "undefined" ? window : globalThis;

  // ── 算 ────────────────────────────────────────────────────
  const SIGNS = [
    ["白羊", 3, 21], ["金牛", 4, 20], ["双子", 5, 21], ["巨蟹", 6, 22], ["狮子", 7, 23], ["处女", 8, 23],
    ["天秤", 9, 23], ["天蝎", 10, 24], ["射手", 11, 23], ["摩羯", 12, 22], ["水瓶", 1, 20], ["双鱼", 2, 19]
  ];
  const ELEMENTS = ["火", "土", "风", "水"];
  // 公历月日 → 第几宫（0＝白羊）
  function signOf(mo, d) {
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return -1;
    for (let i = 0; i < 12; i++) {
      const s = SIGNS[i], n = SIGNS[(i + 1) % 12];
      const from = s[1] * 100 + s[2], to = n[1] * 100 + n[2], x = mo * 100 + d;
      if (from < to ? (x >= from && x < to) : (x >= from || x < to)) return i;
    }
    return -1;
  }
  // 配对看两宫相隔几格（绕一圈取近的那头）。说明文字只描述【这种相位】，不替任何人下结论。
  const ASPECTS = {
    0: [80, "同一个星座", "像照镜子：很懂对方，也很容易在同一个地方一起钻牛角尖。"],
    1: [66, "相邻两宫", "节奏差半拍，一个往前走另一个在收尾，需要磨合的是步调。"],
    2: [84, "元素相生", "火配风、土配水：一个给另一个添柴，聊得起来，也愿意顺着对方。"],
    3: [60, "四分相", "都有主意，而且主意常常不一样；吵得起来，也最容易把对方逼出新的样子。"],
    4: [90, "同一元素", "底色一样，不用多解释就懂；最舒服的那一种合拍。"],
    5: [64, "补十二分相", "看不太懂对方的路数，要多问一句才接得上，接上了反而新鲜。"],
    6: [74, "对宫", "正好站在对面：缺的正是对方有的，拉扯和吸引是同一件事。"]
  };
  function signMatch(a, b) {
    if (a < 0 || b < 0) return null;
    const k = Math.min(Math.abs(a - b), 12 - Math.abs(a - b));
    const x = ASPECTS[k];
    return { score: x[0], aspect: x[1], note: x[2], gap: k };
  }

  // 宿曜二十七宿（没有牛宿）。正月初一起室宿，往后每月初一的起宿固定，日子往后数。
  const SHUKU = ["角", "亢", "氐", "房", "心", "尾", "箕", "斗", "女", "虚", "危", "室", "壁", "奎", "娄", "胃", "昴", "毕", "觜", "参", "井", "鬼", "柳", "星", "张", "翼", "轸"];
  const SHUKU_MONTH_START = [null, "室", "奎", "胃", "毕", "参", "鬼", "张", "角", "氐", "心", "斗", "虚"];
  function shukuOf(lm, ld) {
    if (!(lm >= 1 && lm <= 12 && ld >= 1 && ld <= 30)) return -1;
    return (SHUKU.indexOf(SHUKU_MONTH_START[lm]) + ld - 1) % 27;
  }
  // 从 A 往后数到 B 是第几位（自己＝第 1 位），三九秘法的那一圈：
  const SHUKU_POS = ["命", "荣", "衰", "安", "危", "成", "坏", "友", "亲", "业", "荣", "衰", "安", "危", "成", "坏", "友", "亲",
    "胎", "荣", "衰", "安", "危", "成", "坏", "友", "亲"];
  const SHUKU_PAIR = { 命: "命", 业: "业胎", 胎: "业胎", 荣: "荣亲", 亲: "荣亲", 友: "友衰", 衰: "友衰", 安: "安坏", 坏: "安坏", 危: "危成", 成: "危成" };
  const SHUKU_NOTE = {
    命: "同一个本命宿：像另一个自己，一眼就认得，也会把对方的毛病看成自己的。",
    业胎: "前世今生的那一档：说不清为什么就是绕不开，一个牵着另一个走。",
    荣亲: "最顺的一档：互相成全，在一起两个人都过得更好。",
    友衰: "像朋友那样处得来，但待久了会互相耗着，要留点各自的空。",
    安坏: "最需要小心的一档：一个让另一个安心，另一个却可能把对方拆掉——吸引力也最强。",
    危成: "一开始不太顺，越处越成；彼此是对方需要的那块磨刀石。"
  };
  function shukuRelation(a, b) {
    if (a < 0 || b < 0) return null;
    const p = ((b - a) % 27 + 27) % 27;          // 0..26
    const mine = SHUKU_POS[p], theirs = SHUKU_POS[(27 - p) % 27];
    const pair = SHUKU_PAIR[mine];
    const d = Math.min(p, 27 - p);
    return { pair: pair, mine: mine, theirs: theirs, distance: p === 0 ? "" : d <= 4 ? "近距离" : d <= 9 ? "中距离" : "远距离", note: SHUKU_NOTE[pair] };
  }

  // 生日 → 星座、本命宿。⚠️认不出的那一半给 null，界面照实说「还算不了」。
  //   · 农历生日：宿直接有；星座要换成公历，有年份就精确换，没年份按今年换（个别跨宫边界的人可能差一宫，界面会注「约」）
  //   · 公历生日：星座直接有；宿要换成农历，**没年份换不了**（同一个公历日子每年落在不同的农历日）
  function birthInfo(birthday) {
    const raw = String(birthday || "").trim();
    if (!raw) return null;
    const out = { sign: -1, shuku: -1, signApprox: false, shukuNeedsYear: false };
    const lu = typeof parseLunarBirthday === "function" ? parseLunarBirthday(raw) : null;
    if (lu) {
      out.shuku = shukuOf(lu.m, lu.d);
      let sd = lu.y && typeof lunarToSolar === "function" ? lunarToSolar(lu.y, lu.m, lu.d, lu.isLeap) : null;
      if (!sd && typeof birthdaySolarDate === "function") { sd = birthdaySolarDate(raw, new Date().getFullYear()); out.signApprox = !!sd; }
      if (sd) out.sign = signOf(sd.getMonth() + 1, sd.getDate());
      return out;
    }
    const md = typeof parseMonthDay === "function" ? parseMonthDay(raw) : null;
    if (!md) return null;
    out.sign = signOf(md.mo, md.d);
    const ym = raw.match(/(\d{4})\s*[-/.年]/);
    const l = ym && typeof solarToLunar === "function" ? solarToLunar(new Date(+ym[1], md.mo - 1, md.d)) : null;
    if (l) out.shuku = shukuOf(l.m, l.d); else out.shukuNeedsYear = true;
    return out;
  }

  // 每日：星座 + 日期 当种子。同一天同一个星座永远同一份。
  function seedOf(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const LUCKY_COLORS = [
    ["雾霾蓝", "#7d93ac"], ["燕麦色", "#d8c8a8"], ["豆沙粉", "#c9939a"], ["橄榄绿", "#7f8a55"], ["奶油白", "#f3ead6"],
    ["焦糖棕", "#a5683a"], ["薄荷绿", "#9fd1bd"], ["酒红", "#8a2e3b"], ["鹅黄", "#f2d675"], ["藏青", "#2f3d63"],
    ["香芋紫", "#a99bc9"], ["珊瑚橙", "#ee8d6f"], ["月白", "#dfe6ea"], ["墨绿", "#2f5146"], ["樱花粉", "#f2c1cf"], ["炭灰", "#4a4a4f"]
  ];
  const DAY_LINES = {
    5: ["今天手气在你这边，想做的事别拖到明天。", "顺得出奇的一天，记得留一点给晚上。", "开口就有回应的一天。"],
    4: ["大体顺，小地方多看一眼就好。", "适合把一件拖了很久的事收个尾。", "有人在等你先说话。"],
    3: ["平平的一天，平平也挺好。", "按自己的节奏来，别被别人催着走。", "适合整理，不适合冒进。"],
    2: ["有点逆风，慢一点反而省事。", "今天说话前多想半秒。", "累了就早点收工，不算认输。"],
    1: ["诸事不宜大动，窝着也是一种选择。", "把期待放低一点，今天会好过很多。", "适合躲起来充电。"]
  };
  function dayKeyOf(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function daily(sign, dayKey) {
    if (sign < 0) return null;
    const r = rng(seedOf("astro|" + dayKey + "|" + sign));
    const star = () => 1 + Math.floor(r() * 5);
    const love = star(), work = star(), money = star();
    const all = Math.max(1, Math.min(5, Math.round((love + work + money) / 3 + (r() - 0.5))));
    const color = LUCKY_COLORS[Math.floor(r() * LUCKY_COLORS.length)];
    const lines = DAY_LINES[all];
    return { all: all, love: love, work: work, money: money, color: { name: color[0], hex: color[1] }, number: 1 + Math.floor(r() * 9), line: lines[Math.floor(r() * lines.length)] };
  }

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
  function voiceTail() {
    return (typeof ECHO_QUESTION_BAN !== "undefined" ? "\n\n" + ECHO_QUESTION_BAN : "")
      + (typeof REGISTER_FOLLOWS_SCENE !== "undefined" ? "\n\n" + REGISTER_FOLLOWS_SCENE : "")
      + (g.ReplyPacing ? "\n\n" + g.ReplyPacing.reading() : "");
  }
  function signName(i) { return i >= 0 ? SIGNS[i][0] + "座" : "不知道什么星座"; }

  // ── 画 ────────────────────────────────────────────────────
  const { useState, useMemo } = React;
  const SKY_BASE = { bg: "#151a33", bg2: "#20264a", ink: "#eef0fb", sub: "rgba(238,240,251,.66)", fog: "rgba(238,240,251,.42)", line: "rgba(238,240,251,.14)", accent: "#e7b7c8", tint: "#c9b66f" };
  const sky = () => (typeof pagePalette === "function" ? pagePalette("astro", SKY_BASE) : SKY_BASE);
  // 天上那层碎星：一颗种子摊成一张贴图，铺在外壳上（mobile-ui-layout §3.5：底纹铺外壳、顶栏透明、不跟着滚）
  const STARS = (function () {
    const r = rng(20261003);
    let s = "";
    for (let i = 0; i < 40; i++) s += "<circle cx='" + (r() * 320).toFixed(1) + "' cy='" + (r() * 380).toFixed(1) + "' r='" + (r() < 0.12 ? 1.3 : 0.6) + "' fill='white' opacity='" + (0.25 + r() * 0.55).toFixed(2) + "'/>";
    return "url(\"data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='320' height='380'>" + s + "</svg>") + "\")";
  })();

  function Stars({ n, color }) {
    return h("span", { style: { letterSpacing: 2, color: color, fontSize: 13 } }, "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n));
  }

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

  function Panel({ S, children, style }) {
    return h("div", { "data-wk": "astrocard", style: Object.assign({ background: S.bg2, border: "1px solid " + S.line, borderRadius: 16, padding: "14px 16px" }, style || {}) }, children);
  }

  function AstroApp(props) {
    const S = sky();
    const t = useTheme();
    const chars = (props.characters || []).filter(c => c && !c.isGroup);
    const profile = props.profile || {};
    const meName = profile.name || "我";
    const [tab, setTab] = useState("today");
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

    const missing = (p) => h("button", { onClick: () => p.char ? props.onEditChar && props.onEditChar(p.char) : props.onEditProfile && props.onEditProfile(),
      className: "active:opacity-70", style: { fontFamily: F_BODY, fontSize: 12, color: S.tint, background: "transparent", border: "1px dashed " + S.tint, borderRadius: 999, padding: "5px 12px", marginTop: 6 } },
      (p.id === "me" ? "还不知道你的生日" : "还不知道 " + p.name + " 的生日") + " · 去填");

    const ask = async (key, char, instruction) => {
      if (!char || busy) return;
      const p = props.apiFor ? props.apiFor(char.id) : null;
      const ctx = props.ctxFor ? props.ctxFor(char) : null;
      if (!p || !ctx || typeof runProbe !== "function") { props.toast && props.toast("先到设置配置 API"); return; }
      setBusy(key);
      try {
        const d = await runProbe(p, ctx, { voice: true, instruction: instruction + voiceTail(), schemaHint: "{\"text\":\"你想对她说的话\"}", maxTokens: 65535, tag: "astro" });
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
      style: { marginTop: 12, width: "100%", minHeight: 42, borderRadius: 12, border: "1px solid " + S.tint, background: "transparent", color: S.tint, fontFamily: F_BODY, fontSize: 13.5 } },
      busy === key ? (char.remark || char.name) + " 在看…" : (notes[key] ? "让 " + (char.remark || char.name) + " 再看看" : (label || "让 " + (char.remark || char.name) + " 看看"))) : null;

    const pickRow = (list, val, set, label) => h("div", { style: { marginBottom: 10 } },
      label ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog, marginBottom: 6 } }, label) : null,
      h("div", { style: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 } },
        list.map(p => h("button", { key: p.id, onClick: () => set(p.id), className: "active:opacity-70 shrink-0",
          style: { display: "flex", alignItems: "center", gap: 6, padding: "5px 11px 5px 5px", borderRadius: 999, border: "1px solid " + (val === p.id ? S.tint : S.line),
            background: val === p.id ? S.tint + "26" : "transparent", color: val === p.id ? S.ink : S.sub, fontFamily: F_BODY, fontSize: 12.5 } },
          typeof Avatar !== "undefined" ? h(Avatar, { character: p.char || { name: p.name, avatarImage: profile.avatarImage, color: profile.color || "#8a8fb5" }, size: 22, radius: 999 }) : null,
          p.name))));

    // ---- 今日 ----
    const meInfo = birthInfo(profile.birthday);
    const day = meInfo && meInfo.sign >= 0 ? daily(meInfo.sign, today) : null;
    const todayView = h("div", { className: "flex flex-col gap-3" },
      h(Panel, { S: S },
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: S.fog } }, today.replace(/-/g, " · ") + " · " + meName),
        !day ? h("div", null, h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: S.ink, marginTop: 4 } }, "还算不出你今天的运势"), missing(people[0])) : h("div", null,
          h("div", { className: "flex items-baseline justify-between", style: { marginTop: 4 } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: S.ink } }, signName(meInfo.sign) + (meInfo.signApprox ? "（约）" : "")),
            h(Stars, { n: day.all, color: S.tint })),
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: S.ink, lineHeight: 1.7, marginTop: 8 } }, day.line),
          h("div", { style: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", marginTop: 12, fontFamily: F_BODY, fontSize: 12.5, color: S.sub, alignItems: "center" } },
            "爱情", h(Stars, { n: day.love, color: S.accent }), "事业", h(Stars, { n: day.work, color: S.accent }), "财运", h(Stars, { n: day.money, color: S.accent })),
          h("div", { className: "flex gap-3", style: { marginTop: 14 } },
            h("div", { "data-wk": "astrolucky", style: { flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid " + S.line } },
              h("span", { style: { width: 28, height: 28, borderRadius: 99, background: day.color.hex, boxShadow: "0 0 0 3px " + S.bg + "," + "0 0 12px " + day.color.hex } }),
              h("div", null, h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog } }, "幸运色"), h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink } }, day.color.name))),
            h("div", { style: { width: 92, padding: "10px 12px", borderRadius: 12, border: "1px solid " + S.line } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog } }, "幸运数字"), h("div", { style: { fontFamily: F_DISPLAY, fontSize: 20, color: S.ink } }, day.number))))),
      day && chars.length ? h(Panel, { S: S },
        pickRow(people.filter(p => p.char), commenter, setCommenter, "让谁看看你今天的运势"),
        (() => {
          const c = (byId(commenter) || {}).char;
          if (!c) return null;
          const ci = birthInfo(c.birthday), m = ci && signMatch(meInfo.sign, ci.sign);
          const key = "day|" + today + "|" + c.id;
          const ins = meName + "把她今天的星座运势拿给你看（这是按星座和日期算出来的，不是你编的）：\n"
            + "她是" + signName(meInfo.sign) + "；综合 " + day.all + " 星，爱情 " + day.love + "、事业 " + day.work + "、财运 " + day.money + " 星；幸运色" + day.color.name + "，幸运数字 " + day.number + "；那一句是「" + day.line + "」。\n"
            + (ci && ci.sign >= 0 ? "你是" + signName(ci.sign) + (m ? "，你俩是「" + m.aspect + "」，配对指数 " + m.score + "。" : "。") : "你的生日她还不知道，所以你的星座在这儿没算。") + "\n"
            + "看完说说你的想法。信不信星座、当不当真、顺着哪一点说，全由你这个人决定。";
          return h("div", null, noteBox(key, c), askBtn(key, c, ins));
        })()) : null);

    // ---- 配对 ----
    const A = byId(pa), B = byId(pb);
    const ai = birthInfo(A.birthday), bi = birthInfo(B.birthday);
    const sm = ai && bi ? signMatch(ai.sign, bi.sign) : null;
    const sr = ai && bi ? shukuRelation(ai.shuku, bi.shuku) : null;
    const pairChar = A.char || B.char;          // 谁来点评：左边是角色就左边，否则右边那位
    const pairOther = pairChar === A.char ? B : A;
    const pairKey = "pair|" + [A.id, B.id].join("~") + "|" + (pairChar ? pairChar.id : "");
    const whoLine = (p, info) => h("div", { style: { flex: 1, textAlign: "center" } },
      typeof Avatar !== "undefined" ? h("div", { style: { display: "flex", justifyContent: "center" } }, h(Avatar, { character: p.char || { name: p.name, avatarImage: profile.avatarImage, color: profile.color || "#8a8fb5" }, size: 44, radius: 999 })) : null,
      h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: S.ink, marginTop: 6 } }, p.name),
      h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: S.sub, marginTop: 2 } },
        info && info.sign >= 0 ? signName(info.sign) + (info.signApprox ? "（约）" : "") : "星座未知",
        " · ", info && info.shuku >= 0 ? SHUKU[info.shuku] + "宿" : "宿未知"),
      !info ? missing(p) : (info.shukuNeedsYear ? h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, marginTop: 4 } }, "生日带上年份才算得出宿") : null));
    const pairView = h("div", { className: "flex flex-col gap-3" },
      h(Panel, { S: S },
        pickRow(people, pa, setPa, "左边"),
        pickRow(people, pb, setPb, "右边"),
        pa === pb ? h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: S.fog } }, "两边选了同一个人——换一个再看") : null),
      pa === pb ? null : h(Panel, { S: S },
        h("div", { className: "flex items-start" }, whoLine(A, ai),
          h("div", { style: { alignSelf: "center", fontFamily: F_DISPLAY, fontSize: 26, color: S.tint, padding: "0 4px" } }, sm ? sm.score : "?"),
          whoLine(B, bi)),
        h("div", { "data-wk": "astrosign", style: { marginTop: 14, paddingTop: 12, borderTop: "1px dashed " + S.line } },
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
        pairChar && (sm || sr) ? (() => {
          const ins = "这是按生日算出来的「你」和「" + pairOther.name + "」的配对（不是你编的）：\n"
            + (sm ? "星座：你是" + signName((pairChar === A.char ? ai : bi).sign) + "，" + pairOther.name + "是" + signName((pairChar === A.char ? bi : ai).sign) + "，「" + sm.aspect + "」，配对指数 " + sm.score + "。\n" : "")
            + (sr ? "宿曜：" + (sr.pair === "命" ? "你俩同一个宿（命命）" : "你俩是「" + sr.pair + "」" + (sr.distance ? "（" + sr.distance + "）" : "")) + "。\n" : "")
            + (pairOther.id === "me" ? meName + "把这个拿给你看。" : meName + "把你和" + pairOther.name + "的这份配对拿给你看。") + "\n"
            + "说说你怎么看。当真不当真、顺着哪一点说、要不要反驳，全由你这个人和你们的关系决定。";
          return h("div", null, noteBox(pairKey, pairChar), askBtn(pairKey, pairChar, ins));
        })() : null));

    const tabs = [["today", "今日运势"], ["pair", "配对"]];
    return h("div", { "data-wk": "app", className: "h-full flex flex-col", style: { background: S.bg, backgroundImage: STARS, backgroundSize: "320px 380px" } },
      h(Head, { zh: "星测", onBack: props.onBack, ink: S.ink, bg: "transparent", noLine: true }),
      h("div", { className: "shrink-0" }, h(StarTabs, { tabs: tabs, cur: tab, onPick: setTab, S: S })),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 16px 24px" } },
        tab === "today" ? todayView : pairView,
        h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: S.fog, textAlign: "center", marginTop: 18, lineHeight: 1.6 } },
          "按生日算的，图个乐。让 TA 看看才会调用一次模型。")));
  }

  g.Astro = { signOf, signMatch, shukuOf, shukuRelation, birthInfo, daily, dayKeyOf, SIGNS, SHUKU, SHUKU_POS };
  g.AstroApp = AstroApp;
  g.GAstro = function (p) {
    return h(Svg, p, h("circle", { cx: 12, cy: 12, r: 8.5 }), h("path", { d: "M12 5.5l1.3 3.9 4.1.1-3.3 2.4 1.2 3.9L12 13.5l-3.3 2.3 1.2-3.9-3.3-2.4 4.1-.1z" }));
  };
})();
