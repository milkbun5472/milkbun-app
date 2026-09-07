const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/../js/cloud.js', 'utf8');

function setup() {
  const store = new Map(), timers = new Map(), writes = [];
  let seq = 0, failure = false;
  const ctx = {
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
