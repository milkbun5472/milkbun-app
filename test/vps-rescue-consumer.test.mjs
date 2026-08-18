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

