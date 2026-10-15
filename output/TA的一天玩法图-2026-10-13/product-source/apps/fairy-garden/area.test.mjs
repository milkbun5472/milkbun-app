import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withOpenPaths} from '../../test/_fairy-open.mjs';
import {freshState,MAPS,ACTIVITIES,FURNITURE,areaSpots,areaReach,areaPick,spotWeight,
 walkable,findPath,normalizePlan,companionMillHelp,millAction} from './world.mjs';
import {plannedActivity,dailySchedule,makeCompanionController} from './companion.mjs';
// 她 2026-09-18：「一个时间段能不能圈出一个活动范围，在里面干不同的事」

const season=id=>({season:0,title:'一起过这一季',
 days:Array.from({length:14},(_,i)=>({day:i+1,note:'',
  activities:[{id,note:''},{id,note:''},{id,note:''}]}))});
const at=(id,day,minute)=>plannedActivity({...freshState(),seasonPlan:season(id),day,minute});

test('范围是推导出来的，不是手写的一张点位表',()=>{
 // 水磨工坊／观星室／公共厅／集市 —— 这几处是真有好几个点的
 for(const id of ['workshop','charts','hall','market'])
  assert.ok(areaSpots(ACTIVITIES[id].map,ACTIVITIES[id].target).length>=3,id+' 一带没有点');
 // ⚠️没有点的地方就没有点：不许为了热闹编一个动作出来
 assert.equal(areaSpots('garden',ACTIVITIES.flowers.target).length,0);
 // 每一处都要站得住、走得到——不然他会站在原地等一条不存在的小路
 // ⚠️带一份【路已经开了】的存档：小岛和倒树后的空地封着的时候本来就走不过去，那是玩法。
 const s=withOpenPaths();
 for(const id of Object.keys(ACTIVITIES)){const a=ACTIVITIES[id];
  for(const q of areaSpots(a.map,a.target)){
   assert.ok(walkable(q.target.x,q.target.z,a.map,s),id+' 的「'+q.label+'」站不住');
   assert.ok(findPath(MAPS[a.map].spawn,q.target,a.map,[],s),id+' 的「'+q.label+'」走不到');}}
});

// ⚠️实测 8 米时「月湖北岸」会把集市那几个摊位算进来（坐标上挨着）
test('室外半径要小，室内可以放宽',()=>{
 assert.ok(areaReach('hall')>areaReach('garden'),'室内够不到别的地图，漏不出去');
 const lake=areaSpots('garden',ACTIVITIES.lakeNorth.target).map(q=>q.label);
 for(const q of lake)assert.ok(!/集市|摊|茶|花车/.test(q),'从湖北岸溜达进集市了：'+q);
});

test('挨着的、名字套着名字的，不算第二处',()=>{
 const hall=areaSpots('hall',ACTIVITIES.hall.target).map(q=>q.label);
 // 「壁炉」⊂「壁炉旁」：位置差两米，可念出来就是同一处
 assert.ok(hall.includes('壁炉旁')&&!hall.includes('壁炉'),hall.join('·'));
 const tower=areaSpots('oldTower',ACTIVITIES.charts.target).map(q=>q.label);
 assert.ok(tower.includes('铜环星仪')&&!tower.includes('星仪'),tower.join('·'));
});

// ⚠️她 2026-09-18：「每天接着上次转圈不也是人机，有些东西就会有些人干得多有些人干得少」
test('偏好是稳定的、不平均的，而且从不为零',()=>{
 const s=freshState(),spots=areaSpots('watermill',ACTIVITIES.workshop.target);
 const w=spots.map(q=>spotWeight(s,'c1',q.key));
 assert.ok(new Set(w).size>1,'权重全一样＝轮盘＝人人平均，那正是人不会有的样子');
 assert.ok(w.every(x=>x>0),'权重不许为零：那就成了结构性的「永远临幸不到」');
 // 同一个存档里每次都一样 → 认得出是习惯，不是今天喜欢明天不喜欢
 assert.deepEqual(spots.map(q=>spotWeight(freshState(),'c1',q.key)),w);
 // 换个人，这间屋的用法就变了（三个邻居住同一间屋，各有各的习惯位置）
 assert.notDeepEqual(spots.map(q=>spotWeight(s,'c2',q.key)),w);
 // 存档不同也不同
 assert.notDeepEqual(spots.map(q=>spotWeight({...s,epoch:'另一档'},'c1',q.key)),w);
});

test('一格里挨着待的那几处不重复，而且同一时刻进来几次都一样',()=>{
 const s=freshState(),spots=areaSpots('watermill',ACTIVITIES.workshop.target);
 const picks=areaPick(s,'c1',spots,'seed',3);
 assert.equal(picks.length,3);
 assert.equal(new Set(picks.map(q=>q.key)).size,3,'同一格里挑重了');
 assert.deepEqual(areaPick(s,'c1',spots,'seed',3).map(q=>q.key),picks.map(q=>q.key));
});

test('一格时间里他真的换地方，而且一天和一天不一样',()=>{
 const spots=new Set(),days=new Set();
 for(const day of [1,2,3,4,5]){
  const row=[500,700,850].map(m=>at('workshop',day,m).label);
  row.forEach(x=>spots.add(x)); days.add(row.join('|'));
 }
 assert.ok(spots.size>=4,'一格里从头到尾只有这几处：'+[...spots].join('·'));
 assert.ok(days.size>=3,'每天长得一模一样');
});

// ⚠️最坏的一种：他到了水磨工坊，却再也不帮忙照看材料了，而且不报任何错
test('这一格本来那个点必须留着，钉在上面的活儿不许悄悄没掉',()=>{
 for(const day of [1,2,3,4,5,6,7])
  assert.equal(at('workshop',day,480).label,ACTIVITIES.workshop.label,
   '第'+day+'天头一站不是工坊本来那个点');
 // companionMillHelp 要他站进长工作台 1.25 米内才算帮上忙
 const p=at('workshop',3,480),mill=MAPS.watermill.stations.mill;
 assert.ok(Math.hypot(p.target.x-mill.x,p.target.z-mill.z)<1.25);
});

// ⚠️tick 里有 plan.id==='flowers'／'museum'、['workshop','workshop-aside'] 这几处判断
test('换了地方挂在 spot 上，id 一个字都不许改',()=>{
 const p=at('workshop',1,900);   // 头一站是工坊本来那个点，第二站才是别处
 assert.equal(p.id,'workshop','id 被改了，那几处判断当场失灵');
 assert.ok(p.spot,'换了地方得留个记号，不然路线键认不出来');
 const comp=fs.readFileSync(new URL('./companion.mjs',import.meta.url),'utf8');
 assert.match(comp,/\$\{plan\.id\}:\$\{plan\.spot\|\|''\}/,'路线键要带上 spot，不然他不会挪窝');
});

// ⚠️这一层【不是他的性格】：纯 hash 出来的偏好换个角色照样成立，
//   而「换个角色还照样成立的就是写坏了」（v69.55 撤掉按性格分的三张表那次）。
test('注释里要把「这不是他的性格」写死',()=>{
 const world=fs.readFileSync(new URL('./world.mjs',import.meta.url),'utf8');
 assert.match(world,/这一层【不是他的性格】/);
 assert.match(world,/一个字都不编他喜欢什么/);
 assert.match(world,/真正照着人设来的那一份在季节手册那一枪里/);
});

test('走得到、不卡住：一格时间从头跑到尾',()=>{
 let s={...freshState(),seasonPlan:season('charts'),day:2,minute:480,
  companion:{...freshState().companion,map:'oldTower',position:{...MAPS.oldTower.spawn}}};
 const ctrl=makeCompanionController();const seen=new Set();
 for(let i=0;i<20000;i++){
  if(i%10===0)s={...s,minute:Math.min(1259,s.minute+1)};
  s=ctrl.tick(s,.05,{}).state;
  const v=ctrl.view();
  assert.ok(!v.stuck,'卡住了：'+v.status);
  if(!v.moving)seen.add(v.status);
 }
 assert.ok(seen.size>=3,'一整格下来他只待过：'+[...seen].join('｜'));
});
