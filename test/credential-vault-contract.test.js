const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vault = fs.readFileSync(path.join(__dirname, '../js/credential-vault.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const cloud = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf8');
test('x_api 只保留线路元数据，全部批准秘密字段进入不可导出设备金库', () => {
  for (const key of ['apiKey','key','token','authorization','secret','accessToken','authToken','bearerToken']) assert.match(vault, new RegExp('"' + key + '"'));
  assert.match(vault, /generateKey\([^;]+false, \["encrypt", "decrypt"\]\)/);
  assert.match(vault, /delete clean\[field\]/);
  assert.match(vault, /clean\.credentialRef = "cred:" \+ id/);
});
test('迁移先加密读回逐字验真，再改 x_api，并保留加密 quarantine', () => {
  assert.match(vault, /JSON\.stringify\(verified\) !== JSON\.stringify\(merged\)/);
  assert.match(vault, /row\.quarantine = await encrypt/);
  const verifiedRead = vault.indexOf('await req("credentials", "readonly"');
  const metadataWrite = vault.lastIndexOf('localStorage.setItem("x_api"');
  assert.ok(verifiedRead >= 0 && verifiedRead < metadataWrite);
});
test('运行时才临时合并凭证，云同步仍只收去密后的 x_api', () => {
  assert.match(app, /materializeApiProfiles\(storedApis\)/);
  assert.match(app, /persistApiProfiles\(list\)/);
  assert.doesNotMatch(cloud, /__apiRuntimeProfiles/);
});
