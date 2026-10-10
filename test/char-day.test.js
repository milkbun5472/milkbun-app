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
  vm.runInContext(read('js/char-day-life.js'),env);
  vm.runInContext(read('js/char-day.js'),env);
  let plans={},writes=[];const ref={current:plans};
  const save=new Function('setSchedules','schedulesRef','saveJSON',cut(app,'  const saveSchedDay =','  const applySchedChange =')+'return saveSchedDay;')(fn=>{plans=fn(plans);},ref,(key,v)=>writes.push({key,value:JSON.parse(JSON.stringify(v))}));
  const c={id:'c1',name:'甲',tz:8};
  save('c1','2026-10-09',{seqs:[{seq:1,time:'08:00',end:'09:00',title:'用早饭',location:'府中',type:'meal'},
    {seq:2,time:'10:00',end:'12:00',title:'核对军报',location:'议事处',place:'城中',type:'work'},
    {seq:3,time:'14:00',end:'15:00',title:'临时陪她走走',location:'河边',type:'out',deviation:{plan:'核对军报',reason:'改了约定',actual:'陪她走走'}},
    {seq:4,time:'23:00',end:'24:00',title:'歇下',location:'寝室',type:'sleep'}]});
  return {env,K:env.CharDayKit,C:env.ScheduleClock,c,plans:()=>ref.current,save,writes};
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

function placeViewer(f,initialCharId){
  const states=[],refs=[],snapshots=[];let cursor=0,refCursor=0;
  Object.assign(f.env,{
    h:(tag,props,...children)=>({tag,props:props||{},children:children.flat(Infinity)}),Head:'Head',GMsg:'GMsg',GDiary:'GDiary',GUser:'GUser',GConfig:'GConfig',IHome:'IHome',ICamera:'ICamera',IDots:'IDots',IArrow:'IArrow',IRepeat:'IRepeat',IChevR:'IChevR',IPencil:'IPencil',
    useState:initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
    useRef:initial=>{const i=refCursor++;return refs[i]||(refs[i]={current:initial});},useEffect:()=>{},useKbLift:()=>0,
    React:{Fragment:'Fragment',useLayoutEffect:()=>{},useCallback:fn=>fn},location:{origin:'http://test.invalid'}
  });
  f.env.Date=class extends Date{static now(){return Date.parse('2026-10-09T02:30:00Z');}};
  const props={initialCharId,characters:[f.c],plansFor:()=>f.plans().c1,lookFor:()=>({outfit:'academy',hairColor:'#43352e'}),taFor:()=> '他',build:'test'};
  const render=()=>{cursor=refCursor=0;const tree=f.env.CharDayApp(props);if(refs[0])refs[0].current={contentWindow:{CharDayScene:{setSnapshot:p=>snapshots.push(JSON.parse(JSON.stringify(p)))}}};return tree;};
  const all=tree=>tree&&typeof tree==='object'?[tree,...tree.children.flatMap(all)]:[];
  const text=node=>node.children.map(c=>typeof c==='string'?c:typeof c==='object'?text(c):'').join('');
  const click=(tree,label)=>{const node=all(tree).find(n=>n.tag==='button'&&(n.props['aria-label']||text(n))===label);assert.ok(node,label+'可用');node.props.onClick();};
  const send=tree=>{const frame=all(tree).find(n=>n.tag==='iframe');assert.ok(frame);frame.props.onLoad();return snapshots.at(-1);};
  return {render,click,send,all,states,refs};
}

test('场景尚未同步角色时的首条到访消息可安全接收，不把小世界打进错误页',()=>{
 const f=setup(),viewer=placeViewer(f,'c1');let receive;
 Object.assign(f.env,{useEffect:fn=>fn(),setInterval:()=>1,clearInterval:()=>{},addEventListener:(kind,fn)=>{if(kind==='message')receive=fn;},removeEventListener:()=>{}});
 viewer.render();assert.equal(typeof receive,'function');assert.doesNotThrow(()=>receive({source:viewer.refs[0].current.contentWindow,origin:'http://test.invalid',data:{type:'char-day-visit',present:false,busy:false}}));assert.doesNotThrow(()=>viewer.render());
});

test('新场景从选人页独立试玩，生活示例与日程映射继续可用',()=>{
  const f=setup(),viewer=placeViewer(f,''),before=JSON.stringify(f.plans()),writes=f.writes.length;
  let tree=viewer.render();viewer.click(tree,'新场景摆位试玩');tree=viewer.render();
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
  viewer.click(tree,'更多');tree=viewer.render();viewer.click(tree,'新场景');tree=viewer.render();const stage=viewer.send(tree);
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


test('更多归拢样貌装修场景，整页返回不改变人物或场景快照',()=>{
 const f=setup(),viewer=placeViewer(f,'c1');let tree=viewer.render();const before=viewer.send(tree);
 const scene=viewer.all(tree).find(n=>n.props['data-wk']==='cdayscene');assert.equal(viewer.all(scene).filter(n=>['button','select'].includes(n.tag)).length,0);
 viewer.click(tree,'更多');tree=viewer.render();const after=viewer.send(tree);assert.deepEqual(after,before);
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
