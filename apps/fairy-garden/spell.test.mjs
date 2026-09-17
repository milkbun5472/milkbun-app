import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,SPELLS,SPELL_PLACES,spellOfSeason,restoreSpells,
 castError,castSpell,castAt,castLine,perform,MAPS,companionNearby,recentHappenings,actionError} from './world.mjs';
// 她 2026-09-17：「我想的魔法更像是那种我可以 cast spell 的那种，
//                 微光种子这些要不要也改成碎片或者关系相关的」
// ⚠️材料是碎片——那是你们之间真说过的话、真做过的梦。魔法因此自动是「关系相关」的。
const shard=(kind,id)=>({id,kind,text:'一段'+kind+'。',whole:false,depth:2,day:3,pinned:false});

test('一季学一个咒，四季轮一圈',()=>{
 assert.deepEqual([0,1,2,3,4,5].map(spellOfSeason),['echo','dream','sense','relic','echo','dream']);
 for(const id of Object.keys(SPELLS)) assert.ok(SPELLS[id].name&&SPELLS[id].need&&SPELLS[id].note,id);
});

// ⚠️那场戏留着，醒来的东西换了：不再是一朵花，是一个咒
test('跟他一起唤醒种子，醒来的还有一个咒',()=>{
 let s={...freshState(),map:'forest',position:{...MAPS.forest.stations.seed}};
 s={...s,companion:{...s.companion,map:'forest',position:{...s.position}}};
 assert.equal(companionNearby(s),true);
 const out=perform(s,'seed');
 assert.equal(out.magic.seeds,1,'种子那一半不许丢');
 assert.deepEqual(restoreSpells(out.spells),['echo']);
 assert.match(recentHappenings(out)[0].text,/学会了回声咒/);
 // 他不在旁边就还是唤不醒——那一层是这游戏里唯一真的双人动作
 const alone={...s,companion:{...s.companion,position:{x:s.position.x+9,z:s.position.z+9}}};
 assert.equal(perform(alone,'seed'),alone);
});

test('没学会的咒念不了，材料不对也念不了',()=>{
 const s={...freshState(),shards:[shard('echo','s1'),shard('dream','s2')],spells:['echo']};
 assert.match(castError({...s,spells:[]},'echo','s1','eaves'),/还不会/);
 assert.match(castError(s,'dream','s2','eaves'),/还不会/);
 assert.match(castError(s,'echo','s2','eaves'),/要的是回声石/);
 assert.match(castError(s,'echo','没这片','eaves'),/先挑一片碎片/);
 assert.match(castError(s,'echo','s1','哪儿'),/还没有这个地方/);
 assert.equal(castError(s,'echo','s1','eaves'),'');
});

// ⚠️施法不烧掉碎片：它从背包出去、封进世界里一个位置，还读得到，只是不能再拿去合炉
test('封出去的碎片没被烧掉，只是不在背包里了',()=>{
 let s={...freshState(),shards:[shard('echo','s1')],spells:['echo']};
 s=castSpell(s,'echo','s1','eaves');
 assert.equal(s.shards.length,0,'还占着背包＝没真封出去');
 assert.equal(s.casts.length,1);
 assert.equal(castAt(s,'eaves').text,'一段echo。','封出去就读不到了＝等于烧了');
 assert.match(castLine(s,'eaves'),/屋檐下又响起那一句/);
 assert.deepEqual(restoreState(s).casts,s.casts,'存不住的话她第二天回来就没了');
});

test('一个地方只封一片',()=>{
 let s={...freshState(),shards:[shard('echo','s1'),shard('echo','s2')],spells:['echo']};
 s=castSpell(s,'echo','s1','eaves');
 assert.match(castError(s,'echo','s2','eaves'),/已经封着一片了/);
 assert.equal(castSpell(s,'echo','s2','eaves'),s);
 const other=castSpell(s,'echo','s2','sill');
 assert.equal(other.casts.length,2);
});

// 四个咒各说各的话，而且说的都是那片碎片【自己的原文】——这儿不生成任何文字
test('走到那儿看见的是碎片原文，不是编出来的句子',()=>{
 for(const [id,spell] of Object.entries(SPELLS)){
  let s={...freshState(),shards:[shard(spell.need,'x')],spells:[id]};
  s=castSpell(s,id,'x','pond');
  const line=castLine(s,'pond');
  assert.ok(line.includes('一段'+spell.need+'。'),id+'：那句话不是碎片原文');
  assert.ok(line.startsWith(SPELL_PLACES.pond),id+'：没说清是哪儿');
 }
 assert.equal(castLine(freshState(),'pond'),'','没封过的地方不该冒出一句话');
});

test('许愿树在林地，不会念咒就先去唤醒种子',()=>{
 assert.match(actionError({...freshState(),map:'garden'},'cast'),/那棵许愿树在林地/);
 assert.match(actionError({...freshState(),map:'forest'},'cast'),/还不会念咒/);
 assert.equal(actionError({...freshState(),map:'forest',spells:['echo']},'cast'),'');
 assert.ok(MAPS.forest.stations.cast,'站位没了，那颗按钮就走不过去');
});

// 她 2026-09-17 那条「拆掉四盏灯那个天花板」：灯从此不是终点，是一处能封咒的地方
import {castPlaceError,hastenError,hastenThing,craftThing,thingReady,magicError} from './world.mjs';
test('灯下要先有灯，路灯下要先修好那盏灯',()=>{
 const s={...freshState(),shards:[shard('echo','s1')],spells:['echo']};
 assert.match(castPlaceError(s,'lamp'),/先做一盏星铃灯/);
 assert.match(castPlaceError(s,'pathlamp'),/公告栏上有人要修它/);
 assert.equal(castPlaceError({...s,magic:{...s.magic,lamps:1}},'lamp'),'');
 assert.equal(castPlaceError({...s,fixtures:{pathLamp:true}},'pathlamp'),'');
 // ⚠️castError 要把这句话透传出去，不然弹层只能说一句「还没有这个地方」
 assert.match(castError(s,'echo','s1','lamp'),/先做一盏星铃灯/);
 // 别的地方不该被连累
 for(const p of ['eaves','sill','pond','well','plot'])assert.equal(castPlaceError(s,p),'',p);
});

// ⚠️四盏灯那句话原来是个死胡同（「已经亮起来了」），现在要指一条路
test('四盏灯之后那句话要指路，不是断头',()=>{
 const s={...freshState(),map:'garden',magic:{...freshState().magic,lamps:4}};
 const line=magicError(s,'lamp');
 assert.match(line,/村里别处/);
 assert.match(line,/公告栏/,'不指向下一条线，那还是个天花板');
});

// 月露原来唯一的用处是代替一壶水浇花，谁都不会特地去炼
test('月露倒进锅里：封着的那一样当天就开',()=>{
 let s=craftThing({...freshState(),day:5,potions:1,shards:[shard('dream','d1')]},'d1','ferment');
 const t=s.things[0];
 assert.equal(thingReady(s,t),false);
 assert.equal(hastenError(s,t.id),'');
 s=hastenThing(s,t.id);
 assert.equal(thingReady(s,s.things[0]),true);
 assert.equal(s.potions,0,'月露没被喝掉＝白给');
 assert.match(hastenError(s,s.things[0].id),/本来就开着/);
 assert.match(hastenError({...s,potions:0,things:[{...t,openDay:99}]},t.id),/没有月露了/);
});
