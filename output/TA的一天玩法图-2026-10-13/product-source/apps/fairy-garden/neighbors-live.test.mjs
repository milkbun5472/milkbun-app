import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,MAPS,NEIGHBOR_HOUSES,NEIGHBOR_MAX,restoreNeighbors,freeHouse,
 neighborOf,moveIn,moveInError,moveOut,asCompanion,recentHappenings,walkable} from './world.mjs';
import {makeCompanionController,plannedActivity,dailySchedule,companionPlan} from './companion.mjs';
// 她 2026-09-17：「A 可以，然后可以做他们之间也可以互动这样更像邻居关系」
// ⚠️邻居【就是同行者那一份东西】，只是不是此刻跟你在一起的那个：
//   同一个 restoreCompanion、同一个 companionPlan、同一个控制器，各跑一份。

test('三间屋就是三个名额，一人一间',()=>{
 let s=freshState();
 assert.equal(freeHouse(s),NEIGHBOR_HOUSES[0]);
 s=moveIn(s,{charId:'c1',name:'陆闻记'});
 assert.deepEqual(restoreNeighbors(s.neighbors).map(n=>n.home),['neighbor1']);
 assert.match(moveInError(s,'c1'),/已经住在村里/);
 s=moveIn(s,{charId:'c2',name:'甲'});s=moveIn(s,{charId:'c3',name:'乙'});
 assert.equal(restoreNeighbors(s.neighbors).length,NEIGHBOR_MAX);
 assert.match(moveInError(s,'c4'),/都住满了/);
 assert.equal(freeHouse(s),null);
 // 搬走之后那一间空出来
 s=moveOut(s,'c2');
 assert.equal(freeHouse(s),'neighbor2');
 assert.equal(neighborOf(s,'c2'),null);
});

test('跟你同住的那一位不能同时当邻居',()=>{
 const s={...freshState(),partnerId:'c1'};
 assert.match(moveInError(s,'c1'),/已经和你住在一起/);
});

test('搬进搬出都记进村里那本账',()=>{
 let s=moveIn(freshState(),{charId:'c1',name:'陆闻记'});
 assert.match(recentHappenings(s)[0].text,/陆闻记搬进了/);
 s=moveOut(s,'c1');
 assert.match(recentHappenings(s)[0].text,/陆闻记从.*搬走了/);
});

// ⚠️不改「家」那一层的话，三个邻居全会挤在你家门口
test('邻居的家是他自己那一间，不是你家门口',()=>{
 let s={...freshState(),day:2,minute:1300};
 s=moveIn(s,{charId:'c1',name:'甲'});
 const n=restoreNeighbors(s.neighbors)[0];
 const mine=plannedActivity(s).target, his=plannedActivity(asCompanion(s,n)).target;
 const myHouse=MAPS.garden.stations.rest, hisHouse=MAPS.garden.sites.neighbor1.target;
 assert.ok(Math.hypot(his.x-hisHouse.x,his.z-hisHouse.z)<1.6,'他回的不是自己那间');
 assert.ok(Math.hypot(mine.x-myHouse.x,mine.z-myHouse.z)<1.6,'你的同行者被带跑了');
});

// ⚠️tick 在 routine 模式下绕开 companionPlan 直接用 plannedActivity：
//   只改 companionPlan 的话，三个邻居照旧全挤在你家门口（missPlan 那次一模一样的坑）
test('两处都认那一层：companionPlan 和 plannedActivity 说的是同一个地方',()=>{
 let s={...freshState(),day:2,minute:1300};
 s=moveIn(s,{charId:'c1',name:'甲'});
 const a=asCompanion(s,restoreNeighbors(s.neighbors)[0]);
 assert.deepEqual(plannedActivity(a).target,companionPlan(a).target);
});

test('邻居走的是他自己的一天，不去照料你家的花圃',()=>{
 let s={...freshState(),day:2};
 s=moveIn(s,{charId:'c1',name:'甲'});
 const rows=dailySchedule(asCompanion(s,restoreNeighbors(s.neighbors)[0])).map(x=>x.id);
 assert.ok(!rows.includes('flowers'),'邻居跑去浇你家的花＝那是你家门口那件杂活');
 assert.ok(dailySchedule(s).map(x=>x.id).includes('flowers'),'你的同行者那件杂活不许丢');
});

// ⚠️「来找你说话」「去馆里看你留下的东西」「帮你浇花」都是【你和他之间】的事
test('邻居不接那几件只属于你俩的事',()=>{
 let s={...freshState(),day:9,minute:600,miss:{score:99,day:0,since:1,cameAt:0},blooms:0,water:3,
  collection:[{id:'k',name:'回声灯',note:'x',kind:'echo',way:'set',day:1,gaveDay:1}]};
 s=moveIn(s,{charId:'c1',name:'甲'});
 const n=restoreNeighbors(s.neighbors)[0],c=makeCompanionController();
 let a=asCompanion(s,n),events=[];
 for(let i=0;i<1200;i++){const r=c.tick(a,.1,{allowCare:false,autonomous:true});a=r.state;if(r.event)events.push(r.event);}
 assert.deepEqual(events,[],'邻居替你浇花／替他去馆里，那就乱了');
 assert.ok(!/找你说句话|有话要说/.test(c.view().status),'三个邻居排队来找你说话');
 assert.equal(a.blooms,0,'邻居动了你的花圃');
});

test('几个邻居不会叠在同一个点上',()=>{
 let s={...freshState(),day:2,minute:1250};
 for(const [id,name] of [['c1','甲'],['c2','乙'],['c3','丙']])s=moveIn(s,{charId:id,name});
 const rows=restoreNeighbors(s.neighbors);
 const crew=rows.map(n=>({n,c:makeCompanionController(),a:asCompanion(s,n)}));
 for(let i=0;i<900;i++)for(const x of crew)x.a=x.c.tick(x.a,.1,{allowCare:false,autonomous:true}).state;
 const pts=crew.map(x=>x.a.companion.position);
 pts.forEach(p=>assert.ok(walkable(p.x,p.z,'garden'),'停在了走不到的地方'));
 for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)
  assert.ok(Math.hypot(pts[i].x-pts[j].x,pts[i].z-pts[j].z)>.5,'两个人叠在一起了');
});

test('邻居存得住，旧存档进来是空的',()=>{
 const s=moveIn(freshState(),{charId:'c1',name:'甲',look:{hair:'bun'}});
 assert.deepEqual(restoreState(s).neighbors,restoreNeighbors(s.neighbors));
 assert.deepEqual(restoreState({version:8,day:3}).neighbors,[]);
 // 同一间屋不许塞两个人，同一个人不许占两间
 assert.equal(restoreNeighbors([{charId:'a',home:'neighbor1'},{charId:'b',home:'neighbor1'}]).length,1);
 assert.equal(restoreNeighbors([{charId:'a',home:'neighbor1'},{charId:'a',home:'neighbor2'}]).length,1);
});
