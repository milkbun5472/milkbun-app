// 限时动态（她 2026-11-14：「聊天里搞个限时动态……头像有红框点进去看，24 小时结束后收进过往记录」「想做特别一点，用情侣空间做壁纸那一套」）
//   每一条就是一张竖版卡：用拼壁纸那支 Collage.draw 画（背景、字、贴纸、照片），画好存成一张图进图库（img_ 键）。
//   ⚠️不另写一份排版：TA 摆的版面、她在拼壁纸编辑器里摆的版面，都交给同一个 draw。
//   存档 x_stories：[{ id, by:"me"|角色id, ts, imgKey, text, desc, seen:{谁:几点}, replies:[] }]，24 小时内算「挂着」，过了收进过往。
(function () {
  const KEY = "x_stories", DAY = 86400000, CAP = 400;
  const all = () => { const a = typeof loadJSON === "function" ? loadJSON(KEY, []) : []; return Array.isArray(a) ? a.filter(x => x && x.id && x.by) : []; };
  const save = list => { saveJSON(KEY, list.slice(-CAP)); try { window.dispatchEvent(new Event("lisa-stories")); } catch (e) {} };
  const live = (s, now) => (now || Date.now()) - Number(s.ts || 0) < DAY;
  const activeOf = by => all().filter(s => String(s.by) === String(by) && live(s)).sort((a, b) => a.ts - b.ts);
  const pastOf = by => all().filter(s => String(s.by) === String(by) && !live(s)).sort((a, b) => b.ts - a.ts);
  const unseenBy = (by, viewer) => activeOf(by).some(s => !(s.seen || {})[viewer]);
  const patch = (id, fn) => save(all().map(s => s.id === id ? fn(s) : s));
  const markSeen = (id, viewer) => { const s = all().find(x => x.id === id); if (!s || (s.seen || {})[viewer]) return; patch(id, x => Object.assign({}, x, { seen: Object.assign({}, x.seen || {}, { [viewer]: Date.now() }) })); };
  const remove = id => { const s = all().find(x => x.id === id); save(all().filter(x => x.id !== id)); if (s && s.imgKey && typeof idbImgDel === "function") idbImgDel(s.imgKey).catch(() => {}); };

  // 模型交回来的版面（按 0~1 的比例写位置）→ 拼壁纸那支 draw 认的版面（1080×2340）
  const W = 1080, H = 2340;
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const hex = v => /^#[0-9a-f]{3,8}$/i.test(String(v || "")) ? String(v) : "";
  function layoutFrom(d, hasPhoto) {
    const C = window.Collage || {}, bgs = C.BGS || {}, fonts = ["hand", "brush", "serif", "sans"];
    const bg = bgs[d && d.bg] ? d.bg : "cream", font = fonts.indexOf(d && d.font) >= 0 ? d.font : "brush";
    const free = [];
    if (hasPhoto) free.push({ type: "photo", p: 0, x: W / 2, y: num(d && d.photoY, 0.15, 0.85, 0.42) * H, w: 860, h: 1080, frame: "scrap", s: 1, r: num(d && d.photoR, -8, 8, -2) });
    ((d && d.texts) || []).slice(0, 6).forEach(tx => {
      const t = String((tx && (tx.t || tx.text)) || "").trim().slice(0, 40); if (!t) return;
      free.push({ type: "text", text: t, x: num(tx.x, 0.08, 0.92, 0.5) * W, y: num(tx.y, 0.05, 0.95, 0.5) * H, size: num(tx.size, 36, 180, 80),
        color: hex(tx.color) || (bg === "night" ? "#f3eee8" : "#2b2b2b"), font: fonts.indexOf(tx.font) >= 0 ? tx.font : font, r: num(tx.r, -20, 20, 0), s: 1 });
    });
    const deco = ((d && d.stickers) || []).slice(0, 8).map(st => ({ ch: String((st && (st.ch || st.emoji)) || "").slice(0, 4), x: num(st && st.x, 0.05, 0.95, 0.5) * W, y: num(st && st.y, 0.03, 0.97, 0.5) * H,
      size: num(st && st.size, 50, 220, 110), r: num(st && st.r, -30, 30, 0) })).filter(x => x.ch);
    return { tpl: "blank", bg, font, free, deco, words: [], picks: [] };
  }
  const blobToImg = b => new Promise(res => { const u = URL.createObjectURL(b), im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; });
  async function renderCard(layout, photoBlob) {
    if (!window.Collage || !window.Collage.draw) throw new Error("排版部件还没载入");
    const imgs = {}; if (photoBlob) { const im = await blobToImg(photoBlob); if (im) imgs[0] = im; }
    const cv = document.createElement("canvas"); window.Collage.draw(cv, layout, imgs, "", {});
    return await new Promise(ok => cv.toBlob(b => ok(b), "image/jpeg", 0.88));
  }
  // 存一条。blob 有了就直接存（她在拼壁纸编辑器里存的），没有就照 layout 画
  async function add({ by, layout, photoBlob, blob, text, desc, manual, sticker, audience, raw, photoDesc, photoKind }) {
    const id = "st_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const img = blob || await renderCard(layout, photoBlob);
    if (!img || !img.size) throw new Error("卡没画出来");
    const imgKey = "img_" + id;
    await idbImgPut(imgKey, img);
    const row = { id, by: String(by), ts: Date.now(), imgKey, text: String(text || "").slice(0, 200), desc: String(desc || "").slice(0, 400), seen: {}, replies: [], ...(manual ? { manual: true } : {}),
      ...(normSticker(sticker) ? { sticker: normSticker(sticker) } : {}),
      // 这张卡还能补一张图（她 2026-11-14）：留着排版原稿和「这张图会画什么」，点生图就照它画了重排
      ...(raw ? { raw } : {}), ...(photoDesc ? { photoDesc: String(photoDesc).slice(0, 200), photoKind: ["self", "view", "thing"].indexOf(photoKind) >= 0 ? photoKind : "self" } : {}), ...(photoBlob ? { photo: true } : {}), ...(Array.isArray(audience) && audience.length ? { audience: audience.map(String) } : {}) };
    save(all().concat([row]));
    return row;
  }
  // ── 第二版（她 2026-11-14「还没做完的继续做」）：互动贴纸、只给谁看、精选 ─────────────
  // 贴纸不画进图里，是叠在卡上的一层，点得动：ask 提问框（q）／poll 投票（q＋两个选项）／countdown 倒计时（q＋到哪天）
  function normSticker(st) {
    if (!st || typeof st !== "object") return null;
    const type = ["ask", "poll", "countdown"].indexOf(st.type) >= 0 ? st.type : "";
    const q = String(st.q || "").trim().slice(0, 40);
    if (!type || !q) return null;
    if (type === "poll") { const opts = (Array.isArray(st.opts) ? st.opts : []).map(x => String(x || "").trim().slice(0, 16)).filter(Boolean).slice(0, 2); if (opts.length < 2) return null; return { type, q, opts, votes: st.votes || {} }; }
    if (type === "countdown") { const at = Number(st.at) || (Date.now() + Math.max(1, Math.min(365, Number(st.days) || 1)) * DAY); return { type, q, at }; }
    return { type, q, answers: Array.isArray(st.answers) ? st.answers : [] };
  }
  // 她发的那条只给哪几个人看（audience 空＝谁都看得到）；角色发的都公开
  const visibleTo = (s, viewer) => !(s.by === "me" && Array.isArray(s.audience) && s.audience.length) || s.audience.indexOf(String(viewer)) >= 0;
  const activeFor = (by, viewer) => activeOf(by).filter(s => visibleTo(s, viewer));
  const vote = (id, who, k) => patch(id, s => s.sticker && s.sticker.type === "poll" ? Object.assign({}, s, { sticker: Object.assign({}, s.sticker, { votes: Object.assign({}, s.sticker.votes || {}, { [who]: k }) }) }) : s);
  const answer = (id, who, text) => patch(id, s => s.sticker && s.sticker.type === "ask" ? Object.assign({}, s, { sticker: Object.assign({}, s.sticker, { answers: (s.sticker.answers || []).concat([{ who, text: String(text || "").slice(0, 200), ts: Date.now() }]).slice(-30) }) }) : s);
  // 别人（跟 TA 有关系的角色、配角）的反应：看过、投票、回答、私下回一句——排卡那一次调用顺便写的，一次落进去
  const applyCrowd = (id, list) => patch(id, s => {
    const n = Object.assign({}, s, { seen: Object.assign({}, s.seen || {}), replies: (s.replies || []).slice() }), st = n.sticker ? Object.assign({}, n.sticker) : null;
    (list || []).slice(0, 6).forEach((x, k) => {
      const who = String(x.who), at = Date.now() + k;
      n.seen[who] = at;
      if (st && st.type === "poll" && (x.vote === 0 || x.vote === 1)) st.votes = Object.assign({}, st.votes || {}, { [who]: x.vote });
      if (st && st.type === "ask" && String(x.answer || "").trim()) st.answers = (st.answers || []).concat([{ who, text: String(x.answer).trim().slice(0, 200), ts: at }]);
      if (String(x.reply || "").trim()) n.replies.push({ who, text: String(x.reply).trim().slice(0, 300), ts: at });
    });
    if (st) n.sticker = st;
    return n;
  });
  const daysLeft = at => Math.ceil((Number(at) - Date.now()) / DAY);
  const stickerLine = st => !st ? "" : st.type === "ask" ? "贴着一个提问框「" + st.q + "」" : st.type === "poll" ? "贴着一个投票「" + st.q + "」：" + st.opts.join(" / ") : "贴着倒计时「" + st.q + "」" + (daysLeft(st.at) > 0 ? "，还有 " + daysLeft(st.at) + " 天" : "，已经到了");
  // 精选：过期的挑几条收成一组，起个名，挂在朋友圈主页顶上
  const setHl = (id, name) => patch(id, s => Object.assign({}, s, { hl: String(name || "").trim().slice(0, 12) || undefined }));
  const hlOf = by => { const m = new Map(); all().filter(s => String(s.by) === String(by) && s.hl).sort((a, b) => a.ts - b.ts).forEach(s => { if (!m.has(s.hl)) m.set(s.hl, []); m.get(s.hl).push(s); }); return [...m.entries()]; };
  // 补一张图：照原稿加一格照片重画，换一把新的图库键（查看页认键变了才重读）
  async function addPhoto(id, photoBlob) {
    const s0 = all().find(x => x.id === id); if (!s0 || !s0.raw || !photoBlob) throw new Error("这一条补不了图");
    const img = await renderCard(layoutFrom(s0.raw, true), photoBlob);
    const key = "img_" + id + "_p" + Date.now().toString(36);
    await idbImgPut(key, img);
    patch(id, x => Object.assign({}, x, { imgKey: key, photo: true }));
    if (s0.imgKey && typeof idbImgDel === "function") idbImgDel(s0.imgKey).catch(() => {});
  }
  // 去重：跟挂着的那几条说的是一回事，就不再发（她 2026-11-14「做一下去重」）
  const norm = t => String(t || "").replace(/[\s，。！？!?,.、~…「」“”"'·\-]/g, "");
  function similar(a, b) {
    const x = norm(a), y = norm(b); if (!x || !y) return false;
    if (x.indexOf(y) >= 0 || y.indexOf(x) >= 0) return true;
    const A = new Set(x), B = new Set(y); let n = 0; A.forEach(ch => { if (B.has(ch)) n++; });
    return n / Math.max(A.size, B.size) >= 0.7;
  }
  const dupOf = (by, text) => activeOf(by).some(s => similar(s.text, text) || similar(s.desc, text));
  const addReply = (id, who, text) => patch(id, s => Object.assign({}, s, { replies: (s.replies || []).concat([{ who, text: String(text || "").slice(0, 300), ts: Date.now() }]).slice(-30) }));

  // ── 全屏看：顶上一排进度条，点左右翻，底下回一句 ──────────────────────
  function useBlobUrl(key) {
    const [u, setU] = React.useState("");
    React.useEffect(() => { let on = true, made = ""; if (key && typeof idbImgGet === "function") idbImgGet(key).then(b => { if (on && b) { made = URL.createObjectURL(b); setU(made); } }).catch(() => {}); return () => { on = false; if (made) URL.revokeObjectURL(made); }; }, [key]);
    return u;
  }
  const ago = ts => { const m = Math.max(0, Math.round((Date.now() - ts) / 60000)); return m < 60 ? (m || 1) + " 分钟前" : Math.round(m / 60) + " 小时前"; };
  function StoryViewer({ list, start, viewer, nameOf, avatarOf, onReply, onDelete, onClose, archive }) {
    const h = React.createElement;
    const [i, setI] = React.useState(Math.max(0, Math.min((list || []).length - 1, start || 0)));
    const [draft, setDraft] = React.useState(""), [seenOpen, setSeenOpen] = React.useState(false);
    const [ans, setAns] = React.useState(""), [hlName, setHlName] = React.useState(null), [, bump] = React.useState(0);
    // 自己往下翻（她 2026-11-14）：每条停 6 秒；按着屏幕中间、在打字、点开了看过的人／收精选时停住
    const DUR = 6000, holdT = React.useRef(0), holdLong = React.useRef(false);   // hook 都放在下面那个提前 return 之前
    const [photoOpen, setPhotoOpen] = React.useState(false);   // 「这张图会画什么」默认收着（她 2026-11-14「生图描述可以收起」）
    const [held, setHeld] = React.useState(false), [typing, setTyping] = React.useState(false), [el, setEl] = React.useState(0), [genBusy, setGenBusy] = React.useState(false);
    const paused = held || typing || !!draft || !!ans || seenOpen || hlName != null || genBusy;
    React.useEffect(() => { setEl(0); }, [i]);
    React.useEffect(() => {
      if (paused || !(list || [])[i]) return;
      let last = Date.now();
      const iv = setInterval(() => { const now = Date.now(), d = now - last; last = now; setEl(e => { const n = e + d; if (n >= DUR) { clearInterval(iv); setTimeout(() => go(1), 0); return DUR; } return n; }); }, 100);
      return () => clearInterval(iv);
    }, [paused, i]);
    const s = (list || [])[i];
    const url = useBlobUrl(s && ((all().find(x => x.id === s.id) || s).imgKey));   // 补了图换了键，现读一次才跟得上
    React.useEffect(() => { if (s && viewer && String(s.by) !== String(viewer)) markSeen(s.id, viewer); }, [s && s.id]);
    if (!s) return null;
    const mine = String(s.by) === String(viewer);
    const cur = all().find(x => x.id === s.id) || s, st = cur.sticker;   // 投票、回答是刚写进去的，现读一次
    const card = { position: "absolute", left: "12%", right: "12%", bottom: "16%", zIndex: 3, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,.92)", color: "#222", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))", textAlign: "center", boxShadow: "0 6px 18px rgba(0,0,0,.25)" };
    const stickerUI = !st ? null : h("div", { "data-wk": "storysticker", "data-kind": st.type, style: card },
      h("div", { style: { fontWeight: 600, marginBottom: 8 } }, st.q),
      st.type === "poll" ? h("div", { className: "flex", style: { gap: 8 } }, st.opts.map((o, k) => {
        const vs = Object.values(st.votes || {}), n = vs.filter(v => v === k).length, picked = (st.votes || {})[viewer] === k, voted = (st.votes || {})[viewer] != null || mine;
        return h("button", { key: k, disabled: mine || archive, onClick: () => { vote(s.id, viewer, k); bump(x => x + 1); },
          style: { flex: 1, padding: "8px 6px", borderRadius: 10, border: "1.5px solid " + (picked ? "#e85d75" : "#ccc"), background: picked ? "#fde8ec" : "#fff" } },
          o, voted ? h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#888", marginTop: 2 } }, n + " 票" + (n ? "：" + Object.keys(st.votes).filter(w => st.votes[w] === k).map(nameOf).join("、") : "")) : null);
      })) : null,
      st.type === "countdown" ? h("div", { style: { fontSize: "calc(22px * var(--app-fs, 1))", fontWeight: 700 } }, daysLeft(st.at) > 0 ? "还有 " + daysLeft(st.at) + " 天" : "就是今天") : null,
      st.type === "ask" ? (mine || archive
        ? h("div", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: "#555", textAlign: "left", lineHeight: 1.6 } }, (st.answers || []).length ? st.answers.map((a, k) => h("div", { key: k }, nameOf(a.who) + "：" + a.text)) : "还没人回答")
        : h("div", { className: "flex", style: { gap: 6 } },
            h("input", { "data-wk": "storyask", value: ans, onChange: e => setAns(e.target.value), onFocus: () => setTyping(true), onBlur: () => setTyping(false), placeholder: "回答…", style: { flex: 1, minWidth: 0, minHeight: 36, padding: "0 10px", borderRadius: 9, border: "1px solid #ccc", fontSize: 16 } }),
            h("button", { onClick: () => { const tx = ans.trim(); if (!tx) return; answer(s.id, viewer, tx); onReply && onReply(s, tx, "ask"); setAns(""); onClose(); }, style: { padding: "0 10px", color: "#e85d75" } }, "回答"))) : null);
    const go = d => { const n = i + d; if (n < 0) return; if (n >= list.length) { onClose(); return; } setI(n); setSeenOpen(false); };
    const seen = Object.entries(s.seen || {}).sort((a, b) => b[1] - a[1]);
    const holdStart = () => { holdLong.current = false; clearTimeout(holdT.current); holdT.current = setTimeout(() => { holdLong.current = true; setHeld(true); }, 220); };
    const holdEnd = () => { clearTimeout(holdT.current); if (held) setHeld(false); setTimeout(() => { holdLong.current = false; }, 0); };
    const send = () => { const tx = draft.trim(); if (!tx) return; onReply && onReply(s, tx); setDraft(""); onClose(); };
    const bar = { position: "absolute", left: 0, right: 0, zIndex: 2 };
    return h("div", { "data-wk": "storyview", style: { position: "fixed", inset: 0, zIndex: 120, background: "#000", display: "flex", flexDirection: "column" } },
      h("div", { style: Object.assign({}, bar, { top: 0, padding: "calc(env(safe-area-inset-top, 0px) + 8px) 12px 8px", background: "linear-gradient(rgba(0,0,0,.45),transparent)" }) },
        h("div", { className: "flex", style: { gap: 4 } }, list.map((x, k) => h("div", { key: x.id, style: { flex: 1, height: 2.5, borderRadius: 2, overflow: "hidden", background: "rgba(255,255,255,.35)" } },
          h("div", { style: { height: "100%", background: "#fff", width: k < i ? "100%" : k > i ? "0%" : Math.min(100, el / DUR * 100) + "%" } })))),
        h("div", { className: "flex items-center", style: { gap: 8, marginTop: 8, color: "#fff", fontFamily: F_BODY, fontSize: "calc(13px * var(--app-fs, 1))" } },
          (avatarOf || window.__storyAvatar) ? (avatarOf || window.__storyAvatar)(s.by) : null,
          h("span", { style: { fontWeight: 600 } }, nameOf(s.by)),
          h("span", { style: { opacity: .7, fontSize: "calc(11.5px * var(--app-fs, 1))" } }, archive ? new Date(s.ts).toLocaleDateString() : ago(s.ts)),
          h("span", { style: { flex: 1 } }),
          // 谁的都能删（她 2026-11-14「动态可以删除」）：先问一句，删了这张图一起清掉
          h("button", { "data-wk": "storydel", onClick: () => { const doIt = () => { (onDelete || (x => remove(x.id)))(s); onClose(); };
            if (typeof requestAppConfirm === "function") requestAppConfirm("删掉这条限时动态？", mine ? "删了就没了，看过、回过的记录一起清掉。" : "只从你这儿删掉，TA 那边也就当没发过。", doIt, "删掉"); else doIt(); }, style: { color: "#fff", opacity: .8, padding: "4px 8px" } }, "删掉"),
          h("button", { "data-wk": "storyclose", "aria-label": "关掉", onClick: onClose, style: { color: "#fff", fontSize: 22, padding: "0 6px" } }, "×"))),
      h("div", { style: { flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" } },
        url ? h("img", { src: url, alt: s.text || "", style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" } }) : h("div", { style: { color: "#aaa", fontFamily: F_BODY } }, "载入中…"),
        // 左边三成点一下回上一条、右边点一下下一条；按住不放＝停在这一条（松手接着走）
        h("button", { "aria-label": "上一条", onClick: () => { if (!holdLong.current) go(-1); }, onPointerDown: () => holdStart(), onPointerUp: holdEnd, onPointerLeave: holdEnd, onPointerCancel: holdEnd, style: { position: "absolute", left: 0, top: 0, bottom: 0, width: "35%" } }),
        h("button", { "aria-label": "下一条", onClick: () => { if (!holdLong.current) go(1); }, onPointerDown: () => holdStart(), onPointerUp: holdEnd, onPointerLeave: holdEnd, onPointerCancel: holdEnd, style: { position: "absolute", right: 0, top: 0, bottom: 0, width: "65%" } }),
        stickerUI),
      // 这张图会画什么（她 2026-11-14）：TA 排卡时写好的，没配图的卡点「生图」就照这句补一张（自拍、随手拍的风景、手边的东西都行）
      cur.photoDesc && !cur.photo ? h("div", { "data-wk": "storyphotoline", className: "flex items-center", style: { gap: 8, padding: "8px 12px 0", background: "rgba(0,0,0,.6)", color: "#ddd", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", lineHeight: 1.5 } },
        h("button", { "data-wk": "storyphototoggle", onClick: () => setPhotoOpen(v => !v), className: "flex-1 min-w-0 text-left", style: { color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: photoOpen ? "normal" : "nowrap" } },
          "📷 " + ({ self: "自拍", view: "随手拍的", thing: "手边的东西" }[cur.photoKind] || "照片") + (photoOpen ? "：" + cur.photoDesc + " ︿" : " · 这张图会画什么 ﹀")),
        window.__storyGenPhoto ? h("button", { "data-wk": "storyphotogen", disabled: genBusy, onClick: async () => { setGenBusy(true); try { await window.__storyGenPhoto(cur); bump(x => x + 1); } finally { setGenBusy(false); } },
          style: { flexShrink: 0, padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,.6)", color: "#fff", opacity: genBusy ? .5 : 1 } }, genBusy ? "画着…" : "生图") : null) : null,
      h("div", { style: { padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 10px)", background: "rgba(0,0,0,.6)" } },
        archive ? h("div", { "data-wk": "storyhl", className: "flex items-center", style: { gap: 8, color: "#fff", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))" } },
          hlName == null
            ? h("button", { onClick: () => setHlName(cur.hl || ""), style: { color: "#fff", opacity: .9 } }, cur.hl ? "在精选「" + cur.hl + "」里 · 改" : "收进精选")
            : [h("input", { key: "i", value: hlName, maxLength: 12, onChange: e => setHlName(e.target.value), placeholder: "精选叫什么（空着＝拿出来）", style: { flex: 1, minWidth: 0, minHeight: 36, padding: "0 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.5)", background: "transparent", color: "#fff", fontSize: 16 } }),
               h("button", { key: "b", onClick: () => { setHl(s.id, hlName); setHlName(null); bump(x => x + 1); }, style: { color: "#fff" } }, "好")])
        : mine ? h("div", null,
          h("button", { "data-wk": "storyseen", onClick: () => setSeenOpen(v => !v), style: { color: "#fff", fontFamily: F_BODY, fontSize: "calc(12.5px * var(--app-fs, 1))", opacity: .85 } }, seen.length ? "看过的 " + seen.length + " 人 ›" : "还没人看过"),
          seenOpen ? h("div", { style: { marginTop: 6, color: "#ddd", fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.8 } },
            seen.map(([who, ts]) => h("div", { key: who }, nameOf(who) + " · " + ago(ts))),
            (s.replies || []).map((r, k) => h("div", { key: "r" + k, style: { color: "#fff" } }, nameOf(r.who) + "：" + r.text))) : null)
        : (!archive && onReply ? h("div", null,
          (() => { const others = Object.keys(cur.seen || {}).filter(w => w !== String(viewer)); return others.length ? h("div", { "data-wk": "storyothers", style: { color: "#ccc", fontFamily: F_BODY, fontSize: "calc(11.5px * var(--app-fs, 1))", marginBottom: 6 } }, others.map(nameOf).join("、") + " 也看过") : null; })(),
          h("div", { className: "flex items-center", style: { gap: 8 } },
            h("input", { "data-wk": "storyreply", value: draft, onChange: e => setDraft(e.target.value), onKeyDown: e => { if (e.key === "Enter") send(); }, onFocus: () => setTyping(true), onBlur: () => setTyping(false), placeholder: "回复 " + nameOf(s.by) + "…",
              style: { flex: 1, minWidth: 0, minHeight: 40, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.5)", background: "transparent", color: "#fff", fontFamily: F_BODY, fontSize: 16, outline: "none" } }),
            h("button", { onClick: send, style: { color: "#fff", fontFamily: F_BODY, padding: "0 6px" } }, "发送"))) : null)));
  }
  // 过往：三列小格，点开照样全屏看
  function StoryArchive({ by, title, onOpen }) {
    const h = React.createElement, t = typeof useTheme === "function" ? useTheme() : {};
    const [, tick] = React.useState(0);
    React.useEffect(() => { const f = () => tick(x => x + 1); window.addEventListener("lisa-stories", f); return () => window.removeEventListener("lisa-stories", f); }, []);
    const past = pastOf(by);
    if (!past.length) return null;
    const Cell = ({ s, k }) => { const u = useBlobUrl(s.imgKey); return h("button", { onClick: () => onOpen(past, k), className: "active:opacity-70", style: { aspectRatio: "9 / 19.5", borderRadius: 8, overflow: "hidden", background: (t.bg2 || "#eee") + (u ? " center/cover no-repeat url(" + u + ")" : "") } }); };
    return h("div", { "data-wk": "storyarchive", style: { margin: "10px 0" } },
      h("div", { style: { fontFamily: F_BODY, fontSize: "calc(12px * var(--app-fs, 1))", color: t.fog, margin: "0 2px 6px" } }, (title || "过往限时动态") + " · " + past.length),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 } }, past.slice(0, 60).map((s, k) => h(Cell, { key: s.id, s, k }))));
  }
  // 精选那一排：一组一个圆，点开照样全屏翻（朋友圈主页顶上）
  function StoryHighlights({ by, onOpen }) {
    const h = React.createElement, t = typeof useTheme === "function" ? useTheme() : {};
    const [, tick] = React.useState(0);
    React.useEffect(() => { const f = () => tick(x => x + 1); window.addEventListener("lisa-stories", f); return () => window.removeEventListener("lisa-stories", f); }, []);
    const groups = hlOf(by);
    if (!groups.length) return null;
    const Dot = ({ name, list }) => { const u = useBlobUrl(list[0].imgKey); return h("button", { onClick: () => onOpen(list, 0), className: "active:opacity-70", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, width: 62 } },
      h("span", { style: { width: 56, height: 56, borderRadius: 999, border: "2px solid " + (t.line || "#ddd"), background: (t.bg2 || "#eee") + (u ? " center/cover no-repeat url(" + u + ")" : "") } }),
      h("span", { className: "truncate", style: { maxWidth: 62, fontFamily: F_BODY, fontSize: "calc(11px * var(--app-fs, 1))", color: t.sub } }, name)); };
    return h("div", { "data-wk": "storyhighlights", className: "flex", style: { gap: 10, overflowX: "auto", padding: "8px 0" } }, groups.map(([name, list]) => h(Dot, { key: name, name, list })));
  }
  window.Stories = { KEY, DAY, all, live, activeOf, activeFor, visibleTo, pastOf, unseenBy, markSeen, remove, layoutFrom, renderCard, add, addReply, applyCrowd, addPhoto, dupOf, similar, vote, answer, setHl, hlOf, normSticker, stickerLine, daysLeft, StoryViewer, StoryArchive, StoryHighlights };
})();
