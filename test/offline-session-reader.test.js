const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/components.js'), 'utf8');
const ctx = { h: (type, props, ...children) => ({ type, props, children }), F_BODY: '', F_DISPLAY: '',
  IArrow: 'arrow', ITrash: 'trash', OffCard: 'card', offlineSubSkin: t => t };
vm.createContext(ctx);
vm.runInContext(src.slice(src.indexOf('function OfflineSessionReader('), src.indexOf('function OfflinePastSessions(')), ctx);
function fixture(extra = {}) {
  const session = { id: 'off_1', startTs: 1, endTs: 2, summary: '总结', msgs: [{ id: 'n_1', role: 'narration', content: '场景', ts: 1 }], customNotes: ['旧便签', { id: 'note_1', text: '新便签' }] };
  const calls = [], props = { session, sessions: [{ id: 'other' }, session], t: {}, profile: {},
    fmtStamp: ts => String(ts), onClose: () => calls.push('close'), onDelSession: (...args) => calls.push(args), ...extra };
  return { tree: ctx.OfflineSessionReader(props), calls, props };
}
test('单人群聊共享只读详情，身份和状态入口完整传递', () => {
  assert.equal((src.match(/h\(OfflineSessionReader, /g) || []).length, 2);
  for (const extra of [{ char: { id: 'c' } }, { members: [{ id: 'g' }], showNotes: true, onOpenState: () => {} }]) {
    const f = fixture(extra), card = f.tree.children[1].children[2][0];
    assert.equal(card.props.m, f.props.session.msgs[0]);
    assert.equal(card.props.editable, false);
    assert.equal(card.props.char, extra.char);
    assert.equal(card.props.members, extra.members);
    assert.equal(card.props.onOpenState, extra.onOpenState);
    assert.equal(card.props.meProfile, f.props.profile);
  }
});
test('返回只关闭当前详情，删除先关闭再传原 ID 与原列表索引', () => {
  const f = fixture();
  f.tree.children[0].children[0].props.onClick();
  assert.deepEqual(f.calls, ['close']);
  f.tree.children[0].children[2].props.onClick();
  assert.deepEqual(f.calls, ['close', 'close', ['off_1', 1]]);
  assert.equal(fixture({ onDelSession: null }).tree.children[0].children[2], null);
});
test('便签仅显式启用时展示，正文层级与原滚动样式不变', () => {
  assert.equal(fixture().tree.children[1].children[1], false);
  const tree = fixture({ showNotes: true }).tree, notes = tree.children[1].children[1];
  assert.equal(notes.children[1][0].children[0], '· 旧便签');
  assert.equal(notes.children[1][1].children[0], '· 新便签');
  assert.equal(tree.props.className, 'absolute inset-0 z-20 flex flex-col');
  assert.equal(tree.children[1].props.className, 'flex-1 overflow-y-auto px-5 py-5');
});
