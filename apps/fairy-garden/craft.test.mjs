import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,SHARD_KINDS,CRAFT_WAYS,SPOTS,craftError,craftThing,placeThing,placedAt,thingReady,bellRings,weather,actionError} from './world.mjs';
// 她 2026-09-17 拍板走 codex 那版：碎片收成四类【看得见的东西】，
// 再加一条【一枪都不打】的链：挖到感官晶 → 炼成雨铃 → 挂屋檐 → 雨天真的响。
const shard = (kind, id='s1') => ({ id, kind, text: '一段雨声。', whole: false, depth: 2, day: 1, pinned: false });

test('碎片只剩四类，而且是【东西】不是抽象名词',()=>{
 assert.deepEqual(Object.keys(SHARD_KINDS),['echo','dream','sense','relic']);
 assert.deepEqual(Object.values(SHARD_KINDS),['回声石','梦屑','感官晶','无名遗物']);
});

test('旧存档那八类各归各家，一片都不丢',()=>{
 const s=restoreState({version:8,shards:[
  {id:'a',kind:'memory',text:'伞'},{id:'b',kind:'link',text:'雨天'},{id:'c',kind:'world',text:'他同事'},
  {id:'d',kind:'unsaid',text:'半句'},{id:'e',kind:'habit',text:'转笔'},{id:'f',kind:'ahead',text:'以后'},
  {id:'g',kind:'dream',text:'车'},{id:'h',kind:'sense',text:'铁锈味'},{id:'i',kind:'瞎写',text:'x'}]});
 assert.deepEqual(s.shards.map(x=>x.id+':'+x.kind),
  ['a:echo','b:echo','c:echo','d:relic','e:relic','f:dream','g:dream','h:sense']);
});

test('锅：材料定大方向，手法定形状，一枪都不打',()=>{
 let s={...freshState(),shards:[shard('sense')]};
 assert.equal(craftError(s,'s1','set'),'');
 s=craftThing(s,'s1','set');
 assert.equal(s.things[0].name,'雨铃');
 assert.equal(s.shards.length,0,'做完了那一片该没了');
 assert.equal(s.things[0].from,'一段雨声。','用的哪一片要记着');
 // 同一片材料换个手法就是另一样东西
 const other=craftThing({...freshState(),shards:[shard('sense')]},'s1','distill');
 assert.equal(other.things[0].name,'一线雨声');
 // 认不出的材料给「怪东西」，不是报错
 const odd=craftThing({...freshState(),shards:[{...shard('relic'),kind:'relic'}]},'s1','ferment');
 assert.ok(odd.things[0].name);
});

test('发酵要等日子，没到不算做好',()=>{
 let s={...freshState(),shards:[shard('dream')]};
 s=craftThing(s,'s1','ferment');
 const t=s.things[0];
 assert.equal(t.openDay,1+CRAFT_WAYS.ferment.days);
 assert.equal(thingReady(s,t),false);
 assert.equal(placeThing(s,t.id,'sill'),s,'还封着就不许摆出去');
 assert.equal(thingReady({...s,day:t.openDay},t),true);
});

test('一个位置只摆一样，摆过的会被换下来',()=>{
 let s={...freshState(),shards:[shard('sense','a'),shard('dream','b')]};
 s=craftThing(s,'a','set');s=craftThing(s,'b','set');
 const [second,first]=s.things;
 s=placeThing(s,first.id,'eaves');
 assert.equal(placedAt(s,'eaves').id,first.id);
 s=placeThing(s,second.id,'eaves');
 assert.equal(placedAt(s,'eaves').id,second.id);
 assert.equal((s.things.find(x=>x.id===first.id)).spot,null,'旧的那样该被换下来');
 assert.equal(placeThing(s,second.id,'不存在的地方'),s);
});

test('雨铃：真下雨、真挂在屋檐下，才响',()=>{
 let s={...freshState(),shards:[shard('sense')]};
 s=craftThing(s,'s1','set');
 assert.equal(bellRings(s),false,'没挂出去就不该响');
 s=placeThing(s,s.things[0].id,'eaves');
 const rainy=[1,2,3,4,5,6,7].find(d=>['细雨','细雪'].includes(weather(d,s.epoch)));
 const dry=[1,2,3,4,5,6,7].find(d=>!['细雨','细雪'].includes(weather(d,s.epoch)));
 assert.equal(bellRings({...s,day:rainy}),true);
 assert.equal(bellRings({...s,day:dry}),false);
 // 摆到别处就不是屋檐下的雨铃了
 assert.equal(bellRings({...placeThing(s,s.things[0].id,'sill'),day:rainy}),false);
});

test('走到锅前要有材料，位置表只有一份',()=>{
 assert.match(actionError(freshState(),'craft'),/没有碎片/);
 assert.equal(actionError({...freshState(),shards:[shard('sense')]},'craft'),'');
 assert.match(actionError({...freshState(),map:'forest',shards:[shard('sense')]},'craft'),/锅在庭院里/);
 assert.deepEqual(Object.keys(SPOTS),['eaves','sill','pond']);
});
