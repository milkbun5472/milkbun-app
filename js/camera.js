// 相机（她 2026-11-26：「想要一个相机，可以带上角色或者大头拍，显示现实景色一起拍」）
//   实景用后置/前置镜头，角色当贴纸叠上去（圆头像、小卡、原图三种样式），拖、两指缩放旋转；
//   滤镜整张一起上（人和景一个色调才不像 P 上去的）；按快门把【看到的这一框】原样画进画布存下来。
//   ⚠️镜头走 CallCamera.create（视频通话那一份），不另写一套 getUserMedia：权限、旧壳拦截、释放设备都在那儿。
//   ⚠️预览和导出用同一份 FILTERS 字串：预览挂 CSS filter，导出挂 ctx.filter；不认 ctx.filter 的浏览器逐像素按同一串算。
(function () {
  const h = React.createElement, useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  const FS = n => "calc(" + n + "px * var(--app-fs, 1))";
  const FILTERS = [
    { id: "none", zh: "原图", css: "" },
    { id: "film", zh: "胶片", css: "contrast(1.08) saturate(0.85) sepia(0.18)" },
    { id: "polaroid", zh: "拍立得", css: "brightness(1.08) contrast(0.92) saturate(1.1) sepia(0.12)" },
    { id: "warm", zh: "暖阳", css: "sepia(0.25) saturate(1.25) brightness(1.04)" },
    { id: "cool", zh: "冷调", css: "hue-rotate(-12deg) saturate(0.9) brightness(1.04)" },
    { id: "fade", zh: "褪色", css: "contrast(0.82) brightness(1.1) saturate(0.7)" },
    { id: "night", zh: "夜景", css: "brightness(0.92) contrast(1.22) saturate(1.15)" },
    { id: "mono", zh: "黑白", css: "grayscale(1) contrast(1.12)" }
  ];
  // 五根调节条：数值 -100~100，0＝不动
  const ADJ = [["light", "亮度"], ["contrast", "对比"], ["sat", "饱和"], ["warm", "色温"], ["fade", "褪色"]];
  const ADJ0 = { light: 0, contrast: 0, sat: 0, warm: 0, fade: 0 };
  function adjCss(a) {
    if (!a) return ""; const o = [], f = n => +(n).toFixed(3);
    if (a.light) o.push("brightness(" + f(1 + a.light / 250) + ")");
    if (a.contrast) o.push("contrast(" + f(1 + a.contrast / 200) + ")");
    if (a.sat) o.push("saturate(" + f(1 + a.sat / 100) + ")");
    if (a.warm > 0) o.push("sepia(" + f(a.warm / 300) + ")");
    if (a.warm < 0) o.push("hue-rotate(" + f(a.warm / 6) + "deg)");
    if (a.fade) o.push("contrast(" + f(1 - a.fade / 400) + ") brightness(" + f(1 + a.fade / 900) + ")");
    return o.join(" ");
  }
  // 一起逛那句话：圆角白泡泡＋朝下的小尖，跟着贴纸头顶；拍照时同一个形状画进去
  function wrapText(ctx, text, maxW) {
    const out = []; let line = "";
    for (const ch of String(text || "")) { if (ch === "\n") { out.push(line); line = ""; continue; } if (ctx.measureText(line + ch).width > maxW && line && !/[，。！？、；：,.!?;:」』）)…~～]/.test(ch)) { out.push(line); line = ch; } else line += ch; }
    if (line) out.push(line); return out;
  }
  function drawBubble(ctx, text, cx, bottomY, W) {
    const fs = Math.round(W * 0.036), pad = fs * 0.7, maxW = W * 0.56;
    ctx.save(); ctx.font = "500 " + fs + "px 'PingFang SC','Noto Sans SC',sans-serif";
    const lines = wrapText(ctx, text, maxW - pad * 2), lh = fs * 1.4;
    const bw = Math.min(maxW, Math.max.apply(null, lines.map(l => ctx.measureText(l).width)) + pad * 2), bh = lines.length * lh + pad * 1.4;
    const x = Math.max(W * 0.03, Math.min(W * 0.97 - bw, cx - bw / 2)), y = Math.max(W * 0.03, bottomY - bh - fs * 0.6), r = fs * 0.8;
    ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = fs * 0.6; ctx.shadowOffsetY = fs * 0.15; ctx.fillStyle = "rgba(255,255,255,.96)";
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + bw, y, x + bw, y + bh, r); ctx.arcTo(x + bw, y + bh, x, y + bh, r); ctx.arcTo(x, y + bh, x, y, r); ctx.arcTo(x, y, x + bw, y, r); ctx.closePath(); ctx.fill();
    const tx = Math.max(x + r, Math.min(x + bw - r, cx));
    ctx.beginPath(); ctx.moveTo(tx - fs * 0.4, y + bh - 1); ctx.lineTo(tx, y + bh + fs * 0.55); ctx.lineTo(tx + fs * 0.4, y + bh - 1); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.fillStyle = "#2b2230"; ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad * 0.7 + i * lh + fs * 0.12));
    ctx.restore();
  }
  // 拍立得白边：TA 写的那一行手写在底边上，存到手机／发给TA的就是这一张
  const HAND = "'Long Cang','Ma Shan Zheng','Kaiti SC','STKaiti',KaiTi,cursive";
  async function polaroid(blob, caption, loadImg) {
    const u = URL.createObjectURL(blob); try {
      const im = await loadImg(u); if (!im) return blob; const w = im.naturalWidth, hh = im.naturalHeight, m = Math.round(w * 0.045), bot = Math.round(w * 0.2);
      const cv = document.createElement("canvas"); cv.width = w + m * 2; cv.height = hh + m + bot;
      const ctx = cv.getContext("2d"); ctx.fillStyle = "#fbfaf7"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(im, m, m);
      try { if (document.fonts && document.fonts.load) await document.fonts.load(Math.round(w * 0.06) + "px 'Long Cang'"); } catch (e) {}
      let fs = Math.round(w * 0.06); ctx.font = fs + "px " + HAND;
      let lines = wrapText(ctx, caption, w);
      while (lines.length > 2 && fs > w * 0.035) { fs = Math.round(fs * 0.88); ctx.font = fs + "px " + HAND; lines = wrapText(ctx, caption, w); }
      lines = lines.slice(0, 2); ctx.fillStyle = "#3a3340"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const lh = fs * 1.15, top = hh + m + bot / 2 - (lines.length - 1) * lh / 2;
      lines.forEach((l, i) => ctx.fillText(l, cv.width / 2, top + i * lh));
      return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/jpeg", 0.92));
    } finally { URL.revokeObjectURL(u); }
  }
  // 穿什么（她 2026-11-26「跟情侣空间一样选衣柜或者生成一套新的」）：衣柜里挑几件拼一整套（跟照相馆那排一个用法），或者「配一套新的」——配好挂进TA衣柜、顺手挑上
  function OutfitPick({ name, sets, picked, onToggle, onClear, onGen, busy, dark }) {
    const ink = dark ? "#fff" : "#2b2230", sub = dark ? "rgba(255,255,255,.55)" : "#9a8592", PINK = "#ff5f9e";
    const on = n => picked.indexOf(n) >= 0;
    return h("div", { "data-wk": "camoutfit", style: { marginTop: 10 } },
      h("div", { style: { display: "flex", alignItems: "baseline", gap: 6, fontSize: FS(12), color: ink } },
        h("span", { style: { fontWeight: 600 } }, name + " 穿"),
        h("span", { style: { fontSize: FS(10.5), color: picked.length ? PINK : sub } }, picked.length ? "挑了 " + picked.length + " 件" : sets.length ? "可多选，拼成一整套；不挑就照场景配" : "衣柜还空着，不挑就照场景配"),
        h("span", { style: { flex: 1 } }),
        picked.length ? h("button", { onClick: onClear, style: { border: "none", background: "transparent", color: sub, fontSize: FS(10.5), padding: 0 } }, "不指定") : null),
      h("div", { style: { display: "flex", gap: 6, overflowX: "auto", padding: "6px 0 2px", alignItems: "stretch" } },
        onGen ? h("button", { "data-wk": "cambtn", "data-part": "genfit", onClick: onGen, disabled: !!busy, style: { flexShrink: 0, padding: "6px 11px", borderRadius: 12, border: "1.5px dashed " + PINK, background: "transparent", color: PINK, fontSize: FS(11.5), whiteSpace: "nowrap", opacity: busy ? .6 : 1 } }, busy ? "在配…" : "＋ 配一套新的") : null,
        sets.slice(0, 40).map((x, i) => h("button", { key: i, "data-wk": "camoutfitone", "data-on": on(x.name) ? "1" : "0", onClick: () => onToggle(x.name),
          style: { flexShrink: 0, maxWidth: 170, textAlign: "left", padding: "6px 10px", borderRadius: 12, border: "1.5px solid " + (on(x.name) ? PINK : dark ? "rgba(255,255,255,.18)" : "#f1e4ea"), background: on(x.name) ? (dark ? "rgba(255,95,158,.25)" : "#fff1f6") : dark ? "rgba(255,255,255,.06)" : "#fff", color: ink } },
          h("div", { style: { fontSize: FS(11.5), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: on(x.name) ? 600 : 400 } }, (x.occasion ? x.occasion + " · " : "") + x.name),
          x.note ? h("div", { style: { fontSize: FS(10), color: sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 } }, x.note) : null))));
  }
  const FRAMES = [["", "不指定"], ["full", "全身"], ["half", "半身"], ["bust", "到胸"]];
  const STYLES = [["round", "圆头像"], ["card", "小卡"], ["plain", "原图"]];

  // 不认 ctx.filter 时的兜底：把同一串 CSS 滤镜逐像素算一遍（只用到上面那几种函数）
  function pixelFilter(ctx, w, hh, css) {
    const ops = []; String(css || "").replace(/([a-z-]+)\(([-\d.]+)(deg)?\)/g, (m, f, v) => { ops.push([f, parseFloat(v)]); return m; });
    if (!ops.length) return;
    const img = ctx.getImageData(0, 0, w, hh), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      for (const [f, v] of ops) {
        if (f === "brightness") { r *= v; g *= v; b *= v; }
        else if (f === "contrast") { r = (r - 128) * v + 128; g = (g - 128) * v + 128; b = (b - 128) * v + 128; }
        else if (f === "saturate" || f === "grayscale") {
          const s = f === "saturate" ? v : 1 - v, l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
        } else if (f === "sepia") {
          const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
          r += (sr - r) * v; g += (sg - g) * v; b += (sb - b) * v;
        } else if (f === "hue-rotate") {
          const a = v * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
          const nr = r * (0.213 + c * 0.787 - s * 0.213) + g * (0.715 - c * 0.715 - s * 0.715) + b * (0.072 - c * 0.072 + s * 0.928);
          const ng = r * (0.213 - c * 0.213 + s * 0.143) + g * (0.715 + c * 0.285 + s * 0.140) + b * (0.072 - c * 0.072 - s * 0.283);
          const nb = r * (0.213 - c * 0.213 - s * 0.787) + g * (0.715 - c * 0.715 + s * 0.715) + b * (0.072 + c * 0.928 + s * 0.072);
          r = nr; g = ng; b = nb;
        }
      }
      d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(img, 0, 0);
  }
  function canCtxFilter(ctx) { try { ctx.filter = "grayscale(1)"; const ok = ctx.filter === "grayscale(1)"; ctx.filter = "none"; return ok; } catch (e) { return false; } }
  const loadImg = src => new Promise(res => {
    if (!src) return res(null);
    const im = new Image(); if (/^https?:/i.test(src)) im.crossOrigin = "anonymous";
    im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
  });
  const srcOf = c => { const v = c && c.avatarImage; return v ? (typeof resolveImg === "function" ? resolveImg(v) : v) : ""; };

  // ── 抠出来的人（她 2026-11-26「生好的图怎么扣出人像一起拍」）──────────────
  //   两条来路，抠完都是一张透明底 PNG，存进本机图库（img_cut_），记在 x_camCutouts[人]：
  //   ① 现生：生图画一张全身、纯绿底的，这里把绿色去掉（keyGreen）；
  //   ② 从照片抠：本机跑人像分割（MediaPipe，模型和运行库放在 vendor/，第一次用才下载）
  const blobImg = async b => { const u = URL.createObjectURL(b); try { return await loadImg(u); } finally { setTimeout(() => URL.revokeObjectURL(u), 2000); } };
  const toPng = cv => new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/png"));
  // 透明边裁掉，四周留一点
  function trimCanvas(cv) {
    const W = cv.width, H = cv.height, d = cv.getContext("2d").getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) throw new Error("没抠出人来");
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    const out = document.createElement("canvas"); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
    out.getContext("2d").drawImage(cv, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }
  // 绿幕去底：背景色取四条边的中位数（模型画的绿不一定正好 #00FF00），从四边往里漫，像这个颜色的都去掉；
  //   夹在胳膊和身子中间那种围起来的绿也去（更严一点的门槛）；挨着背景的那一圈按颜色远近给半透明，再把反上去的绿压掉
  async function keyGreen(blob) {
    const im = await blobImg(blob); if (!im) throw new Error("这张图没读出来");
    const k = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight)), W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"); ctx.drawImage(im, 0, 0, W, H);
    const img = ctx.getImageData(0, 0, W, H), d = img.data, N = W * H;
    const rs = [], gs = [], bs = [], put = i => { rs.push(d[i * 4]); gs.push(d[i * 4 + 1]); bs.push(d[i * 4 + 2]); };
    for (let x = 0; x < W; x += 3) { put(x); put((H - 1) * W + x); }
    for (let y = 0; y < H; y += 3) { put(y * W); put(y * W + W - 1); }
    const med = a => a.sort((p, q) => p - q)[a.length >> 1], kr = med(rs), kg = med(gs), kb = med(bs);
    if (!(kg > kr + 40 && kg > kb + 40)) throw new Error("这张的底不是绿的，抠不干净；再生一张试试");
    const dist = i => { const r = d[i * 4] - kr, g = d[i * 4 + 1] - kg, b = d[i * 4 + 2] - kb; return Math.sqrt(r * r + g * g + b * b); };
    const T = 120, TIGHT = 70, SOFT = 190, bg = new Uint8Array(N), q = new Int32Array(N); let qh = 0, qt = 0;
    const seed = i => { if (!bg[i] && dist(i) < T) { bg[i] = 1; q[qt++] = i; } };
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
    while (qh < qt) { const i = q[qh++], x = i % W, y = (i / W) | 0;
      if (x > 0) seed(i - 1); if (x < W - 1) seed(i + 1); if (y > 0) seed(i - W); if (y < H - 1) seed(i + W); }
    for (let i = 0; i < N; i++) if (!bg[i] && dist(i) < TIGHT) bg[i] = 1;
    let bgN = 0; for (let i = 0; i < N; i++) bgN += bg[i];
    if (bgN < N * 0.15) throw new Error("背景太少，像是没画成绿底；再生一张试试");
    // 挨着背景两圈以内的算边
    const edge = new Uint8Array(N);
    for (let pass = 0; pass < 2; pass++) { const src = pass ? edge.slice() : bg;
      for (let i = 0; i < N; i++) { if (bg[i] || edge[i]) continue; const x = i % W;
        if ((x > 0 && src[i - 1]) || (x < W - 1 && src[i + 1]) || (i >= W && src[i - W]) || (i < N - W && src[i + W])) edge[i] = 1; } }
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (bg[i]) { d[o + 3] = 0; continue; }
      if (!edge[i]) continue;
      const a = Math.max(0, Math.min(1, (dist(i) - T * 0.6) / (SOFT - T * 0.6)));
      d[o + 3] = Math.round(d[o + 3] * a);
      const r = d[o], g = d[o + 1], b = d[o + 2], m = Math.max(r, b);
      if (g > m) d[o + 1] = m + (g - m) * 0.25;   // 去绿边
    }
    ctx.putImageData(img, 0, 0);
    return toPng(trimCanvas(cv));
  }
  // 本机人像分割：先用 App 自带的那份（vendor/，国内也打得开），载不下来再退到公共 CDN
  const MP_VER = "1.2.3";
  let segP = null;
  function getSegmenter() {
    if (segP) return segP;
    const here = p => new URL(p, location.href).href;
    const tries = [
      { lib: here("vendor/mediapipe-tasks-vision-" + MP_VER + "/vision_bundle.mjs"), wasm: here("vendor/mediapipe-tasks-vision-" + MP_VER + "/wasm"), model: here("vendor/mediapipe-models/selfie_multiclass_256x256.tflite") },
      { lib: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VER + "/vision_bundle.mjs", wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + MP_VER + "/wasm",
        model: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite" }];
    segP = (async () => {
      let last = null;
      for (const t of tries) {
        try {
          const mod = await import(t.lib);
          const files = await mod.FilesetResolver.forVisionTasks(t.wasm);
          return await mod.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: t.model, delegate: "CPU" }, runningMode: "IMAGE", outputCategoryMask: false, outputConfidenceMasks: true });
        } catch (e) { last = e; }
      }
      segP = null; throw new Error("抠图工具没载下来（要联网）" + (last && last.message ? "：" + String(last.message).slice(0, 60) : ""));
    })();
    return segP;
  }
  // 照片里的人抠出来：第 0 张置信图是「背景」，透明度＝1－背景的把握；边上糊一像素，不发硬
  async function segmentPerson(blob) {
    const im = await blobImg(blob); if (!im) throw new Error("这张图没读出来");
    const k = Math.min(1, 1400 / Math.max(im.naturalWidth, im.naturalHeight)), W = Math.round(im.naturalWidth * k), H = Math.round(im.naturalHeight * k);
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d"); ctx.drawImage(im, 0, 0, W, H);
    const seg = await getSegmenter(), res = seg.segment(cv);
    try {
      const m = res.confidenceMasks && res.confidenceMasks[0]; if (!m) throw new Error("没认出人来");
      const mw = m.width, mh = m.height, bgc = m.getAsFloat32Array();
      const mc = document.createElement("canvas"); mc.width = mw; mc.height = mh;
      const mx = mc.getContext("2d"), md = mx.createImageData(mw, mh);
      let fg = 0;
      for (let i = 0; i < mw * mh; i++) { const a = Math.max(0, Math.min(1, (1 - bgc[i] - 0.15) / 0.7)); md.data[i * 4 + 3] = Math.round(a * 255); fg += a; }
      if (fg < mw * mh * 0.02) throw new Error("这张里没认出人来");
      mx.putImageData(md, 0, 0);
      ctx.globalCompositeOperation = "destination-in";
      try { ctx.filter = "blur(1px)"; } catch (e) {}
      ctx.drawImage(mc, 0, 0, W, H);
      ctx.globalCompositeOperation = "source-over"; try { ctx.filter = "none"; } catch (e) {}
    } finally { try { res.close && res.close(); } catch (e) {} }
    return toPng(trimCanvas(cv));
  }
  const CUT_KEY = "x_camCutouts";
  const cutList = pid => (((typeof loadJSON === "function" ? loadJSON(CUT_KEY, {}) : {}) || {})[pid] || []);
  async function cutSave(pid, png, how) {
    const k = "img_cut_" + String(pid).replace(/[^\w-]/g, "") + "_" + Date.now().toString(36);
    await idbImgPut(k, png);
    const all = loadJSON(CUT_KEY, {}) || {}; all[pid] = [{ k, ts: Date.now(), how }].concat(all[pid] || []).slice(0, 24); saveJSON(CUT_KEY, all);
    return k;
  }
  function cutDrop(pid, k) { const all = loadJSON(CUT_KEY, {}) || {}; all[pid] = (all[pid] || []).filter(x => x.k !== k); saveJSON(CUT_KEY, all); }

  // 贴纸怎么画：预览（DOM）和导出（画布）各照这一份尺寸比例来，边框＝宽的 6%
  function drawSticker(ctx, im, st, W, H, label) {
    const size = st.s * W, cx = st.x * W, cy = st.y * H;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(st.r * Math.PI / 180);
    ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = size * 0.08; ctx.shadowOffsetY = size * 0.03;
    if (st.style === "cut") {   // 抠出来的人：不加框，影子跟着人的轮廓落；可以左右翻
      // 半身（她 2026-11-26「生成全身之后只想显示半身」）：只画上面 crop 那一截，下面裁掉
      const cr = st.crop || 1, ar2 = im ? im.naturalHeight / im.naturalWidth || 1 : 1, ih2 = size * ar2 * cr;
      if (st.flip) ctx.scale(-1, 1);
      if (im) ctx.drawImage(im, 0, 0, im.naturalWidth, im.naturalHeight * cr, -size / 2, -ih2 / 2, size, ih2);
      ctx.restore(); return;
    }
    const half = size / 2, bd = st.style === "plain" ? 0 : size * 0.06;
    const ar = im ? im.naturalHeight / im.naturalWidth || 1 : 1, ih = st.style === "plain" ? size * ar : size;
    if (st.style === "round") { ctx.beginPath(); ctx.arc(0, 0, half, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); }
    else if (st.style === "card") { ctx.fillStyle = "#fff"; ctx.fillRect(-half, -size * 0.56, size, size * 1.12); }
    ctx.shadowColor = "transparent";
    if (im) {
      ctx.save(); ctx.beginPath();
      const inner = size - bd * 2;
      if (st.style === "round") ctx.arc(0, 0, inner / 2, 0, Math.PI * 2); else if (st.style === "card") ctx.rect(-inner / 2, -size * 0.56 + bd, inner, inner); else ctx.rect(-half, -ih / 2, size, ih);
      ctx.clip();
      if (st.style === "plain") ctx.drawImage(im, -half, -ih / 2, size, ih);
      else { const s = Math.max(inner / im.naturalWidth, inner / im.naturalHeight), w = im.naturalWidth * s, hh = im.naturalHeight * s, top = st.style === "card" ? -size * 0.56 + bd : -inner / 2;
        ctx.drawImage(im, -w / 2, top + (inner - hh) / 2, w, hh); }
      ctx.restore();
    } else {
      // 没头像图：跟预览一样画一个灰底首字
      const inner = size - bd * 2, top = st.style === "card" ? -size * 0.56 + bd : -inner / 2;
      ctx.save(); ctx.beginPath(); if (st.style === "round") ctx.arc(0, 0, inner / 2, 0, Math.PI * 2); else ctx.rect(-inner / 2, top, inner, inner); ctx.clip();
      ctx.fillStyle = "#ddd"; ctx.fillRect(-inner / 2, top, inner, inner);
      ctx.fillStyle = "#555"; ctx.font = Math.round(size * 0.3) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(label || "?").slice(0, 1), 0, top + inner / 2); ctx.restore();
    }
    ctx.restore();
  }

  function CameraApp(props) {
    const chars = props.characters || [];
    const people = [{ id: "me", name: props.meName || "我", avatarImage: props.meAvatar || "" }].concat(chars);
    const [cs, setCs] = useState({ phase: "off", facing: "environment", message: "" });
    const [bg, setBg] = useState(null);          // 不开镜头、从相册挑一张当背景
    const [stickers, setStickers] = useState([]);
    const [sel, setSel] = useState(null);
    const [filter, setFilter] = useState("none");
    const [adj, setAdj] = useState(ADJ0);
    const [panel, setPanel] = useState("");       // "people" | "filter" | ""
    const [shot, setShot] = useState(null);       // {url, blob}
    const [busy, setBusy] = useState(false);
    // 全身／半身、挑的衣服（她 2026-11-26）：写真合照和抠图人各一份景别；衣服按人记，两处共用
    const [genFrame, setGenFrame] = useState("");
    const [cutFrame, setCutFrame] = useState("full");
    const [fitPick, setFitPick] = useState({});      // {人id: [挑的那几件的名字]}
    const [fitBusy, setFitBusy] = useState("");
    // 给TA看（她 2026-11-26 挑的前三个好玩的）：拍完挑一个人看这张——TA 说一句、在相纸白边上写一行；还能发进TA的聊天
    const [look, setLook] = useState(null);       // {pid, busy, say, caption}
    const [talkBusy, setTalkBusy] = useState("");  // 一起逛：哪张贴纸正在想说什么
    // 一起逛说过的话都记着，能回看（她 2026-11-27「可以回看一下」）：x_camTalkLog，最近 200 段；回看是整页
    const [talkLog, setTalkLog] = useState(() => { try { const v = typeof loadJSON === "function" ? loadJSON("x_camTalkLog", []) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; } });
    const [talkView, setTalkView] = useState(false);
    const logTalk = (pid, lines) => setTalkLog(l => { const n = l.concat([{ pid, lines, ts: Date.now() }]).slice(-200); try { if (typeof saveJSON === "function") saveJSON("x_camTalkLog", n); } catch (e) {} return n; });
    // 模式转盘（真相机快门上面那一排「照片·人像·视频」）：实景＝镜头叠人；生图＝挑人写一句画面，让生图画一张
    const [mode, setMode] = useState("hub");   // hub＝首页那几块入口（她 2026-11-26「像美图秀秀那样分开」）
    const [colTpl, setColTpl] = useState("booth");
    const hubFileRef = useRef(null);
    const [genIds, setGenIds] = useState([]);
    const [genWho, setGenWho] = useState("other");
    const [genScene, setGenScene] = useState("");
    const [genBusy, setGenBusy] = useState(false);
    const [genMulti, setGenMulti] = useState(true);
    // 「让 AI 先写一版」：她写一句，模型扩成一份分镜填回框里；写的时候那颗按钮转圈（她 2026-11-26）
    const [writing, setWriting] = useState("");
    const writeShot = async (cut) => {
      if (writing || !props.onWriteShot) return;
      const ids = cut ? [cutFor] : genIds;
      if (!ids.length) { props.toast && props.toast("先挑画面里有谁"); return; }
      setWriting(cut ? "cut" : "gen");
      try { const t = await props.onWriteShot(ids, cut ? cutPose : genScene, genWho, !!cut); if (cut) setCutPose(t); else setGenScene(t); }
      catch (e) { props.toast && props.toast("没写成：" + String(e && e.message || e).slice(0, 80)); }
      finally { setWriting(""); }
    };   // 首页点的是「单人写真」还是「多人合照」
    // 这一趟拍的、画的都排进胶卷：拼贴那边直接从这里挑（存进图库，拼贴读图走 imgKey）
    const [roll, setRoll] = useState([]);
    const [rollWho, setRollWho] = useState("");   // 拍过的：按谁筛，空＝全部
    const [rollSel, setRollSel] = useState(null);  // 多选删除（群友 2026-11-28「拍了几百张一个个删有点费」）：null＝没在选，数组＝选中的 imgKey
    // 抠图人：给谁抠（默认第一个角色）、她写的姿势、在忙什么；抠好的图按 img_ 键现读成 objectURL
    const [pTab, setPTab] = useState("avatar");   // 加人面板里两格：头像贴纸 / 抠出来的人（底栏不再多塞一颗，挤不下）
    const [cutFor, setCutFor] = useState(() => (chars[0] && chars[0].id) || "me");
    const [cutPose, setCutPose] = useState("");
    const [cutBusy, setCutBusy] = useState("");
    const [cutRev, setCutRev] = useState(0);
    const [cutUrls, setCutUrls] = useState({});
    const cutFileRef = useRef(null);
    const cuts = cutList(cutFor);
    useEffect(() => {
      let alive = true;
      const want = new Set(stickers.filter(s => s.style === "cut").map(s => s.k).concat(cuts.map(x => x.k)));
      want.forEach(k => { if (cutUrls[k] || typeof idbImgGet !== "function") return;
        idbImgGet(k).then(b => { if (alive && b) { const u = URL.createObjectURL(b); setCutUrls(m => m[k] ? m : Object.assign({}, m, { [k]: u })); } }).catch(() => {}); });
      return () => { alive = false; };
    }, [cutFor, cutRev, stickers.length]);
    const addCut = (pid, k) => {
      const st = { id: "s" + Date.now() + Math.random().toString(36).slice(2, 5), pid, k, x: 0.5 + (stickers.length % 3 - 1) * 0.18, y: 0.6, s: 0.5, r: 0, style: "cut" };
      setStickers(l => l.concat([st])); setSel(st.id);
    };
    const closetOf = id => id && id !== "me" && props.onClosetOf ? props.onClosetOf(id) || [] : [];
    const fitText = id => { const sets = closetOf(id), names = fitPick[id] || []; return names.map(n => { const x = sets.find(y => y.name === n); return x ? x.name + (x.note ? "（" + x.note + "）" : "") : n; }).join("、"); };
    const fitsFor = ids => { const o = {}; ids.forEach(id => { const t = fitText(id); if (t) o[id] = t; }); return o; };
    const togFit = (id, n) => setFitPick(m => { const l = m[id] || []; return Object.assign({}, m, { [id]: l.indexOf(n) >= 0 ? l.filter(x => x !== n) : l.concat([n]) }); });
    const genFit = async (id, hint) => {
      if (fitBusy || !props.onGenFit) return; setFitBusy(id);
      try { const x = await props.onGenFit(id, hint); setFitPick(m => Object.assign({}, m, { [id]: [x.name] })); }
      catch (e) { props.toast && props.toast("没配成：" + String(e && e.message || e).slice(0, 80)); } finally { setFitBusy(""); }
    };
    const outfitFor = (id, hint, dark) => { const p = people.find(x => x.id === id); if (!p || id === "me") return null;
      return h(OutfitPick, { key: "fit" + id, name: p.name, sets: closetOf(id), picked: fitPick[id] || [], onToggle: n => togFit(id, n), onClear: () => setFitPick(m => Object.assign({}, m, { [id]: [] })), onGen: props.onGenFit ? () => genFit(id, hint) : null, busy: fitBusy === id, dark }); };
    const genCut = async () => {
      if (cutBusy || !props.onGenCutout) return;
      setCutBusy("gen");
      try { const raw = await props.onGenCutout(cutFor, cutPose, { frame: cutFrame, fits: fitsFor([cutFor]) }); const png = await keyGreen(raw); const k = await cutSave(cutFor, png, "gen"); setCutRev(n => n + 1); addCut(cutFor, k); }
      catch (e) { props.toast && props.toast("没抠成：" + String(e && e.message || e).slice(0, 80)); }
      finally { setCutBusy(""); }
    };
    const pickCut = async e => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f || cutBusy) return;
      setCutBusy("seg");
      try { const png = await segmentPerson(f); const k = await cutSave(cutFor, png, "photo"); setCutRev(n => n + 1); addCut(cutFor, k); }
      catch (err) { props.toast && props.toast("没抠成：" + String(err && err.message || err).slice(0, 80)); }
      finally { setCutBusy(""); }
    };
    // 胶卷（她 2026-11-26「拍完大退重进怎么就没了」）：图本来就进了本机图库，丢的是这张清单——
    //   清单不另存，开相机时照图库里 img_camroll_ 的键排出来；拍的/画的写在键尾，时间是键里那段 36 进制
    const ROLL_DESC = { s: "拍的", g: "画的" };
    // 按角色分（她 2026-11-26）：画面里有谁也写在键尾（各自 encode、用 ~ 连），胶卷那一排按人筛
    const toRoll = async (blob, desc, pids) => { try { if (typeof idbImgPut !== "function") return; const ps = (pids || []).filter(x => x && x !== "me"), ts = Date.now(), k = "img_camroll_" + ts.toString(36) + "_" + (desc === "画的" ? "g" : "s") + (ps.length ? "_" + ps.map(encodeURIComponent).join("~") : ""); await idbImgPut(k, blob); setRoll(l => [{ imgKey: k, ts, desc, pids: ps }].concat(l)); return k; } catch (e) { return ""; } };
    useEffect(() => { let live = true;
      (async () => { try { if (typeof idbAllKeys !== "function" || typeof idbImgOpen !== "function") return;
        const ks = (await idbAllKeys(idbImgOpen) || []).map(String).filter(k => k.indexOf("img_camroll_") === 0);
        const list = ks.map(k => { const r = k.slice(12), i = r.indexOf("_"), rest = i < 0 ? "" : r.slice(i + 1), j = rest.indexOf("_");
          return { imgKey: k, ts: parseInt(i < 0 ? r : r.slice(0, i), 36) || 0, desc: ROLL_DESC[rest.charAt(0)] || "拍的", pids: j < 0 ? [] : rest.slice(j + 1).split("~").map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } }) }; }).sort((a, b) => b.ts - a.ts);
        if (live) setRoll(l => l.concat(list.filter(x => !l.some(y => y.imgKey === x.imgKey)))); } catch (e) {} })();
      return () => { live = false; }; }, []);
    const camRef = useRef(null), videoRef = useRef(null), stageRef = useRef(null), fileRef = useRef(null), touches = useRef({});
    useEffect(() => {
      const cam = window.CallCamera.create(setCs, window, { width: 1920, height: 1080 });
      camRef.current = cam;   // 进了「拍照」才开镜头，首页不占摄像头
      if (videoRef.current) cam.attach(videoRef.current);
      return () => cam.dispose();
    }, []);
    useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
    // 自己调（她 2026-11-26「滤镜能不能自己调」）：选好的滤镜后面再叠一层，五根条都只拼成同一种 CSS 串，预览、导出、逐像素兜底照旧共用
    const fcss = ((FILTERS.find(f => f.id === filter) || FILTERS[0]).css + " " + adjCss(adj)).trim();
    const mirror = !bg && cs.facing === "user";
    const switchMode = m => {
      if (m === mode) return; setMode(m); setPanel(""); setSel(null);
      if (m === "hub" && bg) { URL.revokeObjectURL(bg); setBg(null); }
      if (m !== "live") { camRef.current && camRef.current.close(); }
      else if (!bg) camRef.current && camRef.current.open(cs.facing || "environment");
    };
    const runGen = async () => {
      if (genBusy || !props.onGen) return;
      if (!genIds.length) { props.toast && props.toast("先挑画面里有谁"); return; }
      setGenBusy(true);
      try { const blob = await props.onGen(genIds, genScene, genWho, { frame: genFrame, fits: fitsFor(genIds) }); setShot({ url: URL.createObjectURL(blob), blob, gen: true, pids: genIds.filter(x => x !== "me") }); setLook(null); toRoll(blob, "画的", genIds).then(k => k && setShot(s => s && s.blob === blob ? Object.assign({}, s, { k }) : s)); }
      catch (e) { props.toast && props.toast("没画成：" + String(e && e.message || e).slice(0, 80)); }
      finally { setGenBusy(false); }
    };
    // 画好的那张拿去实景那边：当背景，照样能贴人、上滤镜，再按快门
    const genToEdit = () => { if (!shot) return; if (bg) URL.revokeObjectURL(bg); setBg(URL.createObjectURL(shot.blob)); setShot(null); setMode("live"); };

    // 加人那一排是多选：点一下上画面，再点一下拿下来；面板不收，可以一口气挑好几个（她 2026-11-26「我和角色都可以」）
    const togglePerson = p => { const on = stickers.filter(s => s.pid === p.id); if (on.length) { setStickers(l => l.filter(s => s.pid !== p.id)); setSel(null); } else addPerson(p); };
    const addPerson = p => {
      const st = { id: "s" + Date.now() + Math.random().toString(36).slice(2, 5), pid: p.id, x: 0.5 + (stickers.length % 3 - 1) * 0.18, y: 0.55, s: 0.32, r: 0, style: "round" };
      setStickers(l => l.concat([st])); setSel(st.id);
    };
    const patch = (id, p) => setStickers(l => l.map(s => s.id === id ? Object.assign({}, s, p) : s));
    const rect = () => stageRef.current.getBoundingClientRect();
    const onDown = (e, id) => {
      e.stopPropagation(); setSel(id);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {}
      const st = stickers.find(s => s.id === id); if (!st) return;
      touches.current[e.pointerId] = { x: e.clientX, y: e.clientY };
      const ids = Object.keys(touches.current);
      touches.current._base = { st: Object.assign({}, st), pts: ids.map(k => Object.assign({}, touches.current[k])) };
    };
    const onMove = (e, id) => {
      if (!touches.current[e.pointerId]) return;
      touches.current[e.pointerId] = { x: e.clientX, y: e.clientY };
      const base = touches.current._base; if (!base) return;
      const R = rect(), ids = Object.keys(touches.current).filter(k => k !== "_base"), pts = ids.map(k => touches.current[k]);
      if (pts.length >= 2 && base.pts.length >= 2) {
        const d0 = Math.hypot(base.pts[1].x - base.pts[0].x, base.pts[1].y - base.pts[0].y) || 1, d1 = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const a0 = Math.atan2(base.pts[1].y - base.pts[0].y, base.pts[1].x - base.pts[0].x), a1 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
        patch(id, { s: Math.max(0.08, Math.min(1.6, base.st.s * d1 / d0)), r: base.st.r + (a1 - a0) * 180 / Math.PI });
      } else if (pts.length === 1 && base.pts.length === 1) {
        patch(id, { x: Math.max(0, Math.min(1, base.st.x + (pts[0].x - base.pts[0].x) / R.width)), y: Math.max(0, Math.min(1, base.st.y + (pts[0].y - base.pts[0].y) / R.height)) });
      }
    };
    const onUp = (e) => {
      delete touches.current[e.pointerId];
      const ids = Object.keys(touches.current).filter(k => k !== "_base");
      const cur = stickers.find(s => s.id === sel);
      touches.current._base = ids.length && cur ? { st: Object.assign({}, cur), pts: ids.map(k => Object.assign({}, touches.current[k])) } : null;
    };

    const pickBg = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      const url = URL.createObjectURL(f); setBg(url); if (camRef.current) camRef.current.close(); };
    const backToCam = () => { if (bg) URL.revokeObjectURL(bg); setBg(null); camRef.current && camRef.current.open(cs.facing || "environment"); };

    // 把取景框此刻的样子画成一张图：快门存它；「TA说一句」也拿它给TA看（tiny＝缩小省流量）
    const renderFrame = async (opt) => {
        const R = rect(), W0 = R.width, H0 = R.height;
        let src = null, sw = 0, sh = 0;
        if (bg) { src = await loadImg(bg); sw = src && src.naturalWidth; sh = src && src.naturalHeight; }
        else { const v = videoRef.current; if (v && v.readyState >= 2) { src = v; sw = v.videoWidth; sh = v.videoHeight; } }
        if (!src || !sw || !sh) throw new Error(bg ? "这张图没读出来" : "镜头还没出画面，等一下再按");
        // 跟预览一样按 cover 裁：取景框里看到哪一块，存下来就是哪一块
        const sc = Math.max(W0 / sw, H0 / sh), cw = W0 / sc, ch = H0 / sc, cx = (sw - cw) / 2, cy = (sh - ch) / 2;
        const out = Math.min(opt && opt.tiny ? 768 : 1440, Math.round(cw)), W = Math.max(1, out), H = Math.max(1, Math.round(out * H0 / W0));
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d");
        if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        ctx.drawImage(src, cx, cy, cw, ch, 0, 0, W, H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const st of stickers) { const p = people.find(x => x.id === st.pid);
          if (st.style === "cut") { ctx.save(); ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = st.s * W * 0.04; ctx.shadowOffsetY = st.s * W * 0.02; drawSticker(ctx, await loadImg(cutUrls[st.k]), st, W, H); ctx.restore(); }
          else drawSticker(ctx, await loadImg(srcOf(p)), st, W, H, p && p.name); }
        if (!(opt && opt.noTalk)) for (const st of stickers) if (st.say) drawBubble(ctx, st.say, st.x * W, st.y * H - talkLift(st, W, H) * H, W);
        if (fcss) {
          if (canCtxFilter(ctx)) { const c2 = document.createElement("canvas"); c2.width = W; c2.height = H; const x2 = c2.getContext("2d"); x2.filter = fcss; x2.drawImage(cv, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(c2, 0, 0); }
          else pixelFilter(ctx, W, H, fcss);
        }
        if (opt && opt.tiny) return cv.toDataURL("image/jpeg", 0.8);
        return await new Promise((res, rej) => { try { cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/jpeg", 0.92); } catch (x) { rej(x); } });
    };
    // 贴纸头顶在哪：泡泡的尖对着它。高度＝宽×长宽比（原图／抠的人按图本身的比例，图载好时记在 st.ar）
    const talkLift = (st, W, H) => { const ar = st.style === "round" ? 1 : st.style === "card" ? 1.12 : (st.ar || 1.4) * (st.style === "cut" ? st.crop || 1 : 1); return st.s * W * ar / 2 / H; };
    // 一起逛：TA 看着取景框里此刻的样子（自己也在里面）说一句，泡泡挂在TA头顶，按快门时一起拍进去
    const talk = async st => {
      if (talkBusy || !props.onLook) return;
      setTalkBusy(st.id);
      try { const img = await renderFrame({ tiny: true, noTalk: true });
        const prior = talkLog.filter(x => x.pid === st.pid).slice(-6).flatMap(x => x.lines);
        const d = await props.onLook(st.pid, img, "live", false, prior);
        const lines = (d && Array.isArray(d.lines) ? d.lines : [d && d.say]).map(x => String(x || "").trim()).filter(Boolean);
        if (lines.length) { patch(st.id, { say: lines.join("\n") }); logTalk(st.pid, lines); } }
      catch (e) { props.toast && props.toast("没说成：" + String(e && e.message || e).slice(0, 80)); }
      finally { setTalkBusy(""); }
    };
    // 给TA看：TA 看拍好的这一张，说一句、写一行在白边上
    const showTo = async pid => {
      if (!shot || (look && look.busy) || !props.onLook) return;
      setLook({ pid, busy: true }); const blob = shot.blob;
      try { const u = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
        const d = await props.onLook(pid, await shrink(u), shot.gen ? "gen" : "photo", (shot.pids || []).indexOf(pid) >= 0);
        setLook({ pid, say: String((d && d.say) || "").trim(), caption: String((d && d.caption) || "").replace(/\s+/g, " ").trim() }); }
      catch (e) { setLook(null); props.toast && props.toast("没看成：" + String(e && e.message || e).slice(0, 80)); }
    };
    const shrink = async u => { const im = await loadImg(u); if (!im) return u; const k = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight)); if (k >= 1) return u;
      const cv = document.createElement("canvas"); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height); return cv.toDataURL("image/jpeg", 0.82); };
    // 存／发出去的那一张：TA 写了字就是带白边那张拍立得，没写就是原片
    const finalBlob = async () => look && look.caption ? await polaroid(shot.blob, look.caption, loadImg) : shot.blob;
    const sendTo = async () => {
      if (!shot || !look || !props.onShare) return;
      try { await props.onShare(look.pid, await finalBlob(), look.caption || ""); } catch (e) { props.toast && props.toast("没发出去：" + String(e && e.message || e).slice(0, 80)); }
    };
    // 拍过的那一排：点开就是拍完那一页（存到手机、给TA看照旧），左下换成「删除」——删的是本机图库里这一张
    const rollPeople = chars.filter(c => roll.some(x => (x.pids || []).indexOf(c.id) >= 0));
    const rollShown = rollWho && rollPeople.some(c => c.id === rollWho) ? roll.filter(x => (x.pids || []).indexOf(rollWho) >= 0) : roll;
    const openRoll = async p => {
      try { const blob = typeof idbImgGet === "function" ? await idbImgGet(p.imgKey) : null; if (!blob) throw new Error("这张在本机图库里找不到了");
        setLook(null); setShot({ url: URL.createObjectURL(blob), blob, k: p.imgKey, fromRoll: true, gen: p.desc === "画的", pids: [] }); }
      catch (e) { props.toast && props.toast(String(e && e.message || e)); }
    };
    const delRollMany = keys => {
      if (!keys || !keys.length) return;
      const go = async () => { for (const k of keys) { try { if (typeof idbImgDel === "function") await idbImgDel(k); } catch (e) {} }
        setRoll(l => l.filter(x => keys.indexOf(x.imgKey) < 0)); setRollSel(null); };
      if (typeof requestAppConfirm === "function") requestAppConfirm("删掉这 " + keys.length + " 张？", "删了就找不回来了（已经存到手机、发进聊天的那份不受影响）", go, "删掉");
      else go();
    };
    const delRoll = async () => {
      // ⚠️不用 window.confirm：装成 App 后那个框被系统吞掉、直接当「取消」（她 2026-11-26「删不掉按不动」）——走 App 自己那层确认
      if (!shot || !shot.k) return;
      const k = shot.k, go = async () => { try { if (typeof idbImgDel === "function") await idbImgDel(k); } catch (e) {} setRoll(l => l.filter(x => x.imgKey !== k)); setShot(null); setLook(null); };
      if (typeof requestAppConfirm === "function") requestAppConfirm("删掉这张？", "删了就找不回来了（已经存到手机、发进聊天的那份不受影响）", go, "删掉");
      else await go();
    };
    const capture = async () => {
      if (busy) return; setBusy(true);
      try {
        const blob = await renderFrame();
        setShot({ url: URL.createObjectURL(blob), blob, pids: Array.from(new Set(stickers.map(s => s.pid).filter(x => x && x !== "me"))) }); setSel(null); setLook(null);
        toRoll(blob, "拍的", stickers.map(s => s.pid)).then(k => k && setShot(s => s && s.blob === blob ? Object.assign({}, s, { k }) : s));
      } catch (e) {
        const m = e && e.name === "SecurityError" ? "有张头像是网上的图，浏览器不让画进照片；换成本地上传的头像再拍" : String(e && e.message || e);
        props.toast && props.toast(m);
      } finally { setBusy(false); }
    };
    const save = async () => { if (!shot) return; let b = shot.blob; try { b = await finalBlob(); } catch (e) {} const f = new File([b], "相机-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "") + ".jpg", { type: "image/jpeg" });
      if (typeof saveFile === "function") saveFile(f); };

    // 按钮（她 2026-11-26「各个页面里面的界面好丑」）：浮在实景上的一律是磨砂深底＋细白边，选中的那颗是白底；颜色跟首页那块「拍照」同一组粉橙
    const btn = (label, onClick, on, part) => h("button", { "data-wk": "cambtn", "data-part": part || "", "data-on": on ? "1" : "0", onClick,
      style: { flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 999, border: on ? "1px solid #fff" : "1px solid rgba(255,255,255,.22)", background: on ? "#fff" : "rgba(28,22,30,.42)", color: on ? "#2b2230" : "#fff",
        fontSize: FS(12.5), fontWeight: on ? 600 : 500, letterSpacing: ".02em", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } }, label);
    const svg = (d, size, color, sw) => h("svg", { viewBox: "0 0 24 24", width: size || 22, height: size || 22, fill: "none", stroke: color || "#fff", strokeWidth: sw || 1.8, strokeLinecap: "round", strokeLinejoin: "round" }, d.map((x, i) => h("path", { key: i, d: x })));
    const IC = {
      back: ["M14.5 5.5L8 12l6.5 6.5"],
      flip: ["M4 9.5h12.5l-3-3", "M20 14.5H7.5l3 3"],
      album: ["M4 5.5h16v13H4z", "M4 15l4.5-4.5 4 4 3-3L20 16", "M15.5 9.2a1.3 1.3 0 100-.01"],
      people: ["M9 11a3 3 0 100-6 3 3 0 000 6z", "M3.5 19.5c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5", "M15.8 11a2.6 2.6 0 100-5.2", "M17.3 14.4c1.9.5 3 2.2 3.2 5.1"],
      filter: ["M9.5 9a4.5 4.5 0 109 0 4.5 4.5 0 10-9 0", "M5.5 14.5a4.5 4.5 0 109 0 4.5 4.5 0 10-9 0", "M9.5 14.5a4.5 4.5 0 109 0 4.5 4.5 0 10-9 0"],
      clear: ["M5 7h14", "M9.5 7V5h5v2", "M7 7l1 12.5h8L17 7"]
    };
    const GRAD = "linear-gradient(135deg,#ff5f9e 0%,#ff8a7a 55%,#ffb36b 100%)";
    // 快门两边那几颗：图标在上、字在下，磨砂圆底
    const ctl = (label, icon, onClick, on, part, hide) => h("button", { "data-wk": "cambtn", "data-part": part || "", "data-on": on ? "1" : "0", onClick, disabled: !!hide,
      style: { width: 56, border: "none", background: "transparent", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: hide ? 0 : 1, padding: 0 } },
      h("span", { style: { width: 42, height: 42, borderRadius: 21, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "#fff" : "rgba(28,22,30,.42)", border: "1px solid " + (on ? "#fff" : "rgba(255,255,255,.22)"), backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } },
        svg(icon, 21, on ? "#2b2230" : "#fff")),
      h("span", { style: { fontSize: FS(10.5), letterSpacing: ".04em", textShadow: "0 1px 3px rgba(0,0,0,.45)" } }, label));
    const roundBtn = (icon, onClick, part, label) => h("button", { "data-wk": "cambtn", "data-part": part, onClick, "aria-label": label,
      style: { height: 38, minWidth: 38, padding: label && part !== "back" ? "0 14px 0 10px" : 0, borderRadius: 19, border: "1px solid rgba(255,255,255,.22)", background: "rgba(28,22,30,.42)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: FS(12.5), backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } },
      svg(icon, 20), label && part !== "back" ? label : null);
    const avatarRing = (p, on, size) => h("div", { style: { display: "inline-block", borderRadius: "50%", padding: 2.5, background: on ? GRAD : "rgba(255,255,255,.18)" } },
      h("div", { style: { borderRadius: "50%", padding: 1.5, background: "rgba(20,16,22,.9)" } }, typeof Avatar === "function" ? h(Avatar, { character: p, size }) : null));
    const selSt = stickers.find(s => s.id === sel);

    if (shot) {
      // 成片：照片放在一张白边相纸上，底下一排；「存到手机」是那颗粉橙的
      const big = (label, onClick, part, primary) => h("button", { "data-wk": "cambtn", "data-part": part, onClick,
        style: { flex: primary ? 1.4 : 1, height: 48, borderRadius: 24, border: primary ? "none" : "1px solid rgba(255,255,255,.22)", background: primary ? GRAD : "rgba(255,255,255,.1)", color: "#fff", fontSize: FS(14), fontWeight: primary ? 600 : 500, letterSpacing: ".04em",
          boxShadow: primary ? "0 10px 24px -12px rgba(255,80,130,.8)" : "none" } }, label);
      // 给TA看：一排头像（照片里有的人排前面），点谁谁看；看完一块白泡泡，「发给TA」把这张（带字就是拍立得那张）发进TA的聊天
      const lk = look, lp = lk && people.find(x => x.id === lk.pid), cap = lk && lk.caption;
      const order = chars.slice().sort((a, b) => ((shot.pids || []).indexOf(b.id) >= 0) - ((shot.pids || []).indexOf(a.id) >= 0));
      const lookRow = props.onLook && chars.length ? h("div", { "data-wk": "camlook", style: { padding: "0 18px 6px" } },
        lk && !lk.busy && lk.say ? h("div", { "data-wk": "camlooksay", style: { background: "rgba(255,255,255,.96)", color: "#2b2230", borderRadius: 16, padding: "10px 12px", marginBottom: 10, fontSize: FS(13.5), lineHeight: 1.6, boxShadow: "0 10px 24px -14px rgba(0,0,0,.7)" } },
          h("div", { style: { fontSize: FS(11), color: "#9a8a96", marginBottom: 2 } }, (lp && lp.name) || "TA"),
          h("div", { style: { whiteSpace: "pre-wrap" } }, lk.say),
          props.onShare ? h("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 6 } },
            h("button", { "data-wk": "cambtn", "data-part": "sendto", onClick: sendTo, style: { height: 30, padding: "0 14px", borderRadius: 15, border: "none", background: GRAD, color: "#fff", fontSize: FS(12), fontWeight: 600 } }, "发给" + ((lp && lp.name) || "TA"))) : null) : null,
        h("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("span", { style: { flexShrink: 0, color: "rgba(255,255,255,.7)", fontSize: FS(12) } }, lk && lk.busy ? "在看…" : "给TA看"),
          h("div", { style: { display: "flex", gap: 8, overflowX: "auto", padding: "2px 0" } },
            order.map(p => h("button", { key: p.id, "data-wk": "camlookone", "data-on": lk && lk.pid === p.id ? "1" : "0", onClick: () => showTo(p.id), "aria-label": p.name,
              style: { flexShrink: 0, border: "none", background: "transparent", padding: 0, opacity: lk && lk.busy && lk.pid !== p.id ? .4 : 1 } },
              avatarRing(p, lk && lk.pid === p.id, 36)))))) : null;
      return h("div", { "data-wk": "campage", "data-part": "result", className: "h-full", style: { position: "relative", background: "radial-gradient(120% 70% at 50% 0%, #3a2433 0%, #17121a 60%)", display: "flex", flexDirection: "column" } },
        h("div", { style: { paddingTop: safeTop(8), paddingLeft: 12, paddingRight: 12, display: "flex", alignItems: "center" } },
          roundBtn(IC.back, () => setShot(null), "back", "返回"),
          h("div", { style: { flex: 1, textAlign: "center", color: "rgba(255,255,255,.8)", fontSize: FS(13.5), letterSpacing: ".18em" } }, shot.fromRoll ? "拍过的" : shot.gen ? "画好了" : "拍好了"), h("div", { style: { width: 38 } })),
        h("div", { style: { flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 22px" } },
          h("div", { "data-wk": "camresultframe", style: { background: "#fbfaf7", padding: 8, paddingBottom: cap ? 6 : 26, borderRadius: 6, boxShadow: "0 24px 50px -20px rgba(0,0,0,.8)", maxWidth: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center" } },
            h("img", { "data-wk": "camresult", src: shot.url, style: { maxWidth: "100%", maxHeight: "calc(100vh - " + (lookRow ? 400 : 260) + "px)", objectFit: "contain", display: "block", borderRadius: 2 } }),
            cap ? h("div", { "data-wk": "camcaption", style: { fontFamily: HAND, fontSize: FS(20), color: "#3a3340", textAlign: "center", padding: "8px 6px 4px", lineHeight: 1.2, maxWidth: "100%" } }, cap) : null)),
        lookRow,
        h("div", { style: { display: "flex", gap: 10, padding: "6px 18px 16px", paddingBottom: "calc(16px + " + COMPOSER_PAD_BOTTOM + ")" } },
          shot.fromRoll ? big("删除", delRoll, "delshot") : shot.gen ? big(genBusy ? "在画…" : "再画一张", () => { if (!genBusy) { setShot(null); runGen(); } }, "regen") : big("重拍", () => setShot(null), "retake"),
          shot.gen && !shot.fromRoll ? big("加滤镜·贴人", genToEdit, "edit") : null,
          big("存到手机", save, "save", true)));
    }
    // ── 首页：像修图 app 的首屏，一块大的「拍照」，底下几格各进各的 ──
    if (mode === "hub") {
      const ico = (d, c) => h("svg", { viewBox: "0 0 24 24", width: 26, height: 26, fill: "none", stroke: c || "#fff", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }, d.map((x, i) => h("path", { key: i, d: x })));
      const I = {
        cam: ["M4 8h3l1.6-2.2h6.8L17 8h3v11H4z", "M12 9.7a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z"],
        edit: ["M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"],
        gen: ["M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z", "M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"],
        duo: ["M8.5 11a3 3 0 100-6 3 3 0 000 6z", "M15.5 11a3 3 0 100-6 3 3 0 000 6z", "M3 20c.5-3.5 2.8-5.5 5.5-5.5S13.5 16.5 14 20", "M10 20c.5-3.5 2.8-5.5 5.5-5.5S20.5 16.5 21 20"],
        grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
        booth: ["M8 3h8v18H8z", "M8 7.5h8", "M8 12h8", "M8 16.5h8"],
        trip: ["M4 6.5l5-2 6 2 5-2v13l-5 2-6-2-5 2z", "M9 4.5v13", "M15 6.5v13"],
        movie: ["M4 8h16v11H4z", "M4 8l3-4h3l-3 4", "M10 8l3-4h3l-3 4", "M16 8l3-4h1"],
        worlds: ["M12 3a9 9 0 100 18 9 9 0 100-18", "M3.5 9h17", "M3.5 15h17", "M12 3c-3 3-3 15 0 18", "M12 3c3 3 3 15 0 18"]
      };
      const goGen = (who, multi) => { setGenWho(who); setGenMulti(multi); if (!multi && genIds.length > 1) setGenIds(genIds.slice(0, 1)); switchMode("gen"); };
      return h("div", { "data-wk": "campage", "data-part": "hub", className: "h-full flex flex-col", style: { background: "linear-gradient(180deg,#ffe3ee 0%,#fff6f9 38%,#fdfbfc 100%)", color: "#2b2230" } },
        typeof Head === "function" ? h(Head, { zh: "相机", bg: "transparent", onBack: props.onBack }) : null,
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 16px 28px" } },
          // 主入口：拍照（实景 + 带上TA）
          h("button", { "data-wk": "camhubtile", "data-part": "shoot", onClick: () => { if (bg) { URL.revokeObjectURL(bg); setBg(null); } setMode("live"); setPanel(""); camRef.current && camRef.current.open(cs.facing || "environment"); }, className: "active:opacity-85",
            style: { width: "100%", border: "none", borderRadius: 26, padding: "20px 20px 18px", textAlign: "left", color: "#fff", background: "linear-gradient(135deg,#ff5f9e 0%,#ff8a7a 55%,#ffb36b 100%)", boxShadow: "0 14px 30px -16px rgba(255,80,130,.75)", position: "relative", overflow: "hidden" } },
            h("div", { style: { position: "absolute", right: -26, top: -26, width: 140, height: 140, borderRadius: 70, background: "rgba(255,255,255,.16)" } }),
            h("div", { style: { position: "absolute", right: 30, bottom: -40, width: 90, height: 90, borderRadius: 45, background: "rgba(255,255,255,.12)" } }),
            h("div", { style: { width: 52, height: 52, borderRadius: 18, background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" } }, ico(I.cam)),
            h("div", { style: { fontSize: FS(22), fontWeight: 700, letterSpacing: ".06em", marginTop: 14 } }, "拍照"),
            h("div", { style: { fontSize: FS(12.5), opacity: .9, marginTop: 4 } }, "镜头里的真实景色，把TA和你贴进来一起拍")),
          // 小工具一排（她 2026-11-27「弄好看点」：八块一样大的色块挤一格一格的，看不出哪个是哪种）：图标圆片＋两个字，装在一张白卡里
          h("div", { style: { fontSize: FS(12), color: "#9a8592", letterSpacing: ".12em", margin: "18px 4px 8px" } }, "修图 · 生图"),
          h("div", { "data-wk": "camhubtools", style: { background: "#fff", borderRadius: 22, padding: "14px 6px 10px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4, boxShadow: "0 10px 26px -18px rgba(160,60,110,.5)" } },
            [["edit", "修图", "linear-gradient(135deg,#8f7bff,#c08bff)", I.edit, () => hubFileRef.current && hubFileRef.current.click()],
             ["gen1", "单人写真", "linear-gradient(135deg,#ff7eb3,#ffa3c4)", I.gen, () => goGen("other", false)],
             ["genN", "多人合照", "linear-gradient(135deg,#46c6c0,#7fd9a8)", I.duo, () => goGen("other", true)],
             ["collage", "拼图", "linear-gradient(135deg,#ffb259,#ffd27a)", I.grid, () => { setColTpl("grid4"); switchMode("collage"); }],
             ["booth", "大头贴", "linear-gradient(135deg,#5aa2ff,#8fc1ff)", I.booth, () => { setColTpl("booth"); switchMode("collage"); }]
            ].map(([part, zh, g, ic, go]) => h("button", { key: part, "data-wk": "camhubtile", "data-part": part, onClick: go, className: "active:opacity-70", style: { border: "none", background: "transparent", padding: "2px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#2b2230" } },
              h("span", { style: { width: 46, height: 46, borderRadius: 16, background: g, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px -8px rgba(120,40,80,.6)" } }, ico(ic)),
              h("span", { style: { fontSize: FS(11.5), whiteSpace: "nowrap" } }, zh)))),
          // 玩一玩：三张有自己颜色的横卡，跟进去那一页同一套色
          (props.onTripCard || props.onMoviePlan || props.onWorldsPlan) ? h("div", { style: { fontSize: FS(12), color: "#9a8592", letterSpacing: ".12em", margin: "20px 4px 8px" } }, "玩一玩") : null,
          [props.onTripCard && ["trip", "旅行", "排几站，每到一站收一张明信片", "linear-gradient(135deg,#2f4a6d 0%,#6d86a6 100%)", I.trip, "#fff"],
           props.onMoviePlan && ["movie", "电影", "主演一部片：海报、剧照、台词", "linear-gradient(135deg,#2b2030 0%,#5a3a4c 60%,#a8705a 100%)", I.movie, "#f4ede3"],
           props.onWorldsPlan && ["worlds", "平行人生", "换个世界的TA，一张写真一封信", "linear-gradient(135deg,#7fb4ff 0%,#a98bff 60%,#e6a7f0 100%)", I.worlds, "#fff"]
          ].filter(Boolean).map(([part, zh, sub, g, ic, ink]) => h("button", { key: part, "data-wk": "camhubtile", "data-part": part, onClick: () => switchMode(part), className: "active:opacity-80",
            style: { width: "100%", position: "relative", overflow: "hidden", border: "none", borderRadius: 22, padding: "16px 18px", marginBottom: 10, textAlign: "left", color: ink, background: g, boxShadow: "0 12px 26px -16px rgba(80,30,60,.6)", display: "flex", alignItems: "center", gap: 14 } },
            h("div", { style: { position: "absolute", right: -20, top: -30, width: 110, height: 110, borderRadius: 55, background: "rgba(255,255,255,.12)" } }),
            h("div", { style: { flex: 1, minWidth: 0, position: "relative" } },
              h("div", { style: { fontSize: FS(17), fontWeight: 700, letterSpacing: ".06em" } }, zh),
              h("div", { style: { fontSize: FS(11.5), opacity: .85, marginTop: 3 } }, sub)),
            h("div", { style: { width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" } }, ico(ic)))),
          roll.length ? h("div", { style: { marginTop: 20 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 14, marginBottom: 8 } },
              h("div", { style: { fontSize: FS(13), fontWeight: 600, flex: 1 } }, "拍过的" + (rollSel ? " · 选了 " + rollSel.length + " 张" : "")),
              rollSel ? h("button", { "data-wk": "cambtn", "data-part": "rollall", onClick: () => { const all = rollShown.map(x => x.imgKey); setRollSel(rollSel.length === all.length ? [] : all); }, style: { border: "none", background: "transparent", color: "#4a3f47", fontSize: FS(12), padding: 0 } }, rollSel.length === rollShown.length ? "全不选" : "全选") : null,
              rollSel ? h("button", { "data-wk": "cambtn", "data-part": "rolldel", disabled: !rollSel.length, onClick: () => delRollMany(rollSel), style: { border: "none", background: "transparent", color: "#e0457b", fontSize: FS(12), fontWeight: 600, padding: 0, opacity: rollSel.length ? 1 : .4 } }, "删掉") : null,
              h("button", { "data-wk": "cambtn", "data-part": "rollpick", onClick: () => setRollSel(rollSel ? null : []), style: { border: "none", background: "transparent", color: "#9a8592", fontSize: FS(12), padding: 0 } }, rollSel ? "取消" : "选择")),
            rollPeople.length ? h("div", { "data-wk": "camrollwho", style: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 } },
              [{ id: "", name: "全部" }].concat(rollPeople).map(p => { const on = rollWho === p.id;
                return h("button", { key: p.id || "all", "data-wk": "camrollwhoone", "data-on": on ? "1" : "0", onClick: () => setRollWho(p.id),
                  style: { flexShrink: 0, height: 28, padding: "0 12px", borderRadius: 14, border: on ? "none" : "1px solid rgba(0,0,0,.1)", background: on ? GRAD : "#fff", color: on ? "#fff" : "#4a3f47", fontSize: FS(12), fontWeight: on ? 600 : 400 } },
                  p.name + (p.id ? " " + roll.filter(x => (x.pids || []).indexOf(p.id) >= 0).length : "")); })) : null,
            h("div", { "data-wk": "camhubroll", style: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 } },
              rollShown.map(p => { const on = !!rollSel && rollSel.indexOf(p.imgKey) >= 0;
                return h("div", { key: p.imgKey, "data-wk": "camrollone", "data-on": on ? "1" : "0", onClick: () => rollSel ? setRollSel(on ? rollSel.filter(k => k !== p.imgKey) : rollSel.concat([p.imgKey])) : openRoll(p), style: { position: "relative", flexShrink: 0, width: 72, height: 96, borderRadius: 12, overflow: "hidden", background: "#eee", cursor: "pointer", outline: on ? "2.5px solid #e0457b" : "none", outlineOffset: -2.5 } },
                  typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: p }) : null,
                  rollSel ? h("div", { style: { position: "absolute", right: 5, top: 5, width: 20, height: 20, borderRadius: 10, border: "1.5px solid #fff", background: on ? "#e0457b" : "rgba(0,0,0,.25)", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" } }, on ? "✓" : "") : null); }))) : null),
        h("input", { ref: hubFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; setBg(URL.createObjectURL(f)); setMode("live"); setPanel(""); } }));
    }
    // 拼贴、大头贴：借拼壁纸那个编辑器（collage.js），solo 不对着哪个人；这一趟拍的画的在胶卷里，也能从手机传
    // 旅行（她 2026-11-26）：整页交给 camera-trip.js
    if (mode === "movie" && window.CameraMovie) return h(window.CameraMovie, { characters: chars, meName: props.meName, meAvatar: props.meAvatar, toast: props.toast, onBack: () => switchMode("hub"), onMoviePlan: props.onMoviePlan, onMoviePoster: props.onMoviePoster, onMovieScene: props.onMovieScene, onMoviePremiere: props.onMoviePremiere });
    if (mode === "worlds" && window.CameraWorlds) return h(window.CameraWorlds, { characters: chars, toast: props.toast, onBack: () => switchMode("hub"), onWorldsPlan: props.onWorldsPlan, onWorldCard: props.onWorldCard, onWorldMore: props.onWorldMore });
    if (mode === "trip" && window.CameraTrip) return h(window.CameraTrip, { characters: chars, toast: props.toast, onBack: () => switchMode("hub"), onTripPlan: props.onTripPlan, onTripCard: props.onTripCard, onTripMore: props.onTripMore });
    if (mode === "collage" && window.Collage) return h(window.Collage.CollageMaker, { partner: { id: "camera", name: "拼贴" }, photos: roll, solo: true, startTpl: colTpl, key: colTpl,
      onBack: () => switchMode("hub"),
      onSave: async r => { if (r && r.mine && typeof saveFile === "function") await saveFile(new File([r.mine], "拼贴-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "") + ".jpg", { type: "image/jpeg" })); } });
    if (mode === "gen") {
      // 写真／合照：跟首页同一张粉色底，几块白卡片一块一块往下填，最底下那颗粉橙的「画一张」
      const people2 = people, max = genMulti ? (props.groupMax || 10) : 1;
      const tog = id => setGenIds(l => l.indexOf(id) >= 0 ? l.filter(x => x !== id) : max === 1 ? [id] : l.length >= max ? l : l.concat([id]));
      const INK = "#2b2230", SUB = "#9a8592", PINK = "#ff5f9e";
      const card = (part, title, hint, kid) => h("div", { "data-wk": "camgencard", "data-part": part, style: { background: "#fff", borderRadius: 22, padding: "14px 14px 16px", marginBottom: 12, boxShadow: "0 10px 26px -18px rgba(160,60,110,.55)" } },
        h("div", { style: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 } },
          h("span", { style: { fontSize: FS(14.5), fontWeight: 600, color: INK, letterSpacing: ".04em" } }, title),
          hint ? h("span", { style: { fontSize: FS(11), color: SUB } }, hint) : null), kid);
      const seg = (k, label, sub) => h("button", { key: k, "data-wk": "cambtn", "data-part": "who", "data-on": genWho === k ? "1" : "0", onClick: () => setGenWho(k),
        style: { flex: 1, padding: "10px 8px", borderRadius: 14, border: "1.5px solid " + (genWho === k ? PINK : "#f1e4ea"), background: genWho === k ? "#fff1f6" : "#fff", color: INK, textAlign: "center" } },
        h("div", { style: { fontSize: FS(13.5), fontWeight: genWho === k ? 600 : 500 } }, label), h("div", { style: { fontSize: FS(10.5), color: SUB, marginTop: 2 } }, sub));
      return h("div", { "data-wk": "campage", "data-part": "gen", className: "h-full flex flex-col", style: { background: "linear-gradient(180deg,#ffe3ee 0%,#fff6f9 38%,#fdfbfc 100%)", color: INK } },
        typeof Head === "function" ? h(Head, { zh: genMulti ? "多人合照" : "单人写真", bg: "transparent", onBack: () => switchMode("hub") }) : null,
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 18px" } },
          card("people", max === 1 ? "画谁" : "画面里有谁", max === 1 ? "挑一个" : "可以多选，最多 " + max + " 个",
            h("div", { "data-wk": "camgenpeople", style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: "12px 6px" } },
              people2.map(p => { const on = genIds.indexOf(p.id) >= 0, n = genIds.indexOf(p.id) + 1;
                return h("button", { key: p.id, "data-wk": "camgenone", "data-on": on ? "1" : "0", onClick: () => tog(p.id), style: { position: "relative", border: "none", background: "transparent", color: INK, textAlign: "center", padding: 0 } },
                  h("div", { style: { display: "inline-block", borderRadius: "50%", padding: 3, background: on ? GRAD : "transparent", transition: "all .15s" } },
                    h("div", { style: { borderRadius: "50%", padding: 2, background: "#fff" } }, typeof Avatar === "function" ? h(Avatar, { character: p, size: 48 }) : null)),
                  on && max > 1 ? h("div", { style: { position: "absolute", top: 0, right: 6, minWidth: 18, height: 18, borderRadius: 9, background: PINK, color: "#fff", fontSize: FS(10.5), lineHeight: "18px", fontWeight: 600, boxShadow: "0 0 0 2px #fff" } }, n) : null,
                  h("div", { style: { fontSize: FS(11.5), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: on ? 600 : 400, color: on ? INK : "#6f5d68" } }, p.name)); }))),
          card("who", "谁拿的手机", "",
            h("div", { style: { display: "flex", gap: 10 } }, seg("other", "有人帮忙拍", "看得到全身和周围"), seg("self", "自己举着自拍", "近一点、带点手臂"))),
          card("frame", "拍多少", "",
            h("div", { style: { display: "flex", gap: 8 } }, FRAMES.map(([k, zh]) => h("button", { key: k, "data-wk": "cambtn", "data-part": "frame", "data-on": genFrame === k ? "1" : "0", onClick: () => setGenFrame(k),
              style: { flex: 1, height: 36, borderRadius: 12, border: "1.5px solid " + (genFrame === k ? PINK : "#f1e4ea"), background: genFrame === k ? "#fff1f6" : "#fff", color: INK, fontSize: FS(13), fontWeight: genFrame === k ? 600 : 400 } }, zh)))),
          genIds.some(id => id !== "me") ? card("outfit", "穿什么", "从衣柜挑，或者配一套新的",
            h("div", { style: { marginTop: -10 } }, genIds.map(id => outfitFor(id, genScene, false)))) : null,
          card("scene", "画面", "选填：在哪、在干嘛",
            h("div", null,
              h("textarea", { "data-wk": "camgenscene", value: genScene, onChange: e => setGenScene(e.target.value), rows: genScene.split("\n").length > 2 ? 7 : 3, placeholder: "空着＝随手拍的一张；也可以只写一两个字，再让 AI 先写一版",
                style: { width: "100%", boxSizing: "border-box", borderRadius: 14, border: "1.5px solid #f1e4ea", background: "#fffafc", color: INK, padding: "10px 12px", fontSize: FS(14), lineHeight: 1.6, outline: "none", resize: "none" } }),
              props.onWriteShot ? h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 } },
                h("button", { "data-wk": "cambtn", "data-part": "writeshot", onClick: () => writeShot(false), disabled: !!writing,
                  style: { flexShrink: 0, whiteSpace: "nowrap", height: 36, padding: "0 14px", borderRadius: 18, border: "1.5px solid " + PINK, background: "#fff", color: PINK, fontSize: FS(12.5), fontWeight: 600, opacity: writing ? .6 : 1 } },
                  writing === "gen" ? "在写…" : "让 AI 先写一版"),
                h("span", { style: { fontSize: FS(10.5), color: SUB, lineHeight: 1.5 } }, "照你这句补成姿势、镜头、光、地点、穿着，写好了还能改")) : null)),
          h("div", { style: { fontSize: FS(11), color: SUB, lineHeight: 1.7, padding: "0 4px" } }, "每个人用自己设的参照照锁脸；没设参照照的照设定画。画一张要等半分钟左右，走的是 设置·图像API。")),
        h("div", { style: { flexShrink: 0, padding: "10px 16px 14px", paddingBottom: "calc(14px + " + COMPOSER_PAD_BOTTOM + ")" } },
          h("button", { "data-wk": "camshutter", "data-part": "gen", onClick: runGen, disabled: genBusy,
            style: { width: "100%", height: 54, borderRadius: 27, border: "none", background: GRAD, opacity: genBusy ? .6 : 1, color: "#fff", fontSize: FS(16), fontWeight: 600, letterSpacing: ".12em", boxShadow: "0 14px 28px -14px rgba(255,80,130,.85)" } },
            genBusy ? "在画…" : "画一张" + (genIds.length ? "（" + genIds.length + " 人）" : ""))));
    }

    const stickerEl = st => {
      if (st.style === "cut") { const on = st.id === sel, u = cutUrls[st.k];
        return h("div", { "data-wk": "camsticker", "data-part": "cut", "data-on": on ? "1" : "0", key: st.id,
          onPointerDown: e => onDown(e, st.id), onPointerMove: e => onMove(e, st.id), onPointerUp: onUp, onPointerCancel: onUp,
          style: { position: "absolute", left: st.x * 100 + "%", top: st.y * 100 + "%", width: st.s * 100 + "%", transform: "translate(-50%,-50%) rotate(" + st.r + "deg)", touchAction: "none",
            outline: on ? "1.5px dashed rgba(255,255,255,.9)" : "none", outlineOffset: 4 } },
          u ? h("div", { style: { width: "100%", aspectRatio: st.ar ? "1 / " + (st.ar * (st.crop || 1)) : "auto", overflow: "hidden", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.28))" } },
            h("img", { src: u, draggable: false, onLoad: e => { const t = e.currentTarget, a = t.naturalHeight / t.naturalWidth; if (a && Math.abs(a - (st.ar || 0)) > .01) patch(st.id, { ar: a }); }, style: { display: "block", width: "100%", height: "auto", pointerEvents: "none", transform: st.flip ? "scaleX(-1)" : "none" } })) : null);
      }
      const p = people.find(x => x.id === st.pid) || {}, src = srcOf(p), on = st.id === sel;
      const shape = st.style === "round" ? { borderRadius: "50%", border: "0.06em solid #fff", background: "#fff" } : st.style === "card" ? { border: "0.06em solid #fff", borderBottomWidth: "0.18em", background: "#fff" } : {};
      return h("div", { "data-wk": "camsticker", "data-on": on ? "1" : "0", key: st.id,
        onPointerDown: e => onDown(e, st.id), onPointerMove: e => onMove(e, st.id), onPointerUp: onUp, onPointerCancel: onUp,
        style: { position: "absolute", left: st.x * 100 + "%", top: st.y * 100 + "%", width: st.s * 100 + "%", transform: "translate(-50%,-50%) rotate(" + st.r + "deg)", touchAction: "none",
          outline: on ? "1.5px dashed rgba(255,255,255,.9)" : "none", outlineOffset: 4 } },
        h("div", { style: Object.assign({ fontSize: st.s * 100 + "vw", boxSizing: "border-box", overflow: "hidden", boxShadow: "0 0.03em 0.08em rgba(0,0,0,.28)", aspectRatio: st.style === "plain" ? "auto" : st.style === "card" ? "1 / 1.12" : "1 / 1" }, shape) },
          src ? h("img", { src, draggable: false, onLoad: e => { const t = e.currentTarget, a = t.naturalHeight / t.naturalWidth; if (st.style === "plain" && a && Math.abs(a - (st.ar || 0)) > .01) patch(st.id, { ar: a }); }, style: { display: "block", width: "100%", height: st.style === "plain" ? "auto" : "100%", objectFit: "cover", pointerEvents: "none" } })
            : h("div", { style: { width: "100%", aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center", background: "#ddd", color: "#555", fontSize: ".3em" } }, (p.name || "?").slice(0, 1))));
    };

    // 实景那一页：画面铺满；顶上两颗磨砂圆钮；底下一块磨砂底板——面板（加人／抠图人／滤镜）和快门那一排都在板子上，压在浅色照片上也看得清
    const sheetOn = !!panel;
    const label = t => h("div", { style: { fontSize: FS(11), color: "rgba(255,255,255,.62)", letterSpacing: ".06em", margin: "2px 2px 8px" } }, t);
    // 回看：一起逛时他说过的每一段，按天排，最新的在下面；整页，不是半窗
    if (talkView) {
      const nm = pid => ((people.find(x => x.id === pid) || {}).name) || "TA";
      const day = ts => { const d = new Date(ts); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
      const hm = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
      let lastDay = "";
      return h("div", { "data-wk": "campage", "data-part": "talklog", className: "h-full flex flex-col", style: { background: "linear-gradient(180deg,#ffe3ee 0%,#fff6f9 38%,#fdfbfc 100%)", color: "#2b2230" } },
        typeof Head === "function" ? h(Head, { zh: "一起逛时说过的", bg: "transparent", onBack: () => setTalkView(false) }) : null,
        h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "4px 16px 24px" } },
          talkLog.map((x, i) => { const d0 = day(x.ts), head = d0 !== lastDay; lastDay = d0;
            return h(React.Fragment, { key: i },
              head ? h("div", { style: { textAlign: "center", fontSize: FS(11), color: "#9a8592", margin: "14px 0 8px" } }, d0) : null,
              h("div", { "data-wk": "camtalkrow", style: { display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 } },
                h("div", { style: { flexShrink: 0 } }, typeof Avatar === "function" ? h(Avatar, { character: people.find(p => p.id === x.pid) || { name: nm(x.pid) }, size: 34 }) : null),
                h("div", { style: { flex: 1, minWidth: 0 } },
                  h("div", { style: { fontSize: FS(11), color: "#9a8592", marginBottom: 3 } }, nm(x.pid) + " · " + hm(x.ts)),
                  x.lines.map((l, j) => h("div", { key: j, style: { display: "table", maxWidth: "100%", background: "#fff", borderRadius: 14, padding: "7px 11px", marginBottom: 4, fontSize: FS(13.5), lineHeight: 1.5, boxShadow: "0 4px 12px -8px rgba(160,60,110,.5)" } }, l))))); })),
        h("div", { style: { flexShrink: 0, padding: "8px 16px 14px", paddingBottom: "calc(14px + " + COMPOSER_PAD_BOTTOM + ")", textAlign: "center" } },
          h("button", { "data-wk": "cambtn", "data-part": "talkclear", onClick: () => { const go = () => { setTalkLog([]); try { saveJSON("x_camTalkLog", []); } catch (e) {} setTalkView(false); };
            if (typeof requestAppConfirm === "function") requestAppConfirm("清空说过的话？", "只清这一页的记录，拍下来的照片不受影响", go, "清空"); else go(); }, style: { border: "none", background: "transparent", color: "#9a8592", fontSize: FS(12) } }, "清空记录")));
    }
    return h("div", { "data-wk": "campage", className: "h-full", style: { position: "relative", background: "#000", overflow: "hidden", display: "flex", flexDirection: "column" } },
      // 取景框：整屏都是画面，跟直播间一样是全屏例外，返回键浮在左上、走 safeTop
      h("div", { ref: stageRef, "data-wk": "camstage", onPointerDown: () => setSel(null), style: { position: "absolute", inset: 0, filter: fcss || "none" } },
        bg ? h("img", { src: bg, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } })
          : h("video", { ref: el => { videoRef.current = el; if (el && camRef.current) camRef.current.attach(el); }, autoPlay: true, playsInline: true, muted: true,
            style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none" } }),
        stickers.map(stickerEl)),
      !bg && cs.phase !== "on" ? h("div", { "data-wk": "camhint", style: { position: "absolute", left: 24, right: 24, top: "40%", textAlign: "center", color: "rgba(255,255,255,.85)", fontSize: FS(13.5), lineHeight: 1.7, pointerEvents: "none" } },
        cs.message || "正在打开镜头…", cs.phase === "error" ? h("div", { style: { fontSize: FS(12), opacity: .7, marginTop: 6 } }, "也可以点下面「相册」挑一张照片当背景") : null) : null,
      // 顶上：返回、换前后镜头（或回到镜头）
      h("div", { style: { position: "absolute", left: 0, right: 0, top: 0, paddingTop: safeTop(8), paddingLeft: 12, paddingRight: 12, display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(rgba(0,0,0,.28), transparent)", paddingBottom: 16 } },
        roundBtn(IC.back, () => switchMode("hub"), "back", "返回"),
        h("div", { style: { flex: 1 } }),
        talkLog.length ? h("button", { "data-wk": "cambtn", "data-part": "talklog", onClick: () => setTalkView(true), style: { height: 38, padding: "0 14px", borderRadius: 19, border: "1px solid rgba(255,255,255,.22)", background: "rgba(28,22,30,.42)", color: "#fff", fontSize: FS(12.5), backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" } }, "说过的") : null,
        bg ? roundBtn(IC.flip, backToCam, "tocam", "回到镜头") : roundBtn(IC.flip, () => camRef.current && camRef.current.switch(), "flip", "翻转")),
      // 选中一张贴纸时：一条磨砂小条，换样式、删掉
      // 一起逛那句话：挂在TA头顶，点一下收掉；拍的时候一起画进去
      stickers.filter(st => st.say || talkBusy === st.id).map(st => { const R = stageRef.current && stageRef.current.getBoundingClientRect(), Wp = (R && R.width) || 390, Hp = (R && R.height) || 844;
        return h("div", { key: "say" + st.id, "data-wk": "camsay", onClick: () => talkBusy !== st.id && patch(st.id, { say: "" }),
          style: { position: "absolute", left: Math.max(4, Math.min(96, st.x * 100)) + "%", bottom: (1 - st.y + talkLift(st, Wp, Hp)) * 100 + "%", transform: "translateX(-50%)", marginBottom: 10, maxWidth: "56%", width: "max-content", whiteSpace: "pre-wrap", maxHeight: "40vh", overflowY: "auto",
            background: "rgba(255,255,255,.96)", color: "#2b2230", borderRadius: 14, padding: "7px 11px", fontSize: FS(13), lineHeight: 1.45, boxShadow: "0 6px 14px -6px rgba(0,0,0,.45)", pointerEvents: "auto", filter: fcss || "none" } },
          talkBusy === st.id ? "……" : st.say,
          h("span", { style: { position: "absolute", left: "50%", bottom: -6, marginLeft: -6, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid rgba(255,255,255,.96)" } })); }),
      selSt && !sheetOn ? h("div", { "data-wk": "camtool", style: { position: "absolute", left: 0, right: 0, bottom: "calc(118px + " + COMPOSER_PAD_BOTTOM + ")", display: "flex", justifyContent: "center", padding: "0 12px" } },
        h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", padding: 6, borderRadius: 22, background: "rgba(20,16,22,.5)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } },
          selSt.style === "cut" ? h(React.Fragment, null, btn("左右翻", () => patch(selSt.id, { flip: !selSt.flip }), !!selSt.flip, "flip"),
              btn("半身", () => patch(selSt.id, { crop: selSt.crop && selSt.crop < 1 ? 1 : 0.55 }), !!(selSt.crop && selSt.crop < 1), "halfcrop"),
              selSt.crop && selSt.crop < 1 ? h("label", { "data-wk": "camcrop", style: { display: "flex", alignItems: "center", gap: 6, color: "#fff", fontSize: FS(11.5), padding: "0 6px", width: "100%" } }, "露多少",
                h("input", { type: "range", min: 25, max: 95, step: 1, value: Math.round(selSt.crop * 100), onChange: e => patch(selSt.id, { crop: (+e.target.value) / 100 }), style: { flex: 1, accentColor: "#ff8fa8" } })) : null)
            : STYLES.map(([k, zh]) => h(React.Fragment, { key: k }, btn(zh, () => patch(selSt.id, { style: k }), selSt.style === k, "style"))),
          selSt.pid && selSt.pid !== "me" && props.onLook ? btn(talkBusy === selSt.id ? "在想…" : selSt.say ? "换一句" : "TA说一句", () => talk(selSt), !!selSt.say, "talk") : null,
          btn("删掉", () => { setStickers(l => l.filter(s => s.id !== selSt.id)); setSel(null); }, false, "del"))) : null,
      // 底下：磨砂底板（面板开着时整块托起来），快门那一排
      h("div", { "data-wk": "camsheet", "data-on": sheetOn ? "1" : "0", style: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: COMPOSER_PAD_BOTTOM,
          background: sheetOn ? "rgba(18,14,20,.66)" : "linear-gradient(transparent, rgba(0,0,0,.55))", backdropFilter: sheetOn ? "blur(18px)" : "none", WebkitBackdropFilter: sheetOn ? "blur(18px)" : "none",
          borderRadius: sheetOn ? "24px 24px 0 0" : 0, borderTop: sheetOn ? "1px solid rgba(255,255,255,.1)" : "none" } },
        sheetOn ? h("div", { style: { width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.28)", margin: "8px auto 2px" } }) : null,
        panel === "people" ? h("div", { "data-wk": "campicktab", style: { display: "flex", margin: "8px 16px 4px", padding: 3, borderRadius: 14, background: "rgba(255,255,255,.08)" } },
          [["avatar", "头像贴纸"], ["cut", "抠图人"]].map(([k, zh]) => h("button", { key: k, "data-wk": "cambtn", "data-part": "ptab", "data-on": pTab === k ? "1" : "0", onClick: () => setPTab(k),
            style: { flex: 1, height: 32, borderRadius: 11, border: "none", background: pTab === k ? "#fff" : "transparent", color: pTab === k ? "#2b2230" : "rgba(255,255,255,.75)", fontSize: FS(12.5), fontWeight: pTab === k ? 600 : 500 } }, zh))) : null,
        panel === "people" && pTab === "avatar" ? h("div", { "data-wk": "campick", style: { display: "flex", gap: 14, overflowX: "auto", padding: "10px 16px 4px" } },
          people.map(p => { const on = stickers.some(s => s.pid === p.id); return h("button", { key: p.id, "data-wk": "campickone", "data-on": on ? "1" : "0", onClick: () => togglePerson(p), style: { flexShrink: 0, border: "none", background: "transparent", color: "#fff", textAlign: "center", width: 58, padding: 0 } },
            avatarRing(p, on, 46),
            h("div", { style: { fontSize: FS(11), marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: on ? 1 : .75 } }, p.name)); })) : null,
        panel === "people" && pTab === "cut" ? h("div", { "data-wk": "camcut", style: { padding: "8px 16px 0" } },
          label("给谁抠"),
          h("div", { "data-wk": "camcutwho", style: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 } },
            people.map(p => h("button", { key: p.id, "data-wk": "camcutone", "data-on": cutFor === p.id ? "1" : "0", onClick: () => setCutFor(p.id),
              style: { flexShrink: 0, border: "none", background: "transparent", color: "#fff", textAlign: "center", width: 50, padding: 0, opacity: cutFor === p.id ? 1 : .7 } },
              avatarRing(p, cutFor === p.id, 36),
              h("div", { style: { fontSize: FS(10.5), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)))),
          cuts.length ? label("抠好的 · 点一下放进画面") : null,
          h("div", { "data-wk": "camcutlist", style: { display: "flex", gap: 10, overflowX: "auto", padding: "2px 2px 10px" } },
            cuts.map(x => h("div", { key: x.k, "data-wk": "camcutthumb", style: { position: "relative", flexShrink: 0, width: 66, height: 88, borderRadius: 14,
                background: "repeating-conic-gradient(rgba(255,255,255,.1) 0 25%, rgba(255,255,255,.04) 0 50%) 0 0/12px 12px", border: "1px solid rgba(255,255,255,.14)" } },
              h("button", { onClick: () => addCut(cutFor, x.k), style: { width: "100%", height: "100%", border: "none", background: "transparent", padding: 5 } },
                cutUrls[x.k] ? h("img", { src: cutUrls[x.k], style: { width: "100%", height: "100%", objectFit: "contain" } }) : null),
              h("button", { "data-wk": "camcutdel", "aria-label": "不要这张", onClick: () => { cutDrop(cutFor, x.k); setCutRev(n => n + 1); },
                style: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, border: "1.5px solid rgba(20,16,22,.9)", background: "#fff", color: "#2b2230", fontSize: FS(12), lineHeight: "18px", padding: 0 } }, "×")))),
          h("div", { style: { display: "flex", gap: 6, marginBottom: 2 } }, [["full", "全身"], ["half", "半身"], ["bust", "到胸"]].map(([k, zh]) => h(React.Fragment, { key: k }, btn(zh, () => setCutFrame(k), cutFrame === k, "cutframe")))),
          outfitFor(cutFor, cutPose, true),
          h("div", { style: { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8, marginTop: 10 } },
            h("textarea", { "data-wk": "camcutpose", value: cutPose, onChange: e => setCutPose(e.target.value), placeholder: "姿势（选填，写一两个字也行）", rows: cutPose.split("\n").length > 1 ? 4 : 1,
              style: { flex: 1, minWidth: 0, minHeight: 38, borderRadius: 19, border: "1px solid rgba(255,255,255,.2)", background: "rgba(255,255,255,.08)", color: "#fff", padding: "9px 14px", fontSize: FS(13), lineHeight: 1.5, outline: "none", resize: "none", boxSizing: "border-box" } }),
            props.onWriteShot ? h("button", { "data-wk": "cambtn", "data-part": "cutwrite", onClick: () => writeShot(true), disabled: !!writing,
              style: { flexShrink: 0, height: 38, padding: "0 12px", borderRadius: 19, border: "1px solid #ff8fb8", background: "transparent", color: "#ffb3cf", fontSize: FS(12.5), opacity: writing ? .6 : 1 } }, writing === "cut" ? "在写…" : "写一版") : null),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            h("button", { "data-wk": "cambtn", "data-part": "cutgen", onClick: genCut, style: { flex: 1, height: 38, padding: "0 14px", borderRadius: 19, border: "none", background: GRAD, color: "#fff", fontSize: FS(12.5), fontWeight: 600, opacity: cutBusy ? .6 : 1 } }, cutBusy === "gen" ? "在画…" : "现生一张"),
            h("button", { "data-wk": "cambtn", "data-part": "cutphoto", onClick: () => !cutBusy && cutFileRef.current && cutFileRef.current.click(), style: { flex: 1, height: 38, padding: "0 14px", borderRadius: 19, border: "1px solid rgba(255,255,255,.3)", background: "rgba(255,255,255,.1)", color: "#fff", fontSize: FS(12.5), opacity: cutBusy ? .6 : 1 } }, cutBusy === "seg" ? "在抠…" : "从照片抠")),
          h("div", { style: { fontSize: FS(10.5), color: "rgba(255,255,255,.5)", padding: "8px 2px 0", lineHeight: 1.6 } },
            cutBusy === "seg" ? "第一次抠要先下载抠图工具（三十兆左右），稍等" : "现生：锁脸照上面选的全身／半身和衣服画一张再去底（用图像API）；从照片抠：手机上就地抠，不花额度")) : null,
        panel === "filter" ? h("div", { "data-wk": "camfilter", style: { display: "flex", gap: 8, overflowX: "auto", padding: "12px 16px 4px" } },
          FILTERS.map(f => h(React.Fragment, { key: f.id }, btn(f.zh, () => setFilter(f.id), filter === f.id, "filter")))) : null,
        panel === "filter" ? h("div", { "data-wk": "camadjust", style: { padding: "6px 18px 2px" } },
          ADJ.map(([k, zh]) => h("label", { key: k, style: { display: "flex", alignItems: "center", gap: 10, height: 30, color: "#fff", fontSize: FS(11.5) } },
            h("span", { style: { width: 30, flexShrink: 0, opacity: .8 } }, zh),
            h("input", { type: "range", min: k === "fade" ? 0 : -100, max: 100, step: 1, value: adj[k], "data-part": "adj-" + k, onChange: e => { const v = +e.target.value; setAdj(a => Object.assign({}, a, { [k]: v })); }, style: { flex: 1, accentColor: "#ff8fa8" } }),
            h("span", { style: { width: 28, textAlign: "right", opacity: .6, fontVariantNumeric: "tabular-nums" } }, adj[k] > 0 ? "+" + adj[k] : String(adj[k])))),
          h("div", { style: { display: "flex", justifyContent: "flex-start", paddingTop: 2 } }, btn("复原", () => setAdj(ADJ0), false, "adjreset"))) : null,
        h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-around", padding: "12px 10px 12px" } },
          ctl("相册", IC.album, () => fileRef.current && fileRef.current.click(), !!bg, "album"),
          ctl("加人", IC.people, () => setPanel(panel === "people" ? "" : "people"), panel === "people", "people"),
          h("button", { "data-wk": "camshutter", onClick: capture, disabled: busy, "aria-label": "拍照", style: { width: 74, height: 74, borderRadius: 37, border: "none", padding: 0, background: "rgba(255,255,255,.28)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } },
            h("span", { style: { width: 60, height: 60, borderRadius: 30, background: busy ? "rgba(255,255,255,.6)" : "#fff", boxShadow: "0 0 0 3px rgba(0,0,0,.08) inset", transition: "transform .1s", transform: busy ? "scale(.9)" : "none" } })),
          ctl("滤镜", IC.filter, () => setPanel(panel === "filter" ? "" : "filter"), panel === "filter" || fcss !== "", "filtertab"),
          ctl("清空", IC.clear, () => { setStickers([]); setSel(null); }, false, "clear", !stickers.length))),
      h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: pickBg }),
      h("input", { ref: cutFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: pickCut }));
  }
  window.CameraApp = CameraApp;
  window.CameraKit = { FILTERS, pixelFilter, drawSticker, keyGreen, segmentPerson };
})();
