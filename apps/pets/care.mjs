const clamp=(v,a=0,b=100,f=65)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):f;
const kinds=['eat','treat','play','sleep','pet','watch'];
const actorKey=v=>typeof v==='string'?v.slice(0,80):'';
const actorName=v=>typeof v==='string'?v.slice(0,24):'';
const bond=r=>({play:clamp(r?.play,0,1e6,0),pet:clamp(r?.pet,0,1e6,0),food:clamp(r?.food,0,1e6,0),refused:clamp(r?.refused,0,1e6,0)});
const lengths={eat:18,treat:6,play:16,sleep:45,pet:5,watch:12};
export function restoreCare(raw){
 const r=raw&&typeof raw==='object'?raw:{};
 const traits=r.traits||{},task=r.task;
 return {version:2,relationships:Object.fromEntries(Object.entries(r.relationships||{}).filter(([k])=>k==='you'||k.startsWith('companion:')).slice(0,40).map(([k,v])=>[k.slice(0,90),bond(v)])),helper:r.helper&&['feed','play','pet'].includes(r.helper.action)&&actorKey(r.helper.id)?{action:r.helper.action,id:actorKey(r.helper.id),name:actorName(r.helper.name),phase:r.helper.phase==='doing'?'doing':'walking',time:clamp(r.helper.time,0,60,0),started:!!r.helper.started,position:r.helper.position&&Number.isFinite(r.helper.position.x)&&Number.isFinite(r.helper.position.z)?{x:r.helper.position.x,z:r.helper.position.z}:null}:null,satiety:clamp(r.satiety),energy:clamp(r.energy,0,100,75),mood:clamp(r.mood,0,100,70),bowl:clamp(r.bowl,0,100,0),elapsed:clamp(r.elapsed,0,1e9,0),idle:0,cooldown:clamp(r.cooldown,0,60,0),rng:clamp(r.rng,1,4294967295,246813579),traits:{active:clamp(traits.active,0,1,.6),social:clamp(traits.social,0,1,.55),bold:clamp(traits.bold,0,1,.45)},toys:{ball:clamp(r.toys?.ball,0,1e6,0),mouse:clamp(r.toys?.mouse,0,1e6,0)},rests:{bed:clamp(r.rests?.bed,0,1e6,0),sofa:clamp(r.rests?.sofa,0,1e6,0)},task:task&&kinds.includes(task.kind)?{kind:task.kind,phase:task.phase==='doing'?'doing':'walking',time:clamp(task.time,0,lengths[task.kind],0),place:['bed','sofa','feeding','rug','window'].includes(task.place)?task.place:'rug',toy:task.toy==='mouse'?'mouse':'ball',source:['self','companion'].includes(task.source)?task.source:'you',actor:actorKey(task.actor),name:actorName(task.name)}:null,position:r.position&&Number.isFinite(r.position.x)&&Number.isFinite(r.position.z)?{x:r.position.x,z:r.position.z}:null,recent:Array.isArray(r.recent)?r.recent.filter(x=>typeof x?.text==='string').slice(-8).map(x=>({text:x.text.slice(0,120),at:clamp(x.at,0,1e9,0)})):[]};
}
export function createPetCare(raw){
 const s=restoreCare(raw);
 const record=text=>{s.recent.push({text,at:s.elapsed});s.recent=s.recent.slice(-8);};
 const random=()=>{s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;};
 function start(kind,place,toy='ball',source='you',actor='',name=''){s.task={kind,phase:'walking',time:0,place,toy,source,actor,name};s.idle=0;return {accepted:true,text:kind==='eat'?'闻到饭香，往碗边去了。':kind==='treat'?'走过来，想尝一小口。':kind==='play'?'盯上了玩具，准备追过去。':kind==='sleep'?'找个舒服的地方歇歇。':kind==='pet'?'靠过来，等你摸摸。':'自己去窗边看看。'};}
 function request(action,{toy='ball',source='you',actor='',name=''}={}){
  const who=source==='companion'?(actorName(name)||'TA'):'你';const rel=()=>{const k=source==='companion'?'companion:'+actorKey(actor):'you';return s.relationships[k]||(s.relationships[k]=bond());};
  const refuse=text=>{if(source!=='self'){rel().refused++;record(who+'想陪它'+(action==='play'?'玩':action==='pet'?'贴贴':'吃东西')+'：'+text);}return {accepted:false,text};};
  if(s.task?.kind==='sleep'&&s.task.phase==='doing'&&action!=='wake')return refuse('正睡得香，先让它休息吧。');
  if(action==='wake'){if(s.task?.kind!=='sleep')return {accepted:false,text:'它已经醒着啦。'};s.task=null;s.idle=0;record('被轻轻叫醒，伸了个懒腰。');return {accepted:true,text:'慢慢醒过来了。'};}
  if(s.task?.source==='self'&&s.task.kind==='watch')s.task=null;
  if(s.task)return {accepted:false,text:'它正在忙这件事，等一小会儿。'};
  if(action==='feed'){if(s.bowl>25)return {accepted:false,text:'碗里还有粮，先吃完这一份。'};s.bowl=100;record(who+'给饭碗添了一份粮。');rel().food++;if(s.satiety>85)return {accepted:true,text:'闻了闻饭碗，现在还不饿。'};return start('eat','feeding','ball',source,actor,name);}
  if(action==='snack'){if(s.satiety>90)return {accepted:false,text:'已经吃饱啦，这一口留到下次。'};return start('treat','rug','ball',source,actor,name);}
  if(action==='eat'){if(!s.bowl||s.satiety>90)return {accepted:false,text:'现在不想吃。'};return start('eat','feeding','ball',source);}
  if(action==='play'){if(s.energy<22)return refuse('有点累，趴着看你晃玩具。');if(s.satiety<15)return refuse('肚子空空，先往饭碗那边看。');if(source!=='self'&&random()>.65+s.traits.active*.25+s.mood*.0015+Math.min(.1,rel().play*.015)){record('今天这次没想玩，转头看了窗外。');return refuse('看了一眼玩具，今天这会儿没兴趣。');}return start('play','rug',toy,source,actor,name);}
  if(action==='rest')return start('sleep',random()<clamp(.7+(s.rests.bed-s.rests.sofa)*.04,.2,.9,.7)?'bed':'sofa','ball',source);
  if(action==='pet'){if(s.cooldown>0){record('摸得有点久，它轻轻挪开了。');return refuse('刚刚摸过啦，它躲开了，想自己待会儿。');}return start('pet','rug','ball',source,actor,name);}
  if(action==='watch')return start('watch','window','ball',source);
  return {accepted:false,text:'它歪头看了看你。'};
 }
 function finish(){const t=s.task;if(!t)return;const who=t.source==='companion'?(t.name||'TA'):'你';if(t.source!=='self'&&['play','pet'].includes(t.kind)){const key=t.source==='companion'?'companion:'+t.actor:'you';const r=s.relationships[key]||(s.relationships[key]=bond());r[t.kind]++;}
  if(t.kind==='play'){s.toys[t.toy]++;s.traits.active=clamp(s.traits.active+.004,0,1);record((t.source==='companion'?who+'陪它':'')+'追着'+(t.toy==='ball'?'小球':'小老鼠')+'玩了一会儿，心情变好了。');}
  if(t.kind==='treat')record('你给了一小口零食，它慢慢嚼完了。');
  if(t.kind==='eat')record('吃了一会儿粮，舔了舔嘴巴。');
  if(t.kind==='sleep'){s.rests[t.place]++;record('在'+(t.place==='sofa'?'沙发边':'自己的窝里')+'睡了一觉，精神好多了。');}
  if(t.kind==='watch')s.traits.bold=clamp(s.traits.bold+.002,0,1);
  if(t.kind==='pet'){s.traits.social=clamp(s.traits.social+.006,0,1);s.cooldown=20;record('让'+who+'摸了摸，贴着'+who+'的手蹭了蹭。');}
  s.task=null;s.idle=0;
 }
 function tick(dt,{home=false,paused=false}={}){
  if(paused||!Number.isFinite(dt)||dt<=0)return null;dt=Math.min(dt,1);s.elapsed+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.satiety=clamp(s.satiety-dt*.025);s.energy=clamp(s.energy-dt*.012);s.mood=clamp(s.mood-dt*(s.satiety<15?.09:.002));
  const t=s.task;
  if(t?.phase==='doing'&&home){t.time+=dt;
   if(t.kind==='eat'){const n=Math.min(s.bowl,dt*4);s.bowl-=n;s.satiety=clamp(s.satiety+n*.65);s.mood=clamp(s.mood+dt*.2);}
   if(t.kind==='treat'){s.satiety=clamp(s.satiety+dt*.9);s.mood=clamp(s.mood+dt*.45);}
   if(t.kind==='play'){s.energy=clamp(s.energy-dt*.8);s.mood=clamp(s.mood+dt*1.1);}
   if(t.kind==='sleep'){s.energy=clamp(s.energy+dt*.75);s.mood=clamp(s.mood+dt*.08);}
   if(t.kind==='pet')s.mood=clamp(s.mood+dt*1.1);
   if(t.time>=lengths[t.kind]||t.kind==='eat'&&(s.bowl<=0||s.satiety>=98)||t.kind==='sleep'&&s.energy>=96)finish();
  }
  if(!s.task&&home){s.idle+=dt;if(s.idle>=12){s.idle=0;if(s.satiety<72&&s.bowl>0)return request('eat',{source:'self'});if(s.energy<48)return request('rest',{source:'self'});if(random()<s.traits.active*.45&&s.energy>40)return request('play',{toy:s.toys.mouse>s.toys.ball?'mouse':'ball',source:'self'});return request('watch',{source:'self'});}}
  return null;
 }
 return {state:s,request,tick,arrive:()=>{if(s.task)s.task.phase='doing';},cancel:()=>{s.task=null;s.idle=0;},record,snapshot:()=>structuredClone(s)};
}
export function careSummary(s){const t=s.task;return {activity:t?(t.phase==='walking'?'正在走过去':({eat:'正在吃饭',treat:'正在吃零食',play:'正在追玩具',sleep:'正在睡觉',pet:'正在蹭蹭',watch:'正在看窗外'})[t.kind]):'在家里悠悠闲闲',satiety:s.satiety<25?'肚子有点空':s.satiety<55?'有点饿':s.satiety>90?'吃得饱饱的':'肚子很舒服',energy:s.energy<25?'困困的':s.energy<55?'想歇一会儿':'很有精神',mood:s.mood<35?'有点闷闷的':s.mood>78?'心情很好':'心情平稳',traits:[s.traits.active>.65?'爱玩的小家伙':'也喜欢安静待着',s.traits.social>.6?'越来越爱贴贴':'慢慢熟悉你的手',s.traits.bold>.6?'好奇心很强':'先观察再靠近'],favoriteToy:s.toys.ball+s.toys.mouse?((s.toys.mouse>s.toys.ball?'小老鼠':'小球')):'还在发现喜欢的玩具',favoriteRest:s.rests.bed+s.rests.sofa?(s.rests.sofa>s.rests.bed?'沙发边':'自己的窝'):'还在挑舒服的位置'};}
