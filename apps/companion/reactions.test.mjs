import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeReactions} from './reactions.mjs';
const ctx={idle:false,typing:false,rain:false,returnSeq:0};
test('初见不迎接，闲置回来只迎一次，保护正在演的动作',()=>{
 const r=makeReactions();r.observe(ctx,0);assert.equal(r.take(1),null);r.observe({...ctx,idle:true},10);r.observe({...ctx,returnSeq:1},20);
 assert.equal(r.take(20,{busy:true}),null);assert.equal(r.take(21),'welcome');r.observe({...ctx,returnSeq:1},22);assert.equal(r.take(22),null);
});
test('探头按输入焦点起势，按键不重播，冷却一分钟，过时不补演',()=>{
 const r=makeReactions();r.observe(ctx,0);r.observe({...ctx,typing:true},2);assert.equal(r.take(2),'peek');r.observe({...ctx,typing:true},3);assert.equal(r.take(3),null);
 r.observe(ctx,4);r.observe({...ctx,typing:true},5);assert.equal(r.take(5),null);r.observe(ctx,65);r.observe({...ctx,typing:true},66);assert.equal(r.take(66,{busy:true}),null);assert.equal(r.take(80),null);
});
test('新消息合并跳动，能叠在聊天动作上，躺趴与拎起时先等',()=>{
 const r=makeReactions();r.observe(ctx,0);r.message(1);r.message(1.1);assert.equal(r.take(2,{held:true}),null);assert.equal(r.take(2,{busy:true,ground:true}),null);assert.equal(r.take(3,{busy:true}),'notice');r.message(4);assert.equal(r.take(4),null);r.message(19);assert.equal(r.take(20),'notice');
});
test('雨伞只认当前雨，十分钟后才再撑，雨停清掉待演的伞',()=>{
 const r=makeReactions();r.observe({...ctx,rain:true},0);assert.equal(r.take(1),'umbrella');assert.equal(r.take(500),null);assert.equal(r.take(602),'umbrella');
 r.observe({...ctx,rain:false},603);assert.equal(r.take(1400),null);
 r.observe({...ctx,rain:true,typing:true},1500);assert.equal(r.take(1501),'peek');r.observe({...ctx,rain:false},1502);assert.equal(r.take(1510),null);
});
test('深夜五分钟后哈欠与揉眼，保护输入睡眠，半小时内不重复催',()=>{
 const r=makeReactions();r.observe(ctx,0);assert.equal(r.take(299,{hour:0}),null);assert.equal(r.take(301,{hour:0,busy:true}),null);assert.equal(r.take(302,{hour:0}),'yawn');assert.equal(r.take(308,{hour:0}),'rubeyes');assert.equal(r.take(500,{hour:0}),null);assert.equal(r.take(2200,{hour:0,sleeping:true}),null);assert.equal(r.take(2201,{hour:12}),null);
});
test('切角色清掉旧动作并重算深夜起点，过期和后台不重播',()=>{
 const r=makeReactions();r.observe(ctx,0);r.message(1);r.reset(900);r.observe(ctx,901);assert.equal(r.take(901,{hour:1}),null);r.message(903);assert.equal(r.take(904,{hidden:true}),null);assert.equal(r.take(914),null);
});
