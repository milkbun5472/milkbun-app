const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Rooms = require('../js/chat-rooms');
const src = fs.readFileSync('js/app.js','utf8');
const cut = (a,b) => { const start=src.indexOf(a),end=src.indexOf(b,start); assert.ok(start>=0&&end>start); return src.slice(start,end); };
function setup(overrides={}) {
  const room=Rooms.normalize({id:'r1',...Rooms.PRESETS.isolated,scenario:'测试房间设定',...overrides},'c1');
  const key=Rooms.chatKey('c1','r1'), writes=[], requests=[], stateWrites=[], memories=[], thoughts=[];
  const box={window:{ChatRooms:{...Rooms,get:()=>room}},Date,console,loadJSON:(key,fallback)=>fallback,
    profile:{name:'测试用户'},characters:[{id:'c1',name:'测试角色'}],groupAutoCallEpochRef:{current:{}},
    callRef:{current:null}, chatsRef:{current:{c1:[{role:'user',content:'主房私事',ts:1}],[key]:[{role:'user',content:'房内对话',ts:2}]}},
    roomStatesRef:{current:{[key]:{mood:'房内心情'}}}, statesRef:{current:{}}, directives:{c1:[{id:'main_rule',text:'主房准则',ts:1}]},
    ctxFor:(char,opts)=>({char,profile:{name:'测试用户'},recentChat:'主房私事',memory:'主房记忆',moodLabel:'主房心情',timeAware:true}),
    roomTimeAwareFor:()=>false,contextAllowsMessage:()=>true,loreForContext:(scope,ids,text)=>text,
    buildBundle:ctx=>JSON.stringify(ctx), userName:p=>p.name,
    setCall:v=>{box.callRef.current=typeof v==='function'?v(box.callRef.current):v},
    toast:()=>{},laneBusy:()=>false,startLane:()=>{},endLane:()=>{},active:{},apiFor:()=>({}),
    settingsFor:()=>({}), ECHO_QUESTION_BAN:'',REGISTER_FOLLOWS_SCENE:'',
    noteTidalUser:()=>stateWrites.push('tidal'),setStateFor:()=>stateWrites.push('state'),pushStateHist:()=>{},setMoodFor:()=>stateWrites.push('mood'),
    setRoomThought:(...args)=>thoughts.push(args),extractJSON:JSON.parse,bgActiveRef:{current:{}},
    setDirectives:fn=>{box.directives=fn(box.directives)}, saveJSON:()=>{},isOocMsg:m=>m.kind==='ooc'||String(m.turnId||'').startsWith('ooc_'),
    oocAsk:async (api,ctx)=>{requests.push(JSON.stringify(ctx));return {reply:'本房调整',directive:'本房准则'}},
    pChat:(key,fn)=>{writes.push(key);box.chatsRef.current[key]=fn(box.chatsRef.current[key]||[])},
    pGChat:()=>writes.push('group'),gsFor:()=>({memoryInterop:true}),addMemEntry:x=>memories.push(x),
    setTimeout:fn=>{fn();return 1},
    callAI:async (api,sys)=>{requests.push(sys);return JSON.stringify({say:['测试回应'],thought:'房内心声',mood:'房内新心情',wearing:'测试衣服',summary:'房间通话摘要',open:['测试约定']})}
  };
  vm.createContext(box);
  const components = fs.readFileSync('js/components.js', 'utf8');
  const audioPref = components.indexOf('function callAutoVoice(');
  vm.runInContext(components.slice(audioPref, components.indexOf('\n}\n', audioPref) + 3), box);
  const engine = fs.readFileSync('js/engine.js', 'utf8');
  vm.runInContext(engine.slice(engine.indexOf('function splitBilingual('), engine.indexOf('const TRANS_CACHE_KEY')), box);
  vm.runInContext(cut('  const roomHistoryText =','  const blockBundleFor =') +
    cut('  const addDirective =','  // 规矩不该只有') + cut('  const oocReply =','  // v61.80 撤走了 reactToMyRecall') +
    cut('  const markCallBye =','  // 随机坐标（位置 stamp 用）')+
    '\nthis.ops={startCall,callSend,endCall,roomContextFor,oocReply};',box);
  return {box,room,key,writes,requests,stateWrites,memories,thoughts};
}
test('真实流式结束释放通话发送锁：保留已落台词，下一条消息可以继续发送', async () => {
  const { streamFixture, delta } = require('./_call-stream-fixture');
  const f = setup(); let busy = false, calls = 0;
  f.box.laneBusy = () => busy;
  f.box.startLane = () => { busy = true; };
  f.box.endLane = () => { busy = false; };
  f.box.callAI = async (api, sys, hist, opts) => {
    calls++;
    const stream = streamFixture([delta(JSON.stringify({ say: ['已经说完'] })), 'data: [DONE]\n\n']);
    const d = await stream.request(opts);
    return d.choices[0].message.content;
  };
  f.box.ops.startCall(f.box.characters, 'voice', null, 'me', f.key);
  await f.box.ops.callSend('第一句');
  assert.equal(busy, false);
  await f.box.ops.callSend('第二句');
  assert.equal(busy, false); assert.equal(calls, 2);
  assert.deepEqual(Array.from(f.box.callRef.current.msgs, m => m.content), ['第一句', '已经说完', '第二句', '已经说完']);
});
test('双语语音流式和视频全文实际落泡、对账、归档均保留译文且不朗读中文',async()=>{
  for (const mode of ['voice','video']) {
    const f=setup(), spoken=[];
    f.box.settingsFor=()=>({bilingual:true});
    f.box.characters[0].voiceId='voice-test';
    f.box.ttsSpeak=async text=>{spoken.push(text)};
    f.box.callAI=async (api,sys,hist,opts)=>{
      assert.match(sys,/通话字幕格式/);
      const raw=JSON.stringify({say:['Hello | 你好','Good evening | 晚上好'],action:'微笑'});
      if(opts.onDelta) for(const ch of raw) opts.onDelta(ch);
      return raw;
    };
    f.box.ops.startCall(f.box.characters,mode,null,'me',f.key);
    await f.box.ops.callSend('你好');
    const lines=f.box.callRef.current.msgs.filter(m=>m.role==='char'&&!m.act);
    assert.equal(lines.length,2);
    assert.deepEqual(Array.from(lines,m=>[m.content,m.zh]),[['Hello','你好'],['Good evening','晚上好']]);
    assert.ok(spoken.every(text=>!/[你好晚上]/.test(text)));
    f.box.callAI=async()=>JSON.stringify({summary:'摘要'});
    f.box.ops.endCall(30);
    const log=f.box.chatsRef.current[f.key].find(m=>m.kind==='callend').log;
    assert.equal(log.find(m=>m.content==='Hello').zh,'你好');
  }
});
test('无伪造编号函数：主房、侧房和群聊均能启动语音视频，连续拨号分开会话',()=>{
  const f=setup(), ids=new Set();
  assert.equal('uid' in f.box,false);
  for(const mode of ['voice','video']) for(const lane of ['main','side','group']) {
    f.box.ops.startCall(f.box.characters,mode,lane==='group'?'g1':null,'me',lane==='side'?f.key:'c1');
    const call=f.box.callRef.current;
    assert.equal(call.mode,mode);assert.match(call.sessionId,/^call_\w+_\w+$/);
    assert.equal(call.chatKey,lane==='group'?null:lane==='side'?f.key:'c1');
    assert.equal(call.room ? call.room.id : null,lane==='side'?'r1':null);
    ids.add(call.sessionId);
  }
  assert.equal(ids.size,6);
});
test('语音/视频都保留房间：实跑通话上下文、状态、挂断摘要与记忆闸',async()=>{
  for(const mode of ['voice','video']){
    const f=setup(); f.box.ops.startCall(f.box.characters,mode,null,'me',f.key);
    await f.box.ops.callSend('房内通话内容');
    assert.equal(f.box.callRef.current.chatKey,f.key);
    assert.match(f.requests[0],/测试房间设定/);
    assert.match(f.requests[0],/房内对话|房内通话内容/);
    assert.doesNotMatch(f.requests[0],/主房私事|主房记忆|主房心情/);
    assert.equal(f.thoughts[0][0],f.key);
    assert.equal(f.stateWrites.length,0);
    // callSend 的写入形状：role=user / role=char / content / ts。
    f.box.callRef.current.msgs.push({role:'user',content:'另一句',ts:3});
    f.box.ops.endCall(30);
    await new Promise(resolve=>setImmediate(resolve));
    assert.ok(f.writes.length>=2);
    assert.ok(f.writes.every(k=>k===f.key));
    assert.equal(f.memories.length,0);
    assert.equal(f.box.chatsRef.current.c1.length,1);
  }
});
test('房间允许状态/记忆写回时保留混搭，心声仍只在本房',async()=>{
  const f=setup({cognition:{...Rooms.PRESETS.isolated.cognition,innerLife:true},writeback:{sharedState:true,stateMood:true,memoryCandidate:true}});
  f.box.ops.startCall(f.box.characters,'video',null,'me',f.key);
  await f.box.ops.callSend('测试');
  assert.deepEqual(f.stateWrites,['state','mood']);
  f.box.callRef.current.msgs.push({role:'user',content:'补一句',ts:3});
  f.box.ops.endCall(30); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.memories.length,2);
  assert.equal(f.thoughts[0][0],f.key);
});
test('旧通话晚到结果不能写入新通话，主房默认键保持兼容',async()=>{
  const f=setup(); let finish;
  f.box.callAI=()=>new Promise(resolve=>{finish=resolve});
  f.box.ops.startCall(f.box.characters,'voice',null,'me',f.key);
  const pending=f.box.ops.callSend('旧通话');
  f.box.ops.startCall(f.box.characters,'video',null,'me');
  finish(JSON.stringify({say:['迟到消息'],thought:'迟到心声',hangup:'旧通话挂断'}));
  await pending;
  assert.equal(f.box.callRef.current.chatKey,'c1');
  assert.equal(f.box.callRef.current.msgs.length,0);
  assert.equal(f.box.callRef.current.bye,undefined);
  assert.equal(f.thoughts.length,0);
});
test('能力提示与执行同一张表；学习游戏与本房通话不被一刀切',()=>{
  const f=setup();
  for(const field of ['whisper','carve','toGroup','memo','ledger','transfer','transferAccept']) {
    assert.equal(Rooms.allowsField(f.room,field),false);
    assert.equal(Rooms.allowsField(null,field),true);
  }
  for(const field of ['call','photo','location','studyInvite','gameInvite']) assert.equal(Rooms.allowsField(f.room,field),true);
  assert.match(src,/if \(!window\.ChatRooms\.allowsField\(room, openCaps\[i\]\)\) openCaps\.splice\(i, 1\)/);
  assert.match(src,/Object\.keys\(parsed\)\.forEach\(field => \{ if \(!window\.ChatRooms\.allowsField\(room, field\)\) parsed\[field\] = null/);
  assert.match(src,/startCall\(\[r\.char\], r\.m\.mode, null, r\.char\.id, r\.cid\)/);
});
test('房间OOC对话与新增准则只落本房，下次上下文能读回',async()=>{
  const f=setup();
  await f.box.ops.oocReply('c1','请调整本房说法',f.key);
  assert.ok(f.writes.every(k=>k===f.key));
  assert.equal(f.box.directives.c1.length,1);
  assert.equal(f.box.directives[f.key][0].text,'本房准则');
  const next=f.box.ops.roomContextFor(f.box.characters[0],f.key,f.room);
  assert.equal(next.directives[0].text,'本房准则');
  assert.doesNotMatch(next.recentChat,/请调整本房说法/);
  assert.doesNotMatch(next.recentChat,/本房调整/);
  assert.match(f.requests[0],/测试房间设定/);
  assert.doesNotMatch(f.requests[0],/主房私事|主房记忆/);
});
test('房间状态写入方保存动作穿着与心情，空心声不丢本地状态',()=>{
  const key=Rooms.chatKey('c1','r1'), saved={};
  const box={window:{ChatRooms:Rooms},Date,roomStatesRef:{current:{}},roomStateHistRef:{current:{}},
    setRoomStates:()=>{},setRoomStateHist:()=>{},saveJSON:(k,v)=>{saved[k]=JSON.parse(JSON.stringify(v))}};
  vm.createContext(box);
  const start=src.indexOf('  const setRoomThought ='),end=src.indexOf('\n  };',start)+5;
  vm.runInContext(src.slice(start,end)+'\nthis.write=setRoomThought;',box);
  box.write(key,'本房心声',{mood:'安静',state:{wearing:'外套',action:'看书',unknown:'不该保存'},turnId:'t1'});
  assert.equal(saved.x_roomStates[key].wearing,'外套');
  assert.equal(saved.x_roomStates[key].unknown,undefined);
  box.write(key,null,{mood:'开心',state:{action:'放下书'},turnId:'t2'});
  assert.equal(saved.x_roomStates[key].thought,null);
  assert.equal(saved.x_roomStates[key].wearing,'外套');
  assert.equal(saved.x_roomStates[key].action,'放下书');
  assert.equal(saved.x_roomStates[key].mood,'开心');
  assert.equal(saved.x_states,undefined);
  assert.equal(saved.x_roomStates.c1,undefined);
});
