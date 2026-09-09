const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const app = fs.readFileSync('js/app.js','utf8');
test('通话接管使旧自发轮失效，挂断后旧轮也不能继续吐泡', () => {
  const start = app.indexOf('    const callEpoch =', app.indexOf('const replyGroup ='));
  const code = app.slice(start, app.indexOf('    if (laneBusy(', start));
  const epochs = {current:{}}, call = {current:null};
  const factory = new Function('groupId','rgOpts','groupAutoCallEpochRef','groupCallActive', code + '; return {autoCancelled,checkAutoCall};');
  const active = id => !!call.current && call.current.groupId === id;
  const old = factory('g1',{auto:true},epochs,active);
  assert.equal(old.autoCancelled(),false);
  // 照 startCall 写入方：群 ID 与 epoch；min 不改变占用。
  assert.match(app,/if \(groupId\) groupAutoCallEpochRef.current\[groupId\] = \(groupAutoCallEpochRef.current\[groupId\] \|\| 0\) \+ 1/);
  epochs.current.g1=1; call.current={groupId:'g1',mode:'video',min:true};
  assert.throws(old.checkAutoCall);
  assert.equal(factory('g2',{auto:true},epochs,active).autoCancelled(),false);
  call.current=null;
  assert.throws(old.checkAutoCall);
  assert.equal(factory('g1',{auto:true},epochs,active).autoCancelled(),false);
  assert.equal(factory('g1',{auto:false},epochs,active).autoCancelled(),false);
});
