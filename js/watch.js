// ============================================================
// 一起看（watch）—— 导入一部电影和它的字幕，在秋秋机里放；放到哪，那一段台词就喂给TA。
// 她 2026-09-25 群里有人问「可以搞一起看电影嘛」，她：「做吧宝宝做一版试试，然后页面也弄好看点」。
//
// ⚠️模型看不了视频本身，只读得到字：所以TA「跟着看」靠的是字幕；想让TA看画面，
//   就截一帧发过去（要她用的模型能识图）。没有字幕的片子，TA只能靠截图和她说。
// ⚠️电影文件又大又只该在这台手机上：视频本体和字幕都进 IndexedDB（不进云同步），
//   localStorage 只放一张小卡（x_watch_films：片名、看到哪、跟谁看、聊过的话）。
// ⚠️这是「一起读」的第二处同形状：给TA的那段 system 头走 core.js 的 companionHead，
//   记忆走宿主的 onAddMemory（keepWhereItHappened），不在这儿另写一份（施工规则/one-public-mechanism.md）。
// ============================================================
(function () {
  const _store = makeTextStore("WatchTogetherDB", "films");
  const KEY = "x_watch_films";
  const TALK_KEEP = 80, TALK_FEED = 14, FRAME_THUMBS = 10;
  // 聊到这么多条就把最早那一截折成摘要（她 2026-09-25：长片子看到后半段，TA 记不住前面聊过啥）
  const FOLD_AT = 40, FOLD_TAKE = 24;
  // 片子往前走了多少分钟，TA可以自己开一次口（不是必须开口）。她自己拉（她 2026-09-25：「自己开口要不要搞个拉条」）
  const AUTO_MIN = 1, AUTO_MAX = 20, AUTO_DEFAULT = 5;
  const SUB_WINDOW = 90;     // 喂给TA的是【刚放过的】这一段台词
  // 放映厅的色：这一页有自己的夜色，不吃主题（跟月度印象、一起听的播放页一样，Head 传 ink/bg）
  const W = {
    bg: "#16141b", bg2: "#1f1c26", card: "#27232f", line: "rgba(255,255,255,.08)",
    ink: "#f3ece0", sub: "rgba(243,236,224,.64)", fog: "rgba(243,236,224,.38)",
    amber: "#e8b566", amberInk: "#2a2016", red: "#d06a5c"
  };

  function loadFilms() { const v = loadJSON(KEY, []); return Array.isArray(v) ? v : []; }
  function saveFilms(list) { return saveJSON(KEY, list); }
  function patchFilm(id, fn) {
    const list = loadFilms().map(function (f) { return f.id === id ? Object.assign({}, f, fn(f)) : f; });
    saveFilms(list);
    return list;
  }
  function clock(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0)), h0 = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    const two = function (n) { return String(n).padStart(2, "0"); };
    return (h0 ? h0 + ":" + two(m) : String(m)) + ":" + two(ss);
  }
  function sizeLabel(n) { const mb = (Number(n) || 0) / 1048576; return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.max(1, Math.round(mb)) + " MB"; }

  // ---- 字幕：srt / vtt / ass(ssa)。编码先按 UTF-8 严格读，读不通再按 GB18030（国内字幕组常见）----
  function decodeText(buf) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, ""); }
    catch (e) { try { return new TextDecoder("gb18030").decode(buf).replace(/^﻿/, ""); } catch (e2) { return new TextDecoder().decode(buf); } }
  }
  function stamp(s) {
    const m = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/.exec(String(s || ""));
    if (!m) return NaN;
    return (Number(m[1]) || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number((m[4] + "00").slice(0, 3)) / 1000;
  }
  function cleanLine(t) {
    return String(t || "").replace(/\{[^}]*\}/g, "").replace(/\\[Nn]/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  function parseSubs(text) {
    const src = String(text || "").replace(/\r/g, "");
    const out = [];
    if (/^\s*\[Script Info\]/m.test(src) || /^Dialogue:/m.test(src)) {
      src.split("\n").forEach(function (line) {
        const m = /^Dialogue:\s*[^,]*,([^,]+),([^,]+),(?:[^,]*,){6}(.*)$/.exec(line);
        if (!m) return;
        const s = stamp(m[1]), e = stamp(m[2]), t = cleanLine(m[3]);
        if (t && s === s && e === e) out.push({ s: s, e: e, t: t });
      });
    } else {
      src.split(/\n\s*\n/).forEach(function (block) {
        const lines = block.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
        const at = lines.findIndex(function (l) { return l.indexOf("-->") > 0; });
        if (at < 0) return;
        const parts = lines[at].split("-->"), s = stamp(parts[0]), e = stamp(parts[1]);
        const t = cleanLine(lines.slice(at + 1).join(" "));
        if (t && s === s && e === e) out.push({ s: s, e: e, t: t });
      });
    }
    return out.sort(function (a, b) { return a.s - b.s; });
  }
  // 刚放过的那一段（到此刻为止，不往后看——不替她剧透，也不让TA「预知」下一句）
  function recentLines(cues, at) {
    return (cues || []).filter(function (c) { return c.s <= at && c.s >= at - SUB_WINDOW; }).slice(-40).map(function (c) { return "[" + clock(c.s) + "] " + c.t; });
  }
  function cueAt(cues, at) {
    const list = cues || [];
    for (let i = list.length - 1; i >= 0; i--) { if (list[i].s <= at) return list[i].e >= at ? list[i].t : ""; }
    return "";
  }
  function grabFrame(video, maxW) {
    if (!video || !video.videoWidth) return "";
    const w = Math.min(maxW, video.videoWidth), hh = Math.round(video.videoHeight * w / video.videoWidth);
    const c = document.createElement("canvas"); c.width = w; c.height = hh;
    c.getContext("2d").drawImage(video, 0, 0, w, hh);
    try { return c.toDataURL("image/jpeg", 0.8); } catch (e) { return ""; }
  }
  function parseSay(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { const d = JSON.parse(m[0]); const arr = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []); return arr.map(function (x) { return String(x || "").trim(); }).filter(Boolean); } catch (e) {} }
    return s && !/^[\[{]/.test(s) ? [s] : [];
  }

  // ---- 模型：TA坐在旁边一起看 ----
  // mode：reply＝她说了一句；auto＝片子放着，TA想说就说（可以不说）；frame＝她截了一帧给TA看
  async function askPartner(p, char, film, cues, at, mode, text, frameUrl) {
    const uName = (p.profile && p.profile.name) || "对方";
    // 她刚说的这一句（或刚截的这一帧）已经先落进了记录，它是这一轮要回的话，不是「说过的」——从记录里摘掉，免得发两遍
    const past = (film.talk || []).slice();
    if ((mode === "reply" || mode === "frame") && past.length && past[past.length - 1].role === "user") past.pop();
    const talk = past.slice(-TALK_FEED).map(function (m) {
      return "[" + clock(m.at) + "] " + (m.role === "user" ? uName : char.name) + "：" + (m.frame ? "（截了一帧画面给你看）" : "") + String(m.content || "");
    }).join("\n");
    // 字幕挪过时间轴的话，按挪过的那条对（她 2026-09-25：「字幕对不上时轴」）
    const lines = recentLines(cues, at - (Number(film.subOffset) || 0));
    const sys = companionHead(p.ctxFor, char)
      + "【此刻】你和「" + uName + "」并排坐着，一起看电影《" + (film.title || "这部片子") + "》，现在放到 " + clock(at)
      + (film.duration ? " / " + clock(film.duration) : "") + "。你们在同一个屋子里，你说的话是说出口的，不是打字发过去的。\n"
      + (lines.length
        ? "【刚放过的台词（字幕，到此刻为止）】\n" + lines.join("\n") + "\n"
        : (cues && cues.length ? "【这一小段没有台词】\n" : "【这部片子没有字幕，你只知道她跟你说的、和她截给你看的画面】\n"))
      + (film.talkDigest ? "【你们前面看的时候聊过的（你自己记下的）】\n" + film.talkDigest + "\n" : "")
      + (talk ? "【你们看到现在说过的｜已经发生过的，不是这一轮要回的话】\n" + talk + "\n" : "")
      + "你只知道放到此刻为止的东西；后面会怎么演，就算你看过这部片子，也别替她剧透。\n"
      + (mode === "auto"
        ? "片子正放着，没人问你。你想说就说一两句（看到这儿你真有反应的时候），没什么想说的就给空数组——安静坐着一起看本来就是常态。\n"
        : "")
      + "只输出 JSON：{\"say\":[\"你说的话，一条一个气泡\"]}";
    const msg = mode === "auto" ? "（片子放着）"
      : mode === "auto-ask" ? "（她转过头来，想听你说两句看到这儿的想法）"
      : mode === "frame" ? ((text ? text + "\n" : "") + "（她把这一帧画面给你看）")
      : text;
    const raw = await callAI(p.active, sys, [{ role: "user", content: msg, imageDataUrls: frameUrl ? [frameUrl] : undefined }], { maxTokens: 65535 });
    return parseSay(raw);
  }
  // 把最早那一截折进这部片子自己的记录。⚠️它不是记忆：折完还是只活在这张票上，出门只有「记住」那一条路（同一起读）
  async function foldWatchTalk(p, char, film, rows) {
    const uName = (p.profile && p.profile.name) || "对方";
    const text = rows.map(function (m) { return "[" + clock(m.at) + "] " + (m.role === "user" ? uName : char.name) + "：" + (m.frame ? "（截了一帧）" : "") + String(m.content || ""); }).join("\n");
    if (!text.trim()) return String(film.talkDigest || "");
    const sys = companionHead(p.ctxFor, char)
      + "你在和「" + uName + "」一起看《" + (film.title || "这部片子") + "》。把下面这段你俩边看边说的话，"
      + "收成一小段【你自己会记住的记录】（第一人称，两三句）：你俩各自怎么看那一段、在哪儿意见不合、她提起的事、你们之间的小默契。别复述剧情，别写影评，别替她总结。"
      + (film.talkDigest ? "\n\n【之前已经记下的（不要重写它，只写这一次新添的）】\n" + film.talkDigest : "")
      + "\n\n只输出这一小段本身。";
    const seg = String(await callAI(p.active, sys, [{ role: "user", content: text }], { maxTokens: 65535 }) || "").trim();
    if (!seg) return String(film.talkDigest || "");
    return (window.ChatRooms && window.ChatRooms.digestMerge)
      ? window.ChatRooms.digestMerge(film.talkDigest || "", seg)
      : (String(film.talkDigest || "").trim() ? String(film.talkDigest).trim() + "\n\n" + seg : seg);
  }
  async function summarizeFilm(p, char, film) {
    const uName = (p.profile && p.profile.name) || "对方";
    const talk = (film.talk || []).slice(-40).map(function (m) { return "[" + clock(m.at) + "] " + (m.role === "user" ? uName : char.name) + "：" + String(m.content || ""); }).join("\n");
    if (!talk.trim() && !film.talkDigest) return "";
    const sys = companionHead(p.ctxFor, char) + (film.talkDigest ? "【你们前面看的时候聊过的（你自己记下的）】\n" + film.talkDigest + "\n\n" : "") + "把下面这次「你和 " + uName + " 一起看《" + (film.title || "一部电影") + "》」的经历，浓缩成 1~3 句会长期记住的事实（你的第一人称）："
      + "你们看了什么、看到哪儿、你对片子的关键看法、你俩看的时候碰出的话或默契、Ta 让你印象深的反应。只写沉淀下来的东西，别流水账、别复述剧情。只输出这几句话本身。";
    return String(await callAI(p.active, sys, [{ role: "user", content: talk || "（后半段没怎么说话）" }], { maxTokens: 65535 }) || "").trim();
  }

  // 改名（她 2026-09-25：片名是一串「copy_B8F7…」文件名，导进来之后没地方改）。票上那支笔、放映页点标题，两处都走这一个
  function renameFilm(f, done) {
    requestAppPrompt("给这部改个名", "", f.title || "", v => {
      const t = String(v || "").trim().slice(0, 40);
      if (!t) return;
      patchFilm(f.id, () => ({ title: t }));
      done && done(t);
    }, "改好了");
  }
  // ---- 小零件 ----
  function btn(label, onClick, opts) {
    const o = opts || {};
    return h("button", { onClick: onClick, disabled: o.disabled, className: "active:opacity-70 disabled:opacity-40", style: Object.assign({
      minHeight: 40, padding: "0 14px", borderRadius: 999, border: "1px solid " + (o.primary ? W.amber : W.line),
      background: o.primary ? W.amber : "rgba(255,255,255,.04)", color: o.primary ? W.amberInk : W.ink,
      fontFamily: F_BODY, fontSize: 13, whiteSpace: "nowrap", flexShrink: 0
    }, o.style || {}) }, label);
  }
  function shell(head, body) {
    return h("div", { className: "h-full flex flex-col", style: { background: "radial-gradient(120% 60% at 50% 0%, #2a2230 0%, " + W.bg + " 62%)", color: W.ink } }, head, body);
  }

  // ---- 片子卡：一张电影票（左边副券撕口、右边正券）----
  function Ticket(props) {
    const f = props.film, c = props.partner;
    const pct = f.duration ? Math.min(100, Math.round((f.pos || 0) / f.duration * 100)) : 0;
    const notch = { position: "absolute", left: 86, width: 16, height: 16, borderRadius: "50%", background: W.bg, marginLeft: -8 };
    return h("div", { style: { position: "relative", display: "flex", borderRadius: 14, background: "linear-gradient(135deg,#2e2835,#241f2b)", border: "1px solid " + W.line, overflow: "hidden", boxShadow: "0 10px 26px rgba(0,0,0,.35)" } },
      h("button", { onClick: props.onOpen, className: "active:opacity-80", style: { display: "flex", flex: 1, minWidth: 0, textAlign: "left", color: W.ink, background: "none", border: "none", padding: 0 } },
        // 副券：第几场＋看到几成
        h("div", { style: { width: 86, flexShrink: 0, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRight: "2px dashed rgba(255,255,255,.14)" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 11, letterSpacing: 2, color: W.amber } }, "放映"),
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: W.ink } }, pct ? pct + "%" : "新"),
          h("div", { style: { width: 46, height: 3, borderRadius: 2, background: "rgba(255,255,255,.1)", overflow: "hidden" } },
            h("div", { style: { width: pct + "%", height: "100%", background: W.amber } }))),
        h("div", { style: { flex: 1, minWidth: 0, padding: "14px 14px 12px" } },
          h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.35, color: W.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.title || "未命名的片子"),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: W.sub, marginTop: 5 } },
            (f.pos ? "看到 " + clock(f.pos) : "还没开场") + (f.duration ? " / " + clock(f.duration) : "") + (f.cueCount ? " · " + (f.inband ? "自带字幕 " : "字幕 ") + f.cueCount + " 句" : " · 没有字幕")),
          h("div", { className: "flex items-center gap-2", style: { marginTop: 9 } },
            c ? h(Avatar, { character: c, size: 22, radius: 11 }) : null,
            h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: c ? W.ink : W.fog } }, c ? "和 " + (c.remark || c.name) + " 一起" : "还没约人")))),
      h("div", { style: Object.assign({}, notch, { top: -8 }) }),
      h("div", { style: Object.assign({}, notch, { bottom: -8 }) }),
      h("div", { style: { width: 40, flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "center" } },
        h("button", { onClick: props.onRename, "aria-label": "改名", className: "active:opacity-60", style: { width: 40, height: 40, color: W.fog, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IPencil, { size: 15, color: W.fog })),
        h("button", { onClick: props.onDelete, "aria-label": "删掉这部", className: "active:opacity-60", style: { width: 40, height: 40, color: W.fog, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center" } }, h(IX, { size: 16, color: W.fog }))));
  }

  // ---- 导入：整页（施工规则/no-half-sheet.md）----
  function ImportPage(props) {
    const [video, setVideo] = useState(null), [sub, setSub] = useState(null), [title, setTitle] = useState(""), [busy, setBusy] = useState(false);
    const vRef = useRef(null), sRef = useRef(null);
    const pickVideo = f => { if (!f) return; setVideo(f); if (!title) setTitle(String(f.name || "").replace(/\.[^.]+$/, "").slice(0, 40)); };
    const go = async () => {
      if (!video || busy) return;
      setBusy(true);
      try {
        const id = "wf_" + Date.now().toString(36);
        let cues = [];
        if (sub) cues = parseSubs(decodeText(await sub.arrayBuffer()));
        if (sub && !cues.length) { props.toast && props.toast("这个字幕文件没读出台词，先不带字幕开场"); }
        await _store.put(id, video);
        await _store.put("cues:" + id, cues);
        const film = { id: id, title: title.trim() || "未命名的片子", createdAt: Date.now(), lastTs: Date.now(), size: video.size, type: video.type, pos: 0, duration: 0, cueCount: cues.length, partnerId: props.partnerId || "", talk: [] };
        saveFilms([film].concat(loadFilms()));
        props.onDone(id);
      } catch (e) {
        props.toast && props.toast("存不下这部：" + ((e && e.message) || "手机空间可能不够了"));
        setBusy(false);
      }
    };
    const row = (label, hint, file, onPick, ref, accept) => h("div", { style: { padding: "14px 16px", borderRadius: 14, background: W.card, border: "1px solid " + W.line } },
      h("div", { className: "flex items-center justify-between gap-3" },
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontFamily: F_BODY, fontSize: 14, color: W.ink } }, label),
          h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: file ? W.amber : W.fog, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, file ? file.name + " · " + sizeLabel(file.size) : hint)),
        btn(file ? "换一个" : "选文件", () => ref.current && ref.current.click())),
      h("input", { ref: ref, type: "file", accept: accept, style: { display: "none" }, onChange: e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; onPick(f); } }));
    return shell(
      h(Head, { zh: "导入一部电影", onBack: props.onBack, bg: "transparent", ink: W.ink }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "12px 16px 28px" } },
        h("div", { className: "space-y-3" },
          row("电影文件", "mp4 最稳；存在这台手机里，不会跟着云同步走", video, pickVideo, vRef, "video/*"),
          row("字幕（强烈建议）", "srt / vtt / ass。不选的话会先试着读视频里自带的字幕", sub, setSub, sRef, ".srt,.vtt,.ass,.ssa,.txt"),
          h("div", { style: { padding: "12px 16px", borderRadius: 14, background: W.card, border: "1px solid " + W.line } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: W.sub, marginBottom: 6 } }, "片名"),
            h("input", { value: title, onChange: e => setTitle(e.target.value), maxLength: 40, placeholder: "叫它什么", className: "w-full outline-none", style: { background: "transparent", border: "none", color: W.ink, fontFamily: F_DISPLAY, fontSize: 17 } }))),
        h("p", { style: { fontFamily: F_BODY, fontSize: 11.5, lineHeight: 1.8, color: W.fog, margin: "14px 4px" } },
          "TA 看不到画面本身，只读得到字幕；想让 TA 看画面的时候，放映时点「给 TA 看这一帧」（要你用的模型能识图）。"),
        h("div", { style: { display: "flex", justifyContent: "center", marginTop: 8 } },
          btn(busy ? "正在存进手机…" : "开场", go, { primary: true, disabled: !video || busy, style: { padding: "0 36px" } }))));
  }

  // ---- 约人 ----
  function PickPartner(props) {
    return h("div", { style: { padding: "18px 16px" } },
      h("div", { style: { fontFamily: F_DISPLAY, fontSize: 19, color: W.ink, marginBottom: 4 } }, "今晚和谁一起看"),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: W.fog, marginBottom: 14 } }, "选了之后这一部就是你们俩的"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(88px,1fr))", gap: 12 } },
        (props.characters || []).map(c => h("button", { key: c.id, onClick: () => props.onPick(c.id), className: "active:opacity-70", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "12px 6px", borderRadius: 14, background: W.card, border: "1px solid " + W.line, color: W.ink } },
          h(Avatar, { character: c, size: 48, radius: 24 }),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, c.remark || c.name)))));
  }

  // ---- 影院模式那一层：台词在下面、TA 的话浮在右上、角上一个退出和一个「说」 ----
  // ⚠️整层 pointer-events:none，只有按钮和输入框接手指：不然挡住原生播放控件
  const FLOAT_MS = 9000;
  function CinemaLayer(p) {
    const fresh = (p.talk || []).filter(m => m.role !== "user" && m.content && Date.now() - (m.ts || 0) < FLOAT_MS).slice(-3);
    const top = "calc(env(safe-area-inset-top) + 10px)";
    const pill = { pointerEvents: "auto", minHeight: 40, padding: "0 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,.2)", background: "rgba(0,0,0,.45)", color: "#fff", fontFamily: F_BODY, fontSize: 13, display: "flex", alignItems: "center", gap: 6, backdropFilter: "blur(6px)" };
    return h("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" } },
      h("button", { onClick: p.onExit, "aria-label": "退出影院模式", style: Object.assign({}, pill, { position: "absolute", left: "calc(env(safe-area-inset-left) + 12px)", top: top, width: 40, padding: 0, justifyContent: "center" }) }, h(IX, { size: 16, color: "#fff" })),
      h("button", { onClick: () => p.setSay(!p.say), style: Object.assign({}, pill, { position: "absolute", right: "calc(env(safe-area-inset-right) + 12px)", top: top }) }, p.say ? "收起" : "说一句"),
      p.say && h("div", { className: "flex items-center gap-2", style: { position: "absolute", left: "calc(env(safe-area-inset-left) + 64px)", right: "calc(env(safe-area-inset-right) + 96px)", top: top, pointerEvents: "auto" } },
        h("input", { autoFocus: true, value: p.txt, onChange: e => p.setTxt(e.target.value), onKeyDown: e => e.key === "Enter" && p.send(), placeholder: "小声说一句…", className: "flex-1 min-w-0 outline-none", style: { minHeight: 40, padding: "0 14px", borderRadius: 999, background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontFamily: F_BODY, fontSize: 16 } }),
        btn("说", p.send, { primary: true, disabled: p.busy || !String(p.txt || "").trim() })),
      // TA 刚说的话：浮在右上，九秒后自己淡掉
      h("div", { style: { position: "absolute", right: "calc(env(safe-area-inset-right) + 14px)", top: "calc(env(safe-area-inset-top) + 62px)", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, maxWidth: "58%" } },
        fresh.map((m, i) => h("div", { key: (m.ts || 0) + ":" + i, className: "flex items-center gap-2", style: { padding: "6px 12px 6px 6px", borderRadius: 999, background: "rgba(22,20,27,.72)", color: "#fff", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.45, backdropFilter: "blur(6px)", opacity: Math.max(0.25, 1 - (Date.now() - (m.ts || 0)) / FLOAT_MS * 0.6) } },
          p.partner ? h(Avatar, { character: p.partner, size: 24, radius: 12 }) : null,
          h("span", null, m.content))),
        p.busy && h("div", { style: { padding: "5px 12px", borderRadius: 999, background: "rgba(22,20,27,.6)", color: "rgba(255,255,255,.7)", fontFamily: F_BODY, fontSize: 12 } }, "…")),
      // 台词：画面下方，躲开原生进度条
      p.hasCues && p.line ? h("div", { style: { position: "absolute", left: 16, right: 16, bottom: "calc(env(safe-area-inset-bottom) + 64px)", textAlign: "center", color: "#fff", fontFamily: F_DISPLAY, fontSize: 17, lineHeight: 1.45, textShadow: "0 1px 3px #000, 0 0 8px rgba(0,0,0,.8)" } }, p.line) : null);
  }

  // ---- 放映 ----
  function Screening(props) {
    const id = props.filmId;
    const [film, setFilm] = useState(() => loadFilms().find(f => f.id === id) || null);
    const [src, setSrc] = useState(""), [cues, setCues] = useState([]), [now, setNow] = useState(0);
    const [busy, setBusy] = useState(false), [txt, setTxt] = useState(""), [missing, setMissing] = useState(false);
    const [auto, setAuto] = useState(() => loadJSON("x_watch_auto", true) !== false);
    const [toolsOpen, setToolsOpen] = useState(false);
    const [playErr, setPlayErr] = useState(false), [cinema, setCinema] = useState(false), [cinemaSay, setCinemaSay] = useState(false), [, setTick] = useState(0);
    const shellRef = useRef(null), foldingRef = useRef(false), fsRef = useRef(false);
    const [every, setEvery] = useState(() => { const n = Number(loadJSON("x_watch_auto_every", AUTO_DEFAULT)); return n >= AUTO_MIN && n <= AUTO_MAX ? n : AUTO_DEFAULT; });
    const vRef = useRef(null), listRef = useRef(null), lastAuto = useRef(0), lastSave = useRef(0), busyRef = useRef(false);
    const cuesRef = useRef([]), inbandSave = useRef(0);
    useEffect(() => { cuesRef.current = cues; }, [cues]);
    // 没单独导字幕的时候，先试视频里自带的字幕轨（她 2026-09-25：「字幕必须单独导吗」→「试试」）。
    // ⚠️网页读得到的只有【内封成独立一轨】的那种，而且只有部分浏览器给（苹果 Safari 对不少 mp4 给，
    //   安卓 Chrome 基本不给）；画进画面里的硬字幕根本不是字，读不到。
    // ⚠️内封轨的台词是【边放边到】的，不是一次全给——所以边放边收，攒一阵存一次。
    //   正好也不会越过此刻：放到哪才收到哪，跟单独导的字幕一样只喂「刚放过的」。
    const adoptInband = () => {
      const v = vRef.current;
      if (!v || !v.textTracks || (film && film.cueCount && !film.inband)) return;
      const tracks = Array.prototype.slice.call(v.textTracks).filter(t => t.kind === "subtitles" || t.kind === "captions");
      if (!tracks.length) return;
      const t = tracks.find(x => /^(zh|chi|chs|cht|cmn)/i.test(x.language || "")) || tracks[0];
      if (t.mode === "disabled") t.mode = "hidden";
      const pull = () => {
        const got = Array.prototype.slice.call(t.cues || []).map(c => ({ s: c.startTime, e: c.endTime, t: cleanLine(c.text) })).filter(c => c.t);
        const seen = {}, merged = cuesRef.current.concat(got).filter(c => { const k = c.s + "|" + c.t; if (seen[k]) return false; seen[k] = 1; return true; }).sort((a, b) => a.s - b.s);
        if (merged.length <= cuesRef.current.length) return;
        cuesRef.current = merged; setCues(merged);
        if (Date.now() - inbandSave.current > 20000) {
          inbandSave.current = Date.now();
          _store.put("cues:" + id, merged).catch(() => {});
          patchFilm(id, () => ({ cueCount: merged.length, inband: true }));
        }
      };
      t.oncuechange = pull; pull();
    };
    const partner = film && (props.characters || []).find(c => String(c.id) === String(film.partnerId));
    // 字幕挪时间轴：正数＝字幕往后推，负数＝往前提（她 2026-09-25）
    const off = Number(film && film.subOffset) || 0;
    const nudge = d => { const n = Math.round((off + d) * 2) / 2; patchFilm(id, () => ({ subOffset: n })); refresh(); };
    const line = cueAt(cues, now - off);
    // 影院模式：横屏铺满，TA 说的话浮在画面上（她 2026-09-25：全屏时看不到 TA 说话）
    const enterCinema = () => {
      setCinema(true); setToolsOpen(false);
      const el = shellRef.current;
      try {
        if (el && el.requestFullscreen) el.requestFullscreen().then(() => {
          fsRef.current = true;
          try { screen.orientation && screen.orientation.lock && screen.orientation.lock("landscape").catch(() => {}); } catch (e) {}
        }).catch(() => {});
      } catch (e) {}
    };
    const exitCinema = () => {
      setCinema(false); setCinemaSay(false);
      try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
      try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {}
      fsRef.current = false;
    };
    useEffect(() => {
      const onFs = () => { if (fsRef.current && !document.fullscreenElement) { fsRef.current = false; setCinema(false); setCinemaSay(false); } };
      document.addEventListener("fullscreenchange", onFs);
      return () => document.removeEventListener("fullscreenchange", onFs);
    }, []);
    // 浮在画面上的那几句要按时间消失：影院模式开着时每秒刷一下
    useEffect(() => { if (!cinema) return; const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, [cinema]);
    useEffect(() => {
      let url = "", alive = true;
      _store.get(id).then(blob => {
        if (!alive) return;
        if (!blob || typeof blob === "string") { setMissing(true); return; }
        url = URL.createObjectURL(blob); setSrc(url);
      }).catch(() => setMissing(true));
      _store.get("cues:" + id).then(c => { if (alive) setCues(Array.isArray(c) ? c : []); }).catch(() => {});
      return () => { alive = false; if (url) URL.revokeObjectURL(url); };
    }, [id]);
    useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [film && (film.talk || []).length, busy]);
    const refresh = () => setFilm(loadFilms().find(f => f.id === id) || null);
    const pushTalk = rows => { patchFilm(id, f => ({ talk: (f.talk || []).concat(rows).slice(-TALK_KEEP), lastTs: Date.now() })); refresh(); maybeFold(); };
    // 聊多了把最早那一截折成摘要；折的时候又来了新话也不怕——只删折进去的那几条（按 ts+内容认）
    const maybeFold = async () => {
      const cur = loadFilms().find(f => f.id === id);
      if (!cur || foldingRef.current || (cur.talk || []).length <= FOLD_AT || !partner || !props.active) return;
      foldingRef.current = true;
      const rows = cur.talk.slice(0, FOLD_TAKE), gone = {};
      rows.forEach(r => { gone[r.ts + "|" + r.role + "|" + (r.content || "")] = 1; });
      try {
        const digest = await foldWatchTalk(props, partner, cur, rows);
        patchFilm(id, f => ({ talkDigest: digest, talk: (f.talk || []).filter(r => !gone[r.ts + "|" + r.role + "|" + (r.content || "")]) }));
        refresh();
      } catch (e) {} finally { foldingRef.current = false; }
    };
    const savePos = force => {
      const v = vRef.current; if (!v) return;
      if (!force && Date.now() - lastSave.current < 5000) return;
      lastSave.current = Date.now();
      patchFilm(id, () => ({ pos: v.currentTime || 0, duration: v.duration && isFinite(v.duration) ? v.duration : (film && film.duration) || 0, lastTs: Date.now() }));
    };
    const ask = async (mode, text, frameUrl) => {
      if (!partner || busyRef.current) return;
      if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
      busyRef.current = true; setBusy(true);
      const at = vRef.current ? vRef.current.currentTime : 0;
      try {
        const cur = loadFilms().find(f => f.id === id) || film;
        const say = await askPartner(props, partner, cur, cues, at, mode, text, frameUrl);
        if (say.length) pushTalk(say.map(s => ({ role: "assistant", content: s, at: at, ts: Date.now() })));
        else if (mode !== "auto") props.toast && props.toast((partner.remark || partner.name) + " 看得入神，没出声");
      } catch (e) { props.toast && props.toast("没接上：" + ((e && e.message) || "重试一下")); }
      finally { busyRef.current = false; setBusy(false); }
    };
    const send = () => {
      const v = txt.trim(); if (!v || busy) return;
      const at = vRef.current ? vRef.current.currentTime : 0;
      pushTalk([{ role: "user", content: v, at: at, ts: Date.now() }]); setTxt("");
      ask("reply", v);
    };
    const showFrame = () => {
      const v = vRef.current; if (!v || busy) return;
      const full = grabFrame(v, 768), thumb = grabFrame(v, 240);
      if (!full) { props.toast && props.toast("这一帧截不下来"); return; }
      const say = txt.trim(); setTxt("");
      // 缩略图只留最近几张，别把存档撑大
      patchFilm(id, f => {
        let talk = (f.talk || []).concat([{ role: "user", content: say, at: v.currentTime, ts: Date.now(), frame: thumb }]).slice(-TALK_KEEP);
        let keep = FRAME_THUMBS;
        for (let i = talk.length - 1; i >= 0; i--) { if (talk[i].frame) { if (keep > 0) keep--; else talk[i] = Object.assign({}, talk[i], { frame: "gone" }); } }
        return { talk: talk };
      });
      refresh();
      ask("frame", say, full);
    };
    const onTime = () => {
      const v = vRef.current; if (!v) return;
      setNow(v.currentTime); savePos(false);
      if (auto && !v.paused && !busyRef.current && partner && props.active && cues.length && v.currentTime - lastAuto.current >= every * 60) {
        lastAuto.current = v.currentTime; ask("auto");
      }
    };
    const remember = () => requestAppConfirm("把这次记下来？", "TA 会把你们一起看这部、看的时候说的话，收成一两句记进记忆里。", async () => {
      try {
        const text = await summarizeFilm(props, partner, loadFilms().find(f => f.id === id) || film);
        if (!text) { props.toast && props.toast("你们还没怎么说话，没什么可记的"); return; }
        props.onAddMemory && props.onAddMemory(text, partner.id);
        props.toast && props.toast("记住了");
      } catch (e) { props.toast && props.toast("没记上：" + ((e && e.message) || "")); }
    }, "记下来");
    if (!film) return shell(h(Head, { zh: "一起看", onBack: props.onBack, bg: "transparent", ink: W.ink }), h("p", { style: { padding: 20, color: W.sub } }, "这部片子找不到了。"));
    const head = h(Head, { zh: film.title || "一起看", sub: partner ? "和 " + (partner.remark || partner.name) + " 一起看" : "", onBack: () => { savePos(true); props.onBack(); }, bg: "transparent", ink: W.ink,
      onTitleTap: () => renameFilm(film, refresh),
      right: partner && (film.talk || []).length ? h("button", { onClick: remember, className: "active:opacity-60", style: { minHeight: 40, padding: "0 6px", fontFamily: F_BODY, fontSize: 13, color: W.amber } }, "记住") : null });
    if (!partner) return shell(head, h("div", { className: "flex-1 min-h-0 overflow-y-auto" }, h(PickPartner, { characters: props.characters, onPick: cid => { patchFilm(id, () => ({ partnerId: cid })); refresh(); } })));
    const talk = film.talk || [];
    return shell(head,
      h("div", { className: "flex-1 min-h-0 flex flex-col" },
        // 银幕
        h("div", { ref: shellRef, style: cinema
            ? { position: "fixed", inset: 0, zIndex: 99990, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }
            : { position: "relative", flexShrink: 0, background: "#000", boxShadow: "0 12px 30px rgba(0,0,0,.45)" } },
          // 放不出来的格式：别只黑着（她 2026-09-25）
          playErr && !missing ? h("div", { style: { aspectRatio: "16/9", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.8, color: W.sub } },
            "这台手机放不了这个格式（常见的是 mkv、avi）。换成 mp4 再导一次就好——用转格式的软件选「只换封装」，一两分钟，画质不变。") : null,
          missing
            ? h("div", { style: { aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: W.sub } }, "这台手机里没有这部片子的文件了（换过设备或清过数据）。删掉这张票重新导入就好，聊过的话还在。")
            : h("video", { ref: vRef, src: src || undefined, controls: true, playsInline: true, preload: "metadata",
                onLoadedMetadata: e => { const v = e.target; if (film.pos && film.pos < (v.duration || Infinity) - 3) v.currentTime = film.pos; lastAuto.current = film.pos || 0; savePos(true); adoptInband(); if (v.textTracks) v.textTracks.onaddtrack = adoptInband; },
                onTimeUpdate: onTime, onPause: () => { savePos(true); if (film.inband || (!film.cueCount && cuesRef.current.length)) { _store.put("cues:" + id, cuesRef.current).catch(() => {}); patchFilm(id, () => ({ cueCount: cuesRef.current.length, inband: true })); } },
                onError: () => setPlayErr(true),
                style: cinema
                  ? { display: playErr ? "none" : "block", width: "100%", height: "100%", maxHeight: "none", objectFit: "contain", background: "#000" }
                  : { display: playErr ? "none" : "block", width: "100%", maxHeight: "42vh", background: "#000" } }),
          cinema && h(CinemaLayer, { line: line, hasCues: !!cues.length, talk: film.talk || [], partner: partner, busy: busy, txt: txt, setTxt: setTxt, send: send, say: cinemaSay, setSay: setCinemaSay, onExit: exitCinema })),
        // 台词条：现在银幕上这一句。没有字幕的片子整条不出现（她 2026-09-25：「没有字幕的提示也删了省空间」）
        cues.length ? h("div", { style: { flexShrink: 0, minHeight: 36, padding: "7px 18px", textAlign: "center", fontFamily: F_DISPLAY, fontSize: 14, lineHeight: 1.5, color: W.ink, borderBottom: "1px solid " + W.line } }, line) : null,
        // 你们说的话
        h("div", { ref: listRef, className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 14px 12px" } },
          !talk.length && h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: W.fog, padding: "22px 10px", lineHeight: 1.8 } }, "片子放起来，想说什么就说。\nTA 看到有感觉的地方也会自己冒一句。"),
          talk.map((m, i) => {
            const mine = m.role === "user";
            return h("div", { key: i, className: "flex " + (mine ? "justify-end" : "justify-start") + " gap-2", style: { margin: "8px 0" } },
              !mine && h(Avatar, { character: partner, size: 28, radius: 14 }),
              h("div", { style: { maxWidth: "76%" } },
                m.frame && m.frame !== "gone" ? h("img", { src: m.frame, alt: "截的那一帧", style: { display: "block", width: 160, borderRadius: 10, marginBottom: m.content ? 5 : 0, marginLeft: "auto", border: "2px solid rgba(255,255,255,.1)" } }) : null,
                m.frame === "gone" ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: W.fog, textAlign: "right" } }, "（截过一帧）") : null,
                m.content ? h("div", { style: { padding: "8px 12px", borderRadius: mine ? "14px 4px 14px 14px" : "4px 14px 14px 14px", background: mine ? W.amber : W.card, color: mine ? W.amberInk : W.ink, fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", border: mine ? "none" : "1px solid " + W.line } }, m.content) : null,
                h("div", { style: { fontFamily: F_BODY, fontSize: 10, color: W.fog, marginTop: 3, textAlign: mine ? "right" : "left" } }, clock(m.at))));
          }),
          busy && h("div", { className: "flex items-center gap-2", style: { margin: "8px 0", color: W.fog, fontFamily: F_BODY, fontSize: 12 } }, h(Avatar, { character: partner, size: 28, radius: 14 }), (partner.remark || partner.name) + " 在想…")),
        // 手边那几样收进输入框左边的「＋」（她 2026-09-25：「做可以收起来上面那几个按键不然太挤了」）：
        //   跟聊天的加号面板一个意思，平时不占地方，要用才展开在输入框上面
        toolsOpen && h("div", { style: { flexShrink: 0, borderTop: "1px solid " + W.line, background: "rgba(31,28,38,.96)" } },
          h("div", { className: "flex items-center gap-2", style: { padding: "10px 12px 2px", overflowX: "auto" } },
          btn("给 TA 看这一帧", showFrame, { disabled: busy || missing }),
          btn("让 TA 说两句", () => ask("auto-ask"), { disabled: busy }),
          btn("影院模式", enterCinema, { disabled: missing || playErr }),
          h("button", { onClick: () => { const n = !auto; setAuto(n); saveJSON("x_watch_auto", n); }, "aria-pressed": String(auto), className: "active:opacity-70", style: { minHeight: 40, padding: "0 12px", borderRadius: 999, flexShrink: 0, border: "1px dashed " + (auto ? W.amber : W.line), background: "none", color: auto ? W.amber : W.fog, fontFamily: F_BODY, fontSize: 12, whiteSpace: "nowrap" } }, auto ? "TA 会自己开口" : "TA 不主动说话")),
          auto && h("div", { className: "flex items-center gap-3", style: { padding: "0 16px 4px" } },
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: W.fog, whiteSpace: "nowrap" } }, "话多"),
          // 轨道自己画：全局样式把原生的轨抹掉了，只剩一个圆点
          h("div", { style: { position: "relative", flex: 1, minWidth: 0, height: 40 } },
            h("div", { style: { position: "absolute", left: 0, right: 0, top: 18, height: 4, borderRadius: 2, background: "rgba(255,255,255,.12)" } },
              h("div", { style: { width: ((every - AUTO_MIN) / (AUTO_MAX - AUTO_MIN) * 100) + "%", height: "100%", borderRadius: 2, background: W.amber } })),
            h("input", { type: "range", min: AUTO_MIN, max: AUTO_MAX, step: 1, value: every, "aria-label": "TA 多久可能自己开一次口",
              onChange: e => { const n = Number(e.target.value); setEvery(n); saveJSON("x_watch_auto_every", n); },
              style: { position: "absolute", inset: 0, width: "100%", height: 40, margin: 0, padding: 0, border: "none", boxShadow: "none", background: "transparent", accentColor: W.amber } })),
          h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: W.fog, whiteSpace: "nowrap" } }, "话少"),
          h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: W.amber, minWidth: 58, textAlign: "right", whiteSpace: "nowrap" } }, "约 " + every + " 分钟")),
          // 字幕对不上画面时挪一挪（有字幕才出来）
          cues.length ? h("div", { className: "flex items-center gap-2", style: { padding: "0 12px 8px" } },
            h("span", { style: { fontFamily: F_BODY, fontSize: 11.5, color: W.fog, whiteSpace: "nowrap", paddingLeft: 4 } }, "字幕"),
            btn("提前 0.5 秒", () => nudge(-0.5), { style: { fontSize: 12, padding: "0 10px" } }),
            h("span", { style: { flex: 1, minWidth: 0, textAlign: "center", fontFamily: F_BODY, fontSize: 12, color: off ? W.amber : W.fog, whiteSpace: "nowrap" } },
              off === 0 ? "对得上" : (off < 0 ? "提前 " + (-off) + " 秒" : "推后 " + off + " 秒")),
            btn("推后 0.5 秒", () => nudge(0.5), { style: { fontSize: 12, padding: "0 10px" } })) : null),
        // 输入
        h("div", { className: "flex items-center gap-2", style: { flexShrink: 0, borderTop: "1px solid " + W.line, background: "rgba(22,20,27,.92)", paddingTop: 10, paddingBottom: COMPOSER_PAD_BOTTOM, paddingLeft: "calc(12px + env(safe-area-inset-left))", paddingRight: "calc(12px + env(safe-area-inset-right))" } },
          h("button", { onClick: () => setToolsOpen(!toolsOpen), "aria-label": toolsOpen ? "收起" : "更多", "aria-expanded": String(toolsOpen), className: "active:opacity-60", style: { width: 40, height: 40, flexShrink: 0, borderRadius: "50%", border: "1px solid " + (toolsOpen ? W.amber : W.line), background: "none", color: toolsOpen ? W.amber : W.sub, fontSize: 22, lineHeight: 1, transform: toolsOpen ? "rotate(45deg)" : "none", transition: "transform .15s" } }, "+"),
          h("input", { value: txt, onChange: e => setTxt(e.target.value), onKeyDown: e => e.key === "Enter" && send(), placeholder: "小声说一句…", className: "flex-1 min-w-0 outline-none", style: { minHeight: 40, padding: "0 14px", borderRadius: 999, background: W.card, border: "1px solid " + W.line, color: W.ink, fontFamily: F_BODY, fontSize: 16 } }),
          btn("说", send, { primary: true, disabled: busy || !txt.trim() }))));
  }

  // ---- 入口 ----
  function WatchTogether(props) {
    const [view, setView] = useState("shelf");   // shelf | import | 片子 id
    const [films, setFilms] = useState(loadFilms);
    const chars = props.characters || [];
    const back = () => { setFilms(loadFilms()); setView("shelf"); };
    const del = f => requestAppConfirm("删掉《" + (f.title || "这部") + "》？", "电影文件只存在这台手机上，删了要重新导入；你们看的时候说的话也会一起删掉（已经「记住」进记忆里的不受影响）。", async () => {
      try { await _store.del(f.id); await _store.del("cues:" + f.id); } catch (e) {}
      saveFilms(loadFilms().filter(x => x.id !== f.id)); setFilms(loadFilms());
    }, "删掉");
    if (view === "import") return h(ImportPage, { toast: props.toast, onBack: back, onDone: fid => { setFilms(loadFilms()); setView(fid); } });
    if (view !== "shelf") return h(Screening, Object.assign({}, props, { filmId: view, onBack: back }));
    const sorted = films.slice().sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    return shell(
      h(Head, { zh: "一起看", sub: "放映厅", onBack: props.onBack, bg: "transparent", ink: W.ink }),
      h("div", { className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "8px 16px 28px" } },
        // 幕布：进门先看到的那一块
        h("div", { style: { position: "relative", borderRadius: 18, padding: "22px 18px 18px", marginBottom: 18, overflow: "hidden", background: "linear-gradient(180deg,#5a2531 0%,#3a1a24 100%)", boxShadow: "inset 0 -18px 30px rgba(0,0,0,.35), 0 12px 28px rgba(0,0,0,.35)" } },
          h("div", { style: { position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 2px, transparent 2px 22px)", pointerEvents: "none" } }),
          h("div", { style: { position: "relative" } },
            h("div", { style: { fontFamily: F_DISPLAY, fontSize: 22, color: "#fbeee0" } }, "今晚放什么"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: "rgba(251,238,224,.72)", margin: "6px 0 14px" } }, "导一部电影和它的字幕进来，约一个人坐你旁边。放到哪，TA 就看到哪。"),
            btn("导入一部电影", () => setView("import"), { primary: true }))),
        sorted.length
          ? h("div", { className: "space-y-3" }, sorted.map(f => h(Ticket, { key: f.id, film: f, partner: chars.find(c => String(c.id) === String(f.partnerId)), onOpen: () => setView(f.id), onDelete: () => del(f), onRename: () => renameFilm(f, () => setFilms(loadFilms())) })))
          : h("div", { style: { textAlign: "center", fontFamily: F_BODY, fontSize: 12.5, color: W.fog, padding: "26px 0" } }, "票夹还是空的")));
  }
  window.WatchTogether = WatchTogether;
  // 给测试用：纯函数
  window.WatchKit = { parseSubs: parseSubs, recentLines: recentLines, cueAt: cueAt, clock: clock, parseSay: parseSay };
})();
