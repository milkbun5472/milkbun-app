import {rainyEpoch} from '../../test/_fairy-weather.mjs';
import {withOpenPaths} from '../../test/_fairy-open.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,advanceTime,weather,walkable,findPath,segmentClear,MAPS,ACTIVITIES,perform,targetFor,companionCare} from './world.mjs';
import {makeCompanionController,dailySchedule,plannedActivity,companionPlan} from './companion.mjs';
function simulate(s,seconds,controller=makeCompanionController()){let events=[];for(let i=0;i<seconds*10;i++){const prev=s.companion;const r=controller.tick(s,.1);s=r.state;if(r.event)events.push(r.event);const c=s.companion;assert.ok(walkable(c.position.x,c.position.z,c.map));if(prev.map===c.map)assert.ok(segmentClear(prev.position,c.position,c.map));else assert.ok(Math.hypot(prev.position.x-MAPS[prev.map].stations.travel.x,prev.position.z-MAPS[prev.map].stations.travel.z)<.13,'must reach actual exit');}return {s,events,controller};}
// ⚠️带一份【路已经开了】的存档：封着的那几处本来就走不过去，那是玩法。
//   「封着的时候不许把他排过去」由 new-scenes.test.mjs 那条钉。
test('他能做的每一件事，脚都真的走得到',()=>{const open=withOpenPaths();for(const [id,a] of Object.entries(ACTIVITIES)){assert.ok(findPath(MAPS[a.map].spawn,a.target,a.map,[],open)?.length,id+' 走不到：'+JSON.stringify(a));}});
test('兜底那一版只是地板，雨雪天不往林地跑',()=>{for(const day of [1,2,3]){const s={...freshState(),day};for(const p of dailySchedule(s))assert.ok(findPath(MAPS[p.map].spawn,p.target,p.map)?.length,JSON.stringify(p));if(weather(day)==='细雨')assert.ok(dailySchedule(s).every(p=>p.map==='garden'));}});
test('companion moves without input and cares once, including after reload',()=>{const r=simulate(freshState(),30);assert.equal(r.s.blooms,1);assert.equal(r.s.water,0);assert.equal(r.events.length,1);assert.equal(r.s.companion.helpDay,1);const again=simulate(restoreState(JSON.parse(JSON.stringify(r.s))),30);assert.equal(again.s.blooms,1);assert.equal(again.events.length,0);assert.equal(companionCare(freshState()).blooms,0);});
test('companion follows across maps through exits, and returns to rain routine',()=>{let s=freshState();s.map='forest';s.position={x:2.6,z:.98};s.companion.mode='follow';let r=simulate(s,45);assert.equal(r.s.companion.map,'forest');assert.ok(Math.hypot(r.s.position.x-r.s.companion.position.x,r.s.position.z-r.s.companion.position.z)<1.1);const forestPlan={season:0,title:'',days:[{day:2,note:'',activities:[{id:'mushrooms',note:''},{id:'home',note:''},{id:'home',note:''}]}]};s={...r.s,epoch:rainyEpoch,day:2,minute:660,seasonPlan:forestPlan,companion:{...r.s.companion,mode:'routine'}};assert.equal(plannedActivity(s).id,'rain');r=simulate(s,45);assert.equal(r.s.companion.map,'garden');assert.equal(r.controller.view().status,'在屋檐下听雨');});
test('autonomous off-screen care and active player care do not conflict',()=>{let s={...freshState(),map:'forest',position:{...MAPS.forest.spawn}};const r=simulate(s,30);assert.equal(r.s.blooms,1);assert.equal(r.s.map,'forest');const p=targetFor(freshState(),'garden');s={...freshState(),water:2,blooms:3,position:p};assert.equal(perform(s,'garden',undefined,'water'),s,'already-open flowers cannot turn pending watering into harvesting');assert.equal(s.harvest,0);const ctrl=makeCompanionController();s={...freshState(),companion:{...freshState().companion,position:p}};for(let i=0;i<100;i++)s=ctrl.tick(s,.1,{allowCare:false}).state;assert.equal(s.blooms,0);s=ctrl.tick(s,.1,{allowCare:true}).state;assert.equal(s.blooms,1);});
test('clock crosses days with same weather and regeneration rules as sleep',()=>{let s={...freshState(),epoch:rainyEpoch,minute:1379,picked:['herb-a']};s=advanceTime(s,1);assert.equal(s.day,2);assert.equal(s.minute,420);assert.equal(s.blooms,1);assert.deepEqual(s.picked,[]);assert.equal(advanceTime(s,60).minute,480);assert.equal(advanceTime(s,0),s);});
test('v2 and invalid companion saves migrate without losing inventory',()=>{let s=restoreState({version:2,water:2,blooms:3,herbs:4,day:4,map:'forest',position:MAPS.forest.spawn});assert.equal(s.version,9);assert.equal(s.minute,480);assert.equal(s.herbs,4);assert.equal(s.companion.name,'同行者');s=restoreState({...s,companion:{name:'  苔苔  ',temperament:'unknown',mode:'bad',map:'forest',position:{x:-.7,z:-1.1},helpDay:-1}});assert.equal(s.companion.name,'苔苔');assert.deepEqual(s.companion.position,MAPS.forest.spawn);assert.equal(s.companion.helpDay,0);});

test('routine companion makes room when player uses its station',()=>{let s=freshState();s.position={...MAPS.garden.stations.garden};const p=companionPlan(s);assert.equal(p.id,'flowers-aside');assert.ok(Math.hypot(p.target.x-s.position.x,p.target.z-s.position.z)>.65);const r=simulate(s,30);assert.ok(Math.hypot(r.s.companion.position.x-s.position.x,r.s.companion.position.z-s.position.z)>.65);});

test('following from the right stops on the right without crossing the player',()=>{let s=freshState();s.map='forest';s.position={x:0,z:3};s.companion={...s.companion,map:'forest',mode:'follow',position:{x:2.8,z:3}};const controller=makeCompanionController();for(let i=0;i<300;i++){const before=s.companion.position;s=controller.tick(s,.1).state;assert.ok(segmentClear(before,s.companion.position,'forest',[{...s.position,r:.58}]));}assert.ok(s.companion.position.x>.55);assert.ok(Math.hypot(s.companion.position.x,s.companion.position.z-3)<=1.05);});
test('a nearby companion keeps either side without shuffling to a fixed slot',()=>{for(const sign of [-1,1]){let s=freshState();s.map='forest';s.position={x:0,z:3};s.companion={...s.companion,map:'forest',mode:'follow',position:{x:sign*.82,z:3}};const initial={...s.companion.position};s=simulate(s,30).s;assert.deepEqual(s.companion.position,initial);}});
test('player moving into a pending route triggers a safe nearer stop',()=>{let s=freshState();s.map='forest';s.position={x:0,z:3};s.companion={...s.companion,map:'forest',mode:'follow',position:{x:3,z:3}};const ctrl=makeCompanionController();s=ctrl.tick(s,.2).state;s.position={x:1.65,z:3};for(let i=0;i<150;i++){const before=s.companion.position;s=ctrl.tick(s,.1).state;assert.ok(segmentClear(before,s.companion.position,'forest',[{...s.position,r:.58}]));}assert.ok(s.companion.position.x>s.position.x+.55);});
test('navigation routes around the player and permits outward recovery from overlap',()=>{const avoid=[{x:0,z:3,r:.58}],start={x:-1.5,z:3},target={x:1.5,z:3};const path=findPath(start,target,'forest',avoid);assert.ok(path?.length);let prev=start;for(const p of path){assert.ok(segmentClear(prev,p,'forest',avoid));prev=p;}const escape=findPath({x:0,z:3},target,'forest',avoid);assert.ok(escape?.length);assert.equal(findPath(start,{x:0,z:3},'forest',avoid),null);});

test('explicit goto reaches the other map and wait survives reload without wandering',()=>{let s=freshState();s.companion.mode='goto';s.companion.destination='pond';s=simulate(s,60).s;assert.equal(s.companion.map,'forest');assert.ok(Math.hypot(s.companion.position.x+.7,s.companion.position.z-.6)<.15);s.companion.mode='wait';s=restoreState(JSON.parse(JSON.stringify(s)));const before={...s.companion.position};s=simulate(s,30).s;assert.deepEqual(s.companion.position,before);assert.equal(s.companion.mode,'wait');assert.equal(s.herbs,0);});

// ⚠️地板表里必须留着那件杂活：没配线路的人打开游戏，他从此再也不浇花了——
//   这种悄悄没掉的东西最坏（v69.55 撤三档性格时差点丢了）。
test('还没排上日程的时候，他照样顺手浇一次花',()=>{
 const rows=dailySchedule(freshState()).map(p=>p.id);
 assert.ok(rows.includes('flowers'),'地板表里没有那件杂活了');
 assert.ok(rows.length>=5,'地板表太薄，她看到的就是「他不会干别的」');
 const drawn=rows.filter(id=>id!=='home'&&id!=='flowers');
 assert.equal(new Set(drawn).size,drawn.length,'中间抽出来的那几格不许重');
 const other=dailySchedule({...freshState(),day:9}).map(p=>p.id);
 assert.notDeepEqual(other,rows,'每天该不一样');
 assert.ok(other.includes('flowers'),'哪天都得有那件杂活');
});

// ⚠️新加的那几处有的【在别的地图上】（收藏馆是单独一张图）：
//   跨图要靠 exitToward 找门，找不到他就站在原地说「这里还没有通往那里的小路」。
//   ⚠️seasonPlan 不进存档（save 时剥掉），所以实机试玩里永远只有地板表——
//     这一条只能在这儿跑（2026-09-17：实机看到的是地板表，不是计划）。
test('按计划他真能走进收藏馆，不是站在门口喊没有路',()=>{
 const plan={season:0,title:'',days:[{day:3,note:'',activities:[{id:'museum',note:''},{id:'board',note:''},{id:'bottle',note:''}]}]};
 let s={...freshState(),day:3,minute:600,seasonPlan:plan};
 assert.equal(plannedActivity(s).id,'museum');
 const ctrl=makeCompanionController();
 for(let i=0;i<4000&&s.companion.map!=='museum';i++)s=ctrl.tick(s,.1).state;
 assert.equal(s.companion.map,'museum','他到不了收藏馆');
 assert.ok(!/还没有通往/.test(ctrl.view().status),ctrl.view().status);
});
