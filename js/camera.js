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

  // 贴纸怎么画：预览（DOM）和导出（画布）各照这一份尺寸比例来，边框＝宽的 6%
  function drawSticker(ctx, im, st, W, H, label) {
    const size = st.s * W, cx = st.x * W, cy = st.y * H;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(st.r * Math.PI / 180);
    ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = size * 0.08; ctx.shadowOffsetY = size * 0.03;
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
    const camRef = useRef(null), videoRef = useRef(null), stageRef = useRef(null), fileRef = useRef(null), touches = useRef({});
    useEffect(() => {
      const cam = window.CallCamera.create(setCs, window, { width: 1920, height: 1080 });
      camRef.current = cam; cam.open("environment");
      if (videoRef.current) cam.attach(videoRef.current);
      return () => cam.dispose();
    }, []);
    useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
    const fcss = (FILTERS.find(f => f.id === filter) || FILTERS[0]).css;
    const mirror = !bg && cs.facing === "user";

    const addPerson = p => {
      const st = { id: "s" + Date.now() + Math.random().toString(36).slice(2, 5), pid: p.id, x: 0.5 + (stickers.length % 3 - 1) * 0.18, y: 0.55, s: 0.32, r: 0, style: "round" };
      setStickers(l => l.concat([st])); setSel(st.id); setPanel("");
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
        for (const st of stickers) { const p = people.find(x => x.id === st.pid); drawSticker(ctx, await loadImg(srcOf(p)), st, W, H, p && p.name); }
        if (fcss) {
          if (canCtxFilter(ctx)) { const c2 = document.createElement("canvas"); c2.width = W; c2.height = H; const x2 = c2.getContext("2d"); x2.filter = fcss; x2.drawImage(cv, 0, 0); ctx.clearRect(0, 0, W, H); ctx.drawImage(c2, 0, 0); }
          else pixelFilter(ctx, W, H, fcss);
        }
        const blob = await new Promise((res, rej) => { try { cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/jpeg", 0.92); } catch (x) { rej(x); } });
        setShot({ url: URL.createObjectURL(blob), blob }); setSel(null);
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
        btn("重拍", () => setShot(null), false, "retake"), btn("存到手机", save, true, "save")));

    const stickerEl = st => {
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
        h("button", { "data-wk": "cambtn", "data-part": "back", onClick: props.onBack, style: { width: 36, height: 36, borderRadius: 18, border: "none", background: "rgba(0,0,0,.35)", color: "#fff", fontSize: FS(18) } }, "‹"),
        h("div", { style: { flex: 1 } }),
        bg ? btn("回到镜头", backToCam, false, "tocam") : btn("翻转", () => camRef.current && camRef.current.switch(), false, "flip")),
      // 选中一张贴纸时：换样式、删掉
      selSt ? h("div", { "data-wk": "camtool", style: { position: "absolute", left: 0, right: 0, bottom: "calc(150px + " + COMPOSER_PAD_BOTTOM + ")", display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap", padding: "0 12px" } },
        STYLES.map(([k, zh]) => h(React.Fragment, { key: k }, btn(zh, () => patch(selSt.id, { style: k }), selSt.style === k, "style"))),
        btn("删掉", () => { setStickers(l => l.filter(s => s.id !== selSt.id)); setSel(null); }, false, "del")) : null,
      // 底下：挑人 / 滤镜面板 + 快门那一排
      h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 0, paddingBottom: COMPOSER_PAD_BOTTOM, background: "linear-gradient(transparent, rgba(0,0,0,.55))" } },
        panel === "people" ? h("div", { "data-wk": "campick", style: { display: "flex", gap: 12, overflowX: "auto", padding: "10px 16px" } },
          people.map(p => h("button", { key: p.id, "data-wk": "campickone", onClick: () => addPerson(p), style: { flexShrink: 0, border: "none", background: "transparent", color: "#fff", width: 58, textAlign: "center" } },
            typeof Avatar === "function" ? h(Avatar, { character: p, size: 48 }) : null,
            h("div", { style: { fontSize: FS(11), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)))) : null,
        panel === "filter" ? h("div", { "data-wk": "camfilter", style: { display: "flex", gap: 8, overflowX: "auto", padding: "10px 16px" } },
          FILTERS.map(f => h(React.Fragment, { key: f.id }, btn(f.zh, () => setFilter(f.id), filter === f.id, "filter")))) : null,
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 16px 14px" } },
          btn("相册", () => fileRef.current && fileRef.current.click(), !!bg, "album"),
          btn("加人", () => setPanel(panel === "people" ? "" : "people"), panel === "people", "people"),
          h("button", { "data-wk": "camshutter", onClick: capture, disabled: busy, "aria-label": "拍照", style: { width: 68, height: 68, borderRadius: 34, border: "4px solid #fff", background: busy ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.92)", boxShadow: "0 0 0 3px rgba(0,0,0,.25)" } }),
          btn("滤镜", () => setPanel(panel === "filter" ? "" : "filter"), panel === "filter" || filter !== "none", "filtertab"),
          btn(stickers.length ? "清空" : "　", () => { setStickers([]); setSel(null); }, false, "clear"))),
      h("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: pickBg }));
  }
  window.CameraApp = CameraApp;
  window.CameraKit = { FILTERS, pixelFilter, drawSticker };
})();
