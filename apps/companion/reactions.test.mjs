import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeReactions,weatherActions} from './reactions.mjs';
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
test('深夜五分钟后哈欠与揉眼，保护输入睡眠，半小时内不重复催',()=>{
 const r=makeReactions();r.observe(ctx,0);assert.equal(r.take(299,{hour:0}),null);assert.equal(r.take(301,{hour:0,busy:true}),null);assert.equal(r.take(302,{hour:0}),'yawn');assert.equal(r.take(308,{hour:0}),'rubeyes');assert.equal(r.take(500,{hour:0}),null);assert.equal(r.take(2200,{hour:0,sleeping:true}),null);assert.equal(r.take(2201,{hour:12}),null);
});
test('切角色清掉旧动作并重算深夜起点，过期和后台不重播',()=>{
 const r=makeReactions();r.observe(ctx,0);r.message(1);r.reset(900);r.observe(ctx,901);assert.equal(r.take(901,{hour:1}),null);r.message(903);assert.equal(r.take(904,{hidden:true}),null);assert.equal(r.take(914),null);
});

const weather=(code,extra={},placeId='me',at=Date.now())=>({known:true,placeId,at,expiresAt:at+1800000,weather:{code,t:20,windSpeed:0,isDay:false,...extra}});
test('雨雪雷、当前冷热、风与当地昼夜分别选动作，未知不猜',()=>{
 assert.deepEqual(weatherActions(weather(61)),['catchrain']);assert.deepEqual(weatherActions(weather(73)),['catchsnow']);assert.deepEqual(weatherActions(weather(95)),['thunder','catchrain']);
 assert.deepEqual(weatherActions(weather(0,{isDay:true,t:32,windSpeed:30})),['wipesweat','fan','wind','shade']);
 assert.deepEqual(weatherActions(weather(0,{t:5})),['warmhands']);assert.deepEqual(weatherActions(weather(0,{hi:35,lo:-20})),[]);
 assert.deepEqual(weatherActions(weather(0,{isDay:null,windSpeed:null})),[]);assert.deepEqual(weatherActions({...weather(61),known:false}),[]);assert.deepEqual(weatherActions(weather(61,{},'me',Date.now()-1800001)),[]);
});
test('天气十分钟轮换一次，变天有90秒间隔，聊天输入睡眠拎起和后台先让开',()=>{
 const r=makeReactions();r.observe({...ctx,weather:weather(95)},0);for(const flag of ['busy','held','sleeping','hidden'])assert.equal(r.take(1,{[flag]:true}),null);
 assert.equal(r.take(2),'thunder');assert.equal(r.take(601),null);assert.equal(r.take(602),'catchrain');
 r.observe({...ctx,weather:weather(73)},603);assert.equal(r.take(604),null);assert.equal(r.take(693),'catchsnow');
 r.observe({...ctx,typing:true,weather:weather(73)},700);assert.equal(r.take(701),'peek');assert.equal(r.take(1400),null);
});
test('雨停仅同地点连续新鲜快照，持伞收伞、空手抖水，切站／过期／未知不误演',()=>{
 for(const weatherUmbrella of [false,true]){const r=makeReactions();r.observe({...ctx,weather:weather(61)},0);r.take(1);r.observe({...ctx,weather:weather(0)},5);assert.equal(r.take(6,{weatherUmbrella,busy:weatherUmbrella}),weatherUmbrella?'rainclose':'raindry');assert.equal(r.take(7),null);}
 for(const next of [weather(0,{},'other'),{...weather(0),known:false},weather(0,{},'me',Date.now()-1900000)]){const r=makeReactions();r.observe({...ctx,weather:weather(61)},0);r.take(1);r.observe({...ctx,weather:next},5);assert.equal(r.take(6),null);}
 const r=makeReactions();r.observe({...ctx,weather:weather(61)},0);r.take(1);r.observe({...ctx,weather:{...weather(0),known:false}},5);r.observe({...ctx,weather:weather(0)},6);assert.equal(r.take(7),null);
});
test('排到时再次查天气有效期；雨停久了不补演',()=>{
 const r=makeReactions(),w=weather(61);r.observe({...ctx,weather:w},0);assert.equal(r.take(1,{wallNow:w.expiresAt+1}),null);
 r.observe({...ctx,weather:weather(0)},5);assert.equal(r.take(126),null);
});
