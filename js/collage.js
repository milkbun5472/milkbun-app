// 拼一张壁纸（她 2026-11-10 转群友许愿：「和 char 一起做情侣拼接壁纸，char 可以和 u 一起摆位置」）
//   ⚠️照片不交给生图去拼：合照墙里的照片脸是对的，生图一拼脸会走样、手写英文会乱码，还每张花一次生图。
//     这里用画布把真照片排上去，字也是 App 写的——跟杂志封面、电影海报那套一个道理。
//   ⚠️预览和导出走【同一个】draw：预览看到什么，存下来就是什么，不另写一份排版。
//   TA 那一手（挑哪几张、放哪格、写什么字）在 app.js 的 onArrange 里，一次文字调用；
//   存下来（挂墙、存手机、一人一半那半张换成 TA 的锁屏）在 onSave 里。这个文件只管摆和画。
//   v2（她 2026-11-10：「开放一点自由度：字体和大小、调整位置、背景样式和 emoji」）：
//     样式只给一个起点——背景、字体、字号、贴纸都能换，照片、字、贴纸在预览上按住就能拖。
(function () {
  const W = 1080, H = 2340;
  const FONTS = {
    hand: { name: "花体英文", css: "'Dancing Script','Long Cang','Noto Serif SC',cursive" },
    brush: { name: "中文手写", css: "'Long Cang','Dancing Script','Noto Serif SC',cursive" },
    serif: { name: "宋体", css: "'Noto Serif SC','Songti SC',serif" },
    sans: { name: "黑体", css: "'Archivo','PingFang SC','Noto Sans SC',sans-serif" }
  };
  const FONT_ORDER = ["hand", "brush", "serif", "sans"];
  // 背景纸：每种样式有自己默认的那张，也都能换成别的
  const BGS = {
    plaid: { name: "棕格纹", base: "#c79f78", line: "#6b4228" },
    pinkPlaid: { name: "粉格纹", base: "#efc9cf", line: "#b0596b" },
    sagePlaid: { name: "绿格纹", base: "#b9c7a7", line: "#4f6440" },
    cream: { name: "米白纸", base: "#f2eee6" },
    dots: { name: "波点", base: "#fbf3ee", dot: "#e7a9b4" },
    grid: { name: "方格本", base: "#fbfbf8", grid: "#d9dde6" },
    mist: { name: "雾灰渐变", from: "#efe9e1", to: "#cbc1b5" },
    night: { name: "夜色", from: "#2c2b3a", to: "#121218" }
  };
  const BG_ORDER = ["plaid", "pinkPlaid", "sagePlaid", "cream", "dots", "grid", "mist", "night"];
  const STICKERS = ["☕", "🕯️", "🎀", "🧸", "🌷", "🍓", "⭐", "💌", "🐱", "🐶", "🌙", "☁️", "🎧", "📷", "🍰", "🫧", "💐", "🎂", "♥", "♡", "✿", "☆"];
  // 每种样式：几格、每格在哪（中心 x/y、宽高、转角）、字写在哪。坐标都按一张 1080×2340 的手机竖屏算
  const TPL = {
    polaroid: {
      name: "拍立得", sub: "三张拍立得", n: 3, caption: true, bg: "plaid",
      slots: [{ x: 560, y: 600, w: 540, h: 620, r: -4 }, { x: 480, y: 1250, w: 540, h: 620, r: 3 }, { x: 590, y: 1900, w: 540, h: 620, r: -2 }],
      words: [{ x: 540, y: 205, size: 64, color: "#5b3a24" }],
      deco: [["☕", 900, 560, 130], ["🕯️", 880, 1480, 120], ["🎀", 190, 330, 120], ["🧸", 170, 2150, 140]]
    },
    scrap: {
      name: "剪贴本", sub: "白边照片、胶带和手写字", n: 5, bg: "cream",
      slots: [{ x: 300, y: 540, w: 520, h: 620, r: -6 }, { x: 790, y: 720, w: 470, h: 560, r: 5 }, { x: 340, y: 1270, w: 560, h: 460, r: 3 },
        { x: 770, y: 1530, w: 450, h: 590, r: -4 }, { x: 470, y: 2030, w: 600, h: 410, r: 2 }],
      words: [{ x: 300, y: 170, size: 62, color: "#b23a48", r: -3 }, { x: 790, y: 1060, size: 46, color: "#2b2b2b", r: 4 },
        { x: 820, y: 1880, size: 50, color: "#b23a48", r: -2 }, { x: 330, y: 1700, size: 44, color: "#2b2b2b", r: 3 }],
      deco: [["♥", 950, 240, 120, "#d0465c"], ["✿", 110, 930, 100, "#c9a227"], ["☆", 990, 2180, 90, "#555"], ["♡", 140, 1640, 100, "#d0465c"]]
    },
    lock: {
      name: "锁屏款", sub: "上面留给时间，下面四张", n: 4, bg: "mist",
      slots: [{ x: 300, y: 1230, w: 470, h: 600, round: 28 }, { x: 780, y: 1230, w: 470, h: 600, round: 28 },
        { x: 300, y: 1870, w: 470, h: 600, round: 28 }, { x: 780, y: 1870, w: 470, h: 600, round: 28 }],
      words: [{ x: 540, y: 850, size: 58, color: "#5e5248" }, { x: 540, y: 2250, size: 44, color: "#7d7064" }],
      deco: [["♥", 540, 1550, 70, "#c45b6e"]]
    }
  };
  const ORDER = ["polaroid", "scrap", "lock"];
  const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

  function bg(ctx, key, ox) {
    const b = BGS[key] || BGS.cream;
    ctx.save(); ctx.translate(ox, 0);
    if (b.from) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, b.from); g.addColorStop(1, b.to); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    else { ctx.fillStyle = b.base; ctx.fillRect(0, 0, W, H); }
    if (b.line) {
      ctx.globalAlpha = 0.16; ctx.fillStyle = b.line;
      for (let x = 0; x < W; x += 90) ctx.fillRect(x, 0, 34, H);
      for (let y = 0; y < H; y += 90) ctx.fillRect(0, y, W, 34);
      ctx.globalAlpha = 0.08; ctx.fillStyle = "#fff";
      for (let x = 45; x < W; x += 90) ctx.fillRect(x, 0, 6, H);
    } else if (b.dot) {
      ctx.fillStyle = b.dot;
      for (let y = 40; y < H; y += 80) for (let x = (y / 80) % 2 ? 80 : 40; x < W; x += 80) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
    } else if (b.grid) {
      ctx.strokeStyle = b.grid; ctx.lineWidth = 2;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    } else if (!b.from) {
      ctx.fillStyle = "rgba(0,0,0,.035)";
      for (let i = 0; i < 900; i++) { const x = (i * 197) % W, y = (i * 389) % H; ctx.fillRect(x, y, 3, 3); }
    }
    ctx.restore();
  }
  function cover(ctx, img, w, h) {
    const iw = img.width, ih = img.height, s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, -w / 2, -h / 2, w, h);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fitText(ctx, text, size, maxW, font) {
    let s = size; ctx.font = s + "px " + font;
    while (s > 18 && ctx.measureText(text).width > maxW) { s -= 2; ctx.font = s + "px " + font; }
    return ctx.measureText(text).width;
  }
  const adjOf = (layout, key) => (layout.adj || {})[key] || {};
  function slot(ctx, tpl, sl, img, cap, ox, a, font, fs) {
    const sc = a.s || 1, w = sl.w * sc, hh = sl.h * sc;
    ctx.save(); ctx.translate(ox + sl.x + (a.dx || 0), sl.y + (a.dy || 0)); ctx.rotate(((sl.r || 0) + (a.r || 0)) * Math.PI / 180);
    const empty = () => { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-w / 2, -hh / 2, w, hh); };
    ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    if (tpl === "polaroid") {
      ctx.fillStyle = "#fbfaf6"; ctx.fillRect(-w / 2, -hh / 2, w, hh); ctx.shadowColor = "transparent";
      const m = 30 * sc, pw = w - m * 2, top = -hh / 2 + m;
      ctx.save(); ctx.translate(0, top + pw / 2); ctx.beginPath(); ctx.rect(-pw / 2, -pw / 2, pw, pw); ctx.clip();
      if (img) cover(ctx, img, pw, pw); else { ctx.fillStyle = "#222"; ctx.fillRect(-pw / 2, -pw / 2, pw, pw); }
      ctx.restore();
      if (cap) { ctx.fillStyle = "#3c2b20"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; fitText(ctx, cap, 50 * sc * fs, pw, font); ctx.fillText(cap, 0, top + pw + (hh - pw - m) / 2); }
    } else if (tpl === "scrap") {
      const b = 18 * sc; ctx.fillStyle = "#fff"; ctx.fillRect(-w / 2 - b, -hh / 2 - b, w + b * 2, hh + b * 2); ctx.shadowColor = "transparent";
      ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -hh / 2, w, hh); ctx.clip(); if (img) cover(ctx, img, w, hh); else empty(); ctx.restore();
      ctx.fillStyle = "rgba(236,222,176,.78)"; ctx.save(); ctx.translate(0, -hh / 2 - b); ctx.rotate(-0.06); ctx.fillRect(-90 * sc, -24 * sc, 180 * sc, 48 * sc); ctx.restore();
    } else {
      const rr = (sl.round || 0) * sc;
      roundRect(ctx, -w / 2, -hh / 2, w, hh, rr); ctx.fillStyle = "#fff"; ctx.fill(); ctx.shadowColor = "transparent";
      ctx.save(); roundRect(ctx, -w / 2, -hh / 2, w, hh, rr); ctx.clip(); if (img) cover(ctx, img, w, hh); else empty(); ctx.restore();
    }
    ctx.restore();
    return { x: ox + sl.x + (a.dx || 0), y: sl.y + (a.dy || 0), w: w + 36, h: hh + 36 };
  }
  // 默认那几颗贴纸：两半各一套，摊成整张画布上的坐标，之后她加的、拖的都在这一份里
  const defaultDeco = (tplKey, split) => {
    const d = (TPL[tplKey] || TPL.polaroid).deco, out = [];
    for (let k = 0; k < (split ? 2 : 1); k++) d.forEach(x => out.push({ ch: x[0], x: x[1] + k * W, y: x[2], size: x[3], color: x[4] || "#000" }));
    return out;
  };
  // layout = { tpl, split, picks, captions, words, font, fontScale, bg, deco, adj }；imgs = 照片下标 → 已解码的图
  //   一人一半：左边一整张给她、右边一整张给 TA，格子各一套；接缝上一颗心，两张并排才拼得起来
  //   返回每样东西在画布上的位置（拖动时认是按到了谁）
  function draw(canvas, layout, imgs, sel) {
    const def = TPL[layout.tpl] || TPL.polaroid, halves = layout.split ? 2 : 1;
    const font = (FONTS[layout.font] || FONTS.hand).css, fs = Number(layout.fontScale) || 1;
    canvas.width = W * halves; canvas.height = H;
    const ctx = canvas.getContext("2d"), boxes = [];
    for (let k = 0; k < halves; k++) bg(ctx, layout.bg || def.bg, k * W);
    for (let k = 0; k < halves; k++) {
      const ox = k * W;
      def.slots.forEach((sl, i) => {
        const at = k * def.n + i, p = (layout.picks || [])[at];
        const bx = slot(ctx, layout.tpl, sl, p != null && p >= 0 ? imgs[p] : null, def.caption ? (layout.captions || [])[at] : "", ox, adjOf(layout, "s" + at), font, fs);
        boxes.push(Object.assign({ key: "s" + at, kind: "slot", idx: at }, bx));
      });
    }
    for (let k = 0; k < halves; k++) {
      const ox = k * W;
      def.words.forEach((wd, i) => {
        const at = k * def.words.length + i, s = String((layout.words || [])[at] || "").trim(); if (!s) return;
        const a = adjOf(layout, "w" + at), x = ox + wd.x + (a.dx || 0), y = wd.y + (a.dy || 0);
        ctx.save(); ctx.translate(x, y); ctx.rotate(((wd.r || 0) + (a.r || 0)) * Math.PI / 180);
        ctx.fillStyle = layout.bg === "night" ? "#f3eee8" : wd.color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const size = wd.size * fs * (a.s || 1), tw = fitText(ctx, s, size, 960, font); ctx.fillText(s, 0, 0);
        ctx.restore();
        boxes.push({ key: "w" + at, kind: "word", idx: at, x, y, w: tw + 40, h: size * 1.4 });
      });
    }
    (layout.deco || defaultDeco(layout.tpl, layout.split)).forEach((d, i) => {
      const size = d.size * (d.s || 1);
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate((d.r || 0) * Math.PI / 180);
      ctx.font = size + "px " + EMOJI_FONT; ctx.fillStyle = d.color || "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d.ch, 0, 0);
      ctx.restore();
      boxes.push({ key: "d" + i, kind: "deco", idx: i, x: d.x, y: d.y, w: size * 1.2, h: size * 1.2 });
    });
    if (layout.split) {
      // 接缝上那颗心画成形状（不靠表情字体，哪台机器上都一样）
      ctx.save(); ctx.translate(W, H / 2); ctx.scale(2.4, 2.4); ctx.fillStyle = "#d0465c";
      ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -40, -60, 0, -30); ctx.bezierCurveTo(40, -60, 60, -10, 0, 30); ctx.fill(); ctx.restore();
    }
    // 选中的那一样描一圈虚线框（只在预览上画，导出不传 sel）
    const hit = sel && boxes.find(b => b.key === sel);
    if (hit) { ctx.save(); ctx.setLineDash([18, 12]); ctx.lineWidth = 6; ctx.strokeStyle = "#e0507a"; ctx.strokeRect(hit.x - hit.w / 2, hit.y - hit.h / 2, hit.w, hit.h); ctx.restore(); }
    return boxes;
  }
  const slotCount = layout => (TPL[layout.tpl] || TPL.polaroid).n * (layout.split ? 2 : 1);
  const wordCount = layout => (TPL[layout.tpl] || TPL.polaroid).words.length * (layout.split ? 2 : 1);
  // 按到了谁：贴纸在最上面，再是字，最后是照片
  function hitTest(boxes, x, y) {
    const rank = { deco: 0, word: 1, slot: 2 };
    return (boxes || []).filter(b => Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2)
      .sort((a, b) => rank[a.kind] - rank[b.kind])[0] || null;
  }

  async function loadImg(p) {
    try {
      let b = p.imgKey && typeof idbImgGet === "function" ? await idbImgGet(p.imgKey) : null;
      if (!b && p.imgUrl) b = await (await fetch(p.imgUrl)).blob();
      return b && b.size ? await createImageBitmap(b) : null;
    } catch (e) { return null; }
  }

  function CollageMaker({ partner, photos, onBack, onArrange, onSave }) {
    const t = useTheme();
    const name = partner.remark || partner.name;
    const list = React.useMemo(() => (photos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)), [photos]);
    const [layout, setLayout] = useState(() => ({ tpl: "polaroid", split: false, picks: [0, 1, 2].map(i => i < list.length ? i : -1), captions: [], words: [], font: "hand", fontScale: 1, bg: "", deco: null, adj: {} }));
    const [why, setWhy] = useState("");
    const [busy, setBusy] = useState(""); // "arrange" | "save"
    const [pickAt, setPickAt] = useState(-1);
    const [sel, setSel] = useState("");
    const imgs = useRef({});
    const boxes = useRef([]);
    const drag = useRef(null);
    const [, bump] = useState(0);
    const cv = useRef(null);
    // 用到哪张才解哪张，解好了重画
    useEffect(() => {
      let live = true;
      (layout.picks || []).forEach(p => { if (p >= 0 && list[p] && !(p in imgs.current)) { imgs.current[p] = null; loadImg(list[p]).then(img => { imgs.current[p] = img; if (live) bump(x => x + 1); }); } });
      return () => { live = false; };
    }, [layout.picks && layout.picks.join(","), list.length]);
    useEffect(() => { if (cv.current) boxes.current = draw(cv.current, layout, imgs.current, sel); });
    const reshape = (patch) => setLayout(l => {
      const n = Object.assign({}, l, patch), need = slotCount(n), picks = (n.picks || []).slice(0, need);
      for (let i = picks.length; i < need; i++) { const free = list.findIndex((_, j) => picks.indexOf(j) < 0); picks.push(free); }
      return Object.assign(n, { picks });
    });
    // 换样式、开关一人一半：位置和贴纸回到那个样式的起点（格子都变了，旧的挪动对不上）
    const restart = patch => { setSel(""); reshape(Object.assign({ adj: {}, deco: null, bg: "" }, patch)); };
    const decoNow = l => l.deco || defaultDeco(l.tpl, l.split);
    // ── 在预览上按住拖：照片、字、贴纸都能挪 ──
    const toCanvas = e => { const c = cv.current, r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
    const onDown = e => {
      const p = toCanvas(e), b = hitTest(boxes.current, p.x, p.y);
      if (!b) { setSel(""); return; }
      setSel(b.key);
      const base = b.kind === "deco" ? { x: decoNow(layout)[b.idx].x, y: decoNow(layout)[b.idx].y } : { x: adjOf(layout, b.key).dx || 0, y: adjOf(layout, b.key).dy || 0 };
      drag.current = { key: b.key, kind: b.kind, idx: b.idx, sx: p.x, sy: p.y, base };
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    };
    const onMove = e => {
      const d = drag.current; if (!d) return;
      const p = toCanvas(e), nx = d.base.x + p.x - d.sx, ny = d.base.y + p.y - d.sy;
      setLayout(l => {
        if (d.kind === "deco") { const deco = decoNow(l).slice(); deco[d.idx] = Object.assign({}, deco[d.idx], { x: nx, y: ny }); return Object.assign({}, l, { deco }); }
        const adj = Object.assign({}, l.adj); adj[d.key] = Object.assign({}, adj[d.key], { dx: nx, dy: ny }); return Object.assign({}, l, { adj });
      });
    };
    const onUp = () => { drag.current = null; };
    // 选中的那一样：大一点、小一点、转一下、复原、删掉（贴纸才能删）
    const selBox = (boxes.current || []).find(b => b.key === sel);
    const tweak = (ds, dr) => setLayout(l => {
      if (!selBox) return l;
      if (selBox.kind === "deco") { const deco = decoNow(l).slice(), d = deco[selBox.idx]; deco[selBox.idx] = Object.assign({}, d, { s: Math.max(0.3, Math.min(3, (d.s || 1) * ds)), r: (d.r || 0) + dr }); return Object.assign({}, l, { deco }); }
      const adj = Object.assign({}, l.adj), a = adj[sel] || {}; adj[sel] = Object.assign({}, a, { s: Math.max(0.4, Math.min(2, (a.s || 1) * ds)), r: (a.r || 0) + dr }); return Object.assign({}, l, { adj });
    });
    const resetSel = () => setLayout(l => {
      if (!selBox) return l;
      if (selBox.kind === "deco") { const deco = decoNow(l).slice(); deco[selBox.idx] = Object.assign({}, deco[selBox.idx], { s: 1, r: 0 }); return Object.assign({}, l, { deco }); }
      const adj = Object.assign({}, l.adj); delete adj[sel]; return Object.assign({}, l, { adj });
    });
    const dropSel = () => { if (!selBox || selBox.kind !== "deco") return; setLayout(l => Object.assign({}, l, { deco: decoNow(l).filter((_, i) => i !== selBox.idx) })); setSel(""); };
    const addSticker = ch => setLayout(l => {
      const deco = decoNow(l).concat([{ ch, x: W / 2 + (Math.random() * 200 - 100), y: H / 2 + (Math.random() * 300 - 150), size: 130, color: /[♥♡]/.test(ch) ? "#d0465c" : /[✿☆]/.test(ch) ? "#c9a227" : "#000" }]);
      setSel("d" + (deco.length - 1)); return Object.assign({}, l, { deco });
    });
    const arrange = async () => {
      if (!onArrange || busy) return;
      setBusy("arrange");
      try {
        const r = await onArrange(list, layout.tpl, layout.split);
        if (r) { setLayout(l => Object.assign({}, l, { picks: r.picks, captions: r.captions, words: r.words })); setWhy(r.why || ""); }
      } finally { setBusy(""); }
    };
    const save = async () => {
      if (!onSave || busy || !cv.current) return;
      setBusy("save");
      try {
        const full = document.createElement("canvas"); draw(full, layout, imgs.current, "");
        const toBlob = c => new Promise(ok => c.toBlob(b => ok(b), "image/jpeg", 0.92));
        const half = k => { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(full, k * W, 0, W, H, 0, 0, W, H); return toBlob(c); };
        const used = (layout.picks || []).filter(p => p >= 0).map(p => list[p] && list[p].desc).filter(Boolean);
        await onSave(layout.split
          ? { mine: await half(0), his: await half(1), tpl: layout.tpl, words: layout.words, used }
          : { mine: await toBlob(full), tpl: layout.tpl, words: layout.words, used });
      } finally { setBusy(""); }
    };
    const def = TPL[layout.tpl];
    const lab = { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, margin: "16px 2px 8px" };
    const inp = { width: "100%", padding: "9px 11px", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 16, marginBottom: 7 };
    // 挑一个值的那几排（背景、字体）：小方块选项，选中的描深一圈
    const chip = (on, label, onClick, extra, kid) => h("button", { key: label, onClick, className: "active:opacity-70 shrink-0",
      style: Object.assign({ padding: "7px 12px", borderRadius: 10, border: "1.5px solid " + (on ? t.ink : t.line), color: on ? t.ink : t.sub, background: t.bg2, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" }, extra || {}) }, kid || null, label);
    const row = kids => h("div", { className: "flex", style: { gap: 7, overflowX: "auto", paddingBottom: 2 } }, kids);
    const small = (label, onClick, on) => h("button", { key: label, onClick, disabled: on === false, className: "flex-1 active:opacity-70 disabled:opacity-30",
      style: { padding: "8px 0", borderRadius: 10, border: "1px solid " + t.line, color: t.ink, fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } }, label);
    if (pickAt >= 0) return h("div", { "data-wk": "uspage", "data-part": "collagepick", className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "第 " + (pickAt + 1) + " 格放哪张", bg: "transparent", onBack: () => setPickAt(-1) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 } },
          list.map((p, i) => h("button", { key: i, onClick: () => { setLayout(l => { const picks = l.picks.slice(); picks[pickAt] = i; return Object.assign({}, l, { picks }); }); setPickAt(-1); },
            className: "active:opacity-80", style: { aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "2px solid " + (layout.picks[pickAt] === i ? t.accent : t.line), padding: 0 } },
            typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: p }) : null)))));
    const selName = selBox ? (selBox.kind === "slot" ? "第 " + (selBox.idx + 1) + " 张照片" : selBox.kind === "word" ? "第 " + (selBox.idx + 1) + " 句字" : "这颗贴纸") : "";
    return h("div", { "data-wk": "uspage", "data-part": "collage", className: "h-full flex flex-col", style: { background: t.bg } },
      h(Head, { zh: "拼一张壁纸", sub: name, bg: "transparent", onBack }),
      h("div", { ref: typeof keepScroll === "function" ? keepScroll("collage:" + partner.id) : null, className: "flex-1 min-h-0 overflow-y-auto px-5 pb-12" },
        // 样式：下划线页签（tabs-not-plain-pills）
        h("div", { className: "flex", style: { borderBottom: "1px solid " + t.line, marginTop: 6 } },
          ORDER.map(k => h("button", { key: k, "data-part": "collagetpl", onClick: () => restart({ tpl: k }), className: "flex-1 active:opacity-70",
            style: { padding: "10px 0 9px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: layout.tpl === k ? t.ink : t.fog, borderBottom: "2px solid " + (layout.tpl === k ? t.ink : "transparent"), marginBottom: -1 } }, TPL[k].name))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, textAlign: "center", margin: "8px 0 10px" } }, def.sub + " · 按住照片、字、贴纸就能拖"),
        // 预览钉在顶上：往下挑背景、字体、贴纸的时候还看得见它（高度按屏幕算，宽度跟着比例走）
        h("div", { "data-part": "collagestage", style: { position: "sticky", top: 0, zIndex: 2, display: "flex", justifyContent: "center", padding: "6px 0 8px", background: t.bg } },
          h("canvas", { ref: cv, "data-part": "collagecanvas", onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
            style: { height: "min(44vh, " + (layout.split ? "calc((100vw - 40px) * 1.083)" : "520px") + ")", width: "auto", maxWidth: "100%", borderRadius: 14, boxShadow: "0 6px 22px rgba(0,0,0,.14)", touchAction: "none" } })),
        // 选中了一样：就地几颗键
        selBox ? h("div", { "data-part": "collagesel", style: { marginTop: 10, padding: "10px 10px 8px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 8 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } }, "选中了" + selName),
            h("button", { onClick: () => setSel(""), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "取消选中")),
          h("div", { className: "flex", style: { gap: 6 } },
            small("大一点", () => tweak(1.12, 0)), small("小一点", () => tweak(1 / 1.12, 0)), small("左转", () => tweak(1, -6)), small("右转", () => tweak(1, 6)),
            selBox.kind === "slot" ? small("换照片", () => setPickAt(selBox.idx)) : null,
            small("复原", resetSel), selBox.kind === "deco" ? small("删掉", dropSel) : null)) : null,
        h("div", { className: "flex items-center", style: { gap: 10, marginTop: 14, padding: "10px 12px", borderRadius: 14, border: "1px solid " + t.line } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "一人一半"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "左边那张给你，右边那张换成 " + name + " 手机的锁屏，并排才拼成一颗心")),
          typeof Toggle === "function" ? h(Toggle, { on: !!layout.split, onChange: v => restart({ split: !!v }), wk: "collage", part: "split" }) : null),
        onArrange ? h("button", { onClick: arrange, disabled: !!busy || !list.length, "data-part": "collagearrange", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 14, padding: "12px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))" } },
          busy === "arrange" ? name + " 在挑…" : "让 " + name + " 来摆") : null,
        why ? h("div", { style: { fontFamily: F_BODY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, marginTop: 10, textAlign: "center" } }, "「" + why + "」") : null,
        h("div", { style: lab }, "背景"),
        row(BG_ORDER.map(k => chip((layout.bg || def.bg) === k, BGS[k].name, () => setLayout(l => Object.assign({}, l, { bg: k })),
          { paddingLeft: 9, display: "flex", alignItems: "center", gap: 6 },
          h("span", { "aria-hidden": "true", style: { width: 14, height: 14, borderRadius: 4, border: "1px solid rgba(0,0,0,.12)", background: BGS[k].from ? "linear-gradient(" + BGS[k].from + "," + BGS[k].to + ")" : BGS[k].base } })))),
        h("div", { style: lab }, "贴纸（点一下加一颗，按住拖到想放的地方）"),
        h("div", { "data-part": "collagestickers", style: { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4 } },
          STICKERS.map(ch => h("button", { key: ch, onClick: () => addSticker(ch), className: "active:opacity-60",
            style: { aspectRatio: "1", borderRadius: 8, border: "1px solid " + t.line, background: t.bg2, fontSize: 20, color: /[♥♡]/.test(ch) ? "#d0465c" : t.ink } }, ch))),
        h("div", { style: lab }, "字体"),
        row(FONT_ORDER.map(k => chip(layout.font === k, FONTS[k].name, () => setLayout(l => Object.assign({}, l, { font: k })), { fontFamily: FONTS[k].css, fontSize: 15 }))),
        h("div", { className: "flex items-center", style: { gap: 10, marginTop: 10 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, "字号"),
          h("input", { type: "range", min: 60, max: 160, step: 5, value: Math.round((layout.fontScale || 1) * 100), "data-part": "collagefs",
            onChange: e => { const v = Number(e.target.value) / 100; setLayout(l => Object.assign({}, l, { fontScale: v })); }, style: { flex: 1 } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, width: 40, textAlign: "right" } }, Math.round((layout.fontScale || 1) * 100) + "%")),
        h("div", { style: lab }, "每一格放哪张（点一格换）"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 } },
          (layout.picks || []).map((p, i) => h("button", { key: i, onClick: () => setPickAt(i), className: "active:opacity-80",
            style: { aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid " + t.line, background: t.bg2, padding: 0, position: "relative" } },
            p >= 0 && list[p] && typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: list[p] }) : h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, i + 1)))),
        def.caption ? h(Fragment, null, h("div", { style: lab }, "拍立得下面的字"),
          (layout.picks || []).map((_, i) => h("input", { key: i, value: (layout.captions || [])[i] || "", maxLength: 16, placeholder: "第 " + (i + 1) + " 张（可空）", style: inp,
            onChange: e => { const v = e.target.value; setLayout(l => { const c = (l.captions || []).slice(); c[i] = v; return Object.assign({}, l, { captions: c }); }); } }))) : null,
        h("div", { style: lab }, "手写的字"),
        Array.from({ length: wordCount(layout) }, (_, i) => h("input", { key: i, value: (layout.words || [])[i] || "", maxLength: 22, placeholder: "第 " + (i + 1) + " 句（可空）", style: inp,
          onChange: e => { const v = e.target.value; setLayout(l => { const c = (l.words || []).slice(); c[i] = v; return Object.assign({}, l, { words: c }); }); } })),
        h("button", { onClick: save, disabled: !!busy, "data-part": "collagesave", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 16, padding: "13px 0", borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
          busy === "save" ? "在存…" : (layout.split ? "存下来 · 右边那张给 " + name : "存下来")),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, marginTop: 8, textAlign: "center" } },
          "存到手机、也挂上合照墙；" + name + " 会看到你们拼了一张。照片和字都是 App 排的，不花生图。")));
  }
  window.Collage = { TPL, ORDER, BGS, FONTS, STICKERS, draw, hitTest, slotCount, wordCount, defaultDeco, CollageMaker };
})();
