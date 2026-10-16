(() => {
  const characters = [
    { id:'demo-shenyu', name:'沈屿', color:'#7c91a5', persona:'虚构演示角色。修复旧书的人，说话直接，珍惜旧物，不喜欢仓促告别。' },
    { id:'demo-linxia', name:'林夏', color:'#a493b0', persona:'虚构演示角色。编辑，细心，幽默，说话轻快。' },
    { id:'demo-xuche', name:'许澈', color:'#b89c7c', persona:'虚构演示角色。书店店主，温和，喜欢听人慢慢把话说完。' }
  ];
  const profile = { name:'星奈', color:'#b998aa' }, queue=[], responses=[], toasts=[], actions=[];
  window.__demo = {characters,profile,queue,responses,toasts,actions,realModelCalls:0};
  window.__queue = (...xs) => queue.push(...xs.map(x=>typeof x==='string'?x:JSON.stringify(x)));
  callAI = async (api,sys,msgs) => {responses.push({sys:String(sys),msgs});if(!queue.length)throw Error('No prepared fictional response');return queue.shift();};
  window.BackgroundGeneration = undefined;
  requestAppConfirm = (title,body,yes) => {actions.push('confirm: '+title);yes();};
  window.Ears = {start:async()=>({cancel:async()=>{},stop:async()=>({transcript:'只记得一扇蓝色的门，醒来时有点舍不得。'})})};
  document.documentElement.classList.remove('fonts-pending');
  document.getElementById('root').style.display='none';document.getElementById('qiu-splash')?.remove();
  const el=document.createElement('div');el.id='dream-demo';el.style='position:fixed;inset:0;z-index:100';document.body.append(el);
  const rr=ReactDOM.createRoot(el);let seq=0;
  const mount = (Component,props) => rr.render(h(ThemeContext.Provider,{value:DEFAULT_THEME},h(Component,{...props,key:++seq})));
  const toast=x=>toasts.push(x), api={model:'local-fictional-prepared-boundary'}, c=characters[0];
  const dreamProps = {characters,profile,profileFor:()=>profile,active:api,worldbook:'',worldbookFor:()=>'',couples:{},rels:{'demo-shenyu->demo-linxia':{label:'朋友',note:'很信任她的眼光'}},moodOf:()=> '平静，想把一件旧事说清',affinityLineOf:()=> '现在对你的好感：82',familiarityOf:()=>({affinity:82,gazeLen:180,memCount:18}),toast,onBack:()=>{},onKeepsake:item=>{const a=loadJSON('x_inventory',[]);saveJSON('x_inventory',[item,...a]);actions.push('native dream keepsake enters original inventory shape');}};
  window.__dream = (entry=null) => mount(Dream,{...dreamProps,enterLoopKey:entry,onEnterConsumed:()=>{}});
  window.__journal = () => mount(DreamJournalApp,{characters,profile,apiFor:()=>api,bgApi:api,couples:{},ctxFor:char=>({char,profile,chars:characters,rels:{},memLib:[],worldbook:'',mood:'平静',affinity:82}),toast,onBack:()=>{},onEnterDream:row=>{actions.push('native journal bridge: '+row.key);__dream(row.key);}});
  const invProps = {initialNav:'my',wallet:0,cart:[],orders:[],wish:[],characters,groups:[],kinshipCards:[],feed:[],busy:false,onBack:()=>{},toast,onToggleOnMe:id=>{saveJSON('x_inventory',loadJSON('x_inventory',[]).map(x=>x.id===id?{...x,onMe:!x.onMe}:x));__inventory();}};
  window.__inventory = () => mount(Shop,{...invProps,inventory:loadJSON('x_inventory',[])});
  window.__chat = (mode='keep') => {
    const lines=mode==='keep'?[{role:'user',content:'今天把那枚纸月亮带出来了。'},{role:'assistant',content:'给我看看。奇怪，我好像在哪见过它……一时想不起来。'}]:mode==='tell'?[{role:'user',content:'睡醒了？'},{role:'assistant',content:'嗯。刚才梦到那家旧书店，你坐在窗边，等我把最后一页补好。'},{role:'assistant',content:'醒来还记得灯亮着，没急着走。'}]:[{role:'user',content:'昨晚睡得怎么样？'},{role:'assistant',content:'做了个乱七八糟的梦。'},{role:'assistant',content:'只记得一扇门，后面的就接不上了。'}];
    mount(ChatThread,{character:c,characters,profile,meProfile:profile,messages:lines.map((m,i)=>({...m,ts:Date.now()-30000+i*1000,read:true})),disp:{time:true,myAvatar:true},sending:false,emotes:[],emotePacks:[],onBack:()=>{},onSend:()=>{throw Error('External sending disabled');},onOpenState:()=>{},onOpenSettings:()=>{},onOpenRooms:()=>{}});
  };
  const opts=[{text:'坐到窗边，等他把书修好。',kind:'accord'},{text:'把台灯转向他手边。',kind:'accord'},{text:'替他把书合上，说该走了。',kind:'resist'}];
  const scene={text:'你推开旧书店的门，雨声却停在门外。沈屿坐在长桌前，正在补一本没有最后一页的书。台灯下的纸张慢慢变成水，只有他的手仍按着书脊。\n\n他抬头看你，像等了很久：“先别走，这一页快好了。”窗外的街道空着，每一扇门都通向这里。',options:opts,chosen:null,final:false};
  window.__scene=scene;
  window.__response = {
    next:{scene:'你坐到窗边，沈屿把最后一页推到你面前。纸上没有字，只有两盏灯的影子。雨声从书脊里响起来，他终于放开了手。\n\n“修好了。”他说。你看见门外的路已经铺出来，但他没有催你走，给你留着那张椅子。',final:true,options:[{text:'把那张椅子留在灯下。',kind:'accord'},{text:'等雨停了，再一起走。',kind:'accord'},{text:'把书店的灯全部关掉。',kind:'resist'}]},
    struggle:{scene:'你伸手合书，所有门同时往后退了一步。沈屿的手停在书脊上，纸页开始发抖，雨声挤进屋里。\n\n“还差一点。”他没有看你，桌上的灯却一盏盏暗下去。那张空椅子离你越来越远。梦还没有碎，只是绷得很紧。',options:[{text:'把书放回桌上，陪他等这一页。',kind:'face'},{text:'告诉他没有修好的书也没关系，替他扔掉。',kind:'shatter'},{text:'赶紧把所有灯点亮，叫他别再想了。',kind:'shatter'}]},
    arrive:{arrive:'你把椅子留在灯下。沈屿终于不再追着最后一页修补，把书放进书架，给你挪出一小块桌面。\n\n门外的雨停了。他递给你一枚纸月亮：“下次来，也坐这里。”你醒来时，手心里仍攥着它。',core:'他想留住的，是一个人愿意等他把话慢慢说完。那张椅子一直空着，是因为他怕你已经走了。',keepsake:{name:'纸月亮',note:'旧书店灯下，他从最后一页折给你的那一枚。'}},
    face:{face:'你把书放回桌上，没有替他决定什么时候结束。沈屿抬头看了你一会儿，第一次松开按着书脊的手。\n\n“其实没有最后一页。”他低声说。空白纸张不再发抖，你在他旁边坐下。门依旧开着，这一次，他没有急着追上去。',core:'他一直绕开的，是有些告别不能靠再多修一页来延迟。你没有催他，也没有替他把那本书扔掉。',keepsake:{name:'纸月亮',note:'那张空白页留下的一小片。'}},
    broken:{collapse:'你伸手拿走那本书，桌沿从指尖裂开。沈屿想开口，雨声却把他的声音淹没了。每扇门都关上，窗边的椅子化成纸屑，你被猛地推出书店。\n\n睁眼时天已经亮了，手里什么也没留下。',why:'他还没有说完，你却替他结束了。那本书不值什么，但那张他想给你留着的椅子，被一起拿走了。'}
  };
  window.__seed = (variant='play') => {
    const s={id:'demo-'+variant,charId:c.id,charName:c.name,charPersona:c.persona,keywords:['旧书店','夜雨','纸月亮'],guests:[],injectChat:true,voiceRef:'',familiarity:2,scenes:[structuredClone(scene)],status:'dreaming',createdTs:Date.now(),lastTs:Date.now()};
    if(variant==='familiar0')s.familiarity=0;if(variant==='familiar1')s.familiarity=1;
    if(variant==='fulfilled'){s.status='fulfilled';s.scenes[0].chosen=0;s.ending=__response.arrive.arrive;s.dreamCore=__response.arrive.core;s.keepsake={...__response.arrive.keepsake,taken:false};}
    if(variant==='struggle'){s.scenes[0].chosen=2;s.scenes.push({text:__response.struggle.scene,options:__response.struggle.options,chosen:null,struggle:true,resistText:opts[2].text});s.struggled=true;s.struggleFor=opts[2].text;}
    if(variant==='broken'){s.status='broken';s.scenes[0].chosen=2;s.ending=__response.broken.collapse;s.whyWrong=__response.broken.why;s.wrongText=opts[2].text;}
    if(variant==='recur'){s.recur={brokenAt:1,wrongText:opts[2].text,whyWrong:__response.broken.why,firstNight:'2026-10-06'};s.nightKey='2026-10-09';s.scenes=[{...scene,text:'你又推开那家旧书店。灯还亮着，沈屿把书放在离你更近的地方，这一次没有压住书脊。\n\n窗边的椅子还在，却多了一枚折好的纸月亮。“这一页，”他说，“你要不要一起看？”',options:[{text:'先听他把这一页说完。',kind:'accord'},{text:'把椅子拉到他旁边。',kind:'accord'},{text:'告诉他上次已经知道结局了。',kind:'resist'}],chosen:null}];}
    saveJSON('x_dream_saves',[s]);__dream();return s;
  };
  window.__shelf = () => {saveJSON('x_dream_saves',[{...loadJSON('x_dream_saves',[])[0],id:'shelf-a',status:'dreaming',charName:'沈屿'},{id:'shelf-b',charId:characters[1].id,charName:'林夏',keywords:['海边','明信片'],scenes:[scene,scene],status:'left',lastTs:Date.now()-1000}]);__dream();};
  window.__journalSeed = () => {
    const now=Date.now();
    const entries=[{id:'my-dream-a',kind:'dream',day:'2026-10-10',ts:now,text:'梦到一扇蓝色的门。门后有雨声，我把台灯留在窗边，醒来还记得灯是暖的。',interpretations:[]},{id:'my-dream-b',kind:'fragment',day:'2026-10-09',ts:now-86400000,text:'一扇蓝色的门，门边有台灯，其他都忘了。',interpretations:[{charId:c.id,name:c.name,text:'只记得门和灯也够了。你不用现在就把整场梦找回来，先记着，明天想起一点再添一点。',sign:'记得一点，也算带回来了。'}]},{id:'my-dream-c',kind:'none',day:'2026-10-08',ts:now-2*86400000,text:'',interpretations:[]}];saveJSON('x_dreamlog',entries);__journal();
  };
  window.__loops = async () => {
    await DreamLoop.listDreams();
    const rows=[{key:'demo-loop-main',charId:c.id,nightKey:'2026-10-09',status:'generated',source:'dream',materialRefs:[],peaks:[],relationActiveAxes:[],intensity:.5,createdAt:Date.now(),narrative:'我梦到旧书店。窗边有一盏灯，你坐在那张一直空着的椅子上，等我把最后一页补好。门外下着雨，你却没有说要走。',motifs:['旧书店','台灯','等待'],tone:'舍不得',wakeLine:'梦到那家书店了，灯一直亮着。'},{key:'demo-loop-queued',charId:characters[1].id,nightKey:'2026-10-09',status:'queued',source:'dream',materialRefs:[],peaks:[],relationActiveAxes:[],intensity:.4,createdAt:Date.now()-1000},{key:'demo-loop-none',charId:characters[2].id,nightKey:'2026-10-08',status:'no_dream',source:'dream',materialRefs:[],peaks:[],relationActiveAxes:[],intensity:0,createdAt:Date.now()-2000}];
    await new Promise((res,rej)=>{const q=indexedDB.open('lisa_dreams_v1',1);q.onsuccess=()=>{const db=q.result;const tx=db.transaction('dreams','readwrite');rows.forEach(r=>tx.objectStore('dreams').put(r));tx.oncomplete=()=>{db.close();res();};tx.onerror=()=>rej(tx.error);};q.onerror=()=>rej(q.error);});return rows;
  };
  __journalSeed();
})();
