import test from 'node:test';import assert from 'node:assert/strict';
import {mergeLook,outfitColors,OUTFITS} from './wardrobe.mjs';
import {freshState,restoreState,restoreLook,moveIn} from './world.mjs';
test('outfit changes keep each palette and all body sliders through save and resident restore',()=>{
 let look=mergeLook({cloth:'#abcdef',dims:{height:1.2}},{outfit:'garden'});
 look=mergeLook(look,{outfitColors:{cloth:'#112233',trim:'#aabbcc'},dims:{waist:.9}});
 look=mergeLook(look,{outfit:'academy'});look=mergeLook(look,{outfitColors:{cloth:'#998877'}});
 let s=freshState();s.look=look;s.companion.look=mergeLook({}, {outfit:'ranger',outfitColors:{boots:'#123456'}});s=moveIn(s,{charId:'fixture',name:'试衣邻居',look});s=restoreState(JSON.parse(JSON.stringify(s)));
 assert.equal(outfitColors(s.look).cloth,'#998877');assert.equal(outfitColors(mergeLook(s.look,{outfit:'garden'})).trim,'#aabbcc');assert.equal(outfitColors(mergeLook(s.look,{outfit:'traveler'})).cloth,'#abcdef');assert.deepEqual(s.look.dims,{height:1.2,waist:.9});assert.deepEqual(s.neighbors[0].look,s.look);assert.equal(outfitColors(s.companion.look).boots,'#123456');
});
test('bad imported colors and outfits do not enter the saved wardrobe',()=>{assert.deepEqual(restoreLook({outfit:'unknown',wardrobe:{garden:{cloth:'red',boots:'#aabbcc',unknown:'#112233'},unknown:{cloth:'#abcdef'}}}),{wardrobe:{garden:{boots:'#aabbcc'}}});assert.equal(Object.keys(OUTFITS).length,6);});
