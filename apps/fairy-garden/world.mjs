import './rules.js?v=fg-ee48044f053e2f07';
export const {START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,DEPTH_MAX,DEPTH_BASE,depthNodes,seasonOf,weather,normalizePlan,hitInteraction}=globalThis.FairyGardenRules;
import {createNavigator} from './navigation.mjs?v=fg-ee48044f053e2f07';
export function walkable(x,z,map='garden'){if(!MAPS[map]||!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>MAPS[map].radius)return false;return !MAPS[map].obstacles.some(o=>{if(o.except&&Math.abs(x-o.except.x)<o.except.w/2&&Math.abs(z-o.except.z)<o.except.d/2)return false;return o.rx?((x-o.x)/(o.rx+.16))**2+((z-o.z)/(o.rz+.16))**2<1:o.r?Math.hypot(x-o.x,z-o.z)<o.r+.16:Math.abs(x-o.x)<o.w/2+.16&&Math.abs(z-o.z)<o.d/2+.16;});}
export function segmentClear(a,b,map='garden',avoid=[]){const minimum=avoid.map(o=>Math.min(o.r,Math.hypot(a.x-o.x,a.z-o.z)));const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/.07));for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(!walkable(x,z,map)||avoid.some((o,j)=>Math.hypot(x-o.x,z-o.z)<minimum[j]-1e-6))return false;}return true;}
export const floorHeight=(map,p)=>MAPS[map]?.surfaces?.find(s=>Math.abs(p.x-s.x)<s.w/2&&Math.abs(p.z-s.z)<s.d/2)?.height??.08;
export const findPath=createNavigator(MAPS,walkable,segmentClear);
const count=(v,max=999999)=>Math.max(0,Math.min(max,Number.isFinite(Number(v))?Math.floor(Number(v)):0));
export const TEMPERAMENTS={gardener:'爱照料植物',explorer:'爱到处探索',scholar:'喜欢安静研究'};
// ── 样貌（发型/发色/衣色/体型）─────────────────────────────────────────
// ⚠️restoreState 和 restoreCompanion 都是【白名单式建对象】：不在这儿写一笔，
//   存档里那一份就会被静默丢掉——她 2026-09-16 报的「样貌退出不保存」正是这个。
//   （同一个坑 js/app.js 的 addMemEntry 注释里也记着一次。）
// 发型名单和六个参数的范围不在这儿重写（那是 doll.json 的事）：这里只做
// 「长得像不像一份样貌」的体检，认不出的键交给 traveler.mjs 自己忽略。
export function restoreLook(raw){
 const d=raw&&typeof raw==='object'?raw:{},out={};
 if(typeof d.hair==='string'&&/^[a-z]{2,16}$/.test(d.hair))out.hair=d.hair;
 for(const k of ['hairColor','cloth'])if(typeof d[k]==='string'&&/^#[0-9a-fA-F]{6}$/.test(d[k]))out[k]=d[k];
 if(d.dims&&typeof d.dims==='object'){const dims={};
  for(const [k,v]of Object.entries(d.dims)){const n=Number(v);
   if(/^[a-z]{2,16}$/.test(k)&&Number.isFinite(n))dims[k]=Math.max(0,Math.min(2,n));}
  if(Object.keys(dims).length)out.dims=dims;}
 return out;
}
export function freshCompanion(){return {name:'同行者',temperament:'gardener',mode:'routine',map:'garden',position:{x:-3.5,z:4.3},helpDay:0,destination:'home',look:{}};}
export function restoreCompanion(raw){const d=raw||{},c=freshCompanion(),map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {...c,name:typeof d.name==='string'?d.name.trim().slice(0,16)||c.name:c.name,temperament:Object.hasOwn(TEMPERAMENTS,d.temperament)?d.temperament:c.temperament,mode:['follow','wait','goto'].includes(d.mode)?d.mode:'routine',destination:['pond','garden','well','home'].includes(d.destination)?d.destination:'home',map,position:d.position&&walkable(d.position.x,d.position.z,map)?{x:d.position.x,z:d.position.z}:map==='garden'?c.position:{...MAPS.forest.spawn},helpDay:count(d.helpDay),look:restoreLook(d.look)};}
// ── 星井（下潜）────────────────────────────────────────────────────────
// depth   现在在第几层（0＝在地面上）
// sand    星砂：三份能在炼药锅换一颗月露
// stones  月石：每得一颗，往下的路再通两层（这就是下潜的进度）
export const deepestAllowed=s=>Math.min(DEPTH_MAX,DEPTH_BASE+count(s&&s.stones)*2);
export function freshState(){return {version:6,epoch:'initial',look:{},magic:freshMagic(),today:{},journal:[],map:'garden',day:1,minute:480,water:0,blooms:0,herbs:0,mushrooms:0,potions:0,harvest:0,sand:0,stones:0,depth:0,picked:[],position:{...START},companion:freshCompanion()};}
export function restoreState(raw){const prior=raw&&[1,2,3,4,5,6].includes(raw.version)?raw:freshState(),d=prior.version<5?{...prior,position:prior.map==='forest'?prior.position:{...START},companion:prior.companion?.map==='forest'?prior.companion:{...prior.companion,position:freshCompanion().position}}:prior,map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {version:6,epoch:typeof d.epoch==='string'?d.epoch.slice(0,80):'initial',magic:restoreMagic(d.magic),today:restoreToday(d.today),journal:restoreJournal(d.journal),map,day:Math.max(1,count(d.day)),minute:d.version>=3?Math.max(420,count(d.minute,1379)):480,water:count(d.water,3),blooms:count(d.blooms,3),herbs:count(d.herbs),mushrooms:count(d.mushrooms),potions:count(d.potions),harvest:count(d.harvest),sand:count(d.sand),stones:count(d.stones),
 // 旧存档没有 depth；人从井里出来才算数，所以不在井底就一律 0
 depth:map==='depths'?Math.max(1,Math.min(DEPTH_MAX,count(d.depth))):0,picked:[...new Set(Array.isArray(d.picked)?d.picked.filter(id=>NODES.some(n=>n.id===id)):[])],position:d.position&&walkable(d.position.x,d.position.z,map)?{x:d.position.x,z:d.position.z}:{...MAPS[map].spawn},companion:restoreCompanion(d.companion),look:restoreLook(d.look)};}
export function nextDay(s){const day=s.day+1;return {...s,day,minute:420,picked:[],today:{},journal:[...(s.journal||[]),{day:s.day,weather:weather(s.day),actions:s.today||{},partner:s.companion.name}].slice(-120),blooms:weather(day)==='细雨'?Math.min(3,s.blooms+1):s.blooms};}
export function advanceTime(s,minutes){let remaining=count(minutes,9600),out=s;while(remaining>0){const span=1380-out.minute;if(remaining<span)return {...out,minute:out.minute+remaining};remaining-=span;out=nextDay(out);}return out;}
export const timeLabel=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
// A companion carries its own morning dew: one visible helping action per game day.
export function companionCare(s){const c=s.companion,p=MAPS.garden.stations.garden;if(c.map!=='garden'||c.helpDay===s.day||s.blooms>=3||Math.hypot(c.position.x-p.x,c.position.z-p.z)>.5)return s;return {...s,blooms:s.blooms+1,companion:{...c,helpDay:s.day}};}
export function targetFor(state,kind,id){if(kind==='visit')return MAPS[state.map]?.sites?.[id]?.target||null;if(kind==='gather'){const n=NODES.find(n=>n.id===id);return n?{x:n.x,z:n.z+.48}:null;}return MAPS[state.map]?.stations[kind]||null;}
export function actionError(s,kind,id){if(kind==='visit')return MAPS[s.map]?.sites?.[id]?'':'这里还没有开放这处地方。';
 if(['seed','star','lamp'].includes(kind))return magicError(s,kind);
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);if(!n||s.map!==n.map||(n.depth!=null&&n.depth!==s.depth))return '这里没有这种材料。';
  if(s.picked.includes(id))return n.map==='depths'?'这一处的矿脉已经采空了。':'这一丛今天采过了，明天会重新长出来。';return '';}
 if(kind==='travel')return MAPS[s.map]?.exits.travel?'':'这里没有通往别处的小路。';
 // 下潜三件事：从井口下去、再往下一层、顺着梯子上来
 if(kind==='dive')return s.map!=='garden'?'先回庭院，井在屋边。':s.minute>1140?'天太晚了，井底看不见路，明天再来。':'';
 if(kind==='ladder')return s.map==='depths'?'':'你不在井里。';
 if(kind==='deeper'){if(s.map!=='depths')return '先下到井里。';
  if(s.depth>=deepestAllowed(s))return s.stones?'再往下是塌掉的岩层。带回一颗月石，路会再通两层。':'再往下就看不见路了。先在这几层找到一颗月石。';
  return '';}
 if(s.map!=='garden')return '先回庭院吧。';
 if(kind==='brew'){if(s.sand<3&&(s.herbs<2||s.mushrooms<1||s.water<1))return '月露配方：铃叶草 ×2、荧光菇 ×1、清水 ×1；或者星砂 ×3。';}
 else if(kind==='garden'){if(s.blooms<3&&!s.potions&&!s.water)return '水壶空了，先去井边取水；也可以用月露唤醒整圃花。';}
 else if(!['well','rest'].includes(kind))return '这里还不能这样做。';return '';
}
export const gardenIntent=s=>s.blooms===3?'harvest':s.potions?'potion':'water';
function performAction(s,kind,id,intent=gardenIntent(s)){
 if(actionError(s,kind,id))return s;const p=targetFor(s,kind,id);if(!p||Math.hypot(s.position.x-p.x,s.position.z-p.z)>.65)return s;
 if(['seed','star','lamp'].includes(kind))return performMagic(s,kind);
 if(kind==='visit')return {...s};
 if(kind==='well')return {...s,water:3};
 if(kind==='garden'){if(intent==='harvest'&&s.blooms===3)return {...s,blooms:0,harvest:s.harvest+3};if(s.blooms>=3)return s;if(intent==='potion'&&s.potions>0)return {...s,blooms:3,potions:s.potions-1};if(intent==='water'&&s.water>0)return {...s,water:s.water-1,blooms:s.blooms+1};return s;}
 // 有星砂先用星砂：那是她特地下井换来的，别让它压在背包里
 if(kind==='brew')return s.sand>=3?{...s,sand:s.sand-3,potions:s.potions+1}
  :{...s,herbs:s.herbs-2,mushrooms:s.mushrooms-1,water:s.water-1,potions:s.potions+1};
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);
  // 井底那两样：星砂常见、月石稀罕；越深一次刨出来的越多
  if(n.map==='depths'){const deep=Math.max(1,s.depth);
   return n.kind==='stone'?{...s,stones:s.stones+1,picked:[...s.picked,id]}
    :{...s,sand:s.sand+1+Math.floor(deep/3),picked:[...s.picked,id]};}
  return {...s,[n.kind==='herb'?'herbs':'mushrooms']:s[n.kind==='herb'?'herbs':'mushrooms']+(n.kind==='herb'?2:1),picked:[...s.picked,id]};}
 // 出口把人放在下一张图上【说好的落点】：默认是那张图的 spawn，
 // 爬梯子上来则是井口（exits.ladder.at）——落点写在出口那一处，不在这儿分支。
 if(kind==='travel'){const e=MAPS[s.map].exits.travel;return {...s,map:e.to,position:{...(e.at||MAPS[e.to].spawn)}};}
 // 下去一趟要花时间：第一层 45 分钟，再往下每层 35 分钟，爬上来 20 分钟。
 // ⚠️时间一律走 advanceTime——它自己会跨天，别在这儿另算一遍日期。
 if(kind==='dive')return advanceTime({...s,map:'depths',depth:1,position:{...MAPS.depths.spawn}},45);
 if(kind==='deeper')return advanceTime({...s,depth:s.depth+1,position:{...MAPS.depths.spawn}},35);
 if(kind==='ladder'){const e=MAPS.depths.exits.ladder;return advanceTime({...s,map:e.to,depth:0,position:{...(e.at||MAPS[e.to].spawn)}},20);}
 if(kind==='rest')return nextDay(s);return s;
}

export const COMPANION_DESTINATIONS={pond:{map:'forest',target:{x:-.7,z:.6},label:'去池边坐一会儿'},garden:{map:'garden',target:MAPS.garden.stations.garden,label:'去看看月光花'},well:{map:'garden',target:MAPS.garden.stations.well,label:'去井边'},home:{map:'garden',target:MAPS.garden.stations.rest,label:'回屋前等你'}};

export function freshMagic(){return {seeds:0,seedSeason:-1,planted:false,growth:0,wateredDay:0,flowers:0,discovered:false,lamps:0};}
export function restoreMagic(d){const m=d||{};return {seeds:count(m.seeds),seedSeason:Number.isInteger(m.seedSeason)&&m.seedSeason>=0?m.seedSeason:-1,planted:m.planted===true,growth:count(m.growth,2),wateredDay:count(m.wateredDay),flowers:count(m.flowers),discovered:m.discovered===true,lamps:count(m.lamps,4)};}
const ACTION_NAMES={visit:'散步到访',well:'取水',garden:'照料或采收月光花',brew:'炼月露',gather:'采集',seed:'一起唤醒种子',star:'照料或采收星铃花',lamp:'制作星铃灯',travel:'穿过小路',dive:'下到井里',deeper:'再往下一层',ladder:'从井里上来'};
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
