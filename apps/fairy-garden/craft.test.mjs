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

// ── 公告栏（v69.35）：接委托、做完留下后果 ──────────────────────────────
import {QUEST_KINDS,QUEST_TAKEN_MAX,questBoard,questTaken,questPaid,takeError,takeQuest,turnIn,lampOn,lampShelter,restoreQuests} from './world.mjs';
const relic = (id='r1') => ({ id, kind:'relic', text:'一个奇怪零件。', whole:false, depth:3, day:1, pinned:false });

test('板子由存档号＋季节算出来：同一档同一季永远是这三条',()=>{
 const s=freshState();
 const a=questBoard(s),b2=questBoard({...s,day:s.day});
 assert.equal(a.length,3);
 assert.deepEqual(a.map(q=>q.id+q.kind+q.from),b2.map(q=>q.id+q.kind+q.from),'同一季刷出来不一样＝刷新一次换一批');
 // 换一季就是另一批，换一档也是
 assert.notDeepEqual(a.map(q=>q.id),questBoard({...s,day:30}).map(q=>q.id));
 const other=questBoard({...s,epoch:'另一档'});
 assert.ok(a.some((q,i)=>q.kind!==other[i].kind||q.from!==other[i].from),'不同存档刷出一模一样的板子');
 a.forEach(q=>assert.ok(QUEST_KINDS[q.kind],'刷出了名单外的委托'));
});

test('手上最多两件，接过的不再出现在板子上',()=>{
 let s=freshState();
 const board=questBoard(s);
 s=takeQuest(s,board[0].id);
 assert.equal(questTaken(s).length,1);
 assert.match(takeError(s,board[0].id),/已经接过/);
 s=takeQuest(s,board[1].id);
 assert.match(takeError(s,board[2].id),/先做完/);
 assert.equal(takeQuest(s,board[2].id),s,'超了还接得下＝闸是假的');
 assert.equal(questTaken(s).length,QUEST_TAKEN_MAX);
 assert.match(takeError(s,'板子上没有的'),/先做完|没有这一件/);
});

test('交委托要真交出东西，交不出就不许算完',()=>{
 let s={...freshState(),day:30};
 const fix=questBoard(s).find(q=>q.kind==='fix');
 if(!fix)return;                                   // 这一季没刷出修东西就跳过
 s=takeQuest(s,fix.id);
 assert.equal(questPaid(s,questTaken(s)[0]),false,'手上没有遗物也能交＝白拿');
 assert.equal(turnIn(s,fix.id),s);
 s={...s,shards:[relic()]};
 assert.equal(questPaid(s,questTaken(s)[0]),true);
 const done=turnIn(s,fix.id);
 assert.equal(done.shards.length,0,'交了东西却还留在背包里');
 assert.equal(done.deeds,1);
 assert.equal(questTaken(done).length,0);
 // ⚠️后果：修东西那一件会把小路那盏灯修好，而且一直留着
 assert.equal(done.fixtures.pathLamp,true);
 assert.equal(restoreQuests(done.quests).length,1,'做完的那一件也要存得住');
});

test('灯是后果，不是一句谢谢：天黑就亮，雨夜有人来躲',()=>{
 const off={...freshState(),minute:1100};
 assert.equal(lampOn(off),false,'没修就不该亮');
 const on={...off,fixtures:{pathLamp:true}};
 assert.equal(lampOn(on),true);
 assert.equal(lampOn({...on,minute:600}),false,'大白天亮着就不对了');
 // 雨夜才有人站在灯下（天气由存档自己抽，这儿只认「雨或雪」）
 const rainyDay=[1,2,3,4,5,6,7,8,9,10].find(d=>['细雨','细雪'].includes(weather(d,on.epoch)));
 assert.equal(lampShelter({...on,day:rainyDay}),true);
 const dryDay=[1,2,3,4,5,6,7,8,9,10].find(d=>!['细雨','细雪'].includes(weather(d,on.epoch)));
 assert.equal(lampShelter({...on,day:dryDay}),false);
});
