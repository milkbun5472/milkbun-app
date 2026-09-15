const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Rooms = require('../js/chat-rooms');
const app = fs.readFileSync('js/app.js', 'utf8');
function declaration(name) {
  const start = app.indexOf('  const ' + name + ' =');
  return app.slice(start, app.indexOf('\n  };', start) + 5);
}
test('侧房上下文读取本房拉黑，主线认知关闭也保留本房事实', () => {
  const key = Rooms.chatKey('a', 'side');
  const room = Rooms.normalize({id:'side', ...Rooms.PRESETS.isolated}, 'a');
  // x_blocks 的真实写入形状来自 setBlockFor / toggleBlock。
  const blocks = {a:{iBlocked:true, blockedTs:Date.now()}, [key]:{theyBlocked:true, reason:'侧房分歧', blockedTs:Date.now()}};
  const box = {window:{ChatRooms:Rooms}, blocksRef:{current:blocks}, chatsRef:{current:{}},
    BLOCK_TOMB_KEEP_MS:30*86400000, roomTimeAwareFor:()=>false};
  vm.createContext(box);
  vm.runInContext(declaration('blockLineFor') + declaration('gateRoomContext') + ';this.gate=gateRoomContext;', box);
  const gate = () => box.gate({blockLine:'主房拉黑', coupleStatus:'主房恋人'}, {id:'a'}, key, room);
  assert.match(gate().blockLine, /侧房分歧/);
  assert.doesNotMatch(gate().blockLine, /她把你拉黑了/);
  assert.equal(gate().coupleStatus, '');
  delete blocks[key];
  assert.equal(gate().blockLine, '');
  blocks[key] = {endedTs:Date.now(), sinceTs:Date.now()-3600000, by:'char', reason:'侧房分歧'};
  assert.match(gate().blockLine, /刚解除拉黑/);
  assert.match(app, /oCtx = gateRoomContext\(oCtx, char, scopeKey, sideRoom\)/);
  assert.match(app, /const gated = gateRoomContext\(ctx, char, chatKey, room\)/);
});
test('群文字、通话和线下共用关系层的组合', () => {
  const start = app.indexOf('  const relationshipLineFor =');
  const source = app.slice(start, app.indexOf('\n', start));
  const box = {blockLineFor:()=> '拉黑', coupleLineFor:()=> '关系', nickLineFor:()=> '称呼', userName:()=> '我', profile:{}};
  vm.createContext(box); vm.runInContext(source+';this.line=relationshipLineFor;', box);
  assert.equal(box.line('a'), '拉黑\n关系\n称呼');
  assert.match(app, /const both = relationshipLineFor\(id\)/);
  assert.match(app, /const l = relationshipLineFor\(c.id\)/);
});
test('单人和群记忆使用同一份三态权限规则', () => {
  const engine = fs.readFileSync('js/engine.js', 'utf8');
  const start = engine.indexOf('function memoryVisibleTo('), end = engine.indexOf('\nfunction retrieveMemories', start);
  const box = {}; vm.createContext(box); vm.runInContext(engine.slice(start,end), box);
  for (const [entry,id,want] of [[{charIds:[]},'a',true],[{charIds:['b']},'a',false],[{charIds:['a'],knownBy:[]},'a',false],[{charIds:['b'],knownBy:['a']},'a',true]]) assert.equal(box.memoryVisibleTo(entry,id),want);
  assert.match(engine, /const canSee = e => memoryVisibleTo\(e, charId\)/);
  assert.match(engine, /const canSee = memoryVisibleTo;/);
});
