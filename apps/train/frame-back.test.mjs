import test from 'node:test';import assert from 'node:assert/strict';
import {setBackNote} from './album.mjs';import {restoreBack,backOf,backDate} from './puzzle-memory.mjs';
import {freshState,receiveTravelArt,restoreState,updateTravelBack} from '../fairy-garden/world.mjs';
const src='data:image/jpeg;base64,AAAA';
test('背面两句都可以不写，写了只改这一张',()=>{const s={artworks:[{id:'a',src},{id:'b',src}],photos:[]};const t=setBackNote(s,'a','you','一起拼完的');assert.equal(t.artworks[0].back.you,'一起拼完的');assert.equal(t.artworks[1].back,undefined);assert.throws(()=>setBackNote(s,'zz','you','x'));assert.throws(()=>setBackNote(s,'a','nobody','x'));assert.equal(restoreBack({}),null);});
test('日期与旅途天数都进背面',()=>{const b=backOf({at:Date.UTC(2026,8,25,4),day:3,back:{companion:'留着',companionName:'甲'}});assert.equal(b.day,3);assert.equal(b.companion,'留着');assert.match(backDate(b.at),/2026 年 9 月 2[45] 日/);});
test('带回庭院带着背面，之后补写也跟着改，重读不丢',()=>{let g=receiveTravelArt(freshState(),{id:'a',src,at:1,day:2,kind:'puzzle',back:{you:'第一句'}});assert.equal(g.things[0].back.you,'第一句');g=updateTravelBack(g,'a',{at:1,day:2,back:{you:'改了',companion:'TA那句'}});const r=restoreState(JSON.parse(JSON.stringify(g)));assert.equal(r.things[0].back.you,'改了');assert.equal(r.things[0].back.companion,'TA那句');});
