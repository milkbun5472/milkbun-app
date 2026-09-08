const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/components.js'), 'utf8');
test('删除确认 portal 位于设置页之上，取消和确认分别回调', () => {
  const body = {}, calls = [], ctx = { document: { body }, ReactDOM: { createPortal: (node, target) => ({ node, target }) },
    h: (type, props, ...children) => ({ type, props, children }), useTheme: () => ({}), F_BODY: '', F_DISPLAY: '' };
  vm.createContext(ctx);
  const a = src.indexOf('function ConfirmDialog('), b = src.indexOf('\n}', a) + 2;
  vm.runInContext(src.slice(a, b), ctx);
  const p = ctx.ConfirmDialog({ title: '删除', onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel') });
  assert.equal(p.target, body);
  const settingsZ = Number(src.match(/position: "fixed", inset: 0, zIndex: (\d+) \}, pgSkin/)[1]);
  assert.ok(p.node.props.style.zIndex > settingsZ);
  p.node.props.onClick(); assert.deepEqual(calls, ['cancel']);
  const buttons = p.node.children[0].children[2].children;
  buttons[1].props.onClick(); assert.deepEqual(calls, ['cancel', 'confirm']);
  let stopped = false; p.node.children[0].props.onClick({ stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
});
