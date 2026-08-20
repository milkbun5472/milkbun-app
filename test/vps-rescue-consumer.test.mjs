import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICES, VpsRescueConsumer } from '../tools/vps/rescue-consumer.mjs';

const env = { SUPABASE_SERVICE_KEY: 'test-key', TARGET_USER: 'user-1' };

test('VPS 互救状态只报告白名单服务', () => {
  const c = new VpsRescueConsumer({ env, serviceStatusImpl: (label) => ({ state: 'active', label }) });
  const status = c.status();
  assert.equal(status.executor, 'vps');
  assert.deepEqual(Object.keys(status.services), Object.keys(SERVICES));
  assert.ok(Object.values(status.services).every((row) => row.state === 'active'));
});

test('未经确认或不在白名单的服务不能重启', () => {
  let calls = 0;
  const c = new VpsRescueConsumer({ env, serviceStatusImpl: () => ({ state: 'active' }), restartImpl: () => { calls += 1; } });
  assert.throws(() => c.execute({ action: 'restart', payload: { service: 'codex_lounge' } }), /明确确认/);
  assert.throws(() => c.execute({ action: 'restart', payload: { service: 'ssh', confirmed: true } }), /白名单/);
  assert.equal(calls, 0);
});

test('白名单重启返回前后体征', () => {
  let state = 'active';
  const c = new VpsRescueConsumer({
    env,
    serviceStatusImpl: () => ({ state }),
    restartImpl: () => { state = 'active'; return { state }; },
  });
  const result = c.execute({ action: 'restart', payload: { service: 'memory', confirmed: true } });
  assert.equal(result.service, 'memory');
  assert.equal(result.after.state, 'active');
});

test('VPS 值班室信件只把可见回复写回结果', () => {
  const calls = [];
  const c = new VpsRescueConsumer({
    env,
    codexSubmitImpl: (id, text) => { calls.push({ id, text }); return '我在 VPS 收到啦。'; },
  });
  const result = c.execute({ id: 'dispatch-1', action: 'codex_chat', payload: { text: '帮我看一下队列' } });
  assert.deepEqual(calls, [{ id: 'app-dispatch-1', text: '<!--VPS_DUTY-->\n帮我看一下队列' }]);
  assert.equal(result.reply, '我在 VPS 收到啦。');
  assert.equal(result.executor, 'vps_codex');
});

test('VPS 值班室拒绝空信与超长信', () => {
  const c = new VpsRescueConsumer({ env, codexSubmitImpl: () => '不应调用' });
  assert.throws(() => c.execute({ id: 'x', action: 'codex_chat', payload: { text: '  ' } }), /1~3000/);
  assert.throws(() => c.execute({ id: 'x', action: 'codex_chat', payload: { text: 'x'.repeat(3001) } }), /1~3000/);
});
