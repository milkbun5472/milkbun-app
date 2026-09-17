import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,MAPS,WORKS,workHere,workError,workShort,workCost,doWork,
 workDone,worksDone,workSpot,lampOn,restoreFixtures,recentHappenings,weather,turnIn,
 takeQuest,questBoard} from './world.mjs';
import {plannedActivity,companionPlan,dailySchedule} from './companion.mjs';
// 她 2026-09-17：「做④吧宝宝」——做过的事真的改变生活

const dry=(()=>{for(let d=1;d<60;d++)if(!['细雨','细雪'].includes(weather(d,'initial')))return d;})();
const wet=(()=>{for(let d=1;d<60;d++)if(['细雨','细雪'].includes(weather(d,'initial')))return d;})();
const atLake=s=>({...s,position:{...MAPS.garden.sites.lakeNorth.target}});
const atTower=s=>({...s,position:{...MAPS.garden.sites.oldTower.target}});

test('走到那儿、带够东西，才动得了手',()=>{
 let s=freshState();
 assert.equal(workHere(s),null,'家门口没有活');
 assert.match(workError(s,'lakeShade'),/走到.*那儿/);
 s=atLake(s);
 assert.equal(workHere(s),'lakeShade');
 assert.deepEqual(workShort(s,'lakeShade'),['铃叶草 ×6','月光花 ×3']);
 assert.match(workError(s,'lakeShade'),/还差/);
 assert.equal(doWork(s,'lakeShade'),s,'东西不够就什么都不许变');
 s={...s,herbs:7,harvest:4};
 assert.equal(workError(s,'lakeShade'),'');
 const out=doWork(s,'lakeShade');
 assert.equal(workDone(out,'lakeShade'),true);
 assert.deepEqual([out.herbs,out.harvest],[1,1],'材料真的扣掉了');
 assert.match(recentHappenings(out,1)[0].text,/藤棚/);
 assert.match(workError(out,'lakeShade'),/已经弄好/);
});

test('弄好之后，他那一天真的改了去处',()=>{
 let s={...atLake(freshState()),herbs:7,harvest:4,minute:800};
 const before=plannedActivity(s);
 s=doWork(s,'lakeShade');
 const after=plannedActivity(s);
 assert.notDeepEqual(after.target,before.target);
 assert.deepEqual(after.target,MAPS.garden.sites.lakeNorth.target);
 // ⚠️tick 在 routine 模式绕开 companionPlan：两个调用方必须给同一个答案。
 //   她得站远一点问——站在棚底下问，companionPlan 会让他【到你身边来】，
 //   那是另一条规矩（走到你跟前陪着），不是这一条。
 const away={...s,position:{...MAPS.garden.sites.home.target}};
 assert.deepEqual(companionPlan(away).target,plannedActivity(away).target);
 assert.deepEqual(plannedActivity(away).target,MAPS.garden.sites.lakeNorth.target);
});

test('旧塔的屋顶补好，雨天他去塔下而不是自家屋檐',()=>{
 let s={...atTower(freshState()),day:wet,minute:800,sand:9,
  shards:[{id:'a',kind:'relic',text:'一'},{id:'b',kind:'relic',text:'二'},{id:'c',kind:'echo',text:'三'}]};
 assert.equal(dailySchedule(s).find(p=>p.start===720).id,'rain','下雨天露天那一格挪到檐下');
 const eaves=plannedActivity(s).target;
 s=doWork(s,'towerRoof');
 assert.deepEqual(plannedActivity(s).target,MAPS.garden.sites.oldTower.target);
 assert.notDeepEqual(plannedActivity(s).target,eaves);
 assert.equal(s.sand,1);
 assert.equal((s.shards||[]).length,1,'两片遗物用掉了，别的一片不许动');
 assert.equal(s.shards[0].kind,'echo');
 // 不下雨那天照旧
 assert.equal(dailySchedule({...s,day:dry}).find(p=>p.start===720).id,'walk');
});

test('小路那盏灯是这张表的第一行，不是它的例外',()=>{
 const s=freshState();
 assert.equal(workDone(s,'pathLamp'),false);
 assert.match(workError(s,'pathLamp'),/公告栏/,'它归公告栏那件「修东西」管，不在现场动手');
 assert.equal(workHere({...s,position:{...MAPS.garden.sites.oldTower.target}}),'towerRoof');
 // 灯亮不亮还是照它自己的时辰
 const on={...s,fixtures:{...restoreFixtures(null),pathLamp:true}};
 assert.equal(lampOn({...on,minute:1100}),true);
 assert.equal(lampOn({...on,minute:600}),false);
 assert.equal(lampOn({...s,minute:1100}),false);
});

test('修过的地方跟着存档走，旧存档一个都不丢',()=>{
 let s={...atLake(freshState()),herbs:7,harvest:4};
 s=doWork(s,'lakeShade');
 const back=restoreState(JSON.parse(JSON.stringify(s)));
 assert.equal(workDone(back,'lakeShade'),true);
 assert.deepEqual(worksDone(back).map(w=>w.id),['lakeShade']);
 // 只有一盏灯的旧存档：灯留着，新那两件从头开始
 const old=restoreState({version:9,fixtures:{pathLamp:true}});
 assert.deepEqual(restoreFixtures(old.fixtures),{pathLamp:true,towerRoof:false,lakeShade:false});
});

test('没弄好的地方不许改他的去处',()=>{
 const s={...freshState(),minute:800};
 assert.equal(workSpot(s,'walk'),null);
 assert.equal(workSpot(s,'rain'),null);
});
