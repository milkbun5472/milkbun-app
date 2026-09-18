import test from 'node:test';import assert from 'node:assert/strict';
import {withOpenPaths} from '../../test/_fairy-open.mjs';
import {MAPS,ACTIVITIES,FURNITURE,areaSpots,areaReach,walkable,findPath,
 freshState,moveIn,neighborOf,marketDay,lakeFrozen,WORKS,SPELL_PLACES} from './world.mjs';
import {dailySchedule,plannedActivity,makeCompanionController} from './companion.mjs';
// 她 2026-09-18：「还有什么没接上动作交互或者玩法没进日历或者现在还是个装饰地点」

const near=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// 这一处除了「走过去」还有没有别的动作
function actsAt(map,site){
 const m=MAPS[map],t=site.target,out=new Set();
 for(const o of m.interactions||[]){
  const d=o.r?near(o,t):Math.max(Math.abs(o.x-t.x)-(o.w||0)/2,Math.abs(o.z-t.z)-(o.d||0)/2);
  if(d<=(o.r||0)+1.2)out.add(o.kind);
 }
 for(const st of Object.values(m.stations||{}))if(near(st,t)<1.5)out.add('station');
 for(const se of Object.values(m.seats||{}))if(near(se,t)<2)out.add('seat');
 if((m.furniture||[]).some(f=>FURNITURE[f.kind]&&near(f,t)<=areaReach(map)))out.add('furniture');
 out.delete('visit');
 return out;
}
// 他哪一格会走到这一处
function visitedBy(map,sid){
 const site=MAPS[map].sites[sid];
 return Object.entries(ACTIVITIES).filter(([,a])=>a.map===map
  && near(site.target,a.target)<=(a.reach||areaReach(map))).map(([id])=>id);
}

// ⚠️一处地方「只有走过去、而且他也不来」＝画在那儿好看，玩不到也活不起来
test('村里没有一处是纯装饰',()=>{
 const works=new Set(Object.values(WORKS).map(w=>w.site).filter(Boolean));
 const bare=[];
 for(const [map,m] of Object.entries(MAPS))
  for(const [sid,site] of Object.entries(m.sites||{})){
   if(actsAt(map,site).size||visitedBy(map,sid).length)continue;
   if(works.has(sid)||Object.hasOwn(SPELL_PLACES,sid))continue;
   bare.push(map+':'+sid+'（'+site.label+'）');
  }
 assert.deepEqual(bare,[],'这几处只有走过去，他也不来：'+bare.join('、'));
});

// ⚠️有几处地方本来就是【摊开的】：站在其中一件跟前，另外几件全在范围外，
//   于是他一季只看那一柜／只逛那一摊／只上那一间。
test('摊开的那几处，一格里够得着全部',()=>{
 for(const [id,want] of [['museum',3],['market',6],['upstairs',4]]){
  const a=ACTIVITIES[id];
  const got=areaSpots(a.map,a.target,a.reach).length;
  assert.ok(got>=want,id+' 只够得着 '+got+' 处，要 '+want);
  assert.ok(walkable(a.target.x,a.target.z,a.map,freshState()),id+' 的落点站不住');
 }
 // ⚠️放宽只给这几格，不许把所有地方一起调大——一起调大就会「从湖北岸溜达进集市」
 assert.ok(!ACTIVITIES.lakeNorth.reach);
 for(const q of areaSpots('garden',ACTIVITIES.lakeNorth.target))
  assert.ok(!/集市|摊|茶|花车/.test(q.label),'湖北岸又够到集市了：'+q.label);
});

test('吃饭和冰面进了他的日程',()=>{
 assert.ok(ACTIVITIES.meal&&ACTIVITIES.meal.map==='home');
 assert.ok(ACTIVITIES.ice);
 const s=withOpenPaths();
 const seen=season=>{const q=new Set();
  for(let d=season;d<season+14;d++)for(const it of dailySchedule({...s,day:d}))q.add(it.id);return q;};
 assert.ok(seen(1).has('meal'),'一整季都没在餐桌边坐过');
 // ⚠️冰面只有冬天成立
 assert.ok(!seen(1).has('ice'),'春天他上冰面');
 assert.ok(lakeFrozen({day:43}));
 assert.ok(seen(43).has('ice'),'冬天他也不上冰面');
 // 集市那一格过同一道闸
 assert.ok(!dailySchedule({...s,day:1}).some(x=>x.id==='market'),'非集市日他去逛集市');
});

// ⚠️三间邻居屋 codex 盖了十几处，住在里面的人原来一次都没进去过
test('邻居会回自己屋里，而且真的走得进去',()=>{
 let s=moveIn(freshState(),{charId:'c1',name:'阿甲',look:{},door:{}});
 const n=neighborOf(s,'c1');
 const ids=new Set();
 for(let d=1;d<=14;d++)for(const it of dailySchedule({...s,day:d,companion:n}))ids.add(it.id);
 assert.ok(ids.has('indoors'),'邻居一整季都不进自己屋：'+[...ids].join(' '));
 // 落点真的换成了 TA 自己那间屋
 const plan=plannedActivity({...s,day:1,minute:1080,companion:n});
 assert.equal(plan.map,'neighbor1');
 assert.match(plan.label,/星图阁楼/);
 // 走得进去，不卡在门口
 let st={...s,day:1,minute:1080,companion:n};
 const ctl=makeCompanionController();let arrived=false;
 for(let i=0;i<20000&&!arrived;i++){st=ctl.tick(st,.05,{autonomous:true}).state;
  arrived=st.companion.map==='neighbor1'
   &&Math.hypot(st.companion.position.x-plan.target.x,st.companion.position.z-plan.target.z)<1.2;}
 assert.ok(arrived,'邻居进不去自己家：'+ctl.view().status);
});

// 「回自己屋里」本来就有屋顶，不该被雨天挪到檐下
test('下雨天邻居照样回屋里，同行者才被挪到檐下',()=>{
 let s=moveIn(freshState(),{charId:'c1',name:'阿甲',look:{},door:{}});
 const n=neighborOf(s,'c1');
 // 找一个真下雨的日子
 let rainy=0;for(let d=1;d<60&&!rainy;d++){
  if(dailySchedule({...s,day:d,companion:n}).some(x=>x.id==='rain'))rainy=d;}
 assert.ok(rainy,'找不到下雨的日子');
 const ids=dailySchedule({...s,day:rainy,companion:n}).map(x=>x.id);
 assert.ok(ids.includes('indoors'),'下雨天把「回自己屋里」也挪到檐下了：'+ids.join(' '));
});

// 「非集市日不逛集市」邻居那条路原来绕开了那道门
test('邻居那条日程也过同一道季节闸',()=>{
 let s=moveIn(freshState(),{charId:'c1',name:'阿甲',look:{},door:{}});
 const n=neighborOf(s,'c1');
 for(let d=1;d<=28;d++){
  const ids=dailySchedule({...s,day:d,companion:n}).map(x=>x.id);
  if(ids.includes('market'))assert.ok(marketDay(d),'第'+d+'天不是集市日，邻居却去逛集市');
 }
});
