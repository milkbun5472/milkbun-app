import {PET_SKILLS,restoreSkills,skillTask,skillDuration,startSkill,completeSkill,skillFacts} from './skills.mjs?v=fg-b6947a335b534082';
import {restoreHomeCondition,homeUse} from './home-condition.mjs?v=fg-b6947a335b534082';
import {WORK_HABITS,habitTask,carriesToy,chooseWorkHabit} from './work-habits.mjs?v=fg-b6947a335b534082';
import {restoreHabitMemory,choosePetToy,choosePetRest,learnComfortSpot,greetingFor,petHabitFacts} from './habits.mjs?v=fg-b6947a335b534082';
import {restoreCareManner} from './resident-care.mjs?v=fg-b6947a335b534082';
import {IDLE_ACTIONS,restoreOutdoorIdle} from './autonomy.mjs?v=fg-b6947a335b534082';
import {SEEK_KINDS,VISIT_STAGES,TOY_SPOTS,homePoint,initiativeFor} from './initiative.mjs?v=fg-b6947a335b534082';
const clamp=(v,a=0,b=100,f=65)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):f;
const kinds=['skill','drink','eat','treat','play','sleep','pet','watch','wander','carryBag','inspectBag','habit',...SEEK_KINDS,'moveAway'];
const actorKey=v=>typeof v==='string'?v.slice(0,80):'';
const actorName=v=>typeof v==='string'?v.slice(0,24):'';
const bond=r=>({play:clamp(r?.play,0,1e6,0),pet:clamp(r?.pet,0,1e6,0),food:clamp(r?.food,0,1e6,0),refused:clamp(r?.refused,0,1e6,0),snack:clamp(r?.snack,0,1e6,0),rest:clamp(r?.rest,0,1e6,0)});
const lengths={skill:6,drink:6,eat:18,treat:6,play:16,sleep:45,pet:5,watch:12,wander:7,carryBag:10,inspectBag:4,waitFood:28,invitePlay:28,invitePet:20,askSnack:20,moveAway:0,habit:12};
export function restoreCare(raw){
 const r=raw&&typeof raw==='object'?raw:{}; const traits=r.traits||{},candidate=r.task,skills=restoreSkills(r.skills);
 const target=typeof candidate?.target==='string'&&(candidate.target==='you'||candidate.target.startsWith('companion:')||candidate.target.startsWith('pet:'))?candidate.target.slice(0,90):'';
 const task=candidate&&(!SEEK_KINDS.includes(candidate.kind)||target)?{...candidate,night:candidate.night===true,place:candidate.place==='person'&&(!target||candidate.phase==='doing'&&!homePoint(candidate.spot)&&!(carriesToy(candidate)&&candidate.stage==='fetch'))?(candidate.kind==='sleep'?'bed':'rug'):candidate.kind==='sleep'&&!['bed','sofa','box','own','person'].includes(candidate.place)?'bed':candidate.place}:null;
 return {version:7,skills,condition:restoreHomeCondition(r.condition),habitCooldown:clamp(r.habitCooldown,0,600,0),habits:restoreHabitMemory(r.habits),outdoorIdle:restoreOutdoorIdle(r.outdoorIdle),initiativeCooldown:clamp(r.initiativeCooldown,0,120,20),toyPlaces:Object.fromEntries(Object.entries(TOY_SPOTS).map(([k,v])=>[k,homePoint(r.toyPlaces?.[k])||{...v}])),relationships:Object.fromEntries(Object.entries(r.relationships||{}).filter(([k])=>k==='you'||k.startsWith('companion:')).slice(0,40).map(([k,v])=>[k.slice(0,90),bond(v)])),helper:r.helper&&['feed','play','pet','snack'].includes(r.helper.action)&&actorKey(r.helper.id)?{petId:actorKey(r.helper.petId),action:r.helper.action,id:actorKey(r.helper.id),name:actorName(r.helper.name),phase:r.helper.phase==='doing'?'doing':'walking',time:clamp(r.helper.time,0,60,0),started:!!r.helper.started,responsive:!!r.helper.responsive,manner:restoreCareManner(r.helper.manner),position:r.helper.position&&Number.isFinite(r.helper.position.x)&&Number.isFinite(r.helper.position.z)?{x:r.helper.position.x,z:r.helper.position.z}:null}:null,satiety:clamp(r.satiety),energy:clamp(r.energy,0,100,75),mood:clamp(r.mood,0,100,70),bowl:clamp(r.bowl,0,100,0),elapsed:clamp(r.elapsed,0,1e9,0),idle:0,cooldown:clamp(r.cooldown,0,60,0),rng:clamp(r.rng,1,4294967295,246813579),traits:{active:clamp(traits.active,0,1,.6),social:clamp(traits.social,0,1,.55),bold:clamp(traits.bold,0,1,.45)},toys:{ball:clamp(r.toys?.ball,0,1e6,0),mouse:clamp(r.toys?.mouse,0,1e6,0)},rests:{own:clamp(r.rests?.own,0,1e6,0),box:clamp(r.rests?.box,0,1e6,0),bed:clamp(r.rests?.bed,0,1e6,0),sofa:clamp(r.rests?.sofa,0,1e6,0)},task:task&&kinds.includes(task.kind)&&(task.kind!=='skill'||skillTask(task)&&(task.mode!=='show'||skills.progress[task.skill].practice>=3)&&(!carriesToy(task)||['fetch','carry','lower'].includes(task.stage)))&&(task.kind!=='habit'||habitTask(task)&&(!['alley','stall'].includes(task.habit)||task.stage==='fetch'||task.stage==='carry'||task.stage==='lower'||task.stage==='waiting')&&(task.habit!=='alley'||target))?{...(typeof task.outingId==='string'?{outingId:actorKey(task.outingId)}:{}),...(skillTask(task)?{skill:task.skill,mode:task.mode}:{}),...(habitTask(task)?{habit:task.habit}:{}),night:task.kind==='sleep'&&task.night===true,greeting:task.greeting===true,manner:restoreCareManner(task.manner),bagId:actorKey(task.bagId),bagReaction:['eager','curious','leave'].includes(task.bagReaction)?task.bagReaction:'curious',socialId:actorKey(task.socialId),peer:actorKey(task.peer),focus:homePoint(task.focus),kind:task.kind,food:task.kind==='treat'&&task.food==='bread'?'bread':'snack',phase:task.phase==='doing'&&(task.kind!=='wander'||homePoint(task.spot))?'doing':'walking',time:clamp(task.time,0,skillTask(task)?Math.max(2,skillDuration(task)):lengths[task.kind],0),place:['bed','sofa','box','own','feeding','rug','window','person','toy','water'].includes(task.place)?task.place:'rug',toy:task.toy==='mouse'?'mouse':'ball',source:['self','companion'].includes(task.source)?task.source:'you',actor:actorKey(task.actor),name:actorName(task.name),target,stage:VISIT_STAGES.includes(task.stage)?task.stage:'',spot:homePoint(task.spot),idleAction:IDLE_ACTIONS.includes(task.idleAction)?task.idleAction:'look',reason:task.reason==='waited'?'waited':'pet'}:null,position:r.position&&Number.isFinite(r.position.x)&&Number.isFinite(r.position.z)?{x:r.position.x,z:r.position.z}:null,recent:Array.isArray(r.recent)?r.recent.filter(x=>typeof x?.text==='string').slice(-8).map(x=>({text:x.text.slice(0,120),at:clamp(x.at,0,1e9,0),...(Number.isFinite(x.wallAt)?{wallAt:x.wallAt,completed:x.completed===true}:{}),...(x.type==='skill'&&Object.hasOwn(PET_SKILLS,x.skill)?{type:'skill',skill:x.skill,mode:x.mode==='show'?'show':'practice',target:actorKey(x.target)}:{}),...(x.type==='neighbor'&&['greet','play','together'].includes(x.kind)?{type:'neighbor',peer:actorKey(x.peer),kind:x.kind}:{}),...(x.type==='social'?{type:'social',peer:actorKey(x.peer),kind:['window','ball','box','reconcile'].includes(x.kind)?x.kind:'window'}:{}),...(x.type==='habit'&&WORK_HABITS[x.habit]?{type:'habit',habit:x.habit}:{}),...(x.type==='visit'?{type:'visit',kind:kinds.includes(x.kind)?x.kind:'invitePet',target:actorKey(x.target)}:{})})):[]};
}
// A self-chosen idle task gives way to a person's request; everything else keeps the pet busy.
function interruptible(t){return t?.source==='self'&&(SEEK_KINDS.includes(t.kind)||['moveAway','watch','wander','play','habit'].includes(t.kind)||t.kind==='sleep'&&t.phase==='walking');}
// The fixed reasons a request is turned down, shared by request() and the care buttons; mood-based refusals stay a surprise.
export function careBlock(s,action){const t=interruptible(s.task)?null:s.task;
 if(t?.kind==='sleep'&&t.phase==='doing'&&action!=='wake')return {short:'睡着了',text:'正睡得香，先让它休息吧。',refuse:true};
 if(action==='wake')return t?.kind==='sleep'?null:{short:'醒着',text:'它已经醒着啦。'};
 if(action==='pet'&&s.cooldown>0)return {short:'刚摸过',text:'刚刚摸过啦，它躲开了，想自己待会儿。',refuse:true,note:'摸得有点久，它轻轻挪开了。'};
 if(t)return {short:'在忙',text:'它正在忙这件事，等一小会儿。'};
 if(action==='feed'&&s.bowl>25)return {short:'碗里还有',text:'碗里还有粮，先吃完这一份。',refuse:true};
 if(action==='snack'&&s.satiety>90)return {short:'吃饱了',text:'已经吃饱啦，这一口留到下次。',refuse:true};
 if(action==='play'&&s.energy<22)return {short:'有点累',text:'有点累，趴着看你晃玩具。',refuse:true};
 if(action==='play'&&s.satiety<15)return {short:'饿了',text:'肚子空空，先往饭碗那边看。',refuse:true};
 return null;}
export function createPetCare(raw,{real=false,now=Date.now}={}){
 const s=restoreCare(raw);
 const record=(text,event)=>{s.recent.push({text,at:s.elapsed,wallAt:now(),...event});s.recent=s.recent.slice(-8);};
 const recordDone=(text,event)=>record(text,{...event,completed:true});
 const random=()=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;};
 function start(kind,place,toy='ball',source='you',actor='',name=''){s.task={kind,phase:'walking',time:0,place,toy,source,actor,name};s.idle=0;return {accepted:true,text:kind==='drink'?'往水碗边走去，准备喝几口。':kind==='eat'?'闻到饭香，往碗边去了。':kind==='treat'?'走过来，想尝一小口。':kind==='play'?'盯上了玩具，准备追过去。':kind==='sleep'?'找个舒服的地方歇歇。':kind==='pet'?'靠过来，等你摸摸。':'自己去窗边看看。'};}
 function request(action,{toy='',source='you',actor='',name='',nearPerson=false,food='snack',place='',restPlaces=['bed','sofa'],manner}={}){
  toy=['ball','mouse'].includes(toy)?toy:action==='play'?choosePetToy(s,random):'ball';const previous=s.task,canInterrupt=interruptible(previous);
  if(canInterrupt)s.task=null;
  const started=result=>{if(s.task&&source==='companion')s.task.manner=restoreCareManner(manner);if(nearPerson&&s.task&&['play','pet','treat'].includes(s.task.kind)){s.task.place='person';s.task.target=source==='companion'?'companion:'+actorKey(actor):'you';}return result;};
  const who=source==='companion'?(actorName(name)||'TA'):'你';const rel=()=>{const k=source==='companion'?'companion:'+actorKey(actor):'you';return s.relationships[k]||(s.relationships[k]=bond());};
  const refuse=text=>{if(canInterrupt)s.task=previous;if(source!=='self'){rel().refused++;record(who+'想陪它'+(action==='play'?'玩':action==='pet'?'贴贴':'吃东西')+'：'+text);}return {accepted:false,text};};
  const block=careBlock(s,action);if(block){if(block.note)record(block.note);if(block.refuse)return refuse(block.text);if(canInterrupt)s.task=previous;return {accepted:false,text:block.text};}
  if(action==='wake'){if(!finishNightRest())s.task=null;s.idle=0;record('被轻轻叫醒，伸了个懒腰。');return {accepted:true,text:'慢慢醒过来了。'};}
  if(action==='feed'){s.bowl=100;recordDone(who+'给饭碗添了一份粮。');rel().food++;if(s.satiety>85)return {accepted:true,text:'闻了闻饭碗，现在还不饿。'};return start('eat','feeding','ball',source,actor,name);}
  if(action==='snack'){const result=started(start('treat','rug','ball',source,actor,name));s.task.food=food==='bread'?'bread':'snack';return result;}
  if(action==='drink'){if(s.condition.water<=0)return {accepted:false,text:'水碗里还没有清水。'};return start('drink','water','ball',source);}
  if(action==='eat'){if(!s.bowl||s.satiety>90)return {accepted:false,text:'现在不想吃。'};return start('eat','feeding','ball',source);}
  if(action==='play'){if(source!=='self'&&random()>.65+s.traits.active*.25+s.mood*.0015+Math.min(.1,rel().play*.015)){record('今天这次没想玩，转头看了窗外。');return refuse('看了一眼玩具，今天这会儿没兴趣。');}return started(start('play','rug',toy,source,actor,name));}
  if(action==='rest'&&['box','own'].includes(place))return start('sleep',place,'ball',source);
  if(action==='rest')return start('sleep',choosePetRest(s,restPlaces,random),'ball',source);
  if(action==='pet'){return started(start('pet','rug','ball',source,actor,name));}
  if(action==='watch')return start('watch','window','ball',source);
  if(canInterrupt)s.task=previous;return {accepted:false,text:'它歪头看了看你。'};
 }
 function finish(delivered=false){const t=s.task;if(!t)return;if(skillTask(t)){const text=completeSkill(s,t,delivered);if(!text)return;recordDone(text,{type:'skill',skill:t.skill,mode:t.mode,target:t.target});}if(t.kind==='sleep'&&!t.target)homeUse(s,'sleep',1,t.place);if(t.kind==='drink')recordDone('到水碗边喝过几口清水。');learnComfortSpot(s,t);const who=t.source==='companion'?(t.name||'TA'):'你';if(t.source!=='self'&&['play','pet','treat'].includes(t.kind)){const key=t.source==='companion'?'companion:'+t.actor:'you';const r=s.relationships[key]||(s.relationships[key]=bond());r[t.kind==='treat'?'snack':t.kind]++;}
  if(t.kind==='play'){s.toys[t.toy]++;s.traits.active=clamp(s.traits.active+.004,0,1);recordDone((t.source==='companion'?who+'陪它':'')+'追着'+(t.toy==='ball'?'小球':'小老鼠')+'玩了一会儿，心情变好了。');}
  if(habitTask(t)){recordDone(WORK_HABITS[t.habit].done,{type:'habit',habit:t.habit});s.habitCooldown=240;}
  if(t.kind==='inspectBag')recordDone(t.bagReaction==='leave'?'闻过小袋子，准备自己去别处待着。':'低头闻了闻刚拆的小袋子，看看这次带回的东西。');
  if(t.kind==='treat')recordDone(t.source==='self'?'慢慢嚼完了一份自己拆出的小'+(t.food==='bread'?'面包。':'零食。'):t.food==='bread'?who+'分给它自己带回的小面包，它慢慢嚼完了。':who+'给了一小口零食，它慢慢嚼完了。');
  if(t.kind==='eat')recordDone('吃了一会儿粮，舔了舔嘴巴。');
  if(t.kind==='sleep'){if(t.place==='person'&&t.target){const r=s.relationships[t.target]||(s.relationships[t.target]=bond());r.rest++;recordDone('靠着'+(t.name||'你')+'睡了一会儿，精神好多了。');}else{const place=t.place==='own'?'own':t.place==='box'?'box':t.place==='sofa'?'sofa':'bed';s.rests[place]++;recordDone('在'+(t.place==='own'?'自己摆好的小窝里':t.place==='box'?'自己买的小纸箱里':t.place==='sofa'?'沙发边':'自己的窝里')+'睡了一觉，精神好多了。');}}
  if(t.kind==='watch')s.traits.bold=clamp(s.traits.bold+.002,0,1);
  if(t.kind==='pet'){s.traits.social=clamp(s.traits.social+.006,0,1);s.cooldown=20;recordDone('让'+who+'摸了摸，贴着'+who+'的手蹭了蹭。');}
  s.task=null;s.idle=0;if(t.kind==='inspectBag'&&t.bagReaction==='leave')s.task={kind:'moveAway',phase:'walking',time:0,place:'rug',source:'self',reason:'bag'};if(!['wander','watch'].includes(t.kind)&&!(t.kind==='play'&&t.source==='self'))s.initiativeCooldown=45;if(t.kind==='pet'||SEEK_KINDS.includes(t.kind))s.task={kind:'moveAway',phase:'walking',time:0,place:'rug',toy:t.toy,source:'self',target:t.target|| (t.source==='companion'?'companion:'+t.actor:'you'),name:t.name,reason:t.kind==='pet'?'pet':'waited'};
 }
 function tick(dt,{home=false,interaction=false,paused=false,people,belongings,restPlaces=['bed','sofa'],idleAllowed=true}={}){
  if(paused||!Number.isFinite(dt)||dt<=0)return null;dt=Math.min(dt,1);s.elapsed+=dt;s.habitCooldown=Math.max(0,s.habitCooldown-dt);s.cooldown=Math.max(0,s.cooldown-dt);s.initiativeCooldown=Math.max(0,s.initiativeCooldown-dt);s.satiety=clamp(s.satiety-dt*(real?.0015:.025));s.energy=clamp(s.energy-dt*(real?.0006:.012));s.mood=clamp(s.mood-dt*(s.satiety<15?.09:.002));
  const t=s.task;
  if(t?.phase==='doing'&&(home||interaction&&['play','pet'].includes(t.kind))){t.time+=dt;
   if(t.kind==='eat'){const n=Math.min(s.bowl,dt*4);s.bowl-=n;homeUse(s,'eat',n);s.satiety=clamp(s.satiety+n*.65);s.mood=clamp(s.mood+dt*.2);}
   if(t.kind==='drink'){homeUse(s,'drink',dt*3);s.mood=clamp(s.mood+dt*.05);}
   if(t.kind==='treat'){s.satiety=clamp(s.satiety+dt*(t.food==='bread'?8/6:.9));s.mood=clamp(s.mood+dt*.45);}
   if(t.kind==='play'){s.energy=clamp(s.energy-dt*.8);s.mood=clamp(s.mood+dt*1.1);}
   if(t.kind==='sleep'){s.energy=clamp(s.energy+dt*.75);s.mood=clamp(s.mood+dt*.08);}
   if(t.kind==='pet')s.mood=clamp(s.mood+dt*1.1);
   if(!['carryBag','inspectBag'].includes(t.kind)&&!t.socialId&&(!carriesToy(t)||t.stage==='waiting')&&((!SEEK_KINDS.includes(t.kind)||t.kind==='invitePlay'&&t.stage==='waiting')&&t.time>=(skillTask(t)?skillDuration(t):lengths[t.kind])&&!t.night||t.kind==='eat'&&(s.bowl<=0||s.satiety>=98)||t.kind==='sleep'&&!t.night&&s.energy>=96))finish();
  }
  if(t?.phase==='doing'&&home&&['waitFood','invitePet','askSnack'].includes(t.kind)&&t.time>=(skillTask(t)?skillDuration(t):lengths[t.kind]))finish();
  if(!s.task&&home&&idleAllowed){s.idle+=dt;if(s.idle>=6){s.idle=0;if(s.condition.water>0&&random()<.045)return request('drink',{source:'self'});if(s.satiety<72&&s.bowl>0)return request('eat',{source:'self'});const habit=chooseWorkHabit(s,belongings,people,random);if(habit){s.task=habit;s.habitCooldown=240;return {accepted:true,quiet:true,text:WORK_HABITS[habit.habit].label};}if(people?.length&&s.initiativeCooldown<=0){const desire=initiativeFor(s,people,random);if(desire){const {person}=desire;s.task={kind:desire.kind,phase:'walking',time:0,place:desire.place,toy:desire.toy||'ball',source:'self',target:person.key,actor:person.id||'',name:person.name||'你',stage:desire.kind==='invitePlay'?'fetch':''};return {accepted:true,text:'它有自己的想法，正慢慢走过去。'};}}if(s.satiety<72&&s.bowl>0)return request('eat',{source:'self'});if(s.energy<48)return request('rest',{source:'self',restPlaces});if(random()<s.traits.active*.2&&s.energy>40)return request('play',{source:'self'});s.task={kind:'wander',phase:'walking',time:0,place:'rug',source:'self',idleAction:random()<.65?'sniff':'look'};return {accepted:true,quiet:true,text:'自己慢慢逛逛。'};}}
  return null;
 }
 function visit(t,text){if(t.greeting)text='听见'+(t.name||'你')+'回家的动静，'+text;record(text,{type:'visit',kind:t.kind,target:t.target});}
 function arrive(){const t=s.task;if(!t||t.phase!=='walking')return;t.phase='doing';t.time=0;
  if(t.kind==='moveAway'){record(t.reason==='pet'?'摸够了，自己慢慢走开，想独自待一会儿。':'等了一会儿，先去别处待着。');s.task=null;s.idle=0;return;}
  if(t.kind==='waitFood'){t.stage='waiting';visit(t,'它到饭碗边等着，看看空碗，又看看'+(t.name||'你')+'。');}
  if(t.kind==='askSnack'){t.stage='waiting';visit(t,'它来到'+(t.name||'你')+'身旁，闻闻手边，想讨一小口零食。');}
  if(t.kind==='invitePet'){t.stage='cuddle';visit(t,'它主动来到'+(t.name||'你')+'身边，轻轻蹭蹭，想贴贴。');}
  if(t.kind==='sleep'&&t.place==='person')visit(t,'它找了个舒服的位置，靠在'+(t.name||'你')+'身旁睡下了。');
  if(carriesToy(t)&&t.stage==='carry')t.stage='lower';
 }
 function pickupToy(){const t=s.task;if(!carriesToy(t)||t.stage!=='fetch'||t.phase!=='doing'||t.time<2)return false;t.stage='carry';t.phase='walking';t.time=0;return true;}
 function deliverToy(point){const t=s.task,p=homePoint(point);if(!carriesToy(t)||t.stage!=='lower'||t.phase!=='doing'||t.time<1.2||!p)return false;s.toyPlaces[t.toy]=p;t.stage='waiting';t.time=0;if(habitTask(t)||skillTask(t)){finish(true);return true;}visit(t,'它把'+(t.toy==='mouse'?'小老鼠':'小球')+'叼到'+(t.name||'你')+'脚边，放下等着一起玩。');return true;}
 function startBag(id,spot,reaction){if(!homePoint(spot)||s.helper||s.task&&!(s.task.source==='self'&&(['watch','wander','play'].includes(s.task.kind)||habitTask(s.task)&&!carriesToy(s.task))&&!s.task.socialId))return {accepted:false,text:'等它忙完，再把小袋子放好。'};s.task={kind:reaction?'inspectBag':'carryBag',phase:'walking',time:0,place:'rug',spot:homePoint(spot),source:'self',bagId:actorKey(id),bagReaction:reaction||'curious'};s.idle=0;return {accepted:true,text:reaction?'它准备闻闻小袋子。':'它叼着小袋子，准备找地方放下。'};}
 function startSocial(t){if(!homePoint(t.spot)&&t.kind!=='invitePlay')return false;if(!['watch','invitePlay','sleep'].includes(t.kind)||!actorKey(t.socialId))return false;s.task={...t,phase:'walking',time:0,source:'self',toy:t.toy||'ball'};s.idle=0;return true;}
 function finishNightRest(){const t=s.task;if(t?.kind!=='sleep'||!t.night||t.phase!=='doing'||t.time<45)return false;finish();return true;}
 function greet(person,at=Date.now()){const task=greetingFor(s,person,at,random);if(!task)return {accepted:false};s.habits.greetings[person.key]=at;s.task={...task,phase:'walking',time:0};s.idle=0;return {accepted:true};}
 return {state:s,requestSkill:(id,options)=>startSkill(s,id,options,random),greet,finishNightRest,startBag,finishBagReaction:()=>{if(s.task?.kind==='inspectBag'&&s.task.phase==='doing'&&s.task.time>=4){finish();return true;}return false;},startSocial,request,tick,arrive,pickupToy,deliverToy,cancel:()=>{s.task=null;s.idle=0;},record,snapshot:()=>structuredClone(s)};
}
export function careSummary(s){const t=s.task;return {skills:skillFacts(s),habits:petHabitFacts(s),activity:skillTask(t)?(t.phase==='walking'?'正跟着口令走过去':t.skill==='stay'?'坐好等一等':t.skill==='fetch'?'正在叼回原来的玩具':'来到叫它的人身边'):habitTask(t)?(t.phase==='walking'?'正在'+WORK_HABITS[t.habit].label:WORK_HABITS[t.habit].label):t?(t.phase==='walking'?(t.kind==='wander'?'自己慢慢逛逛':'正在走过去'):({drink:'正在喝清水',eat:'正在吃饭',treat:t.food==='bread'?'正在吃自己带回的小面包':'正在吃零食',play:'正在追玩具',sleep:'正在睡觉',waitFood:'在饭碗边等你们',invitePlay:'叼玩具来邀玩',invitePet:'主动来贴贴',askSnack:'来讨一小口零食',moveAway:'自己走开歇歇',pet:'正在蹭蹭',carryBag:'叼着带回家的小袋子',inspectBag:'正在闻刚拆开的小袋子',watch:'正在看窗外',wander:t.phase==='walking'?'自己慢慢逛逛':t.idleAction==='sniff'?'停下来闻闻':'歇歇，看看四周'})[t.kind]):'在家里悠悠闲闲',satiety:s.satiety<25?'肚子有点空':s.satiety<55?'有点饿':s.satiety>90?'吃得饱饱的':'肚子很舒服',energy:s.energy<25?'困困的':s.energy<55?'想歇一会儿':'很有精神',mood:s.mood<35?'有点闷闷的':s.mood>78?'心情很好':'心情平稳',traits:[s.traits.active>.65?'爱玩的小家伙':'也喜欢安静待着',s.traits.social>.6?'越来越爱贴贴':'慢慢熟悉你的手',s.traits.bold>.6?'好奇心很强':'先观察再靠近'],favoriteToy:s.toys.ball+s.toys.mouse?((s.toys.mouse>s.toys.ball?'小老鼠':'小球')):'还在发现喜欢的玩具',favoriteRest:s.rests.own+s.rests.bed+s.rests.sofa+s.rests.box?(s.rests.own>Math.max(s.rests.bed,s.rests.sofa,s.rests.box)?'自己摆好的小窝':(s.rests.box>Math.max(s.rests.bed,s.rests.sofa)?'自己的小纸箱':s.rests.sofa>s.rests.bed?'沙发边':'自己的窝')):'还在挑舒服的位置'};}
