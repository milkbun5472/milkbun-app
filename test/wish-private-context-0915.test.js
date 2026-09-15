const test=require('node:test'),assert=require('node:assert/strict');
const {app,engine,cut,fixture,wire,evaluate}=require('./_group-background-fixture.cjs');
test('心愿清单所有入口共用最新八条；单人措辞、旁观身份和送礼能力显式区分',()=>{
 const env=wire(fixture());
 // toggleWish 写入的存档形状：uid/name/price/desc/cat/ts，最新在前。
 env.wishRef.current=Array.from({length:10},(_,i)=>({uid:'w_'+i,name:'测试商品'+i,price:i,desc:'',cat:null,ts:10-i}));
 const text=env.wishFor();assert.match(text,/测试商品7/);assert.doesNotMatch(text,/测试商品8/);
 assert.match(env.wishLine(text,'我'),/手头紧、觉得没必要/);
 assert.match(env.wishLine(text,'我',{group:true,spectate:true,gift:true}),/认识她的人都可能知道/);
 assert.match(env.wishLine(text,'我',{group:true,gift:true}),/填 gift/);
 assert.doesNotMatch(env.wishLine(text,'我',{group:true,gift:false}),/填 gift/);
 env.wishRef.current=[];assert.equal(env.wishLine(env.wishFor(),'我',{group:true}),'');
 assert.match(app,/wishLog: !settingsFor\(char.id\).engineerEyes \? wishFor\(\) : ""/);
 assert.match(app,/wishLog: wishFor\(\)/);
 assert.match(engine,/wishLine\(ctx.wishLog, userName, \{ group: true, gift: false \}\)/);
});
test('共用私有背景保持记忆三层；封闭群/零窗口无实时近况，NPC无主线私事',()=>{
 const env=wire(fixture());
 Object.assign(env,{memories:{a:'甲的长期记忆'},settingsFor:()=>({}),formatMemLib:rows=>rows.map(x=>x.text).join('\n'),
 memberPrivLines:(c,n)=>Number(n)>0?'甲的私聊':'',crossRecentFor:(id,opts)=>{assert.deepEqual(opts,{surfaces:['offline']});return '甲的线下';}});
 env.window.Gaze={text:()=> '甲的印象卡'};
 // retrieve/split 的输出保留原条目；knownBy 与 charIds 使用落库真实字段。
 const split={perChar:{a:[{id:'m1',text:'仅甲知道的事件',knownBy:['a'],charIds:['a']}]}};
 for(const opts of [{interop:false,privateCtxN:6},{interop:true,privateCtxN:0}]){
  const text=env.memberPrivateContextFor(env.members[0],split,opts);
  assert.match(text,/甲的长期记忆/);assert.match(text,/甲的印象卡/);assert.match(text,/仅甲知道的事件/);
  assert.doesNotMatch(text,/甲的私聊|甲的线下/);
 }
 const text=env.memberPrivateContextFor(env.members[0],split,{interop:true,privateCtxN:2});
 assert.match(text,/甲的私聊/);assert.match(text,/甲的线下/);
 assert.equal(env.memberPrivateContextFor(env.members[2],split,{interop:true,privateCtxN:2}),'');
});
