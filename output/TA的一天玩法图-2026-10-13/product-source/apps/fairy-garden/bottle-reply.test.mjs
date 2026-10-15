import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,sealBottle,restoreState,driftPick,drawBottle,keepBottleReply,BOTTLE_DAYS} from './world.mjs';
function sample(wanted){for(let i=0;i<100;i++){const s=sealBottle({...freshState(),epoch:'reply-test-'+i},'今天看见了月湖的光。');if(!!s.bottles[0].replyWanted===wanted)return s;}throw Error('Missing outcome');}
test('reply probability is save-stable, both outcomes occur, and earliest delivery is seven game days',()=>{
 for(const wanted of [true,false]){let s=sample(wanted);assert.equal(driftPick(s),null);const same=sealBottle({...freshState(),epoch:s.epoch},s.bottles[0].text);assert.equal(!!same.bottles[0].replyWanted,wanted);s=restoreState({...s,day:1+BOTTLE_DAYS});assert.equal(driftPick(s).kind,wanted?'reply':'mine');assert.deepEqual(driftPick(restoreState(s)),driftPick(s));}
});
test('pending generation cannot consume the catch; stored response survives reload and cannot be overwritten',()=>{
 let s=sample(true),id=s.bottles[0].id;assert.equal(keepBottleReply(s,id,'太早','同行者'),s);s=restoreState({...s,day:1+BOTTLE_DAYS});assert.equal(drawBottle(s),s);assert.equal(keepBottleReply(s,id,'','同行者'),s);
 s=keepBottleReply(s,id,'我也看见了。','测试同行者');assert.equal(keepBottleReply(s,id,'第二次','别人'),s);s=restoreState(s);assert.equal(driftPick(s).text,'我也看见了。');s=drawBottle(s);assert.equal(s.today.bottle,1);assert.equal(s.bottles[0].taken,true);assert.equal(s.drifts[0].original,'今天看见了月湖的光。');assert.equal(s.drifts[0].sender,'测试同行者');assert.deepEqual(restoreState(s).drifts,s.drifts);assert.equal(drawBottle(s),s);
});
test('old bottles keep their original text and no-reply outcomes never need generation',()=>{
 let s=sample(false);s={...s,day:8};assert.equal(drawBottle(s).drifts[0].kind,'mine');let old=sample(true);const {replyWanted,reply,sender,...b}=old.bottles[0];old=restoreState({...old,day:8,bottles:[b]});assert.equal(driftPick(old).kind,'mine');assert.equal(drawBottle(old).drifts[0].text,b.text);
});
