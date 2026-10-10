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
  function saveHomeUpdate(update){
    const write=homeWrite.catch(()=>{}).then(async()=>{
      const previous=loadJSON("x_charDayHomes",{})||{},next=update(previous);
      const result=await commitJSONDurable("x_charDayHomes",next);
      if(!result?.durable||!result?.live)throw Error("save");
      return next;
    });homeWrite=write;return write;
  }
  function saveHomeChange(charId,section,value){
    return saveHomeUpdate(previous=>({...previous,version:3,[section]:{...previous[section],[String(charId)]:typeof value==='function'?value(previous[section]?.[String(charId)]):value}}));
  }
  const visitChoice=info=>info.control==="auto"?"auto":["read","drink","eat","rest"].includes(info.manualAction)?info.manualAction:"manual";
  root.CharDayKit = { dayState, presentation, DEMO, DEMO_ROWS, saveHomeChange, saveHomeUpdate, visitChoice };
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
    const [cameraMode,setCameraMode]=useState('ta'),[lifePage,setLifePage]=useState(''),[lifeBusy,setLifeBusy]=useState(false),[lifeNotice,setLifeNotice]=useState(''),[photoId,setPhotoId]=useState(''),[photoNote,setPhotoNote]=useState(''),[deletePhoto,setDeletePhoto]=useState(false),[kitchenStatus,setKitchenStatus]=useState(null),[wish,setWish]=useState(''),[catalogLabels,setCatalogLabels]=useState({}),[recommendedFurniture,setRecommendedFurniture]=useState([]);
    const L=root.CharDayLife,S=root.CharDaySocial;
    const [homeChoices,setHomeChoices]=useState({});
    const kbLift = useKbLift();
    const now = Date.now();
    const iframe = useRef(null), scroll = useRef(null), positions = useRef({}), stateRef = useRef(null),decorScroll=useRef(null),decorPositions=useRef({}),visitSave=useRef({}),scenePause=useRef(null),menuScroll=useRef(null),menuPositions=useRef({}),kitchenReady=useRef({});
    const menuKey=lifePage?(lifePage==='album'&&photoId?'photo:'+photoId:lifePage):moreOpen?'more':'life';
    // The schedule/style pages unmount the iframe. Keep only this view's live
    // position in memory so returning or entering the editor can resume it.
    const bindScene=React.useCallback(node=>{if(!node&&iframe.current){try{scenePause.current=iframe.current.contentWindow?.CharDayScene?.pauseState?.()||null;}catch{scenePause.current=null;}}iframe.current=node;},[]);
    const demo = id === DEMO.id, char = demo ? DEMO : (props.characters || []).find(c => String(c.id) === String(id));
    useEffect(() => {
      props.onChatVisibility?.(char, chatOpen && !editor && !demo && !showcase && !book && !homeOptions && !moreOpen && !togetherPanel && !professionalPanel && !mePanel && !lifePage);
      return () => props.onChatVisibility?.(null, false);
    }, [id, chatOpen, showcase, book, homeOptions, editor, moreOpen, togetherPanel, professionalPanel, mePanel, lifePage]);
    useEffect(() => { const timer = setInterval(() => setPulse(n => n + 1), 1000); return () => clearInterval(timer); }, []);
    React.useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = positions.current[homeOptions ? "style" : book ? "book" : "picker"] || 0; }, [book, homeOptions, id]);
    React.useLayoutEffect(()=>{if(decorScroll.current)decorScroll.current.scrollTop=decorPositions.current[decorPanel]||0;},[decorPanel]);
    React.useLayoutEffect(()=>{if(menuScroll.current)menuScroll.current.scrollTop=menuPositions.current[menuKey]||0;},[moreOpen,togetherPanel,mePanel,professionalPanel,book,homeOptions,id,lifePage,photoId]);
    const pick = value => { setLifePage('');setPhotoId('');setLifeNotice('');setKitchenStatus(null);setCameraMode('ta'); setMoreOpen(false);setTogetherPanel(false);setMePanel(false);setProfessionalPanel(false);setId(value); setPreview(null); setBook(false); setDemoIndex(0); setHomeOptions(false); setEditor(null); setDecorPanel(""); setLayoutNotice(""); setStyleNotice(""); setShowcase(""); setSpotId(""); setChatOpen(false); setChatMounted(false); setVisitStatus(null); setFollow(true); setSceneStatus("正在准备画面…"); props.onSelect?.(value === DEMO.id ? "" : value); };
    const room=places.find(p=>p.id===showcase), spot=room?.spots.find(s=>s.id===spotId)||room?.spots[0];
    const visitPlaces=()=>{setMoreOpen(false);if(!char)pick(DEMO.id);setShowcase("dayLaboratory");setSpotId("");setFollow(false);};
    const state = char ? (demo ? { day: "示例日程", time: DEMO_ROWS[demoIndex].time, rows: DEMO_ROWS, hasPlan: true, slot: { ...DEMO_ROWS[demoIndex], key: "demo:" + demoIndex } } : dayState(char, props.plansFor?.(char) || {}, now)) : null;
    const slot = preview || state?.slot, title = slot?.deviation?.actual || slot?.title || (state?.hasPlan ? "这会儿没排事情" : "今天还没有日程");
    const visitorData=props.visitorFor?.(char)||{};
    const payload = char && { persona:char.persona||"",motionStyle:demo?demoMotion:homes.motions?.[String(char.id)]||"auto",visitorData:{...visitorData,homePresence:homeChoices[String(char.id)]||homes.presence?.[String(char.id)]||'with',activityChoice:demo?"auto":homes.visitorActivities?.[String(char.id)]||"auto",motionStyle:demo?demoVisitorMotion:homes.visitorMotions?.[String(char.id)]||"auto"},charId: String(char.id), ta: props.taFor?.(char) || "TA", look: props.lookFor?.(char) || {}, visitorLook:meDraft||homes.looks?.me||visitorData.look||{},visitorPreview:mePanel,professional:demo?demoProfessional:homes.professional?.[String(char.id)]||{},slot: slot || null,
      at: preview || demo ? null : now, preview: !!preview || demo, editing: !!editor, resume:scenePause.current, homePlacements: editor ? editor.placements : demo ? demoLayout : homes.layouts?.[String(char.id)] || {},
      homeStyle: demo ? demoStyle : homes.styles?.[String(char.id)] || "warm", showcase: !!showcase && !editor,
      presentation: editor ? {map:"dayHome",action:"rest",gesture:"rest"} : showcase ? {map:showcase,action:spot?.action||"work",gesture:spot?.gesture||"rest",spot:spot?.id||"entry"} : presentation(slot), cameraMode,kitchenJob:demo?null:homes.kitchens?.[String(char.id)]?.pending||null, minute: showcase ? 720 : preview || demo ? String(slot?.time || "12:00").split(":").reduce((n, part, i) => n + Number(part) * (i ? 1 : 60), 0) : state.minute, follow: editor ? false : follow,
      key: showcase ? "place:"+showcase+":"+(spot?.id||"entry") : slot?.key || JSON.stringify([char.id, state?.day, slot?.time, slot?.end, slot?.title, slot?.location, slot?.deviation]) };
    if(payload&&(showcase||editor))payload.slot=null;
    stateRef.current = payload;
    const send = () => { try { iframe.current?.contentWindow?.CharDayScene?.setSnapshot({...stateRef.current,viewInsets:(()=>{const el=iframe.current?.parentElement,box=el?.getBoundingClientRect(),card=el?.querySelector('[data-wk=cdaynow]')?.getBoundingClientRect(),chat=el?.parentElement?.parentElement?.querySelector('[data-wk=cdaychat]');return {top:card&&box?Math.max(24,card.bottom-box.top+14):130,bottom:chat&&!chat.hidden&&box?Math.max(30,box.bottom-chat.getBoundingClientRect().top+14):30,left:18,right:18};})()}); } catch (_) { setSceneStatus("画面同步失败，请重新载入画面"); } };
    React.useLayoutEffect(() => { send(); }, [pulse, JSON.stringify(payload), retry, book, homeOptions]);
    useEffect(() => {
      const ready = e => {
        if (e.source !== iframe.current?.contentWindow || e.origin !== location.origin) return;
        if(e.data?.type === "char-day-kitchen"){handleKitchen(e.data);return;}
        if(e.data?.type === "char-day-activity"){setActivityStatus(e.data);return;}
        if(e.data?.type === "char-day-visit"){setVisitStatus(current=>({...e.data,saveNotice:current&&current.charId===e.data.charId?current.saveNotice:"",homeSaveNotice:current&&current.charId===e.data.charId?current.homeSaveNotice:""}));rememberVisit(e.data);return;}
        if (e.data?.type === "char-day-layout") { setEditor(current => current ? {placements:e.data.placements,selected:e.data.selected,dragging:e.data.dragging,busy:e.data.busy} : null); setLayoutNotice(e.data.notice || ""); const list=iframe.current?.contentWindow?.CharDayScene?.listFurniture?.(); if(list)setFurniture(list); return; }
        if (e.data?.type === "char-day-view") { setFollow(!!e.data.following);setCameraMode(e.data.mode|| (e.data.following?'ta':'free')); return; }
        if (e.data?.type !== "char-day-status") return;
        setSceneStatus(e.data.error || ""); if (!e.data.error) {setCatalogLabels(iframe.current?.contentWindow?.CharDayScene?.catalogLabels?.()||{}); const motions=iframe.current?.contentWindow?.CharDayScene?.listMotions?.();if(motions)setMotionOptions(motions); const options = iframe.current?.contentWindow?.CharDayScene?.listStyles?.(); if (options) setStyles(options);setProfessionalChoices(iframe.current?.contentWindow?.CharDayScene?.professionalChoices?.()||{}); const list=iframe.current?.contentWindow?.CharDayScene?.listPlaces?.();if(list)setPlaces(list);send(); }
      };
      root.addEventListener("message", ready); return () => root.removeEventListener("message", ready);
    }, []);
    useEffect(()=>{if(!visitStatus?.present)setTogetherPanel(false);},[visitStatus?.present]);
    const openMe=()=>{visitAction("end");setMeDraft(homes.looks?.me||{});setMeNotice("");setMePanel(true);if(!meStyles)fetch("apps/fairy-garden/doll.json?v="+props.build).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setMeStyles).catch(()=>setMeNotice("衣柜还没打开，重新进入可以再试。"));};
    const saveMe=async()=>{if(meBusy)return;setMeBusy(true);try{const next=await saveHomeChange("me","looks",meDraft||{});setHomes(next);setMeDraft(null);setMePanel(false);setMoreOpen(false);}catch{setMeNotice("保存没成功，调整仍在这里，可以重试。");}finally{setMeBusy(false);}};
    const ink = "#4a493c", soft = "#827d69", paper = "#eeeadf";
    const socialSetting=S.setting(payload),homeVisiting=socialSetting?.home&&visitStatus?.present;
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
    function rememberHomeChoice(choice){
      if(demo||payload.presentation.map!=='dayHome')return;
      const charId=String(char.id);setHomeChoices(current=>({...current,[charId]:choice}));
      saveHomeChange(charId,'presence',choice).then(next=>{setHomes(next);setVisitStatus(v=>v?.charId===charId?{...v,homeSaveNotice:''}:v);}).catch(()=>setVisitStatus(v=>v?.charId===charId?{...v,homeSaveNotice:'这次没能记住进出选择，当前仍按你的选择；再选一次可以重试。'}:v));
    }
    const joinVisit=()=>{rememberHomeChoice('with');return iframe.current?.contentWindow?.CharDayScene?.joinVisit?.();};
    const visitAction=kind=>{setTogetherPanel(false);if(kind==='leave')rememberHomeChoice('away');const scene=iframe.current?.contentWindow?.CharDayScene,ok=scene?.visitAction?.(kind),info=scene?.inspect?.().visitor;if(info)rememberVisit(info,true);return ok;};
    function handleKitchen(info){
      const current=stateRef.current,job=current?.kitchenJob;if(current?.charId!==info.charId||job?.id!==info.id)return;
      setKitchenStatus(info);
      if(!info.ready||job.ready||kitchenReady.current[info.id])return;
      kitchenReady.current[info.id]=true;
      saveHomeChange(info.charId,'kitchens',raw=>L.kitchenChange(raw,{kind:'ready',id:info.id})).then(setHomes).catch(()=>{delete kitchenReady.current[info.id];setLifeNotice('进度还没存好，回到现场后可以重试；食材还在。');});
    }
    const uniqueId=()=>root.crypto.randomUUID();
    const openLifePage=page=>{setTogetherPanel(false);setLifePage(page);setPhotoId('');setLifeNotice('');setDeletePhoto(false);if(page==='preferences')setWish(homes.preferences?.[String(char.id)]?.wish||'');};
    const lifeWrite=async write=>{if(lifeBusy)return null;setLifeBusy(true);setLifeNotice('');try{const next=await write();setHomes(next);return next;}catch(e){setLifeNotice(e.message==='save'?'没能保存，原来的记录和材料都还在，可以重试。':e.message);return null;}finally{setLifeBusy(false);}};
    const takePhoto=async()=>{
      if(lifeBusy)return;let shot;try{shot=iframe.current?.contentWindow?.CharDayScene?.capturePhoto();if(!shot)throw Error('画面还在准备。');}catch(e){setLifeNotice(e.message);return;}
      const photo={id:uniqueId(),charId:String(char.id),src:shot.src,at:Date.now(),day:state.day,time:state.time,taName:char.remark||char.name,meName:visitorData.name||'我',activity:shot.activity,place:shot.place||'',map:shot.map,note:''};
      const next=await lifeWrite(()=>saveHomeChange(char.id,'albums',raw=>L.albumChange(raw,char.id,{kind:'add',photo})));
      if(next){setLifePage('album');setPhotoId(photo.id);setPhotoNote('');setLifeNotice('拍好了，已放进你们的小家相册。');}
    };
    const kitchen= L.kitchen(homes.kitchens?.[String(char?.id)]),photos=L.album(homes.albums?.[String(char?.id)],char?.id),photo=photos.find(p=>p.id===photoId),suggestion=L.recommendation(char?.persona,wish),pendingJob=kitchen.pending;
    const kitchenAction=async action=>{
      const next=await lifeWrite(()=>saveHomeChange(char.id,'kitchens',raw=>L.kitchenChange(raw,action)));
      if(next&&['begin','serve'].includes(action.kind))runKitchen(next.kitchens[String(char.id)].pending);
      if(next&&action.kind==='cancel'){visitAction('end');setKitchenStatus(null);setLifeNotice('收起了这次料理，食材保留。');}
      if(next&&action.kind==='finish'){visitAction('end');setKitchenStatus(null);setLifeNotice(pendingJob?.kind==='meal'?'一起吃完了。':'做好两人份，已经收进餐盒。');}
    };
    const runKitchen=job=>{
      if(!job)return;send();setKitchenStatus(null);
      const ok=visitAction('together:'+job.kind);if(ok){setLifePage('');setMoreOpen(false);}else setLifeNotice('等TA在家走到位置、你也进屋后，再点继续。材料和餐盒保留。');
    };
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
    const startEditor = (recommended=[]) => {setRecommendedFurniture(Array.isArray(recommended)?recommended:[]); setMoreOpen(false);setTogetherPanel(false);setDecorPanel(""); setHomeOptions(false);setBook(false);setLayoutNotice("");setEditor({placements:JSON.parse(JSON.stringify(demo?demoLayout:homes.layouts?.[String(char.id)]||{})),selected:"double-bed",dragging:false}); };
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
    const optionGrid=(options,selected,choose,attrs)=>h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},...Object.entries(options||{}).map(([key,value])=>h("button",{key,...attrs,"data-part":key,"aria-pressed":(selected||"auto")===key,disabled:layoutBusy||editor?.busy,onClick:()=>choose(key),style:{...btn,textAlign:"left",borderColor:(selected||"auto")===key?"#7c9269":"#cfc5ae"}},h("span",{style:{display:"inline-block",verticalAlign:"middle",marginRight:8,width:22,height:22,borderRadius:4,background:value.color||"#d6ccb9",backgroundImage:value.pattern==='stripe'?"repeating-linear-gradient(90deg,transparent 0 5px,#fff9 5px 6px)":(value.pattern==='tile'||value.pattern==='wainscot')?"linear-gradient(90deg,transparent 48%,#84756250 49%,#84756250 51%,transparent 52%),linear-gradient(transparent 48%,#84756250 49%,#84756250 51%,transparent 52%)":value.pattern==='dots'?"radial-gradient(#74836880 1.5px,transparent 2px)":value.pattern==='checker'?"conic-gradient(#68756566 25%,transparent 0 50%,#68756566 0 75%,transparent 0)":value.pattern==='herringbone'?"repeating-linear-gradient(45deg,transparent 0 5px,#725d4850 5px 6px)":value.pattern==='botanical'?"radial-gradient(ellipse at 35% 30%,#73876680 0 20%,transparent 22%)":value.pattern==='terrazzo'?"radial-gradient(#79695480 1px,transparent 2px)":"none",backgroundSize:"12px 12px",border:"1px solid #b6ad99"}},null),value.label,(selected||"auto")===key?" · 已选":"")));

    const catalogItem=item=>h("button",{key:item.id,"data-wk":"cdaycatalogitem","data-part":item.id,"aria-label":item.label+" 添一件",disabled:layoutBusy||editor?.busy,onClick:()=>iframe.current?.contentWindow?.CharDayScene?.addFurniture(item.id),style:{...btn,minWidth:0,width:"calc((100% - 10px) / 2)",height:"auto",padding:"4px 8px 10px",textAlign:"left",borderRadius:7,boxShadow:"0 3px 0 #cfc5ae"}},h("div",{style:{position:"relative",width:"100%",aspectRatio:"1",marginBottom:4}},h("img",{src:item.thumbnail,alt:item.label,style:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",display:"block",borderRadius:4}})),h("span",{style:{display:"block",fontSize:12}},item.label),h("span",{style:{display:"block",fontSize:11,color:soft,marginTop:4}},(decorOptions.collections?.[item.collection]?.label||"花窗手作")+" · 添一件"));
    const decorContents=decorPanel&&decorOptions&&h("section",{"data-wk":"cdaydecorpanel",className:"absolute inset-0 flex flex-col",style:{zIndex:5,background:paper}},
      h("div",{role:"status","data-wk":"cdaydecornotice",style:{padding:"8px 16px",fontSize:12,lineHeight:1.8,color:soft,borderBottom:"1px solid #cfc5ae"}},layoutNotice||"先试着搭配，回去看看，满意后点保存。"),
      h("div",{ref:decorScroll,"data-wk":"cdaydecorbody",className:"flex-1 min-h-0 overflow-y-auto",onScroll:e=>{decorPositions.current[decorPanel]=e.currentTarget.scrollTop;},style:{padding:"12px 16px 24px"}},
        decorPanel==='catalog'?h(React.Fragment,null,
          h("p",{style:{fontSize:12,color:soft,lineHeight:1.8,marginTop:0}},"四组家具之外，还有陶艺、小熊、花篮等摆件，以及画框、镜子、壁架和挂饰。点一件添进小家；墙饰挂到后墙或左墙，地毯能铺在桌椅下面。空间不够可以在“房间墙地”里扩建。"),
          recommendedFurniture.length>0&&h('section',{style:{marginBottom:22}},h('h3',{style:{fontSize:14,fontWeight:500}},'这次推荐的几件'),h('div',{style:{display:'flex',flexWrap:'wrap',alignItems:'flex-start',gap:10}},...catalog.filter(item=>recommendedFurniture.includes(item.id)).map(catalogItem))),
          ...Object.entries(decorOptions.categories).map(([key,label])=>h("section",{key,style:{marginBottom:22}},h("h3",{style:{fontSize:14,fontWeight:500,borderBottom:"2px solid #cfc5ae",paddingBottom:7,margin:"0 0 10px"}},label),
            h("div",{style:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",gap:10}},...catalog.filter(item=>item.category===key&&!recommendedFurniture.includes(item.id)).map(catalogItem))))):
        decorPanel==='piece'?h(React.Fragment,null,
          control("选择要搭配的家具",h("select",{"data-wk":"cdaypiecepick","aria-label":"配色的家具",value:editor.selected,disabled:layoutBusy||editor?.busy,onChange:e=>iframe.current?.contentWindow?.CharDayScene?.selectFurniture(e.target.value),style:{...btn,width:"100%",height:44}},h("option",{value:""},"选择家具"),...furniture.map(p=>h("option",{key:p.id,value:p.id},p.label+(p.stored?" · 已收纳":""))))),
          chosen?h(React.Fragment,null,
            h("p",{style:{fontSize:12,color:soft,lineHeight:1.8}},"只改这件家具，其他物件保留自己的搭配。"),
            h("div",{"data-wk":"cdaypiececolors",style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}},...decorOptions.colors.map(v=>h("button",{key:v.color,"aria-label":v.label,"aria-pressed":chosen.color===v.color,disabled:layoutBusy||editor?.busy,onClick:()=>setPiece({color:v.color}),style:{...btn,padding:"8px 4px",borderColor:chosen.color===v.color?"#7c9269":"#cfc5ae"}},h("span",{style:{display:"block",margin:"0 auto 5px",width:25,height:25,borderRadius:5,background:v.color}},null),v.label,chosen.color===v.color?" · 已选":""))),
            chosen.mount&&h(React.Fragment,null,
              control("挂在哪面墙",h("select",{"data-wk":"cdaymountwall","aria-label":"挂饰所在的墙",value:chosen.wall,disabled:layoutBusy||editor?.busy||chosen.stored,onChange:e=>setPiece({wall:e.target.value}),style:{...btn,width:"100%",height:44}},...Object.entries(decorOptions.mountWalls).map(([key,label])=>h("option",{key,value:key},label)))),
              h("div",{"data-wk":"cdaymountposition",style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:14}},...[["往左挪",{along:chosen.along-(chosen.wall==="left"?-.15:.15)}],["往右挪",{along:chosen.along+(chosen.wall==="left"?-.15:.15)}],["挂低一点",{y:chosen.y-.15}],["挂高一点",{y:chosen.y+.15}]].map(([label,change])=>h("button",{key:label,style:btn,disabled:layoutBusy||editor?.busy||chosen.stored,onClick:()=>setPiece(change)},label))),
              h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"回到小家也能直接拖动墙饰，左右和高低一起调。窗户要留空，墙饰之间也要留一点距离。")),
            control("自选颜色",customColor({"data-wk":"cdaypiececolor"},"家具",chosen.color||chosen.primary||"#cba77f",color=>setPiece({color}))),
            h("button",{style:{...btn,width:"100%",marginBottom:14},disabled:layoutBusy||editor?.busy,onClick:()=>setPiece({color:""})},"颜色随小家样式"),
            control("材质",h("select",{"data-wk":"cdaymaterial","aria-label":"家具材质",value:chosen.material||"auto",disabled:layoutBusy||editor?.busy,onChange:e=>setPiece({material:e.target.value}),style:{...btn,width:"100%",height:44}},...Object.entries(decorOptions.materials).map(([key,label])=>h("option",{key,value:key},label)))),
            chosen.actions?.length>0&&h("button",{"data-wk":"cdayusefurniture","aria-pressed":chosen.inUse,style:{...btn,width:"100%"},disabled:layoutBusy||editor?.busy||chosen.stored,onClick:()=>setPiece("use")},chosen.inUse?"TA正在用这件":"让TA用这件"),
            h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"床用于睡觉，餐椅用于用餐，沙发用于喝茶、看书和休息。收纳后会选小家里可用的同类家具。")):h("p",{style:{fontSize:12,color:soft}},"先选一件家具。")):
        h(React.Fragment,null,
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:0}},"房间大小"),
          h("div",{"data-wk":"cdaysizeoptions",style:{display:"grid",gap:8}},...Object.entries(decorOptions.sizes).map(([key,value])=>h("button",{key,"data-wk":"cdayroomsize","data-part":key,"aria-pressed":(roomDecor.size||"compact")===key,disabled:layoutBusy||editor?.busy,onClick:()=>setRoom({size:key}),style:{...btn,textAlign:"left",padding:12,borderColor:roomDecor.size===key?"#7c9269":"#cfc5ae"}},h("span",{style:{display:"block",fontSize:13}},value.label,(roomDecor.size||"compact")===key?" · 已选":""),h("span",{style:{display:"block",fontSize:11,color:soft,marginTop:4}},value.detail)))),
          h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"扩建保留家具位置，墙饰会跟着墙面。想缩回时，先把超出小房间的家具挪进来。"),
          ...[["originalRugs","保留原来的地毯"],["originalWallDecor","保留原来的画框和时钟"]].map(([key,label])=>h("label",{key,style:{display:"flex",alignItems:"center",gap:10,minHeight:44,fontSize:12}},h("input",{"data-wk":"cdayoriginaldecor","data-part":key,type:"checkbox",checked:roomDecor[key]!==false,disabled:layoutBusy||editor?.busy,onChange:e=>setRoom({[key]:e.target.checked}),style:{width:20,height:20,accentColor:"#7c9269"}}),label)),
          h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"收起原来的装饰，就能自己重铺地毯、布置画墙。墙面和地板选好后，回去看实际效果，再点保存。"),
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:22}},"墙面"),optionGrid(decorOptions.walls,roomDecor.wall,key=>setRoom({wall:key,wallColor:""}),{"data-wk":"cdaywall"}),
          h("div",{style:{marginTop:14}},control("墙面自选颜色",customColor({"data-wk":"cdaywallcolor"},"墙面",roomDecor.wallColor||decorOptions.walls[roomDecor.wall]?.color||"#eee3d1",wallColor=>setRoom({wallColor})))),
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:22}},"地板"),optionGrid(decorOptions.floors,roomDecor.floor,key=>setRoom({floor:key,floorColor:""}),{"data-wk":"cdayfloor"}),
          h("div",{style:{marginTop:14}},control("地板自选颜色",customColor({"data-wk":"cdayfloorcolor"},"地板",roomDecor.floorColor||decorOptions.floors[roomDecor.floor]?.color||"#cfb79b",floorColor=>setRoom({floorColor})))))));
    const camera=value=>{const mode=typeof value==='boolean'?(value?'overview':'ta'):value,api=iframe.current?.contentWindow?.CharDayScene;if(api?.setCameraMode?.(mode)===false)return;setFollow(mode!=='overview');setCameraMode(mode);setMoreOpen(false);setTogetherPanel(false);};
    const canVisit=!editor&&!demo&&!!socialSetting;
    const controlsOpen=(moreOpen&&!mePanel)||togetherPanel||professionalPanel||!!lifePage;
    const menuBody=content=>h("div",{ref:menuScroll,"data-wk":"cdaymenubody",className:"flex-1 min-h-0 overflow-y-auto",onScroll:e=>{menuPositions.current[menuKey]=e.currentTarget.scrollTop;},style:{padding:"12px 16px 24px"}},content);
    const menuSection=(label,content)=>h("section",{"data-wk":"cdaymenusection",style:{marginBottom:22}},h("h3",{style:{margin:"0 0 8px",fontSize:12,fontWeight:500,color:soft}},label),content);
    const menuRow=(attrs,label,detail,action,Icon)=>h("button",{...attrs,"aria-label":label,onClick:action,style:{...btn,display:"flex",alignItems:"center",gap:12,width:"100%",border:0,borderBottom:"1px solid #d5cebd",borderRadius:0,background:"transparent",textAlign:"left",padding:"13px 0"}},Icon&&h(Icon,{size:20,color:soft}),h("span",{style:{flex:1,minWidth:0}},h("span",{style:{display:"block",fontSize:14}},label),detail&&h("span",{style:{display:"block",marginTop:4,fontSize:11,lineHeight:1.7,color:soft}},detail)),h(IChevR,{size:16,color:soft}));
    const navButton=(attrs,label,Icon,action,extra={})=>h("button",{...attrs,...extra,onClick:action,style:{...btn,flex:1,minWidth:0,padding:"5px 2px",border:0,borderRadius:0,background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,fontSize:11,lineHeight:1.2}},h(Icon,{size:19,color:extra["aria-pressed"]?"#57734b":ink}),h("span",null,label));
    if (homeOptions) return outer(h(React.Fragment, null, h(Head,{zh:"小家样式",sub:char.remark||char.name,bg:"transparent",ink,onBack:()=>setHomeOptions(false)}), body(h(React.Fragment, null,
      h("p", { style: { fontSize: 14, lineHeight: 1.9, marginTop: 0 } }, "你们的小家"),
      h("p", { style: { fontSize: 12, color: soft, lineHeight: 1.9 } }, "这是小世界里的共同住处。挑喜欢的样式，角色原本的住址和经历照旧。卧室、起居室和厨房餐区之外，也留了添家具的位置。家具可挪动、旋转、收纳和摆回，也能添同款多件、独立配色换材质、选择TA使用的床椅，还可以扩建房间、添加装饰摆件、把画框镜子挂上墙，墙纸与地板也可以自己搭配。"),
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
    return outer(h(React.Fragment, null, h("div",{className:"flex-1 min-h-0 flex flex-col","aria-hidden":controlsOpen||undefined,inert:controlsOpen?"":undefined},editor ? h(Head,{zh:decorPanel==="catalog"?"添家具":decorPanel==="piece"?"家具与墙饰":decorPanel==="room"?"房间与墙地面":"布置小家",sub:char.remark||char.name,bg:"transparent",ink,onBack:decorPanel?closeDecorPanel:cancelEditor,right:h("button",{"data-wk":"cdaysavelayout",disabled:layoutBusy||editor.dragging||editor.busy,style:{...btn,border:0,background:"transparent"},onClick:saveLayout},layoutBusy?"保存中":"保存")}) : head(() => pick(""), h("button", { style: { ...btn, border: 0, background: "transparent" }, onClick: () => pick("") }, "换人")),
      h("div", { "data-wk": "cdayscene", className: "flex-1 min-h-0 relative", style: { overflow: "hidden" } },
        h("iframe", { key: char.id + ":" + retry, ref: bindScene, title: "TA的一天场景", "aria-hidden":!!decorPanel, src: "apps/fairy-garden/day/index.html?v=" + props.build,
          onLoad: send, style: { width: "100%", height: "100%", border: 0, display: "block", pointerEvents:layoutBusy?"none":"auto" } }),
        editor ? h("div",{"data-wk":"cdayeditnote",role:"status",style:{display:decorPanel?"none":"block",position:"absolute",top:66,left:12,right:12,padding:"10px 12px",borderRadius:12,background:"rgba(250,247,236,.94)",fontSize:12,lineHeight:1.7,pointerEvents:"none"}},layoutNotice||"家具在地面拖，墙饰在墙上拖 · 双指缩放",h("div",{style:{fontSize:11,color:soft}},"床椅收起后会换可用同类，没有同类就先休息。")) : h("div", { "data-wk": "cdaynow", style: { visibility:mePanel?"hidden":"visible",position: "absolute", top: 12, left: 12, right: 12, maxWidth:480, padding: "11px 14px", borderRadius: 12, background: "rgba(250,247,236,.94)", boxShadow: "0 2px 18px #6d5b3020", pointerEvents: "none" } },
          h("div", { style: { fontSize: 11, color: soft } }, showcase ? "摆位试玩 · "+(room?.label||"正在准备房间") : demo ? "示例试玩 · " + slot.time : preview ? "预览日程 · " + slot.time + "—" + slot.end : "此刻 · TA当地 " + state.time),
          h("div", { style: { fontSize: 14, lineHeight: 1.7, marginTop: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, showcase ? (spot ? spot.number+" · "+spot.label : "入口") : title),
          showcase && spot && h("div", { style: { fontSize: 11, lineHeight: 1.6, color: soft, marginTop: 3 } }, spot.description),
          !showcase && slot?.location && h("div", { style: { fontSize: 11, lineHeight: 1.6, color: soft, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, slot.location + (!preview && !demo && activityStatus?.charId===payload.charId && activityStatus?.key===payload.key && activityStatus.label ? " · "+activityStatus.label+" · "+activityStatus.spotLabel : "")),
          !showcase && slot?.deviation && h("div", { style: { fontSize: 11, color: "#9b674d", marginTop: 3 } }, "安排临时改了"),
          pendingJob&&h("div",{"data-wk":"cdaykitchenprogress",style:{fontSize:11,color:soft,marginTop:3}},L.recipe(pendingJob.recipeId)?.name+" · "+(pendingJob.ready?"做好了，到生活里的厨房收好":({paused:"这份先放着，去厨房继续",preparing:"一起备菜",stirring:"锅边搅拌",serving:"准备盛出来",eating:"一起吃饭",ready:"做好了，到厨房收好"})[kitchenStatus?.phase]||"去厨房继续")),
          !demo&&!preview&&!showcase&&visitStatus?.charId===String(char.id)&&(visitStatus.notice||visitStatus.saveNotice||visitStatus.homeSaveNotice)&&h("div",{"data-wk":"cdayvisitnote",role:"status",style:{fontSize:11,color:soft,lineHeight:1.6,marginTop:3}},[visitStatus.notice,visitStatus.saveNotice,visitStatus.homeSaveNotice].filter(Boolean).join(" · "))),
        sceneStatus && h("div", { role: "status", style: { position: "absolute", top: "48%", left: 16, right: 16, textAlign: "center", padding: 16, background: "#eeeadfe8", borderRadius: 12, fontSize: 12 } }, sceneStatus,
          sceneStatus.includes("失败") && h("button", { style: { ...btn, display: "block", margin: "12px auto 0" }, onClick: () => { setSceneStatus("正在准备画面…");setVisitStatus(null); setRetry(x => x + 1); } }, "重新载入画面")),
        editor&&!decorPanel&&h("div",{"data-wk":"cdaydecoractions",style:{position:"absolute",top:12,left:12,right:12,display:"flex",gap:6}},...[["catalog","添家具"],["piece","单件搭配"],["room","房间墙地"]].map(([key,label])=>h("button",{key,"data-part":key,style:{...btn,flex:1},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>openDecorPanel(key)},label))),
        decorContents,
        editor&&!decorPanel && h("select",{"data-wk":"cdayfurniture","aria-label":"选择家具",disabled:layoutBusy||editor.dragging||editor.busy,value:editor.selected,onChange:e=>iframe.current?.contentWindow?.CharDayScene?.selectFurniture(e.target.value),style:{...btn,position:"absolute",left:12,right:12,bottom:12,width:"calc(100% - 24px)",height:44,fontSize:13}},h("option",{value:""},"选择家具"),...furniture.map(p=>h("option",{key:p.id,value:p.id},p.label+(p.stored?" · 已收纳":"")))),
        !editor && h("div", { style: { position: "absolute", bottom: 8, left: 10, right: 10, textAlign: "center", fontSize: 10, color: "#655e50", pointerEvents: "none", textShadow:"0 1px 3px #fff" } }, visiting ? "点空地走过去 · 拖动看四周，双指缩放" : "拖动看四周 · 双指缩放")),
      !editor&&showcase&&room&&h("div",{className:"shrink-0",style:{padding:"6px 12px",background:paper,borderTop:"1px solid #cfc5ae"}},h("select",{"data-wk":"cdayplacepoint","aria-label":"选择动作位置",value:spot?.id||"",onChange:e=>setSpotId(e.target.value),style:{...btn,width:"100%",height:44,fontSize:13}},...room.spots.map(s=>h("option",{key:s.id,value:s.id},s.number+" · "+s.label)))),
      editor ? h("div",{"data-wk":"cdayedittools",className:"shrink-0",style:{...footerStyle,display:"flex",gap:4}},
        decorPanel?h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor?.busy,onClick:closeDecorPanel},"回去摆放"):h(React.Fragment,null,
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy||!chosen||chosen.stored,onClick:()=>editorAction("rotate")},chosen?.mount?"换墙":"旋转"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy||!chosen,onClick:()=>editorAction(chosen?.stored?"restore":"store")},chosen?.stored?"摆回":"收纳"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>editorAction("undo")},"撤销"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>iframe.current?.contentWindow?.CharDayScene?.overview()},"全景"))) : h("div", { "data-wk": "cdaytools", className: "shrink-0", style:{...footerStyle,display:"flex",gap:4} },
        showcase?navButton({"data-wk":"cdayreturn"},"回到日程",IArrow,()=>{setShowcase("");setSpotId("");setFollow(true);}):demo?navButton({"data-wk":"cdaynext"},"下一段",IRepeat,()=>setDemoIndex(i=>(i+1)%DEMO_ROWS.length)):props.renderChat&&navButton({"data-wk":"cdaychatopen"},"聊聊",GMsg,()=>{setChatMounted(true);setChatOpen(v=>!v);props.onChatOpen?.(char);},{"aria-pressed":chatOpen}),
        showcase?navButton({"data-wk":"cdaynextplace"},"换场景",IRepeat,()=>{const next=places[(places.findIndex(p=>p.id===showcase)+1)%places.length];if(next){setShowcase(next.id);setSpotId("");setFollow(false);}}):visiting?navButton({"data-wk":"cdaylifeopen"},socialSetting?.home?"生活":"约会",IHome,()=>setTogetherPanel(true),{"data-action":"together"}):canVisit?navButton({"data-wk":"cdayvisitopen"},visitStatus?.busy?"准备中…":socialSetting?.home?"回小家":"走进来",IHome,joinVisit,{disabled:visitStatus?.busy}):navButton({"data-wk":"cdayfollow"},"跟着TA",ICamera,()=>camera(false),{"aria-pressed":follow}),
        preview?navButton({"data-wk":"cdayreturn"},"回到此刻",IArrow,()=>setPreview(null)):navButton({"data-wk":"cdayscheduleopen"},"日程",GDiary,()=>setBook(true),{"aria-label":"今天的日程"}),
        navButton({"data-wk":"cdaymoreopen"},"更多",IDots,()=>setMoreOpen(true),{"aria-expanded":moreOpen}))),
      moreOpen&&!mePanel&&!professionalPanel&&!lifePage&&h("section",{"data-wk":"cdaymore",className:"absolute inset-0 flex flex-col",style:{background:paper,zIndex:18}},h(Head,{zh:"更多",sub:char.remark||char.name,bg:"transparent",ink,onBack:()=>setMoreOpen(false)}),menuBody(h(React.Fragment,null,
        menuSection("看看四周",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[["ta","跟着TA"],["me","跟着我"],["both","看两个人"],["overview","看全景"]].map(([mode,label])=>h("button",{key:label,"data-wk":"cdaycamera","data-part":mode,"aria-pressed":cameraMode===mode,disabled:(mode==="me"||mode==="both")&&!visiting,style:{...btn,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:(mode==="me"||mode==="both")&&!visiting?.45:1},onClick:()=>camera(mode)},h(ICamera,{size:18,color:soft}),label)))),
        menuSection("你们的小家",h(React.Fragment,null,
          !demo&&!showcase&&menuRow({"data-wk":"cdaymeopen"},"我的样貌","头发、衣服和身形",openMe,GUser),
          !demo&&menuRow({"data-wk":"cdayalbumopen"},"小家相册","留住真实同框和当时的活动",()=>openLifePage('album'),ICamera),
          !demo&&menuRow({"data-wk":"cdaypreferencesopen"},"装修灵感","参考TA的偏好，也能写自己的想法",()=>openLifePage('preferences'),IPencil),
          !demo&&menuRow({"data-wk":"cdaykitchenopen"},"小家厨房","食材、一起做饭和两人份餐盒",()=>openLifePage('kitchen'),IHome),
          menuRow({"data-wk":"cdayhomestyle"},"小家样式","房间配色与两人的动作气质",()=>{setBook(false);setVisitStatus(null);setHomeOptions(true);},IHome),
          menuRow({"data-wk":"cdaydecorate"},"布置小家","添家具、挪位置、搭配墙面和地板",startEditor,IPencil))),
        menuSection("场景",h(React.Fragment,null,
          Object.keys(professionalChoices).length>0&&menuRow({"data-wk":"cdayprofessionalopen"},"场景摆件","研究器材、创作材料和排练摆件",()=>setProfessionalPanel(true),GConfig),
          menuRow({"data-wk":"cdayplaces"},"新场景","实验室、图书馆、诊室与更多地方",visitPlaces,ICamera))))),
        h("div",{className:"shrink-0",style:{...footerStyle,paddingLeft:16,paddingRight:16}},h("button",{style:{...btn,width:"100%",border:0,background:"transparent"},onClick:()=>setMoreOpen(false)},"回到小世界"))),
      professionalPanel&&h("div",{"data-wk":"cdayprofessional",className:"absolute inset-0 flex flex-col",style:{background:paper,zIndex:20}},h(Head,{zh:"场景摆件",bg:"transparent",ink,onBack:()=>setProfessionalPanel(false)}),h("div",{className:"flex-1 min-h-0 overflow-y-auto",style:{padding:16}},h("p",{style:{fontSize:12,lineHeight:1.8}},"为这位角色选研究器材、创作材料和排练摆件。只改变小世界的画面。"),...Object.entries(professionalChoices).map(([scene,option])=>h("label",{key:scene,style:{display:"block",marginBottom:18,fontSize:13}},option.label,h("select",{"data-professional":scene,disabled:professionalBusy,style:{...btn,width:"100%",marginTop:8},value:payload.professional[scene]?.[option.field]||Object.keys(option.values)[0],onChange:async e=>{const value=e.target.value,next={...payload.professional,[scene]:{[option.field]:value}};setProfessionalBusy(true);setProfessionalNotice("");try{if(demo){setDemoProfessional(next);}else setHomes(await saveHomeChange(char.id,"professional",next));}catch{setProfessionalNotice("没能保存，原摆件还在，可以再试。");}finally{setProfessionalBusy(false);}}},...Object.entries(option.values).map(([value,label])=>h("option",{key:value,value},label))))),professionalNotice&&h("p",{role:"status"},professionalNotice))),
      togetherPanel&&visiting&&h("section",{"data-wk":"cdayinteraction",className:"absolute inset-0 flex flex-col",style:{background:paper,zIndex:20}},h(Head,{zh:socialSetting?.home?"一起生活":"一起约会",sub:char.remark||char.name,bg:"transparent",ink,onBack:()=>setTogetherPanel(false)}),menuBody(h(React.Fragment,null,
        menuSection("我的活动",h(React.Fragment,null,h("p",{style:{fontSize:11,color:soft,lineHeight:1.8,margin:"0 0 10px"}},"手动选择会一直优先；想让小人自己安排，再选自动活动。"),
          h("select",{"data-wk":"cdayvisitactivity","aria-label":socialSetting?.home?"你在小家做什么":"你在这里做什么",value:visitChoice(visitStatus),style:{...btn,width:"100%",height:44},onChange:e=>visitAction(e.target.value)},h("option",{value:"auto"},"自动活动"),h("option",{value:"manual"},"手动控制 · 停下来"),...[["read","手动 · 看会书"],["drink","手动 · 喝口水"],["eat","手动 · 在餐桌吃点东西"],["rest","手动 · 坐着歇会"]].map(([kind,label])=>h("option",{key:kind,value:kind},label))),
          h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:10}},...[["near","靠近TA"],[visitStatus.seated?"stand":"sit",visitStatus.seated?"起身":"坐旁边"]].map(([kind,label])=>h("button",{key:kind,"data-action":kind,style:btn,onClick:()=>visitAction(kind)},label))))),
        menuSection(socialSetting?.home?"一起做什么":"这里可以一起做什么",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...(socialSetting?.actions||[]).map(({kind,label})=>h("button",{key:kind,"data-action":kind,style:btn,onClick:()=>visitAction("together:"+kind)},label)))),
        socialSetting?.home&&menuSection("小家的日常",h(React.Fragment,null,menuRow({"data-wk":"cdaykitchenopen"},"小家厨房",pendingJob?"手头有一份料理，去看看":"补食材、做好两人份、端上桌",()=>openLifePage('kitchen'),IHome),menuRow({"data-wk":"cdayalbumopen"},"小家相册","拍下你们此刻的样子",()=>openLifePage('album'),ICamera))),
        menuSection("结束与离开",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[["end","结束互动"],["leave",socialSetting?.home?"先离开小家":"离开这里"]].map(([kind,label])=>h("button",{key:kind,"data-action":kind,style:btn,onClick:()=>visitAction(kind)},label)))),
        h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},socialSetting?.home?"TA在家时你默认也在。手动离开后会记住，想回来点回小家；活动仍由你选择。":"按地点选择约会动作，两个人先走到真实位置。结束后继续各自的安排，点空地可以自由走动。"))),
        h("div",{className:"shrink-0",style:{...footerStyle,paddingLeft:16,paddingRight:16}},h("button",{style:{...btn,width:"100%",border:0,background:"transparent"},onClick:()=>setTogetherPanel(false)},"回到小世界"))),
      lifePage&&h("section",{"data-wk":"cdaylifepage","data-part":lifePage,className:"absolute inset-0 flex flex-col",style:{background:paper,zIndex:22}},
        h(Head,{zh:lifePage==='album'?(photo?'这一刻':'小家相册'):lifePage==='kitchen'?'小家厨房':'装修灵感',sub:char.remark||char.name,bg:'transparent',ink,onBack:()=>{if(lifeBusy)return;if(photo){setPhotoId('');setDeletePhoto(false);setLifeNotice('');}else{setLifePage('');if(!moreOpen&&visiting)setTogetherPanel(true);}}}),
        menuBody(h(React.Fragment,null,
          lifePage==='album'&&(photo?h(React.Fragment,null,
            h('img',{"data-wk":"cdayphoto",src:photo.src,alt:photo.taName+'和'+photo.meName+'在小家的同框',style:{display:'block',width:'100%',borderRadius:8}}),
            h('p',{style:{fontSize:12,lineHeight:1.9}},photo.day+' · TA当地 '+photo.time+(photo.place?' · '+photo.place:'')+'\n'+photo.taName+'和'+photo.meName+' · '+photo.activity),
            h('label',{style:{display:'block',fontSize:12}},'给这一刻留一句',h('textarea',{"data-wk":"cdayphotonote",maxLength:200,value:photoNote,disabled:lifeBusy,onChange:e=>setPhotoNote(e.target.value),style:{...btn,width:'100%',display:'block',marginTop:8,minHeight:84,resize:'vertical'}})),
            h('button',{"data-wk":"cdayphotonotesave",style:{...btn,width:'100%',marginTop:10},disabled:lifeBusy,onClick:()=>lifeWrite(()=>saveHomeChange(char.id,'albums',raw=>L.albumChange(raw,char.id,{kind:'note',id:photo.id,note:photoNote}))).then(next=>{if(next)setLifeNotice('这句话已留在照片里。');})},'保存这句话'),
            h('a',{href:photo.src,download:'小家-'+photo.day+'-'+photo.id+'.jpg',style:{...btn,display:'block',textAlign:'center',marginTop:10,textDecoration:'none'}},'导出照片'),
            h('button',{"data-wk":"cdayphotodelete",disabled:lifeBusy,style:{...btn,width:'100%',marginTop:10},onClick:()=>{if(!deletePhoto){setDeletePhoto(true);setLifeNotice('再点一次，删除相册里的这张照片。');return;}lifeWrite(()=>saveHomeChange(char.id,'albums',raw=>L.albumChange(raw,char.id,{kind:'delete',id:photo.id}))).then(next=>{if(next){setPhotoId('');setDeletePhoto(false);setLifeNotice('已删除这一张。');}});}},deletePhoto?'确认删除':'删除这张')):
            h(React.Fragment,null,h('p',{style:{fontSize:12,lineHeight:1.9,color:soft,marginTop:0}},'留住小家里的真实同框，照片会记下TA当地的时间和当时在做什么。'),
              h('button',{"data-wk":"cdayphotoshoot",style:{...btn,width:'100%',marginBottom:16},disabled:lifeBusy||!visiting||!!preview||!!showcase,onClick:takePhoto},visiting?'拍下此刻的两个人':'先和TA走到一起，再拍同框'),
              photos.length?h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}},...photos.slice().reverse().map(item=>h('button',{key:item.id,"data-wk":"cdayphotoitem",style:{...btn,padding:6,textAlign:'left'},onClick:()=>{setPhotoId(item.id);setPhotoNote(item.note||'');setLifeNotice('');setDeletePhoto(false);}},h('img',{src:item.src,alt:item.activity,loading:'lazy',style:{display:'block',width:'100%',aspectRatio:'4/3',objectFit:'cover',borderRadius:5}}),h('span',{style:{display:'block',fontSize:11,lineHeight:1.7,padding:'6px 3px'}},item.day+' '+item.time+' · '+item.activity)))):h('p',{style:{fontSize:12,color:soft}},'还没留过照片。进屋后拍下第一张吧。'))),
          lifePage==='kitchen'&&h(React.Fragment,null,
            h('p',{style:{fontSize:12,lineHeight:1.9,color:soft,marginTop:0}},'这是你们小家的食材篮。每次补三份。两人实际到厨房完成动作，收好成品时才用掉食材；中途停下材料保留。'),
            pendingJob&&menuSection('手头这一份',h(React.Fragment,null,h('p',{style:{fontSize:14}},L.recipe(pendingJob.recipeId)?.name+' · '+(pendingJob.kind==='meal'?'一起吃':'一起做')),
              h('p',{"data-wk":"cdaykitchenstate",role:'status',style:{fontSize:12,lineHeight:1.8}},pendingJob.ready?(pendingJob.kind==='meal'?'两个人已经在餐桌吃好，可以收拾了。':'两人份做好了，可以收进餐盒。'):({preparing:'两个人正在备菜。',stirring:'两个人正在锅边料理。',serving:'准备盛出两人份。',eating:'已经在餐桌坐好，正在一起吃。'})[kitchenStatus?.phase]||'等TA在家，进屋后点继续。'),
              h('button',{"data-wk":"cdaykitchencontinue",disabled:lifeBusy||!homeVisiting||pendingJob.ready,style:{...btn,width:'100%',marginBottom:8},onClick:()=>runKitchen(pendingJob)},'回到现场继续'),
              h('button',{"data-wk":"cdaykitchenfinish",disabled:lifeBusy||!pendingJob.ready,style:{...btn,width:'100%',marginBottom:8},onClick:()=>kitchenAction({kind:'finish',id:pendingJob.id,at:Date.now()})},pendingJob.kind==='meal'?'吃好了，收拾餐桌':'收好两人份'),
              h('button',{"data-wk":"cdaykitchencancel",disabled:lifeBusy,style:{...btn,width:'100%'},onClick:()=>kitchenAction({kind:'cancel'})},'先收起，保留材料'))),
            menuSection('食材篮',h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}},...Object.entries(L.INGREDIENTS).map(([key,label])=>h('div',{key,style:{padding:10,border:'1px solid #cfc5ae',borderRadius:10}},h('span',{style:{fontSize:13,display:'block',marginBottom:8}},label+' ×'+kitchen.ingredients[key]),h('button',{"data-wk":"cdayingredient",'data-part':key,disabled:lifeBusy,style:{...btn,width:'100%'},onClick:()=>kitchenAction({kind:'stock',ingredient:key})},'补三份'))))),
            menuSection('今天做什么',h(React.Fragment,null,...L.RECIPES.map(r=>h('div',{key:r.id,style:{padding:'12px 0',borderBottom:'1px solid #d5cebd'}},h('strong',{style:{fontSize:14,fontWeight:500}},r.name),h('p',{style:{fontSize:11,lineHeight:1.8,color:soft}},Object.entries(r.need).map(([id,n])=>L.INGREDIENTS[id]+' ×'+n).join('、')+' · 做出两人份'),h('p',{style:{fontSize:12,lineHeight:1.8}},r.note),h('button',{"data-wk":"cdayrecipe",'data-part':r.id,style:{...btn,width:'100%'},disabled:lifeBusy||!!pendingJob||!homeVisiting,onClick:()=>kitchenAction({kind:'begin',id:uniqueId(),recipeId:r.id})},visiting?'一起做这份':'进小家后一起做'))))),
            menuSection('已经做好的餐盒',h(React.Fragment,null,kitchen.dishes.length?kitchen.dishes.slice().reverse().map(d=>h('div',{key:d.id,style:{padding:'12px 0',borderBottom:'1px solid #d5cebd'}},h('p',{style:{fontSize:13}},L.recipe(d.recipeId).name+' · 两人份'),h('button',{"data-wk":"cdaydish",'data-part':d.id,style:{...btn,width:'100%'},disabled:lifeBusy||!!pendingJob||!homeVisiting,onClick:()=>kitchenAction({kind:'serve',id:uniqueId(),dishId:d.id})},'端上桌一起吃'))):h('p',{style:{fontSize:12,color:soft}},'做好后收进这里，重进小家还在。')))),
          lifePage==='preferences'&&h(React.Fragment,null,
            h('p',{style:{fontSize:12,color:soft,lineHeight:1.9,marginTop:0}},'参考TA在人设里明确写出的家居偏好。先看看搭配，你挑的房间样式、家具配色和摆位始终优先。'),
            h('label',{style:{fontSize:12}},'你想要怎样的小家',h('textarea',{"data-wk":"cdaydecorwish",value:wish,maxLength:600,onChange:e=>setWish(e.target.value),placeholder:'写下喜欢的颜色、材质或风格',style:{...btn,width:'100%',minHeight:92,display:'block',marginTop:8}})),
            h('button',{"data-wk":"cdaydecorwishsave",style:{...btn,width:'100%',marginTop:10,marginBottom:18},disabled:lifeBusy,onClick:()=>lifeWrite(()=>saveHomeChange(char.id,'preferences',{wish:wish.trim()})).then(next=>{if(next)setLifeNotice(wish.trim()?'已记住你的想法，它会优先于自动参考。':'已回到参考TA的人设偏好。');})},'记住我的想法'),
            suggestion?h(React.Fragment,null,menuSection(suggestion.label,h(React.Fragment,null,h('p',{style:{fontSize:12,color:soft,lineHeight:1.8}},suggestion.source+' · '+suggestion.evidence),h('p',{style:{fontSize:12,lineHeight:1.8}},'配色：'+(styles.find(x=>x.id===suggestion.id)?.label||suggestion.label)),h('div',{style:{display:'flex',gap:8,marginBottom:14}},...(styles.find(x=>x.id===suggestion.id)?.colors||[]).map(color=>h('span',{key:color,style:{width:48,height:40,borderRadius:5,background:color}}))),
              h('button',{"data-wk":"cdaydecorapply",disabled:lifeBusy,style:{...btn,width:'100%'},onClick:()=>lifeWrite(()=>saveHomeUpdate(previous=>({...previous,version:3,styles:{...previous.styles,[String(char.id)]:suggestion.id},layouts:{...previous.layouts,[String(char.id)]:L.recommendLayout(previous.layouts?.[String(char.id)],suggestion)}}))).then(next=>{if(next)setLifeNotice('已选这套配色。你单独搭过的墙面、地板和家具都保留。');})},'选这套配色'))),
              menuSection('可以搭的家具',h(React.Fragment,null,h('p',{style:{fontSize:12,lineHeight:1.8}},suggestion.furniture.map(key=>catalogLabels[key]||key).join('、')),h('button',{"data-wk":"cdaydecorchoose",style:{...btn,width:'100%'},disabled:lifeBusy,onClick:()=>{setLifePage('');startEditor(suggestion.furniture);}},'去布置，自己挑家具')))):
              h('p',{style:{fontSize:12,color:soft,lineHeight:1.9}},'还没有找到明确的家居偏好。写下你的想法，或者到小家样式里直接选喜欢的搭配。')),
          lifeNotice&&h('p',{"data-wk":"cdaylifenotice",role:'status',style:{fontSize:12,color:'#8d634e',lineHeight:1.9,whiteSpace:'pre-wrap'}},lifeNotice))),
        h('div',{className:'shrink-0',style:footerStyle},h('button',{style:{...btn,width:'100%',border:0,background:'transparent'},disabled:lifeBusy,onClick:()=>{setLifePage('');setMoreOpen(false);setTogetherPanel(false);}},'回到小世界'))),
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
