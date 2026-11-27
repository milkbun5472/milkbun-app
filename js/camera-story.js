// 相机·电影 和 平行人生（她 2026-11-26「要生人像、好看的，像旅行、邮票册那样」，挑了这两个）
//   电影：挑几个演员（可以带上她），写一句想看什么片 → 定片名、角色、几场戏 → 出海报 → 一场一场拍剧照、配台词。
//   平行人生：挑一个人 → 想几个平行世界 → 一个世界一张写真，背面是那个世界的TA写给她的信。
//   粉底白卡那套界面跟旅行共用（CameraTrip.kit.makeUI）；写字、出图在 app.js（moviePlan/moviePoster/movieScene/worldsPlan/worldCard）。
//   存档：x_camMovies / x_camWorlds（loadJSON/saveJSON，进 IDB）；图存本机图库 img_movie_ / img_world_，删的时候一起删。
(function () {
  const h = React.createElement, useState = React.useState;
  const K = () => (window.CameraTrip && window.CameraTrip.kit) || {};
  const loadL = key => { try { return (typeof loadJSON === "function" ? loadJSON(key, []) : []) || []; } catch (e) { return []; } };
  const storeL = (key, list) => { try { if (typeof saveJSON === "function") saveJSON(key, list); } catch (e) {} };
  const putImg = async (prefix, blob) => { const k = prefix + Date.now().toString(36); if (typeof idbImgPut === "function") await idbImgPut(k, blob); return k; };
  const delImgs = async keys => { for (const k of keys) if (k && typeof idbImgDel === "function") { try { await idbImgDel(k); } catch (e) {} } };
  const confirmDo = (title, body, go) => { if (typeof requestAppConfirm === "function") requestAppConfirm(title, body, go, "删掉"); else go(); };
  const saveBlob = async (blob, name) => { if (blob && typeof saveFile === "function") await saveFile(new File([blob], name + ".jpg", { type: "image/jpeg" })); };
  const Img = ({ k, style, wk }) => { const url = typeof useIdbImgUrl === "function" ? useIdbImgUrl(k) : null; return url ? h("img", { src: url, "data-wk": wk, style: Object.assign({ display: "block", width: "100%" }, style) }) : h("div", { style: Object.assign({ width: "100%", aspectRatio: "2 / 3", background: "#f1e4ea" }, style) }); };

  // 挑人：一排头像，可以多选／单选；withMe＝带上她自己
  function PeoplePick({ chars, meName, meAvatar, ids, onToggle, withMe, wk, th }) {
    const k = K(), list = (withMe ? [{ id: "me", name: meName || "我", avatarImage: meAvatar || "" }] : []).concat(chars);
    return h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: "12px 6px" } },
      list.map(p => { const on = ids.indexOf(p.id) >= 0;
        return h("button", { key: p.id, "data-wk": wk, "data-on": on ? "1" : "0", onClick: () => onToggle(p.id), style: { border: "none", background: "transparent", color: th.ink, textAlign: "center", padding: 0 } },
          h("div", { style: { display: "inline-block", borderRadius: "50%", padding: 3, background: on ? th.grad : "transparent" } }, h("div", { style: { borderRadius: "50%", padding: 2, background: "#fff" } }, typeof Avatar === "function" ? h(Avatar, { character: p, size: 48 }) : null)),
          h("div", { style: { fontSize: k.FS(11.5), marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, p.name)); }));
  }

  // ── 电影：剧照存手机＝画面下面一条黑底，字幕印在上面 ──
  // 存剧照：字幕「在下面」＝画面下接一条黑底；「叠在画面上」＝压在画面底部，带一层渐暗好认字（不裁画面）
  async function stillWithSubs(imgKey, lines, overlay) {
    const k = K(), blob = typeof idbImgGet === "function" ? await idbImgGet(imgKey) : null; if (!blob) throw new Error("这张图找不到了");
    const u = URL.createObjectURL(blob), im = await k.loadImg(u); URL.revokeObjectURL(u); if (!im) return blob;
    const W = im.naturalWidth, H = im.naturalHeight, fs = Math.round(W * 0.034), pad = Math.round(W * 0.05);
    const cv = document.createElement("canvas"), ctx = cv.getContext("2d"); ctx.font = fs + "px 'PingFang SC','Noto Sans SC',sans-serif";
    const rows = []; (lines || []).forEach(l => k.wrap(ctx, (l.who ? l.who + "：" : "") + l.line, W - pad * 2).forEach(r => rows.push(r)));
    const tall = rows.length ? Math.round(rows.length * fs * 1.5 + pad * 1.2) : 0;
    cv.width = W; cv.height = H + (overlay ? 0 : tall); ctx.fillStyle = "#0d0b0e"; ctx.fillRect(0, 0, W, cv.height); ctx.drawImage(im, 0, 0);
    const top = overlay ? H - tall : H;
    if (overlay && rows.length) { const g = ctx.createLinearGradient(0, top - pad, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)"); ctx.fillStyle = g; ctx.fillRect(0, top - pad, W, H - top + pad); }
    ctx.font = fs + "px 'PingFang SC','Noto Sans SC',sans-serif"; ctx.fillStyle = "#f4efe6"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (overlay) { ctx.shadowColor = "rgba(0,0,0,.8)"; ctx.shadowBlur = fs * 0.3; }
    rows.forEach((r, i) => ctx.fillText(r, W / 2, top + pad * 0.6 + fs * 0.75 + i * fs * 1.5));
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/jpeg", 0.92));
  }
  // 一张剧照：字幕叠在画面上时一句一句换（像片子里那样），在下面时整段列出来；画面不裁
  function StillCard({ imgKey, lines, overlay, th }) {
    const k = K(), [n, setN] = useState(0), L = lines || [];
    React.useEffect(() => { if (!overlay || L.length < 2) return; const t = setInterval(() => setN(x => (x + 1) % L.length), 2600); return () => clearInterval(t); }, [overlay, L.length]);
    const sub = l => h("span", null, l.who ? h("span", { style: { opacity: .65 } }, l.who + "：") : null, l.line);
    return h("div", { style: { position: "relative", background: "#0d0b0e", borderRadius: 12, overflow: "hidden" } },
      h(Img, { k: imgKey }),
      overlay && L.length ? h("div", { "data-wk": "moviesubs", "data-part": "overlay", style: { position: "absolute", left: 0, right: 0, bottom: 0, padding: "34px 16px 14px", background: "linear-gradient(transparent, rgba(0,0,0,.62))", color: "#f4efe6", fontSize: k.FS(14), lineHeight: 1.6, textAlign: "center", textShadow: "0 1px 4px rgba(0,0,0,.8)" } },
        h("div", { key: n, style: { animation: "qqIn .4s ease both" } }, sub(L[n % L.length]))) : null,
      !overlay && L.length ? h("div", { "data-wk": "moviesubs", style: { padding: "10px 14px 12px", color: "#f4efe6", fontSize: k.FS(13), lineHeight: 1.7, textAlign: "center" } }, L.map((l, j) => h("div", { key: j }, sub(l)))) : null);
  }
  // 观影模式：整屏放——海报 → 每场先一张场次卡、再剧照配字幕一句句出 → 片尾演职员表滚动 → 彩蛋。点一下跳到下一格，右上角关掉
  function Screening({ mv, nameOf, onClose }) {
    const k = K();
    const frames = React.useMemo(() => {
      const f = [];
      if (mv.posterKey) f.push({ kind: "poster", ms: 3500 });
      else f.push({ kind: "title", ms: 3000 });
      mv.scenes.forEach((s, i) => { if (!s.shot) return;
        f.push({ kind: "slug", text: "第 " + (i + 1) + " 场" + (s.shot.slug ? " · " + s.shot.slug : " · " + s.name), ms: 2200 });
        const L = s.shot.lines || [];
        if (!L.length) f.push({ kind: "still", s, line: null, ms: 3500 });
        L.forEach(l => f.push({ kind: "still", s, line: l, ms: Math.max(2600, Math.min(6000, 1200 + String(l.line).length * 160)) })); });
      f.push({ kind: "credits", ms: 9000 });
      const eg = mv.premiere && mv.premiere.eggKey ? mv.premiere : null;
      if (eg) { f.push({ kind: "slug", text: "片尾彩蛋", ms: 1800 }); (eg.egg.lines.length ? eg.egg.lines : [null]).forEach(l => f.push({ kind: "egg", line: l, ms: 3200 })); }
      f.push({ kind: "end", ms: 2600 });
      return f;
    }, [mv]);
    const [i, setI] = useState(0);
    React.useEffect(() => { if (i >= frames.length) return; const t = setTimeout(() => setI(x => x + 1), frames[i].ms); return () => clearTimeout(t); }, [i, frames]);
    const fr = frames[Math.min(i, frames.length - 1)];
    const sub = l => l ? h("div", { key: i, style: { position: "absolute", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)", padding: "0 22px", textAlign: "center", color: "#f4efe6", fontSize: k.FS(16), lineHeight: 1.6, textShadow: "0 1px 6px rgba(0,0,0,.9)", animation: "qqIn .35s ease both" } },
      l.who ? h("span", { style: { opacity: .7 } }, l.who + "：") : null, l.line) : null;
    const full = key => h("div", { style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" } }, h(Img, { k: key, style: { width: "100%", height: "100%", objectFit: "contain" } }));
    let body;
    if (fr.kind === "poster") body = full(mv.posterKey);
    else if (fr.kind === "title") body = h("div", { style: { color: "#f4efe6", textAlign: "center" } }, h("div", { style: { fontSize: k.FS(28), fontWeight: 700, letterSpacing: ".2em" } }, mv.title), h("div", { style: { fontSize: k.FS(13), opacity: .7, marginTop: 10 } }, mv.tagline));
    else if (fr.kind === "slug") body = h("div", { style: { color: "#f4efe6", fontSize: k.FS(15), letterSpacing: ".3em", opacity: .85, animation: "qqIn .6s ease both" } }, fr.text);
    else if (fr.kind === "still") body = h(React.Fragment, null, full(fr.s.shot.imgKey), sub(fr.line));
    else if (fr.kind === "egg") body = h(React.Fragment, null, full(mv.premiere.eggKey), sub(fr.line));
    else if (fr.kind === "credits") body = h("div", { style: { position: "absolute", inset: 0, overflow: "hidden" } },
      h("div", { style: { position: "absolute", left: 0, right: 0, top: "100%", textAlign: "center", color: "#f4efe6", animation: "movieCredits " + (fr.ms / 1000) + "s linear both", lineHeight: 2.2, fontSize: k.FS(14) } },
        h("div", { style: { fontSize: k.FS(22), fontWeight: 700, letterSpacing: ".2em", marginBottom: 24 } }, mv.title),
        h("div", { style: { opacity: .6, fontSize: k.FS(12) } }, "导演"), h("div", { style: { marginBottom: 18 } }, nameOf("me")),
        h("div", { style: { opacity: .6, fontSize: k.FS(12) } }, "主演"),
        mv.roles.map((r, j) => h("div", { key: j }, r.who + "　饰　" + String(r.role).split(/[，,。（(]/)[0])),
        h("div", { style: { marginTop: 24, opacity: .6, fontSize: k.FS(12) } }, "全剧终")));
    else body = h("div", { style: { color: "#f4efe6", fontSize: k.FS(18), letterSpacing: ".4em" } }, "— 完 —");
    return ReactDOM.createPortal(h("div", { "data-wk": "moviescreen", onClick: () => setI(x => Math.min(frames.length, x + 1)), style: { position: "fixed", inset: 0, zIndex: 9990, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" } },
      h("style", null, "@keyframes movieCredits{from{transform:translateY(0)}to{transform:translateY(-100%) translateY(-100vh)}}"),
      body,
      h("button", { "data-wk": "moviebtn", "data-part": "closescreen", onClick: e => { e.stopPropagation(); onClose(); }, "aria-label": "关掉", style: { position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 10px)", right: 12, width: 36, height: 36, borderRadius: 18, border: "1px solid rgba(255,255,255,.25)", background: "rgba(0,0,0,.4)", color: "#fff", fontSize: k.FS(16) } }, "×"),
      i >= frames.length ? h("button", { onClick: e => { e.stopPropagation(); setI(0); }, style: { position: "absolute", bottom: "calc(env(safe-area-inset-bottom, 0px) + 30px)", border: "1px solid rgba(255,255,255,.3)", background: "transparent", color: "#fff", borderRadius: 18, padding: "8px 18px", fontSize: k.FS(13) } }, "再看一遍") : null), document.body);
  }

  function CameraMovie(props) {
    const k = K(), chars = props.characters || [], KEY = "x_camMovies";
    const [list, setList] = useState(() => loadL(KEY));
    const [openId, setOpenId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [busy, setBusy] = useState("");
    const [screening, setScreening] = useState(false);
    const [openScript, setOpenScript] = useState(-1);
    const toast = m => props.toast && props.toast(m);
    const put = l => { setList(l); storeL(KEY, l); };
    const patchMv = (id, fn) => put(loadL(KEY).map(m => m.id === id ? fn(m) : m));
    const { card, pill, big, small, page, inp, hero, empty, item, th } = k.makeUI({ page: "moviepage", card: "moviecard", btn: "moviebtn" }, "movie");
    const nameOf = id => id === "me" ? (props.meName || "我") : ((chars.find(c => c.id === id) || {}).name || "");

    if (draft) {
      const d = draft, set = p => setDraft(x => Object.assign({}, x, p));
      const tog = id => set({ ids: d.ids.indexOf(id) >= 0 ? d.ids.filter(x => x !== id) : d.ids.concat([id]) });
      const write = async () => {
        if (busy) return; if (!d.ids.some(i => i !== "me")) { toast("至少挑一个角色"); return; }
        setBusy("plan");
        try { const p = await props.onMoviePlan(d.ids, d.brief, d.titleLock ? d.title : ""); set(Object.assign({}, p, { planned: true })); }
        catch (e) { toast("没写成：" + String(e && e.message || e).slice(0, 80)); } finally { setBusy(""); }
      };
      const go = () => {
        const scenes = (d.scenes || []).filter(s => String(s.name || s.beat || "").trim());
        if (!d.title || !scenes.length) { toast("先写好片名和至少一场戏"); return; }
        const m = { id: "mv_" + Date.now().toString(36), ts: Date.now(), ids: d.ids, brief: d.brief, title: d.title, genre: d.genre || "", mood: d.mood || "", tagline: d.tagline || "", synopsis: d.synopsis || "", poster: d.poster || "", roles: d.roles || [], scenes: scenes.map(s => ({ name: s.name, beat: s.beat, shot: null })), posterKey: "" };
        put([m].concat(loadL(KEY))); setDraft(null); setOpenId(m.id);
      };
      const setScene = (i, p) => set({ scenes: d.scenes.map((s, j) => j === i ? Object.assign({}, s, p) : s) });
      return page("新电影", () => setDraft(null), [
        card("cast", "演员", "可以多选，也可以带上你", h(PeoplePick, { th, chars, meName: props.meName, meAvatar: props.meAvatar, ids: d.ids, onToggle: tog, withMe: true, wk: "movieone" })),
        card("brief", "想看什么片", "类型、一句剧情、一个梗都行", h("div", null,
          inp(d.brief, v => set({ brief: v }), "写一句", "brief", 2),
          h("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 8 } },
            small(busy === "plan" ? "在写…" : d.planned ? "重新写一版" : "让 AI 写一版", write, "plan", busy),
            h("span", { style: { fontSize: k.FS(10.5), color: th.sub } }, "片名、角色、几场戏，写完都能改")))),
        d.planned ? card("plan", "这部片", null, h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          inp(d.title, v => set({ title: v, titleLock: true }), "片名", "title"),
          inp(d.tagline, v => set({ tagline: v }), "海报上的一句", "tagline"),
          inp(d.synopsis, v => set({ synopsis: v }), "剧情简介", "synopsis", 4),
          (d.roles || []).map((r, i) => h("div", { key: i, style: { display: "flex", gap: 6, alignItems: "center" } }, h("span", { style: { fontSize: k.FS(12), width: 64, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r.who), h("div", { style: { flex: 1 } }, inp(r.role, v => set({ roles: d.roles.map((x, j) => j === i ? Object.assign({}, x, { role: v }) : x) }), "演谁", "role")))))) : null,
        d.planned ? card("scenes", "几场戏", (d.scenes || []).length + " 场，一场拍一张剧照", h("div", null,
          (d.scenes || []).map((s, i) => h("div", { key: i, "data-wk": "moviescene", style: { border: "1.5px solid " + th.line, borderRadius: 16, padding: 10, marginBottom: 10 } },
            h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 6 } },
              h("span", { style: { width: 22, height: 22, borderRadius: 11, background: th.grad, color: "#fff", fontSize: k.FS(11), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, i + 1),
              h("div", { style: { flex: 1 } }, inp(s.name, v => setScene(i, { name: v }), "场名", "scenename")),
              h("button", { "data-wk": "moviebtn", "data-part": "delscene", onClick: () => set({ scenes: d.scenes.filter((_, j) => j !== i) }), style: { border: "none", background: "transparent", color: th.sub, fontSize: k.FS(16), padding: "0 4px" } }, "×")),
            inp(s.beat, v => setScene(i, { beat: v }), "这一场发生什么", "scenebeat", 3))),
          h("button", { "data-wk": "moviebtn", "data-part": "addscene", onClick: () => set({ scenes: (d.scenes || []).concat([{ name: "", beat: "" }]) }), style: { width: "100%", height: 38, borderRadius: 14, border: "1.5px dashed " + th.accent, background: "transparent", color: th.accent, fontSize: k.FS(12.5) } }, "＋ 加一场"))) : null
      ], big("开拍", go, "go", !d.planned));
    }

    const mv = list.find(m => m.id === openId);
    if (mv) {
      const next = mv.scenes.findIndex(s => !s.shot), sc = next >= 0 ? mv.scenes[next] : null;
      const doPoster = async () => {
        if (busy) return; setBusy("poster");
        try { const b = await props.onMoviePoster(mv); const key = await putImg("img_movie_", b); const old = mv.posterKey; patchMv(mv.id, m => Object.assign({}, m, { posterKey: key })); if (old) delImgs([old]); }
        catch (e) { toast("海报没出来：" + String(e && e.message || e).slice(0, 80)); } finally { setBusy(""); }
      };
      // 拍第 idx 场；已经拍过的就是重拍（群友 2026-11-27「电影第几场可以重新生成么」）：新的拍成了才换掉旧图，没拍成旧的还在
      const shootAt = async idx => {
        const s0 = mv.scenes[idx]; if (busy || !s0) return; setBusy("scene:" + idx);
        try { const r = await props.onMovieScene(mv, idx, s0.note || ""); const key = await putImg("img_movie_", r.blob); const old = s0.shot && s0.shot.imgKey;
          patchMv(mv.id, m => Object.assign({}, m, { scenes: m.scenes.map((s, i) => i === idx ? Object.assign({}, s, { shot: { imgKey: key, still: r.still, lines: r.lines, slug: r.slug || "", script: r.script || "", bts: r.bts || [], ts: Date.now() } }) : s) }));
          if (old) delImgs([old]); }
        catch (e) { toast("没拍成：" + String(e && e.message || e).slice(0, 80)); } finally { setBusy(""); }
      };
      const shoot = () => shootAt(next);
      const setNote = (idx, v) => patchMv(mv.id, m => Object.assign({}, m, { scenes: m.scenes.map((s, i) => i === idx ? Object.assign({}, s, { note: v }) : s) }));
      const overlay = mv.subOverlay !== false;   // 字幕默认叠在画面上（她 2026-11-27「可以选择让字幕 overlay 在上面滚动」）
      const premiere = async () => {
        if (busy || !props.onMoviePremiere) return; setBusy("premiere");
        try { const r = await props.onMoviePremiere(mv); const key = await putImg("img_movie_", r.blob); const old = mv.premiere && mv.premiere.eggKey;
          patchMv(mv.id, m => Object.assign({}, m, { premiere: { eggKey: key, egg: r.egg, rating: r.rating, shorts: r.shorts, review: r.review, interviews: r.interviews, ts: Date.now() } }));
          if (old) delImgs([old]); }
        catch (e) { toast("首映没办成：" + String(e && e.message || e).slice(0, 80)); } finally { setBusy(""); }
      };
      const pm = mv.premiere;
      const del = () => confirmDo("删掉这部电影？", "海报和剧照都会删掉（已经存到手机的不受影响）", async () => { await delImgs([mv.posterKey, mv.premiere && mv.premiere.eggKey].concat(mv.scenes.map(s => s.shot && s.shot.imgKey))); put(loadL(KEY).filter(m => m.id !== mv.id)); setOpenId(null); });
      const got = mv.scenes.filter(s => s.shot);
      // 页面上的小部件：分段标题、描边小按钮（她 2026-11-27「页面弄好看点」）
      const sec = (zh, en, key) => h("div", { key, "data-wk": "moviesec", style: { display: "flex", alignItems: "center", gap: 10, margin: "22px 2px 12px" } },
        h("span", { style: { fontSize: k.FS(13.5), fontWeight: 700, color: th.ink, letterSpacing: ".08em" } }, zh),
        h("span", { style: { fontSize: k.FS(9.5), color: th.accent, letterSpacing: ".3em", opacity: .8 } }, en),
        h("span", { style: { flex: 1, height: 1, background: "linear-gradient(90deg, " + th.line + ", transparent)" } }));
      const ghost = (label, on, part, accent, dis) => h("button", { "data-wk": "moviebtn", "data-part": part, disabled: !!dis, onClick: on, style: { height: 28, padding: "0 12px", borderRadius: 14, border: "1px solid " + (accent ? th.accent : th.line), background: accent ? th.soft : "transparent", color: accent ? th.accent : th.sub, fontSize: k.FS(11.5), fontWeight: accent ? 600 : 400, opacity: dis ? .5 : 1 } }, label);
      return h(React.Fragment, null, screening ? h(Screening, { mv, nameOf, onClose: () => setScreening(false) }) : null, page(mv.title, () => setOpenId(null), [
        h("div", { key: "poster", "data-wk": "movieposter", style: { borderRadius: 14, overflow: "hidden", boxShadow: "0 18px 36px -18px rgba(40,10,30,.7)", marginBottom: 10, background: "#1a1418" } },
          mv.posterKey ? h(Img, { k: mv.posterKey, wk: "movieposterimg" })
            : h("div", { style: { aspectRatio: "2 / 3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#f4efe6", gap: 10, padding: 20, textAlign: "center" } },
              h("div", { style: { fontSize: k.FS(22), fontWeight: 700, letterSpacing: ".1em" } }, mv.title),
              h("div", { style: { fontSize: k.FS(12), opacity: .7 } }, mv.tagline),
              h("button", { "data-wk": "moviebtn", "data-part": "poster", onClick: doPoster, style: { marginTop: 8, height: 36, padding: "0 18px", borderRadius: 18, border: "none", background: th.grad, color: "#fff", fontSize: k.FS(13), fontWeight: 600, opacity: busy ? .6 : 1 } }, busy === "poster" ? "在拍海报…" : "出海报"))),
        mv.posterKey ? h("div", { key: "pact", style: { display: "flex", justifyContent: "space-between", fontSize: k.FS(11.5), marginBottom: 14 } },
          h("button", { "data-wk": "moviebtn", "data-part": "reposter", onClick: doPoster, style: { border: "none", background: "transparent", color: th.sub } }, busy === "poster" ? "在拍…" : "重拍海报"),
          h("button", { "data-wk": "moviebtn", "data-part": "saveposter", onClick: async () => { try { await saveBlob(await idbImgGet(mv.posterKey), mv.title + "-海报"); } catch (e) {} }, style: { border: "none", background: "transparent", color: th.accent, fontWeight: 600 } }, "存到手机")) : null,
        h("div", { key: "meta", "data-wk": "moviemeta", style: { fontSize: k.FS(12.5), color: th.ink, lineHeight: 1.8, padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,.04)", border: "1px solid " + th.line } },
          mv.genre ? h("div", { style: { fontSize: k.FS(10.5), color: th.accent, letterSpacing: ".25em", marginBottom: 6 } }, mv.genre) : null,
          mv.tagline ? h("div", { style: { fontSize: k.FS(14), fontWeight: 600, marginBottom: 8, fontFamily: "'Songti SC','Noto Serif SC',serif" } }, "「" + mv.tagline + "」") : null,
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: mv.synopsis ? 10 : 0 } },
            (mv.roles.length ? mv.roles : mv.ids.map(i => ({ who: nameOf(i), role: "" }))).map((r, j) => h("span", { key: j, style: { fontSize: k.FS(11), padding: "3px 10px", borderRadius: 12, background: "rgba(255,255,255,.06)", color: th.sub } },
              h("span", { style: { color: th.ink } }, r.who), r.role ? " 饰 " + r.role.split(/[，,。（(]/)[0] : " 主演"))),
          mv.synopsis ? h("div", { style: { color: th.sub } }, mv.synopsis) : null),
        got.length ? sec("片场", "STILLS", "secstill") : null,
        got.length ? h("div", { key: "tools", style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 } },
          small("▶ 开始放映", () => setScreening(true), "screen"),
          h("span", { style: { fontSize: k.FS(11), color: th.sub, marginLeft: 4 } }, "字幕"),
          pill("叠在画面上", overlay, () => patchMv(mv.id, m => Object.assign({}, m, { subOverlay: true })), "subover"),
          pill("放在下面", !overlay, () => patchMv(mv.id, m => Object.assign({}, m, { subOverlay: false })), "subbelow")) : null,
        got.map((s, i) => { const si = mv.scenes.indexOf(s), sh = s.shot;
          return h("div", { key: i, "data-wk": "moviestill", style: { marginBottom: 22 } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 10, margin: "0 2px 8px" } },
            h("span", { style: { minWidth: 30, height: 30, borderRadius: 8, background: th.grad, color: "#1a1418", fontSize: k.FS(13), fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } }, String(si + 1).padStart(2, "0")),
            h("div", { style: { minWidth: 0 } },
              h("div", { style: { fontSize: k.FS(13.5), fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.name),
              sh.slug ? h("div", { "data-wk": "movieslug", style: { fontSize: k.FS(10), color: th.sub, letterSpacing: ".15em" } }, sh.slug) : null)),
          h(StillCard, { imgKey: sh.imgKey, lines: sh.lines, overlay, th }),
          h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" } },
            ghost(busy === "scene:" + si ? "在重拍…" : "重拍这一场", () => shootAt(si), "reshoot", false, busy),
            sh.script ? ghost(openScript === si ? "收起剧本" : "看剧本", () => setOpenScript(openScript === si ? -1 : si), "script") : null,
            h("span", { style: { flex: 1 } }),
            ghost("存到手机", async () => { try { await saveBlob(await stillWithSubs(sh.imgKey, sh.lines, overlay), mv.title + "-" + s.name); } catch (e) { toast(String(e && e.message || e)); } }, "savestill", true)),
          openScript === si && sh.script ? h("div", { "data-wk": "moviescript", style: { marginTop: 6, padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid " + th.line, fontFamily: "'Courier New','Songti SC',serif", fontSize: k.FS(12.5), lineHeight: 1.85, whiteSpace: "pre-wrap", color: th.ink } }, (sh.slug ? sh.slug + "\n\n" : "") + sh.script) : null,
          (sh.bts || []).length ? h("div", { "data-wk": "moviebts", style: { marginTop: 10, padding: "10px 14px", borderRadius: 12, background: th.soft, borderLeft: "3px solid " + th.accent, fontSize: k.FS(11.5), lineHeight: 1.7, color: th.sub } },
            h("div", { style: { fontSize: k.FS(10.5), letterSpacing: ".15em", marginBottom: 2, color: th.accent } }, "幕后花絮"),
            sh.bts.map((b, j) => h("div", { key: j }, b.who ? h("span", { style: { color: th.ink } }, b.who + "　") : null, b.text))) : null); }),
        // 下一场开拍之前：导演说戏
        sc ? h("div", { key: "note", "data-wk": "movienote", style: { marginTop: 8, marginBottom: 14, padding: "12px 14px", borderRadius: 16, border: "1px dashed " + th.accent, background: th.soft } },
          h("div", { style: { fontSize: k.FS(11.5), color: th.sub, marginBottom: 6 } }, "导演说戏 · 第 " + (next + 1) + " 场「" + sc.name + "」（选填，拍的时候照这句来）"),
          inp(sc.note || "", v => setNote(next, v), "比如：这场要更凶一点／让他哭", "scenenote")) : null,
        // 杀青以后：首映——彩蛋、评分、短评、长评、映后采访
        !sc && got.length && pm ? sec("首映礼", "PREMIERE", "secpm") : null,
        !sc && got.length ? (pm ? h("div", { key: "pm", "data-wk": "moviepremiere", style: { marginBottom: 14 } },
          h("div", { style: { fontSize: k.FS(11.5), color: th.sub, letterSpacing: ".15em", margin: "0 2px 8px" } }, "片尾彩蛋"),
          h(StillCard, { imgKey: pm.eggKey, lines: (pm.egg && pm.egg.lines) || [], overlay, th }),
          h("div", { "data-wk": "movierating", style: { display: "flex", alignItems: "center", gap: 12, margin: "18px 0 10px", padding: "14px 16px", borderRadius: 16, background: "rgba(255,255,255,.05)", border: "1px solid " + th.line } },
            h("div", { style: { fontSize: k.FS(34), fontWeight: 700, color: th.accent, lineHeight: 1 } }, Number(pm.rating).toFixed(1)),
            h("div", null, h("div", { style: { color: th.accent, letterSpacing: 2 } }, "★★★★★".slice(0, Math.round(pm.rating / 2)) + "☆☆☆☆☆".slice(0, 5 - Math.round(pm.rating / 2))),
              h("div", { style: { fontSize: k.FS(11), color: th.sub } }, (pm.shorts || []).length + " 条短评 · 首映"))),
          (pm.shorts || []).map((x, j) => h("div", { key: j, style: { padding: "8px 2px", borderBottom: "1px solid " + th.line, fontSize: k.FS(12.5), lineHeight: 1.65 } },
            h("div", { style: { fontSize: k.FS(11), color: th.sub } }, x.who + "　" + "★".repeat(x.stars)), x.text)),
          pm.review && pm.review.text ? h("div", { style: { marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,.05)" } },
            h("div", { style: { fontSize: k.FS(14), fontWeight: 600, marginBottom: 6 } }, pm.review.title || "长评"),
            h("div", { style: { fontSize: k.FS(12.5), lineHeight: 1.8, whiteSpace: "pre-wrap", color: th.ink } }, pm.review.text)) : null,
          (pm.interviews || []).length ? h("div", { style: { marginTop: 16 } },
            h("div", { style: { fontSize: k.FS(11.5), color: th.sub, letterSpacing: ".15em", margin: "0 2px 8px" } }, "映后采访"),
            pm.interviews.map((x, j) => h("div", { key: j, style: { marginBottom: 10, padding: "10px 14px", borderRadius: 14, background: "rgba(255,255,255,.04)", fontSize: k.FS(12.5), lineHeight: 1.7 } },
              x.q ? h("div", { style: { color: th.sub } }, "问：" + x.q) : null,
              h("div", null, h("span", { style: { color: th.accent, fontWeight: 600 } }, (x.who || "演员") + "："), x.a)))) : null,
          h("div", { style: { marginTop: 6 } }, ghost(busy === "premiere" ? "在重办…" : "重办一场首映", premiere, "repremiere", false, busy)))
          : null) : null,
        sec("场记", "SLATE", "secslate"),
        h("div", { key: "left", "data-wk": "movieslate", style: { display: "flex", flexWrap: "wrap", gap: 6 } }, mv.scenes.map((s, i) => h("span", { key: i, style: { fontSize: k.FS(11), padding: "4px 10px", borderRadius: 12, border: "1px solid " + (i === next ? th.accent : th.line), color: s.shot ? th.sub : i === next ? th.accent : th.line, background: s.shot ? "rgba(255,255,255,.05)" : "transparent" } }, (s.shot ? "✓ " : "") + (i + 1) + " " + s.name))),
        h("div", { key: "del", style: { textAlign: "center", marginTop: 26 } }, h("button", { "data-wk": "moviebtn", "data-part": "delmovie", onClick: del, style: { border: "none", background: "transparent", color: th.sub, opacity: .7, fontSize: k.FS(11.5) } }, "删掉这部电影"))
      ], sc ? h("div", null, h("div", { style: { fontSize: k.FS(11), color: th.sub, textAlign: "center", marginBottom: 8 } }, busy === "scene:" + next ? "在写台词、在拍…要等半分钟左右" : "下一场：" + sc.name),
        big(busy === "scene:" + next ? "在拍…" : "拍这一场", shoot, "shoot", !!busy))
        : !pm && props.onMoviePremiere ? h("div", null, h("div", { style: { fontSize: k.FS(11), color: th.sub, textAlign: "center", marginBottom: 8 } }, busy === "premiere" ? "在办首映：彩蛋、影评、映后采访…" : "杀青了：办一场首映，片尾彩蛋、评分影评、映后采访一起出"),
            big(busy === "premiere" ? "在办…" : "杀青 · 办首映", premiere, "premiere", !!busy))
        : h("div", { style: { textAlign: "center", color: th.sub, fontSize: k.FS(12.5), padding: "8px 0" } }, "杀青了")));
    }

    return page("电影", props.onBack, [
      hero("开机", "挑几个演员（可以带上你），写一句想看什么片。定好片名、角色和几场戏，先出海报，再一场一场拍剧照、配台词。", "写一版、出海报、每拍一场各一次"),
      list.length ? list.map(m => { const n = m.scenes.filter(s => s.shot).length;
        return item(m.id, "movieitem", () => setOpenId(m.id), h("div", { style: { width: 54, height: 80, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "#1a1418", boxShadow: "0 6px 14px -6px rgba(0,0,0,.6)" } }, m.posterKey ? h(Img, { k: m.posterKey, style: { height: "100%", objectFit: "cover" } }) : null),
          "《" + m.title + "》", m.ids.map(nameOf).filter(Boolean).join("、") + " 主演", n >= m.scenes.length ? "杀青 · " + n + " 场" : "拍了 " + n + " / " + m.scenes.length + " 场"); })
        : empty("还没拍过，点下面开一部")
    ], big("新电影", () => setDraft({ ids: chars[0] ? [chars[0].id] : [], brief: "", title: "", scenes: [], roles: [] }), "new"));
  }

  // ── 平行人生：一个世界一张，正面写真、背面那个世界的TA写给她的信 ──
  async function worldWithLetter(c, w, name) {
    const k = K(), blob = typeof idbImgGet === "function" ? await idbImgGet(c.imgKey) : null; if (!blob) throw new Error("这张图找不到了");
    const u = URL.createObjectURL(blob), im = await k.loadImg(u); URL.revokeObjectURL(u); if (!im) return blob;
    const W = 1200, ph = Math.round(W * im.naturalHeight / im.naturalWidth), m = 60, fs = 44;
    const cv = document.createElement("canvas"), ctx = cv.getContext("2d"); ctx.font = fs + "px " + k.HAND;
    const rows = k.wrap(ctx, c.letter, W - m * 2), backH = Math.max(500, rows.length * fs * 1.5 + m * 3 + 60);
    cv.width = W; cv.height = ph + backH; ctx.drawImage(im, 0, 0, W, ph);
    ctx.fillStyle = "#fbf7f1"; ctx.fillRect(0, ph, W, backH);
    ctx.fillStyle = "#9a8592"; ctx.font = "30px 'PingFang SC',sans-serif"; ctx.fillText("「" + w.world + "」里的 " + name, m, ph + m + 20);
    ctx.fillStyle = "#3a3340"; ctx.font = fs + "px " + k.HAND; rows.forEach((r, i) => ctx.fillText(r, m, ph + m + 100 + i * fs * 1.5));
    return await new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("没存下来")), "image/jpeg", 0.92));
  }
  function WorldCard({ w, name, onSave, onRedo, redoing, th }) {
    const k = K(), [back, setBack] = useState(false);
    return h("div", { "data-wk": "worldpost", style: { marginBottom: 20 } },
      h("div", { style: { margin: "0 2px 8px", color: th.ink } }, h("span", { style: { fontSize: k.FS(14), fontWeight: 600 } }, w.world), w.who ? h("div", { style: { fontSize: k.FS(11), color: th.sub, marginTop: 2, lineHeight: 1.5 } }, w.who) : null),
      h("div", { "data-wk": "worldflip", onClick: () => setBack(b => !b), style: { position: "relative", borderRadius: 14, overflow: "hidden", boxShadow: "0 16px 34px -18px rgba(80,30,60,.6)", cursor: "pointer", background: "#fbf7f1" } },
        h("div", { style: { visibility: back ? "hidden" : "visible" } }, h(Img, { k: w.card.imgKey, wk: "worldphoto" })),
        back ? h("div", { "data-wk": "worldletter", style: { position: "absolute", inset: 0, overflowY: "auto", padding: "22px 20px", fontFamily: k.HAND, fontSize: k.FS(17), lineHeight: 1.6, color: "#3a3340", whiteSpace: "pre-wrap", background: "#fbf7f1" } },
          w.card.letter, h("div", { style: { textAlign: "right", marginTop: 12 } }, "—— 「" + w.world + "」里的 " + name)) : null),
      h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: k.FS(11), color: th.sub } },
        h("span", null, back ? "点一下看照片" : "点一下看TA写的信"),
        onRedo ? h("button", { "data-wk": "worldbtn", "data-part": "redoworld", disabled: !!redoing, onClick: onRedo, style: { border: "none", background: "transparent", color: th.sub, fontSize: k.FS(12), marginLeft: "auto", marginRight: 14 } }, redoing === true ? "在重来…" : "重来这一张") : null,
        h("button", { "data-wk": "worldbtn", "data-part": "saveworld", onClick: onSave, style: { border: "none", background: "transparent", color: th.accent, fontSize: k.FS(12), fontWeight: 600 } }, "存到手机")));
  }
  function CameraWorlds(props) {
    const k = K(), chars = props.characters || [], KEY = "x_camWorlds";
    const [list, setList] = useState(() => loadL(KEY));
    const [openId, setOpenId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [busy, setBusy] = useState("");
    const toast = m => props.toast && props.toast(m);
    const put = l => { setList(l); storeL(KEY, l); };
    const { card, big, small, page, inp, hero, empty, item, th } = k.makeUI({ page: "worldpage", card: "worldcard", btn: "worldbtn" }, "worlds");
    const nameOf = id => (chars.find(c => c.id === id) || {}).name || "TA";

    if (draft) {
      const d = draft, set = p => setDraft(x => Object.assign({}, x, p));
      const think = async () => {
        if (busy) return; if (!d.charId) { toast("先挑一个人"); return; }
        setBusy("plan");
        try { const ws = await props.onWorldsPlan(d.charId, d.brief); if (!ws.length) throw new Error("没想出来，再试一次"); set({ worlds: ws }); }
        catch (e) { toast("没想成：" + String(e && e.message || e).slice(0, 80)); } finally { setBusy(""); }
      };
      const go = () => {
        const ws = d.worlds.filter(w => String(w.world || "").trim()); if (!d.charId || !ws.length) { toast("至少一个世界"); return; }
        const t = { id: "pw_" + Date.now().toString(36), ts: Date.now(), charId: d.charId, brief: d.brief, worlds: ws.map(w => ({ world: w.world, who: w.who || "", card: null })) };
        put([t].concat(loadL(KEY))); setDraft(null); setOpenId(t.id);
      };
      const setW = (i, p) => set({ worlds: d.worlds.map((w, j) => j === i ? Object.assign({}, w, p) : w) });
      return page("平行人生", () => setDraft(null), [
        card("who", "谁", "挑一个", h(PeoplePick, { th, chars, ids: d.charId ? [d.charId] : [], onToggle: id => set({ charId: id }), wk: "worldone" })),
        card("brief", "想看哪种人生", "可以空着，让TA自己想", h("div", null,
          inp(d.brief, v => set({ brief: v }), "写一句，或者留空", "brief", 2),
          h("div", { style: { marginTop: 8 } }, small(busy === "plan" ? "在想…" : d.worlds.length ? "重新想几个" : "让TA想几个世界", think, "plan", busy)))),
        card("worlds", "几个世界", d.worlds.length ? d.worlds.length + " 个，一个一张写真一封信" : "还没有", h("div", null,
          d.worlds.map((w, i) => h("div", { key: i, "data-wk": "worldrow", style: { border: "1.5px solid " + th.line, borderRadius: 16, padding: 10, marginBottom: 10 } },
            h("div", { style: { display: "flex", gap: 6, alignItems: "center", marginBottom: 6 } },
              h("div", { style: { flex: 1 } }, inp(w.world, v => setW(i, { world: v }), "什么世界", "world")),
              h("button", { "data-wk": "worldbtn", "data-part": "delworld", onClick: () => set({ worlds: d.worlds.filter((_, j) => j !== i) }), style: { border: "none", background: "transparent", color: th.sub, fontSize: k.FS(16), padding: "0 4px" } }, "×")),
            inp(w.who, v => setW(i, { who: v }), "那个世界的TA是什么人（可空）", "whoami", 2))),
          h("button", { "data-wk": "worldbtn", "data-part": "addworld", onClick: () => set({ worlds: d.worlds.concat([{ world: "", who: "" }]) }), style: { width: "100%", height: 38, borderRadius: 14, border: "1.5px dashed " + th.accent, background: "transparent", color: th.accent, fontSize: k.FS(12.5) } }, "＋ 加一个世界")))
      ], big("出发", go, "go", !d.charId || !d.worlds.some(w => String(w.world || "").trim())));
    }

    const pw = list.find(t => t.id === openId);
    if (pw) {
      const name = nameOf(pw.charId), next = pw.worlds.findIndex(w => !w.card), w0 = next >= 0 ? pw.worlds[next] : null;
      // 去第 idx 个世界；去过的就是重来一张（写真和信一起换），新的成了才换掉旧图
      const visitAt = async idx => {
        const wi = pw.worlds[idx]; if (busy || !wi) return; setBusy("go:" + idx);
        try { const r = await props.onWorldCard(pw.charId, wi, pw.worlds.filter((w, i) => w.card && i !== idx).map(w => w.world + "：" + String(w.card.letter || "").slice(0, 80)));
          const key = await putImg("img_world_", r.blob), old = wi.card && wi.card.imgKey;
          put(loadL(KEY).map(t => t.id === pw.id ? Object.assign({}, t, { worlds: t.worlds.map((w, i) => i === idx ? Object.assign({}, w, { card: { imgKey: key, photo: r.photo, letter: r.letter, ts: Date.now() } }) : w) }) : t));
          if (old) delImgs([old]); }
        catch (e) { toast("没去成：" + String(e && e.message || e).slice(0, 80)); } finally { setBusy(""); }
      };
      const visit = () => visitAt(next);
      const del = () => confirmDo("删掉这一组平行人生？", "写真和信都会删掉（已经存到手机的不受影响）", async () => { await delImgs(pw.worlds.map(w => w.card && w.card.imgKey)); put(loadL(KEY).filter(t => t.id !== pw.id)); setOpenId(null); });
      return page(name + "的平行人生", () => setOpenId(null), [
        pw.worlds.filter(w => w.card).map((w, i) => h(WorldCard, { key: i, w, name, th, onRedo: () => visitAt(pw.worlds.indexOf(w)), redoing: busy === "go:" + pw.worlds.indexOf(w) ? true : !!busy, onSave: async () => { try { await saveBlob(await worldWithLetter(w.card, w, name), name + "-" + w.world); } catch (e) { toast(String(e && e.message || e)); } } })),
        h("div", { key: "left", style: { fontSize: k.FS(11.5), color: th.sub, lineHeight: 1.9 } }, pw.worlds.map((w, i) => h("div", { key: i, style: { color: w.card ? th.sub : i === next ? th.ink : th.line } }, (w.card ? "✓ " : i === next ? "→ " : "· ") + w.world))),
        h("button", { key: "del", "data-wk": "worldbtn", "data-part": "delpw", onClick: del, style: { marginTop: 18, border: "none", background: "transparent", color: th.sub, fontSize: k.FS(12) } }, "删掉这一组")
      ], w0 ? h("div", null, h("div", { style: { fontSize: k.FS(11), color: th.sub, textAlign: "center", marginBottom: 8 } }, busy === "go:" + next ? "TA在那个世界里写信、拍照…要等半分钟左右" : "下一个世界：" + w0.world),
        big(busy === "go:" + next ? "在路上…" : "去这个世界", visit, "visit", !!busy)) : h("div", { style: { textAlign: "center", color: th.sub, fontSize: k.FS(12.5), padding: "8px 0" } }, "这几个世界都去过了"));
    }

    return page("平行人生", props.onBack, [
      hero("换一个世界", "同一个TA，换一个世界、一种人生：一个世界一张写真，背面是那个世界的TA写给你的信。", "想世界、每去一个世界各一次"),
      list.length ? list.map(t => { const n = t.worlds.filter(w => w.card).length, c0 = (t.worlds.find(w => w.card) || {}).card;
        return item(t.id, "worlditem", () => setOpenId(t.id), h("div", { style: { width: 60, height: 80, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: th.grad } }, c0 ? h(Img, { k: c0.imgKey, style: { height: "100%", objectFit: "cover" } }) : null),
          nameOf(t.charId), t.worlds.map(w => w.world).join(" · "), "去过 " + n + " / " + t.worlds.length); })
        : empty("还没有，点下面开始")
    ], big("新的一组", () => setDraft({ charId: chars[0] ? chars[0].id : "", brief: "", worlds: [] }), "new"));
  }
  window.CameraMovie = CameraMovie;
  window.CameraWorlds = CameraWorlds;
})();
