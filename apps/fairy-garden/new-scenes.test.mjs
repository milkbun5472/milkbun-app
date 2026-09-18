import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withOpenPaths} from '../../test/_fairy-open.mjs';
import {freshState,restoreState,MAPS,ACTIVITIES,OPENINGS,opened,walkable,findPath,
 COMPANION_DESTINATIONS,destinationChoices,journalText,restoreCompanion,
 whereLabel,shutError,actionError} from './world.mjs';
import {dailySchedule,plannedActivity,makeCompanionController} from './companion.mjs';
// 她 2026-09-18：「然后把新加的场景的动作交互也补上吧宝宝」

const allOpen=withOpenPaths;
const NAILS=['home','flowers','rain'];

test('这一季新长出来的地方，他每一处都够得着',()=>{
 const s=allOpen(freshState());
 for(const id of ['railway','lakeNorth','lakeEast','hiddenPath','tower','charts','clearing','island','workshop']){
  const a=ACTIVITIES[id];
  assert.ok(a,id+' 还没进 ACTIVITIES');
  assert.ok(walkable(a.target.x,a.target.z,a.map,s),id+' 的落点站不住');
  assert.ok(findPath(MAPS[a.map].spawn,a.target,a.map,[],s),id+' 没有路过去');
 }
});

// ⚠️这一条钉的是【地板表照 ACTIVITIES 长】那件事本身：
//   workshop 当年就是「这边定义好了、那张手抄的池子里没有它」，于是他一次都没被排去过。
test('地板表不是手抄的：ACTIVITIES 里每一处都会被排到',()=>{
 const s=allOpen(freshState());
 const seen=new Set();
 for(let day=1;day<=120;day++)for(const item of dailySchedule({...s,day}))seen.add(item.id);
 for(const id of Object.keys(ACTIVITIES))
  assert.ok(seen.has(id)||NAILS.includes(id),id+' 在这个世界里，他却一天都不会去');
});

test('路还没开的地方不排给他——排了他只会站在封口前面',()=>{
 const shut=freshState();
 const gated=Object.keys(ACTIVITIES).filter(id=>ACTIVITIES[id].opensWith);
 assert.ok(gated.length,'没有一处是要先开路的，这条就白钉了');
 for(const id of gated)assert.equal(opened(shut,ACTIVITIES[id].opensWith),false);
 const seen=new Set();
 for(let day=1;day<=120;day++)for(const item of dailySchedule({...shut,day}))seen.add(item.id);
 for(const id of gated)assert.ok(!seen.has(id),id+' 路还封着就把他排过去了');
 const open=allOpen(shut),after=new Set();
 for(let day=1;day<=120;day++)for(const item of dailySchedule({...open,day}))after.add(item.id);
 for(const id of gated)assert.ok(after.has(id),id+' 开了路之后仍然去不了');
});

// ⚠️实机跑出来的那一条：芦苇桥只有 1.45 宽，他贴着边沿走过去，
//   落在登岸台外面三毫米，然后「在原地等一条合适的小路」。
test('开了芦苇桥，他真的走得上小岛（不是只有一条路存在）',()=>{
 let s=allOpen(freshState());
 s={...s,minute:600,seasonPlan:{season:0,title:'一起过这一季',
  days:Array.from({length:14},(_,i)=>({day:i+1,note:'',
   activities:[{id:'island',note:''},{id:'island',note:''},{id:'island',note:''}]}))}};
 const plan=plannedActivity(s),ctrl=makeCompanionController();
 let arrived=false;
 for(let i=0;i<8000&&!arrived;i++){
  s=ctrl.tick(s,.05,{}).state;
  arrived=s.companion.map===plan.map&&
   Math.hypot(s.companion.position.x-plan.target.x,s.companion.position.z-plan.target.z)<.9;
 }
 assert.ok(arrived,'他没走到岛上：'+ctrl.view().status);
});

test('她能把他约到新场景去，白名单和提示词都照同一张表',()=>{
 for(const id of ['railway','lake','tower','mill','market','hall'])
  assert.ok(COMPANION_DESTINATIONS[id],id+' 还不能约');
 // 存档白名单不许是手抄的第二份
 for(const id of Object.keys(COMPANION_DESTINATIONS))
  assert.equal(restoreCompanion({mode:'goto',destination:id}).destination,id);
 assert.equal(restoreCompanion({mode:'goto',destination:'没有这个地方'}).destination,'home');
 const line=destinationChoices();
 for(const id of Object.keys(COMPANION_DESTINATIONS))assert.match(line,new RegExp(id+'（'));
 // 写给模型的那句照这张表长，不许再在 js/fairy-garden.js 里手抄一份中文地名
 const host=fs.readFileSync(new URL('../../js/fairy-garden.js',import.meta.url),'utf8');
 assert.match(host,/target 取 " \+ \(destinations \|\| /);
 assert.ok(!host.includes('pond（林地池边）'),'宿主那句又抄了一份地名');
});

test('约得到的地方，路一直是通的（不许约到还没开的路上去）',()=>{
 const shut=freshState();
 for(const [id,d] of Object.entries(COMPANION_DESTINATIONS))
  assert.ok(findPath(MAPS[d.map].spawn,d.target,d.map,[],shut),id+'：什么都没开的时候他就到不了');
});

// ⚠️写的那一半（perform 往 today 里记）和读的那一半（restoreToday/journalText）是同一层。
test('日记认得 perform 记下的每一个动作，重开一次也不丢',()=>{
 const entry={weather:'晴日',partner:'他',actions:{mill:2}};
 assert.match(journalText(entry),/在水磨工坊碾料 2 次/);
 assert.ok(!journalText(entry).includes('undefined'));
 const back=restoreState({...freshState(),today:{mill:3}});
 assert.equal(back.today.mill,3,'重开一次 mill 就没了');
});

// ⚠️whereLabel 照 sites 认地方：没有名字的场景，村里的账上写的是「在林边村落碰见」。
test('新场景在村里有自己的名字，碰见记的不是「林边村落」',()=>{
 const s=allOpen(freshState());
 for(const id of ['railway','lakeNorth','lakeEast','hiddenPath','tower','clearing','island']){
  const a=ACTIVITIES[id],label=whereLabel(a.map,a.target);
  assert.notEqual(label,MAPS[a.map].name,id+' 在账上没有自己的名字');
 }
});

test('封着的地方走不过去，那一句照 OPENINGS 长，不是各处手抄',()=>{
 const shut=freshState(),open=allOpen(shut);
 for(const key of Object.keys(OPENINGS)){
  assert.match(shutError(shut,key),new RegExp(OPENINGS[key].shut.slice(0,8)));
  assert.match(shutError(shut,key),/先用.*咒把它打开/);
  assert.equal(shutError(open,key),'');
 }
 // 座位和散步到访是同一句：sit 那一支原来写死的是芦苇桥
 assert.equal(actionError(shut,'sit','island'),shutError(shut,'reedBridge'));
 assert.equal(actionError(shut,'visit','island'),shutError(shut,'reedBridge'));
 assert.equal(actionError(open,'visit','island'),'');
 assert.equal(actionError(shut,'sit','pond'),'','没上锁的座位别被误伤');
});

// ⚠️一起排这一季那一枪，模型不知道哪几条路还封着——normalizePlan 只认「这处地方在不在」。
test('这一季排到了还没开的路，他去屋前待着，而不是站在封口前面一整天',()=>{
 const day=Array.from({length:14},(_,i)=>({day:i+1,note:'',
  activities:[{id:'island',note:'去岛上'},{id:'walk',note:''},{id:'clearing',note:''}]}));
 const plan={season:0,title:'一起过这一季',days:day};
 const shut={...freshState(),seasonPlan:plan,day:1};
 for(const item of dailySchedule(shut)){
  assert.ok(!ACTIVITIES[item.id].opensWith,item.id+' 路还封着就排给他了');
  if(item.note)assert.match(item.note,/那条路还没打开/);
 }
 const open={...allOpen(freshState()),seasonPlan:plan,day:1};
 const ids=dailySchedule(open).map(x=>x.id);
 assert.ok(ids.includes('island')&&ids.includes('clearing'),'开了路之后要照她排的来');
});
