import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,MAPS,walkable,segmentClear,findPath,floorHeight,OPENINGS,isOpening,opened,openingReady,openingLine,
 SPELL_PLACES,SPELLS,castPlaceError,castError,castSpell,castAt,castLine,recentHappenings,
 restoreState} from './world.mjs';
// 她 2026-09-17：「先做吧宝宝」——我这半边先做好，等 codex 的网格一到就通
// 交接单：庭院工单-会开的路-2026-09-17.md

const ready=(key,box)=>{               // 假装 codex 已经把标记加上了
 const o={x:99,z:99,w:2,d:2,opensWith:key,...(box||{})};
 MAPS.garden.obstacles.push(o);
 return ()=>{MAPS.garden.obstacles.splice(MAPS.garden.obstacles.indexOf(o),1);};
};
const SPOT={x:8,z:-21,w:3.2,d:1.4};   // 本来走得通的一段泥路
const armed=spell=>({...freshState(),spells:[spell],
 shards:[{id:'s1',kind:SPELLS[spell].need,text:'那天你说的那句'}]});

test('三处开口就是三处能封咒的地方，不是第二套魔法',()=>{
 for(const [key,o] of Object.entries(OPENINGS)){
  assert.ok(SPELL_PLACES[key],key+' 要在封咒的地点表里');
  assert.ok(MAPS.garden.sites[o.site],key+' 的地点要真的存在');
  assert.ok(SPELLS[o.spell],key+' 要认一个真的咒');
  assert.ok(o.shut&&o.open&&o.done);
 }
});

// ⚠️封了却走不过去＝骗她
test('模型还没标记之前，那一处根本不给封',()=>{
 const s=armed('relic');
 assert.equal(openingReady('fallenTree'),false);
 assert.match(castPlaceError(s,'fallenTree'),/还没通到这个世界里来/);
 assert.equal(castSpell(s,'relic','s1','fallenTree'),s,'什么都不许变');
});

test('标记一到，这条路自己就开了口，不用再发一版',()=>{
 const undo=ready('fallenTree',SPOT);
 try{
  assert.equal(openingReady('fallenTree'),true);
  let s=armed('relic');
  assert.equal(castPlaceError(s,'fallenTree'),'');
  // 挡着的时候走不过去
  assert.equal(walkable(SPOT.x,SPOT.z,'garden',s),false);
  assert.equal(opened(s,'fallenTree'),false);
  assert.equal(openingLine(s,'fallenTree'),OPENINGS.fallenTree.shut);
  assert.equal(castError(s,'relic','s1','fallenTree'),'');
  s=castSpell(s,'relic','s1','fallenTree');
  // 开了就走得过去了
  assert.equal(opened(s,'fallenTree'),true);
  assert.equal(walkable(SPOT.x,SPOT.z,'garden',s),true);
  assert.equal(openingLine(s,'fallenTree'),OPENINGS.fallenTree.open);
  assert.equal(recentHappenings(s,1)[0].text,OPENINGS.fallenTree.done);
  // ⚠️碎片不烧掉：从背包出去，封进那一处，还读得到
  assert.equal((s.shards||[]).length,0);
  assert.equal(castAt(s,'fallenTree').text,'那天你说的那句');
  assert.match(castLine(s,'fallenTree'),/那天你说的那句/);
  // 存了再读回来，路还是开的
  assert.equal(opened(restoreState(JSON.parse(JSON.stringify(s))),'fallenTree'),true);
 }finally{undo();}
});

// 灰着不解释，她只会以为坏了
test('开口只认它自己那个咒，而且说得出为什么',()=>{
 const undo=ready('fallenTree');
 try{
  const s={...freshState(),spells:['relic','dream'],
   shards:[{id:'d1',kind:'dream',text:'一个梦'},{id:'r1',kind:'relic',text:'一件东西'}]};
  assert.match(castError(s,'dream','d1','fallenTree'),/要的是.*唤醒咒/);
  assert.equal(castError(s,'relic','r1','fallenTree'),'');
 }finally{undo();}
});

test('别处的障碍一个都没动',()=>{
 const s=freshState();
 const undo=ready('fallenTree',SPOT);
 try{
  const open=castSpell({...armed('relic')},'relic','s1','fallenTree');
  // 开了这一处，不等于别处也开了
  assert.equal(walkable(-13,5.8,'garden',open),false,'屋子还是挡着');
  assert.equal(walkable(22,8,'garden',open),false,'湖面还是过不去');
  assert.equal(walkable(SPOT.x,SPOT.z,'garden',s),false,'没封的存档照旧走不过去');
 }finally{undo();}
});

test('没标记的开口不许出现在地点表里当个灰按钮骗点击',()=>{
 const s=armed('relic');
 for(const key of Object.keys(OPENINGS))
  assert.match(castPlaceError(s,key),/还没通到这个世界里来/);
});

// ── codex 2026-09-17 对着代码查出来的那几处（他没改代码，只记了问题）──────────

// 他实测：落脚点判断能走，跨过去仍被拦，自动寻路还会报错
test('路开了，跨过去和自动寻路都要跟着开',()=>{
 const wall={x:8,z:-21,w:300,d:1.4,opensWith:'fallenTree'};   // 横着封死整条路
 MAPS.garden.obstacles.push(wall);
 try{
  const A={x:8,z:-18.5},B={x:8,z:-23.5};
  let s=armed('relic');
  assert.equal(segmentClear(A,B,'garden',[],s),false,'还挡着的时候跨不过去');
  assert.equal(findPath(A,B,'garden',[],s),null,'还挡着的时候没有路');
  s=castSpell(s,'relic','s1','fallenTree');
  assert.equal(walkable(B.x,B.z,'garden',s),true);
  assert.equal(segmentClear(A,B,'garden',[],s),true,'开了就跨得过去');
  assert.ok(findPath(A,B,'garden',[],s),'开了就找得到路');
 }finally{MAPS.garden.obstacles.splice(MAPS.garden.obstacles.indexOf(wall),1);}
});

// ⚠️比「走不过去」更坏的一种：walkable(x,z,map) 不带存档的调用全库到处都是
test('不带存档的那些调用一个都不许炸',()=>{
 const undo=ready('fallenTree',{x:8,z:-21,w:3.2,d:1.4});
 try{
  assert.equal(walkable(8,-21,'garden'),false);
  assert.equal(opened(null,'fallenTree'),false);
  assert.equal(segmentClear({x:8,z:-18},{x:8,z:-24},'garden'),false);
  assert.ok(findPath(MAPS.garden.sites.home.target,MAPS.garden.sites.hall.target,'garden'),'主寻路照旧通');
 }finally{undo();}
});

// 他点名的第四条：芦苇桥要真正可走的桥面，还要处理桥下那段湖水
test('桥面搭起来才算路，没搭之前不许浮在水上',()=>{
 const deck={x:22,z:8,w:6,d:2.4,height:.35,opensWith:'reedBridge'};
 MAPS.garden.surfaces.push(deck);
 const undo=ready('reedBridge',{x:0,z:0,w:.01,d:.01});
 try{
  let s={...freshState(),spells:['sense'],shards:[{id:'s1',kind:'sense',text:'一段感觉'}]};
  assert.equal(walkable(22,8,'garden',s),false,'没搭之前那儿是湖水');
  assert.equal(floorHeight('garden',{x:22,z:8},s),MAPS.garden.floor??.08,'没搭之前不许有桥面高度');
  s=castSpell(s,'sense','s1','reedBridge');
  assert.equal(walkable(22,8,'garden',s),true,'搭好了就站得住');
  assert.equal(floorHeight('garden',{x:22,z:8},s),deck.height,'站上去的高度是桥面');
  assert.equal(segmentClear({x:19.5,z:8},{x:24.5,z:8},'garden',[],s),true,'桥上能走过去');
  // 桥只在桥那一段：旁边还是水（16,8 不在桥面范围里，基线就走不过去）
  assert.equal(walkable(16,8,'garden',s),false,'桥外面还是湖');
 }finally{MAPS.garden.surfaces.splice(MAPS.garden.surfaces.indexOf(deck),1);undo();}
});
