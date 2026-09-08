const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../js/components.js'), 'utf8');
const ctx = { h: (type, props, ...children) => ({ type, props, children }), F_BODY: '', F_DISPLAY: '' };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('function OfflinePastSessions('), src.indexOf('function OfflinePhotoPicker(')), ctx);
const render = (sessions, onSelect = () => {}) => ctx.OfflinePastSessions({ sessions, t: {}, onSelect });
test('桩字段对应单人和群聊写入方，列表两处接公共实现', () => {
  const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  for (const prefix of ['off_', 'goff_']) assert.ok(app.includes('id: "' + prefix + '" + Date.now(),\n      startTs: Date.now(),\n      endTs: null,'));
  for (const writer of ['pOffline(scopeKey', 'pGOffline(groupId']) assert.ok(app.includes(writer + ', list => list.map(s => s.id === sess.id ? { ...s, endTs: Date.now(), summary } : s))'));
  assert.equal((src.match(/h\(OfflinePastSessions, /g) || []).length, 2);
});
test('只列结束场次，按开始时间倒序且不改变原记录与数组', () => {
  const sessions = [{ id: 'old', startTs: 1, endTs: 2, msgs: [] }, { id: 'live', startTs: 9, endTs: null }, { id: 'new', startTs: 3, endTs: 4, summary: '一段\n总结' }];
  const before = JSON.stringify(sessions), chosen = [];
  const tree = render(sessions, s => chosen.push(s)), rows = tree.children[0];
  assert.deepEqual(Array.from(rows, row => row.props.key), ['new', 'old']);
  rows[0].props.onClick(); assert.equal(chosen[0], sessions[2]);
  assert.equal(JSON.stringify(sessions), before);
  assert.equal(rows[0].children[1].children[0], '一段 总结');
  assert.equal(tree.props.style.maxHeight, '52vh');
  assert.equal(tree.props.style.overflowY, 'auto');
});
test('空列表、段数与空摘要回退，选择回调不串会话', () => {
  assert.equal(render(undefined).children[0].children[0], '还没有已结束的线下记录。');
  assert.equal(render([{ endTs: 1, msgs: [{}, {}] }]).children[0][0].children[1].children[0], '2 段');
  assert.equal(render([{ endTs: 1 }]).children[0][0].children[1].children[0], '点开回看');
  let a = 0, b = 0;
  const one = render([{ endTs: 1 }], () => a++);
  render([{ endTs: 1 }], () => b++);
  one.children[0][0].props.onClick(); assert.equal(a, 1); assert.equal(b, 0);
});
