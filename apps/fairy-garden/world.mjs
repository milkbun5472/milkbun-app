import {restorePuzzleMemory,restoreBack} from '../train/puzzle-memory.mjs?v=fg-5736d962774e29d9';
import {validImage} from '../train/album.mjs?v=fg-5736d962774e29d9';
import {KNOWN_OUTFITS,HAIR_MODES,restoreWardrobe} from './wardrobe.mjs?v=fg-5736d962774e29d9';
import {brewError,brewResult} from './brewing.mjs?v=fg-5736d962774e29d9';
import {restoreWorkshop,restoreWaterLights,activeWaterLights,gameMinute,waterLightError,releaseWaterLight,millError,startMill,collectMill,helpMill,MILL_RECIPES,millRemaining} from './workshop.mjs?v=fg-5736d962774e29d9';
import './rules.js?v=fg-5736d962774e29d9';
export const {COMPANION_DESTINATIONS,GIFT_FAMILIES,GIFT_STANCES,GIFT_ORDER,giftQuota,stanceByRank,WELL_CURIOS,WELL_TIDES,WELL_KITS,wellTide,wellContext,wellWeights,wellFind,VILLAGE_ZONES,villagePoint,migrateVillagePosition,START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,DEPTH_MAX,DEPTH_BASE,depthNodes,seasonOf,weather,normalizePlan,hitInteraction,nearInteraction}=globalThis.FairyGardenRules;
import {createNavigator} from './navigation.mjs?v=fg-5736d962774e29d9';
// Polygon water follows the same sampled shoreline as the exported lake mesh.
const polygonBounds=new WeakMap();
export function inPolygon(x,z,points,padding=0){let box=polygonBounds.get(points);if(!box){box={minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};polygonBounds.set(points,box);}if(x<box.minX-padding||x>box.maxX+padding||z<box.minZ-padding||z>box.maxZ+padding)return false;
 let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if(padding>0&&x>=Math.min(a.x,b.x)-padding&&x<=Math.max(a.x,b.x)+padding&&z>=Math.min(a.z,b.z)-padding&&z<=Math.max(a.z,b.z)+padding){const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l)):0;if((x-a.x-dx*t)**2+(z-a.z-dz*t)**2<padding*padding)return true;}if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
export const lakeFrozen=s=>seasonOf(s?.day||1).index%4===3;
export function onLakeIce(map,p,s){const l=MAPS.garden.lake,d=l.deck;return map==='garden'&&lakeFrozen(s)&&!openDeck(map,p.x,p.z,s)&&inPolygon(p.x,p.z,l.shore)&&!(Math.abs(p.x-d.x)<d.w/2+.12&&Math.abs(p.z-d.z)<d.d/2+.12)&&((p.x-l.island.x)/(l.island.rx+.16))**2+((p.z-l.island.z)/(l.island.rz+.16))**2>=1;}
// 走多大的地方，就走多快（她 2026-09-17：「地图太大走路太慢了，从一头到另一头要大半天」）。
// ⚠️村子从半径 14 长到了 55，脚步一直还是当初那一间院子的脚步——一头走到另一头
//   要一分多钟真时间、几十分钟游戏时间。这不是她不耐烦，是世界大了四倍腿没跟上。
// ⚠️只按【这张图有多大】算，写在这一处：她和同行者、邻居用的是同一个数（各乘各的那一档），
//   在游戏那边给玩家单独调快，他就永远跟不上了。
export const walkSpeedFor = map => Math.max(1.45, Math.min(3.2, 1.45 * Math.sqrt((MAPS[map]?.radius || 14) / 14)));
export function walkable(x,z,map='garden',s=null){if(!MAPS[map]||!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>MAPS[map].radius)return false;if(MAPS[map].walkRegions&&!MAPS[map].walkRegions.some(a=>a.polygon?inPolygon(x,z,a.polygon):Math.hypot(x-a.x,z-a.z)<=a.r))return false;if(MAPS[map].plan?.outline&&!inPolygon(x,z,MAPS[map].plan.outline))return false;const bounds=MAPS[map].bounds;if(bounds&&(Math.abs(x)>bounds.w/2||Math.abs(z)>bounds.d/2))return false;if(openDeck(map,x,z,s))return true;return !MAPS[map].obstacles.some(o=>{if(!blocksNow(o,s))return false;if(o.except&&Math.abs(x-o.except.x)<o.except.w/2&&Math.abs(z-o.except.z)<o.except.d/2)return false;return o.polygon?inPolygon(x,z,o.polygon,.16):o.rx?((x-o.x)/(o.rx+.16))**2+((z-o.z)/(o.rz+.16))**2<1:o.r?Math.hypot(x-o.x,z-o.z)<o.r+.16:Math.abs(x-o.x)<o.w/2+.16&&Math.abs(z-o.z)<o.d/2+.16;});}
// 这一块【此刻】还挡不挡路。⚠️只有这一处答案：walkable 按点问它，segmentClear
//   按线段问它。原来 segmentClear 那一句抢跑的快筛不问存档，于是「落脚点能走、
//   跨过去却被拦」——路开了也走不过去（codex 2026-09-17 实测到的）。
// 开了的桥面。⚠️桥本来就得是一块 surface（不然站上去的高度不对），
//   所以「什么时候有这块桥」就写在那一条上，不另开一张表：
//   surfaces:[{x,z,w,d,height,opensWith:'reedBridge'}]。
// ⚠️桥面【压过挡路的东西】：芦苇桥就是要跨过那片湖水，
//   不让它压过去的话，桥搭好了也过不去（codex 2026-09-17 点名的那一条）。
const openDeck=(map,x,z,s)=>(MAPS[map]?.surfaces||[]).some(f=>f.opensWith&&opened(s,f.opensWith)
 &&Math.abs(x-f.x)<f.w/2&&Math.abs(z-f.z)<f.d/2);
function blocksNow(o,s){
 if(o.kind==='lake'&&lakeFrozen(s))return false;
 if(o.opensWith&&opened(s,o.opensWith))return false;
 return true;
}
// Exact rectangle clipping prevents a short diagonal corner cut from passing sampled checks.
function clipsBox(a,b,o){let lo=0,hi=1;for(const [axis,half]of [['x',o.w/2+.16],['z',o.d/2+.16]]){const min=o[axis]-half+1e-8,max=o[axis]+half-1e-8,d=b[axis]-a[axis];if(Math.abs(d)<1e-12){if(a[axis]<=min||a[axis]>=max)return false;}else{const t1=(min-a[axis])/d,t2=(max-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>=hi)return false;}}return hi>0&&lo<1;}
export function segmentClear(a,b,map='garden',avoid=[],s=null){const deck=(MAPS[map].surfaces||[]).some(f=>f.opensWith&&opened(s,f.opensWith));if(!deck&&MAPS[map].obstacles.some(o=>o.w&&o.d&&!o.except&&blocksNow(o,s)&&clipsBox(a,b,o)))return false;const minimum=avoid.map(o=>Math.min(o.r,Math.hypot(a.x-o.x,a.z-o.z)));const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/.07));for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(!walkable(x,z,map,s)||avoid.some((o,j)=>Math.hypot(x-o.x,z-o.z)<minimum[j]-1e-6))return false;}return true;}
export function floorHeight(map,p,state=null){const m=MAPS[map],base=m?.floor??.08;for(const s of m?.surfaces||[]){if(s.opensWith&&!opened(state,s.opensWith))continue;if(s.kind==='hill'){const r2=((p.x-s.x)/s.rx)**2+((p.z-s.z)/s.rz)**2;if(r2<1)return base+s.height*(1-r2)**2;}else if(Math.abs(p.x-s.x)<s.w/2&&Math.abs(p.z-s.z)<s.d/2)return s.height;}return onLakeIce(map,p,state)?MAPS.garden.lake.iceHeight:base;}
// Picking uses the same ground heights as walking, including raised decks and slopes.
export function groundPoint(map,origin,direction,state=null){
 if(direction.y>=-1e-6)return null;const base=MAPS[map]?.floor??.08,top=Math.max(base,MAPS.garden.lake.iceHeight,...(MAPS[map]?.surfaces||[]).map(s=>s.kind==='hill'?base+s.height:s.height))+.01;
 const point=t=>({x:origin.x+direction.x*t,y:origin.y+direction.y*t,z:origin.z+direction.z*t});
 const start=Math.max(0,(top-origin.y)/direction.y),end=(base-origin.y)/direction.y;if(end<start)return null;
 let previous=start;for(let i=1;i<=48;i++){const t=start+(end-start)*i/48,p=point(t);if(p.y<=floorHeight(map,p,state)+1e-8){let lo=previous,hi=t;for(let n=0;n<15;n++){const mid=(lo+hi)/2,q=point(mid);if(q.y>floorHeight(map,q,state))lo=mid;else hi=mid;}return point(hi);}previous=t;}return point(end);
}
// 乐观格子用的那份「世界全开」：湖结着冰、三处开口都开了。
// ⚠️它只喂给建格子的那一次，不参与任何判断——真正挡不挡路由每一步现算。
// ⚠️用到的时候才拼：OPENINGS 在这个文件下面很远的地方，模块刚开始跑的时候还没有它。
let openWorld=null;
const OPEN_WORLD=()=>openWorld||(openWorld={day:43,casts:Object.entries(OPENINGS).map(([place,o])=>
 ({place,spell:o.spell,kind:SPELLS[o.spell].need,text:'·',day:1}))});
const navigator=createNavigator(MAPS,walkable,segmentClear,(x,z,map)=>walkable(x,z,map,OPEN_WORLD()));
export const findPath=(a,b,map='garden',avoid=[],s=null)=>navigator(a,b,map,avoid,s);
const count=(v,max=999999)=>Math.max(0,Math.min(max,Number.isFinite(Number(v))?Math.floor(Number(v)):0));
// ⚠️三档「性格」v69.55 退役：换个角色照样成立的东西，等于没设计。
//   他今天做什么由模型按【他自己的人设】排（generateSeason 那一枪），排不出来时才走那张地板表。

// ── 样貌（发型/发色/衣色/体型）─────────────────────────────────────────
// ⚠️restoreState 和 restoreCompanion 都是【白名单式建对象】：不在这儿写一笔，
//   存档里那一份就会被静默丢掉——她 2026-09-16 报的「样貌退出不保存」正是这个。
//   （同一个坑 js/app.js 的 addMemEntry 注释里也记着一次。）
// 发型名单和六个参数的范围不在这儿重写（那是 doll.json 的事）：这里只做
// 「长得像不像一份样貌」的体检，认不出的键交给 traveler.mjs 自己忽略。
export function restoreLook(raw){
 const d=raw&&typeof raw==='object'?raw:{},out={};
 if(typeof d.hair==='string'&&/^[a-z]{2,16}$/.test(d.hair))out.hair=d.hair;
 for(const k of ['hairColor','hairColor2','cloth','skin'])if(typeof d[k]==='string'&&/^#[0-9a-fA-F]{6}$/.test(d[k]))out[k]=d[k];
 if(HAIR_MODES.some(m=>m[0]===d.hairMode))out.hairMode=d.hairMode;
 if(KNOWN_OUTFITS.includes(d.outfit))out.outfit=d.outfit;
 const wardrobe=restoreWardrobe(d.wardrobe);if(Object.keys(wardrobe).length)out.wardrobe=wardrobe;
 if(d.dims&&typeof d.dims==='object'){const dims={};
  for(const [k,v]of Object.entries(d.dims)){const n=Number(v);
   if(/^[a-z]{2,16}$/.test(k)&&Number.isFinite(n))dims[k]=Math.max(0,Math.min(2,n));}
  if(Object.keys(dims).length)out.dims=dims;}
 return out;
}
export function freshCompanion(){return {name:'同行者',mode:'routine',map:'garden',position:villagePoint({x:-3.5,z:4.3},'home'),helpDay:0,destination:'home',look:{}};}
export function restoreCompanion(raw,state=null){const d=raw||{},c=freshCompanion(),map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {...c,name:typeof d.name==='string'?d.name.trim().slice(0,16)||c.name:c.name,mode:['follow','wait','goto'].includes(d.mode)?d.mode:'routine',destination:Object.hasOwn(COMPANION_DESTINATIONS,d.destination)?d.destination:'home',map,position:d.position&&walkable(d.position.x,d.position.z,map,state)?{x:d.position.x,z:d.position.z}:map==='garden'?c.position:{...MAPS[map].spawn},helpDay:count(d.helpDay),look:restoreLook(d.look)};}
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
 const valid=(Array.isArray(raw)?raw:[]).filter(x=>x&&x.id&&Object.hasOwn(SEED_KINDS,x.kind));
 const keep=new Set([...valid.filter(x=>x.done!==true).slice(0,SEED_PLOTS),...valid.filter(x=>x.done===true).slice(-SEED_PLOTS*3)]),used=new Set();
 const rows=valid.filter(x=>keep.has(x)).map(x=>{const origin=restoreShards([x.origin])[0];return {
  id:String(x.id).slice(0,40),kind:x.kind,ask:trimText(x.ask,120),day:Math.max(1,count(x.day)),done:x.done===true,
  ...(Number.isInteger(x.plot)&&x.plot>=0&&x.plot<SEED_PLOTS?{plot:x.plot}:{}),...(origin?.curio==='seed'?{origin}:{})};});
 for(const x of rows.filter(x=>!x.done)){if(!Number.isInteger(x.plot)||used.has(x.plot))delete x.plot;else used.add(x.plot);}
 for(const x of rows.filter(x=>!x.done&&!Number.isInteger(x.plot))){x.plot=Array.from({length:SEED_PLOTS},(_,i)=>i).find(i=>!used.has(i));used.add(x.plot);}
 return rows;
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
  s.map !== 'garden' ? '花圃在庭院里。'
  : (s.seeds || []).filter(x => !x.done).length >= SEED_PLOTS ? '地里满了，先把开好的收了。'
  : seedsToday(s) >= SEED_PER_DAY ? '今天种得够多了，明天再来。' : '';
export function sowSeed(s, kind, ask){
  if (!Object.hasOwn(SEED_KINDS, kind) || seedError(s)) return s;
  const seed = { id: 'sd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    kind, plot:freeSeedPlot(s), ask: trimText(ask, 120), day: s.day, done: false };
  return addMiss({ ...s, seeds: [...(s.seeds || []), seed] }, 'seed');
}
// 开好了的那几株。⚠️一次全收：收一次＝打一枪，不管开了几朵（钱闸在这儿）
export const readySeeds = s => (s.seeds || []).filter(x => !x.done && !x.origin && s.day - x.day >= SEED_DAYS);
export function keepNotes(s, rows){
  const ready = new Set(readySeeds(s).map(x => x.id));
  const notes = (Array.isArray(rows) ? rows : []).filter(r => r && ready.has(r.id) && trimText(r.reply, 400))
    .map(r => { const seed = (s.seeds || []).find(x => x.id === r.id);
      return { id: r.id, kind: seed.kind, ask: seed.ask, reply: trimText(r.reply, 400), day: s.day, pinned: false }; });
  if (!notes.length) return s;
  const kept = new Set(notes.map(n => n.id));
  return noteHappening(noteBond({ ...s, seeds: (s.seeds || []).map(x => kept.has(x.id) ? { ...x, done: true } : x),
    notes: [...notes, ...(s.notes || [])].slice(0, NOTE_CAP) }, 'note', '他答了你种下的那句「' + (notes[0].ask || SEED_KINDS[notes[0].kind] || '') + '」'),
    'grew', '地里开了 ' + notes.length + ' 株，花笺收回来了');
}
// Dream seeds share the same six plots and daily sowing limit as question flowers.
export const seedPlot=(s,x)=>Number.isInteger(x.plot)?x.plot:(s.seeds||[]).filter(v=>!v.done).indexOf(x);
const freeSeedPlot=s=>Array.from({length:SEED_PLOTS},(_,i)=>i).find(i=>!(s.seeds||[]).some(x=>!x.done&&seedPlot(s,x)===i));
export const growingDreams=s=>(s.seeds||[]).filter(x=>!x.done&&x.origin);
export const dreamStage=(s,x)=>Math.min(SEED_DAYS,Math.max(0,s.day-x.day));
export function dreamError(s,id,harvest=false){
 if(s.map!=='garden')return '梦种要种在家旁边的花圃。';
 if(harvest){const x=growingDreams(s).find(x=>x.id===id);return !x?'这株已经收回来了。':dreamStage(s,x)<SEED_DAYS?'花还没有开，再让它长一会儿。':s.things.length>=THING_CAP?'屋里的东西放满了，先摆进收藏馆再来收。':'';}
 const sh=s.shards.find(x=>x.id===id);return !sh||sh.curio!=='seed'?'先挑一颗井里带回的梦种。':sh.pinned?'这颗梦种钉住了，先在收藏里取消钉住再种。':seedError(s);
}
function sowDream(s,id){
 const origin=s.shards.find(x=>x.id===id),seed={id:'ds_'+origin.id,kind:'what_if',plot:freeSeedPlot(s),ask:origin.text.slice(0,120),day:s.day,done:false,origin:{...origin}};
 return noteHappening({...s,shards:s.shards.filter(x=>x.id!==id),seeds:[...s.seeds,seed]},'grew','把井里带回的梦种种进花圃，原来的片段留在种子里');
}
function harvestDream(s,id){
 const seed=growingDreams(s).find(x=>x.id===id),sh=seed.origin;
 const thing={id:'fl_'+sh.id,name:'梦花',note:'从井底梦种长出的花，夜里会泛起微光。花心留着种下时的那一片。',kind:sh.kind,way:'set',recipe:'dreamflower',from:sh.text,day:s.day,openDay:0,spot:null};
 return noteHappening({...s,seeds:s.seeds.map(x=>x.id===id?{...x,done:true}:x),things:[thing,...s.things]},'grew','收回一株梦花，可以摆在家具上或留在收藏馆');
}
export function pinNote(s, id){
  return { ...s, notes: (s.notes || []).map(n => n.id === id ? { ...n, pinned: !n.pinned } : n) };
}
// ── 碎片：井里刨出来的不是矿，是【关于这个人的东西】（她 2026-09-16 定的方向）──
// ⚠️深度只决定【完整度】，不决定情感重量：B1 普通想法、B20 童年创伤那种梯子
//   是游戏八股，她点名不要。越深只是越完整、越奇。
// ⚠️能捞的（回忆/联想/他那边）必须从真东西里长；想象的（梦/以后/没说出口/旧习惯/
//   感官）永远带着「这是想象」的身份，不进正史。这条在提示词那头写死。
// ⚠️v69.32 从八类收成四类【看得见的东西】（codex 提的，她拍板）：
//   「念头／未言／情绪／联想」的边界连写提示词的人都分不清，背包会变成一排抽象名词。
//   现在它们首先是【东西】，其次才带着内容——「没说出口／以后／他那边」不再自己占一格，
//   而是这几样东西【携带】的内容。
// ⚠️更要紧的一条：东西是挖出来的，话是他说的。矿洞只描述这一件东西，
//   不许替角色宣布「他当时差点说…」——那句话要他自己看见东西之后再决定。
export const SHARD_KINDS = {
  echo: '回声石', dream: '梦屑', sense: '感官晶', relic: '无名遗物'
};
// 旧存档里那八类各自归到最近的一样（她攒下的一片都不许丢）
const SHARD_MIGRATE = { memory: 'echo', link: 'echo', world: 'echo', ahead: 'dream', unsaid: 'relic', habit: 'relic' };
const shardKind = k => Object.hasOwn(SHARD_KINDS, k) ? k : (SHARD_MIGRATE[k] || null);
export const SHARD_CAP = 240, VEIN_POOL = 6;
export function restoreShards(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.text && shardKind(x.kind)).slice(0, SHARD_CAP).map(x => ({
    id: String(x.id).slice(0, 40), kind: shardKind(x.kind), ...(Object.hasOwn(WELL_CURIOS,x.curio)&&x.curio!=='rune'?{curio:x.curio}:{}), text: trimText(x.text, 240),
    whole: x.whole === true, depth: Math.max(0, count(x.depth)), day: Math.max(1, count(x.day)), pinned: x.pinned === true
  }));
}
// 还没被刨出来的那几片（下潜时由宿主一次生成一批填进来，慢慢挖）
export function restoreVein(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.text && shardKind(x.kind)).slice(0, VEIN_POOL * 2)
    .map(x => ({ kind: shardKind(x.kind), ...(Object.hasOwn(WELL_CURIOS,x.curio)&&x.curio!=='rune'?{curio:x.curio}:{}), text: trimText(x.text, 240), whole: x.whole === true }));
}
export const veinLow = s => (s.vein || []).length <= 1;
export function fillVein(s, rows){
  const add = restoreVein(rows);
  return add.length ? { ...s, vein: [...(s.vein || []), ...add].slice(0, VEIN_POOL * 2) } : s;
}
// 刨到手：池子里有就取一片，没有就给一块没纹路的石头（不调模型，也不让她空手）
export function takeShard(s, depth, curio=null){
  const pool = s.vein || [];
  const row = pool[0] || { kind: 'sense', text: '它静静躺在掌心，握久了有点温。', whole: false };
  const shard = { id: 'sh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    kind: row.kind, ...(Object.hasOwn(WELL_CURIOS,curio)&&curio!=='rune'?{curio}:{}), text: trimText(row.text, 240), whole: !!row.whole,
    depth: Math.max(0, count(depth)), day: s.day, pinned: false };
  return noteHappening({ ...s, vein: pool.slice(1), shards: [shard, ...(s.shards || [])].slice(0, SHARD_CAP) },
    'dug', '从井里第 ' + shard.depth + ' 层带回' + shardName(shard) + (shard.whole ? '（完整的一片）' : ''));
}
export const shardName=sh=>WELL_CURIOS[sh.curio]?.name||SHARD_KINDS[sh.kind]||'碎片';
export function pinShard(s, id){
  return { ...s, shards: (s.shards || []).map(x => x.id === id ? { ...x, pinned: !x.pinned } : x) };
}
// ── 公告栏：接委托，做完会在世界里留下东西（她 2026-09-17 点的下一件）────
// ⚠️这一版也【一枪都不打】：委托是谁发的、要什么、做完留下什么，全是代码算的。
//   模型只留给最值钱的那一下——他站在那盏灯下说的那句话（还没接，留了口子）。
// ⚠️季节改的不是委托皮肤，是【这个世界在这个季节更容易发生什么】：
//   春天容易有人来找东西、夏天容易有临时邀约、秋天多寻物与转交、冬天多陪伴与囤东西。
// ⚠️做完要【留下后果】，而且后果落在她看得见的地方（修好的灯会一直亮着），
//   不是发一句「谢谢你」——这是 codex 那封信里最值得认真做的一条。
export const QUEST_KINDS = {
  find: { label: '找东西', need: 'shard', note: '有人丢了一样东西，帮他从井里刨出来' },
  gather: { label: '采一点', need: 'herbs', note: '要几株林子里的草' },
  bloom: { label: '送花', need: 'harvest', note: '想要几朵开好的月光花' },
  fix: { label: '修东西', need: 'relic', note: '一样坏掉的东西，缺零件', keeps: 'pathLamp' },
  keep: { label: '陪一会儿', need: 'visit', note: '有人想在某处待一会儿，不想一个人' }
};
// 谁发的。三间邻居屋空着的时候只能说「屋主人」；住进人来就落真名——
// 这句话从 v69.0x 起就写在这儿等着了（「等人住进来再接真名」），邻居做完就该接上。
// ⚠️抽签仍旧只看存档号＋板子号：谁住进来【不改抽中哪一间】，只改那一间落谁的名字。
//   把住户也掺进抽签的话，搬一次家整块板子会重抽，她接了一半的委托当场换人。
const QUEST_FROM = [
  { text: '公共厅的告示' },
  { text: '左边邻居屋的主人', home: 'neighbor1' },
  { text: '林后那间的主人', home: 'neighbor2' },
  { text: '右边那间的主人', home: 'neighbor3' },
  { text: '一张没有落款的字条' }
];
export function questFrom(s, seed){
  const pick = QUEST_FROM[hash(seed + ':from') % QUEST_FROM.length];
  if (!pick.home) return pick.text;
  const who = restoreNeighbors(s.neighbors).find(n => n.home === pick.home);
  return who ? who.name : pick.text;
}
const SEASON_QUESTS = [
  { find: 34, gather: 26, keep: 20, fix: 12, bloom: 8 },   // 春：找东西、出门、新认识的人
  { gather: 30, keep: 26, bloom: 24, find: 12, fix: 8 },   // 夏：临时邀约、热闹事
  { find: 32, bloom: 26, fix: 22, gather: 12, keep: 8 },   // 秋：寻物、收获、转交
  { keep: 34, fix: 26, gather: 20, find: 12, bloom: 8 }    // 冬：室内、照顾、陪伴
];
export const QUEST_SLOTS = 3, QUEST_TAKEN_MAX = 2, QUEST_CYCLE = 4;
// 第几块板子（从第 1 天起每 4 天一块）。⚠️只在这一处算，别处一律问它——
//   板子的号同时管【抽签的种子】【委托的 id】和【过没过期】，各算一遍迟早对不上。
export const questCycle = day => Math.floor((Math.max(1, count(day)) - 1) / QUEST_CYCLE);
// 这块板子撕下来的那天：过了这天还没交，就没了
export const questLastDay = cycle => (Math.max(0, count(cycle)) + 1) * QUEST_CYCLE;
const hash = str => { let h = 2166136261; for (const ch of String(str)) { h = Math.imul(h ^ ch.charCodeAt(0), 16777619); } h ^= h >>> 16; return h >>> 0; };
const pickWeighted = (table, seed) => { let draw = (hash(seed) % 1000) / 1000 * 100;
  for (const [key, weight] of Object.entries(table)) { draw -= weight; if (draw < 0) return key; } return Object.keys(table)[0]; };
const QUEST_NEED = { shard: 1, herbs: 2, harvest: 2, relic: 1, visit: 0 };
// 这一季的板子：由存档号＋季节算出来，谁看都是这三条，刷新页面也不会变
export function questBoard(s){
  const season = seasonOf(s.day), cycle = questCycle(s.day), out = [];
  // ⚠️换板子的节奏是四天，但【抽什么】仍旧跟着季节走：春天容易有人来找东西、
  //   冬天多陪伴，那一层没变，变的只是多久换一块。
  const table = SEASON_QUESTS[season.index % 4], order = Object.keys(table);
  for (let i = 0; i < QUEST_SLOTS; i++) {
    const seed = String(s.epoch) + ':quest:' + cycle + ':' + i;
    // ⚠️同一块板子上不许出现两件一样的：抽重了就顺着权重表往下挪一格。
    //   三条里两条「采一点」，看起来就像这个世界只会一件事。
    let kind = pickWeighted(table, seed), guard = 0;
    while (out.some(q => q.kind === kind) && guard++ < order.length) kind = order[(order.indexOf(kind) + 1) % order.length];
    out.push({ id: 'q_' + cycle + '_' + i, kind,
      from: questFrom(s, seed),
      need: QUEST_NEED[QUEST_KINDS[kind].need], season: season.index,
      cycle: cycle, lastDay: questLastDay(cycle) });
  }
  return out;
}
export const questTaken = s => (s.quests || []).filter(q => !q.done);
// 接了没做的，板子一换就没了（她 2026-09-17：「接了没做也没了」）。
// ⚠️只在【跨天】那一处真删，别处一律读 questTaken——读的时候顺手算过期的话，
//   同一件事会在界面上忽隐忽现。
export const questExpired = (s, q) => !q.done && questCycle(s.day) > count(q.cycle);
// 到期没交：板子撕掉，而且【委托人是村里真住着的人】的话，他那边的交情退一格。
// ⚠️只退交情、不扣东西：接了没做完是件小事，不是罪
export function expireQuests(s){
  const gone = (s.quests || []).filter(q => questExpired(s, q));
  if (!gone.length) return s;
  let out = { ...s, quests: (s.quests || []).filter(q => !questExpired(s, q)) };
  for (const q of gone){
    const who = restoreNeighbors(out.neighbors).find(n => n.name === q.from);
    if (who && metCount(out, who.charId) > 0) out = noteHappening(bumpMeet(out, who.charId, -2), 'world', '没赶上' + who.name + '托的那件事，' + who.name + '嘴上没说什么');
  }
  return out;
}
export function restoreQuests(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && Object.hasOwn(QUEST_KINDS, x.kind)).slice(0, 40).map(x => ({
    id: String(x.id).slice(0, 40), kind: x.kind, from: trimText(x.from, 24),
    need: Math.max(0, count(x.need)), season: Math.max(0, count(x.season)),
    cycle: Math.max(0, count(x.cycle)), lastDay: Math.max(0, count(x.lastDay)),
    day: Math.max(1, count(x.day)), done: x.done === true
  }));
}
// ── 修好的地方（她 2026-09-17：「做④吧宝宝」）────────────────────────
// ⚠️「做过的事真的改变生活」是这一条的全部：修好了不是拿到一个勾，
//   是【村里从此多了一处能用的地方】——下雨他会去那儿，午后他会去那儿，
//   她走到那儿也有句话。变的是日子，不是一张成就表。
// ⚠️小路那盏灯是这张表的【第一行】，不是它的例外。原来它散在
//   QUEST_KINDS.fix.keeps / restoreFixtures / lampOn / dailySeeds 好几处，
//   现在这几处一律走这张表（施工规则/one-public-mechanism.md：已有的也要搬过来）。
// ⚠️地点全是村里【本来就有】的那几处（codex 那边已经盖好的旧塔、北岸）：
//   这一版一个新景都不加，只是让盖好的东西真的能用。
export const WORKS = {
  pathLamp: { label: '小路那盏灯', site: null, by: 'quest',
    hint: '公告栏上那件「修东西」做完，它就一直亮着',
    done: '小路那盏灯修好了，从此天黑就亮着' },
  towerRoof: { label: '旧塔漏雨的屋顶', site: 'oldTower', need: { relic: 2, sand: 8 }, moves: ['rain'],
    hint: '补好它，下雨天就能进去躲',
    done: '旧塔那片漏雨的屋顶补好了，下雨天能进去躲雨了',
    there: '塔檐底下是干的，雨声全在外面。' },
  lakeShade: { label: '月湖北岸的藤棚', site: 'lakeNorth', need: { herbs: 6, harvest: 3 }, moves: ['walk','pond','bottle','glow'],
    hint: '搭起来，午后就有个歇脚的地方',
    done: '月湖北岸搭起了一架藤棚，午后有地方坐了',
    there: '藤叶把日头筛成一地碎光，风从湖面过来。' }
};
export const WORK_NEEDS = { relic: '无名遗物', sand: '星砂', herbs: '铃叶草', harvest: '月光花' };
export function restoreFixtures(raw){
  const d = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const id of Object.keys(WORKS)) out[id] = d[id] === true;
  return out;
}
export const workDone = (s, id) => restoreFixtures(s.fixtures)[id] === true;
export const workHave = (s, need) => need === 'relic'
  ? (s.shards || []).filter(x => x.kind === 'relic').length : count(s[need]);
// 缺什么，缺多少。⚠️只算在这一处：按钮上那行小字、点不动时那句解释、
//   界面上那张单子，读的都是它，各写一份迟早三处对不上。
export function workShort(s, id){
  const w = WORKS[id]; if (!w || !w.need) return [];
  return Object.entries(w.need).filter(([k, n]) => workHave(s, k) < n)
    .map(([k, n]) => WORK_NEEDS[k] + ' ×' + (n - workHave(s, k)));
}
export const workCost = id => Object.entries(WORKS[id]?.need || {})
  .map(([k, n]) => WORK_NEEDS[k] + ' ×' + n).join('、');
// 站在这儿能动手的那一件（没有就是 null）。⚠️「够不够得着」只写在这儿
export function workHere(s){
  for (const [id, w] of Object.entries(WORKS)){
    if (!w.site || w.by === 'quest' || workDone(s, id)) continue;
    const site = MAPS[s.map]?.sites?.[w.site]; if (!site) continue;
    if (Math.hypot(site.target.x - s.position.x, site.target.z - s.position.z) <= 2.4) return id;
  }
  return null;
}
export function workError(s, id){
  const w = WORKS[id];
  if (!w) return '这儿没有这一件活。';
  if (workDone(s, id)) return w.label + '已经弄好了。';
  if (w.by === 'quest') return w.hint + '。';
  if (workHere(s) !== id) return '要走到' + w.label + '那儿才动得了手。';
  const short = workShort(s, id);
  return short.length ? '还差' + short.join('、') + '。' : '';
}
export function doWork(s, id){
  if (workError(s, id)) return s;
  const w = WORKS[id];
  let out = { ...s, fixtures: { ...restoreFixtures(s.fixtures), [id]: true } };
  for (const [k, n] of Object.entries(w.need || {})){
    if (k === 'relic'){ let left = n; out.shards = (out.shards || []).filter(x => !(x.kind === 'relic' && left-- > 0)); }
    else out[k] = count(out[k]) - n;
  }
  return noteHappening(companionNearby(s) ? noteBond(out, 'work', '和' + s.companion.name + '一起' + w.done) : out, 'world', w.done);
}
// 这一件活改了他哪一格去哪儿。⚠️只有一处答案：companion.mjs 的 plannedActivity
//   问它要（tick 在 routine 模式绕开 companionPlan，写在别处那一半人就读不到）。
export function workSpot(s, activityId){
  for (const [id, w] of Object.entries(WORKS)){
    // ⚠️moves 是一【组】格子：地板表每天挑的不一样，只认死一格的话，
    //   她修好的地方十天里有九天白修。
    if (!(w.moves || []).includes(activityId) || !workDone(s, id)) continue;
    const site = MAPS.garden.sites[w.site]; if (!site) continue;
    return { map: 'garden', target: { ...site.target }, label: w.there ? w.label : site.label };
  }
  return null;
}
export const worksDone = s => Object.entries(WORKS).filter(([id]) => workDone(s, id))
  .map(([id, w]) => ({ id, label: w.label, done: w.done }));
export const takeError = (s, id) =>
  questTaken(s).length >= QUEST_TAKEN_MAX ? '手上这两件先做完吧。'
  : (s.quests || []).some(q => q.id === id) ? '这一件已经接过了。'
  : !questBoard(s).some(q => q.id === id) ? '板子上没有这一件。' : '';
export function takeQuest(s, id){
  if (takeError(s, id)) return s;
  const row = questBoard(s).find(q => q.id === id);
  return { ...s, quests: [...(s.quests || []), { ...row, day: s.day, done: false }] };
}
// 交得出去吗：身上有没有它要的东西
export function questPaid(s, q){
  const need = QUEST_KINDS[q.kind].need;
  if (need === 'shard') return (s.shards || []).length >= q.need;
  if (need === 'relic') return (s.shards || []).filter(x => x.kind === 'relic').length >= q.need;
  if (need === 'herbs') return count(s.herbs) >= q.need;
  if (need === 'harvest') return count(s.harvest) >= q.need;
  if (need === 'visit') return true;          // 陪一会儿：走到公告栏就算数
  return false;
}
export function turnIn(s, id){
  const q = (s.quests || []).find(x => x.id === id && !x.done);
  if (!q || s.map !== 'garden' || !questPaid(s, q)) return s;
  const need = QUEST_KINDS[q.kind].need;
  let out = { ...s };
  if (need === 'shard') out.shards = (s.shards || []).slice(q.need);
  if (need === 'relic') { let left = q.need; out.shards = (s.shards || []).filter(x => !(x.kind === 'relic' && left-- > 0)); }
  if (need === 'herbs') out.herbs = count(s.herbs) - q.need;
  if (need === 'harvest') out.harvest = count(s.harvest) - q.need;
  // 后果：修东西那一件会把小路上那盏灯修好，从此它一直亮着
  const keeps = QUEST_KINDS[q.kind].keeps;
  if (keeps) out.fixtures = { ...restoreFixtures(s.fixtures), [keeps]: true };
  out.deeds = count(s.deeds) + 1;
  out.quests = (s.quests || []).map(x => x.id === id ? { ...x, done: true, doneDay: s.day } : x);
  return noteHappening(out, 'quest', '替' + q.from + '做完了一件「' + QUEST_KINDS[q.kind].label + '」'
    + (QUEST_KINDS[q.kind].keeps ? '，小路那盏灯从此亮着' : ''));
}
// 灯修好之后：天黑了它就亮着；雨天的晚上，发委托的人会站在灯下避雨
export const lampOn = s => workDone(s, 'pathLamp') && s.minute >= 1020;
export const lampShelter = s => lampOn(s) && ['细雨', '细雪'].includes(weather(s.day, s.epoch));
// ── 锅：把碎片做成【东西】（她 2026-09-17 拍板走 codex 那版）──────────────
// ⚠️这一整条链【一枪都不打】：做出来是什么、叫什么、摆在哪儿、雨天响不响，
//   全是代码算的。模型只用在最值钱的那一下——他路过停下来说的那句话。
//   这是庭院的【成本地板】：不花钱也得好玩，别让每一样收获都变成一段生成的文字。
// ⚠️判据（她定的）：一样东西，要么能读、要么能摆、要么能用、要么会引出下一件事。
//   一样都占不上的，不许进背包。
export const CRAFT_WAYS = {
  distill: { label: '蒸馏', note: '只留下最鲜明的那一点声音、气味或感觉' },
  set: { label: '凝结', note: '做成能摆出来、能拿在手上的东西' },
  ferment: { label: '发酵', note: '先封起来，过几天回来看它变成了什么', days: 2 },
  // 合炉要【两片不同种类】的碎片。⚠️它是让那四种碎片互相认识的唯一一处：
  //   没有它，四种碎片各走各的三条路，攒哪一种都一样。
  fuse: { label: '合炉', note: '两片不一样的碎片一起下锅，出来的是第三样东西', pair: true }
};
// 配方表：材料定大方向，手法定形状。不公开全表，做成过的记进炼金笔记。
const CRAFT = {
  echo: { distill: ['旧日的一点回音', '凑近听，是那天某个很小的声音。'],
    set: ['回声灯', '把那一小段光留在灯罩里，天黑会亮。'],
    ferment: ['封着回音的坛子', '封了几天，里面的声音变长了一点，多出几个原本没听见的字。'] },
  dream: { distill: ['一小瓶梦的余味', '闻起来像刚醒来那几秒。'],
    set: ['玻璃梦', '一块能摆住的梦，夜里会自己发一点光。'],
    ferment: ['醒过来的梦', '封着封着它自己醒了，变成一件谁都说不清的小东西。'] },
  sense: { distill: ['一线雨声', '封在细管里的一段声音，晃一晃还在。'],
    set: ['雨铃', '挂在屋檐下。真下雨的时候，它会响。'],
    ferment: ['潮了的风铃', '受潮之后声音闷了，反而更像远处的雨。'] },
  relic: { distill: ['擦亮的旧零件', '擦掉锈，看得出它本来是什么的一部分了。'],
    set: ['接好的小机关', '缺的那半被补上了，能转起来。'],
    ferment: ['长出东西的遗物', '放了几天，上面长出了不该长的东西。'] }
};
// 完整的一片（下到深处才刨得到那种）做出来的是另一样东西。
// ⚠️这一张是【下潜的回报】：没有它，下到第九层和第一层刨到的碎片做出来一模一样，
//   那口井就只剩一个数字在变。
const WHOLE = {
  echo: { distill: ['一整句留下来的话', '不是片段了。从头到尾，连那口气都在。'],
    set: ['回声灯 · 长明', '灯罩里那段光不再断，天黑了整夜都亮着。'],
    ferment: ['会接话的坛子', '封久了它学会了接下半句——虽然接得并不对。'] },
  dream: { distill: ['一整场梦的余味', '闻得出开头、中间和醒来，顺序都还在。'],
    set: ['琥珀梦', '整场封在一块琥珀里，转个角度能看见不同的一段。'],
    ferment: ['醒着的梦', '它不睡了。放在桌上，偶尔自己动一下。'] },
  sense: { distill: ['一场完整的雨', '从第一滴到停，封在一只细管里。'],
    set: ['雨铃 · 整场', '挂在屋檐下。下雨时它不是响一声，是把整场雨都响完。'],
    ferment: ['久放的潮气', '受潮到底了，凑近像站在雨后的院子里。'] },
  relic: { distill: ['擦亮的整件东西', '不是零件了，看得出它本来是干什么用的。'],
    set: ['修好的旧物', '缺的都补齐了，能用，也能摆。'],
    ferment: ['重新长起来的旧物', '放着放着它把自己续上了，续出来的那半不是原来的样子。'] }
};
// 合炉：两片【不同种类】的碎片。键是两种类名排过序、用 | 连起来，只有这六种组合。
const FUSE = {
  'dream|echo': ['半梦半醒的一句', '一半是梦里的，一半是真说过的，分不出哪句是哪句。'],
  'dream|relic': ['做梦的旧物', '这件东西在做梦，梦见自己还是新的。'],
  'dream|sense': ['一场梦的天气', '梦里那天的天气被单独留了下来，摸得到。'],
  'echo|relic': ['会说话的旧物', '凑近它，它用那件东西自己的声音重复一句。'],
  'echo|sense': ['带着天气的一句', '那句话连着当时的风声一起留下来了。'],
  'relic|sense': ['一件东西的手感', '看不见，但握上去确实有那件东西的分量。']
};
const ODD = ['一团不知道是什么的东西', '你到底往里面放了什么。'];
// 一条配方的名字（做成过的会记进炼金笔记，没做成过的只显示「？」和材料）
const fuseKey = (a, b) => [a, b].sort().join('|');
export const recipeKey = (kind, way, whole, other) =>
  way === 'fuse' ? 'f:' + fuseKey(kind, other) : (whole ? 'w:' : '') + kind + ':' + way;
function recipeRow(kind, way, whole, other){
  if (way === 'fuse') return FUSE[fuseKey(kind, other)] || ODD;
  const table = whole ? WHOLE : CRAFT;
  return (table[kind] && table[kind][way]) || (CRAFT[kind] && CRAFT[kind][way]) || ODD;
}
// 炼金笔记的全表：三十种。⚠️只在这一处生成，界面别再抄一份（施工规则/one-public-mechanism.md）
export function recipeIndex(){
  const out = [];
  for (const kind of Object.keys(SHARD_KINDS)) {
    for (const way of ['distill', 'set', 'ferment']) {
      out.push({ key: recipeKey(kind, way, false), name: CRAFT[kind][way][0], note: CRAFT[kind][way][1],
        how: SHARD_KINDS[kind] + ' · ' + CRAFT_WAYS[way].label });
      out.push({ key: recipeKey(kind, way, true), name: WHOLE[kind][way][0], note: WHOLE[kind][way][1],
        how: '完整的' + SHARD_KINDS[kind] + ' · ' + CRAFT_WAYS[way].label });
    }
  }
  for (const key of Object.keys(FUSE)) {
    const [a, b] = key.split('|');
    out.push({ key: 'f:' + key, name: FUSE[key][0], note: FUSE[key][1],
      how: SHARD_KINDS[a] + ' ＋ ' + SHARD_KINDS[b] + ' · 合炉' });
  }
  return out;
}
export const RECIPE_TOTAL = recipeIndex().length;
export function restoreMade(raw){
  const all = new Set(recipeIndex().map(r => r.key));
  return [...new Set((Array.isArray(raw) ? raw : []).filter(k => all.has(k)))];
}
export const THING_CAP = 120;
// 能摆的地方。⚠️位置写在这儿一处，游戏那头照这个找坐标（别再编第二套）
// ── 开放交互：每一处的家具都点得到（她 2026-09-17：「每一个地方的家具都能交互」）
// ⚠️这张表【只按 kind】：家具本身住在 rules.js 的 MAPS[map].furniture 里，是 codex 那边
//   随着房间一间间长出来的。按 kind 认，他新盖一间屋、摆一张同样的桌子，这边不用改一个字。
//   在这儿另抄一份「哪间屋有哪几件家具」，就是同一层活在两处
//   （施工规则/one-public-mechanism.md），而且他每加一间我就漏一间。
// ⚠️holds＝这上面摆得下东西。原来能摆的只有屋檐、窗台、池边【三个位置】，
//   做出来的第四样往后全堆在盒子里没去处——那句话就写在下面 COLLECTION 那一段的注释里，
//   这一版就是去解它。
export const FURNITURE = {
  hearth:     { label: '壁炉',     look: '炉膛里是昨天的灰，还留着一点温。', holds: true },
  sofa:       { label: '长沙发',   look: '坐垫塌下去一块，那是常坐的那一头。' },
  armchair:   { label: '单人扶手椅', look: '扶手被磨得发亮。' },
  chair:      { label: '椅子',     look: '椅子朝外摆着，像是有人刚站起来。' },
  bench:      { label: '长凳',     look: '长凳够坐下好几个人。' },
  stool:      { label: '矮凳',     look: '矮凳矮得正好，能把下巴搁在膝盖上。' },
  table:      { label: '桌子',     look: '桌面上有几圈杯底留下的印子。', holds: true },
  roundtable: { label: '圆桌',     look: '圆桌边上谁坐都不算主位。', holds: true },
  dining:     { label: '餐桌',     look: '餐桌擦得干干净净，两副碗筷收在一起。', holds: true },
  island:     { label: '料理台',   look: '台面上留着一点面粉。', holds: true },
  kitchen:    { label: '灶台',     look: '锅还温着，水汽在锅盖边上转。', holds: true },
  desk:       { label: '书桌',     look: '桌上摊着写了一半的东西，压着一支笔。', holds: true },
  console:    { label: '边柜',     look: '边柜上空着一块地方，像是特意留出来的。', holds: true },
  shelf:      { label: '架子',     look: '架子上一层一层，最上面那层够不太到。', holds: true },
  bookcase:   { label: '书柜',     look: '书脊高高低低，有几本是倒着塞进去的。', holds: true },
  chest:      { label: '箱子',     look: '箱盖合着，搭扣没扣上。', holds: true },
  wardrobe:   { label: '衣柜',     look: '柜门虚掩着，里面是叠好的衣服。' },
  vanity:     { label: '梳妆台',   look: '镜子擦过了，边角还有一点水痕。', holds: true },
  bath:       { label: '浴缸',     look: '缸沿是凉的，水早就放掉了。' },
  lectern:    { label: '讲台',     look: '讲台上摊着一页没讲完的东西。', holds: true },
  stairs:     { label: '楼梯',     look: '楼梯往上，第三级踩上去会响。' },
  potting:    { label: '花台',     look: '台面上撒着土，指印还在。', holds: true },
  stove:      { label: '小火炉',   look: '炉子上坐着一只壶，壶嘴朝里。', holds: true },
  apothecary: { label: '药柜',     look: '一格一格的小抽屉，标签的字都褪了。', holds: true },
  distiller:  { label: '蒸馏台',   look: '玻璃管里还剩一点没走完的水。', holds: true },
  dryingrack: { label: '晾草架',   look: '一束一束倒挂着，干得发脆。', holds: true },
  millstone:  { label: '水磨',     look: '磨盘停着，缝里卡着几粒没磨完的。', holds: true },
  orrery:     { label: '星仪',     look: '铜环各转各的，推一下会自己走很久。', holds: true },
  telescope:  { label: '望远镜',   look: '镜筒朝着北边，有人调好了没再动。' }
};
// 一件家具的钥匙：哪张图、什么东西、第几件。⚠️钥匙只在这一处拼，
//   存档里记的就是它——换个拼法，她以前摆出去的东西就全掉了。
export const spotKey = (map, kind, index) => map + ':' + kind + ':' + index;
export const spotParse = key => {
  const [map, kind, index] = String(key || '').split(':');
  return MAPS[map] && FURNITURE[kind] && (MAPS[map].furniture || [])[Number(index)]?.kind === kind
    ? { map, kind, index: Number(index), piece: MAPS[map].furniture[Number(index)] } : null;
};
// 老的三个位置一个都不能丢：她已经把东西摆在上面了（雨铃还挂在屋檐下）。
export const SPOTS = { eaves: '屋檐下', sill: '窗台', pond: '池边' };
// 全世界摆得下东西的位置：老三样 ＋ 每间屋里每一件放得住东西的家具。
export function spotsAll(){
  const out = { ...SPOTS };
  for (const [map, m] of Object.entries(MAPS))
    (m.furniture || []).forEach((f, i) => { if (FURNITURE[f.kind]?.holds)
      out[spotKey(map, f.kind, i)] = m.name + '的' + FURNITURE[f.kind].label; });
  return out;
}
export const isSpot = key => Object.hasOwn(SPOTS, key) || !!(spotParse(key) && FURNITURE[spotParse(key).kind].holds);
export const spotLabel = key => Object.hasOwn(SPOTS, key) ? SPOTS[key]
  : (spotParse(key) ? MAPS[spotParse(key).map].name + '的' + FURNITURE[spotParse(key).kind].label : '');
// 站在这儿，够得着的是哪一件。⚠️只有这一处答案：点它、看它、往上摆东西都问它
export function furnitureHere(s, reach = 1.5){
  const list = MAPS[s.map]?.furniture || [];
  let best = null, near = reach;
  list.forEach((f, i) => { if (!FURNITURE[f.kind]) return;
    const dx = Math.max(0, Math.abs(f.x - s.position.x) - f.w / 2), dz = Math.max(0, Math.abs(f.z - s.position.z) - f.d / 2);
    const d = Math.hypot(dx, dz);
    if (d < near){ near = d; best = spotKey(s.map, f.kind, i); } });
  return best;
}
// 点在了哪一件上。⚠️家具本身是障碍，点上去 walkable 一定是 false——
//   所以这一步必须在「走过去」之前问，不然点沙发就是什么都不会发生。
// ⚠️pad 给得大一点，而且要挑【最近的那一件】：镜头是斜的，她点在沙发靠背上，
//   射线落到地面已经是沙发【后面】那一块了。pad 小了就成了「点了没反应」——
//   那正是她说的「不能交互」。挑最近的，是因为放宽之后两件挨着的家具会同时认领。
export function furnitureAtPoint(map, point, pad = .9){
  const list = MAPS[map]?.furniture || [];
  let best = null, near = Infinity;
  list.forEach((f, i) => { if (!FURNITURE[f.kind]) return;
    const dx = Math.max(0, Math.abs(f.x - point.x) - f.w / 2), dz = Math.max(0, Math.abs(f.z - point.z) - f.d / 2);
    const d = Math.hypot(dx, dz);
    if (d <= pad && d < near){ near = d; best = spotKey(map, f.kind, i); } });
  return best;
}
// 站到它旁边的哪一点。⚠️绕着它一圈找【真的站得住】的那一点：
//   凭一个方向硬算，迟早把她送进墙里或者另一件家具里。
export function approachSpot(s, key){
  const at = spotParse(key); if (!at) return null;
  const f = at.piece, out = [];
  for (let ring = 0; ring < 3; ring++){
    const gap = .55 + ring * .45;
    for (let a = 0; a < 16; a++){
      const t = a / 16 * Math.PI * 2;
      const p = { x: f.x + Math.cos(t) * (f.w / 2 + gap), z: f.z + Math.sin(t) * (f.d / 2 + gap) };
      if (walkable(p.x, p.z, at.map, s)) out.push(p);
    }
    if (out.length) break;
  }
  if (!out.length) return null;
  return out.sort((a, b) => Math.hypot(a.x - s.position.x, a.z - s.position.z)
    - Math.hypot(b.x - s.position.x, b.z - s.position.z))[0];
}
// ── 座位（审计，她 2026-09-18：「没有动作只是纯看的也做了」）────────────────────
// ⚠️原来能坐的只有池边、栈桥、小岛：屋里每一张沙发、椅子、长凳点开只有一句描述。
//   现在座位＝地图写死的那几处 ＋ 从家具表【推】出来的（沙发／扶手椅／椅子／长凳／矮凳／浴缸边）：
//   codex 新摆一张椅子，这儿不用改一个字。⚠️只此一份：谁要问「这张地图能坐哪儿」都问 seatsOf。
// 落点：绕着家具找第一个站得住的点（从朝屋子出生点那一侧起找），面朝外坐；他坐的那一点是同一圈上
//   离她六十公分到一米二的下一个点——找不到就不算一处座位，不许把他叠在她身上。
export const SEAT_KINDS = ['sofa', 'armchair', 'chair', 'bench', 'stool', 'bath'];
// 坐下去【坐面有多高】：原来一律按地板算，人就浮在沙发前面（她 2026-09-18：
// 「沙发坐下去对不上建模」）。⚠️这张表只写高度，位置由下面从家具本身推。
export const SEAT_RISE = { sofa: .40, armchair: .42, chair: .45, bench: .40, stool: .36, bath: .30 };
// 挨着坐得下几个人：长的那边够长才坐得下两个，不然他只能在旁边站着
const SEAT_SHARE = 1.7;
const seatCache = new Map();
function seatFromPiece(map, f, key){
  // ⚠️座位记在【家具自己的坐标系】里：相对它的前后左右，加上它自己的朝向。
  //   世界坐标是每次现算的——家具搬到哪儿、转成什么角度，座位跟着走，
  //   以后加一百张沙发也不用再碰这一段（言秋 2026-09-18 的方子）。
  const yaw = Number.isFinite(f.heading) ? f.heading : derivedYaw(map, f);
  const fwd = { x: Math.sin(yaw), z: Math.cos(yaw) };            // 它的正面
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };          // 它的右手边
  const deep = Math.abs(fwd.x) * f.w + Math.abs(fwd.z) * f.d;      // 前后厚度
  const wide = Math.abs(right.x) * f.w + Math.abs(right.z) * f.d;  // 左右长度
  const on = { x: f.x + fwd.x * deep * .18, z: f.z + fwd.z * deep * .18 };
  // 走过去先站哪儿：从正面往外一步；正面站不住就绕着找（家具挪进墙角时的兜底）
  const ring = [];
  for (let a = 0; a < 16; a++){
    const t = Math.atan2(fwd.x, fwd.z) + (a % 2 ? -1 : 1) * Math.ceil(a / 2) * Math.PI / 8;
    const out = { x: Math.sin(t), z: Math.cos(t) };
    const reach = (Math.abs(out.x) * f.w + Math.abs(out.z) * f.d) / 2 + .55;
    const p = { x: f.x + out.x * reach, z: f.z + out.z * reach };
    if (walkable(p.x, p.z, map)) ring.push(p);
  }
  const stand = ring[0]; if (!stand) return null;
  const rise = SEAT_RISE[f.kind] || 0;
  // 长沙发、长凳坐得下两个：他坐在同一张上，沿着它自己的左右方向错开；
  // ⚠️坐不下两个的（单人椅、矮凳）才要在旁边找一块站得住的地方——找不到就不算一处座位。
  const beside = ring.find(p => { const d = Math.hypot(p.x - stand.x, p.z - stand.z); return d >= .6 && d <= 1.4; });
  const share = wide >= SEAT_SHARE
    ? { x: on.x + right.x * .62, z: on.z + right.z * .62, rise }
    : beside ? { ...beside, rise: 0 } : null;
  if (!share) return null;
  return { x: on.x, z: on.z, rise, approach: { x: stand.x, z: stand.z },
    heading: yaw, companion: share,
    label: '在' + FURNITURE[f.kind].label + '边陪你坐着', piece: key };
}
// 家具没写朝向时替它推一个（80 件里有 23 件写了）。⚠️这是兜底不是依据：
//   ① 长沙发、长凳的长边是靠背，人冲短边那一侧坐；② 屋里摆家具是围着桌子、壁炉坐，
//   所以先看哪一侧有可看的东西，都没有才挑更空的那一侧。
const FACING = new Set(['table', 'roundtable', 'dining', 'desk', 'hearth', 'island', 'kitchen']);
function derivedYaw(map, f){
  const long = f.w >= f.d, square = Math.abs(f.w - f.d) < .25;
  const axes = square ? [{ x: 0, z: 1 }, { x: 1, z: 0 }] : [long ? { x: 0, z: 1 } : { x: 1, z: 0 }];
  const score = dir => {
    const half = Math.abs(dir.x) ? f.w / 2 : f.d / 2, wide = Math.abs(dir.x) ? f.d / 2 : f.w / 2;
    const look = (MAPS[map].furniture || []).reduce((n, q) => {
      if (!FACING.has(q.kind)) return n;
      const along = (q.x - f.x) * dir.x + (q.z - f.z) * dir.z;
      const aside = Math.abs((q.x - f.x) * dir.z + (q.z - f.z) * dir.x);
      return n + (along > half && along < half + 2.6 && aside < wide + .9 ? 1 : 0);
    }, 0);
    const open = [.7, 1.3, 2, 2.8].reduce((n, d) =>
      n + (walkable(f.x + dir.x * (half + d), f.z + dir.z * (half + d), map) ? 1 : 0), 0);
    return look * 100 + open;
  };
  const face = axes.flatMap(a => [a, { x: -a.x, z: -a.z }]).sort((p, q) => score(q) - score(p))[0];
  return Math.atan2(face.x, face.z);
}
export function seatAt(map, p, pad = 1.3){
  if (!p) return '';
  let best = '', near = Infinity;
  for (const [id, seat] of Object.entries(seatsOf(map))){
    const d = Math.hypot(seat.x - p.x, seat.z - p.z);
    if (d < pad && d < near){ near = d; best = id; }
  }
  return best;
}
export function seatsOf(map){
  if (!MAPS[map]) return {};
  if (seatCache.has(map)) return seatCache.get(map);
  const out = { ...(MAPS[map].seats || {}) };
  (MAPS[map].furniture || []).forEach((f, i) => { if (!SEAT_KINDS.includes(f.kind) || !FURNITURE[f.kind]) return;
    const key = spotKey(map, f.kind, i), seat = seatFromPiece(map, f, key); if (seat) out[key] = seat; });
  seatCache.set(map, out); return out;
}
// 看一眼。⚠️一枪都不打，而且【先说她自己的东西】：摆在上面的那一样、封在那儿的那一片，
//   都是她真放上去的。没有她的东西时才说这件家具本来的样子——一句都不编。
// ── 一格时间＝一小片地方，不是一个点（她 2026-09-18：「能不能圈出一个活动范围」）──
// 原来一格时间只有一个落点，走到就站到下一格，所以同一格里他永远在做同一件事。
// ⚠️范围【推导】出来，不手写一张点位表：`MAPS[map].sites` 和 `furniture` 已经在那儿了，
//   codex 那边新盖一间屋、摆几件家具，那间屋的活动范围自己就长出来
//   （施工规则/one-public-mechanism.md）。手写的话就是又一张我每次都会漏的表。
// ⚠️室外半径不能大：实测 8 米时「月湖北岸」会把集市那几个摊位算进来（坐标上挨着），
//   他会从湖边溜达进集市——那不是「在湖北岸活动」，那是乱跑。
// ⚠️室内反过来要放宽：屋子本来就是一个整体（水磨工坊 20×14），
//   而且室内够不到别的地图，走到屋子那头也还是「在这间屋里」，漏不出去。
export const AREA_REACH = { interior: 7.5, outdoor: 5 };
export const areaReach = map => MAPS[map]?.interior ? AREA_REACH.interior : AREA_REACH.outdoor;
// 站在这一件旁边，人在做什么。⚠️按 kind 认，和 FURNITURE 一张表同一个形状。
//   认不出来的一律 'rest'（站着待一会儿）——不许为了热闹给它编一个动作。
const SPOT_GESTURE = {
  desk: 'read', lectern: 'read', bookcase: 'read', shelf: 'read', console: 'read',
  chair: 'sit', stool: 'sit', bench: 'sit', sofa: 'sit', armchair: 'sit',
  potting: 'water', dryingrack: 'gather', apothecary: 'gather', chest: 'gather',
  kitchen: 'stir', island: 'stir', distiller: 'stir', millstone: 'stir',
  orrery: 'read', telescope: 'read', hearth: 'rest', vanity: 'rest'
};
// 这一带有哪几处可待。⚠️只此一份：他的日程和以后别人要用的都问它。
//   sites 也算（她 2026-09-18 点名：「算上sites」）——不算的话室外那些地方一个点都没有。
export function areaSpots(map, center, reach = areaReach(map)){
  const m = MAPS[map]; if (!m || !center) return [];
  const out = [], seen = new Set();
  const near = q => Math.hypot(q.x - center.x, q.z - center.z) <= reach;
  // ⚠️挨得太近的不算第二处：公共厅的「壁炉旁」(site) 和「壁炉」(家具) 就是同一块地方，
  //   都收进来的话他会在原地挪半米，看着像抽搐。
  const apart = q => out.every(x => Math.hypot(x.target.x - q.x, x.target.z - q.z) > 1.2);
  for (const [id, site] of Object.entries(m.sites || {})){
    if (!site.target || !near(site.target) || !apart(site.target)) continue;
    const beside = (m.furniture || []).find(q => FURNITURE[q.kind]
      && Math.hypot(q.x - site.target.x, q.z - site.target.z) <= 2.5);
    out.push({ key: 'site:' + map + ':' + id, label: site.label, target: { ...site.target },
      gesture: (beside && SPOT_GESTURE[beside.kind]) || 'rest' });
    seen.add(site.label);
  }
  (m.furniture || []).forEach((f, i) => {
    const kind = FURNITURE[f.kind]; if (!kind || !near(f)) return;
    // ⚠️名字套着名字的也是同一样东西：「星仪」⊂「铜环星仪」、「壁炉」⊂「壁炉旁」。
    //   位置差着两米，可名字一前一后念出来就是同一处，读着像重复。
    if ([...seen].some(x => x.includes(kind.label) || kind.label.includes(x))) return;
    // 家具本身是障碍，落点要站到它旁边去；站不住的就不算一处
    const at = approachSpot({ map, position: center }, spotKey(map, f.kind, i));
    if (!at || !apart(at)) return;
    out.push({ key: spotKey(map, f.kind, i), label: kind.label, target: at, gesture: SPOT_GESTURE[f.kind] || 'rest' });
    seen.add(kind.label);
  });
  return out;
}
// ── 他偏爱哪几处（她 2026-09-18：「有些东西就会有些人干得多有些人干得少」）──
// ⚠️不许用轮盘：「每一处都被公平地轮到」正是人不会有的样子。真人是那把椅子天天坐、
//   磨盘一个月碰一次。所以按【稳定的权重】抽：同一个存档里每次都一样，认得出是习惯；
//   冷门那几处稀、但永远不为零，不会结构性地「永远临幸不到」。
// ⚠️⚠️这一层【不是他的性格】，和 companion.mjs 那张地板表同一个待遇：
//   它只负责「别每次都一样」，一个字都不编他喜欢什么——纯 hash 出来的偏好换个角色
//   照样成立，而「换个角色还照样成立的就是写坏了」（v69.55 撤掉按性格分的三张表那次）。
//   真正照着人设来的那一份在季节手册那一枪里；这张表只是在那之前别让一格时间长得一模一样。
// ⚠️种子带 charId：三个邻居住同一间屋，各有各的习惯位置；换个同行者，这间屋的用法就变了。
export const spotWeight = (s, who, key) => 1 + hash((s?.epoch || 'initial') + ':taste:' + (who || '') + ':' + key) % 7;
// 这一格里挨着待的那几处。⚠️不放回，免得同一格里重复；只看第几天和第几格，
//   所以同一天同一格进来几次都一样（重开不瞬移，也不用在存档里记状态）。
export function areaPick(s, who, spots, seed, n){
  const pool = spots.slice(), out = [];
  for (let i = 0; i < n && pool.length; i++){
    const total = pool.reduce((sum, q) => sum + spotWeight(s, who, q.key), 0);
    let roll = hash(seed + ':' + i) % total;
    let at = pool.length - 1;
    for (let j = 0; j < pool.length; j++){ roll -= spotWeight(s, who, pool[j].key); if (roll < 0){ at = j; break; } }
    out.push(pool.splice(at, 1)[0]);
  }
  return out;
}
export function lookText(s, key){
  const at = spotParse(key); if (!at) return '';
  const thing = placedAt(s, key);
  const lines = [FURNITURE[at.kind].look];
  if (thing) lines.push('「' + thing.name + '」就摆在上面。');
  return lines.join('');
}
export function travelImageFields(x){return x?.recipe==='travelframe'&&validImage(x.image)?{image:x.image,sourceId:String(x.sourceId||'').slice(0,160),memory:restorePuzzleMemory(x.memory),back:restoreBack(x.back)}:{};}
export function receiveTravelArt(s,item){
 if(!item?.id||!validImage(item.src))throw Error('这张照片暂时无法带回，请重新打开相册。');
 if([...(s.things||[]),...(s.collection||[])].some(t=>t.sourceId===item.id))return s;
 if((s.things||[]).length>=THING_CAP)throw Error('屋里的东西放满了，先留一些到收藏馆。');
 const thing={id:'tf_'+String(item.id).replace(/[^a-zA-Z0-9]/g,'').slice(-32),sourceId:item.id,image:item.src,memory:restorePuzzleMemory(item.memory),back:restoreBack({at:item.at,day:item.day,...(item.back||{})}),name:item.kind==='puzzle'?'旅行拼图相框':'旅行照片相框',note:String(item.label||'列车窗外的风景').slice(0,200),kind:'relic',way:'set',recipe:'travelframe',from:String(item.label||'').slice(0,240),day:s.day,openDay:0,spot:null};
 return noteHappening({...s,things:[thing,...s.things]},'made','把一幅旅行相框带回了庭院');
}
// 已经带回庭院的相框，列车那边补写了背面：跟着改（屋里的、馆里的都算）
export function updateTravelBack(s,sourceId,item){const back=restoreBack({at:item?.at,day:item?.day,...(item?.back||{})}),fix=t=>t.sourceId===sourceId?{...t,back}:t;return {...s,things:(s.things||[]).map(fix),collection:(s.collection||[]).map(fix)};}
// 庭院这边也能在背面写字（她 2026-09-25）：只改这一个相框的背面，屋里的、馆里的都算
export function noteTravelBack(s,sourceId,who,text,companionName){if(who!=='you'&&who!=='companion')throw Error('不知道是谁写的');let hit=false;const fix=t=>{if(t.sourceId!==sourceId||t.recipe!=='travelframe')return t;hit=true;return {...t,back:restoreBack({...(t.back||{}),[who]:String(text||'').trim(),...(companionName?{companionName}:{})})};};const out={...s,things:(s.things||[]).map(fix),collection:(s.collection||[]).map(fix)};if(!hit)throw Error('庭院里找不到这个相框了');return out;}
export function restoreThings(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.name).slice(0, THING_CAP).map(x => ({
    ...travelImageFields(x), id: String(x.id).slice(0, 40), name: trimText(x.name, 24), note: trimText(x.note, 200),
    kind: shardKind(x.kind) || 'relic', way: Object.hasOwn(CRAFT_WAYS, x.way) ? x.way : 'set',
    recipe: typeof x.recipe === 'string' ? x.recipe.slice(0, 40) : '',
    from: trimText(x.from, 240), day: Math.max(1, count(x.day)),
    openDay: Math.max(0, count(x.openDay)), spot: isSpot(x.spot) ? x.spot : null
  }));
}
const shardOf = (s, id) => (s.shards || []).find(x => x.id === id) || null;
export function craftError(s, shardId, way, secondId){
  if (!Object.hasOwn(CRAFT_WAYS, way)) return '还没有这种做法。';
  if (s.map !== 'garden') return '锅在庭院里。';
  const first = shardOf(s, shardId);
  if (!first) return '先挑一片碎片。';
  if (!CRAFT_WAYS[way].pair) return '';
  const second = shardOf(s, secondId);
  if (!second || second.id === first.id) return '合炉要两片碎片，再挑一片。';
  if (second.kind === first.kind) return '两片一样的合不出第三样来，换一种。';
  return '';
}
export function craftThing(s, shardId, way, secondId){
  if (craftError(s, shardId, way, secondId)) return s;
  const first = shardOf(s, shardId), pair = CRAFT_WAYS[way].pair;
  const second = pair ? shardOf(s, secondId) : null;
  // 合炉那一样归在【排在前面那种】名下，免得同一炉按挑的先后算出两个不同的键
  const kind = pair ? [first.kind, second.kind].sort()[0] : first.kind;
  const whole = pair ? false : first.whole === true;
  const row = recipeRow(first.kind, way, whole, second && second.kind);
  const key = recipeKey(first.kind, way, whole, second && second.kind);
  const days = CRAFT_WAYS[way].days || 0;
  const used = pair ? first.text + ' ／ ' + second.text : first.text;
  const thing = { id: 'th_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    name: row[0], note: row[1], kind, way, recipe: key, from: trimText(used, 240), day: s.day,
    openDay: days ? s.day + days : 0, spot: null };
  const gone = new Set([first.id, ...(second ? [second.id] : [])]);
  const out = noteHappening({ ...s, shards: (s.shards || []).filter(x => !gone.has(x.id)),
    made: restoreMade([...(s.made || []), key]),
    things: [thing, ...(s.things || [])].slice(0, THING_CAP) },
    'made', '在锅里' + CRAFT_WAYS[way].label + '出一样「' + thing.name + '」');
  return centralLit(out) && !centralLit(s) ? noteHappening(out, 'world', '炼金笔记写满了三十种做法，收藏馆中央那座展台亮了') : out;
}
// 月露倒进锅里（她 2026-09-17）。⚠️月露原来唯一的用处是「代替一壶水浇花」，
//   谁都不会特地去炼它。现在它管【发酵那一路】：封着的那一样，倒一滴当天就开。
export const hastenError = (s, id) => {
  const t = (s.things || []).find(x => x.id === id);
  if (!t) return '没有这一样东西。';
  if (!t.openDay || s.day >= t.openDay) return '这一样本来就开着。';
  if (count(s.potions) < 1) return '没有月露了。井底的星砂三份能炼一颗。';
  return '';
};
export function hastenThing(s, id){
  if (hastenError(s, id)) return s;
  const t = (s.things || []).find(x => x.id === id);
  return noteHappening({ ...s, potions: count(s.potions) - 1,
    things: (s.things || []).map(x => x.id === id ? { ...x, openDay: s.day } : x) },
    'made', '倒了一滴月露，「' + t.name + '」提前开了');
}
// 发酵的那几样：到日子才算做好（在那之前摆不出去，也读不到）
export const thingReady = (s, t) => !t.openDay || s.day >= t.openDay;
export function placeThing(s, id, spot){
  const t = (s.things || []).find(x => x.id === id);
  if (!t || !thingReady(s, t) || (spot && !isSpot(spot))) return s;
  const out = { ...s, things: (s.things || []).map(x => x.id === id ? { ...x, spot: spot || null }
    : (spot && x.spot === spot ? { ...x, spot: null } : x)) };   // 一个位置只摆一样
  // 她摆出来这件事要有回响（她 2026-09-18：「摆在家里他路过会看见并提起」）。
  // 收回来不记——那不是一件发生过的事，只是撤掉。
  return spot ? noteHappening(out, 'set', '把「' + t.name + '」摆在' + (spotLabel(spot) || '家里') + '了') : out;
}
export const placedAt = (s, spot) => (s.things || []).find(x => x.spot === spot) || null;
// 雨铃：真下雨、真挂在屋檐下，才会响。天气由游戏那头算，这儿只回答「响不响」
export const bellRings = s => {
  const t = placedAt(s, 'eaves');
  return !!(t && t.name === '雨铃' && ['细雨', '细雪'].includes(weather(s.day, s.epoch)));
};
// ── 收藏馆（公共厅里，她 2026-09-17 点的）─────────────────────────────
// ⚠️这一条也一枪都不打。它要解决的是【出口】：屋檐、窗台、池边一共只有三个位置，
//   做出来的第四样往后全堆在盒子里没去处——挖了炼了也就没意思了。
//   捐进馆里的东西【永不删除】：背包会被 THING_CAP 挤掉，这一份不会。
// ⚠️功绩只记【第一次捐进来的那一种】。同一样捐十件不多算一分，
//   不然它就变成一条刷分的路，而不是一间馆。
// ── 集市开市（她 2026-09-18 的 5）：功绩原来只写不读。现在它是集市上的钱——
//   替村里做过事（交委托、往馆里留新的一种）摊主才来；买的都是能递给人的东西。
// ⚠️一枪不打；摊位和货写在这一处，游戏那头照它画
export const MARKET_GOODS = {
  herb: { stall: '药草棚', label: '一束铃叶草', cost: 1, give: { herbs: 2 } },
  mushroom: { stall: '药草棚', label: '荧光菇', cost: 1, give: { mushrooms: 1 } },
  flower: { stall: '小花车', label: '月光花', cost: 1, give: { harvest: 1 } },
  dew: { stall: '茶摊', label: '月露', cost: 2, give: { potions: 1 } },
  sand: { stall: '奇物摊', label: '星砂 ×3', cost: 2, give: { sand: 3 } }
};
export const MARKET_REACH = 2.6;
// 集市按日子来（她 2026-09-18：「按日期跟星露谷一样，而不是一次之后就来」）：
//   每季 4、8、12 日，跟公告栏换板子同一个节奏；不是集市日摊子空着、摊主不在。
// ⚠️每次上摊的货不一样：五样常货里按存档号＋那一天抽三样，再加一样那天才有的稀罕货。
export const MARKET_EVERY = 4;
export const marketDay = day => seasonOf(day).day % MARKET_EVERY === 0;
export const nextMarketDay = day => { let d = Math.max(1, count(day)) + 1; while (!marketDay(d)) d++; return d; };
export const marketOpen = s => marketDay(s.day);
export const MARKET_RARE = {
  seed: { stall: '奇物摊', label: '一颗梦种', cost: 3, rare: true },
  whole: { stall: '奇物摊', label: '一片完整的碎片', cost: 3, rare: true }
};
export function marketStock(s){
  if (!marketDay(s.day)) return [];
  const regular = Object.keys(MARKET_GOODS), pick = [];
  let h = hash(String(s.epoch) + ':market:' + s.day);
  const pool = [...regular];
  for (let i = 0; i < 3 && pool.length; i++){ h = (h * 1103515245 + 12345) >>> 0; pick.push(pool.splice(h % pool.length, 1)[0]); }
  const rares = Object.keys(MARKET_RARE);
  pick.push(rares[hash(String(s.epoch) + ':rare:' + s.day) % rares.length]);
  return pick;
}
export const marketGood = id => MARKET_GOODS[id] || MARKET_RARE[id] || null;
// 站在集市中间、或任何一座摊子跟前，都算到了集市（摊子几何来自 rules 的 garden.market.stalls）
export const atMarket = s => s.map === 'garden' && (Math.hypot(s.position.x - MAPS.garden.sites.market.target.x, s.position.z - MAPS.garden.sites.market.target.z) <= MARKET_REACH
  || (MAPS.garden.market?.stalls || []).some(st => Math.hypot(s.position.x - st.x, s.position.z - st.z) <= Math.max(st.w, st.d) / 2 + 1.1));
export function marketError(s, id){
  const g = marketGood(id);
  if (!g) return '摊上没有这一样。';
  if (!atMarket(s)) return '先走到灯串集市。';
  if (!marketOpen(s)) return '今天不是集市日，下次是第 ' + nextMarketDay(s.day) + ' 天。';
  if (!marketStock(s).includes(id)) return '这一样今天没上摊。';
  if (count(s.deeds) < g.cost) return '功绩不够：这一样要 ' + g.cost + ' 分，你有 ' + count(s.deeds) + ' 分。';
  if (g.rare && (s.shards || []).length >= SHARD_CAP) return '碎片盒满了，先整理一下。';
  return '';
}
// 稀罕货：从井底那口池子里取一片（文字仍是模型早先写好的那批），只是外形／完整度由摊主定
function grantRare(s, id){
  const pool = s.vein || [], row = pool[0] || { kind: 'dream', text: '摊主用软布包好递过来，说是从井边捡的。', whole: false };
  const seeded = { ...s, vein: [{ ...row, kind: id === 'seed' ? 'dream' : row.kind, whole: id === 'whole' ? true : row.whole }, ...pool.slice(1)] };
  return takeShard(seeded, 0, id === 'seed' ? 'seed' : null);
}
export function buy(s, id){
  if (marketError(s, id)) return s;
  const g = marketGood(id);
  let out = { ...s, deeds: count(s.deeds) - g.cost, spent: count(s.spent) + g.cost };
  if (g.rare) out = grantRare(out, id);
  else for (const [k, n] of Object.entries(g.give)) out[k] = count(out[k]) + n;
  return noteHappening(out, 'world', '在' + g.stall + '用功绩换了' + g.label);
}
// ── 夜市与吃的（她 2026-09-18：「做夜市，卖的跟吃的有关」「都可以宝宝做吧」）────────
// ⚠️频率：一季一次、两晚（每季 13、14 日，天黑后开）。集市是白天四天一次的例行，夜市是一季一回的节日；
//   两晚是为了「第一晚没赶上／功绩不够，第二晚还来得及」，不是刷两遍。
// ⚠️摊主是村里住着的邻居：按住进来的次序各占一座摊（药草棚、奇物摊、茶摊）；没邻居就是白天那两位摊主。
//   跟邻居买一样，交情走一格（一晚一位记一次）。
// ⚠️钱还是功绩；功绩不够的用材料换（swap）：夜市是给吃的一个来处，不是第二道功绩闸。
// ⚠️吃的不进主线：没有饱腹条、不加属性。它接进来的是三处已有的进度——
//   礼物簿（「吃的」一类，他对它有自己的态度）、相处册（一起吃过东西、逛过一整个夜市）、
//   食谱册（十二样尝没尝过、会不会做）。两条轻 buff（热茶：今天做事快三分钟；热汤：今天下井不怕雨雪）。
export const FOODS = {
  tea:      { label: '一盏热茶',   stall: 'tea',    cost: 1, swap: { herbs: 2 },              cook: { herbs: 2 },              buff: 'quick', note: '喝下去手脚都暖，今天做什么都快一点' },
  roast:    { label: '烤荧光菇',   stall: 'herbs',  cost: 1, swap: { mushrooms: 1 },          cook: { mushrooms: 1 },          note: '边上烤得微焦，中间还亮着' },
  candy:    { label: '月露糖',     stall: 'tea',    cost: 1, swap: { potions: 1 },            cook: { potions: 1 },            note: '含着化得慢，尾巴有一点苦' },
  cake:     { label: '铃叶糕',     stall: 'herbs',  cost: 2, swap: { herbs: 2, harvest: 1 },  cook: { herbs: 2, harvest: 1 },  note: '面上压着一片铃叶的印子' },
  dumpling: { label: '星砂汤圆',   stall: 'curios', cost: 2, swap: { sand: 3 },               cook: { sand: 3 },               note: '碗底沉着几粒亮的' },
  soup:     { label: '一碗热汤',   stall: 'curios', cost: 2, swap: { mushrooms: 1, herbs: 2 }, cook: { mushrooms: 1, herbs: 2 }, buff: 'warm', note: '喝完下井也不觉得冷，雨雪天也不慢' },
  wine:     { label: '一小杯酒酿', stall: 'curios', cost: 2, note: '甜的，喝完脸热' },
  skewer:   { label: '花串',       stall: 'herbs',  cost: 1, swap: { harvest: 1 },            note: '月光花瓣裹了糖串起来' },
  spring:   { label: '春饼',       stall: 'tea',    cost: 2, season: 0, note: '只在春天的夜市有' },
  summer:   { label: '冰镇月露',   stall: 'tea',    cost: 2, season: 1, note: '只在夏天的夜市有' },
  autumn:   { label: '桂花糖藕',   stall: 'tea',    cost: 2, season: 2, note: '只在秋天的夜市有' },
  winter:   { label: '暖梨汤',     stall: 'tea',    cost: 2, season: 3, buff: 'warm', note: '只在冬天的夜市有' }
};
export const FOOD_TOTAL = Object.keys(FOODS).length, PANTRY_CAP = 12, RECIPE_COST = 2;
export const FOOD_BUFFS = { quick: '今天做事快三分钟', warm: '今天下井不怕雨雪' };
export const FIRST_RECIPES = ['tea', 'roast'];
export const NIGHT_MARKET_DAYS = [13, 14];
export const nightMarketDay = day => NIGHT_MARKET_DAYS.includes(seasonOf(day).day);
export const nightMarketOpen = s => nightMarketDay(s.day) && count(s.minute) >= seasonOf(s.day).dusk;
export const nextNightMarket = day => { let d = Math.max(1, count(day)) + 1; while (!nightMarketDay(d)) d++; return d; };
export const foodOf = id => Object.hasOwn(FOODS, id || '') ? FOODS[id] : null;
export const recipeOf = id => String(id || '').startsWith('recipe:') && foodOf(String(id).slice(7)) && FOODS[String(id).slice(7)].cook ? String(id).slice(7) : '';
export function restorePantry(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && foodOf(x.id) && x.uid).slice(0, PANTRY_CAP)
    .map(x => ({ uid: String(x.uid).slice(0, 24), id: x.id, day: Math.max(1, count(x.day)), from: trimText(x.from, 40) || 'fair' }));
}
export const restoreTasted = raw => [...new Set((Array.isArray(raw) ? raw : []).filter(id => foodOf(id)))];
export const restoreRecipes = raw => [...new Set([...FIRST_RECIPES, ...(Array.isArray(raw) ? raw : []).filter(id => foodOf(id) && FOODS[id].cook)])];
export const restoreBuffs = raw => Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? raw : {}).filter(([k, v]) => Object.hasOwn(FOOD_BUFFS, k) && Number.isInteger(v) && v > 0));
export const hasBuff = (s, id) => restoreBuffs(s.buffs)[id] === s.day;
export function restoreFairs(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && count(x.day) > 0).slice(0, 40)
    .map(x => ({ day: count(x.day), vendors: [...new Set((Array.isArray(x.vendors) ? x.vendors : []).map(v => String(v).slice(0, 40)))].slice(0, 6) }));
}
// 那一晚上摊的：三样常货按存档号＋哪一季抽（两晚同一批：第一晚没赶上第二晚还在），加那一季才有的一样，
// 再加一张她还不会的食谱（会做的多了就没有）
export function nightStock(s){
  if (!nightMarketDay(s.day)) return [];
  const season = seasonOf(s.day), key = String(s.epoch) + ':night:' + season.start;
  const pool = Object.keys(FOODS).filter(id => FOODS[id].season == null), pick = [];
  let h = hash(key);
  for (let i = 0; i < 3 && pool.length; i++){ h = (h * 1103515245 + 12345) >>> 0; pick.push(pool.splice(h % pool.length, 1)[0]); }
  const special = Object.keys(FOODS).find(id => FOODS[id].season === season.index % 4); if (special) pick.push(special);
  const known = restoreRecipes(s.recipes), unknown = Object.keys(FOODS).filter(id => FOODS[id].cook && !known.includes(id));
  if (unknown.length) pick.push('recipe:' + unknown[hash(key + ':recipe') % unknown.length]);
  return pick;
}
// 摊主：邻居按住进来的次序各占一座；那一座没邻居就还是白天的摊主
export const VENDOR_STALLS = ['herbs', 'curios', 'tea'];
export function vendorAt(s, stall){
  const i = VENDOR_STALLS.indexOf(stall); if (i < 0) return null;
  return restoreNeighbors(s.neighbors)[i] || null;
}
export const vendorOfFood = (s, id) => { const f = foodOf(recipeOf(id) || id); return f ? vendorAt(s, recipeOf(id) ? 'tea' : f.stall) : null; };
const canSwap = (s, swap) => !!swap && Object.entries(swap).every(([k, n]) => count(s[k]) >= n);
// 怎么付：功绩够就付功绩；不够、手上有材料就拿材料换
export function foodPay(s, id){
  const r = recipeOf(id);
  if (r) return count(s.deeds) >= RECIPE_COST ? { deeds: RECIPE_COST } : null;
  const f = foodOf(id); if (!f) return null;
  if (count(s.deeds) >= f.cost) return { deeds: f.cost };
  return canSwap(s, f.swap) ? { swap: f.swap } : null;
}
export const foodLabel = id => recipeOf(id) ? '「' + FOODS[recipeOf(id)].label + '」的做法' : foodOf(id) ? FOODS[id].label : '';
export function foodError(s, id){
  const r = recipeOf(id), f = foodOf(id);
  if (!r && !f) return '摊上没有这一样。';
  if (!atMarket(s)) return '先走到灯串集市。';
  if (!nightMarketDay(s.day)) return '今天没有夜市，下次是第 ' + nextNightMarket(s.day) + ' 天。';
  if (!nightMarketOpen(s)) return '夜市天黑才开，先做点别的。';
  if (!nightStock(s).includes(id)) return '这一样今晚没上摊。';
  if (r && restoreRecipes(s.recipes).includes(r)) return '这个做法你已经会了。';
  if (!r && restorePantry(s.pantry).length >= PANTRY_CAP) return '篮子装满了，先吃一点。';
  if (!foodPay(s, id)) return r ? '功绩不够：一张做法要 ' + RECIPE_COST + ' 分，你有 ' + count(s.deeds) + ' 分。'
    : '功绩不够：这一样要 ' + f.cost + ' 分' + (f.swap ? '，或者拿' + Object.entries(f.swap).map(([k, n]) => BAG_LABELS[k] + ' ×' + n).join('、') + '换' : '') + '。';
  return '';
}
export const BAG_LABELS = { herbs: '铃叶草', mushrooms: '荧光菇', potions: '月露', harvest: '月光花', sand: '星砂' };
// 哪样货摆在哪座摊（白天的货、夜里的吃的、做法都在这一处查）；摊主站在摊后正中
const STALL_OF = { herb: 'herbs', mushroom: 'herbs', flower: 'flowers', dew: 'tea', sand: 'curios', seed: 'curios', whole: 'curios' };
export const stallOf = id => recipeOf(id) ? 'tea' : foodOf(id) ? FOODS[id].stall : STALL_OF[id] || null;
export function vendorSpot(kind){
  const st = (MAPS.garden.market?.stalls || []).find(x => x.kind === kind); if (!st) return null;
  return { x: st.x - Math.sin(st.heading) * (st.d / 2 + .55), z: st.z - Math.cos(st.heading) * (st.d / 2 + .55), heading: st.heading + Math.PI, label: st.label };
}
const nextUid = rows => 'f' + (rows.reduce((m, p) => Math.max(m, Number(String(p.uid).slice(1)) || 0), 0) + 1);
function pay(s, how){
  if (how.deeds) return { ...s, deeds: count(s.deeds) - how.deeds, spent: count(s.spent) + how.deeds };
  const out = { ...s }; for (const [k, n] of Object.entries(how.swap)) out[k] = count(out[k]) - n; return out;
}
// 记一晚：这一晚来过、跟谁买过；两晚都来过相处册多一格
function noteFair(s, vendor){
  const rows = restoreFairs(s.fairs), row = rows.find(x => x.day === s.day) || { day: s.day, vendors: [] };
  const vid = vendor ? String(vendor.charId) : '';
  const fresh = vid && !row.vendors.includes(vid);
  const next = { ...row, vendors: fresh ? [...row.vendors, vid] : row.vendors };
  let out = { ...s, fairs: [next, ...rows.filter(x => x.day !== s.day)].slice(0, 40) };
  if (fresh) out = bumpMeet(out, vid, 1);
  const season = seasonOf(s.day), both = NIGHT_MARKET_DAYS.every(d => out.fairs.some(x => x.day === season.start + d - 1));
  return both ? noteBond(out, 'fair', '一起逛完了' + season.name + '天的夜市') : out;
}
export function buyFood(s, id){
  if (foodError(s, id)) return s;
  const how = foodPay(s, id), vendor = vendorOfFood(s, id), r = recipeOf(id);
  let out = pay(s, how);
  if (r) out = { ...out, recipes: [...restoreRecipes(out.recipes), r] };
  else { const rows = restorePantry(out.pantry); out = { ...out, pantry: [...rows, { uid: nextUid(rows), id, day: s.day, from: vendor ? String(vendor.charId) : 'fair' }] }; }
  out = noteFair(out, vendor);
  const who = vendor ? '跟' + vendor.name : '在夜市';
  return noteHappening(out, 'world', who + (how.deeds ? '用功绩换了' : '拿东西换了') + foodLabel(id));
}
export const pantryItem = (s, uid) => restorePantry(s.pantry).find(p => p.uid === uid) || null;
export function eatError(s, uid){
  if (!pantryItem(s, uid)) return '篮子里没有这一样。';
  if (sleepPose(s)) return '先起来再吃。';
  return '';
}
// 吃：尝过记进食谱册；他在跟前就是一起吃的（相处册一格）；那两条轻 buff 只管今天
export function eat(s, uid){
  if (eatError(s, uid)) return s;
  const row = pantryItem(s, uid), f = FOODS[row.id], together = companionNearby(s);
  let out = { ...s, pantry: restorePantry(s.pantry).filter(p => p.uid !== uid), tasted: [...new Set([...restoreTasted(s.tasted), row.id])] };
  if (f.buff) out = { ...out, buffs: { ...restoreBuffs(out.buffs), [f.buff]: s.day } };
  if (together) out = noteBond(out, 'meal', '和' + s.companion.name + '一起吃了' + f.label);
  return noteHappening(out, 'world', (together ? '和' + s.companion.name + '一起' : '') + '吃了' + f.label + (f.buff ? '，' + FOOD_BUFFS[f.buff] : ''));
}
export function cookError(s, id){
  const f = foodOf(id);
  if (!f || !f.cook) return '这一样不是灶上能做的。';
  if (s.map !== 'home') return '小灶在自己家里。';
  if (!restoreRecipes(s.recipes).includes(id)) return '还不会做这个，夜市上有它的做法。';
  if (restorePantry(s.pantry).length >= PANTRY_CAP) return '篮子装满了，先吃一点。';
  if (!canSwap(s, f.cook)) return '材料不够：要' + Object.entries(f.cook).map(([k, n]) => BAG_LABELS[k] + ' ×' + n).join('、') + '。';
  return '';
}
export function cook(s, id){
  if (cookError(s, id)) return s;
  const rows = restorePantry(s.pantry), out = pay(s, { swap: FOODS[id].cook });
  return noteHappening({ ...out, pantry: [...rows, { uid: nextUid(rows), id, day: s.day, from: 'home' }] }, 'made', '在自家灶上做了' + FOODS[id].label);
}
// 手机那一册和游戏里的小页都照这一份画
export function foodBook(s){
  const tasted = restoreTasted(s.tasted), known = restoreRecipes(s.recipes), buffs = restoreBuffs(s.buffs);
  return { total: FOOD_TOTAL, tasted: tasted.length, open: nightMarketOpen(s), tonight: nightMarketDay(s.day), next: nextNightMarket(s.day),
    stock: nightStock(s).map(id => ({ id, label: foodLabel(id), vendor: vendorOfFood(s, id)?.name || '' })),
    items: Object.entries(FOODS).map(([id, f]) => ({ id, label: f.label, note: f.note, stall: f.stall, tasted: tasted.includes(id), cook: !!f.cook, known: known.includes(id), season: f.season ?? null, buff: f.buff ? FOOD_BUFFS[f.buff] : '' })),
    pantry: restorePantry(s.pantry).map(p => ({ ...p, label: FOODS[p.id].label })),
    buffs: Object.keys(FOOD_BUFFS).filter(k => buffs[k] === s.day).map(k => FOOD_BUFFS[k]) };
}
// ── 换季那晚的灯会（她 2026-09-18：「一季一件要准备的大事」「做吧」）─────────────────
// ⚠️这是一季里唯一一件【要提前攒东西】的事：每季最后一晚天黑后，在月潭栈桥放一盏灯。
//   要带三样——一朵星铃花（种子→浇三次→开花，好几天的链）、三朵月光花、一样吃的（夜市或自家灶上）。
//   攒不齐就等下一季；放成了相处册一格、家里多一盏摆得出来的灯笼、灯上那句进漂流池。
// ⚠️得两个人一起：他那一晚天黑那格排去栈桥（companion.mjs）；她也可以叫他一起走。
// ⚠️一枪不打；不编灯会的来历，只说她自己带去的东西。
export const FESTIVAL_DAY = 14;
export const festivalDay = day => seasonOf(day).day === FESTIVAL_DAY;
export const festivalOpen = s => festivalDay(s.day) && count(s.minute) >= seasonOf(s.day).dusk;
export const nextFestival = day => { let d = Math.max(1, count(day)) + 1; while (!festivalDay(d)) d++; return d; };
export const FESTIVAL_NEEDS = [
  { id: 'starflower', label: '一朵星铃花', hint: '种下星铃种子，浇三次开花', have: s => count(s.magic && s.magic.flowers) >= 1 },
  { id: 'moon', label: '三朵月光花', hint: '花圃开了就采', have: s => count(s.harvest) >= 3 },
  { id: 'food', label: '一样吃的', hint: '夜市上买，或自家灶上做', have: s => restorePantry(s.pantry).length >= 1 }
];
export const festivalMissing = s => FESTIVAL_NEEDS.filter(n => !n.have(s));
export const festivalReady = s => !festivalMissing(s).length;
export function restoreFestivals(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && Number.isInteger(x.season) && x.season >= 0).slice(0, 40)
    .map(x => ({ season: x.season, day: Math.max(1, count(x.day)), wish: trimText(x.wish, 120), together: x.together === true }));
}
export const festivalDone = s => restoreFestivals(s.festivals).some(f => f.season === seasonOf(s.day).index);
export const FESTIVAL_REACH = 2.2;
export const atFestival = s => s.map === 'garden' && Math.hypot(s.position.x - MAPS.garden.stations.bottle.x, s.position.z - MAPS.garden.stations.bottle.z) <= FESTIVAL_REACH;
export function festivalError(s){
  if (festivalDone(s)) return '这一季的灯已经放过了，下一季再放。';
  if (!festivalDay(s.day)) return '灯会在每季最后一晚，下次是第 ' + nextFestival(s.day) + ' 天。';
  if (!festivalOpen(s)) return '灯会天黑才开，先把东西备齐。';
  const missing = festivalMissing(s); if (missing.length) return '还差：' + missing.map(n => n.label).join('、') + '。';
  if (!atFestival(s)) return '先走到月潭栈桥。';
  if (!companionNearby(s)) return '等他到了一起放。';
  return '';
}
export function holdFestival(s, wish){
  if (festivalError(s)) return s;
  const season = seasonOf(s.day), text = trimText(wish, 120), rows = restorePantry(s.pantry), at = gameMinute(s);
  const thing = { id: 'fl_' + season.index, name: season.name + '天灯会的灯笼', note: '灯会那晚放进月潭又捞回来的那一盏，罩子上还有水痕。' + (text ? '灯上写着：' + text : ''),
    kind: 'relic', way: 'set', recipe: 'festivallantern', from: text, day: s.day, openDay: 0, spot: null };
  let out = { ...s, harvest: count(s.harvest) - 3, magic: { ...s.magic, flowers: count(s.magic.flowers) - 1 }, pantry: rows.slice(1),
    festivals: [{ season: season.index, day: s.day, wish: text, together: true }, ...restoreFestivals(s.festivals)].slice(0, 40),
    waterLights: [...activeWaterLights(s), { at, together: true, where: 'deck' }, { at: at + 1, together: true, where: 'deck' }].slice(-4),
    things: [thing, ...restoreThings(s.things).filter(t => t.id !== thing.id)].slice(0, THING_CAP) };
  if (text) out = { ...out, wishes: [{ text, day: s.day, together: true }, ...restoreWishes(s.wishes)].slice(0, WISH_CAP) };
  out = noteBond(out, 'festival', '和' + s.companion.name + '在' + season.name + '天最后一晚一起放了灯会的灯');
  return noteHappening(out, 'world', '和' + s.companion.name + '在月潭栈桥放了灯会的灯，分着吃了' + FOODS[rows[0].id].label);
}
export function festivalBook(s){
  const season = seasonOf(s.day);
  return { day: FESTIVAL_DAY, tonight: festivalDay(s.day), open: festivalOpen(s), done: festivalDone(s), next: nextFestival(s.day), season: season.name,
    needs: FESTIVAL_NEEDS.map(n => ({ id: n.id, label: n.label, hint: n.hint, have: n.have(s) })), ready: festivalReady(s), held: restoreFestivals(s.festivals).length };
}
// ── 村里的规矩（她 2026-09-18：「要不要写一份简易版攻略」→ 写规律，不写结果）────────
// ⚠️只写【规律】，不写【结果】：写「集市每季 4、8、12 日」，不写奇物摊上有什么；写「星图攒够六片夜里去旧塔」，
//   不写那一夜发生什么——让她自己撞见才好玩。
// ⚠️数字一个都不手写：全从这个文件里的表取（MARKET_EVERY、NIGHT_MARKET_DAYS、FESTIVAL_DAY、SEED_DAYS、
//   GIFT_PER_DAY、BOND_TIERS……），规则改了这一页自己跟着变，不会像 README 那样写死过时。零调用。
export function villageRules(){
  const m = k => ACTION_MINUTES[k], days = Array.from({ length: 14 }, (_, i) => i + 1);
  return [
    { head: '一天', text: '从早上七点到夜里十一点。做事都花时间：取水 ' + m('well') + ' 分、采集 ' + m('gather') + ' 分、炼露 ' + m('brew') + ' 分、做东西 ' + m('craft') + ' 分、念咒 ' + m('cast') + ' 分。天黑了还在做，会自己睡到明天。' },
    { head: '一季', text: '十四天，一年四季，天气每天不一样。这一季哪天有事，看手册最上面那张日历。' },
    { head: '花圃', text: '一壶水浇三次，开了采三朵月光花。想问他什么，就在花圃种下一句，' + SEED_DAYS + ' 天开花。星铃花三天没浇会蔫，浇一次救回来。' },
    { head: '公告栏', text: '每 ' + QUEST_CYCLE + ' 天换一次板子，一次最多接 ' + QUEST_TAKEN_MAX + ' 件。做完交了才有功绩；到期没交会撕掉，委托人是邻居的话交情退。' },
    { head: '集市', text: '每季 ' + days.filter(d => marketDay(d)).join('、') + ' 日开，功绩就是钱。每次上摊的货不一样。' },
    { head: '夜市', text: '每季 ' + NIGHT_MARKET_DAYS.join('、') + ' 日天黑后开，卖吃的和做法；功绩不够拿材料换。篮子最多装 ' + PANTRY_CAP + ' 样。吃过的记进食谱册，他在跟前就是一起吃的；会做的在自己家灶台上做。' },
    { head: '灯会', text: '每季第 ' + FESTIVAL_DAY + ' 天晚上，在月潭栈桥。要带' + FESTIVAL_NEEDS.map(n => n.label).join('、') + '，两个人一起放。攒不齐就等下一季。' },
    { head: '递东西', text: '走到他身边递，一天只递 ' + GIFT_PER_DAY + ' 样。递过一类，才知道他对这一类是什么态度；第一次接过时他说的话记在礼物簿里——礼物簿在手机那一册的「相处」里，和相处册同一页。' },
    { head: '相处册', text: '按一起做过几种不同的事算，不按次数：' + BOND_TIERS.map(([n, l]) => l + '（' + n + ' 种）').join(' → ') + '。处熟了，他愿意陪你去的地方更多。' },
    { head: '井', text: '从屋边那口井下去，往下最多 ' + DEPTH_MAX + ' 层，石头里有东西。井纹残片第 ' + STAR_CHART_FROM + ' 颗以后每一颗是一片星图，攒够 ' + STAR_CHART_NEED + ' 片，夜里两个人去旧塔。雨雪天下井慢，喝过热汤就不慢。' },
    { head: '漂流瓶', text: '在月潭边捞。写下的瓶子 ' + BOTTLE_DAYS + ' 天到；放水灯时留的那句，哪天也会漂回来。' },
    { head: '邻居', text: '村里有 ' + NEIGHBOR_HOUSES.length + ' 间邻居屋，请谁住进来，谁就在村里过自己的日子。走近了能挥手、递东西、说句话；处得近了公告栏上才落他们的名字。夜市那两晚他们是摊主。' },
    { head: '他', text: '他有自己的日程，也会约你、送你东西、拒绝你。行动栏里能叫他一起走、跟着他走；地图上点一处，他会带你走过去。薄雾天远处看不清。' }
  ];
}
export const COLLECTION_CAP = 200;
export function restoreCollection(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.name).slice(0, COLLECTION_CAP).map(x => ({
    ...travelImageFields(x), id: String(x.id).slice(0, 40), name: trimText(x.name, 24), note: trimText(x.note, 200),
    kind: shardKind(x.kind) || 'relic', way: Object.hasOwn(CRAFT_WAYS, x.way) ? x.way : 'set',
    recipe: typeof x.recipe === 'string' ? x.recipe.slice(0, 40) : '',
    from: trimText(x.from, 240), day: Math.max(1, count(x.day)), gaveDay: Math.max(1, count(x.gaveDay))
  }));
}
export function donateError(s, id){
  if (s.map !== 'museum') return '先走进收藏馆，再把东西留下。';
  const t = (s.things || []).find(x => x.id === id);
  if (!t) return '先挑一样东西。';
  if (!thingReady(s, t)) return '这一样还封着，等它开了再捐。';
  if ((s.collection || []).length >= COLLECTION_CAP) return '馆里摆满了。';
  return '';
}
// 算「是不是同一种」用的那一把尺。⚠️v69.41 之前做的东西身上没有 recipe，
//   光比 recipe 的话它们每一件都算「新的一种」——那就又成了一条刷分的路。
const sameKindMark = t => t.recipe || ('名:' + t.name);
export function donate(s, id){
  if (donateError(s, id)) return s;
  const t = (s.things || []).find(x => x.id === id);
  const mark = sameKindMark(t);
  const first = !(s.collection || []).some(x => sameKindMark(x) === mark);
  const row = { ...travelImageFields(t), id: t.id, name: t.name, note: t.note, kind: t.kind, way: t.way,
    recipe: t.recipe || '', from: t.from, day: t.day, gaveDay: s.day };
  return noteHappening(addMiss({ ...s, things: (s.things || []).filter(x => x.id !== id),
    collection: [row, ...(s.collection || [])].slice(0, COLLECTION_CAP),
    deeds: count(s.deeds) + (first ? 1 : 0) }, 'kept'), 'kept', '把「' + t.name + '」留在了馆里');
}
// 馆里已经有几种（不是几件）：炼金笔记那一页拿它对着 RECIPE_TOTAL 算进度
export const collectedKinds = s => new Set((s.collection || []).map(sameKindMark)).size;
// 炼金笔记 30/30 原来集齐了什么也不发生：现在它点亮馆中央那座一直空着的展台（museum-view 照这个亮）
export const centralLit = s => restoreMade(s.made).length >= RECIPE_TOTAL;
// 它不是第二个背包：回信只入漂流记录，不产生物资。
// 漂流瓶：新瓶有固定的回信机会，旧瓶保留原来的归还规则。概率不随刷新重抽。
export const BOTTLE_DAYS = 7, BOTTLE_CAP = 60, DRIFT_PAGE_SIZE = 20;
export function restoreBottles(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.text).map(x => ({
    id: String(x.id).slice(0, 40), text: trimText(x.text, 120),
    day: Math.max(1, count(x.day)), openDay: Math.max(1, count(x.openDay)), taken: x.taken === true,
    ...(x.replyWanted === true ? {replyWanted:true, reply:trimText(x.reply,600), sender:trimText(x.sender,60)} : {})
  }));
}
export function restoreDrifts(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.text).map(x => ({
    id: String(x.id || '').slice(0, 40), kind: ['reply', 'mine', 'note', 'shard', 'kept'].includes(x.kind) ? x.kind : 'note',
    ...(x.kind === 'reply' ? {original:trimText(x.original,120),sender:trimText(x.sender,60)} : {}),
    text: trimText(x.text, 600), day: Math.max(1, count(x.day)), from: Math.max(0, count(x.from))
  }));
}
export const sealedToday = s => (s.bottles || []).some(b => b.day === s.day);
export const sealError = (s, text) =>
  !trimText(text, 120) ? '空着的瓶子漂不动，写一句再封。'
  : sealedToday(s) ? '今天已经放了一只下去了，明天再来。'
  : (s.bottles || []).filter(b=>!b.taken).length >= BOTTLE_CAP ? '水里还有六十只没捞回来的瓶子，先去月湖捞一只吧。' : '';
export function sealBottle(s, text){
  if (sealError(s, text)) return s;
  const bottle = { id: 'bo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    text: trimText(text, 120), day: s.day, openDay: s.day + BOTTLE_DAYS, taken: false,
    ...(hash(String(s.epoch)+':bottle-reply:'+s.day+':'+trimText(text,120))%100 < 65 ? {replyWanted:true,reply:'',sender:''} : {}) };
  // 封进瓶子放走也要有回响：她写了一句话交给水，这本身就是一件发生过的事。
  return noteHappening({ ...s, bottles: [bottle, ...(s.bottles || [])] }, 'sent', '把一句话封进瓶子放走了：' + bottle.text);
}
// 今天水里能捞到什么：自己封的到日子了就先还她自己那一只，
// 否则从【已经有的东西】里按存档号＋天数定一片，同一天捞几次都是同一片。
export function driftPick(s){
  const mine = (s.bottles || []).filter(b => !b.taken && s.day >= b.openDay)
    .sort((a, b) => a.openDay - b.openDay)[0];
  if (mine) return mine.replyWanted
    ? {id:mine.id,kind:'reply',text:mine.reply,original:mine.text,sender:mine.sender,from:mine.day,pending:!mine.reply}
    : { id: mine.id, kind: 'mine', text: mine.text, from: mine.day };
  const pool = [
    ...restoreWishes(s.wishes).map((w, i) => ({ id: 'wish_' + w.day + '_' + i, kind: 'wish', text: w.text, from: w.day })),
    ...(s.notes || []).filter(n => n.reply).map(n => ({ id: n.id, kind: 'note', text: n.reply, from: n.day })),
    ...(s.shards || []).map(x => ({ id: x.id, kind: 'shard', text: x.text, from: x.day })),
    ...(s.collection || []).map(x => ({ id: x.id, kind: 'kept', text: x.name + '。' + x.note, from: x.gaveDay }))
  ];
  if (!pool.length) return null;
  return pool[hash(String(s.epoch) + ':drift:' + s.day) % pool.length];
}
export const driftError = s =>
  s.map !== 'garden' ? '水在庭院里。'
  : count((s.today || {}).bottle) >= 1 ? '今天已经捞过一只了，明天水里会换一只。' : '';
export function drawBottle(s){
  if (driftError(s)) return s;
  const row = driftPick(s);
  if(row?.pending)return s;
  const today = { ...(s.today || {}), bottle: count((s.today || {}).bottle) + 1 };
  if (!row) return { ...s, today };          // 空瓶子也算捞过：不让她今天一直捞下去
  return addMiss({ ...s, today,
    bottles: ['mine','reply'].includes(row.kind)
      ? (s.bottles || []).map(b => b.id === row.id ? { ...b, taken: true } : b) : (s.bottles || []),
    drifts: restoreDrifts([{ ...row, day: s.day }, ...(s.drifts || [])]) }, 'drift');
}
export function keepBottleReply(s,id,reply,sender){
  const b=(s.bottles||[]).find(x=>x.id===id);
  const text=trimText(reply,600);
  if(!b||b.taken||!b.replyWanted||b.reply||s.day<b.openDay||!text)return s;
  return noteBond({...s,bottles:s.bottles.map(x=>x.id===id?{...x,reply:text,sender:trimText(sender,60)}:x)},'reply','你放下水的那句「'+b.text+'」，他回了信');
}
// 还在水里漂着、没到日子的那几只（界面照这个说「还有几天」）
export const floating = s => (s.bottles || []).filter(b => !b.taken && s.day < b.openDay)
  .map(b => ({ ...b, backIn: b.openDay - s.day }));
// 信件保留在原存档，只分页取出展示；搜索、待捞状态均由此处统一计算。
export function bottleBook(s,options={}){
  const query=String(options?.query||'').trim().toLocaleLowerCase();
  const repliesOnly=options?.repliesOnly===true,all=s.drifts||[];
  const matched=all.filter(d=>(!repliesOnly||d.kind==='reply')&&(!query||[d.text,d.original,d.sender].some(t=>String(t||'').toLocaleLowerCase().includes(query))));
  const pages=Math.max(1,Math.ceil(matched.length/DRIFT_PAGE_SIZE));
  const page=Math.min(pages-1,Math.max(0,count(options?.page)));
  const waiting=(s.bottles||[]).filter(b=>!b.taken).map(b=>({id:b.id,text:b.text,day:b.day,backIn:Math.max(0,b.openDay-s.day)}));
  return {days:BOTTLE_DAYS,day:s.day,floating:floating(s),waiting,ready:waiting.filter(b=>b.backIn===0).length,
    drifts:matched.slice(page*DRIFT_PAGE_SIZE,(page+1)*DRIFT_PAGE_SIZE).map(d=>({...d})),
    total:all.length,matches:matched.length,page,pages,error:sealError(s,'x')};
}
// ── 他自己来找你（她 2026-09-17 点的）─────────────────────────────────────
// ⚠️这是庭院里唯一一处【他有主动性】的地方：别的模式（跟着走／等着／去哪儿）
//   全是她在指挥他。所以这一条的形状很要紧——它决定了他是个东西还是个人。
// ⚠️攒的是【真发生过的事】，不是计时器：她多久没跟他说话、她做的事他在不在场、
//   她往馆里留了东西、她在花笺上问了他一句。刚聊完就回落。
// ⚠️这个数【不给她看】。给了它立刻就变成一根刷好感的条——跟心情十维不让直接写
//   是同一个道理（那边也是只收受控证据，不收直接赋值）。
// ⚠️【走过来是零调用的】。真正那一枪要等她点头才打：他站在那儿「像是有话要说」，
//   她点了才生成。这是整个庭院成本观的收口——一枪打在她真的想听的时候。
// ⚠️她不理他【不许罚她】：等一会儿就回自己的日程，思念不清零，明天更容易再来。
export const MISS_READY = 12, MISS_CAP = 30, MISS_WAIT = 90;
export const MISS_GAINS = { silent: 4, beside: 1, kept: 2, drift: 1, seed: 1 };
export function restoreMiss(raw){
  const m = raw || {};
  return { score: count(m.score, MISS_CAP), day: Math.max(0, count(m.day)),
    since: Math.max(0, count(m.since)), cameAt: Math.max(0, count(m.cameAt)) };
}
const withMiss = (s, patch) => ({ ...s, miss: restoreMiss({ ...restoreMiss(s.miss), ...patch }) });
// 攒一笔。⚠️一律走这一处：散在各处各写一句 score+1，迟早有人改漏
export function addMiss(s, reason){
  const gain = MISS_GAINS[reason];
  if (!gain) return s;
  return withMiss(s, { score: Math.min(MISS_CAP, restoreMiss(s.miss).score + gain) });
}
// 跟他说完一轮：回落，但不清零——说过一次不等于这阵子都不想你了
export function talkedWith(s){
  return withMiss(s, { score: Math.max(0, restoreMiss(s.miss).score - MISS_READY), since: s.day, cameAt: 0 });
}
// 过了一天她一句话都没跟他说：这是最主要的那一笔
export function missNewDay(s){
  const m = restoreMiss(s.miss);
  return m.since && s.day - m.since < 1 ? s : addMiss(withMiss(s, { since: s.day }), 'silent');
}
// 他这就放下手里的事，往她那儿走
export const missWanting = s => {
  const m = restoreMiss(s.miss);
  return m.score >= MISS_READY && m.day !== s.day && !(s.sleep && s.sleep.companion) && s.companion.map === s.map;
};
// 到了她身边，正等着她点头（她不点也就站一会儿）
export const missWaiting = s => missWanting(s) && companionNearby(s) && !!restoreMiss(s.miss).cameAt;
export function missArrived(s){
  return missWanting(s) && companionNearby(s) && !restoreMiss(s.miss).cameAt ? withMiss(s, { cameAt: s.minute }) : s;
}
// 等够了她还是没点：回自己的日程去，思念一分不扣
export const missGaveUp = s => {
  const m = restoreMiss(s.miss);
  return !!m.cameAt && s.minute - m.cameAt >= MISS_WAIT;
};
// 她点头了：今天这一次记上（无论那一枪成不成，都不许再打第二次）
export function missTaken(s){
  return noteBond(withMiss(s, { day: s.day, cameAt: 0, score: Math.max(0, restoreMiss(s.miss).score - MISS_READY) }), 'talk', s.companion.name + '自己走过来找你说了句话');
}
export function missLetGo(s){ return withMiss(s, { cameAt: 0, day: s.day }); }
// 他要说的那句话得【带着一件具体的东西】，否则每次都是「我想你了」——
// 那就又是那句「换个角色照样成立的就是写坏了」。这儿只负责把料凑齐，话由他自己说。
// 这一件是不是【从井底捞上来的、他自己的东西】。奇物是拿他的碎片炼的，来头原文
// 就抄在 from 里；她种出来、买来的没有这一段。井里的碎片本身带 curio，背包里
// 那两类带 type。
// ⚠️只有这一处答案：递给他、摆在家里、留在收藏馆里，都问它
// （她 2026-09-18：「那奇物 in general 对我们的『关系』主题有啥用」——
//  用处就是：这些东西本来就是他的，他得认得出来）。
export const fromWell = x => !!x && (x.type === 'shard' || x.type === 'thing'
  || Object.hasOwn(WELL_CURIOS, x.curio || '')
  || !!(typeof x.from === 'string' && x.from.trim()));
// 标给他看的那一句：这几样是他自己的东西，不是她捡来的小玩意。
export const MINE_TAG = '、你自己的东西';
// ── 一段旅程 vs 一个世界（她 2026-09-19：「比如庭院的车站可以坐车然后跳转到新世界的
//    列车玩法…每个庭院档连一个列车档连一个别的什么档」）──────────────────────
// 她拍板：**各走各的进度**——「设定上就是每一个都是不同游戏，当然不应该共享进度」。
// 所以天数、季节、地图、这个世界的材料和建筑，一律留在各世界自己那一档里。
//
// 跟着人走的只有【跟世界无关】的那几样：她和他长什么样、随身那一小袋。
// ⚠️只有这一张表回答「哪一样在哪一层」。以后要把一样东西挪到另一层，改这张表就行，
//   任何读写都不用动（施工规则/one-public-mechanism.md）。
// ⚠️关系那几样（gifts / bond / happenings / miss）【故意不在这层】：它们每一条都带着
//   「第几天」，而天数是各走各的——搬过去就对不上。等列车真做出来、需要「车上送的礼
//   回庭院他还记得」时，那一步要先把关系记录换成绝对日期，而不是世界天数。
export const JOURNEY_SHAPE = {
  look:          { from: s => s.look,             into: (s, v) => ({ ...s, look: v }) },
  companionLook: { from: s => s.companion?.look,  into: (s, v) => ({ ...s, companion: { ...s.companion, look: v } }) },
  // 随身那一小袋：从这个世界的馆里/背包里显式放进来的东西，跟着人上车。
  // 现在是空的——列车还没做，这一层先备好，做的时候不用再动存储。
  carry:         { from: s => s.carry,            into: (s, v) => ({ ...s, carry: v }) },
};
export const JOURNEY_KEYS = Object.keys(JOURNEY_SHAPE);
// 从一份世界存档里【抄出】跟着人走的那几样（不改原件）。
export function takeJourney(s){
  const out = {};
  for (const [k, f] of Object.entries(JOURNEY_SHAPE)) { const v = f.from(s || {}); if (v !== undefined) out[k] = v; }
  return out;
}
// 把旅程那一份【盖回】世界存档上。世界档里那几份是没人读的旧影子（留着只为回滚），
// 以权威的这一份为准。
export function putJourney(s, journey){
  if (!journey || typeof journey !== 'object') return s;
  return Object.entries(JOURNEY_SHAPE).reduce((acc, [k, f]) =>
    journey[k] === undefined ? acc : f.into(acc, journey[k]), s);
}

export function missMaterial(s){
  const notes = (s.notes || []).slice(0, 2).map(n => ({ kind: '花笺', text: n.reply, day: n.day }));
  const kept = (s.collection || []).slice(0, 2).map(x => ({ kind: '她留在收藏馆里的' + (fromWell(x) ? MINE_TAG : ''), text: x.name + '。' + x.note, day: x.gaveDay }));
  const shards = (s.shards || []).filter(x => x.pinned).slice(0, 2).map(x => ({ kind: '她钉住的碎片' + (fromWell(x) ? MINE_TAG : ''), text: x.text, day: x.day }));
  const drift = (s.drifts || []).slice(0, 1).map(x => ({ kind: '她今天从水里捞到的', text: x.text, day: x.day }));
  const placed = (s.things || []).filter(x => x.spot).slice(0, 2).map(x => ({ kind: '她摆在' + (spotLabel(x.spot) || '家里') + '的' + (fromWell(x) ? MINE_TAG : ''), text: x.name + '。' + x.note, day: x.day }));
  const lately = recentHappenings(s, 5).map(x => ({ kind: HAPPEN_KINDS[x.kind], text: x.text, day: x.day }));
  const gifts = restoreGifts(s.gifts).slice(0, 2).map(x => ({ kind: x.from === 'him' ? '你递给她的' : '她递给你的', text: x.name + (x.stance ? '，你' + GIFT_STANCES[x.stance] : ''), day: x.day }));
  return { day: s.day, quiet: Math.max(0, s.day - restoreMiss(s.miss).since),
    rows: [...lately, ...gifts, ...drift, ...kept, ...placed, ...shards, ...notes].filter(x => x.text) };
}
// ── 村里的事（她 2026-09-17：「做 AbC 吧」的 A）─────────────────────────
// ⚠️病根不是「事情少」，是【做了没有回响】：她捐了东西进馆、挖到一片他说过的话、
//   替谁做完一件委托——他一件都不知道。十件事里九件是她一个人在做。
// ⚠️所以这儿只做一件事：把【真发生过的事】记成一本村里的账。
//   它是那几条链子和他之间唯一的接口——他开口时手上的料从这儿取，
//   他排这一季的日程时也读它。记账本身一枪不打。
// ⚠️只记【真发生过的】：这本账不许写任何没发生的事，否则他就会提起一件不存在的事。
export const HAPPEN_CAP = 40;
export const HAPPEN_KINDS = { kept: '留在馆里', dug: '井里刨到', made: '锅里做出', quest: '替人做完', grew: '地里长出', world: '村里', met: '在村里碰见', gift: '递给他的', set: '她摆出来的', sent: '她封进瓶子放走的' };
export function restoreHappenings(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.text && Object.hasOwn(HAPPEN_KINDS, x.kind))
    .slice(0, HAPPEN_CAP).map(x => ({ kind: x.kind, text: trimText(x.text, 120), day: Math.max(1, count(x.day)) }));
}
// ⚠️一律走这一处记。散在各处各写一句 push，迟早有人改漏（AutoGate 那次的形状）
export function noteHappening(s, kind, text){
  const line = trimText(text, 120);
  if (!Object.hasOwn(HAPPEN_KINDS, kind) || !line) return s;
  const rows = restoreHappenings(s.happenings);
  if (rows.some(x => x.day === s.day && x.kind === kind && x.text === line)) return s;   // 同一天同一件不记两遍
  return { ...s, happenings: [{ kind, text: line, day: s.day }, ...rows].slice(0, HAPPEN_CAP) };
}
export const recentHappenings = (s, n = 6) => restoreHappenings(s.happenings).slice(0, Math.max(1, count(n, 40)));
// ── 他带路（她 2026-09-18：「新手指引开了的话就让角色带着过一遍」，「都放一天」）───
// ⚠️他先走到今天该去的地方站着等，她过去他说一句（那句是他自己的口气，手机那侧一枪十句、
//   一位角色一辈子一次），她做那件事，做完他去下一处。七件放在同一天，不隔天。
// ⚠️换季那一天另有一站：带她看这一季才有的那一处。四季各一次，等季节真来了才带，不跳日子。
// ⚠️「做没做」看的是存档里真发生过的事，不是「点过按钮」；老存档已经做过的那几件直接算过。
export const GUIDE_STEPS = [
  { id: 'well', label: '去井边取一壶清水', hint: '井绳有点沉，拉两下就上来了。', map: 'garden', at: () => MAPS.garden.stations.well, done: s => count(s.today?.well) > 0 || count(s.water) > 0 },
  { id: 'garden', label: '给花圃浇一次水', hint: '一壶水浇三次，开了就能采。', map: 'garden', at: () => MAPS.garden.stations.garden, done: s => count(s.today?.garden) > 0 || count(s.blooms) > 0 },
  { id: 'herbs', label: '去林地采一束铃叶草', hint: '林地的草每天长两束，蘑菇更少。', map: 'forest', at: () => ACTIVITIES.herbs.target, done: s => count(s.today?.gather) > 0 || count(s.herbs) > 0 },
  { id: 'gift', label: '把手上的东西递一样给他', hint: '递什么都行，一天一样。', map: null, at: null, done: s => restoreGifts(s.gifts).some(x => x.from !== 'him') },
  { id: 'sow', label: '在花圃种下一句', hint: '写一句想问的，三天开花。', map: 'garden', at: () => MAPS.garden.stations.sow, done: s => (s.seeds || []).length > 0 },
  { id: 'board', label: '去公告栏接一件委托', hint: '板子四天一换，做完交了就有功绩，集市日拿去换东西。', map: 'garden', at: () => MAPS.garden.stations.board, done: s => (s.quests || []).length > 0 || count(s.deeds) > 0 },
  { id: 'sit', label: '去池边一起坐一会儿', hint: '坐下他会来坐旁边。', map: 'forest', at: () => MAPS.forest.seats.pond.companion, done: s => bondKinds(s).has('sit') }
];
export const GUIDE_SEASONS = {
  1: { id: 'season:1', label: '夏天了，去看溪畔的水磨坊', hint: '磨坊能把材料磨成星砂、蒸出月露。', map: 'garden', at: () => MAPS.garden.sites.lakeEast?.target || MAPS.garden.sites.market.target },
  2: { id: 'season:2', label: '秋天了，去林后的许愿树下', hint: '学会的咒在这儿念，封进一个地方。', map: 'forest', at: () => MAPS.forest.sites.wishingTree.target },
  3: { id: 'season:3', label: '冬天了，月湖结冰了', hint: '走上冰面就换冰鞋，点冰面滑过去。', map: 'garden', at: () => MAPS.garden.lake.skateStart }
};
export function restoreGuide(raw){
  const d = raw || {};
  // ⚠️默认关：试玩和测试里他照旧过自己的日子；从小手机进庭院房第一次开档时游戏那头打开一次（asked）
  return { on: d.on === true, asked: d.asked === true, step: Math.max(0, count(d.step, GUIDE_STEPS.length)), said: Array.isArray(d.said) ? d.said.filter(x => typeof x === 'string').slice(0, 20) : [],
    seasons: Array.isArray(d.seasons) ? d.seasons.filter(Number.isInteger).slice(0, 8) : [] };
}
export const setGuide = (s, on) => ({ ...s, guide: { ...restoreGuide(s.guide), on: !!on, asked: true } });
// 这会儿他该带她去哪儿（没有就是 null）：换季那一站优先，然后是七件里下一件没做的
export function guideStep(s){
  const g = restoreGuide(s.guide);
  if (!g.on) return null;
  const season = seasonOf(s.day), key = season.index % 4;
  if (season.day === 1 && GUIDE_SEASONS[key] && !g.seasons.includes(season.index)) return { ...GUIDE_SEASONS[key], season: season.index };
  for (let i = g.step; i < GUIDE_STEPS.length; i++) if (!GUIDE_STEPS[i].done(s)) return GUIDE_STEPS[i];
  return null;
}
export const guideTarget = (s, step = guideStep(s)) => step && step.at ? { map: step.map, target: step.at() } : null;
// 做完一件就翻到下一件；换季那一站她走到跟前就算看过
export function guideAdvance(s){
  const g = restoreGuide(s.guide);
  if (!g.on) return s;
  let step = g.step;
  while (step < GUIDE_STEPS.length && GUIDE_STEPS[step].done(s)) step++;
  const cur = guideStep({ ...s, guide: { ...g, step } });
  let seasons = g.seasons;
  if (cur && cur.season != null && cur.map === s.map && Math.hypot(s.position.x - cur.at().x, s.position.z - cur.at().z) <= 2.4) seasons = [...seasons, cur.season];
  if (step === g.step && seasons === g.seasons) return s;
  return { ...s, guide: { ...g, step, seasons } };
}
export const guideSaid = (s, id) => restoreGuide(s.guide).said.includes(id);
export const markGuideSaid = (s, id) => guideSaid(s, id) ? s : { ...s, guide: { ...restoreGuide(s.guide), said: [...restoreGuide(s.guide).said, id].slice(-20) } };
// ── 日历（她 2026-09-18：「日历也做」）：这一季十四格上都有什么。零调用，读的全是存档。
export function calendarMarks(s, birthday = 0){
  const season = seasonOf(s.day), out = {};
  const add = (day, mark) => { if (day >= 1 && day <= 14) (out[day] = out[day] || []).push(mark); };
  for (let d = 1; d <= 14; d++){ const abs = season.start + d - 1; if (marketDay(abs)) add(d, '集市'); if (nightMarketDay(abs)) add(d, '夜市'); if (festivalDay(abs)) add(d, '灯会'); if ((abs - 1) % QUEST_CYCLE === 0) add(d, '换板子'); }
  const inv = restoreInvite(s.invite); if (inv && inv.day >= season.start && inv.day <= season.end) add(inv.day - season.start + 1, '他约你');
  for (const x of (s.seeds || [])) if (!x.done){ const open = x.day + SEED_DAYS; if (open >= season.start && open <= season.end) add(open - season.start + 1, x.origin ? '梦花开' : '花开'); }
  for (const t of (s.things || [])) if (t.openDay && t.openDay >= season.start && t.openDay <= season.end) add(t.openDay - season.start + 1, '开封');
  for (const b of (s.bottles || [])) if (!b.taken && b.openDay >= season.start && b.openDay <= season.end) add(b.openDay - season.start + 1, '瓶子到');
  if (birthday){ const y = ((count(birthday) - 1) % 56) + 1; if (y > season.index % 4 * 14 && y <= season.index % 4 * 14 + 14) add(y - season.index % 4 * 14, '他的生日'); }
  return out;
}
// 生日：人格档案馆里的公历月日换算成村里的一年（四季各十四天，一年五十六天）
export function gameBirthday(month, day){
  const mo = count(month), d = count(day); if (mo < 1 || mo > 12 || d < 1 || d > 31) return 0;
  const season = mo >= 3 && mo <= 5 ? 0 : mo >= 6 && mo <= 8 ? 1 : mo >= 9 && mo <= 11 ? 2 : 3;
  const start = [3, 6, 9, 12][season], within = ((mo - start + 12) % 12) * 31 + (d - 1);
  return season * 14 + Math.min(14, 1 + Math.floor(within / 93 * 14));
}
export const isBirthday = (s, birthday = s.birthday) => !!count(birthday) && ((s.day - 1) % 56) + 1 === ((count(birthday) - 1) % 56) + 1;
// ── 今天想做的（她 2026-09-18：「没有攻略没有指引很容易一脸懵」）：三条，全按存档现算
export function todayHints(s, birthday = s.birthday){
  const out = [], step = guideStep(s);
  if (step) out.push({ kind: 'guide', text: '他带你：' + step.label });
  if (isBirthday(s, birthday)) out.push({ kind: 'birthday', text: '今天是他的生日，递一样东西给他' });
  if (inviteMet(s)) out.push({ kind: 'date', text: '他约你的地方到了，点头顶那个记号' });
  else if (restoreInvite(s.invite)) out.push({ kind: 'date', text: '他在' + COMPANION_DESTINATIONS[restoreInvite(s.invite).place].label.replace(/^去|^回/, '').replace(/等你$/, '') + '等你' });
  if (starNightReady(s)) out.push({ kind: 'night', text: '星图攒齐了，夜里在旧塔摊开' });
  if (missWanting(s) && companionNearby(s)) out.push({ kind: 'talk', text: '他好像有话要说' });
  if (s.magic && s.magic.wilted) out.push({ kind: 'wilt', text: '星铃花蔫了，浇一次救回来' });
  if (readySeeds(s).length) out.push({ kind: 'note', text: '花圃里开了 ' + readySeeds(s).length + ' 株，去收花笺' });
  const due = questTaken(s).filter(q => q.lastDay - s.day <= 1); if (due.length) out.push({ kind: 'quest', text: '「' + QUEST_KINDS[due[0].kind].label + '」' + (due[0].lastDay <= s.day ? '今天到期' : '明天到期') });
  if (marketDay(s.day)) out.push({ kind: 'market', text: '今天集市日' + (count(s.deeds) ? '，有 ' + count(s.deeds) + ' 分功绩' : '，功绩要靠交委托攒') });
  if (nightMarketDay(s.day)) out.push({ kind: 'fair', text: nightMarketOpen(s) ? '夜市开了，去灯串集市' : '今晚有夜市，天黑后去灯串集市' });
  // 灯会：当天说开没开；前三天提醒还差什么（攒不齐就等下一季，所以得早说）
  if (!festivalDone(s)){ const miss = festivalMissing(s).map(n => n.label).join('、');
    if (festivalDay(s.day)) out.push({ kind: 'festival', text: festivalOpen(s) ? (miss ? '灯会开了，还差' + miss : '灯会开了，去月潭栈桥放灯') : (miss ? '今晚灯会，还差' + miss : '今晚灯会，东西齐了') });
    else if (seasonOf(s.day).day >= FESTIVAL_DAY - 3 && miss) out.push({ kind: 'festival', text: '第 ' + FESTIVAL_DAY + ' 天晚上灯会，还差' + miss }); }
  if ((s.things || []).some(t => t.openDay === s.day)) out.push({ kind: 'open', text: '有一样今天开封' });
  if (!out.length) out.push({ kind: 'free', text: s.blooms === 3 ? '月光花开了，可以采收' : '今天没有非做不可的事，随便走走' });
  return out.slice(0, 3);
}
// ── 相处册（她 2026-09-18：「做1和2」的 1）──────────────────────────────
// ⚠️审计那天查出来的：邻居有「刚搬来→脸熟了→处熟了」，天天跟她同住的这一位
//   反而是全村唯一没有刻度的人。这本册子就是给他的那一条。
// ⚠️刻度按【一起做过几种不同的事】走，不按次数：递一百朵花还是一格，
//   一起唤醒过种子、同睡过一晚、对过铜环、他来找过你……每一种才算一格。
//   按次数走它当场就变成一根刷条（思念那个数不给她看，也是这个道理）。
// ⚠️只记【真发生过的】，每一条带那天的原话；一枪都不打。
export const BOND_KINDS = { seed: '一起唤醒过种子', star: '一起对过铜环', bed: '同睡过一张床', gift: '接过你递的东西',
  sit: '并肩坐过', note: '答过你种下的话', reply: '回过你的漂流瓶', talk: '他来找过你说话',
  work: '一起修好过一处', help: '替你照看过一炉', light: '一起放过水灯', cast: '陪你念过一个咒',
  date: '赴过他的约', given: '收过他送的东西', night: '一起看过一夜星图', birthday: '陪他过过生日',
  meal: '一起吃过东西', fair: '逛过一整个夜市', festival: '一起放过灯会的灯' };
export const BOND_CAP = 200;
export const BOND_TIERS = [[0, '刚住到一起'], [2, '有了一起做的事'], [5, '处熟了'], [8, '过成一家了']];
export function restoreBond(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && Object.hasOwn(BOND_KINDS, x.kind))
    .slice(0, BOND_CAP).map(x => ({ kind: x.kind, day: Math.max(1, count(x.day)), text: trimText(x.text, 120) }));
}
// 记一笔。⚠️一律走这一处（同一天同一种只记一次：并肩坐一下午不是坐了四十次）
export function noteBond(s, kind, text){
  if (!Object.hasOwn(BOND_KINDS, kind)) return s;
  const rows = restoreBond(s.bond);
  if (rows.some(x => x.day === s.day && x.kind === kind)) return s;
  return { ...s, bond: [{ kind, day: s.day, text: trimText(text, 120) || BOND_KINDS[kind] }, ...rows].slice(0, BOND_CAP) };
}
export const bondKinds = s => new Set(restoreBond(s && s.bond).map(x => x.kind));
export function bondTier(s){
  const n = bondKinds(s).size;
  let tier = 0;
  BOND_TIERS.forEach(([need], i) => { if (n >= need) tier = i; });
  return tier;
}
export const bondLabel = s => BOND_TIERS[bondTier(s)][1];
// 手机那一册和模型看的都是这一份
export function bondBook(s){
  const rows = restoreBond(s.bond), done = bondKinds(s), tier = bondTier(s);
  return { tier, label: BOND_TIERS[tier][1],
    next: tier + 1 < BOND_TIERS.length ? { need: BOND_TIERS[tier + 1][0] - done.size, label: BOND_TIERS[tier + 1][1] } : null,
    kinds: Object.entries(BOND_KINDS).map(([kind, label]) => {
      const mine = rows.filter(x => x.kind === kind);
      return { kind, label, count: mine.length, day: mine.length ? mine[0].day : 0, text: mine.length ? mine[0].text : '' }; }),
    rows: rows.slice(0, 30),
    canGo: Object.entries(companionDestinations(s)).map(([id, d]) => ({ id, label: d.label })) };
}
// ── 礼物簿（她 2026-09-18：「做1和2」的 2）─────────────────────────────
// ⚠️原来只能递月光花，而且递十朵和递一朵一样，明天他也不记得。
//   现在背包里的东西都能递：花、月露、草木、井里的碎片、锅里做出来的东西。
// ⚠️他喜不喜欢【不写在代码里】：那是他自己的人设长出来的一张表（手机那侧一枪，
//   一位角色一辈子只打一次），这儿只按类别查表结算。查不到（试玩、还没问过）就是不知道。
// ⚠️不喜欢【不罚她】：没有扣分这回事。这一册记的是「你知道了他什么」，不是分数。
// ⚠️一天递一样：递东西才有分量。这一层是【意义闸】，不是钱闸（结算一枪不打）。
export const GIFT_PER_DAY = 1, GIFT_CAP = 120;
export const GIFT_KEEP = ['flower', 'starflower', 'dreamflower', 'dew', 'herb', 'mushroom', 'thing', 'shard', 'food'];
export function restoreGifts(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && Object.hasOwn(GIFT_FAMILIES, x.family) && x.name)
    .slice(0, GIFT_CAP).map(x => ({ day: Math.max(1, count(x.day)), name: trimText(x.name, 24),
      family: x.family, key: trimText(x.key, 48), stance: Object.hasOwn(GIFT_STANCES, x.stance) ? x.stance : '', from: x.from === 'him' ? 'him' : 'me',
      said: (Array.isArray(x.said) ? x.said : []).slice(0, 3).map(t => trimText(t, 200)).filter(Boolean) }));
}
export const giftsToday = s => restoreGifts(s.gifts).filter(x => x.day === s.day && x.from !== 'him').length;
// 一件东西归哪一类。⚠️碎片和它做出来的东西归同一类：他不喜欢梦屑，就也不会喜欢玻璃梦
const familyOfKind = kind => Object.hasOwn(GIFT_FAMILIES, kind) ? kind : 'relic';
// ── 一样一样地喜欢（她 2026-09-18：「每一档都单独吧，这样才有新鲜感，送出不同的
//   东西可以看到不同反应」）───────────────────────────────────────────────
// ⚠️原来态度是【按类】的：递月光花和递星铃花是同一句反应，八类摸完就再没有新鲜的了。
//   现在每一样东西自己一档。东西分两种：
//   ① 固定那些（花、月露、草木、井水边长出来的那几样 ＋ 吃的整张单子）——开局问一次，
//      一次问完这一整张单子。
//   ② 井里挖出来、做出来的那些——名字是这一档现长的，没法提前列表：第一次递出去
//      那一下现问那一样，之后查表。
// ⚠️「怎么保证他不是什么都喜欢」：分布【由代码定】（见 giftQuota），模型只排先后。
//   这是 施工规则/bans-make-it-dumber.md 那条：该加约束时掷轴，不掷答案。
export const giftKey = it => !it ? '' : it.type === 'food' ? 'food:' + (it.id || '')
  : it.type === 'thing' ? 'thing:' + it.id : it.type === 'shard' ? 'shard:' + it.id : it.type;
export const GIFT_BASICS = [
  { key: 'flower', name: '月光花', family: 'flower' },
  { key: 'starflower', name: '星铃花', family: 'flower' },
  { key: 'dew', name: '月露', family: 'dew' },
  { key: 'herb', name: '一束铃叶草', family: 'herb' },
  { key: 'mushroom', name: '荧光菇', family: 'herb' }
];
// 开局问那一枪问的就是这一整张单子（配额和切法在 rules.js，两侧共用同一张）
export const giftCatalogue = () => [...GIFT_BASICS,
  ...Object.entries(FOODS).map(([id, f]) => ({ key: 'food:' + id, name: f.label, family: 'food', note: f.note }))];
// 他排好先后，代码照配额切：前几样算真心喜欢，最后几样算不太想要。
// 井里长出来的那一样：档位照同一个配比掷轴（同一档、同一个人、同一样东西，掷出来永远一样）
export function rolledStance(seed){
  const quota = giftQuota(20), bag = GIFT_ORDER.flatMap(k => Array(quota[k]).fill(k));
  return bag[hash(String(seed)) % bag.length];
}
export function giftItem(s, ref){
  const type = ref && ref.type;
  if (type === 'flower') return count(s.harvest) > 0 ? { type, name: '月光花', family: 'flower' } : null;
  if (type === 'starflower') return count(s.magic && s.magic.flowers) > 0 ? { type, name: '星铃花', family: 'flower' } : null;
  if (type === 'dew') return count(s.potions) > 0 ? { type, name: '月露', family: 'dew' } : null;
  if (type === 'herb') return count(s.herbs) >= 2 ? { type, name: '一束铃叶草', family: 'herb' } : null;
  if (type === 'mushroom') return count(s.mushrooms) > 0 ? { type, name: '荧光菇', family: 'herb' } : null;
  if (type === 'thing'){ const t = (s.things || []).find(x => x.id === ref.id);
    return t && thingReady(s, t) ? { type, id: t.id, name: t.name, family: t.recipe === 'dreamflower' ? 'flower' : familyOfKind(t.kind), note: t.note } : null; }
  if (type === 'shard'){ const sh = (s.shards || []).find(x => x.id === ref.id);
    return sh && !sh.pinned ? { type, id: sh.id, name: shardName(sh), family: familyOfKind(sh.kind), note: sh.text } : null; }
  if (type === 'food'){ const p = pantryItem(s, ref.uid); return p ? { type, uid: p.uid, id: p.id, name: FOODS[p.id].label, family: 'food', note: FOODS[p.id].note } : null; }
  return null;
}
// 她手上此刻能递的（游戏那头的挑选页照这个画；空手就是空的）
export function giftOptions(s){
  const out = [];
  for (const type of ['flower', 'starflower', 'dew', 'herb', 'mushroom']){ const it = giftItem(s, { type }); if (it) out.push({ ref: { type }, ...it }); }
  for (const t of (s.things || []).filter(x => !x.spot)){ const it = giftItem(s, { type: 'thing', id: t.id }); if (it) out.push({ ref: { type: 'thing', id: t.id }, ...it }); }
  for (const sh of (s.shards || [])){ const it = giftItem(s, { type: 'shard', id: sh.id }); if (it) out.push({ ref: { type: 'shard', id: sh.id }, ...it }); }
  for (const p of restorePantry(s.pantry)){ const it = giftItem(s, { type: 'food', uid: p.uid }); if (it) out.push({ ref: { type: 'food', uid: p.uid }, ...it }); }
  return out.map(x => ({ ...x, familyLabel: GIFT_FAMILIES[x.family].label }));
}
// 递得出去吗。⚠️只有面对面才算：这一下是看得见的交接，不是背包之间转账
export function giftError(s, ref){
  if (giftsToday(s) >= GIFT_PER_DAY) return '今天已经递过一样了，明天再递。';
  if (!giftItem(s, ref)) return ref && ref.type === 'flower' ? '先收获一朵月光花，再拿给同行者。' : '手上没有这一样。';
  if (s.seat || sleepPose(s) || sleepPose(s, 'companion')) return '先起身，面对面递给 TA。';
  if (s.map !== s.companion.map || Math.hypot(s.position.x - s.companion.position.x, s.position.z - s.companion.position.z) > 1.65) return '靠近同行者一点，再把东西递过去。';
  return '';
}
function takeGift(s, it){
  if (it.type === 'flower') return { ...s, harvest: s.harvest - 1 };
  if (it.type === 'starflower') return { ...s, magic: { ...s.magic, flowers: s.magic.flowers - 1 } };
  if (it.type === 'dew') return { ...s, potions: s.potions - 1 };
  if (it.type === 'herb') return { ...s, herbs: s.herbs - 2 };
  if (it.type === 'mushroom') return { ...s, mushrooms: s.mushrooms - 1 };
  if (it.type === 'thing') return { ...s, things: (s.things || []).filter(x => x.id !== it.id) };
  if (it.type === 'food') return { ...s, pantry: restorePantry(s.pantry).filter(p => p.uid !== it.uid) };
  return { ...s, shards: (s.shards || []).filter(x => x.id !== it.id) };
}
// 结算。taste＝他对这一类的态度 { stance, words }（手机那侧查出来递进来的），没有就是不知道。
// ⚠️他说的那句只在【第一次接过这一类】时记进册子：这一类他以后再收，只是接过，不再说一遍。
export function giveGift(s, ref, taste){
  if (giftError(s, ref)) return s;
  const it = giftItem(s, ref), rows = restoreGifts(s.gifts);
  const stance = taste && Object.hasOwn(GIFT_STANCES, taste.stance) ? taste.stance : '';
  // ⚠️「第一次」按【这一样东西】算，不按类（她 2026-09-18：「每一档都单独」）：
  //   递月光花和递星铃花是两件事，各有各的第一次、各有各的那几句。
  const key = giftKey(it), first = !rows.some(x => x.key === key);
  const said = first && taste ? (Array.isArray(taste.words) ? taste.words : []).slice(0, 3).map(t => trimText(t, 200)).filter(Boolean) : [];
  const row = { day: s.day, name: it.name, family: it.family, key, stance, said, from: 'me' };
  const birthday = isBirthday(s);
  const line = (birthday ? '他生日这天，' : '') + '把「' + it.name + '」递给了' + s.companion.name + (stance ? '，' + (stance === 'dislike' ? '他不太想要' : stance === 'meh' ? '他收下了' : '他' + GIFT_STANCES[stance]) : '');
  const out = noteHappening(noteBond({ ...takeGift(s, it), gifts: [row, ...rows].slice(0, GIFT_CAP) }, 'gift', line), 'gift', line);
  return birthday ? noteBond(out, 'birthday', '他生日那天递了「' + it.name + '」给他') : out;
}
// 手机那一册：七类各自摸清了没有、他说过什么、递过几次
export function giftBook(s){
  const all = restoreGifts(s.gifts), rows = all.filter(x => x.from !== 'him');
  return { perDay: GIFT_PER_DAY, today: giftsToday(s), stances: { ...GIFT_STANCES }, fromHim: all.filter(x => x.from === 'him').slice(0, 20),
    families: Object.entries(GIFT_FAMILIES).map(([id, f]) => {
      const mine = rows.filter(x => x.family === id), known = mine.find(x => x.stance);
      // ⚠️这一类里她试过的【每一样】各自一行：同一类里也有他偏爱的和不待见的
      const seen = new Map();
      for (const r of mine){ const k = r.key || r.name;
        if (!seen.has(k)) seen.set(k, { key: k, name: r.name, stance: r.stance, said: r.said, count: 0, day: r.day });
        const row = seen.get(k); row.count++;
        if (!row.stance && r.stance) row.stance = r.stance;
        if (!row.said.length && r.said.length) row.said = r.said; }
      return { id, label: f.label, what: f.what, count: mine.length, stance: known ? known.stance : '',
        items: [...seen.values()],
        said: (mine.find(x => x.said.length) || { said: [] }).said, last: mine.length ? mine[0].name : '' }; }),
    rows: rows.slice(0, 20) };
}
// ── 他这一头（她 2026-09-18：「做3和4」的 3）────────────────────────────
// ⚠️原来聊天里他能落实的只有四种走法：说「不想去」只能落成 none，机制上零痕迹；
//   说「我给你带了点草」也只是嘴上说说。这一版给他三样真会发生的事：
//   回送（东西真进她背包）、约她（他先去那儿等，她到了才有那一段）、拒绝（村里的账上有一笔，他回自己的日程）。
// ⚠️他送的只能是【他自己那天顺手采得到的】那几样：不凭空变出碎片和月露。
export const HIM_GIVES = { herb: { label: '一束铃叶草', field: 'herbs', n: 2, family: 'herb' },
  mushroom: { label: '荧光菇', field: 'mushrooms', n: 1, family: 'herb' }, flower: { label: '月光花', field: 'harvest', n: 1, family: 'flower' },
  food: { label: '夜市上买的一样吃的', family: 'food' } };
// 他在夜市上给她买的那一样：今晚摊上有的里挑（不含做法），按存档号＋日子定
export const himFoodPick = s => { const ids = nightStock(s).filter(id => !recipeOf(id)); return ids.length ? ids[hash(String(s.epoch) + ':him:' + s.day) % ids.length] : ''; };
export const himGaveToday = s => restoreGifts(s.gifts).some(x => x.day === s.day && x.from === 'him');
export function himGiveError(s, item){
  if (!Object.hasOwn(HIM_GIVES, item || '')) return '他手上没有这一样。';
  if (himGaveToday(s)) return '他今天已经给过你一样了。';
  if (!companionNearby(s)) return '他得走到你身边才递得过来。';
  if (item === 'food' && (!nightMarketOpen(s) || !atMarket(s))) return '夜市开着、两个人都在集市上，他才买得到。';
  if (item === 'food' && restorePantry(s.pantry).length >= PANTRY_CAP) return '你的篮子装满了。';
  return '';
}
export function himGive(s, item){
  if (himGiveError(s, item)) return s;
  const g = HIM_GIVES[item];
  const food = item === 'food' ? himFoodPick(s) : '';
  const label = food ? FOODS[food].label : g.label;
  const row = { day: s.day, name: label, family: g.family, stance: '', said: [], from: 'him' };
  const rows = restorePantry(s.pantry);
  const got = food ? { ...s, pantry: [...rows, { uid: nextUid(rows), id: food, day: s.day, from: 'him' }] } : { ...s, [g.field]: count(s[g.field]) + g.n };
  return noteHappening(noteBond({ ...got, gifts: [row, ...restoreGifts(s.gifts)].slice(0, GIFT_CAP) },
    'given', s.companion.name + (food ? '在夜市上给你买了' : '递给你') + label), 'gift', s.companion.name + (food ? '在夜市上给你买了' : '递给你') + label);
}
// 他约她：先自己走过去等，她到了、两个人都在那儿，才有那一段话（那一枪她点了才打）
export function restoreInvite(raw){
  const d = raw || {};
  return Object.hasOwn(COMPANION_DESTINATIONS, d.place || '') ? { place: d.place, day: Math.max(1, count(d.day)), note: trimText(d.note, 80) } : null;
}
export function inviteError(s, place){
  if (!destinationOf(s, place)) return '他还约不到那儿。';
  return '';
}
export function invite(s, place, note){
  if (inviteError(s, place)) return s;
  return { ...s, invite: { place, day: s.day, note: trimText(note, 80) },
    companion: { ...s.companion, mode: 'goto', destination: place } };
}
// 她赴约到了：同一天、两人都在约的那处
export function inviteMet(s){
  const inv = restoreInvite(s.invite), d = inv && COMPANION_DESTINATIONS[inv.place];
  if (!inv || !d || inv.day !== s.day || s.map !== d.map || !companionNearby(s)) return false;
  return Math.hypot(s.position.x - d.target.x, s.position.z - d.target.z) <= 2.4;
}
export function keepInvite(s){
  const inv = restoreInvite(s.invite);
  if (!inv) return s;
  const label = COMPANION_DESTINATIONS[inv.place].label.replace(/^去|^回/, '').replace(/等你$/, '');
  return noteHappening(noteBond({ ...s, invite: null }, 'date', '他约你去' + label + '，你去了'), 'world', '赴了' + s.companion.name + '的约，在' + label);
}
export const dropInvite = s => s.invite ? { ...s, invite: null } : s;
// 他没答应：村里的账上记一笔，他回自己的日程。⚠️不扣任何东西——拒绝是他的性格，不是她的错
export function refuse(s, why){
  const line = trimText(why, 60);
  return noteHappening({ ...s, companion: { ...s.companion, mode: 'routine' } }, 'world', s.companion.name + '这会儿没答应' + (line ? '：' + line : ''));
}
// ── 邻居活过来（她 2026-09-18：「做3和4」的 4）─────────────────────────
// ⚠️审计那天：玩家对邻居全部的动词是搬进来、搬走、换外貌、走近两米四。
//   这一版：能挥手、能递东西；打招呼的那句是他自己人设长出来的（手机那侧一枪，一位邻居一次）。
//   邻居之间照过几次面，村里的账上本来就有，翻出来给她看。
export const NEIGHBOR_REACH = 4, NEIGHBOR_HAND = 1.65;
export function neighborNear(s, reach = NEIGHBOR_REACH){
  let best = null, bd = reach;
  for (const n of restoreNeighbors(s.neighbors)){
    if (n.map !== s.map) continue;
    const d = Math.hypot(n.position.x - s.position.x, n.position.z - s.position.z);
    if (d < bd){ bd = d; best = n; }
  }
  return best;
}
const bumpMeet = (s, charId, by) => {
  const key = meetKey('me', charId), rows = restoreMeets(s.meets), row = rows.find(r => r.key === key);
  const next = { key, n: Math.max(0, (row ? row.n : 0) + by), day: s.day, slot: meetSlot(s) };
  return { ...s, meets: [next, ...rows.filter(r => r.key !== key)].slice(0, MEET_CAP) };
};
export function neighborWaveError(s, charId){
  const n = neighborOf(s, charId);
  if (!n) return 'TA 不住在村里。';
  if (s.seat || sleepPose(s)) return '先站起来，再活动一下。';
  if (n.map !== s.map || Math.hypot(n.position.x - s.position.x, n.position.z - s.position.z) > NEIGHBOR_REACH) return '走近' + n.name + '一点，再挥挥手。';
  return '';
}
// 一天对同一位只记一次（一路挥着手跟着人家走不是交情）
export function waveAtNeighbor(s, charId){
  if (neighborWaveError(s, charId)) return s;
  const n = neighborOf(s, charId);
  if ((s.greeted || {})[String(charId)] === s.day) return s;
  return noteHappening(bumpMeet({ ...s, greeted: { ...(s.greeted || {}), [String(charId)]: s.day } }, charId, 1), 'met', '你向' + n.name + '挥了挥手，' + n.name + '也抬手应了');
}
export function neighborGiftError(s, charId, ref){
  const n = neighborOf(s, charId);
  if (!n) return 'TA 不住在村里。';
  if (!giftItem(s, ref)) return '手上没有这一样。';
  if (s.seat || sleepPose(s)) return '先起身，面对面递给 TA。';
  if (n.map !== s.map || Math.hypot(n.position.x - s.position.x, n.position.z - s.position.z) > NEIGHBOR_HAND) return '靠近' + n.name + '一点，再把东西递过去。';
  if ((s.neighborGifts || {})[String(charId)] === s.day) return '今天已经递给' + n.name + '一样了。';
  return '';
}
// 递给邻居：不问喜好（那张表是同行者的），只算交情——处得近了公告栏上才落他的名字
export function giveToNeighbor(s, charId, ref){
  if (neighborGiftError(s, charId, ref)) return s;
  const n = neighborOf(s, charId), it = giftItem(s, ref);
  return noteHappening(bumpMeet({ ...takeGift(s, it), neighborGifts: { ...(s.neighborGifts || {}), [String(charId)]: s.day } }, charId, 2),
    'gift', '把「' + it.name + '」递给了' + n.name);
}
// ── 走近了能搭话（她 2026-09-18：「Ab 都做吧」的 a）────────────────────
// ⚠️⚠️邻居是【别人的角色】：你和同行者之间的事，TA 一个字都不该知道。
//   所以发给 TA 的不是那份 snapshot（那里头有同行者的位置、礼物、相处册、委托…），
//   而是这一份【专门为邻居裁的】。裁的规矩只写在这一处，别处不许再拼一份
//   （施工规则/one-public-mechanism.md）。
// ⚠️这是【两道闸】，别混成一道：
//   门（door）管的是【TA 自己的主线记忆】——TA 记不记得你们在手机上经历过的事；
//   这一份管的是【这一档里的私事】——同行者那条线，门开得再大也一个字都不给。
//   开了前一道就顺手漏后一道，是这条线上最容易犯的错。
// ⚠️村里最近发生的事也不给：那张表里混着「他在馆里站了一会儿，看的是…」这种，
//   那是同行者的事，不是村里的事。宁可少给，不许漏。
export function neighborView(s, charId){
  const n = neighborOf(s, charId); if (!n) return null;
  return {
    你是: n.name,
    你住在: MAPS.garden.sites[n.home].label,
    今天: '第 ' + s.day + ' 天 · ' + seasonOf(s.day).name + ' · ' + weather(s.day, s.epoch),
    此刻: timeLabel(s.minute),
    你正在: whereLabel(n.map, n.position),
    她正在: whereLabel(s.map, s.position),
    你们在村里碰见过: metCount(s, charId) + ' 次',
    处到: closeness(s, charId)
  };
}
export function neighborTalkError(s, charId){
  const n = neighborOf(s, charId);
  if (!n) return 'TA 不住在村里。';
  if (s.seat || sleepPose(s)) return '先起身，面对面说。';
  if (n.map !== s.map || Math.hypot(n.position.x - s.position.x, n.position.z - s.position.z) > NEIGHBOR_REACH)
    return '走近' + n.name + '一点再开口。';
  // ⚠️一天一位一次：这一枪是【她走过去、点了才打】的，可村里住着三位，
  //   不封顶的话站在原地连点就是一天十几枪。她主动要听的那一次值这个钱，连点的不值。
  if ((s.neighborTalks || {})[String(charId)] === s.day) return '今天已经和' + n.name + '聊过了，明天再说。';
  return '';
}
export function noteNeighborTalk(s, charId, said){
  if (neighborTalkError(s, charId)) return s;
  const n = neighborOf(s, charId);
  return noteHappening(bumpMeet({ ...s, neighborTalks: { ...(s.neighborTalks || {}), [String(charId)]: s.day } }, charId, 2),
    'met', '在' + whereLabel(s.map, s.position) + '和' + n.name + '说了几句' + (trimText(said, 40) ? '：' + trimText(said, 40) : ''));
}
// 邻居之间照过面的账（一枪不打，翻的是 meets 那张表）
export function neighborPairs(s){
  const rows = restoreNeighbors(s.neighbors), byId = Object.fromEntries(rows.map(n => [String(n.charId), n.name]));
  byId.companion = s.companion.name;
  return restoreMeets(s.meets).map(r => { const [a, b] = r.key.split('|'); return { a, b, n: r.n, day: r.day }; })
    .filter(r => r.a !== 'me' && r.b !== 'me' && byId[r.a] && byId[r.b])
    .map(r => ({ a: byId[r.a], b: byId[r.b], n: r.n, day: r.day }));
}
// ── 邻居之间真的说两句（她 2026-09-18 的 ②）──────────────────────────
// ⚠️只有【她在场看得见】的时候才打这一枪：两个 NPC 背着她聊天，她永远看不到，
//   钱花了、体验一点没有。所以要求她同一张图、离得够近。
// ⚠️还要【处过几次才聊】：刚搬来的两个人在路上碰见不会攀谈，那样反而假。
// ⚠️一对一天一次：村里三位邻居＋同行者，不封顶的话她站在集市上就是一串枪。
export const PAIR_WATCH = 7.5;     // 她离这两位多近才算看得见
export const PAIR_TALK_MIN = 3;    // 这两位照过这么多次面，才说得上话
export const pairKey = (a, b) => meetKey(a, b);
export const pairMet = (s, a, b) => (restoreMeets(s.meets).find(r => r.key === pairKey(a, b)) || {}).n || 0;
export function pairTalkError(s, a, b, watcher){
  if (!a || !b || String(a) === String(b)) return '这不是两个人。';
  if (String(a) === 'me' || String(b) === 'me') return '这一路只管别人之间。';
  if (pairMet(s, a, b) < PAIR_TALK_MIN) return '这两位还没熟到会站住说话。';
  if (!watcher) return '你不在跟前，听不见。';
  if ((s.pairTalks || {})[pairKey(a, b)] === s.day) return '今天这两位已经聊过了。';
  return '';
}
// ⚠️发给这两位的那一份：和 neighborView 同一个道理——她和同行者之间的私事一个字都不给。
//   ⚠️而且【谁的主线记忆都不给】：一枪里坐着两个角色，没法把 A 的记忆挡在 B 眼睛外面
//   （群聊那条规矩：每位成员的私有层必须落在自己那一段里，绝不许合成一块共享注入）。
//   所以这一路只给人设和眼前这个村子——宁可少给，不许漏。
export function pairView(s, a, b){
  const who = id => String(id) === 'companion' ? s.companion.name
    : (neighborOf(s, id) || {}).name || '';
  const at = id => String(id) === 'companion' ? whereLabel(s.companion.map, s.companion.position)
    : (n => n ? whereLabel(n.map, n.position) : '')(neighborOf(s, id));
  return {
    今天: '第 ' + s.day + ' 天 · ' + seasonOf(s.day).name + ' · ' + weather(s.day, s.epoch),
    此刻: timeLabel(s.minute),
    在哪儿碰上的: at(a) || at(b),
    这两位: [who(a), who(b)],
    他们照过面: pairMet(s, a, b) + ' 次'
  };
}
export function notePairTalk(s, a, b, said){
  if (!a || !b) return s;
  const text = trimText(said, 60);
  return noteHappening({ ...s, pairTalks: { ...(s.pairTalks || {}), [pairKey(a, b)]: s.day } },
    'met', '路上撞见' + (pairView(s, a, b).这两位.filter(Boolean).join('和')) + '站住说了两句'
      + (text ? '：' + text : ''));
}
// ── 世界自己长的那一件小事（她 2026-09-17：「做 AbC 吧」的 B）──────────
// ⚠️「回来看看变了什么」是放置类的全部乐趣。现在她回来，变的只有天数。
// ⚠️一枪都不打，而且【只从她自己的存档里长】：说的每一句都是真有的东西，
//   绝不凭空编一件没发生过的事（那是这个库最深的一条线）。
// ⚠️挑中哪一件由存档号＋天数定死：同一天进来几次都是同一件，不是摇奖机。
function dailySeeds(s){
  // ⚠️只从她自己的存档里长：挑存档的那几句都先问过「有没有」，
  //   剩下那几句不挑存档但也只说这个村子本来就有的东西。一句都不许编。
  const rows = [], day = s.day;
  const notes = (s.notes || []), shards = (s.shards || []), kept = (s.collection || []);
  const things = (s.things || []).filter(t => t.spot), bottles = (s.bottles || []).filter(b => b.taken);
  const lamp = workDone(s, 'pathLamp');
  if (kept.length) rows.push('馆里那件「' + kept[0].name + '」被人挪正了一点，像是有人站着看过。');
  if (things.length) rows.push('摆在' + SPOTS[things[0].spot] + '的「' + things[0].name + '」上落了一层薄灰，擦一擦还是老样子。');
  if (notes.length) rows.push('第 ' + notes[0].day + ' 天那张花笺被风翻了过来，背面什么也没写。');
  if (shards.length) rows.push('背包里那片' + SHARD_KINDS[shards[0].kind] + '今早是凉的，昨天还不是。');
  if (bottles.length) rows.push('水边多了一只空瓶子，不是你放下去的那只。');
  if (lamp) rows.push('小路那盏灯昨夜亮了一整晚，没人去关。');
  if ((s.seeds || []).some(x => !x.done)) rows.push('地里那几株比昨天高了一点，还没到开的时候。');
  rows.push('公告栏边上多了一张没署名的纸，字被雨泡开了，看不清。');
  rows.push('井口的绳子被人盘好了，盘得比你平时整齐。');
  rows.push('屋后有一串脚印，从小路那头来，到门口就停了。');
  rows.push('溪上那座小桥的木头昨夜响了一宿，今早又没事了。');
  rows.push('公共厅的门虚掩着，里面没人，炉子却是温的。');
  rows.push('月潭边的石头上摆着三颗小果子，摆得很整齐。');
  rows.push('林子那头的雾今天散得比平常晚。');
  return rows;
}
export function dailyNote(s){
  // ⚠️先把最近说过的那几句划掉再抽：连着三天同一句，「世界在动」立刻就假了。
  //   都划完了（存档还很空）才退回整份名单——宁可重复，也不许一天都没有。
  const rows = dailySeeds(s);
  const said = new Set(restoreHappenings(s.happenings).filter(x => x.kind === 'world').slice(0, 5).map(x => x.text));
  const fresh = rows.filter(x => !said.has(x));
  const pool = fresh.length ? fresh : rows;
  return pool[hash(String(s.epoch) + ':daily:' + s.day) % pool.length];
}
// ── 天气真的改变今天能做什么（她 2026-09-17：「做 AbC 吧」的 C）──────────
// ⚠️原来天气只改两样：他的日程和雨铃响不响——那是【滤镜】，不是玩法。
//   下面这几条各自改掉一件她今天真的会做的事，全都是代码算的。
// 雨雪天井壁湿滑：下去和往下都慢一截（不是不让下——不许拿「今天不行」堵她的路）
export const DIVE_WET = 1.6;
export const diveWeight = s => !hasBuff(s, 'warm') && ['细雨', '细雪'].includes(weather(s.day, s.epoch)) ? DIVE_WET : 1;
export const diveWet = s => diveWeight(s) > 1;
// 雾天看不清远处：地图上只标近的那几处（游戏那头照这个画）
export const MAP_FOG_RANGE = 17;
export const mapFoggy = s => weather(s.day, s.epoch) === '薄雾';
// ── 念咒（她 2026-09-17 想要的那种「能 cast spell」的魔法）─────────────
// ⚠️这条线的材料是【碎片】——那是你们之间真说过的话、真做过的梦。
//   所以魔法自动就是「关系相关」的，不用另造一个好感度数字。
// ⚠️施法【不烧掉那片碎片】。烧掉「那天他在楼下等你」去换一场雨，感觉是坏的，
//   也违背这个库最深的一条：东西不会凭空没了。
//   它是【从背包出去、封进世界里的一个位置】：还读得到，但不能再拿去合炉或进锅。
// ⚠️一枪都不打：封进去之后那句话是碎片自己的原文，不是生成的。
export const SPELLS = {
  echo: { name: '回声咒', need: 'echo', note: '把一句听过的话留在一个地方，走到那儿还听得见' },
  dream: { name: '假寐咒', need: 'dream', note: '让一个地方夜里有一场不是真的天气' },
  sense: { name: '留感咒', need: 'sense', note: '把一段感觉留在一个地方，摸得到' },
  relic: { name: '唤醒咒', need: 'relic', note: '把一件说不清的东西叫醒，它会自己待在那儿' }
};
// 封在哪儿：都是她本来就会走到的地方
export const SPELL_PLACES = { eaves: '屋檐下', sill: '窗台', pond: '池边', well: '井口', plot: '花圃边',
  lamp: '屋前的灯下', pathlamp: '小路那盏灯下',
  fallenTree: '林道上那棵倒树', reedBridge: '湖上那片芦苇', towerVines: '封着观星台的藤蔓' };
// ── 会开的路（她 2026-09-17：「先做吧宝宝」；交接单：庭院工单-会开的路-2026-09-17.md）
// ⚠️这【不是第二套魔法】：开路就是往那一处封一片碎片——同一个 castSpell、
//   同一份 casts、同一句「走到那儿还听得见」。区别只在于这三处封完之后，
//   挡在那儿的东西不再挡路了（施工规则/one-public-mechanism.md）。
// ⚠️挡不挡路的那一句只改在 walkable 一处，就写在湖结冰那一句旁边——
//   那一句是 codex 自己发明的同一个形状，这儿只是把它从「湖专用」变成谁都能用。
// ⚠️碎片照旧【不烧掉】：它是从背包出去、封进世界里的一个位置，还读得到。
export const OPENINGS = {
  fallenTree: { site: 'fallenTree', spell: 'relic',
    shut: '一棵倒树横在泥路上，树根那头还连着土。',
    open: '树被抬起来了，底下露出能过人的缝。',
    done: '林道上那棵倒树被抬了起来，路通到了深林' },
  reedBridge: { site: 'reedBridge', spell: 'sense',
    shut: '水从芦苇里流过去，对岸的小岛隔着一段没有路的水面。',
    open: '芦苇自己编成了一道桥，踩上去会轻轻晃。',
    done: '湖上的芦苇编成了一道桥，小岛能过去了' },
  towerVines: { site: 'towerVines', spell: 'dream',
    shut: '藤蔓把那一处封得很密，叶子底下透出一点光。',
    open: '藤蔓让开了，像有人替你把门推了一下。',
    done: '旧塔里那片藤蔓让开了' }
};
export const isOpening = key => Object.hasOwn(OPENINGS, key);
// ⚠️s 可以是空的：walkable(x,z,map) 不带存档的调用全库到处都是（寻路器里就有）。
//   不挡这一下，主寻路器会当场抛错——比「路开了走不过去」更坏。
export const opened = (s, key) => isOpening(key) && !!s && !!castAt(s, key);
// 这一处的模型还没有标记＝这条路这一版还没接上。
// ⚠️不许在这之前就让她封：封了却走不过去，那是骗她。
//   标记一到（codex 在 obstacles 上加 opensWith），这三处自己就开了口，不用再发一版。
export const openingReady = key => isOpening(key)
  && Object.values(MAPS).some(m => (m.obstacles || []).some(o => o.opensWith === key));
// 走到那儿看见的是哪一句：开了是开了那一句，没开是挡着那一句
export const openingLine = (s, key) => isOpening(key) ? (opened(s, key) ? OPENINGS[key].open : OPENINGS[key].shut) : '';
// 路还封着的时候，走到那儿该看见的那一句。⚠️只此一份：座位（sit）和散步到访（visit）
//   都来问它。原来芦苇桥那一句是写死在 sit 那一支里的「先在许愿树下用留感咒编起芦苇桥。」——
//   倒树和藤蔓照着再抄两句，就是同一层活在三处（施工规则/one-public-mechanism.md）。
export const shutError = (s, key) => !isOpening(key) || opened(s, key) ? ''
  : OPENINGS[key].shut + '先用' + SPELLS[OPENINGS[key].spell].name + '把它打开。';
// ⚠️后两处要【先有灯】。这是把魔法那条线接进别的线的地方：
//   屋前那几盏是星铃灯做出来的（月光花那条），小路那盏是委托修好的（公告栏那条）。
//   灯从此不是终点，是【一处能封咒的地方】——这就是那个四盏灯天花板的拆法。
export function castPlaceError(s, place){
  if (!Object.hasOwn(SPELL_PLACES, place)) return '还没有这个地方。';
  if (place === 'lamp' && !count((s.magic || {}).lamps)) return '屋前还没有灯。先做一盏星铃灯。';
  if (place === 'pathlamp' && !workDone(s, 'pathLamp')) return '小路那盏灯还坏着。公告栏上有人要修它。';
  if (isOpening(place) && !openingReady(place)) return '那一处还没通到这个世界里来。';
  return '';
}
const SPELL_ORDER = ['echo', 'dream', 'sense', 'relic'];
// 这一季的种子教的是哪一个咒（一季一颗，四季轮一圈）
export const spellOfSeason = index => SPELL_ORDER[Math.max(0, count(index)) % SPELL_ORDER.length];
export function restoreSpells(raw){
  return [...new Set((Array.isArray(raw) ? raw : []).filter(x => Object.hasOwn(SPELLS, x)))];
}
export function restoreCasts(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && Object.hasOwn(SPELL_PLACES, x.place) && Object.hasOwn(SPELLS, x.spell) && x.text)
    .slice(0, 12).map(x => ({ place: x.place, spell: x.spell, kind: shardKind(x.kind) || SPELLS[x.spell].need,
      text: trimText(x.text, 240), day: Math.max(1, count(x.day)) }));
}
export const castAt = (s, place) => restoreCasts(s.casts).find(x => x.place === place) || null;
export function castError(s, spell, shardId, place){
  if (!Object.hasOwn(SPELLS, spell)) return '还没有这个咒。';
  if (!restoreSpells(s.spells).includes(spell)) return '这个咒你还不会——一季一个，跟他一起去林地唤醒种子。';
  const where = castPlaceError(s, place); if (where) return where;
  if (castAt(s, place)) return SPELL_PLACES[place] + '已经封着一片了，一个地方只留一片。';
  if (isOpening(place) && OPENINGS[place].spell !== spell)
    return SPELL_PLACES[place] + '要的是' + SPELLS[OPENINGS[place].spell].name + '。';
  const shard = (s.shards || []).find(x => x.id === shardId);
  if (!shard) return '先挑一片碎片。';
  if (shard.kind !== SPELLS[spell].need) return SPELLS[spell].name + '要的是' + SHARD_KINDS[SPELLS[spell].need] + '。';
  return '';
}
export function castSpell(s, spell, shardId, place){
  if (castError(s, spell, shardId, place)) return s;
  const shard = (s.shards || []).find(x => x.id === shardId);
  const row = { place, spell, kind: shard.kind, text: shard.text, day: s.day };
  const out = { ...s, shards: (s.shards || []).filter(x => x.id !== shardId), casts: restoreCasts([row, ...(s.casts || [])]) };
  return noteHappening(companionNearby(s) ? noteBond(out, 'cast', s.companion.name + '陪你在许愿树下念了一个' + SPELLS[spell].name) : out,
    'world', isOpening(place) ? OPENINGS[place].done
      : '在' + SPELL_PLACES[place] + '念了一个' + SPELLS[spell].name);
}
// 走到那儿会看见什么。⚠️用的是碎片自己的原文——这儿不生成任何文字
export function castLine(s, place){
  const row = castAt(s, place);
  if (!row) return '';
  const where = SPELL_PLACES[place];
  if (row.spell === 'echo') return where + '又响起那一句：「' + row.text + '」';
  if (row.spell === 'dream') return where + '这一片不太对劲，像是谁的梦漏了出来：' + row.text;
  if (row.spell === 'sense') return where + '还留着那个感觉：' + row.text;
  return where + '那件东西醒着：' + row.text;
}
// ── 住进来的邻居（她 2026-09-17：「更像邻居关系」）────────────────────────
// ⚠️邻居【就是同行者那一份东西】，只是不是此刻跟你在一起的那一个：
//   同一个 restoreCompanion、同一个 companionPlan、同一个控制器，各跑一份。
//   另写一套"邻居移动"就是同一层活在两处（施工规则/one-public-mechanism.md）。
// ⚠️那三间邻居屋早就盖在那儿了（codex 陆续打开了阁楼、花舍）。名额就是三间。
export const NEIGHBOR_HOUSES = ['neighbor1', 'neighbor2', 'neighbor3'];
export const NEIGHBOR_MAX = NEIGHBOR_HOUSES.length;
// ── 邻居这扇门带进什么（她 2026-09-18：「邀请邻居进来是不是也能直接设置他们的房间」）──
// ⚠️那几条开关【不在这儿写第二份】：名字、措辞和分寸都住在 js/chat-rooms.js 的
//   GROUPS.cognition 里，全库的房间用的就是那一份。这边只记【开了哪几条】，
//   怎么念、怎么发全由宿主那侧照那张表来（施工规则/one-public-mechanism.md）。
//   在这儿抄一份键名，那张表哪天加一条，这边就漏一条。
// ⚠️默认全关，和庭院房那个预设一个口径：请进村的是别人的角色，
//   什么都不带才是安全的起点；要带什么由她一条条拨开。
export const DOOR_MAX = 16;
export const restoreDoor = raw => Object.fromEntries(Object.entries(raw && typeof raw === 'object' ? raw : {})
  .filter(([k, v]) => typeof k === 'string' && k.length <= 24 && v === true).slice(0, DOOR_MAX));
export function setNeighborDoor(s, charId, door, name){
  const row = neighborOf(s, charId); if (!row) return s;
  const next = { ...row, door: restoreDoor(door) };
  if (typeof name === 'string' && trimText(name, 16)) next.name = trimText(name, 16);
  return { ...s, neighbors: restoreNeighbors((s.neighbors || [])
    .map(n => String(n.charId) === String(charId) ? next : n)) };
}
export function restoreNeighbors(raw){
  const seen = new Set(), houses = new Set();
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.charId && NEIGHBOR_HOUSES.includes(x.home))
    .filter(x => { const id = String(x.charId); if (seen.has(id) || houses.has(x.home)) return false;
      seen.add(id); houses.add(x.home); return true; })
    .slice(0, NEIGHBOR_MAX)
    .map(x => ({ ...restoreCompanion(x), charId: String(x.charId).slice(0, 40), home: x.home, door: restoreDoor(x.door) }));
}
export const freeHouse = s => NEIGHBOR_HOUSES.find(h => !restoreNeighbors(s.neighbors).some(n => n.home === h)) || null;
export const neighborOf = (s, charId) => restoreNeighbors(s.neighbors).find(n => String(n.charId) === String(charId)) || null;
export function moveInError(s, charId){
  if (!charId) return '先挑一位角色。';
  if (String(s.partnerId || '') === String(charId)) return 'TA 已经和你住在一起了。';
  if (neighborOf(s, charId)) return 'TA 已经住在村里了。';
  if (!freeHouse(s)) return '三间邻居屋都住满了。';
  return '';
}
export function moveIn(s, { charId, name, look, door }){
  if (moveInError(s, charId)) return s;
  const home = freeHouse(s);
  const at = MAPS.garden.sites[home].target;
  const row = { ...freshCompanion(), charId: String(charId), home, name: trimText(name, 16) || '邻居',
    look: restoreLook(look), map: 'garden', position: { ...at }, destination: 'home', door: restoreDoor(door) };
  return noteHappening({ ...s, neighbors: restoreNeighbors([...(s.neighbors || []), row]) },
    'world', row.name + '搬进了' + MAPS.garden.sites[home].label);
}
export function moveOut(s, charId){
  const row = neighborOf(s, charId);
  if (!row) return s;
  return noteHappening({ ...s, neighbors: restoreNeighbors(s.neighbors).filter(n => String(n.charId) !== String(charId)) },
    'world', row.name + '从' + MAPS.garden.sites[row.home].label + '搬走了');
}
// ── 一起转星仪（她 2026-09-18：「做吧宝宝」；codex 提的②：两个人需要配合）──────
// ⚠️这是全库第一件【两个人各做一半、合起来才成】的事。原来「两个人」只有一种形状：
//   他在旁边，于是好一点（唤醒种子、水磨帮一把、并肩放水灯）。那是加成，不是配合。
// ⚠️旧塔观星室是 codex 盖好的现成舞台：楼下站着铜环星仪，台阶上去是残顶观测台。
//   一个人在下面转环，一个人在台上看光落在哪儿——这一版一个新景都不加。
// ⚠️门开不开【由代码判】：对没对准是个数字。模型只负责他怎么开口报方向，
//   那一枪等这副骨架立住了再接（她 2026-09-18 拍的板：先不打枪）。
export const STAR_MARKS = 12;                       // 铜环一圈十二格
export const STAR_SPOTS = { dial: 'orrery', watch: 'telescope' };
export const STAR_ROLES = { dial: '在楼下转铜环', watch: '在台上看光' };
export const STAR_REACH = 2.2;
// 今晚对哪一格：由存档号＋天数定死。同一天进来几次都是那一格，不是摇奖机。
export const starTarget = s => hash(String(s.epoch) + ':star:' + Math.max(1, count(s.day))) % STAR_MARKS;
export function restoreStar(raw){
  const d = raw && typeof raw === 'object' ? raw : {};
  return { angle: count(d.angle) % STAR_MARKS, role: Object.hasOwn(STAR_ROLES, d.role) ? d.role : '',
    day: count(d.day), doneDay: count(d.doneDay) };
}
export const starDone = s => restoreStar(s.star).doneDay === s.day;
const atSpot = (p, map, key) => {
  const site = MAPS[map]?.sites?.[STAR_SPOTS[key]];
  return !!site && Math.hypot(site.target.x - p.x, site.target.z - p.z) <= STAR_REACH;
};
// 这会儿这一局成不成立：两个人都在塔里、她占了一头、今晚还没对上
export const starLive = s => s.map === 'oldTower' && s.companion.map === 'oldTower'
  && !!restoreStar(s.star).role && !starDone(s);
export const starOther = role => role === 'dial' ? 'watch' : role === 'watch' ? 'dial' : '';
export function starError(s, role){
  if (s.map !== 'oldTower') return '这件事在旧塔的观星室里。';
  if (!Object.hasOwn(STAR_ROLES, role)) return '先挑一头。';
  if (starDone(s)) return '今晚已经对上过了，明晚再来。';
  if (s.companion.map !== 'oldTower') return s.companion.name + '还没上来，叫上 TA 一起。';
  if (!atSpot(s.position, s.map, role)) return '先走到' + MAPS.oldTower.sites[STAR_SPOTS[role]].label + '那儿。';
  return '';
}
// 她占一头，他就去另一头。⚠️「他去哪儿」只写在 companion.mjs 的 plannedActivity 那一处
//   （tick 在 routine 模式绕开 companionPlan——这一课这一季栽过三次了）。
export function takeStarRole(s, role){
  if (starError(s, role)) return s;
  const star = restoreStar(s.star);
  return { ...s, star: { ...star, role, day: s.day, angle: star.day === s.day ? star.angle : 0 } };
}
export const starLeave = s => ({ ...s, star: { ...restoreStar(s.star), role: '' } });
// 差几格、偏哪边。⚠️【只有站在台上的那一位看得见】：转的人看不见这个数，
//   看的人转不动那个环——这一句就是「配合」本身，两边谁都不能一个人做完。
export function starGap(s){
  const star = restoreStar(s.star);
  let gap = (starTarget(s) - star.angle) % STAR_MARKS;
  if (gap > STAR_MARKS / 2) gap -= STAR_MARKS;
  if (gap < -STAR_MARKS / 2) gap += STAR_MARKS;
  return gap;
}
export const starAligned = s => starGap(s) === 0;
// 台上那个人看到的：差得远、差一点、对上了，再加偏哪边
// 差多少：光落在哪一档。⚠️这是个数，由代码判——模型只换【他怎么说】。
export const starBand = s => { const near = Math.abs(starGap(s));
  return !near ? 'done' : near > 3 ? 'far' : near > 1 ? 'near' : 'close'; };
const STAR_PLAIN = { done: '光正落在刻痕上。', far: '光还偏得远。', near: '快了。', close: '就差一点。' };
// 他报方向那一句。⚠️voice 是他自己的说法（宿主那一枪，一位角色一辈子问一次）；
//   没有就退回上面那四句白话——这一层永远说得出话，不靠那一枪活着。
// ⚠️方向那半句【永远是代码接的】：模型只管前半句怎么说，往左往右不许它编。
export function starReading(s, voice){
  const band = starBand(s), said = (voice && typeof voice[band] === 'string' && voice[band].trim()) || STAR_PLAIN[band];
  if (band === 'done') return said;
  return said + '往' + (starGap(s) > 0 ? '右' : '左') + '边。';
}
// 转一格。⚠️谁在转要分清楚：她占 dial 就是她自己转，她占 watch 就是【她指挥他转】。
//   两种都从这一处走，不然「他转」那一路迟早自己长出一套。
export function turnStar(s, step){
  if (!starLive(s)) return s;
  const star = restoreStar(s.star);
  const raw = Number.isFinite(Number(step)) ? Math.trunc(Number(step)) : 1;
  const by = (raw < 0 ? -1 : 1) * Math.min(3, Math.abs(raw) || 1);
  return { ...s, star: { ...star, angle: ((star.angle + by) % STAR_MARKS + STAR_MARKS) % STAR_MARKS } };
}
// 对上了。⚠️一天一次，而且【两个人都得在位置上】——一个人把环转对了不算数。
export function alignStar(s){
  if (!starLive(s) || !starAligned(s)) return s;
  const star = restoreStar(s.star);
  if (!atSpot(s.position, s.map, star.role)) return s;
  if (!atSpot(s.companion.position, s.companion.map, starOther(star.role))) return s;
  return noteHappening(noteBond({ ...s, star: { ...star, doneDay: s.day },
    stones: count(s.stones) + 1 }, 'star', '在旧塔一起把铜环对上了今晚那一格'),
    'world', '你们把铜环对上了今晚那一格，残顶落下一道光');
}
// ── 碰见（她 2026-09-17：「继续做玩法吧」）────────────────────────────
// ⚠️三个人住进来了，可她走一整天什么也不会发生——「做了没有回响」在多人这一头
//   又长了一遍。碰见就是那个回响最小的一份：谁和谁在哪儿照过面，村里的账上有。
// ⚠️一枪都不打，而且【只记世界看见的事，不替谁说话】：
//   「在集市碰见阿棠和小满」是真发生的；替阿棠编一句台词就是无中生有。
// 这个点该叫什么地方。⚠️只写在这一处：碰见、日记、以后要说「他在哪儿」
//   都得给同一个答案，各算一遍迟早出现「你在月潭碰见他，他却在小桥」。
export function whereLabel(map, point){
  const m = MAPS[map]; if (!m || !point) return '村里';
  let best = null, near = 4.2;
  for (const [, site] of Object.entries(m.sites || {})){
    const d = Math.hypot(site.target.x - point.x, site.target.z - point.z);
    if (d < near){ near = d; best = site.label; }
  }
  return best || m.name;
}
export const MEET_NEAR = 2.4;          // 两个人算碰上了的距离
export const MEET_CAP = 24;            // 只记这么多对，满了挤掉最久没碰过的
// 一天切成六段：同一对人在同一段里只记一次。不这么切的话，两个人并排走
// 一路就是几十条，村里的账会被一件事塞满。
export const MEET_SLOTS = 6;
export const meetSlot = s => Math.floor(Math.max(0, count(s.minute)) / (1440 / MEET_SLOTS));
export const meetKey = (a, b) => [String(a), String(b)].sort().join('|');
export function restoreMeets(raw){
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).filter(x => x && typeof x.key === 'string' && !seen.has(x.key) && seen.add(x.key))
    .map(x => ({ key: x.key, n: count(x.n, 999), day: count(x.day), slot: count(x.slot, MEET_SLOTS) }))
    .slice(0, MEET_CAP);
}
// 处到什么程度了。⚠️只数【她自己碰见的那些】：邻居之间碰得再多也不是她的交情。
export const MEET_TIERS = [[0, '刚搬来'], [4, '脸熟了'], [12, '处熟了']];
export const metCount = (s, charId) => (restoreMeets(s.meets).find(r => r.key === meetKey('me', charId)) || {}).n || 0;
export const closeness = (s, charId) => {
  const n = metCount(s, charId);
  let out = MEET_TIERS[0][1];
  for (const [need, label] of MEET_TIERS) if (n >= need) out = label;
  return out;
};
// 记一次照面。a／b 是 'me'、'companion' 或邻居的 charId；名字由调用方给，
// 因为名字住在存档里的三个不同地方（她没有名字、同行者一个、邻居各一个）。
export function noteMeet(s, { a, b, nameA, nameB, place }){
  if (!a || !b || String(a) === String(b)) return s;
  const key = meetKey(a, b), slot = meetSlot(s), rows = restoreMeets(s.meets);
  const row = rows.find(r => r.key === key);
  if (row && row.day === s.day && row.slot === slot) return s;      // 这一段里已经记过了
  const next = { key, n: (row ? row.n : 0) + 1, day: s.day, slot };
  const others = rows.filter(r => r.key !== key);
  const here = trimText(place, 20) || '村里';
  const line = String(a) === 'me' ? '你在' + here + '碰见了' + trimText(nameB, 16)
    : String(b) === 'me' ? '你在' + here + '碰见了' + trimText(nameA, 16)
    : trimText(nameA, 16) + '和' + trimText(nameB, 16) + '在' + here + '碰上了';
  return noteHappening({ ...s, meets: [next, ...others].slice(0, MEET_CAP) }, 'met', line);
}
// 控制器跑邻居用的那一份适配：让它以为这一位就是同行者。
// ⚠️不改控制器内部——邻居和同行者用的是同一段走路逻辑，这才是一份实现两处用。
export const asCompanion = (s, n) => ({ ...s, companion: n, seasonPlan: null, seat: null,
  sleep: { player: (s.sleep || {}).player || null, companion: null } });
// ── 星井（下潜）────────────────────────────────────────────────────────
// depth   现在在第几层（0＝在地面上）
// sand    星砂：三份能在炼药锅换一颗月露
// stones  月石：每得一颗，往下的路再通两层（这就是下潜的进度）
export const deepestAllowed=s=>Math.min(DEPTH_MAX,DEPTH_BASE+count(s&&s.stones)*2);
// 井纹残片原来第五颗之后全废（深度到顶）。现在多出来的每一颗是一片星图：
//   攒够六片、两个人夜里都在旧塔，就能一起摊开看一夜（那一枪她点了才打，走「他来找你」同一条路）。
// ⚠️不扣 stones：深度是用它算的，扣了她下不了井。看过几夜另记一个数。
export const STAR_CHART_NEED=6,STAR_CHART_FROM=5;   // 第五颗把深度推到顶（3+5×2≥12），第六颗起是星图
export const starChartPieces=s=>Math.max(0,count(s.stones)-STAR_CHART_FROM-count(s.starNights)*STAR_CHART_NEED);
export const starNightReady=s=>starChartPieces(s)>=STAR_CHART_NEED&&s.map==='oldTower'&&companionNearby(s)&&s.minute>=seasonOf(s.day).dusk;
export function keepStarNight(s){if(!starNightReady(s))return s;return noteHappening(noteBond({...s,starNights:count(s.starNights)+1},'night','在旧塔一起摊开星图看了一夜'),'world','把攒下的星图碎片拼在一起，和'+s.companion.name+'看了一夜');}
export function restoreSleep(raw,map,position){const valid=id=>typeof id==='string'&&Object.hasOwn(MAPS.home.beds,id)?id:null,player=valid(raw?.player),companion=valid(raw?.companion),p=player&&MAPS.home.beds[player].approach.player;return {player:map==='home'&&p&&position&&Math.hypot(position.x-p.x,position.z-p.z)<.3?player:null,companion};}
export function wakeSleeper(s,who='player'){return {...s,sleep:{...(s.sleep||{player:null,companion:null}),[who]:null}};}
// 一起睡时两个人之间留的距离；各睡各的是床位本来的 1.2 米。
export const SLEEP_HUG_GAP=.66;
function bedSlot(s,who){const id=s.sleep?.[who],b=Object.hasOwn(MAPS.home.beds,id||'')?MAPS.home.beds[id]:null,person=who==='player'?s:s.companion;if(!b||person.map!=='home'||Math.hypot(person.position.x-b.approach[who].x,person.position.z-b.approach[who].z)>.14)return null;return {slot:b.slots[who],bed:b};}
// 相拥而眠（她 2026-09-18：「然后在床上能不能搞个相拥而眠的动作」）：
// 只有【同一张床】而且【两个人都已经躺下】才算——他还没上床时抱着空气最难看。
// 躺姿这一份是她和他共用的，所以靠哪一侧、往哪边侧身都从这里算，渲染那边不再自己猜。
export function sleepPose(s,who='player'){
 const mine=bedSlot(s,who);if(!mine)return null;
 const {slot,bed}=mine;
 const together=!!(s.sleep?.player&&s.sleep.player===s.sleep.companion&&bedSlot(s,'player')&&bedSlot(s,'companion'));
 if(!together)return slot;
 const mid=(bed.slots.player.x+bed.slots.companion.x)/2;
 const toward=slot.x<mid?1:-1; // 对方在 +x 还是 -x
 return {...slot,x:mid-toward*SLEEP_HUG_GAP/2,hug:true,toward,hugArm:who==='companion'};
}
export function arrangeSleep(s,id,mode){const b=Object.hasOwn(MAPS.home.beds,id||'')?MAPS.home.beds[id]:null;if(s.map!=='home'||!b||!['together','separate','companion'].includes(mode)||Math.hypot(s.position.x-b.approach.player.x,s.position.z-b.approach.player.z)>.65)return s;const other=Object.keys(MAPS.home.beds).find(k=>k!==id);return {...s,seat:null,sleep:{player:mode==='companion'?null:id,companion:mode==='separate'?other:id}};}
// Cosmetic gestures never change inventory, relationship or the character's routine.
export function gestureError(s,kind){
 if(s.seat||sleepPose(s))return '先站起来，再活动一下。';
 if(kind==='stretch')return '';
 if(kind!=='wave')return '这个动作还不会。';
 if(s.companion.map!==s.map||Math.hypot(s.position.x-s.companion.position.x,s.position.z-s.companion.position.z)>4)return '走近同行者一点，再挥挥手。';
 if(sleepPose(s,'companion'))return 'TA 正在休息，等醒来再打招呼。';
 return '';
}
// 「今天对谁做过了」这种小账：{charId: day}
function restoreDayMarks(d){return Object.fromEntries(Object.entries(d&&typeof d==='object'?d:{}).filter(([k,v])=>k&&Number.isInteger(v)&&v>0).slice(0,12).map(([k,v])=>[String(k).slice(0,40),v]));}
export function freshState(){return {version:9,neighborTalks:{},pairTalks:{},layout:2,interiorLayout:2,epoch:'initial',wellKit:'none',wellTrip:null,workshop:restoreWorkshop(null),waterLights:[],seat:null,sleep:{player:null,companion:null},look:{},seeds:[],notes:[],shards:[],vein:[],things:[],made:[],collection:[],bottles:[],drifts:[],partnerId:'',star:restoreStar(null),happenings:[],bond:[],gifts:[],invite:null,greeted:{},neighborGifts:{},wishes:[],spent:0,starNights:0,guide:restoreGuide(null),birthday:0,pantry:[],tasted:[],recipes:restoreRecipes(null),buffs:{},fairs:[],festivals:[],meets:[],spells:[],casts:[],neighbors:[],miss:{score:0,day:0,since:1,cameAt:0},quests:[],fixtures:restoreFixtures(null),deeds:0,magic:freshMagic(),today:{},journal:[],map:'garden',day:1,minute:480,water:0,blooms:0,herbs:0,mushrooms:0,potions:0,harvest:0,sand:0,stones:0,depth:0,picked:[],position:{...START},companion:freshCompanion()};}
export function restoreState(raw){if(raw&&raw.interiorLayout!==2){raw={...raw,interiorLayout:2,companion:raw.companion?{...raw.companion}:raw.companion};for(const who of ['player','companion']){const person=who==='player'?raw:raw.companion;if(!person||!MAPS[person.map]?.interior)continue;const bed=person.map==='home'&&Object.hasOwn(MAPS.home.beds,raw.sleep?.[who])&&MAPS.home.beds[raw.sleep[who]];person.position={...(bed?bed.approach[who]:MAPS[person.map].spawn)};}}if(raw&&raw.layout!==2){raw={...raw,layout:2,position:raw.map==='garden'?migrateVillagePosition(raw.position):raw.position,companion:raw.companion?{...raw.companion,position:raw.companion.map==='garden'?migrateVillagePosition(raw.companion.position):raw.companion.position}:raw.companion};}const prior=raw&&[1,2,3,4,5,6,7,8,9].includes(raw.version)?raw:freshState(),d=prior.version<5?{...prior,position:prior.map==='forest'?prior.position:{...START},companion:prior.companion?.map==='forest'?prior.companion:{...prior.companion,position:freshCompanion().position}}:prior,map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {version:9,layout:2,interiorLayout:2,epoch:typeof d.epoch==='string'?d.epoch.slice(0,80):'initial',wellKit:Object.hasOwn(WELL_KITS,d.wellKit)?d.wellKit:'none',wellTrip:map==='depths'?{day:Math.max(1,Math.min(count(d.day)||1,count(d.wellTrip?.day)||count(d.day)||1)),kit:Object.hasOwn(WELL_KITS,d.wellTrip?.kit)?d.wellTrip.kit:(Object.hasOwn(WELL_KITS,d.wellKit)?d.wellKit:'none')}:null,workshop:restoreWorkshop(d.workshop),waterLights:restoreWaterLights(d.waterLights),magic:restoreMagic(d.magic),today:restoreToday(d.today),journal:restoreJournal(d.journal),map,sleep:restoreSleep(d.sleep,map,d.position),seat:seatsOf(map)[d.seat]&&d.position&&Math.hypot(d.position.x-seatsOf(map)[d.seat].x,d.position.z-seatsOf(map)[d.seat].z)<.2?d.seat:null,day:Math.max(1,count(d.day)),minute:d.version>=3?Math.max(420,count(d.minute,1379)):480,water:count(d.water,3),blooms:count(d.blooms,3),herbs:count(d.herbs),mushrooms:count(d.mushrooms),potions:count(d.potions),harvest:count(d.harvest),sand:count(d.sand),stones:count(d.stones),
 // 旧存档没有 depth；人从井里出来才算数，所以不在井底就一律 0
 depth:map==='depths'?Math.max(1,Math.min(DEPTH_MAX,count(d.depth))):0,picked:[...new Set(Array.isArray(d.picked)?d.picked.filter(id=>NODES.some(n=>n.id===id)):[])],position:d.position&&walkable(d.position.x,d.position.z,map,d)?{x:d.position.x,z:d.position.z}:{...MAPS[map].spawn},companion:restoreCompanion(d.companion,d),look:restoreLook(d.look),seeds:restoreSeeds(d.seeds),notes:restoreNotes(d.notes),shards:restoreShards(d.shards),vein:restoreVein(d.vein),things:restoreThings(d.things),made:restoreMade(d.made),collection:restoreCollection(d.collection),bottles:restoreBottles(d.bottles),drifts:restoreDrifts(d.drifts),partnerId:typeof d.partnerId==='string'?d.partnerId.slice(0,64):'',star:restoreStar(d.star),happenings:restoreHappenings(d.happenings),bond:restoreBond(d.bond),gifts:restoreGifts(d.gifts),invite:restoreInvite(d.invite),greeted:restoreDayMarks(d.greeted),neighborTalks:restoreDayMarks(d.neighborTalks),pairTalks:restoreDayMarks(d.pairTalks),neighborGifts:restoreDayMarks(d.neighborGifts),wishes:restoreWishes(d.wishes),spent:count(d.spent),starNights:count(d.starNights),guide:restoreGuide(d.guide),birthday:count(d.birthday,56),pantry:restorePantry(d.pantry),tasted:restoreTasted(d.tasted),recipes:restoreRecipes(d.recipes),buffs:restoreBuffs(d.buffs),fairs:restoreFairs(d.fairs),festivals:restoreFestivals(d.festivals),meets:restoreMeets(d.meets),neighbors:restoreNeighbors(d.neighbors),spells:restoreSpells(d.spells),casts:restoreCasts(d.casts),miss:restoreMiss(d.miss),quests:restoreQuests(d.quests),fixtures:restoreFixtures(d.fixtures),deeds:count(d.deeds)};}
// Thaw rescues only positions that are no longer traversable; inventory and relationship data stay intact.
export function shoreAfterThaw(s){if(lakeFrozen(s))return s;const l=MAPS.garden.lake,at=p=>inPolygon(p.x,p.z,l.shore,.16)&&!walkable(p.x,p.z,'garden',s),p=s.map==='garden'&&at(s.position),c=s.companion.map==='garden'&&at(s.companion.position);if(!p&&!c)return s;return {...s,position:p?{...l.bottle.target}:s.position,companion:c?{...s.companion,position:{x:l.bottle.target.x+.85,z:l.bottle.target.z+.3}}:s.companion};}
// 同睡一张床的那一晚记进相处册（各睡各的不记：分房睡不是坏事，也不是一起做的事）
// 星铃花三天没浇会蔫（她 2026-09-18 的 6）：不枯死，浇一次救回来，只是那一天不长
const withWilt=s=>{const m=s.magic||freshMagic();return m.planted&&m.growth<2&&!m.wilted&&s.day+1-Math.max(1,m.wateredDay,m.plantedDay)>=3?{...s,magic:{...m,wilted:true}}:s;};
const withBedNight=s=>s.sleep&&s.sleep.player&&s.sleep.player===s.sleep.companion&&MAPS.home.beds[s.sleep.player]?noteBond(s,'bed','在'+MAPS.home.beds[s.sleep.player].label+'一起睡了一晚'):s;
export function nextDay(s){const day=s.day+1;return withDailyNote(expireQuests(shoreAfterThaw(missNewDay({...withWilt(withBedNight(dropInvite(s))),day,minute:420,picked:[],today:{},journal:[...(s.journal||[]),{day:s.day,weather:weather(s.day,s.epoch),actions:s.today||{},partner:s.companion.name}].slice(-120),blooms:weather(day,s.epoch)==='细雨'?Math.min(3,s.blooms+1):s.blooms}))));}
// 新的一天：世界自己长出来那一件，记进村里的账（他开口时手上就有今天这一件）
function withDailyNote(s){ return noteHappening(s, 'world', dailyNote(s)); }
export function advanceTime(s,minutes){let remaining=count(minutes,9600),out=s;while(remaining>0){const span=1380-out.minute;if(remaining<span)return {...out,minute:out.minute+remaining};remaining-=span;out=nextDay(out);}return out;}
export const timeLabel=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
// A companion carries its own morning dew: one visible helping action per game day.
export function companionCare(s){const c=s.companion,p=MAPS.garden.stations.garden;if(c.map!=='garden'||c.helpDay===s.day||s.blooms>=3||Math.hypot(c.position.x-p.x,c.position.z-p.z)>.5)return s;return {...s,blooms:s.blooms+1,companion:{...c,helpDay:s.day}};}
export function exitFor(map,kind,id){const key=kind==='door'?id:kind;if(!['door','travel','enter'].includes(kind)||!Object.hasOwn(MAPS[map]?.exits||{},key))return null;const e=MAPS[map].exits[key];if(kind==='door'&&e.action!=='door')return null;return {...e,target:e.target||MAPS[map].stations[key]};}
export function targetFor(state,kind,id){if(kind==='repair')return state.map==='watermill'?MAPS.watermill.stations.mill:null;if(['dreamSow','dreamHarvest'].includes(kind))return MAPS[state.map]?.stations.sow||null;const exit=exitFor(state.map,kind,id);if(exit)return exit.target;if(kind==='bed')return state.map==='home'?MAPS.home.beds[id]?.approach.player||null:null;if(kind==='rest'&&state.map==='home'&&state.sleep?.player)return MAPS.home.beds[state.sleep.player].approach.player;if(kind==='sit'){const seat=seatsOf(state.map)[id||'pond'];return seat?{x:(seat.approach||seat).x,z:(seat.approach||seat).z}:null;}if(kind==='visit')return MAPS[state.map]?.sites?.[id]?.target||null;if(kind==='gather'){const n=NODES.find(n=>n.id===id);return n?{x:n.x,z:n.z+.48}:null;}return MAPS[state.map]?.stations[kind]||null;}
export function actionError(s,kind,id){if(kind==='repair')return repairError(s,id);if(['dreamSow','dreamHarvest'].includes(kind))return dreamError(s,id,kind==='dreamHarvest');if(kind==='bed')return s.map==='home'&&Object.hasOwn(MAPS.home.beds,id)?'':'先回家选一张床。';if(kind==='sit'){const seat=seatsOf(s.map)[id||'pond'];return !seat?'这里没有座位。':shutError(s,seat.opensWith);}if(kind==='mill')return s.map==='watermill'?'':'先走进水磨工坊。';if(kind==='visit'){const site=MAPS[s.map]?.sites?.[id];return site?shutError(s,site.opensWith):'这里还没有开放这处地方。';}
 if(['seed','star','lamp'].includes(kind))return magicError(s,kind);
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);if(!n||s.map!==n.map||(n.depth!=null&&n.depth!==s.depth))return '这里没有这种材料。';
  if(s.picked.includes(id))return n.map==='depths'?'这一处的矿脉已经采空了。':'这一丛今天采过了，明天会重新长出来。';return '';}
 if(['travel','enter','door'].includes(kind))return exitFor(s.map,kind,id)?'':'这里没有通往别处的小路。';
 // 下潜三件事：从井口下去、再往下一层、顺着梯子上来
 // 走到公告栏：接委托／交委托都在弹层里做，perform 不动状态
 if(kind==='board')return s.map!=='garden'?'公告栏在公共厅门前。':'';
 // 走到水边捞漂流瓶：捞什么在弹层里说，perform 不动状态
 if(kind==='bottle')return driftError(s);
 // 走到锅前做东西：有碎片才让走这一趟（做什么由弹层选，不在 perform 里）
 if(kind==='craft')return s.map!=='garden'?'锅在庭院里。':(s.shards||[]).length?'':'背包里没有碎片。下井刨一片回来。';
 // 收花笺：地里有开好的才让走过去（真正那一枪在宿主那侧打）
 if(kind==='note')return s.map!=='garden'?'花圃在庭院里。':readySeeds(s).length?'':'地里还没有开好的花。';
 // 走到花圃去种一句：种什么在弹层里挑，perform 不动状态
 if(kind==='sow')return seedError(s);
 // 走到许愿树下念咒：挑什么在弹层里，perform 不动状态
 if(kind==='cast')return s.map!=='forest'?'那棵许愿树在林地。':(restoreSpells(s.spells).length?'':'你还不会念咒——跟他一起去唤醒一颗种子。');
 if(kind==='dive')return s.map!=='garden'?'先回庭院，井在屋边。':s.minute>1140?'天太晚了，井底看不见路，明天再来。':'';
 if(kind==='ladder')return s.map==='depths'?'':'你不在井里。';
 if(kind==='deeper'){if(s.map!=='depths')return '先下到井里。';
  if(s.depth>=deepestAllowed(s))return s.stones?'再往下是塌掉的岩层。带回一片井纹残片，路会再通两层。':'再往下就看不见路了。先在这几层找到一片井纹残片。';
  return '';}
 if(kind==='rest'){if(!MAPS[s.map]?.stations.rest)return '这里没有可以睡觉的地方。';
  // ⚠️说好一起睡，就等他也上床（她 2026-09-18：「我选一起睡就等他也上床了才过到下一天」）
  const with_=s.sleep?.companion&&s.sleep.companion===s.sleep.player;
  if(with_&&!sleepPose(s,'companion'))return s.companion.map==='home'?'他还没上床，等他一会儿。':'他还没回来，等他一起睡。';
  return '';}
 if(s.map!=='garden')return '先回庭院吧。';
 if(kind==='brew')return brewError(s,id);
 else if(kind==='garden'){if(s.blooms<3&&!s.potions&&!s.water)return '水壶空了，先去井边取水；也可以用月露唤醒整圃花。';}
 else if(!['well','rest'].includes(kind))return '这里还不能这样做。';return '';
}
export const gardenIntent=s=>s.blooms===3?'harvest':s.potions?'potion':'water';
function performAction(s,kind,id,intent=gardenIntent(s)){
 if(actionError(s,kind,id))return s;const p=targetFor(s,kind,id);if(!p||Math.hypot(s.position.x-p.x,s.position.z-p.z)>.65)return s;
 if(kind==='repair')return repairRelic(s,id);
 if(kind==='dreamSow')return sowDream(s,id);if(kind==='dreamHarvest')return harvestDream(s,id);
 if(['seed','star','lamp'].includes(kind))return performMagic(s,kind);
 if(kind==='bed')return arrangeSleep(s,id,intent);if(kind==='sit'){const key=id||'pond',seat=seatsOf(s.map)[key];return {...s,seat:key,position:seat?{x:seat.x,z:seat.z}:s.position};}if(kind==='visit')return {...s};
 if(kind==='well')return {...s,water:3};
 if(kind==='garden'){if(intent==='harvest'&&s.blooms===3)return {...s,blooms:0,harvest:s.harvest+3};if(s.blooms>=3)return s;if(intent==='potion'&&s.potions>0)return {...s,blooms:3,potions:s.potions-1};if(intent==='water'&&s.water>0)return {...s,water:s.water-1,blooms:s.blooms+1};return s;}
 // 有星砂先用星砂：那是她特地下井换来的，别让它压在背包里
 if(kind==='brew')return brewResult(s,id);
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);
  // 井底那两样：星砂常见、月石稀罕；越深一次刨出来的越多
  if(n.map==='depths'){
   // 「沉下去的东西」＝往下的钥匙；别的矿脉刨出来的是碎片（内容那一层）
   if(n.kind==='stone')return {...s,stones:s.stones+1,picked:[...s.picked,id]};
   return takeShard({...s,picked:[...s.picked,id]},s.depth,wellFind(s,n));}
  return {...s,[n.kind==='herb'?'herbs':'mushrooms']:s[n.kind==='herb'?'herbs':'mushrooms']+(n.kind==='herb'?2:1),picked:[...s.picked,id]};}
 // 出口把人放在下一张图上【说好的落点】：默认是那张图的 spawn，
 // 爬梯子上来则是井口（exits.ladder.at）——落点写在出口那一处，不在这儿分支。
 if(['travel','enter','door'].includes(kind)){const e=exitFor(s.map,kind,id);return {...s,seat:null,map:e.to,position:{...landingOf(e,kind)}};}
 // 下去一趟要花时间：第一层 45 分钟，再往下每层 35 分钟，爬上来 20 分钟。
 // ⚠️时间一律走 advanceTime——它自己会跨天，别在这儿另算一遍日期。
 if(kind==='dive')return advanceTime({...s,wellTrip:{day:s.day,kit:s.wellKit||'none'},map:'depths',depth:1,position:{...MAPS.depths.spawn}},Math.round(45*diveWeight(s)));
 if(kind==='deeper')return advanceTime({...s,depth:s.depth+1,position:{...MAPS.depths.spawn}},Math.round(35*diveWeight(s)));
 if(kind==='ladder'){const e=MAPS.depths.exits.ladder;return advanceTime({...s,wellTrip:null,map:e.to,depth:0,position:{...(e.at||MAPS[e.to].spawn)}},20);}
 if(kind==='rest')return nextDay(s);return s;
}

export function millAt(s){const p=MAPS.watermill.stations.mill;return s.map==='watermill'&&Math.hypot(s.position.x-p.x,s.position.z-p.z)<.75;}
export function millAction(s,key,collect=false){if(!millAt(s))return s;const out=collect?collectMill(s,key):startMill(s,key);return out===s?s:noteHappening(out,'world',(collect?'取走了':'在水磨工坊放入了')+MILL_RECIPES[key].name);}
export function companionMillHelp(s){const p=MAPS.watermill.stations.mill,c=s.companion;if(c.map!=='watermill'||Math.hypot(c.position.x-p.x,c.position.z-p.z)>1.25)return s;const key=Object.keys(MILL_RECIPES).find(k=>millRemaining(s,k)>0&&!s.workshop?.jobs?.[k]?.helper);if(!key)return s;const out=helpMill(s,key);return out===s?s:noteHappening(noteBond(out,'help',c.name+'替你照看了工坊里那一批'+MILL_RECIPES[key].name),'world',c.name+'帮忙照看了'+MILL_RECIPES[key].name+'，这一批提前半小时做好');}
export function islandLightError(s){if(s.map!=='garden'||s.seat!=='island'||Math.hypot(s.position.x-MAPS.garden.seats.island.x,s.position.z-MAPS.garden.seats.island.z)>.2||!opened(s,'reedBridge'))return '先在小岛水灯台坐下来。';return waterLightError(s);}
// 水灯上可以留一句（她 2026-09-18 的 5）：那句进漂流池，哪天从水里捞回来的就是它
export const WISH_CAP=40;
export function restoreWishes(raw){return (Array.isArray(raw)?raw:[]).filter(x=>x&&trimText(x.text,120)).slice(0,WISH_CAP).map(x=>({text:trimText(x.text,120),day:Math.max(1,count(x.day)),together:x.together===true}));}
export function floatIslandLight(s,wish){if(islandLightError(s))return s;const together=companionNearby(s),text=trimText(wish,120);let out=releaseWaterLight(s,together);if(text)out={...out,wishes:[{text,day:s.day,together},...restoreWishes(s.wishes)].slice(0,WISH_CAP)};return noteHappening(together?noteBond(out,'light','和'+s.companion.name+'在小岛一起放了一盏水灯'):out,'world',together?'和'+s.companion.name+'在小岛放下一盏水灯':'在小岛放下一盏水灯');}
// 他答应「我去某处等你」时能落实的地点。⚠️那张表是【唯一一份】，住在 rules.js 的
//   COMPANION_DESTINATIONS（手机白名单也要认它）：存档白名单（restoreCompanion）、
//   游戏那头的 applyAction、写给模型的那句清单，三处都来问它。
// ⚠️处到哪一档才去得了（表上每处的 tier），由相处册那一段的 bondTier 定：
//   四处地板一直开着，处熟了名单才长。这儿按存档筛，别处不许再抄一份档位。
export function companionDestinations(s){const tier=bondTier(s);return Object.fromEntries(Object.entries(COMPANION_DESTINATIONS).filter(([,d])=>(d.tier||0)<=tier));}
export const destinationOf=(s,id)=>companionDestinations(s)[id]||null;
// 写给模型的那一句「target 能填什么」。⚠️照上面那张表长，不另抄一份中文名。
export const destinationChoices=s=>Object.entries(companionDestinations(s)).map(([id,d])=>id+'（'+d.label.replace(/^去|^回/,'').replace(/等你$/,'')+'）').join('、');

export function freshMagic(){return {seeds:0,seedSeason:-1,planted:false,growth:0,wateredDay:0,plantedDay:0,flowers:0,discovered:false,lamps:0,wilted:false};}
export function restoreMagic(d){const m=d||{};return {seeds:count(m.seeds),seedSeason:Number.isInteger(m.seedSeason)&&m.seedSeason>=0?m.seedSeason:-1,planted:m.planted===true,growth:count(m.growth,2),wateredDay:count(m.wateredDay),flowers:count(m.flowers),plantedDay:count(m.plantedDay),discovered:m.discovered===true,lamps:count(m.lamps,4),wilted:m.wilted===true};}
const ACTION_NAMES={repair:'修复旧物',dreamSow:'种下梦种',dreamHarvest:'收回梦花',door:'走过门与楼梯',bed:'回卧室休息',enter:'回小屋歇脚',sit:'在池边坐下',visit:'散步到访',well:'取水',garden:'照料或采收月光花',brew:'炼月露',gather:'采集',seed:'一起唤醒种子',star:'照料或采收星铃花',lamp:'制作星铃灯',travel:'穿过小路',craft:'在锅前做东西',dive:'下到井里',deeper:'再往下一层',ladder:'从井里上来',note:'收花笺',sow:'种下一句',cast:'念一个咒',board:'看公告栏',bottle:'捞漂流瓶',
 // ⚠️这张表就是日记的【读的那一半】：restoreToday 照它筛，journalText 照它取名。
 //   perform 写进 today 的 kind 只要不在这儿，重开一次就没了，重开之前还会印成
 //   「undefined 次」——mill（水磨工坊碾料）就这么漏了一整季
 //   （施工规则/stub-from-the-writer.md：写的那一半和读的那一半是同一层的两瓣）。
 mill:'在水磨工坊碾料'};
function restoreToday(d){return Object.fromEntries(Object.keys(ACTION_NAMES).filter(k=>d&&count(d[k])>0).map(k=>[k,count(d[k],999)]));}
function restoreJournal(d){return (Array.isArray(d)?d:[]).slice(-120).filter(x=>Number.isInteger(x?.day)&&x.day>0).map(x=>({day:x.day,weather:['晴日','细雨','薄雾','细雪'].includes(x.weather)?x.weather:weather(x.day),partner:String(x.partner||'同行者').slice(0,16),actions:restoreToday(x.actions)}));}
export function journalText(entry){const facts=Object.entries(entry.actions||{}).map(([k,v])=>`${ACTION_NAMES[k]} ${v} 次`);return `${entry.weather}，与${entry.partner}同住。${facts.length?facts.join('，')+'。':'这天没有留下采集或制作记录。'}`;}
export function companionNearby(s){return s.companion.map===s.map&&Math.hypot(s.companion.position.x-s.position.x,s.companion.position.z-s.position.z)<1.55;}
export function magicError(s,kind){const m=s.magic||freshMagic();if(kind==='seed'){if(s.map!=='forest')return '去林地寻找沉睡的种子。';if(m.seedSeason===seasonOf(s.day).index)return '这一季的种子已经带回家了，下一季会有新的微光。';return '';}
 if(s.map!=='garden')return '先把森林的礼物带回庭院。';
 if(kind==='lamp')return m.lamps>=4?'屋前四个灯位都亮了。再想要灯，得等村里别处支起灯杆——小路那盏可以去公告栏接委托修。':m.flowers<1||s.harvest<3?'星铃灯需要星铃花 ×1、月光花 ×3。':'';
 if(!m.planted)return m.seeds?'':'先和同行者去林地唤醒一颗种子。';
 if(m.growth>=2)return '';
 if(m.wilted)return s.water>0?'':'它蔫了。先取一壶清水来，浇一次就救得回来。';
 if(m.wateredDay===s.day)return '今天照料过了，明天再来看看新芽。';return s.water>0?'':'先取一壶清水来照料它。';}
function performMagic(s,kind){const m=s.magic||freshMagic();if(kind==='seed'){if(!companionNearby(s))return s;
 // ⚠️醒来的不只是一颗种子，还有【一个咒】——这才是那场戏的分量所在
 const learn=spellOfSeason(seasonOf(s.day).index);
 const out={...s,magic:{...m,seeds:m.seeds+1,seedSeason:seasonOf(s.day).index},spells:restoreSpells([...(s.spells||[]),learn])};
 const bonded=noteBond(out,'seed','和'+s.companion.name+'一起唤醒了一颗种子');
 return (s.spells||[]).includes(learn)?bonded:noteHappening(bonded,'world','和'+s.companion.name+'一起唤醒了一颗种子，学会了'+SPELLS[learn].name);}
 if(kind==='lamp')return {...s,harvest:s.harvest-3,magic:{...m,flowers:m.flowers-1,lamps:m.lamps+1}};
 if(!m.planted)return {...s,magic:{...m,seeds:m.seeds-1,planted:true,growth:0,wateredDay:0,plantedDay:s.day,wilted:false}};
 if(m.growth>=2)return {...s,magic:{...m,planted:false,growth:0,flowers:m.flowers+1,discovered:true}};
 // 蔫了的那一浇只是救回来，不长：三天没管的代价就是这一天
 if(m.wilted)return {...s,water:s.water-1,magic:{...m,wilted:false,wateredDay:s.day}};
 return {...s,water:s.water-1,magic:{...m,growth:m.growth+1,wateredDay:s.day}};
}
// 地面上的事也花时间（她 2026-09-18 的 6）：原来只有下井和工坊走表，别的一天做一百件也不到中午。
// ⚠️表只有这一份：perform 里的走这儿，锅前／捐馆／念咒那几处不经 perform 的，游戏那头拿 spendTime 记同一张表
export const ACTION_MINUTES={well:5,garden:10,gather:10,brew:20,craft:20,sow:10,note:10,seed:10,star:10,lamp:10,cast:15,board:5,repair:20,dreamSow:10,dreamHarvest:10,bottle:10,museum:5,mill:5,eat:5,cook:15,festival:20};
// 喝过热茶的那一天每件事快三分钟（最少也要一分钟）
export const spendTime=(s,kind)=>ACTION_MINUTES[kind]?advanceTime(s,Math.max(1,ACTION_MINUTES[kind]-(hasBuff(s,'quick')?3:0))):s;
export function perform(s,kind,id,intent=gardenIntent(s)){const out0=performAction(s,kind,id,intent);if(out0===s)return out0;const out=['dive','deeper','ladder','rest'].includes(kind)?out0:spendTime(out0,kind);// 她做一件事的时候他就在旁边：这也是思念那一笔（攒的是真发生过的事，不是计时器）
 const near=companionNearby(s)?addMiss(out,'beside'):out;
 if(kind==='rest')return {...near,seat:null};return {...near,seat:kind==='sit'?near.seat:null,today:{...(near.today||{}),[kind]:((near.today||{})[kind]||0)+1}};}

// Find the first physical exit on a route; companions never jump across disconnected maps.
// 穿过一道口子落在哪儿：【这张图的口子 → 那张图的口子】，不是回家门口
// （她 2026-09-18：「为啥从林地回来是传送回家门口」「从林间回来角色还是传送回家」）。
// ⚠️她和他共用这一处；屋门那两种照旧落在 spawn——屋子的 spawn 本来就是门口。
export const landingOf=(exit,kind='travel')=>exit&&exit.at?exit.at
  :(kind==='travel'&&MAPS[exit.to].stations&&MAPS[exit.to].stations.travel)||MAPS[exit.to].spawn;
export function exitToward(from,to){const queue=[{map:from,first:null}],seen=new Set([from]);while(queue.length){const step=queue.shift();if(step.map===to)return step.first;for(const [id,exit]of Object.entries(MAPS[step.map]?.exits||{})){if(seen.has(exit.to)||!MAPS[exit.to])continue;seen.add(exit.to);queue.push({map:exit.to,first:step.first||{id,to:exit.to,at:exit.at,target:exit.target||MAPS[from].stations[id]}});}}return null;}

export function chooseWellKit(s,key){return s.map!=='depths'&&Object.hasOwn(WELL_KITS,key)?{...s,wellKit:key}:s;}

export function repairError(s,id){
 if(s.map!=='watermill')return '修复用的工作台在水磨坊里。';
 const sh=s.shards.find(x=>x.id===id);
 return !sh||sh.curio!=='relic'?'先挑一件井里带回的沉睡旧物。':sh.pinned?'这件旧物钉住了，先在收藏里解除钉住。':s.things.length>=THING_CAP?'屋里的东西放满了，先留一些到收藏馆再修。':'';
}
function repairRelic(s,id){const sh=s.shards.find(x=>x.id===id),thing={id:'rr_'+sh.id,name:'修好的留光匣',note:'松开的匣盖重新扣合，裂缝用金线接住；里面仍留着井底带回的那一片。',kind:sh.kind,way:'set',recipe:'repairedrelic',from:sh.text,day:s.day,openDay:0,spot:null};return noteHappening({...s,shards:s.shards.filter(x=>x.id!==id),things:[thing,...s.things]},'made','在水磨坊修好了一只留光匣');}

// 递月光花是礼物簿那一套的其中一样（旧名留着给老调用方）；主线好感、记忆照旧一个字不碰。
export const flowerGiftError=s=>giftError(s,{type:'flower'});
export const giveMoonFlower=(s,taste=null)=>giveGift(s,{type:'flower'},taste);
