// TA的一天页面那一半：主屏小组件要的 CharDayKit 在 js/char-day-core.js，这份跟小世界一组点进去才加载（组名 garden）。
// Schedule viewer and per-character home decoration; narrative and game saves stay with their owners.
(function (root) {
  const { DEMO, DEMO_ROWS, clockText, aroundNow, spanText, dayState, presentation, clockOptions, clockSources, saveHomeUpdate, saveHomeChange, visitChoice, sceneWeather, lastThought, dayLine } = root.CharDayCore;
  // One palette and control skin for the viewer, paper pages and kitchen.
  const UI = Object.freeze({ink:"#393f36",soft:"#707568",paper:"#f5f5ee",line:"#e1e4d8",accent:"#58705a",
    button:{minHeight:44,padding:"10px 14px",border:"1px solid #e0e4d9",borderRadius:14,backgroundColor:"#fffdf7",color:"#393f36",fontSize:13,lineHeight:1.5,boxShadow:"0 2px 4px #38443104"},
    surface:{background:"#f5f5ee",backgroundImage:"radial-gradient(ellipse at 0% 0%,#eaf0df80,transparent 65%),radial-gradient(ellipse at 100% 100%,#f1e3d780,transparent 70%)"}});
  const UI_CSS = `
    [data-wk="cdaypage"] button { -webkit-tap-highlight-color:transparent; transition:background-color .16s,box-shadow .16s,transform .16s; }
    [data-wk="cdaypage"] button:active:not(:disabled) { transform:translateY(1px); }
    [data-wk="cdaypage"] button:focus-visible,[data-wk="cdaypage"] select:focus-visible,[data-wk="cdaypage"] input:focus-visible { outline:2px solid #58705a;outline-offset:3px; }
    [data-wk="cdaypage"] button:disabled { opacity:.42;cursor:default; }
    [data-wk="cdaypage"] select { appearance:none;-webkit-appearance:none;font-size:16px!important; padding-right:34px!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23707568' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center; }
    [data-wk="cdaypage"] input:not([type="checkbox"]):not([type="color"]):not([type="range"]),[data-wk="cdaypage"] textarea { font-size:16px!important; }
    [data-wk="cdaypage"] .cday-icon { display:flex;align-items:center;justify-content:center;flex-shrink:0;width:38px;height:38px;border-radius:13px;background:#e8eddf;color:#58705a; }
    [data-wk="cdaypage"] .cday-icon svg { flex-shrink:0; }
    [data-wk="cdaypage"] .cday-row:active { background:#e9eee2; }
    [data-wk="cdaypage"] .cday-action { display:flex;align-items:center;gap:10px;text-align:left; }
    [data-wk="cdaypage"] .cday-place { min-height:116px;position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:10px; }
    [data-wk="cdaypage"] .cday-place .cday-icon { width:36px;height:36px; }
    [data-wk="cdaypage"] .cday-choice { position:relative;display:flex;gap:10px;align-items:center;text-align:left;min-height:76px; }
    [data-wk="cdaypage"] .cday-choice[aria-checked="true"] { border-color:#8b9e7e;background:#eaf0e2;box-shadow:inset 0 -3px #9caa90; }
    [data-wk="cdaymelook"] button:not([data-wk="headink"]) { min-height:44px!important; }
    [data-wk="cdaypage"] .cday-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
    @media (orientation:landscape) { [data-wk="cdaynow"] { right:auto!important;width:285px;max-width:calc(44% - 24px)!important;max-height:calc(100% - 48px);overflow-y:auto;pointer-events:auto!important;overscroll-behavior:contain; } [data-wk="cdaykitchenhud"][data-tabletop="1"] { left:auto!important;width:285px;max-height:calc(100% - 48px)!important; } }
    @media (prefers-reduced-motion:reduce) { [data-wk="cdaypage"] button { transition:none; } }
  `;
  // Display icons only; map names and destinations continue to come from the scene catalog.
  const LabIcon=p=>h(Svg,p,h("path",{d:"M9 3h6m-5 0v6L5 18a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10"}),h("circle",{cx:11,cy:17,r:.5}));
  const FarmIcon=p=>h(Svg,p,h("path",{d:"M4 21h16M7 21v-7m0 1C3 15 3 11 3 9c4 0 4 3 4 6m0-3c0-4 4-5 7-5 0 4-3 5-7 5M15 21v-4m0 1c0-4 4-5 6-5 0 4-3 5-6 5"}));
  const GymIcon=p=>h(Svg,p,h("path",{d:"M7 12h10M3 10v4m18-4v4M5 7h3v10H5zm11 0h3v10h-3z"}));
  const MusicIcon=p=>h(Svg,p,h("path",{d:"M10 17V5l10-2v12M10 8l10-2"}),h("ellipse",{cx:7,cy:18,rx:3,ry:2}),h("ellipse",{cx:17,cy:16,rx:3,ry:2}));
  const TrainIcon=p=>h(Svg,p,h("rect",{x:6,y:3,width:12,height:15,rx:3}),h("path",{d:"M6 10h12M9 18l-3 3m9-3 3 3M9 6h6"}),h("path",{d:"M9 14h.01M15 14h.01"}));
  const placeIcon = id => ({dayHome:IHome,dayWork:GBrief,dayCafe:GCoffee,dayStreet:GWalk,dayLaboratory:LabIcon,dayLibrary:GStudy,dayClinic:IPulse,dayStudio:GPen,dayRehearsal:MusicIcon,dayStation:TrainIcon,dayGym:GymIcon,dayMarket:GShop,dayOffice:GBrief,dayCampus:GStudy,dayInvestigation:ISearch,dayService:GMeal,dayFilm:IFilm,dayBroadcast:GChat,dayLegal:GDebate,dayTraining:GymIcon,dayWorkshop:GConfig,dayFarm:FarmIcon,dayFleaMarket:GBag,dayStudy:GDiary})[id]||IHome;
  const actionIcon = kind => /read|study/.test(kind)?GStudy:/drink|tea/.test(kind)?GCoffee:/eat|meal|cook|stir|chop/.test(kind)?GMeal:/clean|wash|tidy|sweep/.test(kind)?GConfig:/sleep|rest|sit|lean/.test(kind)?GMoon:/hand|hug|kiss|cuddle|forehead|cheek|shoulder/.test(kind)?IHeart:/leave|return|end|stand/.test(kind)?IArrow:GUs;
  // Persona hobbies only change with the persona, while the scene re-renders every second: read each persona once.
  const likesMemo = new Map();
  function idleLikesOf(persona) { const k = String(persona || ""); if (!likesMemo.has(k)) { if (likesMemo.size > 50) likesMemo.clear(); likesMemo.set(k, root.CharDayLink.idleLikes(k)); } return likesMemo.get(k); }
  const sceneContinuity=new Map();
  // The day album keeps only image references (iv_, the on-device image vault): the pictures stay on this phone and never ride
  // into the cloud row or the export. Writes queue one after another so auto-save, fill-in and thoughts never overwrite each other.
  function loadAlbums(){ return (typeof loadJSON === "function" ? loadJSON("x_charDayAlbums", {}) : {}) || {}; }
  let albumWrite=Promise.resolve();
  const albumImg=src=>typeof resolveImg==="function"&&String(src||"").indexOf("iv_")===0?resolveImg(src):src;
  function saveAlbum(charId,day,update){
    const write=albumWrite.catch(()=>{}).then(async()=>{
      const all=loadAlbums(),id=String(charId),mine={...(all[id]||{})},entry=update(mine[day]||null);
      if(entry?.photos&&typeof imgToVault==="function")entry.photos=await Promise.all(entry.photos.map(async p=>String(p.src||"").slice(0,5)==="data:"?{...p,src:await imgToVault(p.src)}:p));
      mine[day]=entry;
      const days=Object.keys(mine).sort().slice(-7),next={...all,[id]:Object.fromEntries(days.map(d=>[d,mine[d]]))};
      const result=await commitJSONDurable("x_charDayAlbums",next);if(!result?.durable||!result?.live)throw Error("save");
      return next[id][day];
    });
    albumWrite=write;return write;
  }
  // One photo per stop (by start time), in time order; a newer frame of the same stop keeps the thought already written for it.
  function mergePhotos(cur,add){
    const byTime=new Map();
    for(const p of [...(cur||[]),...(add||[])]){if(!p?.time)continue;const old=byTime.get(p.time);byTime.set(p.time,{...old,...p,thought:p.thought||old?.thought||""});}
    return [...byTime.values()].sort((a,b)=>a.time<b.time?-1:a.time>b.time?1:0).slice(-12);
  }
  // Up to six stops of the day so far, evenly spread, in time order.
  function albumRows(state,{pastOnly=false}={}){
    const toMin=t=>{const m=/^(\d{1,2}):(\d{2})/.exec(String(t||""));return m?+m[1]*60+ +m[2]:null;},rows=(state?.rows||[]).filter(r=>String(r.title||"").trim()&&toMin(r.time)!=null);
    const past=rows.filter(r=>toMin(r.time)<=state.minute),pool=past.length||pastOnly?past:rows;
    if(pool.length<=6)return pool;
    return Array.from({length:6},(_,i)=>pool[Math.round(i*(pool.length-1)/5)]);
  }
  root.CharDayApp = function CharDayApp(props) {
    const [id, setId] = useState(props.initialCharId || ""), [pulse, setPulse] = useState(0),
      [book, setBook] = useState(false), [preview, setPreview] = useState(null), [demoIndex, setDemoIndex] = useState(0),
      [follow, setFollow] = useState(true), [sceneStatus, setSceneStatus] = useState("正在准备画面…"), [retry, setRetry] = useState(0),
      [homeOptions, setHomeOptions] = useState(false), [styles, setStyles] = useState([]), [demoStyle, setDemoStyle] = useState("warm"),
      [motionOptions,setMotionOptions]=useState([]),[demoMotion,setDemoMotion]=useState("auto"),[demoVisitorMotion,setDemoVisitorMotion]=useState("auto"),
      [homes, setHomes] = useState(() => typeof loadJSON === "function" ? loadJSON("x_charDayHomes", {}) || {} : {}),
      [styleBusy, setStyleBusy] = useState(false), [styleNotice, setStyleNotice] = useState(""),
      [decorPanel,setDecorPanel]=useState(""),[catalog,setCatalog]=useState([]),[decorOptions,setDecorOptions]=useState(null),
      [editor, setEditor] = useState(null), [furniture, setFurniture] = useState([]), [piecePreview, setPiecePreview] = useState(null), [layoutBusy, setLayoutBusy] = useState(false), [layoutNotice, setLayoutNotice] = useState(""), [demoLayout, setDemoLayout] = useState({}),
      [showcase, setShowcase] = useState(""), [spotId, setSpotId] = useState(""), [places, setPlaces] = useState([]),
      [activityStatus,setActivityStatus]=useState(null), [chatOpen, setChatOpen] = useState(false), [chatMounted, setChatMounted] = useState(false), [visitStatus,setVisitStatus]=useState(null),[togetherPanel,setTogetherPanel]=useState(false),[mePanel,setMePanel]=useState(false),[meStyles,setMeStyles]=useState(null),[meDraft,setMeDraft]=useState(null),[meBusy,setMeBusy]=useState(false),[meNotice,setMeNotice]=useState(""),[moreOpen,setMoreOpen]=useState(false),[professionalPanel,setProfessionalPanel]=useState(false),[professionalChoices,setProfessionalChoices]=useState({}),[professionalStyles,setProfessionalStyles]=useState({}),[professionalScene,setProfessionalScene]=useState('dayLaboratory'),[professionalBusy,setProfessionalBusy]=useState(false),[professionalNotice,setProfessionalNotice]=useState(""),[demoProfessional,setDemoProfessional]=useState({});
    const [outing,setOuting]=useState(()=>sceneContinuity.get(String(props.initialCharId))?.outing||null),[outingPicker,setOutingPicker]=useState(false),[outingMode,setOutingMode]=useState('solo');
    const [cameraMode,setCameraMode]=useState(()=>sceneContinuity.get(String(props.initialCharId))?.outing?.mode==='solo'?'me':sceneContinuity.get(String(props.initialCharId))?.outing?'both':'ta'),[lifePage,setLifePage]=useState(''),[lifeBusy,setLifeBusy]=useState(false),[lifeNotice,setLifeNotice]=useState(''),[photoId,setPhotoId]=useState(''),[photoNote,setPhotoNote]=useState(''),[kitchenStatus,setKitchenStatus]=useState(null),[kitchenView,setKitchenView]=useState('book'),[kitchenRecipe,setKitchenRecipe]=useState(''),[wish,setWish]=useState(''),[catalogLabels,setCatalogLabels]=useState({}),[recommendedFurniture,setRecommendedFurniture]=useState([]);
    const [kitchenTool,setKitchenTool]=useState(''),[photoDraft,setPhotoDraft]=useState(null),[photoPreviewNotice,setPhotoPreviewNotice]=useState(''),[photoRefresh,setPhotoRefresh]=useState(0);
    useEffect(()=>{setKitchenTool('');},[id,retry]);
    const L=root.CharDayLife,S=root.CharDaySocial;
    const [homeChoices,setHomeChoices]=useState({});
    const [positionEdit,setPositionEdit]=useState(null),[positionBusy,setPositionBusy]=useState(false),[positionNotice,setPositionNotice]=useState('');
    const [clockBusy,setClockBusy]=useState(false),[clockNotice,setClockNotice]=useState('');
    const [socialDraft,setSocialDraft]=useState({}),[socialBusy,setSocialBusy]=useState(false),[socialNotice,setSocialNotice]=useState(''),[pairOptions,setPairOptions]=useState([]),[pairDraft,setPairDraft]=useState({}),[choreWho,setChoreWho]=useState('me'),[pairWho,setPairWho]=useState('me');
    const kbLift = useKbLift();
    const now = Date.now();
    const iframe = useRef(null), scroll = useRef(null), positions = useRef({}), stateRef = useRef(null),decorScroll=useRef(null),decorPositions=useRef({}),visitSave=useRef({}),scenePause=useRef(null),menuScroll=useRef(null),menuPositions=useRef({}),kitchenReady=useRef({}),kitchenCheckpoints=useRef({});
    const menuKey=positionEdit?'position:'+id+':'+positionEdit.day+':'+positionEdit.seq:outingPicker?'outings':professionalPanel?'professional:'+professionalScene:lifePage?(lifePage==='album'&&photoId?'photo:'+photoId:lifePage==='kitchen'?'kitchen:'+kitchenView+':'+kitchenRecipe:lifePage):moreOpen?'more':'life';
    // Keep temporary scene progress across both subpages and the whole app's
    // unmount. This is view state; it never writes a schedule or calendar.
    const bindScene=React.useCallback(node=>{if(!node&&iframe.current){try{const paused=iframe.current.contentWindow?.CharDayScene?.pauseState?.();if(paused){scenePause.current=paused;if(!stateRef.current?.preview&&!stateRef.current?.showcase)sceneContinuity.set(paused.charId,paused);}}catch{}}iframe.current=node;},[]);
    const demo = id === DEMO.id, char = demo ? DEMO : (props.characters || []).find(c => String(c.id) === String(id));
    useEffect(() => {
      props.onChatVisibility?.(char, chatOpen && !editor && !demo && !showcase && !book && !homeOptions && !moreOpen && !togetherPanel && !professionalPanel && !mePanel && !lifePage && !outingPicker && !positionEdit);
      return () => props.onChatVisibility?.(null, false);
    }, [id, chatOpen, showcase, book, homeOptions, editor, moreOpen, togetherPanel, professionalPanel, mePanel, lifePage, outingPicker, !!positionEdit]);
    useEffect(() => {
      const refresh=()=>setPulse(n=>n+1),visible=()=>{if(root.document?.visibilityState!=='hidden')refresh();};
      const timer=setInterval(refresh,1000);
      root.addEventListener?.('pageshow',refresh);root.document?.addEventListener?.('visibilitychange',visible);
      return()=>{clearInterval(timer);root.removeEventListener?.('pageshow',refresh);root.document?.removeEventListener?.('visibilitychange',visible);};
    }, []);
    React.useLayoutEffect(() => { if (scroll.current) scroll.current.scrollTop = positions.current[homeOptions ? "style" : book ? "book" : "picker"] || 0; }, [book, homeOptions, id]);
    React.useLayoutEffect(()=>{if(decorScroll.current)decorScroll.current.scrollTop=decorPositions.current[decorPanel]||0;},[decorPanel]);
    React.useLayoutEffect(()=>{if(menuScroll.current)menuScroll.current.scrollTop=menuPositions.current[menuKey]||0;},[moreOpen,togetherPanel,mePanel,professionalPanel,professionalScene,book,homeOptions,id,lifePage,photoId,kitchenView,kitchenRecipe,outingPicker,positionEdit?.expected]);
    const pick = value => {setAlbumShoot(null);setAlbumOpen(false);setAlbumDay(null);setAlbumNotice('');const trip=sceneContinuity.get(String(value))?.outing||null;setOuting(trip);setOutingPicker(false);setPositionEdit(null);setPositionNotice(''); setLifePage('');setPhotoId('');setKitchenRecipe('');setKitchenView('book');setLifeNotice('');setKitchenStatus(null);setCameraMode(trip?.mode==='solo'?'me':trip?'both':'ta'); setMoreOpen(false);setTogetherPanel(false);setMePanel(false);setProfessionalPanel(false);setId(value); setPreview(null); setBook(false); setDemoIndex(0); setHomeOptions(false); setEditor(null); setDecorPanel(""); setLayoutNotice(""); setStyleNotice(""); setShowcase(""); setSpotId(""); setChatOpen(false); setChatMounted(false); setVisitStatus(null); setFollow(true); setSceneStatus("正在准备画面…"); props.onSelect?.(value === DEMO.id ? "" : value); };
    const room=places.find(p=>p.id===showcase), spot=room?.spots.find(s=>s.id===spotId)||room?.spots[0];
    const visitPlaces=()=>{setOuting(null);setMoreOpen(false);if(!char)pick(DEMO.id);setShowcase("dayLaboratory");setSpotId("");setFollow(false);};
    const openPosition=(row,day,phaseIndex)=>{
      const raw=props.plansFor?.(char)?.[day]?.seqs?.find(q=>q.seq===row?.seq);
      if(!raw||demo||!props.onEditSchedSeq)return;
      const stages=root.CharDayLink.stagesFor(raw),stageIndex=Number.isInteger(phaseIndex)&&stages[phaseIndex]?phaseIndex:0;
      const phase=stages[stageIndex],chosen=phase&&(phase.override||phase),at=chosen?{map:chosen.scene,spot:chosen.spot}:presentation(raw),scene=(root.CharDayCatalog||[]).find(s=>s.id===at.map);
      setPositionNotice('');setPositionEdit({day,seq:raw.seq,expected:JSON.stringify(raw),row:raw,stages,scope:phase?'stage':'whole',stageIndex,automatic:phase?!phase.override:!raw.world?.manual,scene:scene?.id||'dayHome',spot:at.spot||scene?.spots[0]?.id});
    };
    const choosePositionTarget=(scope,index)=>setPositionEdit(draft=>{
      const stageIndex=index==null?draft.stageIndex:Number(index),phase=scope==='stage'?draft.stages[stageIndex]:null;
      if(scope==='stage'&&!phase)return draft;
      const chosen=phase&&(phase.override||phase),at=chosen?{map:chosen.scene,spot:chosen.spot}:presentation(draft.row),scene=(root.CharDayCatalog||[]).find(s=>s.id===at.map);
      return {...draft,scope,stageIndex,automatic:phase?!phase.override:!draft.row.world?.manual,scene:scene?.id||'dayHome',spot:at.spot||scene?.spots[0]?.id};
    });
    const closePosition=()=>{if(!positionBusy){setPositionEdit(null);setPositionNotice('');}};
    const savePosition=async()=>{
      if(!positionEdit||positionBusy)return;
      const draft=positionEdit;setPositionBusy(true);setPositionNotice('');
      try{
        const anchor=draft.automatic?null:{scene:draft.scene,spot:draft.spot};
        const patch=draft.scope==='stage'?{worldStage:{index:draft.stageIndex,anchor}}:{world:anchor&&{...anchor,manual:true}};
        const ok=await props.onEditSchedSeq(char,draft.day,draft.seq,patch,draft.expected);
        if(!ok){setPositionNotice('没能保存，或这一段已经改过了。返回重新打开后再试。');return;}
        if(preview&&preview.seq===draft.seq){const row=props.plansFor?.(char)?.[draft.day]?.seqs?.find(q=>q.seq===draft.seq);if(row)setPreview({...row,key:'preview:'+char.id+':'+draft.day+':'+JSON.stringify(row)});}
        setPositionEdit(null);setFollow(true);
      }catch{setPositionNotice('保存没成功，选择还在这里，可以再试。');}finally{setPositionBusy(false);}
    };
    const clockMode=homes.clockModes?.[String(char?.id)]==='real'?'real':'auto';
    const changeClock=async mode=>{if(clockBusy||demo||!['auto','real'].includes(mode))return;setClockBusy(true);setClockNotice('');try{setHomes(await saveHomeChange(char.id,'clockModes',mode));}catch{setClockNotice('没有保存成功，当前选择保持原样，可以再试。');}finally{setClockBusy(false);}};
    const state = char ? (demo ? { day: "示例日程", time: DEMO_ROWS[demoIndex].time, rows: DEMO_ROWS, hasPlan: true, slot: { ...DEMO_ROWS[demoIndex], key: "demo:" + demoIndex } } : dayState(char, props.plansFor?.(char) || {}, now, clockOptions(homes, char.id))) : null;
    // Foreground return reanchors the main clock's real timestamp. A frozen
    // clock keeps its original plan archive, including after a browser reload.
    useEffect(()=>{
      if(!char||demo||preview||showcase||!state?.followVirtual||!state.paused)return;
      const charId=String(char.id),pin={virtualAt:state.displayAt,sourceDay:state.sourceDay};
      clockSources.set(charId,pin);
      const saved=homes.clockSources?.[charId];
      if(saved?.virtualAt===pin.virtualAt&&saved.sourceDay===pin.sourceDay)return;
      let live=true;
      saveHomeChange(charId,'clockSources',pin).then(next=>{if(live)setHomes(next);}).catch(()=>{});
      return()=>{live=false;};
    },[char?.id,demo,preview,showcase,state?.followVirtual,state?.paused,state?.displayAt,state?.sourceDay]);
    const slot = preview || state?.slot, title = slot?.deviation?.actual || slot?.title || (state?.hasPlan ? "这会儿没排事情，"+root.CharDayLink.idleLabel(state?.minute) : "今天还没有日程");
    const visitorData=props.visitorFor?.(char)||{};
    const destinations=root.CharDayCatalog||[],outingPlace=destinations.find(p=>p.id===outing?.map);
    const trip=outingPlace&&!demo&&!preview&&!showcase?outing:null;
    const openOutings=()=>{setOutingMode(trip?.mode||'solo');setOutingPicker(true);};
    const goOuting=map=>{if(!destinations.some(p=>p.id===map))return;setPreview(null);setShowcase('');setSpotId('');setBook(false);setOuting({map,mode:outingMode});setOutingPicker(false);setMoreOpen(false);setTogetherPanel(false);setVisitStatus(null);setFollow(true);setCameraMode(outingMode==='solo'?'me':'both');};
    const returnToTA=()=>{setOuting(null);setOutingPicker(false);setMoreOpen(false);setTogetherPanel(false);setBook(false);setPreview(null);setShowcase('');setSpotId('');setVisitStatus(null);setFollow(true);setCameraMode('ta');};
    const albumFill = useRef("");
    const [albumDay, setAlbumDay] = useState(null), [albumOpen, setAlbumOpen] = useState(false), [albumShoot, setAlbumShoot] = useState(null), [albumNotice, setAlbumNotice] = useState(""), [albumBusy, setAlbumBusy] = useState(false), [albumTick, setAlbumTick] = useState(0);
    // The now-card stays short by default so the scene shows; details open on a tap (她 2026-10-12：「太长了还收不起来看不到画面」).
    // line = only a thin handle at the top, short = what TA is doing, open = every detail.
    const [nowMode, setNowMode] = useState("short"), nowOpen = nowMode === "open";
    const visual = root.CharDayLink.resolve(slot, state?.at ?? now, {preview:!!preview||demo,minute:state?.minute,seed:String(char?.id||""),likes:idleLikesOf(char?.persona),homePlacements:homes.layouts?.[String(char?.id)]||{}});
    const sceneNear = !demo && !preview && state ? aroundNow(state) : null;
    const stageIndex=!preview&&!demo&&activityStatus?.charId===String(char?.id)&&activityStatus.key===slot?.key&&Number.isInteger(activityStatus.stageIndex)&&visual.stages[activityStatus.stageIndex]?activityStatus.stageIndex:visual.presentation.stageIndex;
    const activeStage=visual.stages[stageIndex],manualPoint=activeStage?activeStage.override:visual.presentation.manual?{scene:visual.presentation.map,spot:visual.presentation.spot}:null;
    const stagePlace = manualPoint ? (root.CharDayCatalog||[]).find(s=>s.id===manualPoint.scene)?.label : activeStage?.location || slot?.location;
    const nextStage=visual.stages[stageIndex+1];
    const payload = char && { outing:trip,socialPreferences:socialDraft[String(char.id)]||homes.socialPreferences?.[String(char.id)]||{},pairStyle:pairDraft[String(char.id)]?.ta||homes.pairStyles?.[String(char.id)]||'auto',persona:char.persona||"",motionStyle:demo?demoMotion:homes.motions?.[String(char.id)]||"auto",visitorData:{...visitorData,pairStyle:pairDraft[String(char.id)]?.me||homes.visitorPairStyles?.[String(char.id)]||'auto',homePresence:homeChoices[String(char.id)]||homes.presence?.[String(char.id)]||'with',activityChoice:demo?"auto":homes.visitorActivities?.[String(char.id)]||"auto",motionStyle:demo?demoVisitorMotion:homes.visitorMotions?.[String(char.id)]||"auto"},charId: String(char.id), ta: props.taFor?.(char) || "TA", look: props.lookFor?.(char) || {}, visitorLook:meDraft||homes.looks?.me||visitorData.look||{},visitorPreview:mePanel,professional:demo?demoProfessional:homes.professional?.[String(char.id)]||{},slot: slot || null, activitySlot:visual.activitySlot || null,
      at: preview || demo ? null : state.at, preview: !!preview || demo, albumShot: !!albumShoot, scenePaused:!!(albumOpen||book||homeOptions||moreOpen||togetherPanel||professionalPanel||lifePage||mePanel||outingPicker||positionEdit), editing: !!editor, resume:scenePause.current?.charId===String(char.id)?scenePause.current:!preview&&!demo&&!showcase?sceneContinuity.get(String(char.id))||null:null, homePlacements: editor ? editor.placements : demo ? demoLayout : homes.layouts?.[String(char.id)] || {},
      homeStyle: demo ? demoStyle : homes.styles?.[String(char.id)] || "warm", showcase: !!showcase && !editor,
      presentation: editor ? {map:"dayHome",action:"rest",gesture:"rest"} : showcase ? {map:showcase,action:spot?.action||"work",gesture:spot?.gesture||"rest",spot:spot?.id||"entry"} : trip ? {map:trip.map,action:'rest',gesture:'rest'} : visual.presentation, cameraMode,kitchenJob:demo?null:homes.kitchens?.[String(char.id)]?.pending||null,kitchenCarry:demo?[]:L.kitchen(homes.kitchens?.[String(char.id)]).dishes.filter(d=>d.packed&&d.owner==='ta'), minute: showcase ? 720 : preview || demo ? String(slot?.time || "12:00").split(":").reduce((n, part, i) => n + Number(part) * (i ? 1 : 60), 0) : state.minute, follow: editor ? false : follow,
      key: trip&&!editor ? "outing:"+char.id+":"+trip.map+":"+trip.mode : showcase ? "place:"+showcase+":"+(spot?.id||"entry") : slot?.key || JSON.stringify([char.id, state?.day, slot?.time, slot?.end, slot?.title, slot?.location, slot?.deviation, ...(slot ? [] : [visual.presentation?.spot])]) };
    if(payload&&(showcase||editor))payload.slot=null;
    if(payload)payload.weather=demo||showcase?null:sceneWeather(char,now,!!preview,payload.minute,preview?null:state?.day);
    const thoughtPrefs=homes.thoughts?.[String(char?.id)]||{};
    const thoughtFrame=!demo&&!preview&&!showcase&&!editor&&!trip&&state?.slot?root.CharDayThoughts.snapshot({char,slot:state.slot,state,stageIndex,stage:activeStage,activity:activityStatus?.charId===String(char?.id)&&activityStatus.key===slot?.key?activityStatus:null,scope:props.thoughtScopeFor?.(char)||''}):null;
    const thought=root.CharDayThoughts.useThoughts({char,frame:thoughtFrame,enabled:thoughtPrefs.enabled===true,cache:thoughtPrefs.cache,preferences:thoughtPrefs,
      allowed:!!thoughtFrame&&!kitchenTool&&!book&&!homeOptions&&!moreOpen&&!togetherPanel&&!professionalPanel&&!lifePage&&!mePanel&&!outingPicker&&!positionEdit&&!chatOpen&&root.document?.visibilityState!=='hidden'&&!!props.generateThought,
      context:props.thoughtContextFor,generate:props.generateThought,tick:pulse,
      save:(id,change)=>saveHomeChange(id,'thoughts',change),saved:setHomes});
    const chosen=furniture.find(p=>p.id===editor?.selected);
    const piecePreviewKey=chosen&&JSON.stringify([chosen.id,chosen.color,chosen.material,chosen.partColors,payload?.homeStyle]);
    useEffect(()=>{
      if(decorPanel!=="piece"||!chosen){setPiecePreview(null);return;}
      const id=chosen.id,frame=requestAnimationFrame(()=>{try{const src=iframe.current?.contentWindow?.CharDayScene?.furniturePreview(id);setPiecePreview(src?{id,src}:null);}catch(_){setPiecePreview(null);}});
      return()=>cancelAnimationFrame(frame);
    },[decorPanel,piecePreviewKey]);

    stateRef.current = payload;
    const send = () => { try { iframe.current?.contentWindow?.CharDayScene?.setSnapshot({...stateRef.current,viewInsets:(()=>{const el=iframe.current?.parentElement,box=el?.getBoundingClientRect(),card=el?.querySelector('[data-wk=cdaynow]')?.getBoundingClientRect(),chat=el?.parentElement?.parentElement?.querySelector('[data-wk=cdaychat]'),hud=el?.querySelector('[data-wk=cdaykitchenhud]'),sideKitchen=hud?.dataset.tabletop==='1'&&box?.width>box?.height,sideCard=card&&box?.width>box?.height;return {top:sideCard?24:card&&box?Math.max(24,card.bottom-box.top+14):130,bottom:Math.max(30,chat&&!chat.hidden&&box?box.bottom-chat.getBoundingClientRect().top+14:0,!sideKitchen&&hud&&box?box.bottom-hud.getBoundingClientRect().top+14:0),left:sideCard?card.right-box.left+18:18,right:sideKitchen?box.right-hud.getBoundingClientRect().left+18:18};})()}); } catch (_) { setSceneStatus("画面同步失败，请重新载入画面"); } };
    React.useLayoutEffect(() => { send(); }, [pulse, JSON.stringify(payload), retry, book, homeOptions, thought.cache?.text, thought.busy, thought.error, thought.unsaved, chatOpen]);
    useEffect(() => {
      const ready = e => {
        if (e.source !== iframe.current?.contentWindow || e.origin !== location.origin) return;
        if(e.data?.type==='char-day-kitchen-notice'&&String(e.data.charId)===String(stateRef.current?.charId)){setLifeNotice(String(e.data.notice||''));return;}
        if(e.data?.type==='char-day-kitchen-station'&&String(e.data.charId)===String(stateRef.current?.charId)){setKitchenTool(typeof e.data.station==='string'?e.data.station:'');return;}
        if(e.data?.type === "char-day-kitchen"){handleKitchen(e.data);return;}
        if(e.data?.type === "char-day-activity"){setActivityStatus(e.data);return;}
        if(e.data?.type === "char-day-visit"){setVisitStatus(current=>({...e.data,saveNotice:current&&current.charId===e.data.charId?current.saveNotice:"",homeSaveNotice:current&&current.charId===e.data.charId?current.homeSaveNotice:""}));rememberVisit(e.data);return;}
        if (e.data?.type === "char-day-layout") { setEditor(current => current ? {...current,placements:e.data.placements,selected:e.data.selected,dragging:e.data.dragging,busy:e.data.busy} : null); setLayoutNotice(e.data.notice || ""); const list=iframe.current?.contentWindow?.CharDayScene?.listFurniture?.(); if(list)setFurniture(list); return; }
        if (e.data?.type === "char-day-view") { setFollow(!!e.data.following);setCameraMode(e.data.mode|| (e.data.following?'ta':'free')); return; }
        if (e.data?.type !== "char-day-status") return;
        setSceneStatus(e.data.error || ""); if (!e.data.error) {setCatalogLabels(iframe.current?.contentWindow?.CharDayScene?.catalogLabels?.()||{}); const motions=iframe.current?.contentWindow?.CharDayScene?.listMotions?.();if(motions)setMotionOptions(motions);setPairOptions(iframe.current?.contentWindow?.CharDayScene?.listPairStyles?.()||[]); const options = iframe.current?.contentWindow?.CharDayScene?.listStyles?.(); if (options) setStyles(options);setProfessionalChoices(iframe.current?.contentWindow?.CharDayScene?.professionalChoices?.()||{});setProfessionalStyles(iframe.current?.contentWindow?.CharDayScene?.professionalStyles?.()||{}); const list=iframe.current?.contentWindow?.CharDayScene?.listPlaces?.();if(list)setPlaces(list);send(); }
      };
      root.addEventListener("message", ready); return () => root.removeEventListener("message", ready);
    }, []);
    useEffect(()=>{if(!visitStatus?.present)setTogetherPanel(false);},[visitStatus?.present]);
    const openMe=()=>{setMeDraft(structuredClone(homes.looks?.me||visitorData.look||{}));setMeNotice("");setMePanel(true);if(!meStyles)fetch("apps/fairy-garden/doll.json?v="+props.build).then(r=>{if(!r.ok)throw Error();return r.json();}).then(setMeStyles).catch(()=>setMeNotice("衣柜还没打开，重新进入可以再试。"));};
    const saveMe=async()=>{if(meBusy)return;setMeBusy(true);try{const next=await saveHomeChange("me","looks",meDraft||{});setHomes(next);setMeDraft(null);setMePanel(false);setMoreOpen(false);}catch{setMeNotice("保存没成功，调整仍在这里，可以重试。");}finally{setMeBusy(false);}};
    const {ink,soft,paper}=UI;
    const socialSetting=S.setting(payload),homeVisiting=socialSetting?.home&&visitStatus?.charId===String(char?.id)&&visitStatus?.present;
    const visiting=visitStatus?.charId===String(char?.id)&&visitStatus.present;
    function rememberVisit(info,explicit=false){
      const current=stateRef.current,charId=String(info.charId||current?.charId||"");
      if(!info.present&&!explicit||!['auto','manual'].includes(info.control)||charId!==current?.charId||current.preview||current.outing||info.outing)return;
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
      if(demo||payload.outing||payload.presentation.map!=='dayHome')return;
      const charId=String(char.id);setHomeChoices(current=>({...current,[charId]:choice}));
      saveHomeChange(charId,'presence',choice).then(next=>{setHomes(next);setVisitStatus(v=>v?.charId===charId?{...v,homeSaveNotice:''}:v);}).catch(()=>setVisitStatus(v=>v?.charId===charId?{...v,homeSaveNotice:'这次没能记住进出选择，当前仍按你的选择；再选一次可以重试。'}:v));
    }
    const joinVisit=()=>{rememberHomeChoice('with');return iframe.current?.contentWindow?.CharDayScene?.joinVisit?.();};
    const visitAction=(kind,options)=>{setTogetherPanel(false);if(kind==='leave')rememberHomeChoice('away');const scene=iframe.current?.contentWindow?.CharDayScene,ok=scene?.visitAction?.(kind,options),info=scene?.inspect?.().visitor;if(info)rememberVisit(info,true);return ok;};
    async function changeProfessional(field,value){
      const scene=professionalScene;setProfessionalBusy(true);setProfessionalNotice('');
      try{
        if(demo)setDemoProfessional(old=>({...old,[scene]:{...old[scene],[field]:value}}));
        else setHomes(await saveHomeChange(char.id,'professional',old=>({...old,[scene]:{...old?.[scene],[field]:value}})));
      }catch{setProfessionalNotice('没能保存，原陈设和配色还在，可以再试。');}finally{setProfessionalBusy(false);}
    }
    async function changeSocial(field,value){
      const charId=String(char.id),next={...payload.socialPreferences,[field]:value};setSocialDraft(raw=>({...raw,[charId]:next}));setSocialBusy(true);setSocialNotice('');
      try{setHomes(await saveHomeChange(charId,'socialPreferences',old=>({...old,[field]:value})));}
      catch{setSocialNotice('当前已按你的选择；这次没能保存，重新选择可以重试。');}finally{setSocialBusy(false);}
    }
    async function changePair(who,value){
      const charId=String(char.id);setPairDraft(raw=>({...raw,[charId]:{...raw[charId],[who]:value}}));setStyleBusy(true);setStyleNotice('');if(demo){setStyleBusy(false);return;}
      try{setHomes(await saveHomeChange(charId,who==='ta'?'pairStyles':'visitorPairStyles',value));setStyleNotice('已记住各自的双人动作习惯');}
      catch{setStyleNotice('当前已按你的选择；这次没能保存，重新选择可以重试。');}finally{setStyleBusy(false);}
    }
    const pairChoice=(who,label)=>h('label',{style:{display:'block',marginBottom:14,fontSize:12,lineHeight:1.8}},label,
      h('select',{"data-wk":"cdaypair",'data-part':who,'aria-label':label,disabled:styleBusy,value:who==='ta'?payload.pairStyle:payload.visitorData.pairStyle,onChange:e=>changePair(who,e.target.value),style:{...btn,height:44,display:'block',width:'100%',marginTop:6}},
        h('option',{value:'auto'},'自动参考人设与动作习惯'),...pairOptions.map(p=>h('option',{key:p.id,value:p.id},p.label+' · '+p.description))));
    function handleKitchen(info){
      const current=stateRef.current,job=current?.kitchenJob;if(current?.charId!==info.charId||job?.id!==info.id)return;
      setKitchenStatus(info);
      if(job.cooking&&info.progress){const rev=L.cookingProgress(info.progress).rev;if(rev<=L.cookingProgress(job.cooking.progress).rev||rev<=(kitchenCheckpoints.current[info.id]||0))return;kitchenCheckpoints.current[info.id]=rev;
       saveHomeChange(info.charId,'kitchens',raw=>L.kitchenChange(raw,{kind:'progress',id:info.id,progress:info.progress,mode:info.mode,lead:info.lead})).then(setHomes).catch(()=>{delete kitchenCheckpoints.current[info.id];setLifeNotice('这步还没存好，继续操作可以重试；食材还在。');});return;}
      if(!info.ready||job.ready||kitchenReady.current[info.id])return;
      kitchenReady.current[info.id]=true;
      saveHomeChange(info.charId,'kitchens',raw=>L.kitchenChange(raw,{kind:'ready',id:info.id})).then(setHomes).catch(()=>{delete kitchenReady.current[info.id];setLifeNotice('进度还没存好，回到现场后可以重试；食材还在。');});
    }
    const uniqueId=()=>root.crypto.randomUUID();
    const kitchenInput=event=>{const result=iframe.current?.contentWindow?.CharDayScene?.kitchenInput(event);if(result?.ok===false&&result.reason)setLifeNotice(result.reason);else if(result?.ok)setLifeNotice(result.notice||'');};
    const openLifePage=page=>{setTogetherPanel(false);setLifePage(page);setPhotoId('');setKitchenRecipe('');setLifeNotice('');if(page==='preferences')setWish(homes.preferences?.[String(char.id)]?.wish||'');};
    const lifeWrite=async(write,saveFailure)=>{if(lifeBusy)return null;setLifeBusy(true);setLifeNotice('');try{const next=await write();setHomes(next);return next;}catch(e){setLifeNotice(e.message==='save'?(saveFailure||'没能保存，原来的记录和材料都还在，可以重试。'):e.message);return null;}finally{setLifeBusy(false);}};
    // Daily album, automatic (on unless switched off): while TA's live day is on screen, keep one frame per stop once TA has settled there.
    const albumAuto = !!char && homes.albumAuto?.[String(char.id)] !== false;
    useEffect(()=>{
      if(typeof setTimeout!=="function"||!char||demo||preview||showcase||trip||editor||albumShoot||!albumAuto||!state?.slot||state.slot.carry||payload?.scenePaused)return;
      const slot=state.slot,day=state.day,key=payload?.key,want=visual.presentation?.map;
      if(loadAlbums()[String(char.id)]?.[day]?.photos?.some(p=>p.time===slot.time))return;
      let timer,cancelled=false,last=null,onMap=0;const started=Date.now();
      const tick=()=>{
        if(cancelled)return;
        const api=iframe.current?.contentWindow?.CharDayScene,sc=api?.inspect?.(),pos=sc?.position;
        const here=!!sc?.ready&&!sc.changing&&(!want||sc.map===want);if(here&&!onMap)onMap=Date.now();
        const still=here&&last&&pos&&Math.hypot((pos.x||0)-(last.x||0),(pos.z||0)-(last.z||0))<.03;last=pos?{...pos}:null;
        if(!(still&&Date.now()-onMap>1500)){if(Date.now()-started<90000)timer=setTimeout(tick,1000);return;}
        let shot=null;try{shot=api.captureSolo();}catch{}
        if(!shot||shot.charId!==String(char.id)||shot.key!==key)return;
        saveAlbum(char.id,day,cur=>({...(cur||{}),photos:mergePhotos(cur?.photos,[{time:slot.time,end:slot.end||"",title:slot.title,location:slot.location||"",place:shot.place||"",src:shot.src}]),at:Date.now()})).then(()=>setAlbumTick(t=>t+1)).catch(()=>{});
      };
      timer=setTimeout(tick,2500);
      return()=>{cancelled=true;clearTimeout(timer);};
    },[char?.id,state?.slot?.key,state?.day,albumAuto,!!preview,!!showcase,!!trip,!!editor,!!albumShoot,!!payload?.scenePaused]);
    // Opening the album fills in today's stops nobody was watching (once per set of gaps), so she never has to press "shoot".
    useEffect(()=>{
      if(!albumOpen){albumFill.current=albumFill.current&&albumShoot?albumFill.current:"";return;}
      if(albumShoot||!char||demo||!albumAuto||!state)return;
      const day=state.day,photos=loadAlbums()[String(char.id)]?.[day]?.photos||[],miss=albumRows(state,{pastOnly:true}).filter(r=>!photos.some(p=>p.time===r.time));
      // One automatic round per opening: stops that still fail stay empty instead of restarting the shoot every time the page comes back.
      const tag=char.id+":"+day;
      if(!miss.length||albumFill.current===tag)return;
      albumFill.current=tag;setAlbumOpen(false);setOuting(null);setShowcase("");setBook(false);setAlbumShoot({day,rows:miss,index:0,photos:[],auto:true});
    },[albumOpen,char?.id]);
    // Shoot the day album: preview each stop in turn, wait until TA has arrived, take a small frame of TA alone.
    useEffect(()=>{
      if(!albumShoot||!char||demo)return;
      let timer,cancelled=false;const {rows,index,day}=albumShoot;
      if(index>=rows.length){
        setPreview(null);
        (async()=>{try{if(albumShoot.photos.length)await saveAlbum(char.id,day,cur=>({...(albumShoot.replace?{}:cur||{}),photos:albumShoot.replace?albumShoot.photos:mergePhotos(cur?.photos,albumShoot.photos),at:Date.now()}));setAlbumNotice(albumShoot.photos.length?'':'这次一张也没拍成，可以再试。');}catch{setAlbumNotice('照片没能存下，可以再拍一次。');}setAlbumShoot(null);setAlbumTick(t=>t+1);setAlbumOpen(true);})();
        return;
      }
      const row=rows[index],key="album:"+char.id+":"+day+":"+index,want=presentation(row)?.map,started=Date.now();
      setPreview({...row,key});
      const next=photo=>setAlbumShoot(s=>s&&s.index===index?{...s,index:index+1,photos:photo?[...s.photos,photo]:s.photos}:s);
      // The route keeps a last point even at rest, so "arrived" means: right map, and TA has nearly stopped moving (or 8s on the map).
      let last=null,onMap=0;
      const tick=()=>{
        if(cancelled)return;
        const api=iframe.current?.contentWindow?.CharDayScene,sc=api?.inspect?.(),pos=sc?.position;
        const here=!!sc?.ready&&!sc.changing&&(!want||sc.map===want);if(here&&!onMap)onMap=Date.now();
        const still=here&&last&&pos&&Math.hypot((pos.x||0)-(last.x||0),(pos.z||0)-(last.z||0))<.03;last=pos?{...pos}:null;
        const settled=here&&(still||Date.now()-onMap>8000);
        if(!settled){if(Date.now()-started<20000){timer=setTimeout(tick,300);return;}next(null);return;}
        timer=setTimeout(()=>{if(cancelled)return;let shot=null;try{shot=api.captureSolo();}catch{}
          next(shot&&shot.charId===String(char.id)&&shot.key===key?{time:row.time,end:row.end||"",title:row.title,location:row.location||"",place:shot.place||"",src:shot.src}:null);},1500);
      };
      timer=setTimeout(tick,500);
      return()=>{cancelled=true;clearTimeout(timer);};
    },[albumShoot?.index,albumShoot?.day,char?.id]);
    useEffect(()=>{
      setPhotoDraft(null);setPhotoPreviewNotice('');
      if(lifePage!=='album'||photoId)return;
      if(!visiting||demo||preview||showcase||trip?.mode==='solo'){setPhotoPreviewNotice('先和TA走到一起，再拍同框照片。');return;}
      let timer,cancelled=false;const started=performance.now(),key=payload.key;
      const prepare=()=>{
        if(cancelled)return;
        try{
          const api=iframe.current?.contentWindow?.CharDayScene,scene=api?.inspect();
          if(!scene?.ready||scene.changing){
            if(performance.now()-started<15000){timer=setTimeout(prepare,250);return;}
            throw Error('画面还没准备好，稍后点重新取景。');
          }
          const shot=api.capturePhoto();if(!shot||shot.charId!==String(char.id))throw Error('画面还在准备，请重新取景。');
          const at=Date.now(),photo={id:uniqueId(),charId:String(char.id),src:shot.src,at,day:state?.day&&!demo&&!preview?state.day:root.ScheduleClock.characterFrame(char,at).day,time:clockText(shot.minute),taName:char.remark||char.name,meName:visitorData.name||'我',activity:shot.activity,place:shot.place||'',map:shot.map,note:''};
          setPhotoDraft({key,photo});
        }catch(e){setPhotoPreviewNotice(e.message||'取景没成功，可以再试一次。');}
      };
      timer=setTimeout(prepare,0);
      return()=>{cancelled=true;clearTimeout(timer);};
    },[lifePage,photoId,id,visiting,payload?.key,retry,photoRefresh,!!preview,showcase,trip?.mode]);
    const photoShot=photoDraft?.key===payload?.key&&photoDraft?.photo.charId===String(char?.id)?photoDraft.photo:null;
    const takePhoto=async()=>{
      if(lifeBusy||!photoShot)return;const photo=photoShot;
      const next=await lifeWrite(()=>saveHomeChange(char.id,'albums',raw=>L.albumChange(raw,char.id,{kind:'add',photo})),'没能保存，这张预览还在，可以重试。');
      if(next){setLifePage('album');setPhotoId(photo.id);setPhotoNote('');setLifeNotice('拍好了，已放进你们的小家相册。');}
    };
    const kitchen= L.kitchen(homes.kitchens?.[String(char?.id)]),photos=L.album(homes.albums?.[String(char?.id)],char?.id),photo=photos.find(p=>p.id===photoId),suggestion=L.recommendation(char?.persona,wish),pendingJob=kitchen.pending;
    const kitchenAction=async action=>{
      const next=await lifeWrite(()=>saveHomeChange(char.id,'kitchens',raw=>L.kitchenChange(raw,action.kind==='begin'?{...action,day:state.day,time:state.time,at:Date.now()}:action)));
      if(next&&['begin','serve','plate'].includes(action.kind))runKitchen(next.kitchens[String(char.id)].pending);
      if(next&&action.kind==='cancel'){visitAction('end');setKitchenStatus(null);setLifeNotice('收起了这次料理，食材保留。');}
      if(next&&action.kind==='finish'){visitAction('end');setKitchenStatus(null);setLifeNotice(pendingJob?.kind==='meal'?'一起吃完了。':'做好两人份，已经收进餐盒。');}
      return next;
    };
    const shareKitchenMeal=async mealId=>{
      const meal=L.kitchenMealFor(homes,char.id,mealId);if(!meal&&!(pendingJob?.kind==='cook'&&pendingJob.id===mealId)){setLifeNotice('这份料理已经改变，重新打开后再试。');return;}
      const next=await lifeWrite(()=>saveHomeChange(char.id,'kitchenChats',raw=>root.CharDayKitchenChat.chatChange(raw,{kind:'select',meal:meal||null})));
      if(next){setChatOpen(false);setKitchenView('chat');setKitchenRecipe('');setLifePage('kitchen');setMoreOpen(false);}
    };
    const playKitchenMoment=(kind,jobId)=>{if(!pendingJob||jobId&&jobId!==pendingJob.id){setLifeNotice('这份料理已经结束。');return;}setLifePage('');setMoreOpen(false);setTogetherPanel(false);requestAnimationFrame(()=>{send();kitchenInput({kind:'moment',value:kind});});};
    const runKitchen=job=>{
      if(!job)return;send();setKitchenStatus(null);
      const ok=visitAction('together:'+job.kind,job.cooking?{lead:job.cooking.lead}:undefined);if(ok){setLifePage('');setMoreOpen(false);}else setLifeNotice('等TA在家走到位置、你也进屋后，再点继续。材料和餐盒保留。');
    };
    const btn = UI.button;
    const footerStyle={padding:"3px 6px",paddingBottom:"calc(3px + env(safe-area-inset-bottom) * 0.4)",borderTop:"1px solid "+UI.line,minHeight:56,background:"#f9faf3"};
    const outer = body => h("div", { "data-wk": "cdaypage", className: "h-full flex flex-col", style: { position: "relative", ...UI.surface, color: ink } }, h("style",null,UI_CSS),body);
    const head = (back, right) => h(Head, { zh: kitchenTool?root.CharDayKitchen.stationInfo(pendingJob,kitchenTool,kitchenStatus?.progress).label:"TA的一天", sub: kitchenTool?(()=>{const K=root.CharDayKitchen,q=K.cookingSpec(pendingJob,kitchenStatus?.progress),t=K.stationInfo(pendingJob,kitchenTool,kitchenStatus?.progress);return q.ready?'已做好 · 放大看看这份成品':q.passive?'还有 '+Math.max(0,Math.ceil(q.seconds-(q.progress.wait||0)))+' 秒 · 可调火':t.hint+(!q.tabletop&&q.required?' · '+Math.round(q.progress.work/q.required*100)+'%':'');})():char ? char.remark || char.name : "跟着TA看看今天", bg: "transparent", ink,lineInk:UI.line,subInk:soft, onBack: kitchenTool?()=>kitchenInput({kind:'station',value:''}):back, right:kitchenTool?null:right });
    const body = content => h("div", { ref: scroll, "data-wk": "cdaybody", className: "flex-1 min-h-0 overflow-y-auto", onScroll: e => { positions.current[homeOptions ? "style" : book ? "book" : "picker"] = e.currentTarget.scrollTop; }, style: { padding: "18px 18px 28px" } }, content);
    if (!char) return outer(h(React.Fragment, null, head(props.onBack), body(h(React.Fragment, null,
      h("p", { style: { fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.9, color: soft, margin: "0 0 16px" } }, "挑一位，看看TA此刻在哪儿、在做什么。"),
      ...(props.characters || []).map(c => {
        // The last saved thought only; the picker never asks the model for a new one.
        const thoughtOf = x => lastThought(homes, x.id);
        const st = dayState(c, props.plansFor?.(c) || {}, now, clockOptions(homes, c.id)), near = aroundNow(st), thought = thoughtOf(c);
        // No plan today is a dead end unless the card offers the way to the calendar.
        return h("div", { key: c.id, style: { marginBottom: 10 } }, h("button", { "data-wk": "cdaypick", onClick: () => pick(c.id), style: { ...btn, width: "100%", textAlign: "left", padding: 14 } },
          h("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 } }, h("strong", { style: { fontSize: "calc(15px * var(--app-fs, 1))", fontWeight: 500 } }, c.remark || c.name), h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: soft, flexShrink: 0 } }, "TA当地 " + st.time)),
          h("span", { style: { display: "block", marginTop: 5, lineHeight: 1.7 } }, st.slot?.title || (st.hasPlan ? "这会儿没排事情，"+root.CharDayLink.idleLabel(st.minute) : "今天还没有日程")),
          !!st.slot && h("span", { style: { display: "block", fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: soft } }, [st.slot.location, spanText(near.elapsed)].filter(Boolean).join(" · ")),
          !!(near.prev || near.next) && h("span", { style: { display: "block", fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: soft } }, [near.prev && "刚才 · " + near.prev.title, near.next && "接下来 " + near.next.time + " · " + near.next.title].filter(Boolean).join("　")),
          dayLine(st, { accent: UI.accent }) || false,
          !!thought && h("span", { style: { display: "block", fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.7, color: soft, marginTop: 4, borderTop: "1px dashed " + UI.line, paddingTop: 4 } }, "念头" + (thought.time ? " · " + thought.time : "") + "：" + thought.text)),
          !st.hasPlan && h("button", { onClick: () => props.onSchedule?.(c), style: { ...btn, width: "100%", marginTop: 6, background: "transparent", borderStyle: "dashed" } }, "去日历给TA排今天"));
      }), h("button", { onClick: () => pick(DEMO.id), style: { ...btn, width: "100%", marginTop: 12, background: "transparent", borderStyle: "dashed" } }, "先看一段示例"),
      h("p", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: soft, lineHeight: 1.8 } }, "跟着日程走进小家、工作空间、小店和街道；专业日程也会走进实验室、图书馆、诊室和创作室。"),
      h("button", { "data-wk": "block", onClick: visitPlaces, "data-wk":"cdayplaces", style: { ...btn, width: "100%", marginTop: 4, background: "transparent", border: 0, color: soft, fontSize: "calc(12px * var(--app-fs, 1))" } }, "逛逛所有场景")))));
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
      if(demo){(section==='motions'?setDemoMotion:setDemoVisitorMotion)(value);setStyleNotice("示例动作习惯已调整");return;}
      setStyleBusy(true);setStyleNotice("");
      try{setHomes(await saveHomeChange(char.id,section,value));setStyleNotice("已记住你们各自的动作习惯");}
      catch(_){setStyleNotice("这次没能保存，原来的动作习惯还在，可以再试一次。");}
      finally{setStyleBusy(false);}
    };
    const motionChoice=(section,label)=>h("label",{style:{display:"block",marginBottom:14,fontSize:12,lineHeight:1.8}},label,
      h("select",{"data-wk":"cdaymotion","data-part":section,"aria-label":label,disabled:styleBusy,value:demo?(section==='motions'?demoMotion:demoVisitorMotion):homes[section]?.[String(char.id)]||"auto",onChange:e=>changeMotion(section,e.target.value),style:{...btn,height:44,display:"block",width:"100%",marginTop:6}},
        h("option",{value:"auto"},"自动参考人设"),...motionOptions.map(p=>h("option",{key:p.id,value:p.id},p.label+" · "+p.description))));
    const startEditor = (recommended=[]) => {setRecommendedFurniture(Array.isArray(recommended)?recommended:[]); setMoreOpen(false);setTogetherPanel(false);setDecorPanel(""); setHomeOptions(false);setBook(false);setLayoutNotice("");setEditor({placements:JSON.parse(JSON.stringify(demo?demoLayout:homes.layouts?.[String(char.id)]||{})),selected:"double-bed",dragging:false,stayInHome:payload.presentation.map!=="dayHome"}); };
    const cancelEditor = () => { if(layoutBusy||editor?.busy)return;setEditor(null);setDecorPanel("");setLayoutNotice(""); };
    const finishLayoutSave = placements => {
      if(editor?.stayInHome){
        setEditor(current=>current?{...current,placements}:null);
        setLayoutNotice("已保存，可以继续布置；点返回结束装修。");
      }else{setEditor(null);setDecorPanel("");setLayoutNotice("");}
    };
    const saveLayout = async () => {
      if(layoutBusy||editor?.dragging||editor?.busy)return;
      const checked=iframe.current?.contentWindow?.CharDayScene?.editLayout?.();
      if(!checked?.ok){setLayoutNotice(checked?.reason||"画面还在准备，稍等一下再保存。");return;}
      if(demo){setDemoLayout(checked.placements);finishLayoutSave(checked.placements);return;}
      setLayoutBusy(true);setLayoutNotice("");
      try{
        const next=await saveHomeChange(char.id,"layouts",checked.placements);
        setHomes(next);finishLayoutSave(checked.placements);
      }catch(_){setLayoutNotice("这次没能保存，试摆还在，可以再试一次；取消会回到原来的布置。");}
      finally{setLayoutBusy(false);}
    };
    const editorAction=action=>{if(layoutBusy)return;iframe.current?.contentWindow?.CharDayScene?.editAction(action);};
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
    const customColor=(hook,label,value,change)=>h("fieldset",{...hook,disabled:layoutBusy||editor?.busy,style:{border:0,padding:0,margin:0,minWidth:0}},h(ColorDot,{value,onChange:change,label,hexField:true,hexOnly:true,size:44,tone:{line:UI.line,ink,bg2:paper,field:btn.backgroundColor,ink2:ink}}));
    const optionGrid=(options,selected,choose,attrs)=>h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},...Object.entries(options||{}).map(([key,value])=>h("button",{key,...attrs,"data-part":key,"aria-pressed":(selected||"auto")===key,disabled:layoutBusy||editor?.busy,onClick:()=>choose(key),style:{...btn,textAlign:"left",borderColor:(selected||"auto")===key?"#8b9e7e":UI.line}},h("span",{style:{display:"inline-block",verticalAlign:"middle",marginRight:8,width:22,height:22,borderRadius:4,background:value.color||"#d6ccb9",backgroundImage:value.pattern==='stripe'?"repeating-linear-gradient(90deg,transparent 0 5px,#fff9 5px 6px)":(value.pattern==='tile'||value.pattern==='wainscot')?"linear-gradient(90deg,transparent 48%,#84756250 49%,#84756250 51%,transparent 52%),linear-gradient(transparent 48%,#84756250 49%,#84756250 51%,transparent 52%)":value.pattern==='dots'?"radial-gradient(#74836880 1.5px,transparent 2px)":value.pattern==='checker'?"conic-gradient(#68756566 25%,transparent 0 50%,#68756566 0 75%,transparent 0)":value.pattern==='herringbone'?"repeating-linear-gradient(45deg,transparent 0 5px,#725d4850 5px 6px)":value.pattern==='botanical'?"radial-gradient(ellipse at 35% 30%,#73876680 0 20%,transparent 22%)":value.pattern==='terrazzo'?"radial-gradient(#79695480 1px,transparent 2px)":"none",backgroundSize:"12px 12px",border:"1px solid #b6ad99"}},null),value.label,(selected||"auto")===key?" · 已选":"")));

    const catalogItem=item=>h("button",{key:item.id,"data-wk":"cdaycatalogitem","data-part":item.id,"aria-label":item.label+" 添一件",disabled:layoutBusy||editor?.busy,onClick:()=>iframe.current?.contentWindow?.CharDayScene?.addFurniture(item.id),style:{...btn,minWidth:0,width:"calc((100% - 10px) / 2)",height:"auto",padding:"4px 8px 10px",textAlign:"left",borderRadius:14,boxShadow:"0 2px 8px #38443108"}},h("div",{style:{position:"relative",width:"100%",aspectRatio:"1",marginBottom:4}},h("img",{src:item.thumbnail,alt:item.label,style:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",display:"block",borderRadius:4}})),h("span",{style:{display:"block",fontSize:12}},item.label),h("span",{style:{display:"block",fontSize:11,color:soft,marginTop:4}},(decorOptions.collections?.[item.collection]?.label||"花窗手作")+" · 添一件"));
    const decorContents=decorPanel&&decorOptions&&h("section",{"data-wk":"cdaydecorpanel",className:"absolute inset-0 flex flex-col",style:{zIndex:5,...UI.surface}},
      h("div",{role:"status","data-wk":"cdaydecornotice",style:{padding:"8px 16px",fontSize:12,lineHeight:1.8,color:soft,borderBottom:"1px solid "+UI.line}},layoutNotice||"先试着搭配，回去看看，满意后点保存。"),
      h("div",{ref:decorScroll,"data-wk":"cdaydecorbody",className:"flex-1 min-h-0 overflow-y-auto",onScroll:e=>{decorPositions.current[decorPanel]=e.currentTarget.scrollTop;},style:{padding:"18px 18px 28px"}},
        decorPanel==='catalog'?h(React.Fragment,null,
          h("p",{style:{fontSize:12,color:soft,lineHeight:1.8,marginTop:0}},"兴趣角可添钢琴、吉他、画架、哑铃架和运动软垫，摆好后能弹奏、画画或锻炼。还有四组家具、陶艺、小熊、花篮，以及画框、镜子、壁架和挂饰。点一件添进小家；墙饰挂到后墙或左墙，地毯能铺在桌椅下面。空间不够可以在“房间墙地”里扩建。"),
          recommendedFurniture.length>0&&h('section',{style:{marginBottom:22}},h('h3',{style:{fontSize:14,fontWeight:500}},'这次推荐的几件'),h('div',{style:{display:'flex',flexWrap:'wrap',alignItems:'flex-start',gap:10}},...catalog.filter(item=>recommendedFurniture.includes(item.id)).map(catalogItem))),
          ...Object.entries(decorOptions.categories).map(([key,label])=>h("section",{key,style:{marginBottom:22}},h("h3",{style:{fontSize:14,fontWeight:500,borderBottom:"1px solid "+UI.line,paddingBottom:7,margin:"0 0 10px"}},label),
            h("div",{style:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",gap:10}},...catalog.filter(item=>item.category===key&&!recommendedFurniture.includes(item.id)).map(catalogItem))))):
        decorPanel==='piece'?h(React.Fragment,null,
          control("选择要搭配的家具",h("select",{"data-wk":"cdaypiecepick","aria-label":"配色的家具",value:editor.selected,disabled:layoutBusy||editor?.busy,onChange:e=>iframe.current?.contentWindow?.CharDayScene?.selectFurniture(e.target.value),style:{...btn,width:"100%",height:44}},h("option",{value:""},"选择家具"),...furniture.map(p=>h("option",{key:p.id,value:p.id},p.label+(p.stored?" · 已收纳":""))))),
          chosen?h(React.Fragment,null,
            h("p",{style:{fontSize:12,color:soft,lineHeight:1.8}},"每个部件可以单独配色。主要颜色负责原来的搭配，部件自选颜色优先；同款家具也能各自搭配。"),
            h("figure",{style:{margin:"0 0 18px",textAlign:"center"}},h("div",{style:{width:160,height:160,maxWidth:"100%",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12,background:paper}},piecePreview?.id===chosen.id?h("img",{"data-wk":"cdaypiecepreview",src:piecePreview.src,alt:chosen.label+"配色预览",style:{display:"block",width:"100%",height:"100%",objectFit:"contain",borderRadius:12}}):h("span",{style:{fontSize:11,color:soft}},"正在更新预览")),h("figcaption",{style:{fontSize:11,color:soft,marginTop:6}},"配色预览")),
            h("h3",{style:{fontSize:13,fontWeight:500,margin:"0 0 10px"}},"主要颜色"),
            h("div",{"data-wk":"cdaypiececolors",style:{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,marginBottom:14}},...decorOptions.colors.map(v=>h("button",{key:v.color,"aria-label":v.label,"aria-pressed":chosen.color===v.color,disabled:layoutBusy||editor?.busy,onClick:()=>setPiece({color:v.color}),style:{...btn,padding:"8px 4px",borderColor:chosen.color===v.color?"#8b9e7e":UI.line}},h("span",{style:{display:"block",margin:"0 auto 5px",width:25,height:25,borderRadius:5,background:v.color}},null),v.label,chosen.color===v.color?" · 已选":""))),
            chosen.mount&&h(React.Fragment,null,
              control("挂在哪面墙",h("select",{"data-wk":"cdaymountwall","aria-label":"挂饰所在的墙",value:chosen.wall,disabled:layoutBusy||editor?.busy||chosen.stored,onChange:e=>setPiece({wall:e.target.value}),style:{...btn,width:"100%",height:44}},...Object.entries(decorOptions.mountWalls).map(([key,label])=>h("option",{key,value:key},label)))),
              h("div",{"data-wk":"cdaymountposition",style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:14}},...[["往左挪",{along:chosen.along-(chosen.wall==="left"?-.15:.15)}],["往右挪",{along:chosen.along+(chosen.wall==="left"?-.15:.15)}],["挂低一点",{y:chosen.y-.15}],["挂高一点",{y:chosen.y+.15}]].map(([label,change])=>h("button",{key:label,style:btn,disabled:layoutBusy||editor?.busy||chosen.stored,onClick:()=>setPiece(change)},label))),
              h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"回到小家也能直接拖动墙饰，左右和高低一起调。窗户要留空，墙饰之间也要留一点距离。")),
            control("自选颜色",customColor({"data-wk":"cdaypiececolor"},"家具",chosen.color||chosen.primary||"#cba77f",color=>setPiece({color}))),
            h("button",{style:{...btn,width:"100%",marginBottom:14},disabled:layoutBusy||editor?.busy,onClick:()=>setPiece({color:""})},"颜色随小家样式"),
            h("section",{"data-wk":"cdaypartcolors",style:{marginBottom:20}},h("h3",{style:{fontSize:13,fontWeight:500,margin:"0 0 12px"}},"部件颜色"),...(chosen.parts||[]).map(part=>h("div",{key:part.id,"data-wk":"cdaypartcolor","data-part":part.id,style:{padding:"12px 0",borderBottom:"1px solid "+UI.line}},
              control(part.label,customColor({},part.label,part.color,color=>setPiece({partColors:{[part.id]:color}}))),
              h("button",{"data-wk":"cdaypartreset","data-part":part.id,disabled:layoutBusy||editor?.busy||!part.custom,style:{...btn,width:"100%",minHeight:44},onClick:()=>setPiece({partColors:{[part.id]:""}})},part.custom?"恢复这个部件的原配色":"沿用原配色"))),
              h("button",{"data-wk":"cdaypartsreset",disabled:layoutBusy||editor?.busy||!Object.keys(chosen.partColors||{}).length,style:{...btn,width:"100%",minHeight:44,marginTop:14},onClick:()=>setPiece({partColors:null})},"恢复所有部件的原配色")),
            control("材质",h("select",{"data-wk":"cdaymaterial","aria-label":"家具材质",value:chosen.material||"auto",disabled:layoutBusy||editor?.busy,onChange:e=>setPiece({material:e.target.value}),style:{...btn,width:"100%",height:44}},...Object.entries(decorOptions.materials).map(([key,label])=>h("option",{key,value:key},label)))),
            chosen.actions?.length>0&&h("button",{"data-wk":"cdayusefurniture","aria-pressed":chosen.inUse,style:{...btn,width:"100%"},disabled:layoutBusy||editor?.busy||chosen.stored,onClick:()=>setPiece("use")},chosen.inUse?"TA正在用这件":"让TA用这件"),
            h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"床用于睡觉，餐椅用于用餐，沙发用于喝茶、看书和休息。收纳后会选小家里可用的同类家具。")):h("p",{style:{fontSize:12,color:soft}},"先选一件家具。")):
        h(React.Fragment,null,
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:0}},"房间大小"),
          h("div",{"data-wk":"cdaysizeoptions",style:{display:"grid",gap:8}},...Object.entries(decorOptions.sizes).map(([key,value])=>h("button",{key,"data-wk":"cdayroomsize","data-part":key,"aria-pressed":(roomDecor.size||"compact")===key,disabled:layoutBusy||editor?.busy,onClick:()=>setRoom({size:key}),style:{...btn,textAlign:"left",padding:12,borderColor:roomDecor.size===key?"#8b9e7e":UI.line}},h("span",{style:{display:"block",fontSize:13}},value.label,(roomDecor.size||"compact")===key?" · 已选":""),h("span",{style:{display:"block",fontSize:11,color:soft,marginTop:4}},value.detail)))),
          h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"扩建保留家具位置，墙饰会跟着墙面。想缩回时，先把超出小房间的家具挪进来。"),
          ...[["originalRugs","保留原来的地毯"],["originalWallDecor","保留原来的画框和时钟"]].map(([key,label])=>h("label",{key,style:{display:"flex",alignItems:"center",gap:10,minHeight:44,fontSize:12}},h("input",{"data-wk":"cdayoriginaldecor","data-part":key,type:"checkbox",checked:roomDecor[key]!==false,disabled:layoutBusy||editor?.busy,onChange:e=>setRoom({[key]:e.target.checked}),style:{width:20,height:20,accentColor:"#7c9269"}}),label)),
          h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"收起原来的装饰，就能自己重铺地毯、布置画墙。墙面和地板选好后，回去看实际效果，再点保存。"),
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:22}},"墙面"),optionGrid(decorOptions.walls,roomDecor.wall,key=>setRoom({wall:key,wallColor:""}),{"data-wk":"cdaywall"}),
          h("div",{style:{marginTop:14}},control("墙面自选颜色",customColor({"data-wk":"cdaywallcolor"},"墙面",roomDecor.wallColor||decorOptions.walls[roomDecor.wall]?.color||"#eee3d1",wallColor=>setRoom({wallColor})))),
          h("h3",{style:{fontSize:14,fontWeight:500,marginTop:22}},"地板"),optionGrid(decorOptions.floors,roomDecor.floor,key=>setRoom({floor:key,floorColor:""}),{"data-wk":"cdayfloor"}),
          h("div",{style:{marginTop:14}},control("地板自选颜色",customColor({"data-wk":"cdayfloorcolor"},"地板",roomDecor.floorColor||decorOptions.floors[roomDecor.floor]?.color||"#cfb79b",floorColor=>setRoom({floorColor})))))));
    const camera=value=>{const mode=typeof value==='boolean'?(value?'overview':'ta'):value,api=iframe.current?.contentWindow?.CharDayScene;if(api?.setCameraMode?.(mode)===false)return;setFollow(mode!=='overview');setCameraMode(mode);setMoreOpen(false);setTogetherPanel(false);};
    const canVisit=!editor&&!demo&&!!socialSetting;
    const controlsOpen=!!positionEdit||book||homeOptions||(moreOpen&&!mePanel)||togetherPanel||professionalPanel||!!lifePage||outingPicker;
    const kitchenOnScene=!!(!editor&&!controlsOpen&&!chatOpen&&!demo&&!preview&&!showcase&&homeVisiting&&pendingJob);
    const menuBody=content=>h("div",{ref:menuScroll,"data-wk":"cdaymenubody",className:"flex-1 min-h-0 overflow-y-auto",onScroll:e=>{menuPositions.current[menuKey]=e.currentTarget.scrollTop;},style:{padding:"18px 18px 28px"}},content);
    const iconTile=(Icon,tone)=>h("span",{className:"cday-icon","aria-hidden":true,style:tone?{background:tone}:undefined},h(Icon,{size:21,color:UI.accent}));
    const actionButton=(attrs,kind,label,onClick)=>h("button",{...attrs,className:"cday-action",style:btn,onClick},h(actionIcon(kind),{size:19,color:UI.accent}),h("span",{style:{flex:1,minWidth:0}},label));
    const menuSection=(label,content)=>h("section",{"data-wk":"cdaymenusection",style:{marginBottom:22}},h("h3",{style:{margin:"0 0 12px",fontSize:12,fontWeight:600,color:soft,display:"flex",alignItems:"center",gap:9}},h("span",{style:{width:3,height:12,borderRadius:2,background:"#95a384"}},""),label),content);
    const menuRow=(attrs,label,detail,action,Icon)=>h("button",{...attrs,className:"cday-row","aria-label":label,onClick:action,style:{...btn,display:"flex",alignItems:"center",gap:12,width:"100%",border:0,borderBottom:"1px solid "+UI.line,borderRadius:0,background:"transparent",textAlign:"left",padding:"13px 0",boxShadow:"none"}},Icon&&iconTile(Icon),h("span",{style:{flex:1,minWidth:0}},h("span",{style:{display:"block",fontSize:14,fontWeight:500}},label),detail&&h("span",{style:{display:"block",marginTop:4,fontSize:11,lineHeight:1.7,color:soft}},detail)),h(IChevR,{size:15,color:soft}));
    const navButton=({sub,...attrs},label,Icon,action,extra={})=>h("button",{...attrs,...extra,onClick:action,style:{...btn,flex:1,minWidth:0,padding:"3px 2px",border:0,borderRadius:12,background:"transparent",boxShadow:"none",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,fontSize:11,lineHeight:1.2,color:extra["aria-pressed"]?UI.accent:ink,fontWeight:extra["aria-pressed"]?600:400}},h("span",{style:{display:"flex",alignItems:"center",justifyContent:"center",width:34,height:26,borderRadius:9,background:extra["aria-pressed"]?"#e3ebd8":"transparent"}},h(Icon,{size:20,color:extra["aria-pressed"]?UI.accent:ink})),h("span",null,label),sub&&h("span",{style:{fontSize:9.5,color:soft,fontWeight:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}},sub));
    const styleView=homeOptions&&h("section",{"data-wk":"cdaystylepage",className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:22}}, h(Head,{zh:"小家样式",sub:char.remark||char.name,bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>setHomeOptions(false)}), body(h(React.Fragment, null,
      h("p", { style: { fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.9, marginTop: 0 } }, "你们的小家"),
      h("p", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: soft, lineHeight: 1.9 } }, "挑一套喜欢的配色，再去布置家具、墙饰和地板，慢慢把这里住成你们的样子。"),
      h("p",{style:{fontSize:13,margin:"18px 0 6px"}},"小人的动作习惯"),
      h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},"自动参考人设中的性格描写，也可以自己挑动作习惯。每个人都有自己的节奏和坐姿。"),
      motionChoice("motions","TA的动作习惯"),motionChoice("visitorMotions","我的动作习惯"),pairChoice("ta","TA的双人动作"),pairChoice("me","我的双人动作"),
      ...styles.map(option => h("button", { key: option.id, "data-wk": "cdaystyle", "aria-pressed": payload.homeStyle === option.id, disabled: styleBusy,
        onClick: () => changeStyle(option.id), style: { ...btn, display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", marginBottom: 12, padding: 14, borderColor: payload.homeStyle === option.id ? "#8b9e7e" : UI.line } },
        h("span", { style: { display: "flex" } }, ...option.colors.map((color, i) => h("span", { key: i, style: { display: "block", width: 18, height: 28,background:color,borderRadius:5,marginRight:3 } }))),
        h("span",{style:{flex:1}},option.label),payload.homeStyle===option.id&&h(ICheck,{size:18,color:UI.accent}))),
      h("button", { "data-wk":"cdaydecorate", style:{...btn,width:"100%",marginTop:4}, onClick:startEditor }, "布置小家"),
      styleNotice && h("p", { role: "status", style: { fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.8 } }, styleNotice),
      h("button", { style: { ...btn, width: "100%" }, onClick: () => {setHomeOptions(false);setMoreOpen(false);} }, "回去看看"))));
    const bookView=book&&h("section",{inert:positionEdit?"":undefined,"aria-hidden":positionEdit?true:undefined,"data-wk":"cdaybook",className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:22}}, h(Head,{zh:"今天的日程",sub:char.remark||char.name,bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>setBook(false)}), body(h(React.Fragment, null,
      h("p", { style: { fontSize: "calc(12px * var(--app-fs, 1))", color: soft, lineHeight: 1.8, marginTop: 0 } }, demo ? "示例安排，仅用于试玩。" : state.day + " · TA当地 " + state.time),
      !state.rows.length && h("p", { style: { fontSize: "calc(13px * var(--app-fs, 1))", lineHeight: 1.9 } }, "还没有今天的安排。点最下面「去日历看完整安排」，在日历里排好或让 AI 排，回来就能看。"),
      ...state.rows.map((row, i) => h("div", {key:i,style:{display:"flex",alignItems:"stretch",gap:8,marginBottom:8}},h("button", { "data-wk": "cdayrow", "data-on": String(slot?.time === row.time), onClick: () => {
        setOuting(null);
        if (demo) setDemoIndex(i); else setPreview({ ...row, key: "preview:" + char.id + ":" + state.day + ":" + JSON.stringify(row) });
        setBook(false);
      }, style: { ...btn, flex:1,minWidth:0, textAlign: "left", border: 0, borderLeft: "3px solid " + (state.slot?.time === row.time ? "#8b9e7e" : UI.line),background:state.slot?.time===row.time?"#eaf0e2":"#fffdf7",borderRadius:"0 14px 14px 0", padding: "14px 15px", marginBottom: 10 } },
        h("span", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: soft } }, row.time + "—" + row.end + (state.slot?.time === row.time ? " · 此刻" : "")),
        h("div", { style: { fontSize: "calc(14px * var(--app-fs, 1))", lineHeight: 1.8, marginTop: 4 } }, row.title),
        row.location && h("div", { style: { color: soft, fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.8 } }, row.location),
        row.deviation && h("div", { style: { color: "#9b674d", fontSize: "calc(12px * var(--app-fs, 1))", lineHeight: 1.8 } }, "临时改了：" + (row.deviation.actual || row.deviation.reason || "安排有变化"))),!demo&&props.onEditSchedSeq&&h("button",{"data-wk":"cdaypositionopen","aria-label":"换地方："+row.title,style:{...btn,alignSelf:"center"},onClick:()=>openPosition(row,state.sourceDay||state.day)},"换地方"))),
      !demo && h("button", { style: { ...btn, width: "100%", marginTop: 12 }, onClick: () => props.onSchedule?.(char) }, "去日历看完整安排"))));
    const positionStage=positionEdit?.scope==='stage'?positionEdit.stages[positionEdit.stageIndex]:null;
    const positionScene=(root.CharDayCatalog||[]).find(s=>s.id===positionEdit?.scene);
    const positionView=positionEdit&&h("section",{"data-wk":"cdaypositionpage",className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:24}},
      h(Head,{zh:"换个地方",sub:char.remark||char.name,bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:closePosition}),
      menuBody(h(React.Fragment,null,
        h("p",{style:{fontSize:11,color:soft,margin:"0 0 6px"}},positionEdit.day+" · "+positionEdit.row.time+"—"+positionEdit.row.end),
        h("p",{style:{fontSize:14,lineHeight:1.8,margin:"0 0 6px"}},positionEdit.row.deviation?.actual||positionEdit.row.title),
        h("p",{style:{fontSize:12,color:soft,lineHeight:1.8,margin:"0 0 18px"}},positionStage?"只换小世界画面里这一步在哪儿，不改日历。":"只换小世界画面里这一段在哪儿，不改日历。"),
        positionEdit.stages.length>1&&menuSection("调整范围",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},...[["stage","只改一步"],["whole","整段日程"]].map(([scope,label])=>h("button",{key:scope,"data-wk":"cdaypositionscope","data-part":scope,"aria-pressed":positionEdit.scope===scope,disabled:positionBusy,style:{...btn,borderColor:positionEdit.scope===scope?"#8b9e7e":UI.line},onClick:()=>choosePositionTarget(scope)},label)))),
        positionStage&&menuSection("要改哪一步",h("select",{"data-wk":"cdaypositionstage","aria-label":"选择日程阶段",disabled:positionBusy,value:positionEdit.stageIndex,style:{...btn,width:"100%",height:44},onChange:e=>choosePositionTarget('stage',e.target.value)},...positionEdit.stages.map((stage,index)=>h("option",{key:index,value:index},stage.title)))),
        h("button",{"data-wk":"cdaypositionauto","aria-pressed":positionEdit.automatic,disabled:positionBusy,style:{...btn,width:"100%",textAlign:"left",marginBottom:20,borderColor:positionEdit.automatic?"#8b9e7e":UI.line},onClick:()=>setPositionEdit(v=>({...v,automatic:true}))},"按日程自动匹配",positionEdit.automatic?" · 已选":""),
        menuSection("场景",h("select",{"data-wk":"cdaypositionscene","aria-label":"场景",disabled:positionBusy,value:positionEdit.scene,style:{...btn,width:"100%",height:44},onChange:e=>{const scene=(root.CharDayCatalog||[]).find(s=>s.id===e.target.value);if(scene)setPositionEdit(v=>({...v,automatic:false,scene:scene.id,spot:scene.spots[0]?.id}));}},...(root.CharDayCatalog||[]).map(s=>h("option",{key:s.id,value:s.id},s.label)))),
        menuSection("具体位置",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}},...(positionScene?.spots||[]).map(p=>h("button",{key:p.id,"data-wk":"cdaypositionspot","data-part":p.id,"aria-pressed":!positionEdit.automatic&&positionEdit.spot===p.id,disabled:positionBusy,style:{...btn,textAlign:"left",borderColor:!positionEdit.automatic&&positionEdit.spot===p.id?"#8b9e7e":UI.line},onClick:()=>setPositionEdit(v=>({...v,automatic:false,spot:p.id}))},p.label,!positionEdit.automatic&&positionEdit.spot===p.id?" · 已选":"")))),
        positionNotice&&h("p",{role:"status",style:{fontSize:12,color:soft,lineHeight:1.8}},positionNotice))),
      h("div",{className:"shrink-0",style:footerStyle},h("button",{"data-wk":"cdaypositionsave",disabled:positionBusy,style:{...btn,width:"100%"},onClick:savePosition},positionBusy?"保存中…":"保存位置")));
    return outer(h(React.Fragment, null, h("div",{className:"flex-1 min-h-0 flex flex-col","aria-hidden":controlsOpen||undefined,inert:controlsOpen?"":undefined},editor ? h(Head,{zh:decorPanel==="catalog"?"添家具":decorPanel==="piece"?"家具与墙饰":decorPanel==="room"?"房间与墙地面":"布置小家",sub:char.remark||char.name,bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:decorPanel?closeDecorPanel:cancelEditor,right:h("button",{"data-wk":"cdaysavelayout",disabled:layoutBusy||editor.dragging||editor.busy,style:{...btn,border:0,background:"transparent"},onClick:saveLayout},layoutBusy?"保存中":"保存")}) : head(() => pick(""), h("button", { style: { ...btn, border: 0, background: "transparent" }, onClick: () => pick("") }, "换人")),
      h("div", { "data-wk": "cdayscene", className: "flex-1 min-h-0 relative", style: { overflow: "hidden" } },
        h("iframe", { key: char.id + ":" + retry, ref: bindScene, title: "TA的一天场景", "aria-hidden":!!decorPanel, src: "apps/fairy-garden/day/index.html?v=" + props.build,
          onLoad: send, style: { width: "100%", height: "100%", border: 0, display: "block", pointerEvents:layoutBusy?"none":"auto" } }),
        editor ? h("div",{"data-wk":"cdayeditnote",role:"status",style:{display:decorPanel?"none":"block",position:"absolute",top:66,left:12,right:12,padding:"10px 12px",borderRadius:12,background:"rgba(250,247,236,.94)",fontSize:12,lineHeight:1.7,pointerEvents:"none"}},layoutNotice||"拖家具摆放，拖空白旋转 · 双指移动／缩放",h("div",{style:{fontSize:11,color:soft}},"床椅收起后会换可用同类，没有同类就先休息。")) : (nowMode==="line"&&!showcase&&!trip ? h("button",{"aria-label":"展开此刻卡片",onClick:()=>setNowMode("short"),style:{position:"absolute",top:6,left:"50%",transform:"translateX(-50%)",width:120,height:28,padding:0,border:0,background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"auto",visibility:mePanel||kitchenTool?"hidden":"visible"}},h("span",{style:{display:"block",width:56,height:4,borderRadius:2,background:"rgba(110,125,95,.55)",boxShadow:"0 1px 3px #3c483022"}})) : h("div", { "data-wk": "cdaynow", style: { visibility:mePanel||kitchenTool?"hidden":"visible",position: "absolute", top: 12, left: 12, right: 12, maxWidth:480, padding: "13px 15px", borderRadius: "6px 18px 18px 18px", border:"1px solid #ffffffe0",background: "rgba(252,253,245,.94)", boxShadow: "0 4px 16px #3c483015",borderLeft:"3px solid #9eae88", pointerEvents: "none" } },
          h("div", { style: {display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,fontSize:11,color:UI.accent,fontWeight:500} },h("span",null,trip ? "自由逛 · "+outingPlace.label : showcase ? "逛逛场景 · "+(room?.label||"正在准备房间") : demo ? "示例试玩 · " + slot.time : preview ? "预览日程 · " + slot.time + "—" + slot.end : "此刻 · TA当地 " + state.time),!trip&&!demo&&!showcase&&slot?.seq!=null&&props.onEditSchedSeq&&h("button",{"data-wk":"cdaypositionopen",style:{...btn,pointerEvents:"auto",padding:"5px 9px",background:"transparent",border:0,flexShrink:0,display:"inline-flex",flexDirection:"row",alignItems:"center",gap:3,whiteSpace:"nowrap"},onClick:()=>openPosition(slot,slot.sourceDay||state.sourceDay||state.day,stageIndex)},h(IPencil,{size:14,color:soft}),visual.stages.length?" 换这一步的地方":" 换地方"),!showcase&&!trip&&h("button",{"aria-expanded":nowOpen,"aria-label":nowOpen?"收起此刻详情":"展开此刻详情",onClick:()=>setNowMode(nowOpen?"short":"open"),style:{...btn,pointerEvents:"auto",padding:"5px 8px",background:"transparent",border:0,flexShrink:0,color:soft,fontSize:11,whiteSpace:"nowrap"}},nowOpen?"简略":"详情"),!showcase&&!trip&&h("button",{"aria-label":"收成一条线","title":"收成一条线",onClick:()=>setNowMode("line"),style:{...btn,pointerEvents:"auto",padding:"5px 8px",background:"transparent",border:0,flexShrink:0,color:soft,fontSize:11,whiteSpace:"nowrap"}},"收起")),
          h("div", { style: { fontSize: "calc(14px * var(--app-fs, 1))",fontWeight:500, lineHeight: 1.7, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } }, trip ? (trip.mode==='solo'?'你自己逛逛':'和TA一起逛逛') : showcase ? (spot ? spot.number+" · "+spot.label : "入口") : title),
          !demo && !preview && !showcase && !trip && !state?.hasPlan && h("button", { onClick: () => props.onSchedule?.(char), style: { ...btn, width: "100%", marginTop: 6, pointerEvents: "auto" } }, "去日历给TA排今天"),
          (nowOpen||showcase||trip) && !showcase && !trip && !!sceneNear && !!(state.slot || sceneNear.prev || sceneNear.next) && h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, color: soft, marginTop: 3 } }, [!!state.slot && spanText(sceneNear.elapsed), !!sceneNear.prev && "刚才 · " + sceneNear.prev.title, sceneNear.next && "接下来 " + sceneNear.next.time + " · " + sceneNear.next.title].filter(Boolean).map((line, i) => h("div", { key: i, style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, line))),
          (nowOpen||showcase||trip) && !showcase && !trip && !!sceneNear && (dayLine(state, { accent: UI.accent }) || false),
          showcase && spot && h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, color: soft, marginTop: 3 } }, spot.description),
          trip && h('div',{"data-wk":"cdayoutingplan",style:{fontSize:11,lineHeight:1.6,color:soft,marginTop:3,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}},'TA的原安排 · '+state.time+' · '+title),
          (nowOpen||showcase||trip) && !kitchenOnScene && !trip && !showcase && (stagePlace || visual.presentation.stageLabel) && h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", lineHeight: 1.6, color: soft, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, (stagePlace || "此刻") + (!preview && !demo && activityStatus?.charId===payload.charId && activityStatus?.key===payload.key && activityStatus.label ? (activityStatus.groupLabel?" · "+activityStatus.groupLabel:"")+" · "+activityStatus.label+(activityStatus.spotLabel?" · "+activityStatus.spotLabel:"") : "")),
          (nowOpen||showcase||trip) && !trip&&!showcase&&visual.presentation.stageCount>1&&h("div",{"data-wk":"cdayphase",style:{fontSize:11,color:soft,lineHeight:1.6,marginTop:5,borderTop:"1px solid "+UI.line,paddingTop:5}},h("div",{style:{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},"正在 · "+(activeStage?.title||visual.presentation.stageLabel)),h("div",{style:{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},nextStage?"接下来 · "+nextStage.title:"本段最后一步")),
          (nowOpen||showcase||trip) && !demo&&!preview&&!showcase&&state.virtual&&h("div",{"data-wk":"cdayclocknote",style:{fontSize:11,color:soft,marginTop:3}},state.followVirtual?"活动跟角色钟"+(state.paused?" · 已暂停":""):"活动按现实时间 · "+clockText(root.ScheduleClock.localMinute(char,now))),
          (nowOpen||showcase||trip) && !trip&&!showcase&&manualPoint&&h("div",{style:{fontSize:11,color:soft,marginTop:3}},(activeStage?"这一步已指定位置":"位置已手动指定")+" · "+(root.CharDayCatalog||[]).find(s=>s.id===manualPoint.scene)?.label+" · "+((root.CharDayCatalog||[]).find(s=>s.id===manualPoint.scene)?.spots.find(p=>p.id===manualPoint.spot)?.label||"")),
          (thoughtPrefs.enabled===true||thought.cache||thought.unsaved||thought.busy)&&thoughtFrame&&!chatOpen&&h("div",{"data-wk":"cdaythought",style:{borderTop:"1px solid "+UI.line,marginTop:8,paddingTop:5,pointerEvents:"auto"}},
            h("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}},h("span",{style:{fontSize:11,color:UI.accent}},"此刻的念头"+(thought.cache?" · "+thought.cache.time:"")),h("button",{"data-wk":"cdaythoughtrefresh","aria-label":thought.unsaved?"保存这句念头":"换一个此刻念头",disabled:thought.busy,style:{...btn,minWidth:44,minHeight:44,padding:"4px 7px",border:0,background:"transparent",boxShadow:"none",fontSize:11,color:soft},onClick:thought.refresh},thought.busy?"想一会儿…":thought.unsaved?"保存这句":"换一个")),
            h("div",{"data-wk":"cdaythoughttext",role:"status",style:{fontSize:12,lineHeight:1.8,maxHeight:nowOpen?78:44,overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch",whiteSpace:"pre-wrap"}},thought.unsaved||thought.cache?.text||(thought.busy?"这一刻，TA在想什么…":thought.error?"这次没能生成念头。":"还没有这一刻的念头，点“换一个”看看。")),
            thought.error&&h("div",{role:"status",style:{fontSize:11,color:"#9b674d",marginTop:3}},thought.unsaved?"念头已生成，还没保存成功，点“保存这句”重试。":"没能更新，点“换一个”重试。")),
          // The thought switch sits on the card itself; it still uses the chat model at most once per interval.
          !demo&&!preview&&!showcase&&!trip&&thoughtPrefs.enabled!==true&&!thought.cache&&!thought.unsaved&&!thought.busy&&!!thoughtFrame&&!chatOpen&&!!props.generateThought&&h("div",{style:{borderTop:"1px solid "+UI.line,marginTop:8,paddingTop:5,pointerEvents:"auto"}},h("button",{"aria-label":"看看"+(char.remark||char.name)+"此刻在想什么",disabled:thought.saving||thought.busy,onClick:()=>thought.once(),style:{...btn,width:"100%",minHeight:44,padding:"4px 10px",background:"transparent",borderStyle:"dashed",fontSize:12}},"看看TA在想什么"),h("div",{style:{fontSize:10,color:soft,marginTop:2}},"只想这一次，不会自己接着想；想让TA隔一阵自己想，去「更多 → 此刻的念头」打开"),thought.saveError&&h("div",{role:"status",style:{fontSize:11,color:"#9b674d"}},thought.saveError)),
          !trip && !showcase && slot?.deviation && h("div", { style: { fontSize: "calc(11px * var(--app-fs, 1))", color: "#9b674d", marginTop: 3 } }, "安排临时改了"),
          !kitchenOnScene&&payload.kitchenCarry?.length>0&&h("div",{"data-wk":"cdaykitchencarry",style:{fontSize:11,color:soft,marginTop:3}},"给TA装好了便当："+payload.kitchenCarry.map(L.dishName).join("、")),
          !kitchenOnScene&&pendingJob&&h("div",{"data-wk":"cdaykitchenprogress",style:{fontSize:11,color:soft,marginTop:3}},L.recipe(pendingJob.recipeId)?.name+" · "+(pendingJob.ready?"做好了，到小家厨房收好":kitchenStatus?.label||({paused:"这份先放着，去厨房继续",preparing:"一起备菜",stirring:"锅边搅拌",serving:"准备盛出来",eating:"一起吃饭",ready:"做好了，到厨房收好"})[kitchenStatus?.phase]||"去厨房继续")),
          !kitchenOnScene&&!demo&&!preview&&!showcase&&visitStatus?.charId===String(char.id)&&(visitStatus.notice||visitStatus.saveNotice||visitStatus.homeSaveNotice)&&h("div",{"data-wk":"cdayvisitnote",role:"status",style:{fontSize:11,color:soft,lineHeight:1.6,marginTop:3}},[visitStatus.notice,visitStatus.saveNotice,visitStatus.homeSaveNotice].filter(Boolean).join(" · ")))),
        sceneStatus && h("div", { role: "status", style: { position: "absolute", top: "48%", left: 16, right: 16, textAlign: "center", padding: 16, background: "#eeeadfe8", borderRadius: 12, fontSize: "calc(12px * var(--app-fs, 1))" } }, sceneStatus,
          sceneStatus.includes("失败") && h("button", { style: { ...btn, display: "block", margin: "12px auto 0" }, onClick: () => { setSceneStatus("正在准备画面…");setVisitStatus(null); setRetry(x => x + 1); } }, "重新载入画面")),
        editor&&!decorPanel&&h("div",{"data-wk":"cdaydecoractions",style:{position:"absolute",top:12,left:12,right:12,display:"flex",gap:6}},...[["catalog","添家具"],["piece","单件搭配"],["room","房间墙地"]].map(([key,label])=>h("button",{key,"data-part":key,style:{...btn,flex:1},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>openDecorPanel(key)},label))),
        decorContents,
        editor&&!decorPanel && h("select",{"data-wk":"cdayfurniture","aria-label":"选择家具",disabled:layoutBusy||editor.dragging||editor.busy,value:editor.selected,onChange:e=>iframe.current?.contentWindow?.CharDayScene?.selectFurniture(e.target.value),style:{...btn,position:"absolute",left:12,right:12,bottom:12,width:"calc(100% - 24px)",height:44,fontSize:13}},h("option",{value:""},"选择家具"),...furniture.map(p=>h("option",{key:p.id,value:p.id},p.label+(p.stored?" · 已收纳":"")))),
        kitchenTool&&kitchenOnScene&&h(root.CharDayKitchenGuide,{job:pendingJob,status:kitchenStatus,station:kitchenTool,input:kitchenInput,notice:lifeNotice,busy:lifeBusy}),
        !kitchenTool&&kitchenOnScene&&h(root.CharDayKitchenHUD,{job:{...pendingJob,cooking:pendingJob.cooking&&{...pendingJob.cooking,mode:kitchenStatus?.mode||pendingJob.cooking.mode,lead:kitchenStatus?.lead||pendingJob.cooking.lead}},status:kitchenStatus,busy:lifeBusy,input:kitchenInput,action:kitchenAction,notice:lifeNotice,preferences:kitchen.preferences,persona:char?.persona||'',resume:runKitchen,share:shareKitchenMeal,finish:()=>kitchenAction({kind:'finish',id:pendingJob.id,at:Date.now()}),plate:()=>kitchenAction({kind:'plate',id:pendingJob.id,mealId:uniqueId(),at:Date.now()})}),
        !editor && !kitchenTool && h("div", { style: { position: "absolute", bottom: 8, left: 10, right: 10, textAlign: "center", fontSize: "calc(10px * var(--app-fs, 1))", color: "#655e50", pointerEvents: "none", textShadow:"0 1px 3px #fff" } }, visiting ? "点空地走过去 · 单指旋转，双指移动／缩放" : "单指旋转 · 双指移动／缩放")),
      !editor&&showcase&&room&&h("div",{className:"shrink-0",style:{padding:"6px 12px",background:paper,borderTop:"1px solid "+UI.line}},h("select",{"data-wk":"cdayplacepoint","aria-label":"选择动作位置",value:spot?.id||"",onChange:e=>setSpotId(e.target.value),style:{...btn,width:"100%",height:44,fontSize:13}},...room.spots.map(s=>h("option",{key:s.id,value:s.id},s.number+" · "+s.label)))),
      kitchenTool?h("div",{"data-wk":"cdaycuttools",className:"shrink-0",style:{...footerStyle,display:"flex",gap:6}},h("button",{"data-wk":"cdaycutback",style:{...btn,flex:1,padding:"8px 6px"},onClick:()=>kitchenInput({kind:"station",value:""})},"回台面"),h("select",{"data-wk":"cdaykitchentoolselect","aria-label":"换厨房道具",value:kitchenTool,style:{...btn,flex:1,minWidth:0,height:44,padding:"6px 24px 6px 8px"},onChange:e=>kitchenInput(e.target.value.startsWith('together:')?{kind:'moment',value:e.target.value.slice(9)}:{kind:'station',value:e.target.value})},h('optgroup',{label:'操作道具'},...root.CharDayKitchen.cookingStations(pendingJob,kitchenStatus?.progress).map(q=>h('option',{key:q.id,value:q.id,disabled:q.disabled},q.label))),h('optgroup',{label:'一起做一小下'},...root.CharDayKitchen.cooperation(pendingJob,kitchenStatus?.progress).map(q=>h('option',{key:q.id,value:'together:'+q.id,disabled:q.disabled},q.label)))),kitchenTool==='board'&&h("button",{"data-wk":"cdaycutpan",style:{...btn,flex:1,padding:"8px 6px"},onClick:()=>kitchenInput({kind:"board-pan"})},"这些下锅")):editor ? h("div",{"data-wk":"cdayedittools",className:"shrink-0",style:{...footerStyle,display:"flex",gap:4}},
        decorPanel?h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor?.busy,onClick:closeDecorPanel},"回去摆放"):h(React.Fragment,null,
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy||!chosen||chosen.stored,onClick:()=>editorAction("rotate")},chosen?.mount?"换墙":"旋转"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy||!chosen,onClick:()=>editorAction(chosen?.stored?"restore":"store")},chosen?.stored?"摆回":"收纳"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>editorAction("undo")},"撤销"),
        h("button",{style:{...btn,flex:1,border:0,background:"transparent"},disabled:layoutBusy||editor.dragging||editor.busy,onClick:()=>iframe.current?.contentWindow?.CharDayScene?.overview()},"全景"))) : h("div", { "data-wk": "cdaytools", className: "shrink-0", style:{...footerStyle,display:"flex",gap:4} },
        showcase?navButton({"data-wk":"cdayreturn"},"回到日程",IArrow,()=>{setShowcase("");setSpotId("");setFollow(true);}):demo?navButton({"data-wk":"cdaynext"},"下一段",IRepeat,()=>setDemoIndex(i=>(i+1)%DEMO_ROWS.length)):props.renderChat&&navButton({"data-wk":"cdaychatopen"},"聊聊",GMsg,()=>{setChatMounted(true);setChatOpen(v=>!v);props.onChatOpen?.(char);},{"aria-pressed":chatOpen}),
        showcase?navButton({"data-wk":"cdaynextplace"},"换场景",IRepeat,()=>{const next=places[(places.findIndex(p=>p.id===showcase)+1)%places.length];if(next){setShowcase(next.id);setSpotId("");setFollow(false);}}):// One name for the middle key; what it does right now sits in the small line under it.
          visiting?navButton({"data-wk":"cdaylifeopen",sub:trip?.mode==='solo'?"自己逛着":socialSetting?.home?"在家里":"约会中"},"一起",IHome,()=>setTogetherPanel(true),{"data-action":"together","aria-label":"一起："+(trip?.mode==='solo'?"自己逛着":socialSetting?.home?"在家里":"约会中")}):canVisit?navButton({"data-wk":"cdayvisitopen",sub:visitStatus?.busy?"准备中…":socialSetting?.home?"回小家":"走进去"},"一起",IHome,joinVisit,{disabled:visitStatus?.busy,"aria-label":"一起："+(socialSetting?.home?"回小家":"走进去")}):navButton({"data-wk":"cdayfollow",sub:"TA在忙，先看着"},"一起",ICamera,()=>camera(false),{"aria-pressed":follow,"aria-label":"一起：TA在忙，先看着"}),
        trip?navButton({"data-wk":"cdayoutingreturn"},"回到TA",IArrow,returnToTA):preview?navButton({"data-wk":"cdayreturn"},"回到此刻",IArrow,()=>setPreview(null)):navButton({"data-wk":"cdayscheduleopen"},"日程",GDiary,()=>setBook(true),{"aria-label":"今天的日程"}),
        navButton({"data-wk":"cdaymoreopen"},"更多",IDots,()=>setMoreOpen(true),{"aria-expanded":moreOpen}))),
      styleView,bookView,positionView,
      moreOpen&&!homeOptions&&!book&&!mePanel&&!professionalPanel&&!lifePage&&!outingPicker&&h("section",{"data-wk":"cdaymore",className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:18}},h(Head,{zh:"更多",sub:char.remark||char.name,bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>setMoreOpen(false)}),menuBody(h(React.Fragment,null,
        !demo&&menuSection("一起做点什么",h(React.Fragment,null,
          trip&&menuRow({"data-wk":"cdayoutingreturn"},"回到TA","继续看TA此刻的安排",returnToTA,IArrow),
          trip&&menuRow({"data-wk":"cdayscheduleopen"},"今天的日程","看看TA原本的安排",()=>setBook(true),GDiary),
          !demo&&menuRow({"data-wk":"cdayoutingsopen"},"去逛逛","自己出门，或主动邀请TA同行",openOutings,GWalk),
          !demo&&menuRow({},"今天的小相册","把今天去过的地方各拍一张，串成一页",()=>{setMoreOpen(false);setAlbumNotice('');setAlbumDay(null);setAlbumOpen(true);},ICamera),
          !demo&&menuRow({"data-wk":"cdaykitchenopen"},"小家厨房","食材、一起做饭和两人份餐盒",()=>openLifePage('kitchen'),GMeal),
          !demo&&menuRow({"data-wk":"cdayalbumopen"},"同框相册","你和TA一起时拍下的同框照",()=>openLifePage('album'),ICamera))),
        menuSection("看看四周",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[["ta","跟着TA"],["me","跟着我"],["both","看两个人"],["overview","看全景"]].map(([mode,label])=>h("button",{key:label,"data-wk":"cdaycamera","data-part":mode,"aria-pressed":cameraMode===mode,disabled:((mode==="me"||mode==="both")&&!visiting)||(trip?.mode==='solo'&&mode!=='me'&&mode!=='overview'),style:{...btn,display:"flex",alignItems:"center",justifyContent:"flex-start",gap:10,background:cameraMode===mode?"#eaf0e2":"#fffdf7",borderColor:cameraMode===mode?"#8b9e7e":UI.line,boxShadow:cameraMode===mode?"inset 0 -3px #9caa90":btn.boxShadow,fontWeight:cameraMode===mode?600:400,opacity:((mode==="me"||mode==="both")&&!visiting)||(trip?.mode==='solo'&&mode!=='me'&&mode!=='overview')?.45:1},onClick:()=>camera(mode)},h(mode==="both"?GUs:mode==="me"?GUser:ICamera,{size:20,color:UI.accent}),label,cameraMode===mode&&h(ICheck,{size:14,color:UI.accent}))))),
        menuSection("你们的小家",h(React.Fragment,null,
          !demo&&!showcase&&menuRow({"data-wk":"cdaymeopen"},"我的样貌","头发、衣服和身形",openMe,GUser),
          !demo&&!!props.onEditLook&&menuRow({},"TA的样貌","在「陪伴」里改，和陪伴的小人同步",()=>{setMoreOpen(false);props.onEditLook(char);},GUser),
          !demo&&menuRow({"data-wk":"cdaypreferencesopen"},"装修灵感","参考TA的偏好，也能写自己的想法",()=>openLifePage('preferences'),IPencil),
          menuRow({"data-wk":"cdayhomestyle"},"小家样式","房间配色与两人的动作习惯",()=>{setBook(false);setHomeOptions(true);},IHome),
          menuRow({"data-wk":"cdaydecorate"},"布置小家","添家具、挪位置、搭配墙面和地板",startEditor,IPencil))),
        !demo&&menuSection("此刻的念头",h("div",null,
          h("p",{style:{fontSize:12,color:soft,lineHeight:1.8,marginTop:0}},"在日程下看看TA这一瞬间的心里话。只为当前角色开启，记住选择；仅在看TA时低频更新，也可手动换一句。"),
          h("button",{"data-wk":"cdaythoughtswitch",role:"switch","aria-checked":thoughtPrefs.enabled===true,"aria-label":"开启"+(char.remark||char.name)+"的此刻念头",disabled:thought.saving,style:{...btn,width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:thoughtPrefs.enabled?"#eaf0e2":"#fffdf7",borderColor:thoughtPrefs.enabled?"#8b9e7e":UI.line},onClick:()=>thought.setEnabled(thoughtPrefs.enabled!==true)},h("span",null,"日程下显示念头"),h("span",{style:{color:UI.accent}},thought.saving?"保存中…":thoughtPrefs.enabled?"已开启":"未开启")),
          h("p",{style:{fontSize:11,color:soft,lineHeight:1.7,marginBottom:0}},"开启后会使用聊天模型生成；只保存在小世界，不写进聊天、日历或记忆。"),
          thought.saveError&&h("p",{role:"status",style:{fontSize:12,color:"#9b674d"}},thought.saveError))),
        !demo&&menuSection("活动时间",h("div",{"data-wk":"cdayclock"},h("p",{style:{fontSize:12,lineHeight:1.8,color:soft,marginTop:0}},"开启角色钟后，选择TA的活动怎么推进。日历仍按原日保存。"),h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[["auto","按TA的时间走"],["real","按现实时间走"]].map(([mode,label])=>h("button",{key:mode,"data-wk":"cdayclockmode","data-part":mode,"aria-pressed":clockMode===mode,disabled:clockBusy,style:{...btn,fontWeight:clockMode===mode?600:400,background:clockMode===mode?"#eaf0e2":"#fffdf7",borderColor:clockMode===mode?"#8b9e7e":UI.line},onClick:()=>changeClock(mode)},label))),clockNotice&&h("p",{role:"status",style:{fontSize:12,color:"#9b674d",lineHeight:1.6}},clockNotice))),
        menuSection("更多设置",h(React.Fragment,null,
          Object.keys(professionalChoices).length>0&&menuRow({"data-wk":"cdayprofessionalopen"},"工作场景布置","每位角色的职业空间、陈设与配色",()=>{setProfessionalScene(Object.hasOwn(professionalChoices,payload.presentation.map)?payload.presentation.map:professionalScene);setProfessionalPanel(true);},GConfig),
          menuRow({"data-wk":"cdayplaces"},"逛逛所有场景","看看每个地方TA会在哪儿做什么",visitPlaces,ICamera))))),
        h("div",{className:"shrink-0",style:{...footerStyle,paddingLeft:16,paddingRight:16}},h("button",{style:{...btn,width:"100%",border:0,background:"transparent"},onClick:()=>setMoreOpen(false)},"回到小世界"))),
      // 今天的小相册：整页（no-half-sheet）；拍摄时整页让开，场景照常动，底部一条小字可停
      !!albumShoot&&h("button",{onClick:()=>{const done=albumShoot;setAlbumShoot(null);setPreview(null);if(done.photos.length)saveAlbum(char.id,done.day,cur=>({...(done.replace?{}:cur||{}),photos:done.replace?done.photos:mergePhotos(cur?.photos,done.photos),at:Date.now()})).then(()=>setAlbumTick(t=>t+1)).catch(()=>setAlbumNotice('照片没能存下，可以再拍一次。'));setAlbumOpen(true);},style:{...btn,position:"absolute",left:12,right:12,bottom:12,margin:"0 auto",maxWidth:320,zIndex:19,minHeight:44,padding:"6px 14px",borderRadius:999,background:"rgba(252,253,245,.95)",fontSize:12}},(albumShoot.auto?"补拍没看到的几段 ":"拍小相册 ")+Math.min(albumShoot.index+1,albumShoot.rows.length)+"/"+albumShoot.rows.length+" · 点这里停"),
      albumOpen&&!albumShoot&&(()=>{
        const mine=albumTick>=0?loadAlbums()[String(char.id)]||{}:{},today=state?.day,viewDay=albumDay&&mine[albumDay]?albumDay:today,isToday=viewDay===today;
        const album=mine[viewDay],rows=isToday?albumRows(state):[],photos=album?.photos||[];
        const days=[...new Set([today,...Object.keys(mine).filter(d=>mine[d]?.photos?.length)])].sort().reverse();
        // Past days as small stacks of prints: the top one is that day's first photo, the pressed stack lifts and takes ink.
        const stacks=days.length>1&&h("div",{style:{display:"flex",gap:6,overflowX:"auto",padding:"4px 2px 12px",margin:"0 -4px 6px",WebkitOverflowScrolling:"touch"}},...days.map(d=>{
          const list=mine[d]?.photos||[],on=d===viewDay,cover=albumImg(list[0]?.src),label=d===today?"今天":Number(d.slice(5,7))+"/"+Number(d.slice(8,10));
          return h("button",{key:d,"aria-pressed":on,"aria-label":label+"的小相册",onClick:()=>{setAlbumDay(d===today?null:d);setAlbumNotice('');},style:{...btn,flexShrink:0,minWidth:76,minHeight:44,display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 4px",background:"transparent",border:0,boxShadow:"none",opacity:on?1:.6,transform:on?"translateY(-3px)":"none"}},
            h("span",{style:{position:"relative",display:"block",width:60,height:46}},
              ...(list.length>1?[[-7,-3],[5,3]].map(([deg,dx],k)=>h("span",{key:k,style:{position:"absolute",inset:0,background:"#fffdf7",border:"1px solid "+UI.line,borderRadius:4,transform:"rotate("+deg+"deg) translateX("+dx+"px)",boxShadow:"0 1px 3px #0001"}})):[]),
              h("span",{style:{position:"absolute",inset:0,padding:3,background:"#fffdf7",border:"1px solid "+(on?UI.accent:UI.line),borderRadius:4,boxShadow:on?"0 4px 10px #3c483026":"0 1px 3px #0001"}},cover?h("img",{src:cover,alt:"",style:{display:"block",width:"100%",height:"100%",objectFit:"cover",borderRadius:2}}):h("span",{style:{display:"block",width:"100%",height:"100%",borderRadius:2,background:"#eef0e6"}}))),
            h("span",{style:{fontSize:11,marginTop:7,color:on?UI.accent:soft,fontWeight:on?600:400}},label),
            h("span",{style:{fontSize:10,color:soft}},list.length+" 张"));
        }));
        const shoot=()=>{if(!rows.length){setAlbumNotice('今天还没有能拍的安排。');return;}setAlbumNotice('');setAlbumOpen(false);setOuting(null);setShowcase('');setBook(false);setAlbumShoot({day:state.day,rows,index:0,photos:[],replace:true});};
        const think=async()=>{
          if(albumBusy||!photos.length||!props.generateDiary)return;setAlbumBusy(true);setAlbumNotice('');
          try{
            const value=await props.generateDiary(char,photos,props.thoughtContextFor?.(char)||{});
            const list=Array.isArray(value?.thoughts)?value.thoughts.map(x=>String(x||"").trim()):[];
            if(list.length!==photos.length||list.some(x=>!x))throw Error('这次念头没对上照片张数，可以再试。他这回写的是：'+String(JSON.stringify(value)||'').slice(0,160));
            await saveAlbum(char.id,viewDay,cur=>({...(cur||{}),photos:(cur?.photos||photos).map(p=>{const i=photos.findIndex(x=>x.time===p.time);return i>=0?{...p,thought:list[i]||p.thought||""}:p;}),thoughtAt:Date.now()}));setAlbumTick(t=>t+1);
          }catch(e){setAlbumNotice(e.message==='save'?'念头生成了但没能存下，可以再试。':e.message||'没能生成，可以再试。');}
          finally{setAlbumBusy(false);}
        };
        return h("section",{className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:18}},
          h(Head,{zh:"今天的小相册",sub:(char.remark||char.name)+" · "+(viewDay||""),bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>setAlbumOpen(false)}),
          h("div",{className:"flex-1 min-h-0 overflow-y-auto",style:{padding:"16px 16px 24px"}},
            stacks||false,
            !photos.length&&h("p",{style:{fontSize:13,lineHeight:1.9,color:soft,marginTop:0}},albumAuto?"每天自动存：你看着TA的时候，每到一段新安排就存一张；没看到的几段，打开这一页时会自动补拍。只拍TA自己，存在这台手机上，每位角色留最近七天，拍照不调模型。":"自动存已关。点下面「拍今天」，把今天到现在的每一段各拍一张（最多六张）。"),
            photos.length>0&&h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...photos.map((ph,i)=>h("figure",{key:i,style:{margin:0,background:"#fffdf7",border:"1px solid "+UI.line,borderRadius:12,overflow:"hidden"}},
              h("img",{src:albumImg(ph.src),alt:ph.title,style:{display:"block",width:"100%",aspectRatio:"4 / 3",objectFit:"cover",background:"#eef0e6"}}),
              h("figcaption",{style:{padding:"7px 9px 9px"}},
                h("div",{style:{fontSize:11,color:UI.accent}},ph.time+(ph.location||ph.place?" · "+(ph.location||ph.place):"")),
                h("div",{style:{fontSize:12.5,lineHeight:1.6,marginTop:2,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}},ph.title),
                (ph.thought||album?.thoughts?.[i])?h("div",{style:{fontSize:12,lineHeight:1.7,color:soft,marginTop:4}},"「"+(ph.thought||album.thoughts[i])+"」"):false)))),
            albumNotice?h("p",{role:"status",style:{fontSize:12,color:"#9b674d",lineHeight:1.7}},albumNotice):false,
            photos.length>0&&!!props.generateDiary&&h("button",{disabled:albumBusy,onClick:think,style:{...btn,width:"100%",marginTop:14}},albumBusy?"正在想每一张…":photos.some(p=>p.thought)?"重新配每张的念头 · 用聊天模型，一次":"看看每张当时在想什么 · 用聊天模型，一次"),
            isToday&&h("button",{role:"switch","aria-checked":albumAuto,onClick:()=>saveHomeChange(char.id,"albumAuto",!albumAuto).then(setHomes).catch(()=>setAlbumNotice("开关没存上，可以再点一次。")),style:{...btn,width:"100%",marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}},h("span",null,"每天自动存"),h("span",{style:{color:albumAuto?UI.accent:soft}},albumAuto?"开":"关")),
            isToday&&h("button",{disabled:albumBusy||!rows.length,onClick:shoot,style:{...btn,width:"100%",marginTop:10,background:photos.length?"transparent":btn.background}},photos.length?"重新拍今天":"拍今天")));
      })(),
      outingPicker&&h("section",{"data-wk":"cdayoutings",className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:22}},h(Head,{zh:"去逛逛",sub:char.remark||char.name,bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>setOutingPicker(false)}),menuBody(h(React.Fragment,null,
        h("p",{style:{fontSize:12,lineHeight:1.8,color:soft,marginTop:0}},"不用等日程排到这里，选个地点出门逛逛。逛完点“回到TA”，继续看当时的安排。"),
        menuSection("和谁去",h("div",{"data-wk":"cdayoutingmode",role:"radiogroup","aria-label":"和谁去",className:"cday-grid"},...[["solo","自己逛","随心走走",GUser],["together","邀请TA","一起出门",GUs]].map(([mode,label,note,Icon])=>h("button",{key:mode,"data-wk":"cdayoutingchoice","data-part":mode,role:"radio",tabIndex:outingMode===mode?0:-1,"aria-label":mode==='solo'?'自己逛':'邀请TA同行',"aria-checked":outingMode===mode,className:"cday-choice",style:{...btn,background:outingMode===mode?"#eaf0e2":btn.backgroundColor,borderColor:outingMode===mode?"#8b9e7e":UI.line,boxShadow:outingMode===mode?"inset 0 -3px #9caa90":btn.boxShadow},onClick:()=>setOutingMode(mode),onKeyDown:e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const next=mode==='solo'?'together':'solo';setOutingMode(next);e.currentTarget.parentElement.querySelector('[data-part="'+next+'"]').focus();}}},h(Icon,{size:22,color:UI.accent}),h("span",{style:{flex:1,minWidth:0}},h("span",{style:{display:"block",fontSize:14,fontWeight:500}},label),h("span",{style:{display:"block",fontSize:11,color:soft,marginTop:3}},note)),outingMode===mode&&h(ICheck,{size:13,color:UI.accent}))))),
        menuSection("选个地方出发",h("div",{className:"cday-grid"},...destinations.map((p,i)=>h("button",{key:p.id,"data-wk":"cdaydestination","data-part":p.id,"aria-label":p.label,"aria-current":trip?.map===p.id?'location':undefined,className:"cday-place",style:{...btn,borderColor:trip?.map===p.id?"#8b9e7e":UI.line},onClick:()=>goOuting(p.id)},iconTile(placeIcon(p.id),["#e8eddf","#f3e6d9","#e7edeb"][i%3]),h("span",{style:{fontSize:14,lineHeight:1.6,fontWeight:500}},p.label.split('／')[0]),h("span",{style:{fontSize:11,color:soft,lineHeight:1.6,marginTop:-7}},trip?.map===p.id?"正在这里":p.label.split('／')[1]||"去这里看看"),h(IChevR,{size:13,color:soft,style:{position:"absolute",right:12,top:23}}))))))),
        h("div",{className:"shrink-0",style:{...footerStyle,paddingLeft:16,paddingRight:16}},h("button",{style:{...btn,width:"100%",border:0,background:"transparent"},onClick:()=>setOutingPicker(false)},"回到小世界"))),
      professionalPanel&&h("section",{"data-wk":"cdayprofessional",className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:20}},h(Head,{zh:"场景摆件",sub:char.remark||char.name,bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>setProfessionalPanel(false)}),menuBody(h(React.Fragment,null,
        h("p",{style:{fontSize:12,lineHeight:1.8,color:soft}},"各地点分别记住这位角色的选择。自动参考明确人设，手动陈设和配色始终优先。"),
        h("label",{style:{display:"block",fontSize:13,marginBottom:18}},"先选地点",h("select",{"aria-label":"场景地点",value:professionalScene,style:{...btn,width:"100%",height:44,marginTop:8},onChange:e=>setProfessionalScene(e.target.value)},...Object.entries(professionalChoices).map(([id,p])=>h("option",{key:id,value:id},p.label)))),
        professionalChoices[professionalScene]&&h(React.Fragment,null,
          h("label",{style:{display:"block",fontSize:13,marginBottom:18}},"陈设",h("select",{"data-professional":professionalScene,"aria-label":"职业场景陈设",disabled:professionalBusy,value:payload.professional[professionalScene]?.[professionalChoices[professionalScene].field]||'auto',style:{...btn,width:"100%",height:44,marginTop:8},onChange:e=>changeProfessional(professionalChoices[professionalScene].field,e.target.value)},h("option",{value:"auto"},"自动参考人设"),...Object.entries(professionalChoices[professionalScene].values).map(([value,label])=>h("option",{key:value,value},label)))),
          h("label",{style:{display:"block",fontSize:13,marginBottom:18}},"配色",h("select",{"data-professional-style":professionalScene,"aria-label":"职业场景配色",disabled:professionalBusy,value:payload.professional[professionalScene]?.style||'auto',style:{...btn,width:"100%",height:44,marginTop:8},onChange:e=>changeProfessional('style',e.target.value)},h("option",{value:"auto"},"自动参考人设"),...Object.entries(professionalStyles).map(([value,label])=>h("option",{key:value,value},label))))),
        professionalNotice&&h("p",{role:"status",style:{fontSize:12,color:soft}},professionalNotice)))),

      togetherPanel&&visiting&&h("section",{"data-wk":"cdayinteraction",className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:20}},h(Head,{zh:socialSetting?.solo?"我的活动":"一起",sub:(char.remark||char.name)+(socialSetting?.solo?"":socialSetting?.home?" · 在家里":" · 约会中"),bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>setTogetherPanel(false)}),menuBody(h(React.Fragment,null,
        menuSection("我的活动",h(React.Fragment,null,h("p",{style:{fontSize:11,color:soft,lineHeight:1.8,margin:"0 0 10px"}},socialSetting?.solo?"点空地走过去，或选一个动作。想让小人自己活动，也可以选自动活动。":socialSetting?.home?"手动选择会一直优先；想让小人自己安排，再选自动活动。":"约会开启时会自动跟随TA；手动选择后，选自动跟随TA恢复同行。"),
          h("select",{"data-wk":"cdayvisitactivity","aria-label":socialSetting?.home?"你在小家做什么":"你在这里做什么",value:!socialSetting?.home&&(S.chores[visitChoice(visitStatus)]||root.CharDayHomeHobbies?.activities[visitChoice(visitStatus)])?"manual":visitChoice(visitStatus),style:{...btn,width:"100%",height:44},onChange:e=>visitAction(e.target.value)},h("option",{value:"auto"},(socialSetting?.home||socialSetting?.solo)?"自动活动":"自动跟随TA"),h("option",{value:"manual"},"手动控制 · 停下来"),...[["read","手动 · 看会书"],["drink","手动 · 喝口水"],["eat","手动 · 在餐桌吃点东西"],["rest","手动 · 坐着歇会"],...(socialSetting?.home?Object.entries(root.CharDayHomeHobbies?.activities||{}).map(([kind,p])=>{const unavailable=!(root.CharDayHomeHobbies.available(payload.homePlacements)||[]).includes(kind);return [kind,"手动 · "+p.label+(unavailable?"（先摆家具）":""),unavailable];}):[]),...(socialSetting?.home?Object.entries(S.chores).map(([kind,p])=>[kind,'手动 · '+p.label]):[])].map(([kind,label,disabled])=>h("option",{key:kind,value:kind,disabled:!!disabled},label))),
          h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:10}},...[...(socialSetting?.solo?[]:[["near","靠近TA"]]),[visitStatus.seated?"stand":"sit",visitStatus.seated?"起身":socialSetting?.solo?"找座位坐下":"坐旁边"]].map(([kind,label])=>actionButton({key:kind,"data-action":kind},kind,label,()=>visitAction(kind)))))),
        !trip&&menuSection("相处习惯",h(React.Fragment,null,...[["autoInteractions","自动小互动","只在两个人空闲、且我的活动为自动时发生"],["followDates","一起去下一站","约会地点改变时一起走到门口，工作地点会分开"]].map(([field,label,note])=>h('label',{key:field,style:{display:'block',marginBottom:14,fontSize:12,lineHeight:1.8}},label,h('select',{"data-wk":"cdaysocial",'data-part':field,'aria-label':label,disabled:socialBusy,value:payload.socialPreferences[field]===false?'off':'on',onChange:e=>changeSocial(field,e.target.value==='on'),style:{...btn,width:'100%',height:44,marginTop:6}},h('option',{value:'on'},'开启'),h('option',{value:'off'},'关闭')),h('p',{style:{fontSize:11,color:soft}},note))),socialNotice&&h('p',{role:'status',style:{fontSize:12}},socialNotice))),
        socialSetting?.actions.length>0&&menuSection(socialSetting?.home?"一起做什么":"这里可以一起做什么",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...(socialSetting?.actions||[]).filter(action=>!action.intimate).map(({kind,label})=>actionButton({key:kind,"data-action":kind},kind,label,()=>visitAction("together:"+kind))))),
        (socialSetting?.actions||[]).some(action=>action.intimate)&&menuSection("亲密互动",h(React.Fragment,null,h('label',{style:{display:'block',fontSize:12,marginBottom:12}},'这次谁先靠近',h('select',{"data-wk":"cdaypairwho",'aria-label':'这次谁先靠近',value:pairWho,onChange:e=>setPairWho(e.target.value),style:{...btn,width:'100%',height:44,marginTop:6}},h('option',{value:'me'},'我先靠近'),h('option',{value:'ta'},'TA先靠近'))),h('p',{style:{fontSize:11,color:soft,lineHeight:1.8,margin:'0 0 14px'}},'优先在当前座位或床边相处，身旁的人会自己靠过来。自动小互动开启时，TA也可能先发起；手动选择一直优先。'),...[['轻轻亲近',null],['坐着相处','sit'],['躺着相处','lie']].map(([label,posture])=>{const actions=(socialSetting?.actions||[]).filter(action=>action.intimate&&(S.rest?.[action.kind]?.posture||null)===posture);return actions.length?h('div',{key:label,style:{marginBottom:18}},h('p',{style:{fontSize:12,color:soft,margin:'0 0 8px'}},label),h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}},...actions.map(({kind,label})=>actionButton({key:kind,'data-action':kind},kind,label,()=>visitAction('together:'+kind,{initiator:pairWho==='ta'?'a':'b'}))))):null;}))),
        socialSetting?.home&&h(React.Fragment,null,...[["浴室",true],["家务",false]].map(([title,personal])=>menuSection(title,
          h(React.Fragment,null,
            h('label',{style:{display:'block',fontSize:12,marginBottom:10}},'这次谁来做',h('select',{...(personal?{"data-wk":"cdaybathwho"}:{"data-wk":"cdaychorewho"}),'aria-label':personal?'谁用浴室':'这次谁来做',value:choreWho,onChange:e=>setChoreWho(e.target.value),style:{...btn,width:'100%',height:44,marginTop:6}},h('option',{value:'me'},'我来做'),h('option',{value:'ta'},'TA来做'))),
            h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}},...Object.entries(S.chores).filter(([,p])=>!!p.personal===personal).map(([kind,p])=>actionButton({key:kind,...(personal?{"data-wk":"cdaybathaction"}:{"data-wk":"cdaychore"}),'data-part':kind},kind,p.label,()=>visitAction(choreWho==='ta'?'chore:ta:'+kind:kind))))
          )))),
        socialSetting?.home&&menuSection("小家的日常",h(React.Fragment,null,menuRow({"data-wk":"cdaykitchenopen"},"小家厨房",pendingJob?"手头有一份料理，去看看":"补食材、做好两人份、端上桌",()=>openLifePage('kitchen'),IHome),menuRow({"data-wk":"cdayalbumopen"},"同框相册","拍下你们此刻的样子",()=>openLifePage('album'),ICamera))),
        menuSection("结束与离开",h("div",{style:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}},...[["end","结束互动"],trip?["return","回到TA"]:["leave",socialSetting?.home?"先离开小家":"离开这里"]].map(([kind,label])=>actionButton({key:kind,"data-action":kind},kind,label,()=>kind==='return'?returnToTA():visitAction(kind))))),
        h("p",{style:{fontSize:11,color:soft,lineHeight:1.8}},trip?"这次自由逛由你选择活动，逛完点回到TA即可继续看当前安排。":socialSetting?.home?"TA在家时你默认也在。手动离开后会记住，想回来点回小家；活动仍由你选择。":"按地点选择约会动作，两个人先走到真实位置。自动模式会跟着TA走，点空地或选动作后由你手动控制；选自动跟随TA即可继续同行。"))),
        h("div",{className:"shrink-0",style:{...footerStyle,paddingLeft:16,paddingRight:16}},h("button",{style:{...btn,width:"100%",border:0,background:"transparent"},onClick:()=>setTogetherPanel(false)},"回到小世界"))),
      lifePage&&h("section",{"data-wk":"cdaylifepage","data-part":lifePage,className:"absolute inset-0 flex flex-col",style:{...UI.surface,zIndex:22,bottom:lifePage==='kitchen'&&kitchenView==='chat'?kbLift:0}},
        h(Head,{zh:lifePage==='album'?(photo?'这一刻':'同框相册'):lifePage==='kitchen'?'小家厨房':'装修灵感',sub:char.remark||char.name,bg:'transparent',ink,lineInk:UI.line,subInk:soft,onBack:()=>{if(lifeBusy)return;if(lifePage==='kitchen'&&kitchenRecipe){setKitchenRecipe('');setLifeNotice('');return;}if(photo){setPhotoId('');setLifeNotice('');}else{setLifePage('');if(!moreOpen&&visiting)setTogetherPanel(true);}}}),
        lifePage==='kitchen'&&kitchenView==='chat'&&!kitchenRecipe?h(React.Fragment,null,
          h('div',{className:'shrink-0',style:{padding:'8px 18px 0'}},h(root.CharDayKitchenTabs,{view:kitchenView,setView:setKitchenView,setDetail:setKitchenRecipe,busy:lifeBusy,btn})),
          h(root.CharDayKitchenChat.View,{key:String(char.id),character:char,profile:props.profile,apiFor:props.apiFor,active:props.active,homes,onHomes:setHomes,btn,ink,soft,footerStyle,interact:playKitchenMoment})):menuBody(h(React.Fragment,null,
          lifePage==='album'&&(photo?h(React.Fragment,null,
            h('img',{"data-wk":"cdayphoto",src:photo.src,alt:photo.taName+'和'+photo.meName+'在'+(photo.place||'小家')+'的同框',style:{display:'block',width:'100%',borderRadius:8}}),
            h('p',{style:{fontSize:12,lineHeight:1.9}},photo.day+' · TA当地 '+photo.time+(photo.place?' · '+photo.place:'')+'\n'+photo.taName+'和'+photo.meName+' · '+photo.activity),
            h('label',{style:{display:'block',fontSize:12}},'给这一刻留一句',h('textarea',{"data-wk":"cdayphotonote",maxLength:200,value:photoNote,disabled:lifeBusy,onChange:e=>setPhotoNote(e.target.value),style:{...btn,width:'100%',display:'block',marginTop:8,minHeight:84,resize:'vertical'}})),
            h('button',{"data-wk":"cdayphotonotesave",style:{...btn,width:'100%',marginTop:10},disabled:lifeBusy,onClick:()=>lifeWrite(()=>saveHomeChange(char.id,'albums',raw=>L.albumChange(raw,char.id,{kind:'note',id:photo.id,note:photoNote}))).then(next=>{if(next)setLifeNotice('这句话已留在照片里。');})},'保存这句话'),
            h('a',{href:photo.src,download:'小家-'+photo.day+'-'+photo.id+'.jpg',style:{...btn,display:'block',textAlign:'center',marginTop:10,textDecoration:'none'}},'导出照片'),
            h('button',{"data-wk":"cdayphotodelete",disabled:lifeBusy,style:{...btn,width:'100%',marginTop:10},onClick:()=>requestAppConfirm('删掉这张照片？','从同框相册里删掉这一张，删了找不回来。删之前想留底的话，先去 设置 → 数据 → 导入与导出 → 导出全部数据。',()=>{lifeWrite(()=>saveHomeChange(char.id,'albums',raw=>L.albumChange(raw,char.id,{kind:'delete',id:photo.id}))).then(next=>{if(next){setPhotoId('');setLifeNotice('已删除这一张。');}});},'删掉')},'删除这张')):
            h(React.Fragment,null,h('p',{style:{fontSize:12,lineHeight:1.9,color:soft,marginTop:0}},'留住小家里的真实同框，照片会记下TA当地的时间和当时在做什么。'),
              h('figure',{"data-wk":"cdayphotoframe",style:{margin:'0 0 12px'}},
                photoShot?h('img',{"data-wk":"cdayphotopreview",src:photoShot.src,alt:photoShot.taName+'和'+photoShot.meName+'的取景预览',onError:()=>{setPhotoDraft(null);setPhotoPreviewNotice('预览没能显示，点重新取景再试。');},style:{display:'block',width:'100%',aspectRatio:'4/3',objectFit:'contain',borderRadius:8,background:'#e3ddce'}}):h('div',{role:'status',style:{aspectRatio:'4/3',display:'flex',alignItems:'center',justifyContent:'center',padding:20,borderRadius:8,background:'#e3ddce',fontSize:12,lineHeight:1.8,textAlign:'center'}},photoPreviewNotice||'正在准备取景…'),
                h('figcaption',{style:{fontSize:11,color:soft,lineHeight:1.8,marginTop:7}},photoShot?'取景预览 · '+photoShot.time+' · '+photoShot.activity:'取景预览')),
              h('button',{"data-wk":"cdayphotoshoot",style:{...btn,width:'100%',marginBottom:8},disabled:lifeBusy||!photoShot,onClick:takePhoto},lifeBusy?'保存中…':visiting?'拍下此刻的两个人':'先和TA走到一起，再拍同框'),
              visiting&&!preview&&!showcase&&trip?.mode!=='solo'&&h('button',{"data-wk":"cdayphotorefresh",style:{...btn,width:'100%',marginBottom:16,background:'transparent'},disabled:lifeBusy,onClick:()=>{setLifeNotice('');setPhotoRefresh(n=>n+1);}},'重新取景'),
              photos.length?h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12}},...photos.slice().reverse().map(item=>h('button',{key:item.id,"data-wk":"cdayphotoitem",style:{...btn,padding:6,textAlign:'left'},onClick:()=>{setPhotoId(item.id);setPhotoNote(item.note||'');setLifeNotice('');}},h('img',{src:item.src,alt:item.activity,loading:'lazy',style:{display:'block',width:'100%',aspectRatio:'4/3',objectFit:'cover',borderRadius:5}}),h('span',{style:{display:'block',fontSize:11,lineHeight:1.7,padding:'6px 3px'}},item.day+' '+item.time+' · '+item.activity)))):h('p',{style:{fontSize:12,color:soft}},'还没留过照片。进屋后拍下第一张吧。'))),
          lifePage==='kitchen'&&h(root.CharDayKitchenUI,{key:String(char.id),state:kitchen,view:kitchenView,setView:setKitchenView,detail:kitchenRecipe,setDetail:setKitchenRecipe,busy:lifeBusy,homeVisiting,status:kitchenStatus,action:kitchenAction,resume:runKitchen,share:shareKitchenMeal,uniqueId,btn,ink,soft,section:menuSection,persona:char.persona,character:char,profile:props.profile,apiFor:props.apiFor,active:props.active,onHomes:setHomes}),
          lifePage==='preferences'&&h(React.Fragment,null,
            h('p',{style:{fontSize:12,color:soft,lineHeight:1.9,marginTop:0}},'参考TA在人设里明确写出的家居偏好。先看看搭配，你挑的房间样式、家具配色和摆位始终优先。'),
            h('label',{style:{fontSize:12}},'你想要怎样的小家',h('textarea',{"data-wk":"cdaydecorwish",value:wish,maxLength:600,onChange:e=>setWish(e.target.value),placeholder:'写下喜欢的颜色、材质或风格',style:{...btn,width:'100%',minHeight:92,display:'block',marginTop:8}})),
            h('button',{"data-wk":"cdaydecorwishsave",style:{...btn,width:'100%',marginTop:10,marginBottom:18},disabled:lifeBusy,onClick:()=>lifeWrite(()=>saveHomeChange(char.id,'preferences',{wish:wish.trim()})).then(next=>{if(next)setLifeNotice(wish.trim()?'已记住你的想法，它会优先于自动参考。':'已回到参考TA的人设偏好。');})},'记住我的想法'),
            suggestion?h(React.Fragment,null,menuSection(suggestion.label,h(React.Fragment,null,h('p',{style:{fontSize:12,color:soft,lineHeight:1.8}},suggestion.source+' · '+suggestion.evidence),h('p',{style:{fontSize:12,lineHeight:1.8}},'配色：'+(styles.find(x=>x.id===suggestion.id)?.label||suggestion.label)),h('div',{style:{display:'flex',gap:8,marginBottom:14}},...(styles.find(x=>x.id===suggestion.id)?.colors||[]).map(color=>h('span',{key:color,style:{width:48,height:40,borderRadius:5,background:color}}))),
              h('button',{"data-wk":"cdaydecorapply",disabled:lifeBusy,style:{...btn,width:'100%'},onClick:()=>lifeWrite(()=>saveHomeUpdate(previous=>({...previous,version:3,styles:{...previous.styles,[String(char.id)]:suggestion.id},layouts:{...previous.layouts,[String(char.id)]:L.recommendLayout(previous.layouts?.[String(char.id)],suggestion)}}))).then(next=>{if(next)setLifeNotice('已选这套配色。你单独搭过的墙面、地板和家具都保留。');})},'选这套配色'))),
              menuSection('可以搭的家具',h(React.Fragment,null,h('p',{style:{fontSize:12,lineHeight:1.8}},suggestion.furniture.map(key=>catalogLabels[key]||key).join('、')),h('button',{"data-wk":"cdaydecorchoose",style:{...btn,width:'100%'},disabled:lifeBusy,onClick:()=>{setLifePage('');startEditor(suggestion.furniture);}},'去布置，自己挑家具')))):
              h('p',{style:{fontSize:12,color:soft,lineHeight:1.9}},'还没有找到明确的家居偏好。写下你的想法，或者到小家样式里直接选喜欢的搭配。')),
          lifeNotice&&h('p',{"data-wk":"cdaylifenotice",role:'status',style:{fontSize:12,color:'#8d634e',lineHeight:1.9,whiteSpace:'pre-wrap'}},lifeNotice))),
        !(lifePage==='kitchen'&&kitchenView==='chat')&&h('div',{className:'shrink-0',style:footerStyle},h('button',{style:{...btn,width:'100%',border:0,background:'transparent'},disabled:lifeBusy,onClick:()=>{setLifePage('');setMoreOpen(false);setTogetherPanel(false);}},'回到小世界'))),
      mePanel&&h("div",{"data-wk":"cdaymelook",className:"absolute inset-0 flex flex-col",style:{zIndex:25,pointerEvents:"none"}},h("div",{style:{pointerEvents:"auto",background:paper}},h(Head,{zh:"我的样貌",bg:"transparent",ink,lineInk:UI.line,subInk:soft,onBack:()=>{if(meBusy)return;setMeDraft(null);setMePanel(false);}})),h("div",{style:{height:"32%",minHeight:110,flexShrink:0}}),h("div",{className:"flex-1 min-h-0 overflow-y-auto",style:{pointerEvents:"auto",background:paper,padding:16}},h("p",{style:{fontSize:12,lineHeight:1.8,marginTop:0}},"这份样貌用于你在TA的一天里的小人，所有角色共用。从庭院取用的是副本，之后改色不会改动原庭院；按「保存样貌」才存下。"),
        // TA的样貌只有一份，住在「陪伴」里；这里给一个门过去，免得大家不知道该去哪改
        !demo&&!!props.onEditLook&&h("button",{onClick:()=>{if(meBusy)return;setMeDraft(null);setMePanel(false);props.onEditLook(char);},style:{...btn,width:"100%",minHeight:44,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}},h("span",null,"改"+(char.remark||char.name)+"的样貌"),h("span",{style:{fontSize:11,color:soft}},"在「陪伴」里改，两边同步")),h("select",{"aria-label":"取用庭院样貌",style:{...btn,width:"100%",marginBottom:16},defaultValue:"",onChange:e=>{const value=props.readAppearance?.(e.target.value);if(value){setMeDraft(value);setMeNotice("");}else setMeNotice("这份存档还没有保存你的样貌。");}},h("option",{value:""},"从庭院存档取用…"),...(props.appearanceSaves||[]).map(row=>h("option",{key:row.id,value:row.key},row.name||"庭院存档"))),meStyles&&root.GardenDressControls?h(root.GardenDressControls,{who:"me",look:{me:meDraft||{}},styles:meStyles,game:()=>iframe.current?.contentWindow?.CharDayScene?.visitorWardrobe?.(),pushLook:patch=>setMeDraft(current=>iframe.current?.contentWindow?.CharDayScene?.mergeVisitorLook?.(patch,current)||current)}):h("p",null,"正在打开衣柜…"),meNotice&&h("p",{role:"status"},meNotice)),h("div",{className:"shrink-0",style:{...footerStyle,pointerEvents:"auto"}},h("button",{style:{...btn,width:"100%"},disabled:meBusy,onClick:saveMe},meBusy?"保存中…":"保存样貌"))),
      chatMounted && !editor && !demo && !showcase && h("section", { "data-wk": "cdaychat", "aria-label": "和" + (char.remark || char.name) + "聊天", hidden: !chatOpen||controlsOpen||mePanel,
        className: "absolute left-0 right-0 flex flex-col", style: { display: chatOpen&&!controlsOpen&&!mePanel ? "flex" : "none", top: kbLift ? "15%" : "50%", bottom: kbLift, zIndex: 8, background: paper, borderTop: "1px solid "+UI.line, boxShadow: "0 -4px 18px #6d5b3020" } },
        h("div", { "data-wk": "cdaychatbar", className: "shrink-0 flex items-center", style: { gap: 8, padding: "2px 12px", minHeight: 44, borderBottom: "1px solid "+UI.line } },
          h("span", { style: { flex: 1, minWidth: 0, fontSize: "calc(11px * var(--app-fs, 1))", color: soft } }, "主聊天 · 最近20条"),
          h("button", { style: { ...btn, border: 0, background: "transparent" }, onClick: () => props.onMainChat?.(char) }, "完整聊天"),
          h("button", { "aria-label": "收起聊天", style: { ...btn, border: 0, background: "transparent" }, onClick: () => setChatOpen(false) }, "收起")),
        h("div", { className: "flex-1 min-h-0 relative" }, props.renderChat?.(char, { visible: chatOpen, close: () => setChatOpen(false) })))));
  };

})(window);
