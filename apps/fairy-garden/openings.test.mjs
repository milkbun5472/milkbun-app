import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,MAPS,walkable,OPENINGS,isOpening,opened,openingReady,openingLine,
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
