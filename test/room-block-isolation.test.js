const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const components = fs.readFileSync('js/components.js', 'utf8');
const Rooms = require('../js/chat-rooms');
function fixture(reply) {
  const key = Rooms.chatKey('c1', 'r1');
  const room = Rooms.normalize({id:'r1', ...Rooms.PRESETS.isolated}, 'c1');
  const timers = [], lanes = [], systems = [], saved = {};
  const chatsRef = {current:{c1:[{role:'user',content:'主房私事'}], [key]:[{role:'user',content:'侧房诉说'}]}};
  let blocks = {c1:{iBlocked:true}};
  const box = {window:{ChatRooms:{...Rooms, get:()=>room}}, activeRoomId:'r1', active:{},
    characters:[{id:'c1', name:'虚构甲'}], profile:{name:'测试用户'}, blocksRef:{current:blocks}, chatsRef,
    setBlocks:fn=>{blocks=fn(blocks)}, saveJSON:(k,v)=>{saved[k]=v},
    pChat:(k,fn)=>{chatsRef.current[k]=fn(chatsRef.current[k]||[])},
    toast:()=>{}, laneBusy:()=>false, startLane:k=>lanes.push(k), endLane:k=>lanes.push(k),
    apiFor:()=>({}), ctxFor:()=>({char:{id:'c1',name:'虚构甲'},recentChat:'主房私事',mem:'主房记忆'}),
    roomTimeAwareFor:()=>false, contextAllowsMessage:()=>true, isOocMsg:m=>m.kind==='ooc'||String(m.turnId||'').startsWith('ooc_'), roomStatesRef:{current:{}}, loreForContext:()=>'', directives:{},
    buildBundle:ctx=>JSON.stringify(ctx), extractJSON:JSON.parse,
    callAI:async (api,sys)=>{systems.push(sys);return JSON.stringify(reply)},
    setTimeout:fn=>timers.push(fn), Date};
  vm.createContext(box);
  const start=app.indexOf('  const setBlockFor =');
  const end=app.indexOf('  const clearChat =',start);
  vm.runInContext(app.slice(start,end)+'\nthis.ops={toggleBlock,blockedReaction,respondUnblockFromChar,sendMyUnblockReq};',box);
  return {box,key,timers,lanes,systems,saved,ops:box.ops,flush:async()=>{while(timers.length) await timers.shift()()}};
}
test('侧房拉黑、申请及延迟消息在切房后仍只写原房间', async()=>{
  const f=fixture({mode:'appeal',say:['侧房反应'],reason:'侧房原因'});
  f.ops.toggleBlock('c1',f.key);
  assert.equal(f.saved.x_blocks[f.key].iBlocked,true);
  await f.ops.blockedReaction('c1',f.key);
  f.box.activeRoomId='main';
  await f.flush();
  assert.equal(f.box.chatsRef.current.c1.length,1);
  const rows=f.box.chatsRef.current[f.key];
  const card=rows.find(m=>m.kind==='unblock_req');
  assert.equal(card.reason,'侧房原因');
  f.ops.respondUnblockFromChar('c1',card.cid,true,f.key);
  await f.flush();
  assert.equal(f.saved.x_blocks.c1.iBlocked,true);
  assert.equal(f.saved.x_blocks[f.key],undefined);
  assert.equal(f.box.chatsRef.current.c1.length,1);
  assert.ok(f.lanes.every(k=>k==='c:'+f.key));
  assert.match(f.systems[0],/侧房诉说/);
  assert.doesNotMatch(f.systems[0],/主房私事|主房记忆/);
});
test('用户解除申请的处理结果和回复不改主房状态或消息',async()=>{
  const f=fixture({accept:true,say:['侧房回应']});
  await f.ops.sendMyUnblockReq('c1','侧房申请',f.key);
  await f.flush();
  const card=f.box.chatsRef.current[f.key].find(m=>m.kind==='unblock_req');
  assert.equal(card.status,'accepted');
  assert.equal(card.plea,'侧房申请');
  assert.equal(f.box.chatsRef.current.c1.length,1);
  assert.equal(f.saved.x_blocks.c1.iBlocked,true);
});
test('主房默认键兼容旧存档，UI各入口传房间键并复用40px头像',async()=>{
  const f=fixture({mode:'appeal',reason:'主房原因'});
  await f.ops.blockedReaction('c1'); await f.flush();
  assert.ok(f.box.chatsRef.current.c1.some(m=>m.kind==='unblock_req'));
  assert.equal(f.box.chatsRef.current[f.key].length,1);
  for(const name of ['blockedReaction','sendMyUnblockReq','respondUnblockFromChar','toggleBlock']) {
    assert.ok(app.split('\n').some(line=>line.includes(name+'(activeChar.id')&&line.includes('blockChatKey(activeChar.id)')));
  }
  const row=components.slice(components.indexOf('    if (m.kind === "unblock_req")'),components.indexOf('    if (m.kind === "recalled")'));
  assert.match(row,/items-start gap-2/);
  assert.match(row,/character: character, size: 40, radius: 10/);
  assert.match(row,/dsp.myAvatar && h\(Avatar, \{ character: meAv/);
  const card=components.slice(components.indexOf('function UnblockReqCard('),components.indexOf('// 聊天 +面板的图标'));
  assert.match(card,/maxWidth: "100%"/);
});
