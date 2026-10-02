(function (root) {
  "use strict";

  // 电台的材质、刻度和录音标签共用一套；舞台沿用通话页的 flex 层级和 Avatar。
  const RADIO_LIFE_CSS = `
[data-radio-life] { --rl-edge:rgba(228,190,143,.22); --rl-dim:rgba(241,217,188,.57); font-family:var(--f-body,sans-serif); }
[data-radio-life] * { box-sizing:border-box; }
[data-radio-life] .rl-panel { background:linear-gradient(145deg,rgba(238,197,151,.055),rgba(0,0,0,.09)); border:1px solid var(--rl-edge); border-radius:4px 4px 18px 4px; padding:20px; margin-bottom:18px; }
[data-radio-life] .rl-eyebrow { font-size:10px; letter-spacing:2px; color:var(--rl-accent); }
[data-radio-life] .rl-title { font-family:var(--f-display,serif); font-size:22px; font-weight:400; line-height:1.4; }
[data-radio-life] .rl-copy { font-size:12px; line-height:1.9; color:var(--rl-dim); }
[data-radio-life] .rl-field { display:block; width:100%; min-height:44px; padding:10px 2px; color:var(--rl-ink); background:transparent; border:0; border-bottom:1px solid var(--rl-edge); border-radius:0; outline:none; font-size:14px; }
[data-radio-life] .rl-field:focus { border-bottom-color:var(--rl-accent); }
[data-radio-life] .rl-label { display:block; font-size:10px; letter-spacing:1px; color:var(--rl-dim); margin:18px 0; }
[data-radio-life] .rl-label > span { display:block; margin-bottom:4px; }
[data-radio-life] .rl-button { min-height:44px; padding:9px 16px; border:1px solid var(--rl-edge); border-radius:3px; background:linear-gradient(180deg,rgba(248,222,189,.1),rgba(145,108,81,.06)); color:var(--rl-ink); font-size:12px; cursor:pointer; }
[data-radio-life] .rl-button:disabled { opacity:.4; cursor:default; }
[data-radio-life] button:focus-visible,[data-radio-life] [tabindex]:focus-visible { outline:2px solid var(--rl-accent); outline-offset:-2px; }
[data-radio-life] .rl-switches { display:flex; margin:8px 22px 0; border:1px solid var(--rl-edge); border-radius:4px; padding:3px; background:rgba(0,0,0,.22); box-shadow:inset 0 1px 5px rgba(0,0,0,.3); flex-shrink:0; }
[data-radio-life] .rl-switch { flex:1; min-height:50px; border:0; position:relative; padding:9px 4px; color:var(--rl-dim); background:transparent; font-size:11px; letter-spacing:1px; }
[data-radio-life] .rl-switch + .rl-switch { border-left:1px solid var(--rl-edge); }
[data-radio-life] .rl-switch::before { content:''; display:block; width:16px; height:2px; margin:0 auto 6px; background:rgba(223,177,121,.2); border-radius:1px; }
[data-radio-life] .rl-switch[aria-pressed=true] { color:var(--rl-ink); transform:translateY(1px); background:linear-gradient(180deg,rgba(232,194,149,.1),rgba(232,194,149,.025)); box-shadow:inset 0 2px 7px rgba(0,0,0,.32); }
[data-radio-life] .rl-switch[aria-pressed=true]::before { width:25px; background:var(--rl-accent); box-shadow:0 0 8px rgba(242,177,96,.3); }
[data-radio-life] .rl-receiver { position:relative; padding:24px 18px 20px; border:1px solid var(--rl-edge); border-radius:14px; background:linear-gradient(150deg,rgba(122,84,65,.2),rgba(17,12,12,.2)); box-shadow:inset 0 1px 0 rgba(248,221,184,.08),0 12px 30px rgba(0,0,0,.15); }
[data-radio-life] .rl-receiver::before,[data-radio-life] .rl-receiver::after { content:''; position:absolute; top:10px; width:3px; height:3px; border-radius:50%; background:rgba(225,189,142,.3); box-shadow:0 0 0 2px rgba(0,0,0,.2); }
[data-radio-life] .rl-receiver::before { left:10px; } [data-radio-life] .rl-receiver::after { right:10px; }
[data-radio-life] .rl-serial { display:flex; justify-content:space-between; align-items:center; font-size:9px; letter-spacing:1.5px; color:var(--rl-dim); }
[data-radio-life] .rl-dot { display:inline-block; width:5px; height:5px; margin-right:7px; border-radius:50%; background:var(--rl-accent); box-shadow:0 0 9px rgba(242,177,96,.4); }
[data-radio-life] .rl-frequency { display:flex; justify-content:center; align-items:baseline; gap:8px; margin:23px 0 17px; }
[data-radio-life] .rl-frequency strong { font-family:ui-monospace,Menlo,monospace; font-size:52px; font-weight:300; letter-spacing:-3px; color:var(--rl-accent); text-shadow:0 0 20px rgba(243,176,96,.18); }
[data-radio-life] .rl-frequency small { font-size:9px; letter-spacing:1px; color:var(--rl-dim); }
[data-radio-life] .rl-dial { position:relative; padding:12px 5px 7px; border-top:1px solid var(--rl-edge); border-bottom:1px solid var(--rl-edge); }
[data-radio-life] .rl-ticks { display:flex; justify-content:space-between; align-items:flex-end; height:24px; }
[data-radio-life] .rl-ticks i { display:block; width:1px; height:8px; background:rgba(215,178,137,.33); }
[data-radio-life] .rl-ticks i:nth-child(5n+1) { height:20px; background:rgba(215,178,137,.58); }
[data-radio-life] .rl-needle { position:absolute; top:7px; height:32px; width:2px; background:var(--rl-accent); box-shadow:0 0 9px rgba(244,175,86,.45); transition:left .45s ease; }
[data-radio-life] .rl-scale { display:flex; justify-content:space-between; font-family:ui-monospace,monospace; font-size:8px; color:var(--rl-dim); margin-top:8px; }
[data-radio-life] .rl-person { display:flex; align-items:center; gap:13px; margin:22px 0 16px; }
[data-radio-life] .rl-person .rl-label { flex:1; min-width:0; margin:0; }
[data-radio-life] .rl-person .rl-field { font-family:var(--f-display,serif); font-size:18px; padding-left:0; }
[data-radio-life] .rl-schedule { border-top:1px dashed var(--rl-edge); padding-top:16px; font-size:13px; line-height:1.8; }
[data-radio-life] .rl-schedule small { display:block; margin-top:5px; font-size:10px; letter-spacing:.5px; color:var(--rl-dim); }
[data-radio-life] .rl-invitation { text-align:center; color:var(--rl-accent); font-size:11px; letter-spacing:1px; margin:21px 0 0; }
[data-radio-life] .rl-footnote { text-align:center; margin:18px 8px 0; font-size:10px; color:var(--rl-dim); line-height:1.8; }
[data-radio-life] .rl-stage { height:100%; text-align:center; position:relative; }
[data-radio-life] .rl-stage-top { display:flex; align-items:center; justify-content:space-between; font-size:9px; letter-spacing:1px; color:var(--rl-dim); flex-shrink:0; gap:10px; }
[data-radio-life] .rl-stage-freq { font-family:ui-monospace,monospace; color:var(--rl-accent); font-size:12px; letter-spacing:1px; }
[data-radio-life] .rl-stage-scene { font-size:10px; color:var(--rl-dim); line-height:1.7; margin-top:10px; flex-shrink:0; }
[data-radio-life] .rl-stage-main { flex:1; min-height:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:12px 0; }
[data-radio-life] .rl-portrait { position:relative; display:flex; align-items:center; justify-content:center; width:124px; height:124px; flex-shrink:0; border-radius:50%; border:1px solid rgba(230,181,130,.19); background:radial-gradient(circle,rgba(219,159,97,.12),transparent 70%); }
[data-radio-life] .rl-portrait::before { content:''; position:absolute; inset:8px; border:1px dashed rgba(230,181,130,.24); border-radius:50%; }
[data-radio-life] .rl-portrait::after { content:''; position:absolute; inset:-16px; border:1px solid rgba(230,181,130,.06); border-radius:50%; }
[data-radio-life] .rl-portrait [data-wk=avatar] { width:82px!important; height:82px!important; filter:sepia(.1); box-shadow:0 8px 20px rgba(0,0,0,.3); }
[data-radio-life] .rl-stage[data-speaking="1"] .rl-portrait::after { animation:rl-ripple 2.4s ease-out infinite; }
[data-radio-life] .rl-speaker { font-family:var(--f-display,serif); font-size:22px; letter-spacing:2px; color:var(--rl-ink); }
[data-radio-life] .rl-wave { display:flex; align-items:center; justify-content:center; gap:3px; height:20px; flex-shrink:0; opacity:.5; }
[data-radio-life] .rl-wave i { display:block; width:2px; height:var(--bar); min-height:2px; border-radius:1px; background:var(--rl-accent); transform:scaleY(.45); }
[data-radio-life] .rl-stage[data-speaking="1"] .rl-wave { opacity:1; }
[data-radio-life] .rl-stage[data-speaking="1"] .rl-wave i { animation:rl-wave 1s ease-in-out infinite alternate; animation-delay:var(--delay); }
[data-radio-life] .rl-caption { font-family:var(--f-display,serif); font-size:21px; line-height:1.8; white-space:pre-wrap; overflow-wrap:anywhere; max-width:430px; padding:0 8px; }
[data-radio-life] .rl-stage-bottom { flex-shrink:0; }
[data-radio-life] .rl-status { min-height:24px; font-size:11px; line-height:1.6; color:var(--rl-accent); }
[data-radio-life] .rl-stage[data-ended="1"] .rl-status { letter-spacing:2px; }
[data-radio-life] .rl-count { display:flex; align-items:center; gap:12px; color:var(--rl-dim); font-family:ui-monospace,monospace; font-size:9px; margin:8px auto 12px; max-width:250px; }
[data-radio-life] .rl-progress { flex:1; height:1px; background:rgba(224,181,136,.15); }
[data-radio-life] .rl-progress span { display:block; height:1px; background:var(--rl-accent); transition:width .25s; }
[data-radio-life] .rl-tools { display:flex; justify-content:center; gap:18px; padding:5px 0 1px; border-top:1px solid var(--rl-edge); }
[data-radio-life] .rl-tools .rl-button { display:flex; gap:6px; align-items:center; justify-content:center; min-width:58px; }
[data-radio-life] .rl-tape { position:relative; display:block; width:100%; text-align:left; color:#35281f; background:linear-gradient(135deg,#e5d2b6,#c6ad8b); border:1px solid #ba9b78; border-radius:5px; padding:13px 14px; margin-bottom:14px; box-shadow:inset 0 0 0 3px rgba(65,42,30,.06),0 5px 14px rgba(0,0,0,.12); min-height:100px; cursor:pointer; }
[data-radio-life] .rl-tape-title { font-family:var(--f-display,serif); font-size:16px; line-height:1.5; border-bottom:1px solid rgba(57,39,28,.24); padding-bottom:6px; padding-right:48px; overflow-wrap:anywhere; }
[data-radio-life] .rl-tape-meta { font-size:9px; color:#685343; margin-top:7px; line-height:1.7; letter-spacing:.2px; }
[data-radio-life] .rl-tape-mark { position:absolute; right:13px; top:15px; font-family:ui-monospace,monospace; font-size:10px; border:1px solid rgba(65,42,30,.22); padding:3px 5px; }
[data-radio-life] .rl-reels { display:flex; align-items:center; justify-content:center; gap:36px; height:37px; margin:12px 0 2px; position:relative; }
[data-radio-life] .rl-reels::before { content:''; position:absolute; left:30%; right:30%; height:19px; border:1px solid rgba(57,39,28,.2); background:rgba(57,39,28,.06); }
[data-radio-life] .rl-reels i { position:relative; z-index:1; display:block; width:34px; height:34px; border-radius:50%; border:5px solid #6b5948; outline:1px solid rgba(57,39,28,.2); background:repeating-conic-gradient(#d9c5a7 0 12deg,#6b5948 12deg 54deg); box-shadow:inset 0 0 0 9px #dac5a7; }
[data-radio-life] .rl-tape[data-blank="1"] { opacity:.85; cursor:default; }
[data-radio-life] .rl-section-title { display:flex; align-items:baseline; justify-content:space-between; padding:0 2px; margin:4px 0 19px; }
[data-radio-life] .rl-section-title h2 { font-family:var(--f-display,serif); font-weight:400; font-size:22px; }
[data-radio-life] .rl-section-title small { color:var(--rl-dim); font-size:9px; letter-spacing:1px; }
@keyframes rl-wave { from { transform:scaleY(.35); } to { transform:scaleY(1); } }
@keyframes rl-ripple { from { transform:scale(.92); opacity:.7; } to { transform:scale(1.14); opacity:0; } }
@media (max-height:650px) {
 [data-radio-life] .rl-receiver { padding:18px 15px 16px; }
 [data-radio-life] .rl-frequency { margin:13px 0; } [data-radio-life] .rl-frequency strong { font-size:45px; }
 [data-radio-life] .rl-person { margin:16px 0 12px; } [data-radio-life] .rl-invitation { margin-top:14px; }
 [data-radio-life] .rl-stage-main { gap:10px; padding:9px 0; }
 [data-radio-life] .rl-portrait { width:80px; height:80px; } [data-radio-life] .rl-portrait [data-wk=avatar] { width:56px!important; height:56px!important; }
 [data-radio-life] .rl-portrait::after { inset:-8px; } [data-radio-life] .rl-speaker { font-size:18px; }
 [data-radio-life] .rl-caption { font-size:17px; line-height:1.65; padding:0; }
 [data-radio-life] .rl-stage[data-long="1"] .rl-portrait { width:50px; height:50px; }
 [data-radio-life] .rl-stage[data-long="1"] .rl-portrait [data-wk=avatar] { width:36px!important; height:36px!important; }
 [data-radio-life] .rl-stage[data-long="1"] .rl-stage-main { gap:6px; }
 [data-radio-life] .rl-stage[data-long="1"] .rl-caption { font-size:16px; }
 [data-radio-life] .rl-stage[data-long="1"] .rl-wave { height:12px; }
 [data-radio-life] .rl-stage-scene { margin-top:7px; } [data-radio-life] .rl-count { margin:4px auto 8px; }
}
@media (prefers-reduced-motion:reduce) { [data-radio-life] .rl-wave i,[data-radio-life] .rl-portrait::after { animation:none!important; transition:none; } }
`;
  function RadioLifeScreen(p) {
    const R = root.RadioLife;
    const [mode, setMode] = useState("live"), [charId, setChar] = useState(() => (p.characters[0] || {}).id || "");
    const [revision, refresh] = useState(0), [eventId, setEvent] = useState(""), [detail, setDetail] = useState("");
    const [showId, setShow] = useState(""), [episodeId, setEpisode] = useState(""), [showName, setName] = useState("");
    const [topic, setTopic] = useState(""), [input, setInput] = useState(""), [title, setTitle] = useState("");
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [playing, setPlaying] = useState(false), [position, setPosition] = useState(-1), [sound, setSound] = useState(false), [audioState, setAudioState] = useState(""), [pageIndex, setPageIndex] = useState(0);
    const alive = useRef(true), lock = useRef(false), speech = useRef(null), token = useRef(0), scroll = useRef(null), scrolls = useRef({}), viewKey = useRef("live");
    const d = R.read(), chars = p.characters || [], char = chars.find(c => c.id === charId);
    const scene = char ? p.sceneFor(char) : null;
    const event = d.events.find(e => e.id === (detail || eventId));
    const show = d.shows.find(s => s.id === showId), episode = show && show.episodes.find(e => e.id === episodeId);
    const fullStage = mode === "live" && !detail && !!event;
    const stageLine = event && event.lines[position >= 0 ? position : Math.max(0,event.heard-1)];
    const stageChunks = stageLine ? Array.from(stageLine.text).join("").match(/[\s\S]{1,90}/gu) || [""] : [];
    const stageText = stageChunks[pageIndex] || "";
    const atEnd = !!event && position === event.lines.length-1 && pageIndex === stageChunks.length-1 && event.heard === event.lines.length;
    const shownLines = event ? R.heardLines(event) : episode ? episode.lines : [];
    const notify = () => refresh(n => n + 1);
    const stop = () => { token.current++; if (speech.current) speech.current.cancel(); speech.current = null; if (alive.current) { setPlaying(false); setAudioState(""); } };
    useEffect(() => {
      alive.current = true;
      if (root.RadioUI) root.RadioUI.Engine.setPower(false);
      const tick = setInterval(notify, 15000);
      const hidden = () => { if (document.hidden) stop(); };
      document.addEventListener("visibilitychange", hidden);
      return () => { alive.current = false; stop(); clearInterval(tick); document.removeEventListener("visibilitychange", hidden); };
    }, []);
    // 日程变化不自动发请求；结束当前现场的播放，旧已听片段仍能回看。
    useEffect(() => { if (!detail && event && (!scene || scene.key !== event.scene.key)) stop(); }, [scene && scene.key, revision]);
    const key = detail ? "clip:" + detail : mode === "studio" && showId ? "show:" + showId + ":" + episodeId : mode;
    React.useLayoutEffect(() => { viewKey.current = key; if (scroll.current) scroll.current.scrollTop = scrolls.current[key] || 0; }, [key]);
    const remember = () => { if (scroll.current) scrolls.current[viewKey.current] = scroll.current.scrollTop; };
    const changeMode = next => { remember(); stop(); setDetail(""); setMode(next); setError(""); };
    const back = () => {
      if (busy) return;
      remember(); stop(); setError("");
      if (detail) { setDetail(""); return; }
      if (mode === "live" && event) { setEvent(""); setPageIndex(0); return; }
      if (episodeId) { setEpisode(""); return; }
      if (showId) { setShow(""); return; }
      p.onBack();
    };
    const run = async work => {
      if (lock.current) return;
      lock.current = true; setBusy(true); setError(""); stop();
      try { await work(); if (alive.current) notify(); }
      catch (e) { if (alive.current) setError(e.message || "这次没接上，请手动重试。"); }
      finally { lock.current = false; if (alive.current) setBusy(false); }
    };
    const receive = continuing => run(async () => {
      const current = char && p.sceneFor(char);
      if (!current) throw new Error("这会儿没有可接入的日程现场。可以先到日历给TA排好日程。");
      const e = await p.onConnect(char, current, continuing);
      if (alive.current) {
        const latest = p.sceneFor(char);
        if (latest && latest.key === e.scene.key) {
          setEvent(e.id); setPageIndex(0); setPosition(Math.max(0, e.heard - 1));
          if (!e.heard && Array.from(e.lines[0].text).length <= 90) R.reveal(e.id, 0);
          if (sound) play([{...e.lines[Math.max(0,e.heard-1)],text:Array.from(e.lines[Math.max(0,e.heard-1)].text).slice(0,90).join("")}], 0, "", Math.max(0, e.heard - 1));
        }
      }
    });
    const next = () => {
      if (atEnd) return;
      stop();
      if (!event || !scene || event.scene.key !== scene.key) return;
      if (pageIndex + 1 < stageChunks.length) { setPageIndex(pageIndex+1); if (pageIndex+1 === stageChunks.length-1 && position === event.heard) { R.reveal(event.id,position); notify(); } if(sound) play([{...stageLine,text:stageChunks[pageIndex+1]}],0,"",position); return; }
      const at = Math.max(0,position) + 1;
      if (at < event.lines.length) { setPageIndex(0); if(Array.from(event.lines[at].text).length <= 90) R.reveal(event.id, at); setPosition(at); notify(); if (sound) play([{...event.lines[at],text:Array.from(event.lines[at].text).slice(0,90).join("")}], 0, "", at); }
      // 最后一句停在本段结尾；后续只能从单独的文字入口接入。
    };
    const advance = () => {
      if (lock.current || mode !== "live" || detail) return;
      if (!event || !scene || event.scene.key !== scene.key) receive(false);
      else next();
    };
    const play = (lines, start, liveId, baseIndex = 0) => {
      stop(); if (!lines.length) return;
      const version = token.current; setPlaying(true); setAudioState("正在准备声音…"); setError("");
      const step = index => {
        if (!alive.current || version !== token.current) return;
        if (index >= lines.length) { setPlaying(false); setAudioState("这句说完了 · 轻点继续"); speech.current = null; return; }
        if (liveId) {
          const current = char && p.sceneFor(char);
          if (!current || !event || current.key !== event.scene.key) { stop(); return; }
          R.reveal(liveId, index); notify();
        }
        setPosition(index + baseIndex);
        const line = lines[index], actor = chars.find(c => c.id === line.speakerId);
        speech.current = root.RadioVoice.speak(line.text, {
          voiceId: actor && actor.voiceId, seed: root.RadioVoice.hash01(line.speakerId || line.speaker),
          start: () => { if(alive.current && version===token.current) setAudioState("正在说…"); },
          end: () => step(index + 1), fail: e => { if (alive.current && version === token.current) { setPlaying(false); setAudioState("声音没接上 · 可轻点继续看文字"); setError(e.message || "语音没播放出来，可以继续看文字。"); } }
        });
      };
      step(Math.max(0, start));
    };
    const makeShow = () => run(async () => { const s = R.createShow(char, showName); remember(); setShow(s.id); setName(""); });
    const startShow = () => run(async () => {
      const c = chars.find(c => c.id === show.charId);
      if (!c) throw new Error("这位搭档不在当前角色列表里。");
      // 开始失败仍留空录制草稿，下一次继续复用，不会重复建期数。
      const pending = show.episodes.find(e => e.status === "recording");
      const e = pending || R.startEpisode(show.id, topic, p.userName);
      remember(); setEpisode(e.id); setTitle(e.title);
      if (!e.lines.length) { const raw = await p.onStudio(c, R.getShow(show.id), e, ""); R.appendShow(show.id, e.id, "", raw, c); }
      setTopic("");
    });
    const send = () => run(async () => {
      const c = chars.find(c => c.id === show.charId);
      if (!c) throw new Error("这位搭档不在当前角色列表里。");
      const say = input.trim();
      if (!say && episode.lines.length) return;
      const raw = await p.onStudio(c, show, episode, say);
      R.appendShow(show.id, episode.id, say, raw, c); setInput("");
    });
    const ink = pageColor("radio", "ink", "#f1ddc0"), bg = pageColor("radio", "bg", "#1c1515"), accent = pageColor("radio", "accent", "#d9ac79");
    const panel = { padding: 20, borderRadius: "4px 4px 18px 4px", border: "1px solid var(--rl-edge)", background: "linear-gradient(145deg,rgba(238,197,151,.055),rgba(0,0,0,.09))", marginBottom: 18 };
    const field = { display:"block", width:"100%", minHeight:44, padding:"10px 2px", background:"transparent", border:0, borderBottom:"1px solid var(--rl-edge)", color:ink, fontSize:14, boxSizing:"border-box", borderRadius:0 };
    const btn = (label, fn, disabled, extra) => {
      const icon = {"朗读":"wave","静音":"wave","收藏":"bookmark","已收藏":"bookmark","聊聊":"handset"}[label];
      return h("button",{className:"rl-button",type:"button",onClick:fn,disabled:!!disabled || busy,style:extra},icon && h(CGlyph,{k:icon,size:15,color:accent}),h("span",null,label));
    };
    const tape = (name, meta, mark, fn) => h("button", {className:"rl-tape","data-wk":"radiotape","aria-label":name,onClick:fn,type:"button"},
      h("div",{className:"rl-tape-title"},name),h("span",{className:"rl-tape-mark"},mark),h("div",{className:"rl-tape-meta"},meta),h("div",{className:"rl-reels","aria-hidden":true},h("i"),h("i")));
    const wave = () => h("div",{className:"rl-wave","data-wk":"radiowave","aria-hidden":true},Array.from({length:25},(_,i)=>h("i",{key:i,style:{"--bar":(5+((i*7+3)%17))+"px","--delay":(-i*.13)+"s"}})));
    const dial = value => h("div",{className:"rl-dial","data-wk":"radiodial","aria-hidden":true},
      h("div",{className:"rl-ticks"},Array.from({length:41},(_,i)=>h("i",{key:i}))),
      h("span",{className:"rl-needle",style:{left:Math.max(2,Math.min(98,(Number(value)-87.5)/20*100))+"%"}}),
      h("div",{className:"rl-scale"},[88,92,96,100,104,108].map(n=>h("span",{key:n},n))));
    const row = (...children) => h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 } }, ...children);
    const label = (name, child) => h("label", {className:"rl-label"}, h("span", null, name), child);
    const chooseChar = () => label("调到谁的频率", h("select", { className:"rl-field","aria-label": "调到谁的频率", value: charId, disabled: busy, style: field,
      onChange: e => { stop(); setChar(e.target.value); setEvent(""); setPosition(-1); setError(""); } },
      chars.length ? chars.map(c => h("option", { key: c.id, value: c.id, style: { color: "#1c1515" } }, c.remark || c.name)) : h("option", {value:""}, "先去人格档案馆添加角色")));
    const transcript = (lines, canReplay) => h("div", { "data-radio-transcript": true, style: { display: "grid", gap: 12, marginTop: 18 } },
      lines.map((l, i) => h("div", { key: i, "data-radio-line": i, style: { borderLeft: "2px solid " + (playing && position === i ? accent : "rgba(230,219,192,.2)"), paddingLeft: 12 } },
        h("div", { style: { fontSize: 11, color: accent, marginBottom: 4 } }, l.speaker),
        h("div", { style: { fontSize: 15, lineHeight: 1.85, whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, l.text),
        canReplay && btn("听第" + (i + 1) + "句", () => play([l], 0, "", i), false, { minHeight: 40, padding: "6px 10px", marginTop: 6, fontSize: 11 }))));
    let body;
    if (detail && event) {
      body = h("section", { style: panel }, h("h2", { style: {fontSize:18} }, event.title), h("p", {style:{fontSize:12,opacity:.7}}, event.scene.day + " · " + event.scene.time + " · " + event.scene.location),
        row(btn(playing ? "停止播放" : "回听这段", () => playing ? stop() : play(shownLines, 0)),
          btn(event.savedAt ? "取消保存" : "保存这段", () => run(async () => R.keep(event.id, !event.savedAt))),
          btn("去找TA聊", () => { stop(); p.onChat(event.ownerId); })), transcript(shownLines, true));
    } else if (mode === "live") {
      const current = event && scene && event.scene.key === scene.key;
      const freq = char ? (87.5 + Math.floor(root.RadioVoice.hash01(char.id) * 200) / 10).toFixed(1) : "—";
      body = h("div", {className:fullStage ? "h-full flex flex-col" : undefined},
        !event && h("section", {className:"rl-receiver","data-wk":"radioreceiver"},
          h("div",{className:"rl-serial"},h("span",null,"生活频率"),h("span",null,h("i",{className:"rl-dot"}),scene ? "信号待接入" : "此刻无信号")),
          h("div",{className:"rl-frequency"},h("strong",null,freq),h("small",null,"兆赫")),dial(freq),
          h("div",{className:"rl-person"},char && h(Avatar,{character:char,size:42,radius:999}),chooseChar()),
          h("div", {className:"rl-schedule","data-radio-scene":true},scene ? scene.title : "这会儿没有可接入的现场",
            h("small",null,scene ? scene.time+"—"+scene.end+" · "+(scene.location || "日程没有注明地点") : "先到日历给TA排好日程")),
          h("div",{className:"rl-invitation"},busy ? "正在寻找这一端的信号…" : scene ? "轻点屏幕，听见此刻" : "等一段生活开始"),
          !scene && row(btn("去日历排日程",p.onSchedule))),
        event && h("section", {"data-radio-stage":true,"data-wk":"radiostage","data-speaking":playing && audioState === "正在说…" ? "1":"0","data-ended":atEnd ? "1":"0","data-long":stageText.length>65 ? "1":"0",className:"rl-stage flex-1 min-h-0 flex flex-col"},
          h("div",{className:"rl-stage-top"},h("span",null,h("i",{className:"rl-dot"}),"静默接入"),h("span",{className:"rl-stage-freq"},freq+" 兆赫")),
          h("div", {className:"rl-stage-scene","data-radio-scene":true},scene ? scene.title+ (scene.location ? " · "+scene.location : "") : "这段日程已结束 · 轻点调到现在"),
          h("div",{className:"rl-stage-main"},
            h("div",{className:"rl-portrait","data-wk":"radioportrait"},h(Avatar,{character:chars.find(c=>c.id===stageLine?.speakerId) || {name:stageLine?.speaker},size:82,radius:999})),
            h("div",{className:"rl-speaker"},stageLine && stageLine.speaker),wave(),
            h("div",{"data-radio-transcript":true,"data-wk":"radiocaption","data-radio-line":position,key:event.id+":"+position+":"+pageIndex,className:"rl-caption"},stageText)),
          h("div",{className:"rl-stage-bottom"},
            h("div",{className:"rl-count"},h("span",null,"第"+(event.ordinal+1)+"段"),h("div",{className:"rl-progress","aria-hidden":true},h("span",{style:{width:((position+1)/event.lines.length*100)+"%"}})),h("span",null,(position+1)+" / "+event.lines.length)),
            h("div",{role:"status","aria-live":"polite","data-radio-audio-status":true,"data-wk":"radiostatus",className:"rl-status"},busy ? "电波正在接续…" : atEnd ? (sound && playing ? "本段最后一句 · "+audioState : "本段已结束") : sound ? audioState || "轻点屏幕，继续听" : "轻点看下一句"),
            atEnd && current && btn("接着听后续",()=>receive(true),false,{background:"transparent",border:0,padding:"6px 8px",fontSize:11,color:accent}),
            h("div",{className:"rl-tools","data-wk":"radiotools"},
              btn(sound ? "静音":"朗读",()=>{stop();setSound(!sound);if(!sound && stageLine)play([{...stageLine,text:stageText}],0,"",position);},false,{background:"transparent",border:0,padding:"6px 8px",fontSize:11}),
              btn(event.savedAt ? "已收藏":"收藏",()=>run(async()=>R.keep(event.id,!event.savedAt)),!event.heard,{background:"transparent",border:0,padding:"6px 8px",fontSize:11}),
              btn("聊聊",()=>{stop();p.onChat(event.ownerId);},false,{background:"transparent",border:0,padding:"6px 8px",fontSize:11})))),
        !event && h("div",{className:"rl-footnote"},"你在这一端，TA在生活里。",h("br"),"收听与收藏，都不会打扰TA。"));
    } else if (mode === "saved") {
      const saved = d.events.filter(e => e.savedAt).slice().reverse();
      body = h("section",null,h("div",{className:"rl-section-title"},h("h2",null,"留下来的电波"),h("small",null,saved.length+"段收藏")),
        saved.length ? saved.map((e,i)=>h("div",{key:e.id},tape(e.title,e.scene.name+" · "+e.scene.day+" · 已听"+e.heard+"句",String(saved.length-i).padStart(2,"0"),()=>{remember();stop();setDetail(e.id);}))) : h("div",{className:"rl-panel rl-copy"},"把某一刻的声音留下。听到喜欢的片段，点「收藏」，它就会出现在这里。"));
    } else if (show && episode) {
      body = h("section", {style:panel}, h("div", {style:{fontSize:11,color:accent}}, show.name + " · " + (episode.status === "finished" ? "已收麦" : "录制中")),
        h("h2", {style:{fontSize:18,marginTop:10}}, episode.title), transcript(episode.lines, true),
        episode.lines.length > 0 && row(btn(playing ? "停止播放" : "回听本期", () => playing ? stop() : play(episode.lines, 0))),
        episode.status === "recording" && h("div", null,
          label("递话题／插一句", h("textarea", {"aria-label":"递话题／插一句",value:input,onChange:e=>setInput(e.target.value),maxLength:800,rows:3,style:field})),
          row(btn(episode.lines.length ? "递给搭档" : "请搭档开场", send, episode.lines.length && !input.trim())),
          label("给这一期起个名字", h("input", {"aria-label":"给这一期起个名字",value:title,onChange:e=>setTitle(e.target.value),style:field})),
          row(btn("收麦，留下这一期", () => run(async () => R.finishEpisode(show.id, episode.id, title)), !episode.lines.length))),
        episode.status === "finished" && row(btn("去找搭档聊聊", () => {stop();p.onChat(show.charId);}))); 
    } else if (show) {
      const c = chars.find(c=>c.id===show.charId), pending = show.episodes.find(e=>e.status==="recording");
      body = h("section", {style:panel}, h("h2", {style:{fontSize:18}}, show.name), h("p", {style:{fontSize:12,color:accent,margin:"8px 0 16px"}}, "你和" + (c && c.name || "原来的搭档") + "的电台"),
        pending ? btn("继续录这一期", () => {remember();setEpisode(pending.id);setTitle(pending.title);}, !c) : h("div", null,
          label("今天想聊什么", h("input", {"aria-label":"今天想聊什么",value:topic,onChange:e=>setTopic(e.target.value),style:field})), btn("一起试播", startShow, !c || !topic.trim())),
        h("div", {style:{marginTop:20}}, show.episodes.filter(e=>e.status==="finished").slice().reverse().map(e => h("div", {key:e.id},tape(e.title,new Date(e.createdAt).toLocaleDateString()+" · 已收麦",String(show.episodes.indexOf(e)+1).padStart(2,"0"),()=>{remember();setEpisode(e.id);setTitle(e.title);})))));
    } else {
      body = h("div", null, h("section", {style:panel}, h("div",{className:"rl-eyebrow",style:{marginBottom:10}},"这一端，也留下你们的声音"),h("h2", {className:"rl-title"}, "一起办一座小电台"),
        h("p", {className:"rl-copy",style:{marginTop:8}}, "你递题，也能随时插话。TA带来自己的想法，一期一期留下你们的声音。"),
        h("div",{className:"rl-tape","data-blank":"1",style:{marginTop:18},"aria-hidden":true},h("div",{className:"rl-tape-title"},showName || "还没写下的台名"),h("div",{className:"rl-reels"},h("i"),h("i"))), chooseChar(),
        label("你们的台名", h("input", {"aria-label":"你们的台名",value:showName,onChange:e=>setName(e.target.value),style:field})), btn("建好录音间", makeShow, !char || !showName.trim())),
        d.shows.map(s => h("div",{key:s.id},tape(s.name,"你和"+(chars.find(c=>c.id===s.charId)?.name || "原来的搭档")+" · "+s.episodes.filter(e=>e.status==="finished").length+"期",String(d.shows.indexOf(s)+1).padStart(2,"0"),()=>{remember();setShow(s.id);}))));
    }
    return h("div", {"data-radio-life":true,"data-wk":"radioframe",className:"h-full flex flex-col",style:{backgroundColor:bg,color:ink,"--rl-ink":ink,"--rl-accent":accent,
      backgroundImage:"radial-gradient(ellipse at 15% 5%,rgba(161,102,75,.19),transparent 60%),radial-gradient(ellipse at 85% 80%,rgba(129,77,67,.1),transparent 60%),repeating-linear-gradient(0deg,rgba(231,188,143,.018) 0 1px,transparent 1px 3px)"}},
      h("style",null,RADIO_LIFE_CSS),
      h(Head, {zh:detail ? "录音回听":"电台",sub:busy ? "正在接收，请稍候":"听见生活的另一端",onBack:back,bg:"transparent",ink,right:btn("旧录音",()=>{stop();p.onArchive();},false,{padding:"6px",fontSize:10,background:"transparent",border:0})}),
      !detail && !showId && !fullStage && h("div",{className:"rl-switches","data-wk":"radiomodes"},
        [["live","生活频率"],["studio","录音间"],["saved","录音架"]].map(([id,name])=>h("button",{key:id,type:"button",className:"rl-switch","aria-pressed":mode===id,onClick:()=>changeMode(id),disabled:busy},name))),
      h("div", {ref:scroll,"data-radio-life-scroll":true,
        onClick:e=>{ if (!e.target.closest("button,select,input,textarea,a,label") && !String(root.getSelection && root.getSelection() || "")) advance(); },
        onKeyDown:e=>{ if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); advance(); } },
        tabIndex:mode === "live" && !detail ? 0 : undefined,"aria-label":mode === "live" && !detail ? "轻点屏幕继续听现场" : undefined,
        className:fullStage ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-y-auto",style:{position:"relative",padding:fullStage ? "18px 24px 8px":"22px",paddingBottom:"calc(12px + env(safe-area-inset-bottom) * 0.4)"}},
        error && h("div", {role:"alert",style:{...panel,...(fullStage ? {position:"absolute",top:12,left:16,right:16,zIndex:2,padding:12,maxHeight:90,overflowY:"auto"} : {}),color:ink,fontSize:13,lineHeight:1.7,overflowWrap:"anywhere"}}, error), body));
  }
  root.RadioLifeScreen = RadioLifeScreen;
})(window);
