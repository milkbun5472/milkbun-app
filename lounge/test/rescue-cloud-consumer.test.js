'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { RescueCloudConsumer } = require('../rescue-cloud-consumer');

test('远程互救只执行白名单动作，重启仍要求手机确认', () => {
  const calls = [];
  const consumer = new RescueCloudConsumer({ rescue: {
    status: () => ({ ok: true }), checkpoint: x => ({ x }),
    restart: (service, confirmed) => { calls.push({ service, confirmed }); return { service }; },
    rewindPreview: x => ({ ...x, executable: false }), rescueSummary: x => '票:' + x,
  } });
  assert.deepEqual(consumer.execute({ action: 'status', payload: {} }), { ok: true });
  assert.throws(() => consumer.execute({ action: 'delete', payload: {} }), /未知互救命令/);
  consumer.execute({ action: 'restart', payload: { service: 'wake', confirmed: true } });
  assert.deepEqual(calls, [{ service: 'wake', confirmed: true }]);
});

test('本机桥凭据只从 0600 环境文件读取，不进入命令结果', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rescue-cloud-'));
  const envPath = path.join(dir, '.env');
  fs.writeFileSync(envPath, 'SUPABASE_SERVICE_KEY=secret\nTARGET_USER=owner\n');
  fs.chmodSync(envPath, 0o600);
  const consumer = new RescueCloudConsumer({ rescue: {}, envPath });
  const headers = consumer.headers();
  assert.equal(headers.apikey, 'secret');
  assert.equal(Object.prototype.hasOwnProperty.call(consumer, 'serviceKey'), false);
});
