const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/components.js'), 'utf8');
test('删除确认 portal 位于设置页之上，取消和确认分别回调', () => {
  const body = {}, calls = [], ctx = { document: { body }, ReactDOM: { createPortal: (node, target) => ({ node, target }) },
    h: (type, props, ...children) => ({ type, props, children }), useTheme: () => ({}), F_BODY: '', F_DISPLAY: '' };
  vm.createContext(ctx);
  const a = src.indexOf('const APP_OVERLAY_LAYERS ='), end = src.indexOf('function ConfirmDialog('), b = src.indexOf('\n}', end) + 2;
  vm.runInContext(src.slice(a, b), ctx);
  const p = ctx.ConfirmDialog({ title: '删除', onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel') });
  assert.equal(p.target, body);
  const settingsZ = Number(src.match(/position: "fixed", inset: 0, zIndex: (\d+) \}, pgSkin/)[1]);
  assert.ok(p.node.props.style.zIndex > settingsZ);
  p.node.props.onClick(); assert.deepEqual(calls, ['cancel']);
  // ⚠️别按下标摸孩子：这张框里会多出纸纹、红印这种装饰层（v67.79 她要「删除框
  //   做好看点」时就多了两层），一多就全错位。按那一行自己的 className 找。
  const row = p.node.children[0].children.find(x => x && x.props && x.props.className === 'flex gap-3');
  const buttons = row.children;
  buttons[1].props.onClick(); assert.deepEqual(calls, ['cancel', 'confirm']);
  let stopped = false; p.node.children[0].props.onClick({ stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
});

test('Toast 独立挂载在反馈层，空消息不挂载且不拦截点击', () => {
  const body = {}, ctx = { document: { body }, ReactDOM: { createPortal: (node, target) => ({ node, target }) },
    h: (type, props, ...children) => ({ type, props, children }), useTheme: () => ({}), F_BODY: '' };
  vm.createContext(ctx);
  vm.runInContext(src.match(/const APP_OVERLAY_LAYERS = .*;/)[0], ctx);
  const a = src.indexOf('function Toast('), b = src.indexOf('\n}\n', a) + 2;
  vm.runInContext(src.slice(a, b), ctx);
  assert.equal(ctx.Toast({ msg: '' }), null);
  const p = ctx.Toast({ msg: '已保存' });
  assert.equal(p.target, body);
  assert.ok(p.node.props.style.zIndex > 1200);
  assert.equal(p.node.props.style.pointerEvents, 'none');
  assert.match(p.node.props.className, /fixed inset-0.*pointer-events-none/);
  assert.equal(p.node.children[0].children[0], '已保存');
});

test('输入和确认共享同一 portal，输入回调和遮罩取消保持独立', () => {
  const calls = [], body = {}, ctx = { document: { body }, ReactDOM: { createPortal: (node, target) => ({ node, target }) },
    h: (type, props, ...children) => ({ type, props, children }), useTheme: () => ({}), F_BODY: '', F_DISPLAY: '',
    useState: v => [v, () => {}], useRef: () => ({ current: null }), useEffect: () => {} };
  vm.createContext(ctx);
  const a = src.indexOf('const APP_OVERLAY_LAYERS ='), end = src.indexOf('function ConfirmDialog('), b = src.indexOf('\n}', end) + 2;
  vm.runInContext(src.slice(a, b), ctx);
  for (const multiline of [false, true]) {
    const p = ctx.PromptDialog({ value: '草稿', multiline, onOk: v => calls.push(v), onCancel: () => calls.push('cancel') });
    assert.equal(p.target, body); assert.ok(p.node.props.style.zIndex > 999);
    const card = p.node.children[0], field = card.children[2];
    assert.equal(field.type, multiline ? 'textarea' : 'input');
    card.children[3].children[1].props.onClick();
    p.node.props.onClick();
  }
  assert.deepEqual(calls, ['草稿', 'cancel', '草稿', 'cancel']);
  // v70.67 起第三位用户：转账那个框（她 2026-09-18：「我让你做框你给我做了个什么东西」）。
  // ⚠️这个数【往上长是对的】——它数的是「有几处共用这一层挂载」，不是「有几个弹窗」。
  //   该红的是有人另写一个居中的盒子，那种情况这个数不会动、下面那条审计才会逮到。
  assert.equal((src.match(/return appDialogPortal\(/g) || []).length, 3);
});
