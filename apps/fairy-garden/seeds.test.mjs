import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,restoreState,sowSeed,seedError,readySeeds,keepNotes,pinNote,actionError,perform,SEED_KINDS,SEED_DAYS,SEED_PLOTS,SEED_PER_DAY} from './world.mjs';
// 花田（她 2026-09-16：「种花那条先做吧」）：种下一句话，三天后收一张花笺。
// ⚠️「一次全收」是这条设计的钱闸：开几朵都只打一枪，钉在这儿别被拆。
test('种下一句，三天后才开',()=>{
 let s=freshState();
 s=sowSeed(s,'miss','你有没有哪一刻突然特别想我');
 assert.equal(s.seeds.length,1);
 assert.equal(readySeeds(s).length,0,'当天就能收＝没有等待，这条就没意思了');
 assert.equal(readySeeds({...s,day:1+SEED_DAYS-1}).length,0);
 assert.equal(readySeeds({...s,day:1+SEED_DAYS}).length,1);
 assert.equal(sowSeed(s,'不存在的念头','x'),s,'念头表以外的一律不收');
});
test('一天种得下几株、地里能站几株，都有上限',()=>{
 let s=freshState();
 for(let i=0;i<SEED_PER_DAY;i++)s=sowSeed(s,'today','');
 assert.match(seedError(s),/明天再来/);
 assert.equal(sowSeed(s,'today','').seeds.length,SEED_PER_DAY,'超了还种得下去＝闸是假的');
 // 换一天接着种，直到地里站满
 let day=1;
 while(s.seeds.length<SEED_PLOTS){day++;s={...s,day};s=sowSeed(s,'today','');}
 s={...s,day:day+1};
 assert.match(seedError(s),/地里满了/);
});
test('收花笺：只收开好的那几株，收过的不再收',()=>{
 let s=freshState();
 s=sowSeed(s,'miss','甲');s={...s,day:2};s=sowSeed(s,'later','乙');
 s={...s,day:1+SEED_DAYS};                      // 甲开了，乙还没
 const ready=readySeeds(s);
 assert.equal(ready.length,1);
 s=keepNotes(s,[{id:ready[0].id,reply:'昨天下楼买水的时候。'},{id:'不是这一株',reply:'混进来的'}]);
 assert.equal(s.notes.length,1,'不属于这一批的不许写进花册');
 assert.equal(s.notes[0].ask,'甲');
 assert.equal(readySeeds(s).length,0,'收过的还在地里＝会被重复收');
 assert.equal(keepNotes(s,[{id:ready[0].id,reply:'再来一次'}]).notes.length,1);
});
test('花笺能钉住，也能从存档读回来',()=>{
 let s=freshState();s=sowSeed(s,'secret','丙');s={...s,day:1+SEED_DAYS};
 s=keepNotes(s,readySeeds(s).map(x=>({id:x.id,reply:'  有一件事我一直没说。  '})));
 assert.equal(s.notes[0].reply,'有一件事我一直没说。','两头的空白要擦掉');
 const id=s.notes[0].id;
 s=pinNote(s,id);assert.equal(s.notes[0].pinned,true);
 const back=restoreState({version:7,...s});
 assert.equal(back.notes.length,1);
 assert.equal(back.notes[0].pinned,true,'钉住的读回来就松了');
 assert.equal(back.seeds.length,1);
 // 存档里的东西当外来数据看
 assert.deepEqual(restoreState({version:7,notes:[{id:'x'},null,{id:'y',reply:'好'}],seeds:[{id:'z',kind:'瞎写'}]}).notes.map(n=>n.id),['y']);
 assert.equal(restoreState({version:7,seeds:[{id:'z',kind:'瞎写'}]}).seeds.length,0);
});
test('走到花圃才收得到，地里没开就别走这一趟',()=>{
 let s=freshState();
 assert.match(actionError(s,'note'),/还没有开好的花/);
 s=sowSeed(s,'miss','甲');s={...s,day:1+SEED_DAYS};
 assert.equal(actionError(s,'note'),'');
 assert.match(actionError({...s,map:'forest'},'note'),/花圃在庭院里/);
 // ⚠️收花笺那一支不走 perform：那一枪在宿主那侧打（见 game.mjs 的注释）
 assert.equal(perform(s,'note'),s);
});
test('念头表就这八个，别在别处另抄一份',()=>{
 assert.deepEqual(Object.keys(SEED_KINDS),['miss','curious','sulk','secret','today','later','what_if','unsaid']);
});
