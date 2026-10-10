// 微光庭院有两种进法（她 2026-09-16 定的第二种）：
//   · 首页那个入口＝架空试玩：一个公共存档，全文人设＋公共文风，主线一概不读写。
//   · 【庭院房】＝角色的一间侧房：一间房一个存档，进门带什么由这间房的开关说了算，
//     说过的话落在这间房自己的聊天记录里，要带出去就开「能进记忆」「总结回主线」。
// ⚠️第二种一样机制都没新造：房间那套（cognition/writeback）本来就长着这几排开关，
//   庭院以前只是没接上去。所以这里只多收三个 props：storeKey（存档挂哪儿）、
//   mainline（已经过这间房认知闸的主线底子）、record（这间房的记录与写回）。
// 接口密钥留在父页 callAI，不传进游戏画面。
(function (root) {
  "use strict";
  const KEY = "x_fairyGarden", BUILD = "fg-0ea83b85ae5ca55e", hosts = new WeakMap();
  const h = React.createElement, useState = React.useState, useRef = React.useRef, useEffect = React.useEffect;
  root.FairyGardenHostFor = child => hosts.get(child) || null;
  // ⚠️「读回来是空」不等于「这儿本来就没有一档」。存档搬进 IDB 之后，文字仓没灌起来
  //   那一刻读到的也是空；这时候要是照着「没有」开一档新的，第一次保存就把她真正的
  //   那一档原地盖掉了——而她看见的全过程只是「进去发现庭院变新的了」。
  //   所以空的时候先问一句仓开没开：没开就【什么都不写】，把话说出来让她退出去再进。
  function vaultStalled(key) {
    if (typeof isIdbTextKey !== "function" || !isIdbTextKey(key)) return "";
    let st = null; try { st = typeof txtVaultState === "function" ? txtVaultState() : null; } catch (e) { return ""; }
    if (!st || (st.done && st.ok)) return "";
    return "本机的存档仓还没打开" + (st.err ? "（" + st.err + "）" : "") + "，先别在这儿开新的一档——退出去等一下再进来，庭院还在。";
  }
  // 一份空存档长什么样，只写在这一处：read 兜底和「新开一段」建档都来拿。
  // 一条记录＝【一段旅程】：同一位同行者，底下挂着好几个世界各自的进度
  // （她 2026-09-19：「每个庭院档连一个列车档连一个别的什么档」）。
  // 绒绒小镇用 archive.clock 走现实日历；庭院与列车保留各自游戏时间。
  //   journey 只装跟世界无关的那几样（谁、长什么样、随身袋），由 world.mjs 的
  //   JOURNEY_SHAPE 一张表说了算，这儿不判断哪样归哪层。
  const blankSave = () => ({ version: 1, id: "garden_" + Date.now() + "_" + Math.random().toString(36).slice(2), partnerId: "", world: null, worlds: {}, journey: {}, dialogs: {} });
  const read = (key) => {
    const k = key || KEY;
    const d = loadJSON(k, null);
    if (d && d.version === 1 && d.id) return root.GameClock.archive(d);
    const stall = vaultStalled(k); if (stall) throw new Error(stall);
    return root.GameClock.archive(blankSave());
  };
  const write = (key, data) => { data=root.GameClock.archive(data); if (!saveJSON(key || KEY, data)) throw new Error("庭院没能保存，请先留在这里。空间不足时可以导出手机备份。"); return data; };
  const TRAIN_BUILD = BUILD;
  function saveWorld(key, current, world, worldId, journey) {
    const w=String(worldId||"garden");
    if(!WORLDS.some(x=>x.id===w)||!world||!Number.isFinite(world.version)||!Number.isFinite(world.day)||typeof world.map!=="string")throw Error("世界进度异常，暂未覆盖旧存档。");
    const d=current(),{clock,...game}=world;world=w==="pets"?{...game,clock:d.clock}:game;return write(key,{...d,activeWorld:w,journey: { ...(d.journey || {}), ...(journey || {}) }, worlds: { ...(d.worlds || {}), [w]: world }, world: w === "garden" ? world : d.world});
  }
  function WorldSession(props) {
    const [place,setPlace]=useState(()=>{try{return props.entryWorld||read(props.storeKey||KEY).activeWorld||"garden";}catch{return "garden";}});
    const [ready,setReady]=useState(place!=="train"),[error,setError]=useState("");
    const alive=useRef(true),switching=useRef(false),key=props.storeKey||KEY;
    const [stationChoice,setStationChoice]=useState(false),choiceDone=useRef(null);
    const chooseStation=()=>new Promise(resolve=>{if(choiceDone.current){resolve(null);return;}choiceDone.current=resolve;setStationChoice(true);});
    const finishChoice=to=>{const done=choiceDone.current;choiceDone.current=null;setStationChoice(false);done?.(to);};
    useEffect(()=>()=>{choiceDone.current?.(null);choiceDone.current=null;},[]);
    const initialize=async(from)=>{
      const before=loadJSON(key,null);
      const {startTrip}=await import("../apps/train/travel.mjs?v="+TRAIN_BUILD);
      if(!alive.current)return false;
      const d=read(key);if(before&&d.id!==before.id)throw Error("存档已切换，请重新进入。");const garden=from==="garden"?worldOf(d,"garden"):null;
      if(from==="garden"&&!garden)throw Error("庭院还没有保存成功，请留在车站。");
      write(key,{...d,partnerId:props.lockPartnerId?String(props.lockPartnerId):d.partnerId,activeWorld:"train",worlds:{...(d.worlds||{}),train:startTrip(garden,Math.random,d.worlds?.train)}});return true;
    };
    useEffect(()=>{alive.current=true;if(place==="train"&&!props.entryWorld&&read(key).worlds?.train){setReady(true);}else if(place==="train")initialize("direct").then(ok=>{if(ok)setReady(true);}).catch(e=>{if(alive.current)setError(e.message);});return()=>{alive.current=false;};},[]);
    const travel=async(to,options={})=>{
      if(switching.current)return false;switching.current=true;
      try{
        if(to==="train"){if(!await initialize(place==="garden"?"garden":"direct"))return false;}
        else if(to==="garden"){
          const before=read(key);const m=await import("../apps/fairy-garden/world.mjs?v="+BUILD);if(!alive.current)return false;
          const d=read(key);if(d.id!==before.id)throw Error("存档已切换，请重新进入。");const old=m.restoreState(m.putJourney(m.restoreState(worldOf(d,"garden")),d.journey)),at=m.MAPS.garden.station.target;
          const garden={...old,map:"garden",depth:0,seat:null,sleep:{player:null,companion:null},position:{...at},companion:{...old.companion,map:"garden",mode:"follow",seat:null,position:{x:at.x+.75,z:at.z}}};
          write(key,{...d,activeWorld:"garden",world:garden,worlds:{...(d.worlds||{}),garden}});
        }else if(to==="pets"){
          const before=read(key);let station=null;
          if(options.station){station=await Promise.all([import("../apps/pets/railway.mjs?v="+BUILD),import("../art/pet-career/world-navigation.mjs?v="+BUILD),fetch("art/pet-career/outside.json?v="+BUILD).then(r=>{if(!r.ok)throw Error("小镇车站暂时没能打开，请稍后再试。");return r.json();})]);if(!alive.current)return false;}
          // Re-read after the awaits: the town may have saved meanwhile, so arrive on the latest pets save.
          const d=read(key);if(d.id!==before.id)throw Error("存档已切换，请重新进入。");let pets=d.worlds?.pets;if(station){const [m,n,r]=station;pets=m.arrivePetStation(pets,n.createPetWorld(r),r.station);}write(key,{...d,activeWorld:"pets",worlds:{...(d.worlds||{}),...(pets?{pets}:{})}});
        }else return false;
        setReady(true);setPlace(to);return true;
      }catch(e){setError(e.message);props.toast(e.message);return false;}finally{switching.current=false;}
    };
    if(!ready)return h("div",{className:"h-full flex flex-col",style:{background:G.paper,color:G.ink}},h(Head,{zh:"远行列车",onBack:props.onBack}),h("p",{role:"status",style:{padding:20}},error||"正在准备旅程…"));
    return h('div',{className:'h-full',style:{position:'relative'}},h(place==="pets"?PetSession:place==="train"?TrainSession:GardenSession,{...props,key:place,onTravel:travel,onStation:chooseStation}),stationChoice&&h(RailwayPage,{from:place,onClose:()=>finishChoice(null),onChoose:finishChoice}));
  }
  // 旅行相框：点图看原样大图；「翻看背面」看日期、拼图纪念和两个人各留的那句话（2026-09-25）
  // 念出来（庭院和列车共用）：一句一句念，念完了才回来——游戏靠这个决定什么时候翻下一只气泡
  // （她 2026-09-19：「开了就每个气泡念完再到下一个气泡念」）。
  // ⚠️和聊天里那条语音走【同一个 ttsSpeak / ttsWarm】：自带 idb 缓存，另写一套合成就是又开一处要付钱的地方。
  // 念不了就老老实实返回 false，让游戏退回原来的定时——不许把气泡卡死在那儿。
  // 上一条还在念的时候，warmAloud 把下一条先合成掉；按缓存钥匙合流，不会再花一次钱。
  // 列车设置里的开关：记在这台设备上（跟庭院「念出来」一个口径，存 '1'/'0'）
  function RailwayChoices({from,onChoose}){
    return h('div',{ "data-wk": "fgrailway", 'data-railway-choices':true,className:'flex-1 min-h-0 overflow-y-auto',style:{padding:20,paddingBottom:COMPOSER_PAD_BOTTOM}},
      h('p',{style:{fontSize:13,lineHeight:1.8,marginBottom:20}},from==='train'?'选择下车的站点，继续这一档的日子。':'选好目的地，列车就会沿铁轨驶进站台。'),
      h('div',{style:{display:'grid',gap:12}},...WORLDS.filter(w=>w.id!==from).map(w=>h('button',{ "data-wk": "fgrailwaydest", key:w.id,'data-railway-destination':w.id,'aria-label':'进入'+w.name,onClick:()=>onChoose(w.id),style:{...pickButtonStyle(),textAlign:'left',minHeight:72,padding:'14px 16px'}},h('strong',{style:{display:'block',fontSize:15,fontWeight:500}},'进入'+w.name),h('span',{style:{display:'block',fontSize:12,marginTop:5,color:G.soft}},w.id==='train'?'登上远行列车，留在车厢里看窗景':w.id==='pets'?'绒绒小镇车站 · 南边街道':'微光庭院南站 · 林边站台')))));
  }
  function RailwayPage({from,onClose,onChoose}){
    return h('section',{'data-railway-page':from,className:'absolute inset-0 flex flex-col',style:{zIndex:30,background:G.paper,color:G.ink}},h(Head,{zh:from==='pets'?'绒绒小镇车站':'微光庭院南站',bg:'transparent',onBack:onClose}),h(RailwayChoices,{from,onChoose}));
  }
  function TrainSwitch({label,note,storeKey,fallback,onChange}){
    const read=()=>{try{const v=localStorage.getItem(storeKey);return v===null?fallback:v==="1";}catch(e){return fallback;}};
    const [on,setOn]=useState(read);
    const flip=()=>{const next=!on;setOn(next);try{localStorage.setItem(storeKey,next?"1":"0");}catch(e){}onChange&&onChange(next);};
    return h("div",{style:{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:"1px solid "+G.line,background:"rgba(255,255,255,.5)"}},
      h("div",{style:{flex:1,minWidth:0}},h("div",{style:{fontFamily:F_BODY,fontSize:13.5,color:G.ink}},label),h("div",{style:{fontFamily:F_BODY,fontSize:11.5,color:G.soft,lineHeight:1.7,marginTop:3}},note)),
      h("button",{ "data-wk": "fgswitch", "data-on": on ? "1" : "0", type:"button",role:"switch","aria-checked":on,"aria-label":label,onClick:flip,style:{flexShrink:0,width:52,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:"transparent"}},
        h("span",{style:{width:44,height:26,borderRadius:13,background:on?G.deep:"#cfd6c3",position:"relative",transition:"background .15s"}},h("span",{style:{position:"absolute",top:3,left:on?21:3,width:20,height:20,borderRadius:10,background:"#fff",transition:"left .15s"}}))));
  }
  function makeAloud(){
    let playing=null;
    const stop=()=>{try{if(playing){playing.pause();playing.src="";}}catch(e){}playing=null;};
    const bridge=(live,partner)=>({
      readAloud:async text=>{const line=String(text||"").trim(),c=partner();if(!line||!c||!c.voiceId||typeof ttsSpeak!=="function")return false;
        try{const blob=await ttsSpeak(line,c.voiceId);if(!live())return false;stop();const url=URL.createObjectURL(blob),a=new Audio(url);playing=a;
          try{await a.play();}catch(e){try{URL.revokeObjectURL(url);}catch(_){}playing=null;return false;}
          await new Promise(done=>{a.onended=done;a.onerror=done;});try{URL.revokeObjectURL(url);}catch(e){}if(playing===a)playing=null;return true;}catch(e){return false;}},
      warmAloud:text=>{const line=String(text||"").trim(),c=partner();if(!line||!c||!c.voiceId||typeof ttsWarm!=="function")return false;try{ttsWarm(line,c.voiceId);}catch(e){}return true;},
      stopAloud:()=>{stop();return true;}});
    return {stop,bridge};
  }
  function TravelFramePreview({src,label,memory,back:raw}){
    const [back,setBack]=useState(false),[lines,setLines]=useState([]),[info,setInfo]=useState(null),[big,setBig]=useState(false),[full,setFull]=useState(false),key=JSON.stringify([memory||null,raw||null]);
    useEffect(()=>{let alive=true;setBack(false);setLines([]);setInfo(null);import('../apps/train/puzzle-memory.mjs?v='+BUILD).then(m=>{if(!alive)return;const [mem,r]=JSON.parse(key);setLines(mem?m.puzzleMemoryLines(mem):[]);const b=m.backOf(r||{});setInfo(b?{...b,date:m.backDate(b.at)}:null);}).catch(()=>{});return()=>{alive=false;};},[key,src]);
    const hasBack=lines.length>0||!!info;
    const say=(who,text)=>h('p',{style:{margin:'10px 0 0',fontSize:13.5,lineHeight:1.8,fontFamily:F_BODY}},h('span',{style:{fontSize:11.5,color:'#8a7a5c',marginRight:6}},who),text);
    return h('figure',{'data-travel-frame':true,style:{margin:'9px 0',minWidth:0}},
      back?h('div',{'data-frame-back':true,style:{padding:'20px 16px',background:'#e9dfc7',border:'8px solid #765b3e',borderRadius:7,color:'#534733',lineHeight:1.9,overflowWrap:'anywhere'}},
        h('strong',{style:{fontSize:14,fontWeight:500}},lines.length?'这幅拼图的纪念':'这张照片的背面'),
        info&&(info.date||info.day)&&h('p',{'data-back-date':true,style:{margin:'8px 0',fontSize:13}},[info.date,info.day?'旅途第 '+info.day+' 天':''].filter(Boolean).join(' · ')),
        lines.map((line,i)=>h('p',{key:i,style:{margin:'8px 0',fontSize:13}},line)),
        info&&info.you&&say('你写',info.you),
        info&&info.companion&&say(info.companionName+' 写',info.companion))
      :h('button',{type:'button','aria-label':'看大图',onClick:()=>{setFull(false);setBig(true);},style:{display:'block',width:'100%',padding:0,background:'transparent',border:0}},h('img',{src,alt:label,loading:'lazy',style:{display:'block',width:'100%',height:'auto',borderRadius:7}})),
      hasBack&&h('button',{type:'button',onClick:()=>setBack(v=>!v),'aria-pressed':back,style:{...pickButtonStyle(),padding:'7px 12px',marginTop:8,fontSize:12,minHeight:40}},back?'看看正面':'翻看背面'),
      // 大图：先整张放进屏幕；点图切到原始像素，可以拖着看细节
      big&&ReactDOM.createPortal(h('div',{'data-frame-big':true,role:'dialog','aria-label':label||'旅行相框',onClick:()=>setBig(false),style:{position:'fixed',inset:0,zIndex:2147483000,background:'rgba(20,18,14,.94)',overflow:'auto',WebkitOverflowScrolling:'touch',display:full?'block':'flex',alignItems:'center',justifyContent:'center'}},
        h('img',{src,alt:label,onClick:e=>{e.stopPropagation();setFull(v=>!v);},style:full?{display:'block',maxWidth:'none'}:{display:'block',maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}),
        h('button',{type:'button','aria-label':'关闭大图',onClick:e=>{e.stopPropagation();setBig(false);},style:{position:'fixed',top:'calc(env(safe-area-inset-top) + 10px)',right:12,width:40,height:40,borderRadius:20,background:'rgba(255,255,255,.18)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center'}},h(IX,{size:18,color:'#fff'}))),document.body));
  }
  function travelFramePreview(t){return t.image?h(TravelFramePreview,{src:t.image,label:t.name,memory:t.memory,back:{back:t.back}}):null;}
  // 背面留言：她写一句，TA 写一句，都可以不写；写过还能改（2026-09-25）
  function BackNotes({item,busy,onNote,onAsk}){
    const saved=(item.back&&item.back.you)||'',[draft,setDraft]=useState(saved),theirs=item.back&&item.back.companion;
    useEffect(()=>{setDraft(saved);},[item.id,saved]);
    const box={width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:10,border:'1px solid '+G.line,background:'#fffef8',fontFamily:F_BODY,fontSize:16,lineHeight:1.6,color:G.ink,resize:'vertical'};
    return h('section',{ "data-wk": "fgbacknotes", 'data-back-notes':true,'aria-label':'背面留言',style:{margin:'4px 0 16px',padding:'12px 14px',borderRadius:12,background:'rgba(233,223,199,.55)',border:'1px solid rgba(118,91,62,.18)'}},
      h('div',{style:{fontFamily:F_BODY,fontSize:13,color:G.ink,marginBottom:8}},'在背面留一句'),
      h('textarea',{ "data-wk": "fginput", "data-part": "backnote", rows:2,maxLength:200,value:draft,placeholder:'你想写的话（可以不写）',onChange:e=>setDraft(e.target.value),style:box}),
      h('button',{type:'button',disabled:busy||draft.trim()===saved.trim(),onClick:()=>onNote('you',draft),style:{...pickButtonStyle(),padding:'8px 12px',marginTop:8,fontSize:12.5,minHeight:40}},saved?'改成这句':'写上'),
      onAsk&&h('div',{style:{marginTop:14}},
        theirs&&h('p',{style:{fontFamily:F_BODY,fontSize:13,lineHeight:1.8,margin:'0 0 8px'}},h('span',{style:{fontSize:11.5,color:G.soft,marginRight:6}},(item.back.companionName||'TA')+' 写'),theirs),
        h('button',{type:'button',disabled:busy,onClick:onAsk,style:{...pickButtonStyle(),padding:'8px 12px',fontSize:12.5,minHeight:40}},busy?'…':theirs?'请 TA 重写一句':'请 TA 也写一句')));
  }
  // 庭院里的旅行相框单独一页：点屋里挂着的那个、或花册里那一格都进这里
  function FrameSheet({thing,busy,onClose,onNote,onAsk}){
    const item={id:thing.sourceId,back:thing.back||null};
    return h('div',{ "data-wk": "fgframesheet", 'data-frame-sheet':true,className:'absolute inset-0 flex flex-col',style:{background:G.paper,zIndex:30,color:G.ink}},
      h(Head,{zh:thing.name||'旅行相框',bg:'transparent',ink:G.ink,onBack:onClose}),
      h('div',{className:'flex-1 min-h-0 overflow-y-auto',style:{padding:16}},
        h(TravelFramePreview,{src:thing.image,label:thing.name,memory:thing.memory,back:{back:thing.back}}),
        thing.note&&h('p',{style:{fontFamily:F_BODY,fontSize:13,lineHeight:1.8,margin:'4px 0 12px'}},thing.note),
        h(BackNotes,{item,busy,onNote,onAsk})));
  }
  function TravelAlbum({getArchive,onDelete,onCarry,onExchange,onClose,onNote,onAskNote}){
    const [kit,setKit]=useState(null),[selected,setSelected]=useState(null),[revision,setRevision]=useState(0),[message,setMessage]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);
    const scroll=useRef(null),scrollAt=useRef(0);
    useEffect(()=>{let alive=true;import('../apps/train/album.mjs?v='+BUILD).then(m=>{if(alive)setKit(m);}).catch(e=>setMessage(e.message));return()=>{alive=false;};},[]);
    useEffect(()=>{if(!selected&&scroll.current)scroll.current.scrollTop=scrollAt.current;},[selected]);
    const archive=getArchive(),rows=kit?kit.albumRows(archive.worlds?.train):[],item=rows.find(x=>x.id===selected),garden=worldOf(archive,'garden'),carried=item&&[...(garden?.things||[]),...(garden?.collection||[])].some(t=>t.sourceId===item.id);
    const action=async fn=>{if(busy)return;setBusy(true);setMessage('');try{await fn();setRevision(n=>n+1);}catch(e){setMessage(e.message);}finally{setBusy(false);}};
    const button={...pickButtonStyle(),padding:'10px 12px'};
    return h('div',{ "data-wk": "fgalbum", className:'absolute inset-0 flex flex-col',style:{background:G.paper,zIndex:20,color:G.ink}},
      h(Head,{zh:item?'旅行留影':'旅行相册',bg:'transparent',ink:G.ink,onBack:()=>{if(busy)return;if(item){setSelected(null);setConfirm(false);setMessage('');}else onClose();}}),
      h('div',{ref:scroll,className:'flex-1 min-h-0 overflow-y-auto',style:{padding:16}},
        !kit?h('p',null,'正在翻开相册…'):item?h(React.Fragment,null,
          h(TravelFramePreview,{key:item.id,src:item.src,label:item.label,memory:item.memory,back:item}),
          onNote&&h(BackNotes,{item,busy,onNote:(who,text)=>action(async()=>{await onNote(item,who,text);setMessage('写在背面了。');}),onAsk:onAskNote&&(()=>action(async()=>{await onAskNote(item);setMessage('TA 在背面写了一句。');}))}),
          h('p',{style:{fontFamily:F_BODY,fontSize:13,lineHeight:1.8}},item.label),h('p',{style:{fontSize:12,color:G.soft}},item.kind==='photo'?kit.photographerLabel(item):'一起拼好的风景'),item.promise&&h('p',{style:{fontSize:12,color:G.deep}},'拍照约定 · '+item.promise.name+' · 已拍到'),
          h('div',{style:{display:'grid',gap:10}},
            h('button',{style:button,disabled:busy||carried,onClick:()=>action(async()=>{await onCarry(item);setMessage('已带回庭院，在花册「屋里」可以摆放。');})},carried?'已带回庭院':'带回庭院'),
            h('a',{href:item.src,download:(item.kind==='puzzle'?'旅行拼图':'旅行照片')+'.jpg',style:{...button,textAlign:'center',textDecoration:'none',display:'block'}},'导出图片'),
            h('button',{style:{...button,color:'#965b4f'},disabled:busy,onClick:()=>{if(!confirm){setConfirm(true);setMessage('删除相册里的这一张；已经带回庭院的相框会保留。再点一次确认。');return;}action(async()=>{await onDelete(item.id);setSelected(null);setConfirm(false);setMessage('已从相册删除。');});}},confirm?'确认删除':'删除这张')),
          h('p',{style:{fontSize:11,lineHeight:1.8,color:G.soft}},'相册属于这一档，庭院和列车都能翻看。手机也可以长按上面的图片保存。')):
          h(React.Fragment,null,onExchange&&h('button',{style:{...button,width:'100%',marginBottom:12},disabled:busy||!(archive.worlds?.train?.companionPhotos||[]).length,onClick:()=>action(async()=>{await onExchange();setMessage('交换好了，TA拍的照片也可以拿来拼图或带回庭院。');})},'交换相册 · '+(archive.worlds?.train?.companionPhotos||[]).length+' 张待翻开'),h('p',{style:{fontSize:12,lineHeight:1.8,color:G.soft}},'TA会在沿途拍下窗景，每趟最多六张。交换相册后可以看见TA拍的照片，也能用来拼图、导出或带回庭院。'),
          kit.promiseSummaries(archive.worlds?.train||{}).slice().reverse().map(p=>h('section',{key:p.id,style:{borderBottom:'1px solid '+G.line,padding:'8px 0',marginBottom:12}},h('h3',{style:{fontSize:14,fontWeight:500}},'第 '+p.trip+' 趟 · 拍照约定'),h('p',{style:{fontSize:12}},'你：'+p.you.theme+' · '+p.you.status),p.companion&&h('p',{style:{fontSize:12}},p.companion.name+'：'+p.companion.theme+' · '+p.companion.status))),rows.length?['puzzle','photo'].map(kind=>{const group=rows.filter(x=>x.kind===kind);return group.length?h('section',{key:kind,style:{marginBottom:22}},h('h3',{style:{fontFamily:F_BODY,fontSize:14,fontWeight:500}},kind==='puzzle'?'拼好的风景':'旅途照片'),h('div',{style:{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}},group.map(x=>h('button',{key:x.id,onClick:()=>{scrollAt.current=scroll.current?.scrollTop||0;setSelected(x.id);setMessage('');setConfirm(false);},style:{padding:6,border:'1px solid '+G.line,borderRadius:9,background:'#fffaf0',textAlign:'left',color:G.ink}},h('img',{src:x.src,alt:x.label,loading:'lazy',style:{display:'block',width:'100%',aspectRatio:'3/2',objectFit:'contain'}}),h('span',{style:{display:'block',fontSize:11,lineHeight:1.6,padding:5}},x.label),x.kind==='photo'&&h('span',{style:{fontSize:11,color:G.soft,padding:5}},kit.photographerLabel(x)))))):null;}):h('p',null,'还没有照片，坐上列车，用取景器留下一张风景吧。')),
        message&&h('p',{role:'status',style:{fontSize:12,lineHeight:1.8,color:G.deep,marginTop:14}},message)));
  }
  // One record, partitioned by archive and world. Untagged old replies remain readable,
  // but cannot establish which world they happened in and never enter a world prompt.
  const DIALOG_WORLDS = new Set(['garden','train','pets']);
  const dialogStamp = (world, archiveId) => {
    if(!DIALOG_WORLDS.has(world)||!String(archiveId||''))throw Error('对话来源异常，暂未写入。');
    return {gameWorld:world,gameArchiveId:String(archiveId)};
  };
  const scopedDialog = (m, world, archiveId) => !!m && m.gameWorld===world && String(m.gameArchiveId||'')===String(archiveId||'');
  const selectDialogs = (rows, world, archiveId) => (Array.isArray(rows)?rows:[]).filter(m=>scopedDialog(m,world,archiveId));
  // Only garden ever wrote untagged pending/failed requests; completed legacy turns are ambiguous.
  const oldGardenRequest = m => m && !m.gameWorld && m.role==='user' && ['pending','failed'].includes(m.status);
  const localDialogs = (d,cid,world) => ((d.dialogs||{})[cid]||[]).filter(m=>scopedDialog(m,world,d.id)||(world==='garden'&&oldGardenRequest(m)));
  function replaceDialogs(d,cid,world,rows,limit=200){
    const old=(d.dialogs||{})[cid]||[],stamp=dialogStamp(world,d.id);
    const kept=old.filter(m=>!scopedDialog(m,world,d.id)&&!(world==='garden'&&oldGardenRequest(m)));
    return {...d,dialogs:{...(d.dialogs||{}),[cid]:kept.concat(rows.slice(-limit).map(m=>({...m,...stamp})))}};
  }
  const worldRecord=(p,key,world,d)=>{
    const raw=p.record||(p.recordFor?p.recordFor(key):null);if(!raw)return null;
    return {history:raw.historyFor?raw.historyFor(world,d.id):selectDialogs(raw.history,world,d.id),
      legacy:raw.legacyHistory||[],hasMainline:!!raw.mainlineFor,mainline:()=>raw.mainlineFor?.(world,d.id)||'',onTurn:turn=>raw.onTurn({...turn,...dialogStamp(world,d.id)})};
  };
  const worldMainline=(p,key,d,world,cid)=>{
    const raw=p.record||(p.recordFor?p.recordFor(key):null);
    return raw?.mainlineFor?raw.mainlineFor(world,d.id):p.mainline||(p.mainlineFor?p.mainlineFor(cid):'');
  };
  const worldHistory=(p,key,d,world)=>worldRecord(p,key,world,d)?.history||localDialogs(d,d.partnerId,world).filter(m=>m.status==='done');
  function storeWorldTurn(key,current,record,cid,text,out,limit=Infinity,world='garden'){
    const parts=out.parts||[out.reply];
    if(record?.onTurn)record.onTurn({text,reply:out.reply,parts});
    else{const d=current();write(key,replaceDialogs(d,cid,world,[...localDialogs(d,cid,world),...(text?[{role:'user',content:text,status:'done'}]:[]),...parts.map(content=>({role:'assistant',content,status:'done'}))],limit));}
  }
  const worldCognition = world => (root.FairyWorlds||[]).find(w=>w.id===world)?.cognition||'';
  root.FairyWorldDialogs={stamp:dialogStamp,select:selectDialogs,local:localDialogs,replace:replaceDialogs,cognition:worldCognition};
  function LegacyWorldDialogs({record,archive,cid}){
    const rows=record?record.legacy:((archive.dialogs||{})[cid]||[]).filter(m=>m&&!m.gameWorld&&m.status==='done').slice(-100);
    if(!rows.length)return null;
    return h('details',{'data-world-legacy':true,style:{fontSize:12,lineHeight:1.8,margin:'10px 0'}},
      h('summary',null,'分开前的共用记录'),h('p',null,'这些旧话没有标明发生在哪个世界，保留在这里翻看。新的对话会各自记下。'),
      rows.map((m,i)=>h('p',{key:m.id||i,style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}},(m.role==='user'?'你':'TA')+'：'+m.content)));
  }
  // Pet pages share the existing full-page / composer geometry; their material belongs to the town.
  function PetSeal({kind='paw',size=24}){
    const paths={search:['M15 9a6 6 0 1 1-12 0 6 6 0 0 1 12 0','M14 14l7 7'],cup:['M4 8h12v9c0 4-12 4-12 0Z','M16 9h2c5 0 5 6-2 6','M7 3v2','M12 2v3','M3 22h15'],paw:['M7 13c-2 2-4 5-2 7 2 2 4-1 7-1s5 3 7 1c2-2 0-5-2-7-3-3-7-3-10 0','M4 8v2','M9 4v3','M15 4v3','M20 8v2'],bread:['M5 10c-5-6 3-10 7-7 4-3 12 1 7 7v10H5Z','M9 8v6','M15 8v6'],bag:['M8 3h8l-2 5c6 4 7 12 2 13H8C3 20 4 12 10 8Z','M8 8h8','M10 13h4','M12 11v7'],home:['M3 11 12 3l9 8','M5 10v11h14V10','M10 21v-7h4v7'],train:['M5 3h14v15H5Z','M8 6h8v5H8Z','M8 18l-2 3','M16 18l2 3','M8 15h.01','M16 15h.01'],leaf:['M4 20c2-8 6-13 16-16 1 13-7 18-16 16Z','M5 19 16 8'],chat:['M4 4h16v12H9l-5 4Z','M8 8h8','M8 12h5'],ball:['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0','M5 6c8 0 8 12 14 12','M18 5c0 7-12 8-12 14'],book:['M4 4h7c2 0 2 2 2 2s0-2 2-2h5v16h-5c-2 0-2 1-2 1s0-1-2-1H4Z','M13 6v15'],arrow:['M5 12h14','M14 7l5 5-5 5']};
    return h(Svg,{size,sw:1.5},...(paths[kind]||paths.paw).map((d,i)=>h('path',{key:i,d})));
  }
  function PetPortrait({profile}){const dog=profile?.species==='dog',base=profile?.look?.base||'#f4eee4',patch=profile?.look?.patch||'#aea198';return h('svg',{viewBox:'0 0 120 112','aria-hidden':true,className:'pet-portrait'},
    h('ellipse',{cx:60,cy:101,rx:36,ry:5,fill:'#ddd8c8',opacity:.55}),
    h('path',{d:dog?'M26 52C4 64 7 13 30 17L43 37M94 52c22 12 19-39-4-35L77 37':'M24 45 17 8Q43 11 49 29M96 45 103 8Q77 11 71 29',fill:patch,stroke:'#87786f',strokeWidth:1.4}),
    !dog&&h('path',{d:'M24 34 22 16l18 13M96 34l2-18-18 13',fill:'#deb4a7'}),
    h('path',{d:'M21 62C15 18 105 18 99 62q4 35-39 36-43-1-39-36Z',fill:base,stroke:'#958b7e',strokeWidth:1.4}),
    h('path',{d:'M21 56q-2-26 26-30l13 23 13-23q27 4 26 30L77 65 60 50 43 65Z',fill:patch}),
    ...[42,78].map(cx=>h('g',{key:cx},h('ellipse',{cx,cy:62,rx:9,ry:12,fill:'#4b413a'}),h('ellipse',{cx:cx-2,cy:58,rx:3,ry:4,fill:'#fffaf3'}))),
    h('ellipse',{cx:33,cy:77,rx:8,ry:4,fill:'#efc1ac',opacity:.6}),h('ellipse',{cx:87,cy:77,rx:8,ry:4,fill:'#efc1ac',opacity:.6}),
    h('path',{d:dog?'M55 76q5-5 10 0l-5 6Z':'M55 76h10l-5 5Z',fill:dog?'#5d5044':'#ca9386'}),h('path',{d:'M60 80v5m0 0q-4 4-8 0m8 0q4 4 8 0',fill:'none',stroke:'#857267',strokeWidth:1.3,strokeLinecap:'round'}),
    !dog&&h('path',{d:'M13 72l17 2M12 81l18-3M107 72l-17 2M108 81l-18-3',stroke:'#958b7e',strokeWidth:1,opacity:.65}));}
  const PET_LIVE_PANELS=['chat','care','career','pets','view','neighbors','journal','together','parcel','travel','album','domestic'];
  function PetWindow({page,drawer,children}){return h('section',{['data-pet-'+page]:true,className:(page==='chat'?'pet-chat-page':'pet-panel')+' absolute left-0 right-0 bottom-0 flex flex-col'+(drawer?' pet-live-window':' inset-0'),style:drawer?{top:drawer.top+'%',bottom:drawer.lift||0,zIndex:10}:undefined},
    drawer&&h('header',{className:'pet-chat-heading shrink-0'},h('div',{className:'pet-chat-divider',role:'separator',tabIndex:0,'aria-label':drawer.chat?'调整聊天窗口大小':'调整面板窗口大小','aria-orientation':'horizontal','aria-valuemin':28,'aria-valuemax':72,'aria-valuenow':Math.round(drawer.ratio*100),'aria-valuetext':'窗口占 '+Math.round(drawer.ratio*100)+'%','title':'拖动调大小，双击恢复一半',...drawer.controls},h('span',{className:'pet-chat-grip','aria-hidden':true}),h(PetSeal,{kind:drawer.chat?'chat':'paw',size:19}),h('strong',null,drawer.title)),h('button',{type:'button',onClick:drawer.close,'aria-label':drawer.chat?'收起小镇聊天':'收起小镇面板'},'收起')),
    children);}
  function PetPanel({page,children,footer,scrollRef,onScroll,drawer}){return h(PetWindow,{page,drawer},
    h('div',{ref:scrollRef,onScroll,className:'pet-page-body flex-1 min-h-0 overflow-y-auto'},children),
    footer&&h('div',{className:'pet-page-footer shrink-0',style:{paddingBottom:COMPOSER_PAD_BOTTOM,minHeight:56}},footer));}
  function PetNote({title,children,kind='paw',className=''}){return h('section',{className:'pet-note '+className},h('h3',{className:'pet-note-title'},h(PetSeal,{kind,size:18}),title),children);}

  function PetSession(props){
    const key=props.storeKey||KEY,seed=useRef(null);if(!seed.current){seed.current=read(key);if(!seed.current.partnerId&&props.lockPartnerId)seed.current={...seed.current,partnerId:String(props.lockPartnerId)};}const owner=useRef(seed.current.id),ownerPartner=useRef(String(seed.current.partnerId||'')),frame=useRef(null),latest=useRef(props);latest.current=props;
    const neighborReturn=useRef(''),[neighborId,setNeighborId]=useState(''),[neighborView,setNeighborView]=useState(null),[neighborNotice,setNeighborNotice]=useState('');
    const dressReturn=useRef(''),viewReturn=useRef(''),petsReturn=useRef('');const [viewInfo,setViewInfo]=useState(null);const [petsView,setPetsView]=useState(null),[newPet,setNewPet]=useState(false),[petLoading,setPetLoading]=useState(false);
    const [parcelView,setParcelView]=useState(null);
    const caseRequest=useRef(false);const [caseBusy,setCaseBusy]=useState(false),[caseDetail,setCaseDetail]=useState(''),[caseDraft,setCaseDraft]=useState(null);
    const domesticReturn=useRef(''),[domesticView,setDomesticView]=useState(null),[domesticNotice,setDomesticNotice]=useState(''),[domesticCount,setDomesticCount]=useState(12),[celebrationGift,setCelebrationGift]=useState('');
    const albumReturn=useRef(''),[albumView,setAlbumView]=useState(null),[albumId,setAlbumId]=useState(''),[albumCount,setAlbumCount]=useState(12),[albumNotice,setAlbumNotice]=useState('');
    const [photoCount,setPhotoCount]=useState(12);const [careerTab,setCareerTab]=useState('today'),panelScroll=useRef(null),panelPositions=useRef({}),panelReturn=useRef(''),[careerView,setCareerView]=useState(null),[careerNotice,setCareerNotice]=useState(''),[careView,setCareView]=useState(null),[loaded,setLoaded]=useState(false),[panel,setPanel]=useState(''),[error,setError]=useState(''),[profile,setProfile]=useState({species:'cat',name:'猫猫',look:{id:'original'},weight:1,size:1});
    const current=()=>{const stall=vaultStalled(key);if(stall)throw Error(stall);const d=loadJSON(key,null)||seed.current;if(d.id!==owner.current||String(d.partnerId||'')!==ownerPartner.current)throw Error('存档已切换，请重新进入绒绒小镇。');return root.GameClock.archive(d);};
    const talking=useRef(false),alive=useRef(true),chatScroll=useRef(null),chatPosition=useRef({top:0,bottom:true});const kbLift=useKbLift(),livePanel=PET_LIVE_PANELS.includes(panel),pausesScene=!!panel&&!livePanel;const [draft,setDraft]=useState(''),[chatBusy,setChatBusy]=useState(false),[chatRows,setChatRows]=useState([]),[chatNotice,setChatNotice]=useState('');
    const splitBox=useRef(null),dragSplit=useRef(null),[chatRatio,setChatRatio]=useState(.5),ratioRef=useRef(.5),[splitHeight,setSplitHeight]=useState(0);ratioRef.current=chatRatio;
    const paperReturn=useRef(''),[togetherView,setTogetherView]=useState(null),[togetherNotice,setTogetherNotice]=useState(''),[togetherMode,setTogetherMode]=useState('shop'),[journalView,setJournalView]=useState(null),[journalDate,setJournalDate]=useState('');
    const panelState=useRef({panel,paused:pausesScene});panelState.current={panel,paused:pausesScene,live:livePanel};
    const record=()=>worldRecord(latest.current,key,'pets',current());
    const history=()=>worldHistory(latest.current,key,current(),'pets');
    const character=()=>{const d=current();return(latest.current.characters||[]).find(c=>String(c.id)===String(d.partnerId))||null;};
    const openChat=()=>{game()?.wakeCompanion?.();if(!talking.current)setChatRows(history().slice(-100));setPanel('chat');};
    const rememberChat=()=>{const el=chatScroll.current;if(el)chatPosition.current={top:el.scrollTop,bottom:el.scrollHeight-el.scrollTop-el.clientHeight<32};};
    const closeChat=()=>{rememberChat();chatScroll.current?.closest('section')?.querySelector('input')?.blur();setPanel('');};
    const game=()=>frame.current?.contentWindow.PetGame;
    const syncScene=()=>{frame.current?.contentDocument?.body?.classList.toggle('pet-chat-open',panelState.current.live);game()?.pause?.(panelState.current.paused);};
    const bind=node=>{if(frame.current&&frame.current!==node)hosts.delete(frame.current.contentWindow);frame.current=node;if(node)hosts.set(node.contentWindow,{load:current,chooseStation:()=>props.onStation(),travel:to=>leave(()=>props.onTravel(to,{station:true})),companion:()=>{const c=character();return c?{id:c.id,name:c.remark||c.name,ta:typeof CharacterPronoun!=='undefined'?CharacterPronoun.ta(c):'TA',persona:typeof c.persona==='string'?c.persona:''}:null;},openChat,openNeighbors:id=>{if(frame.current===node){neighborReturn.current=panelState.current.panel==='chat'?'chat':'';setNeighborId(id||'');setNeighborView(game()?.neighborhood());setNeighborNotice('');setPanel('neighbors');setError('');}},openParcel:data=>{if(frame.current===node){setParcelView(data);setPanel('parcel');setError('');}},openView:()=>{if(frame.current===node){rememberScroll();viewReturn.current=panelState.current.panel==='chat'?'chat':'';setViewInfo(game()?.observation());setPanel('view');setError('');}},openPets:()=>{if(frame.current===node){rememberScroll();petsReturn.current=panelState.current.panel==='chat'?'chat':'';setPetsView(game()?.roster());setPanel('pets');setError('');}},selectionChanged:()=>{if(frame.current===node)setPetsView(game()?.roster());},save:(state,id,journey)=>frame.current===node&&!!saveWorld(key,current,state,id,journey),openAlbum:id=>{if(frame.current===node){albumReturn.current=panelState.current.panel==='chat'?'chat':'';rememberScroll();setAlbumView(game()?.photos());setAlbumId(id||'');setAlbumNotice('');setPanel('album');}},openCareer:tab=>{if(frame.current===node){rememberScroll();panelReturn.current=panelState.current.panel==='chat'?'chat':'';setCareerTab(tab==='history'?'history':'today');setCareerNotice('');setCareerView(game()?.career());setPanel('career');setError('');}},openCare:()=>{if(frame.current===node){rememberScroll();panelReturn.current=panelState.current.panel==='chat'?'chat':'';setCareView(game()?.care());setPanel('care');setError('');}},ready:()=>{if(frame.current===node){setLoaded(true);setChatRatio(game()?.chatLayout().ratio??.5);syncScene();}}});};
    useEffect(()=>()=>{alive.current=false;if(frame.current)hosts.delete(frame.current.contentWindow);},[]);
    useEffect(()=>{const g=game();syncScene();if(loaded&&panel==='pet'&&g)g.preview(true);},[panel,loaded]);
    useEffect(()=>{if(!loaded||panel!=='career')return;const timer=setInterval(()=>{try{const g=game();if(g?.ready)setCareerView(g.career());}catch{}},1000);return()=>clearInterval(timer);},[panel,loaded]);
    useEffect(()=>{if(!loaded||!['care','pets','view'].includes(panel))return;const timer=setInterval(()=>{try{const g=game();if(!g?.ready)return;if(panel==='care')setCareView(g.care());else if(panel==='pets')setPetsView(g.roster());else setViewInfo(g.observation());}catch{}},1000);return()=>clearInterval(timer);},[panel,loaded]);
    useEffect(()=>{const el=chatScroll.current;if(panel!=='chat'||!el)return;const restore=()=>{el.scrollTop=chatPosition.current.bottom?el.scrollHeight:chatPosition.current.top;};restore();const observer=new ResizeObserver(restore);observer.observe(el);return()=>observer.disconnect();},[panel,chatRows,chatBusy,chatNotice]);

    useEffect(()=>{const el=splitBox.current;if(!el)return;const measure=()=>setSplitHeight(el.getBoundingClientRect().height),observer=new ResizeObserver(measure);measure();observer.observe(el);return()=>observer.disconnect();},[]);
    const commitSplit=value=>{try{current();if(!game()?.setChatRatio(value))throw Error('窗口大小还没有保存成功，请重试。');setChatRatio(game().chatLayout().ratio);setError('');}catch(e){setChatRatio(game()?.chatLayout().ratio??.5);setError(e.message);}};
    const splitMove=e=>{const drag=dragSplit.current;if(!drag||drag.id!==e.pointerId)return;const b=splitBox.current.getBoundingClientRect(),lift=panel==='chat'?kbLift:0,height=Math.max(1,b.height-lift),next=game().chatLayout((b.bottom-lift-e.clientY)/height,height).ratio;ratioRef.current=next;setChatRatio(next);};
    const splitFinish=(e,cancel=false)=>{const drag=dragSplit.current;if(!drag||drag.id!==e.pointerId)return;dragSplit.current=null;if(cancel){ratioRef.current=drag.start;setChatRatio(drag.start);}else commitSplit(ratioRef.current);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
    const splitKey=e=>{const values={ArrowUp:chatRatio+.05,ArrowDown:chatRatio-.05,Home:.28,End:.72};if(!Object.hasOwn(values,e.key))return;e.preventDefault();commitSplit(values[e.key]);};
    const showTogether=(mode='shop')=>{rememberScroll();paperReturn.current=panel;const view=game()?.together();setTogetherMode(view?.trip?.mode==='walk'?'walk':view?.trip?'shop':mode==='walk'?'walk':'shop');setTogetherView(view);setTogetherNotice('');setPanel('together');setError('');};
    const showWalk=()=>showTogether('walk');
    const showDomestic=()=>{rememberScroll();domesticReturn.current=panel;setDomesticView(game()?.domestic());setDomesticNotice('');setPanel('domestic');};
    const domesticAct=(action,options={})=>{try{current();const r=game()?.domesticAction(action,options);setDomesticView(game()?.domestic());setDomesticNotice(r?.text||'先等它空下来。');}catch(e){setDomesticNotice(e.message);}};
    const moveFurniture=(item,dx,dz,turn=0)=>{const q=item.point,r=game()?.careerAction('move-furniture',{item:item.id,point:{x:q.x+dx,z:q.z+dz,yaw:(q.yaw||0)+turn}});setDomesticView(game()?.domestic());setDomesticNotice(r?.text||'这个角落暂时放不下。');};
    useEffect(()=>{if(!loaded||panel!=='domestic')return;const timer=setInterval(()=>setDomesticView(game()?.domestic()),1000);return()=>clearInterval(timer);},[panel,loaded]);
    const showAlbum=()=>{rememberScroll();albumReturn.current=panel;setAlbumView(game()?.photos());setAlbumId('');setAlbumNotice('');setPanel('album');setError('');};
    const albumBack=()=>{rememberScroll();if(albumId)setAlbumId('');else {setPanel(albumReturn.current);albumReturn.current='';}};
    const albumAct=(action,id)=>{try{current();const r=game()?.albumAction(action,id);setAlbumView(game()?.photos());setAlbumNotice(r?.text||'这张照片还没准备好。');if(r?.accepted&&action==='delete')setAlbumId('');}catch(e){setAlbumNotice(e.message);}};
    const albumTake=()=>{try{current();const r=game()?.takePhoto();setAlbumNotice(r?.text||'先让TA和宠物走到一起。');if(r?.accepted){setAlbumView(game()?.photos());setAlbumId(r.id);}}catch(e){setAlbumNotice(e.message);}};
    const togetherAct=(action,shop)=>{try{current();const r=game()?.togetherAction(action,shop);setTogetherView(game()?.together());setTogetherNotice(r?.text||'等大家准备好再出发。');if(r?.accepted){setPanel(paperReturn.current==='chat'?'chat':'');setChatNotice(r.text);}}catch(e){setTogetherNotice(e.message);}};
    const showJournal=()=>{rememberScroll();paperReturn.current=panel;const view=game()?.journal();setJournalDate(view?.start||'');setJournalView(view);setPanel('journal');setError('');};
    const paperBack=()=>{rememberScroll();setPanel(paperReturn.current);paperReturn.current='';};
    const journalPick=date=>{rememberScroll();setJournalDate(date);setJournalView(game()?.journal(date));};
    useEffect(()=>{if(!loaded||!['together','journal'].includes(panel))return;const timer=setInterval(()=>{if(panel==='together')setTogetherView(game()?.together());else setJournalView(game()?.journal(journalDate));},1000);return()=>clearInterval(timer);},[loaded,panel,journalDate]);
    const scrollKey=(panel==='album'?'album:'+albumId:panel==='journal'?'journal:'+journalDate:panel==='neighbors'?'neighbors:'+neighborId:panel==='career'?'career:'+careerTab:panel)+(['career','care'].includes(panel)?':'+(game()?.snapshot().activePetId||''):'');const rememberScroll=()=>{panelPositions.current[scrollKey]=panelScroll.current?.scrollTop||0;};
    useEffect(()=>{if(!panelScroll.current)return;panelScroll.current.scrollTop=panelPositions.current[scrollKey]||0;},[panel,careerTab,neighborId,petsView?.activePetId,journalDate,albumId]);
    useEffect(()=>{if(!loaded||panel!=='neighbors')return;const timer=setInterval(()=>{try{setNeighborView(game()?.neighborhood());}catch{}},1000);return()=>clearInterval(timer);},[panel,loaded]);
    const showNeighbors=()=>{rememberScroll();neighborReturn.current=panel;setNeighborId('');setNeighborView(game()?.neighborhood());setNeighborNotice('');setPanel('neighbors');setError('');};
    const neighborBack=()=>{rememberScroll();if(neighborId){setNeighborId('');setNeighborNotice('');}else {setPanel(neighborReturn.current);neighborReturn.current='';}};
    const neighborAct=(action,id)=>{try{current();const r=game()?.neighborAction(action,id);setNeighborView(game()?.neighborhood());setNeighborNotice(r?.text||'街坊还没准备好。');if(r?.accepted&&action==='join')game()?.goGathering();if(r?.accepted&&['greet','deliver','join','invite','end-visit','leave-event','pet-greet','pet-play','pet-together','guest-invite','guest-play','guest-quiet','guest-guard','guest-end'].includes(action))setPanel('');}catch(e){setNeighborNotice(e.message);}};
    const neighborGo=(id,event=false)=>{try{current();if(!(event?game()?.goGathering():game()?.goNeighbor(id)))throw Error('暂时走不过去，稍后再试。');setPanel('');}catch(e){setNeighborNotice(e.message);}};
    const showCareer=()=>{rememberScroll();panelReturn.current=['travel','pets','care','domestic'].includes(panel)?panel:'';setCareerView(game()?.career());setCareerNotice('');setPanel('career');setError('');};
    const companyWork=(action,options={})=>{const result=game()?.companyAction(action,options);setCareerView(game()?.career());setCareerNotice(result?.text||'先等它们空下来。');if(result?.accepted&&action==='review')setPanel('');};
    const work=(action,options={})=>{if(caseRequest.current)return;const result=game()?.careerAction(action,options);setCareerView(game()?.career());setCareerNotice(result?.text||'正在打开进度…');if(result?.accepted&&!result.keepPanel&&['invite','bribe','choose','resume'].includes(action))setPanel('');};
    const receiveCase=draft=>{const g=game();current();if(g?.snapshot().activePetId!==draft.petId||g?.career().day!==draft.day)throw Error('同行的小家伙或日子变了，这封消息仍属于原来的小家伙。');if(!g.flush())throw Error('这封已写好，保存还没成功。重试收下即可，不会重新调用模型。');const saved=g.careerAction('prepare-case',{definition:draft.definition,day:draft.day});if(!saved.accepted)throw Error(saved.text);setCaseDraft(null);setCareerView(g.career());setCareerNotice(saved.text);};
    const retryCase=()=>{try{receiveCase(caseDraft);}catch(e){setCareerNotice(e.message);}};
    const newModelCase=async()=>{
      if(caseRequest.current)return;caseRequest.current=true;setCaseBusy(true);setCaseDetail('');setCaseDraft(null);setCareerNotice('正在等小巷的一封新消息…');
      const node=frame.current,g=game(),petId=g?.snapshot().activePetId,day=g?.career().day;
      try{
        current();if(!g?.flush())throw Error('进度还没保存成功，请先重试保存。');
        const p=latest.current,c=character(),world=g.chatContext();
        if(world.career.job||world.career.daily.invited||world.career.daily.closed||world.career.daily.rest||world.career.detective.prepared)throw Error('先陪完眼前的消息，下一天再接新的。');
        const definition=await generatePetCase({active:c&&p.apiFor?p.apiFor(c.id):p.active,world});
        if(!alive.current||frame.current!==node)return;current();
        if(game()?.snapshot().activePetId!==petId||game()?.career().day!==day)throw Error('同行的小家伙或日子变了，这份消息没有覆盖新进度。');
        const pending={definition,petId,day};setCaseDraft(pending);receiveCase(pending);
      }catch(e){if(alive.current&&frame.current===node){setCareerNotice(e.message||'这封消息暂时没到，仍可以玩本地小案。');setCaseDetail(e.detail||'');setCareerView(game()?.career());}}
      finally{caseRequest.current=false;if(alive.current)setCaseBusy(false);}
    };
    const showCare=()=>{rememberScroll();panelReturn.current=['travel','pets','domestic'].includes(panel)?panel:'';setCareView(game()?.care());setPanel('care');setError('');};
    const edit=()=>{rememberScroll();setNewPet(false);panelReturn.current=['travel','pets','care','domestic'].includes(panel)?panel:'';const g=game();if(!g)return;setProfile(g.snapshot().profile);setPanel('pet');setError('');};
    useEffect(()=>{if(loaded&&!game()?.snapshot().configured)edit();},[loaded]);
    const change=patch=>{const next={...profile,...patch};setProfile(next);game()?.applyProfile(next);};
    const refreshPets=()=>setPetsView(game()?.roster());
    const editCompanion=()=>{try{current();game().getLook();rememberScroll();dressReturn.current=panel;setPanel('companion-dress');setError('');}catch(e){setError(e.message);}};
    const finishDress=()=>{try{if(!game()?.flush())throw Error('外貌还没有保存成功，请留在这里重试。');if(dressReturn.current==='view')setViewInfo(game()?.observation());setPanel(dressReturn.current);dressReturn.current='';setError('');}catch(e){setError(e.message);}};
    const showView=()=>{rememberScroll();viewReturn.current=panel==='travel'?'travel':'';setViewInfo(game()?.observation());setPanel('view');setError('');};
    const viewWho=async(kind,id)=>{const result=await game()?.watch(kind,id);if(!result?.accepted){setError(result?.text||'镜头还没有准备好。');return;}setPanel('');setError('');};
    const showPets=()=>{rememberScroll();petsReturn.current=panel==='travel'?'travel':'';refreshPets();setPanel('pets');setError('');};
    const choosePet=async(id,page='care')=>{rememberScroll();const result=await game()?.selectPet(id);if(!result?.accepted){setError(result?.text||'还没有准备好。');return;}refreshPets();setError('');panelReturn.current='pets';if(page==='pet'){setNewPet(false);setProfile(game().snapshot().profile);}else if(page==='career'){setCareerView(game().career());setCareerNotice('');}else setCareView(game().care());setPanel(page);};
    const addPet=async()=>{if(petLoading)return;setPetLoading(true);setError('');try{const result=await game()?.beginAdd();if(!result?.accepted)throw Error(result?.text||'还没有准备好。');setNewPet(true);panelReturn.current='pets';setProfile(result.profile);setPanel('pet');}catch(e){setError(e.message);}finally{setPetLoading(false);}};
    const cancel=()=>{game()?.cancelProfile();refreshPets();if(panelReturn.current==='care')setCareView(game()?.care());setNewPet(false);setPanel(panelReturn.current);panelReturn.current='';};
    const savePet=()=>{try{if(!game()?.commitProfile(profile))throw Error('宠物设置没有保存成功，请留在这里重试。');game().preview(false);refreshPets();setPanel(newPet?'pets':'');setNewPet(false);setError('');}catch(e){setError(e.message);}};
    const leave=async action=>{try{if(talking.current)throw Error('同行者正在回复，等这句说完再离开。');if(!game()?.ready||!game()?.flush())throw Error('进度还没有保存成功，请留在这里重试。');return await action();}catch(e){setError(e.message);props.toast(e.message);return false;}};
    async function sendChat(e){e.preventDefault();const text=draft.trim(),c=character(),node=frame.current;if(!text||!c||talking.current)return;talking.current=true;setChatBusy(true);setError('');setChatNotice('');
      // Her line shows the moment she sends it; if the reply fails it goes back into the box instead of staying as if delivered.
      chatPosition.current.bottom=true;const sent={role:'user',content:text};setChatRows(rows=>[...rows,sent].slice(-100));setDraft('');try{
      if(!game()?.flush())throw Error('进度还没有保存成功，请先重试保存。');
      const p=latest.current,cid=c.id,world=game().chatContext();const account=root.Cloud?.getSessionUser?await root.Cloud.getSessionUser().catch(()=>null):null;
      const out=await ask({active:p.apiFor?p.apiFor(cid):p.active,character:c,profile:p.profile,world,history:history().slice(-100),text,mainline:worldMainline(p,key,current(),'pets',cid),engineer:!!p.isEngineer?.(cid)});
      const accountNow=root.Cloud?.getSessionUser?await root.Cloud.getSessionUser().catch(()=>null):null;
      if(!alive.current||frame.current!==node||String(current().partnerId)!==String(cid)||String(account?.id||'')!==String(accountNow?.id||''))throw Error('角色或存档已经变更，这句回复没有写入其他房间。');
      const parts=out.parts||[out.reply];storeWorldTurn(key,current,record(),cid,text,out,200,'pets');
      setChatRows(rows=>[...rows,...parts.map(content=>({role:'assistant',content}))].slice(-100));
      if(out.workChoice){const result=game().snapshot().activePetId!==world.activePetId?{text:'同行的小家伙变了，这个主意留给原来那只。'}:game().careerAction('choose',{...out.workChoice,by:c.remark||c.name});setChatNotice(result.text);}
      if(out.petAction){const result=game().companionAction(out.petAction,out.petId||world.activePetId);setChatNotice(result.text);}
    }catch(e){if(alive.current){setChatRows(rows=>rows.filter(row=>row!==sent));setDraft(d=>d||text);setError(e.message||'这次没能连上，可以重试。');}}finally{talking.current=false;if(alive.current)setChatBusy(false);}}
    const field={width:'100%',minHeight:42,border:'1px solid #ccd4be',borderRadius:12,padding:'8px 10px',background:'#fffdf5',color:'var(--pet-ink)' ,fontFamily:'inherit',fontSize:16};
    const plate=(title,body)=>h('section',{className:'pet-edit-field'},h('label',null,title),body);
    const palette=(game()?.palettes||[]).map(p=>[p.label,p.base,p.patch]),furColors=game()?.furColors?.()||{};
    const drawerLift=panel==='chat'?kbLift:0,drawerHeight=Math.max(0,splitHeight-drawerLift);
    const split=game()?.chatLayout(chatRatio,drawerHeight)||{scenePercent:50};
    const d=current(),c=(props.characters||[]).find(x=>String(x.id)===String(d.partnerId)),petProfileView=game()?.snapshot().profile||profile;
    const drawerControls={onPointerDown:e=>{if(e.button)return;e.preventDefault();dragSplit.current={id:e.pointerId,start:chatRatio};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:splitMove,onPointerUp:e=>splitFinish(e),onPointerCancel:e=>splitFinish(e,true),onLostPointerCapture:e=>splitFinish(e,true),onKeyDown:splitKey,onDoubleClick:()=>commitSplit(.5)};
    const paperDrawer={top:split.scenePercent*(splitHeight?drawerHeight/splitHeight:1),lift:drawerLift,ratio:chatRatio,controls:drawerControls,title:({care:'看看'+petProfileView.name,career:'宠物职业生涯',pets:'家里的宠物',view:'镜头看谁',neighbors:neighborView?.neighbors.find(n=>n.id===neighborId)?.name||'街坊与小约定',journal:'小镇周记',together:togetherMode==='walk'?'两人同行遛宠物':'结伴逛街',parcel:'回家拆袋子',travel:'小镇菜单',album:albumId?'这一张生活照':'小镇生活相册',domestic:'家里的小日子'})[panel]||petProfileView.name+'的小日子',close:()=>{rememberScroll();setPanel('');setError('');}};

    return h('div',{ "data-wk": "fgpetpage", className:'pet-session h-full flex flex-col '+(panel?'pet-paper-open':''),'data-pet-world':true,style:{color:'var(--pet-ink)' }},
      h('link',{rel:'stylesheet',href:'apps/pets/panels.css?v='+BUILD}),
      h(Head,{zh:livePanel?'绒绒小镇':panel==='domestic'?'家里的小日子':panel==='album'?(albumId?'这一张生活照':'小镇生活相册'):panel==='together'?(togetherMode==='walk'?'两人同行遛宠物':'结伴逛街'):panel==='journal'?'小镇周记':panel==='neighbors'?(neighborView?.neighbors.find(n=>n.id===neighborId)?.name||'街坊与小约定'):panel==='companion-dress'?'TA的外貌':panel==='view'?'镜头看谁':panel==='parcel'?'回家拆袋子':panel==='career'?'宠物职业生涯':panel==='care'?'看看它':panel==='pets'?'家里的宠物':panel==='pet'?(newPet?'迎接新宠物':'宠物预览'):panel==='travel'?'去哪里':'绒绒小镇',sub:loaded&&!pausesScene?game()?.snapshot().profile.name:undefined,bg:'transparent',ink:'var(--pet-ink)',subInk:'var(--pet-soft)',lineInk:'rgba(117,97,91,.14)',onBack:panel==='domestic'?()=>{rememberScroll();setPanel(domesticReturn.current);}:panel==='album'?albumBack:['together','journal'].includes(panel)?paperBack:panel==='neighbors'?neighborBack:panel==='companion-dress'?finishDress:panel==='view'?()=>{rememberScroll();setPanel(viewReturn.current);viewReturn.current='';}:panel==='parcel'?()=>setPanel(''):panel==='chat'?closeChat:panel==='pets'?()=>{rememberScroll();setPanel(petsReturn.current);petsReturn.current='';}:panel==='career'||panel==='care'?()=>{rememberScroll();refreshPets();setPanel(panelReturn.current);panelReturn.current='';}:panel==='travel'?()=>setPanel(''):panel==='pet'?()=>{cancel();if(!newPet&&!current().worlds?.pets?.configured)leave(props.onBack);}:()=>loaded?leave(props.onBack):props.onBack(),right:loaded&&!pausesScene?h('button',{onClick:()=>setPanel('travel'),style:{minHeight:40,padding:'8px 12px'}},'小镇菜单'):null}),
      h('div',{ref:splitBox,className:'flex-1 min-h-0',style:{position:'relative'}},
        h('iframe',{ref:bind,title:'绒绒小镇游戏',src:'apps/pets/index.html?v='+BUILD,style:{position:'absolute',inset:0,width:'100%',height:'100%',border:0,display:'block',visibility:pausesScene&&panel!=='pet'?'hidden':'visible'},onLoad:()=>{if(game()?.ready)setLoaded(true);}}),
        !loaded&&h('p',{role:'status',style:{position:'absolute',top:10,left:20,right:20}},'正在打开宠物街区…'),
        error&&panel!=='chat'&&h('p',{role:'alert',style:{position:'absolute',left:10,right:10,bottom:panel==='pet'?'64%':70,zIndex:12,background:'#fff5e7',padding:10,color:'#994a36'}},error),
        panel==='chat'&&h(PetWindow,{page:'chat',drawer:{...paperDrawer,chat:true,title:'和'+(c?.remark||c?.name||'TA')+'说话',close:closeChat}},
          h('div',{ "data-wk": "fgmsgs", "data-part": "pet", ref:chatScroll,className:'flex-1 min-h-0 overflow-y-auto',onScroll:rememberChat,style:{padding:'8px 14px'}},
            h('div',{className:'pet-chat-note'},h(PetSeal,{kind:'paw',size:24}),h('p',null,'场景继续活动，拖动上边的小把手调大小。'),h('button',{className:'pet-text-button',onClick:showTogether},'结伴安排'),h('details',null,h('summary',null,'关于这一档的对话'),h('p',null,'这里只显示这一档在绒绒小镇说过的话，手机房间仍能看全。记忆权限沿用本房间设置；照料会在窗口后的场景实际进行。'))),
            h(LegacyWorldDialogs,{record:record(),archive:current(),cid:c?.id}),
            ...chatRows.map((m,i)=>h('div',{ "data-wk": "fgmsg", "data-part": "pet", "data-me": m.role === "user" ? "1" : "0", key:i,className:'pet-chat-row '+(m.role==='user'?'pet-chat-you':'pet-chat-ta')},h('span',{className:'pet-chat-author'},m.role==='user'?'你':c?.remark||c?.name||'TA'),h('p',{className:'pet-chat-bubble'},m.content))),
            error&&h('p',{role:'alert',className:'pet-message'},error),chatBusy&&h('p',{role:'status'},'TA正在回复…'),chatNotice&&h('p',{role:'status',style:{fontSize:13,lineHeight:1.8}},chatNotice),
            h('div',{'aria-label':'请TA照料宠物',className:'pet-chat-care-actions'},...[['feed','请TA添粮'],['play','请TA陪玩'],['pet','请TA摸摸']].map(([action,label])=>h('button',{key:action,className:'pet-chat-care-action',onClick:()=>{const result=game()?.companionAction(action);setChatNotice(result?.text||'先回家吧。');}},label)))),
          h('form',{ "data-wk": "fgcompose", "data-part": "pet", className:'pet-chat-composer',onSubmit:sendChat,style:{display:'flex',gap:8,padding:'8px 12px',paddingBottom:COMPOSER_PAD_BOTTOM,minHeight:56,borderTop:'1px solid '+G.line,flexShrink:0}},h('input',{'aria-label':'对同行者说',value:draft,onChange:e=>setDraft(e.target.value),disabled:chatBusy||!c,maxLength:12000,placeholder:'和TA说句话…',style:{...field,flex:1,minWidth:0}}),h('button',{type:'submit',disabled:chatBusy||!c||!draft.trim(),style:{...field,width:'auto',background:G.deep,color:'#fffaf1'}},'发送'))),
        panel==='pet'&&h('div',{'data-pet-settings':true,className:'pet-edit-page flex flex-col',style:{position:'absolute',top:'38%',left:0,right:0,bottom:0}},
          h('div',{className:'flex-1 min-h-0 overflow-y-auto',style:{padding:'0 18px 12px'}},
            plate('宠物',h('div',{style:{display:'flex',gap:10}},[['cat','猫咪'],['dog','狗狗']].map(([species,label])=>h('button',{className:'pet-species-choice',key:species,'aria-label':'选择'+label,'aria-pressed':profile.species===species,onClick:()=>change(game().speciesProfile(profile,species)),style:{...field,borderBottom:'3px solid '+(profile.species===species?G.deep:G.line),transform:profile.species===species?'translateY(-2px)':'none'}},label)))),
            plate('名字',h('input',{'aria-label':'宠物名字',maxLength:24,value:profile.name,onChange:e=>change({name:e.target.value}),style:field})),
            plate('毛色',h('div',{style:{display:'flex',flexWrap:'wrap',gap:6}},palette.map(([label,base,patch])=>h('button',{className:'pet-coat-swatch',key:label,'aria-label':label+'毛色','aria-pressed':base?profile.look?.patch===patch:profile.look?.id==='original',onClick:()=>change({look:base?{id:'custom',base,patch}:{id:'original'}}),style:{'--pet-coat-base':base||'#eee9e0','--pet-coat-patch':patch||'#afa199'}},h('span',{className:'pet-coat-colors'}),h('span',null,label))))),
            plate('自选毛色',h('div',{style:{display:'flex',gap:12}},[['底毛','base'],['花纹','patch']].map(([label,k])=>h('label',{key:k,style:{display:'flex',alignItems:'center',gap:6}},label,h('input',{type:'color','aria-label':label+'颜色',value:profile.look?.[k]||furColors[k],onChange:e=>change({look:{id:'custom',base:profile.look?.base||furColors.base,patch:profile.look?.patch||furColors.patch,[k]:e.target.value}}),style:{width:48,height:42}}))))),
            ...[['胖瘦','weight',.8,1.25],['大小','size',.7,1.3]].map(([label,k,min,max])=>plate(label+' · '+Math.round(profile[k]*100)+'%',h('input',{type:'range','aria-label':label,min,max,step:.01,value:profile[k],onChange:e=>change({[k]:Number(e.target.value)}),style:{width:'100%',minHeight:40,accentColor:G.deep}}))),
            h('p',{style:{fontSize:11,color:G.soft}},'实时预览；名字、毛色与体型只属于这一档宠物。')),
          h('div',{style:{display:'flex',gap:10,padding:'8px 18px',paddingBottom:COMPOSER_PAD_BOTTOM,minHeight:56,borderTop:'1px solid '+G.line}},h('button',{onClick:()=>{change({species:profile.species,name:profile.species==='dog'?'狗狗':'猫猫',look:{id:'original'},weight:1,size:1});},style:{...field,width:'auto'}},'复位'),h('button',{onClick:savePet,style:{...field,flex:1,background:G.deep,color:'#fffaf1'}},'保存并进入'))),

        panel==='domestic'&&domesticView&&h(PetPanel,{page:'domestic',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:()=>{rememberScroll();setPanel(domesticReturn.current);}},'回到小镇')},
          h('div',{className:'pet-town-sign'},h(PetSeal,{kind:'home',size:42}),h('div',null,h('h2',null,domesticView.name+'的小日子'),h('p',null,'自己的心愿、你们做的点心和一起过的纪念日。'))),
          domesticNotice&&h('p',{className:'pet-quiet',role:'status'},domesticNotice),
          domesticView.task&&h(PetNote,{title:domesticView.task.petName+' · '+(domesticView.task.kind==='cook'?'小料理盘旁':'围过来过纪念日'),kind:'bread'},h('p',{className:'pet-quiet'},domesticView.task.phase==='walking'?'先等它和你们实际走到身边。':domesticView.task.kind==='cook'?(domesticView.task.phase==='mix'?'正在把零食泡软、捣开。':'正在分成一口大的小点。'):'正陪它待一会儿，纪念和照片做完才留下。'),h('button',{className:'pet-button',onClick:()=>domesticAct('cancel')},'这次先收好')),
          h(PetNote,{title:'它自己的小心愿',kind:'paw'},domesticView.wish?h(React.Fragment,null,h('p',{className:'pet-wish-title'},domesticView.wish.title),h('p',{className:'pet-footnote'},'从 '+domesticView.wish.created+' 留下；'+(domesticView.wish.paused?'先搁在心里。':'实际睡过、吃过、送过或相处过，才会变成它的记忆。')),h('div',{className:'pet-care-actions'},h('button',{className:'pet-button',onClick:()=>domesticAct(domesticView.wish.paused?'wish-resume':'wish-pause')},domesticView.wish.paused?'再拿出来看看':'先不着急完成'),['bed','corner'].includes(domesticView.wish.kind)&&h('button',{className:'pet-button',onClick:()=>{showCareer();setCareerTab('pocket');}},'翻它的零钱袋'),domesticView.wish.kind==='gift'&&h('button',{className:'pet-button',onClick:showNeighbors},'去找这个小伙伴'),domesticView.wish.kind==='friends'&&h('button',{className:'pet-button',onClick:showCare},'看看家里的伙伴'))):h('p',{className:'pet-quiet'},'刚实现的心愿先留在记忆里，下一天再慢慢长出新想法。')),
          h('details',{className:'pet-domestic-section',open:true},h('summary',null,h(PetSeal,{kind:'paw',size:22}),'生日和领养纪念日'),...domesticView.occasions.map(o=>h('section',{key:o.id,className:'pet-home-good'},h('strong',null,o.name+' · '+o.date),h('p',{className:'pet-quiet'},o.done?'今年这一天已经陪它过了。':o.today?'今天是它的日子，可以等TA回家一起围过来。':'到真实日期的当天，再一起准备。'),o.today&&!o.done&&h(React.Fragment,null,h('label',{className:'pet-quiet'},'给它选的纪念礼物',h('select',{className:'pet-button','aria-label':'纪念日的小礼物',value:celebrationGift,onChange:e=>setCelebrationGift(e.target.value)},h('option',{value:''},'陪着它就很好'),...domesticView.furniture.map(x=>h('option',{key:x.id,value:x.id},x.name)))),h('button',{className:'pet-button',disabled:!!domesticView.task||!domesticView.companion,onClick:()=>domesticAct('celebrate',{occasion:o.id,gift:celebrationGift})},'约TA一起陪它过'+o.name),h('p',{className:'pet-footnote'},'熟悉的街坊可以先沿原来的路来家里，到了再一起庆祝。'),...domesticView.neighbors.filter(n=>n.canInvite).map(n=>h('button',{key:n.id,className:'pet-button',onClick:()=>{const r=game()?.neighborAction('guest-invite',n.id);setDomesticNotice(r?.text||'先等朋友空下来。');}},'请'+n.name+'来家里')))))),
          h('details',{className:'pet-domestic-section',open:true},h('summary',null,h(PetSeal,{kind:'bread',size:22}),'和TA做一口小点心'),h('p',{className:'pet-footnote'},'用它已有的宠物零食，做完才扣材料。每份两小口，等愿意时再尝。'),...domesticView.recipes.map(recipe=>h('section',{key:recipe.id,className:'pet-home-good'},h('strong',null,recipe.name),h('p',{className:'pet-quiet'},recipe.detail),h('p',{className:'pet-footnote'},'需要自己的零食 '+recipe.ingredients.snack+' 份 · '+(recipe.available?'材料已收好':'材料还不够')),h('div',{className:'pet-care-actions'},...['you',...(domesticView.companion?['companion']:[])].map(actor=>h('button',{key:actor,className:'pet-button',disabled:!recipe.available||!!domesticView.task||!!domesticView.serving,onClick:()=>domesticAct('cook',{recipe:recipe.id,actor})},actor==='you'?'我来做':'和TA一起做'))),recipe.taste.count>0&&h('p',{className:'pet-footnote'},'尝过 '+recipe.taste.count+' 次 · '+(recipe.taste.liked?'喜欢过这个口感':'还在挑喜欢的口感')+' · '+Object.values(recipe.taste.makers).map(x=>x.name+'做过的，吃了'+x.count+'口').join('、')))),domesticView.serving&&h('p',{className:'pet-quiet'},'它正在尝这一小口，吃完才记口味。'),...domesticView.batches.map(batch=>h('section',{key:batch.id,className:'pet-home-good'},h('strong',null,batch.name+'做的'+batch.title),h('p',{className:'pet-footnote'},'还留着 '+batch.remaining+' 小口'),h('button',{className:'pet-button',disabled:!!domesticView.task||!!domesticView.serving,onClick:()=>domesticAct('serve',{id:batch.id})},'拿一小口给它尝')))),
          h('details',{className:'pet-domestic-section'},h('summary',null,h(PetSeal,{kind:'home',size:22}),'布置自己的小角落'),h('p',{className:'pet-footnote'},'小窝和垫子可以自由挪动、转向；会检查家具、宠物和门口。点摆好的小窝，它实际走过去休息。'),!domesticView.furniture.length&&h('button',{className:'pet-button',onClick:()=>{showCareer();setCareerTab('pocket');}},'先用自己的零钱挑个小窝'),...domesticView.furniture.map(item=>h('section',{key:item.id,className:'pet-home-good'},h('strong',null,item.name),h('div',{className:'pet-furniture-directions'},...[[0,-.25,'往窗边'],[-.25,0,'往左挪'],[.25,0,'往右挪'],[0,.25,'往门口']].map(([x,z,label])=>h('button',{key:label,className:'pet-button',onClick:()=>moveFurniture(item,x,z)},label)),h('button',{className:'pet-button',onClick:()=>moveFurniture(item,0,0,Math.PI/4)},'转一下'),h('button',{className:'pet-button',onClick:()=>{const r=game()?.careerAction('own-rest',{item:item.id});setDomesticNotice(r?.text||'先等它空下来。');}},'请它去歇歇'))))),
          domesticView.neighbors.some(n=>n.atHome)&&h(PetNote,{title:'朋友到家里了',kind:'leaf'},...domesticView.neighbors.filter(n=>n.atHome).map(n=>h('div',{key:n.id},h('p',{className:'pet-quiet'},'可以把一件自己的小东西分给'+n.name+'。'),...domesticView.gifts.map(item=>h('button',{key:item,className:'pet-button',onClick:()=>domesticAct('gift',{peer:n.id,item})},'送'+({flower:'小花',sticker:'贴纸',bookmark:'书签',coaster:'杯垫'}[item])))))),
          h(PetNote,{title:'一起留下的记忆',kind:'book'},domesticView.memories.length?h('ol',{className:'pet-diary-lines'},...domesticView.memories.slice(0,domesticCount).map(m=>h('li',{key:m.id},h('small',null,new Date(m.at).toLocaleDateString()),h('p',null,m.text)))):h('p',{className:'pet-quiet'},'等真正一起做过的小事留下来。'),domesticView.memories.length>domesticCount&&h('button',{className:'pet-text-button',onClick:()=>setDomesticCount(n=>n+12)},'再翻12件小事'))),

        panel==='album'&&albumView&&h(PetPanel,{page:'album',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:albumId?()=>{rememberScroll();setAlbumId('');}:()=>setPanel('')},albumId?'回到相册':'回到场景')},
          albumNotice&&h('p',{className:'pet-quiet',role:'status'},albumNotice),
          albumId?(()=>{const photo=albumView.photos.find(x=>x.id===albumId);return photo?h('div',{'data-living-photo':photo.id},h('figure',{className:'pet-living-print'},h('img',{src:photo.image,alt:photo.personName+'和'+photo.petName+'在'+photo.place+'的生活照',width:640,height:480}),h('figcaption',null,h('strong',null,photo.personName+'和'+photo.petName),h('p',null,photo.caption),h('small',null,new Date(photo.at).toLocaleDateString()+' · '+photo.time+' · '+photo.place+' · '+photo.season+' '+photo.weather))),h('div',{className:'pet-care-actions'},h('a',{className:'pet-button',href:photo.image,download:photo.petName+'-小镇生活照.jpg'},'保存这张照片'),h('button',{className:'pet-button',onClick:()=>albumAct(albumView.wallPhotoId===photo.id?'take-down':'display',photo.id)},albumView.wallPhotoId===photo.id?'从墙上收回相册':'摆到家里的墙上'),h('details',{className:'pet-photo-remove'},h('summary',null,'整理这张照片'),h('p',{className:'pet-footnote'},'移走后，这一档相册和墙上都会收起它。可以先保存到手机。'),h('button',{className:'pet-button',onClick:()=>albumAct('delete',photo.id)},'从这一档移走这张照片')))):h('p',{className:'pet-quiet'},'这张照片已经收起了。');})():h(React.Fragment,null,
            h('div',{className:'pet-town-sign'},h(PetSeal,{kind:'book',size:42}),h('div',null,h('h2',null,'一起生活的照片'),h('p',null,'你给TA和宠物拍下当时的真实模样。'))),
            h('button',{className:'pet-button',onClick:albumTake},'给TA和宠物拍一张'),
            !albumView.photos.length&&h(PetNote,{title:'等第一张同框照片',kind:'paw'},h('p',{className:'pet-quiet'},'让TA和宠物走到同一个地方，在场景上点「拍照」。追球、歇脚和在家陪伴，都能留下这一刻。')),
            h('div',{className:'pet-work-photos pet-living-photos'},...albumView.photos.slice(-albumCount).reverse().map(photo=>h('figure',{key:photo.id},h('button',{'aria-label':'查看'+photo.petName+'的生活照',onClick:()=>{rememberScroll();setAlbumId(photo.id);setAlbumNotice('');}},h('img',{src:photo.image,alt:photo.personName+'和'+photo.petName,width:640,height:480,loading:'lazy'})),h('figcaption',null,h('strong',null,photo.personName+'和'+photo.petName),h('small',null,new Date(photo.at).toLocaleDateString()+' · '+photo.place),albumView.wallPhotoId===photo.id&&h('small',null,'这一张在家里的墙上'))))),
            albumView.photos.length>albumCount&&h('button',{className:'pet-text-button',onClick:()=>setAlbumCount(n=>n+12)},'再翻12张照片'),h('p',{className:'pet-footnote'},'点开照片可以保存到手机，也能挑一张摆在家里的墙上。照片保存在这一档里。'))),
        panel==='together'&&togetherView&&h(PetPanel,{page:'together',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:()=>setPanel(paperReturn.current==='chat'?'chat':'')},'回到场景')},
          h(PetNote,{title:togetherView.trip?'这次一起出门':togetherMode==='walk'?'约好，带它出去走走':'约好，一起走',kind:'paw'},
            h('p',{className:'pet-quiet'},togetherView.trip?(togetherView.trip.mode==='walk'?togetherView.trip.status+'。':togetherView.trip.petName+'和'+togetherView.trip.personName+(togetherView.trip.phase==='browse'?'已经到'+togetherView.trip.title+'，正在一起逛逛。':togetherView.trip.phase==='home'?'正在沿路一起回家。':'正在沿路去'+togetherView.trip.title+'。')):togetherView.personName?(togetherMode==='walk'?'你和'+togetherView.personName+'约好带'+togetherView.petName+'出门。点街道自由带路，走在前面的会等等同伴。':'带'+togetherView.petName+'和'+togetherView.personName+'一起去小店，走在前面的会等等同伴。'):'先选好这一档的同行者，再来约一起出门。'),
            h('p',{className:'pet-footnote'},togetherMode==='walk'?'出门后，街边托盘可以歇歇、追球或摸摸；点街道或「继续走」再出发，也能开着半窗边走边聊，最后一起回家。':'大家吃饱、休息好并且空闲时出发。可以一路开着聊天；到了店里再点家具看看。'),h('p',{className:'pet-footnote'},'吃饭、休息或正忙时先等大家空下来；离开小镇超过一分钟，这次散步先结束，回来继续各自的日子。')),
          togetherView.reason&&h('p',{className:'pet-quiet'},togetherView.reason),togetherNotice&&h('p',{role:'status',className:'pet-quiet'},togetherNotice),
          togetherView.trip?h('div',{className:'pet-care-actions'},
            h('button',{className:'pet-button',onClick:openChat},'边走边聊'),
            ...(togetherView.trip.mode==='walk'?[['pause','路边歇歇'],['play','陪它追球'],['pet','停下来摸摸'],['resume','继续沿街走'],['notice','陪它看看路边']].map(([action,label])=>h('button',{key:action,className:'pet-button',disabled:!togetherView.trip.outsideReady||togetherView.trip.phase==='home'||['play','pet'].includes(action)&&!!togetherView.trip.play,onClick:()=>togetherAct(action)},label)):[]),
            h('button',{className:'pet-button',disabled:togetherView.trip.phase==='home',onClick:()=>togetherAct('home')},'一起回家'),h('button',{className:'pet-button',onClick:()=>togetherAct('stop')},'结束这次散步')):
            togetherMode==='walk'?h('button',{className:'pet-button pet-button-primary',disabled:!togetherView.personName,onClick:()=>togetherAct('walk-start')},'约TA一起遛宠物'):
            h('div',{className:'pet-town-routes'},...togetherView.shops.map(shop=>h('button',{key:shop.id,className:'pet-town-route',disabled:!togetherView.personName,onClick:()=>togetherAct('start',shop.id)},h(PetSeal,{kind:shop.id==='florist'?'leaf':shop.id==='cafe'?'cup':shop.id==='bakery'?'bread':'bag',size:28}),h('span',null,h('strong',null,'一起去'+shop.title),h('small',null,'沿路走到店里，再慢慢逛')),h(PetSeal,{kind:'arrow',size:17})))),
          togetherMode==='walk'&&togetherView.habits&&h(PetNote,{title:'它慢慢记住的散步习惯',kind:'paw'},h('p',{className:'pet-quiet'},togetherView.habits.detail),h('p',{className:'pet-footnote'},togetherView.habits.pace),...togetherView.habits.spots.map((spot,i)=>h('div',{key:i,className:'pet-home-good'},h('p',null,'常'+spot.label+'的位置 · 实际陪过 '+spot.visits+' 次'),togetherView.trip&&h('button',{className:'pet-button',disabled:!togetherView.trip.outsideReady||['home','wipe'].includes(togetherView.trip.phase),onClick:()=>togetherAct('favorite',{kind:spot.kind,point:spot.point,friendId:spot.friendId})},'一起去这个老地方'))),togetherView.habits.wetPaws&&h('p',{className:'pet-footnote'},'刚在雨里走过，回家后会陪它擦爪。'),...togetherView.habits.recent.slice(0,4).map(x=>h('p',{key:x.id,className:'pet-footnote'},x.text)))),
        panel==='journal'&&journalView&&h(PetPanel,{page:'journal',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:paperBack},'合上周记')},
          h('div',{className:'pet-town-sign'},h(PetSeal,{kind:'book',size:42}),h('div',null,h('h2',null,'这一周的小日子'),h('p',null,journalView.start+' ～ '+journalView.end))),
          h('label',{className:'pet-week-picker'},'翻到哪一周',h('select',{'aria-label':'选择周记周次',value:journalView.start,onChange:e=>journalPick(e.target.value),style:field},...journalView.weeks.map(date=>h('option',{key:date,value:date},date+' 开始的一周')))),
          h('div',{className:'pet-week-counts'},...Object.entries(journalView.counts).filter(([,count])=>count>0).map(([kind,count])=>h('div',{key:kind},h('strong',null,count),h('span',null,journalView.kinds[kind])))),
          !journalView.total&&h(PetNote,{title:'这周还等着小事发生',kind:'paw'},h('p',{className:'pet-quiet'},'完成照料、实际见过朋友、收好工作工资或小收藏后，会慢慢记进这一周。')),
          ...journalView.days.filter(day=>day.facts.length).map(day=>h(PetNote,{key:day.date,title:day.date,kind:'book'},h('ol',{className:'pet-care-memories'},...day.facts.map((fact,i)=>h('li',{key:i},h('small',null,journalView.kinds[fact.kind]+(fact.actor?' · '+fact.actor:'')),h('span',null,fact.text),fact.count>1&&h('small',null,'这天共 '+fact.count+' 次')))))),
          h('p',{className:'pet-footnote'},'按手机当地日历，每周一开始。这里只整理实际发生的事，同一天重复的小事合在一条里；旧册子里没有现实日期的记录仍留在原册子中。')),
        panel==='neighbors'&&neighborView&&h(PetPanel,{page:'neighbors',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:()=>setPanel('')},h(PetSeal,{kind:'paw',size:18}),'回到场景')},
          neighborNotice&&h('p',{role:'status',className:'pet-quiet'},neighborNotice),
          !neighborId?h(React.Fragment,null,
            h(PetNote,{title:'街上慢慢熟起来',kind:'chat'},h('p',{className:'pet-quiet'},'带'+petProfileView.name+'走到街坊身边打招呼。每天见面、送好小托付，慢慢就成了能串门的朋友。花店的小茉、面包店的可可、咖啡店的墨墨也住在这里，熟悉后可以一起追球或安静陪着。'),h('p',{className:'pet-footnote'},'街坊各有现实作息，雨雪会进屋。点「走到身边」会让空闲的街坊暂时等你；离线不会替你交朋友。')),
            h('div',{className:'pet-town-routes'},...neighborView.neighbors.map(n=>h('button',{key:n.id,className:'pet-town-route','aria-label':'认识'+n.name,onClick:()=>{rememberScroll();setNeighborId(n.id);setNeighborNotice('');}},n.pet?h(PetPortrait,{profile:n.profile}):h(PetSeal,{kind:n.id==='baker'?'bread':n.id==='florist'?'leaf':'cup',size:32}),h('span',null,h('strong',null,n.name+' · '+n.role),h('small',null,n.relation+' · '+n.place)),h(PetSeal,{kind:'arrow',size:17})))),
            h(PetNote,{title:neighborView.event.title,kind:'ball'},h('p',{className:'pet-quiet'},neighborView.event.when),h('p',{className:'pet-footnote'},neighborView.event.available?'今天在'+neighborView.event.venue+'，到场一起待一会儿。':'按小镇现实日历来，错过也没关系。'),neighborView.event.joined?h(React.Fragment,null,h('p',{className:'pet-quiet'},neighborView.event.joined.done?'已经和街坊一起参加过了。':'约好了，正在等大家实际到场。'),h('button',{className:'pet-button',onClick:()=>neighborGo('',true)},'去小聚现场'),c&&h('button',{className:'pet-button',onClick:()=>{try{const r=game().inviteAlong();setNeighborNotice(r.text);if(r.accepted)setPanel('');}catch(e){setNeighborNotice(e.message);}}},'约TA一起去'),h('button',{className:'pet-button',onClick:()=>neighborAct('leave-event')},'结束这次小聚')):h('button',{className:'pet-button',disabled:!neighborView.event.available,onClick:()=>neighborAct('join')},'参加这次小聚')),
            neighborView.recent.length>0&&h(PetNote,{title:'最近的邻里小事',kind:'book'},...neighborView.recent.slice(0,6).map((x,i)=>h('p',{key:i,className:'pet-quiet'},x.text)))):
            (()=>{const n=neighborView.neighbors.find(n=>n.id===neighborId);if(n?.pet)return h(React.Fragment,null,
              h('div',{className:'pet-nameplate'},h(PetPortrait,{profile:n.profile}),h('div',null,h('h2',null,n.name),h('p',null,n.role))),
              h(PetNote,{title:'慢慢认识彼此',kind:'paw'},h('p',{className:'pet-quiet'},n.detail),h('p',{className:'pet-quiet'},n.relation),h('p',{className:'pet-footnote'},'打过招呼 '+n.friend.greetings+' 次'+(n.friend.work?' · 工作相遇 '+n.friend.work+' 次':'')),h('p',{className:'pet-footnote'},'一起追球 '+n.friend.play+' 次 · 安静陪伴 '+n.friend.together+' 次')),
              h('div',{className:'pet-care-actions'},h('button',{className:'pet-button',onClick:()=>neighborGo(n.id)},'去'+n.placeName+'找'+n.name),...[['pet-greet','和'+n.name+'打招呼'],['pet-play','一起追小球'],['pet-together','陪它待一会儿']].map(([action,label])=>h('button',{key:action,className:'pet-button',onClick:()=>neighborAct(action,n.id)},label))),
              h(PetNote,{title:'来家里做客',kind:'home'},h('p',{className:'pet-quiet'},neighborView.petVisit?.neighborId===n.id?neighborView.petVisit.hostName+' · '+neighborView.petVisit.label:n.friend.visits>=2?'已经认识了，可以请它来家里慢慢待着。':'先慢慢认识两次，再请它到家里。'),h('p',{className:'pet-footnote'},'实际来家里相处过 '+n.friend.homeVisits+' 次'),neighborView.petVisit?.neighborId===n.id?h(React.Fragment,null,neighborView.petVisit.mine&&neighborView.petVisit.options.length>0&&h('div',{className:'pet-care-actions'},...[['play','分享家里的球'],['quiet','安静陪着'],['guard','留好自己的空间']].map(([id,label])=>h('button',{key:id,className:'pet-button',onClick:()=>neighborAct('guest-'+id,n.id)},label))),h('button',{className:'pet-button',onClick:()=>{if(game()?.goHome())setPanel('');}},'回家看看'),neighborView.petVisit.mine&&h('button',{className:'pet-text-button',onClick:()=>neighborAct('guest-end',n.id)},'送朋友回店里')):h('button',{className:'pet-button',disabled:!n.canInvite,onClick:()=>neighborAct('guest-invite',n.id)},'请'+n.name+'来家里')),
              neighborView.petMeeting&&h(PetNote,{title:'这次相处正在进行',kind:'paw'},h('p',{className:'pet-quiet'},neighborView.petMeeting.phase==='walking'?'正在走到朋友身边。':'正在一起'+(neighborView.petMeeting.kind==='play'?'追小球':neighborView.petMeeting.kind==='greet'?'打招呼':'安静待着')+'。'),h('button',{className:'pet-button',onClick:()=>neighborAct('pet-stop',n.id)},'这次先歇歇')),
              h('p',{className:'pet-footnote'},'先实际走进'+n.placeName+'，再邀请它。认识两次后可以一起玩；刚相处过会先各自歇一会儿，饿了、累了或忙着时也会拒绝。'),
              n.friend.recent.length>0&&h(PetNote,{title:'一起留下的小事',kind:'book'},...n.friend.recent.slice().reverse().map((x,i)=>h('p',{key:i,className:'pet-quiet'},x.text))));return n&&h(React.Fragment,null,
              h(PetNote,{title:n.name+' · '+n.role,kind:'chat'},h('p',{className:'pet-quiet'},n.detail),h('p',{className:'pet-footnote'},n.relation+' · '+n.place),h('p',{className:'pet-footnote'},'日常见面 '+n.hours+' · '+(n.awake?'现在可以来往。':'已经收工休息，白天再见。')),n.memory&&h('p',{className:'pet-quiet'},'认得'+n.memory.knownName+(n.memory.habit?'，还记得它'+n.memory.habit:'')+'。')),
              h('div',{className:'pet-care-actions'},h('button',{className:'pet-button',onClick:()=>neighborGo(n.id)},'走到'+n.name+'身边'),h('button',{className:'pet-button',onClick:()=>neighborAct('greet',n.id)},'打个招呼'),h('button',{className:'pet-button',onClick:()=>neighborAct('accept',n.id)},'帮忙送'+(n.id==='baker'?'面包':n.id==='florist'?'小花':'便条'))),
              h(PetNote,{title:'来家里坐坐',kind:'home'},h('p',{className:'pet-quiet'},neighborView.visit?.id===n.id?(neighborView.visit.phase==='going'?'正在沿街走过来。':neighborView.visit.phase==='staying'?'已经走进家门，来陪大家坐一会儿。':'正在回到街上。'):n.canInvite?'已经熟悉了，可以请来串门。':'多见几次或送好一次小托付，熟悉后就可以约。'),neighborView.visit?.id===n.id&&h('button',{className:'pet-button',onClick:()=>{if(game()?.goHome())setPanel('');else setNeighborNotice('暂时走不过去，稍后再试。');}},'回家等街坊'),h('button',{className:'pet-button',disabled:neighborView.visit?.id!==n.id&&!n.canInvite,onClick:()=>neighborAct(neighborView.visit?.id===n.id?'end-visit':'invite',n.id)},neighborView.visit?.id===n.id?'和街坊道别':'邀请来串门')));})(),
          neighborView.quest&&h(PetNote,{title:'手上的小托付',kind:'bag'},h('p',{className:'pet-quiet'},neighborView.quest.petName+'带着'+neighborView.quest.item+'，要交给'+neighborView.quest.toName+'。'),h('p',{className:'pet-footnote'},'东西会跟着原来那只宠物；换到别的宠物不会转交。'),h('div',{className:'pet-care-actions'},h('button',{className:'pet-button',onClick:()=>neighborGo(neighborView.quest.phase==='returning'?neighborView.quest.from:neighborView.quest.to)},'去找'+neighborView.quest.toName),h('button',{className:'pet-button',onClick:()=>neighborAct('deliver',neighborView.quest.phase==='returning'?neighborView.quest.from:neighborView.quest.to)},neighborView.quest.phase==='returning'?'交还东西':'把东西交过去'),h('button',{className:'pet-button',onClick:()=>neighborAct('return',neighborView.quest.from)},'先还回去')))),
        panel==='companion-dress'&&c&&h(PetCompanionDress,{game,character:c,scrollRef:panelScroll,onScroll:rememberScroll,onDone:finishDress,onError:setError}),
        panel==='view'&&viewInfo&&h(PetPanel,{page:'view',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:()=>setPanel('')},h(PetSeal,{kind:'paw',size:18}),'回到场景')},
          h(PetNote,{title:'看谁，就跟着谁',kind:'paw'},h('p',{className:'pet-quiet'},'正在照料 '+petProfileView.name+'。换镜头后，照料对象仍是它；点场景里的另一只可以选中照料。'),h('p',{className:'pet-footnote'},'拖动画面会停在这里，他们继续各自生活。')),
          h('div',{className:'pet-town-routes'},...viewInfo.pets.map(p=>h('button',{key:p.id,className:'pet-town-route','aria-label':'跟着'+p.profile.name,'aria-pressed':viewInfo.mode==='pet'&&viewInfo.petId===p.id,onClick:()=>viewWho('pet',p.id)},h(PetPortrait,{profile:p.profile}),h('span',null,h('strong',null,'跟着'+p.profile.name),h('small',null,p.place+' · '+p.summary.activity)),h(PetSeal,{kind:'arrow',size:17}))),viewInfo.companion&&h('button',{className:'pet-town-route','aria-label':'看看TA','aria-pressed':viewInfo.mode==='companion',onClick:()=>viewWho('companion')},h(PetSeal,{kind:'chat',size:32}),h('span',null,h('strong',null,'看看TA'),h('small',null,viewInfo.companion.name+' · '+viewInfo.companion.place+' · '+viewInfo.companion.summary)),h(PetSeal,{kind:'arrow',size:17})),h('button',{className:'pet-town-route','aria-label':'停在这里','aria-pressed':viewInfo.mode==='fixed',onClick:()=>viewWho('fixed')},h(PetSeal,{kind:'home',size:32}),h('span',null,h('strong',null,'停在这里'),h('small',null,'把镜头留在当前场景，看看谁会走进来')))),
          viewInfo.companion&&h(PetNote,{title:'TA的小日子',kind:'chat'},h('p',{className:'pet-quiet'},viewInfo.companion.summary),h('p',{className:'pet-footnote'},viewInfo.companion.preferences?.likes?.length?'人设中的偏好：'+viewInfo.companion.preferences.likes.join('、'):'还没有明确的兴趣偏好，先自在地过日子。'),viewInfo.companion.preferences?.recent?.length>0&&h('p',{className:'pet-footnote'},'最近做过：'+viewInfo.companion.preferences.recent.slice(-3).map(x=>x.label).join('、')),h('button',{className:'pet-button',onClick:editCompanion},'TA的外貌'))),
        panel==='parcel'&&parcelView&&h(PetPanel,{page:'parcel',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:()=>setPanel('')},h(PetSeal,{kind:'paw',size:18}),'回到它身边')},
          h('div',{className:'pet-nameplate'},h(PetSeal,{kind:'bag',size:48}),h('div',null,h('span',{className:'pet-eyebrow'},'绒绒小镇 · 回家拆袋子'),h('h2',null,parcelView.name+'的小袋子'),h('p',null,'第 '+parcelView.bag.day+' 天 · '+parcelView.bag.sourceTitle))),
          h(PetNote,{title:'这次带回了这些',kind:'bag'},h('div',{className:'pet-parcel-contents'},...parcelView.bag.contents.map(item=>h('div',{key:item.id,className:'pet-inventory-row'},h(PetSeal,{kind:item.kind,size:28}),h('span',null,h('strong',null,item.name),h('small',null,item.count+' '+item.unit+'，已经收进它自己的小物件')))))),
          h(PetNote,{title:'它的小反应',kind:'paw'},h('p',{className:'pet-quiet'},parcelView.bag.reactionText),h('p',{className:'pet-footnote'},parcelView.bag.served?'已经留出一份给它，回到屋里看它慢慢吃。':'回到屋里，让它自己凑近看看。'))),
        panel==='career'&&careerView&&h(PetPanel,{page:'career',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:()=>setPanel('')},h(PetSeal,{kind:'paw',size:18}),'回到它身边')},
          h('div',{className:'pet-book-tabs',role:'tablist','aria-label':'职业生活册'},...[['today','bread','店里的今天'],['bag','bag','零钱袋'],['history','book','履历册']].map(([id,kind,label])=>h('button',{key:id,role:'tab',tabIndex:careerTab===id?0:-1,onKeyDown:e=>{const ids=['today','bag','history'],index=ids.indexOf(id),next=e.key==='ArrowRight'?(index+1)%3:e.key==='ArrowLeft'?(index+2)%3:e.key==='Home'?0:e.key==='End'?2:-1;if(next<0)return;e.preventDefault();rememberScroll();setCareerTab(ids[next]);e.currentTarget.parentElement.querySelectorAll('[role=tab]')[next].focus();},'aria-selected':careerTab===id,'aria-controls':'pet-book-'+id,id:'pet-tab-'+id,onClick:()=>{rememberScroll();setCareerTab(id);},className:'pet-book-tab '+(careerTab===id?'pet-book-selected':'')},h(PetSeal,{kind,size:20}),label))),
          h('div',{role:'tabpanel',id:'pet-book-'+careerTab,'aria-labelledby':'pet-tab-'+careerTab},
            careerNotice&&h('p',{role:'status',className:'pet-message'},careerNotice),
            careerTab==='today'&&h('div',null,
              c&&careerView.company&&h(PetNote,{title:'和TA商量今天',kind:'chat'},
                careerView.company.proposal?h(React.Fragment,null,h('p',{className:'pet-quiet'},careerView.company.name+'想带它去'+((careerView.professions||careerView.workplaces).find(x=>x.id===careerView.company.proposal.profession)?.title||'店里')+'看看。'),h('p',{className:'pet-footnote'},careerView.company.proposal.reason),careerView.company.proposal.status==='offered'?h('div',{className:'pet-care-actions'},h('button',{className:'pet-button',disabled:!careerView.company.available,onClick:()=>companyWork('agree')},'先去TA提的这家'),h('button',{className:'pet-button',disabled:!careerView.company.available,onClick:()=>companyWork('change',{profession:careerView.workplace.id})},'我想去'+careerView.workplace.title),h('button',{className:'pet-button',disabled:!careerView.company.available,onClick:()=>companyWork('rest')},'今天让它休息')):h('p',{className:'pet-quiet'},careerView.company.proposal.status==='rest'?'今天留给它自己，TA原先的提议也留在这一天。':(careerView.company.proposal.status==='changed'?'你选了另一家，今天先照你的想法看看。':'你们商量好先去看看。')+(careerView.company.proposal.outcome==='refused'?' 它到店后不想上班，先按它的心情来。':careerView.company.proposal.outcome==='willing'?' 到店后它愿意接这一班。':' 到了店里，还要问它自己的意见。'))):h(React.Fragment,null,h('p',{className:'pet-quiet'},'你们在家空下来时，TA偶尔会有个想法。也能先问问TA，原来的排班和它自己的意愿照常。'),h('button',{className:'pet-button',disabled:!careerView.company.available||careerView.daily.invited||careerView.daily.closed||careerView.daily.rest,onClick:()=>companyWork('suggest')},'问问TA想去哪家')),
                h('button',{className:'pet-text-button',onClick:()=>{setDraft('今天想带'+careerView.petName+'去哪家看看？也可以让它休息，你怎么想？');openChat();}},'和TA聊聊今天的安排')),
              h(PetNote,{title:'现实日历',kind:'book'},h('p',{className:'pet-quiet'},careerView.calendar?.label+' · '+['春','夏','秋','冬'][careerView.calendar?.season]+'季 · 第 '+careerView.calendar?.seasonDay+'/'+careerView.calendar?.seasonLength+' 天'),h('p',{className:'pet-quiet'},careerView.window?.label),h('label',null,'每周排班',h('select',{'aria-label':'每周排班',disabled:careerView.workplace.temporary,style:field,value:careerView.schedule.shift,onChange:e=>work('schedule',{shift:e.target.value,weekend:careerView.schedule.weekend})},h('option',{value:'none'},'到店再商量'),h('option',{value:'morning'},'上午班 · 09:00–12:00'),h('option',{value:'afternoon'},'下午班 · 14:00–17:00'))),h('label',{className:'pet-shopping-toggle'},h('span',null,'周末也可以排班'),h('input',{type:'checkbox',role:'switch','aria-label':'周末也可以排班',disabled:careerView.workplace.temporary,checked:careerView.schedule.weekend,onChange:e=>work('schedule',{shift:careerView.schedule.shift,weekend:e.target.checked})})),h('p',{className:'pet-quiet'},careerView.workplace.temporary?'临时兼职按这一次的邀请走，不加入每周固定排班。做完三件小事，一起收工才结算。':'手动邀请随时可以问；自动排班按约好的时段和周末开关走。愿意才接班，一天最多一班。')),
              game()?.routineNotes?.().length>0&&h(PetNote,{title:'你不在时的小日子',kind:'paw'},h('ol',{className:'pet-care-memories'},...game().routineNotes().map((x,i)=>h('li',{key:x.at+':'+i},h('small',null,root.GameClock.sample(d.clock,x.at).label),h('span',null,x.text))))),
              h('div',{className:'pet-nameplate'},h(PetPortrait,{profile:petProfileView}),h('div',null,h('span',{className:'pet-eyebrow'},game()?.calendar()?.date||'今天的小日子'),h('h2',null,careerView.petName),h('p',null,careerView.activity))),
              careerView.life&&h(PetNote,{title:careerView.workplace.title+' · '+careerView.life.stage,kind:'book'},h('p',{className:'pet-quiet'},'真正做完 '+careerView.life.completed+' 班 · '+careerView.life.wish),h('p',{className:'pet-footnote'},careerView.breakUntil>careerView.day?'约好先休息，还留 '+(careerView.breakUntil-careerView.day)+' 天；想重新去看看，也可以当天再商量。':'做过的班次慢慢长成经历，累了也可以留下几天空闲。'),h('button',{className:'pet-text-button',disabled:!!careerView.job||careerView.breakUntil>careerView.day,onClick:()=>work('career-break')},'留三天休息')),
              careerView.life?.lastStory&&h(PetNote,{title:careerView.life.lastStory.title,kind:'chat'},h('p',{className:'pet-quiet'},careerView.life.lastStory.text),h('p',{className:'pet-footnote'},careerView.life.lastStory.by+'当时拿的主意 · '+careerView.life.lastStory.choice)),
              h('div',{className:'pet-work-postings','aria-label':'今天想去的小店'},...careerView.workplaces.map(place=>h('button',{key:place.id,className:'pet-work-posting','aria-pressed':careerView.workplace.id===place.id,disabled:caseBusy||careerView.workplace.id!==place.id&&(!!careerView.job||careerView.daily.invited||careerView.daily.closed||careerView.daily.rest),onClick:()=>work('select',{profession:place.id})},h(PetSeal,{kind:place.icon,size:26}),h('span',null,h('strong',null,place.title),h('small',null,place.description))))),
              h('section',{className:'pet-bakery-order'},h('div',{className:'pet-order-heading'},h(PetSeal,{kind:careerView.workplace.icon,size:32}),h('div',null,h('h3',null,careerView.workplace.role),h('p',null,careerView.opinion)),h('span',{className:'pet-ticket-stamp'},careerView.trialDone?'店里熟客':'初次试工')),
                h('ol',{className:'pet-shift-track','aria-label':'三段试工进度'},...[0,1,2].map(i=>h('li',{key:i,className:careerView.job&&careerView.job.index>i?'pet-shift-done':careerView.job?.index===i?'pet-shift-current':''},h('span',null,i+1),careerView.workplace.steps[i]))),
                careerView.workplace.id==='stall'&&h(PetNote,{title:careerView.market?'公园野餐角的小摊':'今天装进摊袋的',kind:'bag',className:'pet-stall-note'},
                  careerView.market?h(React.Fragment,null,h('p',{className:'pet-quiet'},'下一站 · '+careerView.market.destinationTitle),h('p',{className:'pet-quiet'},'已成交 ￥'+careerView.market.income+' · 卖出 '+careerView.market.sold+' 件 · 交换 '+careerView.market.exchanged+' 件'),h('p',{className:'pet-footnote'},'余货和换回的小东西跟着摊袋回家。没有固定工资，只记实际成交。')):h(React.Fragment,null,h('p',{className:'pet-quiet'},'先在家里从自己的库存挑最多三件。愿意出摊时才装上；没卖掉的带回家。'),h('div',{className:'pet-inventory'},...careerView.stall.goods.map(item=>h('div',{key:item.id,className:'pet-inventory-row pet-stall-stock'},h(PetSeal,{kind:item.kind,size:22}),h('span',null,h('strong',null,item.name),h('small',null,'自己的 '+item.count+' '+item.unit+' · 准备带 '+item.packed+' '+item.unit)),h('button',{className:'pet-small-button','aria-label':'放回一'+item.unit+item.name,disabled:!!careerView.job||careerView.room!=='home'||careerView.daily.invited||!item.packed,onClick:()=>work('stall-pack',{item:item.id,delta:-1})},'−'),h('button',{className:'pet-small-button','aria-label':'装上一'+item.unit+item.name,disabled:!!careerView.job||careerView.room!=='home'||careerView.daily.invited||item.packed>=item.count||Object.values(careerView.stall.pack).reduce((a,b)=>a+b,0)>=3,onClick:()=>work('stall-pack',{item:item.id,delta:1})},'+'))))),h('p',{className:'pet-footnote'},'小球、窝和案件纪念留给它，暂放的快递包裹属于收件人。')),
                careerView.workplace.id==='courier'&&h(PetNote,{title:careerView.delivery?'这趟配送':'街区的小路线',kind:'bag',className:'pet-delivery-note'},
                  careerView.delivery&&h(React.Fragment,null,h('h4',null,careerView.delivery.parcel),h('p',{className:'pet-quiet'},'标签 · '+careerView.delivery.address),h('p',{className:'pet-quiet'},'下一站 · '+careerView.delivery.destinationTitle),h('p',{className:'pet-footnote'},careerView.delivery.status==='delivered'?'已在正确门牌签收，回代收点交回执。':careerView.delivery.holdPlaced?'原包裹已在家里暂放，下一班继续送。':'沿街区走到这一站，门边的小事等你和TA拿主意。')),
                  !careerView.delivery&&h('p',{className:'pet-quiet'},'先到便利店代收点商量一班，核对标签，再沿街区送到门牌。回来交回执，工资收进它自己的零钱袋。'),
                  careerView.courier.pending&&h('div',{className:'pet-delivery-hold'},h('strong',null,'还要继续送的一份'),h('p',null,careerView.courier.pending.parcel+' · '+careerView.courier.pending.address),h('p',{className:'pet-footnote'},careerView.courier.pending.location+'。这是收件人的原包裹，下一班会接着送。')),
                  h('ul',{className:'pet-delivery-routes'},...careerView.courier.routes.map(route=>h('li',{key:route.id},h('span',null,route.title+' · '+route.label),h('small',null,route.visits?'已送达 '+route.visits+' 趟'+(route.like>.15?' · 喜欢这条路线':''):'还在认识这条路线'))))),
                careerView.workplace.id==='alley'&&!careerView.job&&h(PetNote,{title:'小巷来的新消息',kind:'search',className:'pet-case-inbox'},
                  caseDraft&&caseDraft.petId===game()?.snapshot().activePetId&&caseDraft.day===careerView.day?h(React.Fragment,null,h('h4',null,caseDraft.definition.title),h('p',{className:'pet-quiet'},'这封已经写好了，等保存成功再收进小巷。'),h('button',{className:'pet-button pet-button-soft',onClick:retryCase},'重试收下这封消息')):careerView.detective.prepared?h(React.Fragment,null,h('span',{className:'pet-eyebrow'},careerView.detective.prepared.sourceLabel+' · 已收好'),h('h4',null,careerView.detective.prepared.title),h('p',{className:'pet-quiet'},careerView.detective.prepared.intro),h('p',{className:'pet-footnote'},'这封完整留在存档里。先问问它愿不愿意，收齐线索后再拼结论。'),h('button',{className:'pet-text-button',disabled:caseBusy,onClick:()=>work('discard-case',{day:careerView.day})},'这次用本地小案')):
                  h(React.Fragment,null,h('p',{className:'pet-quiet'},'小镇的日常消息会变换东西、地点和起因，也会接上街坊的连载。随时可以先问问它愿不愿意。'),h('p',{className:'pet-footnote'},'想接模型写的新消息时，再点下面这一枚。每次点击调用一次，生成后整案保存；线索有疑问时可以留作悬案。'),h('button',{className:'pet-button pet-button-soft',disabled:caseBusy||careerView.daily.invited||careerView.daily.closed||careerView.daily.rest,onClick:newModelCase},h(PetSeal,{kind:'chat',size:18}),caseBusy?'正在等小巷来信…':'请模型写一件小案')),
                  careerView.detective.serial&&h('p',{className:'pet-footnote'},careerView.detective.serial.name+' · 已查明 '+careerView.detective.serial.solved+'/'+careerView.detective.serial.total+' 回'),
                  caseDetail&&h('details',{className:'pet-case-detail'},h('summary',null,'查看这次返回'),h('pre',null,caseDetail))),
                careerView.investigation&&h(PetNote,{title:careerView.investigation.title,kind:'search',className:'pet-case-note'},h('span',{className:'pet-eyebrow'},careerView.investigation.sourceLabel),h('p',{className:'pet-quiet'},careerView.investigation.intro),careerView.investigation.clues.length?h('ol',{className:'pet-case-clues'},...careerView.investigation.clues.map((clue,i)=>h('li',{key:clue.id},h('span',null,i+1),h('p',null,clue.text)))):h('p',{className:'pet-footnote'},'接下来慢慢收齐三条线索。'),careerView.investigation.conclusion&&h('p',{className:'pet-case-conclusion'},(careerView.investigation.outcome==='solved'?'已结案 · ':'暂留悬案 · ')+careerView.investigation.conclusion)),
                  (careerView.delivery||careerView.market)&&careerView.job?.phase!=='working'&&!careerView.atDestination&&h('button',{className:'pet-button pet-button-soft',onClick:()=>{setPanel('');game()?.goDelivery();}},'先走回'+(careerView.delivery||careerView.market).destinationTitle),
                careerView.event?h('div',{className:'pet-work-event'},h('span',{className:'pet-eyebrow'},careerView.event.kind==='deduction'?'卷宗里等你补上最后一行':careerView.market?'摊前来的小客人':careerView.delivery?'这趟配送的小事':'店里发生了一件小事'),h('h3',null,careerView.event.title),h('p',null,careerView.event.text),h('div',{className:'pet-choices'},...careerView.event.options.map((o,i)=>h('button',{key:o.id,className:'pet-choice','aria-label':o.label,onClick:()=>work('choose',{eventId:careerView.event.id,choice:o.id})},h('span',{className:'pet-choice-number'},i+1),h('span',null,o.label),h(PetSeal,{kind:'arrow',size:16})))),c&&h('button',{className:'pet-button pet-button-soft',onClick:()=>{setDraft(careerView.event.title+'。'+careerView.event.text+'你觉得我们怎么安排？');openChat();}},h(PetSeal,{kind:'chat',size:18}),'先和TA商量')):
                h('div',{className:'pet-work-controls'},
                  h('p',{className:'pet-footnote'},careerView.autonomous?'这班自己上班、自己结工资。离开或关掉 app 后，回来会补算。':careerView.trialDone?'已经学会这份工作，下一班可以托管。':'第一次试工一起拿主意，完成后正式上班可以托管。'),
                  careerView.job?.phase==='ready'&&h('button',{className:'pet-button pet-button-primary',onClick:()=>work('finish')},careerView.market?'收好小票，结束摆摊':'一起收工，结工资'),
                  careerView.job?.phase==='tired'&&h('button',{className:'pet-button pet-button-primary',onClick:()=>work('resume')},'恢复精神后继续'),
                  careerView.job?.phase==='working'&&h('button',{className:'pet-button pet-button-primary',onClick:()=>{setPanel('');if(!careerView.atDestination)game()?.goDelivery();}},(careerView.delivery||careerView.market)?'陪它走到'+(careerView.delivery||careerView.market).destinationTitle:careerView.atDestination?(careerView.autonomous?'看看它上班':'回店里陪它继续'):'陪它走到工作位置'),
                  !careerView.job&&!careerView.daily.closed&&!careerView.daily.rest&&(careerView.room!==careerView.destination?h('button',{className:'pet-button pet-button-primary',onClick:()=>{if(game()?.goWork(careerView.workplace.id))setPanel('');else setCareerNotice('这次还没能出发，先等眼前的事情做完，或重试保存后再点一次。');}},careerView.workplace.id==='stall'?'先回家准备摊袋':'走去'+careerView.workplace.title+'看看'):h('button',{className:'pet-button pet-button-primary',onClick:()=>work(careerView.daily.declined?'bribe':'invite'),disabled:!careerView.window?.open||careerView.daily.declined&&(careerView.daily.bribed||!careerView.inventory.snack)},careerView.daily.declined?'用一份零食再邀请一次':careerView.workplace.id==='stall'?'问问它愿不愿意出摊':careerView.trialDone?'问问它愿不愿意上班':'问问它愿不愿意试工')),
                  careerView.daily.closed&&!careerView.job&&h('p',{className:'pet-quiet'},'今天已经收工啦，去公园走走，或回家陪它。'),careerView.daily.rest&&h('p',{className:'pet-quiet'},'今天属于它自己，想怎么玩都可以。')),
                careerView.job?h('button',{className:'pet-text-button',onClick:()=>work('cancel')},careerView.market?'今天先收摊，带余货回家':'今天先停下，不结工资'):!careerView.daily.closed&&!careerView.daily.rest&&h('button',{className:'pet-text-button',onClick:()=>work('rest')},'今天不上班，让它休息')),
              careerView.receipt&&h('button',{className:'pet-pay-envelope',onClick:()=>setCareerTab('bag')},h(PetSeal,{kind:'bag',size:24}),h('span',null,careerView.receipt.text),h(PetSeal,{kind:'arrow',size:16})),
              h('details',{className:'pet-fold-note'},h('summary',null,'试工和正式上班'),h('p',null,'每家第一次试工，三段小事一起拿主意，做完点收工。完成试工后，正式上班会按性格和精神自己处理小事、收工结工资，再带袋子回家；可以离开场景或关掉 app，回来会补算。太累会自己停工休息。大部分职业猫狗都能做；书架小管理员是猫咪专属，花店寻香助手是狗狗专属。临时兼职不加入固定排班，愿不愿意由它自己的状态决定。'),h('p',null,'日期、星期和时钟与手机当地日历一致。2026年10月4日是全镇春季第1天，每14个现实日一起换季，春夏秋冬循环；新档直接进入当天的季节和季内天数。菜单和离线也照常过时间；普通吃睡会接着生活，第一次试工的小事会等你，正式上班可托管；离线最多接着生活三天，自动排班仍按约好的时段和它的意愿。选择会改变它对这份工作的印象。侦探托管会收好线索、留作悬案，不替你认定答案。'))),
            careerTab==='bag'&&h('div',null,
              h('section',{className:'pet-money-pouch'},h(PetSeal,{kind:'bag',size:64}),h('div',null,h('span',{className:'pet-eyebrow'},careerView.petName+'自己的小金库'),h('p',{className:'pet-balance'},h('small',null,'￥'),careerView.balance),h('p',{className:'pet-quiet'},'每一笔，都是它自己的。'))),
              h(PetNote,{title:'让它自己挑一点喜欢的',kind:'bag'},h('label',{className:'pet-shopping-toggle'},h('span',null,h('strong',null,'逛店时让它自己花钱'),h('small',null,'每只一天最多挑一次，也可能什么都不买。')),h('input',{type:'checkbox',role:'switch','aria-label':'逛店时让它自己花钱',checked:careerView.shopping.enabled,onChange:e=>work('shopping-settings',{enabled:e.target.checked})})),h('div',{className:'pet-shopping-budget'},h('label',{htmlFor:'pet-shopping-cap'},'每次最多花'),h('select',{id:'pet-shopping-cap',value:careerView.shopping.cap,onChange:e=>work('shopping-settings',{cap:Number(e.target.value)})},...[8,12,24,40].map(value=>h('option',{key:value,value},'￥'+value)))),h('p',{className:'pet-quiet'},'只用它自己的钱，不够就留着。买好的小袋子要带回家再拆。'),h('button',{className:'pet-button pet-button-soft',disabled:!!careerView.job||!careerView.shopping.enabled&&careerView.shopping.trip?.phase!=='packed',onClick:()=>{setPanel('');if(careerView.shopping.trip?.phase==='packed')game()?.goHome();else game()?.goShopping();}},careerView.shopping.trip?.phase==='packed'?'带它和小袋子回家':'陪它去便利店逛逛'),careerView.shopping.trip?.phase==='browsing'&&h('p',{className:'pet-quiet'},'它正在货架前慢慢挑，回到店里等一小会儿。'),careerView.shopping.log.length>0&&h('ol',{className:'pet-shopping-slips'},...careerView.shopping.log.slice().reverse().map(x=>h('li',{key:x.id},h('small',null,'第 '+x.day+' 天 · 它自己拿的主意'),h('strong',null,x.text),h('p',null,x.reason),x.item&&h('small',null,x.delivered?(x.served?'已经拆开，留了一份准备慢慢吃':'已经拆开收好了'):careerView.parcels.queue.find(p=>p.id===x.id)?.phase==='placed'?'袋子已经放在家里，等你一起拆':'装在小袋子里，等带回家'))))),
              h(PetNote,{title:'用自己的钱挑一点喜欢的',kind:'bag'},h('div',{className:'pet-shop-shelf'},...careerView.shop.map(item=>h('button',{key:item.id,className:'pet-shop-item','aria-label':item.name+' · ￥'+item.cost+(item.max&&item.owned?' · 已有':''),disabled:!item.canBuy,onClick:()=>work('buy',{item:item.id})},h('span',{className:'pet-item-drawing'},h(PetSeal,{kind:item.icon,size:38})),h('span',null,item.name),h('small',null,'￥'+item.cost+(item.max&&item.owned?' · 已有':'')))))),
              h(PetNote,{title:'把家里慢慢变成它喜欢的样子',kind:'home'},h('p',{className:'pet-quiet'},'用它自己的零钱挑小窝和玩具。摆好的睡垫会出现在屋里，它也会自己挑地方休息。'),careerView.furnishings?.items.length?h('div',{className:'pet-home-goods'},...careerView.furnishings.items.map(item=>h('section',{key:item.id,className:'pet-home-good','data-pet-furnishing':item.id},h('div',{className:'pet-inventory-row'},h(PetSeal,{kind:item.icon,size:26}),h('span',null,h('strong',null,item.name),h('small',null,item.active?(item.kind==='rest'?'摆在'+item.slotName:item.kind==='wear'?'正戴着':'正在用这颗球'):'收在它自己的物件里'))),h('p',{className:'pet-footnote'},item.text),item.kind==='rest'?h(React.Fragment,null,h('label',{className:'pet-quiet'},'摆在哪里 ',h('select',{className:'pet-button','aria-label':item.name+'摆在哪里',disabled:careerView.room!=='home'||!!careerView.job,value:item.slot,onChange:e=>work('furnish',{item:item.id,slot:e.target.value})},...(item.slot==='free'?[h('option',{key:'free',value:'free',disabled:true},'自己挑的位置')]:[]),...careerView.furnishings.slots.map(p=>h('option',{key:p.id,value:p.id},p.name)))),h('div',{className:'pet-care-actions'},h('button',{className:'pet-button',disabled:careerView.room!=='home'||!!careerView.job,onClick:()=>work('furnish',{item:item.id,slot:item.slot})},item.active?'重新铺好':'把它摆出来'),h('button',{className:'pet-button',disabled:careerView.room!=='home'||!!careerView.job,onClick:()=>{const q=game()?.careerAction('own-rest',{item:item.id});setCareerNotice(q?.text||'');if(q?.accepted)setPanel('');}},'去里面歇歇'))):h('button',{className:'pet-button',disabled:careerView.room!=='home'||!!careerView.job,onClick:()=>work(item.kind==='wear'?'wear':'furnish',{item:item.id})},item.active?(item.kind==='wear'?'再戴好':'继续用它'):(item.kind==='wear'?'给它戴上':'拿出来陪玩'))))):h('p',{className:'pet-footnote'},'先从上面的货架挑一件。兼职带回的配饰，也会收在这里。'),careerView.furnishings?.wear&&h('button',{className:'pet-text-button',onClick:()=>work('undress')},'摘下配饰收好'),c&&h('button',{className:'pet-text-button',onClick:()=>{setDraft('我们给'+careerView.petName+'挑的小窝和玩具，你觉得摆在哪里它更舒服？也看看它自己喜欢哪个地方。');openChat();}},'和TA商量怎么摆'),careerView.furnishings?.recent.length>0&&h('ol',{className:'pet-diary-lines pet-diary-prose'},...careerView.furnishings.recent.slice(-3).reverse().map((x,i)=>h('li',{key:i},h('p',null,x.text))))),
              c&&careerView.company&&h(PetNote,{title:'下班后，一起看看',kind:'chat'},h('p',{className:'pet-quiet'},'先把工作的袋子带回家拆开，再约TA走过来。实际陪它看一会儿后，才留下你们的共同小事。'),careerView.company.review?h(React.Fragment,null,h('p',{className:'pet-quiet'},careerView.company.review.phase==='looking'?'TA到了，正陪它看小袋子。':'TA正在走过来，回场景等一会儿。'),h('button',{className:'pet-button',onClick:()=>companyWork('cancel-review')},'这次先各自忙')):careerView.company.bags.length?h('div',{className:'pet-care-actions'},...careerView.company.bags.map(bag=>h('button',{key:bag.id,className:'pet-button',disabled:!careerView.company.available,onClick:()=>companyWork('review',{bagId:bag.id})},'约TA看'+bag.title))):h('p',{className:'pet-footnote'},'现在没有还没一起看过的工作袋子。')),
              h(PetNote,{title:'还没拆的小袋子',kind:'bag'},careerView.parcels.queue.length?h('div',null,...careerView.parcels.queue.map(bag=>h('div',{key:bag.id,className:'pet-inventory-row'},h(PetSeal,{kind:'bag',size:24}),h('span',null,h('strong',null,bag.sourceTitle+'的小袋子'),h('small',null,bag.phase==='placed'?'已经放在家里，里面的小东西等你拆开':'还没放好，回家后让它找个地方放下')),h('button',{className:'pet-small-button',disabled:bag.phase!=='placed'||careerView.room!=='home',onClick:()=>work('unpack',{bagId:bag.id})},'拆开看看')))):h('p',{className:'pet-quiet'},'下次打工或自己逛店回来，再一起拆一份。')),
              h(PetNote,{title:'它带回家的小东西',kind:'paw'},h('div',{className:'pet-inventory'},...[['snack','零食'],['bread','小面包']].map(([item,label])=>h('div',{key:item,className:'pet-inventory-row'},h(PetSeal,{kind:'bread',size:24}),h('span',null,h('strong',null,label),h('small',null,careerView.inventory[item]+' 份，'+(item==='bread'?'放在家里的面包篮':'收在自己的袋子里'))),h('button',{className:'pet-small-button',disabled:!careerView.inventory[item]||!!careerView.job,onClick:()=>work('use',{item})},'分给它')))),h('div',{className:'pet-inventory-row'},h(PetSeal,{kind:'leaf',size:24}),h('span',null,h('strong',null,'花店带回的小花'),h('small',null,careerView.inventory.flower+' 枝待插，花瓶里 '+careerView.vase.flowers+' 枝')),h('button',{className:'pet-small-button',disabled:!careerView.inventory.flower||careerView.vase.flowers>=3,onClick:()=>work('arrange')},'插进花瓶')),h('p',{className:'pet-quiet'},'收好了 '+careerView.inventory.petals+' 片花瓣，留作花店的小纪念。'),careerView.inventory.toy>0&&h('p',{className:'pet-quiet'},(careerView.shopping.toyStyle==='wonky'?'它自己挑的歪眼小怪球':'自己的小球')+'已经摆在家里的玩具角，点小球陪它玩。')),
              ...careerView.collections.map(collection=>h(PetNote,{key:collection.title,title:collection.title,kind:'book'},h('div',{className:'pet-inventory'},...collection.items.map(item=>h('div',{key:item.id,className:'pet-inventory-row'},h(PetSeal,{kind:item.kind,size:24}),h('span',null,h('strong',null,item.name),h('small',null,item.count+' '+item.unit+'，收在它自己的小收藏里'))))),h('p',{className:'pet-quiet'},'这是值班留下的小纪念，拆开下班的小袋子才收进来。'))),
              h(PetNote,{title:'摆摊换回的奇怪收藏',kind:'paw'},h('p',{className:'pet-quiet'},'不配套的大纽扣 '+careerView.inventory.oddButton+' 颗，歪歪的叶子小船 '+careerView.inventory.leafBoat+' 只。带回家拆袋后才收进来。')),
              careerView.inventory.box>0&&h(PetNote,{title:'它自己的小纸箱',kind:'home'},h('p',{className:'pet-quiet'},'敞口的矮纸箱已经带回家，可以钻进去歇歇。'),h('button',{className:'pet-button pet-button-soft',onClick:()=>{const r=game()?.careerAction('box-rest');setCareerNotice(r?.text||'');if(r?.accepted)setPanel('');}},'去自己的小纸箱里休息')),
              h('section',{className:'pet-receipt'},h('h3',null,'零钱袋里的小票'),careerView.ledger.length?h('ol',null,...careerView.ledger.slice(-12).reverse().map(x=>h('li',{key:x.id},h('span',null,x.text,h('small',null,'第 '+x.day+' 天')),h('strong',{className:x.amount>=0?'pet-income':'pet-expense'},(x.amount>=0?'+':'')+x.amount)))):h('p',{className:'pet-quiet'},'还没有收支，第一份工资在等它。')),
              h('p',{className:'pet-footnote'},'工资只属于它，不进入你的钱包。两份初始零食是出门的小礼物。')),
            careerTab==='history'&&h('div',null,
              careerView.photos?.length>0&&h(PetNote,{title:'临时兼职留下的照片',kind:'book'},h('div',{className:'pet-work-photos'},...careerView.photos.slice(-photoCount).reverse().map(photo=>h('figure',{key:photo.id},photo.image?h('a',{href:photo.image,download:photo.name+'-'+photo.day+'.jpg','aria-label':'保存'+photo.name+'的'+((careerView.professions||careerView.workplaces).find(x=>x.id===photo.profession)?.title||'临时兼职')+'照片'},h('img',{src:photo.image,alt:photo.name+'在'+((careerView.professions||careerView.workplaces).find(x=>x.id===photo.profession)?.title||'临时兼职')+'收工时的照片',width:256,height:256,loading:'lazy'})):h('p',{className:'pet-footnote'},'这一次没有留到照片'),h('figcaption',null,h('strong',null,((careerView.professions||careerView.workplaces).find(x=>x.id===photo.profession)?.title||'临时兼职')),h('small',null,'第 '+photo.day+' 天 · '+photo.name),h('p',null,photo.caption))))),careerView.photos.length>photoCount&&h('button',{className:'pet-text-button',onClick:()=>setPhotoCount(n=>n+12)},'再翻12张照片'),h('p',{className:'pet-footnote'},'收工时拍下当时的模样，点照片可以保存。配饰在下班袋里，带回家拆开后再戴上。')),
              careerView.company?.memories.length>0&&h(PetNote,{title:'你们一起记得的小事',kind:'chat'},h('ol',{className:'pet-care-memories'},...careerView.company.memories.slice().reverse().map(m=>h('li',{key:m.bagId},h('small',null,'第 '+m.day+' 天'),h('span',null,m.text))))),
              careerView.stall.log.length>0&&h(PetNote,{title:'公园小摊的收摊小票',kind:'bag',className:'pet-stall-log'},h('ol',{className:'pet-care-memories'},...careerView.stall.log.slice().reverse().map(x=>h('li',{key:x.id},h('small',null,'第 '+x.day+' 天'),h('span',null,x.text))))),
              careerView.courier.log.length>0&&h(PetNote,{title:'走过的配送路线',kind:'bag',className:'pet-delivery-log'},h('ol',{className:'pet-care-memories'},...careerView.courier.log.slice().reverse().map(x=>h('li',{key:x.id},h('small',null,'第 '+x.day+' 天'),h('span',null,x.text))))),
              h('section',{className:'pet-resume-cover'},h(PetSeal,{kind:'book',size:42}),h('div',null,h('h2',null,careerView.petName+'的职业履历'),h('p',null,'忙过的小日子，闲着的好时光。'))),
              h('div',{className:'pet-resume-counts'},...careerView.workplaces.map(place=>h('p',{key:place.id},h('strong',null,careerView.resume[place.id]),h('span',null,'天 · '+place.title))),h('p',null,h('strong',null,careerView.resume.rest),h('span',null,'天 · 无业休息'))),
              careerView.life?.regulars.length>0&&h(PetNote,{title:'店里认得它的熟客',kind:'chat'},...careerView.life.regulars.map(x=>h('p',{key:x.name,className:'pet-quiet'},x.name+' · 相处 '+x.visits+' 次 · '+x.relation))),
              careerView.life?.milestones.length>0&&h(PetNote,{title:'职业里的小转折',kind:'book'},...careerView.life.milestones.map((x,i)=>h('p',{key:i,className:'pet-quiet'},'第 '+x.day+' 天 · '+x.text))),
              careerView.firstTrial&&h('section',{className:'pet-trial-print','aria-label':'第一次试工纪念'},h(PetSeal,{kind:(careerView.professions||careerView.workplaces).find(p=>p.id===careerView.firstTrial.profession)?.icon||'bread',size:42}),h('span',{className:'pet-eyebrow'},'小镇第 '+careerView.firstTrial.day+' 天 · '+((careerView.professions||careerView.workplaces).find(p=>p.id===careerView.firstTrial.profession)?.title||'面包店')),h('h3',null,careerView.firstTrial.name?careerView.firstTrial.name+'的第一份工作':'第一次小店试工'),h('p',null,'赚了 ￥'+careerView.firstTrial.wage+(careerView.firstTrial.contents.length?'，带回 '+careerView.firstTrial.contents.map(x=>x.count+' '+x.unit+x.name).join('、')+'。':'。')),h('ol',{className:'pet-memory-choices'},...careerView.firstTrial.choices.map((x,i)=>h('li',{key:i},h('strong',null,(x.by||'未记录')+'拿的主意'),h('p',null,x.text)))),!careerView.firstTrial.choices.length&&h('p',{className:'pet-quiet'},'旧履历留着日期和工资，那天的三个主意还没有记下来。'),h('p',{className:'pet-quiet'},'这张纪念贴留在家里的墙上。')),h(PetNote,{title:'一路过来的日子',kind:'book'},careerView.history.length?h('ol',{className:'pet-history-lines'},...careerView.history.slice().reverse().map((x,i)=>h('li',{key:i},h('span',{className:'pet-history-seal'},h(PetSeal,{kind:(careerView.professions||careerView.workplaces).find(p=>p.id===x.kind)?.icon||'paw',size:20})),h('div',null,h('strong',null,x.kind==='rest'?'休息 '+x.days+' 天':((careerView.professions||careerView.workplaces).find(p=>p.id===x.kind)?.title||'小店')+' · ￥'+x.wage),h('small',null,'第 '+x.day+' 天'),h('p',null,x.text))))):h('p',{className:'pet-quiet'},'还没写下第一段履历。不上班的日子，也会慢慢记在这里。')),
              careerView.casebook.length>0&&h(PetNote,{title:'它的小镇卷宗',kind:'search'},h('ol',{className:'pet-casebook'},...careerView.casebook.slice().reverse().map(file=>h('li',{key:file.id},h('small',null,'第 '+file.day+' 天 · '+(file.outcome==='solved'?'已结案':'悬案')+' · '+(file.by||'未记录')+'拿的主意'),h('strong',null,file.title),h('small',null,file.sourceLabel),h('ol',{className:'pet-case-clues'},...file.clues.map((clue,i)=>h('li',{key:clue.id},h('span',null,i+1),h('p',null,clue.text)))),h('p',{className:'pet-case-conclusion'},file.conclusion))))),
              h(PetNote,{title:'工作里记住的小事',kind:'paw'},careerView.florist.friend&&h('p',{className:'pet-quiet'},'认识了'+careerView.florist.friend.name+'，已经打过 '+careerView.florist.friend.visits+' 次招呼。'),careerView.recent.length?h('ol',{className:'pet-diary-lines'},...careerView.recent.slice().reverse().map((x,i)=>h('li',{key:i},h('small',null,'第 '+x.day+' 天'),h('p',null,x.text)))):h('p',{className:'pet-quiet'},'和它一起去店里看看，留下一点新鲜事。'))))),
        panel==='care'&&careView&&h(PetPanel,{page:'care',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',onClick:()=>{setPanel('');if(!careView.atHome)game()?.goHome?.();else game()?.watch?.('pet',game()?.snapshot().activePetId);}},h(PetSeal,{kind:careView.atHome?'paw':'home',size:18}),careView.atHome?'回到它身边':'回家照料')},
          h('div',{className:'pet-nameplate pet-care-nameplate'},h(PetPortrait,{profile:petProfileView}),h('div',null,h('span',{className:'pet-eyebrow'},'绒绒小镇 · 照料记录'),h('h2',null,petProfileView.name),h('p',null,careView.summary.activity),h('span',{className:'pet-mood-tag'},careView.summary.mood))),
          careView.birth&&h(PetNote,{title:'生日和年龄',kind:'paw'},h('div',{'data-pet-birth':true},h('p',{className:'pet-quiet'},'现在 ',h('strong',{'data-pet-age':true},careView.birth.label)),h('p',{className:'pet-quiet'},'生日 ',h('time',{'data-pet-birthday':true,dateTime:careView.birth.birthday},careView.birth.birthdayLabel)),h('p',{className:'pet-footnote'},careView.birth.legacy?'旧存档从补登记时开始计算，生日为估算日期。':'领养时是 8–12 周大的小家伙，生日按当时年龄估算。'),h('p',{className:'pet-footnote'},'跟着现实日期慢慢长大，离线也会增长年龄。'))),
          !careView.atHome&&h('p',{className:'pet-message',role:'status'},petProfileView.name+'还在外面。点底下「回家照料」，实际到家后就可以做家务和练技能。'),h('div',{className:'pet-care-meters'},...[['饱腹','satiety',careView.summary.satiety,'bread'],['精力','energy',careView.summary.energy,'leaf']].map(([label,k,text,kind])=>h('section',{key:k,className:'pet-meter '+(k==='energy'?'pet-meter-energy':'')},h('div',{className:'pet-meter-label'},h(PetSeal,{kind,size:22}),h('label',{htmlFor:'pet-care-'+k},label),h('span',null,Math.round(careView[k]),h('small',null,' / 100'))),h('progress',{id:'pet-care-'+k,max:100,value:careView[k],'aria-label':label}),h('p',null,text)))),
          careView.summary.skills&&h(PetNote,{title:'一起学的小技能',kind:'paw'},h('p',{className:'pet-quiet'},'每次慢慢练，实际做完三次后就能试口令。'),...careView.summary.skills.map(x=>h('div',{key:x.id,className:'pet-social-card','data-pet-skill':x.id},h('strong',null,x.label),h('p',{className:'pet-quiet'},x.active?'正在'+(careView.task.mode==='show'?'试口令':'一起练习')+'，回到场景看它做完。':x.status),...x.teachers.map((p,i)=>h('p',{key:i,className:'pet-footnote'},'跟'+p.name+'练成 '+p.practice+' 次')),x.shown>0&&h('p',{className:'pet-footnote'},'学会后已做过 '+x.shown+' 次'),...['practice',...(x.learned?['show']:[])].map(mode=>h('div',{key:mode,className:'pet-care-meters'},...['you','companion'].map(trainer=>h('button',{key:trainer,className:'pet-button',disabled:!careView.atHome||!!careView.helper||!!careView.household?.task||!!careView.task&&!(careView.task.source==='self'&&['watch','wander'].includes(careView.task.kind)&&!careView.task.socialId)||trainer==='companion'&&!c,onClick:()=>{const r=game()?.skillAction(x.id,{trainer,mode});setCareView(game()?.care());setError(r?.accepted?'':r?.text||'晚一点再试。');if(r?.accepted)setPanel('');}},mode==='practice'?(trainer==='you'?'跟我练':'跟TA练'):(trainer==='you'?x.cue:'请TA试口令'))))))),careView.task?.kind==='skill'&&h('button',{className:'pet-button',onClick:()=>{const r=game()?.skillAction('stop');setCareView(game()?.care());setError(r?.accepted?'':r?.text||'暂时停不下来。');}},'这次先歇歇'),h('p',{className:'pet-footnote'},'累了、饿了或正在忙时先不练。拿的是原来的玩具，取消或离线不补熟练度；学过的小技能随这只宠物保存。')),
          careView.household&&h(PetNote,{title:'家里谁来做',kind:'home'},h('p',{className:'pet-quiet'},careView.household.task?careView.household.task.name+'正在帮'+careView.household.task.petName+careView.household.task.label+'。回到场景看它做完。':'每项可以各自分工，空闲时按实际需要收拾。'),...careView.household.chores.map(x=>h('div',{key:x.kind,className:'pet-social-card','data-house-chore':x.kind},h('strong',null,x.label),h('p',{className:'pet-quiet'},x.status),h('label',{className:'pet-quiet'},'平时谁负责 ',h('select',{className:'pet-button',style:{width:'100%',marginTop:6},'aria-label':x.label+'的分工',value:careView.household.assignments[x.kind],onChange:e=>{const r=game()?.choreAction('assign',{kind:x.kind,actor:e.target.value});setCareView(game()?.care());setError(r?.accepted?'':r?.text||'暂时没有记好。');}},...[['shared','一起照顾'],['you','我负责'],['ta','TA负责']].map(([value,label])=>h('option',{key:value,value},label)))),h('div',{className:'pet-care-meters'},...['you','companion'].map(actor=>h('button',{key:actor,className:'pet-button',disabled:!x.needed||!!careView.household.task||!careView.atHome||actor==='companion'&&!c,onClick:()=>{const r=game()?.choreAction(x.kind,{actor});setCareView(game()?.care());setError(r?.accepted?'':r?.text||'晚一点再试。');if(r?.accepted)setPanel('');}},actor==='you'?'我来做':'请TA做'))))),careView.household.task&&h('button',{className:'pet-button',onClick:()=>{const r=game()?.choreAction('cancel');setCareView(game()?.care());setError(r?.accepted?'':r?.text||'暂时停不下来。');}},'这件先停一下'),careView.household.recent.length>0&&h('ol',{className:'pet-diary-lines pet-diary-prose'},...careView.household.recent.slice().reverse().map((x,i)=>h('li',{key:i},h('p',null,x.text.replace(/^TA(?=帮)/,c?.remark||c?.name||'TA'))))),h('p',{className:'pet-footnote'},'睡着、忙着或正在用的东西先不动；擦碗边保留原来的粮。收好才记经历，分工和离线补算都在本地。')),
          h(PetNote,{title:'一点点长出来的脾气',kind:'paw'},h('ul',{className:'pet-trait-list'},...careView.summary.traits.map((text,i)=>h('li',{key:i},text)))),
          h(PetNote,{title:'发现它喜欢',kind:'ball'},h('div',{className:'pet-favorite-pair'},h('div',null,h(PetSeal,{kind:'ball',size:26}),h('small',null,'最爱玩的'),h('strong',null,careView.summary.favoriteToy)),h('div',null,h(PetSeal,{kind:'home',size:26}),h('small',null,'睡得舒服的'),h('strong',null,careView.summary.favoriteRest)))),
          careView.summary.habits&&h(PetNote,{title:'慢慢养成的习惯',kind:'paw'},h('p',{className:'pet-quiet'},careView.summary.habits.toy.formed?'经常选'+careView.summary.habits.toy.label+'，已经一起玩过 '+careView.summary.habits.toy.completed+' 次。':'多陪它试试玩具，看看它会更常挑哪一个。'),h('p',{className:'pet-quiet'},careView.summary.habits.rest.formed?'更常回到'+careView.summary.habits.rest.label+'休息，已经睡过 '+careView.summary.habits.rest.completed+' 次。':'还在慢慢挑舒服的睡处。'),...careView.summary.habits.spots.map((x,i)=>h('p',{key:i,className:'pet-footnote'},x.label+' · 已舒服地待过 '+x.visits+' 次')),h('p',{className:'pet-footnote'},careView.summary.habits.greeting)),
          h(PetNote,{title:'和你们越来越熟',kind:'paw'},h('div',{className:'pet-bonds'},...[['you','你'],['companion:'+String(c?.id||''),c?.remark||c?.name||'TA']].map(([key,label])=>{const bond=careView.relationships?.[key];return h('div',{key,className:'pet-bond'},h('span',{className:'pet-person-tag'},label),bond?h('div',{className:'pet-bond-counts'},...[[bond.play,'陪玩'],[bond.pet,'摸摸'],[bond.food,'添粮']].map(([n,label])=>h('span',{key:label},h('strong',null,n),label))):h('p',{className:'pet-quiet'},'还在慢慢熟悉。'));}))),
          careView.social&&h(PetNote,{title:'家里的小伙伴',kind:'paw',className:'pet-social-note'},careView.social.peers.length?h('div',{className:'pet-social-list'},...careView.social.peers.map(peer=>h('div',{key:peer.id,className:'pet-social-card'},h('span',{className:'pet-social-peer'},peer.name),h('p',{className:'pet-quiet'},peer.label),h('div',{className:'pet-social-counts'},h('span',null,'一起看窗 '+peer.window+' 次'),h('span',null,'递小球 '+peer.ball+' 次'),h('span',null,'纸箱旁 '+peer.box+' 次'),(peer.reconcile||0)>0&&h('span',null,'和好 '+peer.reconcile+' 次')),h('button',{className:'pet-button',onClick:()=>{const result=game()?.socialAction('window',peer.id);setCareView(game()?.care());if(result?.accepted)setPanel('');else setError(result?.text||'晚一点再试。');}},'邀请'+peer.name+'一起看窗外'),peer.tension>0&&h('button',{className:'pet-button',onClick:()=>{const r=game()?.socialAction('reconcile',peer.id);setCareView(game()?.care());setError(r?.accepted?'':r?.text);}},'留好位置，陪它们和好')))):h('p',{className:'pet-quiet'},'以后有小伙伴住进来，就能慢慢认识彼此。'),careView.social.recent.length>0&&h('ol',{className:'pet-diary-lines'},...careView.social.recent.slice().reverse().map(x=>h('li',{key:x.id},h('small',null,'第 '+x.day+' 天'),h('p',null,x.text))))),
          h(PetNote,{title:'今天留下的小脚印',kind:'paw'},careView.recent.length?h('ol',{className:'pet-diary-lines'},...careView.recent.slice().reverse().map((x,i)=>h('li',{key:i},h('small',null,careView.elapsed-x.at<60?'刚刚':Math.floor((careView.elapsed-x.at)/60)+' 分钟前'),h('p',null,x.text)))):h('p',{className:'pet-quiet'},'一起吃顿饭、玩一会儿，慢慢留下它的小日子。')),
          h('p',{className:'pet-footnote'},'翻照料记录时，上方场景继续活动，状态会跟着实际照料更新。')),
        panel==='pets'&&petsView&&h(PetPanel,{page:'pets',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer,footer:h('button',{className:'pet-button pet-button-primary',disabled:petLoading||petsView.pets.length>=petsView.limit,onClick:addPet},h(PetSeal,{kind:'paw',size:18}),petLoading?'正在迎接…':petsView.pets.length>=petsView.limit?'四只小家伙都住下啦':'迎接一只新宠物')},
          h('div',{className:'pet-town-sign'},h(PetSeal,{kind:'home',size:42}),h('div',null,h('h2',null,'这一档的小家人'),h('p',null,petsView.pets.length+' / '+petsView.limit+' 只 · 点开各自的小日子'))),
          h('div',{className:'pet-family-list'},...petsView.pets.map(p=>h('section',{key:p.id,className:'pet-family-card '+(p.id===petsView.activePetId?'pet-family-selected':''),'data-pet-id':p.id},
            h('button',{className:'pet-family-cover','aria-label':'查看'+p.profile.name,onClick:()=>choosePet(p.id)},h(PetPortrait,{profile:p.profile}),h('span',null,h('strong',null,p.profile.name),h('small',null,(p.profile.species==='dog'?'狗狗':'猫咪')+(p.birth?' · '+p.birth.label:'')),p.birth&&h('small',{'data-pet-family-birthday':true},'生日 '+p.birth.birthdayLabel),h('span',{className:'pet-family-status'},p.summary.activity),h('span',{className:'pet-family-tag'},p.id===petsView.activePetId?'正在陪它':p.place||'住在同一个家里'))),
            h('div',{className:'pet-family-actions'},h('button',{onClick:()=>choosePet(p.id,'pet'),'aria-label':'修改'+p.profile.name+'的外貌'},'名字与外貌'),h('button',{onClick:()=>choosePet(p.id,'career'),'aria-label':'查看'+p.profile.name+'的职业'},'职业生活册'))))),
          h('p',{className:'pet-footnote'},'每只独立记住生日、毛色、体型、脾气、你们的关系和自己的零钱袋。闲时各自出门散步、逛店再回家；这里会显示它们当前的去处。翻名册时大家照常活动，状态、去处和现实年龄都会更新。')),
        panel==='travel'&&h(PetPanel,{page:'travel',scrollRef:panelScroll,onScroll:rememberScroll,drawer:paperDrawer},
          h('div',{className:'pet-town-sign'},h(PetSeal,{kind:'home',size:42}),h('div',null,h('h2',null,'今天带它去哪里'),h('p',null,c?'和'+(c.remark||c.name)+'，继续这一档的小日子。':'从小镇出发，继续这一档的旅程。'))),
          h('div',{className:'pet-town-routes'},...[['home','家里的小日子','它的小心愿、纪念日、亲手做的点心和自己的角落',showDomestic],['book','小镇周记','翻翻每周实际留下的打工、照料、朋友和小收藏',showJournal],['book','小镇生活相册','给TA和宠物拍同框照，挑一张摆在家里',showAlbum],...(c?[['paw','两人同行遛宠物','约TA一起沿街走，停下来玩，再一起回家',showWalk],['paw','结伴逛街','带TA和现在的小家伙一起去店里、边走边聊',showTogether]]:[]),['paw','镜头看谁','跟着宠物、看看TA，或留在这里观察',showView],['chat','街坊与小约定','认识街坊、帮忙送东西，周末一起小聚',showNeighbors],['paw','家里的宠物','每一只都有自己的小档案，也能迎接新家人',showPets],['bread','职业','去小店试工，攒钱并带回小东西',showCareer],['paw','看看它','翻翻照料记录，看它过得好不好',showCare],['paw','宠物名字与外貌','给'+petProfileView.name+'改小名、毛色和体型',edit],...(c?[['chat','TA的外貌','给'+(c.remark||c.name)+'换衣服、发型和配色',editCompanion],['chat','和TA说话','商量今天的小事，也聊聊你们',openChat]]:[])].map(([kind,label,note,action])=>h('button',{key:label,className:'pet-town-route',onClick:action},h('span',{className:'pet-route-icon'},h(PetSeal,{kind,size:25})),h('span',null,h('strong',null,label),h('small',null,note)),h(PetSeal,{kind:'arrow',size:17})))),
          h(PetNote,{title:'从南边车站出发',kind:'train'},h('button',{className:'pet-button pet-button-primary',onClick:()=>{setPanel('');game()?.goStation();}},h(PetSeal,{kind:'train',size:24}),'走到绒绒小镇车站'),h('p',{className:'pet-quiet'},'沿街走到站台，可以上远行列车，或坐到微光庭院南站。')),
          h('button',{className:'pet-text-button pet-save-switch',onClick:()=>leave(()=>props.onChooseSave('pets'))},'选择另一档'))));
  }

  function PetCompanionDress({game,character,scrollRef,onScroll,onDone,onError}){
    const [look,setLook]=useState(()=>game().getLook()),[styles,setStyles]=useState(null),[listError,setListError]=useState(''),[listRetry,setListRetry]=useState(0),[previewStatus,setPreviewStatus]=useState({state:'loading'}),[previewRetry,setPreviewRetry]=useState(0);
    useEffect(()=>{let live=true;setListError('');fetch('apps/fairy-garden/doll.json?v='+BUILD).then(r=>{if(!r.ok)throw Error('衣柜还没打开，请再试一次。');return r.json();}).then(s=>{if(live)setStyles(s);}).catch(e=>{if(live)setListError(e.message);});return()=>{live=false;};},[listRetry]);
    const pushLook=patch=>{try{if(!game().setLook('companion',patch))throw Error('这次换装没有保存成功，仍穿着刚才那一身。请再试一次。');setLook(game().getLook());onError('');}catch(e){onError(e.message);}};
    const ta=typeof CharacterPronoun!=='undefined'?CharacterPronoun.ta(character):'TA';
    return h(PetPanel,{page:'companion-dress',scrollRef,onScroll,footer:h('button',{className:'pet-button pet-button-primary',onClick:onDone},'换好了')},
      h('div',{'data-pet-companion-preview':true,style:{position:'sticky',top:0,zIndex:2,height:'clamp(160px,28dvh,240px)',background:'var(--pet-paper)',borderRadius:14,marginBottom:16,overflow:'hidden'}},
        h(root.CompanionPreview,{mode:'full',msg:{type:'pet-look',characterId:String(character.id),ta,look:look.companion},ctx:{screen:'wardrobe'},onStatus:setPreviewStatus,reloadKey:previewRetry,style:{width:'100%',height:'100%'}}),
        previewStatus.state!=='ready'&&h('div',{role:'status',style:{position:'absolute',inset:0,display:'grid',placeContent:'center',background:'var(--pet-paper)',textAlign:'center'}},previewStatus.state==='failed'?h('button',{className:'pet-button',onClick:()=>{setPreviewStatus({state:'loading'});setPreviewRetry(x=>x+1);}},'重新打开小人预览'):'小人正在来… '+(previewStatus.pct||0)+'%')),
      h('p',{className:'pet-footnote'},'为'+(character.remark||character.name)+'换一身。选好立即保存，搭配只属于这一档的同行者。'),
      listError?h('div',{role:'alert'},listError,h('button',{className:'pet-button',onClick:()=>setListRetry(x=>x+1)},'重新打开衣柜')):!styles?h('p',{role:'status'},'正在打开衣柜…'):h(DressControls,{who:'companion',look,styles,game,pushLook}));
  }

  function TrainSession(props){
    const frame=useRef(null),owner=useRef(read(props.storeKey||KEY).id),talking=useRef(false),latest=useRef(props);latest.current=props;
    const [toolbar,setToolbar]=useState(null);
    const aloud=useRef(null);if(!aloud.current)aloud.current=makeAloud();useEffect(()=>()=>aloud.current.stop(),[]);
    const [loaded,setLoaded]=useState(false),[panel,setPanel]=useState(""),[error,setError]=useState("");
    const key=props.storeKey||KEY;
    const current=()=>{const d=loadJSON(key,null);if(!d||d.id!==owner.current)throw Error("存档已切换，请重新进入列车。");return root.GameClock.archive(d);};
    const bind=node=>{if(frame.current&&frame.current!==node)hosts.delete(frame.current.contentWindow);frame.current=node;if(!node)return;hosts.set(node.contentWindow,{...aloud.current.bridge(()=>frame.current===node,()=>{const d=current();return (latest.current.characters||[]).find(c=>String(c.id)===String(d.partnerId))||null;}),load:current,setToolbar:bar=>{if(frame.current===node)setToolbar(bar);},ready:()=>{if(frame.current===node){setLoaded(true);trainGame()?.pause?.(!!panel);}},save:(world,id)=>frame.current===node&&!!saveWorld(key,current,world,id),companion:()=>{const d=current(),c=(latest.current.characters||[]).find(c=>String(c.id)===String(d.partnerId));return c?{id:c.id,name:c.remark||c.name,ta:typeof CharacterPronoun!=="undefined"?CharacterPronoun.ta(c):"TA",voice:!!c.voiceId,avatar:c.avatarImage?(typeof resolveImg==="function"?resolveImg(c.avatarImage):c.avatarImage):""}:null;},chat:trainChat,history:()=>trainHistory().slice(-30),openAlbum:()=>{if(frame.current===node)setPanel("album");}});};
    useEffect(()=>()=>{if(frame.current)hosts.delete(frame.current.contentWindow);},[]);
    useEffect(()=>{frame.current?.contentWindow.TrainGame?.pause?.(!!panel);},[panel,loaded]);
    const flush=()=>{if(!frame.current?.contentWindow.TrainGame?.flush())throw Error("进度还没有保存成功，请先留在列车。");};
    const savedAction=async action=>{try{if(talking.current)throw Error("同行者正在回复，等这句说完再离开。");flush();await action();}catch(e){setError(e.message);props.toast(e.message);}};
    const leave=to=>savedAction(()=>to?props.onTravel(to,{station:true}):props.onBack());
    const newRoom=id=>savedAction(()=>props.onNewGardenRoom(id,"train"));
    const d=read(key),c=(props.characters||[]).find(c=>String(c.id)===String(d.partnerId));
    const trainRecord=()=>worldRecord(latest.current,key,'train',current());
    const trainHistory=()=>worldHistory(latest.current,key,current(),'train');
    async function trainChat(text,puzzle,automatic=false){
      if(talking.current)throw Error("上一句还在回复，稍等一下。");
      const p=latest.current,d=current(),cid=d.partnerId,c=(p.characters||[]).find(c=>String(c.id)===String(cid)),node=frame.current;
      if(!c)throw Error("这一档还没有同行者。");
      const record=trainRecord(),history=trainHistory();
      if(!automatic)node.contentWindow.TrainGame?.speak(text,"me");
      talking.current=true;
      try{
        const out=await ask({active:p.apiFor?p.apiFor(c.id):p.active,character:c,profile:p.profile,world:{...node.contentWindow.TrainGame.chatContext(),puzzle:puzzle?{...puzzle}:null,puzzleLastMove:puzzle?d.worlds.train?.puzzleLastMove:null},history:history.slice(-100),text,event:automatic,mainline:worldMainline(p,key,current(),'train',c.id),engineer:!!(p.isEngineer&&p.isEngineer(c.id))});
        if(frame.current!==node)throw Error("已经离开这桌拼图，回复未写入其他房间。");
        if(String(current().partnerId)!==String(cid))throw Error('同行者已经变更，回复未写入其他角色。');storeWorldTurn(key,current,record,cid,automatic?'':text,out,Infinity,'train');
        node.contentWindow.TrainGame?.speak(out.parts,"companion");
        if(out.move)node.contentWindow.TrainGame?.companionMove?.(out.move);
        return out;
      }finally{talking.current=false;}
    }
    const carryArt=async item=>{flush();const m=await import('../apps/fairy-garden/world.mjs?v='+BUILD),d=current(),garden=m.receiveTravelArt(m.restoreState(worldOf(d,'garden')),item);write(key,{...d,world:garden,worlds:{...(d.worlds||{}),garden}});};
    const trainGame=()=>frame.current&&frame.current.contentWindow.TrainGame;
    const [who,setWho]=useState("companion"),[look,setLook]=useState({me:{},companion:{}}),[styles,setStyles]=useState(null);
    useEffect(()=>{if(panel!=="dress"||styles)return;let on=true;fetch('apps/fairy-garden/doll.json?v='+BUILD).then(r=>r.json()).then(d=>{if(on)setStyles(d);}).catch(()=>{});return ()=>{on=false;};},[panel]);
    const pullLook=()=>{const g=trainGame();if(g&&g.getLook)setLook(g.getLook());};
    useEffect(()=>{const g=trainGame();if(!g||!g.preview)return;g.preview(panel==="dress"?who:null);return ()=>{const q=trainGame();if(q&&q.preview)q.preview(null);};},[panel,who,loaded]);
    const pushTrainLook=patch=>{const g=trainGame();if(!g||!g.setLook)return;if(!g.setLook(who,patch)){props.toast("这次没存上，样貌还是原来的。");return;}pullLook();};
    // 背面写字：先落列车相册，已经带回庭院的那一幅跟着改
    const noteBack=async(item,who,text)=>{const g=frame.current?.contentWindow.TrainGame;if(!g)throw Error("列车还没准备好");g.editAlbum({kind:'note',id:item.id,who,text});const m=await import('../apps/fairy-garden/world.mjs?v='+BUILD),d=current(),row=[...(d.worlds?.train?.artworks||[]),...(d.worlds?.train?.photos||[])].find(x=>x.id===item.id),old=worldOf(d,'garden');if(!row||!old)return;const garden=m.updateTravelBack(m.restoreState(old),item.id,row);write(key,{...d,world:garden,worlds:{...(d.worlds||{}),garden}});};
    const askBack=async item=>{const p=latest.current,d=current(),ch=(p.characters||[]).find(x=>String(x.id)===String(d.partnerId));if(!ch)throw Error("这一档还没有同行者。");const pm=await import('../apps/train/puzzle-memory.mjs?v='+BUILD);const line=await frameNote({active:p.apiFor?p.apiFor(ch.id):p.active,character:ch,profile:p.profile,mainline:worldMainline(p,key,current(),'train',ch.id),item,lines:pm.puzzleMemoryLines(item.memory),history:trainHistory().slice(-30)});await noteBack(item,'companion',line);};
    const small={...pickButtonStyle(),padding:"5px 10px",fontSize:12};
    const page=(title,back,body)=>h("div",{ "data-wk": "fgtrainpanel", className:"absolute inset-0 flex flex-col",style:{background:"#e8e6d7",zIndex:10}},
      h(Head,{zh:title,bg:"transparent",ink:G.ink,onBack:back}),body);
    return h("div",{ "data-wk": "fgtrainpage", className:"h-full flex flex-col",style:{background:"#e8e6d7",color:G.ink,position:"relative"}},
      h("div",{"data-train-toolbar":true,style:{flexShrink:0}},h(Head,{zh:toolbar?toolbar.title:"远行列车",sub:toolbar?"":c?"与 "+(c.remark||c.name)+" 同行":"窗外的旅程",bg:"transparent",ink:G.ink,onBack:toolbar?toolbar.back:()=>loaded?leave():props.onBack(),
        right:h("div",{ "data-wk": "fgtrainactions", style:{display:"flex",gap:6}},toolbar?toolbar.actions.map(a=>h("button",{key:a.id,id:a.id,onClick:a.run,style:small},a.label)):[h("button",{key:"settings",disabled:!loaded,onClick:()=>setPanel("settings"),style:small},"设置"),h("button",{key:"landing",disabled:!loaded,onClick:()=>setPanel("landing"),style:small},"下车")])})),
      h("div",{className:"flex-1 min-h-0",style:{position:"relative"}},h("iframe",{ref:bind,title:"远行列车游戏",src:"apps/train/index.html?v="+TRAIN_BUILD,style:{width:"100%",height:"100%",border:0,display:"block"},onLoad:()=>setLoaded(!!frame.current?.contentWindow.TrainGame?.ready)}),
        error&&h("p",{role:"alert",style:{position:"absolute",top:50,left:16,right:16}},error),
        // 改外貌：上面留一截透明，车厢里的两个人就在那儿换上
      panel==="dress"&&h("div",{"data-train-dress":true,style:{position:"absolute",left:0,right:0,top:"36%" /* 和 apps/train/game.mjs 的 PREVIEW_BAND 同一个比例 */,bottom:0,zIndex:10,background:"#e9ecdd",display:"flex",flexDirection:"column",boxShadow:"0 -12px 30px #30442615"}},
        h("div",{style:{display:"flex",alignItems:"stretch",borderBottom:"1px solid "+G.line,background:"rgba(255,255,255,.4)",flexShrink:0}},
          [["companion",c?(c.remark||c.name):"同行者"],["me","我"]].map(([k,label])=>h("button",{ "data-wk": "fgdresstab", "data-part": "train", "data-on": who === k ? "1" : "0", key:k,onClick:()=>setWho(k),className:"flex-1 active:opacity-70",
            style:{minHeight:44,fontFamily:F_BODY,fontSize:13.5,color:who===k?G.ink:"#93a188",borderBottom:"2px solid "+(who===k?G.deep:"transparent"),background:"transparent"}},label)),
          h("button",{"aria-label":"收起改外貌",onClick:()=>setPanel(""),style:{minWidth:56,minHeight:44,fontFamily:F_BODY,fontSize:13,color:G.deep,background:"transparent"}},"完成")),
        h("div",{className:"flex-1 min-h-0 overflow-y-auto",style:{padding:"16px 16px 40px",WebkitOverflowScrolling:"touch"}},
          h("div",{style:{fontFamily:F_BODY,fontSize:11.5,color:G.soft,lineHeight:1.8,marginBottom:14}},"只换这一档列车里的样子；没换过的沿用庭院那一身。"),
          h(DressControls,{who,look,styles,game:trainGame,pushLook:pushTrainLook})))),
      panel==="album"&&h(TravelAlbum,{getArchive:current,onNote:noteBack,onAskNote:c?askBack:null,onExchange:()=>frame.current.contentWindow.TrainGame.editAlbum({kind:'exchange'}),onDelete:id=>frame.current.contentWindow.TrainGame.editAlbum({kind:'delete',id}),onCarry:carryArt,onClose:()=>setPanel("")}),
      panel==="landing"&&page("下一站",()=>setPanel(""),h(RailwayChoices,{from:'train',onChoose:leave})),
      panel==="settings"&&page("旅程设置",()=>setPanel(""),h("div",{className:"flex-1 min-h-0 overflow-y-auto",style:{padding:20}},
        h("p",{style:{fontFamily:F_BODY,fontSize:13,lineHeight:1.9,marginBottom:20}},c?"这段旅程与 "+(c.remark||c.name)+" 同行，和庭院共用这一档。":"庭院和列车共用这一档旅程。"),
        h("div",{style:{display:"grid",gap:12}},
          h("button",{style:pickButtonStyle(),onClick:()=>savedAction(()=>props.onChooseSave("train"))},"选择已有庭院存档"),
          h("button",{style:pickButtonStyle(),onClick:()=>{pullLook();setPanel("dress");}},"改外貌"),
          h(TrainSwitch,{label:"拼图时 TA 自己开口",note:"一起拼的时候，拼到一段、拼完、想请你帮忙时 TA 会自己说一句。关了就只在你说话时回。",storeKey:"x_trainAutoTalk",fallback:true}),
          h(TrainSwitch,{label:"念出来",note:c&&c.voiceId?"TA 说的每一句都念出来，念完这句才冒下一句。和庭院是同一个开关。":"要先在角色资料里给 TA 选一个声音，才念得出来。和庭院是同一个开关。",storeKey:"x_fairyGardenVoice",fallback:false,onChange:on=>{if(!on)aloud.current.stop();}}),
          h("button",{style:pickButtonStyle(),onClick:()=>setPanel("partner")},"选同行者，开新房间")),
        h(LegacyWorldDialogs,{record:trainRecord(),archive:current(),cid:current().partnerId}),
        h("p",{style:{fontFamily:F_BODY,fontSize:12,lineHeight:1.8,color:G.soft,marginTop:16}},"新房间会先让你设置名称、设定和记忆权限。原来的房间与存档都会保留。"))),
      panel==="partner"&&page("选择同行者",()=>setPanel("settings"),partnerPickBody({characters:props.characters,live:[],error,
        note:"选一位同行者，再设置新房间，开始你们的列车旅程。",onPick:newRoom})));
  }
  // 发色沿用色板；衣柜提供逐套保存的自由配色。
  const HAIR_COLORS = ['#2b2320', '#4a3629', '#6b4a33', '#8a6a4b', '#b38f62', '#d8c393', '#8d4a3a', '#6f5f7c'];
  // 衣服、肤色、发色共用取色与色号输入，验证规则只写一份。
  // ⚠️色圈本身归 components.js 的 ColorDot 管（施工规则/one-public-mechanism.md，
  //   她 2026-09-20：「全都改成色圈，这样以后不会改一处坏一处」）。庭院不吃主题色，
  //   所以那几支绿的靠 tone 传进去；只认六位色号这条靠 hexOnly。
  // 改外貌的那一整排控件：庭院的「样貌」页和列车的「旅程设置」共用这一份（2026-09-25 抽出来）。
  // game 是游戏 iframe 里那个对象，要有 getDyes / getOutfit；pushLook 负责落盘。
  function DressControls({ who, look, styles, game, pushLook }) {
    return h(React.Fragment, null,
      h(DyeControl, { key: who + "skin", label: "肤色", value: game() && game().getDyes ? game().getDyes(who).skin : null,
        onChange: skin => pushLook({ skin }), palette: ["#f9e2d2", "#f2cbb4", "#dfb093", "#c58d69", "#9c694c", "#694536"] }),
      // 眼睛颜色（她 2026-09-26）：庭院、列车、陪伴三处都走这一份控件，数据字段 eye
      h(DyeControl, { key: who + "eye", label: "眼睛", value: game() && game().getDyes ? game().getDyes(who).eye : null,
        onChange: eye => pushLook({ eye }), palette: ["#5d4435", "#2b2230", "#3f6fa8", "#4e8a62", "#8a5bb0", "#b5433f"] }),
      h("section", { "aria-label": "衣柜", style: { marginBottom: 24 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink, marginBottom: 10 } }, "挑一套衣服"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 } },
          Object.entries((styles && styles.outfits) || {}).map(([id, outfit]) => {
            const on = (game() && game().getOutfit ? game().getOutfit(who).id : (look[who] || {}).outfit) === id;
            return h("button", { key: id, "aria-pressed": on, onClick: () => pushLook({ outfit: id }),
              style: { minHeight: 54, padding: "10px 8px", borderRadius: 12, border: "1px solid " + (on ? G.deep : G.line), background: on ? "#d4ddc7" : "#f7f5e9", color: G.ink, fontFamily: F_BODY, fontSize: 12 } }, outfit.label);
          })),
        // 按当前衣服列出真实可选区域；复位也走共用外貌写入，保留其他衣服。
        (() => { const selected = game() && game().getOutfit ? game().getOutfit(who) : null;
          const outfit = selected && styles?.outfits?.[selected.id];
          const slots = Object.entries(outfit?.colorLabels || {cloth:"衣服主色",trim:"衬衫与领边",bottom:"裤袜颜色",accent:"领带与点缀",boots:"鞋子颜色"})
            .filter(([slot]) => outfit && slot in outfit.colors);
          return slots.length ? [h("p", { key: "hint", style: { fontSize: 11, color: G.soft, lineHeight: 1.8, margin: "12px 0" } }, "每套单独记住配色，选颜色或输入六位色号，小人会立即换上。"), h("button", { key: "reset-colors", type: "button", onClick: () => pushLook({ outfitColors: { ...outfit.colors } }),
            style: { minHeight: 44, padding: "8px 14px", marginBottom: 8, border: "1px solid " + G.line, borderRadius: 10, background: "#f7f5e9", color: G.deep, fontFamily: F_BODY, fontSize: 12 } }, "恢复本套默认配色")].concat(slots.map(([slot, label]) => {
            const hex = selected.colors[slot] || "#8d5f66";
            return h(DyeControl, { key: who + slot, label, value: hex, onChange: value => pushLook({ outfitColors: { [slot]: value } }) });
          })) : null; })()),
      h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } }, "发型"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 } },
        Object.entries((styles && styles.hair) || {}).map(([key, label]) => {
          const on = (game() && game().getHair ? game().getHair(who) : (look[who] || {}).hair || "") === key;
          return h("button", { key: key, onClick: () => pushLook({ hair: key }), className: "active:opacity-70",
            style: { padding: "11px 6px", borderRadius: 13, border: "1px solid " + (on ? G.deep : G.line),
              background: on ? "rgba(85,112,79,.12)" : "rgba(255,255,255,.55)",
              fontFamily: F_BODY, fontSize: 12, lineHeight: 1.45, color: on ? G.ink : G.soft } }, label);
        })),
      !styles && h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.soft } }, "发型名单还没读进来…"),
      // 表情：换的是脸上那张贴图（doll.json 的 faces）；以后桌宠按心情自动换也走同一个 face 字段
      styles && styles.faces ? h("div", { style: { marginTop: 18 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } }, "表情"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 } },
          Object.entries(styles.faces).map(([key, label]) => {
            const on = ((look[who] || {}).face || "default") === key;
            return h("button", { key, "aria-pressed": on, onClick: () => pushLook({ face: key }), className: "active:opacity-70",
              style: { minHeight: 36, borderRadius: 11, border: "1px solid " + (on ? G.deep : G.line), background: on ? "rgba(85,112,79,.12)" : "rgba(255,255,255,.55)", fontFamily: F_BODY, fontSize: 11.5, color: on ? G.ink : G.soft } }, label);
          }))) : null,
      // 体型：六根滑杆，1 是中性。上下限来自 doll.json（＝Blender 里那份 LIMITS）
      ((styles && styles.dims) || []).length ? h("div", { style: { marginTop: 22 } },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "体型"),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } }, "按这只小旅人的比例微调；拖动就能看见变化，每一项都可以单独还原。"),
        styles.dims.map(d => {
          const cur = Number(((look[who] || {}).dims || {})[d.key]);
          const value = isFinite(cur) ? cur : 1;
          return h("div", { key: d.key, style: { marginBottom: 10, padding: "12px 13px", background: "rgba(244,229,211,.52)", border: "1px solid rgba(151,112,82,.16)", borderRadius: 14 } },
            h("div", { className: "flex items-center justify-between", style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginBottom: 3 } },
              h("span", null, d.label + " · " + Math.round(value * 100) + "%"),
              h("button", { onClick: () => pushLook({ dims: { [d.key]: 1 } }), className: "active:opacity-60",
                style: { fontFamily: F_BODY, fontSize: 10.5, color: Math.abs(value - 1) < .005 ? "transparent" : G.deep, background: "transparent" } }, "回到中间")),
            h("input", { type: "range", "aria-label": d.label, min: d.min, max: d.max, step: .01, value: value,
              onChange: e => pushLook({ dims: { [d.key]: Number(e.target.value) } }),
              style: { width: "100%", minHeight: 28, accentColor: "#a5785c" } }),
            h("div", { className: "flex items-center justify-between", style: { fontSize: 10, color: G.soft } },
              h("span", null, d.low || "轻一些"), h("span", null, d.high || "多一些")));
        })) : null,
      h(DyeControl, { key: who + "hair", label: "发色", value: game() && game().getDyes ? game().getDyes(who).hairColor : null,
        onChange: hairColor => pushLook({ hairColor }), palette: HAIR_COLORS }),
      // 发色花样：单色 / 渐变 / 拼色 / 挑染，后三种多一个副色（名单在 wardrobe.mjs 的 HAIR_MODES）
      (() => { const d = game() && game().getDyes ? game().getDyes(who) : null, mode = (d && d.hairMode) || "solid";
        const modes = (game() && game().hairModes) || [];
        return h(React.Fragment, null,
          modes.length ? h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "4px 0 14px" } },
            modes.map(([id, label]) => h("button", { key: id, "aria-pressed": mode === id, onClick: () => pushLook({ hairMode: id }), className: "active:opacity-70",
              style: { minHeight: 40, borderRadius: 12, border: "1px solid " + (mode === id ? G.deep : G.line), background: mode === id ? "#d4ddc7" : "#f7f5e9", color: G.ink, fontFamily: F_BODY, fontSize: 12 } }, label))) : null,
          mode !== "solid" ? h(DyeControl, { key: who + "hair2", label: mode === "gradient" ? "发尾颜色" : mode === "split" ? "另一半颜色" : "挑染颜色",
            value: d ? d.hairColor2 : null, onChange: hairColor2 => pushLook({ hairColor2 }), palette: HAIR_COLORS.concat(["#e6b5ce", "#9fb8d8", "#f0e0b8"]) }) : null); })());
  }
  function DyeControl({label, value, onChange, palette}) {
    const hex = /^#[0-9a-f]{6}$/i.test(value || "") ? value : "#f2cbb4";
    const tone = { line: "#cbd4bd", ink: "#344936", bg2: "#f8f7ee", field: "#f8f7ee", ink2: "#344936" };
    return h("div", { style: { marginBottom: 14 } },
      h("div", { style: { fontSize: 12, color: "#344936", marginBottom: 4 } }, label),
      h(ColorDot, { value: hex, onChange: onChange, label: label, size: 44, palette: palette,
        hexField: true, hexOnly: true, tone: tone }));
  }
  // 一轮话拆成几个气泡（她 2026-09-17：「他回复一大段是不是没用分气泡」）。
  // ⚠️拆气泡全库只有一处实现：GroupIdentityGuard.splitBubbles ＋ engine.js 的 splitLongBubble。
  //   庭院自己再写一个切句子的函数，就是同一层活在两处（施工规则/one-public-mechanism.md）。
  // ⚠️只有【真的长到成墙】的那一条才动刀（80 字往上，而且只在句号处断）：
  //   庭院这边是成段叙事，照即时通讯那个 22 字的尺子切，会把一段描写剁成碎片。
  const BUBBLE_WALL = 80;
  function replyParts(raw) {
    const G = (typeof window !== "undefined" && window.GroupIdentityGuard) || null;
    const lines = [];
    (Array.isArray(raw) ? raw : [raw]).forEach(row => {
      const text = String(row == null ? "" : row).trim(); if (!text) return;
      (G ? G.splitBubbles(text) : text.split(/\n+/)).forEach(x => { const t = String(x).trim(); if (t) lines.push(t); });
    });
    const out = [];
    lines.forEach(line => {
      if (line.length <= BUBBLE_WALL || typeof splitLongBubble !== "function") { out.push(line); return; }
      const cut = splitLongBubble(line, false).filter(Boolean);
      (cut.length ? cut : [line]).forEach(x => out.push(x));
    });
    return out.slice(0, 12);
  }
  function normalizeReply(raw) {
    const obj = extractJSON(raw);
    const parts = obj ? replyParts(obj.reply) : [];
    if (!parts.length) { const e = new Error("这次没读懂角色的回复，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const a = obj.action || {}, kind = ["none", "follow", "routine", "wait", "goto", "invite", "gift", "refuse"].includes(a.kind) ? a.kind : "none";
    // 地点只认这个世界里真有的（那张表在 rules.js）；处到哪一档才去得了、他手上有没有那样东西，由游戏那头再验一次
    const known = id => typeof id === "string" && Object.hasOwn(root.FairyGardenRules.COMPANION_DESTINATIONS, id);
    const text = v => String(v == null ? "" : v).trim().slice(0, 80);
    let action = { kind };
    if (kind === "goto" || kind === "invite") action = known(a.target) ? { kind, target: a.target, note: kind === "invite" ? text(a.note) : undefined } : { kind: "none" };
    else if (kind === "gift") action = ["herb", "mushroom", "flower", "food"].includes(a.item) ? { kind, item: a.item } : { kind: "none" };
    else if (kind === "refuse") action = { kind, why: text(a.why) };
    else action = { kind, target: undefined };
    return { parts, reply: parts.join("\n"), action };
  }
  function sharedStyle() { return [narrativeCore({ intimate: true }), CONDESCENDING_TONE_BAN, REGISTER_FOLLOWS_SCENE, STOCK_REPLY_BAN, ECHO_QUESTION_BAN, typeof ReplyPacing !== "undefined" ? ReplyPacing.reading() : ""].filter(Boolean).join("\n\n"); }
  // mainline＝父页按【这间房的认知闸】拼好的主线底子（buildBundle 那一份）。
  // ⚠️给了就用它替掉这儿这份手写的自我介绍：那一份是全库公用的「你是谁＋怎么说话」，
  //   庭院自己再写一遍就是同一层活在两处（施工规则/one-public-mechanism.md）。
  //   没给（首页试玩）仍走原来这份，行为一个字都不变。
  function roleContext(character, profile, mainline, setting) {
    const one = "你就是「" + character.name + "」，正与「" + userName(profile) + "」" + (setting ? "相处。" : "一起生活在魔法庭院。");
    if (setting) return [one, setting, String(mainline || "").trim() || ["【完整角色人设】\n" + (character.persona || character.name), "【对方的设定】\n" + (profile && profile.persona || "未填写")].join("\n\n")].join("\n\n");
    if (String(mainline || "").trim()) return one + "\n\n" + String(mainline).trim();
    return [one, "【完整角色人设】\n" + (character.persona || character.name), "【对方的设定】\n" + (profile && profile.persona || "未填写")].join("\n\n");
  }
  async function generateSeason({ active, character, profile, world, mainline }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来安排这一季。");
    const rules = root.FairyGardenRules, season = rules.seasonOf(world.day);
    const sys = [sharedStyle(), roleContext(character, profile, mainline), "【当前游戏事实与最近日志】\n" + JSON.stringify(world),
      "【这一季】第 " + season.year + " 年" + season.name + "季，共 14 天。这是一份可以实行的生活安排，日子会继续往后走。围绕你的人设、兴趣和你们的游戏经历，为每天挑三个活动，依次用于上午、下午、傍晚。全天候的移动、雨雪调整、实际到场和材料结算由游戏负责。",
      "【这一份就是你全部的日子】游戏这边没有另一套「默认作息」垫着——你没排的时段，他就只是待在屋前。所以这十四天是什么样，全看你怎么排。",
      "【她一个人做的那些事，你也去得了】井、告示板、收藏馆、月潭边、集市、小桥、许愿树、邻居屋门前，都在清单里。⚠️收藏馆里摆着的是【她自己留下的东西】，你去看，就是在看她。",
      (world.lately && world.lately.length ? "【村里最近发生的事】\n" + world.lately.map(x => "・第 " + x.day + " 天：" + x.text).join("\n") : ""),
      "【本季每日天气】\n" + JSON.stringify(Array.from({length:14},(_,i)=>({day:i+1,weather:rules.weather(season.start+i,world.epoch)}))),
      "【可实行活动】\n" + JSON.stringify(Object.entries(rules.ACTIVITIES).map(([id,a])=>({id,place:rules.MAPS[a.map].name,activity:a.label}))),
      "你决定这一季想怎样生活，各天如何变化、哪些日子想独处或一起待着。活动的想法、动机与观察可以自由写；活动标识使用上述清单。涉及尚未建成的事物时把它作为愿望，眼下的安排仍落在已有地点。已经过去的季内日期只列计划，不把计划当已发生的回忆。",
      '【输出格式】只输出 JSON：{"title":"你为这一季取的短标题","days":[{"day":1,"note":"这天想怎样过","activities":[{"id":"活动标识","note":"这个活动里你想做什么"}]}]}。days 完整包含第 1 到第 14 天，每天恰好三个 activities。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{role:"user",content:"安排这一季。"}], {maxTokens:65000,timeout:180000,tag:"微光庭院季节"});
    try { return rules.normalizePlan(extractJSON(raw), world.day); } catch(e) { e.detail=String(raw||"").slice(0,1600);throw e; }
  }
  async function generatePetCase({active,world}){
    const {generateModelCase,modelCaseContext}=await import('../apps/pets/detective-model.mjs?v='+BUILD);
    const context=modelCaseContext(world);
    return generateModelCase({active,context,id:'model:'+Date.now()+':'+Math.random().toString(36).slice(2,8),invoke:callAI,parse:extractJSON});
  }
  function petWorkChoice(action,world){const event=world?.career?.event;return action?.kind==='work-choice'&&(!action.petId||action.petId===world?.activePetId)&&event&&action.eventId===event.id&&event.options.some(o=>o.id===action.choice)?{eventId:event.id,choice:action.choice}:null;}
  async function ask({ active, character, profile, world, history, text, mainline, destinations, event=false, engineer=false }) {
    // 真身票优先（她 2026-09-25「座位这种得你自己来」）：言秋同行时先开 CC 票请本人接话，
    // 不在岗/超时才落引擎兜底——同 trpg「队友宣言」先例，她永远有回音。
    const train=world?.map==="carriage",pets=world?.map==="pet-home",setting=pets?worldCognition('pets'):'';
    if (engineer && root.CCSeat && root.Cloud) {
      // 自动闲聊（event=游戏每45秒的搭话）不开真身票：真身只接她亲口说的话——
      // 否则每张票占线一两分钟，把拼图桌的发送锁攥死（她 9/26 首航实测「发不出来」）。
      if (event) return { reply: [] };
      try {
        const r = await root.CCSeat.ask({
          tool: "train_chat", char_id: character.id, ticket: "fg:" + Date.now(),
          world: pets ? {...world,lifeContext:setting} : world, history: history.slice(-30), text, event,
          expect: world?.map==='pet-home'?'{"reply":["当前要说的话"],"action":{"kind":"none|feed|play|pet|snack|work-choice","petId":"照料对象的宠物标识","eventId":"当前事件标识","choice":"选项标识"}}':'{"reply":["第一句","第二句(可省)"],"action":{"kind":"none|move","target":"seat|stand|rack|berth(move时)"}}'
        }, 120000);
        if (r && Array.isArray(r.reply) && r.reply.length) {
          const parts=r.reply.map(x=>String(x||"").trim()).filter(Boolean);const out={parts,reply:parts.join("\n")};
          const a = r.action; if(world?.map==='pet-home')out.workChoice=petWorkChoice(a,world); if (a && a.kind === "move" && ["seat","stand","rack","berth"].includes(a.target)) out.move = a.target;
          if(world?.map==="pet-home"&&["feed","play","pet","snack"].includes(a?.kind))out.petAction=a.kind;out.petId=typeof a?.petId==="string"?a.petId:null;
          if (out.parts.length) return out;
        }
      } catch (e) { /* 超时/不在岗：落回引擎，票根不追（这里的每轮对话可重来） */ }
    }
    if (!active) throw new Error("先在设置里配置创作线路，再来和角色说话。");
    const style = sharedStyle();
    const sys = [style,
      roleContext(character, profile, mainline, setting),
      pets ? "【家里的宠物与日常】pets列出这一个家里每只宠物的稳定id、名字、脾气、饱腹、精力、当前行为、对不同人的实际相处经验和最近的小事，以当前世界事实为准。activePetId表示对方当前选中的宠物，pet/career/home是它的资料；pets中每只都有自己的相处记录与职业，照料动作的petId取实际想照料的那只id。pet.task的target表示它想找谁，walking/fetch/carry仍在途中；recent中type为visit的是实际抵达或放下玩具后的记录。home.parcels.waiting是尚未拆开的真实袋子，carrying仍在带回或找地方放，placed已经放好；opened才是实际拆出并入库的东西。宠物的小反应以当前照料任务和实际完成的小事为准，准备去闻或准备吃仍未完成。social是这个家里宠物之间的实际相处记录；pending仍在走过去或等待，recent才是已经发生的共同小事，pairs按两只稳定id记录看窗、递球和纸箱旁等待。关系计数来自已完成的照料，按事实理解它找人的偏好，别预设谁负责哪一项。pets各自的place/town和companion.place/town表示实际所在地点与闲时路线，可能分别在家、街区或不同店里；companion.visible表示对方在当前地点能否看见你。together为这次真实结伴的安排；mode为walk时，对方和你在一起遛宠物，travel仍在出门，walk沿街走，pause路边歇歇，play停下来互动，notice陪它看路边的小事，wipe在实际回家后擦爪，home一起回家。street.phase为approach还在走过去，doing才在实际陪伴；walkHabits是这只宠物实际形成的常去位置和完成小事，livingPhotos是这一档实际拍下的照片信息，图片不送入模型。domestic包含它自己持续留着的小心愿、真实生日与领养纪念日、料理安排、已经做好但尚未吃完的点心、实际口味与赠礼记忆。wish是想法，paused只是暂时搁置；task仍在准备，serving仍在等它实际吃完，memories才是已经完成的小事。原料和物件归各自宠物所有，未完成不编造成往事。尚未完成按当下的准备与途中理解。you.outWalking和walkActivity表示对方此刻是否同行及实际阶段。you.place是对方此刻所在的地方，you.with是对方正跟着的那只宠物；sameRoomAsCompanion为false时你们不在同一处，是隔着各自的地方在说话，你看不到对方眼前的场面，对方眼前发生什么以you和pets里的实际地点为准。job表示尚在准备或执行的照料。你自己对宠物的态度、愿不愿照料、想做什么按人设和相处方式生发。这里的往事与其他经历沿这间房准许的上下文承接。" : train ? "【远行列车】你们正在列车小游戏里旅行。activity 是此刻正在做的事，看窗外聊天时拼图留在桌上，打开拼图桌才继续拼。以本轮人设保留性格、声纹和相处方式；时间、风景、拼图片数、已拼数量与实际落手以当前世界为准。environment 是发送这句消息时的实时窗外环境，包含时间、季节、天气、沿途景物及线路过渡；puzzle.photo 是拍摄时留下的旧照片信息，两者可能不同。根据话题自然感知眼前环境，穿隧道时依据遮挡状态描述窗外。新的消息以新的环境快照为准。photography列出实际拍下的照片，shared表示是否已交换给对方。这些是游戏中的共同经历。拼图动画由游戏执行，你可以边看边说、和对方聊其他话题。个人拼图水平是这份游戏档的熟练度，不代表现实能力。" : "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。⚠️这是你们在玩的一个小游戏：村子、天气、背包、这一天都是游戏里的，可以入戏，但别把它当成你们现实里真发生过的事——现实里的事只以上面给你的经历为准。时间、背包、位置与共同经历都属于这个存档。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【这个世界里你们最近的对话】\n" + history.map(m => (m.role === "user" ? userName(profile) : character.name) + "：" + m.content).join("\n"),
      (event ? (pets ? "【刚发生的生活小事】\n" : "【刚发生的游戏事件】\n") : "【对方刚说】\n") + text,
      pets ? "【共同照料动作】当前career.event有待决定的小事时，可以按人设提出主意，action.kind用work-choice，eventId与choice选当前事件和选项标识。实际采用的决定与之后的变化以生活记录为准；也可以只商量，留给对方选择。职业收入与东西属于宠物小金库，履历和拒工态度见career。career.company列出你在这一档里对这只宠物的实际提议、商量结果和一起看过工作袋子的记忆；proposal是想法，outcome才是到店后它自己的回应，review仍在走过去或陪看，memories是已经一起看完的小事。可以沿当前事实与自己的人设商量。home列出家里的面包篮、自己的小球和第一次试工纪念；数量、已分出的食物和纪念上记录的决定者都是当前事实，可以沿这些变化聊天。action.kind取none或feed（去添粮）、play（去陪玩）、pet（去摸摸）、snack（给一小口零食）。当前companion.place和照料对象的town.place都为home且job为空时能开始；together.mode为walk且双方实际在outside、没有其他互动任务时，也能停下来play追球或pet摸摸，仍按实际回应开始和完成。你会沿实际路径走到地方再做，宠物会回应或拒绝。reply表达现在的意愿；动作尚未完成时按准备去做表达。完成、拒绝、取消以之后的生活记录为准。一次选一只宠物和一个动作，也可以只聊天。" : train ? "【列车动作】action.kind 用 none；你自己想在车厢里挪个地方时用 move，target 取 seat（回座位）／stand（站到过道看窗外）／rack（去整理行李架）／berth（去上铺躺下），只动你自己，想不想动由你。实际操作由游戏执行。有拼图进度时，以已经落位的碎片为准；puzzle 为空时按当前活动聊天。" : "【你能落实的动作】none=继续当前行动；follow=沿路来陪对方；routine=恢复自己的日程；wait=停在当前位置等候；goto=去一个地点，target 取 " + (destinations || "home（屋前）") + "。你们处得越熟，能一起去的地方越多（世界事实里 bond 那一栏写着你们处到哪儿了、一起做过什么、她递过你什么）。"
        + "另外三种真会发生的事：invite=你约她去一个地点（target 同上，note 写你约她时说的那句），你先过去等，她到了才有下文；"
        + "gift=你把手边顺手采到的一样递给她，item 取 herb（一束铃叶草）／mushroom（荧光菇）／flower（月光花），得她就在你跟前，一天一样；food 是你在夜市上给她买一样吃的，只有世界事实里 food.open 为 true、两个人都在灯串集市时才做得到；"
        + "refuse=她提了什么你没答应，why 写你没答应的那一句，然后你回自己的日程。"
        + "动作只控制你自己，用户的小人由用户操作。路径与到达由游戏执行，回复表达眼下的意愿与举动；物品变动以游戏实际结算为准。答应、犹豫、商量、拒绝、主动约她，都按你的性格来。",
      '【输出格式】只输出 JSON：{"reply":["你说的第一句","接着说的第二句"],"action":{"kind":"动作标识","target":"goto／invite 时的地点标识","note":"invite 时你约她的那句","item":"gift 时的东西标识","why":"refuse 时的那一句"}}。用不到的字段不写。'
      + "reply 是一个数组，一条一个意思：她那头是一个一个气泡冒出来的，一口气说完的整段塞进一条就是一堵字墙。"
      + "想说几条由你，短就一条；动作描写跟着它所属的那一句走，别单独攒成一条。"
      + "本轮只选择一个能落实的动作，其余内容可以继续聊天。"
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "回应眼前这一句。" }], { maxTokens: 65000, timeout: 180000, tag: "微光庭院" });
    const out = normalizeReply(raw);
    if(pets){const a=extractJSON(raw)?.action;out.workChoice=petWorkChoice(a,world);out.petAction=["feed","play","pet","snack"].includes(a?.kind)?a.kind:null;out.petId=typeof a?.petId==="string"?a.petId:null;}
    if (train) { const o = extractJSON(raw), a = o && o.action; if (a && a.kind === "move" && ["seat", "stand", "rack", "berth"].includes(a.target)) out.move = a.target; }
    return out;
  }
  // ── 花笺：把开好的那几株一次问完（她 2026-09-16 定的种花那条）──────────
  // ⚠️【一次调用收一批】：开了几朵就在这一枪里一起回，不是一朵一枪。
  //   这是整条设计能不能落地的那个闸——拆了它，她在庭院点一下午就是几十枪。
  // ⚠️不许把没发生过的共同经历写成真发生过：花笺是他此刻的感受、想法、
  //   他自己那边的生活，不是你们的新往事（如果馆那条路已经吃过一次亏）。
  const SEED_LABELS = { miss: "想你", curious: "好奇", sulk: "委屈", secret: "秘密",
    today: "今天", later: "以后", what_if: "如果", unsaid: "没说出口" };
  // 相框背面那一句：TA 看着这幅拼好的图（或照片）自己写。只要一句话，不是聊天回复。
  async function frameNote({active,character,profile,mainline,item,lines,history}) {
    if(!active) throw new Error("先在设置里配置创作线路，再请 TA 写。");
    const mine=item.back&&item.back.you;
    const sys=[sharedStyle(),roleContext(character,profile,mainline),
      "【这一幅】\n"+JSON.stringify({名字:item.label,种类:item.kind==='puzzle'?'你们一起拼好装了框的拼图':'旅途上拍的照片',纪念:lines,旅途第几天:item.day||null}),
      mine?"【她已经写在背面的那句】\n"+mine:"",
      history&&history.length?"【你们最近在列车上的对话】\n"+history.map(m=>(m.role==="user"?userName(profile):character.name)+"："+m.content).join("\n"):"",
      "这幅要挂起来留着。你在它背面亲手写一句留给她的话：写你自己此刻真想留下的，长短、语气由你。共同经历以提供的事实为依据。署名和日期由程序填入。",
      '只输出 JSON：{"line":"写在背面的话"}。'].filter(Boolean).join("\n\n");
    const raw=await callAI(active,sys,[{role:"user",content:"在背面写下这一句。"}],{maxTokens:65000,timeout:180000,tag:"旅行相框背面"});
    const r=extractJSON(raw);
    if(!r||typeof r.line!=="string"||!r.line.trim()){const e=new Error("这次没写成，可以再请 TA 写一次。");e.detail=String(raw||"").slice(0,1200);throw e;}
    return r.line.trim().slice(0,200);
  }
  async function bottleReply({active,character,profile,mainline,world,bottle}) {
    if(!active) throw new Error("先在设置里配置创作线路，再来读回信。瓶子会等着你。");
    const sys=[sharedStyle(),roleContext(character,profile,mainline),
      "【庭院事实】\n"+JSON.stringify(world),
      "【数日前放下水的原信】\n"+JSON.stringify({text:bottle.original,day:bottle.from}),
      "你在这个架空庭院里捡到了这封漂流瓶，隔了几天才把回应封回瓶里。以自己的口吻写一小段回信，回应原句；可从庭院日常生发具体感受。共同经历以提供的事实为依据，想象就以想象表达。署名由程序填入。",
      '只输出 JSON：{"reply":"回信正文"}。'].join("\n\n");
    const raw=await callAI(active,sys,[{role:"user",content:"写这封回信。"}],{maxTokens:65000,timeout:180000,tag:"庭院漂流瓶回信"});
    const result=extractJSON(raw);
    if(!result||typeof result.reply!=="string"||!result.reply.trim()){
      const e=new Error("这次没读懂回信，瓶子还留着，可以再试。");e.detail=String(raw||"").slice(0,1200);throw e;
    }
    return {reply:result.reply.trim().slice(0,600),sender:character.name};
  }
  async function blossoms({ active, character, profile, world, mainline, seeds }) {
    if (!active) throw new Error("先在设置里配置创作线路，再来收花笺。");
    const rows = (seeds || []).slice(0, 6);
    if (!rows.length) throw new Error("地里没有开好的花。");
    const uName = userName(profile);
    const sys = [sharedStyle(), roleContext(character, profile, mainline),
      "【花田】「" + uName + "」把想问你的话种进了庭院的花圃，过了几天开出花来。你现在逐一回它们。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【开好的花，每一株一句】\n" + rows.map(x => "· " + x.id + "〔" + (SEED_LABELS[x.kind] || "今天") + "〕" + (x.ask || "（她没写字，只放了这个念头）")).join("\n"),
      "【怎么回】一株一句到三句，是你此刻真实的回应：可以是一个很小的具体瞬间、一个念头、"
        + "一件你那边刚发生的事，也可以是反问或者沉默着说点别的。别复述她的问题，别每株都同一个调子，"
        + "别写成情书体。\n"
        + "⚠️不许把【你们之间没发生过的事】说成真发生过——没有的共同经历就别编；"
        + "想象和「如果」要让人看得出那是想象。",
      '【输出格式】只输出 JSON 数组：[{"id":"上面那一行的编号","reply":"你的回应"}]，每株一条，不多不少。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "回这几株。" }], { maxTokens: 20000, timeout: 180000, tag: "微光庭院花笺" });
    const parsed = extractJSON(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.notes) ? parsed.notes : null);
    if (!list) { const e = new Error("这次没读懂花笺，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const want = new Set(rows.map(x => x.id));
    const out = list.filter(x => x && want.has(String(x.id)) && String(x.reply || "").trim())
      .map(x => ({ id: String(x.id), reply: String(x.reply).trim().slice(0, 400) }));
    if (!out.length) { const e = new Error("这次一株都没回上来，可以重试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // ── 碎片：下潜时一次生成一批，慢慢挖出来（同花笺那条闸）──────────────
  // ⚠️深度只决定【完整度和奇异度】，不决定情感重量——「B1 普通想法、B20 童年创伤」
  //   那种梯子她点名不要。这条在提示词里写死。
  // ⚠️能捞的（回忆/联想/他那边）只许从真东西里长；想象的那几类必须看得出是想象。
  // ⚠️四类【看得见的东西】（v69.32，codex 提的，她拍板）：先是东西，其次才带着内容。
  //   「没说出口／以后／他那边」不再自己占一格，而是这几样东西携带的内容。
  const SHARD_LABELS = { echo: "回声石", dream: "梦屑", sense: "感官晶", relic: "无名遗物" };
  async function shards({ active, character, profile, world, mainline, depth, want }) {
    if (!active) throw new Error("先在设置里配置创作线路，再下井。");
    const n = Math.max(1, Math.min(8, Number(want) || 6));
    const uName = userName(profile);
    const sys = [sharedStyle(), roleContext(character, profile, mainline),
      "【星井】「" + uName + "」在井底发现奇物。外形由游戏决定，这里生成其中承载的内容，四种性质：\n"
        + "· 回声 echo：一段真发生过的小事——只能从上面真给到你的经历里长，没有就别选它。\n"
        + "· 梦境 dream：一个梦里的画面，不必解释前因后果。\n"
        + "· 留感 sense：一段声音、一种气味、一点温度，附着它勾起的那一点东西。\n"
        + "· 旧物印记 relic：曾经使用、遗落或保存留下的痕迹，来历可以不完整。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【这一层】第 " + Math.max(1, Number(depth) || 1) + " 层。"
        + "⚠️越深的只是【越完整、越奇怪】，不是越深情、越惨、越隐秘——别按层数往上堆情绪。"
        + "浅处也可以挖到很珍贵的东西，深处也可以很日常。",
      "【怎么写】每片一两句，短：写可感知的内容和痕迹；容器外形由游戏里的井潮选择，内容可承载在任一种奇物里。"
        + "不解释前因后果，不交代是什么时候的事，不写成完整的小故事。别每片一个调子，别都在说她。\n"
        + "kind 只能取：echo｜dream｜sense｜relic。\n"
        + "⚠️echo【只能从上面真给到你的经历里长】，真没有就别选它。绝不许编一段你们其实没发生过的事。\n"
        + "⚠️最要紧的一条：**东西是挖出来的，话是你自己说的**。"
        + "不许在碎片上替自己宣布「我当时差点说…」「我一直想着…」这种台词——"
        + "那句话要等你【看见这件东西之后】再决定说不说、怎么说。这里只写那件东西本身。",
      '【输出格式】只输出 JSON 数组，' + n + ' 条：[{"kind":"echo｜dream｜sense｜relic","text":"这一片上写着什么","whole":false}]。'
        + 'whole 只有在这一件本身是完整一件事时才为 true。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "刨开这一层。" }], { maxTokens: 20000, timeout: 180000, tag: "微光庭院碎片" });
    const parsed = extractJSON(raw);
    const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.shards) ? parsed.shards : null);
    if (!list) { const e = new Error("这次没读懂井里的东西，可以再下一次。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    const out = list.filter(x => x && SHARD_LABELS[String(x.kind)] && String(x.text || "").trim())
      .map(x => ({ kind: String(x.kind), text: String(x.text).trim().slice(0, 240), whole: x.whole === true })).slice(0, n);
    if (!out.length) { const e = new Error("这一层什么都没刨出来，可以再下一次。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // ── 礼物簿那张表：他喜欢什么（她 2026-09-18）。一位角色一辈子只打一次，之后递什么都是查表。
  // ⚠️类别在 rules.js（游戏那侧按同一张表结算）；这儿只问【态度】和【第一次接过时他会说的话】。
  // ⚠️不塞任何内容示范（施工规则/prompt-no-content-samples.md）：喜欢什么由他的人设长出来。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  function normalizeTastes(raw, catalogue) {
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.items) ? obj.items : [];
    const keys = catalogue.map(x => x.key);
    // 他排的先后（只认单子上有的、去重），排漏的按单子原序补在后面
    const order = [];
    for (const r of rows){ const k = r && String(r.key || "").trim();
      if (keys.includes(k) && !order.includes(k)) order.push(k); }
    if (order.length < Math.ceil(keys.length / 2)) {
      const e = new Error("这次没读出他喜欢什么，可以再试一次。"); e.detail = String(raw || "").slice(0, 1200); throw e;
    }
    for (const k of keys) if (!order.includes(k)) order.push(k);
    // ⚠️分布由代码切（施工规则/bans-make-it-dumber.md：掷轴，不掷答案）：
    //   他说了什么算「他排在前面」，但「前面能站几个」不是他说了算。
    const byKey = root.FairyGardenRules.stanceByRank(order, keys.length);
    return catalogue.map(item => {
      const r = rows.find(x => x && String(x.key || "").trim() === item.key) || {};
      return { key: item.key, family: item.family, stance: byKey[item.key] || "meh", words: replyParts(r.words).slice(0, 2) };
    });
  }
  // 生日：人格档案馆里那一栏（公历或农历）换算成村里的一天。⚠️解析只用 engine 那几处现成的函数，不另写一套
  function gameBirthdayOf(c) {
    try {
      const bd = String((c && c.birthday) || "").trim(); if (!bd) return 0;
      const rules = root.FairyGardenRules; let mo = 0, d = 0;
      const lu = typeof parseLunarBirthday === "function" ? parseLunarBirthday(bd) : null;
      if (lu && typeof lunarToSolar === "function") { const dt = lunarToSolar(new Date().getFullYear(), lu.m, lu.d, lu.isLeap); if (dt) { mo = dt.getMonth() + 1; d = dt.getDate(); } }
      else { const p = typeof parseBirthDate === "function" ? parseBirthDate(bd) : null; if (p) { mo = p.mo; d = p.d; } else { const m = bd.match(/(\d{1,2})\s*[-/.月]\s*(\d{1,2})/); if (m) { mo = +m[1]; d = +m[2]; } } }
      return mo && d ? gameBirthday(mo, d) : 0;
    } catch (e) { return 0; }
  }
  // 村里的一年：四季各十四天。⚠️同一个换算写在 world.mjs 的 gameBirthday；这儿只是宿主拿不到 ESM 时的同一份算法
  function gameBirthday(mo, d) {
    const season = mo >= 3 && mo <= 5 ? 0 : mo >= 6 && mo <= 8 ? 1 : mo >= 9 && mo <= 11 ? 2 : 3;
    const start = [3, 6, 9, 12][season], within = ((mo - start + 12) % 12) * 31 + (d - 1);
    return season * 14 + Math.min(14, 1 + Math.floor(within / 93 * 14));
  }
  // ── 他带路那十句（她 2026-09-18）：七件事各一句、换季三站各一句，一位角色一辈子一枪。零内容示范。
  const GUIDE_STOPS = [
    { step: "well", what: "带她去井边取一壶清水" }, { step: "garden", what: "带她给花圃浇一次水" }, { step: "herbs", what: "带她去林地采一束铃叶草" },
    { step: "gift", what: "让她把手上的东西递一样给你，一天一样" }, { step: "sow", what: "带她在花圃种下一句想问你的话，三天开花" },
    { step: "board", what: "带她去公告栏接一件委托，做完交了有功绩，集市日拿去换东西" }, { step: "sit", what: "带她去池边一起坐一会儿" },
    { step: "season:1", what: "夏天第一天，带她去看溪畔的水磨坊，那儿能磨星砂、蒸月露" }, { step: "season:2", what: "秋天第一天，带她去林后的许愿树，学会的咒在那儿念" },
    { step: "season:3", what: "冬天第一天，月湖结冰了，带她上冰面" }
  ];
  function normalizeGuide(raw) {
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = GUIDE_STOPS.map(g => { const r = rows.find(x => x && x.step === g.step) || {}; return { step: g.step, text: String(r.text || "").trim().slice(0, 160) }; }).filter(x => x.text);
    if (out.length < 5) { const e = new Error("这次没读出他带路要说的话。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  async function guideLines({ active, character, profile, mainline, world }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才带得了路。");
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。⚠️这是你们在玩的一个小游戏：村子、天气、背包、这一天都是游戏里的，可以入戏，但别把它当成你们现实里真发生过的事——现实里的事只以上面给你的经历为准。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【此刻】她刚搬进这个村子，你先住了一阵，村里的路你熟。头一天你带她走一圈，每到一处先站在那儿等她，她走到跟前你说一句。换季那天也各有一站。",
      "【十站】\n" + JSON.stringify(GUIDE_STOPS),
      "【要紧的】每一站只写你站在那儿、她走过来时说出口的那一句（可以两句）：说清这儿能做什么、为什么值得做，用你自己的口气。不编你们没发生过的往事，不替她安排接下来做什么。十句得看得出是同一个人说的。",
      '【输出格式】只输出 JSON：{"lines":[{"step":"站的标识","text":"你说的那句"}]}，十站都要有。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "带路。" }], { maxTokens: 65000, timeout: 180000, tag: "微光庭院带路" });
    return normalizeGuide(raw);
  }
  async function tastes({ active, character, profile, mainline, world, catalogue }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才说得出喜欢什么。");
    const rules = root.FairyGardenRules, quota = rules.giftQuota(catalogue.length);
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。⚠️这是你们在玩的一个小游戏：村子、天气、背包、这一天都是游戏里的，可以入戏，但别把它当成你们现实里真发生过的事——现实里的事只以上面给你的经历为准。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【她在这个村里能递给你的东西，一样一样都在这儿】\n"
        + JSON.stringify(catalogue.map(x => ({ key: x.key, name: x.name, note: x.note || "" }))),
      "【要你定的】把这些东西【从你最想要的排到你最不想要的】，一样都不许漏、不许并列。"
        + "按你自己的人设排：有人就是不爱花，有人偏偏稀罕井里那些脏兮兮的旧物；"
        + "同一类里也该有分别——一样是花，你未必两种都一样喜欢。"
        + "⚠️不用管每一档能站几个人，那不归你定；你只管这个先后。",
      "【还要写的】给排在最前面那几样和最后面那几样，各写一两句【第一次从她手里接过它时你会说出口的话】。"
        + "中间那些可以不写。⚠️只写接过东西那一刻说出口的：不编你们没发生过的往事，也不替她安排接下来做什么。",
      '【输出格式】只输出 JSON：{"items":[{"key":"东西的标识","words":["接过时说的话"]}]}。'
        + "items 的【顺序就是你的先后】，从最想要排到最不想要，共 " + catalogue.length + " 条。words 没有就留空数组。"
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "排下来。" }], { maxTokens: 65000, timeout: 180000, tag: "微光庭院喜好" });
    void quota;
    return normalizeTastes(raw, catalogue);
  }
  // 井里挖出来、做出来的那一样：名字是这一档现长的，没法提前问。
  // ⚠️档位【由代码掷】（rolledStance，同一个人同一样东西永远掷出同一档），
  //   这一枪只问他接过时说什么——掷轴不掷答案。
  async function tasteWords({ active, character, profile, mainline, item, stance }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才说得出话。");
    const rules = root.FairyGardenRules;
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式。⚠️这是你们在玩的一个小游戏：可以入戏，但别把它当成现实里真发生过的事。",
      "【她刚递给你的这一样】\n" + JSON.stringify({ name: item.name, note: item.note || "", 来历: item.from || "" }),
      // ⚠️井里那些是【他自己的东西】：一段他经历过的事、做过的梦、留下的印记。
      //   递过来的时候他要认得出那是什么，而不是当成一块石头（她 2026-09-18：
      //   「奇物对我们的关系主题有啥用」——用处就在这一下，别把它写成道具）。
      item.fromWell ? "【⚠️这一样是从星井里捞上来的】井底那些东西都是【你自己的】：一段你经历过的事、一个你做过的梦、"
        + "一点你留下的痕迹。上面【那一段正文就是它承载的内容】。她把它捞上来、有的还做成了别的东西，"
        + "现在递到你手上。你认得出它是什么，先反应【这是什么】，再反应她把它递过来这件事。"
        + "⚠️不解释前因后果，不替她说她为什么给你，不编一段你们没发生过的往事。" : "",
      "【你对它的态度】" + rules.GIFT_STANCES[stance] + "。这一条已经定了，照它写。",
      "【要写的】你接过它那一刻说出口的一两句。⚠️只写这一刻：不编你们没发生过的往事，也不替她安排接下来做什么。",
      '【输出格式】只输出 JSON：{"words":["第一句","要是还有第二句"]}。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "说一句。" }], { maxTokens: 65000, timeout: 180000, tag: "微光庭院喜好一样" });
    const obj = extractJSON(raw), words = replyParts(obj && obj.words).slice(0, 2);
    if (!words.length) { const e = new Error("这次没听清他说什么。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return words;
  }
  // ── 邻居打招呼那句（她 2026-09-18：「做3和4」的 4）：一位邻居一辈子一枪，
  //   三档各一句（刚搬来／脸熟了／处熟了），之后她每次挥手都是查表。零内容示范。
  function normalizeHello(raw) {
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const tiers = ["刚搬来", "脸熟了", "处熟了"];
    const out = tiers.map(tier => { const r = rows.find(x => x && x.tier === tier) || {}; return { tier, text: String(r.text || "").trim().slice(0, 120) }; }).filter(x => x.text);
    if (!out.length) { const e = new Error("这次没读出 TA 会怎么打招呼，再挥一次手试试。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  async function hello({ active, character, profile, world }) {
    if (!active) throw new Error("先在设置里配置创作线路，邻居才开得了口。");
    const sys = [sharedStyle(),
      "你就是「" + character.name + "」，住在魔法庭院的村子里，是「" + userName(profile) + "」的邻居。",
      "【完整角色人设】\n" + (character.persona || character.name),
      "【对方的设定】\n" + (profile && profile.persona || "未填写"),
      "【当前世界的事实】\n" + JSON.stringify(world),
      "【此刻】她在村里走着，看见你，抬手朝你挥了挥。你应一句。她和你处到三档：刚搬来（还不熟）、脸熟了（路上常碰见）、处熟了（说得上话），三档各写一句你会应的话。"
        + "⚠️只写你此刻应的那一句：不编你们没发生过的往事，也不替她安排接下来做什么。三句得看得出是同一个人在三种熟络程度下说的。",
      '【输出格式】只输出 JSON：{"lines":[{"tier":"刚搬来","text":"你应的那句"},{"tier":"脸熟了","text":"…"},{"tier":"处熟了","text":"…"}]}。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "应一句。" }], { maxTokens: 65000, timeout: 180000, tag: "微光庭院邻居" });
    return normalizeHello(raw);
  }
  // ── 走近了跟邻居说句话（她 2026-09-18：「Ab 都做吧」的 a）──────────────
  // ⚠️邻居是【别人的角色】，所以这一枪有两道闸，而且它们管的不是同一件事：
  //   ① 门（door）＝TA 自己的主线记忆带不带进这个村子。开了哪几条由她在邻居那一页
  //      拨，走的是房间那道闸（ChatRooms.gateCtx），不另写一套。
  //   ② 世界那一份＝【这一档里的私事】。发给 TA 的是 world.mjs 的 neighborView，
  //      不是那份 snapshot——同行者的位置、礼物、相处册、委托，门开得再大也一个字不给。
  //   开了①就顺手漏②，是这条线上最容易犯的错。
  // ⚠️反八股那一堆照给：那不是记忆，是文风地板，在哪儿都该有
  //   （施工规则/four-surfaces-same-context.md：「沙盒身份不构成砍掉它们的理由」）。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  async function neighborLine({ active, character, profile, bundle, view, said }) {
    if (!active) throw new Error("先在设置里配置创作线路，TA 才开得了口。");
    const sys = [sharedStyle(),
      "你就是「" + character.name + "」，住在魔法庭院的村子里，是「" + userName(profile) + "」的邻居。",
      "【完整角色人设】\n" + (character.persona || character.name),
      bundle || "",
      "【对方的设定】\n" + (profile && profile.persona || "未填写"),
      "【此刻这个村子】\n" + JSON.stringify(view),
      (said ? "【她刚说】\n" + said : "【此刻】她走到你跟前，像是想跟你说句话。你开口。"),
      (said ? "【要紧的】接着她这句说，别把她的话原样复述一遍。" : ""),
      "【要紧的】就着此刻说——这个时候、这个地方、这个天气，你手头在做什么，你们碰见过几次。"
        + "你和她是邻居，不是她的谁：熟到什么程度上面写着，别越过它。"
        + "⚠️你不知道她和同住那位之间的事，一个字都别提，也别打听。"
        + "⚠️不编你们没发生过的往事，不替她安排接下来做什么，不问「你怎么了」这种回声式的反问。",
      '【输出格式】只输出 JSON：{"lines":["你说的第一句","接着说的第二句"]}。'
        + "一条一个意思，她那头是一个一个气泡冒出来的；一句说得完就一条，最多三条。"
    ].filter(Boolean).join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "说句话。" }],
      { maxTokens: 65000, timeout: 180000, tag: "微光庭院邻居" });
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = rows.map(x => String(x || "").trim()).filter(Boolean).slice(0, 3);
    if (!out.length) { const e = new Error("这次没听清 TA 说什么，明天再找 TA 聊。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // ── 他在台上报方向那四句（她 2026-09-18 的 ①）────────────────────────
  // ⚠️门开不开【由代码判】：差多少、往哪边，都是数（world.mjs 的 starBand／starGap）。
  //   这一枪只换【他怎么说那前半句】——往左往右不许模型编，那是他俩配合的凭据。
  // ⚠️一位角色一辈子一枪，存在这一档的 stars[charId]（照 hello 那条的先例）：
  //   她转一格就打一次的话，一晚上十几枪，而这件事本来是零成本的。
  const STAR_BANDS = [["far", "光还偏得远，得转好几格"], ["near", "快了，再转一两格就到"],
    ["close", "就差一格"], ["done", "光正落在刻痕上，对上了"]];
  function normalizeStar(raw) {
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = {};
    for (const [band] of STAR_BANDS) {
      const r = rows.find(x => x && x.band === band) || {};
      const t = String(r.text || "").trim().slice(0, 60);
      if (t) out[band] = t;
    }
    if (!Object.keys(out).length) { const e = new Error("这次没读出 TA 会怎么报方向，照旧用白话那几句。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  async function starLines({ active, character, profile, mainline }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才报得出方向。");
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。⚠️这是你们在玩的一个小游戏：村子、天气、背包、这一天都是游戏里的，可以入戏，但别把它当成你们现实里真发生过的事——现实里的事只以上面给你的经历为准。",
      "【此刻】旧塔观星室。她在楼下转铜环，你站在残顶观测台上看光落在哪儿——"
        + "她手里只有环，看不见光，全靠你报。你们要把光对到今晚那道刻痕上。",
      "【四种情况】\n" + JSON.stringify(STAR_BANDS.map(([band, what]) => ({ band, what }))),
      "【要紧的】每种写一句你会喊下去的话，用你自己的口气。"
        + "⚠️只写【差多少】那半句，**不要写往左往右**——方向由游戏接在你这句后面，写了会重复。"
        + "⚠️是喊给楼下的人听的：短，能听清。不编你们没发生过的往事，也不替她安排接下来做什么。",
      '【输出格式】只输出 JSON：{"lines":[{"band":"档位标识","text":"你喊的那句"}]}，四种都要有。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "报方向。" }],
      { maxTokens: 65000, timeout: 180000, tag: "微光庭院对星" });
    return normalizeStar(raw);
  }
  // ── 路上撞见：两位邻居站住说两句（她 2026-09-18 的 ②）──────────────────
  // ⚠️一枪里坐着【两个角色】，所以围栏比别处更要紧：
  //   ① 每个人的人设落在【他自己那一段】里，绝不合成一块共享注入
  //      （群聊那条规矩：私有层必须分段，见 four-surfaces-same-context.md）。
  //   ② 【谁的主线记忆都不给】——没法把 A 的记忆挡在 B 眼睛外面。宁可少给，不许漏。
  //   ③ 她和同住那位之间的事，两个人都不知道（world.mjs 的 pairView 已经裁过一遍）。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  async function pairLines({ active, profile, a, b, view }) {
    if (!active) throw new Error("先在设置里配置创作线路，他们才说得上话。");
    const seg = (who, label) => "【" + label + "：" + who.name + "】\n" + (who.persona || who.name);
    const sys = [sharedStyle(),
      "村里两位住户在路上撞见了，站住说了两句。你把这两句都写出来，各用各的口气。",
      seg(a, "先开口的那位"),
      seg(b, "接话的那位"),
      "【这个村子此刻】\n" + JSON.stringify(view),
      "【他们和「" + userName(profile) + "」的关系】两位都是住在同一个村子里的邻居，仅此而已。",
      "【要紧的】就着此刻说——这个天气、这个地方、他们照过几次面。"
        + "两句话，一人一句，是那种路上碰见随口说的：短，具体，不寒暄客套。"
        + "⚠️他们互相之间不熟到能聊私事，也不知道对方家里的事，别编。"
        + "⚠️更不知道「" + userName(profile) + "」和她同住那位之间的任何事，一个字都别提。"
        + "⚠️不编他们没发生过的往事，不替谁安排接下来做什么。",
      '【输出格式】只输出 JSON：{"lines":[{"who":"' + a.name + '","text":"第一句"},{"who":"' + b.name + '","text":"接的那句"}]}。'
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "他们说了什么。" }],
      { maxTokens: 65000, timeout: 180000, tag: "微光庭院邻里" });
    const obj = extractJSON(raw), rows = obj && Array.isArray(obj.lines) ? obj.lines : [];
    const out = rows.map(x => ({ who: String((x && x.who) || "").trim(), text: String((x && x.text) || "").trim() }))
      .filter(x => x.text).slice(0, 2);
    if (!out.length) { const e = new Error("这次没听清他们说什么。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return out;
  }
  // 他自己走过来、她点了头，才打的那一枪（她 2026-09-17）。
  // ⚠️这是整个庭院里最值钱的一次调用：别的都躲着不打，这一次是她主动要听。
  // ⚠️料全放 system，user 只留一句触发（施工规则/prompt-send-shape.md）。
  // ⚠️手上那几件【全是存档里真发生过的东西】，他只能从这里头挑：
  //   不给料他就只能说「我想你了」，那句话换个角色照样成立，等于没说。
  async function missLine({ active, character, profile, mainline, world, material }) {
    if (!active) throw new Error("先在设置里配置创作线路，他才说得出话。");
    const rows = (material && material.rows) || [];
    const quiet = Math.max(0, Number(material && material.quiet) || 0);
    const sys = [sharedStyle(),
      roleContext(character, profile, mainline),
      "【微光庭院】以本轮人设保留性格、声纹和相处方式，以游戏状态确定此时此地。⚠️这是你们在玩的一个小游戏：村子、天气、背包、这一天都是游戏里的，可以入戏，但别把它当成你们现实里真发生过的事——现实里的事只以上面给你的经历为准。",
      "【当前世界的事实】\n" + JSON.stringify(world),
      material && material.starNight
        ? "【此刻】你们在旧塔的星图桌前，把她一趟趟从井底带回来的星图碎片拼在了一起，天已经黑了，星图摊开在桌上。这一夜只有这一次，说你此刻真想说的。"
        : material && material.invite
        ? "【此刻】是你约她来" + String(material.invite.place || "这儿") + "的" + (material.invite.note ? "（你当时说的是：" + material.invite.note + "）" : "") + "，她真的来了，这会儿就站在你跟前。这一段只有这一次。"
        : "【此刻】你自己放下手里的事，走到她面前站住了。不是她叫你来的——是你自己想找她说句话。"
        + (quiet ? "你们已经 " + quiet + " 天没正经说过话了。" : ""),
      rows.length
        ? "【你手上这几样，都是你们之间真有过的】\n" + rows.map(r => "・〔" + r.kind + "・第 " + r.day + " 天〕" + r.text).join("\n")
          + "\n⚠️标着「你自己的东西」那几样，是她从井底捞上来、拿你的碎片炼成的——那是你自己的经历、梦或痕迹，不是她捡来的小玩意。要提它，先认出这是什么，再说她把它摆在那儿／留在馆里这件事。"
        : "【你手上什么都没有】你们之间还没攒下什么可说的东西。",
      "【要紧的一条】从上面那几样里【挑一件】说起，或者说这会儿眼前的天气、光线、她正在做的事。"
        + "⚠️绝不许编一段你们其实没发生过的事。"
        + "⚠️也别只说一句你想她——那句话谁来说都成立，等于没开口；真要说，也得说清是被什么勾起来的。"
        + "说完就完，不用替她安排接下来做什么，也不用留个问题等她接。",
      '【输出格式】只输出 JSON：{"say":["你开口的第一句","接着说的第二句"]}。'
        + "一条一个意思，她那头是一个一个气泡冒出来的。想说几条由你，一句说得完就一条。"
    ].join("\n\n");
    const raw = await callAI(active, sys, [{ role: "user", content: "他开口。" }], { maxTokens: 12000, timeout: 180000, tag: "微光庭院找你" });
    const obj = extractJSON(raw);
    const parts = obj ? replyParts(obj.say) : [];
    if (!parts.length) { const e = new Error("这次他没说出口，明天再来。"); e.detail = String(raw || "").slice(0, 1200); throw e; }
    return parts;
  }
  root.FairyGardenService = { generatePetCase, KEY, normalizeReply, ask, bottleReply, missLine, neighborLine, starLines, normalizeStar, pairLines, tasteWords, generateSeason, blossoms, shards, tastes, normalizeTastes, hello, normalizeHello, guideLines, normalizeGuide, gameBirthday, SEED_LABELS, SHARD_LABELS };
  // ⚠️原来这颗是【一栋小房子】，画的是世界 #1（微光庭院）。壳里现在装着好几个世界，
  //   主屏那颗图标是【进壳】的入口，不该再指认某一个世界。
  //   换成三颗大小不一的星子：只说「好几个小世界」。
  // 陪伴（js/companion.js）的换装面板也是这一份：它有自己的一身，但控件和规则不另写（one-public-mechanism）
  root.GardenDressControls = DressControls;
  root.GFairyGarden = p => h(Svg, p, h("path", {
    d: "M5 14a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M13 7.5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M3.9 6.2a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0" }));
  // 一局庭院（选好世界与存档之后的那一屏）。外面那层选择页在 FairyGardenApp。
  // 一份色板：原来 GardenSession 和 FairyGardenApp 各写了一份，改一处永远漏一处。
  const G = { ink: "#344936", soft: "#6e8060", line: "#d1dac2", paper: "#fffef5", deep: "#55704f" };
  // ⚠️写成函数，不是模块级常量：好几条测试把这个文件【按段】抠出来在 vm 里跑，
  //   在模块加载那一刻就去取 F_BODY 的话，那几段一跑就是「F_BODY is not defined」。
  const pickButtonStyle = () => ({ border: "1px solid #c8d5ba", borderRadius: 14, padding: "14px 16px", background: "#f6f7ea", color: "#426043", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, textAlign: "left" });
  // 「挑一位同行者」那一页的正文：新开一段和在庭院里另开一间，用的是同一份。
  // ⚠️只此一份：这一页上「住在村里的排前面」「没有角色时提示去档案馆」这些分寸，
  //   照着再抄一份就会各改各的（施工规则/one-public-mechanism.md）。
  // ⚠️没有「先和示例同行者试玩」那条路了（她 2026-09-18：「直接把示例同行者删了吧，
  //   玩秋秋机的都是有角色的。所以主要 focus 还是角色互动和关系」）。
  //   那条路本来就是残的：没有角色时井里刨不出碎片 → 做不了东西 → 收藏馆空 →
  //   念不了咒 → 三条会开的路一条都开不了。摆着它＝请人去玩一个阉割版。
  //   ⚠️【以前开的那些示例档不动】：照样列在选档页上、照样进得去，只是不能再新建
  //   （施工规则外那条也管这儿：这一步执行完，有没有哪一份数据只剩一个副本了）。
  function partnerPickBody({ characters, live, note, onPick, error }) {
    const seated = (live || []).map(String);
    // 住在村里的那几位排在前面（她 2026-09-17：「改变同行应该是只能从邻居里面选」）。
    // ⚠️不是把别人挡掉：新存档村里一个人都没有，挡掉她就谁也选不了。
    //   选了住在村里的那一位，那间屋就空出来——他现在跟你一起住了，
    //   不会再变成两个人（那一层在 world.mjs 里，界面怎么点都绕不过去）。
    const rows = (characters || []).slice().sort((a, b) => seated.indexOf(String(b.id)) - seated.indexOf(String(a.id)));
    return h("div", { "data-wk": "fgpick", className: "flex-1 min-h-0 overflow-y-auto", style: { padding: 20 } },
      h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 1.9, marginBottom: 20, color: G.soft } },
        // ⚠️一个角色都没有的时候「挑一位」没有对象，而下面那句「也可以先去…」
        //   还暗示着本来有别的选择——那条选择（示例同行者）已经撤掉了。空的时候换一句话说。
        rows.length ? note : "这个世界是和你手机里的角色一起过的。先去人格档案馆创建一位，再回来开一段。"),
      h("div", { style: { display: "grid", gap: 11 } },
        rows.map(c => h("button", { "data-wk": "fgpickrow", key: c.id, style: pickButtonStyle(), onClick: () => onPick(c.id) },
          (c.remark || c.name) + (seated.includes(String(c.id)) ? " · 住在村里" : "")))),

      error && h("p", { role: "alert", style: { color: "#a34836", marginTop: 14, fontFamily: F_BODY, fontSize: 12.5 } }, error));
  }
  function GardenSession(props) {
    // 存档挂哪儿：庭院房给自己那把钥匙，首页试玩仍是公共那一档
    const storeKey = useRef(null); if (!storeKey.current) storeKey.current = props.storeKey || KEY;
    const recordRef = useRef(null);
    // 庭院房的同行者就是这间房的角色，没得选：进门那一刻就钉死，免得先闪一下选人页
    const t = useTheme(), initial = useRef(null), stalled = useRef("");
    if (!initial.current) {
      try {
        const d = read(storeKey.current);
        initial.current = (props.lockPartnerId && String(d.partnerId) !== String(props.lockPartnerId))
          ? write(storeKey.current, { ...d, partnerId: String(props.lockPartnerId) }) : d;
      } catch (e) {
        stalled.current = e.message;
        initial.current = { version: 1, id: "", partnerId: "", world: null, dialogs: {} };
      }
    }
    const [entry, setEntry] = useState(() => initial.current), [pick, setPick] = useState(!initial.current.partnerId && !props.startSolo), [solo, setSolo] = useState(!!props.startSolo), [chat, setChat] = useState(false), [draft, setDraft] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [detail, setDetail] = useState(""), [loaded, setLoaded] = useState(false);
    const frame = useRef(null), alive = useRef(true), busyRef = useRef(false), propsRef = useRef(props), owner = useRef(initial.current.id), serial = useRef(0), messages = useRef(null); propsRef.current = props;
    // ⚠️禁区要跟着这一屏一起走：不撤的话，出了庭院悬浮播放器还悬在半空，
    //   而外面根本没有那条行动栏——那就成了「哪儿都躲着一条看不见的东西」。
    // 这一季的安排还在路上她就离开了（2026-10-01「离开这页就白跑」查出来的）：
    //   回来的那一份按庭院的规矩不写入，可存档里那条 pending 原样挂着——下回进来 185 秒内
    //   点什么都是「上次请求还在处理」。所以离开的那一刻就把它标成没排完，回来可以直接重试。
    const planInFlight = useRef(null);
    useEffect(() => () => {
      const f = planInFlight.current; if (!f) return;
      try { const d = loadJSON(storeKey.current, null); if (d && d.plans && d.plans[f.key] && d.plans[f.key].request === f.request)
        write(storeKey.current, { ...d, plans: { ...d.plans, [f.key]: { status: "failed", at: Date.now(), error: "离开庭院时这一季还没排好，回来可以重试。" } } }); } catch (e) {}
    }, []);
    useEffect(() => { alive.current = true; return () => { alive.current = false; serial.current++; if (window.FloatKeepClear) window.FloatKeepClear.set(0); if (frame.current) hosts.delete(frame.current.contentWindow); }; }, []);
    const current = () => {
      if (!alive.current) throw new Error("这个庭院页面已经离开了。");
      const d = loadJSON(storeKey.current, null); if (!d || d.id !== owner.current) throw new Error("存档已经切换，请重新进入庭院。"); return root.GameClock.archive(d);
    };
    const partner = () => (propsRef.current.characters || []).find(c => String(c.id) === String(current().partnerId)) || null;
    const update = fn => { const next = write(storeKey.current, fn(current())); setEntry(next); return next; };
    // 这一局那位同行者的主线底子（buildBundle 那一份：人设、心情、记忆、反八股…）。
    // ⚠️她 2026-09-19 问「小世界里也知道在放啥歌」时查出来的：房间那条路一直传着
    //   mainline，小世界这条路【从来没传过】——角色在小世界里是薄的，只有人设正文，
    //   没有心情、没有记忆、没有一起听、也没有反八股那一堆。
    //   这正是 施工规则/four-surfaces-same-context.md 记的那个形状（群聊变霸总、
    //   解梦馆变心理测试）：一层写在一处，别处没跟上。
    // 小世界这条路的同行者是按存档挑的、会换人，所以要的是【一个函数】不是一段字：
    //   问它要谁的，它就现拼谁的。房间那条路锁死一个人，传进来的那段照旧直接用。
    const mainlineNow = () => {
      const raw=worldRecord(propsRef.current,storeKey.current,'garden',current());
      if(raw?.hasMainline)return raw.mainline();
      const fixed = String(propsRef.current.mainline || "").trim();
      if (fixed) return fixed;
      const c = partner(); if (!c) return "";
      try { return String(propsRef.current.mainlineFor ? propsRef.current.mainlineFor(c.id) : "") || ""; }
      catch (e) { return ""; }
    };
    // 正在念的那一条；重开一轮或者她关掉开关时要立刻掐掉
    const aloud = useRef(null); if (!aloud.current) aloud.current = makeAloud();
    const stopAloud = () => aloud.current.stop();
    const game = () => frame.current && frame.current.contentWindow.FairyGardenGame;
    const flush = () => { const g = game(); if (g && !g.flush()) throw new Error("进度还没有保存成功，请先留在庭院。"); };
    const back = () => { try { flush(); serial.current++; props.onBack(); } catch (e) { setError(e.message); props.toast(e.message); } };
    const choose = id => {
      // 挑了手机里的一位＝给 TA 开一间庭院房，不是把这一档换个人顶上。
      // 一间房＝一个庭院存档是这条线从头定下的；在原地换人会让这一档的过去接到别人身上。
      // ⚠️原来这一句还挂着 lockPartnerId：于是【已经在庭院房里】才走这条，
      //   从首页那个入口挑人走的是下面那条——只把 partnerId 写进这一档，
      //   一间房都没有。她 2026-09-18：「我从游戏开了一档根本没连房间」。
      //   挑示例同行者（id 为空）才走下面那条：那一档本来就不属于谁，所以不挂房间。
      if (id && props.onNewGardenRoom) { setPick(false); props.onNewGardenRoom(id); return; }
      try { const old = loadJSON(storeKey.current, null); if (old && old.id !== owner.current) throw new Error("存档已经切换，请重新进入庭院。"); const d = old || initial.current; const next = write(storeKey.current, { ...d, partnerId: id || "" }); owner.current = next.id; setEntry(next); setSolo(!id); setPick(false); setLoaded(false); setError(""); setDetail(""); serial.current++; }
      catch (e) { setError(e.message); }
    };
    const changePartner = () => {
      // 她 2026-09-17：「从游戏里开新档它不会主动创建房间」。
      // ⚠️原来这儿只丢下一句「换人请另开一间」就完了：话是对的，可她得自己退出去、
      //   翻到房间列表、认出哪个预设是庭院、建一间——那一步本来就该我们替她做。
      if (props.lockPartnerId) { if (props.onNewGardenRoom) { setPick(true); return; }
        props.toast("这间庭院房就是和 TA 的，换人请另开一间。"); return; } if (busyRef.current) { props.toast("等这次回复完成后再换同行者。"); return; } try { flush(); serial.current++; setChat(false); setPick(true); } catch (e) { props.toast(e.message); } };
    // 说话那一层分三档（她 2026-09-18：「能不能再做一层折叠，要点开才会展开高一点，
    //   平时就对话框加一个小箭头，说话也不会自动弹出只有我手动才弹出」）：
    //   false＝收着 / 'bar'＝只留输入那一条 / 'tall'＝展开看记录。
    // ⚠️永远只由她点开：这一层不会因为他说了什么自己弹出来（他说的话在头顶的气泡里）。
    const openChat = value => { setChat(value); if (game()) game().setChatOpen(!!value); };
    const planKey = (cid, day) => String(cid) + ":" + (current().world?.epoch || "initial") + ":" + root.FairyGardenRules.seasonOf(day).key;
    async function planSeason(retry) {
      if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
      const c=partner(); if(!c) throw new Error("先选择手机里的角色，再一起安排这一季。");
      flush(); const world=game().snapshot(), key=planKey(c.id,world.day), old=(current().plans||{})[key];
      if(old?.status==="ready")return old.plan;
      if(old?.status==="pending" && Date.now()-old.at<185000)throw new Error("上次请求还在处理，稍后再看看这一季。");
      if(old && !retry)throw new Error("上次安排没有完成，可以点重试。日常活动仍会继续。");
      const epoch=serial.current, request="season_"+Date.now()+"_"+Math.random().toString(36).slice(2), cid=c.id;
      const accountId=async()=>root.Cloud?.getSessionUser?String((await root.Cloud.getSessionUser().catch(()=>null))?.id||""):"";
      busyRef.current=true;setBusy(true);
      try {
        update(d=>({...d,plans:{...(d.plans||{}),[key]:{status:"pending",at:Date.now(),request}}}));planInFlight.current={key,request};
        const account=await accountId();if(!alive.current||serial.current!==epoch)throw Error("庭院已离开，这次安排没有写入。");current();
        const plan=await generateSeason({active:propsRef.current.apiFor?propsRef.current.apiFor(cid):propsRef.current.active,character:c,profile:propsRef.current.profile,world,mainline:mainlineNow()});
        if(await accountId()!==account||!alive.current||serial.current!==epoch)throw Error("角色或账号已切换，这次安排没有写入。");
        const latest=current();if(String(latest.partnerId)!==String(cid)||!partner()||latest.plans?.[key]?.request!==request||planKey(cid,game().snapshot().day)!==key)throw Error("存档或季节已改变，这次安排没有写入。");
        update(d=>({...d,plans:{...(d.plans||{}),[key]:{status:"ready",at:Date.now(),plan}}}));
        game().refreshSeasonPlan();return plan;
      } catch(e) {
        if(alive.current&&serial.current===epoch)try{update(d=>d.plans?.[key]?.request===request?{...d,plans:{...d.plans,[key]:{status:"failed",at:Date.now(),error:e.message,detail:e.detail||""}}}:d);}catch(_){}
        throw e;
      } finally {busyRef.current=false;planInFlight.current=null;if(alive.current)setBusy(false);}
    }
    const bind = node => {
      if (frame.current && frame.current !== node) hosts.delete(frame.current.contentWindow); frame.current = node; if (!node) return;
      hosts.set(node.contentWindow, {
        load: () => current(), partner: () => { const c = partner(); return c ? { id: c.id, name: c.remark || c.name, birthday: gameBirthdayOf(c) } : null; },
        save: (world, worldId, journey) => frame.current === node && !!saveWorld(storeKey.current,current,world,worldId,journey),
        chooseStation: () => props.onStation(),
        travel: (to="train") => { if(frame.current!==node||busyRef.current){props.toast("等这次回复完成后再上车。");return false;}flush();stopAloud();serial.current++;return props.onTravel?.(to,{station:true}); },
        // 念出来：一句一句念，念完了才回来——游戏靠这个决定什么时候翻下一只气泡
        // （她 2026-09-19：「开了就每个气泡念完再到下一个气泡念」）。
        // ⚠️和聊天里那条语音走【同一个 ttsSpeak】：它自带 idb 缓存，另写一套合成
        //   就是又开一处要付钱的地方（施工规则/one-public-mechanism.md）。
        // 念不了就老老实实返回 false，让游戏退回原来的定时——不许把气泡卡死在那儿。
        ...aloud.current.bridge(() => frame.current === node, partner),
        changePartner,
        // 庭院整屏是一张画布，底下那条行动栏是它自己的操作位——报上来，
        // 悬浮播放器就不会默认停在它头上（js/components.js 的 FloatKeepClear）。
        floatClear: px => { if (window.FloatKeepClear) window.FloatKeepClear.set(px); },
        // 收花笺：游戏那头走到花圃按下收，生成这一枪在这儿打（callAI 在父页）。
        // 一次把开好的全回了，回来由游戏自己写进存档。
        // 下潜时补一池碎片：一次调用出一批，接下来几层刨到的都是从这池里取
        dig: async depth => {
          const c = partner();
          if (!c) throw new Error("先选一位同行者，井里才有东西。");
          const epoch = serial.current;
          return await shards({
            active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
            character: c, profile: propsRef.current.profile, mainline: mainlineNow(),
            world: (game() && game().snapshot()) || {}, depth: depth
          }).then(out => {
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这一批碎片没有写入。");
            return out;
          });
        },
        // 他自己来找你：走过来那一路是游戏算的，这一枪等她点了记号才打
        miss: async material => {
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const c = partner();
          if (!c) throw new Error("先选一位同行者。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const parts = await missLine({
              active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: mainlineNow(),
              world: (game() && game().snapshot()) || {}, material: material
            });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这句话没有写下来。");
            if (String(current().partnerId) !== String(c.id)) throw new Error("同行者已经换过，这句话没有写下来。");
            // ⚠️他说的话跟她问出来的那些落在同一处：不另开一本，不然聊天记录就有两份
            const record = recordRef.current;
            if (record) record.onTurn({ text: "", reply: parts.join("\n"), parts: parts });
            else update(old => replaceDialogs(old,c.id,'garden',localDialogs(old,c.id,'garden')
              .concat(parts.map((part, i) => ({ id: "miss_" + Date.now() + "_" + i, role: "assistant", content: part, status: "done" })))));
            return parts;
          } finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 礼物簿那张表：这位角色一辈子只问一次，问过就存在这一档里（跟季节安排一个放法）
        hasTastes: () => { const c = partner(); const d = current(); return !!(c && d.tastes && d.tastes[String(c.id)] && d.tastes[String(c.id)].status === "ready"); },
        // 屋里点衣柜／梳妆台（审计，她 2026-09-18）：开的就是季节手册那一页「样貌」，不另做一个换装界面
        openWardrobe: () => { pullLook(); pullGarden(); setDress(true); },
        // 点到挂在屋里的旅行相框：直接打开它（大图、背面、留言）
        openFrame: id => { const g = game(); const t = g && g.getTravelFrame && g.getTravelFrame(id); if (t) setFrame(t); },
        // 他带路那十句：一位角色问一次，存在这一档的 guides[charId]
        guideLines: async () => {
          const c = partner(); if (!c) throw new Error("先选一位同行者。");
          const cid = String(c.id), have = (current().guides || {})[cid];
          if (have && have.status === "ready") return have.rows;
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current; busyRef.current = true; setBusy(true);
          try {
            const rows = await guideLines({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: mainlineNow(), world: (game() && game().snapshot()) || {} });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几句没有写下来。");
            if (String(current().partnerId) !== cid) throw new Error("同行者已经换过，这几句没有写下来。");
            update(old => ({ ...old, guides: { ...(old.guides || {}), [cid]: { status: "ready", at: Date.now(), rows } } }));
            return rows;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 走近了跟邻居说句话（她 2026-09-18 的 a）：一天一位一次，每次现打。
        // ⚠️两道闸各管各的：door → 那位自己的主线记忆（走房间那道 gateCtx）；
        //   view → 这一档里能给 TA 看的（同行者那条线一个字都不在里头，见 neighborView）。
        neighborSay: async ({ charId, door, view, said }) => {
          const cid = String(charId), c = (propsRef.current.characters || []).find(x => String(x.id) === cid);
          if (!c) throw new Error("这位邻居不在手机里了。");
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const bundle = propsRef.current.neighborBundle ? propsRef.current.neighborBundle(cid, door) : "";
            const lines = await neighborLine({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, bundle, view, said });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几句没算数。");
            return lines;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 他报方向那四句：一位角色问一次，存在这一档的 stars[charId]（照 hello 的先例）
        starVoice: async () => {
          const c = partner(); if (!c) return null;
          const cid = String(c.id), have = (current().stars || {})[cid];
          if (have && have.status === "ready") return have.lines;
          if (busyRef.current) return null;     // ⚠️别在这儿抛：她正在转环，报不出就先用白话那几句
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const lines = await starLines({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: mainlineNow() });
            if (!alive.current || serial.current !== epoch) return null;
            update(old => ({ ...old, stars: { ...(old.stars || {}), [cid]: { status: "ready", at: Date.now(), lines } } }));
            return lines;
          } catch (e) { if (alive.current) { setDetail(e.detail || ""); } return null; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 路上撞见两位住户站住说两句：一对一天一次，每次现打（她在场才叫得到这儿）
        pairSay: async ({ a, b, view }) => {
          const list = propsRef.current.characters || [];
          const who = id => String(id) === "companion" ? partner() : list.find(x => String(x.id) === String(id));
          const ca = who(a), cb = who(b);
          if (!ca || !cb) throw new Error("这两位有一位不在手机里了。");
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const lines = await pairLines({ active: propsRef.current.apiFor ? propsRef.current.apiFor(ca.id) : propsRef.current.active,
              profile: propsRef.current.profile, a: ca, b: cb, view });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这两句没算数。");
            return lines;
          } catch (e) { if (alive.current) { setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 邻居打招呼那三句：一位邻居问一次，存在这一档的 hellos[charId]
        hello: async charId => {
          const cid = String(charId), c = (propsRef.current.characters || []).find(x => String(x.id) === cid);
          if (!c) throw new Error("这位邻居不在手机里了。");
          const have = (current().hellos || {})[cid];
          if (have && have.status === "ready") return have.rows;
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const rows = await hello({ active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, world: (game() && game().snapshot()) || {} });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几句没有写下来。");
            update(old => ({ ...old, hellos: { ...(old.hellos || {}), [cid]: { status: "ready", at: Date.now(), rows } } }));
            return rows;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        tastes: async () => {
          const c = partner();
          if (!c) throw new Error("先选一位同行者，才知道 TA 喜欢什么。");
          const cid = String(c.id), have = (current().tastes || {})[cid];
          // ⚠️类别表长了（v70.74 加了「吃的」）：老档那张表缺哪一类就再问一次，不缺就一辈子只问一次
          // ⚠️2026-09-18 起这张表是【一样一样】的：老档那份按类的键对不上，重问一次。
          //   单子以后再长（新加一样吃的），缺哪一样也重问——不缺就一辈子只问一次。
          const want = ((game() && game().giftCatalogue && game().giftCatalogue()) || []).map(x => x.key);
          if (have && have.status === "ready" && want.length
            && want.every(k => (have.rows || []).some(r => r && r.key === k))) return have.rows;
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const rows = await tastes({
              active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: mainlineNow(),
              world: (game() && game().snapshot()) || {},
              catalogue: (game() && game().giftCatalogue && game().giftCatalogue()) || []
            });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这张表没有写下来。");
            if (String(current().partnerId) !== cid) throw new Error("同行者已经换过，这张表没有写下来。");
            update(old => ({ ...old, tastes: { ...(old.tastes || {}), [cid]: { status: "ready", at: Date.now(), rows } } }));
            return rows;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        // 井里挖出来／做出来的那一样：第一次递出去那一下现问，问过就存在这一档里。
        // ⚠️档位是游戏那侧掷好了传过来的（rolledStance），这一枪只问他说什么。
        tasteOne: async ({ key, item, stance }) => {
          const c = partner();
          if (!c) throw new Error("先选一位同行者，才知道 TA 怎么想。");
          const cid = String(c.id), box = (current().tastes || {})[cid] || {};
          const had = (box.extra || {})[key];
          if (had && Array.isArray(had.words)) return had.words;
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const words = await tasteWords({
              active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: mainlineNow(), item, stance });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这一句没有写下来。");
            update(old => { const all = old.tastes || {}, mine = all[cid] || {};
              return { ...old, tastes: { ...all, [cid]: { ...mine, extra: { ...(mine.extra || {}), [key]: { stance, words, at: Date.now() } } } } }; });
            return words;
          } catch (e) { if (alive.current) { setError(e.message); setDetail(e.detail || ""); } throw e; }
          finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        bottleReply: async bottle => {
          if(busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const c=partner();if(!c)throw new Error("先选一位同行者，回信才有人写。瓶子会留着。");
          const epoch=serial.current;busyRef.current=true;setBusy(true);
          try {
            const out=await bottleReply({active:propsRef.current.apiFor?propsRef.current.apiFor(c.id):propsRef.current.active,
              character:c,profile:propsRef.current.profile,mainline:mainlineNow(),
              world:(game()&&game().snapshot())||{},bottle});
            if(!alive.current||serial.current!==epoch||String(current().partnerId)!==String(c.id))throw new Error("庭院或同行者已切换，这次回信没有写入。");
            return out;
          }catch(e){if(alive.current){setError(e.message);setDetail(e.detail||"");}throw e;}finally{busyRef.current=false;if(alive.current)setBusy(false);}
        },
        bloom: async rows => {
          if (busyRef.current) throw new Error("这次请求还在进行中，稍等一下。");
          const c = partner();
          if (!c) throw new Error("先选一位同行者，花才有人回。");
          const epoch = serial.current;
          busyRef.current = true; setBusy(true);
          try {
            const out = await blossoms({
              active: propsRef.current.apiFor ? propsRef.current.apiFor(c.id) : propsRef.current.active,
              character: c, profile: propsRef.current.profile, mainline: mainlineNow(),
              world: (game() && game().snapshot()) || {}, seeds: rows
            });
            if (!alive.current || serial.current !== epoch) throw new Error("庭院已经离开，这几张花笺没有写入。");
            if (String(current().partnerId) !== String(c.id)) throw new Error("同行者已经换过，这几张花笺没有写入。");
            return out;
          } finally { busyRef.current = false; if (alive.current) setBusy(false); }
        },
        planSeason, planState: day => { const d=current(); return (d.plans||{})[planKey(d.partnerId,day)]||null; },
        ready: () => {
          if (!alive.current) return;
          setLoaded(true);
          // 顶栏让位要在游戏【每次】就绪时都报一遍（群友 2026-10-09 截图：天气、缩放压在顶栏底下）：
          //   loaded 已经是 true 的时候（游戏页自己重载过一次），上面那个跟着 [headH, loaded] 走的 effect 不会再跑，
          //   新的那一页就一直以为顶栏高 0
          try { const g = game(); if (g && g.setHeadClear) g.setHeadClear(headHRef.current); } catch (e) {}
          ensureLooks();
        }
      });
    };
    // ── 说过的话只有一份 ────────────────────────────────────────────────
    // 庭院房里，那一份就是【这间房的聊天记录】，游戏按存档与世界筛选：
    // 主聊天那边翻得到，「能进记忆」「总结回主线」这些开关也才有东西可带。
    // 存档里只留还没落定的那几条（pending/failed）——重试要靠它认领，
    // 落定之后立刻交给房间，不在这儿留第二份。
    // 首页试玩没有房间可写，三世界对话仍保存在原存档，各自保留最近200条。
    // ⚠️从房间进来时 app.js 直接给 record；从【小世界那条路】进来时它给的是 recordFor，
    //   按这一档的钥匙现取（她 2026-09-18：「从游戏界面进是不显示聊天记录的」）。
    const record = worldRecord(props,storeKey.current,'garden',entry);
    recordRef.current = record;   // ⚠️回调里一律读这一份：props.record 只有从房间进来才有
    const doneHistory = (d, cid) => record
      ? ((recordRef.current && recordRef.current.history) || [])
      : localDialogs(d,cid,'garden').filter(m => m.status === "done");
    // ── 样貌（她 2026-09-16 接着要的）─────────────────────────────────────
    // 一个身体十二款头发，换一款是数据：这儿只管把选择递给游戏，存档由游戏那头写。
    // 清单从 apps/fairy-garden/doll.json 拿——发型名单和六个体型参数的上下限都在里面，
    // 由导模型那一步同时生成。界面上的名字/范围和模型里的网格/形态键永远对得上
    //（在这儿另写一份 JS 常量就是又一处要同步的）。
    // ⚠️顶栏浮在场景上面（她 2026-09-18：「上面又有框，不要做这个框挡住场景了」）。
    //   这是对 施工规则/mobile-ui-layout.md「顶栏自己占一条」的一处明写例外：
    //   庭院整屏是一张 3D 画布，横一条实心栏就等于把画剪掉一截。栏还是那条 Head
    //   （返回、标题、三颗药丸都没动），只是不再占位——底色换成一层往下化开的薄纱。
    //   ⚠️游戏那头的天气、地图控件本来贴着顶边，得让开这条栏：量出来的高度报进去，
    //   那边只有 --head-clear 这一个变量在用（不在两处各写一个数）。
    const headRef = useRef(null);
    const [headH, setHeadH] = useState(0);
    const headHRef = useRef(0); headHRef.current = headH;
    const [dress, setDress] = useState(false);
    // 花册（她 2026-09-16 定的种花那条）：写字和翻册子在手机这一侧，走过去收在游戏那一侧
    const [book, setBook] = useState(false);
    const [travelAlbum,setTravelAlbum]=useState(false);
    const [garden, setGarden] = useState(null);
    const [bookTab, setBookTab] = useState("notes");   // notes=花册 / shards=碎片盒
    // 请谁搬进来／改谁的门禁：这一页开着的时候，装的是那位的草稿（她 2026-09-18 的 b）
    const [invite, setInvite] = useState(null);
    // 量一次那条栏有多高：字号、安全区、机型都能改它，写死一个数迟早对不上
    useEffect(() => {
      const el = headRef.current; if (!el) return;
      const set = () => setHeadH(Math.round(el.getBoundingClientRect().height));
      set();
      if (!window.ResizeObserver) return;
      const ro = new ResizeObserver(set); ro.observe(el);
      return () => ro.disconnect();
    }, [pick, book, dress]);
    // 报给游戏：它那头的天气和地图控件照这个数往下让
    useEffect(() => { const g = game(); if (loaded && g && g.setHeadClear) g.setHeadClear(headH); }, [headH, loaded]);
    // 底下那条同理：聊天面板盖住多少就报多少，游戏那头照它算「他还看得见吗」
    // （她 2026-09-19：「现在气泡只显示最后一句话了」——他被判成出画面，气泡整串不冒）。
    const chatRef = useRef(null);
    const [chatH, setChatH] = useState(0);
    useEffect(() => {
      const el = chatRef.current;
      if (!el) { setChatH(0); return; }
      const set = () => setChatH(Math.round(el.getBoundingClientRect().height));
      set();
      if (!window.ResizeObserver) return;
      const ro = new ResizeObserver(set); ro.observe(el);
      return () => ro.disconnect();
    }, [chat, dress, book]);
    useEffect(() => { const g = game(); if (loaded && g && g.setChatClear) g.setChatClear(chatH); }, [chatH, loaded]);

    const [shardBox, setShardBox] = useState(null);
    const [bond, setBond] = useState(null);           // 相处册＋礼物簿（game.getBond）
    const [things, setThings] = useState(null);
    const [openFrameT, setFrame] = useState(null), [frameBusy, setFrameBusy] = useState(false);
    const [museum, setMuseum] = useState(null);
    const [bottles, setBottles] = useState(null);
    const [crew, setCrew] = useState(null);
    const [bottleText, setBottleText] = useState("");
    const bottleView=useRef({query:"",repliesOnly:false,page:0}),bottleArchive=useRef(null);
    const readBottleBook=(patch,scroll=false)=>{
      bottleView.current={...bottleView.current,...patch};
      const g=game();if(g?.getBottles)setBottles(g.getBottles(bottleView.current));
      if(scroll)requestAnimationFrame(()=>bottleArchive.current?.scrollIntoView({block:"start"}));
    };
    // 背面写字（庭院这边）：列车相册里还在就一起改；已经挂在庭院的相框也改
    const gardenBack = async (sourceId, who, text) => {
      const c = partner(), name = c ? (c.remark || c.name) : undefined, g = game();
      const d = current(), tr = d.worlds && d.worlds.train;
      if (tr && [...(tr.artworks || []), ...(tr.photos || [])].some(x => x.id === sourceId)) {
        const m = await import('../apps/train/album.mjs?v=' + BUILD);
        update(x => ({ ...x, worlds: { ...(x.worlds || {}), train: m.setBackNote(x.worlds.train, sourceId, who, text, name) } }));
      }
      const hung = g && g.getTravelFrame && g.getTravelFrame(sourceId);
      if (hung) { g.noteTravelBack(sourceId, who, text, name); setFrame(f => f && f.sourceId === sourceId ? g.getTravelFrame(sourceId) : f); pullGarden(); }
    };
    const frameAct = async fn => { if (frameBusy) return; setFrameBusy(true); try { await fn(); } catch (e) { props.toast(e.message); } finally { setFrameBusy(false); } };
    const frameItem = t => ({ id: t.sourceId, label: t.from || t.name, kind: t.memory ? 'puzzle' : 'photo', memory: t.memory, day: t.back && t.back.day, back: t.back });
    const pullGarden = () => { const g = game(); if (!g) return;
      if (g.getGarden) setGarden(g.getGarden());
      if (g.getShards) setShardBox(g.getShards());
      if (g.getThings) setThings(g.getThings());
      if (g.getCollection) setMuseum(g.getCollection());
      if (g.getBottles) setBottles(g.getBottles(bottleView.current));
      if (g.getNeighbors) setCrew(g.getNeighbors());
      if (g.getBond) setBond(g.getBond()); };
    const [who, setWho] = useState('companion');
    const [styles, setStyles] = useState(null);
    const [look, setLook] = useState({ me: {}, companion: {} });
    useEffect(() => {
      let on = true;
      fetch('apps/fairy-garden/doll.json?v=' + BUILD).then(r => r.json())
        .then(d => { if (on) setStyles(d); }).catch(() => {});
      return () => { on = false; };
    }, []);
    const pullLook = () => { const g = game(); if (g && g.getLook) setLook(g.getLook()); };
    // 这一侧还没设过样貌，就按性别补一份（她 2026-09-19：「为啥男的进去是默认女体我是男体」）。
    // ⚠️原来这件事只在进门那一瞬间试一次，而且只管同行者：那会儿角色还没就位就永远错过，
    //   他一直留着那头长卷发；她自己则连试都没试过，永远是写死的那身短发。
    // ⚠️她 2026-09-19：「不要设置性别！！！男的不许玩！！！」——这个 app 是给她用的，
    //   她自己那一侧【永远是女生】，写死在这儿，不做成设置项、也不去读任何人设字段。
    //   （我上一版自作主张往「我的面具」里加了一项，是加多了，已经撤掉。）
    // 配哪一身（头发＋六根形体参数）由游戏里那一份 GENDER_LOOKS 说了算，
    // 宿主只负责回答「这一位是他还是她」。
    const taOf = c => (typeof CharacterPronoun !== "undefined") ? CharacterPronoun.ta(c) : "TA";
    const ensureLooks = () => {
      try {
        const g = game();
        if (!g || !g.ensureLook) return;
        const c = partner();
        // 衣色仍旧取角色卡上那个色：性别那份只管头发和身形。
        if (c) g.ensureLook('companion', taOf(c), { cloth: c.color || '#729786' });
        g.ensureLook('me', "她");
        pullLook();
      } catch (e) {/* 样貌是锦上添花，出错不许拦住进门 */}
    };
    // 她 2026-09-17：「为啥感觉体型拉杆没用」——拉杆一直是有用的，是这一页【整页盖住了游戏】，
    // 她拖的时候一个像素都看不见。这一页顶上留一条透明的窗（PREVIEW_BAND=30%），
    // 底下那一格就是游戏自己往窗里渲的那个小人。开这一页就告诉它渲谁，关了就收。
    // 角色或用户人设【后来才就位】时再补一次：进门那一瞬间拿不到人，不该就这么算了。
    useEffect(() => { if (loaded) ensureLooks(); },
      [loaded, entry.partnerId]);
    useEffect(() => {
      const g = game(); if (!g || !g.preview) return;
      g.preview(dress ? who : null);
      return () => { const q = game(); if (q && q.preview) q.preview(null); };
    }, [dress, who, loaded]);
    const pushLook = patch => {
      const g = game(); if (!g || !g.setLook) return;
      if (!g.setLook(who, patch)) { props.toast("这次没存上，样貌还是原来的。"); return; }
      pullLook();
    };
    const char = (props.characters || []).find(c => String(c.id) === String(entry.partnerId));
    const localRows = localDialogs(entry,entry.partnerId,'garden');
    const rows = record
      ? (record.history || []).concat(localRows.filter(m => m && m.status !== "done"))
      : localRows;
    useEffect(() => { if (messages.current) messages.current.scrollTop = messages.current.scrollHeight; }, [rows.length, chat, busy]);
    // ⚠️这个提前 return 必须排在【所有 hook 之后】：排前面的话下面的 hook 这一帧不跑，
    //   React #310 直接白屏（test/hooks-order.test.js 钉着这条）。
    if (stalled.current) return h("div", { "data-wk": "fgstalled", className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: "等一下再进来", bg: "transparent", ink: "#344936", onBack: props.onBack }),
      h("div", { style: { padding: "22px 20px", fontFamily: F_BODY, fontSize: 13, lineHeight: 2 } }, stalled.current));
    async function send(retry) {
      if (busyRef.current || !game()) return;
      const c = partner(); if (!c) { setError("先选一位角色入住庭院。"); return; }
      const pending = retry ? rows.findLast(m => m.role === "user" && m.status !== "done") : null;
      const text = String(pending ? pending.content : draft).trim(); if (!text) return;
      const request = "turn_" + Date.now() + "_" + Math.random().toString(36).slice(2), epoch = serial.current, cid = c.id;
      busyRef.current = true; setBusy(true); setError(""); setDetail("");
      try {
        flush(); const world = game().snapshot();
        const d = update(old => { const previous = localDialogs(old,cid,'garden'), next = pending ? previous.map(m => m.id === pending.id ? { ...m, request, status: "pending" } : m) : previous.concat({ id: request, request, role: "user", content: text, status: "pending" }); return replaceDialogs(old,cid,'garden',next); });
        setDraft("");
        // 她自己说的那句也浮到她头顶上（她 2026-09-17：「我自己说话也要气泡」）。
        // ⚠️和他那只走同一个 speak()，只是 who 不同：另写一套的话，
        //   「一条显示完停一口气再下一条」那条规矩迟早只剩一边还对。
        try { if (game() && game().speak) game().speak(text, "me"); } catch (e) {}
        const account = root.Cloud && root.Cloud.getSessionUser ? await root.Cloud.getSessionUser().catch(() => null) : null;
        if (!alive.current || serial.current !== epoch) return;
        current();
        const result = await ask({ active: propsRef.current.apiFor ? propsRef.current.apiFor(cid) : propsRef.current.active, character: c, profile: propsRef.current.profile, world, history: doneHistory(d, cid).slice(-30), text, mainline: mainlineNow(), destinations: (game() && game().destinations && game().destinations()) || "", engineer: !!(propsRef.current.isEngineer && propsRef.current.isEngineer(cid)) });
        const accountNow = root.Cloud && root.Cloud.getSessionUser ? await root.Cloud.getSessionUser().catch(() => null) : null;
        if (!alive.current || serial.current !== epoch) return;
        const latest = current();
        if (String(latest.partnerId) !== String(cid) || !partner() || String(account && account.id || "") !== String(accountNow && accountNow.id || "") || !localDialogs(latest,cid,'garden').some(m => m.request === request && m.status === "pending")) throw new Error("角色或存档已变更，这次回复没有写入。");
        // 第一只气泡的那段静默（她 2026-09-19：「第一个气泡也是」）：
        // 下面还要写房间、写存档、过一遍 React，之后才轮到 speak() 去念。
        // 那几步跟合成没有先后关系，所以在这儿就先把头一句发出去合成——
        // 等真要念的时候，ttsWarm 那把钥匙已经在飞或已经落进缓存了。
        // ⚠️放在校验【之后】：校验没过的那一轮压根不该花这笔钱。
        try { const first = (result.parts || [])[0]; const g0 = game(); if (first && g0 && g0.warmVoice) g0.warmVoice(first); } catch (e) {}
        if (record) {
          // 先把这一轮交给房间（它才是记录），再把存档里那条在途的撤掉——
          // 顺序反过来的话，中间那一瞬这句话谁都没有。
          recordRef.current.onTurn({ text: text, reply: result.reply, parts: result.parts });
          update(old => replaceDialogs(old,cid,'garden',localDialogs(old,cid,'garden').filter(m => m.request !== request)));
        } else update(old => replaceDialogs(old,cid,'garden',localDialogs(old,cid,'garden').map(m => m.request === request ? { ...m, status: "done" } : m).concat(result.parts.map((part, i) => ({ id: request + "_reply" + (i ? "_" + i : ""), role: "assistant", content: part, status: "done" })))));
        // 他刚说的那句话浮到他头顶上（她 2026-09-17）。⚠️只是把已经收到的这句显示一遍，
        //   不另存一份、也不另发一次——聊天记录仍旧只有上面那一处。
        try { if (game() && game().speak) game().speak(result.parts); } catch (e) {}
        const accepted = game() && game().applyAction(result.action); if (!accepted) props.toast("回复已保存，这个动作暂时无法执行。");
      } catch (e) {
        if (alive.current && serial.current === epoch) { setError(e.message || "这次没能连上，稍后可以重试。"); setDetail(e.detail || ""); try { update(old => replaceDialogs(old,cid,'garden',localDialogs(old,cid,'garden').map(m => m.request === request ? { ...m, status: "failed" } : m))); } catch (_) {} }
      } finally { busyRef.current = false; if (alive.current) setBusy(false); }
    }
    // ── 这一页的按键（她 2026-09-16：「那些按键的 ui 好拥挤」）─────────────
    // 病根是这些按钮从来没装修过：没字体、没圆角、字挤在一条边上，
    // 跟 app 别处那套（F_BODY + 圆角 + 该留的白）完全不是一家人。
    // 一份色板 + 三个形状写在这儿，下面各处都取这儿的，不再各写各的行内样式。
    // 描边药丸：顶栏那个「说话」、面板里的「换同行者」「重试」都用它，大小只差一档
    const pill = (small) => ({
      border: "1px solid " + G.line, borderRadius: 999,
      padding: small ? "5px 12px" : "7px 15px",
      background: "rgba(255,255,255,.55)", color: G.soft,
      fontFamily: F_BODY, fontSize: small ? 11 : 12.5, lineHeight: 1.4, whiteSpace: "nowrap"
    });
    if ((!props.lockPartnerId || props.onNewGardenRoom) && (pick || (!char && !solo))) return h("div", { "data-wk": "fgpickpage", className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936" } },
      h(Head, { zh: "微光庭院", sub: props.lockPartnerId ? "给谁新开一间" : "选一位同行者", bg: "transparent", ink: "#344936", onBack: props.lockPartnerId ? () => setPick(false) : props.onBack }),
      partnerPickBody({ characters: props.characters, live: ((crew && crew.rows) || []).map(n => n.charId), error,
        note: props.lockPartnerId ? "一间房＝一个庭院存档。挑一位，就给 TA 新开一间，这一间和这一档都留着不动。" : "一起种花、探索林地，也可以边玩边聊。这里有独立的时间与经历。",
        onPick: choose }));
    return h("div", { "data-wk": "fggarden", className: "h-full flex flex-col", style: { background: "#e4e9d7", color: "#344936", position: "relative" } },
      // ⚠️浮在场景上面、不占位（见上面 headRef 那段注释）：薄纱往下化开，字还看得清，
      //   画面从屏幕最上边就开始。pointerEvents 只在栏本身上打开，别把场景的拖动吃掉。
      h("div", { "data-wk": "fghead", ref: headRef, style: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 5,
        background: "linear-gradient(180deg, rgba(228,233,215,.92), rgba(228,233,215,.62) 62%, rgba(228,233,215,0))" } },
      h(Head, { zh: "微光庭院", sub: char ? "与 " + (char.remark || char.name) + " 同行" : "自由试玩", bg: "transparent", ink: "#344936", onBack: back,
        // ⚠️开着花册/样貌时只留一个「回庭院」：三颗药丸并排会把标题挤扁
        right: (book || dress)
          ? h("button", { "data-wk": "fgpill", "data-part": "back", style: pill(), onClick: () => { setBook(false); setDress(false); } }, "回庭院")
          : h("div", { style: { display: "flex", gap: 7 } },
            h("button", { "data-wk": "fgpill", "data-part": "book", style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => { pullGarden(); setBook(true); }, disabled: !loaded }, "花册"),
            h("button", { "data-wk": "fgpill", "data-part": "dress", style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => { pullLook(); pullGarden(); setDress(true); }, disabled: !loaded }, "样貌"),
            h("button", { "data-wk": "fgpill", "data-part": "chat", "data-on": chat ? "1" : "0", style: { ...pill(), opacity: loaded ? 1 : .45 }, onClick: () => openChat(chat ? false : "bar"), disabled: !loaded }, chat ? "收起" : "说话")) })),
      h("div", { className: "flex-1 min-h-0", style: { position: "relative" } },
        h("iframe", { ref: bind, title: "微光庭院游戏", src: "apps/fairy-garden/index.html?embedded=1&v=" + BUILD, style: { width: "100%", height: "100%", border: 0, display: "block" }, onLoad: () => { if (game()) setLoaded(true); } }),
        !loaded && h("div", { "data-wk": "fgloading", style: { position: "absolute", top: 25, left: 0, right: 0, textAlign: "center", fontSize: 12, pointerEvents: "none" } }, "正在推开庭院的门…"),
        // ⚠️整页盖住游戏，而不是新开一屏：iframe 一旦卸载，这一局的进度就没了。
        // ⚠️顶栏现在浮着：整页盖上来的册子要自己让开那条栏，不然第一排索引签压在它底下
        openFrameT&&h(FrameSheet,{thing:openFrameT,busy:frameBusy,onClose:()=>setFrame(null),
          onNote:(who,text)=>frameAct(async()=>{await gardenBack(openFrameT.sourceId,who,text);}),
          onAsk:partner()?(()=>frameAct(async()=>{const c=partner(),p=propsRef.current,pm=await import('../apps/train/puzzle-memory.mjs?v='+BUILD);const line=await frameNote({active:p.apiFor?p.apiFor(c.id):p.active,character:c,profile:p.profile,mainline:mainlineNow(),item:frameItem(openFrameT),lines:pm.puzzleMemoryLines(openFrameT.memory),history:doneHistory(current(),c.id).slice(-30)});await gardenBack(openFrameT.sourceId,'companion',line);})):null}),
        travelAlbum&&h(TravelAlbum,{onNote:(item,who,text)=>gardenBack(item.id,who,text),onAskNote:partner()?(async item=>{const c=partner(),p=propsRef.current,pm=await import('../apps/train/puzzle-memory.mjs?v='+BUILD);const line=await frameNote({active:p.apiFor?p.apiFor(c.id):p.active,character:c,profile:p.profile,mainline:mainlineNow(),item,lines:pm.puzzleMemoryLines(item.memory),history:doneHistory(current(),c.id).slice(-30)});await gardenBack(item.id,'companion',line);}):null,getArchive:current,onExchange:async()=>{const m=await import('../apps/train/photography.mjs?v='+BUILD);update(d=>({...d,worlds:{...(d.worlds||{}),train:m.exchangePhotos(d.worlds?.train||{})}}));},onClose:()=>setTravelAlbum(false),onCarry:item=>{const g=game();if(!g?.receiveTravelArt)throw Error('庭院还没准备好');g.receiveTravelArt(item);pullGarden();},onDelete:async id=>{const m=await import('../apps/train/album.mjs?v='+BUILD);update(d=>({...d,worlds:{...(d.worlds||{}),train:m.removeAlbumItem(d.worlds?.train||{},id)}}));}}),
        book && h("div", { "data-wk": "fgbook", style: { position: "absolute", inset: 0, paddingTop: headH, background: "#e9ecdd", overflowY: "auto", WebkitOverflowScrolling: "touch" } },
          h("button",{style:{...pickButtonStyle(),margin:"12px 16px",width:"calc(100% - 32px)"},onClick:()=>{try{flush();props.onTravel("pets");}catch(e){props.toast(e.message);}}},"进入绒绒小镇"),
          // ⚠️这一册在现实里就是一本【索引册】，所以 tab 长成册子右边伸出来的一列索引签（施工规则/tabs-not-plain-pills.md）：
          //   竖排字、每张一个色、贴着页边往下排；选中那张是纸色、跟页面连成一片、往外拉出来一截，
          //   没选的往边上缩进去、暗着，像压在后面几页。七张竖着排也放得下，不会像横排那样把最后一张挤出屏幕。
          //   选中态不只靠颜色：位置、宽度、纸色、连不连着页面四样一起变。可点区 48px 高。
          //   sticky＋height 0：跟着页面滚也钉在右上，不用把滚动容器拆成两层。
          h("div", { "data-wk": "fgbooktabs", style: { position: "sticky", top: headH + 10, height: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, margin: 0 } },
            [["notes", "花册", ((garden && garden.notes) || []).length, "#e6d6c3"],
             ["shards", "碎片盒", ((shardBox && shardBox.rows) || []).length, "#dfe3c9"],
             ["things", "屋里", ((things && things.rows) || []).length, "#e4d9df"],
             ["museum", "收藏馆", ((museum && museum.rows) || []).length, "#d7e0e3"],
             ["travel", "旅行册", (current().worlds?.train?.photos||[]).length+(current().worlds?.train?.artworks||[]).length, "#e4d4bb"],
             ["bottle", "漂流瓶", ((bottles && bottles.waiting) || []).length, "#e7e1c9"],
             ["crew", "邻居", ((crew && crew.rows) || []).length, "#d9e5d7"],
             ["bond", "相处", bond ? bond.kinds.filter(k => k.count).length : 0, "#e6d4cf"]].map(([k, label, n, tint]) => {
              const on = bookTab === k;
              return h("button", { "data-wk": "fgbooktab", "data-on": on ? "1" : "0", key: k, onClick: () => k === "travel" ? setTravelAlbum(true) : setBookTab(k), className: "active:opacity-80", "aria-pressed": on,
                // ⚠️flexShrink:0 + nowrap 这两条【不许删】（她 2026-09-18 抓到：「你的字怎么是
                //   从右往左读的」）。外面那个 flex 列是 height:0 的 sticky 壳，可用主轴尺寸＝0，
                //   于是默认的 flex-shrink:1 会把每张签压到 min-content——竖排的 min-content
                //   就是【一列一个字】，「花册」当场断成两列。而中文竖排的列序是右→左，
                //   两列读起来就成了「册花」。看着像我把字写反了，其实是被挤的。
                //   nowrap 是第二道：以后谁把 height:0 拿掉，它也不会再断列。
                style: { writingMode: "vertical-rl", whiteSpace: "nowrap", flexShrink: 0,
                  minHeight: 56, minWidth: on ? 46 : 40, padding: on ? "13px 8px 13px 9px" : "11px 7px 11px 8px",
                  fontFamily: F_BODY, fontSize: on ? 14 : 13, letterSpacing: 1.5, lineHeight: 1,
                  color: on ? G.ink : "#7d8b72", background: on ? G.paper : tint,
                  border: "1px solid " + G.line, borderRight: 0, borderLeft: on ? "1px solid " + G.paper : "1px solid " + G.line,
                  borderRadius: "10px 0 0 10px", transform: on ? "translateX(0)" : "translateX(7px)",
                  boxShadow: on ? "-2px 2px 5px rgba(52,73,54,.12)" : "none", position: "relative", zIndex: on ? 2 : 1, transition: "transform .15s ease" } },
                label + (n ? " " + n : "")); })),
          bookTab === "bond" ? h("div", { "data-wk": "fgbookpage", "data-part": "bond", style: { padding: "16px 54px 40px 16px" } },
            // ── 相处册（她 2026-09-18：「做1和2」）。刻度按【一起做过几种事】走，不是分数。
            // ⚠️名单、档位、礼物的类别与态度都问 world.mjs 那一处要（getBond），这儿只画。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "你们一起做过的事都记在这儿。做过的事越多样，处得越熟；处熟了，他能陪你去的地方就更多。"),
            bond ? h("div", null,
              h("div", { "data-wk": "fgbondcard", style: { borderRadius: 14, border: "1px solid " + G.deep, background: "rgba(255,255,255,.6)", padding: "12px 14px", marginBottom: 18 } },
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 17, color: G.ink } }, bond.label),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } },
                  bond.next ? "再一起做 " + bond.next.need + " 种没做过的事，就是「" + bond.next.label + "」。" : "能一起做的事，都一起做过了。"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 6, lineHeight: 1.7 } },
                  "现在他愿意陪你去：" + bond.canGo.map(x => x.label).join("、"))),
              // 他带路的开关（她 2026-09-18：「开了的话就让角色带着过一遍」）
              bond.guide ? h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderRadius: 12, border: "1px solid " + G.line, background: "rgba(255,255,255,.55)", padding: "9px 12px", marginBottom: 14 } },
                h("div", null,
                  h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.ink } }, "他带路"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginTop: 2, lineHeight: 1.6 } },
                    bond.guide.on ? (bond.guide.step ? "现在带你：" + bond.guide.step.label : "这一圈带完了，换季那天他还会带你看一处") : "关着。开了他会先走到该去的地方等你。")),
                h("button", { "data-wk": "fgguide", "data-on": bond.guide.on ? "1" : "0", className: "active:opacity-70", onClick: () => { const g = game(); if (!g || !g.setGuide) return; g.setGuide(!bond.guide.on); pullGarden(); },
                  style: { ...pill(true), borderColor: bond.guide.on ? G.deep : G.line, color: bond.guide.on ? "#f7faf2" : G.soft, background: bond.guide.on ? G.deep : "rgba(255,255,255,.55)" } },
                  bond.guide.on ? "开着" : "关着")) : null,
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "一起做过的"),
              h("div", { style: { display: "grid", gap: 8, marginBottom: 20 } },
                bond.kinds.map(k => h("div", { "data-wk": "fgitem", "data-part": "kind", key: k.kind, style: { borderRadius: 12, border: "1px solid " + (k.count ? G.line : "rgba(209,218,194,.5)"), background: k.count ? "rgba(255,255,255,.6)" : "transparent", padding: "9px 12px", opacity: k.count ? 1 : .55 } },
                  h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                    h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink } }, k.label),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, k.count ? (k.count > 1 ? k.count + " 次 · " : "") + "第 " + k.day + " 天" : "还没有")),
                  k.text ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 4, lineHeight: 1.6 } }, k.text) : null))),
              // ── 礼物簿：七类各自摸清了没有。⚠️他喜欢什么是他自己定的，这儿只显示她已经试出来的那几类
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "礼物簿"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                "在庭院里走到他身边点「递一样东西」。一天只递一样。每一样东西他都各有各的态度——递过才知道；第一次接过那一样时他说的话会留在这儿。"),
              ((bond.gifts.fromHim || []).length) ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                "他递给你的：" + bond.gifts.fromHim.map(r => r.name + "（第 " + r.day + " 天）").join("、")) : null,
              h("div", { style: { display: "grid", gap: 8 } },
                bond.gifts.families.map(f => h("div", { "data-wk": "fgitem", "data-part": "gift", key: f.id, style: { borderRadius: 12, border: "1px solid " + (f.count ? G.line : "rgba(209,218,194,.5)"), background: f.count ? "rgba(255,255,255,.6)" : "transparent", padding: "9px 12px", opacity: f.count ? 1 : .6 } },
                  h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                    h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink } }, f.label),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: f.stance === "love" || f.stance === "like" ? G.deep : "#93a188" } },
                      f.stance ? bond.gifts.stances[f.stance] + (f.count > 1 ? " · 递过 " + f.count + " 次" : "") : f.count ? "他没说" : "？")),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 3, lineHeight: 1.6 } }, f.what),
                  // ⚠️同一类里【一样一样】各自一行（她 2026-09-18：「每一档都单独吧」）：
                  //   一样是花，月光花和星铃花未必一个待遇；他说的话也各是各的。
                  (f.items || []).length ? h("div", { style: { display: "grid", gap: 6, marginTop: 7 } },
                    f.items.map(it => h("div", { "data-wk": "fgitemrow", key: it.key, style: { borderTop: "1px solid rgba(209,218,194,.55)", paddingTop: 6 } },
                      h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                        h("span", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.ink } }, it.name),
                        h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: it.stance === "love" || it.stance === "like" ? G.deep : "#93a188" } },
                          (it.stance ? bond.gifts.stances[it.stance] : "他没说") + (it.count > 1 ? " · 递过 " + it.count + " 次" : ""))),
                      it.said && it.said.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 3, lineHeight: 1.7, whiteSpace: "pre-wrap" } }, it.said.join("\n")) : null))) : null))),
              // ── 食谱册（她 2026-09-18：「夜市卖的跟吃的有关」）：十二样尝没尝过、会不会做。⚠️全从 world.foodBook 来，这儿只画
              bond.food ? h("div", { style: { marginTop: 20 } },
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "食谱册 · 尝过 " + bond.food.tasted + " / " + bond.food.total),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                  (bond.food.open ? "夜市开着，去灯串集市。" : bond.food.tonight ? "今晚有夜市，天黑后开。" : "夜市一季一次、两晚，下次是第 " + bond.food.next + " 天。") + "会做的在自己家灶台上做；吃的也能递给他，是礼物簿里单独一类。"),
                bond.food.pantry.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                  "篮子里：" + bond.food.pantry.map(p => p.label + (p.from === "him" ? "（他买的）" : p.from === "home" ? "（自己做的）" : "")).join("、")) : null,
                bond.food.buffs.length ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.deep, marginBottom: 10, lineHeight: 1.7 } }, bond.food.buffs.join("；")) : null,
                h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                  bond.food.items.map(it => h("div", { "data-wk": "fgitem", "data-part": "food", key: it.id, style: { borderRadius: 12, border: "1px solid " + (it.tasted ? G.line : "rgba(209,218,194,.5)"), background: it.tasted ? "rgba(255,255,255,.6)" : "transparent", padding: "8px 10px", opacity: it.tasted ? 1 : .6 } },
                    h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.ink } }, it.tasted ? it.label : "？"),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188", marginTop: 3, lineHeight: 1.6 } },
                      (it.tasted ? it.note : it.season != null ? "只在一季的夜市有" : it.cook ? "夜市上有，也能自己做" : "夜市上有") + (it.cook ? (it.known ? " · 会做" : " · 还不会做") : "") + (it.tasted && it.buff ? " · " + it.buff : ""))))))
              : null)
            : h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft } }, "还没读到这一册。"))
          : bookTab === "crew" ? (invite ? h("div", { "data-wk": "fgbookpage", "data-part": "invite", style: { padding: "16px 54px 40px 16px" } },
            // ── 请 TA 搬进来之前先把话说清（她 2026-09-18：「邀请邻居进来是不是也能直接设置」）──
            // ⚠️开关那几条【不在这儿另写一份】：名字和措辞都问 ChatRooms.GROUPS.cognition，
            //   全库的房间用的就是那一份（施工规则/one-public-mechanism.md）。
            //   「回这间房先补看主聊天」那一条没有对象——邻居不住在一间房里，所以只有它被摘掉。
            (() => {
              const Kit = root.ChatRooms;
              const rows = ((Kit && Kit.GROUPS && Kit.GROUPS.cognition) || []).filter(([k]) => k !== "mainDelta");
              const who = (props.characters || []).find(c => String(c.id) === String(invite.charId));
              const flip = k => setInvite(v => ({ ...v, door: { ...v.door, [k]: !v.door[k] } }));
              return h(React.Fragment, null,
                h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: G.ink } },
                  invite.fresh ? "请 " + (who ? (who.remark || who.name) : "TA") + " 搬进村里" : "改" + invite.name + "的设定"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, margin: "6px 0 14px" } },
                  "住进来之后 TA 在村里过自己的日子，你走在村里会碰见。这几条现在就能定，之后也随时能改。"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 6 } }, "村里叫 TA 什么"),
                h("input", { "data-wk": "fginput", "data-part": "invitename", value: invite.name, maxLength: 16,
                  onChange: e => setInvite(v => ({ ...v, name: e.target.value })),
                  style: { width: "100%", padding: "10px 11px", borderRadius: 11, border: "1px solid " + G.line,
                    background: "rgba(255,255,255,.7)", color: G.ink, fontFamily: F_BODY, fontSize: 14, outline: "none" } }),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginTop: 6, lineHeight: 1.7 } },
                  "样子搬进来之后在「样貌」那一页换，和同行者走同一套。"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, margin: "18px 0 4px" } }, "TA 进这个村子时带着什么"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, lineHeight: 1.7, marginBottom: 6 } },
                  "默认什么都不带。TA 是你手机里的角色，带哪些进来由你一条条拨开。"),
                rows.map(([k, label, note]) => h("div", { "data-wk": "fgdoorrow", key: k, className: "flex items-center justify-between",
                  style: { padding: "11px 0", borderBottom: "1px solid " + G.line, gap: 12 } },
                  h("div", null,
                    h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink } }, label),
                    h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: G.soft, marginTop: 2, lineHeight: 1.45 } }, note)),
                  h("button", { "data-wk": "fgdoor", "data-on": invite.door[k] ? "1" : "0", onClick: () => flip(k), className: "active:opacity-70", "aria-pressed": !!invite.door[k],
                    style: { flexShrink: 0, width: 46, height: 27, borderRadius: 999, border: "1px solid " + G.line,
                      background: invite.door[k] ? G.deep : "rgba(255,255,255,.6)", padding: 2, display: "flex",
                      justifyContent: invite.door[k] ? "flex-end" : "flex-start" } },
                    h("span", { style: { width: 21, height: 21, borderRadius: 999, background: invite.door[k] ? "#fffef5" : "#c6d0b8", display: "block" } })))),
                h("div", { className: "flex", style: { gap: 9, marginTop: 20 } },
                  h("button", { "data-wk": "fgbtn", "data-part": "invite", onClick: () => {
                      const g = game(); if (!g) return;
                      const err = invite.fresh
                        ? g.moveIn({ charId: invite.charId, name: invite.name, look: {}, door: invite.door })
                        : g.setNeighborDoor(invite.charId, invite.door, invite.name);
                      if (err) { props.toast(err); return; }
                      setInvite(null); pullGarden();
                      props.toast(invite.fresh ? invite.name + "搬进来了。" : "改好了。"); },
                    style: { flex: 1, padding: "11px 0", borderRadius: 12, border: 0, background: G.deep,
                      color: "#f6f7ea", fontFamily: F_BODY, fontSize: 13 } },
                    invite.fresh ? "请 TA 搬进来" : "保存"),
                  h("button", { "data-wk": "fgbtn", "data-part": "cancel", onClick: () => setInvite(null),
                    style: { padding: "11px 15px", borderRadius: 12, border: "1px solid " + G.line,
                      background: "transparent", color: G.soft, fontFamily: F_BODY, fontSize: 12.5 } }, "算了")));
            })())
          : h("div", { "data-wk": "fgbookpage", "data-part": "crew", style: { padding: "16px 54px 40px 16px" } },
            // ── 邻居（她 2026-09-17：「更像邻居关系」）。三间屋就是三个名额。
            // ⚠️他们走路用的是【跟同行者同一套】控制器和布偶，只是各跑一份。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "村里有三间邻居屋。请谁住进来，谁就在村里过自己的日子——早上出门、去集市、傍晚回自己门前，你走在村里会碰见。走近了能挥手、能递东西，处得近了公告栏上的委托才落他们的名字。"),
            ((crew && crew.pairs) || []).length ? h("div", { style: { borderRadius: 12, border: "1px solid " + G.line, background: "rgba(255,255,255,.45)", padding: "9px 12px", marginBottom: 14 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.ink, marginBottom: 4 } }, "他们之间"),
              crew.pairs.map((p, i) => h("div", { key: i, style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.7 } },
                p.a + " 和 " + p.b + " 在村里碰过 " + p.n + " 次" + (p.day ? "，最近是第 " + p.day + " 天" : "")))) : null,
            ((crew && crew.rows) || []).length ? h("div", { style: { display: "grid", gap: 10, marginBottom: 18 } },
              crew.rows.map(n => h("div", { "data-wk": "fgitem", "data-part": "crew", key: n.charId, style: { borderRadius: 14, border: "1px solid " + G.line, background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: G.ink } }, n.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, n.houseLabel)),
                h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5 } },
                  n.here ? "这会儿在" + (n.where || n.map) : "这会儿在" + n.map),
                // 碰见：走在村里照过几次面。⚠️这个数只数【她自己碰见的】，
                //   邻居之间碰得再多也不是她的交情（world.mjs 的 metCount 就是这么算的）。
                h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 4 } },
                  n.met ? "碰见过 " + n.met + " 次 · " + n.closeness : "还没在路上碰见过"),
                h("div", { className: "flex items-center", style: { gap: 14, marginTop: 8 } },
                  h("button", { "data-wk": "fgbtn", "data-part": "editcrew", onClick: () => setInvite({ charId: n.charId, name: n.name, door: { ...(n.door || {}) }, fresh: false }),
                    className: "active:opacity-60",
                    style: { fontFamily: F_BODY, fontSize: 10.5, color: G.deep, background: "transparent", padding: 0 } },
                    "设定 ›"),
                  h("button", { "data-wk": "fgbtn", "data-part": "moveout", onClick: () => { const g = game(); if (!g || !g.moveOut) return;
                      const err = g.moveOut(n.charId);
                      if (err) { props.toast(err); return; } pullGarden(); props.toast(n.name + "搬走了。房间和聊天都留着。"); },
                    className: "active:opacity-60",
                    style: { marginLeft: "auto", fontFamily: F_BODY, fontSize: 10.5, color: "#a08d86", background: "transparent", padding: 0 } },
                    "请 TA 搬走")))))
              : h("div", { "data-wk": "fgempty", style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9, marginBottom: 16 } },
                  "三间屋都空着。"),
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 9 } },
              (crew && crew.free) ? "请谁搬进来" : "三间都住满了"),
            (crew && crew.free) ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7 } },
              (props.characters || []).filter(c => String(c.id) !== String(entry.partnerId)
                && !((crew && crew.rows) || []).some(n => String(n.charId) === String(c.id)))
                .slice(0, 40).map(c => h("button", { "data-wk": "fgcrewpick", key: c.id, className: "active:opacity-70",
                  onClick: () => setInvite({ charId: c.id, name: c.remark || c.name, door: {}, fresh: true }),
                  style: { ...pill(true), borderColor: G.line, color: G.soft, background: "rgba(255,255,255,.55)" } },
                  c.remark || c.name)))
              : null))
          :           bookTab === "bottle" ? h("div", { "data-wk": "fgbookpage", "data-part": "bottle", style: { padding: "16px 54px 40px 16px" } },
            // 回信与原信沿用同一本漂流瓶记录。
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "写一句话封进瓶子里放下水，" + ((bottles && bottles.days) || 7) + " 个游戏日以后，可能捞到同行者的回信，也可能只有原信。到月湖栈桥捞，一天一只；读新回信会使用创作线路。"),
            h("textarea", { "data-wk": "fginput", "data-part": "bottle", value: bottleText, onChange: e => setBottleText(e.target.value), rows: 2, maxLength: 120,
              placeholder: "想放进瓶子里的那一句话……",
              style: { width: "100%", border: "1px solid " + G.line, background: G.paper, borderRadius: 14, padding: "10px 12px",
                fontFamily: F_BODY, fontSize: 14, color: G.ink, outline: "none", resize: "none" } }),
            h("button", { "data-wk": "fgbtn", "data-part": "bottle", className: "w-full active:opacity-70",
              onClick: () => { const g = game(); if (!g || !g.seal) return;
                const err = g.seal(bottleText);
                if (err) { props.toast(err); return; }
                setBottleText(""); pullGarden(); props.toast("放下水了，" + ((bottles && bottles.days) || 7) + " 个游戏日以后，去水边看看。"); },
              style: { marginTop: 9, border: 0, borderRadius: 999, padding: "11px 0", background: G.deep, color: "#f7faf2", fontFamily: F_BODY, fontSize: 13.5 } },
              "放下水"),
            ((bottles && bottles.waiting) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } },
                bottles.ready ? "有 " + bottles.ready + " 只已到月湖，去栈桥捞捞看" : "还在水里的"),
              bottles.waiting.map(b => h("div", { "data-wk": "fgitem", "data-part": "bottlewait", key: b.id, style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.8, padding: "8px 0", borderBottom: "1px solid rgba(209,218,194,.6)" } },
                b.text + (b.backIn ? " · 还有 " + b.backIn + " 个游戏日" : " · 已到月湖，待捞")))) : null,
            h("section", { "data-wk": "fgbottlebook", ref:bottleArchive,"aria-label":"漂流信册",style:{marginTop:22}},
              h("div", {style:{fontFamily:F_BODY,fontSize:12,color:G.ink,marginBottom:8}}, "捞上来过的 · 共 " + (bottles?.total||0) + " 封"),
              h("input", { "data-wk": "fginput", "data-part": "bottlesearch", type:"search","aria-label":"搜索漂流信",placeholder:"搜原句、回信或署名",value:bottleView.current.query,
                onChange:e=>readBottleBook({query:e.target.value,page:0}),
                style:{width:"100%",minHeight:44,border:"1px solid "+G.line,borderRadius:10,padding:"10px 12px",background:G.paper,color:G.ink,fontSize:14}}),
              h("label", {style:{display:"flex",alignItems:"center",gap:8,minHeight:44,fontSize:12,color:G.ink}},
                h("input", {type:"checkbox",checked:bottleView.current.repliesOnly,onChange:e=>readBottleBook({repliesOnly:e.target.checked,page:0})}), "只看回信"),
              h("div", {role:"status",style:{fontSize:11,color:G.soft,marginBottom:10}},
                bottles?.matches ? "找到 " + bottles.matches + " 封 · 第 " + (bottles.page+1) + " / " + bottles.pages + " 页" : bottles?.total ? "没有找到相符的信，换个词看看。" : "捞到的信会留在这里。"),
              h("div", {style:{display:"grid",gap:10}},
                (bottles?.drifts||[]).map((d,i)=>h("article", {key:(d.id||"")+":"+d.day+":"+i,style:{borderRadius:14,border:"1px solid "+G.line,background:"rgba(255,255,255,.6)",padding:"11px 13px"}},
                  h("div", {style:{fontFamily:F_BODY,fontSize:10.5,color:"#93a188"}},
                    "第 " + d.day + " 天捞到 · " + (d.kind === "reply" ? (d.sender || "同行者") + "的回信" : d.kind === "mine" ? "自己封的" : d.kind === "wish" ? "水灯上留的那句" : d.kind === "note" ? "旧花笺" : d.kind === "shard" ? "井里的碎片" : "馆里的一件") + "（第 " + d.from + " 天）"),
                  d.original && h("div", {style:{fontSize:12,color:G.soft,marginTop:8}}, "你放下的：" + d.original),
                  h("div", {style:{fontFamily:F_BODY,fontSize:13.5,color:G.ink,marginTop:6,lineHeight:1.85,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}},d.text)))),
              bottles?.pages>1 && h("div", {style:{display:"flex",justifyContent:"space-between",gap:12,marginTop:16}},
                h("button", { "data-wk": "fgpagebtn", "data-part": "prev", disabled:bottles.page===0,onClick:()=>readBottleBook({page:bottles.page-1},true),style:{...pill(),minHeight:44}}, "上一页"),
                h("button", { "data-wk": "fgpagebtn", "data-part": "next", disabled:bottles.page>=bottles.pages-1,onClick:()=>readBottleBook({page:bottles.page+1},true),style:{...pill(),minHeight:44}}, "下一页"))))
          :           bookTab === "museum" ? h("div", { "data-wk": "fgbookpage", "data-part": "museum", style: { padding: "16px 54px 40px 16px" } },
            // ── 收藏馆：三个位置摆不下的那些的【出口】。捐进去的永不删除，
            //    炼金笔记的全表由 world.mjs 一处生成，这儿只负责显示（别再抄一份）
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "留在收藏馆里的东西会一直摆着——背包会被挤掉，这一份不会。走进村南那间小馆才能留。"),
            // ⚠️馆里那几件排在前面：笔记有三十行，其中二十多行是「？」，
            //   摆在上面就把她真正捐进去的那几件压到屏幕外头去了。
            h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } },
              "馆里摆着的 " + ((museum && museum.rows) || []).length + " 件"),
            ((museum && museum.rows) || []).length ? h("div", { style: { display: "grid", gap: 10 } },
              museum.rows.map(t => h("div", { "data-wk": "fgitem", "data-part": "museum", key: t.id, style: { borderRadius: 14, border: "1px solid " + G.line, background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: G.ink } }, t.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, "第 " + t.gaveDay + " 天捐的")),
                travelFramePreview(t),
                t.image && h("button", { "data-wk": "fgframebtn", type: "button", onClick: () => setFrame(t), style: { ...pickButtonStyle(), padding: "7px 12px", fontSize: 12, minHeight: 40, marginBottom: 6 } }, "在背面写字"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } }, t.note),
                t.from ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 5, lineHeight: 1.6 } }, "用的那一片：" + t.from) : null)))
              : h("div", { "data-wk": "fgempty", style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9 } },
                  "还空着。做好一样东西，走进收藏馆把它留在那儿。"),
            // 炼金笔记：做成过的写出名字，没做成过的只留一行材料——那是线索，不是清单
            h("div", { style: { marginTop: 24, display: "flex", alignItems: "baseline", justifyContent: "space-between" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink } }, "炼金笔记"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: G.soft } },
                "做成过 " + ((museum && museum.made) || []).length + " / " + ((museum && museum.total) || 0) + " 种")),
            h("div", { style: { display: "grid", gap: 6, marginTop: 8 } },
              ((museum && museum.recipes) || []).filter(r => (museum.made || []).indexOf(r.key) > -1).map(r =>
                h("div", { key: r.key, style: { display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(209,218,194,.55)" } },
                  h("span", { style: { fontFamily: F_BODY, fontSize: 13, color: G.ink, flex: 1 } }, r.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } }, r.how)))),
            h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 12, lineHeight: 1.9 } },
              "还没做出来的：" + ((museum && museum.recipes) || []).filter(r => (museum.made || []).indexOf(r.key) < 0)
                .map(r => r.how).join("、")))
          :           bookTab === "things" ? h("div", { "data-wk": "fgbookpage", "data-part": "things", style: { padding: "16px 54px 40px 16px" } },
            // ── 修好的地方（她 2026-09-17：「做④吧宝宝」）。
            // ⚠️「还差什么」问的是 world.mjs 那一处（workShort），这儿不另算一遍。
            ((things && things.works) || []).length ? h("div", { style: { marginBottom: 22 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 4 } }, "修好的地方"),
              h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: G.soft, marginBottom: 10, lineHeight: 1.7 } },
                "弄好一处，村里就多一处能用的地方——下雨他会去那儿躲，午后他会去那儿坐。材料带齐了，走到那儿就能动手。"),
              h("div", { style: { display: "grid", gap: 9 } },
                things.works.map(w => h("div", { "data-wk": "fgitem", "data-part": "work", key: w.id, style: { borderRadius: 14, border: "1px solid " + (w.done ? G.deep : G.line), background: "rgba(255,255,255,.55)", padding: "10px 13px" } },
                  h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                    h("span", { style: { fontFamily: F_DISPLAY, fontSize: 14.5, color: G.ink } }, w.label),
                    h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: w.done ? G.deep : "#93a188" } },
                      w.done ? "弄好了" : (w.where || "公告栏"))),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } },
                    w.done ? w.hint : w.cost ? (w.short.length ? "还差" + w.short.join("、") : "材料齐了，走过去就能动手") + " · 要" + w.cost : w.hint))))) : null,
            // ── 屋里：锅炼出来的东西。⚠️这一整条链一枪都不打，全是代码算的
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "用碎片在锅里做出来的东西。能摆的摆出来——真下雨的时候，屋檐下的雨铃会响。屋里屋外每一件放得住东西的家具都摆得下：走过去点它就行。"),
            ((things && things.rows) || []).length ? h("div", { style: { display: "grid", gap: 10 } },
              things.rows.map(t => h("div", { "data-wk": "fgitem", "data-part": "thing", key: t.id, style: { borderRadius: 14, border: "1px solid " + (t.spot ? G.deep : G.line), background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                h("div", { className: "flex items-baseline justify-between", style: { gap: 8 } },
                  h("span", { style: { fontFamily: F_DISPLAY, fontSize: 15, color: G.ink } }, t.name),
                  h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    (things.ways[t.way] ? things.ways[t.way].label : "") + " · 第 " + t.day + " 天")),
                travelFramePreview(t),
                t.image && h("button", { "data-wk": "fgframebtn", type: "button", onClick: () => setFrame(t), style: { ...pickButtonStyle(), padding: "7px 12px", fontSize: 12, minHeight: 40, marginBottom: 6 } }, "在背面写字"),
                h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, marginTop: 5, lineHeight: 1.7 } },
                  t.ready ? t.note : "还封着，第 " + t.openDay + " 天才能打开。"),
                !t.ready ? h("button", { "data-wk": "fgbtn", "data-part": "ready", className: "active:opacity-70",
                  onClick: () => { const g = game(); if (!g || !g.hasten) return;
                    const err = g.hasten(t.id);
                    if (err) { props.toast(err); return; } pullGarden(); props.toast("倒了一滴月露，今天就能开。"); },
                  disabled: !((things && things.potions) > 0),
                  style: { ...pill(true), marginTop: 8, borderColor: G.line, color: ((things && things.potions) > 0) ? G.deep : "#b3bfa6",
                    background: "rgba(255,255,255,.55)" } },
                  ((things && things.potions) > 0) ? "倒一滴月露 · 今天就开" : "倒一滴月露（没有月露了）") : null,
                t.from ? h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: "#93a188", marginTop: 5, lineHeight: 1.6 } }, "用的那一片：" + t.from) : null,
                t.ready ? h("div", { style: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 } },
                  // ⚠️位置从三个变成了五十二个：一件东西底下铺五十二颗药丸没法用。
                  //   这儿只留【老三样 ＋ 它现在在的那一处 ＋ 她这会儿站着的那一件】，
                  //   其余的都在世界里——走过去点那件家具就能摆。那才是「每一处都能交互」。
                  Object.entries(things.spots).filter(([k]) =>
                    ["eaves", "sill", "pond"].includes(k) || k === t.spot || k === things.here).map(([k, label]) =>
                    h("button", { "data-wk": "fgbtn", "data-part": "thingact", key: k, className: "active:opacity-70",
                      onClick: () => { const g = game(); if (!g || !g.place) return;
                        const err = g.place(t.id, t.spot === k ? null : k);
                        if (err) { props.toast(err); return; } pullGarden(); },
                      style: { ...pill(true), borderColor: t.spot === k ? G.deep : G.line, color: t.spot === k ? G.ink : G.soft,
                        background: t.spot === k ? "rgba(85,112,79,.12)" : "rgba(255,255,255,.55)" } },
                      t.spot === k ? "已摆在" + label : "摆到" + label))) : null)))
              : h("div", { "data-wk": "fgempty", style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9 } },
                  "还没有。下井刨一片碎片回来，走到炼药锅那儿做点东西。"))
          : bookTab === "shards" ? h("div", { "data-wk": "fgbookpage", "data-part": "shards", style: { padding: "16px 54px 40px 16px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "井潮带来的奇物，里面留着不同的片段。越深的只是越完整、越奇怪，不是越沉重。"),
            ((shardBox && shardBox.rows) || []).length ? h("div", { style: { display: "grid", gap: 10 } },
              shardBox.rows.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(sh =>
                h("div", { "data-wk": "fgitem", "data-part": "shard", "data-on": sh.pinned ? "1" : "0", key: sh.id, style: { borderRadius: 14, border: "1px solid " + (sh.pinned ? G.deep : G.line), background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "〔" + ((shardBox.curios && shardBox.curios[sh.curio] && shardBox.curios[sh.curio].name) || (shardBox.kinds && shardBox.kinds[sh.kind]) || "碎片") + "〕第 " + sh.depth + " 层 · 第 " + sh.day + " 天" + (sh.whole ? " · 完整的一片" : "")),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: G.ink, marginTop: 6, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, sh.text),
                  h("button", { "data-wk": "fgpin", onClick: () => { const g = game(); if (g && g.pinShard) { g.pinShard(sh.id); pullGarden(); } }, className: "active:opacity-60",
                    style: { marginTop: 7, fontFamily: F_BODY, fontSize: 10.5, color: sh.pinned ? G.deep : "#93a188", background: "transparent" } },
                    sh.pinned ? "已钉住" : "钉住"))))
              : h("div", { "data-wk": "fgempty", style: { fontFamily: F_BODY, fontSize: 12.5, color: G.soft, lineHeight: 1.9 } },
                  "还没有。从屋边那口井下去，石头里有东西。"),
            shardBox && shardBox.busy ? h("div", { style: { marginTop: 12, fontFamily: F_BODY, fontSize: 11.5, color: G.soft } }, "正在读这一层的石头…") : null,
            // ⚠️封出去的那几片【还读得到】——施法不烧掉碎片，这是它的另一半
            ((shardBox && shardBox.casts) || []).length ? h("div", { style: { marginTop: 22 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "封出去的"),
              h("div", { style: { display: "grid", gap: 10 } },
                shardBox.casts.map((c, i) => h("div", { "data-wk": "fgitem", "data-part": "cast", key: c.place + ":" + i, style: { borderRadius: 14, border: "1px dashed " + G.line, background: "rgba(255,255,255,.45)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "〔" + c.spell + "〕封在" + c.place + " · 第 " + c.day + " 天"),
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13, color: G.soft, marginTop: 6, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, c.text))))) : null,
            ((shardBox && shardBox.spells) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 6 } }, "会念的咒"),
              shardBox.spells.map(sp => h("div", { key: sp.id, style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, padding: "5px 0" } },
                sp.name + " · 要" + sp.need + " —— " + sp.note))) : null)
          : h("div", { "data-wk": "fgbookpage", "data-part": "notes", style: { padding: "16px 54px 40px 16px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              "走到花圃那儿种一句下去，过三天开花。开好了再走过去收——" + (char ? (char.remark || char.name) : "同行者") + "会在花笺上回你一句。"),
            // 地里的
            ((garden && garden.seeds) || []).length ? h("div", { style: { marginTop: 20 } },
              h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink, marginBottom: 8 } }, "地里的"),
              garden.seeds.map(sd => h("div", { "data-wk": "fgitem", "data-part": "seed", key: sd.id, style: { fontFamily: F_BODY, fontSize: 12, color: G.soft, lineHeight: 1.7, padding: "7px 0", borderBottom: "1px solid rgba(209,218,194,.6)" } },
                "〔" + (sd.label || garden.kinds[sd.kind] || "今天") + "〕" + (sd.ask || "（只种了一个念头）") + " · " + (sd.bloomIn > 0 ? "还有 " + sd.bloomIn + " 天开" : "开好了，去花圃收")))) : null,
            // 花册
            h("div", { style: { marginTop: 22, display: "flex", alignItems: "baseline", justifyContent: "space-between" } },
              h("span", { style: { fontFamily: F_BODY, fontSize: 12, color: G.ink } }, "花册"),
              h("span", { style: { fontFamily: F_BODY, fontSize: 10.5, color: G.soft } },
                ((garden && garden.notes) || []).length ? "共 " + garden.notes.length + " 张" : "还没有")),
            h("div", { style: { marginTop: 8, display: "grid", gap: 10 } },
              ((garden && garden.notes) || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(nt =>
                h("div", { "data-wk": "fgitem", "data-part": "note", "data-on": nt.pinned ? "1" : "0", key: nt.id, style: { borderRadius: 14, border: "1px solid " + (nt.pinned ? G.deep : G.line), background: "rgba(255,255,255,.6)", padding: "11px 13px" } },
                  h("div", { style: { fontFamily: F_BODY, fontSize: 10.5, color: "#93a188" } },
                    "第 " + nt.day + " 天 ·〔" + ((garden.kinds && garden.kinds[nt.kind]) || "今天") + "〕"),
                  nt.ask ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 4, lineHeight: 1.6 } }, "你问：" + nt.ask) : null,
                  h("div", { style: { fontFamily: F_BODY, fontSize: 13.5, color: G.ink, marginTop: 6, lineHeight: 1.85, whiteSpace: "pre-wrap" } }, nt.reply),
                  h("button", { "data-wk": "fgpin", onClick: () => { const g = game(); if (g && g.pinNote) { g.pinNote(nt.id); pullGarden(); } }, className: "active:opacity-60",
                    style: { marginTop: 7, fontFamily: F_BODY, fontSize: 10.5, color: nt.pinned ? G.deep : "#93a188", background: "transparent" } },
                    nt.pinned ? "已钉住" : "钉住")))))),
        dress && h("div", { "data-wk": "fgdress", style: { position: "absolute", inset: 0, background: "transparent", pointerEvents: "none" } },
          // ⚠️这条 30% 高的窗要【真的透明】：底下就是游戏，游戏往这儿渲要换的那个小人。
          //   高度必须和 game.mjs 的 PREVIEW_BAND 对上，改一处就得改两处——所以两边都写着对方。
          h("div", { style: { position: "absolute", left: 0, right: 0, top: 0, height: "30%" } }),
          h("div", { "data-wk": "fgdresspanel", style: { position: "absolute", left: 0, right: 0, top: "30%", bottom: 0, background: "#e9ecdd", overflowY: "auto", WebkitOverflowScrolling: "touch", pointerEvents: "auto", boxShadow: "0 -12px 30px #30442615" } },
          // 两个人：一排底线 tab，不是一排药丸（施工规则/tabs-not-plain-pills.md）
          h("div", { "data-wk": "fgdresstabs", style: { display: "flex", borderBottom: "1px solid " + G.line, background: "rgba(255,255,255,.4)" } },
            // 住在村里的那几位也在这一排（她 2026-09-17：「邀请邻居的话改不了外貌」）
            [["companion", char ? (char.remark || char.name) : "同行者"], ["me", "我"],
              ...(((crew && crew.rows) || []).map(n => [String(n.charId), n.name]))].map(([k, label]) =>
              h("button", { "data-wk": "fgdresstab", "data-on": who === k ? "1" : "0", key: k, onClick: () => setWho(k), className: "flex-1 active:opacity-70",
                style: { padding: "12px 0", fontFamily: F_BODY, fontSize: 13.5, color: who === k ? G.ink : "#93a188",
                  borderBottom: "2px solid " + (who === k ? G.deep : "transparent"), background: "transparent" } }, label))),
          h("div", { style: { padding: "16px 54px 40px 16px" } },
            h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, lineHeight: 1.8, marginBottom: 14 } },
              who === "companion" && char
                ? "换的是 " + (char.remark || char.name) + " 在这个庭院里的样子，只在这一个存档里算数。"
                : who === "me" ? "换的是你自己在这个庭院里的样子。"
                : "换的是住在村里那一位在这个庭院里的样子。"),
            h(DressControls, { who, look, styles, game, pushLook })))),
        chat && !dress && !book && h("section", { "data-wk": "fgchat", "data-on": chat === "tall" ? "1" : "0", ref: chatRef, "aria-label": "庭院聊天", style: { position: "absolute", left: 8, right: 8, bottom: 0, maxHeight: "52%", display: "flex", flexDirection: "column", background: "rgba(250,250,238,.97)", border: "1px solid " + G.line, borderTop: "1px solid " + G.line, borderRadius: "22px 22px 0 0", boxShadow: "0 -10px 34px #3044261f" } },
          // 抓手：一眼看出这层是能收起来的，也把面板和游戏画面隔开
          h("div", { style: { width: 34, height: 4, borderRadius: 999, background: G.line, margin: "8px auto 0" } }),
          // ⚠️那个小箭头就是【要不要看记录】：平时只留一条输入，点开才长高
          h("div", { style: { padding: "6px 10px 6px 16px", display: "flex", alignItems: "center", gap: 8 } },
            h("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: F_BODY, fontSize: 12, color: G.soft } },
              char ? "和 " + (char.remark || char.name) + " 说话" : "选一位角色，开始聊天"),
            chat === "tall" ? h("button", { "data-wk": "fgpill", "data-part": "newroom", onClick: changePartner, disabled: busy, style: { ...pill(true), opacity: busy ? .45 : 1 } }, "另开一间") : null,
            h("button", { "data-wk": "fgchattoggle", "aria-label": chat === "tall" ? "收起聊天记录" : "看看聊天记录", onClick: () => openChat(chat === "tall" ? "bar" : "tall"),
              style: { border: 0, background: "transparent", color: G.soft, fontSize: 15, minWidth: 40, minHeight: 34, lineHeight: 1 } },
              chat === "tall" ? "⌄" : "⌃")),
          chat === "tall" ? h("div", { "data-wk": "fgmsgs", ref: messages, className: "min-h-0 overflow-y-auto", style: { padding: "2px 16px 4px", fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.85, minHeight: 64, maxHeight: "34vh" } },
            h(LegacyWorldDialogs,{record,archive:entry,cid:entry.partnerId}),
            rows.map(m => h("div", { "data-wk": "fgmsg", "data-me": m.role === "user" ? "1" : "0", key: m.id, style: { margin: "0 0 13px" } },
              h("div", { "data-wk": "fgmsgname", style: { fontFamily: F_BODY, fontSize: 10, letterSpacing: ".06em", color: "#93a188", marginBottom: 2 } }, m.role === "user" ? "你" : (char && (char.remark || char.name) || "同行者")),
              h("div", { "data-wk": "fgbubble", "data-me": m.role === "user" ? "1" : "0", style: { whiteSpace: "pre-wrap", color: m.role === "user" ? G.soft : G.ink } }, m.content))),
            !rows.length && h("p", { "data-wk": "fgempty", style: { margin: "6px 0 12px", color: "#93a188" } }, "想聊什么，或者想一起去哪里？"),
            busy && h("p", { role: "status", style: { margin: "0 0 12px", color: "#93a188" } }, "正在回应…"),
            error && h("p", { role: "alert", style: { margin: "0 0 10px", color: "#a34836" } }, error),
            detail && h("details", { style: { marginBottom: 10 } }, h("summary", { style: { fontSize: 11, color: G.soft } }, "查看原始回复"), h("pre", { style: { whiteSpace: "pre-wrap", fontSize: 10, marginTop: 6 } }, detail))) : null,
          chat === "tall" && !busy && rows.some(m => m.role === "user" && m.status !== "done") && h("div", { "data-wk": "fgretry", style: { padding: "0 16px 8px" } },
            h("button", { style: pill(true), onClick: () => send(true) }, "重试上次未完成的回复")),
          h("form", { "data-wk": "fgcompose", onSubmit: e => { e.preventDefault(); send(false); }, style: { display: "flex", alignItems: "center", gap: 9, padding: "9px 12px 11px", paddingBottom: COMPOSER_PAD_BOTTOM, borderTop: "1px solid rgba(209,218,194,.7)" } },
            h("input", { "data-wk": "fginput", "data-part": "chat", "aria-label": "对同行者说", value: draft, onChange: e => setDraft(e.target.value), disabled: busy || !char, maxLength: 12000, placeholder: char ? "和同行者说句话…" : "先选择角色", style: { flex: 1, minWidth: 0, border: "1px solid " + G.line, background: G.paper, borderRadius: 999, padding: "11px 15px", fontFamily: F_BODY, fontSize: 16, color: G.ink, outline: "none" } }),
            h("button", { "data-wk": "fgsend", type: "submit", disabled: busy || !char || !draft.trim(), style: { flexShrink: 0, border: 0, borderRadius: 999, padding: "11px 17px", background: G.deep, color: "#f7faf2", fontFamily: F_BODY, fontSize: 13.5, opacity: (busy || !char || !draft.trim()) ? .38 : 1 } }, "发送")))));
  }

  // ── 进门那两页（她 2026-09-16：「先做个进入页面…再来到存档…新建或者开启已有」）──
  // 一层是【去哪个世界】，一层是【开哪一档】。庭院房那条路不走这儿：
  // 一间房就是一个世界一个存档，进门直接落到桌上（见 app.js 的 storeKey/lockPartnerId）。
  // ⚠️她 2026-09-18：占位的那三个世界全删了。原来摆在那儿是「这地方以后会长」的意思，
  //   可它们许的是三件谁都没在做的事——别人打开秋秋机，看见的就是三张空头支票。
  //   撤掉一件东西就把它删掉，不许留在原地当死代码（那三行连着灰卡片那一档渲染一起走）。
  const WORLDS = [
    { id: "garden", name: "微光庭院", label: "庭院", note: "种花、下井、和同行者一起把日子过下去" },
    { id: "train", name: "远行列车", label: "列车", note: "带上同一档的同行者，沿着山林、田野和海岸旅行" },
    { id: "pets", name: "绒绒小镇", label: "宠物", note: "跟着小尾巴，过自己的日子", cognition: "【绒绒小镇】这里是你和对方共同生活、一起养宠的日常。家、街区、店铺和家里的猫狗都是这个生活场景的一部分；照料、家务、职业与带回家的东西会成为你们共同的小日子。以眼前的状态和已经完成的记录承接经历，尚在路上或准备做的事按当前阶段理解。你怎样看待宠物、愿不愿照料、如何相处，沿你完整的人设、喜好与实际经历自然生发；两人可以商量、分工，也会有不同意见。其他往事沿这间房准许的上下文承接。" }
  ];
  const DAY_WORLD = { id: "day", name: "TA的一天", note: "跟着TA看看今天 · 现有日程与基础动作" };
  const INDEX_KEY = "x_fairyGardenSaves";
  // legacy＝原来那一档，钥匙仍是原来那把；扫回来的房间存档 id 自带 ":" 开头
  // 这一档里某个世界那一份进度。⚠️只有这一处答案：老档把庭院存在 `world` 上，
  //   新档存在 `worlds.garden` 里——读的人不该知道这件事。
  const worldOf = (rec, id) => {
    const w = String(id || "garden");
    return root.GameClock.world(rec||{},w);
  };
  const saveKeyOf = row => { const id = typeof row === "string" ? row : (row && row.id); return (row && row.key) || (id === "legacy" ? KEY : KEY + ":" + id); };
  // 老的那一档（KEY 里躺着的那份）要认回来当一条存档。
  // ⚠️绝不搬它的内容：搬＝复制一份再删一份，中间任何一步断掉就少一档。
  //   只在名册里记一笔，它的钥匙仍旧是原来那把。
  function readSaves() {
    const rows = (loadJSON(INDEX_KEY, []) || []).filter(x => x && x.id).map(x => ({
      id: String(x.id), world: String(x.world || "garden"),
      name: String(x.name || "").slice(0, 24), ts: Number(x.ts) || 0
    }));
    const legacy = loadJSON(KEY, null);
    if (legacy && legacy.id && !rows.some(x => x.id === "legacy")) {
      rows.unshift({ id: "legacy", world: "garden", name: "原来那一档", ts: 0 });
      saveJSON(INDEX_KEY, rows);
    }
    // ⚠️名册对不上时以【存档本身】为准（她 2026-09-16：「我回不到有花园的小屋了」）。
    //   名册只是一张目录，它丢了一行、或者这一档本来就不是从这儿建的（比如聊天里的
    //   庭院房），存档都还好好躺在那儿。所以再扫一遍真正存在的键，没登记的认回来——
    //   宁可多列一行，也不能让一段日子从界面上消失。
    //   （先例：设置 → 数据 →「找回失联的角色」。）
    try {
      // 存档已经搬进 IDB（engine.js 的 IDB_TEXT_PREFIXES），localStorage 里多半只剩
      // 还没迁完的那几个，所以两边都要扫一遍，谁也别落下。
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      try { (typeof window !== "undefined" && window.__txtMirror ? window.__txtMirror : new Map()).forEach((v, k) => keys.push(k)); } catch (e) {}
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!key || key.indexOf(KEY + ":") !== 0) continue;
        const id = key.slice(KEY.length + 1);
        if (!id || rows.some(x => x.id === id)) continue;
        const room = key.indexOf("::room::") > -1;
        // ⚠️房间那种键是 x_fairyGarden::角色::room::房号，切出来的 id 自己带冒号。
        //   所以这一行连【整把钥匙】一起记下来，别再去拼一次（拼错就又打不开了）。
        rows.push({ id: id, key: key, world: "garden", name: room ? "聊天里的庭院房" : "找回的一档", ts: 0, found: true });
      }
    } catch (e) {/* 隐私模式下读不到就算了，不连累这一页 */}
    return rows;
  }
  function saveMeta(row,worldId="garden") {
    const d = loadJSON(saveKeyOf(row), null) || {};
    const w = worldOf(d, worldId) || {};
    return {
      day: w.clock ? root.GameClock.sample(w.clock).day : Number(w.day) || 0,
      partnerId: String(d.partnerId || ""),
      fresh: !worldOf(d, worldId)
    };
  }
  // ── 小世界入口那条路（她 2026-09-19：「第一个世界是一个 svg 填色房子在左边，
  //    然后后续第二个（可以先做一个圆圈占位）再做两个点之间有小脚印的线状连起来，
  //    以后第三个又在左边」）──────────────────────────────────────────────
  // 一条从上往下、左右交替的小路：每个世界是路上的一站，站与站之间是一串脚印。
  // 站在哪一侧只看它排第几（单数在左、双数在右），所以以后加世界不用再动排版。
  const NODE = 112;
  const worldHouse = () => h("svg", { width: NODE, height: NODE, viewBox: "0 0 104 104", "aria-hidden": "true" },
    h("ellipse", { cx: 52, cy: 89, rx: 38, ry: 8.5, fill: "#cfdcba" }),
    h("rect", { x: 67, y: 25, width: 9, height: 20, rx: 2, fill: "#b58f76" }),
    h("path", { d: "M52 20 L88 51 L16 51 Z", fill: "#94ae82" }),
    h("path", { d: "M52 27 L79 51 L25 51 Z", fill: "#a6bd92" }),
    h("rect", { x: 25, y: 50, width: 54, height: 35, rx: 3.5, fill: "#fbf8e9", stroke: "#c9d5b3", strokeWidth: 1.6 }),
    h("rect", { x: 45, y: 62, width: 15, height: 23, rx: 7.2, fill: "#c9906b" }),
    h("circle", { cx: 56.4, cy: 74, r: 1.5, fill: "#f7e8cb" }),
    [30, 65].map(x => h("g", { key: x },
      h("rect", { x: x, y: 58, width: 11, height: 11, rx: 2.4, fill: "#f4dca7", stroke: "#cbb88c", strokeWidth: 1.2 }),
      h("path", { d: "M" + (x + 5.5) + " 58 v11 M" + x + " 63.5 h11", stroke: "#cbb88c", strokeWidth: 1 }))),
    [22, 84].map(x => h("circle", { key: x, cx: x, cy: 84, r: 3.2, fill: "#e6b9c6" })));
  // 占位那一站【没有名字也没有介绍】：她 2026-09-18 把三个占位世界删掉，
  // 就是因为「许的是三件谁都没在做的事」。一个空圈只说「路还没走完」，不许一张空头支票。
  const worldSoon = () => h("svg", { width: NODE, height: NODE, viewBox: "0 0 104 104", "aria-hidden": "true" },
    h("circle", { cx: 52, cy: 54, r: 29, fill: "rgba(255,255,255,.34)", stroke: "#c3d1af", strokeWidth: 2, strokeDasharray: "5 7", strokeLinecap: "round" }));
  // 两站之间的一串脚印。每一枚是一张独立的小图，不跟着容器拉伸——
  // 整条路画成一张按宽度缩放的 svg 的话，脚印会被压扁。
  const footTrail = (toRight, key) => {
    const n = 5;
    return h("div", { key: key, "aria-hidden": "true", style: { position: "relative", height: 62, margin: "2px 0" } },
      Array.from({ length: n }, (_, i) => {
        const t = i / (n - 1);
        const x = (toRight ? 24 + t * 52 : 76 - t * 52) + (i % 2 ? (toRight ? 3.5 : -3.5) : 0);
        const turn = (toRight ? 132 : -132) + (i % 2 ? 9 : -9);
        return h("svg", { key: i, width: 15, height: 19, viewBox: "0 0 16 20",
          style: { position: "absolute", left: "calc(" + x + "% - 7.5px)", top: (5 + t * 68) + "%",
            transform: "rotate(" + turn + "deg)", opacity: .34 + i * .045 } },
          h("ellipse", { cx: 8, cy: 12.6, rx: 4.3, ry: 6, fill: "#9fb28a" }),
          h("circle", { cx: 4.3, cy: 4.9, r: 1.5, fill: "#9fb28a" }),
          h("circle", { cx: 8, cy: 3.5, r: 1.6, fill: "#9fb28a" }),
          h("circle", { cx: 11.7, cy: 5.1, r: 1.5, fill: "#9fb28a" }));
      }));
  };

  function worldPet(){return h('svg',{width:96,height:86,viewBox:'0 0 96 86','aria-hidden':true},h('path',{d:'M24 42L21 17L40 29M56 29L76 17L72 42',fill:'#a79a8e',stroke:'#796e62',strokeWidth:2}),h('ellipse',{cx:48,cy:48,rx:31,ry:27,fill:'#eee2cf',stroke:'#796e62',strokeWidth:2}),...[36,60].map(x=>h('ellipse',{key:x,cx:x,cy:45,rx:5,ry:7,fill:'#544b43'})),h('path',{d:'M44 57L48 61L52 57M48 61V66',fill:'#d7a59b',stroke:'#796e62',strokeWidth:1.5}));}
  function worldTrain(){return h("svg",{width:96,height:86,viewBox:"0 0 96 86","aria-hidden":true},h("path",{d:"M8 70H89M12 75H86",stroke:"#72866e",strokeWidth:3}),h("rect",{x:12,y:20,width:72,height:45,rx:9,fill:"#8aa48b",stroke:"#4f6953",strokeWidth:2}),...[23,43,63].map(x=>h("rect",{key:x,x,y:30,width:13,height:16,rx:3,fill:"#eee4c5"})),...[28,68].map(x=>h("circle",{key:x,cx:x,cy:65,r:7,fill:"#4f6953"})));}
  root.FairyGardenApp = function FairyGardenApp(props) {
    const t = useTheme();
    // 庭院房那条路：房间就是世界也是存档，不用选
    if (props.storeKey || props.lockPartnerId) return h(WorldSession, props);
    const [world, setWorld] = useState(() => props.initialWorld === "day" ? DAY_WORLD : WORLDS.find(w=>w.id===props.initialWorld)||null);
    const [saves, setSaves] = useState(() => readSaves());
    const [openId, setOpenId] = useState(null);
    const [picking, setPicking] = useState(false);
    // 「先和示例同行者试玩」本身就是一次回答：进去别再把同一张选人页摆一遍。
    const [openSolo, setOpenSolo] = useState(false);
    const scrolls=useRef({}),scrollNode=useRef(null);
    useEffect(()=>{if(scrollNode.current)scrollNode.current.scrollTop=scrolls.current[world?.id||"worlds"]||0;},[openId,world,picking]);
    const refresh = () => setSaves(readSaves());
    // openId 存的是【整把钥匙】，不是 id：房间那种键拼不回来（见 readSaves 的注释）
    // The mainline schedule viewer has no journey archive and never boards the game railway.
    if (world?.id === "day") return h(root.CharDayApp, { ...(props.day || {}), characters: props.characters, build: BUILD, appearanceSaves:readSaves().map(row=>({id:row.id,name:row.name,key:saveKeyOf(row)})), readAppearance:key=>worldOf(loadJSON(key,null)||{},"garden")?.look||null, onBack: () => setWorld(null) });
    if (openId) return h(WorldSession, Object.assign({}, props, {
      key: openId, storeKey: openId, startSolo: openSolo, entryWorld:world.id,
      onChooseSave: () => { setOpenId(null); setOpenSolo(false); refresh(); },
      onBack: () => { setOpenId(null); setOpenSolo(false); refresh(); }
    }));
    const card = (onClick, children) => h("button", { "data-wk": "fgcard",
      onClick: onClick, className: "w-full text-left active:opacity-70",
      style: { padding: "15px 16px", borderRadius: 16, border: "1px solid " + G.line,
        background: "rgba(255,255,255,.62)" }
    }, children);
    // ⚠️只有【壳】叫小世界（她 2026-09-18 定的）：它装着好几个世界，再叫「微光庭院」
    //   就成了「一个叫微光庭院的地方，进去挑世界，第一个世界也叫微光庭院」。
    //   进了某个世界以后那几处 Head 仍旧是那个世界自己的名字（GardenSession 里那三处别动）。
    const shell = (sub, onBack, body) => h("div", { "data-wk": "fgpage", className: "h-full flex flex-col", style: { background: "#e4e9d7", color: G.ink } },
      h(Head, { zh: "小世界", sub: sub, bg: "transparent", ink: G.ink, onBack: onBack }),
      h("div", { "data-wk": "fgbody", ref:scrollNode,onScroll:e=>{scrolls.current[world?.id||"worlds"]=e.currentTarget.scrollTop;},className: "flex-1 min-h-0 overflow-y-auto", style: { padding: "6px 18px 36px" } }, body));

    // 仓没打开时名册也读不全：这时候让她建新档，会把一份残缺的名册写回去（名字、时间都没了）。
    const stall = vaultStalled(INDEX_KEY);
    if (stall) return shell("等一下再进来", props.onBack,
      h("p", { style: { fontFamily: F_BODY, fontSize: 13, lineHeight: 2, color: G.soft, margin: "10px 0" } }, stall));
    if (!world) {
      // 路上的站：先是已经能进的那几个世界，末尾留一个空圈——路还没走完。
      const stops = WORLDS.concat([DAY_WORLD, null]);
      const stop = (w, i) => {
        const left = i % 2 === 0;
        const label = h("div", { style: { flex: 1, minWidth: 0, textAlign: left ? "left" : "right" } },
          h("div", { "data-wk": "fgworldname", style: { fontFamily: F_DISPLAY, fontSize: w ? 16.5 : 13.5, color: w ? G.ink : G.soft } },
            w ? w.name : "还没有下一个"),
          w ? h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.65 } }, w.note) : null,
          w ? h("span", { style: { display: "inline-block", marginTop: 10, padding: "3.5px 10px", borderRadius: 999,
            border: "1px solid " + G.line, background: "rgba(255,255,255,.55)",
            fontFamily: F_BODY, fontSize: 10.5, color: G.deep } }, "可以进") : null);
        const inner = h("div", { className: "flex items-center", style: { gap: 13, flexDirection: left ? "row" : "row-reverse" } },
          h("div", { style: { flexShrink: 0, lineHeight: 0 } }, w ? (w.id==="train"?worldTrain():w.id==="pets"?worldPet():w.id==="day"?h(root.GCompanion,{width:NODE,height:NODE,stroke:"#74866b",strokeWidth:1}):worldHouse()) : worldSoon()), label);
        return w
          ? h("button", { "data-wk": "fgworld", key: w.id, onClick: () => setWorld(w), className: "w-full text-left active:opacity-70",
              style: { padding: "4px 2px", background: "transparent", border: 0 } }, inner)
          : h("div", { "data-wk": "fgworld", "data-part": "soon", key: "soon", style: { padding: "4px 2px" } }, inner);
      };
      const path = [];
      stops.forEach((w, i) => {
        if (i) path.push(footTrail(i % 2 === 1, "trail" + i));
        path.push(stop(w, i));
      });
      return shell("挑一个世界", props.onBack, h(React.Fragment, null,
        h("p", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: G.soft, margin: "6px 0 22px" } },
          "庭院、列车与绒绒小镇共用旅程。也可以去「TA的一天」，看看TA此刻的日程。"),
        h("div", null, path)));
    }

    const rows = saves.filter(x => WORLDS.some(w=>w.id===x.world));
    // ⚠️不再有「开一段不挑人的」：新的一段一律要挑一位（她 2026-09-18 定的）。
    //   以前开的那些示例档照样列在上面、照样进得去，只是不能再新建——
    //   撤掉一件东西就把它删掉，不许留在原地当死代码。
    // ⚠️她 2026-09-18：「从游戏开了一档根本没连房间」。原来「＋ 新开一段」直接写一条
    //   g_xxx 进庭院自己那张名册就开了——那一档【不属于任何人、也不挂任何房间】：
    //   没有聊天、没有记忆进出、没有一处能设权限。挑了手机里的一位，就该是一间房
    //   （一间房＝一个庭院存档，这条线从头就是这么定的），而且先让她把设定定好。
    const pickForNew = id => { setPicking(false); if (id) props.onNewGardenRoom(id,world.id); };
    // ⚠️她 2026-09-19：「好像超过三个第四个存档删不掉」。不是「超过三个」——
    //   原来这里靠 `row.key` 认「聊天里那间房的存档」，而 `key` 只有【扫回来的】
    //   那几档才带：同样是庭院房，登记在名册里的那张有「删掉」，扫回来的那张没有。
    //   同一条规矩在同一页上两种结果，看着就像随机坏掉。
    //   现在一律给删。删掉的只是这一段日子，聊天里那间房本身还在，再进去是新的第一天。
    const roomSave = row => saveKeyOf(row).indexOf("::room::") > -1;
    const drop = row => requestAppConfirm("删掉这一档？",
      (roomSave(row)
        ? "这是聊天里那间庭院房的存档。房间还在，但里面的日子、背包和聊过的话会从头开始。"
        : "这一档里的日子、背包和聊过的话会一起删掉。")
      + "找不回来——要留底，先去 设置 → 数据 → 导出全部数据，存成 json 放好再删。",
      () => {
        const next = readSaves().filter(x => x.id !== row.id);
        saveJSON(INDEX_KEY, next);
        try { dropStored(saveKeyOf(row)); } catch (e) {}
        setSaves(next);
      }, "删掉");
    // 挑人那一页：挑了手机里的一位就去开一间房（先设定、再建）。
    if (picking) return shell("给谁开一段", () => setPicking(false),
      partnerPickBody({ characters: props.characters, live: [], onPick: pickForNew,
        note: "挑一位同行者，再设置房间名称、设定和记忆权限。庭院与列车共用这一档旅程，原来的房间与存档保留。" }));
    return shell("选一档 · " + world.name, () => setWorld(null), h(React.Fragment, null,
      h("p", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.9, color: G.soft, margin: "6px 0 16px" } },
        world.id === "train" ? "选一个已有庭院存档，和这一档的同行者上车；也可以先选同行者、设置新房间，再开始一段旅程。" : "选一档接着过，或者从头开一段新的。"),
      h("div", { "data-wk": "fgsaves", style: { display: "grid", gap: 11 } },
        rows.map((row, i) => {
          const meta = saveMeta(row,world.id);
          const partner = (props.characters || []).find(c => String(c.id) === meta.partnerId);
          return h("div", { "data-wk": "fgsave", key: row.id, style: { position: "relative" } },
            // ⚠️以前开的示例档没有同行者：直接进去接着玩，别摆一张【它逃不掉的】选人页
            //   ——那一页现在只剩「挑一位」，一挑就跑去开新房间，这一档就被撂下了。
            card(() => { setOpenSolo(!meta.partnerId); setOpenId(saveKeyOf(row)); }, h(React.Fragment, null,
              h("div", { "data-wk": "fgsavename", style: { fontFamily: F_DISPLAY, fontSize: 15.5, color: G.ink } }, row.name || (row.id === "legacy" ? "原来那一档" : "第 " + (rows.length - i) + " 档")),
              h("div", { "data-wk": "fgsavesub", style: { fontFamily: F_BODY, fontSize: 11.5, color: G.soft, marginTop: 5, lineHeight: 1.6 } },
                meta.fresh ? "还没开始" : "第 " + meta.day + " 天" + (partner ? " · 与 " + (partner.remark || partner.name) + " 同住" : "")))),
            h("button", { "data-wk": "fgsavedel", onClick: () => drop(row), className: "active:opacity-60",
              style: { position: "absolute", right: 10, top: 10, padding: "4px 8px", fontFamily: F_BODY, fontSize: 10.5, color: "#a08d86", background: "transparent" } }, "删掉"));
        }),
        h("button", { "data-wk": "fgnewbtn", onClick: () => setPicking(true), className: "w-full active:opacity-70",
          style: { padding: "14px 16px", borderRadius: 16, border: "1px dashed " + G.line, background: "transparent", fontFamily: F_BODY, fontSize: 13, color: G.deep } },
          world.id === "train" ? "＋ 选同行者，开新房间" : "＋ 新开一段"))));
  };
  root.FairyWorlds=WORLDS;
})(window);
