import {IDLE_ACTIONS,restoreOutdoorIdle} from './autonomy.mjs?v=fg-8a3cad69c2d629ad';
import {SEEK_KINDS,VISIT_STAGES,TOY_SPOTS,homePoint,initiativeFor} from './initiative.mjs?v=fg-8a3cad69c2d629ad';
const clamp=(v,a=0,b=100,f=65)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):f;
const kinds=['eat','treat','play','sleep','pet','watch','wander','carryBag','inspectBag',...SEEK_KINDS,'moveAway'];
const actorKey=v=>typeof v==='string'?v.slice(0,80):'';
const actorName=v=>typeof v==='string'?v.slice(0,24):'';
const bond=r=>({play:clamp(r?.play,0,1e6,0),pet:clamp(r?.pet,0,1e6,0),food:clamp(r?.food,0,1e6,0),refused:clamp(r?.refused,0,1e6,0),snack:clamp(r?.snack,0,1e6,0),rest:clamp(r?.rest,0,1e6,0)});
const lengths={eat:18,treat:6,play:16,sleep:45,pet:5,watch:12,wander:7,carryBag:10,inspectBag:4,waitFood:28,invitePlay:28,invitePet:20,askSnack:20,moveAway:0};
export function restoreCare(raw){
 const r=raw&&typeof raw==='object'?raw:{}; const traits=r.traits||{},candidate=r.task;
 const target=typeof candidate?.target==='string'&&(candidate.target==='you'||candidate.target.startsWith('companion:')||candidate.target.startsWith('pet:'))?candidate.target.slice(0,90):'';
 const task=candidate&&(!SEEK_KINDS.includes(candidate.kind)||target)?{...candidate,night:candidate.night===true,place:candidate.place==='person'&&(!target||candidate.phase==='doing'&&!homePoint(candidate.spot))?(candidate.kind==='sleep'?'bed':'rug'):candidate.kind==='sleep'&&!['bed','sofa','box','person'].includes(candidate.place)?'bed':candidate.place}:null;
 return {version:3,outdoorIdle:restoreOutdoorIdle(r.outdoorIdle),initiativeCooldown:clamp(r.initiativeCooldown,0,120,20),toyPlaces:Object.fromEntries(Object.entries(TOY_SPOTS).map(([k,v])=>[k,homePoint(r.toyPlaces?.[k])||{...v}])),relationships:Object.fromEntries(Object.entries(r.relationships||{}).filter(([k])=>k==='you'||k.startsWith('companion:')).slice(0,40).map(([k,v])=>[k.slice(0,90),bond(v)])),helper:r.helper&&['feed','play','pet','snack'].includes(r.helper.action)&&actorKey(r.helper.id)?{petId:actorKey(r.helper.petId),action:r.helper.action,id:actorKey(r.helper.id),name:actorName(r.helper.name),phase:r.helper.phase==='doing'?'doing':'walking',time:clamp(r.helper.time,0,60,0),started:!!r.helper.started,responsive:!!r.helper.responsive,position:r.helper.position&&Number.isFinite(r.helper.position.x)&&Number.isFinite(r.helper.position.z)?{x:r.helper.position.x,z:r.helper.position.z}:null}:null,satiety:clamp(r.satiety),energy:clamp(r.energy,0,100,75),mood:clamp(r.mood,0,100,70),bowl:clamp(r.bowl,0,100,0),elapsed:clamp(r.elapsed,0,1e9,0),idle:0,cooldown:clamp(r.cooldown,0,60,0),rng:clamp(r.rng,1,4294967295,246813579),traits:{active:clamp(traits.active,0,1,.6),social:clamp(traits.social,0,1,.55),bold:clamp(traits.bold,0,1,.45)},toys:{ball:clamp(r.toys?.ball,0,1e6,0),mouse:clamp(r.toys?.mouse,0,1e6,0)},rests:{box:clamp(r.rests?.box,0,1e6,0),bed:clamp(r.rests?.bed,0,1e6,0),sofa:clamp(r.rests?.sofa,0,1e6,0)},task:task&&kinds.includes(task.kind)?{bagId:actorKey(task.bagId),bagReaction:['eager','curious','leave'].includes(task.bagReaction)?task.bagReaction:'curious',socialId:actorKey(task.socialId),peer:actorKey(task.peer),focus:homePoint(task.focus),kind:task.kind,food:task.kind==='treat'&&task.food==='bread'?'bread':'snack',phase:task.phase==='doing'&&(task.kind!=='wander'||homePoint(task.spot))?'doing':'walking',time:clamp(task.time,0,lengths[task.kind],0),place:['bed','sofa','box','feeding','rug','window','person','toy'].includes(task.place)?task.place:'rug',toy:task.toy==='mouse'?'mouse':'ball',source:['self','companion'].includes(task.source)?task.source:'you',actor:actorKey(task.actor),name:actorName(task.name),target,stage:VISIT_STAGES.includes(task.stage)?task.stage:'',spot:homePoint(task.spot),idleAction:IDLE_ACTIONS.includes(task.idleAction)?task.idleAction:'look',reason:task.reason==='waited'?'waited':'pet'}:null,position:r.position&&Number.isFinite(r.position.x)&&Number.isFinite(r.position.z)?{x:r.position.x,z:r.position.z}:null,recent:Array.isArray(r.recent)?r.recent.filter(x=>typeof x?.text==='string').slice(-8).map(x=>({text:x.text.slice(0,120),at:clamp(x.at,0,1e9,0),...(x.type==='social'?{type:'social',peer:actorKey(x.peer),kind:['window','ball','box'].includes(x.kind)?x.kind:'window'}:{}),...(x.type==='visit'?{type:'visit',kind:kinds.includes(x.kind)?x.kind:'invitePet',target:actorKey(x.target)}:{})})):[]};
}
export function createPetCare(raw,{real=false}={}){
 const s=restoreCare(raw);
 const record=(text,event)=>{s.recent.push({text,at:s.elapsed,...event});s.recent=s.recent.slice(-8);};
 const random=()=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;};
 function start(kind,place,toy='ball',source='you',actor='',name=''){s.task={kind,phase:'walking',time:0,place,toy,source,actor,name};s.idle=0;return {accepted:true,text:kind==='eat'?'闻到饭香，往碗边去了。':kind==='treat'?'走过来，想尝一小口。':kind==='play'?'盯上了玩具，准备追过去。':kind==='sleep'?'找个舒服的地方歇歇。':kind==='pet'?'靠过来，等你摸摸。':'自己去窗边看看。'};}
 function request(action,{toy='ball',source='you',actor='',name='',nearPerson=false,food='snack',place=''}={}){
  const previous=s.task,canInterrupt=previous?.source==='self'&&(SEEK_KINDS.includes(previous.kind)||['moveAway','watch','wander','play'].includes(previous.kind)||previous.kind==='sleep'&&previous.phase==='walking');
  if(canInterrupt)s.task=null;
  const started=result=>{if(nearPerson&&s.task&&['play','pet','treat'].includes(s.task.kind)){s.task.place='person';s.task.target=source==='companion'?'companion:'+actorKey(actor):'you';}return result;};
  const who=source==='companion'?(actorName(name)||'TA'):'你';const rel=()=>{const k=source==='companion'?'companion:'+actorKey(actor):'you';return s.relationships[k]||(s.relationships[k]=bond());};
  const refuse=text=>{if(canInterrupt)s.task=previous;if(source!=='self'){rel().refused++;record(who+'想陪它'+(action==='play'?'玩':action==='pet'?'贴贴':'吃东西')+'：'+text);}return {accepted:false,text};};
  if(s.task?.kind==='sleep'&&s.task.phase==='doing'&&action!=='wake')return refuse('正睡得香，先让它休息吧。');
  if(action==='wake'){if(s.task?.kind!=='sleep'){if(canInterrupt)s.task=previous;return {accepted:false,text:'它已经醒着啦。'};};s.task=null;s.idle=0;record('被轻轻叫醒，伸了个懒腰。');return {accepted:true,text:'慢慢醒过来了。'};}
  if(s.task?.source==='self'&&s.task.kind==='watch')s.task=null;
  if(action==='pet'&&s.cooldown>0){record('摸得有点久，它轻轻挪开了。');return refuse('刚刚摸过啦，它躲开了，想自己待会儿。');}
  if(s.task)return {accepted:false,text:'它正在忙这件事，等一小会儿。'};
  if(action==='feed'){if(s.bowl>25)return refuse('碗里还有粮，先吃完这一份。');s.bowl=100;record(who+'给饭碗添了一份粮。');rel().food++;if(s.satiety>85)return {accepted:true,text:'闻了闻饭碗，现在还不饿。'};return start('eat','feeding','ball',source,actor,name);}
  if(action==='snack'){if(s.satiety>90)return refuse('已经吃饱啦，这一口留到下次。');const result=started(start('treat','rug','ball',source,actor,name));s.task.food=food==='bread'?'bread':'snack';return result;}
  if(action==='eat'){if(!s.bowl||s.satiety>90)return {accepted:false,text:'现在不想吃。'};return start('eat','feeding','ball',source);}
  if(action==='play'){if(s.energy<22)return refuse('有点累，趴着看你晃玩具。');if(s.satiety<15)return refuse('肚子空空，先往饭碗那边看。');if(source!=='self'&&random()>.65+s.traits.active*.25+s.mood*.0015+Math.min(.1,rel().play*.015)){record('今天这次没想玩，转头看了窗外。');return refuse('看了一眼玩具，今天这会儿没兴趣。');}return started(start('play','rug',toy,source,actor,name));}
  if(action==='rest'&&place==='box')return start('sleep','box','ball',source);
  if(action==='rest')return start('sleep',random()<clamp(.7+(s.rests.bed-s.rests.sofa)*.04,.2,.9,.7)?'bed':'sofa','ball',source);
  if(action==='pet'){return started(start('pet','rug','ball',source,actor,name));}
  if(action==='watch')return start('watch','window','ball',source);
  if(canInterrupt)s.task=previous;return {accepted:false,text:'它歪头看了看你。'};
 }
 function finish(){const t=s.task;if(!t)return;const who=t.source==='companion'?(t.name||'TA'):'你';if(t.source!=='self'&&['play','pet','treat'].includes(t.kind)){const key=t.source==='companion'?'companion:'+t.actor:'you';const r=s.relationships[key]||(s.relationships[key]=bond());r[t.kind==='treat'?'snack':t.kind]++;}
  if(t.kind==='play'){s.toys[t.toy]++;s.traits.active=clamp(s.traits.active+.004,0,1);record((t.source==='companion'?who+'陪它':'')+'追着'+(t.toy==='ball'?'小球':'小老鼠')+'玩了一会儿，心情变好了。');}
  if(t.kind==='inspectBag')record(t.bagReaction==='leave'?'闻过小袋子，准备自己去别处待着。':'低头闻了闻刚拆的小袋子，看看这次带回的东西。');
  if(t.kind==='treat')record(t.source==='self'?'慢慢嚼完了一份自己拆出的小'+(t.food==='bread'?'面包。':'零食。'):t.food==='bread'?who+'分给它自己带回的小面包，它慢慢嚼完了。':who+'给了一小口零食，它慢慢嚼完了。');
  if(t.kind==='eat')record('吃了一会儿粮，舔了舔嘴巴。');
  if(t.kind==='sleep'){if(t.place==='person'&&t.target){const r=s.relationships[t.target]||(s.relationships[t.target]=bond());r.rest++;record('靠着'+(t.name||'你')+'睡了一会儿，精神好多了。');}else{const place=t.place==='box'?'box':t.place==='sofa'?'sofa':'bed';s.rests[place]++;record('在'+(t.place==='box'?'自己买的小纸箱里':t.place==='sofa'?'沙发边':'自己的窝里')+'睡了一觉，精神好多了。');}}
  if(t.kind==='watch')s.traits.bold=clamp(s.traits.bold+.002,0,1);
  if(t.kind==='pet'){s.traits.social=clamp(s.traits.social+.006,0,1);s.cooldown=20;record('让'+who+'摸了摸，贴着'+who+'的手蹭了蹭。');}
  s.task=null;s.idle=0;if(t.kind==='inspectBag'&&t.bagReaction==='leave')s.task={kind:'moveAway',phase:'walking',time:0,place:'rug',source:'self',reason:'bag'};if(!['wander','watch'].includes(t.kind)&&!(t.kind==='play'&&t.source==='self'))s.initiativeCooldown=45;if(t.kind==='pet'||SEEK_KINDS.includes(t.kind))s.task={kind:'moveAway',phase:'walking',time:0,place:'rug',toy:t.toy,source:'self',target:t.target|| (t.source==='companion'?'companion:'+t.actor:'you'),name:t.name,reason:t.kind==='pet'?'pet':'waited'};
 }
 function tick(dt,{home=false,paused=false,people}={}){
  if(paused||!Number.isFinite(dt)||dt<=0)return null;dt=Math.min(dt,1);s.elapsed+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.initiativeCooldown=Math.max(0,s.initiativeCooldown-dt);s.satiety=clamp(s.satiety-dt*(real?.0015:.025));s.energy=clamp(s.energy-dt*(real?.0006:.012));s.mood=clamp(s.mood-dt*(s.satiety<15?.09:.002));
  const t=s.task;
  if(t?.phase==='doing'&&home){t.time+=dt;
   if(t.kind==='eat'){const n=Math.min(s.bowl,dt*4);s.bowl-=n;s.satiety=clamp(s.satiety+n*.65);s.mood=clamp(s.mood+dt*.2);}
   if(t.kind==='treat'){s.satiety=clamp(s.satiety+dt*(t.food==='bread'?8/6:.9));s.mood=clamp(s.mood+dt*.45);}
   if(t.kind==='play'){s.energy=clamp(s.energy-dt*.8);s.mood=clamp(s.mood+dt*1.1);}
   if(t.kind==='sleep'){s.energy=clamp(s.energy+dt*.75);s.mood=clamp(s.mood+dt*.08);}
   if(t.kind==='pet')s.mood=clamp(s.mood+dt*1.1);
   if(!['carryBag','inspectBag'].includes(t.kind)&&!t.socialId&&((!SEEK_KINDS.includes(t.kind)||t.kind==='invitePlay'&&t.stage==='waiting')&&t.time>=lengths[t.kind]&&!t.night||t.kind==='eat'&&(s.bowl<=0||s.satiety>=98)||t.kind==='sleep'&&!t.night&&s.energy>=96))finish();
  }
  if(t?.phase==='doing'&&home&&['waitFood','invitePet','askSnack'].includes(t.kind)&&t.time>=lengths[t.kind])finish();
  if(!s.task&&home){s.idle+=dt;if(s.idle>=6){s.idle=0;if(s.satiety<72&&s.bowl>0)return request('eat',{source:'self'});if(people?.length&&s.initiativeCooldown<=0){const desire=initiativeFor(s,people,random);if(desire){const {person}=desire;s.task={kind:desire.kind,phase:'walking',time:0,place:desire.place,toy:desire.toy||'ball',source:'self',target:person.key,actor:person.id||'',name:person.name||'你',stage:desire.kind==='invitePlay'?'fetch':''};return {accepted:true,text:'它有自己的想法，正慢慢走过去。'};}}if(s.satiety<72&&s.bowl>0)return request('eat',{source:'self'});if(s.energy<48)return request('rest',{source:'self'});if(random()<s.traits.active*.2&&s.energy>40)return request('play',{toy:s.toys.mouse>s.toys.ball?'mouse':'ball',source:'self'});s.task={kind:'wander',phase:'walking',time:0,place:'rug',source:'self',idleAction:random()<.65?'sniff':'look'};return {accepted:true,quiet:true,text:'自己慢慢逛逛。'};}}
  return null;
 }
 function visit(t,text){record(text,{type:'visit',kind:t.kind,target:t.target});}
 function arrive(){const t=s.task;if(!t||t.phase!=='walking')return;t.phase='doing';t.time=0;
  if(t.kind==='moveAway'){record(t.reason==='pet'?'摸够了，自己慢慢走开，想独自待一会儿。':'等了一会儿，先去别处待着。');s.task=null;s.idle=0;return;}
  if(t.kind==='waitFood'){t.stage='waiting';visit(t,'它到饭碗边等着，看看空碗，又看看'+(t.name||'你')+'。');}
  if(t.kind==='askSnack'){t.stage='waiting';visit(t,'它来到'+(t.name||'你')+'身旁，闻闻手边，想讨一小口零食。');}
  if(t.kind==='invitePet'){t.stage='cuddle';visit(t,'它主动来到'+(t.name||'你')+'身边，轻轻蹭蹭，想贴贴。');}
  if(t.kind==='sleep'&&t.place==='person')visit(t,'它找了个舒服的位置，靠在'+(t.name||'你')+'身旁睡下了。');
  if(t.kind==='invitePlay'&&t.stage==='carry')t.stage='lower';
 }
 function pickupToy(){const t=s.task;if(t?.kind!=='invitePlay'||t.stage!=='fetch'||t.phase!=='doing'||t.time<2)return false;t.stage='carry';t.phase='walking';t.time=0;return true;}
 function deliverToy(point){const t=s.task,p=homePoint(point);if(t?.kind!=='invitePlay'||t.stage!=='lower'||t.phase!=='doing'||t.time<1.2||!p)return false;s.toyPlaces[t.toy]=p;t.stage='waiting';t.time=0;visit(t,'它把'+(t.toy==='mouse'?'小老鼠':'小球')+'叼到'+(t.name||'你')+'脚边，放下等着一起玩。');return true;}
 function startBag(id,spot,reaction){if(!homePoint(spot)||s.helper||s.task&&!(s.task.source==='self'&&['watch','wander','play'].includes(s.task.kind)&&!s.task.socialId))return {accepted:false,text:'等它忙完，再把小袋子放好。'};s.task={kind:reaction?'inspectBag':'carryBag',phase:'walking',time:0,place:'rug',spot:homePoint(spot),source:'self',bagId:actorKey(id),bagReaction:reaction||'curious'};s.idle=0;return {accepted:true,text:reaction?'它准备闻闻小袋子。':'它叼着小袋子，准备找地方放下。'};}
 function startSocial(t){if(!homePoint(t.spot)&&t.kind!=='invitePlay')return false;if(!['watch','invitePlay','sleep'].includes(t.kind)||!actorKey(t.socialId))return false;s.task={...t,phase:'walking',time:0,source:'self',toy:t.toy||'ball'};s.idle=0;return true;}
 return {state:s,startBag,finishBagReaction:()=>{if(s.task?.kind==='inspectBag'&&s.task.phase==='doing'&&s.task.time>=4){finish();return true;}return false;},startSocial,request,tick,arrive,pickupToy,deliverToy,cancel:()=>{s.task=null;s.idle=0;},record,snapshot:()=>structuredClone(s)};
}
export function careSummary(s){const t=s.task;return {activity:t?(t.phase==='walking'?(t.kind==='wander'?'自己慢慢逛逛':'正在走过去'):({eat:'正在吃饭',treat:t.food==='bread'?'正在吃自己带回的小面包':'正在吃零食',play:'正在追玩具',sleep:'正在睡觉',waitFood:'在饭碗边等你们',invitePlay:'叼玩具来邀玩',invitePet:'主动来贴贴',askSnack:'来讨一小口零食',moveAway:'自己走开歇歇',pet:'正在蹭蹭',carryBag:'叼着带回家的小袋子',inspectBag:'正在闻刚拆开的小袋子',watch:'正在看窗外',wander:t.phase==='walking'?'自己慢慢逛逛':t.idleAction==='sniff'?'停下来闻闻':'歇歇，看看四周'})[t.kind]):'在家里悠悠闲闲',satiety:s.satiety<25?'肚子有点空':s.satiety<55?'有点饿':s.satiety>90?'吃得饱饱的':'肚子很舒服',energy:s.energy<25?'困困的':s.energy<55?'想歇一会儿':'很有精神',mood:s.mood<35?'有点闷闷的':s.mood>78?'心情很好':'心情平稳',traits:[s.traits.active>.65?'爱玩的小家伙':'也喜欢安静待着',s.traits.social>.6?'越来越爱贴贴':'慢慢熟悉你的手',s.traits.bold>.6?'好奇心很强':'先观察再靠近'],favoriteToy:s.toys.ball+s.toys.mouse?((s.toys.mouse>s.toys.ball?'小老鼠':'小球')):'还在发现喜欢的玩具',favoriteRest:s.rests.bed+s.rests.sofa+s.rests.box?(s.rests.box>Math.max(s.rests.bed,s.rests.sofa)?'自己的小纸箱':s.rests.sofa>s.rests.bed?'沙发边':'自己的窝'):'还在挑舒服的位置'};}
