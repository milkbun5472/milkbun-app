const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),app=read('js/app.js');
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j);};
const plain=x=>JSON.parse(JSON.stringify(x));
function envFor(raw){
 const at=Date.parse('2026-10-09T16:15:00Z'),FixedDate=class extends Date{constructor(...args){super(...(args.length?args:[at]));}static now(){return at;}};
 const c={id:'c1',name:'测试甲',tz:'0'},calls=[],writes=[];
 const e={Date:FixedDate,JSON,Math:Object.assign(Object.create(Math),{random:()=>.1}),console,
  characters:[c],active:{id:'main'},bgActive:{id:'background'},SCHED_PLAN_DAYS:7,SCHED_WORLD_RULE:'世界规则',SCHED_END_RULE:'结束规则',SCHED_TENSE_RULE:'时态规则',
  schedulesRef:{current:{}},schedSelfRevRef:{current:false},noSchedFor:()=>false,isBody:()=>false,
  ctxFor:ch=>({char:ch,persona:'完整人设'}),loreFor:()=>({lore:'同一世界'}),characterText:(_c,s)=>s,
  schedPeerBlock:()=>'',schedWeatherLine:async()=>'',setGen:()=>{},toast:()=>{},autoRefreshOn:()=>true,bgJob:async(_f,_c,fn)=>fn(),
  runProbe:async(api,ctx,spec)=>{calls.push({api,ctx,spec});return plain(raw);},
  saveJSON:(key,value)=>{writes.push({key,value:plain(value)});return true;},setSchedules:fn=>{e.schedulesRef.current=fn(e.schedulesRef.current);}};
 e.window=e;vm.createContext(e);
 for(const f of ['js/schedule-clock.js','apps/fairy-garden/day/catalog.js','js/char-day-link.js','js/content-boundaries.js'])vm.runInContext(read(f),e);
 e.pad2=n=>String(n).padStart(2,'0');
 vm.runInContext(cut(read('js/screens.js'),'function schedDayKey(', 'function schedDisplaySeqs('),e);
 vm.runInContext(cut(app,'  const saveSchedDay =','  const applySchedChange =')+'\nglobalThis.saveDay=saveSchedDay;',e);
 vm.runInContext(cut(app,'  const genScheduleDay =','  const SCHED_PLAN_DAYS =')+'\nglobalThis.generateDay=genScheduleDay;',e);
 vm.runInContext(cut(app,'  const genScheduleWeek =','  const schedMondayOf =')+'\nglobalThis.generateWeek=genScheduleWeek;',e);
 vm.runInContext(cut(app,'  const schedMaybeSelfRevise =','  const genSnoop =')+'\nglobalThis.revise=schedMaybeSelfRevise;',e);
 return {e,c,calls,writes,L:e.CharDayLink};
}
const row=(scene='dayLaboratory',spot='computer')=>({time:'10:00',end:'12:00',title:'核对培养观察数据',location:'西院研究楼',place:'原世界城市',type:'work',busy:2,world:{scene,spot},deviation:null});
test('场景与位置目录从实际地图生成，所有保存位置都是已有家具动作点',async()=>{
 const {registerHooks}=require('node:module');const hook=registerHooks({resolve(s,c,next){return s==='three'?{url:require('node:url').pathToFileURL(path.join(__dirname,'../apps/fairy-garden/vendor/three.module.js')).href,shortCircuit:true}:next(s,c);}});
 try{
  const {DAY_PLACES}=await import('../apps/fairy-garden/day/places/index.mjs'),{CORE_SPACES}=await import('../apps/fairy-garden/day/spaces.mjs');
  const {e,L}=envFor({}),actual={...CORE_SPACES,...DAY_PLACES};assert.equal(e.CharDayCatalog.length,Object.keys(actual).length);
  for(const m of e.CharDayCatalog){assert.equal(m.label,actual[m.id].label);assert.deepEqual(plain(m.spots.map(s=>s.id)).sort(),actual[m.id].spots.map(s=>s.id).sort());
   for(const p of m.spots){assert.ok(L.validate({scene:m.id,spot:p.id}));assert.equal(p.action,actual[m.id].spots.find(s=>s.id===p.id).action);}}
 }finally{hook.deregister();}
});
test('当天实际生成调用把视觉字段发出并经原writer保存，原叙事/当地时间/角色隔离不改',async()=>{
 const source={load:'NORMAL',seqs:[row()]},f=envFor(source);f.e.saveDay('c2','2026-10-09',{seqs:[{title:'乙的私事'}]});
 assert.equal(await f.e.generateDay(f.c,'2026-10-09'),true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].api.id,'background');
 assert.match(f.calls[0].spec.instruction,/TA的一天·场景连接/);assert.match(f.calls[0].spec.schemaHint,/"world"/);assert.equal(f.calls[0].spec.maxTokens,65000);
 const s=f.e.schedulesRef.current.c1['2026-10-09'].seqs[0];assert.deepEqual(plain(s.world),source.seqs[0].world);assert.equal(s.location,'西院研究楼');assert.equal(s.place,'原世界城市');assert.equal(s.title,source.seqs[0].title);assert.equal(s.busy,2);const current=f.e.ScheduleClock.currentSlot(f.c,f.e.schedulesRef.current.c1,Date.parse('2026-10-09T10:30:00Z'));assert.deepEqual(plain(current.world),source.seqs[0].world);assert.equal(f.L.presentation(current).map,'dayLaboratory');
 assert.equal(f.writes.at(-1).key,'x_schedules');assert.equal(f.e.schedulesRef.current.c2['2026-10-09'].seqs[0].title,'乙的私事');assert.equal(source.seqs[0].seq,undefined);
});
test('周计划只有一次后台调用：未来偏差清空，专业位置保存，额外日期丢弃',async()=>{
 const s=row('dayLibrary','study-notes');s.deviation={reason:'还没发生的变更',actual:'改去别处',world:{scene:'dayClinic',spot:'duty'}};
 const f=envFor({days:[{day:'2026-10-10',seqs:[s]},{day:'2026-10-20',seqs:[row()]}]});
 assert.equal(await f.e.generateWeek(f.c,{from:'2026-10-10',count:1}),true);assert.equal(f.calls.length,1);assert.match(f.calls[0].spec.instruction,/dayLibrary/);assert.match(f.calls[0].spec.schemaHint,/"world"/);
 const saved=f.e.schedulesRef.current.c1;assert.equal(saved['2026-10-20'],undefined);assert.equal(saved['2026-10-10'].kind,'plan');assert.equal(saved['2026-10-10'].seqs[0].deviation,null);assert.deepEqual(plain(saved['2026-10-10'].seqs[0].world),s.world);
});
test('临时改计划使用同一连接：实际地点替换原位置，失败不加额外调用',async()=>{
 const changed=row();changed.deviation={plan:'分析数据',reason:'临时交班',actual:'去诊室交班',world:{scene:'dayClinic',spot:'handoff'}};
 const f=envFor({changed:true,seqs:[{...row(),time:'08:00',end:'09:00'},changed,{...row('dayHome','sleep'),time:'23:00',end:'24:00',type:'sleep',title:'就寝'}]});
 f.e.saveDay('c1','2026-10-09',{seqs:[row(),row(),row()]});await f.e.revise();assert.equal(f.calls.length,1);assert.match(f.calls[0].spec.instruction,/TA的一天·场景连接/);assert.match(f.calls[0].spec.schemaHint,/"world"/);
 const s=f.e.schedulesRef.current.c1['2026-10-09'].seqs[1];assert.equal(s.world.scene,'dayLaboratory');assert.equal(s.deviation.world.scene,'dayClinic');assert.equal(f.L.presentation(s).spot,'handoff');await f.e.revise();assert.equal(f.calls.length,1);
});
test('错误的scene/spot配对丢弃，生成不替换原地点；不能把诊查床当睡床',()=>{
 const {L}=envFor({});for(const bad of [{scene:'dayClinic',spot:'sleep'},{scene:'unknown',spot:'casework'},{scene:'dayStudio',spot:'computer'},'dayClinic'])assert.equal(L.validate(bad),null);
 const linked=L.bindRow(row(),{world:{scene:'dayClinic',spot:'sleep'}});assert.equal(linked.world,null);assert.equal(linked.location,'西院研究楼');assert.equal(L.presentation({...row('dayClinic','bedside'),type:'sleep'}).map,'dayHome');
});
test('旧日程按具体场所/事情去四个专业房，在家事项留家，阅读与创作不冒充同一动作',()=>{
 const {L}=envFor({});for(const [s,scene,spot] of [[{title:'分析实验数据',type:'work'},'dayLaboratory','computer'],[{title:'复习笔记',location:'图书馆'},'dayLibrary','study-notes'],[{title:'整理病历',type:'work'},'dayClinic','casework'],[{title:'绘画设计',type:'create'},'dayStudio','drawing'],[{title:'绘画设计',location:'家里',type:'create'},'dayHome',undefined]]){const p=L.presentation(s);assert.equal(p.map,scene);if(spot)assert.equal(p.spot,spot);}
 assert.equal(L.presentation({title:'绘画设计',type:'create'}).gesture,'rest');assert.equal(L.presentation({title:'翻书',location:'图书馆'}).gesture,'read');
});
test('临时去家里/餐馆/河边的实际安排不沿用原实验室标记或原场所',()=>{
 const {L}=envFor({});for(const [actual,map]of [['回家整理记录','dayHome'],['去餐馆吃午饭','dayCafe'],['沿河边散步','dayStreet']])assert.equal(L.presentation({...row(),location:'实验室',deviation:{actual}}).map,map);
});
test('旧聊天和线下临时改日程沿真正splice writer，实际画面不继承被替换的房间',()=>{
 const {e,L}=envFor({});const seqs=e.schedSpliceNow([row()],630,{title:'去图书馆挑书',location:'图书馆',until:'11:00',reason:'改约'});const s=seqs.find(s=>s.time==='10:30');assert.equal(s.world,undefined);assert.equal(L.presentation(s).map,'dayLibrary');assert.equal(L.presentation(s).spot,'choose-book');assert.equal(seqs[0].world.scene,'dayLaboratory');const plainTitle=e.schedSpliceNow([row()],630,{title:'阅读资料',location:'图书馆',until:'11:00'}).find(s=>s.time==='10:30');assert.equal(L.presentation(plainTitle).map,'dayLibrary');
});
test('数字生命生成连接字段为null，不因视觉场景硬排现实职业',async()=>{
 const f=envFor({seqs:[{time:'10:00',title:'维护记忆',type:'work',world:null}]});f.e.isBody=()=>true;assert.equal(await f.e.generateDay(f.c,'2026-10-09'),true);assert.match(f.calls[0].spec.instruction,/存在时间线/);assert.doesNotMatch(f.calls[0].spec.instruction,/dayClinic/);assert.match(f.calls[0].spec.schemaHint,/"world":null/);
});
test('新排练室与候车区从真实日程writer接入，原文字不变，日历投影继续隐藏视觉字段',async()=>{
 for(const [scene,spot]of [['dayRehearsal','practice'],['dayRehearsal','piano'],['dayStation','waiting'],['dayStation','departure']]){
  const seq={...row(scene,spot),title:scene==='dayRehearsal'?'排练当天曲目':'等车准备出发',location:scene==='dayRehearsal'?'北街排练室':'城南车站'};
  const f=envFor({seqs:[seq]});assert.equal(await f.e.generateDay(f.c,'2026-10-09'),true);assert.equal(f.calls.length,1);
  const saved=f.e.schedulesRef.current.c1['2026-10-09'].seqs[0];assert.equal(f.L.presentation(saved).map,scene);assert.equal(f.L.presentation(saved).spot,spot);
  assert.equal(saved.title,seq.title);assert.equal(saved.location,seq.location);const publicPlan=f.L.publicSchedules(f.e.schedulesRef.current);
  assert.equal(publicPlan.c1['2026-10-09'].seqs[0].world,undefined);assert.equal(publicPlan.c1['2026-10-09'].seqs[0].title,seq.title);
 }
});
test('旧日程按排练/出行实际文字分到新场景，在家练琴与实际改动仍按原世界事情',()=>{
 const {L}=envFor({});
 for(const [title,location,map,spot]of [['练琴','琴房','dayRehearsal','piano'],['练舞','排练室','dayRehearsal','practice'],['翻看台词','排练室','dayRehearsal','score'],['休息一下','排练室','dayRehearsal','rest'],['坐着候车','城南车站','dayStation','waiting'],['候车时看书','车站','dayStation','reading'],['放好行李','候车厅','dayStation','luggage'],['查看站牌','车站','dayStation','information'],['通勤出发','城南车站','dayStation','departure'],['离开候车厅','车站','dayStation','exit']]){const p=L.presentation({title,location,type:'work'});assert.equal(p.map,map,title);assert.equal(p.spot,spot,title);}
 assert.equal(L.presentation({title:'在家练琴',location:'家里',type:'work'}).map,'dayHome');
 assert.equal(L.presentation({...row('dayRehearsal','piano'),deviation:{actual:'在车站坐着候车'}}).map,'dayStation');
 assert.equal(L.presentation({title:'就寝',type:'sleep',world:{scene:'dayStation',spot:'waiting'}}).map,'dayHome');
});
function looks(){
 const f=envFor({});let cfg={charId:'c1',autoFace:true,looks:{c1:{outfit:'academy',hair:'korean',hairColor:'#43352e',skin:'#ead3ba',eye:'#827565',dims:{head:1.15,height:.95},wardrobe:{academy:{cloth:'#a8be83'}}},c2:{face:'sad',hair:'bob',hairColor:'#a95f43'}}};
 Object.assign(f.e,{addEventListener:()=>{},loadJSON:()=>cfg});vm.runInContext(read('js/mood-label.js'),f.e);vm.runInContext(read('js/companion.js'),f.e);let moods={};
 const writer=new Function('setMoods','saveJSON','window',cut(app,'  const setMoodFor =','  const _moodSkip =')+'return setMoodFor;')(fn=>{moods=fn(moods);},(key,v)=>f.writes.push({key,value:plain(v)}),f.e);
 return {...f,api:f.e.CompanionFace,writer,moods:()=>moods,setCfg:value=>{cfg=value;},cfg:()=>cfg};
}

test('新增职业场景按实际地点与操作分配，顾客、演员与摄影师保持各自活动',()=>{
 const {L}=envFor({});
 const cases=[
  ['梳理调查线索','刑侦办案室','dayInvestigation','clues'],['整理当日案卷','警局','dayInvestigation','notes'],['交接值勤','派出所','dayInvestigation','duty'],['案情汇报','办案室','dayInvestigation','briefing'],
  ['切配备菜','餐厅后厨','dayService','prep'],['灶台炒菜','餐厅后厨','dayService','cook'],['制作咖啡','咖啡馆吧台','dayService','coffee'],['调制饮品','酒吧吧台','dayService','mix'],['核对订单','餐厅','dayService','cashier'],
  ['补妆','化妆间','dayFilm','makeup'],['候场看台本','片场','dayFilm','script'],['拍戏表演','摄影棚','dayFilm','perform'],['模特棚拍','影棚','dayFilm','pose'],['机后掌镜','摄影棚','dayFilm','camera'],['摄影师棚拍','摄影棚','dayFilm','camera'],['制作早餐','后厨','dayService','cook'],['准备午餐','餐厅后厨','dayService','cook'],
  ['配音录制','配音棚','dayBroadcast','voice'],['录歌','录音室','dayBroadcast','sing'],['监听混音','录音棚','dayBroadcast','mix'],['开播聊天','直播间','dayBroadcast','stream'],['剪辑素材','直播工作室','dayBroadcast','edit']
 ];
 for(const [title,location,map,spot]of cases){const actual=L.presentation({title,location,type:'work'});assert.equal(actual.map,map,title);assert.equal(actual.spot,spot,title);}
 for(const title of ['在家直播','在家录歌','在家试音','在家制作咖啡','在家读台本'])assert.equal(L.presentation({title,location:'家里',type:'work'}).map,'dayHome');
 assert.equal(L.presentation({title:'在咖啡馆喝咖啡',location:'咖啡馆',type:'coffee'}).map,'dayCafe');
 assert.equal(L.presentation({title:'餐厅吃午饭',location:'餐厅',type:'meal'}).map,'dayCafe');
 assert.equal(L.presentation({title:'观看直播',type:'home'}).map,'dayHome');
 assert.equal(L.presentation({title:'排练台词',location:'排练室',type:'work'}).map,'dayRehearsal');
 assert.equal(L.presentation({title:'外景拍摄',location:'小街',type:'work'}).map,'dayStreet');
 assert.equal(L.presentation({title:'巡逻',location:'街头',type:'work'}).map,'dayStreet');
});
test('职业场景沿原生成writer保存合法world，改期与日历投影保留原边界',async()=>{
 for(const [scene,spot]of [['dayInvestigation','clues'],['dayService','cook'],['dayFilm','camera'],['dayBroadcast','voice']]){
  const seq={...row(scene,spot),title:'当前职业事项',location:'角色世界里的实际工作地点'},f=envFor({seqs:[seq]});
  assert.equal(await f.e.generateDay(f.c,'2026-10-09'),true);assert.equal(f.calls.length,1);
  const saved=f.e.schedulesRef.current.c1['2026-10-09'].seqs[0];assert.equal(f.L.presentation(saved).map,scene);assert.equal(f.L.presentation(saved).spot,spot);
  assert.equal(saved.title,seq.title);assert.equal(saved.location,seq.location);assert.equal(f.L.publicRow(saved).world,undefined);
  assert.equal(f.L.presentation({...saved,deviation:{actual:'回家休息',world:null}}).map,'dayHome');
 }
});

test('厨房料理与喝水按原日程文字进入家中实际动作点，外食与偏差保持各自地点',()=>{
 const {L}=envFor({});
 for(const title of ['在家做饭','下厨煮汤','做晚餐','炒菜'])assert.equal(L.presentation({title,location:'家里',type:'meal'}).spot,'cook');
 assert.equal(L.presentation({title:'在家喝水',type:'home'}).spot,'tea');
 assert.equal(L.presentation({title:'在餐馆吃午饭',location:'餐馆',type:'meal'}).map,'dayCafe');
 assert.equal(L.presentation({title:'整理资料',world:{scene:'dayWork',spot:'work'},deviation:{actual:'回家下厨煮汤'}}).spot,'cook');
 assert.equal(L.presentation({title:'做晚餐',world:{scene:'dayHome',spot:'cook'}}).action,'cook');
});
test('表情由真实心情writer读入：自动脸与陪伴一致，完整颜色/体型/服饰不丢',()=>{
 const f=looks();f.writer('c1',{label:'眉开眼笑',ts:f.e.Date.now()});f.writer('c2',{label:'委屈',ts:f.e.Date.now()});
 const before=JSON.stringify(f.cfg()),l=f.api.lookFor(f.c,f.moods());assert.equal(l.face,'happy');assert.equal(l.hair,'korean');assert.equal(l.dims.head,1.15);assert.equal(l.wardrobe.academy.cloth,'#a8be83');assert.equal(f.api.lookFor({id:'c2'},f.moods()).face,'sad');assert.equal(JSON.stringify(f.cfg()),before);assert.equal(f.writes[0].key,'x_moods');
 f.writer('c1',{label:'不开心',ts:f.e.Date.now()});assert.equal(f.api.lookFor(f.c,f.moods()).face,'gloomy');
});
test('陪伴手选脸覆盖自动心情，换角色不继承别人的未设置外貌，恢复自动用当前心情',()=>{
 const f=looks();f.writer('c1',{label:'开心',ts:f.e.Date.now()});f.setCfg({...f.cfg(),autoFace:false,looks:{...f.cfg().looks,c1:{...f.cfg().looks.c1,face:'proud'}}});
 assert.equal(f.api.lookFor(f.c,f.moods()).face,'proud');assert.equal(f.api.lookFor({id:'c2'},f.moods()).face,'sad');assert.equal(f.api.lookFor({id:'c3'},f.moods()).hairColor,undefined);assert.equal(f.api.lookFor({id:'c3'},f.moods()).face,'default');
 f.setCfg({...f.cfg(),autoFace:true});assert.equal(f.api.lookFor(f.c,f.moods()).face,'happy');
});

test('日历只收到文字投影，视觉编号留给TA一天，不改变真实writer的原档',async()=>{
 const raw=row();raw.deviation={plan:'整理资料',reason:'临时换去诊室',actual:'核对病历',world:{scene:'dayClinic',spot:'casework'}};
 const f=envFor({seqs:[raw]});await f.e.generateDay(f.c,'2026-10-09');
 const stored=f.e.schedulesRef.current,before=JSON.stringify(stored),visible=f.L.publicSchedules(stored),s=visible.c1['2026-10-09'].seqs[0];
 assert.equal(s.title,raw.title);assert.equal(s.location,raw.location);assert.equal(s.deviation.actual,raw.deviation.actual);
 assert.equal('world' in s,false);assert.equal('world' in s.deviation,false);assert.doesNotMatch(JSON.stringify(visible),/dayLaboratory|computer|dayClinic|casework|"world"/);
 assert.equal(JSON.stringify(stored),before);assert.equal(stored.c1['2026-10-09'].seqs[0].world.scene,'dayLaboratory');
 assert.equal(f.L.presentation(stored.c1['2026-10-09'].seqs[0]).map,'dayClinic');assert.match(f.calls[0].spec.instruction,/编号只写进 world/);
});
test('文字投影兼容旧日程、空档和异常seqs，不把日历变成另一个writer',()=>{
 const f=envFor({}),input={c1:{old:{seqs:[{seq:1,title:'自己的事情'}]},none:{},bad:{seqs:null}},c2:{day:{seqs:[]}}};
 assert.deepEqual(plain(f.L.publicSchedules(input)),input);assert.deepEqual(plain(f.L.publicSchedules(null)),{});assert.equal(f.writes.length,0);
});

test('健身房与超市从真实生成writer保存，原日程文字保留、日历没有新场景编号',async()=>{
 for(const [scene,spot,title,location]of [['dayGym','weights','哑铃练习','西街健身房'],['dayMarket','produce','采购蔬菜水果','北街超市'],['dayMarket','cashier','上午收银值班','北街超市']]){
  const seq={...row(scene,spot),title,location},f=envFor({seqs:[seq]});assert.equal(await f.e.generateDay(f.c,'2026-10-09'),true);assert.equal(f.calls.length,1);assert.match(f.calls[0].spec.instruction,/dayGym/);assert.match(f.calls[0].spec.instruction,/dayMarket/);
  const saved=f.e.schedulesRef.current.c1['2026-10-09'].seqs[0];assert.deepEqual(plain(saved.world),{scene,spot});assert.equal(saved.title,title);assert.equal(saved.location,location);assert.equal(f.L.presentation(saved).spot,spot);
  const calendar=f.L.publicSchedules(f.e.schedulesRef.current);assert.equal(calendar.c1['2026-10-09'].seqs[0].world,undefined);assert.equal(calendar.c1['2026-10-09'].seqs[0].title,title);
 }
});
test('旧运动购物日程按实际地点动作连接，在家拉伸与临时变更仍沿原世界',()=>{
 const {L}=envFor({});for(const [title,location,map,spot]of [['慢跑训练','健身房','dayGym','treadmill'],['哑铃力量训练','健身房','dayGym','weights'],['热身拉伸','运动馆','dayGym','stretch'],['运动后补水喝水','健身房','dayGym','water'],['挑选蔬菜','超市','dayMarket','produce'],['买牛奶','便利店','dayMarket','cold'],['挑纸巾日用品','超市','dayMarket','groceries'],['结账付款','超市','dayMarket','checkout'],['收银值班','超市','dayMarket','cashier'],['装袋整理','超市','dayMarket','packing']]){const p=L.presentation({title,location,type:'out'});assert.equal(p.map,map,title);assert.equal(p.spot,spot,title);}
 assert.equal(L.presentation({title:'在家拉伸',type:'home'}).map,'dayHome');assert.equal(L.presentation({title:'整理超市购物清单',location:'家里',type:'home'}).map,'dayHome');
 assert.equal(L.presentation({...row('dayGym','weights'),deviation:{actual:'去超市挑选蔬菜',location:'超市'}}).map,'dayMarket');assert.equal(L.validate({scene:'dayGym',spot:'produce'}),null);
});

test('办公室与校园按实际日程区分汇报、听会、授课、听课；家中与其他明确场所保留原地点',()=>{
 const {L}=envFor({});
 for(const [title,location,map,spot]of [['开组会','','dayOffice','meeting'],['备课写教案','办公室','dayOffice','notes'],['处理邮件','公司办公室','dayOffice','computer'],['整理文件','办公室','dayOffice','notes'],['开部门例会','会议室','dayOffice','meeting'],['记录会议笔记','会议室','dayOffice','meeting-notes'],['汇报项目进度','会议室','dayOffice','presentation'],['打印报告','公司','dayOffice','print'],['喝水','办公室','dayOffice','tea'],['上课听讲','教学楼教室','dayCampus','listen'],['记课堂笔记','教室','dayCampus','notes'],['给学生上课','教室','dayCampus','teach'],['授课','教室','dayCampus','teach'],['黑板前板书','教室','dayCampus','blackboard'],['备课写教案','学校','dayCampus','prepare'],['课后做题','校园','dayCampus','study'],['课间休息','校园','dayCampus','rest'],['吃午饭','学校食堂','dayCampus','meal']]){
  const p=L.presentation({title,location,type:'work'});assert.equal(p.map,map,title);assert.equal(p.spot,spot,title);
 }
 for(const title of ['在家开会','在家备课','在家上网课'])assert.equal(L.presentation({title,location:'家里',type:'work'}).map,'dayHome');
 assert.equal(L.presentation({title:'公司附近喝咖啡',location:'咖啡店',type:'coffee'}).map,'dayCafe');
 assert.equal(L.presentation({title:'学校外吃午饭',location:'餐厅',type:'meal'}).map,'dayCafe');
 assert.equal(L.presentation({title:'复习课堂笔记',location:'图书馆',type:'work'}).map,'dayLibrary');
 assert.equal(L.presentation({title:'处理邮件',type:'work'}).map,'dayWork');
 assert.equal(L.presentation({...row('dayOffice','computer'),deviation:{actual:'改去教室授课',location:'学校'}}).spot,'teach');
});
test('两组新场景经原日程生成writer保存与公开投影，合法world优先且视觉识别不产生新写入',async()=>{
 for(const [scene,spot]of [['dayOffice','computer'],['dayOffice','presentation'],['dayCampus','listen'],['dayCampus','blackboard']]){
  const raw={...row(scene,spot),title:'原世界具体安排',location:'原来的具体地名'};const f=envFor({seqs:[raw]});
  assert.equal(await f.e.generateDay(f.c,'2026-10-09'),true);assert.equal(f.calls.length,1);assert.match(f.calls[0].spec.instruction,new RegExp(scene));
  const saved=f.e.schedulesRef.current.c1['2026-10-09'].seqs[0],count=f.writes.length,before=JSON.stringify(f.e.schedulesRef.current);
  for(let i=0;i<5;i++){const p=f.L.presentation(saved);assert.equal(p.map,scene);assert.equal(p.spot,spot);}
  assert.equal(saved.title,raw.title);assert.equal(saved.location,raw.location);assert.equal(f.writes.length,count);assert.equal(JSON.stringify(f.e.schedulesRef.current),before);
  const publicRow=f.L.publicRow(saved);assert.equal(publicRow.world,undefined);assert.equal(publicRow.location,raw.location);
 }
});

 test('用户实机日程按明确地点纠正旧视觉链接，标题地点与日历原档不变',async()=>{
 const cases=[['在医学院附属图书馆安静阅读神经解剖外科学专著','医学院附属图书馆二楼自习区','dayLibrary','desk-reading','dayWork','work'],['陪Lisa逛复古市集挑选旧布料杂货与古董小件','城中复古跳蚤市集','dayFleaMarket','fabric','dayStreet','walk'],['在星露谷小窝农场整理作物与钓鱼记录','秋声农场码头','dayFarm','records','dayWork','work'],['在集市旁的面包房买肉桂卷并与热红茶歇脚','红河岸边法式烘焙店','dayCafe','tea','dayHome','tea']];
 for(const [title,location,map,spot,oldMap,oldSpot]of cases){
  const raw={...row(oldMap,oldSpot),title,location,type:'out'},f=envFor({seqs:[raw]});await f.e.generateDay(f.c,'2026-10-09');const saved=f.e.schedulesRef.current.c1['2026-10-09'].seqs[0],before=JSON.stringify(saved),writes=f.writes.length;
  for(const world of [null,saved.world]){const p=f.L.presentation({...saved,world});assert.equal(p.map,map,title);assert.equal(p.spot,spot,title);}
  assert.equal(JSON.stringify(saved),before);assert.equal(f.writes.length,writes);assert.equal(f.L.publicRow(saved).title,title);assert.equal(f.L.publicRow(saved).location,location);assert.equal(f.L.publicRow(saved).world,undefined);
  assert.equal(f.L.presentation({...row(),deviation:{actual:title,location,world:raw.world}}).map,map);
 }
 const {L}=envFor({});assert.equal(L.presentation({title:'在家整理农场记录',location:'家里',type:'work'}).map,'dayHome');assert.equal(L.presentation({title:'看复古市集照片',location:'家里',type:'home'}).map,'dayHome');assert.equal(L.presentation({title:'做晚餐',location:'餐厅后厨',type:'work',world:{scene:'dayService',spot:'cook'}}).map,'dayService');assert.equal(L.presentation({title:'原世界自己的安排',location:'原世界具体地名',world:{scene:'dayLibrary',spot:'window-reading'}}).spot,'window-reading');
});
