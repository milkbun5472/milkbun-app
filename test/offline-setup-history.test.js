const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/components.js'), 'utf8');
const ctx = { h: (type, props, ...children) => ({ type, props, children }), F_BODY: '', F_DISPLAY: '', ITrash: 'trash' };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('function OfflineSetupHistory('), src.indexOf('function OfflineSetupStyleSection(')), ctx);
function fixture(sessions, extra = {}) {
  const selected = [], deleted = [];
  return { selected, deleted, tree: ctx.OfflineSetupHistory({ sessions, t: {}, fmtStamp: ts => String(ts),
    onSelect: s => selected.push(s), onDelSession: (...args) => deleted.push(args), ...extra }) };
}
test('仅列结束场次，保留原顺序，点击返回原对象与原索引', () => {
  const sessions = [{ id: 'live', startTs: 3, endTs: null, msgs: [] },
    { id: 'same', startTs: 1, endTs: 2, summary: '旧场', msgs: [] },
    { id: 'same', startTs: 4, endTs: 5, msgs: [{ content: '开场' }] }];
  const before = JSON.stringify(sessions), f = fixture(sessions), rows = f.tree.children[1];
  assert.equal(rows.length, 2);
  rows[1].children[0].props.onClick(); rows[1].children[1].props.onClick();
  assert.equal(f.selected[0], sessions[2]);
  assert.deepEqual(f.deleted, [['same', 2]]);
  assert.equal(rows[0].children[0].children[1].children[0], '旧场');
  assert.equal(rows[1].children[0].children[1].children[0], '开场');
  assert.equal(JSON.stringify(sessions), before);
});
test('空记录不占位，缺 ID 仍传正确索引，无删除权限隐藏按钮', () => {
  assert.equal(fixture().tree, null);
  const f = fixture([{ endTs: 1, msgs: [] }]);
  f.tree.children[1][0].children[1].props.onClick();
  assert.deepEqual(f.deleted, [[undefined, 0]]);
  assert.equal(f.tree.children[1][0].children[0].children[1].children[0], '（无总结）');
  assert.equal(fixture([{ endTs: 1, msgs: [] }], { onDelSession: null }).tree.children[1][0].children[1], null);
});
test('两个开局页接公共卡片，选择与删除回调不串会话', () => {
  assert.equal((src.match(/h\(OfflineSetupHistory, \{ sessions, t, fmtStamp, onSelect: setReadView, onDelSession \}\)/g) || []).length, 2);
  const a = fixture([{ id: 'a', endTs: 1, msgs: [] }]), b = fixture([{ id: 'b', endTs: 1, msgs: [] }]);
  a.tree.children[1][0].children[1].props.onClick();
  assert.deepEqual(a.deleted, [['a', 0]]); assert.deepEqual(b.deleted, []);
});
