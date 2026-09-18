import test from 'node:test';import assert from 'node:assert/strict';
import {bottleHistory} from '../../test/fixtures/fairy-bottle-history.mjs';
import {freshState,sealBottle,sealError,restoreState,bottleBook,BOTTLE_CAP,BOTTLE_DAYS,DRIFT_PAGE_SIZE} from './world.mjs';
test('more than sixty completed bottles still allow writing; all letters survive restore and pagination',()=>{
 const s=bottleHistory();assert.equal(s.bottles.length,145);assert.equal(s.drifts.length,145);assert.ok(JSON.stringify(s).length>100000);
 assert.equal(sealError({...s,day:s.day+1},'继续写'),'');
 const back=restoreState(sealBottle({...s,day:s.day+1},'继续写'));assert.equal(back.bottles.length,146);assert.equal(back.drifts.length,145);
 const pages=[];for(let page=0;page<bottleBook(back).pages;page++)pages.push(...bottleBook(back,{page}).drifts);
 assert.deepEqual(pages,s.drifts);assert.equal(bottleBook(back).drifts.length,DRIFT_PAGE_SIZE);assert.equal(bottleBook(back,{query:'原句编号000'}).matches,1);
});
test('filter searches reply, original and sender, clamps page after narrowing, and never mutates history',()=>{
 const s=bottleHistory(85),reply=s.drifts.find(d=>d.kind==='reply'),before=JSON.stringify(s);
 const filtered=bottleBook(s,{repliesOnly:true});assert.ok(filtered.matches>0&&filtered.matches<85);assert.ok(filtered.drifts.every(d=>d.kind==='reply'));
 for(const query of [reply.original,reply.sender,reply.text.slice(0,7)])assert.ok(bottleBook(s,{query}).matches>0);
 assert.equal(bottleBook(s,{query:reply.sender,page:999}).page,0);assert.equal(bottleBook(s,{query:'找不到的字'}).matches,0);assert.equal(bottleBook(s,{page:-10}).page,0);assert.equal(JSON.stringify(s),before);
});
test('capacity counts only uncollected bottles; due bottles remain visible without exposing their outcome',()=>{
 let s=freshState();for(let i=0;i<BOTTLE_CAP;i++)s=sealBottle({...s,day:i+1},'未捞'+i);
 assert.match(sealError({...s,day:100},'再写'),/六十只/);
 const view=bottleBook({...s,day:s.day+BOTTLE_DAYS});assert.equal(view.waiting.length,BOTTLE_CAP);assert.equal(view.ready,BOTTLE_CAP);assert.ok(view.waiting.every(b=>b.backIn===0&&!('replyWanted' in b)));
 const restored=restoreState(s);assert.equal(restored.bottles.length,BOTTLE_CAP);
});
