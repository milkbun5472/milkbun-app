const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),app=read('js/app.js');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j);};
function setup(){
  const env={Date,JSON,Math,window:{}};env.window=env;vm.createContext(env);
  vm.runInContext(read('js/schedule-clock.js'),env);
  vm.runInContext(cut(read('js/screens.js'),'function schedFillEnds(', 'function schedTzShiftMin('),env);
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
  assert.equal(f.K.presentation({type:'work',title:'翻书找资料'}).gesture,'read');assert.equal(f.K.presentation({type:'out'}).map,'garden');assert.equal(f.K.presentation({type:'sleep'}).action,'sleep');
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
  const f=setup(),n=f.writes.length;assert.equal(f.K.DEMO.id,'__char_day_demo');assert.equal(f.K.DEMO_ROWS.length,5);
  for(const row of f.K.DEMO_ROWS)assert.ok(f.K.presentation(row).gesture);assert.equal(f.writes.length,n);
});
test('主App接真实日程与已有陪伴样貌，日历使用现有角色入口并正确返回小世界',()=>{
  const route=cut(app,'  });else if (screen === "fairyGarden")','  });else if (screen === "trpg")'),calls=[];
  const env={screen:'fairyGarden',window:{FairyGardenApp:'garden'},h:(_,p)=>p,body:null,gardenEntryWorld:'day',gardenDayCharId:'c1',setGardenDayCharId:id=>calls.push(['select',id]),schedulesRef:{current:{c1:{today:123}}},CharacterPronoun:{ta:()=> '他'},loadJSON:()=>({looks:{c1:{hairColor:'#111111'}}}),setGardenEntryWorld:v=>calls.push(['world',v]),calReturnRef:{current:null},setSelSched:v=>calls.push(['sched',v]),setScreen:v=>calls.push(['screen',v]),characters:[],liveChars:[],offlineApiFor:()=>{},offlineActive:{},isBody:()=>false,settingsFor:()=>({}),profile:{},toast:()=>{},openGardenRoomFor:()=>{},neighborBundleFor:()=>{},gardenRecordFor:()=>{},buildBundle:()=>'',ctxFor:()=>({})};
  const p=new Function('env','with(env){'+route.replace('  });else if','  if')+'});return body;}')(env);
  assert.equal(p.day.plansFor({id:'c1'}).today,123);assert.equal(p.day.lookFor({id:'c1'}).hairColor,'#111111');p.day.onSchedule({id:'c1'});
  assert.deepEqual(calls,[['world','day'],['sched','c1'],['screen','calendar']]);assert.equal(env.calReturnRef.current.screen,'fairyGarden');
});
test('新世界入口独立于三游戏旅程，移动外壳沿公共Head和单滚动/底安全区',()=>{
  const source=read('js/char-day.js'),host=read('js/fairy-garden.js'),html=read('index.html');
  assert.match(host,/WORLDS\.concat\(\[DAY_WORLD, null\]\)/);assert.match(host,/world\?\.id === "day"/);
  assert.match(source,/h\(Head,/);assert.match(source,/flex-1 min-h-0 overflow-y-auto/);assert.match(source,/safe-area-inset-bottom\) \* 0\.4/);
  assert.ok(html.indexOf('js/char-day.js')<html.indexOf('js/fairy-garden.js'));
  assert.doesNotMatch(source,/callAI\(|runProbe\(|saveJSON\(|localStorage\.setItem/);
});

test('睡眠场景沿真实床位helper传入完整位置，得到可用躺姿而非只标成sleep',async()=>{
  const {MAPS,sleepPose}=await import('../apps/fairy-garden/world.mjs');
  const source=read('apps/fairy-garden/day/scene.mjs');
  const run=new Function('MAPS','sleepPose',"let seat,bed;"+cut(source,'function destination(p)','function go(')+"const target=destination({action:'sleep'});return {target,bed};");
  const {target,bed}=run(MAPS,sleepPose);assert.ok(bed);assert.ok(bed.y>0);
  assert.deepEqual(target,MAPS.home.beds[Object.keys(MAPS.home.beds)[0]].approach.companion);
});
