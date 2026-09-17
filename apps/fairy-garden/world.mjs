import './rules.js?v=fg-6050ed6bbbb29cc0';
export const {START,TREES,NODES,MAPS,ACTIVITIES,SEASONS,DEPTH_MAX,DEPTH_BASE,depthNodes,seasonOf,weather,normalizePlan,hitInteraction}=globalThis.FairyGardenRules;
import {createNavigator} from './navigation.mjs?v=fg-6050ed6bbbb29cc0';
export function walkable(x,z,map='garden'){if(!MAPS[map]||!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>MAPS[map].radius)return false;const bounds=MAPS[map].bounds;if(bounds&&(Math.abs(x)>bounds.w/2||Math.abs(z)>bounds.d/2))return false;return !MAPS[map].obstacles.some(o=>{if(o.except&&Math.abs(x-o.except.x)<o.except.w/2&&Math.abs(z-o.except.z)<o.except.d/2)return false;return o.rx?((x-o.x)/(o.rx+.16))**2+((z-o.z)/(o.rz+.16))**2<1:o.r?Math.hypot(x-o.x,z-o.z)<o.r+.16:Math.abs(x-o.x)<o.w/2+.16&&Math.abs(z-o.z)<o.d/2+.16;});}
// Exact rectangle clipping prevents a short diagonal corner cut from passing sampled checks.
function clipsBox(a,b,o){let lo=0,hi=1;for(const [axis,half]of [['x',o.w/2+.16],['z',o.d/2+.16]]){const min=o[axis]-half+1e-8,max=o[axis]+half-1e-8,d=b[axis]-a[axis];if(Math.abs(d)<1e-12){if(a[axis]<=min||a[axis]>=max)return false;}else{const t1=(min-a[axis])/d,t2=(max-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>=hi)return false;}}return hi>0&&lo<1;}
export function segmentClear(a,b,map='garden',avoid=[]){if(MAPS[map].obstacles.some(o=>o.w&&o.d&&!o.except&&clipsBox(a,b,o)))return false;const minimum=avoid.map(o=>Math.min(o.r,Math.hypot(a.x-o.x,a.z-o.z)));const len=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(len/.07));for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(!walkable(x,z,map)||avoid.some((o,j)=>Math.hypot(x-o.x,z-o.z)<minimum[j]-1e-6))return false;}return true;}
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
    id: String(x.id).slice(0, 40), kind: shardKind(x.kind), text: trimText(x.text, 240),
    whole: x.whole === true, depth: Math.max(0, count(x.depth)), day: Math.max(1, count(x.day)), pinned: x.pinned === true
  }));
}
// 还没被刨出来的那几片（下潜时由宿主一次生成一批填进来，慢慢挖）
export function restoreVein(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.text && shardKind(x.kind)).slice(0, VEIN_POOL * 2)
    .map(x => ({ kind: shardKind(x.kind), text: trimText(x.text, 240), whole: x.whole === true }));
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
// 谁发的。邻居屋现在还空着，所以先用「屋主人」这种说法，等人住进来再接真名。
const QUEST_FROM = ['公共厅的告示', '左边邻居屋的主人', '林后那间的主人', '右边那间的主人', '一张没有落款的字条'];
const SEASON_QUESTS = [
  { find: 34, gather: 26, keep: 20, fix: 12, bloom: 8 },   // 春：找东西、出门、新认识的人
  { gather: 30, keep: 26, bloom: 24, find: 12, fix: 8 },   // 夏：临时邀约、热闹事
  { find: 32, bloom: 26, fix: 22, gather: 12, keep: 8 },   // 秋：寻物、收获、转交
  { keep: 34, fix: 26, gather: 20, find: 12, bloom: 8 }    // 冬：室内、照顾、陪伴
];
export const QUEST_SLOTS = 3, QUEST_TAKEN_MAX = 2;
const hash = str => { let h = 2166136261; for (const ch of String(str)) { h = Math.imul(h ^ ch.charCodeAt(0), 16777619); } h ^= h >>> 16; return h >>> 0; };
const pickWeighted = (table, seed) => { let draw = (hash(seed) % 1000) / 1000 * 100;
  for (const [key, weight] of Object.entries(table)) { draw -= weight; if (draw < 0) return key; } return Object.keys(table)[0]; };
const QUEST_NEED = { shard: 1, herbs: 2, harvest: 2, relic: 1, visit: 0 };
// 这一季的板子：由存档号＋季节算出来，谁看都是这三条，刷新页面也不会变
export function questBoard(s){
  const season = seasonOf(s.day), out = [];
  const table = SEASON_QUESTS[season.index % 4], order = Object.keys(table);
  for (let i = 0; i < QUEST_SLOTS; i++) {
    const seed = String(s.epoch) + ':quest:' + season.index + ':' + i;
    // ⚠️同一块板子上不许出现两件一样的：抽重了就顺着权重表往下挪一格。
    //   三条里两条「采一点」，看起来就像这个世界只会一件事。
    let kind = pickWeighted(table, seed), guard = 0;
    while (out.some(q => q.kind === kind) && guard++ < order.length) kind = order[(order.indexOf(kind) + 1) % order.length];
    out.push({ id: 'q_' + season.index + '_' + i, kind,
      from: QUEST_FROM[hash(seed + ':from') % QUEST_FROM.length],
      need: QUEST_NEED[QUEST_KINDS[kind].need], season: season.index });
  }
  return out;
}
export const questTaken = s => (s.quests || []).filter(q => !q.done);
export function restoreQuests(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && Object.hasOwn(QUEST_KINDS, x.kind)).slice(0, 40).map(x => ({
    id: String(x.id).slice(0, 40), kind: x.kind, from: trimText(x.from, 24),
    need: Math.max(0, count(x.need)), season: Math.max(0, count(x.season)),
    day: Math.max(1, count(x.day)), done: x.done === true
  }));
}
export function restoreFixtures(raw){
  const d = raw && typeof raw === 'object' ? raw : {};
  return { pathLamp: d.pathLamp === true };
}
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
  return out;
}
// 灯修好之后：天黑了它就亮着；雨天的晚上，发委托的人会站在灯下避雨
export const lampOn = s => !!(restoreFixtures(s.fixtures).pathLamp && s.minute >= 1020);
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
export const SPOTS = { eaves: '屋檐下', sill: '窗台', pond: '池边' };
export function restoreThings(raw){
  return (Array.isArray(raw) ? raw : []).filter(x => x && x.id && x.name).slice(0, THING_CAP).map(x => ({
    id: String(x.id).slice(0, 40), name: trimText(x.name, 24), note: trimText(x.note, 200),
    kind: shardKind(x.kind) || 'relic', way: Object.hasOwn(CRAFT_WAYS, x.way) ? x.way : 'set',
    recipe: typeof x.recipe === 'string' ? x.recipe.slice(0, 40) : '',
    from: trimText(x.from, 240), day: Math.max(1, count(x.day)),
    openDay: Math.max(0, count(x.openDay)), spot: Object.hasOwn(SPOTS, x.spot) ? x.spot : null
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
  return { ...s, shards: (s.shards || []).filter(x => !gone.has(x.id)),
    made: restoreMade([...(s.made || []), key]),
    things: [thing, ...(s.things || [])].slice(0, THING_CAP) };
}
// 发酵的那几样：到日子才算做好（在那之前摆不出去，也读不到）
export const thingReady = (s, t) => !t.openDay || s.day >= t.openDay;
export function placeThing(s, id, spot){
  const t = (s.things || []).find(x => x.id === id);
  if (!t || !thingReady(s, t) || (spot && !Object.hasOwn(SPOTS, spot))) return s;
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
  return { ...s, things: (s.things || []).filter(x => x.id !== id),
    collection: [row, ...(s.collection || [])].slice(0, COLLECTION_CAP),
    deeds: count(s.deeds) + (first ? 1 : 0) };
}
// 馆里已经有几种（不是几件）：炼金笔记那一页拿它对着 RECIPE_TOTAL 算进度
export const collectedKinds = s => new Set((s.collection || []).map(sameKindMark)).size;
// ── 星井（下潜）────────────────────────────────────────────────────────
// depth   现在在第几层（0＝在地面上）
// sand    星砂：三份能在炼药锅换一颗月露
// stones  月石：每得一颗，往下的路再通两层（这就是下潜的进度）
export const deepestAllowed=s=>Math.min(DEPTH_MAX,DEPTH_BASE+count(s&&s.stones)*2);
export function restoreSleep(raw,map,position){const valid=id=>typeof id==='string'&&Object.hasOwn(MAPS.home.beds,id)?id:null,player=valid(raw?.player),companion=valid(raw?.companion),p=player&&MAPS.home.beds[player].approach.player;return {player:map==='home'&&p&&position&&Math.hypot(position.x-p.x,position.z-p.z)<.3?player:null,companion};}
export function wakeSleeper(s,who='player'){return {...s,sleep:{...(s.sleep||{player:null,companion:null}),[who]:null}};}
export function sleepPose(s,who='player'){const id=s.sleep?.[who],b=Object.hasOwn(MAPS.home.beds,id||'')?MAPS.home.beds[id]:null,person=who==='player'?s:s.companion;if(!b||person.map!=='home'||Math.hypot(person.position.x-b.approach[who].x,person.position.z-b.approach[who].z)>.14)return null;return b.slots[who];}
export function arrangeSleep(s,id,mode){const b=Object.hasOwn(MAPS.home.beds,id||'')?MAPS.home.beds[id]:null;if(s.map!=='home'||!b||!['together','separate','companion'].includes(mode)||Math.hypot(s.position.x-b.approach.player.x,s.position.z-b.approach.player.z)>.65)return s;const other=Object.keys(MAPS.home.beds).find(k=>k!==id);return {...s,seat:null,sleep:{player:mode==='companion'?null:id,companion:mode==='separate'?other:id}};}
export function freshState(){return {version:9,epoch:'initial',seat:null,sleep:{player:null,companion:null},look:{},seeds:[],notes:[],shards:[],vein:[],things:[],made:[],collection:[],quests:[],fixtures:{pathLamp:false},deeds:0,magic:freshMagic(),today:{},journal:[],map:'garden',day:1,minute:480,water:0,blooms:0,herbs:0,mushrooms:0,potions:0,harvest:0,sand:0,stones:0,depth:0,picked:[],position:{...START},companion:freshCompanion()};}
export function restoreState(raw){const prior=raw&&[1,2,3,4,5,6,7,8,9].includes(raw.version)?raw:freshState(),d=prior.version<5?{...prior,position:prior.map==='forest'?prior.position:{...START},companion:prior.companion?.map==='forest'?prior.companion:{...prior.companion,position:freshCompanion().position}}:prior,map=Object.hasOwn(MAPS,d.map)?d.map:'garden';return {version:9,epoch:typeof d.epoch==='string'?d.epoch.slice(0,80):'initial',magic:restoreMagic(d.magic),today:restoreToday(d.today),journal:restoreJournal(d.journal),map,sleep:restoreSleep(d.sleep,map,d.position),seat:MAPS[map].seats?.[d.seat]&&d.position&&Math.hypot(d.position.x-MAPS[map].seats[d.seat].x,d.position.z-MAPS[map].seats[d.seat].z)<.2?d.seat:null,day:Math.max(1,count(d.day)),minute:d.version>=3?Math.max(420,count(d.minute,1379)):480,water:count(d.water,3),blooms:count(d.blooms,3),herbs:count(d.herbs),mushrooms:count(d.mushrooms),potions:count(d.potions),harvest:count(d.harvest),sand:count(d.sand),stones:count(d.stones),
 // 旧存档没有 depth；人从井里出来才算数，所以不在井底就一律 0
 depth:map==='depths'?Math.max(1,Math.min(DEPTH_MAX,count(d.depth))):0,picked:[...new Set(Array.isArray(d.picked)?d.picked.filter(id=>NODES.some(n=>n.id===id)):[])],position:d.position&&walkable(d.position.x,d.position.z,map)?{x:d.position.x,z:d.position.z}:{...MAPS[map].spawn},companion:restoreCompanion(d.companion),look:restoreLook(d.look),seeds:restoreSeeds(d.seeds),notes:restoreNotes(d.notes),shards:restoreShards(d.shards),vein:restoreVein(d.vein),things:restoreThings(d.things),made:restoreMade(d.made),collection:restoreCollection(d.collection),quests:restoreQuests(d.quests),fixtures:restoreFixtures(d.fixtures),deeds:count(d.deeds)};}
export function nextDay(s){const day=s.day+1;return {...s,day,minute:420,picked:[],today:{},journal:[...(s.journal||[]),{day:s.day,weather:weather(s.day,s.epoch),actions:s.today||{},partner:s.companion.name}].slice(-120),blooms:weather(day,s.epoch)==='细雨'?Math.min(3,s.blooms+1):s.blooms};}
export function advanceTime(s,minutes){let remaining=count(minutes,9600),out=s;while(remaining>0){const span=1380-out.minute;if(remaining<span)return {...out,minute:out.minute+remaining};remaining-=span;out=nextDay(out);}return out;}
export const timeLabel=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
// A companion carries its own morning dew: one visible helping action per game day.
export function companionCare(s){const c=s.companion,p=MAPS.garden.stations.garden;if(c.map!=='garden'||c.helpDay===s.day||s.blooms>=3||Math.hypot(c.position.x-p.x,c.position.z-p.z)>.5)return s;return {...s,blooms:s.blooms+1,companion:{...c,helpDay:s.day}};}
export function exitFor(map,kind,id){const key=kind==='door'?id:kind;if(!['door','travel','enter'].includes(kind)||!Object.hasOwn(MAPS[map]?.exits||{},key))return null;const e=MAPS[map].exits[key];if(kind==='door'&&e.action!=='door')return null;return {...e,target:e.target||MAPS[map].stations[key]};}
export function targetFor(state,kind,id){const exit=exitFor(state.map,kind,id);if(exit)return exit.target;if(kind==='bed')return state.map==='home'?MAPS.home.beds[id]?.approach.player||null:null;if(kind==='rest'&&state.map==='home'&&state.sleep?.player)return MAPS.home.beds[state.sleep.player].approach.player;if(kind==='sit'){const seat=MAPS[state.map]?.seats?.pond;return seat?{x:seat.x,z:seat.z}:null;}if(kind==='visit')return MAPS[state.map]?.sites?.[id]?.target||null;if(kind==='gather'){const n=NODES.find(n=>n.id===id);return n?{x:n.x,z:n.z+.48}:null;}return MAPS[state.map]?.stations[kind]||null;}
export function actionError(s,kind,id){if(kind==='bed')return s.map==='home'&&Object.hasOwn(MAPS.home.beds,id)?'':'先回家选一张床。';if(kind==='sit')return MAPS[s.map]?.seats?.pond?'':'这里没有池边座位。';if(kind==='visit')return MAPS[s.map]?.sites?.[id]?'':'这里还没有开放这处地方。';
 if(['seed','star','lamp'].includes(kind))return magicError(s,kind);
 if(kind==='gather'){const n=NODES.find(n=>n.id===id);if(!n||s.map!==n.map||(n.depth!=null&&n.depth!==s.depth))return '这里没有这种材料。';
  if(s.picked.includes(id))return n.map==='depths'?'这一处的矿脉已经采空了。':'这一丛今天采过了，明天会重新长出来。';return '';}
 if(['travel','enter','door'].includes(kind))return exitFor(s.map,kind,id)?'':'这里没有通往别处的小路。';
 // 下潜三件事：从井口下去、再往下一层、顺着梯子上来
 // 走到公告栏：接委托／交委托都在弹层里做，perform 不动状态
 if(kind==='board')return s.map!=='garden'?'公告栏在公共厅门前。':'';
 // 走到锅前做东西：有碎片才让走这一趟（做什么由弹层选，不在 perform 里）
 if(kind==='craft')return s.map!=='garden'?'锅在庭院里。':(s.shards||[]).length?'':'背包里没有碎片。下井刨一片回来。';
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
 if(kind==='bed')return arrangeSleep(s,id,intent);if(kind==='sit')return {...s,seat:'pond'};if(kind==='visit')return {...s};
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
 if(['travel','enter','door'].includes(kind)){const e=exitFor(s.map,kind,id);return {...s,seat:null,map:e.to,position:{...(e.at||MAPS[e.to].spawn)}};}
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
const ACTION_NAMES={door:'走过门与楼梯',bed:'回卧室休息',enter:'回小屋歇脚',sit:'在池边坐下',visit:'散步到访',well:'取水',garden:'照料或采收月光花',brew:'炼月露',gather:'采集',seed:'一起唤醒种子',star:'照料或采收星铃花',lamp:'制作星铃灯',travel:'穿过小路',craft:'在锅前做东西',dive:'下到井里',deeper:'再往下一层',ladder:'从井里上来',note:'收花笺',board:'看公告栏'};
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
export function exitToward(from,to){const queue=[{map:from,first:null}],seen=new Set([from]);while(queue.length){const step=queue.shift();if(step.map===to)return step.first;for(const [id,exit]of Object.entries(MAPS[step.map]?.exits||{})){if(seen.has(exit.to)||!MAPS[exit.to])continue;seen.add(exit.to);queue.push({map:exit.to,first:step.first||{id,to:exit.to,at:exit.at,target:exit.target||MAPS[from].stations[id]}});}}return null;}
