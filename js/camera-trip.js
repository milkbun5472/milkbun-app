// 相机·旅行（她 2026-11-26：「选角色然后选景点或者任意地点，排出好几站，每一站收到明信片——正面是他在这一站拍的照，背面写一小段话；
//   也可以选多个角色，每一站选谁来寄」；拍板：一站一站寄、出发前选她去不去、选记不记进记忆、明信片多做几种，可以自己定也可以让TA挑）
//   存档：x_camTrips（loadJSON/saveJSON，进 IDB）；每张明信片的照片存本机图库 img_trip_ 键，删旅行时一起删。
//   写字、挑怎么拍、出图都在 app.js 的 tripPlan / tripCard，这一页只管排、寄、翻、存。
(function () {
  const h = React.createElement, useState = React.useState, useEffect = React.useEffect;
  const FS = n => "calc(" + n + "px * var(--app-fs, 1))";
  const KEY = "x_camTrips";
  const GRAD = "linear-gradient(135deg,#ff5f9e 0%,#ff8a7a 55%,#ffb36b 100%)";
  const INK = "#2b2230", SUB = "#9a8592", PINK = "#ff5f9e";
  const HAND = "'Long Cang','Ma Shan Zheng','Kaiti SC','STKaiti',KaiTi,cursive";
  // 明信片的样子：paper 背面纸色、ink 字色、edge 正面相片外框、deco 装饰
  const STYLES = [
    { id: "classic", zh: "白卡邮戳", paper: "#fbfaf6", ink: "#2f3a4a", line: "rgba(47,58,74,.18)", edge: "#fff", deco: "stamp" },
    { id: "kraft", zh: "牛皮纸", paper: "#d8b98d", ink: "#3b2a1a", line: "rgba(59,42,26,.25)", edge: "#efe2cc", deco: "stamp" },
    { id: "journal", zh: "胶带手账", paper: "#fff8ec", ink: "#4a3a48", line: "rgba(74,58,72,.14)", edge: "#fff", deco: "tape" },
    { id: "film", zh: "胶片", paper: "#26232a", ink: "#f3ede4", line: "rgba(243,237,228,.16)", edge: "#111", deco: "film" },
    { id: "dusk", zh: "晚霞水彩", paper: "linear-gradient(160deg,#ffe1ea 0%,#f3dcff 55%,#dfe8ff 100%)", paperC: ["#ffe1ea", "#f3dcff", "#dfe8ff"], ink: "#4b3658", line: "rgba(75,54,88,.14)", edge: "#fff", deco: "heart" }
  ];
  const styleOf = id => STYLES.find(x => x.id === id) || STYLES[0];
  const load = () => { try { return (typeof loadJSON === "function" ? loadJSON(KEY, []) : []) || []; } catch (e) { return []; } };
  const store = list => { try { if (typeof saveJSON === "function") saveJSON(KEY, list); } catch (e) {} };
  const dateZh = ts => { const d = new Date(ts || Date.now()); return d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate(); };
  const loadImg = src => new Promise(res => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

  // ── 存到手机：正面在上、背面在下，画成一张 ──
  function wrap(ctx, text, maxW) {
    const out = []; let line = "";
    for (const ch of String(text || "")) { if (ch === "\n") { out.push(line); line = ""; continue; }
      if (ctx.measureText(line + ch).width > maxW && line && !/[，。！？、；：,.!?;:」』）)…~～]/.test(ch)) { out.push(line); line = ch; } else line += ch; }
    if (line) out.push(line); return out;
  }
  async function drawCard(card, stop, names) {
    const st = styleOf(card.style), W = 1200, m = 48;
    const blob = card.imgKey && typeof idbImgGet === "function" ? await idbImgGet(card.imgKey) : null;
    const u = blob ? URL.createObjectURL(blob) : null, im = await loadImg(u);
    const ph = im ? Math.round((W - m * 2) * im.naturalHeight / im.naturalWidth) : 600, frontH = ph + m * 2, backH = 820, gap = 40;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = frontH + gap + backH;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ece6e9"; ctx.fillRect(0, 0, W, cv.height);
    ctx.fillStyle = st.edge; ctx.fillRect(0, 0, W, frontH);
    if (im) ctx.drawImage(im, m, m, W - m * 2, ph);
    if (u) URL.revokeObjectURL(u);
    const y0 = frontH + gap;
    if (st.paperC) { const g = ctx.createLinearGradient(0, y0, W, y0 + backH); st.paperC.forEach((c, i) => g.addColorStop(i / (st.paperC.length - 1), c)); ctx.fillStyle = g; } else ctx.fillStyle = st.paper;
    ctx.fillRect(0, y0, W, backH);
    // 中线、邮票框、地址线
    ctx.strokeStyle = st.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W * 0.62, y0 + 70); ctx.lineTo(W * 0.62, y0 + backH - 70); ctx.stroke();
    ctx.setLineDash([10, 8]); ctx.strokeRect(W - 230, y0 + 60, 160, 190); ctx.setLineDash([]);
    ctx.fillStyle = st.ink; ctx.textAlign = "center"; ctx.font = "600 34px 'PingFang SC','Noto Sans SC',sans-serif";
    ctx.fillText(String(stop.place || "").slice(0, 6), W - 150, y0 + 165);
    ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(W - 300, y0 + 230, 78, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = st.ink; ctx.stroke();
    ctx.font = "26px 'PingFang SC',sans-serif"; ctx.fillText(dateZh(card.ts), W - 300, y0 + 240); ctx.globalAlpha = 1;
    for (let i = 0; i < 4; i++) { const ly = y0 + 400 + i * 90; ctx.strokeStyle = st.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * 0.66, ly); ctx.lineTo(W - 70, ly); ctx.stroke(); }
    // 左半写字
    ctx.textAlign = "left"; ctx.fillStyle = st.ink;
    let fs = 46, lines; const maxW = W * 0.62 - 140;
    const body = () => { const out = []; ctx.font = fs + "px " + HAND; (card.texts || []).forEach(t => { wrap(ctx, t.text, maxW).forEach(l => out.push([l, 0])); if ((card.texts || []).length > 1 || names[t.pid]) out.push(["—— " + (names[t.pid] || ""), 1]); }); return out; };
    lines = body(); while (lines.length * fs * 1.35 > backH - 140 && fs > 24) { fs -= 3; lines = body(); }
    let y = y0 + 80 + fs;
    lines.forEach(([l, sign]) => { ctx.textAlign = sign ? "right" : "left"; ctx.fillText(l, sign ? W * 0.62 - 50 : 70, y); y += fs * 1.35; });
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/jpeg", 0.92));
  }

  // ── 一张明信片：点一下翻面 ──
  function Postcard({ card, stop, names, onSave }) {
    const [back, setBack] = useState(false);
    const url = typeof useIdbImgUrl === "function" ? useIdbImgUrl(card.imgKey) : null;
    const st = styleOf(card.style);
    const face = { position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", borderRadius: 10, overflow: "hidden", boxShadow: "0 14px 30px -16px rgba(80,30,60,.55)" };
    const deco = st.deco === "tape" ? [h("div", { key: "t1", style: { position: "absolute", top: -6, left: 18, width: 70, height: 20, background: "rgba(255,170,190,.75)", transform: "rotate(-8deg)" } }), h("div", { key: "t2", style: { position: "absolute", top: -6, right: 22, width: 60, height: 20, background: "rgba(150,210,200,.75)", transform: "rotate(7deg)" } })]
      : st.deco === "heart" ? [h("div", { key: "hh", style: { position: "absolute", right: 12, bottom: 8, color: "#ff8fb1", fontSize: FS(18) } }, "♡")] : [];
    return h("div", { "data-wk": "trippost", style: { marginBottom: 18 } },
      h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, margin: "0 2px 8px", color: INK } },
        h("span", { style: { fontSize: FS(14), fontWeight: 600 } }, stop.place),
        h("span", { style: { fontSize: FS(11), color: SUB } }, (card.texts || []).map(t => names[t.pid]).filter(Boolean).join("、") + " 寄 · " + (card.kindZh || "") + " · " + dateZh(card.ts))),
      h("div", { "data-wk": "tripflip", onClick: () => setBack(b => !b), style: { position: "relative", width: "100%", aspectRatio: "3 / 2", perspective: 1200, cursor: "pointer" } },
        h("div", { style: { position: "absolute", inset: 0, transformStyle: "preserve-3d", transition: "transform .6s", transform: back ? "rotateY(180deg)" : "none" } },
          // 正面：照片
          h("div", { "data-wk": "tripfront", style: Object.assign({}, face, { background: st.edge, padding: st.deco === "film" ? "14px 10px" : 10 }) },
            st.deco === "film" ? h("div", { style: { position: "absolute", left: 0, right: 0, top: 3, height: 8, backgroundImage: "repeating-linear-gradient(90deg,#d9d2c6 0 8px,transparent 8px 18px)", opacity: .7 } }) : null,
            st.deco === "film" ? h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 3, height: 8, backgroundImage: "repeating-linear-gradient(90deg,#d9d2c6 0 8px,transparent 8px 18px)", opacity: .7 } }) : null,
            url ? h("img", { src: url, style: { width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 4 } }) : h("div", { style: { width: "100%", height: "100%", background: "#eee" } })),
          // 背面：字、邮票、邮戳
          h("div", { "data-wk": "tripback", style: Object.assign({}, face, { transform: "rotateY(180deg)", background: st.paper, color: st.ink, display: "flex", padding: "14px 12px 12px 16px" }) },
            deco,
            h("div", { style: { flex: 1.6, minWidth: 0, overflowY: "auto", fontFamily: HAND, fontSize: FS(16), lineHeight: 1.45, paddingRight: 10, borderRight: "1.5px solid " + st.line } },
              (card.texts || []).map((t, i) => h("div", { key: i, style: { marginBottom: 8 } }, h("div", { style: { whiteSpace: "pre-wrap" } }, t.text),
                (card.texts || []).length > 1 ? h("div", { style: { textAlign: "right", fontSize: FS(13), opacity: .8 } }, "—— " + (names[t.pid] || "")) : null))),
            h("div", { style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", paddingLeft: 10 } },
              h("div", { style: { width: 54, height: 64, border: "1.5px dashed " + st.line, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FS(10.5), fontWeight: 600, textAlign: "center", padding: 3, lineHeight: 1.2 } }, String(stop.place || "").slice(0, 6)),
              h("div", { style: { marginTop: 6, marginRight: 34, width: 52, height: 52, borderRadius: "50%", border: "1.5px solid " + st.ink, opacity: .5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FS(9.5), transform: "rotate(-12deg)" } }, dateZh(card.ts)),
              h("div", { style: { flex: 1 } }),
              [0, 1, 2].map(i => h("div", { key: i, style: { width: "100%", borderBottom: "1.5px solid " + st.line, height: 16 } })))))),
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: FS(11), color: SUB } },
        h("span", null, back ? "点一下翻回正面" : "点一下翻到背面"),
        h("button", { "data-wk": "tripbtn", "data-part": "savecard", onClick: onSave, style: { border: "none", background: "transparent", color: PINK, fontSize: FS(12), fontWeight: 600 } }, "存到手机")));
  }

  // 相机里「旅行／电影／平行人生」几页共用的一套（粉底白卡、药丸、底下那颗粉橙大按钮、输入框）：挂点名各页自己给
  // 三个玩法各一套颜色（她 2026-11-27「相机里那几个页面弄好看点」）：旅行暖粉、电影暗场金、平行人生梦幻蓝紫
  const THEMES = {
    trip: { bg: "linear-gradient(180deg,#ffe3ee 0%,#fff6f9 38%,#fdfbfc 100%)", card: "#fff", ink: INK, sub: SUB, accent: PINK, grad: GRAD, line: "#f1e4ea", soft: "#fff1f6", inputBg: "#fffafc", glow: "rgba(255,80,130,.85)", shadow: "rgba(160,60,110,.55)", dark: false,
      hero: "linear-gradient(135deg,#ff8fb1 0%,#ffb38a 100%)" },
    movie: { bg: "radial-gradient(120% 60% at 50% 0%, #3a2a36 0%, #17121a 55%, #0f0c11 100%)", card: "rgba(255,255,255,.06)", ink: "#f4ede3", sub: "rgba(244,237,227,.55)", accent: "#e8b86b", grad: "linear-gradient(135deg,#f2c879 0%,#d98a4e 100%)", line: "rgba(255,255,255,.12)", soft: "rgba(232,184,107,.14)", inputBg: "rgba(255,255,255,.05)", glow: "rgba(232,150,80,.6)", shadow: "rgba(0,0,0,.6)", dark: true,
      hero: "linear-gradient(135deg,#3d2c3e 0%,#6b4258 55%,#b4775a 100%)" },
    worlds: { bg: "linear-gradient(180deg,#e6ecff 0%,#f3eeff 45%,#fbfaff 100%)", card: "#fff", ink: "#2c2a44", sub: "#8b88a8", accent: "#7b74f0", grad: "linear-gradient(135deg,#7fb4ff 0%,#a98bff 100%)", line: "#e7e4f7", soft: "#f1efff", inputBg: "#fbfaff", glow: "rgba(120,110,255,.6)", shadow: "rgba(90,80,180,.4)", dark: false,
      hero: "linear-gradient(135deg,#7fb4ff 0%,#a98bff 60%,#e6a7f0 100%)" }
  };
  const ICONS = {
    trip: ["M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z", "M9 4.5v13", "M15 6.5v13"],
    movie: ["M4 8h16v11H4z", "M4 8l3-4h3l-3 4", "M10 8l3-4h3l-3 4", "M16 8l3-4h1"],
    worlds: ["M12 3a9 9 0 100 18 9 9 0 100-18", "M3.5 9h17", "M3.5 15h17", "M12 3c-3 3-3 15 0 18", "M12 3c3 3 3 15 0 18"]
  };
  const icon = (d, size, color) => h("svg", { viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: color || "#fff", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }, d.map((x, i) => h("path", { key: i, d: x })));
  function makeUI(wk, themeId) {
    const th = THEMES[themeId] || THEMES.trip;
    const card = (part, title, hint, kid) => h("div", { "data-wk": wk.card, "data-part": part, style: { background: th.card, borderRadius: 22, padding: "14px 14px 16px", marginBottom: 12, boxShadow: "0 10px 26px -18px " + th.shadow, border: th.dark ? "1px solid " + th.line : "none" } },
      h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 } },
        h("span", { style: { fontSize: FS(14.5), fontWeight: 600, color: th.ink } }, title), hint ? h("span", { style: { fontSize: FS(11), color: th.sub } }, hint) : null), kid);
    const pill = (label, on, onClick, part) => h("button", { "data-wk": wk.btn, "data-part": part || "", "data-on": on ? "1" : "0", onClick,
      style: { flexShrink: 0, height: 30, padding: "0 12px", borderRadius: 15, border: "1.5px solid " + (on ? th.accent : th.line), background: on ? th.soft : th.dark ? "transparent" : "#fff", color: th.ink, fontSize: FS(12), fontWeight: on ? 600 : 400 } }, label);
    const big = (label, onClick, part, dim) => h("button", { "data-wk": wk.btn, "data-part": part, onClick, disabled: !!dim,
      style: { width: "100%", height: 52, borderRadius: 26, border: "none", background: th.grad, opacity: dim ? .5 : 1, color: th.dark ? "#2a1a10" : "#fff", fontSize: FS(15.5), fontWeight: 600, letterSpacing: ".1em", boxShadow: "0 14px 28px -14px " + th.glow } }, label);
    const small = (label, onClick, part, busy) => h("button", { "data-wk": wk.btn, "data-part": part, onClick, disabled: !!busy,
      style: { height: 34, padding: "0 16px", borderRadius: 17, border: "none", background: th.grad, color: th.dark ? "#2a1a10" : "#fff", fontSize: FS(12.5), fontWeight: 600, opacity: busy ? .6 : 1, whiteSpace: "nowrap" } }, label);
    const page = (title, onBack, body, foot) => h("div", { "data-wk": wk.page, "data-theme": themeId || "trip", className: "h-full flex flex-col", style: { background: th.bg, color: th.ink } },
      typeof Head === "function" ? h(Head, { zh: title, bg: "transparent", onBack, ...(th.dark ? { ink: th.ink, lineInk: th.line } : {}) }) : null,
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 18px" } }, body),
      foot ? h("div", { style: { flexShrink: 0, padding: "10px 16px 14px", paddingBottom: "calc(14px + " + (typeof COMPOSER_PAD_BOTTOM !== "undefined" ? COMPOSER_PAD_BOTTOM : "0px") + ")" } }, foot) : null);
    const inp = (v, on, ph, part, rows) => h(rows ? "textarea" : "input", { value: v, placeholder: ph, rows, "data-part": part, onChange: e => on(e.target.value),
      style: { width: "100%", boxSizing: "border-box", border: "1.5px solid " + th.line, borderRadius: 12, padding: "9px 11px", fontSize: FS(13.5), color: th.ink, background: th.inputBg, outline: "none", resize: "none", lineHeight: 1.5 } });
    // 列表页顶上那块：大图标＋一句这是什么＋要花几次调用
    const hero = (title, line, cost) => h("div", { key: "hero", "data-wk": wk.page.replace("page", "hero"), style: { position: "relative", overflow: "hidden", borderRadius: 24, padding: "18px 18px 16px", marginBottom: 16, background: th.hero, color: "#fff", boxShadow: "0 16px 30px -18px " + th.glow } },
      h("div", { style: { position: "absolute", right: -26, top: -26, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.14)" } }),
      h("div", { style: { position: "absolute", right: 18, top: 16, opacity: .9 } }, icon(ICONS[themeId] || ICONS.trip, 38)),
      h("div", { style: { fontSize: FS(20), fontWeight: 700, letterSpacing: ".06em" } }, title),
      h("div", { style: { fontSize: FS(12.5), lineHeight: 1.65, marginTop: 6, opacity: .95, paddingRight: 40 } }, line),
      cost ? h("div", { style: { display: "inline-block", marginTop: 10, fontSize: FS(10.5), padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,.22)" } }, cost) : null);
    const empty = text => h("div", { key: "empty", style: { textAlign: "center", padding: "44px 0 20px", color: th.sub } },
      h("div", { style: { display: "inline-flex", width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", background: th.soft, marginBottom: 10 } }, icon(ICONS[themeId] || ICONS.trip, 28, th.accent)),
      h("div", { style: { fontSize: FS(13) } }, text));
    const item = (key, wkName, onClick, thumb, title, sub, note) => h("button", { key, "data-wk": wkName, onClick, style: { width: "100%", display: "flex", gap: 12, alignItems: "center", textAlign: "left", border: th.dark ? "1px solid " + th.line : "none", background: th.card, borderRadius: 20, padding: 10, marginBottom: 10, boxShadow: "0 10px 26px -18px " + th.shadow, color: th.ink } },
      thumb, h("div", { style: { flex: 1, minWidth: 0 } },
        h("div", { style: { fontSize: FS(14.5), fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, title),
        h("div", { style: { fontSize: FS(11.5), color: th.sub, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, sub),
        h("div", { style: { fontSize: FS(11), color: th.accent, marginTop: 3, fontWeight: 600 } }, note)),
      h("span", { style: { color: th.sub, fontSize: FS(16) } }, "›"));
    return { card, pill, big, small, page, inp, hero, empty, item, th };
  }

  function CameraTrip(props) {
    const chars = props.characters || [];
    const [trips, setTrips] = useState(load);
    const [openId, setOpenId] = useState(null);
    const [draft, setDraft] = useState(null);     // 新建：{ids, meGo, remember, place, stops}
    const [busy, setBusy] = useState("");
    const toast = m => props.toast && props.toast(m);
    const put = list => { setTrips(list); store(list); };
    const names = {}; chars.forEach(c => { names[c.id] = c.name; });
    const { card, pill, big, page, inp, hero, empty, item } = makeUI({ page: "trippage", card: "tripcard", btn: "tripbtn" }, "trip");

    // ── 新的旅行 ──
    if (draft) {
      const d = draft, set = p => setDraft(x => Object.assign({}, x, p));
      const setStop = (i, p) => set({ stops: d.stops.map((s, j) => j === i ? Object.assign({}, s, p) : s) });
      const tog = id => set({ ids: d.ids.indexOf(id) >= 0 ? d.ids.filter(x => x !== id) : d.ids.concat([id]) });
      const defSender = () => d.ids.length > 1 ? "all" : d.ids[0] || "";
      const plan = async () => {
        if (busy) return; if (!d.ids.length) { toast("先挑谁去"); return; } if (!String(d.place || "").trim()) { toast("先写去哪儿"); return; }
        setBusy("plan");
        try { const st = await props.onTripPlan(d.ids, d.place, d.meGo); if (!st.length) throw new Error("没排出来，再试一次");
          set({ stops: st.map((x, i) => ({ place: x.place, plan: x.plan, sender: d.ids.length > 1 ? d.ids[i % d.ids.length] : d.ids[0], style: "auto" })) }); }
        catch (e) { toast("没排成：" + String(e && e.message || e).slice(0, 80)); } finally { setBusy(""); }
      };
      const go = () => {
        const stops = d.stops.filter(s => String(s.place || "").trim()).map(s => Object.assign({}, s, { sender: s.sender === "all" ? (d.ids.length > 1 ? "all" : d.ids[0]) : (d.ids.indexOf(s.sender) >= 0 ? s.sender : defSender()) }));
        if (!d.ids.length || !stops.length) { toast("至少一个人、一站"); return; }
        const t = { id: "trip_" + Date.now().toString(36), ts: Date.now(), title: String(d.place || "").trim().slice(0, 20) || stops[0].place, ids: d.ids, meGo: !!d.meGo, remember: !!d.remember, stops: stops.map(s => Object.assign({}, s, { card: null })) };
        put([t].concat(trips)); setDraft(null); setOpenId(t.id);
      };
      return page("新的旅行", () => setDraft(null), [
        card("who", "谁去", "可以多选", h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: "12px 6px" } },
          chars.map(p => { const on = d.ids.indexOf(p.id) >= 0;
            return h("button", { key: p.id, "data-wk": "tripone", "data-on": on ? "1" : "0", onClick: () => tog(p.id), style: { border: "none", background: "transparent", color: INK, textAlign: "center", padding: 0 } },
              h("div", { style: { display: "inline-block", borderRadius: "50%", padding: 3, background: on ? GRAD : "transparent" } }, h("div", { style: { borderRadius: "50%", padding: 2, background: "#fff" } }, typeof Avatar === "function" ? h(Avatar, { character: p, size: 48 }) : null)),
              h("div", { style: { fontSize: FS(11.5), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)); }))),
        card("opts", "出发前", null, h("div", null,
          h("div", { style: { display: "flex", gap: 8, marginBottom: 8, alignItems: "center" } }, h("span", { style: { fontSize: FS(12.5), width: 56, flexShrink: 0 } }, "你去吗"),
            pill("一起去", d.meGo, () => set({ meGo: true }), "mego"), pill("在家等明信片", !d.meGo, () => set({ meGo: false }), "mestay")),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center" } }, h("span", { style: { fontSize: FS(12.5), width: 56, flexShrink: 0 } }, "记忆"),
            pill("记进记忆", d.remember, () => set({ remember: true }), "remember"), pill("不记", !d.remember, () => set({ remember: false }), "noremember")),
          h("div", { style: { fontSize: FS(10.5), color: SUB, marginTop: 8, lineHeight: 1.6 } }, "一起去：合照里有你，话是写给同行的你；记进记忆：每寄一站记一条，以后聊天TA记得去过。"))),
        card("where", "去哪儿", "景点、城市，或者随便一句", h("div", null,
          inp(d.place, v => set({ place: v }), "写一个地方", "place", 2),
          h("button", { "data-wk": "tripbtn", "data-part": "plan", onClick: plan, style: { marginTop: 8, height: 34, padding: "0 16px", borderRadius: 17, border: "none", background: GRAD, color: "#fff", fontSize: FS(12.5), fontWeight: 600, opacity: busy ? .6 : 1, whiteSpace: "nowrap" } }, busy === "plan" ? "在排…" : d.stops.length ? "重新排一版" : "让 AI 排一版"),
          h("span", { style: { fontSize: FS(10.5), color: SUB, marginLeft: 8 } }, "排完都能改，也能自己加"))),
        card("stops", "路线", d.stops.length ? d.stops.length + " 站，一站寄一张" : "还没有站", h("div", null,
          d.stops.map((s, i) => h("div", { key: i, "data-wk": "tripstop", style: { border: "1.5px solid #f6e8ee", borderRadius: 16, padding: 10, marginBottom: 10 } },
            h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 6 } },
              h("span", { style: { width: 22, height: 22, borderRadius: 11, background: GRAD, color: "#fff", fontSize: FS(11), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, i + 1),
              h("div", { style: { flex: 1 } }, inp(s.place, v => setStop(i, { place: v }), "地名", "stopplace")),
              i > 0 ? h("button", { "data-wk": "tripbtn", "data-part": "up", onClick: () => { const a = d.stops.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ stops: a }); }, style: { border: "none", background: "transparent", color: SUB, fontSize: FS(14), padding: "0 4px" } }, "↑") : null,
              h("button", { "data-wk": "tripbtn", "data-part": "delstop", onClick: () => set({ stops: d.stops.filter((_, j) => j !== i) }), style: { border: "none", background: "transparent", color: SUB, fontSize: FS(16), padding: "0 4px" } }, "×")),
            inp(s.plan, v => setStop(i, { plan: v }), "在那儿做什么（可空）", "stopplan"),
            h("div", { style: { display: "flex", gap: 6, overflowX: "auto", marginTop: 8, alignItems: "center" } }, h("span", { style: { fontSize: FS(11), color: SUB, flexShrink: 0 } }, "谁寄"),
              (d.ids.length > 1 ? [["all", "大家一起"]] : []).concat(d.ids.map(id => [id, names[id] || "?"])).map(([k, zh]) => h(React.Fragment, { key: k }, pill(zh, s.sender === k, () => setStop(i, { sender: k }), "sender")))),
            h("div", { style: { display: "flex", gap: 6, overflowX: "auto", marginTop: 6, alignItems: "center" } }, h("span", { style: { fontSize: FS(11), color: SUB, flexShrink: 0 } }, "样子"),
              [["auto", "让TA挑"]].concat(STYLES.map(x => [x.id, x.zh])).map(([k, zh]) => h(React.Fragment, { key: k }, pill(zh, s.style === k, () => setStop(i, { style: k }), "style")))))),
          h("button", { "data-wk": "tripbtn", "data-part": "addstop", onClick: () => set({ stops: d.stops.concat([{ place: "", plan: "", sender: defSender(), style: "auto" }]) }), style: { width: "100%", height: 38, borderRadius: 14, border: "1.5px dashed #f1cfdc", background: "transparent", color: PINK, fontSize: FS(12.5) } }, "＋ 加一站")))
      ], big("出发", go, "go", !d.ids.length || !d.stops.some(s => String(s.place || "").trim())));
    }

    // ── 一趟旅行：收到的明信片一张张往下排，下一站点了才寄 ──
    const trip = trips.find(t => t.id === openId);
    if (trip) {
      const next = trip.stops.findIndex(s => !s.card), stop = next >= 0 ? trip.stops[next] : null;
      const send = async () => {
        if (busy || !stop) return; setBusy("send");
        try {
          const r = await props.onTripCard(trip, next, STYLES);
          const k = "img_trip_" + Date.now().toString(36);
          if (typeof idbImgPut === "function") await idbImgPut(k, r.blob);
          const style = stop.style !== "auto" ? stop.style : (r.style || STYLES[Math.floor(Math.random() * STYLES.length)].id);
          const c = { imgKey: k, kind: r.kind, kindZh: ({ self: "自拍", other: "别人帮拍", group: "合照" })[r.kind] || "", scene: r.scene, texts: r.texts, style, ts: Date.now() };
          const list = load().map(t => t.id === trip.id ? Object.assign({}, t, { stops: t.stops.map((s, i) => i === next ? Object.assign({}, s, { card: c }) : s) }) : t);
          put(list);
        } catch (e) { toast("没寄成：" + String(e && e.message || e).slice(0, 80)); }
        finally { setBusy(""); }
      };
      const del = () => {
        // 同上：不用 window.confirm
        const go = async () => {
          for (const s of trip.stops) if (s.card && s.card.imgKey && typeof idbImgDel === "function") { try { await idbImgDel(s.card.imgKey); } catch (e) {} }
          put(load().filter(t => t.id !== trip.id)); setOpenId(null);
        };
        if (typeof requestAppConfirm === "function") requestAppConfirm("删掉这趟旅行？", "明信片和照片都会删掉（已经存到手机的不受影响）", go, "删掉");
        else go();
      };
      const save = async (c, s) => { try { const b = await drawCard(c, s, names); if (typeof saveFile === "function") await saveFile(new File([b], "明信片-" + s.place + ".jpg", { type: "image/jpeg" })); } catch (e) { toast("没存下来：" + String(e && e.message || e).slice(0, 60)); } };
      const who = s => s.sender === "all" ? "大家一起" : names[s.sender] || "TA";
      const got = trip.stops.filter(s => s.card);
      return page(trip.title, () => setOpenId(null), [
        h("div", { key: "meta", style: { fontSize: FS(11.5), color: SUB, margin: "2px 2px 14px", lineHeight: 1.6 } },
          trip.ids.map(id => names[id]).filter(Boolean).join("、") + (trip.meGo ? " 和你" : "") + " · " + trip.stops.length + " 站 · " + (trip.remember ? "记进记忆" : "不记进记忆")),
        got.length ? null : h("div", { key: "empty", style: { textAlign: "center", color: SUB, fontSize: FS(12.5), padding: "30px 0" } }, "还没寄出第一张"),
        got.map((s, i) => h(Postcard, { key: i, card: s.card, stop: s, names, onSave: () => save(s.card, s) })),
        h("div", { key: "route", style: { marginTop: 6, fontSize: FS(11.5), color: SUB, lineHeight: 1.9 } },
          trip.stops.map((s, i) => h("div", { key: i, style: { color: s.card ? SUB : i === next ? INK : "#c8b8c0" } }, (s.card ? "✓ " : i === next ? "→ " : "· ") + s.place + "（" + who(s) + "寄）"))),
        h("button", { key: "del", "data-wk": "tripbtn", "data-part": "deltrip", onClick: del, style: { marginTop: 18, border: "none", background: "transparent", color: SUB, fontSize: FS(12) } }, "删掉这趟旅行")
      ], stop ? h("div", null,
        h("div", { style: { fontSize: FS(11), color: SUB, textAlign: "center", marginBottom: 8 } }, busy === "send" ? "在写、在拍…要等半分钟左右" : "下一站：" + stop.place + " · " + who(stop) + "寄"),
        big(busy === "send" ? "在路上…" : "寄这一站", send, "send", !!busy)) : h("div", { style: { textAlign: "center", color: SUB, fontSize: FS(12.5), padding: "8px 0" } }, "这趟走完了"));
    }

    // ── 旅行列表 ──
    return page("旅行", props.onBack, [
      hero("出门走走", "挑几个人、写一个地方，排出几站。每到一站寄回一张明信片：正面是TA在那儿拍的照，背面是TA写给你的话。", "每寄一张：一次聊天模型＋一张图"),
      trips.length ? trips.map(t => { const n = t.stops.filter(s => s.card).length, c0 = (t.stops.find(s => s.card) || {}).card;
        return item(t.id, "tripitem", () => setOpenId(t.id), h(TripThumb, { k: c0 && c0.imgKey }), t.title,
          t.ids.map(id => names[id]).filter(Boolean).join("、") + (t.meGo ? " 和你" : ""),
          n >= t.stops.length ? "走完了 · " + n + " 张明信片" : "收到 " + n + " / " + t.stops.length); })
        : empty("还没出过门，点下面开始第一趟")
    ], big("新的旅行", () => setDraft({ ids: chars[0] ? [chars[0].id] : [], meGo: false, remember: true, place: "", stops: [] }), "new"));
  }
  function TripThumb({ k }) {
    const url = typeof useIdbImgUrl === "function" ? useIdbImgUrl(k) : null;
    return h("div", { style: { width: 66, height: 66, borderRadius: 14, overflow: "hidden", flexShrink: 0, background: THEMES.trip.hero, display: "flex", alignItems: "center", justifyContent: "center" } },
      url ? h("img", { src: url, style: { width: "100%", height: "100%", objectFit: "cover" } }) : icon(ICONS.trip, 26));
  }
  window.CameraTrip = CameraTrip;
  window.CameraTrip.STYLES = STYLES;
  window.CameraTrip.kit = { makeUI, THEMES, wrap, loadImg, HAND, GRAD, INK, SUB, PINK, FS, dateZh };
})();
