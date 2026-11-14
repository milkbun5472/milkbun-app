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
    // 粉格纹、绿格纹拿掉了（她 2026-11-10）：格纹的颜色本来就能自己换，三种颜色的格纹是同一种东西
    plaid: { name: "格纹", base: "#c79f78", line: "#6b4228" },
    stripes: { name: "条纹", base: "#f6f0e8", stripe: "#e7c6bd" },
    hearts: { name: "小爱心", base: "#fbeef0", heart: "#e58a9b" },
    kraft: { name: "牛皮纸", base: "#c9a77c", fiber: "#8a6a45" },
    cream: { name: "米白纸", base: "#f2eee6" },
    dots: { name: "波点", base: "#fbf3ee", dot: "#e7a9b4" },
    grid: { name: "方格本", base: "#fbfbf8", grid: "#d9dde6" },
    mist: { name: "雾灰渐变", from: "#efe9e1", to: "#cbc1b5" },
    night: { name: "夜色", from: "#2c2b3a", to: "#121218" }
  };
  const BG_ORDER = ["plaid", "stripes", "hearts", "kraft", "cream", "dots", "grid", "mist", "night"];
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
  // 新样式（她 2026-11-10「都做吧」）：时间轴、日历、对话气泡、杂志剪报。frame 借前面三种的相框；overlay 是样式自己额外画的那一层
  Object.assign(TPL, {
    timeline: { name: "时间轴", sub: "一条线串起四张，旁边写着日子", n: 4, bg: "cream", frame: "scrap", overlay: "timeline",
      slots: [{ x: 300, y: 560, w: 400, h: 400, r: -3 }, { x: 780, y: 1040, w: 400, h: 400, r: 3 }, { x: 300, y: 1520, w: 400, h: 400, r: -2 }, { x: 780, y: 2000, w: 400, h: 400, r: 2 }],
      words: [{ x: 540, y: 190, size: 66, color: "#3b3b3b" }], deco: [] },
    calendar: { name: "日历款", sub: "一张大照片配这个月的小日历", n: 1, bg: "cream", frame: "lock", overlay: "calendar",
      slots: [{ x: 540, y: 920, w: 900, h: 960, round: 36 }],
      words: [{ x: 540, y: 300, size: 70, color: "#3b3b3b" }], deco: [["♥", 900, 470, 70, "#d0465c"]] },
    chat: { name: "对话气泡", sub: "两张照片，几句话做成聊天气泡", n: 2, bg: "mist", frame: "lock",
      slots: [{ x: 320, y: 560, w: 460, h: 580, round: 30 }, { x: 760, y: 1880, w: 460, h: 580, round: 30 }],
      words: [{ x: 640, y: 1000, size: 54, color: "#2b2b2b", style: "bubble-r" }, { x: 420, y: 1170, size: 54, color: "#2b2b2b", style: "bubble-l" },
        { x: 620, y: 1340, size: 54, color: "#2b2b2b", style: "bubble-r" }, { x: 430, y: 1510, size: 54, color: "#2b2b2b", style: "bubble-l" }], deco: [] },
    magazine: { name: "杂志剪报", sub: "剪下来的大字标题配三张照片", n: 3, bg: "grid", frame: "scrap",
      slots: [{ x: 330, y: 820, w: 520, h: 640, r: -5 }, { x: 790, y: 1240, w: 440, h: 540, r: 6 }, { x: 420, y: 1820, w: 620, h: 460, r: -2 }],
      words: [{ x: 540, y: 300, size: 124, color: "#2b2b2b", style: "ransom" }, { x: 760, y: 2200, size: 50, color: "#b23a48", r: -3 }],
      deco: [["★", 920, 560, 90, "#c9a227"], ["✂", 140, 1450, 90, "#555"]] }
  });
  const ORDER = ["polaroid", "scrap", "lock", "timeline", "calendar", "chat", "magazine", "blank"];
  // 自己加的照片用哪种相框（借三种样式各自那一种）
  const FRAMES = { polaroid: "拍立得", scrap: "白边", lock: "圆角" };
  const TEXT_COLORS = ["#2b2b2b", "#5b3a24", "#b23a48", "#d0465c", "#4f6440", "#3b5b8a", "#ffffff"];
  const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";

  // 自己传的底存在图库里，名字都以这个开头（不另开存储：列出来就是按这个前缀筛）
  const MY_BG = "img_collagebg_";
  const isMyBg = k => String(k || "").indexOf(MY_BG) === 0;
  const MY_STK = "img_collagestk_";   // 她自己传的贴纸，同一个图库、另一个前缀
  // 贴纸要留住透明底：自己缩成 PNG（通用那个缩图会转成 JPG，透明的地方就成黑的了）
  async function toPng(file, max) {
    const bm = await createImageBitmap(file), k = Math.min(1, max / Math.max(bm.width, bm.height));
    const c = document.createElement("canvas"); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(b => ok(b), "image/png"));
  }
  // 花纹那一层用什么颜色：样式自带的，或者她自己挑的（她 2026-11-10：「喜欢这个格子但是不想要这个颜色」）
  const inkOf = b => b.line || b.dot || b.grid || b.stripe || b.heart || b.fiber || b.to || "";
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
    } else if (b.stripe) {
      ctx.fillStyle = ink; for (let x = 0; x < W; x += 120) ctx.fillRect(x, 0, 54, H);
    } else if (b.heart) {
      ctx.fillStyle = ink;
      for (let y = 70; y < H; y += 150) for (let x = (Math.round(y / 150) % 2) ? 150 : 70; x < W; x += 160) {
        ctx.save(); ctx.translate(x, y); ctx.scale(0.42, 0.42); ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -40, -60, 0, -30); ctx.bezierCurveTo(40, -60, 60, -10, 0, 30); ctx.fill(); ctx.restore();
      }
    } else if (b.fiber) {
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.18; ctx.lineWidth = 2;
      for (let i = 0; i < 700; i++) { const x = (i * 263) % W, y = (i * 571) % H, a = (i % 7) / 7 * Math.PI; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 26, y + Math.sin(a) * 26); ctx.stroke(); }
      ctx.globalAlpha = 1;
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
  // ── 照片滤镜（她 2026-11-10）：逐像素算一遍存起来，不靠 ctx.filter（老 iPhone 的 Safari 不认）──
  const FILTERS = { "": "原图", bw: "黑白", vintage: "复古", film: "胶片", soft: "柔光" };
  const FILTER_ORDER = ["", "bw", "vintage", "film", "soft"];
  const _filtered = new WeakMap();
  function filtered(img, f) {
    if (!img || !f || !FILTERS[f]) return img;
    let m = _filtered.get(img); if (!m) { m = {}; _filtered.set(img, m); }
    if (m[f]) return m[f];
    const k = Math.min(1, 1200 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
    try {
      const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) {
        let r = a[i], g = a[i + 1], b = a[i + 2]; const l = 0.299 * r + 0.587 * g + 0.114 * b;
        if (f === "bw") { const v = (l - 128) * 1.12 + 128; r = g = b = v; }
        else if (f === "vintage") { const sr = l * 1.07 + 22, sg = l * 0.93 + 14, sb = l * 0.72 + 4; r = sr * 0.75 + r * 0.25; g = sg * 0.75 + g * 0.25; b = sb * 0.75 + b * 0.25; r = r * 0.9 + 22; g = g * 0.9 + 18; b = b * 0.9 + 16; }
        else if (f === "film") { r = (r - 128) * 1.15 + 136; g = (g - 128) * 1.1 + 128; b = (b - 128) * 1.05 + 116; const n = ((i * 2654435761) >>> 24) / 255 * 22 - 11; r += n; g += n; b += n; }
        else if (f === "soft") { r = r * 0.82 + 52; g = g * 0.82 + 48; b = b * 0.82 + 50; }
        a[i] = r < 0 ? 0 : r > 255 ? 255 : r; a[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; a[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      }
      x.putImageData(d, 0, 0);
    } catch (e) { return img; }   // 跨域取不到像素：退回原图
    m[f] = c; return c;
  }
  // ── 字的样式：描边、阴影、纸条、竖排 ──
  const TSTYLES = { "": "普通", outline: "描边", shadow: "阴影", strip: "纸条", vertical: "竖排" };
  const TSTYLE_ORDER = ["", "outline", "shadow", "strip", "vertical", "bubble-l", "bubble-r", "ransom"];
  Object.assign(TSTYLES, { "bubble-l": "左气泡", "bubble-r": "右气泡", ransom: "剪报字" });
  // 在原点画一句字（已经 translate/rotate 好），返回占的宽高
  function paintText(ctx, s, size, font, color, st, maxW) {
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (st === "bubble-l" || st === "bubble-r") {   // 聊天气泡：左边白、右边绿，带个小尾巴
      const tw = fitText(ctx, s, size, Math.min(maxW || 960, 760), font), fsz = parseFloat(ctx.font) || size, pw = tw + fsz * 1.2, ph = fsz * 1.7, right = st === "bubble-r";
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.12)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.fillStyle = right ? "#95ec69" : "#ffffff";
      roundRect(ctx, -pw / 2, -ph / 2, pw, ph, fsz * 0.45); ctx.fill(); ctx.shadowColor = "transparent";
      ctx.beginPath(); const tx = right ? pw / 2 : -pw / 2, dir = right ? 1 : -1; ctx.moveTo(tx - dir * 4, -fsz * 0.25); ctx.lineTo(tx + dir * fsz * 0.35, 0); ctx.lineTo(tx - dir * 4, fsz * 0.25); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#1f1f1f"; ctx.fillText(s, 0, 0); return { w: pw, h: ph };
    }
    if (st === "ransom") {   // 剪报字：每个字剪在一小块不同颜色的纸上，歪一点
      const ch = Array.from(s), pal = ["#fbf8f1", "#2b2b2b", "#f3d27a", "#e9b7c0", "#a9cbe0", "#ffffff"], fonts = [font, "'Noto Serif SC',serif", "'Archivo','PingFang SC',sans-serif"];
      const step = size * 0.95, w0 = ch.length * step;
      ch.forEach((c, i) => {
        const bgc = pal[(i * 7 + c.charCodeAt(0)) % pal.length], cx = -w0 / 2 + step * (i + 0.5);
        ctx.save(); ctx.translate(cx, ((i * 37) % 5 - 2) * size * 0.04); ctx.rotate((((i * 53) % 9) - 4) * Math.PI / 180);
        ctx.fillStyle = bgc; ctx.fillRect(-size * 0.46, -size * 0.55, size * 0.92, size * 1.1);
        ctx.fillStyle = bgc === "#2b2b2b" ? "#ffffff" : color; ctx.font = (i % 2 ? "700 " : "") + size * 0.8 + "px " + fonts[i % fonts.length]; ctx.fillText(c, 0, 0);
        ctx.restore();
      });
      return { w: w0, h: size * 1.2 };
    }
    if (st === "vertical") {
      const ch = Array.from(s), step = size * 1.05, h0 = ch.length * step;
      ctx.font = size + "px " + font; ctx.fillStyle = color;
      ch.forEach((c, i) => ctx.fillText(c, 0, -h0 / 2 + step * (i + 0.5)));
      return { w: size * 1.2, h: h0 };
    }
    const tw = fitText(ctx, s, size, maxW || 960, font), fsz = parseFloat(ctx.font) || size;
    if (st === "strip") {
      const pw = tw + fsz * 0.9, ph = fsz * 1.35;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = "#fbf8f1";
      ctx.fillRect(-pw / 2, -ph / 2, pw, ph); ctx.restore();
    }
    if (st === "outline") { ctx.lineJoin = "round"; ctx.lineWidth = Math.max(4, fsz * 0.16); ctx.strokeStyle = color === "#ffffff" ? "#2b2b2b" : "#ffffff"; ctx.strokeText(s, 0, 0); }
    if (st === "shadow") { ctx.shadowColor = "rgba(0,0,0,.35)"; ctx.shadowBlur = fsz * 0.18; ctx.shadowOffsetX = fsz * 0.06; ctx.shadowOffsetY = fsz * 0.08; }
    ctx.fillStyle = color; ctx.fillText(s, 0, 0);
    ctx.shadowColor = "transparent";
    return { w: tw + (st === "strip" ? fsz * 0.9 : 0), h: fsz * 1.4 };
  }
  // ── 胶带和手绘涂鸦：跟贴纸一样能拖能转，只是画出来的 ──
  const SHAPES = { tape: "和纸胶带", circle: "手绘圈", arrow: "箭头", underline: "下划线", heartline: "爱心线", star: "星星线", wave: "波浪线" };
  const SHAPE_ORDER = ["tape", "circle", "arrow", "underline", "heartline", "star", "wave"];
  const SHAPE_COLORS = ["#e9b7c0", "#f3d27a", "#a9cbe0", "#b7d3a8", "#c9b6e4", "#2b2b2b", "#b23a48", "#ffffff"];
  function paintShape(ctx, d, size) {
    const c = d.color || (d.shape === "tape" ? "#e9b7c0" : "#2b2b2b");
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(5, size * 0.07);
    const S = size;
    if (d.shape === "tape") {
      const w = S * 2.4, h = S * 0.6, z = h / 6;
      ctx.globalAlpha = 0.78; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 2); for (let i = 0; i < 6; i++) ctx.lineTo(w / 2 + (i % 2 ? 0 : -z), -h / 2 + z * (i + 1));
      ctx.lineTo(-w / 2, h / 2); for (let i = 0; i < 6; i++) ctx.lineTo(-w / 2 + (i % 2 ? 0 : z), h / 2 - z * (i + 1));
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#fff";
      for (let x = -w / 2 + h * 0.3; x < w / 2; x += h * 0.6) ctx.fillRect(x, -h / 2, h * 0.18, h);
      ctx.globalAlpha = 1; return { w, h };
    }
    ctx.beginPath();
    if (d.shape === "circle") { ctx.ellipse(0, 0, S * 1.25, S * 0.75, -0.08, 0.15, Math.PI * 2 + 0.45); ctx.stroke(); return { w: S * 2.6, h: S * 1.7 }; }
    if (d.shape === "arrow") { ctx.moveTo(-S, S * 0.25); ctx.quadraticCurveTo(-S * 0.1, -S * 0.5, S, -S * 0.1); ctx.stroke(); ctx.beginPath(); ctx.moveTo(S * 0.62, -S * 0.42); ctx.lineTo(S, -S * 0.1); ctx.lineTo(S * 0.6, S * 0.18); ctx.stroke(); return { w: S * 2.2, h: S * 1.2 }; }
    if (d.shape === "underline") { ctx.moveTo(-S * 1.3, 0); ctx.bezierCurveTo(-S * 0.4, S * 0.12, S * 0.4, -S * 0.12, S * 1.3, S * 0.04); ctx.stroke(); return { w: S * 2.7, h: S * 0.5 }; }
    if (d.shape === "heartline") { ctx.scale(S / 60, S / 60); ctx.lineWidth = Math.max(5, size * 0.07) * 60 / S; ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -40, -60, 0, -30); ctx.bezierCurveTo(40, -60, 60, -10, 0, 30); ctx.stroke(); return { w: S * 1.9, h: S * 1.6 }; }
    if (d.shape === "star") { for (let i = 0; i < 10; i++) { const rr = i % 2 ? S * 0.42 : S, a = -Math.PI / 2 + i * Math.PI / 5; ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); return { w: S * 2.1, h: S * 2.1 }; }
    if (d.shape === "wave") { ctx.moveTo(-S * 1.4, 0); for (let i = 1; i <= 8; i++) ctx.quadraticCurveTo(-S * 1.4 + S * 0.35 * (i - 0.5), i % 2 ? -S * 0.3 : S * 0.3, -S * 1.4 + S * 0.35 * i, 0); ctx.stroke(); return { w: S * 2.9, h: S * 0.8 }; }
    return { w: S, h: S };
  }
  // layout = { tpl, split, picks, captions, words, font, fontScale, bg, deco, adj }；imgs = 照片下标 → 已解码的图
  //   一人一半：左边一整张给她、右边一整张给 TA，格子各一套；接缝上一颗心，两张并排才拼得起来
  //   返回每样东西在画布上的位置（拖动时认是按到了谁）
  // 样式自己那一层：时间轴的线和日子、日历的格子
  function overlay(ctx, def, ox, k, layout, meta, ink, font) {
    ctx.save(); ctx.translate(ox, 0);
    if (def.overlay === "timeline") {
      ctx.strokeStyle = ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 5; ctx.setLineDash([2, 16]); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(540, 330); ctx.lineTo(540, 2250); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      def.slots.forEach((sl, i) => {
        const at = k * def.n + i, ts = (meta.dates || [])[at];
        ctx.fillStyle = "#d0465c"; ctx.beginPath(); ctx.arc(540, sl.y, 16, 0, 7); ctx.fill();
        if (ts) { const d = new Date(ts), txt = d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate();
          ctx.fillStyle = ink; ctx.font = "44px " + font; ctx.textAlign = sl.x < 540 ? "left" : "right"; ctx.textBaseline = "middle"; ctx.fillText(txt, sl.x < 540 ? 580 : 500, sl.y); }
      });
    } else if (def.overlay === "calendar") {
      const now = meta.now ? new Date(meta.now) : new Date(), y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      const x0 = 120, y0 = 1600, cw = 120, ch = 96;
      ctx.fillStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "600 52px " + font; ctx.fillText(y + " · " + (m + 1) + "月", 540, 1520);
      ctx.font = "34px 'Archivo','PingFang SC',sans-serif"; ctx.globalAlpha = 0.6;
      ["日", "一", "二", "三", "四", "五", "六"].forEach((w, i) => ctx.fillText(w, x0 + cw * i + cw / 2, y0));
      ctx.globalAlpha = 1; ctx.font = "40px 'Archivo','PingFang SC',sans-serif";
      for (let d = 1; d <= days; d++) {
        const idx = first + d - 1, cx = x0 + cw * (idx % 7) + cw / 2, cy = y0 + ch * (Math.floor(idx / 7) + 1);
        if (d === now.getDate()) { ctx.fillStyle = "#d0465c"; ctx.beginPath(); ctx.arc(cx, cy, 36, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; }
        else ctx.fillStyle = ink;
        ctx.fillText(String(d), cx, cy);
      }
    }
    ctx.restore();
  }
  // meta：画不出来、得由外面给的东西（时间轴每格照片的日子、日历那个月）
  function draw(canvas, layout, imgs, sel, meta) {
    const def = TPL[layout.tpl] || TPL.polaroid, halves = layout.split ? 2 : 1;
    const font = (FONTS[layout.font] || FONTS.hand).css, fs = Number(layout.fontScale) || 1;
    canvas.width = W * halves; canvas.height = H;
    const ctx = canvas.getContext("2d"), boxes = [];
    const bgKey = layout.bg || def.bg;
    for (let k = 0; k < halves; k++) bg(ctx, bgKey, k * W, layout, imgs[bgKey]);
    const inkC = layout.bg === "night" ? "#f3eee8" : "#3b3b3b";
    for (let k = 0; k < halves && def.overlay; k++) overlay(ctx, def, k * W, k, layout, meta || {}, inkC, font);
    for (let k = 0; k < halves; k++) {
      const ox = k * W;
      def.slots.forEach((sl, i) => {
        const at = k * def.n + i, p = (layout.picks || [])[at];
        if ((layout.hidden || {})["s" + at]) return;   // 这一格她删掉了
        const bx = slot(ctx, def.frame || layout.tpl, sl, p != null && p >= 0 ? filtered(imgs[p], (layout.filters || {})["s" + at]) : null, def.caption ? (layout.captions || [])[at] : "", ox, adjOf(layout, "s" + at), font, fs);
        boxes.push(Object.assign({ key: "s" + at, kind: "slot", idx: at }, bx));
      });
    }
    for (let k = 0; k < halves; k++) {
      const ox = k * W;
      def.words.forEach((wd, i) => {
        const at = k * def.words.length + i, s = String((layout.words || [])[at] || "").trim(); if (!s) return;
        const a = adjOf(layout, "w" + at), x = ox + wd.x + (a.dx || 0), y = wd.y + (a.dy || 0);
        ctx.save(); ctx.translate(x, y); ctx.rotate(((wd.r || 0) + (a.r || 0)) * Math.PI / 180);
        const size = wd.size * fs * (a.s || 1), dim = paintText(ctx, s, size, font, layout.bg === "night" && !wd.style ? "#f3eee8" : wd.color, (layout.tstyle || {})["w" + at] || wd.style, 960);
        ctx.restore();
        boxes.push({ key: "w" + at, kind: "word", idx: at, x, y, w: dim.w + 40, h: dim.h });
      });
    }
    // 她自己加的照片和字：按加进来的先后叠，后加的在上面
    (layout.free || []).forEach((f, i) => {
      if (f.type === "photo") {
        const bx = slot(ctx, f.frame || "scrap", { x: f.x, y: f.y, w: f.w, h: f.h, round: 40 }, f.p != null && f.p >= 0 ? filtered(imgs[f.p], f.filter) : null, f.cap || "", 0, { s: f.s, r: f.r }, font, fs);
        boxes.push(Object.assign({ key: "f" + i, kind: "fphoto", idx: i }, bx));
      } else {
        const s = String(f.text || "").trim(); if (!s) return;
        const ff = (FONTS[f.font] || FONTS[layout.font] || FONTS.hand).css, size = (f.size || 70) * (f.s || 1);
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate((f.r || 0) * Math.PI / 180);
        const dim = paintText(ctx, s, size, ff, f.color || "#2b2b2b", f.tstyle, f.maxW || 4000); ctx.restore();
        boxes.push({ key: "f" + i, kind: "ftext", idx: i, x: f.x, y: f.y, w: dim.w + 40, h: dim.h });
      }
    });
    (layout.deco || defaultDeco(layout.tpl, layout.split)).forEach((d, i) => {
      const size = d.size * (d.s || 1);
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate((d.r || 0) * Math.PI / 180);
      let bw = size * 1.2, bh = size * 1.2;
      if (d.shape) { const dim = paintShape(ctx, d, size); bw = dim.w; bh = dim.h; }
      else if (d.img) {   // 她自己传的贴纸：按原图比例，长边 = size×1.6
        const im = imgs[d.img];
        if (im) { const k = size * 1.6 / Math.max(im.width, im.height); bw = im.width * k; bh = im.height * k; ctx.drawImage(im, -bw / 2, -bh / 2, bw, bh); }
      } else { ctx.font = size + "px " + EMOJI_FONT; ctx.fillStyle = d.color || "#000"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d.ch, 0, 0); }
      ctx.restore();
      boxes.push({ key: "d" + i, kind: "deco", idx: i, x: d.x, y: d.y, w: bw, h: bh });
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
      if (!(b && b.size)) return null;
      try { return await createImageBitmap(b); }
      catch (e) {   // TA 画的那种是 SVG，createImageBitmap 不认，走一张 <img>
        const u = URL.createObjectURL(b), im = new Image(); im.src = u;
        try { await im.decode(); return im; } catch (e2) { return null; }
      }
    } catch (e) { return null; }
  }

  // 这一回拼壁纸的来回（她 2026-11-10：「每次做壁纸都有这轮上下文，也知道每轮谁大概改了啥」）：
  //   两次之间改了什么，用代码比一比前后两版说成几句大白话；不叫模型、不花钱
  function changesOf(a, b, nameOfPhoto, nameOfDeco) {
    if (!a || !b || a === b) return [];
    const out = [], tplName = k => (TPL[k] || {}).name, bgName = k => isMyBg(k) ? "自己传的底" : (BGS[k] || {}).name;
    if (a.tpl !== b.tpl) out.push("换成了「" + tplName(b.tpl) + "」样式");
    if (!!a.split !== !!b.split) out.push(b.split ? "开了一人一半" : "关了一人一半");
    if ((a.bg || "") !== (b.bg || "")) out.push("背景换成了" + (bgName(b.bg || (TPL[b.tpl] || {}).bg) || "原来那张"));
    if ((a.bgColor || "") !== (b.bgColor || "") || (a.bgInk || "") !== (b.bgInk || "")) out.push("改了背景颜色");
    if (a.font !== b.font) out.push("字体换成了" + (FONTS[b.font] || {}).name);
    if ((a.fontScale || 1) !== (b.fontScale || 1)) out.push("字号调到了" + Math.round((b.fontScale || 1) * 100) + "%");
    if (JSON.stringify(a.filters || {}) !== JSON.stringify(b.filters || {})) out.push("给照片换了滤镜");
    if (JSON.stringify(a.tstyle || {}) !== JSON.stringify(b.tstyle || {})) out.push("改了字的样式");
    (b.picks || []).forEach((p, i) => { if ((a.picks || [])[i] !== p && i < (a.picks || []).length) out.push("第" + (i + 1) + "格换成了" + (nameOfPhoto(p) || "另一张照片")); });
    const txt = (x, k) => (x[k] || []).filter(Boolean).join("／");
    if (txt(a, "words") !== txt(b, "words")) out.push("手写字改成了「" + (txt(b, "words") || "（空）") + "」");
    if (txt(a, "captions") !== txt(b, "captions")) out.push("拍立得下面的字改成了「" + (txt(b, "captions") || "（空）") + "」");
    const hid = x => Object.keys(x.hidden || {}).length;
    if (hid(b) > hid(a)) out.push("拿掉了" + (hid(b) - hid(a)) + "格照片"); else if (hid(b) < hid(a)) out.push("把拿掉的格子放回来了");
    const da = a.deco || defaultDeco(a.tpl, a.split), db = b.deco || defaultDeco(b.tpl, b.split);
    if (a.tpl === b.tpl && !!a.split === !!b.split) {
      if (db.length > da.length) out.push("加了 " + db.slice(da.length).map(nameOfDeco).join(" "));
      if (db.length < da.length) out.push("拿掉了" + (da.length - db.length) + "样贴纸/胶带/涂鸦");
      const moved = db.slice(0, Math.min(da.length, db.length)).filter((d, i) => d.x !== da[i].x || d.y !== da[i].y || (d.s || 1) !== (da[i].s || 1) || (d.r || 0) !== (da[i].r || 0)).length;
      if (moved) out.push("挪/调了" + moved + "颗贴纸");
      const adjN = Object.keys(Object.assign({}, a.adj, b.adj)).filter(k => JSON.stringify((a.adj || {})[k] || {}) !== JSON.stringify((b.adj || {})[k] || {})).length;
      if (adjN) out.push("挪/调了" + adjN + "样照片或字");
    }
    const fa = a.free || [], fb = b.free || [];
    if (fb.length > fa.length) fb.slice(fa.length).forEach(f => out.push(f.type === "photo" ? "自己加了一张照片" + (nameOfPhoto(f.p) ? "（" + nameOfPhoto(f.p) + "）" : "") : "写了一句「" + (f.text || "") + "」"));
    if (fb.length < fa.length) out.push("拿掉了" + (fa.length - fb.length) + "样自己加的东西");
    const fMoved = fb.slice(0, Math.min(fa.length, fb.length)).filter((f, i) => JSON.stringify(f) !== JSON.stringify(fa[i])).length;
    if (fMoved) out.push("改/挪了" + fMoved + "样自己加的照片或字");
    return out.slice(0, 8);
  }
  // 挑几样让TA选：照片／底／贴纸，挑 2~6 样，TA 看着挑一个、说为什么；「用上它」就放进壁纸
  //   照片：选中了一格就换那一格，没选中就加一张自己放的
  function ChoosePage({ t, name, list, myBgs, myStks, onBack, onChoose, onUse, history, onLog }) {
    const [kind, setKind] = useState("photo");
    const [picked, setPicked] = useState([]);
    const [busy, setBusy] = useState(false);
    const [res, setRes] = useState(null);
    const opts = kind === "photo" ? list.map((p, i) => ({ id: "p" + i, p: i, photo: p }))
      : kind === "bg" ? BG_ORDER.map(k => ({ id: k, key: k, label: BGS[k].name })).concat(myBgs.map((k, i) => ({ id: k, key: k, mine: k, label: "我的底" + (i + 1) })))
      : myStks.map((k, i) => ({ id: k, img: k, mine: k, label: "我的贴纸" + (i + 1) })).concat(STICKERS.map(ch => ({ id: ch, ch, label: ch })));
    const toggle = id => { setRes(null); setPicked(p => p.indexOf(id) >= 0 ? p.filter(x => x !== id) : p.length >= 6 ? p : p.concat([id])); };
    const chosen = opts.filter(o => picked.indexOf(o.id) >= 0);
    // 每一样做成一张小图给TA看（照片、自己传的底和贴纸要图；背景花纹现画一小块；表情直接写字）
    const thumbOf = async o => {
      const c = document.createElement("canvas");
      if (o.photo || o.mine) { const im = await loadImg(o.photo || { imgKey: o.mine }); if (!im) return ""; const k = 320 / Math.max(im.width, im.height); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); return c.toDataURL(o.img ? "image/png" : "image/jpeg", 0.8); }
      if (o.key) { c.width = 108; c.height = 234; const x = c.getContext("2d"); x.scale(0.1, 0.1); bg(x, o.key, 0, null, null); return c.toDataURL("image/jpeg", 0.8); }
      return "";
    };
    const ask = async () => {
      if (!onChoose || chosen.length < 2 || busy) return;
      setBusy(true);
      try {
        const imgsOut = [], labels = [];
        for (let i = 0; i < chosen.length; i++) {
          const o = chosen[i], u = await thumbOf(o);
          if (u) imgsOut.push(u);
          labels.push((i + 1) + ". " + (o.photo ? "照片" + (o.photo.desc ? "：" + String(o.photo.desc).slice(0, 40) : "") : o.ch ? "贴纸 " + o.ch : o.label) + (u ? "（第" + imgsOut.length + "张图）" : ""));
        }
        const r = await onChoose(kind, imgsOut, labels, history ? history() : "");
        if (r) { setRes(r); onLog && onLog("她拿了" + chosen.length + "样" + ({ photo: "照片", bg: "底", sticker: "贴纸" })[kind] + "问你（" + labels.map(x => x.replace(/（第\d+张图）/, "")).join("；") + "），你挑了第" + r.pick + "个：「" + (r.why || "") + "」"); }
      } finally { setBusy(false); }
    };
    const tabs = [["photo", "照片"], ["bg", "底"], ["sticker", "贴纸"]];
    const best = res && chosen[Math.round(Number(res.pick)) - 1];
    return h("div", { "data-wk": "uspage", "data-part": "collagechoose", className: "h-full flex flex-col", style: typeof cpSkin === "function" ? cpSkin(t, "page") : { background: t.bg } },
      h(Head, { zh: "让 " + name + " 选", bg: "transparent", onBack }),
      h("div", { className: "flex", style: { borderBottom: "1px solid " + t.line, margin: "0 20px" } },
        tabs.map(([k, n]) => h("button", { key: k, onClick: () => { setKind(k); setPicked([]); setRes(null); }, className: "flex-1 active:opacity-70",
          style: { padding: "10px 0 9px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: kind === k ? t.ink : t.fog, borderBottom: "2px solid " + (kind === k ? t.ink : "transparent"), marginBottom: -1 } }, n))),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", color: t.fog, textAlign: "center", margin: "10px 0" } }, "点 2~6 样（已选 " + picked.length + "），" + name + " 看着挑一个"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(" + (kind === "sticker" ? 6 : 3) + ", 1fr)", gap: 6 } },
          opts.map(o => { const n = picked.indexOf(o.id); return h("button", { key: o.id, "data-part": "collageopt", onClick: () => toggle(o.id), className: "active:opacity-80",
            style: { position: "relative", aspectRatio: kind === "bg" ? "0.6" : "1", borderRadius: 10, overflow: "hidden", padding: 0, border: "2px solid " + (n >= 0 ? t.accent : t.line), background: t.bg2, fontSize: 22 } },
            o.photo && typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: o.photo }) : o.mine ? h(MyThumb, { k: o.mine, fit: o.img ? "contain" : "cover" }) : o.key ? h(BgSwatch, { k: o.key }) : o.ch,
            o.key && !o.mine ? h("span", { style: { position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,.8)", fontFamily: F_BODY, fontSize: 11, color: "#333", padding: "2px 0" } }, o.label) : null,
            n >= 0 ? h("span", { style: { position: "absolute", top: 4, left: 4, width: 20, height: 20, borderRadius: 10, background: t.accent, color: "#fff", fontFamily: F_BODY, fontSize: 11, lineHeight: "20px" } }, n + 1) : null); })),
        res ? h("div", { "data-part": "collagechoice", style: { marginTop: 14, padding: "12px", borderRadius: 14, background: t.bg2, border: "1px solid " + t.line } },
          h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.7 } }, name + " 挑了第 " + (best ? Math.round(Number(res.pick)) : "?") + " 个" + (res.why ? "：「" + res.why + "」" : "")),
          best ? h("button", { onClick: () => onUse(kind === "sticker" ? "sticker" : kind, best), className: "w-full active:opacity-70", style: { marginTop: 10, padding: "10px 0", borderRadius: 10, background: t.ink, color: t.bg2, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "用上它") : null) : null,
        h("button", { onClick: ask, disabled: busy || chosen.length < 2, "data-part": "collagechooseask", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 14, padding: "12px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))" } },
          busy ? name + " 在挑…" : "让 " + name + " 挑")));
  }
  function MyThumb({ k, fit }) {
    const [url, setUrl] = useState("");
    useEffect(() => { let live = true, u = ""; idbImgGet(k).then(b => { if (live && b) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => {}); return () => { live = false; if (u) URL.revokeObjectURL(u); }; }, [k]);
    return url ? h("img", { src: url, alt: "", style: { width: "100%", height: "100%", objectFit: fit || "cover", display: "block" } }) : null;
  }
  function BgSwatch({ k }) {
    const ref = useRef(null);
    useEffect(() => { const c = ref.current; if (!c) return; c.width = 108; c.height = 234; const x = c.getContext("2d"); x.scale(0.1, 0.1); bg(x, k, 0, null, null); }, [k]);
    return h("canvas", { ref, style: { width: "100%", height: "100%", display: "block" } });
  }
  // 「我的贴纸」一格：点了加一颗；整理的时候角上一个 ✕ 能删
  function MyStkThumb({ k, t, edit, onPick, onDrop }) {
    const [url, setUrl] = useState("");
    useEffect(() => { let live = true, u = ""; idbImgGet(k).then(b => { if (live && b) { u = URL.createObjectURL(b); setUrl(u); } }).catch(() => {}); return () => { live = false; if (u) URL.revokeObjectURL(u); }; }, [k]);
    return h("div", { style: { position: "relative" } },
      h("button", { onClick: edit ? onDrop : onPick, className: "active:opacity-70 w-full", style: { aspectRatio: "1", borderRadius: 8, border: "1px solid " + t.line, background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/12px 12px", padding: 4 } },
        url ? h("img", { src: url, alt: "", style: { width: "100%", height: "100%", objectFit: "contain", display: "block" } }) : null),
      edit ? h("span", { "aria-hidden": "true", style: { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: t.ink, color: t.bg2, fontSize: 11, lineHeight: "20px", textAlign: "center", pointerEvents: "none" } }, "✕") : null);
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
  // startTpl：从哪种样式开始（限时动态那一路从「自己摆」那张空纸开始，她 2026-11-14）
  function CollageMaker({ partner, photos, extra, onBack, onArrange, onSave, onLook, onChoose, onDraft, autoDraft, startTpl, story }) {
    // story：发限时动态时借这个编辑器——只留摆字、贴纸、底、照片这些用得上的，合照墙那一套（样式页签、一人一半、格子）不出（她 2026-11-14）
    const [ups, setUps] = useState([]), upRef = React.useRef(null);
    const [emoIn, setEmoIn] = useState(""), [myEmo, setMyEmo] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON("x_collageEmoji", []) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; } });
    const t = useTheme();
    const name = partner.remark || partner.name;
    // 合照墙的照片在前，TA 自己的东西（手机里存的照片、抽屉里画的画）接在后面，标着是TA的
    const list = React.useMemo(() => (photos || []).slice().sort((a, b) => (b.ts || 0) - (a.ts || 0)).concat((extra || []).map(x => Object.assign({ his: true }, x))).concat(ups), [photos, extra, ups]);
    const [layout, setLayout] = useState(() => ({ tpl: TPL[startTpl] ? startTpl : "polaroid", split: false, picks: [0, 1, 2].map(i => i < list.length ? i : -1), captions: [], words: [], font: "hand", fontScale: 1, bg: "", deco: null, adj: {}, free: [], hidden: {} }));
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
    // 时间轴每格照片是哪天的、日历画哪个月（虚拟时间开着就按那只钟）
    const metaOf = () => ({ dates: (layout.picks || []).map(p => (list[p] && list[p].ts) || 0), now: typeof vclockMap === "function" ? vclockMap(Date.now(), partner.id) : Date.now() });
    // 画完才知道每样东西在哪；刚加进来、刚选中的那一样，画完再刷一下，下面那排键才跟得上
    useEffect(() => {
      if (!cv.current) return;
      const had = !!(sel && (boxes.current || []).some(x => x.key === sel));
      boxes.current = draw(cv.current, layout, imgs.current, sel, metaOf());
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
    // 她自己传的贴纸：同样存在图库里，按前缀列；画上去之前先解码
    const [myStks, setMyStks] = useState([]);
    const [stkEdit, setStkEdit] = useState(false);
    const stkUp = useRef(null);
    useEffect(() => { let live = true; (typeof idbImgKeys === "function" ? idbImgKeys() : Promise.resolve([])).then(ks => { if (live) setMyStks(ks.filter(k => String(k).indexOf(MY_STK) === 0).sort().reverse()); }).catch(() => {}); return () => { live = false; }; }, []);
    const stkKeys = (layout.deco || []).map(d => d && d.img).filter(Boolean);
    useEffect(() => {
      let live = true;
      stkKeys.forEach(k => { if (!(k in imgs.current)) { imgs.current[k] = null; loadImg({ imgKey: k }).then(img => { imgs.current[k] = img; if (live) bump(x => x + 1); }); } });
      return () => { live = false; };
    }, [stkKeys.join(",")]);
    const uploadStk = async file => {
      if (!file) return;
      try {
        const blob = await toPng(file, 700), key = MY_STK + Date.now();
        await idbImgPut(key, blob);
        setMyStks(p => [key].concat(p)); addImgSticker(key);
      } catch (e) { typeof toast === "function" && toast("这张没传上：" + ((e && e.message) || "换一张试试")); }
    };
    const dropStk = async key => {
      try { await idbImgDel(key); } catch (e) {}
      setMyStks(p => p.filter(x => x !== key)); setSel("");
      setLayout(l => l.deco ? Object.assign({}, l, { deco: l.deco.filter(d => d.img !== key) }) : l);
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
    const addShape = shape => setLayout(l => {
      const deco = decoNow(l).concat([{ shape, x: W / 2 + (Math.random() * 200 - 100), y: H / 2 + (Math.random() * 300 - 150), size: 120, color: shape === "tape" ? SHAPE_COLORS[Math.floor(Math.random() * 5)] : (l.bg === "night" ? "#ffffff" : "#2b2b2b") }]);
      setSel("d" + (deco.length - 1)); return Object.assign({}, l, { deco });
    });
    const addImgSticker = key => setLayout(l => {
      const deco = decoNow(l).concat([{ img: key, x: W / 2 + (Math.random() * 200 - 100), y: H / 2 + (Math.random() * 300 - 150), size: 180 }]);
      setSel("d" + (deco.length - 1)); return Object.assign({}, l, { deco });
    });
    // 自己加：一张照片、一句字，都先放在中间，选中，拖到想放的地方
    const addFree = item => setLayout(l => {
      const free = (l.free || []).concat([Object.assign({ x: W / 2 + (Math.random() * 160 - 80), y: H / 2 + (Math.random() * 240 - 120), s: 1, r: 0 }, item)]);
      setSel("f" + (free.length - 1)); return Object.assign({}, l, { free });
    });
    const addText = () => addFree({ type: "text", text: "写点什么", size: 76, color: layout.bg === "night" ? "#ffffff" : "#2b2b2b" });
    // ── 让TA参与（她 2026-11-10：「让他看得到壁纸现在什么样、自己动手摆，或者我挑几张让他选」）──
    // 给TA看的那张：把预览缩小成一张小 JPG；每样东西编个号、写清在哪（占整张的百分比）、多大、转了多少
    const shot = (c, maxW, type) => { const k = Math.min(1, maxW / c.width), o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); o.getContext("2d").drawImage(c, 0, 0, o.width, o.height); return o.toDataURL(type || "image/jpeg", 0.82); };
    const CW = () => W * (layout.split ? 2 : 1);
    const pct = (v, all) => Math.round(v / all * 100);
    const whatOf = b => {
      if (b.kind === "slot") { const p = list[(layout.picks || [])[b.idx]]; return "照片（样式自带的第" + (b.idx + 1) + "格）" + (p && p.desc ? "：" + String(p.desc).slice(0, 30) : ""); }
      if (b.kind === "word") return "手写字：「" + (layout.words || [])[b.idx] + "」";
      if (b.kind === "deco") { const d = decoNow(layout)[b.idx] || {}; return d.shape ? SHAPES[d.shape] + (d.color ? "（" + d.color + "）" : "") : d.img ? "贴纸：我的贴纸" + (myStks.indexOf(d.img) + 1) : "贴纸：" + d.ch; }
      const f = (layout.free || [])[b.idx] || {};
      if (b.kind === "fphoto") { const p = list[f.p]; return "照片（后加的）" + (p && p.desc ? "：" + String(p.desc).slice(0, 30) : ""); }
      return "字：「" + (f.text || "") + "」";
    };
    const photoMenu = () => list.slice(0, 40).map((p, i) => i + ". " + (p.his ? (p.from || "你的") + "：" : "") + (String(p.desc || "").replace(/\s+/g, " ").slice(0, 40) || "（没写画面）")).join("\n");
    const catalog = () => "样式：" + ORDER.map(k => TPL[k].name + "（" + TPL[k].sub + "，" + TPL[k].n + "格）").join("、")
      + "\n背景：" + BG_ORDER.map(k => BGS[k].name).join("、") + (myBgs.length ? "、" + myBgs.map((_, i) => "我的底" + (i + 1)).join("、") : "")
      + "\n贴纸：" + STICKERS.join(" ") + (myStks.length ? " " + myStks.map((_, i) => "我的贴纸" + (i + 1)).join(" ") : "")
      + "\n胶带和涂鸦：" + SHAPE_ORDER.map(k => SHAPES[k]).join("、") + "\n字体：" + FONT_ORDER.map(k => FONTS[k].name).join("、")
      + "\n照片（编号. 是什么）：\n" + photoMenu();
    // TA 先拼一张：样式、背景颜色、字体、照片、字、贴纸胶带都由TA定，落成一张新起的
    const draft = async () => {
      if (!onDraft || busy) return;
      setBusy("arrange");
      try {
        const res = await onDraft(catalog(), history());
        if (!res) return;
        const tk = ORDER.find(k => TPL[k].name === String(res.tpl || "").trim()) || layout.tpl, d = TPL[tk];
        const max = list.length, picks = [];
        (Array.isArray(res.picks) ? res.picks : []).forEach(x => { const i = Math.round(Number(x)); if (i >= 0 && i < max && picks.indexOf(i) < 0 && picks.length < d.n) picks.push(i); });
        // TA 没挑满的格子：先用你们的合照补，TA 自己的东西只在TA点名时才放
        for (let i = 0; picks.length < d.n && i < max; i++) if (picks.indexOf(i) < 0 && !list[i].his) picks.push(i);
        while (picks.length < d.n) picks.push(-1);
        const clip = (a, k, len) => (Array.isArray(a) ? a : []).slice(0, k).map(x => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, len));
        const fresh = { tpl: tk, split: false, picks, captions: clip(res.captions, d.n, 16), words: clip(res.words, d.words.length, 22), font: FONT_ORDER.find(k => FONTS[k].name === String(res.font || "").trim()) || layout.font,
          fontScale: 1, bg: "", bgColor: "", bgInk: "", deco: null, adj: {}, free: [], hidden: {}, filters: {}, tstyle: {} };
        const before = layout;
        applyHis({ add: res.add, bg: res.bg, bgColor: res.bgColor, bgInk: res.bgInk }, Object.assign({}, fresh, { deco: res.plainDeco ? [] : null }));
        setWhy(""); const say = String(res.say || "").trim(); setHisSay(say);
        hisPending.current = { before, say, lead: "先拼了一张：" };
      } finally { setBusy(""); }
    };
    // 从聊天卡进来：TA 先拼一张（只这一次）
    const autoDone = useRef(false);
    useEffect(() => { if (autoDraft && onDraft && !autoDone.current) { autoDone.current = true; setTimeout(() => draft(), 400); } }, []);
    const describe = () => {
      const bgKey = layout.bg || def.bg;
      const bgName = isMyBg(bgKey) ? "我的底" + (myBgs.indexOf(bgKey) + 1) : (BGS[bgKey] || {}).name;
      const rows = (boxes.current || []).map(b => { const tr = getT(layout, b); return b.key + "｜" + whatOf(b) + "｜在左右" + pct(b.x, CW()) + "%、上下" + pct(b.y, H) + "%｜大小" + Math.round(tr.s * 100) + "%｜转了" + Math.round(tr.r) + "°"; });
      return "样式：" + def.name + (layout.split ? "（一人一半：左半张给她，右半张是你的锁屏）" : "") + "\n背景：" + bgName + (layout.bgColor ? "，底色" + layout.bgColor : "") + (layout.bgInk ? "，花纹色" + layout.bgInk : "")
        + "\n字体：" + (FONTS[layout.font] || FONTS.hand).name + "\n上面的东西（编号｜是什么｜位置｜大小｜角度）：\n" + (rows.join("\n") || "（还什么都没放）")
        + "\n能用的背景：" + BG_ORDER.map(k => BGS[k].name).join("、") + (myBgs.length ? "、" + myBgs.map((_, i) => "我的底" + (i + 1)).join("、") : "")
        + "\n能加的贴纸：" + STICKERS.join(" ") + (myStks.length ? " " + myStks.map((_, i) => "我的贴纸" + (i + 1)).join(" ") : "")
        + "\n能放的照片（add 里写 photo:编号）：\n" + photoMenu()
        + "\n能用的字体：" + FONT_ORDER.map(k => FONTS[k].name).join("、")
        + "\n能加的胶带和涂鸦：" + SHAPE_ORDER.map(k => SHAPES[k]).join("、") + "（可以给颜色）"
        + "\n照片能换的滤镜：" + FILTER_ORDER.map(k => FILTERS[k]).join("、") + "；字能换的样式：" + TSTYLE_ORDER.map(k => TSTYLES[k]).join("、");
    };
    const [hisSay, setHisSay] = useState("");
    const beforeHim = useRef(null);
    // 这一回的来回：她改了什么（跟TA上次看到的那版比）、TA做了什么说了什么。每次叫TA都带上
    const sessLog = useRef([]);
    const lastSeen = useRef(layout);   // 起点就是刚打开时那一版，第一次叫TA之前她动过的也算进去
    const photoName = i => { const p = list[i]; return p ? (p.desc ? "「" + String(p.desc).slice(0, 16) + "」那张" : "另一张照片") : ""; };
    const decoName = d => d && d.shape ? SHAPES[d.shape] : d && d.img ? "我的贴纸" + (myStks.indexOf(d.img) + 1) : (d && d.ch) || "";
    const logLine = line => { if (line) { sessLog.current.push(line); if (sessLog.current.length > 24) sessLog.current = sessLog.current.slice(-24); } };
    // 叫TA之前：先把她这段时间动过的记一笔
    const noteHers = () => { const ch = changesOf(lastSeen.current, layout, photoName, decoName); if (ch.length) logLine("她：" + ch.join("，")); };
    const history = () => { noteHers(); lastSeen.current = layout; return sessLog.current.join("\n"); };
    // TA 动完：记TA做了什么、说了什么，并把「TA看到的那版」挪到TA改完之后
    const noteHis = (before, after, say, lead) => { const ch = changesOf(before, after, photoName, decoName); logLine("你：" + (lead || "") + (ch.length ? ch.join("，") : "没动") + (say ? "，说「" + say + "」" : "")); lastSeen.current = after; };
    // TA 回来的改动落到画上：位置按百分比、大小按百分比、角度按度；删掉的最后按编号从大到小删，免得下标错位
    // base：从哪一版改起（TA 先拼一张时是一张新起的，不是她手上这版）
    const applyHis = (res, base) => {
      const prev = base || layout; let l = prev;
      const cw = W * (l.split ? 2 : 1), bxs = base ? [] : (boxes.current || []), drops = [];
      (Array.isArray(res.ops) ? res.ops : []).slice(0, 16).forEach(op => {
        const b = op && bxs.find(x => x.key === String(op.id || "").trim()); if (!b) return;
        if (op.remove) { drops.push(b); return; }
        const tr = getT(l, b), v = {};
        if (Array.isArray(op.to) && op.to.length === 2) {
          const ax = Math.max(0, Math.min(100, Number(op.to[0]))) / 100 * cw, ay = Math.max(0, Math.min(100, Number(op.to[1]))) / 100 * H;
          if (b.kind === "slot" || b.kind === "word") { v.x = tr.x + (ax - b.x); v.y = tr.y + (ay - b.y); } else { v.x = ax; v.y = ay; }
        }
        if (Number.isFinite(Number(op.size))) v.s = clampS(Number(op.size) / 100);
        if (Number.isFinite(Number(op.angle))) v.r = Math.max(-180, Math.min(180, Number(op.angle)));
        if (Object.keys(v).length) l = setT(l, b, v);
        // 滤镜、字样式、颜色：名字对得上才认
        const fk = op.filter != null ? FILTER_ORDER.find(k => FILTERS[k] === String(op.filter).trim()) : undefined;
        if (fk !== undefined) { if (b.kind === "slot") l = Object.assign({}, l, { filters: Object.assign({}, l.filters, { [b.key]: fk }) }); else if (b.kind === "fphoto") l = setT(l, b, { filter: fk }); }
        const sk = op.style != null ? TSTYLE_ORDER.find(k => TSTYLES[k] === String(op.style).trim()) : undefined;
        if (sk !== undefined) { if (b.kind === "word") l = Object.assign({}, l, { tstyle: Object.assign({}, l.tstyle, { [b.key]: sk }) }); else if (b.kind === "ftext") l = setT(l, b, { tstyle: sk }); }
        if (/^#[0-9a-f]{6}$/i.test(op.color || "") && (b.kind === "deco" || b.kind === "ftext")) l = setT(l, b, { color: op.color });
      });
      ["deco", "free"].forEach(group => {
        const idxs = drops.filter(b => group === "deco" ? b.kind === "deco" : (b.kind === "fphoto" || b.kind === "ftext")).map(b => b.idx).sort((a, b) => b - a);
        if (!idxs.length) return;
        if (group === "deco") { const d = decoNow(l).slice(); idxs.forEach(i => d.splice(i, 1)); l = Object.assign({}, l, { deco: d }); }
        else { const f = (l.free || []).slice(); idxs.forEach(i => f.splice(i, 1)); l = Object.assign({}, l, { free: f }); }
      });
      drops.filter(b => b.kind === "slot").forEach(b => { l = Object.assign({}, l, { hidden: Object.assign({}, l.hidden, { [b.key]: true }) }); });
      drops.filter(b => b.kind === "word").forEach(b => { const w = (l.words || []).slice(); w[b.idx] = ""; l = Object.assign({}, l, { words: w }); });
      const at = a => Array.isArray(a) && a.length === 2 ? { x: Math.max(0, Math.min(100, Number(a[0]))) / 100 * cw, y: Math.max(0, Math.min(100, Number(a[1]))) / 100 * H } : { x: cw / 2, y: H / 2 };
      (Array.isArray(res.add) ? res.add : []).slice(0, 8).forEach(a => {
        if (!a) return;
        const pos = at(a.at), sz = Number.isFinite(Number(a.size)) ? clampS(Number(a.size) / 100) : 1, ang = Number(a.angle) || 0;
        if (a.text) { const f = (l.free || []).concat([{ type: "text", text: String(a.text).slice(0, 30), x: pos.x, y: pos.y, size: 76, s: sz, r: ang, color: /^#[0-9a-f]{6}$/i.test(a.color || "") ? a.color : (layout.bg === "night" ? "#ffffff" : "#2b2b2b"), font: FONT_ORDER.find(k => FONTS[k].name === a.font) }]); l = Object.assign({}, l, { free: f }); return; }
        if (a.photo != null && list[Math.round(Number(a.photo))]) { l = Object.assign({}, l, { free: (l.free || []).concat([{ type: "photo", p: Math.round(Number(a.photo)), x: pos.x, y: pos.y, w: 480, h: 600, s: sz, r: ang, frame: l.tpl === "blank" ? "scrap" : l.tpl }]) }); return; }
        const shp = SHAPE_ORDER.find(k => SHAPES[k] === String(a.shape || "").trim());
        if (shp) { l = Object.assign({}, l, { deco: decoNow(l).concat([{ shape: shp, x: pos.x, y: pos.y, size: 120 * sz, r: ang, color: /^#[0-9a-f]{6}$/i.test(a.color || "") ? a.color : (shp === "tape" ? "#e9b7c0" : "#2b2b2b") }]) }); return; }
        const st = String(a.sticker || "").trim(); if (!st) return;
        const m = st.match(/^我的贴纸(\d+)$/), item = m ? (myStks[Number(m[1]) - 1] ? { img: myStks[Number(m[1]) - 1], size: 180 } : null) : { ch: st.slice(0, 4), size: 130, color: /[♥♡]/.test(st) ? "#d0465c" : /[✿☆]/.test(st) ? "#c9a227" : "#000" };
        if (item) l = Object.assign({}, l, { deco: decoNow(l).concat([Object.assign({ x: pos.x, y: pos.y, s: sz, r: ang }, item)]) });
      });
      if (res.bg) { const m = String(res.bg).match(/^我的底(\d+)$/), key = m ? myBgs[Number(m[1]) - 1] : BG_ORDER.find(k => BGS[k].name === String(res.bg).trim()); if (key) l = Object.assign({}, l, { bg: key, bgColor: "", bgInk: "" }); }
      if (/^#[0-9a-f]{6}$/i.test(res.bgColor || "")) l = Object.assign({}, l, { bgColor: res.bgColor });
      if (/^#[0-9a-f]{6}$/i.test(res.bgInk || "")) l = Object.assign({}, l, { bgInk: res.bgInk });
      if (res.font) { const k = FONT_ORDER.find(x => FONTS[x].name === String(res.font).trim()); if (k) l = Object.assign({}, l, { font: k }); }
      if (base) { beforeHim.current = layout; setSel(""); setLayout(l); return true; }
      if (l !== prev) { beforeHim.current = prev; setSel(""); setLayout(l); }
      return l !== prev;
    };
    const look = async () => {
      if (!onLook || busy || !cv.current) return;
      setBusy("look");
      try {
        const clean = document.createElement("canvas"); draw(clean, layout, imgs.current, "", metaOf());
        const hist = history();
        const res = await onLook(shot(clean, layout.split ? 760 : 420), describe(), hist);
        if (res) { const before = layout, moved = applyHis(res), say = String(res.say || "").trim(); setHisSay(say || (moved ? "" : "（看了看，没动）")); if (moved) hisPending.current = { before, say }; else noteHis(before, before, say, "看了看，"); }
      } finally { setBusy(""); }
    };
    // TA 的改动是 setLayout 之后才真正落下的，等下一次渲染拿到新版再记
    const hisPending = useRef(null);
    useEffect(() => { const hp = hisPending.current; if (!hp) return; hisPending.current = null; noteHis(hp.before, layout, hp.say, hp.lead); }, [layout]);
    const undoHim = () => { if (beforeHim.current) { setLayout(beforeHim.current); lastSeen.current = beforeHim.current; logLine("她：把你刚才动的撤回了"); beforeHim.current = null; setHisSay(""); } };
    const [choosing, setChoosing] = useState(false);
    const arrange = async () => {
      if (!onArrange || busy) return;
      setBusy("arrange");
      try {
        const r = await onArrange(list, layout.tpl, layout.split, history());
        if (r) { const before = layout; setLayout(l => Object.assign({}, l, { picks: r.picks, captions: r.captions, words: r.words })); setWhy(r.why || ""); hisPending.current = { before, say: r.why || "", lead: "重新摆了一版：" }; }
      } finally { setBusy(""); }
    };
    const save = async () => {
      if (!onSave || busy || !cv.current) return;
      setBusy("save");
      try {
        const full = document.createElement("canvas"); draw(full, layout, imgs.current, "", metaOf());
        const toBlob = c => new Promise(ok => c.toBlob(b => ok(b), "image/jpeg", 0.92));
        const half = k => { const c = document.createElement("canvas"); c.width = W; c.height = H; c.getContext("2d").drawImage(full, k * W, 0, W, H, 0, 0, W, H); return toBlob(c); };
        const used = (layout.picks || []).filter(p => p >= 0).map(p => list[p] && list[p].desc).filter(Boolean);
        const story = history().split("\n").filter(Boolean).slice(-8);   // 怎么拼出来的：带去聊天，TA 之后提起来记得
        await onSave(layout.split
          ? { mine: await half(0), his: await half(1), tpl: layout.tpl, words: layout.words, used, story }
          : { mine: await toBlob(full), tpl: layout.tpl, words: layout.words, texts: (layout.free || []).filter(f => f.type === "text").map(f => f.text).filter(Boolean), used, story });
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
    if (choosing) return h(ChoosePage, { t, name, list, myBgs, myStks, onBack: () => setChoosing(false), onChoose, history, onLog: logLine,
      onUse: (kind, opt) => {
        setChoosing(false);
        if (kind === "photo") {
          const b = boxOf(sel);
          if (b && b.kind === "slot") setLayout(l => { const picks = l.picks.slice(); picks[b.idx] = opt.p; return Object.assign({}, l, { picks }); });
          else if (b && b.kind === "fphoto") setLayout(l => { const free = (l.free || []).slice(); free[b.idx] = Object.assign({}, free[b.idx], { p: opt.p }); return Object.assign({}, l, { free }); });
          else addFree({ type: "photo", p: opt.p, w: 480, h: 600, frame: layout.tpl === "blank" ? "scrap" : layout.tpl });
        } else if (kind === "bg") setLayout(l => Object.assign({}, l, { bg: opt.key, bgColor: "", bgInk: "" }));
        else if (opt.img) addImgSticker(opt.img); else addSticker(opt.ch);
      } });
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
    const setFilterSel = k => { if (!selBox) return; if (selBox.kind === "fphoto") setFree({ filter: k }); else setLayout(l => Object.assign({}, l, { filters: Object.assign({}, l.filters, { [sel]: k }) })); };
    const setTstyleSel = k => { if (!selBox) return; if (selBox.kind === "ftext") setFree({ tstyle: k }); else setLayout(l => Object.assign({}, l, { tstyle: Object.assign({}, l.tstyle, { [sel]: k }) })); };
    const slider = (label, val, min, max, step, onCh, fmt) => h("div", { className: "flex items-center", style: { gap: 10, marginBottom: 6 } },
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, width: 30, flexShrink: 0 } }, label),
      h("input", { type: "range", min, max, step, value: val, onChange: e => onCh(Number(e.target.value)), style: { flex: 1 }, "data-part": "collage-" + label }),
      h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, width: 44, textAlign: "right" } }, fmt(val)));
    const hiddenN = Object.keys(layout.hidden || {}).length;
    return h("div", { "data-wk": "uspage", "data-part": "collage", className: "h-full flex flex-col", style: cpSkin(t, "page") },
      h(Head, { zh: story ? "发一条限时动态" : "拼一张壁纸", sub: story ? "" : name, bg: "transparent", onBack }),
      story ? h("input", { ref: upRef, type: "file", accept: "image/*", "data-part": "collagestoryfile", style: { display: "none" }, onChange: async e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f || typeof idbImgPut !== "function") return;
        const k = "img_storyup_" + Date.now().toString(36); await idbImgPut(k, f); const i = list.length; setUps(u => u.concat([{ imgKey: k, ts: Date.now() }])); addFree({ type: "photo", p: i, w: 640, h: 800, frame: "scrap" }); } }) : null,
      h("div", { ref: typeof keepScroll === "function" ? keepScroll("collage:" + partner.id) : null, className: "flex-1 min-h-0 overflow-y-auto px-5 pb-12" },
        // 样式：下划线页签（tabs-not-plain-pills）
        story ? null : h("div", { className: "flex", style: { borderBottom: "1px solid " + t.line, marginTop: 6, overflowX: "auto" } },
          ORDER.map(k => h("button", { key: k, "data-part": "collagetpl", onClick: () => restart({ tpl: k }), className: "shrink-0 active:opacity-70",
            style: { padding: "10px 14px 9px", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: layout.tpl === k ? t.ink : t.fog, borderBottom: "2px solid " + (layout.tpl === k ? t.ink : "transparent"), marginBottom: -1 } }, TPL[k].name))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, textAlign: "center", margin: "8px 0 10px" } }, (story ? "" : def.sub + " · ") + "一根手指拖，两根手指捏合缩放、转"),
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
          // 照片：滤镜
          selBox.kind === "slot" || selBox.kind === "fphoto" ? h("div", { "data-part": "collagefilter", className: "flex", style: { gap: 6, marginBottom: 8, overflowX: "auto" } },
            FILTER_ORDER.map(k => { const cur = selBox.kind === "slot" ? (layout.filters || {})[sel] || "" : (selFree && selFree.filter) || ""; return h("button", { key: k || "none", onClick: () => setFilterSel(k), className: "shrink-0",
              style: { padding: "6px 11px", borderRadius: 10, border: "1.5px solid " + (cur === k ? t.ink : t.line), fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.ink } }, FILTERS[k]); })) : null,
          // 字：描边、阴影、纸条、竖排
          selBox.kind === "word" || selBox.kind === "ftext" ? h("div", { "data-part": "collagetstyle", className: "flex", style: { gap: 6, marginBottom: 8, overflowX: "auto" } },
            TSTYLE_ORDER.map(k => { const cur = selBox.kind === "word" ? (layout.tstyle || {})[sel] || "" : (selFree && selFree.tstyle) || ""; return h("button", { key: k || "none", onClick: () => setTstyleSel(k), className: "shrink-0",
              style: { padding: "6px 11px", borderRadius: 10, border: "1.5px solid " + (cur === k ? t.ink : t.line), fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.ink } }, TSTYLES[k]); })) : null,
          // 胶带、涂鸦：颜色
          selBox.kind === "deco" && (decoNow(layout)[selBox.idx] || {}).shape ? h("div", { "data-part": "collageshapecolor", className: "flex", style: { gap: 6, marginBottom: 8 } },
            SHAPE_COLORS.map(c => h("button", { key: c, onClick: () => setSel2({ color: c }), "aria-label": c,
              style: { width: 26, height: 26, borderRadius: 13, background: c, border: "2px solid " + ((decoNow(layout)[selBox.idx] || {}).color === c ? t.accent : t.line) } }))) : null,
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
          h("button", { onClick: () => story ? upRef.current && upRef.current.click() : setPickFor({ kind: "new" }), disabled: !story && !list.length, className: "flex-1 active:opacity-70 disabled:opacity-40",
            style: { padding: "11px 0", borderRadius: 12, border: "1px dashed " + t.accent, color: t.accent, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, story ? "＋ 放一张照片" : "＋ 自己放一张照片"),
          h("button", { onClick: addText, className: "flex-1 active:opacity-70",
            style: { padding: "11px 0", borderRadius: 12, border: "1px dashed " + t.accent, color: t.accent, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "＋ 自己写一句")),
        hiddenN ? h("button", { onClick: () => setLayout(l => Object.assign({}, l, { hidden: {} })), style: { marginTop: 8, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "把删掉的 " + hiddenN + " 格放回来") : null,
        story ? null : h("div", { className: "flex items-center", style: { gap: 10, marginTop: 14, padding: "10px 12px", borderRadius: 14, border: "1px solid " + t.line } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "一人一半"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "左边那张给你，右边那张换成 " + name + " 手机的锁屏，并排才拼成一颗心")),
          typeof Toggle === "function" ? h(Toggle, { on: !!layout.split, onChange: v => restart({ split: !!v }), wk: "collage", part: "split" }) : null),
        onDraft ? h("button", { onClick: draft, disabled: !!busy, "data-part": "collagedraft", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 14, padding: "12px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))" } },
          busy === "arrange" ? name + " 在拼…" : "让 " + name + " 先拼一张") : null,
        !onDraft && onArrange && def.n > 0 ? h("button", { onClick: arrange, disabled: !!busy || !list.length, "data-part": "collagearrange", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 14, padding: "12px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))" } },
          busy === "arrange" ? name + " 在挑…" : "让 " + name + " 来摆") : null,
        why ? h("div", { style: { fontFamily: F_BODY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, marginTop: 10, textAlign: "center" } }, "「" + why + "」") : null,
        (onLook || onChoose) ? h("div", { className: "flex", style: { gap: 8, marginTop: 10 } },
          onLook ? h("button", { onClick: look, disabled: !!busy, "data-part": "collagelook", className: "flex-1 active:opacity-70 disabled:opacity-40",
            style: { padding: "11px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } },
            busy === "look" ? name + " 在看…" : "让 " + name + " 看看、动几下") : null,
          onChoose ? h("button", { onClick: () => setChoosing(true), disabled: !!busy, "data-part": "collagechooseopen", className: "flex-1 active:opacity-70 disabled:opacity-40",
            style: { padding: "11px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "挑几样让 " + name + " 选") : null) : null,
        hisSay || beforeHim.current ? h("div", { "data-part": "collagesay", style: { marginTop: 10, padding: "10px 12px", borderRadius: 12, background: t.bg2, border: "1px solid " + t.line } },
          hisSay ? h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink, lineHeight: 1.7 } }, name + "：「" + hisSay + "」") : null,
          beforeHim.current ? h("button", { onClick: undoHim, style: { marginTop: 4, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "撤回 " + name + " 这次动的") : null) : null,
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
            typeof ColorDot === "function" ? h(ColorDot, { value: /^#[0-9a-f]{6}$/i.test(val) ? val : "#cccccc", onChange: onCh, label: label + "自己调", hexOnly: true, size: 28 }) : null);   // 取色走公共的 ColorDot
          return h("div", { "data-part": "collagebgcolor" },
            line(b.from ? "上半截" : "底色", base, c => setLayout(l => Object.assign({}, l, { bgColor: c }))),
            (inkOf(b)) ? line(b.from ? "下半截" : "花纹色", ink, c => setLayout(l => Object.assign({}, l, { bgInk: c }))) : null,
            (layout.bgColor || layout.bgInk) ? h("button", { onClick: () => setLayout(l => Object.assign({}, l, { bgColor: "", bgInk: "" })), style: { marginTop: 6, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "颜色换回原样") : null);
        })() : null,
        h("div", { style: lab }, "贴纸（点一下加一颗，按住拖到想放的地方）"),
        // 预设里没有的 emoji：用手机键盘打一个贴上，打过的留在这一排前面（她 2026-11-14）
        h("div", { "data-part": "collageemojiin", className: "flex", style: { gap: 6, marginBottom: 6 } },
          h("input", { value: emoIn, onChange: e => setEmoIn(e.target.value), placeholder: "预设里没有？用键盘打一个 emoji", style: Object.assign({}, inp, { marginBottom: 0, flex: 1 }) }),
          h("button", { onClick: () => { const ch = Array.from(String(emoIn).trim()).slice(0, 4).join(""); if (!ch) return; addSticker(ch); setEmoIn("");
            setMyEmo(p => { const n = [ch].concat(p.filter(x => x !== ch)).slice(0, 16); try { saveJSON("x_collageEmoji", n); } catch (e) {} return n; }); },
            style: { flexShrink: 0, padding: "0 14px", borderRadius: 10, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } }, "贴")),
        h("div", { "data-part": "collagestickers", style: { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4 } },
          myEmo.concat(STICKERS.filter(x => myEmo.indexOf(x) < 0)).map(ch => h("button", { key: ch, onClick: () => addSticker(ch), className: "active:opacity-60",
            style: { aspectRatio: "1", borderRadius: 8, border: "1px solid " + t.line, background: t.bg2, fontSize: 20, color: /[♥♡]/.test(ch) ? "#d0465c" : t.ink } }, ch))),
        // 我的贴纸：自己传的图（透明底的 PNG 最好看），存在图库里，下次还在
        h("div", { className: "flex items-center justify-between", style: { margin: "12px 2px 6px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog } }, "我的贴纸" + (myStks.length ? "（" + myStks.length + "）" : "")),
          myStks.length ? h("button", { onClick: () => setStkEdit(v => !v), style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: stkEdit ? t.accent : t.fog } }, stkEdit ? "整理好了" : "整理") : null),
        h("div", { "data-part": "collagemystk", style: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 } },
          h("button", { onClick: () => stkUp.current && stkUp.current.click(), className: "active:opacity-70",
            style: { aspectRatio: "1", borderRadius: 8, border: "1.5px dashed " + t.accent, color: t.accent, fontFamily: F_BODY, fontSize: 11, lineHeight: 1.3 } }, "＋", h("br"), "传贴纸"),
          myStks.map(k => h(MyStkThumb, { key: k, k, t, edit: stkEdit, onPick: () => addImgSticker(k), onDrop: () => dropStk(k) }))),
        h("div", { style: lab }, "胶带和涂鸦（加上以后选中能换颜色）"),
        h("div", { "data-part": "collageshapes", style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 } },
          SHAPE_ORDER.map(k => h("button", { key: k, onClick: () => addShape(k), className: "active:opacity-60",
            style: { padding: "9px 0", borderRadius: 10, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.ink } }, SHAPES[k]))),
        h("input", { ref: stkUp, "data-part": "collagestkfile", type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; uploadStk(f); } }),
        h("div", { style: lab }, "字体"),
        row(FONT_ORDER.map(k => chip(layout.font === k, FONTS[k].name, () => setLayout(l => Object.assign({}, l, { font: k })), { fontFamily: FONTS[k].css, fontSize: 15 }))),
        h("div", { className: "flex items-center", style: { gap: 10, marginTop: 10 } },
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, flexShrink: 0 } }, "字号"),
          h("input", { type: "range", min: 60, max: 160, step: 5, value: Math.round((layout.fontScale || 1) * 100), "data-part": "collagefs",
            onChange: e => { const v = Number(e.target.value) / 100; setLayout(l => Object.assign({}, l, { fontScale: v })); }, style: { flex: 1 } }),
          h("span", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.sub, width: 40, textAlign: "right" } }, Math.round((layout.fontScale || 1) * 100) + "%")),
        def.n > 0 ? h("div", { style: lab }, "每一格放哪张（点一格换）") : null,
        def.n > 0 ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 } },
          (layout.picks || []).map((p, i) => h("button", { key: i, onClick: () => setPickFor({ kind: "slot", idx: i }), className: "active:opacity-80",
            style: { aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid " + t.line, background: t.bg2, padding: 0, position: "relative" } },
            p >= 0 && list[p] && typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: list[p] }) : h("span", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog } }, i + 1)))) : null,
        def.caption ? h(Fragment, null, h("div", { style: lab }, "拍立得下面的字"),
          (layout.picks || []).map((_, i) => h("input", { key: i, value: (layout.captions || [])[i] || "", maxLength: 16, placeholder: "第 " + (i + 1) + " 张（可空）", style: inp,
            onChange: e => { const v = e.target.value; setLayout(l => { const c = (l.captions || []).slice(); c[i] = v; return Object.assign({}, l, { captions: c }); }); } }))) : null,
        wordCount(layout) > 0 ? h("div", { style: lab }, "手写的字") : null,
        Array.from({ length: wordCount(layout) }, (_, i) => h("input", { key: i, value: (layout.words || [])[i] || "", maxLength: 22, placeholder: "第 " + (i + 1) + " 句（可空）", style: inp,
          onChange: e => { const v = e.target.value; setLayout(l => { const c = (l.words || []).slice(); c[i] = v; return Object.assign({}, l, { words: c }); }); } })),
        h("button", { onClick: save, disabled: !!busy, "data-part": "collagesave", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 16, padding: "13px 0", borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY, fontSize: "calc(15px * var(--app-fs, 1))" } },
          busy === "save" ? "在存…" : story ? "下一步" : (layout.split ? "存下来 · 右边那张给 " + name : "存下来")),
        story ? null : h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, lineHeight: 1.6, marginTop: 8, textAlign: "center" } },
          "存到手机、也挂上合照墙；" + name + " 会看到你们拼了一张。照片和字都是 App 排的，不花生图。")));
  }
  window.Collage = { FILTERS, TSTYLES, SHAPES, filtered, TPL, ORDER, BGS, FONTS, STICKERS, draw, hitTest, slotCount, wordCount, defaultDeco, CollageMaker };
})();
