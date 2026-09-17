import {OUTFITS,restoreWardrobe} from './wardrobe.mjs?v=fg-147992fd87ef6145';
import {brewError,brewResult} from './brewing.mjs?v=fg-147992fd87ef6145';
import {restoreWorkshop,restoreWaterLights,waterLightError,releaseWaterLight,millError,startMill,collectMill,helpMill,MILL_RECIPES,millRemaining} from './workshop.mjs?v=fg-147992fd87ef6145';
import './rules.js?v=fg-147992fd87ef6145';
export const {WELL_CURIOS,WELL_TIDES,WELL_KITS,wellTide,wellContext,wellWeights,wellFind,VILLAGE_ZONES,villagePoint,migrateVillagePosition,START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,DEPTH_MAX,DEPTH_BASE,depthNodes,seasonOf,weather,normalizePlan,hitInteraction}=globalThis.FairyGardenRules;
import {createNavigator} from './navigation.mjs?v=fg-147992fd87ef6145';
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
 for(const k of ['hairColor','cloth'])if(typeof d[k]==='string'&&/^#[0-9a-fA-F]{6}$/.test(d[k]))out[k]=d[k];
 if(Object.hasOwn(OUTFITS,d.outfit))out.outfit=d.outfit;
 const wardrobe=restoreWardrobe(d.wardrobe);if(Object.keys(wardrobe).length)out.wardrobe=wardrobe;
 if(d.dims&&typeof d.dims==='object'){const dims={};
  for(const [k,v]of Object.entries(d.dims)){const n=Number(v);
   if(/^[a-z]{2,16}$/.test(k)&&Number.isFinite(n))dims[k]=Math.max(0,Math.min(2,n));}
  if(Object.keys(dims).length)out.dims=dims;}
 return out;
}
export function freshCompanion(){return {name:'同行者',mode:'routine',map:'garden',position:villagePoint({x:-3.5,z:4.3},'home'),helpDay:0,destination:'home',look:{}};}
export function restoreCompanion(raw,state=null){const d=raw||{},c=freshCompanion(),map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {...c,name:typeof d.name==='string'?d.name.trim().slice(0,16)||c.name:c.name,mode:['follow','wait','goto'].includes(d.mode)?d.mode:'routine',destination:['pond','garden','well','home'].includes(d.destination)?d.destination:'home',map,position:d.position&&walkable(d.position.x,d.position.z,map,state)?{x:d.position.x,z:d.position.z}:map==='garden'?c.position:{...MAPS[map].spawn},helpDay:count(d.helpDay),look:restoreLook(d.look)};}
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
  return noteHappening({ ...s, seeds: (s.seeds || []).map(x => kept.has(x.id) ? { ...x, done: true } : x),
    notes: [...notes, ...(s.notes || [])].slice(0, NOTE_CAP) },
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
export function expireQuests(s){
  return (s.quests || []).some(q => questExpired(s, q))
    ? { ...s, quests: (s.quests || []).filter(q => !questExpired(s, q)) } : s;
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
  return noteHappening(out, 'world', w.done);
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
// 看一眼。⚠️一枪都不打，而且【先说她自己的东西】：摆在上面的那一样、封在那儿的那一片，
//   都是她真放上去的。没有她的东西时才说这件家具本来的样子——一句都不编。
export function lookText(s, key){
  const at = spotParse(key); if (!at) return '';
  const thing = placedAt(s, key);
  const lines = [FURNITURE[at.kind].look];
  if (thing) lines.push('「' + thing.name + '」就摆在上面。');
  return lines.join('');
}
export function restoreThings(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.name).slice(0, THING_CAP).map(x => ({
    id: String(x.id).slice(0, 40), name: trimText(x.name, 24), note: trimText(x.note, 200),
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
  return noteHappening({ ...s, shards: (s.shards || []).filter(x => !gone.has(x.id)),
    made: restoreMade([...(s.made || []), key]),
    things: [thing, ...(s.things || [])].slice(0, THING_CAP) },
    'made', '在锅里' + CRAFT_WAYS[way].label + '出一样「' + thing.name + '」');
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
  return { ...s, things: (s.things || []).map(x => x.id === id ? { ...x, spot: spot || null }
    : (spot && x.spot === spot ? { ...x, spot: null } : x)) };   // 一个位置只摆一样
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
export const COLLECTION_CAP = 200;
export function restoreCollection(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.name).slice(0, COLLECTION_CAP).map(x => ({
    id: String(x.id).slice(0, 40), name: trimText(x.name, 24), note: trimText(x.note, 200),
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
  const row = { id: t.id, name: t.name, note: t.note, kind: t.kind, way: t.way,
    recipe: t.recipe || '', from: t.from, day: t.day, gaveDay: s.day };
  return noteHappening(addMiss({ ...s, things: (s.things || []).filter(x => x.id !== id),
    collection: [row, ...(s.collection || [])].slice(0, COLLECTION_CAP),
    deeds: count(s.deeds) + (first ? 1 : 0) }, 'kept'), 'kept', '把「' + t.name + '」留在了馆里');
}
// 馆里已经有几种（不是几件）：炼金笔记那一页拿它对着 RECIPE_TOTAL 算进度
export const collectedKinds = s => new Set((s.collection || []).map(sameKindMark)).size;
// ── 漂流瓶（她 2026-09-17 点的）─────────────────────────────────────────
// ⚠️这一条是【零调用】里最零的一条：它一个字都不生成，只把【已经在存档里的东西】
//   重新递回来一次——过去的花笺、刨到过的碎片、留在馆里的东西，还有她自己封进去的那句话。
// ⚠️它不是第二个背包：捞上来【不产生任何新库存】，原来那一片还在原来那儿，
//   这儿只留一条「第几天捞到过什么」的记录（先例：codex 的收藏馆也是只读陈列）。
// ⚠️自己封的那只要过几天才漂回来——【当天就能捞到自己刚写的】就不是漂流瓶，是记事本。
export const BOTTLE_DAYS = 7, BOTTLE_CAP = 60, DRIFT_CAP = 60;
export function restoreBottles(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.text).slice(0, BOTTLE_CAP).map(x => ({
    id: String(x.id).slice(0, 40), text: trimText(x.text, 120),
    day: Math.max(1, count(x.day)), openDay: Math.max(1, count(x.openDay)), taken: x.taken === true
  }));
}
export function restoreDrifts(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.text).slice(0, DRIFT_CAP).map(x => ({
    id: String(x.id || '').slice(0, 40), kind: ['mine', 'note', 'shard', 'kept'].includes(x.kind) ? x.kind : 'note',
    text: trimText(x.text, 240), day: Math.max(1, count(x.day)), from: Math.max(0, count(x.from))
  }));
}
export const sealedToday = s => (s.bottles || []).some(b => b.day === s.day);
export const sealError = (s, text) =>
  !trimText(text, 120) ? '空着的瓶子漂不动，写一句再封。'
  : sealedToday(s) ? '今天已经放了一只下去了，明天再来。'
  : (s.bottles || []).length >= BOTTLE_CAP ? '水里的瓶子够多了。' : '';
export function sealBottle(s, text){
  if (sealError(s, text)) return s;
  const bottle = { id: 'bo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    text: trimText(text, 120), day: s.day, openDay: s.day + BOTTLE_DAYS, taken: false };
  return { ...s, bottles: [bottle, ...(s.bottles || [])].slice(0, BOTTLE_CAP) };
}
// 今天水里能捞到什么：自己封的到日子了就先还她自己那一只，
// 否则从【已经有的东西】里按存档号＋天数定一片，同一天捞几次都是同一片。
export function driftPick(s){
  const mine = (s.bottles || []).filter(b => !b.taken && s.day >= b.openDay)
    .sort((a, b) => a.openDay - b.openDay)[0];
  if (mine) return { id: mine.id, kind: 'mine', text: mine.text, from: mine.day };
  const pool = [
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
  const today = { ...(s.today || {}), bottle: count((s.today || {}).bottle) + 1 };
  if (!row) return { ...s, today };          // 空瓶子也算捞过：不让她今天一直捞下去
  return addMiss({ ...s, today,
    bottles: row.kind === 'mine'
      ? (s.bottles || []).map(b => b.id === row.id ? { ...b, taken: true } : b) : (s.bottles || []),
    drifts: restoreDrifts([{ ...row, day: s.day }, ...(s.drifts || [])]) }, 'drift');
}
// 还在水里漂着、没到日子的那几只（界面照这个说「还有几天」）
export const floating = s => (s.bottles || []).filter(b => !b.taken && s.day < b.openDay)
  .map(b => ({ ...b, backIn: b.openDay - s.day }));
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
  return withMiss(s, { day: s.day, cameAt: 0, score: Math.max(0, restoreMiss(s.miss).score - MISS_READY) });
}
export function missLetGo(s){ return withMiss(s, { cameAt: 0, day: s.day }); }
// 他要说的那句话得【带着一件具体的东西】，否则每次都是「我想你了」——
// 那就又是那句「换个角色照样成立的就是写坏了」。这儿只负责把料凑齐，话由他自己说。
export function missMaterial(s){
  const notes = (s.notes || []).slice(0, 2).map(n => ({ kind: '花笺', text: n.reply, day: n.day }));
  const kept = (s.collection || []).slice(0, 2).map(x => ({ kind: '她留在收藏馆里的', text: x.name + '。' + x.note, day: x.gaveDay }));
  const shards = (s.shards || []).filter(x => x.pinned).slice(0, 2).map(x => ({ kind: '她钉住的碎片', text: x.text, day: x.day }));
  const drift = (s.drifts || []).slice(0, 1).map(x => ({ kind: '她今天从水里捞到的', text: x.text, day: x.day }));
  const placed = (s.things || []).filter(x => x.spot).slice(0, 2).map(x => ({ kind: '摆在' + SPOTS[x.spot] + '的', text: x.name + '。' + x.note, day: x.day }));
  const lately = recentHappenings(s, 5).map(x => ({ kind: HAPPEN_KINDS[x.kind], text: x.text, day: x.day }));
  return { day: s.day, quiet: Math.max(0, s.day - restoreMiss(s.miss).since),
    rows: [...lately, ...drift, ...kept, ...placed, ...shards, ...notes].filter(x => x.text) };
}
// ── 村里的事（她 2026-09-17：「做 AbC 吧」的 A）─────────────────────────
// ⚠️病根不是「事情少」，是【做了没有回响】：她捐了东西进馆、挖到一片他说过的话、
//   替谁做完一件委托——他一件都不知道。十件事里九件是她一个人在做。
// ⚠️所以这儿只做一件事：把【真发生过的事】记成一本村里的账。
//   它是那几条链子和他之间唯一的接口——他开口时手上的料从这儿取，
//   他排这一季的日程时也读它。记账本身一枪不打。
// ⚠️只记【真发生过的】：这本账不许写任何没发生的事，否则他就会提起一件不存在的事。
export const HAPPEN_CAP = 40;
export const HAPPEN_KINDS = { kept: '留在馆里', dug: '井里刨到', made: '锅里做出', quest: '替人做完', grew: '地里长出', world: '村里', met: '在村里碰见' };
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
export const diveWeight = s => ['细雨', '细雪'].includes(weather(s.day, s.epoch)) ? DIVE_WET : 1;
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
  return noteHappening({ ...s,
    shards: (s.shards || []).filter(x => x.id !== shardId),
    casts: restoreCasts([row, ...(s.casts || [])]) },
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
export function restoreNeighbors(raw){
  const seen = new Set(), houses = new Set();
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.charId && NEIGHBOR_HOUSES.includes(x.home))
    .filter(x => { const id = String(x.charId); if (seen.has(id) || houses.has(x.home)) return false;
      seen.add(id); houses.add(x.home); return true; })
    .slice(0, NEIGHBOR_MAX)
    .map(x => ({ ...restoreCompanion(x), charId: String(x.charId).slice(0, 40), home: x.home }));
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
export function moveIn(s, { charId, name, look }){
  if (moveInError(s, charId)) return s;
  const home = freeHouse(s);
  const door = MAPS.garden.sites[home].target;
  const row = { ...freshCompanion(), charId: String(charId), home, name: trimText(name, 16) || '邻居',
    look: restoreLook(look), map: 'garden', position: { ...door }, destination: 'home' };
  return noteHappening({ ...s, neighbors: restoreNeighbors([...(s.neighbors || []), row]) },
    'world', row.name + '搬进了' + MAPS.garden.sites[home].label);
}
export function moveOut(s, charId){
  const row = neighborOf(s, charId);
  if (!row) return s;
  return noteHappening({ ...s, neighbors: restoreNeighbors(s.neighbors).filter(n => String(n.charId) !== String(charId)) },
    'world', row.name + '从' + MAPS.garden.sites[row.home].label + '搬走了');
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
export function restoreSleep(raw,map,position){const valid=id=>typeof id==='string'&&Object.hasOwn(MAPS.home.beds,id)?id:null,player=valid(raw?.player),companion=valid(raw?.companion),p=player&&MAPS.home.beds[player].approach.player;return {player:map==='home'&&p&&position&&Math.hypot(position.x-p.x,position.z-p.z)<.3?player:null,companion};}
export function wakeSleeper(s,who='player'){return {...s,sleep:{...(s.sleep||{player:null,companion:null}),[who]:null}};}
export function sleepPose(s,who='player'){const id=s.sleep?.[who],b=Object.hasOwn(MAPS.home.beds,id||'')?MAPS.home.beds[id]:null,person=who==='player'?s:s.companion;if(!b||person.map!=='home'||Math.hypot(person.position.x-b.approach[who].x,person.position.z-b.approach[who].z)>.14)return null;return b.slots[who];}
export function arrangeSleep(s,id,mode){const b=Object.hasOwn(MAPS.home.beds,id||'')?MAPS.home.beds[id]:null;if(s.map!=='home'||!b||!['together','separate','companion'].includes(mode)||Math.hypot(s.position.x-b.approach.player.x,s.position.z-b.approach.player.z)>.65)return s;const other=Object.keys(MAPS.home.beds).find(k=>k!==id);return {...s,seat:null,sleep:{player:mode==='companion'?null:id,companion:mode==='separate'?other:id}};}
export function freshState(){return {version:9,layout:2,interiorLayout:2,epoch:'initial',wellKit:'none',wellTrip:null,workshop:restoreWorkshop(null),waterLights:[],seat:null,sleep:{player:null,companion:null},look:{},seeds:[],notes:[],shards:[],vein:[],things:[],made:[],collection:[],bottles:[],drifts:[],partnerId:'',happenings:[],meets:[],spells:[],casts:[],neighbors:[],miss:{score:0,day:0,since:1,cameAt:0},quests:[],fixtures:restoreFixtures(null),deeds:0,magic:freshMagic(),today:{},journal:[],map:'garden',day:1,minute:480,water:0,blooms:0,herbs:0,mushrooms:0,potions:0,harvest:0,sand:0,stones:0,depth:0,picked:[],position:{...START},companion:freshCompanion()};}
export function restoreState(raw){if(raw&&raw.interiorLayout!==2){raw={...raw,interiorLayout:2,companion:raw.companion?{...raw.companion}:raw.companion};for(const who of ['player','companion']){const person=who==='player'?raw:raw.companion;if(!person||!MAPS[person.map]?.interior)continue;const bed=person.map==='home'&&Object.hasOwn(MAPS.home.beds,raw.sleep?.[who])&&MAPS.home.beds[raw.sleep[who]];person.position={...(bed?bed.approach[who]:MAPS[person.map].spawn)};}}if(raw&&raw.layout!==2){raw={...raw,layout:2,position:raw.map==='garden'?migrateVillagePosition(raw.position):raw.position,companion:raw.companion?{...raw.companion,position:raw.companion.map==='garden'?migrateVillagePosition(raw.companion.position):raw.companion.position}:raw.companion};}const prior=raw&&[1,2,3,4,5,6,7,8,9].includes(raw.version)?raw:freshState(),d=prior.version<5?{...prior,position:prior.map==='forest'?prior.position:{...START},companion:prior.companion?.map==='forest'?prior.companion:{...prior.companion,position:freshCompanion().position}}:prior,map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {version:9,layout:2,interiorLayout:2,epoch:typeof d.epoch==='string'?d.epoch.slice(0,80):'initial',wellKit:Object.hasOwn(WELL_KITS,d.wellKit)?d.wellKit:'none',wellTrip:map==='depths'?{day:Math.max(1,Math.min(count(d.day)||1,count(d.wellTrip?.day)||count(d.day)||1)),kit:Object.hasOwn(WELL_KITS,d.wellTrip?.kit)?d.wellTrip.kit:(Object.hasOwn(WELL_KITS,d.wellKit)?d.wellKit:'none')}:null,workshop:restoreWorkshop(d.workshop),waterLights:restoreWaterLights(d.waterLights),magic:restoreMagic(d.magic),today:restoreToday(d.today),journal:restoreJournal(d.journal),map,sleep:restoreSleep(d.sleep,map,d.position),seat:MAPS[map].seats?.[d.seat]&&d.position&&Math.hypot(d.position.x-MAPS[map].seats[d.seat].x,d.position.z-MAPS[map].seats[d.seat].z)<.2?d.seat:null,day:Math.max(1,count(d.day)),minute:d.version>=3?Math.max(420,count(d.minute,1379)):480,water:count(d.water,3),blooms:count(d.blooms,3),herbs:count(d.herbs),mushrooms:count(d.mushrooms),potions:count(d.potions),harvest:count(d.harvest),sand:count(d.sand),stones:count(d.stones),
 // 旧存档没有 depth；人从井里出来才算数，所以不在井底就一律 0
 depth:map==='depths'?Math.max(1,Math.min(DEPTH_MAX,count(d.depth))):0,picked:[...new Set(Array.isArray(d.picked)?d.picked.filter(id=>NODES.some(n=>n.id===id)):[])],position:d.position&&walkable(d.position.x,d.position.z,map,d)?{x:d.position.x,z:d.position.z}:{...MAPS[map].spawn},companion:restoreCompanion(d.companion,d),look:restoreLook(d.look),seeds:restoreSeeds(d.seeds),notes:restoreNotes(d.notes),shards:restoreShards(d.shards),vein:restoreVein(d.vein),things:restoreThings(d.things),made:restoreMade(d.made),collection:restoreCollection(d.collection),bottles:restoreBottles(d.bottles),drifts:restoreDrifts(d.drifts),partnerId:typeof d.partnerId==='string'?d.partnerId.slice(0,64):'',happenings:restoreHappenings(d.happenings),meets:restoreMeets(d.meets),neighbors:restoreNeighbors(d.neighbors),spells:restoreSpells(d.spells),casts:restoreCasts(d.casts),miss:restoreMiss(d.miss),quests:restoreQuests(d.quests),fixtures:restoreFixtures(d.fixtures),deeds:count(d.deeds)};}
// Thaw rescues only positions that are no longer traversable; inventory and relationship data stay intact.
export function shoreAfterThaw(s){if(lakeFrozen(s))return s;const l=MAPS.garden.lake,at=p=>inPolygon(p.x,p.z,l.shore,.16)&&!walkable(p.x,p.z,'garden',s),p=s.map==='garden'&&at(s.position),c=s.companion.map==='garden'&&at(s.companion.position);if(!p&&!c)return s;return {...s,position:p?{...l.bottle.target}:s.position,companion:c?{...s.companion,position:{x:l.bottle.target.x+.85,z:l.bottle.target.z+.3}}:s.companion};}
export function nextDay(s){const day=s.day+1;return withDailyNote(expireQuests(shoreAfterThaw(missNewDay({...s,day,minute:420,picked:[],today:{},journal:[...(s.journal||[]),{day:s.day,weather:weather(s.day,s.epoch),actions:s.today||{},partner:s.companion.name}].slice(-120),blooms:weather(day,s.epoch)==='细雨'?Math.min(3,s.blooms+1):s.blooms}))));}
// 新的一天：世界自己长出来那一件，记进村里的账（他开口时手上就有今天这一件）
function withDailyNote(s){ return noteHappening(s, 'world', dailyNote(s)); }
export function advanceTime(s,minutes){let remaining=count(minutes,9600),out=s;while(remaining>0){const span=1380-out.minute;if(remaining<span)return {...out,minute:out.minute+remaining};remaining-=span;out=nextDay(out);}return out;}
export const timeLabel=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
// A companion carries its own morning dew: one visible helping action per game day.
export function companionCare(s){const c=s.companion,p=MAPS.garden.stations.garden;if(c.map!=='garden'||c.helpDay===s.day||s.blooms>=3||Math.hypot(c.position.x-p.x,c.position.z-p.z)>.5)return s;return {...s,blooms:s.blooms+1,companion:{...c,helpDay:s.day}};}
export function exitFor(map,kind,id){const key=kind==='door'?id:kind;if(!['door','travel','enter'].includes(kind)||!Object.hasOwn(MAPS[map]?.exits||{},key))return null;const e=MAPS[map].exits[key];if(kind==='door'&&e.action!=='door')return null;return {...e,target:e.target||MAPS[map].stations[key]};}
export function targetFor(state,kind,id){if(kind==='repair')return state.map==='watermill'?MAPS.watermill.stations.mill:null;if(['dreamSow','dreamHarvest'].includes(kind))return MAPS[state.map]?.stations.sow||null;const exit=exitFor(state.map,kind,id);if(exit)return exit.target;if(kind==='bed')return state.map==='home'?MAPS.home.beds[id]?.approach.player||null:null;if(kind==='rest'&&state.map==='home'&&state.sleep?.player)return MAPS.home.beds[state.sleep.player].approach.player;if(kind==='sit'){const seat=MAPS[state.map]?.seats?.[id||'pond'];return seat?{x:seat.x,z:seat.z}:null;}if(kind==='visit')return MAPS[state.map]?.sites?.[id]?.target||null;if(kind==='gather'){const n=NODES.find(n=>n.id===id);return n?{x:n.x,z:n.z+.48}:null;}return MAPS[state.map]?.stations[kind]||null;}
export function actionError(s,kind,id){if(kind==='repair')return repairError(s,id);if(['dreamSow','dreamHarvest'].includes(kind))return dreamError(s,id,kind==='dreamHarvest');if(kind==='bed')return s.map==='home'&&Object.hasOwn(MAPS.home.beds,id)?'':'先回家选一张床。';if(kind==='sit'){const seat=MAPS[s.map]?.seats?.[id||'pond'];return !seat?'这里没有座位。':seat.opensWith&&!opened(s,seat.opensWith)?'先在许愿树下用留感咒编起芦苇桥。':'';}if(kind==='mill')return s.map==='watermill'?'':'先走进水磨工坊。';if(kind==='visit')return MAPS[s.map]?.sites?.[id]?'':'这里还没有开放这处地方。';
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
 if(kind==='rest')return MAPS[s.map]?.stations.rest?'':'这里没有可以睡觉的地方。';
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
 if(kind==='bed')return arrangeSleep(s,id,intent);if(kind==='sit')return {...s,seat:id||'pond'};if(kind==='visit')return {...s};
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
 if(['travel','enter','door'].includes(kind)){const e=exitFor(s.map,kind,id);return {...s,seat:null,map:e.to,position:{...(e.at||MAPS[e.to].spawn)}};}
 // 下去一趟要花时间：第一层 45 分钟，再往下每层 35 分钟，爬上来 20 分钟。
 // ⚠️时间一律走 advanceTime——它自己会跨天，别在这儿另算一遍日期。
 if(kind==='dive')return advanceTime({...s,wellTrip:{day:s.day,kit:s.wellKit||'none'},map:'depths',depth:1,position:{...MAPS.depths.spawn}},Math.round(45*diveWeight(s)));
 if(kind==='deeper')return advanceTime({...s,depth:s.depth+1,position:{...MAPS.depths.spawn}},Math.round(35*diveWeight(s)));
 if(kind==='ladder'){const e=MAPS.depths.exits.ladder;return advanceTime({...s,wellTrip:null,map:e.to,depth:0,position:{...(e.at||MAPS[e.to].spawn)}},20);}
 if(kind==='rest')return nextDay(s);return s;
}

export function millAt(s){const p=MAPS.watermill.stations.mill;return s.map==='watermill'&&Math.hypot(s.position.x-p.x,s.position.z-p.z)<.75;}
export function millAction(s,key,collect=false){if(!millAt(s))return s;const out=collect?collectMill(s,key):startMill(s,key);return out===s?s:noteHappening(out,'world',(collect?'取走了':'在水磨工坊放入了')+MILL_RECIPES[key].name);}
export function companionMillHelp(s){const p=MAPS.watermill.stations.mill,c=s.companion;if(c.map!=='watermill'||Math.hypot(c.position.x-p.x,c.position.z-p.z)>1.25)return s;const key=Object.keys(MILL_RECIPES).find(k=>millRemaining(s,k)>0&&!s.workshop?.jobs?.[k]?.helper);if(!key)return s;const out=helpMill(s,key);return out===s?s:noteHappening(out,'world',c.name+'帮忙照看了'+MILL_RECIPES[key].name+'，这一批提前半小时做好');}
export function islandLightError(s){if(s.map!=='garden'||s.seat!=='island'||Math.hypot(s.position.x-MAPS.garden.seats.island.x,s.position.z-MAPS.garden.seats.island.z)>.2||!opened(s,'reedBridge'))return '先在小岛水灯台坐下来。';return waterLightError(s);}
export function floatIslandLight(s){if(islandLightError(s))return s;const out=releaseWaterLight(s,companionNearby(s));return noteHappening(out,'world',companionNearby(s)?'和'+s.companion.name+'在小岛放下一盏水灯':'在小岛放下一盏水灯');}
export const COMPANION_DESTINATIONS={pond:{map:'forest',target:{x:-.7,z:.6},label:'去池边坐一会儿'},garden:{map:'garden',target:MAPS.garden.stations.garden,label:'去看看月光花'},well:{map:'garden',target:MAPS.garden.stations.well,label:'去井边'},home:{map:'garden',target:MAPS.garden.stations.rest,label:'回屋前等你'}};

export function freshMagic(){return {seeds:0,seedSeason:-1,planted:false,growth:0,wateredDay:0,flowers:0,discovered:false,lamps:0};}
export function restoreMagic(d){const m=d||{};return {seeds:count(m.seeds),seedSeason:Number.isInteger(m.seedSeason)&&m.seedSeason>=0?m.seedSeason:-1,planted:m.planted===true,growth:count(m.growth,2),wateredDay:count(m.wateredDay),flowers:count(m.flowers),discovered:m.discovered===true,lamps:count(m.lamps,4)};}
const ACTION_NAMES={repair:'修复旧物',dreamSow:'种下梦种',dreamHarvest:'收回梦花',door:'走过门与楼梯',bed:'回卧室休息',enter:'回小屋歇脚',sit:'在池边坐下',visit:'散步到访',well:'取水',garden:'照料或采收月光花',brew:'炼月露',gather:'采集',seed:'一起唤醒种子',star:'照料或采收星铃花',lamp:'制作星铃灯',travel:'穿过小路',craft:'在锅前做东西',dive:'下到井里',deeper:'再往下一层',ladder:'从井里上来',note:'收花笺',sow:'种下一句',cast:'念一个咒',board:'看公告栏',bottle:'捞漂流瓶'};
function restoreToday(d){return Object.fromEntries(Object.keys(ACTION_NAMES).filter(k=>d&&count(d[k])>0).map(k=>[k,count(d[k],999)]));}
function restoreJournal(d){return (Array.isArray(d)?d:[]).slice(-120).filter(x=>Number.isInteger(x?.day)&&x.day>0).map(x=>({day:x.day,weather:['晴日','细雨','薄雾','细雪'].includes(x.weather)?x.weather:weather(x.day),partner:String(x.partner||'同行者').slice(0,16),actions:restoreToday(x.actions)}));}
export function journalText(entry){const facts=Object.entries(entry.actions||{}).map(([k,v])=>`${ACTION_NAMES[k]} ${v} 次`);return `${entry.weather}，与${entry.partner}同住。${facts.length?facts.join('，')+'。':'这天没有留下采集或制作记录。'}`;}
export function companionNearby(s){return s.companion.map===s.map&&Math.hypot(s.companion.position.x-s.position.x,s.companion.position.z-s.position.z)<1.55;}
export function magicError(s,kind){const m=s.magic||freshMagic();if(kind==='seed'){if(s.map!=='forest')return '去林地寻找沉睡的种子。';if(m.seedSeason===seasonOf(s.day).index)return '这一季的种子已经带回家了，下一季会有新的微光。';return '';}
 if(s.map!=='garden')return '先把森林的礼物带回庭院。';
 if(kind==='lamp')return m.lamps>=4?'屋前四个灯位都亮了。再想要灯，得等村里别处支起灯杆——小路那盏可以去公告栏接委托修。':m.flowers<1||s.harvest<3?'星铃灯需要星铃花 ×1、月光花 ×3。':'';
 if(!m.planted)return m.seeds?'':'先和同行者去林地唤醒一颗种子。';
 if(m.growth>=2)return '';
 if(m.wateredDay===s.day)return '今天照料过了，明天再来看看新芽。';return s.water>0?'':'先取一壶清水来照料它。';}
function performMagic(s,kind){const m=s.magic||freshMagic();if(kind==='seed'){if(!companionNearby(s))return s;
 // ⚠️醒来的不只是一颗种子，还有【一个咒】——这才是那场戏的分量所在
 const learn=spellOfSeason(seasonOf(s.day).index);
 const out={...s,magic:{...m,seeds:m.seeds+1,seedSeason:seasonOf(s.day).index},spells:restoreSpells([...(s.spells||[]),learn])};
 return (s.spells||[]).includes(learn)?out:noteHappening(out,'world','和'+s.companion.name+'一起唤醒了一颗种子，学会了'+SPELLS[learn].name);}
 if(kind==='lamp')return {...s,harvest:s.harvest-3,magic:{...m,flowers:m.flowers-1,lamps:m.lamps+1}};
 if(!m.planted)return {...s,magic:{...m,seeds:m.seeds-1,planted:true,growth:0,wateredDay:0}};
 if(m.growth>=2)return {...s,magic:{...m,planted:false,growth:0,flowers:m.flowers+1,discovered:true}};
 return {...s,water:s.water-1,magic:{...m,growth:m.growth+1,wateredDay:s.day}};
}
export function perform(s,kind,id,intent=gardenIntent(s)){const out=performAction(s,kind,id,intent);if(out===s)return out;// 她做一件事的时候他就在旁边：这也是思念那一笔（攒的是真发生过的事，不是计时器）
 const near=companionNearby(s)?addMiss(out,'beside'):out;
 if(kind==='rest')return {...near,seat:null};return {...near,seat:kind==='sit'?near.seat:null,today:{...(near.today||{}),[kind]:((near.today||{})[kind]||0)+1}};}

// Find the first physical exit on a route; companions never jump across disconnected maps.
export function exitToward(from,to){const queue=[{map:from,first:null}],seen=new Set([from]);while(queue.length){const step=queue.shift();if(step.map===to)return step.first;for(const [id,exit]of Object.entries(MAPS[step.map]?.exits||{})){if(seen.has(exit.to)||!MAPS[exit.to])continue;seen.add(exit.to);queue.push({map:exit.to,first:step.first||{id,to:exit.to,at:exit.at,target:exit.target||MAPS[from].stations[id]}});}}return null;}

export function chooseWellKit(s,key){return s.map!=='depths'&&Object.hasOwn(WELL_KITS,key)?{...s,wellKit:key}:s;}

export function repairError(s,id){
 if(s.map!=='watermill')return '修复用的工作台在水磨坊里。';
 const sh=s.shards.find(x=>x.id===id);
 return !sh||sh.curio!=='relic'?'先挑一件井里带回的沉睡旧物。':sh.pinned?'这件旧物钉住了，先在收藏里解除钉住。':s.things.length>=THING_CAP?'屋里的东西放满了，先留一些到收藏馆再修。':'';
}
function repairRelic(s,id){const sh=s.shards.find(x=>x.id===id),thing={id:'rr_'+sh.id,name:'修好的留光匣',note:'松开的匣盖重新扣合，裂缝用金线接住；里面仍留着井底带回的那一片。',kind:sh.kind,way:'set',recipe:'repairedrelic',from:sh.text,day:s.day,openDay:0,spot:null};return noteHappening({...s,shards:s.shards.filter(x=>x.id!==id),things:[thing,...s.things]},'made','在水磨坊修好了一只留光匣');}
