// Schedule viewer and per-character home decoration; narrative and game saves stay with their owners.
(function (root) {
  "use strict";
  const DEMO = { id: "__char_day_demo", name: "示例小人", tz: "0" };
  const DEMO_ROWS = [
    { seq: 1, time: "08:00", end: "09:00", title: "吃早饭，慢慢醒过来", location: "家里的餐桌", type: "meal" },
    { seq: 2, time: "09:00", end: "12:00", title: "坐下来翻书、整理手头的事", location: "案边", type: "work" },
    { seq: 3, time: "14:00", end: "16:00", title: "出门走一走", location: "街边小路", type: "out" },
    { seq: 4, time: "18:00", end: "19:00", title: "在家下厨煮汤", location: "家里的厨房", type: "home" },
    { seq: 5, time: "19:00", end: "21:00", title: "回家喝茶，歇一会儿", location: "窗边", type: "coffee" },
    { seq: 6, time: "23:00", end: "24:00", title: "躺下来休息", location: "卧室", type: "sleep" }
  ];
  const clockText = n => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
  function dayState(char, plans, at = Date.now()) {
    const clock = root.ScheduleClock, day = clock.dayKey(char, at), minute = clock.localMinute(char, at);
    const plan = (plans || {})[day], rows = typeof schedFillEnds === "function" ? schedFillEnds(plan?.seqs || []) : plan?.seqs || [];
    const slot = clock.currentSlot(char, plans, at, undefined, {
      fillEnds: typeof schedFillEnds === "function" ? schedFillEnds : x => x,
      sleepCarry: typeof schedSleepCarry === "function" ? schedSleepCarry : undefined
    });
    return { day, minute, time: clockText(minute), rows, slot, hasPlan: !!rows.length };
  }
  function presentation(slot) { return root.CharDayLink.presentation(slot); }
  let homeWrite=Promise.resolve();
  function saveHomeChange(charId,section,value){
    const write=homeWrite.catch(()=>{}).then(async()=>{
      const previous=loadJSON("x_charDayHomes",{})||{},next={...previous,version:3,[section]:{...previous[section],[String(charId)]:value}};
      const result=await commitJSONDurable("x_charDayHomes",next);
      if(!result?.durable||!result?.live)throw Error("save");
      return next;
    });
    homeWrite=write;return write;
  }
  const visitChoice=info=>info.control==="auto"?"auto":["read","drink","eat","rest"].includes(info.manualAction)?info.manualAction:"manual";
  root.CharDayKit = { dayState, presentation, DEMO, DEMO_ROWS, saveHomeChange, visitChoice };
  root.CharDayApp = function CharDayApp(props) {
    const [id, setId] = useState(props.initialCharId || ""), [pulse, setPulse] = useState(0),
      [book, setBook] = useState(false), [preview, setPreview] = useState(null), [demoIndex, setDemoIndex] = useState(0),
      [follow, setFollow] = useState(true), [sceneStatus, setSceneStatus] = useState("正在准备画面…"), [retry, setRetry] = useState(0),
      [homeOptions, setHomeOptions] = useState(false), [styles, setStyles] = useState([]), [demoStyle, setDemoStyle] = useState("warm"),
      [motionOptions,setMotionOptions]=useState([]),[demoMotion,setDemoMotion]=useState("auto"),[demoVisitorMotion,setDemoVisitorMotion]=useState("auto"),
      [homes, setHomes] = useState(() => typeof loadJSON === "function" ? loadJSON("x_charDayHomes", {}) || {} : {}),
      [styleBusy, setStyleBusy] = useState(false), [styleNotice, setStyleNotice] = useState(""),
      [decorPanel,setDecorPanel]=useState(""),[catalog,setCatalog]=useState([]),[decorOptions,setDecorOptions]=useState(null),
      [editor, setEditor] = useState(null), [furniture, setFurniture] = useState([]), [layoutBusy, setLayoutBusy] = useState(false), [layoutNotice, setLayoutNotice] = useState(""), [demoLayout, setDemoLayout] = useState({}),
      [showcase, setShowcase] = useState(""), [spotId, setSpotId] = useState(""), [places, setPlaces] = useState([]),
      [activityStatus,setActivityStatus]=useState(null), [chatOpen, setChatOpen] = useState(false), [chatMounted, setChatMounted] = useState(false), [visitStatus,setVisitStatus]=useState(null),[togetherPanel,setTogetherPanel]=useState(false),[mePanel,setMePanel]=useState(false),[meStyles,setMeStyles]=useState(null),[meDraft,setMeDraft]=useState(null),[meBusy,setMeBusy]=useState(false),[meNotice,setMeNotice]=useState(""),[moreOpen,setMoreOpen]=useState(false),[professionalPanel,setProfessionalPanel]=useState(false),[professionalChoices,setProfessionalChoices]=useState({}),[professionalBusy,setProfessionalBusy]=useState(false),[professionalNotice,setProfessionalNotice]=useState(""),[demoProfessional,setDemoProfessional]=useState({});
    const kbLift = useKbLift();
    const now = Date.now();
    const iframe = useRef(null), scroll = useRef(null), positions = useRef({}), stateRef = useRef(null),decorScroll=useRef(null),decorPositions=useRef({}),visitSave=useRef({}),scenePause=useRef(null),menuScroll=useRef(null),menuPositions=useRef({});
    // The schedule/style pages unmount the iframe. Keep only this view's live
    // position in memory so returning or entering the editor can resume it.
    const bindScene=React.useCallback(node=>{if(!node&&iframe.current){try{scenePause.current=iframe.current.contentWindow?.CharDayScene?.pauseState?.()||null;}catch{scenePause.current=null;}}iframe.current=node;},[]);
    const demo = id === DEMO.id, char = demo ? DEMO : (props.characters || []).find(c => String(c.id) === String(id));
    useEffect(() => {
      props.onChatVisibility?.(char, chatOpen && !editor && !demo && !showcase && !book && !homeOptions && !moreOpen && !togetherPanel && !professionalPanel && !mePanel);
      return () => props.onChatVisibility?.(null, false);
    }, [id, chatOpen, showcase, book, homeOptions, editor, moreOpen, togetherPanel, professionalPanel, mePanel]);
    useEffect(() => { const timer = setInterval(() => setPulse(n => n + 1), 1000); return () => clearInterval(timer); }, []);
    React.useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = positions.current[homeOptions ? "style" : book ? "book" : "picker"] || 0; }, [book, homeOptions, id]);
    React.useLayoutEffect(()=>{if(decorScroll.current)decorScroll.current.scrollTop=decorPositions.current[decorPanel]||0;},[decorPanel]);
    React.useLayoutEffect(()=>{if(menuScroll.current)menuScroll.current.scrollTop=menuPositions.current[moreOpen?"more":"life"]||0;},[moreOpen,togetherPanel,mePanel,professionalPanel,book,homeOptions,id]);
    const pick = value => { setMoreOpen(false);setTogetherPanel(false);setMePanel(false);setProfessionalPanel(false);setId(value); setPreview(null); setBook(false); setDemoIndex(0); setHomeOptions(false); setEditor(null); setDecorPanel(""); setLayoutNotice(""); setStyleNotice(""); setShowcase(""); setSpotId(""); setChatOpen(false); setChatMounted(false); setVisitStatus(null); setFollow(true); setSceneStatus("正在准备画面…"); props.onSelect?.(value === DEMO.id ? "" : value); };
    const room=places.find(p=>p.id===showcase), spot=room?.spots.find(s=>s.id===spotId)||room?.spots[0];
    const visitPlaces=()=>{setMoreOpen(false);if(!char)pick(DEMO.id);setShowcase("dayLaboratory");setSpotId("");setFollow(false);};
    const state = char ? (demo ? { day: "示例日程", time: DEMO_ROWS[demoIndex].time, rows: DEMO_ROWS, hasPlan: true, slot: { ...DEMO_ROWS[demoIndex], key: "demo:" + demoIndex } } : dayState(char, props.plansFor?.(char) || {}, now)) : null;
    const slot = preview || state?.slot, title = slot?.deviation?.actual || slot?.title || (state?.hasPlan ? "这会儿没排事情" : "今天还没有日程");
    const visitorData=props.visitorFor?.(char)||{};
    const payload = char && { persona:char.persona||"",motionStyle:demo?demoMotion:homes.motions?.[String(char.id)]||"auto",visitorData:{...visitorData,activityChoice:demo?"auto":homes.visitorActivities?.[String(char.id)]||"auto",motionStyle:demo?demoVisitorMotion:homes.visitorMotions?.[String(char.id)]||"auto"},charId: String(char.id), ta: props.taFor?.(char) || "TA", look: props.lookFor?.(char) || {}, visitorLook:meDraft||homes.looks?.me||visitorData.look||{},visitorPreview:mePanel,professional:demo?demoProfessional:homes.professional?.[String(char.id)]||{},slot: slot || null,
      at: preview || demo ? null : now, preview: !!preview || demo, editing: !!editor, resume:scenePause.current, homePlacements: editor ? editor.placements : demo ? demoLayout : homes.layouts?.[String(char.id)] || {},
      homeStyle: demo ? demoStyle : homes.styles?.[String(char.id)] || "warm", showcase: !!showcase && !editor,
      presentation: editor ? {map:"dayHome",action:"rest",gesture:"rest"} : showcase ? {map:showcase,action:spot?.action||"work",gesture:spot?.gesture||"rest",spot:spot?.id||"entry"} : presentation(slot), minute: showcase ? 720 : preview || demo ? String(slot?.time || "12:00").split(":").reduce((n, part, i) => n + Number(part) * (i ? 1 : 60), 0) : state.minute, follow: editor ? false : follow,
      key: showcase ? "place:"+showcase+":"+(spot?.id||"entry") : slot?.key || JSON.stringify([char.id, state?.day, slot?.time, slot?.end, slot?.title, slot?.location, slot?.deviation]) };
    if(payload&&(showcase||editor))payload.slot=null;
    stateRef.current = payload;
    const send = () => { try { iframe.current?.contentWindow?.CharDayScene?.setSnapshot(stateRef.current); } catch (_) { setSceneStatus("画面同步失败，请重新载入画面"); } };
    React.useLayoutEffect(() => { send(); }, [pulse, JSON.stringify(payload), retry, book, homeOptions]);
    useEffect(() => {
      const ready = e => {
        if (e.source !== iframe.current?.contentWindow || e.origin !== location.origin) return;
        if(e.data?.type === "char-day-activity"){setActivityStatus(e.data);return;}
        if(e.data?.type === "char-day-visit"){setVisitStatus(current=>({...e.data,saveNotice:current&&current.charId===e.data.charId?current.saveNotice:""}));rememberVisit(e.data);return;}
        if (e.data?.type === "char-day-layout") { setEditor(current => current ? {placements:e.data.placements,selected:e.data.selected,dragging:e.data.dragging,busy:e.data.busy} : null); setLayoutNotice(e.data.notice || ""); const list=iframe.current?.contentWindow?.CharDayScene?.listFurniture?.(); if(list)setFurniture(list); return; }
        if (e.data?.type === "char-day-view") { setFollow(!!e.data.following); return; }
        if (e.data?.type !== "char-day-status") return;
        setSceneStatus(e.data.error || ""); if (!e.data.error) { const motions=iframe.current?.contentWindow?.CharDayScene?.listMotions?.();if(motions)setMotionOptions(motions); const options = iframe.current?.contentWindow?.CharDayScene?.listStyles?.(); if (options) setStyles(options);setProfessionalChoices(iframe.current?.contentWindow?.CharDayScene?.professionalChoices?.()||{}); const list=iframe.current?.contentWindow?.CharDayScene?.listPlaces?.();if(list)setPlaces(list);send(); }
      };
      root.addEventListener("message", ready); return () => root.removeEventListener("message", ready);
    }, []);
    useEffect(()=>{if(!visitStatus?.present)setTogetherPanel(false);},[visitStatus?.present]);
    const openMe=()=>{visitAction("end");setMeDraft(homes.looks?.me||{});setMeNotice("");setMePanel(true);if(!meStyles)fetch("apps/fairy-garden/doll.json?v="+props.build).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setMeStyles).catch(()=>setMeNotice("衣柜还没打开，重新进入可以再试。"));};
    const saveMe=async()=>{if(meBusy)return;setMeBusy(true);try{const next=await saveHomeChange("me","looks",meDraft||{});setHomes(next);setMeDraft(null);setMePanel(false);setMoreOpen(false);}catch{setMeNotice("保存没成功，调整仍在这里，可以重试。");}finally{setMeBusy(false);}};
    const ink = "#4a493c", soft = "#827d69", paper = "#eeeadf";
    const visiting=visitStatus?.charId===String(char?.id)&&visitStatus.present;
    function rememberVisit(info,explicit=false){
      const current=stateRef.current,charId=String(info.charId||current?.charId||"");
      if(!info.present&&!explicit||!['auto','manual'].includes(info.control)||charId!==current?.charId||current.preview)return;
      const choice=visitChoice(info),before=visitSave.current[charId];
      if(before?.choice===choice&&!(explicit&&before.failed))return;
      const record=visitSave.current[charId]={choice,failed:false};
      if(!before&&choice===current.visitorData.activityChoice)return;
      saveHomeChange(charId,"visitorActivities",choice).then(next=>{
        setHomes(next);if(visitSave.current[charId]===record)setVisitStatus(v=>v?.charId===charId?{...v,saveNotice:""}:v);
      }).catch(()=>{
        record.failed=true;if(visitSave.current[charId]===record)setVisitStatus(v=>v?.charId===charId?{...v,saveNotice:"这次没能记住选择，当前仍按你的选择活动；重新选一次可以再保存。"}:v);
      });
    }
    const visitAction=kind=>{setTogetherPanel(false);const scene=iframe.current?.contentWindow?.CharDayScene,ok=scene?.visitAction?.(kind),info=scene?.inspect?.().visitor;if(info)rememberVisit(info,true);return ok;};
    const btn = { minHeight: 44, padding: "9px 12px", border: "1px solid #cfc5ae", borderRadius: 10, background: "#f9f5e9", color: ink, fontSize: 12 };
    const footerStyle={padding:"3px 6px",paddingBottom:"calc(3px + env(safe-area-inset-bottom) * 0.4)",borderTop:"1px solid #cfc5ae",minHeight:56,background:paper};
    const outer = body => h("div", { "data-wk": "cdaypage", className: "h-full flex flex-col", style: { position: "relative", background: paper, color: ink } }, body);
    const head = (back, right) => h(Head, { zh: "TA的一天", sub: char ? char.remark || char.name : "跟着TA看看今天", bg: "transparent", ink, onBack: back, right });
    const body = content => h("div", { ref: scroll, "data-wk": "cdaybody", className: "flex-1 min-h-0 overflow-y-auto", onScroll: e => { positions.current[homeOptions ? "style" : book ? "book" : "picker"] = e.currentTarget.scrollTop; }, style: { padding: "12px 16px 24px" } }, content);
    if (!char) return outer(h(React.Fragment, null, head(props.onBack), body(h(React.Fragment, null,
      h("p", { style: { fontSize: 13, lineHeight: 1.9, color: soft, margin: "0 0 16px" } }, "挑一位，看看TA此刻在哪儿、在做什么。"),
      ...(props.characters || []).map(c => {
        const st = dayState(c, props.plansFor?.(c) || {}, now);
        return h("button", { key: c.id, "data-wk": "cdaypick", onClick: () => pick(c.id), style: { ...btn, width: "100%", textAlign: "left", padding: 14, marginBottom: 10 } },
          h("strong", { style: { display: "block", fontSize: 15, fontWeight: 500 } }, c.remark || c.name),
          h("span", { style: { display: "block", marginTop: 5, lineHeight: 1.7, color: soft } }, st.slot?.title || (st.hasPlan ? "这会儿没排事情" : "今天还没有日程")));
      }), h("button", { onClick: () => pick(DEMO.id), style: { ...btn, width: "100%", marginTop: 12, background: "transparent", borderStyle: "dashed" } }, "先看一段示例"),
      h("button", { onClick: visitPlaces, "data-wk":"cdayplaces", style: { ...btn, width: "100%", marginTop: 10 } }, "新场景摆位试玩"),
      h("p", { style: { fontSize: 11, color: soft, lineHeight: 1.8 } }, "跟着日程走进小家、工作空间、小店和街道；专业日程也会走进实验室、图书馆、诊室和创作室。")))));
    const changeStyle = async value => {
      if (styleBusy) return;
      if (demo) { setDemoStyle(value); setStyleNotice("示例小家已换样式"); return; }
      setStyleBusy(true); setStyleNotice("");
      try {
        const next=await saveHomeChange(char.id,"styles",value);
        setHomes(next); setStyleNotice("已记住这位角色的小家样式");
      } catch (_) { setStyleNotice("这次没能保存，原样式还在，可以再试一次。"); }
      finally { setStyleBusy(false); }
    };
    const changeMotion=async(section,value)=>{
      if(styleBusy||!['auto',...motionOptions.map(p=>p.id)].includes(value))return;
      if(demo){(section==='motions'?setDemoMotion:setDemoVisitorMotion)(value);setStyleNotice("示例动作气质已调整");return;}
      setStyleBusy(true);setStyleNotice("");
      try{setHomes(await saveHomeChange(char.id,section,value));setStyleNotice("已记住你们各自的动作气质");}
      catch(_){setStyleNotice("这次没能保存，原来的动作气质还在，可以再试一次。");}
      finally{setStyleBusy(false);}
    };
    const motionChoice=(section,label)=>h("label",{style:{display:"block",marginBottom:14,fontSize:12,lineHeight:1.8}},label,
      h("select",{"data-wk":"cdaymotion","data-part":section,"aria-label":label,disabled:styleBusy,value:demo?(section==='motions'?demoMotion:demoVisitorMotion):homes[section]?.[String(char.id)]||"auto",onChange:e=>changeMotion(section,e.target.value),style:{...btn,height:44,display:"block",width:"100%",marginTop:6}},
        h("option",{value:"auto"},"自动参考人设"),...motionOptions.map(p=>h("option",{key:p.id,value:p.id},p.label+" · "+p.description))));
    const startEditor = () => { setMoreOpen(false);setTogetherPanel(false);setDecorPanel(""); setHomeOptions(false);setBook(false);setLayoutNotice("");setEditor({placements:JSON.parse(JSON.stringify(demo?demoLayout:homes.layouts?.[String(char.id)]||{})),selected:"double-bed",dragging:false}); };
    const cancelEditor = () => { if(layoutBusy||editor?.busy)return;setEditor(null);setDecorPanel("");setLayoutNotice(""); };
    const saveLayout = async () => {
      if(layoutBusy||editor?.dragging||editor?.busy)return;
      const checked=iframe.current?.contentWindow?.CharDayScene?.editLayout?.();
      if(!checked?.ok){setLayoutNotice(checked?.reason||"画面还在准备，稍等一下再保存。");return;}
      if(demo){setDemoLayout(checked.placements);setEditor(null);setDecorPanel("");setLayoutNotice("");return;}
      setLayoutBusy(true);setLayoutNotice("");
      try{
        const next=await saveHomeChange(char.id,"layouts",checked.placements);
        setHomes(next);setEditor(null);setDecorPanel("");setLayoutNotice("");
      }catch(_){setLayoutNotice("这次没能保存，试摆还在，可以再试一次；取消会回到原来的布置。");}
      finally{setLayoutBusy(false);}
    };
    const editorAction=action=>{if(layoutBusy)return;iframe.current?.contentWindow?.CharDayScene?.editAction(action);};
    const chosen=furniture.find(p=>p.id===editor?.selected);

    const closeDecorPanel=()=>{if(decorScroll.current)decorPositions.current[decorPanel]=decorScroll.current.scrollTop;setDecorPanel("");};
    const openDecorPanel=panel=>{
      if(layoutBusy||editor?.dragging||editor?.busy)return;
      const api=iframe.current?.contentWindow?.CharDayScene;if(!api)return;
      setDecorOptions(api.decorationOptions());if(panel==='catalog')setCatalog(api.listCatalog());setDecorPanel(panel);
    };
    const setPiece=change=>{if(!layoutBusy&&!editor?.dragging)editorAction(change);};
    const setRoom=change=>{if(!layoutBusy&&!editor?.dragging)iframe.current?.contentWindow?.CharDayScene?.editRoom(change);};
    const roomDecor=editor?.placements?.$room||{};
    const control=(label,element)=>h("div",{style:{display:"block",marginBottom:14,fontSize:12,lineHeight:1.8}},h("span",{style:{display:"block",marginBottom:6,color:soft}},label),element);
    const customColor=(hook,label,value,change)=>h("fieldset",{...hook,disabled:layoutBusy||editor?.busy,style:{border:0,padding:0,margin:0,minWidth:0}},h(ColorDot,{value,onChange:change,label,hexField:true,hexOnly:true,size:44,tone:{line:"#cfc5ae",ink,bg2:paper,field:"#f9f5e9",ink2:ink}}));
    const optionGrid=(options,selected,choose,attrs)=>h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},...Object.entries(options||{}).map(([key,value])=>h("button",{key,...attrs,"data-part":key,"aria-pressed":(selected||"auto")===key,disabled:layoutBusy||editor?.busy,onClick:()=>choose(key),style:{...btn,textAlign:"left",borderColor:(selected||"auto")===key?"#7c9269":"#cfc5ae"}},h("span",{style:{display:"inline-block",verticalAlign:"middle",marginRight:8,width:22,height:22,borderRadius:4,background:value.color||"#d6ccb9",backgroundImage:value.pattern==='stripe'?"repeating-linear-gradient(90deg,transparent 0 5px,#fff9 5px 6px)":value.pattern==='tile'?"linear-gradient(90deg,transparent 48%,#84756250 49%,#84756250 51%,transparent 52%),linear-gradient(transparent 48%,#84756250 49%,#84756250 51%,transparent 52%)":"none",backgroundSize:"12px 12px",border:"1px solid #b6ad99"}},null),value.label,(selected||"auto")===key?" · 已选":"")));
    const decorContents=decorPanel&&decorOptions&&h("section",{"data-wk":"cdaydecorpanel",className:"absolute inset-0 flex flex-col",style:{zIndex:5,background:paper}},
      h("div",{role:"status","data-wk":"cdaydecornotice",style:{padding:"8px 16px",fontSize:12,lineHeight:1.8,color:soft,borderBottom:"1px solid #cfc5ae"}},layoutNotice||"先试着搭配，回去看看，满意后点保存。"),
      h("div",{ref:decorScroll,"data-wk":"cdaydecorbody",className:"flex-1 min-h-0 overflow-y-auto",onScroll:e=>{decorPositions.current[decorPanel]=e.currentTarget.scrollTop;},style:{padding:"12px 16px 24px"}},
        decorPanel==='catalog'?h(React.Fragment,null,
          h("p",{style:{fontSize:12,color:soft,lineHeight:1.8,marginTop:0}},"原木藤编、复古深木、圆润现代、金属玻璃四组造型可以混搭。点一件添进小家，同款可多次添加；空位不够时先收纳。地毯能铺在桌椅下面。"),
          ...Object.entries(decorOptions.categories).map(([key,label])=>h("section",{key,style:{marginBottom:22}},h("h3",{style:{fontSize:14,fontWeight:500,borderBottom:"2px solid #cfc5ae",paddingBottom:7,margin:"0 0 10px"}},label),
            h("div",{style:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",gap:10}},...catalog.filter(item=>item.category===key).map(item=>h("button",{key:item.id,"data-wk":"cdaycatalogitem","data-part":item.id,"aria-label":item.label+" 添一件",disabled:layoutBusy||editor?.busy,onClick:()=>iframe.current?.contentWindow?.CharDayScene?.addFurniture(item.id),style:{...btn,minWidth:0,width:"calc((100% - 10px) / 2)",height:"auto",padding:"4px 8px 10px",textAlign:"left",borderRadius:7,boxShadow:"0 3px 0 #cfc5ae"}},h("div",{style:{position:"relative",width:"100%",aspectRatio:"1",marginBottom:4}},h("img",{src:item.thumbnail,alt:item.label,style:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",display:"block",borderRadius:4}})),h("span",{style:{display:"block",fontSize:12}},item.label),h("span",{style:{display:"block",fontSize:11,color:soft,marginTop:4}},(decorOptions.collections?.[item.collection]?.label||"花窗手作")+" · 添一件"))))))):
        decorPanel==='piece'?h(React.Fragment,null,
          control("选择要搭配的家具",h("select",{"data-wk":"cdaypiecepick","aria-label":"配色的家具",value:editor.selected,disabled:layoutBusy||editor?.busy,onChange:e=>iframe.current?.contentWindow?.CharDayScene?.selectFurniture(e.target.value),style:{...btn,width:"100%",height:44}},h("option",{value:""},"选择家具"),...furniture.map(p=>h("option",{key:p.id,value:p.id},p.label+(p.stored?" · 已收纳":""))))),
          chosen?h(React.Fragment,null,
            h("p",{style:{fontSize:12,color:soft,lineHeight:1.8}},"只改这件家具，其他物件保留自己的搭配。"),
            h("div",{"data-wk":"cdaypiececolors",style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}},...decorOptions.colors.map(v=>h("button",{key:v.color,"aria-label":v.label,"aria-pressed":chosen.color===v.color,disabled:layoutBusy||editor?.busy,onClick:()=>setPiece({color:v.color}),style:{...btn,padding:"8px 4px",borderColor:chosen.color===v.color?"#7c9269":"#cfc5ae"}},h("span",{style:{display:"block",margin:"0 auto 5px",width:25,height:25,borderRadius:5,background:v.color}},null),v.label,chosen.color===v.color?" · 已选":""))),
            control("自选颜色",customColor({"data-wk":"cdaypiececolor"},"家具",chosen.color||chosen.primary||"#cba77f",color=>setPiece({color}))),
            h("button",{style:{...btn,width:"100%",marginBottom:14},disabled:layoutBusy||editor?.busy,onClick:()=>setPiece({color:""})},"颜色随小家样式"),
            control("材质",h("select",{"data-wk":"cdaymaterial","aria-label":"家具材质",value:chosen.material||"auto",disabled:layoutBusy||editor?.busy,onChange:e=>setPiece({material:e.target.value}),style:{...btn,width:"100%",height:44}},...Object.entries(decorOptions.materials).map(([key,label])=>h("option",{key,value:key},label)))),
            chosen.actions?.length>0&&h("button",{"data-wk":"cdayusefurniture","aria-pressed":chosen.inUse,style:{...btn,width:"100%"},disabled:layoutBusy||editor?.busy||chosen.stored,onClick:()=>setPiece("use")},chosen.inUse?"TA正在用这件":"让TA用这件"),
            h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"床用于睡觉，餐椅用于用餐，沙发用于喝茶、看书和休息。收纳后会选小家里可用的同类家具。")):h("p",{style:{fontSize:12,color:soft}},"先选一件家具。")):
        h(React.Fragment,null,
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:0}},"墙面"),optionGrid(decorOptions.walls,roomDecor.wall,key=>setRoom({wall:key,wallColor:""}),{"data-wk":"cdaywall"}),
          h("div",{style:{marginTop:14}},control("墙面自选颜色",customColor({"data-wk":"cdaywallcolor"},"墙面",roomDecor.wallColor||decorOptions.walls[roomDecor.wall]?.color||"#eee3d1",wallColor=>setRoom({wallColor})))),
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:22}},"地板"),optionGrid(decorOptions.floors,roomDecor.floor,key=>setRoom({floor:key,floorColor:""}),{"data-wk":"cdayfloor"}),
          h("div",{style:{marginTop:14}},control("地板自选颜色",customColor({"data-wk":"cdayfloorcolor"},"地板",roomDecor.floorColor||decorOptions.floors[roomDecor.floor]?.color||"#cfb79b",floorColor=>setRoom({floorColor})))))));
    const camera=wide=>{setFollow(!wide);const api=iframe.current?.contentWindow?.CharDayScene;wide?api?.overview():api?.focus();setMoreOpen(false);setTogetherPanel(false);};
    const canVisit=!editor&&!demo&&!preview&&!showcase&&payload.presentation.map==="dayHome";
    const controlsOpen=(moreOpen&&!mePanel)||togetherPanel||professionalPanel;
    const menuBody=content=>h("div",{ref:menuScroll,"data-wk":"cdaymenubody",className:"flex-1 min-h-0 overflow-y-auto",onScroll:e=>{menuPositions.current[moreOpen?"more":"life"]=e.currentTarget.scrollTop;},style:{padding:"12px 16px 24px"}},content);
    const menuSection=(label,content)=>h("section",{"data-wk":"cdaymenusection",style:{marginBottom:22}},h("h3",{style:{margin:"0 0 8px",fontSize:12,fontWeight:500,color:soft}},label),content);
    const menuRow=(attrs,label,detail,action,Icon)=>h("button",{...attrs,"aria-label":label,onClick:action,style:{...btn,display:"flex",alignItems:"center",gap:12,width:"100%",border:0,borderBottom:"1px solid #d5cebd",borderRadius:0,background:"transparent",textAlign:"left",padding:"13px 0"}},Icon&&h(Icon,{size:20,color:soft}),h("span",{style:{flex:1,minWidth:0}},h("span",{style:{display:"block",fontSize:14}},label),detail&&h("span",{style:{display:"block",marginTop:4,fontSize:11,lineHeight:1.7,color:soft}},detail)),h(IChevR,{size:16,color:soft}));
    const navButton=(attrs,label,Icon,action,extra={})=>h("button",{...attrs,...extra,onClick:action,style:{...btn,flex:1,minWidth:0,padding:"5px 2px",border:0,borderRadius:0,background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,fontSize:11,lineHeight:1.2}},h(Icon,{size:19,color:extra["aria-pressed"]?"#57734b":ink}),h("span",null,label));
    if (homeOptions) return outer(h(React.Fragment, null, h(Head,{zh:"小家样式",sub:char.remark||char.name,bg:"transparent",ink,onBack:()=>setHomeOptions(false)}), body(h(React.Fragment, null,
      h("p", { style: { fontSize: 14, lineHeight: 1.9, marginTop: 0 } }, "你们的小家"),
      h("p", { style: { fontSize: 12, color: soft, lineHeight: 1.9 } }, "这是小世界里的共同住处。挑喜欢的样式，角色原本的住址和经历照旧。卧室、起居室和厨房餐区之外，也留了添家具的位置。家具可挪动、旋转、收纳和摆回，也能添同款多件、独立配色换材质、选择TA使用的床椅，墙纸与地板也可以自己搭配。"),
      h("p",{style:{fontSize:13,margin:"18px 0 6px"}},"小人的动作气质"),
      h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"自动参考人设中的性格描写，也可以自己挑动作气质。每个人都有自己的节奏和坐姿。"),
      motionChoice("motions","TA的动作气质"),motionChoice("visitorMotions","我的动作气质"),
      ...styles.map(option => h("button", { key: option.id, "data-wk": "cdaystyle", "aria-pressed": payload.homeStyle === option.id, disabled: styleBusy,
        onClick: () => changeStyle(option.id), style: { ...btn, display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", marginBottom: 12, padding: 14, borderColor: payload.homeStyle === option.id ? "#7c9269" : "#cfc5ae" } },
        h("span", { style: { display: "flex" } }, ...option.colors.map((color, i) => h("span", { key: i, style: { display: "block", width: 22, height: 32, background: color } }))),
        h("span", null, option.label, payload.homeStyle === option.id ? " · 正在用" : ""))),
      h("button", { "data-wk":"cdaydecorate", style:{...btn,width:"100%",marginTop:4}, onClick:startEditor }, "布置小家"),
      styleNotice && h("p", { role: "status", style: { fontSize: 12, lineHeight: 1.8 } }, styleNotice),
      h("button", { style: { ...btn, width: "100%" }, onClick: () => {setHomeOptions(false);setMoreOpen(false);} }, "回去看看")))));
    if (book) return outer(h(React.Fragment, null, h(Head,{zh:"今天的日程",sub:char.remark||char.name,bg:"transparent",ink,onBack:()=>setBook(false)}), body(h(React.Fragment, null,
      h("p", { style: { fontSize: 12, color: soft, lineHeight: 1.8, marginTop: 0 } }, demo ? "示例安排，仅用于试玩。" : state.day + " · TA当地 " + state.time),
      !state.rows.length && h("p", { style: { fontSize: 13, lineHeight: 1.9 } }, "还没有今天的安排，可以到日历里排好再来看。"),
      ...state.rows.map((row, i) => h("button", { key: i, "data-wk": "cdayrow", "data-on": String(slot?.time === row.time), onClick: () => {
        if (demo) setDemoIndex(i); else setPreview({ ...row, key: "preview:" + char.id + ":" + state.day + ":" + JSON.stringify(row) });
        setBook(false);
      }, style: { ...btn, width: "100%", textAlign: "left", borderRadius: 0, border: 0, borderLeft: "2px solid " + (state.slot?.time === row.time ? "#7c9269" : "#cfc5ae"), padding: "12px 14px", marginBottom: 8 } },
        h("span", { style: { fontSize: 11, color: soft } }, row.time + "—" + row.end + (state.slot?.time === row.time ? " · 此刻" : "")),
        h("div", { style: { fontSize: 14, lineHeight: 1.8, marginTop: 4 } }, row.title),
        row.location && h("div", { style: { color: soft, fontSize: 12, lineHeight: 1.8 } }, row.location),
        row.deviation && h("div", { style: { color: "#9b674d", fontSize: 12, lineHeight: 1.8 } }, "临时改了：" + (row.deviation.actual || row.deviation.reason || "安排有变化")))),
      !demo && h("button", { style: { ...btn, width: "100%", marginTop: 12 }, onClick: () => props.onSchedule?.(char) }, "去日历看完整安排")))));
    return outer(h(React.Fragment, null, h("div",{className:"flex-1 min-h-0 flex flex-col","aria-hidden":controlsOpen||undefined,inert:controlsOpen?"":undefined},editor ? h(Head,{zh:decorPanel==="catalog"?"添家具":decorPanel==="piece"?"家具配色":decorPanel==="room"?"墙面地板":"布置小家",sub:char.remark||char.name,bg:"transparent",ink,onBack:decorPanel?closeDecorPanel:cancelEditor,right:h("button",{"data-wk":"cdaysavelayout",disabled:layoutBusy||editor.dragging||editor.busy,style:{...btn,border:0,background:"transparent"},onClick:saveLayout},layoutBusy?"保存中":"保存")}) : head(() => pick(""), h("button", { style: { ...btn, border: 0, background: "transparent" }, onClick: () => pick("") }, "换人")),
      h("div", { "data-wk": "cdayscene", className: "flex-1 min-h-0 relative", style: { overflow: "hidden" } },
        h("iframe", { key: char.id + ":" + retry, ref: bindScene, title: "TA的一天场景", "aria-hidden":!!decorPanel, src: "apps/fairy-garden/day/index.html?v=" + props.build,
          onLoad: send, style: { width: "100%", height: "100%", border: 0, display: "block", pointerEvents:layoutBusy?"none":"auto" } }),
        editor ? h("div",{"data-wk":"cdayeditnote",role:"status",style:{display:decorPanel?"none":"block",position:"absolute",top:66,left:12,right:12,padding:"10px 12px",borderRadius:12,background:"rgba(250,247,236,.94)",fontSize:12,lineHeight:1.7,pointerEvents:"none"}},layoutNotice||"拖动家具试摆 · 空地拖动看四周，双指缩放",h("div",{style:{fontSize:11,color:soft}},"床椅收起后会换可用同类，没有同类就先休息。")) : h("div", { "data-wk": "cdaynow", style: { visibility:mePanel?"hidden":"visible",position: "absolute", top: 12, left: 12, right: 12, maxWidth:480, padding: "11px 14px", borderRadius: 12, background: "rgba(250,247,236,.94)", boxShadow: "0 2px 18px #6d5b3020", pointerEvents: "none" } },
          h("div", { style: { fontSize: 11, color: soft } }, showcase ? "摆位试玩 · "+(room?.label||"正在准备房间") : demo ? "示例试玩 · " + slot.time : preview ? "预览日程 · " + slot.time + "—" + slot.end : "此刻 · TA当地 " + state.time),
          h("div", { style: { fontSize: 14, lineHeight: 1.7, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, showcase ? (spot ? spot.number+" · "+spot.label : "入口") : title),
          showcase && spot && h("div", { style: { fontSize: 11, lineHeight: 1.6, color: soft, marginTop: 3 } }, spot.description),
          !showcase && slot?.location && h("div", { style: { fontSize: 11, lineHeight: 1.6, color: soft, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, slot.location + (!preview && !demo && activityStatus?.charId===payload.charId && activityStatus?.key===payload.key && activityStatus.label ? " · "+activityStatus.label+" · "+activityStatus.spotLabel : "")),
          !showcase && slot?.deviation && h("div", { style: { fontSize: 11, color: "#9b674d", marginTop: 3 } }, "安排临时改了"),
          !demo&&!preview&&!showcase&&visitStatus?.charId===String(char.id)&&(visitStatus.notice||visitStatus.saveNotice)&&h("div",{"data-wk":"cdayvisitnote",role:"status",style:{fontSize:11,color:soft,lineHeight:1.6,marginTop:3}},[visitStatus.notice,visitStatus.saveNotice].filter(Boolean).join(" · "))),
        sceneStatus && h("div", { role: "status", style: { position: "absolute", top: "48%", left: 16, right: 16, textAlign: "center", padding: 16, background: "#eeeadfe8", borderRadius: 12, fontSize: 12 } }, sceneStatus,
          sceneStatus.includes("失败") && h("button", { style: { ...btn, display: "block", margin: "12px auto 0" }, onClick: () => { setSceneStatus("正在准备画面…");setVisitStatus(null); setRetry(x => x + 1); } }, "重新载入画面")),
        editor&&!decorPanel&&h("div",{"data-wk":"cdaydecoractions",style:{position:"absolute",top:12,left:12,right:12,display:"flex",gap:6}},...[["catalog","添家具"],["piece","配色"],["room","墙地面"]].map(([key,label])=>h("button",{key,"data-part":key,style:{...btn,flex:1},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>openDecorPanel(key)},label))),
        decorContents,
        editor&&!decorPanel && h("select",{"data-wk":"cdayfurniture","aria-label":"选择家具",disabled:layoutBusy||editor.dragging||editor.busy,value:editor.selected,onChange:e=>iframe.current?.contentWindow?.CharDayScene?.selectFurniture(e.target.value),style:{...btn,position:"absolute",left:12,right:12,bottom:12,width:"calc(100% - 24px)",height:44,fontSize:13}},h("option",{value:""},"选择家具"),...furniture.map(p=>h("option",{key:p.id,value:p.id},p.label+(p.stored?" · 已收纳":"")))),
        !editor && h("div", { style: { position: "absolute", bottom: 8, left: 10, right: 10, textAlign: "center", fontSize: 10, color: "#655e50", pointerEvents: "none", textShadow:"0 1px 3px #fff" } }, visiting ? "点空地走过去 · 拖动看四周，双指缩放" : "拖动看四周 · 双指缩放")),
      !editor&&showcase&&room&&h("div",{className:"shrink-0",style:{padding:"6px 12px",background:paper,borderTop:"1px solid #cfc5ae"}},h("select",{"data-wk":"cdayplacepoint","aria-label":"选择动作位置",value:spot?.id||"",onChange:e=>setSpotId(e.target.value),style:{...btn,width:"100%",height:44,fontSize:13}},...room.spots.map(s=>h("option",{key:s.id,value:s.id},s.number+" · "+s.label)))),
      editor ? h("div",{"data-wk":"cdayedittools",className:"shrink-0",style:{...footerStyle,display:"flex",gap:4}},
        decorPanel?h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor?.busy,onClick:closeDecorPanel},"回去摆放"):h(React.Fragment,null,
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy||!chosen||chosen.stored,onClick:()=>editorAction("rotate")},"旋转"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy||!chosen,onClick:()=>editorAction(chosen?.stored?"restore":"store")},chosen?.stored?"摆回":"收纳"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>editorAction("undo")},"撤销"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>iframe.current?.contentWindow?.CharDayScene?.overview()},"全景"))) : h("div", { "data-wk": "cdaytools", className: "shrink-0", style:{...footerStyle,display:"flex",gap:4} },
        showcase?navButton({"data-wk":"cdayreturn"},"回到日程",IArrow,()=>{setShowcase("");setSpotId("");setFollow(true);}):demo?navButton({"data-wk":"cdaynext"},"下一段",IRepeat,()=>setDemoIndex(i=>(i+1)%DEMO_ROWS.length)):props.renderChat&&navButton({"data-wk":"cdaychatopen"},"聊聊",GMsg,()=>{setChatMounted(true);setChatOpen(v=>!v);props.onChatOpen?.(char);},{"aria-pressed":chatOpen}),
        showcase?navButton({"data-wk":"cdaynextplace"},"换场景",IRepeat,()=>{const next=places[(places.findIndex(p=>p.id===showcase)+1)%places.length];if(next){setShowcase(next.id);setSpotId("");setFollow(false);}}):visiting?navButton({"data-wk":"cdaylifeopen"},"生活",IHome,()=>setTogetherPanel(true),{"data-action":"together"}):canVisit?navButton({"data-wk":"cdayvisitopen"},visitStatus?.busy?"准备中…":"进小屋",IHome,()=>iframe.current?.contentWindow?.CharDayScene?.joinVisit?.(),{disabled:visitStatus?.busy}):navButton({"data-wk":"cdayfollow"},"跟着TA",ICamera,()=>camera(false),{"aria-pressed":follow}),
        preview?navButton({"data-wk":"cdayreturn"},"回到此刻",IArrow,()=>setPreview(null)):navButton({"data-wk":"cdayscheduleopen"},"日程",GDiary,()=>setBook(true),{"aria-label":"今天的日程"}),
        navButton({"data-wk":"cdaymoreopen"},"更多",IDots,()=>setMoreOpen(true),{"aria-expanded":moreOpen}))),
      moreOpen&&!mePanel&&!professionalPanel&&h("section",{"data-wk":"cdaymore",className:"absolute inset-0 flex flex-col",style:{background:paper,zIndex:18}},h(Head,{zh:"更多",sub:char.remark||char.name,bg:"transparent",ink,onBack:()=>setMoreOpen(false)}),menuBody(h(React.Fragment,null,
        menuSection("看看四周",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[[false,"跟着TA"],[true,"看全景"]].map(([wide,label])=>h("button",{key:label,"aria-pressed":follow!==wide,style:{...btn,display:"flex",alignItems:"center",justifyContent:"center",gap:8},onClick:()=>camera(wide)},h(ICamera,{size:18,color:soft}),label)))),
        menuSection("你们的小家",h(React.Fragment,null,
          !demo&&!showcase&&menuRow({"data-wk":"cdaymeopen"},"我的样貌","头发、衣服和身形",openMe,GUser),
          menuRow({"data-wk":"cdayhomestyle"},"小家样式","房间配色与两人的动作气质",()=>{setBook(false);setVisitStatus(null);setHomeOptions(true);},IHome),
          menuRow({"data-wk":"cdaydecorate"},"布置小家","添家具、挪位置、搭配墙面和地板",startEditor,IPencil))),
        menuSection("场景",h(React.Fragment,null,
          Object.keys(professionalChoices).length>0&&menuRow({"data-wk":"cdayprofessionalopen"},"场景摆件","研究器材、创作材料和排练摆件",()=>setProfessionalPanel(true),GConfig),
          menuRow({"data-wk":"cdayplaces"},"新场景","实验室、图书馆、诊室与更多地方",visitPlaces,ICamera))))),
        h("div",{className:"shrink-0",style:{...footerStyle,paddingLeft:16,paddingRight:16}},h("button",{style:{...btn,width:"100%",border:0,background:"transparent"},onClick:()=>setMoreOpen(false)},"回到小世界"))),
      professionalPanel&&h("div",{"data-wk":"cdayprofessional",className:"absolute inset-0 flex flex-col",style:{background:paper,zIndex:20}},h(Head,{zh:"场景摆件",bg:"transparent",ink,onBack:()=>setProfessionalPanel(false)}),h("div",{className:"flex-1 min-h-0 overflow-y-auto",style:{padding:16}},h("p",{style:{fontSize:12,lineHeight:1.8}},"为这位角色选研究器材、创作材料和排练摆件。只改变小世界的画面。"),...Object.entries(professionalChoices).map(([scene,option])=>h("label",{key:scene,style:{display:"block",marginBottom:18,fontSize:13}},option.label,h("select",{"data-professional":scene,disabled:professionalBusy,style:{...btn,width:"100%",marginTop:8},value:payload.professional[scene]?.[option.field]||Object.keys(option.values)[0],onChange:async e=>{const value=e.target.value,next={...payload.professional,[scene]:{[option.field]:value}};setProfessionalBusy(true);setProfessionalNotice("");try{if(demo){setDemoProfessional(next);}else setHomes(await saveHomeChange(char.id,"professional",next));}catch{setProfessionalNotice("没能保存，原摆件还在，可以再试。");}finally{setProfessionalBusy(false);}}},...Object.entries(option.values).map(([value,label])=>h("option",{key:value,value},label))))),professionalNotice&&h("p",{role:"status"},professionalNotice))),
      togetherPanel&&visiting&&h("section",{"data-wk":"cdayinteraction",className:"absolute inset-0 flex flex-col",style:{background:paper,zIndex:20}},h(Head,{zh:"一起生活",sub:char.remark||char.name,bg:"transparent",ink,onBack:()=>setTogetherPanel(false)}),menuBody(h(React.Fragment,null,
        menuSection("我的活动",h(React.Fragment,null,h("p",{style:{fontSize:11,color:soft,lineHeight:1.8,margin:"0 0 10px"}},"手动选择会一直优先；想让小人自己安排，再选自动活动。"),
          h("select",{"data-wk":"cdayvisitactivity","aria-label":"你在小家做什么",value:visitChoice(visitStatus),style:{...btn,width:"100%",height:44},onChange:e=>visitAction(e.target.value)},h("option",{value:"auto"},"自动活动"),h("option",{value:"manual"},"手动控制 · 停下来"),...[["read","手动 · 看会书"],["drink","手动 · 喝口水"],["eat","手动 · 在餐桌吃点东西"],["rest","手动 · 坐着歇会"]].map(([kind,label])=>h("option",{key:kind,value:kind},label))),
          h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:10}},...[["near","靠近TA"],[visitStatus.seated?"stand":"sit",visitStatus.seated?"起身":"坐旁边"]].map(([kind,label])=>h("button",{key:kind,"data-action":kind,style:btn,onClick:()=>visitAction(kind)},label))))),
        menuSection("一起做什么",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[["hand","牵手"],["hug","拥抱"],["shoulder","靠肩"],["read","一起看书"],["meal","一起吃饭"],["cook","一起做饭"]].map(([kind,label])=>h("button",{key:kind,"data-action":kind,style:btn,onClick:()=>visitAction("together:"+kind)},label)))),
        menuSection("结束与离开",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[["end","结束互动"],["leave","离开小屋"]].map(([kind,label])=>h("button",{key:kind,"data-action":kind,style:btn,onClick:()=>visitAction(kind)},label)))),
        h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"TA照着自己的日程生活。点空地可以自由走动，坐下和互动会先走到实际的位置。"))),
        h("div",{className:"shrink-0",style:{...footerStyle,paddingLeft:16,paddingRight:16}},h("button",{style:{...btn,width:"100%",border:0,background:"transparent"},onClick:()=>setTogetherPanel(false)},"回到小世界"))),
      mePanel&&h("div",{"data-wk":"cdaymelook",className:"absolute inset-0 flex flex-col",style:{zIndex:25,pointerEvents:"none"}},h("div",{style:{pointerEvents:"auto",background:paper}},h(Head,{zh:"我的样貌",bg:"transparent",ink,onBack:()=>{if(meBusy)return;setMeDraft(null);setMePanel(false);}})),h("div",{style:{height:"32%",minHeight:110,flexShrink:0}}),h("div",{className:"flex-1 min-h-0 overflow-y-auto",style:{pointerEvents:"auto",background:paper,padding:16}},h("p",{style:{fontSize:12,lineHeight:1.8,marginTop:0}},"这份样貌用于你在TA的一天里的小人，所有角色共用。也可以取用庭院存档里的你。"),h("select",{"aria-label":"取用庭院样貌",style:{...btn,width:"100%",marginBottom:16},defaultValue:"",onChange:e=>{const value=props.readAppearance?.(e.target.value);if(value){setMeDraft(value);setMeNotice("");}else setMeNotice("这份存档还没有保存你的样貌。");}},h("option",{value:""},"从庭院存档取用…"),...(props.appearanceSaves||[]).map(row=>h("option",{key:row.id,value:row.key},row.name||"庭院存档"))),meStyles&&root.GardenDressControls?h(root.GardenDressControls,{who:"me",look:{me:meDraft||{}},styles:meStyles,game:()=>iframe.current?.contentWindow?.CharDayScene?.visitorWardrobe?.(),pushLook:patch=>setMeDraft(current=>iframe.current?.contentWindow?.CharDayScene?.mergeVisitorLook?.(patch,current)||current)}):h("p",null,"正在打开衣柜…"),meNotice&&h("p",{role:"status"},meNotice)),h("div",{className:"shrink-0",style:{pointerEvents:"auto",background:paper,padding:6,paddingBottom:"calc(6px + env(safe-area-inset-bottom) * 0.4)"}},h("button",{style:{...btn,width:"100%"},disabled:meBusy,onClick:saveMe},meBusy?"保存中…":"保存样貌"))),
      chatMounted && !editor && !demo && !showcase && h("section", { "data-wk": "cdaychat", "aria-label": "和" + (char.remark || char.name) + "聊天", hidden: !chatOpen||controlsOpen||mePanel,
        className: "absolute left-0 right-0 flex flex-col", style: { display: chatOpen&&!controlsOpen&&!mePanel ? "flex" : "none", top: kbLift ? "15%" : "50%", bottom: kbLift, zIndex: 8, background: paper, borderTop: "1px solid #cfc5ae", boxShadow: "0 -4px 18px #6d5b3020" } },
        h("div", { "data-wk": "cdaychatbar", className: "shrink-0 flex items-center", style: { gap: 8, padding: "2px 12px", minHeight: 44, borderBottom: "1px solid #cfc5ae" } },
          h("span", { style: { flex: 1, minWidth: 0, fontSize: 11, color: soft } }, "主聊天 · 最近20条"),
          h("button", { style: { ...btn, border: 0, background: "transparent" }, onClick: () => props.onMainChat?.(char) }, "完整聊天"),
          h("button", { "aria-label": "收起聊天", style: { ...btn, border: 0, background: "transparent" }, onClick: () => setChatOpen(false) }, "收起")),
        h("div", { className: "flex-1 min-h-0 relative" }, props.renderChat?.(char, { visible: chatOpen, close: () => setChatOpen(false) })))));
  };
})(window);
