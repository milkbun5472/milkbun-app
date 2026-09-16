import './rules.js?v=fg-d4d9c0decefffab4';
export const {START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,seasonOf,weather,normalizePlan,hitInteraction}=globalThis.FairyGardenRules;
export function walkable(x,z,map='garden'){if(!MAPS[map]||!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>MAPS[map].radius)return false;return !MAPS[map].obstacles.some(o=>o.r?Math.hypot(x-o.x,z-o.z)<o.r+.16:Math.abs(x-o.x)<o.w/2+.16&&Math.abs(z-o.z)<o.d/2+.16);}
const STEP=.24,N=43,half=(N-1)/2;
const point=(i,j)=>({x:(i-half)*STEP,z:(j-half)*STEP});
const avoidsPoint=(p,avoid)=>avoid.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>=o.r);
function nearest(p,map,avoid=[]){let best=null,d=Infinity;for(let i=0;i<N;i++)for(let j=0;j<N;j++){const q=point(i,j),dist=Math.hypot(p.x-q.x,p.z-q.z);if(dist<d&&walkable(q.x,q.z,map)&&avoidsPoint(q,avoid)&&segmentClear(p,q,map,avoid)){best={i,j,...q};d=dist;}}return best;}
export function segmentClear(a,b,map='garden',avoid=[]){const minimum=avoid.map(o=>Math.min(o.r,Math.hypot(a.x-o.x,a.z-o.z)));const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/.07));for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(!walkable(x,z,map)||avoid.some((o,j)=>Math.hypot(x-o.x,z-o.z)<minimum[j]-1e-6))return false;}return true;}
export function findPath(start,target,map='garden',avoid=[]){
 if(!walkable(start.x,start.z,map)||!walkable(target.x,target.z,map)||!avoidsPoint(target,avoid))return null;
 const s=nearest(start,map,avoid),t=nearest(target,map,avoid);if(!s||!t)return null;const key=(i,j)=>i*N+j;const sk=key(s.i,s.j),tk=key(t.i,t.j),open=[sk],g=new Map([[sk,0]]),prev=new Map(),done=new Set();
 while(open.length){open.sort((a,b)=>{const pa=point(Math.floor(a/N),a%N),pb=point(Math.floor(b/N),b%N);return g.get(a)+Math.hypot(pa.x-t.x,pa.z-t.z)-g.get(b)-Math.hypot(pb.x-t.x,pb.z-t.z);});const cur=open.shift();if(cur===tk){let k=cur,pts=[];while(k!==sk){pts.push(point(Math.floor(k/N),k%N));k=prev.get(k);}pts.push({x:s.x,z:s.z});pts.reverse();pts.push({...target});return pts;}
 done.add(cur);const i=Math.floor(cur/N),j=cur%N,p=point(i,j);for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=N||nj>=N)continue;const nk=key(ni,nj),q=point(ni,nj);if(done.has(nk)||!segmentClear(p,q,map,avoid))continue;const ng=g.get(cur)+Math.hypot(di,dj)*STEP;if(ng<(g.get(nk)??Infinity)){g.set(nk,ng);prev.set(nk,cur);if(!open.includes(nk))open.push(nk);}}}return null;
}
const count=(v,max=999999)=>Math.max(0,Math.min(max,Number.isFinite(Number(v))?Math.floor(Number(v)):0));
export const TEMPERAMENTS={gardener:'爱照料植物',explorer:'爱到处探索',scholar:'喜欢安静研究'};
export function freshCompanion(){return {name:'同行者',temperament:'gardener',mode:'routine',map:'garden',position:{x:-1.6,z:1.25},helpDay:0,destination:'home'};}
export function restoreCompanion(raw){const d=raw||{},c=freshCompanion(),map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {...c,name:typeof d.name==='string'?d.name.trim().slice(0,16)||c.name:c.name,temperament:Object.hasOwn(TEMPERAMENTS,d.temperament)?d.temperament:c.temperament,mode:['follow','wait','goto'].includes(d.mode)?d.mode:'routine',destination:['pond','garden','well','home'].includes(d.destination)?d.destination:'home',map,position:d.position&&walkable(d.position.x,d.position.z,map)?{x:d.position.x,z:d.position.z}:map==='garden'?c.position:{...MAPS.forest.spawn},helpDay:count(d.helpDay)};}
export function freshState(){return {version:4,epoch:'initial',magic:freshMagic(),today:{},journal:[],map:'garden',day:1,minute:480,water:0,blooms:0,herbs:0,mushrooms:0,potions:0,harvest:0,picked:[],position:{...START},companion:freshCompanion()};}
export function restoreState(raw){const d=raw&&[1,2,3,4].includes(raw.version)?raw:freshState(),map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {version:4,epoch:typeof d.epoch==='string'?d.epoch.slice(0,80):'initial',magic:restoreMagic(d.magic),today:restoreToday(d.today),journal:restoreJournal(d.journal),map,day:Math.max(1,count(d.day)),minute:d.version>=3?Math.max(420,count(d.minute,1379)):480,water:count(d.water,3),blooms:count(d.blooms,3),herbs:count(d.herbs),mushrooms:count(d.mushrooms),potions:count(d.potions),harvest:count(d.harvest),picked:[...new Set(Array.isArray(d.picked)?d.picked.filter(id=>NODES.some(n=>n.id===id)):[])],position:d.position&&walkable(d.position.x,d.position.z,map)?{x:d.position.x,z:d.position.z}:{...MAPS[map].spawn},companion:restoreCompanion(d.companion)};}
export function nextDay(s){const day=s.day+1;return {...s,day,minute:420,picked:[],today:{},journal:[...(s.journal||[]),{day:s.day,weather:weather(s.day),actions:s.today||{},partner:s.companion.name}].slice(-120),blooms:weather(day)==='细雨'?Math.min(3,s.blooms+1):s.blooms};}
export function advanceTime(s,minutes){let remaining=count(minutes,9600),out=s;while(remaining>0){const span=1380-out.minute;if(remaining<span)return {...out,minute:out.minute+remaining};remaining-=span;out=nextDay(out);}return out;}
export const timeLabel=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
// A companion carries its own morning dew: one visible helping action per game day.
export function companionCare(s){const c=s.companion,p=MAPS.garden.stations.garden;if(c.map!=='garden'||c.helpDay===s.day||s.blooms>=3||Math.hypot(c.position.x-p.x,c.position.z-p.z)>.5)return s;return {...s,blooms:s.blooms+1,companion:{...c,helpDay:s.day}};}
export function targetFor(state,kind,id){if(kind==='gather'){const n=NODES.find(n=>n.id===id);return n?{x:n.x,z:n.z+.48}:null;}return MAPS[state.map]?.stations[kind]||null;}
export function actionError(s,kind,id){
 if(['seed','star','lamp'].includes(kind))return magicError(s,kind);
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);if(!n||s.map!==n.map)return '这里没有这种材料。';if(s.picked.includes(id))return '这一丛今天采过了，明天会重新长出来。';return '';}
 if(kind==='travel')return MAPS[s.map]?.exits.travel?'':'这里没有通往别处的小路。';
 if(s.map!=='garden')return '先回庭院吧。';
 if(kind==='brew'){if(s.herbs<2||s.mushrooms<1||s.water<1)return '月露配方：铃叶草 ×2、荧光菇 ×1、清水 ×1。';}
 else if(kind==='garden'){if(s.blooms<3&&!s.potions&&!s.water)return '水壶空了，先去井边取水；也可以用月露唤醒整圃花。';}
 else if(!['well','rest'].includes(kind))return '这里还不能这样做。';return '';
}
export const gardenIntent=s=>s.blooms===3?'harvest':s.potions?'potion':'water';
function performAction(s,kind,id,intent=gardenIntent(s)){
 if(actionError(s,kind,id))return s;const p=targetFor(s,kind,id);if(!p||Math.hypot(s.position.x-p.x,s.position.z-p.z)>.65)return s;
 if(['seed','star','lamp'].includes(kind))return performMagic(s,kind);
 if(kind==='well')return {...s,water:3};
 if(kind==='garden'){if(intent==='harvest'&&s.blooms===3)return {...s,blooms:0,harvest:s.harvest+3};if(s.blooms>=3)return s;if(intent==='potion'&&s.potions>0)return {...s,blooms:3,potions:s.potions-1};if(intent==='water'&&s.water>0)return {...s,water:s.water-1,blooms:s.blooms+1};return s;}
 if(kind==='brew')return {...s,herbs:s.herbs-2,mushrooms:s.mushrooms-1,water:s.water-1,potions:s.potions+1};
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);return {...s,[n.kind==='herb'?'herbs':'mushrooms']:s[n.kind==='herb'?'herbs':'mushrooms']+(n.kind==='herb'?2:1),picked:[...s.picked,id]};}
 if(kind==='travel'){const map=MAPS[s.map].exits.travel.to;return {...s,map,position:{...MAPS[map].spawn}};}
 if(kind==='rest')return nextDay(s);return s;
}

export const COMPANION_DESTINATIONS={pond:{map:'forest',target:{x:-.7,z:.6},label:'去池边坐一会儿'},garden:{map:'garden',target:MAPS.garden.stations.garden,label:'去看看月光花'},well:{map:'garden',target:MAPS.garden.stations.well,label:'去井边'},home:{map:'garden',target:MAPS.garden.stations.rest,label:'回屋前等你'}};

export function freshMagic(){return {seeds:0,seedSeason:-1,planted:false,growth:0,wateredDay:0,flowers:0,discovered:false,lamps:0};}
export function restoreMagic(d){const m=d||{};return {seeds:count(m.seeds),seedSeason:Number.isInteger(m.seedSeason)&&m.seedSeason>=0?m.seedSeason:-1,planted:m.planted===true,growth:count(m.growth,2),wateredDay:count(m.wateredDay),flowers:count(m.flowers),discovered:m.discovered===true,lamps:count(m.lamps,4)};}
const ACTION_NAMES={well:'取水',garden:'照料或采收月光花',brew:'炼月露',gather:'采集',seed:'一起唤醒种子',star:'照料或采收星铃花',lamp:'制作星铃灯',travel:'穿过小路'};
function restoreToday(d){return Object.fromEntries(Object.keys(ACTION_NAMES).filter(k=>d&&count(d[k])>0).map(k=>[k,count(d[k],999)]));}
function restoreJournal(d){return (Array.isArray(d)?d:[]).slice(-120).filter(x=>Number.isInteger(x?.day)&&x.day>0).map(x=>({day:x.day,weather:weather(x.day),partner:String(x.partner||'同行者').slice(0,16),actions:restoreToday(x.actions)}));}
export function journalText(entry){const facts=Object.entries(entry.actions||{}).map(([k,v])=>`${ACTION_NAMES[k]} ${v} 次`);return `${entry.weather}，与${entry.partner}同住。${facts.length?facts.join('，')+'。':'这天没有留下采集或制作记录。'}`;}
export function companionNearby(s){return s.companion.map===s.map&&Math.hypot(s.companion.position.x-s.position.x,s.companion.position.z-s.position.z)<1.55;}
export function magicError(s,kind){const m=s.magic||freshMagic();if(kind==='seed'){if(s.map!=='forest')return '去林地寻找沉睡的种子。';if(m.seedSeason===seasonOf(s.day).index)return '这一季的种子已经带回家了，下一季会有新的微光。';return '';}
 if(s.map!=='garden')return '先把森林的礼物带回庭院。';
 if(kind==='lamp')return m.lamps>=4?'屋前四个灯位已经亮起来了。':m.flowers<1||s.harvest<3?'星铃灯需要星铃花 ×1、月光花 ×3。':'';
 if(!m.planted)return m.seeds?'':'先和同行者去林地唤醒一颗种子。';
 if(m.growth>=2)return '';
 if(m.wateredDay===s.day)return '今天照料过了，明天再来看看新芽。';return s.water>0?'':'先取一壶清水来照料它。';}
function performMagic(s,kind){const m=s.magic||freshMagic();if(kind==='seed'){if(!companionNearby(s))return s;return {...s,magic:{...m,seeds:m.seeds+1,seedSeason:seasonOf(s.day).index}};}
 if(kind==='lamp')return {...s,harvest:s.harvest-3,magic:{...m,flowers:m.flowers-1,lamps:m.lamps+1}};
 if(!m.planted)return {...s,magic:{...m,seeds:m.seeds-1,planted:true,growth:0,wateredDay:0}};
 if(m.growth>=2)return {...s,magic:{...m,planted:false,growth:0,flowers:m.flowers+1,discovered:true}};
 return {...s,water:s.water-1,magic:{...m,growth:m.growth+1,wateredDay:s.day}};
}
export function perform(s,kind,id,intent=gardenIntent(s)){const out=performAction(s,kind,id,intent);if(out===s||kind==='rest')return out;return {...out,today:{...(out.today||{}),[kind]:((out.today||{})[kind]||0)+1}};}

// Find the first physical exit on a route; companions never jump across disconnected maps.
export function exitToward(from,to){const queue=[{map:from,first:null}],seen=new Set([from]);while(queue.length){const step=queue.shift();if(step.map===to)return step.first;for(const [id,exit]of Object.entries(MAPS[step.map]?.exits||{})){if(seen.has(exit.to)||!MAPS[exit.to])continue;seen.add(exit.to);queue.push({map:exit.to,first:step.first||{id,to:exit.to,target:MAPS[from].stations[id]}});}}return null;}
