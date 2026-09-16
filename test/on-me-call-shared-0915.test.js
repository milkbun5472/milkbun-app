const test = require('node:test');
const assert = require('node:assert/strict');
const {app,engine,cut,fixture,wire,evaluate} = require('./_group-background-fixture.cjs');
const read = cut(app,'  const onMeFor =','  const ctxFor =');
const format = cut(engine,'function onMeLine(','function buildBundle(');
test('随身物共用读取真实 onMe 标记和写入端额度，库存变化立即生效',()=>{
  // toggleOnMe 的 patchInv(id,{onMe:!it.onMe}) 写入布尔标记，物品本身保留 id/name。
  const env={ON_ME_CAP:Number(app.match(/const ON_ME_CAP = (\d+);/)[1]),inventoryRef:{current:[
    {id:'1',name:'测试发夹',onMe:true},{id:'2',name:'测试手环',onMe:true},
    {id:'3',name:'测试围巾',onMe:true},{id:'4',name:'没带的包',onMe:false}]}};
  const get=evaluate(read,env,'onMeFor');
  assert.equal(get(),'测试发夹、测试手环');
  env.inventoryRef.current[0].onMe=false;
  assert.equal(get(),'测试手环、测试围巾');
  env.inventoryRef.current=[];assert.equal(get(),'');
  // v68.81：群线下那一处加了旁观群的闸（她不在场，就不该有「她今天身上带着」），
  //   所以只剩单聊那一处是光秃秃的 onMeFor()
  assert.equal((app.match(/onMe: onMeFor\(\)/g)||[]).length,1);
  assert.match(app,/onMe: groupSpectating\(group\) \? "" : onMeFor\(\)/);
  assert.match(app,/const _gOnMe = onMeFor\(\)/);
  assert.match(app,/const gOnMeHint = \(_gOnMe && !groupSpectating\(group\)\)/);
  // 判据只许有一份：两路问同一个函数
  assert.equal((app.match(/const groupSpectating = group =>/g)||[]).length,1);
});
for(const modeZh of ['语音通话','视频通话']) test('多人'+modeZh+'发送的 system 使用共用随身物，空库存无空段',async()=>{
  const env=wire(fixture()); let sent='';
  Object.assign(env,{ON_ME_CAP:2,modeZh,uName:'读者',cur:{groupId:'g'},hist:[],rels:{},loreRef:{current:[]},directives:{},
    groupPersonaBudget:()=>6000,directedRelationLines:()=>'',loreText:()=>'',gsFor:()=>({memoryInterop:false,privateCtxN:0}),
    primeQueryVec:async()=>{},memLibRef:{current:[]},splitGroupMemories:()=>({shared:[],perChar:{}}),formatMemLib:()=>'',
    memories:{},settingsFor:()=>({}),memberPrivLines:(c,n)=>Number(n)>0?'私聊_'+c.id:'',crossRecentFor:id=>'线下_'+id,groupContextRows:()=>[],
    PERSONA_EVOLVE_IDS:[],groupGrowthLine:()=>'',groupBans:()=>'',callerIsChar:false,callerName:'',
    PRIVATE_IS_BACKGROUND_NOT_AMMO:'',active:{},callBiHint:'',callAI:async(_api,sys)=>{sent=sys;return '[]';}});
  env.window.Gaze={text:id=>'印象卡_'+id+'_完整末尾'};
  env.onMeLine=evaluate(format,env,'onMeLine');
  const code=cut(app,'        const gCallCap =','        const arr = extractJSON(raw);');
  const send=new Function('env','with(env){return (async()=>{'+code+'})();}');
  env.wishRef.current=[{uid:'w_1',name:'愿望测试书',price:12,desc:'',cat:null,ts:1}];
  env.inventoryRef.current=[{id:'1',name:'只有测试的发夹',onMe:true}];
  await send(env);assert.match(sent,/今天身上带着：只有测试的发夹/);
  assert.equal((sent.match(/今天身上带着：/g)||[]).length,1);
  for(const id of ['a','b']) assert.equal(sent.split('印象卡_'+id+'_完整末尾').length-1,1);
  assert.match(sent,/见了面你看得见它/);
  assert.match(sent,/愿望测试书（¥12）/);assert.doesNotMatch(sent,/填 gift/);
  assert.doesNotMatch(sent,/线下_a|私聊_a/);
  env.gsFor=()=>({memoryInterop:true,privateCtxN:3});
  await send(env);assert.match(sent,/线下_a/);assert.match(sent,/私聊_a/);
  const a=sent.slice(sent.indexOf('『甲』'),sent.indexOf('『乙』'));
  assert.match(a,/线下_a/);assert.doesNotMatch(a,/线下_b/);
  env.gsFor=()=>({memoryInterop:true,privateCtxN:0});
  await send(env);assert.doesNotMatch(sent,/线下_a/);

  env.inventoryRef.current=[];await send(env);assert.doesNotMatch(sent,/今天身上带着：/);
});

test('群文字只发送一次完整印象卡，保留各人的私有围栏和工程师例外',()=>{
  const env=wire(fixture());
  Object.assign(env,{memories:{},gSplit:{perChar:{}},formatMemLib:()=>'',hist:'',
    memberPrivLines:()=>'',crossRecentFor:()=>'',settingsFor:id=>({engineerEyes:id==='b'})});
  env.window.Gaze={text:id=>'唯一卡片_'+id+'_'+ '内容'.repeat(500)+'_末尾守则'};
  const members=evaluate(require('./_group-background-fixture.cjs').sections.online,env,'memberDesc');
  // ⚠️收尾这一句原来是 `privBlob += memLines;`——v69.03 撤掉「查漏后重打一枪」时
  //   privBlob 一起没了（它只喂那一路）。这里改成盯下一句真实存在的代码。
  const privateCode=cut(app,'        const memLines = members.map(c => {','        const groupMem = formatMemLib(gSplit.shared);');
  const privateText=evaluate(privateCode,env,'memLines');
  const sent=members+privateText;
  assert.equal(sent.split('唯一卡片_a_').length-1,1);
  assert.match(sent, /_末尾守则/);
  assert.doesNotMatch(sent,/唯一卡片_b_|唯一卡片_npc_/);
  assert.match(privateText,/只有 甲 本人知道，别的成员并不知情/);
  assert.equal(env.gazeFor('b'),'');assert.equal(env.gazeFor('npc'),'');
});

// 我 2026-09-15 复查那几版时扫到的漏：线上那路挡了旁观群，群线下那路没挡——
// 旁观群里她根本不在场（不是群里的一员，只以旁白推剧情），
// 冒一句「她今天身上带着…」出来，等于凭空把她放进了一场她没去的戏。
test('旁观群两路都不给「她今天身上带着」', () => {
  const pick = app.match(/const groupSpectating = group => [^\n]+/)[0];
  const fn = new Function('gsFor', pick + ';return groupSpectating;');
  const none = fn(() => ({}));
  assert.equal(none({ id: 'g1', roomKind: 'spectate' }), true, 'roomKind 记在群自己身上');
  assert.equal(fn(() => ({ spectate: true }))({ id: 'g1' }), true, 'spectate 记在另一份 groupSettings 里');
  assert.equal(none({ id: 'g1', roomKind: 'group' }), false);
  assert.equal(none(null), false);
  // ⚠️两头都要问：只看其中一头，另一种建群方式立刻漏过去
  assert.match(pick, /roomKind === "spectate" \|\| \(gsFor\(group\.id\) \|\| \{\}\)\.spectate/);
});
