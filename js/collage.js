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
    },
    // 自己摆（她 2026-11-10：「可以选自己放」）：一张空纸，照片和字全由她加
    blank: { name: "自己摆", sub: "一张空纸，照片和字都由你放", n: 0, bg: "cream", slots: [], words: [], deco: [] }
  };
  const ORDER = ["polaroid", "scrap", "lock", "blank"];
  // 自己加的照片用哪种相框（借三种样式各自那一种）
  const FRAMES = { polaroid: "拍立得", scrap: "白边", lock: "圆角" };
  const TEXT_COLORS = ["#2b2b2b", "#5b3a24", "#b23a48", "#d0465c", "#4f6440", "#3b5b8a", "#ffffff"];
  const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

  // 自己传的底存在图库里，名字都以这个开头（不另开存储：列出来就是按这个前缀筛）
  const MY_BG = "img_collagebg_";
  const isMyBg = k => String(k || "").indexOf(MY_BG) === 0;
  // 花纹那一层用什么颜色：样式自带的，或者她自己挑的（她 2026-11-10：「喜欢这个格子但是不想要这个颜色」）
  const inkOf = b => b.line || b.dot || b.grid || b.to || "";
  function bg(ctx, key, ox, layout, img) {
    ctx.save(); ctx.translate(ox, 0);
    if (isMyBg(key)) {
      ctx.fillStyle = "#eee"; ctx.fillRect(0, 0, W, H);
      if (img) { ctx.save(); ctx.translate(W / 2, H / 2); cover(ctx, img, W, H); ctx.restore(); }
      ctx.restore(); return;
    }
    const b = BGS[key] || BGS.cream, base = (layout && layout.bgColor) || b.base || b.from, ink = (layout && layout.bgInk) || inkOf(b);
    if (b.from) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, base); g.addColorStop(1, ink); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    else { ctx.fillStyle = base; ctx.fillRect(0, 0, W, H); }
    if (b.line) {
      ctx.globalAlpha = 0.16; ctx.fillStyle = ink;
      for (let x = 0; x < W; x += 90) ctx.fillRect(x, 0, 34, H);
      for (let y = 0; y < H; y += 90) ctx.fillRect(0, y, W, 34);
      ctx.globalAlpha = 0.08; ctx.fillStyle = "#fff";
      for (let x = 45; x < W; x += 90) ctx.fillRect(x, 0, 6, H);
    } else if (b.dot) {
      ctx.fillStyle = ink;
      for (let y = 40; y < H; y += 80) for (let x = (y / 80) % 2 ? 80 : 40; x < W; x += 80) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
    } else if (b.grid) {
      ctx.strokeStyle = ink; ctx.lineWidth = 2;
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
    const bgKey = layout.bg || def.bg;
    for (let k = 0; k < halves; k++) bg(ctx, bgKey, k * W, layout, imgs[bgKey]);
    for (let k = 0; k < halves; k++) {
      const ox = k * W;
      def.slots.forEach((sl, i) => {
        const at = k * def.n + i, p = (layout.picks || [])[at];
        if ((layout.hidden || {})["s" + at]) return;   // 这一格她删掉了
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
    // 她自己加的照片和字：按加进来的先后叠，后加的在上面
    (layout.free || []).forEach((f, i) => {
      if (f.type === "photo") {
        const bx = slot(ctx, f.frame || "scrap", { x: f.x, y: f.y, w: f.w, h: f.h, round: 40 }, f.p != null && f.p >= 0 ? imgs[f.p] : null, f.cap || "", 0, { s: f.s, r: f.r }, font, fs);
        boxes.push(Object.assign({ key: "f" + i, kind: "fphoto", idx: i }, bx));
      } else {
        const s = String(f.text || "").trim(); if (!s) return;
        const ff = (FONTS[f.font] || FONTS[layout.font] || FONTS.hand).css, size = (f.size || 70) * (f.s || 1);
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate((f.r || 0) * Math.PI / 180);
        ctx.fillStyle = f.color || "#2b2b2b"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = size + "px " + ff;
        const tw = ctx.measureText(s).width; ctx.fillText(s, 0, 0); ctx.restore();
        boxes.push({ key: "f" + i, kind: "ftext", idx: i, x: f.x, y: f.y, w: tw + 40, h: size * 1.4 });
      }
    });
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
  // 按到了谁：贴纸在最上面，再是字，再是自己加的照片，最后是样式自带的格子；同一层里后画的（在上面的）先认
  function hitTest(boxes, x, y) {
    const rank = { deco: 0, ftext: 1, word: 1, fphoto: 2, slot: 3 };
    return (boxes || []).map((b, i) => Object.assign({ _i: i }, b)).filter(b => Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - b.y) <= b.h / 2)
      .sort((a, b) => rank[a.kind] - rank[b.kind] || b._i - a._i)[0] || null;
  }

  async function loadImg(p) {
    try {
      let b = p.imgKey && typeof idbImgGet === "function" ? await idbImgGet(p.imgKey) : null;
      if (!b && p.imgUrl) b = await (await fetch(p.imgUrl)).blob();
      return b && b.size ? await createImageBitmap(b) : null;
    } catch (e) { return null; }
  }

  // 「我的底」一格：点了用它；选中时角上一个 ✕ 能删
  function MyBgThumb({ k, on, t, onPick, onDrop }) {
    const [url, setUrl] = useState("");
    useEffect(() => { let live = true, u = ""; idbImgGet(k).then(b => { if (live && b) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => {}); return () => { live = false; if (u) URL.revokeObjectURL(u); }; }, [k]);
    return h("div", { className: "shrink-0", style: { position: "relative" } },
      h("button", { onClick: onPick, className: "active:opacity-70", style: { width: 54, height: 72, borderRadius: 10, overflow: "hidden", padding: 0, border: "2px solid " + (on ? t.ink : t.line), background: "#eee" } },
        url ? h("img", { src: url, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }) : null),
      on ? h("button", { onClick: onDrop, "aria-label": "删掉这张底", style: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, background: t.ink, color: t.bg2, fontSize: 12, lineHeight: "22px" } }, "✕") : null);
  }
  function CollageMaker({ partner, photos, onBack, onArrange, onSave }) {
    const t = useTheme();
    const name = partner.remark || partner.name;
    const list = React.useMemo(() => (photos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)), [photos]);
    const [layout, setLayout] = useState(() => ({ tpl: "polaroid", split: false, picks: [0, 1, 2].map(i => i < list.length ? i : -1), captions: [], words: [], font: "hand", fontScale: 1, bg: "", deco: null, adj: {}, free: [], hidden: {} }));
    const [why, setWhy] = useState("");
    const [busy, setBusy] = useState(""); // "arrange" | "save"
    // 挑照片给谁：{ kind: "slot"|"free", idx } 或 { kind: "new" }（新加一张自己放的）
    const [pickFor, setPickFor] = useState(null);
    const [sel, setSel] = useState("");
    const imgs = useRef({});
    const boxes = useRef([]);
    const drag = useRef(null);
    const touches = useRef({});   // 按在预览上的手指：两根就是捏合缩放、转
    const [, bump] = useState(0);
    const cv = useRef(null);
    // 用到哪张才解哪张，解好了重画
    const usedIdx = (layout.picks || []).concat((layout.free || []).filter(f => f.type === "photo").map(f => f.p));
    useEffect(() => {
      let live = true;
      usedIdx.forEach(p => { if (p >= 0 && list[p] && !(p in imgs.current)) { imgs.current[p] = null; loadImg(list[p]).then(img => { imgs.current[p] = img; if (live) bump(x => x + 1); }); } });
      return () => { live = false; };
    }, [usedIdx.join(","), list.length]);
    // 画完才知道每样东西在哪；刚加进来、刚选中的那一样，画完再刷一下，下面那排键才跟得上
    useEffect(() => {
      if (!cv.current) return;
      const had = !!(sel && (boxes.current || []).some(x => x.key === sel));
      boxes.current = draw(cv.current, layout, imgs.current, sel);
      if (sel && !had && boxes.current.some(x => x.key === sel)) bump(x => x + 1);
    });
    // 她自己传的底：从图库按前缀列出来；选中哪张才解哪张
    const [myBgs, setMyBgs] = useState([]);
    const bgUp = useRef(null);
    useEffect(() => { let live = true; (typeof idbImgKeys === "function" ? idbImgKeys() : Promise.resolve([])).then(ks => { if (live) setMyBgs(ks.filter(isMyBg).sort().reverse()); }).catch(() => {}); return () => { live = false; }; }, []);
    useEffect(() => {
      const k = layout.bg; if (!isMyBg(k) || k in imgs.current) return;
      imgs.current[k] = null; let live = true;
      loadImg({ imgKey: k }).then(img => { imgs.current[k] = img; if (live) bump(x => x + 1); });
      return () => { live = false; };
    }, [layout.bg]);
    const uploadBg = async file => {
      if (!file) return;
      try {
        const du = typeof resizeImageFile === "function" ? await resizeImageFile(file, 2400, 0.9) : await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(file); });
        const blob = await (await fetch(du)).blob(), key = MY_BG + Date.now();
        await idbImgPut(key, blob);
        setMyBgs(p => [key].concat(p)); setLayout(l => Object.assign({}, l, { bg: key, bgColor: "", bgInk: "" }));
      } catch (e) { typeof toast === "function" && toast("这张没传上：" + ((e && e.message) || "换一张试试")); }
    };
    const dropBg = async key => {
      try { await idbImgDel(key); } catch (e) {}
      delete imgs.current[key]; setMyBgs(p => p.filter(x => x !== key)); setLayout(l => l.bg === key ? Object.assign({}, l, { bg: "" }) : l);
    };
    const reshape = (patch) => setLayout(l => {
      const n = Object.assign({}, l, patch), need = slotCount(n), picks = (n.picks || []).slice(0, need);
      for (let i = picks.length; i < need; i++) { const free = list.findIndex((_, j) => picks.indexOf(j) < 0); picks.push(free); }
      return Object.assign(n, { picks });
    });
    // 换样式、开关一人一半：格子、贴纸回到那个样式的起点（格子都变了，旧的挪动对不上）；她自己加的照片和字留着
    const restart = patch => { setSel(""); reshape(Object.assign({ adj: {}, deco: null, bg: "", bgColor: "", bgInk: "", hidden: {} }, patch)); };
    const decoNow = l => l.deco || defaultDeco(l.tpl, l.split);
    const boxOf = key => (boxes.current || []).find(b => b.key === key);
    // 选中的那一样现在的位置、大小、角度——三种东西各存在各的地方，读写都走这一对
    const getT = (l, b) => {
      if (b.kind === "deco") { const d = decoNow(l)[b.idx] || {}; return { x: d.x, y: d.y, s: d.s || 1, r: d.r || 0 }; }
      if (b.kind === "fphoto" || b.kind === "ftext") { const f = (l.free || [])[b.idx] || {}; return { x: f.x, y: f.y, s: f.s || 1, r: f.r || 0 }; }
      const a = (l.adj || {})[b.key] || {}; return { x: a.dx || 0, y: a.dy || 0, s: a.s || 1, r: a.r || 0 };
    };
    const setT = (l, b, v) => {
      if (b.kind === "deco") { const deco = decoNow(l).slice(); deco[b.idx] = Object.assign({}, deco[b.idx], v); return Object.assign({}, l, { deco }); }
      if (b.kind === "fphoto" || b.kind === "ftext") { const free = (l.free || []).slice(); free[b.idx] = Object.assign({}, free[b.idx], v); return Object.assign({}, l, { free }); }
      const adj = Object.assign({}, l.adj), m = {};
      if ("x" in v) m.dx = v.x; if ("y" in v) m.dy = v.y; if ("s" in v) m.s = v.s; if ("r" in v) m.r = v.r;
      adj[b.key] = Object.assign({}, adj[b.key], m); return Object.assign({}, l, { adj });
    };
    const clampS = s => Math.max(0.3, Math.min(3, s));
    // ── 在预览上：一根手指按住拖，两根手指捏合缩放、转 ──
    const toCanvas = e => { const c = cv.current, r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; };
    const pinchOf = () => { const ps = Object.values(touches.current); if (ps.length < 2) return null; const [a, b] = ps; return { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI }; };
    const onDown = e => {
      const p = toCanvas(e);
      touches.current[e.pointerId] = p;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
      const pin = pinchOf();
      if (pin) {   // 第二根手指落下：对着选中的那一样捏
        const b = boxOf(sel); if (!b) return;
        const tr = getT(layout, b); drag.current = { pinch: true, b, d0: pin.d, a0: pin.ang, s0: tr.s, r0: tr.r }; return;
      }
      const b = hitTest(boxes.current, p.x, p.y);
      if (!b) { setSel(""); drag.current = null; return; }
      setSel(b.key);
      const tr = getT(layout, b);
      drag.current = { b, sx: p.x, sy: p.y, bx: tr.x, by: tr.y };
    };
    const onMove = e => {
      if (!(e.pointerId in touches.current)) return;
      const p = toCanvas(e); touches.current[e.pointerId] = p;
      const d = drag.current; if (!d) return;
      if (d.pinch) { const pin = pinchOf(); if (!pin) return; setLayout(l => setT(l, d.b, { s: clampS(d.s0 * pin.d / (d.d0 || 1)), r: Math.round(d.r0 + pin.ang - d.a0) })); return; }
      setLayout(l => setT(l, d.b, { x: d.bx + p.x - d.sx, y: d.by + p.y - d.sy }));
    };
    const onUp = e => { delete touches.current[e.pointerId]; drag.current = null; };
    // 选中的那一样：拖条调大小和角度，复原、删掉、放到最上面
    const selBox = boxOf(sel);
    const selT = selBox ? getT(layout, selBox) : null;
    const setSel2 = v => setLayout(l => selBox ? setT(l, selBox, v) : l);
    const resetSel = () => setLayout(l => {
      if (!selBox) return l;
      if (selBox.kind === "slot" || selBox.kind === "word") { const adj = Object.assign({}, l.adj); delete adj[sel]; return Object.assign({}, l, { adj }); }
      return setT(l, selBox, { s: 1, r: 0 });
    });
    const dropSel = () => {
      if (!selBox) return;
      setLayout(l => {
        if (selBox.kind === "deco") return Object.assign({}, l, { deco: decoNow(l).filter((_, i) => i !== selBox.idx) });
        if (selBox.kind === "fphoto" || selBox.kind === "ftext") return Object.assign({}, l, { free: (l.free || []).filter((_, i) => i !== selBox.idx) });
        if (selBox.kind === "slot") return Object.assign({}, l, { hidden: Object.assign({}, l.hidden, { [sel]: true }) });
        if (selBox.kind === "word") { const w = (l.words || []).slice(); w[selBox.idx] = ""; return Object.assign({}, l, { words: w }); }
        return l;
      });
      setSel("");
    };
    const toTop = () => {
      if (!selBox || !(selBox.kind === "fphoto" || selBox.kind === "ftext" || selBox.kind === "deco")) return;
      setLayout(l => {
        const arr = selBox.kind === "deco" ? decoNow(l).slice() : (l.free || []).slice(), [it] = arr.splice(selBox.idx, 1); arr.push(it);
        setSel((selBox.kind === "deco" ? "d" : "f") + (arr.length - 1));
        return Object.assign({}, l, selBox.kind === "deco" ? { deco: arr } : { free: arr });
      });
    };
    const addSticker = ch => setLayout(l => {
      const deco = decoNow(l).concat([{ ch, x: W / 2 + (Math.random() * 200 - 100), y: H / 2 + (Math.random() * 300 - 150), size: 130, color: /[♥♡]/.test(ch) ? "#d0465c" : /[✿☆]/.test(ch) ? "#c9a227" : "#000" }]);
      setSel("d" + (deco.length - 1)); return Object.assign({}, l, { deco });
    });
    // 自己加：一张照片、一句字，都先放在中间，选中，拖到想放的地方
    const addFree = item => setLayout(l => {
      const free = (l.free || []).concat([Object.assign({ x: W / 2 + (Math.random() * 160 - 80), y: H / 2 + (Math.random() * 240 - 120), s: 1, r: 0 }, item)]);
      setSel("f" + (free.length - 1)); return Object.assign({}, l, { free });
    });
    const addText = () => addFree({ type: "text", text: "写点什么", size: 76, color: layout.bg === "night" ? "#ffffff" : "#2b2b2b" });
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
    if (pickFor) {
      const cur = pickFor.kind === "slot" ? layout.picks[pickFor.idx] : pickFor.kind === "free" ? ((layout.free || [])[pickFor.idx] || {}).p : -1;
      const choose = i => {
        if (pickFor.kind === "slot") setLayout(l => { const picks = l.picks.slice(); picks[pickFor.idx] = i; return Object.assign({}, l, { picks }); });
        else if (pickFor.kind === "free") setLayout(l => { const free = (l.free || []).slice(); free[pickFor.idx] = Object.assign({}, free[pickFor.idx], { p: i }); return Object.assign({}, l, { free }); });
        else addFree({ type: "photo", p: i, w: 480, h: 600, frame: layout.tpl === "blank" ? "scrap" : layout.tpl });
        setPickFor(null);
      };
      return h("div", { "data-wk": "uspage", "data-part": "collagepick", className: "h-full flex flex-col", style: cpSkin(t, "page") },
        h(Head, { zh: pickFor.kind === "new" ? "加哪一张" : "换成哪张", bg: "transparent", onBack: () => setPickFor(null) }),
        h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
          h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 } },
            list.map((p, i) => h("button", { key: i, onClick: () => choose(i),
              className: "active:opacity-80", style: { aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "2px solid " + (cur === i ? t.accent : t.line), padding: 0 } },
              typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: p }) : null)))));
    }
    const selName = selBox ? ({ slot: "第 " + (selBox.idx + 1) + " 格照片", word: "第 " + (selBox.idx + 1) + " 句字", deco: "这颗贴纸", fphoto: "你加的照片", ftext: "你加的字" })[selBox.kind] : "";
    const selFree = selBox && (selBox.kind === "fphoto" || selBox.kind === "ftext") ? (layout.free || [])[selBox.idx] : null;
    const setFree = v => setLayout(l => { const free = (l.free || []).slice(); free[selBox.idx] = Object.assign({}, free[selBox.idx], v); return Object.assign({}, l, { free }); });
    const slider = (label, val, min, max, step, onCh, fmt) => h("div", { className: "flex items-center", style: { gap: 10, marginBottom: 6 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, width: 30, flexShrink: 0 } }, label),
      h("input", { type: "range", min, max, step, value: val, onChange: e => onCh(Number(e.target.value)), style: { flex: 1 }, "data-part": "collage-" + label }),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, width: 44, textAlign: "right" } }, fmt(val)));
    const hiddenN = Object.keys(layout.hidden || {}).length;
    return h("div", { "data-wk": "uspage", "data-part": "collage", className: "h-full flex flex-col", style: cpSkin(t, "page") },
      h(Head, { zh: "拼一张壁纸", sub: name, bg: "transparent", onBack }),
      h("div", { ref: typeof keepScroll === "function" ? keepScroll("collage:" + partner.id) : null, className: "flex-1 min-h-0 overflow-y-auto px-5 pb-12" },
        // 样式：下划线页签（tabs-not-plain-pills）
        h("div", { className: "flex", style: { borderBottom: "1px solid " + t.line, marginTop: 6 } },
          ORDER.map(k => h("button", { key: k, "data-part": "collagetpl", onClick: () => restart({ tpl: k }), className: "flex-1 active:opacity-70",
            style: { padding: "10px 0 9px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: layout.tpl === k ? t.ink : t.fog, borderBottom: "2px solid " + (layout.tpl === k ? t.ink : "transparent"), marginBottom: -1 } }, TPL[k].name))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, textAlign: "center", margin: "8px 0 10px" } }, def.sub + " · 一根手指拖，两根手指捏合缩放、转"),
        // 预览钉在顶上：往下挑背景、字体、贴纸的时候还看得见它（高度按屏幕算，宽度跟着比例走）
        h("div", { "data-part": "collagestage", style: { position: "sticky", top: 0, zIndex: 2, display: "flex", justifyContent: "center", padding: "6px 0 8px", background: t.bg } },
          h("canvas", { ref: cv, "data-part": "collagecanvas", onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp,
            style: { height: "min(44vh, " + (layout.split ? "calc((100vw - 40px) * 1.083)" : "520px") + ")", width: "auto", maxWidth: "100%", borderRadius: 14, boxShadow: "0 6px 22px rgba(0,0,0,.14)", touchAction: "none" } })),
        // 选中了一样：就地几颗键
        selBox ? h("div", { "data-part": "collagesel", style: { marginTop: 10, padding: "10px 10px 8px", borderRadius: 14, border: "1px solid " + t.line, background: t.bg2 } },
          h("div", { className: "flex items-center justify-between", style: { marginBottom: 8 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub } }, "选中了" + selName),
            h("button", { onClick: () => setSel(""), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "取消选中")),
          slider("大小", Math.round(selT.s * 100), 30, 300, 1, v => setSel2({ s: v / 100 }), v => v + "%"),
          slider("角度", Math.round(selT.r), -180, 180, 1, v => setSel2({ r: v }), v => v + "°"),
          selBox.kind === "ftext" ? h(Fragment, null,
            h("input", { "data-part": "collagetextedit", value: selFree.text || "", maxLength: 30, placeholder: "写点什么", onChange: e => setFree({ text: e.target.value }), style: Object.assign({}, inp, { marginTop: 4 }) }),
            h("div", { className: "flex", style: { gap: 6, marginBottom: 8 } },
              TEXT_COLORS.map(c => h("button", { key: c, onClick: () => setFree({ color: c }), "aria-label": c,
                style: { width: 26, height: 26, borderRadius: 13, background: c, border: "2px solid " + ((selFree.color || "#2b2b2b") === c ? t.accent : t.line) } })),
              h("span", { style: { flex: 1 } }),
              FONT_ORDER.map(k => h("button", { key: k, onClick: () => setFree({ font: k }), style: { fontFamily: FONTS[k].css, fontSize: 13, padding: "2px 6px", borderRadius: 8, border: "1px solid " + ((selFree.font || layout.font) === k ? t.ink : t.line), color: t.ink } }, "字")))) : null,
          selBox.kind === "fphoto" ? h("div", { className: "flex", style: { gap: 6, marginBottom: 8 } },
            Object.keys(FRAMES).map(k => h("button", { key: k, onClick: () => setFree({ frame: k }), className: "flex-1",
              style: { padding: "6px 0", borderRadius: 10, border: "1.5px solid " + ((selFree.frame || "scrap") === k ? t.ink : t.line), fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.ink } }, FRAMES[k]))) : null,
          h("div", { className: "flex", style: { gap: 6 } },
            selBox.kind === "slot" ? small("换照片", () => setPickFor({ kind: "slot", idx: selBox.idx })) : null,
            selBox.kind === "fphoto" ? small("换照片", () => setPickFor({ kind: "free", idx: selBox.idx })) : null,
            selBox.kind === "fphoto" || selBox.kind === "ftext" || selBox.kind === "deco" ? small("放到最上面", toTop) : null,
            small("复原", resetSel), small(selBox.kind === "slot" ? "这格不要" : "删掉", dropSel))) : null,
        // 自己放（她 2026-11-10「可以选自己放」）
        h("div", { "data-part": "collagefree", className: "flex", style: { gap: 8, marginTop: 12 } },
          h("button", { onClick: () => setPickFor({ kind: "new" }), disabled: !list.length, className: "flex-1 active:opacity-70 disabled:opacity-40",
            style: { padding: "11px 0", borderRadius: 12, border: "1px dashed " + t.accent, color: t.accent, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "＋ 自己放一张照片"),
          h("button", { onClick: addText, className: "flex-1 active:opacity-70",
            style: { padding: "11px 0", borderRadius: 12, border: "1px dashed " + t.accent, color: t.accent, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "＋ 自己写一句")),
        hiddenN ? h("button", { onClick: () => setLayout(l => Object.assign({}, l, { hidden: {} })), style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "把删掉的 " + hiddenN + " 格放回来") : null,
        h("div", { className: "flex items-center", style: { gap: 10, marginTop: 14, padding: "10px 12px", borderRadius: 14, border: "1px solid " + t.line } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "一人一半"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "左边那张给你，右边那张换成 " + name + " 手机的锁屏，并排才拼成一颗心")),
          typeof Toggle === "function" ? h(Toggle, { on: !!layout.split, onChange: v => restart({ split: !!v }), wk: "collage", part: "split" }) : null),
        onArrange && def.n > 0 ? h("button", { onClick: arrange, disabled: !!busy || !list.length, "data-part": "collagearrange", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 14, padding: "12px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))" } },
          busy === "arrange" ? name + " 在挑…" : "让 " + name + " 来摆") : null,
        why ? h("div", { style: { fontFamily: F_BODY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, marginTop: 10, textAlign: "center" } }, "「" + why + "」") : null,
        h("div", { style: lab }, "背景"),
        row(BG_ORDER.map(k => chip((layout.bg || def.bg) === k, BGS[k].name, () => setLayout(l => Object.assign({}, l, { bg: k, bgColor: "", bgInk: "" })),
          { paddingLeft: 9, display: "flex", alignItems: "center", gap: 6 },
          h("span", { "aria-hidden": "true", style: { width: 14, height: 14, borderRadius: 4, border: "1px solid rgba(0,0,0,.12)", background: BGS[k].from ? "linear-gradient(" + BGS[k].from + "," + BGS[k].to + ")" : BGS[k].base } })))),
        // 我的底：自己传的，存在图库里，下次进来还在
        h("div", { "data-part": "collagemybg", className: "flex", style: { gap: 7, overflowX: "auto", marginTop: 8, paddingBottom: 2 } },
          h("button", { onClick: () => bgUp.current && bgUp.current.click(), className: "active:opacity-70 shrink-0",
            style: { width: 54, height: 72, borderRadius: 10, border: "1.5px dashed " + t.accent, color: t.accent, fontFamily: F_BODY, fontSize: 11, lineHeight: 1.4 } }, "＋", h("br"), "传一张底"),
          myBgs.map(k => h(MyBgThumb, { key: k, k, on: layout.bg === k, t, onPick: () => setLayout(l => Object.assign({}, l, { bg: k })), onDrop: () => dropBg(k) }))),
        h("input", { ref: bgUp, "data-part": "collagebgfile", type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; uploadBg(f); } }),
        // 换颜色：花纹照旧，颜色自己挑
        !isMyBg(layout.bg || def.bg) ? (() => {
          const b = BGS[layout.bg || def.bg] || BGS.cream, base = layout.bgColor || b.base || b.from, ink = layout.bgInk || inkOf(b);
          const SW = ["#c79f78", "#efc9cf", "#b9c7a7", "#f2eee6", "#c8d6e8", "#e8d9f0", "#f6e3a8", "#2c2b3a", "#ffffff", "#6b4228", "#b0596b", "#4f6440", "#3b5b8a", "#7a5c9e", "#d0465c", "#121218"];
          const line = (label, val, onCh) => h("div", { className: "flex items-center", style: { gap: 6, marginTop: 8 } },
            h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, width: 52, flexShrink: 0 } }, label),
            h("div", { className: "flex", style: { gap: 5, overflowX: "auto", flex: 1, paddingBottom: 2 } },
              SW.map(c => h("button", { key: c, onClick: () => onCh(c), "aria-label": c, className: "shrink-0",
                style: { width: 24, height: 24, borderRadius: 12, background: c, border: "2px solid " + (String(val).toLowerCase() === c ? t.accent : t.line) } }))),
            h("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(val) ? val : "#cccccc", onChange: e => onCh(e.target.value), "aria-label": label + "自己调",
              style: { width: 34, height: 28, padding: 0, border: "1px solid " + t.line, borderRadius: 6, background: "transparent", flexShrink: 0 } }));
          return h("div", { "data-part": "collagebgcolor" },
            line(b.from ? "上半截" : "底色", base, c => setLayout(l => Object.assign({}, l, { bgColor: c }))),
            (b.line || b.dot || b.grid || b.from) ? line(b.from ? "下半截" : "花纹色", ink, c => setLayout(l => Object.assign({}, l, { bgInk: c }))) : null,
            (layout.bgColor || layout.bgInk) ? h("button", { onClick: () => setLayout(l => Object.assign({}, l, { bgColor: "", bgInk: "" })), style: { marginTop: 6, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "颜色换回原样") : null);
        })() : null,
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
        def.n > 0 ? h("div", { style: lab }, "每一格放哪张（点一格换）") : null,
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 } },
          (layout.picks || []).map((p, i) => h("button", { key: i, onClick: () => setPickFor({ kind: "slot", idx: i }), className: "active:opacity-80",
            style: { aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid " + t.line, background: t.bg2, padding: 0, position: "relative" } },
            p >= 0 && list[p] && typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: list[p] }) : h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, i + 1)))),
        def.caption ? h(Fragment, null, h("div", { style: lab }, "拍立得下面的字"),
          (layout.picks || []).map((_, i) => h("input", { key: i, value: (layout.captions || [])[i] || "", maxLength: 16, placeholder: "第 " + (i + 1) + " 张（可空）", style: inp,
            onChange: e => { const v = e.target.value; setLayout(l => { const c = (l.captions || []).slice(); c[i] = v; return Object.assign({}, l, { captions: c }); }); } }))) : null,
        wordCount(layout) > 0 ? h("div", { style: lab }, "手写的字") : null,
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
