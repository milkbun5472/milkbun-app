(function (root) {
  "use strict";
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
      stop();
      if (!event || !scene || event.scene.key !== scene.key) return;
      if (pageIndex + 1 < stageChunks.length) { setPageIndex(pageIndex+1); if (pageIndex+1 === stageChunks.length-1 && position === event.heard) { R.reveal(event.id,position); notify(); } if(sound) play([{...stageLine,text:stageChunks[pageIndex+1]}],0,"",position); return; }
      setPageIndex(0);
      const at = Math.max(0,position) + 1;
      if (at < event.lines.length) { if(Array.from(event.lines[at].text).length <= 90) R.reveal(event.id, at); setPosition(at); notify(); if (sound) play([{...event.lines[at],text:Array.from(event.lines[at].text).slice(0,90).join("")}], 0, "", at); }
      else receive(true);
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
        if (index >= lines.length) { setPlaying(false); setAudioState("说完了 · 轻点继续"); speech.current = null; return; }
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
    const ink = pageColor("radio", "ink", "#ecdfc4"), bg = pageColor("radio", "bg", "#292f2b"), accent = pageColor("radio", "accent", "#b7d6bd");
    const panel = { padding: 16, borderRadius: 18, border: "1px solid rgba(230,219,192,.18)", background: "rgba(0,0,0,.12)", marginBottom: 14 };
    const field = { display: "block", width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,.22)", border: "1px solid rgba(230,219,192,.25)", color: ink, fontSize: 14, boxSizing: "border-box" };
    const btn = (label, fn, disabled, extra) => h("button", { type: "button", onClick: fn, disabled: !!disabled || busy,
      style: { minHeight: 44, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(230,219,192,.28)", background: "rgba(230,219,192,.08)", color: ink, fontSize: 13, opacity: disabled || busy ? .45 : 1, ...extra } }, label);
    const row = (...children) => h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 } }, ...children);
    const label = (name, child) => h("label", { style: { display: "block", fontSize: 12, margin: "12px 0" } }, h("span", { style: { display: "block", marginBottom: 7, opacity: .75 } }, name), child);
    const chooseChar = () => label("调到谁的频率", h("select", { "aria-label": "调到谁的频率", value: charId, disabled: busy, style: field,
      onChange: e => { stop(); setChar(e.target.value); setEvent(""); setPosition(-1); setError(""); } },
      chars.length ? chars.map(c => h("option", { key: c.id, value: c.id, style: { color: "#292f2b" } }, c.remark || c.name)) : h("option", {value:""}, "先去人格档案馆添加角色")));
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
        !event && h("section", { style: { ...panel, background: "linear-gradient(145deg,rgba(147,171,134,.18),rgba(0,0,0,.25))" } },
          h("div", { style: {display:"flex",justifyContent:"space-between",fontSize:11,color:accent} }, h("span", null, "生活频率" + (current ? " · " + freq : "")), h("span", null, current ? "已接入 · 静默收听" : "待接入")),
          !current && h("div", { style:{fontSize:42,fontFamily:"monospace",letterSpacing:3,margin:"12px 0 8px"} }, freq),
          !current && h("div", { "aria-hidden":true, style:{height:26,backgroundImage:"repeating-linear-gradient(90deg,transparent 0 9px,rgba(183,214,189,.6) 9px 10px)",maskImage:"linear-gradient(0deg,#000,transparent)"} }),
          chooseChar(),
          h("div", { "data-radio-scene":true, style:{fontSize:14,lineHeight:1.8} }, scene ? scene.time + "—" + scene.end + " · " + scene.title : "这会儿没有可接入的现场"),
          scene && h("div", {style:{fontSize:12,opacity:.7}}, scene.location || "日程没有注明地点"),
          !current && h("p", {style:{fontSize:12,lineHeight:1.8,opacity:.7,marginTop:10}}, "接入后，TA不知道你正在听。保存也不会通知TA。"),
          !current && h("p", {style:{fontSize:12,color:accent,marginTop:12}}, scene ? "轻点屏幕，接入此刻" : "先到日历排好日程"),
          !scene && btn("去日历排日程", p.onSchedule)),
        event && h("section", {"data-radio-stage":true,className:"flex-1 min-h-0 flex flex-col",style:{textAlign:"center",padding:"12px 8px 0"}},
          h("div", {"data-radio-scene":true,style:{fontSize:11,opacity:.6,flexShrink:0}}, scene ? scene.title + (scene.location ? " · "+scene.location : "") : "这段日程已经结束 · 轻点调到现在"),
          h("div", {className:"flex-1 min-h-0 flex flex-col items-center justify-center",style:{gap:14,padding:"12px 0"}},
            h(Avatar, {character:chars.find(c=>c.id===stageLine?.speakerId) || {name:stageLine?.speaker},size:64,radius:999}),
            h("div", {style:{fontSize:15,color:accent}}, stageLine && stageLine.speaker),
            h("div", {"data-radio-transcript":true,"data-radio-line":position,style:{fontSize:18,lineHeight:1.8,whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxWidth:420}}, stageText)),
          h("div", {role:"status","aria-live":"polite","data-radio-audio-status":true,style:{fontSize:12,color:accent,minHeight:24,flexShrink:0}}, busy ? "电波正在接续…" : sound ? audioState || "轻点屏幕，继续听" : "轻点看下一段"),
          h("div", {className:"shrink-0",style:{display:"flex",justifyContent:"center",gap:20,padding:"10px 0 2px"}},
            btn(sound ? "静音" : "朗读", () => { stop(); setSound(!sound); if (!sound && stageLine) play([{...stageLine,text:stageText}],0,"",position); }, false, {background:"transparent",border:0,padding:"6px 8px",fontSize:12}),
            btn(event.savedAt ? "已收藏" : "收藏", () => run(async () => R.keep(event.id, !event.savedAt)), !event.heard, {background:"transparent",border:0,padding:"6px 8px",fontSize:12}),
            btn("聊聊", () => { stop(); p.onChat(event.ownerId); }, false, {background:"transparent",border:0,padding:"6px 8px",fontSize:12}))),
        !event && h("p", {style:{fontSize:13,lineHeight:1.9,opacity:.7,padding:"0 6px"}}, "拧到TA的频率，听一小段正在发生的生活。接入才会生成现场；离开、换日程都不会自动续播。"));
    } else if (mode === "saved") {
      const saved = d.events.filter(e => e.savedAt).slice().reverse();
      body = h("section", {style:panel}, h("h2", {style:{fontSize:16,marginBottom:12}}, "留下来的电波"),
        saved.length ? saved.map(e => h("button", {key:e.id,onClick:()=>{remember();stop();setDetail(e.id);},style:{...field,textAlign:"left",marginBottom:10}},
          h("div", {style:{fontSize:14}}, e.title), h("div", {style:{fontSize:11,opacity:.7,marginTop:5}}, e.scene.name + " · " + e.scene.day + " · 已听" + e.heard + "句"))) : h("p", {style:{fontSize:13,lineHeight:1.8,opacity:.7}}, "听到想留下的片段，点「收藏」。日程结束后，TA也能记得这段实际发生的对话。"));
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
        h("div", {style:{marginTop:20}}, show.episodes.filter(e=>e.status==="finished").slice().reverse().map(e => h("button", {key:e.id,onClick:()=>{remember();setEpisode(e.id);setTitle(e.title);},style:{...field,textAlign:"left",marginBottom:10}}, e.title))));
    } else {
      body = h("div", null, h("section", {style:panel}, h("h2", {style:{fontSize:16}}, "一起办一座小电台"),
        h("p", {style:{fontSize:13,lineHeight:1.8,opacity:.7,marginTop:8}}, "你递题，也能随时插话。TA带来自己的想法，一期一期留下你们的声音。"), chooseChar(),
        label("你们的台名", h("input", {"aria-label":"你们的台名",value:showName,onChange:e=>setName(e.target.value),style:field})), btn("建好录音间", makeShow, !char || !showName.trim())),
        d.shows.map(s => h("button", {key:s.id,onClick:()=>{remember();setShow(s.id);},style:{...field,textAlign:"left",marginBottom:12}}, s.name + " · " + s.episodes.filter(e=>e.status==="finished").length + "期")));
    }
    return h("div", {"data-radio-life":true,className:"h-full flex flex-col",style:{backgroundColor:bg,color:ink,
      backgroundImage:"repeating-linear-gradient(100deg,transparent 0 4px,rgba(198,172,125,.025) 5px 6px),radial-gradient(ellipse at top left,rgba(151,172,133,.15),transparent 75%)"}},
      h(Head, {zh:detail ? "录音回听" : "电台",sub:busy ? "正在接收，请稍候" : "这一端，听见生活",onBack:back,bg:"transparent",ink,right:btn("旧录音",()=>{stop();p.onArchive();},false,{padding:"6px",fontSize:11})}),
      !detail && !showId && !fullStage && h("div", {className:"shrink-0",style:{display:"flex",gap:3,padding:"10px 16px 0"}},
        [["live","生活频率"],["studio","录音间"],["saved","录音架"]].map(([id,name])=>h("button",{key:id,type:"button","aria-pressed":mode===id,onClick:()=>changeMode(id),disabled:busy,
          style:{flex:1,minHeight:44,borderRadius:"5px 5px 0 0",border:"1px solid rgba(230,219,192,.18)",borderBottom:mode===id ? "3px solid "+accent : "3px solid rgba(0,0,0,.3)",
            transform:mode===id ? "translateY(3px)" : "none",boxShadow:mode===id ? "inset 0 2px 4px rgba(0,0,0,.3)" : "0 3px 0 rgba(0,0,0,.4)",background:mode===id ? "rgba(147,171,134,.16)" : "rgba(230,219,192,.06)",color:ink,fontSize:12}},name))),
      h("div", {ref:scroll,"data-radio-life-scroll":true,
        onClick:e=>{ if (!e.target.closest("button,select,input,textarea,a,label") && !String(root.getSelection && root.getSelection() || "")) advance(); },
        onKeyDown:e=>{ if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); advance(); } },
        tabIndex:mode === "live" && !detail ? 0 : undefined,"aria-label":mode === "live" && !detail ? "轻点屏幕继续听现场" : undefined,
        className:fullStage ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-y-auto",style:{padding:"18px 16px",paddingBottom:"calc(18px + env(safe-area-inset-bottom) * 0.4)"}},
        error && h("div", {role:"alert",style:{...panel,color:ink,fontSize:13,lineHeight:1.7,overflowWrap:"anywhere"}}, error), body));
  }
  root.RadioLifeScreen = RadioLifeScreen;
})(window);
