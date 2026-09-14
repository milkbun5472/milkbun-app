const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');
const app = read('app.js');
const K = require('../js/phone.js');

test('刷新复用历史哨兵，双退真正回到站外且保留原历史字段', () => {
  const entries = [{ url: 'outside', state: null }, { url: 'app', state: { route: 'fixture' } }];
  let index = 1;
  const handlers = {};
  const window = { history: {
    get state() { return entries[index].state; },
    pushState(state) { entries.splice(index + 1); entries.push({ url: 'app', state }); index++; },
    back() { if (index) { index--; if (handlers.popstate) handlers.popstate(); } }
  }, addEventListener(k, f) { handlers[k] = f; }, removeEventListener(k) { delete handlers[k]; } };
  for (let n = 0; n < 4; n++) {
    delete handlers.popstate;
    vm.runInNewContext(read('back-guard.js'), { window, Date });
    window.BackGuard.arm({});
  }
  assert.equal(entries.length, 3);
  assert.equal(window.history.state.route, 'fixture');
  window.history.back(); window.history.back();
  assert.equal(entries[index].url, 'outside');
});

test('旧版本已叠的哨兵可退出；缓存恢复重新装上保护', () => {
  let handler, pageShow;
  const states = [null, null]; let index = 1;
  const window = { history: {
    get state() { return states[index]; },
    pushState(s) { states.splice(index + 1); states.push(s); index++; },
    back() { if (index) { index--; if (handler) handler(); } }
  }, addEventListener(k,f) { if(k==='popstate') handler=f; else if(k==='pageshow') pageShow=f; }, removeEventListener() { handler=null; } };
  vm.runInNewContext(read('back-guard.js'), { window, Date });
  // 依照实际写入方的 MARK 造旧哨兵，不把家里标识硬写到公共测试里。
  window.history.pushState({[window.BackGuard.MARK]:1});
  window.history.pushState({[window.BackGuard.MARK]:1});
  window.history.pushState({[window.BackGuard.MARK]:1});
  window.BackGuard.arm({});window.history.back();window.history.back();
  assert.equal(index, 0); assert.equal(handler, null);
  index=1;pageShow({persisted:true});assert.equal(typeof handler,'function');
  assert.equal(window.history.state[window.BackGuard.MARK],1);
});

// 字段直接取自 savePhoneApp / archivePhoneApp / phoneVitalMerge 的三个写入桶。
function fixture() {
  return { x_phone: { c1: { health: { cards: [{ name: 'fixture', num: 50 }], _at: 1 }, notes: { items: [{ title: '保留' }] } }, c2: { health: { cards: [] } } },
    x_phoneArch: { c1: [{ app: 'health', id: 'h1' }, { app: 'notes', id: 'n1' }], c2: [{ app: 'health', id: 'h2' }] },
    x_phoneVitals: { c1: [{ date: '2026-09-14', metrics: [] }], c2: [{ date: '2026-09-13', metrics: [] }] } };
}
test('清空只改目标手机及该app的归档/趋势，验证落盘后才成功', async () => {
  const store = fixture(), before = structuredClone(store);
  const result = await K.phoneResetStored('c1', 'health', k => store[k], async (k, v) => { store[k] = v; return { durable: true, live: true }; });
  assert.equal(result.ok, true);
  assert.equal(store.x_phone.c1.health, undefined);
  assert.deepEqual(store.x_phone.c1.notes, before.x_phone.c1.notes);
  assert.deepEqual(store.x_phone.c2, before.x_phone.c2);
  assert.deepEqual(store.x_phoneArch.c1, [before.x_phoneArch.c1[1]]);
  assert.deepEqual(store.x_phoneArch.c2, before.x_phoneArch.c2);
  assert.equal(store.x_phoneVitals.c1, undefined);
  assert.deepEqual(store.x_phoneVitals.c2, before.x_phoneVitals.c2);
});
test('第二张表写失败，已尝试的表全部回滚且不报告成功', async () => {
  const store = fixture(), before = structuredClone(store); let calls = 0;
  const result = await K.phoneResetStored('c1', 'health', k => store[k], async (k, v) => {
    calls++; store[k] = v; return { durable: calls !== 2, live: calls !== 2 };
  });
  assert.equal(result.ok, false); assert.equal(result.restored, true);
  assert.deepEqual(store, before);
});
test('回滚也失败时明确返回异常，不假称原记录已保留', async () => {
  const store = fixture();
  const r = await K.phoneResetStored('c1', 'health', k => store[k], async () => ({ durable: false, live: false }));
  assert.equal(r.ok, false); assert.equal(r.restored, false);
});

function opsHarness() {
  const start = app.indexOf('  const withPhoneWork =');
  const end = app.indexOf('  // 调整角色钱包余额', start);
  const store = fixture(), messages = [];
  let commits = 0;
  const ctx = { phoneOpsRef: { current: { active: 0, resetting: false, watching: false } },
    phonesRef: { current: store.x_phone }, PHONE_APPS: [{ key: 'health' }], PHONE_LIVE_KEYS: [],
    window: { PhoneKit: { resetStored: K.phoneResetStored } }, toast: s => messages.push(s), phoneKeyLabel: s => s,
    loadJSON: k => store[k], commitJSONDurable: async (k, v) => { commits++; store[k] = v; return { durable: true, live: true }; },
    setPhones() {}, setPhoneArch() {}, setPhoneVitals() {} };
  vm.createContext(ctx); vm.runInContext(app.slice(start, end) + '\nthis.work=withPhoneWork;this.reset=resetPhoneApp;', ctx);
  return { ctx, messages, get commits() { return commits; } };
}
test('在途生成未结束时禁止清空，成功/失败都释放占用', async () => {
  const h = opsHarness(); let finish;
  const work = h.ctx.work(() => new Promise(r => { finish = r; }));
  assert.equal(await h.ctx.reset('c1', 'health'), false); assert.equal(h.commits, 0);
  finish(true); await work;
  await assert.rejects(h.ctx.work(async () => { throw new Error('fixture failure'); }));
  assert.equal(h.ctx.phoneOpsRef.current.active, 0);
  assert.equal(await h.ctx.reset('c1', 'health'), true); assert.equal(h.commits, 3);
});
test('清空期间不启动新生成；看手机播放中也不允许清空', async () => {
  const h = opsHarness(); let called = false;
  h.ctx.phoneOpsRef.current.resetting = true;
  assert.equal(await h.ctx.work(() => { called = true; }), false); assert.equal(called, false);
  h.ctx.phoneOpsRef.current.resetting = false; h.ctx.phoneOpsRef.current.watching = true;
  assert.equal(await h.ctx.reset('c1', 'health'), false); assert.equal(h.commits, 0);
  ['genPhoneApp', 'genPhoneAll', 'genWatchSession'].forEach(name => {
    const head = app.slice(app.indexOf('  const ' + name + ' ='), app.indexOf('  const ' + name + ' =') + 150);
    assert.match(head, /withPhoneWork\(async/);
  });
});
test('线下结束不绕过已存在的用户确认/云端纠错机制', () => {
  assert.doesNotMatch(app, /supersedeOfflineRolling/);
  assert.match(app, /saveMemLib\(\[entry, \.\.\.pruneSubsumed\(memLibRef\.current, \[entry\]\)\]\)/);
  const start = app.indexOf('  const pruneSubsumed =');
  const fn = app.slice(start, app.indexOf('\n  };', start) + 5);
  const edited = { id: 'edited', text: '用户修改过的记录', source: 'auto', ofs: 'fixture', pinned: false, open: false, charIds: ['c1'] };
  const ctx = { normMemText: s => s, memShareChar: () => true, window: { MemoryCorrectionShadow: { observePair() {} } }, existing: [edited], newer: [{ id: 'new', text: edited.text + '及补充', charIds: ['c1'] }] };
  vm.createContext(ctx); vm.runInContext(fn + '\nthis.result=pruneSubsumed(existing,newer);', ctx);
  assert.equal(ctx.result[0], edited); assert.equal(edited.surfaceState, undefined);
});
