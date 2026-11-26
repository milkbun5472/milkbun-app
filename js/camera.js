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
      const ar2 = im ? im.naturalHeight / im.naturalWidth || 1 : 1, ih2 = size * ar2;
      if (st.flip) ctx.scale(-1, 1);
      if (im) ctx.drawImage(im, -size / 2, -ih2 / 2, size, ih2);
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
    const [panel, setPanel] = useState("");       // "people" | "filter" | ""
    const [shot, setShot] = useState(null);       // {url, blob}
    const [busy, setBusy] = useState(false);
    // 模式转盘（真相机快门上面那一排「照片·人像·视频」）：实景＝镜头叠人；生图＝挑人写一句画面，让生图画一张
    const [mode, setMode] = useState("hub");   // hub＝首页那几块入口（她 2026-11-26「像美图秀秀那样分开」）
    const [colTpl, setColTpl] = useState("booth");
    const hubFileRef = useRef(null);
    const [genIds, setGenIds] = useState([]);
    const [genWho, setGenWho] = useState("other");
    const [genScene, setGenScene] = useState("");
    const [genBusy, setGenBusy] = useState(false);
    const [genMulti, setGenMulti] = useState(true);   // 首页点的是「单人写真」还是「多人合照」
    // 这一趟拍的、画的都排进胶卷：拼贴那边直接从这里挑（存进图库，拼贴读图走 imgKey）
    const [roll, setRoll] = useState([]);
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
    const genCut = async () => {
      if (cutBusy || !props.onGenCutout) return;
      setCutBusy("gen");
      try { const raw = await props.onGenCutout(cutFor, cutPose); const png = await keyGreen(raw); const k = await cutSave(cutFor, png, "gen"); setCutRev(n => n + 1); addCut(cutFor, k); }
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
    const toRoll = async (blob, desc) => { try { if (typeof idbImgPut !== "function") return; const k = "img_camroll_" + Date.now().toString(36); await idbImgPut(k, blob); setRoll(l => [{ imgKey: k, ts: Date.now(), desc }].concat(l)); } catch (e) {} };
    const camRef = useRef(null), videoRef = useRef(null), stageRef = useRef(null), fileRef = useRef(null), touches = useRef({});
    useEffect(() => {
      const cam = window.CallCamera.create(setCs, window, { width: 1920, height: 1080 });
      camRef.current = cam;   // 进了「拍照」才开镜头，首页不占摄像头
      if (videoRef.current) cam.attach(videoRef.current);
      return () => cam.dispose();
    }, []);
    useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
    const fcss = (FILTERS.find(f => f.id === filter) || FILTERS[0]).css;
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
      try { const blob = await props.onGen(genIds, genScene, genWho); setShot({ url: URL.createObjectURL(blob), blob, gen: true }); toRoll(blob, "画的"); }
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

    const capture = async () => {
      if (busy) return; setBusy(true);
      try {
        const R = rect(), W0 = R.width, H0 = R.height;
        let src = null, sw = 0, sh = 0;
        if (bg) { src = await loadImg(bg); sw = src && src.naturalWidth; sh = src && src.naturalHeight; }
        else { const v = videoRef.current; if (v && v.readyState >= 2) { src = v; sw = v.videoWidth; sh = v.videoHeight; } }
        if (!src || !sw || !sh) throw new Error(bg ? "这张图没读出来" : "镜头还没出画面，等一下再按");
        // 跟预览一样按 cover 裁：取景框里看到哪一块，存下来就是哪一块
        const sc = Math.max(W0 / sw, H0 / sh), cw = W0 / sc, ch = H0 / sc, cx = (sw - cw) / 2, cy = (sh - ch) / 2;
        const out = Math.min(1440, Math.round(cw)), W = Math.max(1, out), H = Math.max(1, Math.round(out * H0 / W0));
        const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d");
        if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        ctx.drawImage(src, cx, cy, cw, ch, 0, 0, W, H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (const st of stickers) { const p = people.find(x => x.id === st.pid);
          if (st.style === "cut") { ctx.save(); ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = st.s * W * 0.04; ctx.shadowOffsetY = st.s * W * 0.02; drawSticker(ctx, await loadImg(cutUrls[st.k]), st, W, H); ctx.restore(); }
          else drawSticker(ctx, await loadImg(srcOf(p)), st, W, H, p && p.name); }
        if (fcss) {
          if (canCtxFilter(ctx)) { const c2 = document.createElement("canvas"); c2.width = W; c2.height = H; const x2 = c2.getContext("2d"); x2.filter = fcss; x2.drawImage(cv, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(c2, 0, 0); }
          else pixelFilter(ctx, W, H, fcss);
        }
        const blob = await new Promise((res, rej) => { try { cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/jpeg", 0.92); } catch (x) { rej(x); } });
        setShot({ url: URL.createObjectURL(blob), blob }); setSel(null); toRoll(blob, "拍的");
      } catch (e) {
        const m = e && e.name === "SecurityError" ? "有张头像是网上的图，浏览器不让画进照片；换成本地上传的头像再拍" : String(e && e.message || e);
        props.toast && props.toast(m);
      } finally { setBusy(false); }
    };
    const save = () => { if (!shot) return; const f = new File([shot.blob], "相机-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "") + ".jpg", { type: "image/jpeg" });
      if (typeof saveFile === "function") saveFile(f); };

    const btn = (label, onClick, on, part) => h("button", { "data-wk": "cambtn", "data-part": part || "", "data-on": on ? "1" : "0", onClick,
      style: { flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: "none", background: on ? "#fff" : "rgba(255,255,255,.16)", color: on ? "#111" : "#fff", fontSize: FS(12.5), backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" } }, label);
    const selSt = stickers.find(s => s.id === sel);

    if (shot) return h("div", { "data-wk": "campage", "data-part": "result", className: "h-full", style: { position: "relative", background: "#000", display: "flex", flexDirection: "column" } },
      h("div", { style: { flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: safeTop(8) } },
        h("img", { "data-wk": "camresult", src: shot.url, style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" } })),
      h("div", { style: { display: "flex", gap: 10, justifyContent: "center", padding: "14px 16px", paddingBottom: "calc(14px + " + COMPOSER_PAD_BOTTOM + ")" } },
        shot.gen ? btn(genBusy ? "在画…" : "再画一张", () => { if (!genBusy) { setShot(null); runGen(); } }, false, "regen") : btn("重拍", () => setShot(null), false, "retake"),
        shot.gen ? btn("加滤镜·贴人", genToEdit, false, "edit") : null,
        shot.gen ? btn("返回", () => setShot(null), false, "retake") : null,
        btn("存到手机", save, true, "save")));
    // ── 首页：像修图 app 的首屏，一块大的「拍照」，底下几格各进各的 ──
    if (mode === "hub") {
      const ico = (d, c) => h("svg", { viewBox: "0 0 24 24", width: 26, height: 26, fill: "none", stroke: c || "#fff", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" }, d.map((x, i) => h("path", { key: i, d: x })));
      const I = {
        cam: ["M4 8h3l1.6-2.2h6.8L17 8h3v11H4z", "M12 9.7a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2z"],
        edit: ["M4 20h4L19 9l-4-4L4 16z", "M13.5 6.5l4 4"],
        gen: ["M12 3l1.8 4.6L18.5 9l-4.7 1.6L12 15l-1.8-4.4L5.5 9l4.7-1.4z", "M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"],
        duo: ["M8.5 11a3 3 0 100-6 3 3 0 000 6z", "M15.5 11a3 3 0 100-6 3 3 0 000 6z", "M3 20c.5-3.5 2.8-5.5 5.5-5.5S13.5 16.5 14 20", "M10 20c.5-3.5 2.8-5.5 5.5-5.5S20.5 16.5 21 20"],
        grid: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
        booth: ["M8 3h8v18H8z", "M8 7.5h8", "M8 12h8", "M8 16.5h8"]
      };
      const tile = (part, title, sub, grad, icon, onClick, wide) => h("button", { key: part, "data-wk": "camhubtile", "data-part": part, onClick, className: "active:opacity-80",
        style: { gridColumn: wide ? "1 / -1" : "auto", position: "relative", overflow: "hidden", border: "none", borderRadius: 20, padding: "14px 14px 13px", textAlign: "left", color: "#fff", background: grad, boxShadow: "0 8px 20px -12px rgba(120,40,80,.55)", minHeight: 108, display: "flex", flexDirection: "column", justifyContent: "space-between" } },
        h("div", { style: { width: 42, height: 42, borderRadius: 14, background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center" } }, ico(icon)),
        h("div", null, h("div", { style: { fontSize: FS(15.5), fontWeight: 600, letterSpacing: ".04em" } }, title), h("div", { style: { fontSize: FS(11), opacity: .85, marginTop: 2 } }, sub)));
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
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 } },
            tile("edit", "修图", "挑一张照片，加滤镜、贴人", "linear-gradient(135deg,#8f7bff,#c08bff)", I.edit, () => hubFileRef.current && hubFileRef.current.click()),
            tile("gen1", "单人写真", "挑一个人，画一张", "linear-gradient(135deg,#ff7eb3,#ffa3c4)", I.gen, () => goGen("other", false)),
            tile("genN", "多人合照", "挑几个人，画在一起", "linear-gradient(135deg,#46c6c0,#7fd9a8)", I.duo, () => goGen("other", true)),
            tile("collage", "拼图", "宫格、拍立得、剪贴本", "linear-gradient(135deg,#ffb259,#ffd27a)", I.grid, () => { setColTpl("grid4"); switchMode("collage"); }),
            tile("booth", "大头贴", "一条四格，印上日期", "linear-gradient(135deg,#5aa2ff,#8fc1ff)", I.booth, () => { setColTpl("booth"); switchMode("collage"); }, true)),
          roll.length ? h("div", { style: { marginTop: 20 } },
            h("div", { style: { fontSize: FS(13), fontWeight: 600, marginBottom: 8 } }, "刚才拍的"),
            h("div", { "data-wk": "camhubroll", style: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 } },
              roll.map(p => h("div", { key: p.imgKey, style: { flexShrink: 0, width: 72, height: 96, borderRadius: 12, overflow: "hidden", background: "#eee" } }, typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: p }) : null)))) : null),
        h("input", { ref: hubFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; setBg(URL.createObjectURL(f)); setMode("live"); setPanel(""); } }));
    }
    // 拼贴、大头贴：借拼壁纸那个编辑器（collage.js），solo 不对着哪个人；这一趟拍的画的在胶卷里，也能从手机传
    if (mode === "collage" && window.Collage) return h(window.Collage.CollageMaker, { partner: { id: "camera", name: "拼贴" }, photos: roll, solo: true, startTpl: colTpl, key: colTpl,
      onBack: () => switchMode("hub"),
      onSave: async r => { if (r && r.mine && typeof saveFile === "function") await saveFile(new File([r.mine], "拼贴-" + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "") + ".jpg", { type: "image/jpeg" })); } });
    if (mode === "gen") {
      const people2 = people, max = genMulti ? (props.groupMax || 10) : 1;
      const tog = id => setGenIds(l => l.indexOf(id) >= 0 ? l.filter(x => x !== id) : max === 1 ? [id] : l.length >= max ? l : l.concat([id]));
      return h("div", { "data-wk": "campage", "data-part": "gen", className: "h-full", style: { position: "relative", background: "#111", color: "#fff", display: "flex", flexDirection: "column" } },
        h("div", { style: { paddingTop: safeTop(8), paddingLeft: 12, paddingRight: 12, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 } },
          h("button", { "data-wk": "cambtn", "data-part": "back", onClick: () => switchMode("hub"), style: { width: 36, height: 36, borderRadius: 18, border: "none", background: "rgba(255,255,255,.12)", color: "#fff", fontSize: FS(18) } }, "‹"),
          h("div", { style: { flex: 1, textAlign: "center", fontSize: FS(14), letterSpacing: ".1em", opacity: .85 } }, genMulti ? "多人合照" : "单人写真"), h("div", { style: { width: 36 } })),
        h("div", { style: { flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 16px" } },
          h("div", { style: { fontSize: FS(12), opacity: .6, marginBottom: 8 } }, max === 1 ? "画谁（挑一个）" : "画面里有谁（可以多选，最多 " + max + " 个）"),
          h("div", { "data-wk": "camgenpeople", style: { display: "flex", flexWrap: "wrap", gap: 10 } },
            people2.map(p => { const on = genIds.indexOf(p.id) >= 0, n = genIds.indexOf(p.id) + 1;
              return h("button", { key: p.id, "data-wk": "camgenone", "data-on": on ? "1" : "0", onClick: () => tog(p.id), style: { position: "relative", width: 64, border: "none", background: "transparent", color: "#fff", textAlign: "center", opacity: on ? 1 : .62 } },
                h("div", { style: { display: "inline-block", borderRadius: "50%", boxShadow: on ? "0 0 0 2.5px #ffd54a" : "none" } }, typeof Avatar === "function" ? h(Avatar, { character: p, size: 48 }) : null),
                on ? h("div", { style: { position: "absolute", top: -2, right: 4, minWidth: 18, height: 18, borderRadius: 9, background: "#ffd54a", color: "#111", fontSize: FS(11), lineHeight: "18px", fontWeight: 600 } }, n) : null,
                h("div", { style: { fontSize: FS(11), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)); })),
          h("div", { style: { fontSize: FS(12), opacity: .6, margin: "18px 0 8px" } }, "谁拿的手机"),
          h("div", { style: { display: "flex", gap: 8 } }, btn("有人帮忙拍", () => setGenWho("other"), genWho === "other", "who"), btn("自己举着自拍", () => setGenWho("self"), genWho === "self", "who")),
          h("div", { style: { fontSize: FS(12), opacity: .6, margin: "18px 0 8px" } }, "画面（选填：在哪、在干嘛、穿什么）"),
          h("textarea", { "data-wk": "camgenscene", value: genScene, onChange: e => setGenScene(e.target.value), rows: 3, placeholder: "空着＝随手拍的一张",
            style: { width: "100%", boxSizing: "border-box", borderRadius: 10, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.06)", color: "#fff", padding: "10px 12px", fontSize: FS(14), lineHeight: 1.6, outline: "none", resize: "none" } }),
          h("div", { style: { fontSize: FS(11.5), opacity: .5, marginTop: 8, lineHeight: 1.7 } }, "每个人用自己设的参照照锁脸；没设参照照的照设定画。画一张要等半分钟左右，走的是 设置·图像API。")),
        h("div", { style: { flexShrink: 0, paddingBottom: COMPOSER_PAD_BOTTOM } },
          h("div", { style: { display: "flex", justifyContent: "center", padding: "8px 16px 14px" } },
            h("button", { "data-wk": "camshutter", "data-part": "gen", onClick: runGen, disabled: genBusy, style: { minWidth: 160, height: 52, borderRadius: 26, border: "none", background: genBusy ? "rgba(255,213,74,.5)" : "#ffd54a", color: "#111", fontSize: FS(15), fontWeight: 600 } },
              genBusy ? "在画…" : "画一张" + (genIds.length ? "（" + genIds.length + " 人）" : "")))));
    }

    const stickerEl = st => {
      if (st.style === "cut") { const on = st.id === sel, u = cutUrls[st.k];
        return h("div", { "data-wk": "camsticker", "data-part": "cut", "data-on": on ? "1" : "0", key: st.id,
          onPointerDown: e => onDown(e, st.id), onPointerMove: e => onMove(e, st.id), onPointerUp: onUp, onPointerCancel: onUp,
          style: { position: "absolute", left: st.x * 100 + "%", top: st.y * 100 + "%", width: st.s * 100 + "%", transform: "translate(-50%,-50%) rotate(" + st.r + "deg)", touchAction: "none",
            outline: on ? "1.5px dashed rgba(255,255,255,.9)" : "none", outlineOffset: 4 } },
          u ? h("img", { src: u, draggable: false, style: { display: "block", width: "100%", height: "auto", pointerEvents: "none", transform: st.flip ? "scaleX(-1)" : "none", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.28))" } }) : null);
      }
      const p = people.find(x => x.id === st.pid) || {}, src = srcOf(p), on = st.id === sel;
      const shape = st.style === "round" ? { borderRadius: "50%", border: "0.06em solid #fff", background: "#fff" } : st.style === "card" ? { border: "0.06em solid #fff", borderBottomWidth: "0.18em", background: "#fff" } : {};
      return h("div", { "data-wk": "camsticker", "data-on": on ? "1" : "0", key: st.id,
        onPointerDown: e => onDown(e, st.id), onPointerMove: e => onMove(e, st.id), onPointerUp: onUp, onPointerCancel: onUp,
        style: { position: "absolute", left: st.x * 100 + "%", top: st.y * 100 + "%", width: st.s * 100 + "%", transform: "translate(-50%,-50%) rotate(" + st.r + "deg)", touchAction: "none",
          outline: on ? "1.5px dashed rgba(255,255,255,.9)" : "none", outlineOffset: 4 } },
        h("div", { style: Object.assign({ fontSize: st.s * 100 + "vw", boxSizing: "border-box", overflow: "hidden", boxShadow: "0 0.03em 0.08em rgba(0,0,0,.28)", aspectRatio: st.style === "plain" ? "auto" : st.style === "card" ? "1 / 1.12" : "1 / 1" }, shape) },
          src ? h("img", { src, draggable: false, style: { display: "block", width: "100%", height: st.style === "plain" ? "auto" : "100%", objectFit: "cover", pointerEvents: "none" } })
            : h("div", { style: { width: "100%", aspectRatio: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center", background: "#ddd", color: "#555", fontSize: ".3em" } }, (p.name || "?").slice(0, 1))));
    };

    return h("div", { "data-wk": "campage", className: "h-full", style: { position: "relative", background: "#000", overflow: "hidden", display: "flex", flexDirection: "column" } },
      // 取景框：整屏都是画面，跟直播间一样是全屏例外，返回键浮在左上、走 safeTop
      h("div", { ref: stageRef, "data-wk": "camstage", onPointerDown: () => setSel(null), style: { position: "absolute", inset: 0, filter: fcss || "none" } },
        bg ? h("img", { src: bg, style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } })
          : h("video", { ref: el => { videoRef.current = el; if (el && camRef.current) camRef.current.attach(el); }, autoPlay: true, playsInline: true, muted: true,
            style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: mirror ? "scaleX(-1)" : "none" } }),
        stickers.map(stickerEl)),
      !bg && cs.phase !== "on" ? h("div", { "data-wk": "camhint", style: { position: "absolute", left: 24, right: 24, top: "40%", textAlign: "center", color: "rgba(255,255,255,.85)", fontSize: FS(13.5), lineHeight: 1.7, pointerEvents: "none" } },
        cs.message || "正在打开镜头…", cs.phase === "error" ? h("div", { style: { fontSize: FS(12), opacity: .7, marginTop: 6 } }, "也可以点下面「相册」挑一张照片当背景") : null) : null,
      // 顶上：返回、换前后镜头
      h("div", { style: { position: "absolute", left: 0, right: 0, top: 0, paddingTop: safeTop(8), paddingLeft: 12, paddingRight: 12, display: "flex", alignItems: "center", gap: 8 } },
        h("button", { "data-wk": "cambtn", "data-part": "back", onClick: () => switchMode("hub"), style: { width: 36, height: 36, borderRadius: 18, border: "none", background: "rgba(0,0,0,.35)", color: "#fff", fontSize: FS(18) } }, "‹"),
        h("div", { style: { flex: 1 } }),
        bg ? btn("回到镜头", backToCam, false, "tocam") : btn("翻转", () => camRef.current && camRef.current.switch(), false, "flip")),
      // 选中一张贴纸时：换样式、删掉
      selSt ? h("div", { "data-wk": "camtool", style: { position: "absolute", left: 0, right: 0, bottom: "calc(150px + " + COMPOSER_PAD_BOTTOM + ")", display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", padding: "0 12px" } },
        selSt.style === "cut" ? btn("左右翻", () => patch(selSt.id, { flip: !selSt.flip }), !!selSt.flip, "flip")
          : STYLES.map(([k, zh]) => h(React.Fragment, { key: k }, btn(zh, () => patch(selSt.id, { style: k }), selSt.style === k, "style"))),
        btn("删掉", () => { setStickers(l => l.filter(s => s.id !== selSt.id)); setSel(null); }, false, "del")) : null,
      // 底下：挑人 / 滤镜面板 + 快门那一排
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: COMPOSER_PAD_BOTTOM, background: "linear-gradient(transparent, rgba(0,0,0,.55))" } },
        panel === "people" ? h("div", { "data-wk": "campicktab", style: { display: "flex", gap: 6, padding: "8px 16px 0" } },
          btn("头像", () => setPTab("avatar"), pTab === "avatar", "ptab"), btn("抠图人", () => setPTab("cut"), pTab === "cut", "ptab")) : null,
        panel === "people" && pTab === "avatar" ? h("div", { "data-wk": "campick", style: { display: "flex", gap: 12, overflowX: "auto", padding: "10px 16px" } },
          people.map(p => { const on = stickers.some(s => s.pid === p.id); return h("button", { key: p.id, "data-wk": "campickone", "data-on": on ? "1" : "0", onClick: () => togglePerson(p), style: { flexShrink: 0, border: "none", background: "transparent", color: "#fff", width: 58, textAlign: "center", opacity: on ? 1 : .7 } },
            h("div", { style: { display: "inline-block", borderRadius: "50%", boxShadow: on ? "0 0 0 2.5px #ffd54a" : "none" } }, typeof Avatar === "function" ? h(Avatar, { character: p, size: 48 }) : null),
            h("div", { style: { fontSize: FS(11), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)); })) : null,
        panel === "people" && pTab === "cut" ? h("div", { "data-wk": "camcut", style: { padding: "8px 16px 0" } },
          h("div", { "data-wk": "camcutwho", style: { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 } },
            people.map(p => h("button", { key: p.id, "data-wk": "camcutone", "data-on": cutFor === p.id ? "1" : "0", onClick: () => setCutFor(p.id),
              style: { flexShrink: 0, border: "none", background: "transparent", color: "#fff", textAlign: "center", width: 52, opacity: cutFor === p.id ? 1 : 0.6 } },
              h("div", { style: { display: "inline-block", borderRadius: "50%", boxShadow: cutFor === p.id ? "0 0 0 2.5px #ffd54a" : "none" } }, typeof Avatar === "function" ? h(Avatar, { character: p, size: 36 }) : null),
              h("div", { style: { fontSize: FS(10.5), marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)))),
          h("div", { "data-wk": "camcutlist", style: { display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 8px", minHeight: cuts.length ? 84 : 0 } },
            cuts.map(x => h("div", { key: x.k, "data-wk": "camcutthumb", style: { position: "relative", flexShrink: 0, width: 62, height: 84, borderRadius: 10, background: "rgba(255,255,255,.12)" } },
              h("button", { onClick: () => addCut(cutFor, x.k), style: { width: "100%", height: "100%", border: "none", background: "transparent", padding: 4 } },
                cutUrls[x.k] ? h("img", { src: cutUrls[x.k], style: { width: "100%", height: "100%", objectFit: "contain" } }) : null),
              h("button", { "data-wk": "camcutdel", "aria-label": "不要这张", onClick: () => { cutDrop(cutFor, x.k); setCutRev(n => n + 1); },
                style: { position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10, border: "none", background: "rgba(0,0,0,.6)", color: "#fff", fontSize: FS(11), lineHeight: "20px" } }, "×")))),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            h("input", { "data-wk": "camcutpose", value: cutPose, onChange: e => setCutPose(e.target.value), placeholder: "姿势（选填）",
              style: { flex: 1, minWidth: 0, height: 34, borderRadius: 17, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.1)", color: "#fff", padding: "0 12px", fontSize: FS(13), outline: "none" } }),
            btn(cutBusy === "gen" ? "在画…" : "现生一张", genCut, false, "cutgen"),
            btn(cutBusy === "seg" ? "在抠…" : "从照片抠", () => !cutBusy && cutFileRef.current && cutFileRef.current.click(), false, "cutphoto")),
          h("div", { style: { fontSize: FS(10.5), opacity: .6, color: "#fff", padding: "6px 2px 0", lineHeight: 1.6 } },
            cutBusy === "seg" ? "第一次抠要先下载抠图工具（三十兆左右），稍等" : "现生：锁脸画一张全身再去底（用图像API）；从照片抠：手机上就地抠，不花额度")) : null,
        panel === "filter" ? h("div", { "data-wk": "camfilter", style: { display: "flex", gap: 8, overflowX: "auto", padding: "10px 16px" } },
          FILTERS.map(f => h(React.Fragment, { key: f.id }, btn(f.zh, () => setFilter(f.id), filter === f.id, "filter")))) : null,
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 16px 14px" } },
          btn("相册", () => fileRef.current && fileRef.current.click(), !!bg, "album"),
          btn("加人", () => setPanel(panel === "people" ? "" : "people"), panel === "people", "people"),
          h("button", { "data-wk": "camshutter", onClick: capture, disabled: busy, "aria-label": "拍照", style: { width: 68, height: 68, borderRadius: 34, border: "4px solid #fff", background: busy ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.92)", boxShadow: "0 0 0 3px rgba(0,0,0,.25)" } }),
          btn("滤镜", () => setPanel(panel === "filter" ? "" : "filter"), panel === "filter" || filter !== "none", "filtertab"),
          btn(stickers.length ? "清空" : "　", () => { setStickers([]); setSel(null); }, false, "clear"))),
      h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: pickBg }),
      h("input", { ref: cutFileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: pickCut }));
  }
  window.CameraApp = CameraApp;
  window.CameraKit = { FILTERS, pixelFilter, drawSticker, keyGreen, segmentPerson };
})();
