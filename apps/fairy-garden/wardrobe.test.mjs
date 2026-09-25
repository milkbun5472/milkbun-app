import test from 'node:test';import assert from 'node:assert/strict';
import {mergeLook,outfitColors,OUTFITS} from './wardrobe.mjs';
import {freshState,restoreState,restoreLook,moveIn} from './world.mjs';
test('outfit changes keep each palette and all body sliders through save and resident restore',()=>{
 // 旧存档（照 mergeLook 当年写出来的样子）：穿着已退役的 garden、另几套也各有配色
 let look={skin:'#f8dfcc',hairColor:'#e6b5ce',cloth:'#abcdef',outfit:'garden',dims:{height:1.2},wardrobe:{garden:{cloth:'#112233',trim:'#aabbcc'}}};
 look=mergeLook(look,{dims:{waist:.9}});look=mergeLook(look,{outfit:'academy'});look=mergeLook(look,{outfitColors:{cloth:'#998877'}});
 let s=freshState();s.look=look;s.companion.look={outfit:'ranger',wardrobe:{ranger:{boots:'#123456'}}};s=moveIn(s,{charId:'fixture',name:'试衣邻居',look});s=restoreState(JSON.parse(JSON.stringify(s)));
 // 旧六套里只有 academy 还在模型里；另外几套的选择和配色照样存着、读档不丢（以后补回同名款式就认回去）
 assert.equal(outfitColors(s.look).cloth,'#998877');assert.equal(s.look.wardrobe.garden.trim,'#aabbcc');assert.equal(s.look.cloth,'#abcdef');
 assert.equal(s.companion.look.outfit,'ranger');assert.equal(s.companion.look.wardrobe.ranger.boots,'#123456');
 assert.deepEqual(s.look.dims,{height:1.2,waist:.9});assert.deepEqual(s.neighbors[0].look,s.look);assert.equal(s.look.skin,'#f8dfcc');assert.equal(s.look.hairColor,'#e6b5ce');
});
test('bad imported colors and outfits do not enter the saved wardrobe',()=>{assert.deepEqual(restoreLook({outfit:'unknown',wardrobe:{garden:{cloth:'red',boots:'#aabbcc',unknown:'#112233'},unknown:{cloth:'#abcdef'}}}),{wardrobe:{garden:{boots:'#aabbcc'}}});assert.deepEqual(Object.keys(OUTFITS),['academy']);});
