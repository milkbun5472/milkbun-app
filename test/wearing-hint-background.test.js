const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('js/app.js','utf8');
test('实际穿着提醒引用已有背景，不重复活动地点或换衣示例', () => {
  const start = app.indexOf('const _wearRefreshHint =');
  const end = app.indexOf('const _clockStampHint',start);
  const code = app.slice(start,end);
  const render = new Function('_wearRefreshGate',code+'; return _wearRefreshHint;');
  assert.equal(render({required:false}), '');
  for(const reason of ['行程已切换','当前穿着尚未建档','上轮换装刷新尚未完成']) {
    const text = render({required:true,reason});
    assert.ok(text.includes(reason));
    assert.match(text,/在 wearing 确认此刻实际穿着/);
    assert.match(text,/依据已有上下文/);
    assert.doesNotMatch(text,/当前行程是|七点|十点|睡衣/);
  }
  assert.doesNotMatch(code,/_wearBrief/);
  assert.match(app,/_stateBootstrapHint \+ _wearRefreshHint \+ paceHint/);
});
