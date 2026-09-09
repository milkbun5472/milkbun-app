const test = require('node:test'), assert = require('node:assert/strict');
const { streamFixture, delta } = require('./_call-stream-fixture');
test('收到分块 DONE 就返回，连接不关闭也不等静默超时，不消费结束后的内容', async () => {
  const seen = [], f = streamFixture([delta('你好'), 'data: [DO', 'NE]\n\n' + delta('不应显示')]);
  const d = await f.request({ onDelta: s => seen.push(s) });
  assert.equal(d.choices[0].message.content, '你好');
  assert.deepEqual(seen, ['你好']); assert.equal(f.reads(), 3); assert.equal(f.cancels(), 1);
});
test('finish_reason 后保留独立 usage 尾包；没有 DONE 也有有限收尾', async () => {
  const f = streamFixture([delta('完整回答'), 'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
    'data: {"choices":[],"usage":{"completion_tokens":7}}\n\n']);
  const d = await f.request();
  assert.equal(d.choices[0].finish_reason, 'length'); assert.equal(d.usage.completion_tokens, 7);
  assert.equal(f.cancels(), 1);
});
test('真正未完成的静默仍报错；错误事件不再等待连接关闭', async () => {
  await assert.rejects(streamFixture([delta('未完')]).request(), /静默/);
  const f = streamFixture(['data: {"error":{"message":"线路出错"}}\n\n']);
  assert.equal((await f.request()).error.message, '线路出错'); assert.equal(f.cancels(), 1);
});
