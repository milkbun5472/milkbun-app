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
test('bad imported colors and outfits do not enter the saved wardrobe',()=>{assert.deepEqual(restoreLook({outfit:'unknown',wardrobe:{garden:{cloth:'red',boots:'#aabbcc',unknown:'#112233'},unknown:{cloth:'#abcdef'}}}),{wardrobe:{garden:{boots:'#aabbcc'}}});assert.deepEqual(Object.keys(OUTFITS),['academy','garden','ranger','cardigan','jacket','suit','tee']);});
test('hair gradient / split / streak survive save and default to plain colour',async()=>{
 const {dyesOf,HAIR_MODES}=await import('./wardrobe.mjs');
 assert.deepEqual(HAIR_MODES.map(m=>m[0]),['solid','gradient','split','streak']);
 // 照 setLook→mergeLook 写进存档的样子
 const look=mergeLook({hairColor:'#4a3629'},{hairMode:'gradient',hairColor2:'#e6b5ce'});
 assert.deepEqual(restoreLook(JSON.parse(JSON.stringify(look))),{hairColor:'#4a3629',hairColor2:'#e6b5ce',hairMode:'gradient'});
 assert.deepEqual(restoreLook({hairMode:'rainbow',hairColor2:'pink'}),{});
 const d=dyesOf({hairColor:'#112233'},{skin:'#f2cbb4'});assert.equal(d.hairMode,'solid');assert.equal(d.hairColor2,'#112233');
});
test('异瞳沿真实外貌写入/读档保留，关开不丢两眼颜色，旧存档仍同色',async()=>{
 const {eyesOf,dyesOf,DEFAULT_EYE}=await import('./wardrobe.mjs');
 assert.deepEqual(eyesOf({}),{eye:DEFAULT_EYE,eyeMode:'solid',eyeLeft:DEFAULT_EYE,eyeRight:DEFAULT_EYE});
 const old={eye:'#3f6fa8',skin:'#dfb093',outfit:'ranger',hair:'bob'};
 assert.equal(eyesOf(old).eyeMode,'solid');assert.equal(eyesOf(old).eyeLeft,old.eye);
 let look=mergeLook(old,{eyeMode:'split'});look=mergeLook(look,{eyeLeft:'#4e8a62'});look=mergeLook(look,{eyeRight:'#8a5bb0'});
 const s=freshState();s.look=look;s.companion.look=look;const saved=restoreState(JSON.parse(JSON.stringify(moveIn(s,{charId:'eyes-fixture',name:'异瞳邻居',look}))));
 for(const result of [saved.look,saved.companion.look,saved.neighbors[0].look])assert.deepEqual(result,look);
 const off=restoreLook(mergeLook(look,{eyeMode:'solid',outfit:'academy'}));assert.equal(eyesOf(off).eye,old.eye);assert.equal(eyesOf(off).eyeLeft,'#4e8a62');
 const back=mergeLook(off,{eyeMode:'split'});assert.equal(dyesOf(back).eyeRight,'#8a5bb0');assert.equal(back.skin,old.skin);
});
test('单眼缺色沿同色底色，非法颜色/模式不会进入外貌存档',async()=>{
 const {eyesOf}=await import('./wardrobe.mjs');
 assert.deepEqual(restoreLook({eyeMode:'bad',eyeLeft:'red',eyeRight:'#xx00aa'}),{});
 assert.deepEqual(eyesOf({eye:'#ABCDEF',eyeMode:'split',eyeLeft:'red'}),{eye:'#ABCDEF',eyeMode:'split',eyeLeft:'#ABCDEF',eyeRight:'#ABCDEF'});
 assert.equal(eyesOf({eye:'bad',eyeMode:'split',eyeRight:'#112233'}).eyeLeft,'#5d4435');
});
