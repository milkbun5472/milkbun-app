(() => {
  const picture='/demo-assets/示例合照.png';
  const char={id:'demo-shenyu',name:'沈屿',color:'#869d83',appearance:'二十多岁的成年男性，短黑发，深色眼睛。虚构演示插画角色。',persona:'旧书修复师，喜欢慢慢看书，话不多。',refPhoto:picture};
  const profile={name:'星奈',color:'#d79a87',appearance:'二十多岁的成年女性，栗色短发。虚构演示插画角色。',refPhoto:picture};
  const myCloset={closet:[{occasion:'平常',sets:[{name:'奶油开衫',note:'象牙白针织开衫，细格半裙，棕色平底鞋。'}]}]};
  const carry={outfit:{closet:[{occasion:'平常',sets:[{name:'橄榄绿外套',note:'橄榄绿色棉布工装外套，直身版型。'},{name:'米白衬衫',note:'米白色棉衬衫，搭配深色长裤和皮鞋。'}]}]}};
  const entry={id:'demo-diary',ts:new Date(2026,9,12,22,10).getTime(),titleZh:'窗边留了一下午',location:'书店 · 咖啡馆 · 家',weather:'晴',timeStr:'22:10',paras:[{text:'上午补好了那本旧书的书脊。外套袖口沾了一点胶，洗的时候才发现。'},{text:'下午在窗边喝完一杯咖啡，把没读完的两页接着看完了。'},{text:'晚上换上针织衫，在灯下又翻了一会儿书。今天就到这儿。'}],signature:'沈屿',wears:[{t:'09:00',w:'橄榄绿棉布外套，米白衬衫'},{t:'14:00',w:'米白衬衫，脱下外套'},{t:'19:30',w:'锈棕色针织开衫，米白衬衫'}]};
  const model={mode:'studio',key:0,studio:[],gen:{},diaries:{[char.id]:[entry]},chats:[],packs:[],responses:[],images:[],toasts:[],requests:[],imageQueue:[],replyQueue:[]};
  const studioRef={current:model.studio},statesRef={current:{[char.id]:{wearing:'今天的灰卫衣',wearingUpdatedAt:Date.now()}}},stateHistRef={current:{}},carryRef={current:{[char.id]:carry}},myClosetRef={current:myCloset},emotePacksRef={current:model.packs};
  window.__photoDemo=model;window.__photoChar=char;window.__entry=entry;
  window.__queueImage=(...xs)=>model.imageQueue.push(...xs);
  window.__queueReply=(...xs)=>model.replyQueue.push(...xs);
  imgApiReady=()=>true;
  generateSelfieImage=async(prompt,refs,opts)=>{const name=model.imageQueue.shift();if(!name)throw Error('No prepared image response');model.requests.push({prompt,referenceCount:refs?.length||0,options:opts,asset:name});return{blob:await(await fetch('/demo-assets/'+name+'.png')).blob()};};
  runProbe=async(api,ctx,opts)=>{if(!model.replyQueue.length)throw Error('No prepared text response');model.responses.push({ctx,opts});return model.replyQueue.shift();};
  document.documentElement.classList.remove('fonts-pending');document.getElementById('root').style.display='none';document.getElementById('qiu-splash')?.remove();
  const el=document.createElement('div');el.id='photo-demo';el.style='position:fixed;inset:0;z-index:100';document.body.append(el);const root=ReactDOM.createRoot(el);let rerender=()=>{};
  const emit=()=>rerender(x=>x+1),toast=x=>model.toasts.push(x);
  window.__toast=toast;
  const pChat=(cid,fn)=>{model.chats=fn(model.chats);saveJSON('x_chats',{[char.id]:model.chats});emit();};
  const writers=__nativePhotos({profile,characters:[char],statesRef,stateHistRef,carryRef,myClosetRef,studioRef,setStudio:n=>{model.studio=n;emit();},setGen:fn=>{model.gen=fn(model.gen);emit();},saveJSON,toast,apiFor:()=>({model:'fictional-prepared-demo'}),ctxFor:()=>({char,profile,recentChat:'虚构演示：下午在书店窗边一起看书。'}),photoDiaryBusy:'',setPhotoDiaryBusy:v=>{model.photoBusy=v;emit();},setDiaries:fn=>{model.diaries=fn(model.diaries);emit();},scheduleTextFor:()=>'09:00 书店工作，修复旧书；14:00 咖啡馆看书；19:30 回家阅读。',schedDayKey:d=>d.toISOString().slice(0,10),pChat,setActiveChar:()=>{},setScreen:()=>mount('chat'),emotePacksRef,commitEmotePacks:n=>{model.packs=n;emotePacksRef.current=n;saveJSON('x_emotePacks',n);emit();return true;}});
  window.__photoWriters=writers;
  const studioProps=()=>({partner:char,myCloset,charCloset:carry,shots:model.studio,busy:model.gen.studio,fitBusy:false,canShoot:true,onGenFit:()=>toast('演示仅展示现有衣柜'),onShoot:o=>writers.studioShoot(char,o),onShare:s=>writers.shareShotToChat(char,s),onDelete:()=>{},onBack:()=>mount('chat')});
  const chatProps=()=>({character:char,characters:[char],profile,meProfile:profile,messages:model.chats,disp:{time:true,myAvatar:true},sending:false,emotes:[],emotePacks:model.packs,onBack:()=>mount('studio'),onSend:()=>{},onSendRich:m=>{model.chats=[m];saveJSON('x_chats',{[char.id]:model.chats});emit();},onOpenState:()=>{},onOpenSettings:()=>{},onOpenRooms:()=>{}});
  function Demo(){const [,tick]=React.useState(0);rerender=tick;let body;
    if(model.mode==='studio')body=h(PhotoStudio,studioProps());
    else if(model.mode==='diary')body=h(DiaryEntryView,{entry:model.diaries[char.id][0],char,isMe:false,chars:[char],onBack:()=>mount('studio'),onDelete:()=>{},onPhotoDiary:e=>writers.genPhotoDiary(char.id,e),photoBusy:model.photoBusy===entry.id});
    else if(model.mode==='emotes')body=h(EmoteMatrix,{packs:model.packs,characters:[char],onBack:()=>mount('chat'),onAddPack:()=>{},onUpdatePack:()=>{},onDeletePack:()=>{},onToggleChar:()=>{},onImport:()=>{},onAddImages:()=>{},onRenameEmote:()=>{},onDeleteEmotes:()=>{}});
    else body=h(ChatThread,chatProps());
    return body;
  }
  function mount(mode){model.mode=mode;model.key++;root.render(h(ThemeContext.Provider,{value:DEFAULT_THEME},h(Demo,{key:model.key})));}
  window.__photoMount=mount;
  window.__resetStudio=()=>{model.studio=[];studioRef.current=[];mount('studio');};
  window.__seedPhotoChat=async()=>{const blob=await(await fetch(picture)).blob();await idbImgPut('img_demo_original',blob);model.chats=[{role:'assistant',content:'刚才拍的，给你看。',ts:Date.now()-5000,read:true},{role:'assistant',kind:'selfie',imgKey:'img_demo_original',desc:'书店窗边的合照',ts:Date.now()-4500,read:true}];mount('chat');};
  mount('studio');
})();
