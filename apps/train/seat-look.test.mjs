import test from 'node:test';import assert from 'node:assert/strict';
import {startTrip,restoreTrip} from './travel.mjs';import {seatLook,lookForTa} from '../fairy-garden/wardrobe.mjs';
test('车上换的样貌重新发车/读档都还在',()=>{const t={...startTrip(null,()=>0),looks:{me:{hair:'bob'},companion:{hair:'korean'}}};const n=startTrip({day:3,minute:5,epoch:'e'},()=>0,t);assert.deepEqual(n.looks,t.looks);assert.deepEqual(restoreTrip(JSON.parse(JSON.stringify(n))).looks,t.looks);assert.equal(startTrip(null,()=>0).looks,undefined);});
test('没存过样貌：她那一侧是她，同行者按他/她',()=>{assert.equal(seatLook('me',null,'他').hair,lookForTa('她').hair);assert.equal(seatLook('companion',null,'他').hair,lookForTa('他').hair);assert.equal(seatLook('companion',{hair:'bob'},'他').hair,'bob');});
test('键盘顶起对话框：盖住多少顶多少，几十像素的安全区不算',async()=>{const {keyboardLift}=await import('./puzzle-view.mjs');assert.equal(keyboardLift(844,500,0),344);assert.equal(keyboardLift(844,800,0),0);});
