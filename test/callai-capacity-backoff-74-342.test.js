// 站子说「我满了」时要等得久一点（她 2026-09-30 拿公共版用户的截图来问）
//
// 那张截图上的原话：「（发送失败：system memory overloaded (current: 91.2%, threshold: 90%)）」
// —— 是**中转站自己**吐回来的：它那台机器内存 91.2%，超过自己定的 90% 保险线。
// callAI 当时已经重试过一次，但只等 2 秒；一台内存卡在 91% 的机器 2 秒降不下来，
// 于是两次撞同一堵墙。这份测试钉的就是「两种等法不许又变回一种」。
//
// ⚠️callAI 单独抠出来跑（施工规则/anchor-on-code：锚只钉函数名）。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const src = fs.readFileSync('js/engine.js', 'utf8');
const i = src.indexOf('async function callAI(p, system, messages, opts) {');
const j = src.indexOf('async function callAIOnce(p, system, messages, opts) {');
assert.ok(i > 0 && j > i, '抠不出 callAI');
const code = src.slice(i, j);

// 用假的 setTimeout 把等待时间记下来，不真等
function run(errs) {
  const waits = [];
  let n = 0;
  const callAIOnce = async () => {
    const e = errs[n++];
    if (e) throw new Error(e);
    return "OK";
  };
  const fakeTimeout = (fn, ms) => { waits.push(ms); fn(); return 0; };
  const fn = new Function('callAIOnce', 'setTimeout', 'window',
    code + '\nreturn callAI;')(callAIOnce, fakeTimeout, undefined);
  return { waits, tries: () => n, go: (opts) => fn({ id: 'p' }, 's', [], opts || {}) };
}

test('① 她截图上那句：认成「对面满了」，等 4 秒再等 10 秒，总共发三次', async () => {
  const full = 'system memory overloaded (current: 91.2%, threshold: 90%)';
  const r = run([full, full, null]);
  assert.equal(await r.go(), 'OK');
  assert.deepEqual(r.waits, [4000, 10000], '两次退避必须是 4 秒和 10 秒');
  assert.equal(r.tries(), 3, '一次原发 + 两次重试');
});

test('② 连接抖一下还是老样子：只等 2 秒、只多试一次', async () => {
  const r = run(['Load failed', null]);
  assert.equal(await r.go(), 'OK');
  assert.deepEqual(r.waits, [2000]);
  assert.equal(r.tries(), 2);
});

test('③ 第一次是过载、第二次换成别的错：不再往下试', async () => {
  const r = run(['overloaded', '502 bad gateway... 不对，换一种', null]);
  await assert.rejects(() => r.go());
  assert.deepEqual(r.waits, [4000], '第二次不是过载类，就停在这儿');
});

test('④ 真错误一次都不重试（不许把内容/密钥错误闷掉重发烧钱）', async () => {
  const r = run(['invalid api key', null]);
  await assert.rejects(() => r.go());
  assert.deepEqual(r.waits, []);
  assert.equal(r.tries(), 1);
});

test('⑤ 等待途中她按了停止：不许再发出去', async () => {
  const sig = { aborted: false };
  const waits = [];
  let n = 0;
  const callAIOnce = async () => { n++; throw new Error('overloaded'); };
  const fakeTimeout = (fn, ms) => { waits.push(ms); sig.aborted = true; fn(); return 0; };
  const fn = new Function('callAIOnce', 'setTimeout', 'window',
    code + '\nreturn callAI;')(callAIOnce, fakeTimeout, undefined);
  await assert.rejects(() => fn({ id: 'p' }, 's', [], { signal: sig }));
  assert.equal(n, 1, '第一次之后就停止了，不许有第二次');
});

test('⑥ 流式已经吐出字的那一次仍然不重试（否则同一句话冒两遍）', async () => {
  let n = 0;
  const callAIOnce = async (p, s, m, o) => { n++; o.onDelta('半'); throw new Error('overloaded'); };
  const fn = new Function('callAIOnce', 'setTimeout', 'window',
    code + '\nreturn callAI;')(callAIOnce, (f) => f(), undefined);
  await assert.rejects(() => fn({ id: 'p' }, 's', [], { onDelta: () => {} }));
  assert.equal(n, 1);
});
