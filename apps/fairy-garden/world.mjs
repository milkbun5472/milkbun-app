import './rules.js?v=fg-7b571cbd113377b9';
export const {START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,DEPTH_MAX,DEPTH_BASE,depthNodes,seasonOf,weather,normalizePlan,hitInteraction}=globalThis.FairyGardenRules;
import {createNavigator} from './navigation.mjs?v=fg-7b571cbd113377b9';
export function walkable(x,z,map='garden'){if(!MAPS[map]||!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>MAPS[map].radius)return false;const bounds=MAPS[map].bounds;if(bounds&&(Math.abs(x)>bounds.w/2||Math.abs(z)>bounds.d/2))return false;return !MAPS[map].obstacles.some(o=>{if(o.except&&Math.abs(x-o.except.x)<o.except.w/2&&Math.abs(z-o.except.z)<o.except.d/2)return false;return o.rx?((x-o.x)/(o.rx+.16))**2+((z-o.z)/(o.rz+.16))**2<1:o.r?Math.hypot(x-o.x,z-o.z)<o.r+.16:Math.abs(x-o.x)<o.w/2+.16&&Math.abs(z-o.z)<o.d/2+.16;});}
export function segmentClear(a,b,map='garden',avoid=[]){const minimum=avoid.map(o=>Math.min(o.r,Math.hypot(a.x-o.x,a.z-o.z)));const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/.07));for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(!walkable(x,z,map)||avoid.some((o,j)=>Math.hypot(x-o.x,z-o.z)<minimum[j]-1e-6))return false;}return true;}
export function floorHeight(map,p){const m=MAPS[map],base=m?.floor??.08;for(const s of m?.surfaces||[]){if(s.kind==='hill'){const r2=((p.x-s.x)/s.rx)**2+((p.z-s.z)/s.rz)**2;if(r2<1)return base+s.height*(1-r2)**2;}else if(Math.abs(p.x-s.x)<s.w/2&&Math.abs(p.z-s.z)<s.d/2)return s.height;}return base;}
// Picking uses the same ground heights as walking, including raised decks and slopes.
export function groundPoint(map,origin,direction){
 if(direction.y>=-1e-6)return null;const base=MAPS[map]?.floor??.08,top=Math.max(base,...(MAPS[map]?.surfaces||[]).map(s=>s.kind==='hill'?base+s.height:s.height))+.01;
 const point=t=>({x:origin.x+direction.x*t,y:origin.y+direction.y*t,z:origin.z+direction.z*t});
 const start=Math.max(0,(top-origin.y)/direction.y),end=(base-origin.y)/direction.y;if(end<start)return null;
 let previous=start;for(let i=1;i<=48;i++){const t=start+(end-start)*i/48,p=point(t);if(p.y<=floorHeight(map,p)+1e-8){let lo=previous,hi=t;for(let n=0;n<15;n++){const mid=(lo+hi)/2,q=point(mid);if(q.y>floorHeight(map,q))lo=mid;else hi=mid;}return point(hi);}previous=t;}return point(end);
}
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
export function restoreCompanion(raw){const d=raw||{},c=freshCompanion(),map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {...c,name:typeof d.name==='string'?d.name.trim().slice(0,16)||c.name:c.name,temperament:Object.hasOwn(TEMPERAMENTS,d.temperament)?d.temperament:c.temperament,mode:['follow','wait','goto'].includes(d.mode)?d.mode:'routine',destination:['pond','garden','well','home'].includes(d.destination)?d.destination:'home',map,position:d.position&&walkable(d.position.x,d.position.z,map)?{x:d.position.x,z:d.position.z}:map==='garden'?c.position:{...MAPS[map].spawn},helpDay:count(d.helpDay),look:restoreLook(d.look)};}
// ── 花田：种下一句话，过几天收一张花笺（她 2026-09-16 定的方向）─────────
// 种的不是花，是【一句你想问的话】；开花收上来的是他给的一句回应，进花册。
// ⚠️花册不设「收集完成」：同一个念头隔一阵再种，答案本来就该不一样。
// ⚠️生成那一枪在【宿主】那一侧打（callAI 在父页），这里只管地里的状态。
export const SEED_KINDS = {
  miss: '想你', curious: '好奇', sulk: '委屈', secret: '秘密',
  today: '今天', later: '以后', what_if: '如果', unsaid: '没说出口'
};
export const SEED_DAYS = 3;          // 种下三天开花
export const SEED_PLOTS = 6;         // 地里最多同时种这么多
export const SEED_PER_DAY = 2;       // 一天最多种两株：这一层是【钱闸】，别拆
export const NOTE_CAP = 300;
const trimText = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
export function restoreSeeds(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && Object.hasOwn(SEED_KINDS, x.kind)).slice(-SEED_PLOTS * 4).map(x => ({
    id: String(x.id).slice(0, 40), kind: x.kind, ask: trimText(x.ask, 120),
    day: Math.max(1, count(x.day)), done: x.done === true
  }));
}
export function restoreNotes(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.reply).slice(-NOTE_CAP).map(x => ({
    id: String(x.id).slice(0, 40), kind: Object.hasOwn(SEED_KINDS, x.kind) ? x.kind : 'today',
    ask: trimText(x.ask, 120), reply: trimText(x.reply, 400),
    day: Math.max(1, count(x.day)), pinned: x.pinned === true
  }));
}
export const seedsToday = (s, day) => (s.seeds || []).filter(x => x.day === (day || s.day)).length;
export const seedError = s =>
  (s.seeds || []).filter(x => !x.done).length >= SEED_PLOTS ? '地里满了，先把开好的收了。'
  : seedsToday(s) >= SEED_PER_DAY ? '今天种得够多了，明天再来。' : '';
export function sowSeed(s, kind, ask){
  if (!Object.hasOwn(SEED_KINDS, kind) || seedError(s)) return s;
  const seed = { id: 'sd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    kind, ask: trimText(ask, 120), day: s.day, done: false };
  return { ...s, seeds: [...(s.seeds || []), seed] };
}
// 开好了的那几株。⚠️一次全收：收一次＝打一枪，不管开了几朵（钱闸在这儿）
export const readySeeds = s => (s.seeds || []).filter(x => !x.done && s.day - x.day >= SEED_DAYS);
export function keepNotes(s, rows){
  const ready = new Set(readySeeds(s).map(x => x.id));
  const notes = (Array.isArray(rows) ? rows : []).filter(r => r && ready.has(r.id) && trimText(r.reply, 400))
    .map(r => { const seed = (s.seeds || []).find(x => x.id === r.id);
      return { id: r.id, kind: seed.kind, ask: seed.ask, reply: trimText(r.reply, 400), day: s.day, pinned: false }; });
  if (!notes.length) return s;
  const kept = new Set(notes.map(n => n.id));
  return { ...s, seeds: (s.seeds || []).map(x => kept.has(x.id) ? { ...x, done: true } : x),
    notes: [...notes, ...(s.notes || [])].slice(0, NOTE_CAP) };
}
export function pinNote(s, id){
  return { ...s, notes: (s.notes || []).map(n => n.id === id ? { ...n, pinned: !n.pinned } : n) };
}
// ── 碎片：井里刨出来的不是矿，是【关于这个人的东西】（她 2026-09-16 定的方向）──
// ⚠️深度只决定【完整度】，不决定情感重量：B1 普通想法、B20 童年创伤那种梯子
//   是游戏八股，她点名不要。越深只是越完整、越奇。
// ⚠️能捞的（回忆/联想/他那边）必须从真东西里长；想象的（梦/以后/没说出口/旧习惯/
//   感官）永远带着「这是想象」的身份，不进正史。这条在提示词那头写死。
export const SHARD_KINDS = {
  memory: '回忆', link: '联想', world: '他那边',
  unsaid: '没说出口', dream: '梦的边角', habit: '旧习惯', sense: '一点声音气味', ahead: '以后'
};
export const SHARD_CAP = 240, VEIN_POOL = 6;
export function restoreShards(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.text && Object.hasOwn(SHARD_KINDS, x.kind)).slice(0, SHARD_CAP).map(x => ({
    id: String(x.id).slice(0, 40), kind: x.kind, text: trimText(x.text, 240),
    whole: x.whole === true, depth: Math.max(0, count(x.depth)), day: Math.max(1, count(x.day)), pinned: x.pinned === true
  }));
}
// 还没被刨出来的那几片（下潜时由宿主一次生成一批填进来，慢慢挖）
export function restoreVein(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.text && Object.hasOwn(SHARD_KINDS, x.kind)).slice(0, VEIN_POOL * 2)
    .map(x => ({ kind: x.kind, text: trimText(x.text, 240), whole: x.whole === true }));
}
export const veinLow = s => (s.vein || []).length <= 1;
export function fillVein(s, rows){
  const add = restoreVein(rows);
  return add.length ? { ...s, vein: [...(s.vein || []), ...add].slice(0, VEIN_POOL * 2) } : s;
}
// 刨到手：池子里有就取一片，没有就给一块没纹路的石头（不调模型，也不让她空手）
export function takeShard(s, depth){
  const pool = s.vein || [];
  const row = pool[0] || { kind: 'sense', text: '一块没有纹路的石头。握久了有点温。', whole: false };
  const shard = { id: 'sh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    kind: row.kind, text: trimText(row.text, 240), whole: !!row.whole,
    depth: Math.max(0, count(depth)), day: s.day, pinned: false };
  return { ...s, vein: pool.slice(1), shards: [shard, ...(s.shards || [])].slice(0, SHARD_CAP) };
}
export function pinShard(s, id){
  return { ...s, shards: (s.shards || []).map(x => x.id === id ? { ...x, pinned: !x.pinned } : x) };
}
// ── 星井（下潜）────────────────────────────────────────────────────────
// depth   现在在第几层（0＝在地面上）
// sand    星砂：三份能在炼药锅换一颗月露
// stones  月石：每得一颗，往下的路再通两层（这就是下潜的进度）
export const deepestAllowed=s=>Math.min(DEPTH_MAX,DEPTH_BASE+count(s&&s.stones)*2);
export function freshState(){return {version:8,epoch:'initial',seat:null,look:{},seeds:[],notes:[],shards:[],vein:[],magic:freshMagic(),today:{},journal:[],map:'garden',day:1,minute:480,water:0,blooms:0,herbs:0,mushrooms:0,potions:0,harvest:0,sand:0,stones:0,depth:0,picked:[],position:{...START},companion:freshCompanion()};}
export function restoreState(raw){const prior=raw&&[1,2,3,4,5,6,7,8].includes(raw.version)?raw:freshState(),d=prior.version<5?{...prior,position:prior.map==='forest'?prior.position:{...START},companion:prior.companion?.map==='forest'?prior.companion:{...prior.companion,position:freshCompanion().position}}:prior,map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {version:8,epoch:typeof d.epoch==='string'?d.epoch.slice(0,80):'initial',magic:restoreMagic(d.magic),today:restoreToday(d.today),journal:restoreJournal(d.journal),map,seat:MAPS[map].seats?.[d.seat]&&d.position&&Math.hypot(d.position.x-MAPS[map].seats[d.seat].x,d.position.z-MAPS[map].seats[d.seat].z)<.2?d.seat:null,day:Math.max(1,count(d.day)),minute:d.version>=3?Math.max(420,count(d.minute,1379)):480,water:count(d.water,3),blooms:count(d.blooms,3),herbs:count(d.herbs),mushrooms:count(d.mushrooms),potions:count(d.potions),harvest:count(d.harvest),sand:count(d.sand),stones:count(d.stones),
 // 旧存档没有 depth；人从井里出来才算数，所以不在井底就一律 0
 depth:map==='depths'?Math.max(1,Math.min(DEPTH_MAX,count(d.depth))):0,picked:[...new Set(Array.isArray(d.picked)?d.picked.filter(id=>NODES.some(n=>n.id===id)):[])],position:d.position&&walkable(d.position.x,d.position.z,map)?{x:d.position.x,z:d.position.z}:{...MAPS[map].spawn},companion:restoreCompanion(d.companion),look:restoreLook(d.look),seeds:restoreSeeds(d.seeds),notes:restoreNotes(d.notes),shards:restoreShards(d.shards),vein:restoreVein(d.vein)};}
export function nextDay(s){const day=s.day+1;return {...s,day,minute:420,picked:[],today:{},journal:[...(s.journal||[]),{day:s.day,weather:weather(s.day,s.epoch),actions:s.today||{},partner:s.companion.name}].slice(-120),blooms:weather(day,s.epoch)==='细雨'?Math.min(3,s.blooms+1):s.blooms};}
export function advanceTime(s,minutes){let remaining=count(minutes,9600),out=s;while(remaining>0){const span=1380-out.minute;if(remaining<span)return {...out,minute:out.minute+remaining};remaining-=span;out=nextDay(out);}return out;}
export const timeLabel=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
// A companion carries its own morning dew: one visible helping action per game day.
export function companionCare(s){const c=s.companion,p=MAPS.garden.stations.garden;if(c.map!=='garden'||c.helpDay===s.day||s.blooms>=3||Math.hypot(c.position.x-p.x,c.position.z-p.z)>.5)return s;return {...s,blooms:s.blooms+1,companion:{...c,helpDay:s.day}};}
export function targetFor(state,kind,id){if(kind==='sit'){const seat=MAPS[state.map]?.seats?.pond;return seat?{x:seat.x,z:seat.z}:null;}if(kind==='visit')return MAPS[state.map]?.sites?.[id]?.target||null;if(kind==='gather'){const n=NODES.find(n=>n.id===id);return n?{x:n.x,z:n.z+.48}:null;}return MAPS[state.map]?.stations[kind]||null;}
export function actionError(s,kind,id){if(kind==='sit')return MAPS[s.map]?.seats?.pond?'':'这里没有池边座位。';if(kind==='visit')return MAPS[s.map]?.sites?.[id]?'':'这里还没有开放这处地方。';
 if(['seed','star','lamp'].includes(kind))return magicError(s,kind);
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);if(!n||s.map!==n.map||(n.depth!=null&&n.depth!==s.depth))return '这里没有这种材料。';
  if(s.picked.includes(id))return n.map==='depths'?'这一处的矿脉已经采空了。':'这一丛今天采过了，明天会重新长出来。';return '';}
 if(kind==='travel'||kind==='enter')return MAPS[s.map]?.exits[kind]?'':'这里没有通往别处的小路。';
 // 下潜三件事：从井口下去、再往下一层、顺着梯子上来
 // 收花笺：地里有开好的才让走过去（真正那一枪在宿主那侧打）
 if(kind==='note')return s.map!=='garden'?'花圃在庭院里。':readySeeds(s).length?'':'地里还没有开好的花。';
 if(kind==='dive')return s.map!=='garden'?'先回庭院，井在屋边。':s.minute>1140?'天太晚了，井底看不见路，明天再来。':'';
 if(kind==='ladder')return s.map==='depths'?'':'你不在井里。';
 if(kind==='deeper'){if(s.map!=='depths')return '先下到井里。';
  if(s.depth>=deepestAllowed(s))return s.stones?'再往下是塌掉的岩层。带回一颗月石，路会再通两层。':'再往下就看不见路了。先在这几层找到一颗月石。';
  return '';}
 if(kind==='rest')return MAPS[s.map]?.stations.rest?'':'这里没有可以睡觉的地方。';
 if(s.map!=='garden')return '先回庭院吧。';
 if(kind==='brew'){if(s.sand<3&&(s.herbs<2||s.mushrooms<1||s.water<1))return '月露配方：铃叶草 ×2、荧光菇 ×1、清水 ×1；或者星砂 ×3。';}
 else if(kind==='garden'){if(s.blooms<3&&!s.potions&&!s.water)return '水壶空了，先去井边取水；也可以用月露唤醒整圃花。';}
 else if(!['well','rest'].includes(kind))return '这里还不能这样做。';return '';
}
export const gardenIntent=s=>s.blooms===3?'harvest':s.potions?'potion':'water';
function performAction(s,kind,id,intent=gardenIntent(s)){
 if(actionError(s,kind,id))return s;const p=targetFor(s,kind,id);if(!p||Math.hypot(s.position.x-p.x,s.position.z-p.z)>.65)return s;
 if(['seed','star','lamp'].includes(kind))return performMagic(s,kind);
 if(kind==='sit')return {...s,seat:'pond'};if(kind==='visit')return {...s};
 if(kind==='well')return {...s,water:3};
 if(kind==='garden'){if(intent==='harvest'&&s.blooms===3)return {...s,blooms:0,harvest:s.harvest+3};if(s.blooms>=3)return s;if(intent==='potion'&&s.potions>0)return {...s,blooms:3,potions:s.potions-1};if(intent==='water'&&s.water>0)return {...s,water:s.water-1,blooms:s.blooms+1};return s;}
 // 有星砂先用星砂：那是她特地下井换来的，别让它压在背包里
 if(kind==='brew')return s.sand>=3?{...s,sand:s.sand-3,potions:s.potions+1}
  :{...s,herbs:s.herbs-2,mushrooms:s.mushrooms-1,water:s.water-1,potions:s.potions+1};
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);
  // 井底那两样：星砂常见、月石稀罕；越深一次刨出来的越多
  if(n.map==='depths'){
   // 「沉下去的东西」＝往下的钥匙；别的矿脉刨出来的是碎片（内容那一层）
   if(n.kind==='stone')return {...s,stones:s.stones+1,picked:[...s.picked,id]};
   return takeShard({...s,picked:[...s.picked,id]},s.depth);}
  return {...s,[n.kind==='herb'?'herbs':'mushrooms']:s[n.kind==='herb'?'herbs':'mushrooms']+(n.kind==='herb'?2:1),picked:[...s.picked,id]};}
 // 出口把人放在下一张图上【说好的落点】：默认是那张图的 spawn，
 // 爬梯子上来则是井口（exits.ladder.at）——落点写在出口那一处，不在这儿分支。
 if(kind==='travel'||kind==='enter'){const e=MAPS[s.map].exits[kind];return {...s,map:e.to,position:{...(e.at||MAPS[e.to].spawn)}};}
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
const ACTION_NAMES={enter:'回小屋歇脚',sit:'在池边坐下',visit:'散步到访',well:'取水',garden:'照料或采收月光花',brew:'炼月露',gather:'采集',seed:'一起唤醒种子',star:'照料或采收星铃花',lamp:'制作星铃灯',travel:'穿过小路',dive:'下到井里',deeper:'再往下一层',ladder:'从井里上来',note:'收花笺'};
function restoreToday(d){return Object.fromEntries(Object.keys(ACTION_NAMES).filter(k=>d&&count(d[k])>0).map(k=>[k,count(d[k],999)]));}
function restoreJournal(d){return (Array.isArray(d)?d:[]).slice(-120).filter(x=>Number.isInteger(x?.day)&&x.day>0).map(x=>({day:x.day,weather:['晴日','细雨','薄雾','细雪'].includes(x.weather)?x.weather:weather(x.day),partner:String(x.partner||'同行者').slice(0,16),actions:restoreToday(x.actions)}));}
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
export function perform(s,kind,id,intent=gardenIntent(s)){const out=performAction(s,kind,id,intent);if(out===s)return out;if(kind==='rest')return {...out,seat:null};return {...out,seat:kind==='sit'?out.seat:null,today:{...(out.today||{}),[kind]:((out.today||{})[kind]||0)+1}};}

// Find the first physical exit on a route; companions never jump across disconnected maps.
export function exitToward(from,to){const queue=[{map:from,first:null}],seen=new Set([from]);while(queue.length){const step=queue.shift();if(step.map===to)return step.first;for(const [id,exit]of Object.entries(MAPS[step.map]?.exits||{})){if(seen.has(exit.to)||!MAPS[exit.to])continue;seen.add(exit.to);queue.push({map:exit.to,first:step.first||{id,to:exit.to,at:exit.at,target:MAPS[from].stations[id]}});}}return null;}
