import test from 'node:test';import assert from 'node:assert/strict';
import {restoreState,restoreLook,freshState} from './world.mjs';
// 她 2026-09-16：「样貌退出不保存的」。
// 病根：restoreState / restoreCompanion 是【白名单式建对象】——存档里有 look，
// 可这两处没写这一笔，读回来就被静默丢掉。这一份就是钉住那一笔。
test('样貌要能从存档里读回来，两个人各自一份',()=>{
 const s=restoreState({version:6,look:{hair:'bun',hairColor:'#2b2320',dims:{height:1.2}},
  companion:{look:{hair:'wavy',cloth:'#729786'}}});
 assert.deepEqual(s.look,{hair:'bun',hairColor:'#2b2320',dims:{height:1.2}});
 assert.deepEqual(s.companion.look,{hair:'wavy',cloth:'#729786'});
 // 新存档也要有这两个位置，不然第一次写进去没地方落
 assert.deepEqual(freshState().look,{});
 assert.deepEqual(freshState().companion.look,{});
});
test('存档里的样貌当外来数据看：认不出的一律不要',()=>{
 assert.deepEqual(restoreLook({hair:'DROP TABLE',hairColor:'red',cloth:'#12345',dims:{height:'x'}}),{});
 assert.deepEqual(restoreLook(null),{});
 assert.deepEqual(restoreLook({dims:{height:99}}),{dims:{height:2}},'离谱的值要夹住，别把模型拉爆');
 // 发型名单和六个参数的范围不在这儿重写（那是 doll.json 的事）
 const src=String(restoreLook);
 assert.ok(!/korean|wolf|ponytail/.test(src),'又在这儿抄了一份发型名单');
});
