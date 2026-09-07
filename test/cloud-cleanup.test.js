const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../js/cloud.js', 'utf8');

function setup(now) {
  const store = new Map(), timers = new Map(), writes = [];
  let seq = 0, failure = false;
  const ctx = {
    Date: now === undefined ? Date : class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    },
    console: { warn() {}, error() {} },
    document: { addEventListener() {} },
    setTimeout(fn) { const id = ++seq; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    localStorage: {
      getItem: k => store.get(k) || null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    supabase: { createClient: () => ({ from: () => ({
      upsert: async row => { writes.push(row); return { error: failure ? new Error('offline') : null }; }
    }) }) },
  };
  ctx.window = ctx;
  vm.runInNewContext(source, ctx);
  const C = ctx.Cloud;
  C.getUser = async () => ({ id: 'test-user' });
  C.localMeaningful = () => true;
  C.staleness = async () => ({ stale: false });
  C.collectForSave = async () => ({});
  C.ensureVpsSession = async () => ({});
  return { C, timers, writes, ctx, fail: v => { failure = v; } };
}

test('三处备份显示共用状态：未备份、刚成功、近期失败、24 小时边界与恢复', async () => {
  const now = Date.parse('2026-09-07T12:00:00Z');
  const { C, fail } = setup(now);
  let st = C.pushState();
  assert.equal(st.needsAttention, true);
  assert.equal(st.headline, '这台设备还没有成功备份过');
  assert.equal(st.summary, '还没有备份过');
  C.markSynced(new Date(now - 60000).toISOString());
  st = C.pushState();
  assert.equal(st.needsAttention, false);
  assert.match(st.detail, /刚刚/);
  fail(true);
  await C.autoPush();
  st = C.pushState();
  assert.equal(st.needsAttention, true);
  assert.equal(st.headline, '这次备份未成功');
  assert.doesNotMatch(st.headline, /天/);
  assert.match(st.summary, /^⚠️/);
  assert.match(st.why, /拒绝/);
  C.markSynced(new Date(now - 86400000 + 1).toISOString());
  assert.equal(C.pushState().needsAttention, false);
  C.markSynced(new Date(now - 86400000).toISOString());
  assert.equal(C.pushState().headline, '已经 1 天没有成功备份了');
  fail(false);
  await C.autoPush();
  assert.equal(C.pushState().needsAttention, false);
  assert.equal(C.pushState().headline, '最近备份正常');
});

test('实际横幅使用公共标题；未启用/正常状态隐藏，近期失败不误报一天', async () => {
  const components = fs.readFileSync(__dirname + '/../js/components.js', 'utf8');
  const marker = components.indexOf('// ── 备份坏了要看得见');
  const start = components.indexOf('(function () {', marker);
  const end = components.indexOf('  h("div", { className: "flex-1 min-h-0"', start);
  const body = components.slice(start, end).trim().replace(/,$/, '');
  const render = new Function('window', 'h', 'onOpenSettings', 't', 'F_BODY', 'return ' + body);
  const h = (type, props, ...children) => ({ type, props, children });
  const { C, fail } = setup(Date.parse('2026-09-07T12:00:00Z'));
  const click = () => {};
  const draw = cloud => render({ Cloud: cloud }, h, click, { fog: '#999' }, 'sans-serif');
  assert.equal(draw(null), null);
  C.markSynced('2026-09-07T11:59:00Z');
  assert.equal(draw(C), null);
  fail(true);
  await C.autoPush();
  const tree = draw(C);
  assert.equal(tree.props.onClick, click);
  assert.match(tree.props.className, /shrink-0/);
  assert.equal(tree.children[0].children[0], '⚠️ 这次备份未成功');
  assert.equal(draw({ ...C, ready: () => false }), null);
});

test('自动备份失败后重试：失败不盖成功戳，成功清掉旧告警并收掉计时器', async () => {
  const { C, timers, writes, fail } = setup();
  const old = '2026-09-01T12:00:00.000Z';
  C.markSynced(old);
  fail(true);
  await C.autoPush();
  assert.equal(C.lastPushedAt(), old);
  assert.equal(C.pushState().blocked.reason, 'upsert');
  assert.equal(timers.size, 0);
  fail(false);
  await C.autoPush();
  assert.equal(C.lastPushedAt(), writes.at(-1).updated_at);
  assert.equal(C.pushState().blocked, null);
  assert.equal(C.pushState().why, '');
  assert.equal(timers.size, 0);
});

test('启动恢复只在 apply 成功后更新同步状态，失败仍保留旧告警', async () => {
  const { C } = setup();
  const old = '2026-09-01T12:00:00.000Z', restored = '2026-09-07T12:00:00.000Z';
  C.markSynced(old);
  C.pushBlocked = { reason: 'apply_partial' };
  C.pull = async () => ({ data: {}, updated_at: restored });
  C.apply = async () => { throw new Error('quota'); };
  assert.equal((await C.autoPull()).applied, false);
  assert.equal(C.lastPushedAt(), old);
  assert.equal(C.pushState().blocked.reason, 'apply_partial');
  C.apply = async () => {};
  assert.equal((await C.autoPull()).applied, true);
  assert.equal(C.lastPushedAt(), restored);
  assert.equal(C.pushState().blocked, null);
});

test('超时包装对 thenable 成功、拒绝和永久挂起都正确结算并释放计时器', async () => {
  const { ctx, timers } = setup();
  const start = source.indexOf('  const withTimeout =');
  const end = source.indexOf('  const loreNonEmpty', start);
  const wrap = vm.runInNewContext(source.slice(start, end) + '\nwithTimeout;', ctx);
  assert.equal(await wrap({ then: resolve => resolve(42) }, 10), 42);
  assert.equal(timers.size, 0);
  await assert.rejects(wrap(Promise.reject(new Error('network')), 10), /network/);
  assert.equal(timers.size, 0);
  const pending = wrap(new Promise(() => {}), 10);
  const rejected = assert.rejects(pending, /push_timeout/);
  [...timers.values()][0]();
  await rejected;
  assert.equal(timers.size, 0);
});
