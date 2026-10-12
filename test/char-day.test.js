const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),app=read('js/app.js');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);};
function setup(){
  const env={Date,JSON,Math,window:{}};env.window=env;vm.createContext(env);
  vm.runInContext(read('js/schedule-clock.js'),env);
  vm.runInContext(cut(read('js/screens.js'),'function schedFillEnds(', 'function schedTzShiftMin('),env);
  vm.runInContext(read('apps/fairy-garden/day/catalog.js'),env);
  vm.runInContext(read('js/char-day-link.js'),env);
  vm.runInContext(read('apps/fairy-garden/day/social.js'),env);
  vm.runInContext(read('apps/fairy-garden/day/kitchen.js'),env);vm.runInContext(read('js/char-day-life.js'),env);
  vm.runInContext(read('js/char-day-thoughts.js'),env);
  vm.runInContext(read('js/char-day.js'),env);
  let plans={},writes=[];const ref={current:plans};
  const save=new Function('setSchedules','schedulesRef','saveJSON',cut(app,'  const saveSchedDay =','  const applySchedChange =')+'return saveSchedDay;')(fn=>{plans=fn(plans);},ref,(key,v)=>writes.push({key,value:JSON.parse(JSON.stringify(v))}));
  const c={id:'c1',name:'甲',tz:8};
  save('c1','2026-10-09',{seqs:[{seq:1,time:'08:00',end:'09:00',title:'用早饭',location:'府中',type:'meal'},
    {seq:2,time:'10:00',end:'12:00',title:'核对军报',location:'议事处',place:'城中',type:'work'},
    {seq:3,time:'14:00',end:'15:00',title:'临时陪她走走',location:'河边',type:'out',deviation:{plan:'核对军报',reason:'改了约定',actual:'陪她走走'}},
    {seq:4,time:'23:00',end:'24:00',title:'歇下',location:'寝室',type:'sleep'}]});
  return {env,K:env.CharDayKit,C:env.ScheduleClock,c,plans:()=>ref.current,save,writes,ref};
}
test('读取真实日程writer的字段，按角色当地时间找当前段与具体地点',()=>{
  const f=setup(),s=f.K.dayState(f.c,f.plans().c1,Date.parse('2026-10-09T02:30:00Z'));
  assert.equal(s.time,'10:30');assert.equal(s.slot.title,'核对军报');assert.equal(s.slot.location,'议事处');assert.equal(s.slot.place,'城中');assert.equal(s.rows.length,4);
  assert.equal(f.writes[0].key,'x_schedules');assert.equal(f.writes[0].value.c1['2026-10-09'].seqs[1].seq,2);
});
test('日程空档、结束时刻、过期日程都不继续显示旧工作',()=>{
  const f=setup();for(const at of ['2026-10-09T01:30:00Z','2026-10-09T04:00:00Z','2026-10-10T02:30:00Z'])assert.equal(f.K.dayState(f.c,f.plans().c1,Date.parse(at)).slot,null);
});
test('聊天临时变更通过原writer立即可见，不修改原安排或其他角色',()=>{
  const f=setup();f.save('c2','2026-10-09',{seqs:[{time:'10:00',end:'12:00',title:'别人的事',location:'别处',type:'work'}]});
  const rows=JSON.parse(JSON.stringify(f.plans().c1['2026-10-09'].seqs));rows[1]={...rows[1],title:'一起去河边',location:'河边',type:'other',deviation:{reason:'已经约定',actual:'一起去河边'}};
  f.save('c1','2026-10-09',{seqs:rows});const before=JSON.stringify(f.plans()),writes=f.writes.length;
  const s=f.K.dayState(f.c,f.plans().c1,Date.parse('2026-10-09T02:30:00Z'));assert.equal(s.slot.title,'一起去河边');assert.equal(s.slot.deviation.actual,'一起去河边');
  assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);assert.doesNotMatch(JSON.stringify(s),/别人的事/);
});
test('凌晨沿原跨午夜睡眠helper承接昨天，醒来与今天新安排接上',()=>{
  const f=setup();f.save('c1','2026-10-08',{seqs:[{time:'23:00',end:'24:00',title:'夜里歇下',location:'寝室',type:'sleep'}]});
  const s=f.K.dayState(f.c,f.plans().c1,Date.parse('2026-10-08T18:00:00Z'));assert.equal(s.day,'2026-10-09');assert.equal(s.slot.carry,true);assert.equal(s.slot.type,'sleep');
  assert.equal(f.K.dayState(f.c,f.plans().c1,Date.parse('2026-10-09T00:00:00Z')).slot.title,'用早饭');
});
test('具体职业内容保留，通用工作姿态不捏造翻书或吃饭',()=>{
  const f=setup();assert.equal(f.K.presentation({type:'work',title:'核对军报'}).gesture,'rest');assert.equal(f.K.presentation({type:'create',title:'雕刻石像'}).gesture,'rest');
  assert.equal(f.K.presentation({type:'work',title:'翻书找资料'}).gesture,'read');assert.equal(f.K.presentation({type:'out'}).map,'dayStreet');assert.equal(f.K.presentation({type:'sleep'}).action,'sleep');
});

test('同一工作段持续有托腮和抬眼动作，休息有舒展，睡眠吃饭阅读沿原动作',async()=>{
  const {activityPose}=await import('../apps/fairy-garden/day/activity.mjs');
  const work={action:'work',gesture:'rest'};
  assert.equal(activityPose(work,2).emotion,'chin');assert.equal(activityPose(work,9).emotion,'peek');
  assert.equal(activityPose(work,18).emotion,'chin');assert.equal(activityPose(work,2).gesture,'rest');
  assert.equal(activityPose({action:'rest',gesture:'rest'},2).gesture,'stretch');
  assert.equal(activityPose({action:'rest',gesture:'rest'},7).gesture,'rest');
  for(const gesture of ['read','eat','tea','sleep'])assert.equal(activityPose({action:gesture,gesture},9).gesture,gesture);
});
test('示例单独提供全部基础动作，不调用writer或替角色排事情',()=>{
  const f=setup(),n=f.writes.length;assert.equal(f.K.DEMO.id,'__char_day_demo');assert.equal(f.K.DEMO_ROWS.length,6);
  const actions=f.K.DEMO_ROWS.map(row=>f.K.presentation(row).action);for(const kind of ['meal','read','cook','tea','walk','sleep'])assert.ok(actions.includes(kind));
  for(const row of f.K.DEMO_ROWS)assert.ok(f.K.presentation(row).gesture);assert.equal(f.writes.length,n);
});
test('主App接真实日程与已有陪伴样貌，日历使用现有角色入口并正确返回小世界',()=>{
  const route=cut(app,'  });else if (screen === "fairyGarden")','  });else if (screen === "trpg")'),calls=[];
  const env={screen:'fairyGarden',window:{FairyGardenApp:'garden',CompanionFace:{lookFor:()=>({hairColor:'#111111',face:'happy'})}},moods:{c1:{label:'开心'}},h:(_,p)=>p,body:null,gardenEntryWorld:'day',gardenDayCharId:'c1',setGardenDayCharId:id=>calls.push(['select',id]),schedulesRef:{current:{c1:{today:123}}},CharacterPronoun:{ta:()=> '他'},loadJSON:()=>({looks:{c1:{hairColor:'#111111'}}}),setGardenEntryWorld:v=>calls.push(['world',v]),calReturnRef:{current:null},setSelSched:v=>calls.push(['sched',v]),setScreen:v=>calls.push(['screen',v]),characters:[],liveChars:[],offlineApiFor:()=>{},offlineActive:{},isBody:()=>false,settingsFor:()=>({}),profile:{},toast:()=>{},openGardenRoomFor:()=>{},neighborBundleFor:()=>{},gardenRecordFor:()=>{},buildBundle:()=>'',ctxFor:()=>({})};
  const p=new Function('env','with(env){'+route.replace('  });else if','  if')+'});return body;}')(env);
  assert.equal(p.day.onKitchenShare,undefined);
  assert.equal(p.day.plansFor({id:'c1'}).today,123);assert.equal(p.day.lookFor({id:'c1'}).hairColor,'#111111');p.day.onSchedule({id:'c1'});
  assert.deepEqual(calls,[['world','day'],['sched','c1'],['screen','calendar']]);assert.equal(env.calReturnRef.current.screen,'fairyGarden');
});
test('新世界入口独立于三游戏旅程，移动外壳沿公共Head和单滚动/底安全区',()=>{
  const source=read('js/char-day.js'),host=read('js/fairy-garden.js'),html=read('index.html');
  assert.match(host,/WORLDS\.concat\(\[DAY_WORLD, null\]\)/);assert.match(host,/world\?\.id === "day"/);
  assert.match(source,/h\(Head,/);assert.match(source,/flex-1 min-h-0 overflow-y-auto/);assert.match(source,/safe-area-inset-bottom\) \* 0\.4/);
  assert.ok(html.indexOf('js/char-day.js')<html.indexOf('js/fairy-garden.js'));
  assert.doesNotMatch(source,/callAI\(|runProbe\(|localStorage\.setItem/);assert.match(source,/commitJSONDurable\("x_charDayHomes",next\)/);
});

test('新小家睡眠沿共用床位helper，床位随家具布局而非原庭院小屋',async()=>{
  const {MAPS,sleepPose}=await import('../apps/fairy-garden/world.mjs');
  const {CORE_SPACES,registerCoreSpaces}=await import('../apps/fairy-garden/day/spaces.mjs');
  registerCoreSpaces(MAPS);const map=CORE_SPACES.dayHome,spot=map.spots.find(s=>s.action==='sleep');
  const bed=sleepPose({map:'dayHome',companion:{map:'dayHome',position:spot.target},sleep:{companion:spot.id}},'companion');
  assert.ok(bed);assert.ok(bed.y>.5);assert.deepEqual(bed,map.beds.sleep.slots.companion);
  assert.equal(sleepPose({map:'dayHome',companion:{map:'dayHome',position:map.spawn},sleep:{companion:spot.id}},'companion'),null);
});

test('样式与装修沿真实原子writer的durable/live回执；失败保留旧档，各角色与其他字段并存',async()=>{
 const f=setup();let stored={version:1,styles:{c1:'warm',c2:'dusk'},layouts:{c2:{sofa:{x:1,z:2}}},keep:'旧字段'},verified=false,writes=0;
 f.env.loadJSON=()=>stored;f.env.walPutVerified=async()=>verified;f.env.saveJSON=(key,value)=>{assert.equal(key,'x_charDayHomes');stored=value;writes++;return true;};
 vm.runInContext(cut(read('js/engine.js'),'async function commitJSONDurable(','function localStorageBytes('),f.env);
 const before=JSON.stringify(stored);await assert.rejects(f.K.saveHomeChange('c1','layouts',{sofa:{stored:true}}));assert.equal(JSON.stringify(stored),before);assert.equal(writes,0);
 verified=true;await f.K.saveHomeChange('c1','layouts',{sofa:{stored:true}});assert.equal(stored.layouts.c1.sofa.stored,true);assert.equal(stored.layouts.c2.sofa.x,1);assert.equal(stored.styles.c2,'dusk');assert.equal(stored.keep,'旧字段');
 await f.K.saveHomeChange('c1','styles','light');assert.equal(stored.styles.c1,'light');assert.equal(stored.layouts.c1.sofa.stored,true);assert.equal(stored.version,3);
});

test('明确在家与外食分别去新小家或小店，日程原文决定位置',()=>{
  const f=setup();
  assert.equal(f.K.presentation({type:'meal',title:'吃午饭',location:'街角餐馆'}).map,'dayCafe');
  assert.equal(f.K.presentation({type:'coffee',title:'喝咖啡',location:'家里的餐桌'}).map,'dayHome');
  assert.equal(f.K.presentation({type:'coffee',title:'等朋友',location:'咖啡馆'}).map,'dayCafe');
  assert.equal(f.K.presentation({type:'work',title:'整理报告',location:'家里书桌'}).map,'dayHome');
  assert.equal(f.K.presentation({type:'work',title:'整理报告',location:'工位'}).map,'dayWork');
  assert.equal(f.K.presentation({type:'social',title:'聊聊天',location:'咖啡店'}).map,'dayCafe');
});
test('生活控制与气质装修共用串行writer，快速手动自动切换保留最后选择和他人的存档',async()=>{
 const f=setup();let stored={styles:{c2:'dusk'},visitorActivities:{c2:'drink'},future:{keep:true}},inFlight=0,maximum=0;
 f.env.loadJSON=()=>stored;f.env.walPutVerified=async()=>{maximum=Math.max(maximum,++inFlight);await new Promise(r=>setTimeout(r,4));inFlight--;return true;};
 f.env.saveJSON=(key,value)=>{assert.equal(key,'x_charDayHomes');stored=value;return true;};
 vm.runInContext(cut(read('js/engine.js'),'async function commitJSONDurable(','function localStorageBytes('),f.env);
 await Promise.all([f.K.saveHomeChange('c1','visitorActivities','read'),f.K.saveHomeChange('c1','motions','calm'),f.K.saveHomeChange('c1','visitorActivities','auto')]);
 assert.equal(maximum,1);assert.equal(stored.visitorActivities.c1,'auto');assert.equal(stored.visitorActivities.c2,'drink');assert.equal(stored.motions.c1,'calm');assert.equal(stored.styles.c2,'dusk');assert.equal(stored.future.keep,true);
});

function placeViewer(f,initialCharId,extraProps={}){
  const states=[],refs=[],snapshots=[];let cursor=0,refCursor=0;
  Object.assign(f.env,{
    h:(tag,props,...children)=>({tag,props:props||{},children:children.flat(Infinity)}),Head:'Head',GMsg:'GMsg',GDiary:'GDiary',GUser:'GUser',GConfig:'GConfig',IHome:'IHome',ICamera:'ICamera',IDots:'IDots',IArrow:'IArrow',IRepeat:'IRepeat',IChevR:'IChevR',IPencil:'IPencil',ICheck:'ICheck',GUs:'GUs',GStudy:'GStudy',GBrief:'GBrief',GCoffee:'GCoffee',GWalk:'GWalk',IPulse:'IPulse',GPen:'GPen',GShop:'GShop',ISearch:'ISearch',GMeal:'GMeal',IFilm:'IFilm',GChat:'GChat',GDebate:'GDebate',GBag:'GBag',IHeart:'IHeart',GMoon:'GMoon',Svg:'Svg',
    useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef:initial=>{const i=refCursor++;return refs[i]||(refs[i]={current:initial});},useEffect:()=>{},useKbLift:()=>0,
    React:{Fragment:'Fragment',useLayoutEffect:()=>{},useCallback:fn=>fn},location:{origin:'http://test.invalid'}
  });
  Object.assign(f.env.React,{useState:f.env.useState,useRef:f.env.useRef,useEffect:f.env.useEffect});
  f.env.Date=class extends Date{static now(){return Date.parse('2026-10-09T02:30:00Z');}};
  const props={initialCharId,characters:[f.c],plansFor:()=>f.plans().c1,lookFor:()=>({outfit:'academy',hairColor:'#43352e'}),taFor:()=> '他',build:'test',...extraProps};
  const render=()=>{cursor=refCursor=0;const tree=f.env.CharDayApp(props);if(refs[0])refs[0].current={contentWindow:{CharDayScene:{setSnapshot:p=>snapshots.push(JSON.parse(JSON.stringify(p)))}}};return tree;};
  const all=tree=>tree&&typeof tree==='object'?[tree,...tree.children.flatMap(all)]:[];
  const text=node=>node.children.map(c=>typeof c==='string'?c:typeof c==='object'?text(c):'').join('');
  const click=(tree,label)=>{const node=all(tree).find(n=>n.tag==='button'&&(n.props['aria-label']||text(n))===label);assert.ok(node,label+'可用');node.props.onClick();};
  const send=tree=>{const frame=all(tree).find(n=>n.tag==='iframe');assert.ok(frame);frame.props.onLoad();return snapshots.at(-1);};
  return {render,click,send,all,states,refs};
}

// Read the same per-mask clock that the settings writer exposes to the app.
function roleClock(f,clocks,maskOf=id=>id==='c2'?'other':'main'){
 const source=read('js/engine.js'),names=['vclockState','vclockCfg','vclockMap'];
 for(const name of names){const i=source.indexOf('function '+name+'('),j=source.indexOf('\n}\n',i);assert.ok(i>=0&&j>i);vm.runInContext(source.slice(i,j+3),f.env);}
 f.env.__vclock={active:'c2',clocks,maskOf};return f.env.__vclock;
}
test('小世界投影角色钟的加速、跳日与单阶段；真实日历桶、其他面具和上下文保持原样',()=>{
 const f=setup(),real=Date.parse('2026-10-09T02:10:00Z'),base=Date.parse('1934-05-07T02:10:00Z');
 f.save('c1','2026-10-09',{seqs:[f.env.CharDayLink.bindRow({seq:7,time:'10:00',end:'11:00',title:'买完菜回家做饭',location:'超市与家里',type:'home'},{world:{stages:[{scene:'dayMarket',spot:'produce',title:'挑菜',minutes:25},{scene:'dayStreet',spot:'walk',title:'回家',minutes:5},{scene:'dayHome',spot:'cook',title:'做饭',minutes:30}]}})]});
 const W=roleClock(f,{main:{on:true,base,at:real,speed:2},other:{on:false}}),before=JSON.stringify(f.plans()),writes=f.writes.length;
 let s=f.K.dayState(f.c,f.plans().c1,real+10*60000);assert.equal(s.time,'10:30');assert.equal(s.day,'1934-05-07');assert.equal(s.sourceDay,'2026-10-09');assert.equal(s.slot.seq,7);assert.equal(s.slot.startAt,Date.parse('1934-05-07T02:00:00Z'));assert.equal(f.env.CharDayLink.resolve(s.slot,s.at).presentation.stageIndex,2);
 const calendar=f.C.currentSlot(f.c,f.plans().c1,real+10*60000,undefined,{fillEnds:f.env.schedFillEnds});assert.equal(calendar.day,'2026-10-09');assert.equal(calendar.startAt,Date.parse('2026-10-09T02:00:00Z'));
 W.clocks.main.base=Date.parse('1934-05-08T02:17:00Z');s=f.K.dayState(f.c,f.plans().c1,real);assert.equal(s.day,'1934-05-08');assert.equal(s.time,'10:17');assert.equal(s.rows[0].seq,7);assert.equal(f.env.CharDayLink.resolve(s.slot,s.at).presentation.stageIndex,0);
 const original=f.K.dayState(f.c,f.plans().c1,real,{followVirtual:false});assert.equal(original.at,real);assert.equal(original.time,'10:17');assert.equal(original.slot.startAt,calendar.startAt);
 const other=f.C.characterFrame({...f.c,id:'c2'},real);assert.equal(other.virtual,false);assert.equal(other.at,real);assert.equal(W.active,'c2');assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);
});
test('角色钟暂停或离开暂停跨现实午夜仍守住同一原段；恢复与倒拨读当前时刻',()=>{
 const f=setup(),real=Date.parse('2026-10-09T02:10:00Z'),base=Date.parse('1934-05-07T02:30:00Z'),W=roleClock(f,{main:{on:true,base,at:real,speed:0}}),before=JSON.stringify(f.plans()),writes=f.writes.length;
 const a=f.K.dayState(f.c,f.plans().c1,real),b=f.K.dayState(f.c,f.plans().c1,real+86400e3);assert.equal(b.time,'10:30');assert.equal(b.slot.key,a.slot.key);assert.equal(b.sourceDay,'2026-10-09');assert.equal(b.paused,true);
 W.clocks.main={on:true,base,at:real,speed:3,awayAt:real+10*60000};const away=f.K.dayState(f.c,f.plans().c1,real+2*86400e3);assert.equal(away.time,'11:00');assert.equal(away.sourceDay,'2026-10-09');assert.equal(away.slot.title,'核对军报');assert.equal(away.paused,true);
 W.clocks.main={on:true,base:Date.parse('1934-05-07T00:15:00Z'),at:real,speed:1};const back=f.K.dayState(f.c,f.plans().c1,real);assert.equal(back.slot.title,'用早饭');assert.equal(back.paused,false);
 W.clocks.main.on=false;assert.equal(f.K.dayState(f.c,f.plans().c1,real).time,'10:10');assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);
});
test('暂停钟被原App重锚定后，原小家writer保存的来源仍跨隔夜和冷启动保持；跳时与现实模式不继承',async()=>{
 const f=setup(),real=Date.parse('2026-10-09T02:30:00Z'),base=Date.parse('1934-05-07T02:30:00Z'),W=roleClock(f,{main:{on:true,base,at:real,speed:0}}),a=f.K.dayState(f.c,f.plans().c1,real),before=JSON.stringify(f.plans());
 let stored={clockSources:{c2:{virtualAt:0,sourceDay:'2000-01-01'}},keep:true};f.env.loadJSON=()=>stored;f.env.walPutVerified=async()=>true;f.env.saveJSON=(key,value)=>{assert.equal(key,'x_charDayHomes');stored=value;return true;};
 vm.runInContext(cut(read('js/engine.js'),'async function commitJSONDurable(','function localStorageBytes('),f.env);
 await f.K.saveHomeChange(f.c.id,'clockSources',{virtualAt:a.displayAt,sourceDay:a.sourceDay});const record=JSON.parse(JSON.stringify(stored.clockSources.c1));
 W.clocks.main={on:true,base,at:real+86400e3,speed:0};assert.equal(f.K.dayState(f.c,f.plans().c1,real+86400e3).slot,null);
 const resumed=f.K.dayState(f.c,f.plans().c1,real+86400e3,{clockSource:record});assert.equal(resumed.slot.key,a.slot.key);assert.equal(resumed.slot.title,'核对军报');
 const fresh=setup();fresh.ref.current=JSON.parse(before);roleClock(fresh,{main:JSON.parse(JSON.stringify(W.clocks.main))});assert.equal(fresh.K.dayState(fresh.c,fresh.plans().c1,real+86400e3,{clockSource:record}).slot.key,a.slot.key);
 assert.equal(f.K.dayState(f.c,f.plans().c1,real+86400e3,{followVirtual:false,clockSource:record}).slot,null);
 W.clocks.main.base+=86400e3;assert.equal(f.K.dayState(f.c,f.plans().c1,real+86400e3,{clockSource:record}).sourceDay,'2026-10-10');
 assert.equal(stored.clockSources.c2.sourceDay,'2000-01-01');assert.equal(stored.keep,true);assert.equal(JSON.stringify(f.plans()),before);
});
test('虚拟纪元零点与半小时时区可读；缺钟或异常钟退回现实而不动当前聊天面具',()=>{
 const f=setup(),real=Date.parse('2026-10-09T02:10:00Z');const W=roleClock(f,{main:{on:true,base:0,at:real,speed:0}});
 assert.equal(f.C.characterFrame({id:'c1',tz:5.5},real).minute,330);assert.equal(f.C.characterFrame({id:'c1',tz:-3.5},real).day,'1969-12-31');assert.equal(f.C.localMinute({tz:0},0),0);
 f.env.vclockMap=()=>{throw Error('bad clock');};const frame=f.C.characterFrame(f.c,real);assert.equal(frame.virtual,false);assert.equal(frame.at,real);assert.equal(W.active,'c2');
});
test('未指定角色时区时，跳到冬季仍与设备角色钟的当地小时一致',()=>{
 const previous=process.env.TZ;process.env.TZ='America/Winnipeg';
 try{const f=setup(),real=Date.parse('2026-10-09T15:30:00Z'),base=Date.parse('2026-11-21T16:30:00Z');roleClock(f,{main:{on:true,base,at:real,speed:0}});
 const char={id:'c1'},frame=f.C.characterFrame(char,real);assert.equal(frame.minute,630);assert.equal(frame.offset,-360);const s=f.K.dayState(char,f.plans().c1,real);assert.equal(s.time,'10:30');assert.equal(s.slot.title,'核对军报');assert.equal(s.slot.startAt,Date.parse('2026-11-21T16:00:00Z'));assert.equal(s.sourceDay,'2026-10-09');
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('活动时间选择使用原小家durable writer：失败保持、两种模式、重新进入及角色隔离',async()=>{
 const f=setup(),real=Date.parse('2026-10-09T02:30:00Z');roleClock(f,{main:{on:true,base:Date.parse('1934-05-07T00:30:00Z'),at:real,speed:0}});
 let stored={clockModes:{c2:'auto'},layouts:{c2:{sofa:{x:1}}},keep:'保留'},verified=false;
 f.env.loadJSON=()=>stored;f.env.walPutVerified=async()=>verified;f.env.saveJSON=(key,value)=>{assert.equal(key,'x_charDayHomes');stored=value;return true;};
 vm.runInContext(cut(read('js/engine.js'),'async function commitJSONDurable(','function localStorageBytes('),f.env);
 const v=placeViewer(f,'c1'),hook=(tree,key,part)=>v.all(tree).find(n=>n.props['data-wk']===key&&(!part||n.props['data-part']===part));let tree=v.render();assert.equal(v.send(tree).slot.title,'用早饭');v.click(tree,'更多');tree=v.render();const before=JSON.stringify(stored);
 await hook(tree,'cdayclockmode','real').props.onClick();tree=v.render();assert.equal(JSON.stringify(stored),before);assert.equal(hook(tree,'cdayclockmode','auto').props['aria-pressed'],true);
 verified=true;await hook(tree,'cdayclockmode','real').props.onClick();tree=v.render();assert.equal(v.send(tree).slot.title,'核对军报');assert.equal(stored.clockModes.c2,'auto');assert.equal(stored.keep,'保留');assert.equal(stored.layouts.c2.sofa.x,1);
 const fresh=placeViewer(f,'c1');let again=fresh.render();assert.equal(fresh.send(again).slot.title,'核对军报');fresh.click(again,'更多');again=fresh.render();await fresh.all(again).find(n=>n.props['data-wk']==='cdayclockmode'&&n.props['data-part']==='auto').props.onClick();again=fresh.render();assert.equal(fresh.send(again).slot.title,'用早饭');
});

test('场景尚未同步角色时的首条到访消息可安全接收，不把小世界打进错误页',()=>{
 const f=setup(),viewer=placeViewer(f,'c1');let receive;
 Object.assign(f.env,{useEffect:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},addEventListener:(kind,fn)=>{if(kind==='message')receive=fn;},removeEventListener:()=>{}});
 viewer.render();assert.equal(typeof receive,'function');assert.doesNotThrow(()=>receive({source:viewer.refs[0].current.contentWindow,origin:'http://test.invalid',data:{type:'char-day-visit',present:false,busy:false}}));assert.doesNotThrow(()=>viewer.render());
});

test('新场景从选人页独立试玩，生活示例与日程映射继续可用',()=>{
  const f=setup(),viewer=placeViewer(f,''),before=JSON.stringify(f.plans()),writes=f.writes.length;
  let tree=viewer.render();viewer.click(tree,'逛逛所有场景');tree=viewer.render();
  const payload=viewer.send(tree);
  assert.equal(payload.charId,f.K.DEMO.id);assert.equal(payload.presentation.map,'dayLaboratory');
  assert.equal(payload.slot,null);assert.equal(payload.follow,false);assert.match(payload.key,/^place:/);
  viewer.click(tree,'回到日程');tree=viewer.render();const back=viewer.send(tree);
  assert.equal(back.charId,f.K.DEMO.id);assert.equal(back.presentation.map,'dayHome');
  viewer.click(tree,'下一段');const next=viewer.send(viewer.render());assert.equal(next.presentation.map,'dayWork');
  assert.equal(f.K.DEMO_ROWS.length,6);assert.equal(f.K.presentation({type:'work',title:'分析实验数据'}).map,'dayLaboratory');
  assert.equal(f.K.presentation({type:'work',title:'在图书馆看书'}).map,'dayLibrary');
  assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);
});

test('已有角色进入摆位保留真实样貌，返回恢复同角色原日程且不写档',()=>{
  const f=setup(),viewer=placeViewer(f,'c1'),before=JSON.stringify(f.plans()),writes=f.writes.length;
  let tree=viewer.render();const first=viewer.send(tree);assert.equal(first.slot.title,'核对军报');
  viewer.click(tree,'更多');tree=viewer.render();viewer.click(tree,'逛逛所有场景');tree=viewer.render();const stage=viewer.send(tree);
  assert.equal(stage.charId,'c1');assert.deepEqual(stage.look,first.look);assert.equal(stage.slot,null);
  viewer.click(tree,'回到日程');const back=viewer.send(viewer.render());
  assert.equal(back.charId,'c1');assert.deepEqual(back.look,first.look);assert.deepEqual(back.presentation,first.presentation);
  assert.equal(back.slot.title,'核对军报');assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);
});

test('日程页卸载画面前接住临时位置，装修沿同一现场继续且不写日程或游戏存档',()=>{
  const f=setup(),viewer=placeViewer(f,'c1'),before=JSON.stringify(f.plans()),writes=f.writes.length;
  let tree=viewer.render();const first=viewer.send(tree),frame=viewer.all(tree).find(n=>n.tag==='iframe');
  // Shape comes from CharDayScene.pauseState's runtime writer, never a save key.
  const paused={charId:'c1',map:first.presentation.map,key:'current-phase',position:{x:1,z:2},target:{x:1,z:2},moving:false,yaw:.4,speed:0,dwell:12,walkTarget:0};
  frame.props.ref({contentWindow:{CharDayScene:{pauseState:()=>paused}}});frame.props.ref(null);
  viewer.click(tree,'更多');tree=viewer.render();viewer.click(tree,'布置小家');tree=viewer.render();
  const edit=viewer.send(tree);assert.equal(edit.editing,true);assert.deepEqual(edit.resume,paused);
  assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);
});

test('整个TA一天卸载再挂载仍接到同角色进度，角色之间隔离且不写日程',()=>{
 const f=setup(),v=placeViewer(f,'c1'),tree=v.render(),first=v.send(tree),writes=f.writes.length,before=JSON.stringify(f.plans());
 const paused={charId:'c1',map:first.presentation.map,key:'current-phase',position:{x:1,z:2},target:{x:1,z:2},moving:false,yaw:.4,speed:0,dwell:12,walkTarget:0};
 const frame=v.all(tree).find(n=>n.tag==='iframe');frame.props.ref({contentWindow:{CharDayScene:{pauseState:()=>paused}}});frame.props.ref(null);
 const fresh=placeViewer(f,'c1');assert.deepEqual(fresh.send(fresh.render()).resume,paused);
 f.c={...f.c,id:'c2'};const other=placeViewer(f,'c2');assert.equal(other.send(other.render()).resume,null);
 assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);
});


test('更多归拢样貌装修场景，整页返回不改变人物或场景快照',()=>{
 const f=setup(),viewer=placeViewer(f,'c1');let tree=viewer.render();const before=viewer.send(tree);
 const scene=viewer.all(tree).find(n=>n.props['data-wk']==='cdayscene');assert.equal(viewer.all(scene).filter(n=>['button','select'].includes(n.tag)&&!/此刻详情$|^收成一条线$/.test(n.props['aria-label']||'')).length,0);
 viewer.click(tree,'更多');tree=viewer.render();const after=viewer.send(tree);assert.deepEqual(after,{...before,scenePaused:true});
 const panel=viewer.all(tree).find(n=>n.props['data-wk']==='cdaymore');assert.ok(panel);assert.equal(viewer.all(panel).filter(n=>n.props['data-wk']==='cdaymenubody').length,1);
 for(const key of ['cdaymeopen','cdayhomestyle','cdaydecorate','cdayplaces'])assert.ok(viewer.all(panel).find(n=>n.props['data-wk']===key));
 viewer.click(tree,'回到小世界');tree=viewer.render();assert.equal(viewer.all(tree).find(n=>n.props['data-wk']==='cdaymore'),undefined);assert.deepEqual(viewer.send(tree),before);
 viewer.click(tree,'今天的日程');tree=viewer.render();assert.equal(viewer.all(tree).filter(n=>n.props['data-wk']==='cdaydecorate').length,0);
});


test('空日程也保留日程入口，页面只展示安排与原日历入口',()=>{
 const f=setup();f.save('c1','2026-10-09',{seqs:[]});const viewer=placeViewer(f,'c1');let tree=viewer.render();
 assert.ok(viewer.all(tree).find(n=>n.props['data-wk']==='cdayscheduleopen'));viewer.click(tree,'今天的日程');tree=viewer.render();
 assert.ok(viewer.all(tree).find(n=>n.tag==='Head'&&n.props.zh==='今天的日程'));
 assert.equal(viewer.all(tree).filter(n=>n.props['data-wk']==='cdayrow').length,0);assert.equal(viewer.all(tree).filter(n=>n.props['data-wk']==='cdaydecorate').length,0);
});

test('TA外出时保存装修留在小屋，失败不退出，连续保存后返回保留最近成功的布置',async()=>{
 const f=setup(),viewer=placeViewer(f,'c1'),{checkHomeLayout}=await import('../apps/fairy-garden/day/home-layout.mjs');
 let stored={version:3,layouts:{c2:{$room:{wall:'rose'}}},future:{keep:true}},verified=false;
 f.env.loadJSON=()=>stored;f.env.walPutVerified=async()=>verified;f.env.saveJSON=(key,value)=>{assert.equal(key,'x_charDayHomes');stored=value;return true;};
 vm.runInContext(cut(read('js/engine.js'),'async function commitJSONDurable(','function localStorageBytes('),f.env);
 const plans=JSON.stringify(f.plans()),writes=f.writes.length;
 let tree=viewer.render();const outside=viewer.send(tree);assert.notEqual(outside.presentation.map,'dayHome');
 viewer.click(tree,'更多');tree=viewer.render();viewer.click(tree,'布置小家');tree=viewer.render();
 const save=async placements=>{const checked=checkHomeLayout(placements);assert.equal(checked.ok,true);Object.assign(viewer.refs[0].current.contentWindow.CharDayScene,{editLayout:()=>checked});await viewer.all(tree).find(n=>n.tag==='Head').props.right.props.onClick();tree=viewer.render();return viewer.send(tree);};
 let snap=await save({$room:{wall:'stripe'}});assert.equal(snap.editing,true);assert.equal(stored.layouts.c1,undefined);
 verified=true;snap=await save({$room:{wall:'stripe'}});assert.equal(snap.editing,true);assert.equal(snap.presentation.map,'dayHome');assert.equal(stored.layouts.c1.$room.wall,'stripe');
 snap=await save({$room:{wall:'sage'}});assert.equal(snap.editing,true);assert.equal(stored.layouts.c1.$room.wall,'sage');
 viewer.all(tree).find(n=>n.tag==='Head').props.onBack();snap=viewer.send(viewer.render());assert.equal(snap.editing,false);assert.deepEqual(snap.presentation,outside.presentation);assert.equal(snap.homePlacements.$room.wall,'sage');
 assert.equal(stored.layouts.c2.$room.wall,'rose');assert.equal(stored.future.keep,true);assert.equal(JSON.stringify(f.plans()),plans);assert.equal(f.writes.length,writes);
});

test('TA在家时保存装修继续沿原退出恢复，装修里的保存不另改日程',async()=>{
 const f=setup();f.save('c1','2026-10-09',{seqs:[{seq:1,time:'10:00',end:'12:00',title:'在家读书',location:'小家',type:'home',world:{scene:'dayHome',spot:'read'}}]});
 let stored={};f.env.loadJSON=()=>stored;f.env.walPutVerified=async()=>true;f.env.saveJSON=(key,value)=>{stored=value;return true;};
 vm.runInContext(cut(read('js/engine.js'),'async function commitJSONDurable(','function localStorageBytes('),f.env);
 const viewer=placeViewer(f,'c1'),{checkHomeLayout}=await import('../apps/fairy-garden/day/home-layout.mjs');let tree=viewer.render();const before=viewer.send(tree);assert.equal(before.presentation.map,'dayHome');
 viewer.click(tree,'更多');tree=viewer.render();viewer.click(tree,'布置小家');tree=viewer.render();Object.assign(viewer.refs[0].current.contentWindow.CharDayScene,{editLayout:()=>checkHomeLayout({$room:{wall:'stripe'}})});
 await viewer.all(tree).find(n=>n.tag==='Head').props.right.props.onClick();const after=viewer.send(viewer.render());assert.equal(after.editing,false);assert.deepEqual(after.presentation,before.presentation);assert.equal(stored.layouts.c1.$room.wall,'stripe');
});

test('自由逛两种选择覆盖真实目录全部地点，原writer的日程与日历字段不改',()=>{
 const f=setup(),v=placeViewer(f,'c1'),before=JSON.stringify(f.plans()),writes=f.writes.length;
 for(const mode of ['solo','together'])for(const p of f.env.CharDayCatalog){
  let tree=v.render();v.click(tree,'更多');tree=v.render();v.click(tree,'去逛逛');tree=v.render();
  const picker=v.all(tree).find(n=>n.props['data-wk']==='cdayoutings');assert.ok(picker);assert.equal(v.all(picker).filter(n=>n.props['data-wk']==='cdaydestination').length,24);
  v.all(picker).find(n=>n.props['data-wk']==='cdayoutingchoice'&&n.props['data-part']===mode).props.onClick();tree=v.render();v.all(tree).find(n=>n.props['data-wk']==='cdaydestination'&&n.props['data-part']===p.id).props.onClick();tree=v.render();
  const payload=v.send(tree),setting=f.env.CharDaySocial.setting(payload);assert.equal(payload.outing.mode,mode);assert.equal(payload.presentation.map,p.id);assert.equal(payload.showcase,false);assert.equal(payload.preview,false);assert.equal(payload.slot.title,'核对军报');assert.equal(payload.cameraMode,mode==='solo'?'me':'both');assert.ok(setting);assert.equal(!!setting.solo,mode==='solo');assert.equal(f.env.CharDaySocial.automaticSetting(payload),false);
  v.click(tree,'回到TA');const back=v.send(v.render());assert.equal(back.outing,null);assert.equal(back.presentation.map,'dayWork');assert.equal(back.slot.title,'核对军报');
 }
 assert.equal(JSON.stringify(f.plans()),before);assert.equal(f.writes.length,writes);
});

test('自由逛状态随实际现场快照保留，同角色重进继续，其他角色和预览不继承',()=>{
 const f=setup(),v=placeViewer(f,'c1');let tree=v.render();const normal=v.send(tree);
 v.click(tree,'更多');tree=v.render();v.click(tree,'去逛逛');tree=v.render();v.all(tree).find(n=>n.props['data-wk']==='cdaydestination'&&n.props['data-part']==='dayFarm').props.onClick();tree=v.render();
 const payload=v.send(tree),paused={charId:'c1',map:payload.presentation.map,outing:payload.outing,scheduledResume:{charId:'c1',map:normal.presentation.map,position:{x:1,z:2}},position:{x:0,z:3},visitor:{present:true,manualAction:'rest'}};
 const frame=v.all(tree).find(n=>n.tag==='iframe');frame.props.ref({contentWindow:{CharDayScene:{pauseState:()=>paused}}});frame.props.ref(null);
 const fresh=placeViewer(f,'c1'),resumed=fresh.send(fresh.render());assert.deepEqual(resumed.outing,paused.outing);assert.deepEqual(resumed.resume,paused);assert.equal(resumed.cameraMode,'me');
 f.c={...f.c,id:'other'};const otherViewer=placeViewer(f,'other'),other=otherViewer.send(otherViewer.render());assert.equal(other.outing,null);
 const S=f.env.CharDaySocial;for(const patch of [{preview:true},{showcase:true},{editing:true},{presentation:{map:'dayClinic'}}])assert.equal(S.outing({...payload,...patch}),null);
 assert.equal(S.setting({...normal,presentation:{map:'dayClinic'}}),null,'没有主动邀请时仍是TA独自工作');
});

test('逛街时延迟抵达的现场消息不把手选动作写回正常生活偏好',async()=>{
 const f=setup(),v=placeViewer(f,'c1');let receive,writes=0;
 Object.assign(f.env,{loadJSON:()=>({}),commitJSONDurable:async()=>{writes++;return {durable:true,live:true};},useEffect:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},addEventListener:(kind,fn)=>{if(kind==='message')receive=fn;},removeEventListener:()=>{}});
 let tree=v.render();v.click(tree,'更多');tree=v.render();v.click(tree,'去逛逛');tree=v.render();v.all(tree).find(n=>n.props['data-wk']==='cdaydestination'&&n.props['data-part']==='dayFarm').props.onClick();tree=v.render();v.click(tree,'回到TA');tree=v.render();v.send(tree);
 // The delayed message is the real visitNotice shape, tagged at its scene owner.
 receive({source:v.refs[0].current.contentWindow,origin:'http://test.invalid',data:{type:'char-day-visit',charId:'c1',outing:{map:'dayFarm',mode:'solo'},present:true,control:'manual',manualAction:'rest'}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(writes,0);
});


test('自由逛同行小票可键盘选择，状态清楚且所有地点仍来自真实目录',()=>{
 const f=setup(),v=placeViewer(f,'c1');let tree=v.render();v.click(tree,'更多');tree=v.render();v.click(tree,'去逛逛');tree=v.render();
 const tickets=()=>v.all(tree).filter(n=>n.props['data-wk']==='cdayoutingchoice');
 assert.equal(tickets().length,2);assert.equal(tickets().filter(n=>n.props['aria-checked']).length,1);
 for(const n of tickets()){assert.equal(n.props.role,'radio');assert.equal(n.props.style.minHeight,44);assert.equal(typeof n.props.onKeyDown,'function');}
 tickets().find(n=>n.props['data-part']==='together').props.onClick();tree=v.render();
 const selected=tickets().find(n=>n.props['aria-checked']);assert.equal(selected.props['data-part'],'together');assert.match(selected.props.style.boxShadow,/inset/);
 assert.deepEqual(v.all(tree).filter(n=>n.props['data-wk']==='cdaydestination').map(n=>n.props['aria-label']),Array.from(f.env.CharDayCatalog,p=>p.label));
 assert.equal(f.writes.length,1);
});
test('小世界皮肤只在自身外壳，减少动画与键盘焦点均有真实样式',()=>{
 const f=setup(),v=placeViewer(f,'c1'),tree=v.render(),skin=v.all(tree).find(n=>n.tag==='style');
 assert.ok(skin);const css=skin.children.join('');assert.match(css,/prefers-reduced-motion/);assert.match(css,/focus-visible/);assert.match(css,/\[data-wk="cdaypage"\] select/);
 assert.equal(v.all(tree).find(n=>n.props['data-wk']==='cdaytools').props.style.minHeight,56);
});

test('复合日程纸卡显示当前与下一步，原编辑writer只纠正所选阶段并在结束后自动继续',async()=>{
 const f=setup(),L=f.env.CharDayLink,raw={seq:1,time:'10:00',end:'11:00',title:'买完菜回家做饭',location:'超市和家里',type:'home',world:{scene:'dayMarket',spot:'produce',stages:[{title:'挑选蔬菜',location:'北街超市',scene:'dayMarket',spot:'produce',minutes:25},{title:'提袋回家',location:'回家路上',scene:'dayStreet',spot:'walk',minutes:5},{title:'在家做饭',location:'家里厨房',scene:'dayHome',spot:'cook',minutes:30}]}};
 f.save('c1','2026-10-09',{load:'NORMAL',estTime:1,seqs:[raw]});const original=JSON.stringify(L.publicSchedules(f.plans()));
 Object.assign(f.env,{schedulesRef:f.ref,saveJSON:(key,value)=>{f.writes.push({key,value:JSON.parse(JSON.stringify(value))});return true;},setSchedules:value=>{f.ref.current=value;}});
 vm.runInContext(cut(app,'  const editSchedSeq =','  const schedWeekKeysFrom =')+'this.editPhase=editSchedSeq;',f.env);
 const v=placeViewer(f,'c1',{onEditSchedSeq:(char,day,seq,patch,expected)=>f.env.editPhase(char.id,day,seq,patch,expected)});let at=Date.parse('2026-10-09T02:12:00Z');f.env.Date=class extends Date{static now(){return at;}};
 const hook=(tree,key)=>v.all(tree).find(n=>n.props['data-wk']===key),text=n=>n.children.map(x=>typeof x==='string'?x:typeof x==='object'?text(x):'').join('');
 let tree=v.render();v.click(tree,'展开此刻详情');tree=v.render();assert.match(text(hook(tree,'cdayphase')),/正在 · 挑选蔬菜/);assert.match(text(hook(tree,'cdayphase')),/接下来 · 提袋回家/);
 hook(tree,'cdaypositionopen').props.onClick();tree=v.render();assert.equal(hook(tree,'cdaypositionstage').props.value,0);assert.equal(v.all(tree).find(n=>n.props['data-wk']==='cdaypositionscope'&&n.props['data-part']==='stage').props['aria-pressed'],true);
 hook(tree,'cdaypositionstage').props.onChange({target:{value:'1'}});tree=v.render();hook(tree,'cdaypositionscene').props.onChange({target:{value:'dayLibrary'}});tree=v.render();v.all(tree).find(n=>n.props['data-wk']==='cdaypositionspot'&&n.props['data-part']==='window-reading').props.onClick();tree=v.render();await hook(tree,'cdaypositionsave').props.onClick();tree=v.render();assert.equal(hook(tree,'cdaypositionpage'),undefined);
 assert.equal(JSON.stringify(L.publicSchedules(f.plans())),original);assert.equal(v.send(tree).presentation.map,'dayMarket');
 at=Date.parse('2026-10-09T02:27:00Z');tree=v.render();let payload=v.send(tree);assert.equal(payload.presentation.map,'dayLibrary');assert.equal(payload.presentation.stageManual,true);assert.match(text(hook(tree,'cdayphase')),/接下来 · 在家做饭/);
 hook(tree,'cdaypositionopen').props.onClick();tree=v.render();assert.equal(hook(tree,'cdaypositionstage').props.value,1);hook(tree,'cdaypositionauto').props.onClick();tree=v.render();await hook(tree,'cdaypositionsave').props.onClick();tree=v.render();assert.equal(v.send(tree).presentation.map,'dayStreet');
 at=Date.parse('2026-10-09T02:35:00Z');tree=v.render();payload=v.send(tree);assert.equal(payload.presentation.map,'dayHome');assert.equal(payload.presentation.stageIndex,2);assert.equal(payload.presentation.manual,undefined);assert.match(text(hook(tree,'cdayphase')),/本段最后一步/);assert.equal(JSON.stringify(L.publicSchedules(f.plans())),original);
});

test('挑人页就是监视面板：此刻、做了多久、刚才和接下来一眼看完',()=>{
  const f=setup(),viewer=placeViewer(f,'');const tree=viewer.render();
  const card=viewer.all(tree).find(n=>n.tag==='button'&&n.props['data-wk']==='cdaypick');assert.ok(card,'有角色卡');
  const txt=n=>n.children.map(c=>typeof c==='string'?c:c&&typeof c==='object'?txt(c):'').join('');const t=txt(card);
  assert.match(t,/TA当地 \d\d:\d\d/);assert.match(t,/刚才 · |接下来 \d\d:\d\d · /);
});

test('此刻卡能完全收成一条线，点线再回来',()=>{
  const f=setup(),viewer=placeViewer(f,'c1');let tree=viewer.render();
  const card=t=>viewer.all(t).find(n=>n.props['data-wk']==='cdaynow');
  assert.ok(card(tree),'默认看得到卡片');
  viewer.click(tree,'收成一条线');tree=viewer.render();
  assert.equal(card(tree),undefined,'收起后卡片不挡画面');
  viewer.click(tree,'展开此刻卡片');tree=viewer.render();
  assert.ok(card(tree),'点细线卡片回来');
});

test('今天的小相册：更多里能进，没拍时给「拍今天」，配念头一次调用、料走 ctxFor、上限给足',()=>{
  const f=setup(),viewer=placeViewer(f,'c1');let tree=viewer.render();
  viewer.click(tree,'更多');tree=viewer.render();viewer.click(tree,'今天的小相册');tree=viewer.render();
  const heads=viewer.all(tree).filter(n=>n.tag==='Head').map(n=>n.props.zh);assert.ok(heads.includes('今天的小相册'),heads.join(','));
  const btns=viewer.all(tree).filter(n=>n.tag==='button').map(n=>n.children.filter(c=>typeof c==='string').join(''));assert.ok(btns.includes('拍今天'),btns.join('|'));
  const app=read('js/app.js'),i=app.indexOf('generateDiary: (c, photos, identity) =>'),seg=app.slice(i,i+900);assert.ok(i>0);
  assert.match(seg,/ctxFor\(c,/);assert.match(seg,/maxTokens:65000/);assert.match(seg,/albumInstruction\(photos\)/);
  const scene=read('apps/fairy-garden/day/scene.mjs');assert.match(scene,/function captureSolo\(\)\{/);assert.match(scene,/capturePhoto,captureSolo,/);
  const day=read('js/char-day.js');assert.match(day,/commitJSONDurable\("x_charDayAlbums",next\)/);assert.match(day,/slice\(-7\)/);
});

test('拍小相册时场景直接站到每一段的位置，不先走出门、不从门口走进来',()=>{
  const scene=read('apps/fairy-garden/day/scene.mjs'),day=read('js/char-day.js');
  assert.match(scene,/else if\(data\.albumShot&&map&&map!==needed&&!changing\)\{enter\(needed,token\);\}/);
  assert.match(scene,/else if\(\(initial\|\|snapshot\.albumShot\)&&\(snapshot\.presentation\.action==='sleep'\|\|snapshot\.albumShot\|\|/);
  assert.match(day,/albumShot: !!albumShoot,/);
});

test('小相册能翻看往日：每天一摞相片，点哪摞看哪天，往日不显示拍摄和自动存开关',()=>{
  const f=setup(),store={x_charDayAlbums:{c1:{'2026-10-07':{photos:[{time:'09:00',title:'早会',src:'data:a'},{time:'14:00',title:'改稿',src:'data:b'}]},'2026-10-09':{photos:[{time:'08:00',title:'用早饭',src:'data:c'}]}}}};
  f.env.loadJSON=(k,d)=>k in store?store[k]:d;
  const viewer=placeViewer(f,'c1');let tree=viewer.render();
  viewer.click(tree,'更多');tree=viewer.render();viewer.click(tree,'今天的小相册');tree=viewer.render();
  const head=t=>viewer.all(t).find(n=>n.tag==='Head'&&n.props.zh==='今天的小相册');assert.ok(head(tree));
  assert.ok(viewer.all(tree).find(n=>n.tag==='button'&&n.props['aria-label']==='今天的小相册'),'有今天那一摞');
  viewer.click(tree,'10/7的小相册');tree=viewer.render();
  assert.match(head(tree).props.sub,/2026-10-07/);
  const labels=viewer.all(tree).filter(n=>n.tag==='button').map(n=>n.props['aria-label']||'');
  assert.ok(!viewer.all(tree).some(n=>n.props&&n.props.role==='switch'&&n.props['aria-checked']!==undefined&&String(n.props['aria-label']||'')===''),'往日没有自动存开关');
  assert.equal(viewer.all(tree).filter(n=>n.tag==='img'&&/^data:[ab]$/.test(n.props.src)).length>=2,true);
});
