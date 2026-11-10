// 拼一张壁纸（她 2026-11-10 转群友许愿：「和 char 一起做情侣拼接壁纸，char 可以和 u 一起摆位置」）
//   ⚠️照片不交给生图去拼：合照墙里的照片脸是对的，生图一拼脸会走样、手写英文会乱码，还每张花一次生图。
//     这里用画布把真照片排上去，字也是 App 写的——跟杂志封面、电影海报那套一个道理。
//   ⚠️预览和导出走【同一个】draw：预览看到什么，存下来就是什么，不另写一份排版。
//   TA 那一手（挑哪几张、放哪格、写什么字）在 app.js 的 onArrange 里，一次文字调用；
//   存下来（挂墙、存手机、一人一半那半张换成 TA 的锁屏）在 onSave 里。这个文件只管摆和画。
(function () {
  const W = 1080, H = 2340;
  const HAND = "'Dancing Script','Long Cang','Noto Serif SC',cursive";
  // 每种样式：几格、每格在哪（中心 x/y、宽高、转角）、字写在哪。坐标都按一张 1080×2340 的手机竖屏算
  const TPL = {
    polaroid: {
      name: "拍立得", sub: "格纹纸上三张拍立得", n: 3, caption: true,
      slots: [{ x: 560, y: 600, w: 540, h: 620, r: -4 }, { x: 480, y: 1250, w: 540, h: 620, r: 3 }, { x: 590, y: 1900, w: 540, h: 620, r: -2 }],
      words: [{ x: 540, y: 205, size: 64, color: "#5b3a24" }],
      deco: [["☕", 900, 560, 130], ["🕯️", 880, 1480, 120], ["🎀", 190, 330, 120], ["🧸", 170, 2150, 140]]
    },
    scrap: {
      name: "剪贴本", sub: "撕边照片、胶带和手写字", n: 5,
      slots: [{ x: 300, y: 540, w: 520, h: 620, r: -6 }, { x: 790, y: 720, w: 470, h: 560, r: 5 }, { x: 340, y: 1270, w: 560, h: 460, r: 3 },
        { x: 770, y: 1530, w: 450, h: 590, r: -4 }, { x: 470, y: 2030, w: 600, h: 410, r: 2 }],
      words: [{ x: 300, y: 170, size: 62, color: "#b23a48", r: -3 }, { x: 790, y: 1060, size: 46, color: "#2b2b2b", r: 4 },
        { x: 820, y: 1880, size: 50, color: "#b23a48", r: -2 }, { x: 330, y: 1700, size: 44, color: "#2b2b2b", r: 3 }],
      deco: [["♥", 950, 240, 120, "#d0465c"], ["✿", 110, 930, 100, "#c9a227"], ["☆", 990, 2180, 90, "#555"], ["♡", 140, 1640, 100, "#d0465c"]]
    },
    lock: {
      name: "锁屏款", sub: "上面留给时间，下面四张", n: 4,
      slots: [{ x: 300, y: 1230, w: 470, h: 600, round: 28 }, { x: 780, y: 1230, w: 470, h: 600, round: 28 },
        { x: 300, y: 1870, w: 470, h: 600, round: 28 }, { x: 780, y: 1870, w: 470, h: 600, round: 28 }],
      words: [{ x: 540, y: 850, size: 58, color: "#5e5248" }, { x: 540, y: 2250, size: 44, color: "#7d7064" }],
      deco: [["♥", 540, 1550, 70, "#c45b6e"]]
    }
  };
  const ORDER = ["polaroid", "scrap", "lock"];

  function bg(ctx, tpl, ox) {
    ctx.save(); ctx.translate(ox, 0);
    if (tpl === "polaroid") {
      ctx.fillStyle = "#c79f78"; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.16; ctx.fillStyle = "#6b4228";
      for (let x = 0; x < W; x += 90) ctx.fillRect(x, 0, 34, H);
      for (let y = 0; y < H; y += 90) ctx.fillRect(0, y, W, 34);
      ctx.globalAlpha = 0.08; ctx.fillStyle = "#fff";
      for (let x = 45; x < W; x += 90) ctx.fillRect(x, 0, 6, H);
    } else if (tpl === "scrap") {
      ctx.fillStyle = "#f2eee6"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,.035)";
      for (let i = 0; i < 900; i++) { const x = (i * 197) % W, y = (i * 389) % H; ctx.fillRect(x, y, 3, 3); }
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#efe9e1"); g.addColorStop(1, "#cbc1b5");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
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
  }
  function slot(ctx, tpl, sl, img, cap, ox) {
    ctx.save(); ctx.translate(ox + sl.x, sl.y); ctx.rotate((sl.r || 0) * Math.PI / 180);
    const empty = () => { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(-sl.w / 2, -sl.h / 2, sl.w, sl.h); };
    ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    if (tpl === "polaroid") {
      ctx.fillStyle = "#fbfaf6"; ctx.fillRect(-sl.w / 2, -sl.h / 2, sl.w, sl.h); ctx.shadowColor = "transparent";
      const pw = sl.w - 60, top = -sl.h / 2 + 30;
      ctx.save(); ctx.translate(0, top + pw / 2); ctx.beginPath(); ctx.rect(-pw / 2, -pw / 2, pw, pw); ctx.clip();
      if (img) cover(ctx, img, pw, pw); else { ctx.fillStyle = "#222"; ctx.fillRect(-pw / 2, -pw / 2, pw, pw); }
      ctx.restore();
      if (cap) { ctx.fillStyle = "#3c2b20"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; fitText(ctx, cap, 50, pw, HAND); ctx.fillText(cap, 0, top + pw + (sl.h - pw - 30) / 2); }
    } else if (tpl === "scrap") {
      const b = 18; ctx.fillStyle = "#fff"; ctx.fillRect(-sl.w / 2 - b, -sl.h / 2 - b, sl.w + b * 2, sl.h + b * 2); ctx.shadowColor = "transparent";
      ctx.save(); ctx.beginPath(); ctx.rect(-sl.w / 2, -sl.h / 2, sl.w, sl.h); ctx.clip(); if (img) cover(ctx, img, sl.w, sl.h); else empty(); ctx.restore();
      ctx.fillStyle = "rgba(236,222,176,.78)"; ctx.save(); ctx.translate(0, -sl.h / 2 - b); ctx.rotate(-0.06); ctx.fillRect(-90, -24, 180, 48); ctx.restore();
    } else {
      roundRect(ctx, -sl.w / 2, -sl.h / 2, sl.w, sl.h, sl.round || 0); ctx.fillStyle = "#fff"; ctx.fill(); ctx.shadowColor = "transparent";
      ctx.save(); roundRect(ctx, -sl.w / 2, -sl.h / 2, sl.w, sl.h, sl.round || 0); ctx.clip(); if (img) cover(ctx, img, sl.w, sl.h); else empty(); ctx.restore();
    }
    ctx.restore();
  }
  function words(ctx, def, list, ox) {
    (def.words || []).forEach((w, i) => {
      const s = String((list || [])[i] || "").trim(); if (!s) return;
      ctx.save(); ctx.translate(ox + w.x, w.y); ctx.rotate((w.r || 0) * Math.PI / 180);
      ctx.fillStyle = w.color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; fitText(ctx, s, w.size, 900, HAND); ctx.fillText(s, 0, 0);
      ctx.restore();
    });
  }
  function deco(ctx, def, ox) {
    (def.deco || []).forEach(d => { ctx.save(); ctx.font = d[3] + "px 'Apple Color Emoji','Segoe UI Emoji',sans-serif"; ctx.fillStyle = d[4] || "#000";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(d[0], ox + d[1], d[2]); ctx.restore(); });
  }
  // layout = { tpl, split, picks:[照片下标|-1], captions:[], words:[] }；imgs = 下标 → 已解码的图
  //   一人一半：左边一整张给她、右边一整张给 TA，格子各一套；接缝上一颗心，两张并排才拼得起来
  function draw(canvas, layout, imgs) {
    const def = TPL[layout.tpl] || TPL.polaroid, halves = layout.split ? 2 : 1;
    canvas.width = W * halves; canvas.height = H;
    const ctx = canvas.getContext("2d");
    for (let k = 0; k < halves; k++) {
      const ox = k * W;
      bg(ctx, layout.tpl, ox); deco(ctx, def, ox);
      def.slots.forEach((sl, i) => { const at = k * def.n + i, p = (layout.picks || [])[at]; slot(ctx, layout.tpl, sl, p != null && p >= 0 ? imgs[p] : null, def.caption ? (layout.captions || [])[at] : "", ox); });
      words(ctx, def, (layout.words || []).slice(k * def.words.length), ox);
    }
    if (layout.split) {
      // 接缝上那颗心画成形状（不靠表情字体，哪台机器上都一样）
      ctx.save(); ctx.translate(W, H / 2); ctx.scale(2.4, 2.4); ctx.fillStyle = "#d0465c";
      ctx.shadowColor = "rgba(0,0,0,.2)"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.bezierCurveTo(-60, -10, -40, -60, 0, -30); ctx.bezierCurveTo(40, -60, 60, -10, 0, 30); ctx.fill(); ctx.restore();
    }
    return canvas;
  }
  const slotCount = layout => (TPL[layout.tpl] || TPL.polaroid).n * (layout.split ? 2 : 1);
  const wordCount = layout => (TPL[layout.tpl] || TPL.polaroid).words.length * (layout.split ? 2 : 1);

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
    const [layout, setLayout] = useState(() => ({ tpl: "polaroid", split: false, picks: [0, 1, 2].map(i => i < list.length ? i : -1), captions: [], words: [] }));
    const [why, setWhy] = useState("");
    const [busy, setBusy] = useState(""); // "arrange" | "save"
    const [pickAt, setPickAt] = useState(-1);
    const imgs = useRef({});
    const [, bump] = useState(0);
    const cv = useRef(null);
    // 用到哪张才解哪张，解好了重画
    useEffect(() => {
      let live = true;
      (layout.picks || []).forEach(p => { if (p >= 0 && list[p] && !(p in imgs.current)) { imgs.current[p] = null; loadImg(list[p]).then(img => { imgs.current[p] = img; if (live) bump(x => x + 1); }); } });
      return () => { live = false; };
    }, [layout.picks && layout.picks.join(","), list.length]);
    useEffect(() => { if (cv.current) draw(cv.current, layout, imgs.current); });
    const reshape = (patch) => setLayout(l => {
      const n = Object.assign({}, l, patch), need = slotCount(n), picks = (n.picks || []).slice(0, need);
      for (let i = picks.length; i < need; i++) { const free = list.findIndex((_, j) => picks.indexOf(j) < 0); picks.push(free); }
      return Object.assign(n, { picks });
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
        const full = draw(document.createElement("canvas"), layout, imgs.current);
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
    if (pickAt >= 0) return h("div", { "data-wk": "uspage", "data-part": "collagepick", className: "h-full flex flex-col", style: cpSkin(t, "page") },
      h(Head, { zh: "第 " + (pickAt + 1) + " 格放哪张", bg: "transparent", onBack: () => setPickAt(-1) }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5 pb-10" },
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 } },
          list.map((p, i) => h("button", { key: i, onClick: () => { setLayout(l => { const picks = l.picks.slice(); picks[pickAt] = i; return Object.assign({}, l, { picks }); }); setPickAt(-1); },
            className: "active:opacity-80", style: { aspectRatio: "1", borderRadius: 10, overflow: "hidden", border: "2px solid " + (layout.picks[pickAt] === i ? t.accent : t.line), padding: 0 } },
            typeof AlbumPhoto === "function" ? h(AlbumPhoto, { photo: p }) : null)))));
    return h("div", { "data-wk": "uspage", "data-part": "collage", className: "h-full flex flex-col", style: cpSkin(t, "page") },
      h(Head, { zh: "拼一张壁纸", sub: name, bg: "transparent", onBack }),
      h("div", { ref: typeof keepScroll === "function" ? keepScroll("collage:" + partner.id) : null, className: "flex-1 min-h-0 overflow-y-auto px-5 pb-12" },
        // 样式：下划线页签（tabs-not-plain-pills）
        h("div", { className: "flex", style: { borderBottom: "1px solid " + t.line, marginTop: 6 } },
          ORDER.map(k => h("button", { key: k, "data-part": "collagetpl", onClick: () => reshape({ tpl: k }), className: "flex-1 active:opacity-70",
            style: { padding: "10px 0 9px", fontFamily: F_BODY, fontSize: "calc(13.5px * var(--app-fs, 1))", color: layout.tpl === k ? t.ink : t.fog, borderBottom: "2px solid " + (layout.tpl === k ? t.ink : "transparent"), marginBottom: -1 } }, TPL[k].name))),
        h("div", { style: { fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.fog, textAlign: "center", margin: "8px 0 10px" } }, def.sub),
        h("div", { style: { display: "flex", justifyContent: "center" } },
          h("canvas", { ref: cv, "data-part": "collagecanvas", style: { width: layout.split ? "100%" : "62%", maxWidth: layout.split ? 420 : 260, height: "auto", borderRadius: 14, boxShadow: "0 6px 22px rgba(0,0,0,.14)" } })),
        h("div", { className: "flex items-center", style: { gap: 10, marginTop: 14, padding: "10px 12px", borderRadius: 14, border: "1px solid " + t.line } },
          h("div", { className: "flex-1 min-w-0" },
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", color: t.ink } }, "一人一半"),
            h("div", { style: { fontFamily: F_BODY, fontSize: "calc(10.5px * var(--app-fs, 1))", color: t.fog, marginTop: 2 } }, "左边那张给你，右边那张换成 " + name + " 手机的锁屏，并排才拼成一颗心")),
          typeof Toggle === "function" ? h(Toggle, { on: !!layout.split, onChange: v => reshape({ split: !!v }), wk: "collage", part: "split" }) : null),
        onArrange ? h("button", { onClick: arrange, disabled: !!busy || !list.length, "data-part": "collagearrange", className: "w-full active:opacity-70 disabled:opacity-40",
          style: { marginTop: 14, padding: "12px 0", borderRadius: 12, border: "1px solid " + t.ink, color: t.ink, fontFamily: F_DISPLAY, fontSize: "calc(14.5px * var(--app-fs, 1))" } },
          busy === "arrange" ? name + " 在挑…" : "让 " + name + " 来摆") : null,
        why ? h("div", { style: { fontFamily: F_BODY, fontStyle: "italic", fontSize: "calc(12.5px * var(--app-fs, 1))", color: t.sub, lineHeight: 1.7, marginTop: 10, textAlign: "center" } }, "「" + why + "」") : null,
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
  window.Collage = { TPL, ORDER, draw, slotCount, wordCount, CollageMaker };
})();
