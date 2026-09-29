// ============================================================
// 一起听·边听边说（她 2026-09-29：「有人说一起听想做成这样」——网易云那种两只头像挂在唱片上、
//   谁说话谁冒气泡）。跟「一起看」同一个形状：上下文走 companionHead（整份 buildBundle），
//   离开时往单聊落一条 listenlog 交接，话术只写在 listenLogText 一处。
// ⚠️自己开口按次花钱：一首歌最多一句、两句之间至少隔 AUTO_GAP_S 秒；总闸在
//   设置 → 自动生成 →「一起听时开口」，页面上那颗是同一格（window.__setAutoFromPage）。
// ============================================================
(function () {
  const h = React.createElement, useState = React.useState, useEffect = React.useEffect, useRef = React.useRef;
  const KEY = "x_listenTalk";   // { [charId]: { talk:[{role,content,ts,song}] } }
  const KEEP = 40, FEED = 12, SHOW = 3, AUTO_GAP_S = 90, BUBBLE_MS = 9000;

  function load() { const v = loadJSON(KEY, {}); return v && typeof v === "object" ? v : {}; }
  function talkOf(charId) { const r = load()[charId]; return (r && Array.isArray(r.talk)) ? r.talk : []; }
  function push(charId, rows) {
    const all = load(), cur = talkOf(charId);
    all[charId] = { talk: cur.concat(rows).slice(-KEEP) };
    saveJSON(KEY, all);
  }

  // 回到单聊时那一句（单聊回话、recentChat、聊天卡片三处都调它）
  function listenLogText(m, uName, cName) {
    const u = uName || "她", c = cName || "你";
    const said = (m.lines || []).map(function (x) { return (x.who === "user" ? u : c) + "：" + String(x.text || ""); }).join("\n");
    return "【你们俩刚在「一起听」里戴着同一副耳机听了一会儿歌" + ((m.songs || []).length ? "：" + m.songs.map(function (s) { return "《" + s + "》"; }).join("、") : "")
      + "。这件事发生在这个位置，现在回到了聊天】" + (said ? "\n【当时边听边说的最后几句·原话】\n" + said : "");
  }

  function parseSay(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { const d = JSON.parse(m[0]); const arr = Array.isArray(d.say) ? d.say : (d.say ? [d.say] : []); return arr.map(function (x) { return String(x || "").trim(); }).filter(Boolean); } catch (e) {} }
    return s && !/^[\[{]/.test(s) ? [s] : [];
  }

  // mode：reply＝她说了一句；auto＝歌放着，TA想说就说（可以不说）
  async function askListen(p, char, song, lyric, mode, text) {
    const uName = (p.profile && p.profile.name) || "对方";
    const past = talkOf(char.id).slice();
    if (mode === "reply" && past.length && past[past.length - 1].role === "user") past.pop();
    const talk = past.slice(-FEED).map(function (m) { return (m.role === "user" ? uName : char.name) + "：" + String(m.content || "") + (m.song ? "（在放《" + m.song + "》时）" : ""); }).join("\n");
    const sys = companionHead(p.ctxFor, char)
      + "【此刻】你和「" + uName + "」戴着同一副耳机在一起听歌，正放着《" + (song.title || "这首歌") + "》" + (song.artist ? " - " + song.artist : "")
      + (lyric.at ? "，放到 " + lyric.at : "") + "。你们在一起，你说的话是说出口的。\n"
      + (lyric.lines.length ? "【刚唱过的几句词（到此刻为止）】\n" + lyric.lines.join("\n") + "\n" : "【这一段没有歌词可看，你只听得到旋律】\n")
      + (talk ? "【你们刚才边听边说过的｜已经发生过的，不是这一轮要回的话】\n" + talk + "\n" : "")
      + (mode === "auto"
        ? "歌正放着，没人问你。这一段你真有反应才说一两句，没什么想说的就给空数组——安静一起听本来就是常态。\n"
        : "")
      + "一条就是一个气泡，短一点，像凑在耳边说的话。只输出 JSON：{\"say\":[\"你说的话\"]}";
    const msg = mode === "auto" ? "（歌放着）" : text;
    const raw = await callAI(p.active, sys, [{ role: "user", content: msg }], { maxTokens: 65535 });
    return parseSay(raw);
  }

  function lyricWindow(lines, active, cur) {
    const out = [];
    if (Array.isArray(lines) && active >= 0) for (let i = Math.max(0, active - 5); i <= active; i++) if (lines[i] && lines[i].text) out.push(lines[i].text);
    const s = Math.max(0, Math.floor(cur || 0));
    return { lines: out, at: s ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : "" };
  }

  // 播放页上那一块：两只头像挂在封面上方，谁说话谁冒气泡；底下一行小输入
  // props：partner, profile, song, player{t,dur,playing}, lyricLines, lyricActive, active, ctxFor, toast, t(主题)
  function ListenTalk(props) {
    const partner = props.partner, song = props.song, t = props.t;
    const [rows, setRows] = useState(() => partner ? talkOf(partner.id) : []);
    const [txt, setTxt] = useState("");
    const [busy, setBusy] = useState(false);
    const [, setTick] = useState(0);
    const busyRef = useRef(false), lastAutoRef = useRef(0), spokeForRef = useRef({}), visitRef = useRef({ at: Date.now(), songs: [] });
    const autoOn = () => !!(window.__autoRefreshOn && window.__autoRefreshOn("listen"));
    const [auto, setAuto] = useState(autoOn);
    useEffect(() => { setRows(partner ? talkOf(partner.id) : []); }, [partner && partner.id]);
    // 气泡按时间淡掉：有气泡挂着时每秒刷一下
    useEffect(() => { const iv = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(iv); }, []);
    useEffect(() => { if (song && song.title && visitRef.current.songs.indexOf(song.title) < 0) visitRef.current.songs.push(song.title); }, [song && song.id]);
    // 离开这一页：这一趟真说过话，往单聊落一条交接
    useEffect(() => () => {
      if (!partner || !props.onHandoff) return;
      const said = talkOf(partner.id).filter(r => (r.ts || 0) >= visitRef.current.at && r.content).slice(-10);
      if (!said.length) return;
      props.onHandoff(partner.id, { role: "system", kind: "listenlog", songs: visitRef.current.songs.slice(-5),
        lines: said.map(r => ({ who: r.role === "user" ? "user" : "assistant", text: r.content })),
        content: "一起听了 " + visitRef.current.songs.slice(-3).map(s => "《" + s + "》").join("") , ts: Date.now() });
    }, [partner && partner.id]);

    const add = list => { if (!partner) return; push(partner.id, list); setRows(talkOf(partner.id)); };
    const ask = async (mode, text) => {
      if (!partner || !song || busyRef.current) return;
      if (!props.active) { props.toast && props.toast("请先到设置配置 API"); return; }
      busyRef.current = true; setBusy(true);
      try {
        const lw = lyricWindow(props.lyricLines, props.lyricActive, props.player && props.player.t);
        const say = await askListen(props, partner, song, lw, mode, text);
        if (say.length) add(say.map(s => ({ role: "assistant", content: s, ts: Date.now(), song: song.title || "" })));
        else if (mode !== "auto") props.toast && props.toast((partner.remark || partner.name) + " 听得入神，没出声");
      } catch (e) { if (mode !== "auto") props.toast && props.toast("没接上：" + ((e && e.message) || "重试一下")); }
      finally { busyRef.current = false; setBusy(false); }
    };
    // 自己开口：一首歌最多一句，放到四分之一以后、剩下三成以前，两句之间至少隔 AUTO_GAP_S 秒
    const pl = props.player || {};
    useEffect(() => {
      if (!auto || !autoOn() || !partner || !song || !pl.playing || !pl.dur || busyRef.current || !props.active) return;
      if (spokeForRef.current[song.id]) return;
      const f = pl.t / pl.dur;
      if (f < 0.25 || f > 0.7) return;
      if (Date.now() - lastAutoRef.current < AUTO_GAP_S * 1000) return;
      spokeForRef.current[song.id] = 1; lastAutoRef.current = Date.now();
      ask("auto");
    }, [Math.floor(pl.t || 0), auto]);

    const send = () => {
      const v = txt.trim(); if (!v || busy || !partner) return;
      add([{ role: "user", content: v, ts: Date.now(), song: (song && song.title) || "" }]); setTxt("");
      ask("reply", v);
    };
    const flip = () => { const n = !auto; setAuto(n); if (window.__setAutoFromPage) window.__setAutoFromPage("listen", null, n); };
    if (!partner) return null;

    const now = Date.now();
    const live = rows.filter(r => now - (r.ts || 0) < BUBBLE_MS).slice(-SHOW);
    const mine = live.filter(r => r.role === "user"), theirs = live.filter(r => r.role !== "user");
    const bubble = (r, i, side) => h("div", { key: (r.ts || 0) + "_" + i, style: {
        maxWidth: 150, padding: "7px 11px", borderRadius: 14, marginTop: 6, background: "rgba(255,255,255,.88)", color: "#2d2a26",
        boxShadow: "0 3px 10px rgba(30,28,24,.14)", fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.5, wordBreak: "break-word",
        [side === "l" ? "borderTopRightRadius" : "borderTopLeftRadius"]: 4,
        opacity: Math.max(0.25, 1 - Math.max(0, now - (r.ts || 0) - BUBBLE_MS * 0.6) / (BUBBLE_MS * 0.4)), transition: "opacity .6s" } }, r.content);
    const me = props.profile || {};
    const head = (who, isMe) => h("div", { style: { width: 54, height: 54, borderRadius: 999, padding: 2, background: "rgba(255,255,255,.7)", boxShadow: "0 4px 12px rgba(30,28,24,.2)" } },
      isMe ? (me.avatarImage ? h("img", { src: typeof resolveImg === "function" ? resolveImg(me.avatarImage) : me.avatarImage, alt: "", style: { width: 50, height: 50, borderRadius: 999, objectFit: "cover" } })
        : h("div", { style: { width: 50, height: 50, borderRadius: 999, background: t.bg2, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_DISPLAY, fontSize: 18, color: t.ink } }, String(me.name || "我").slice(0, 1)))
        : h(Avatar, { character: who, size: 50, radius: 999 }));
    // 两只头像之间那根耳机线
    const stage = h("div", { style: { position: "relative", display: "flex", justifyContent: "center", gap: 0, paddingTop: 8 } },
      h("svg", { "aria-hidden": "true", width: 150, height: 40, viewBox: "0 0 150 40", style: { position: "absolute", top: 0, left: "50%", marginLeft: -75, pointerEvents: "none" } },
        h("path", { d: "M22 36 C22 4, 128 4, 128 36", fill: "none", stroke: t.ink, strokeOpacity: .35, strokeWidth: 2.2, strokeLinecap: "round" })),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", width: "50%", paddingRight: 4 } },
        h("div", { style: { marginRight: 8 } }, head(null, true)), mine.map((r, i) => bubble(r, i, "l"))),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-start", width: "50%", paddingLeft: 4 } },
        h("div", { style: { marginLeft: 8 } }, head(partner, false)), theirs.map((r, i) => bubble(r, i, "r")),
        busy ? h("div", { style: { marginTop: 6, fontFamily: F_BODY, fontSize: 11, color: t.fog } }, "…") : null));
    const bar = h("div", { className: "flex items-center", style: { gap: 8, width: "100%", maxWidth: 340, marginTop: 14 } },
      h("input", { value: txt, onChange: e => setTxt(e.target.value), onKeyDown: e => { if (e.key === "Enter") send(); },
        placeholder: "凑过去跟 " + (partner.remark || partner.name) + " 说一句",
        style: { flex: 1, minWidth: 0, height: 38, borderRadius: 999, border: "1px solid " + t.line, background: t.bg2, color: t.ink, padding: "0 14px", fontFamily: F_BODY, fontSize: 13, outline: "none" } }),
      h("button", { onClick: send, disabled: busy || !txt.trim(), className: "active:opacity-70",
        style: { height: 38, padding: "0 14px", borderRadius: 999, background: t.ink, color: t.bg, fontFamily: F_BODY, fontSize: 13, opacity: busy || !txt.trim() ? .45 : 1 } }, "说"),
      h("button", { onClick: flip, "aria-pressed": String(auto), className: "active:opacity-70",
        style: { height: 38, padding: "0 10px", borderRadius: 999, border: "1px dashed " + (auto ? (t.accent || t.ink) : t.line), color: auto ? (t.accent || t.ink) : t.fog, fontFamily: F_BODY, fontSize: 11.5, whiteSpace: "nowrap" } },
        auto ? "TA 会开口" : "TA 不开口"));
    return { stage: stage, bar: bar };
  }

  window.ListenTalk = { KEY, listenLogText, askListen, lyricWindow, parseSay, useTalk: ListenTalk };
  window.listenLogText = listenLogText;
})();
