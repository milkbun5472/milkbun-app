// 她 2026-09-16：「好宝宝加一个重新总结的按钮」
// 收尾那一枪失败过的场次，逐字记录一直是全的，缺的只有记忆库那三样和卡片正文——
// 拿存着的 msgs 再打一枪就能补回来，不用重聊。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const comp = fs.readFileSync(path.join(__dirname, '../js/components.js'), 'utf8');

const pick = app.slice(app.indexOf('  const offlineLogSessionFor = (list, log) => {'), app.indexOf('  const resummarizeOffline = async'));
const offlineLogSessionFor = new Function(pick + ';return offlineLogSessionFor;')();

test('认场次先认 ofs，认不到才按结束时间就近认', () => {
  const list = [
    { id: 's1', endTs: 1000 },
    { id: 's2', endTs: 1000 + 3 * 60000 },
    { id: 's3' } // 还没结束的那场不许认
  ];
  assert.equal(offlineLogSessionFor(list, { ofs: 's2', ts: 1000 }).id, 's2', 'ofs 在就只认 ofs');
  assert.equal(offlineLogSessionFor(list, { ts: 1000 + 3 * 60000 }).id, 's2', '没 ofs 按时间就近');
  assert.equal(offlineLogSessionFor(list, { ofs: 's3', ts: 1000 }), null, '没结束的场次不认');
});

test('隔得太远宁可不认——认错场次会把别人的经过写成这一场的总结', () => {
  const list = [{ id: 's1', endTs: 1000 }];
  assert.equal(offlineLogSessionFor(list, { ts: 1000 + 11 * 60000 }), null);
  assert.equal(offlineLogSessionFor(list, { ts: 0 }), null, '连时间都没有就不猜');
  assert.equal(offlineLogSessionFor([], { ts: 1000 }), null);
  assert.equal(offlineLogSessionFor(null, { ts: 1000 }), null);
});

test('两条经过卡都记 ofs，补总结才找得回是哪一场', () => {
  assert.equal((app.match(/kind: "offlinelog"[^\n]*ofs: sess\.id/g) || []).length, 2);
});

test('补总结走的是和收尾同一套规矩', () => {
  const fn = app.slice(app.indexOf('  const resummarizeOffline = async'), app.indexOf('\n  const goHome'));
  // 不互通的群，补总结一样不许把记忆写进全局库（和 endOffline 同一条闸）
  assert.match(fn, /const interopOn = gsFor\(ownerId\)\.memoryInterop;/);
  assert.match(fn, /if \(interopOn\) \{/);
  // 这一场已经记过的那几条照旧发回去，别把同一件事再记一遍
  assert.equal((fn.match(/offlineRecordedOf\(sess\.id\)/g) || []).length, 2);
  // 失败说真话，不吞
  assert.match(fn, /toast\(err \? "还是没成：" \+ err/);
  // 补出来的总结要回写进那张卡，否则她看到的还是「你们刚在线下见了一面」
  assert.equal((fn.match(/i === msgIndex \? \{ \.\.\.m, content: summary/g) || []).length, 2);
});

test('单聊和群聊两处都挂得上这个按钮', () => {
  assert.equal((comp.match(/onResummarize: onResummarizeOffline \? \(\) => onResummarizeOffline\(i\) : null/g) || []).length, 2);
  assert.match(comp, /onResummarize \? h\("button", \{ onClick: redo/);
  assert.equal((app.match(/onResummarizeOffline: i => resummarizeOffline\("(char|group)"/g) || []).length, 2);
  // 单聊那一处要按【当前房间】的 key 取消息，不能一律用角色 id（侧房会取错数组）
  assert.match(app, /resummarizeOffline\("char", activeChar\.id, window\.ChatRooms \? window\.ChatRooms\.chatKey\(activeChar\.id, activeRoomId\)/);
});
