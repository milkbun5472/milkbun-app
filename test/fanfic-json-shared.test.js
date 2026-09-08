const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const parseJSONLoose = require('./_model-json');
const src = fs.readFileSync(path.join(__dirname, '../js/fanfic.js'), 'utf8');
function generation(name, reply) {
  const start = src.indexOf('  async function ' + name + '(');
  const end = src.indexOf('\n  }', start) + 4;
  assert.ok(start > 0 && end > start);
  let calls = 0;
  const fn = new Function('parseJSONLoose', 'callAI', 'uid', 'ANTI_CLICHE', 'READER_VOICE',
    src.slice(start, end) + '\nreturn ' + name + ';')(
    parseJSONLoose, async () => { calls++; return reply; }, p => p + '_fixture', '', '');
  return {fn, calls: () => calls};
}
test('同人文六处解析共用 engine，不留本地修复链', () => {
  assert.equal((src.match(/= parseJSONLoose\(/g) || []).length, 6);
  assert.doesNotMatch(src, /\b(?:extractJSON|repairJSON)\(/);
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.indexOf('js/engine.js?') < html.indexOf('js/fanfic.js?'));
});
test('书评裸换行与楼中楼保留内容，一次调用完成', async () => {
  // 字段来自 genReviews 的输出协议与返回映射，不伪造存档字段。
  const g = generation('genReviews', '[{"author":"作者甲","content":"第一段\n第二段","replies":[{"author":"读者乙","content":"接话\t内容"}]}]');
  const rows = await g.fn({}, {title:'虚构篇目', author:'作者甲', chapters:[{content:'虚构正文'}]}, {name:'测试版'}, []);
  assert.equal(rows[0].content, '第一段\n第二段');
  assert.equal(rows[0].isAuthor, true);
  assert.equal(rows[0].replies[0].content, '接话\t内容');
  assert.equal(g.calls(), 1);
});
test('评论回复兼容双包、截断与无效返回，保留原过滤规则', async () => {
  for (const reply of [JSON.stringify('[{"author":"作者甲","content":"回复"}]'), '[{"author":"作者甲","content":"回复']) {
    const g = generation('genReplyToUser', reply);
    const rows = await g.fn({}, {title:'虚构篇目', author:'作者甲'}, {}, '测试', '');
    assert.equal(rows[0].content, '回复');
    assert.equal(rows[0].isAuthor, true);
    assert.equal(g.calls(), 1);
  }
  const g = generation('genReplyToUser', '不可解析');
  assert.deepEqual(await g.fn({}, {title:'虚构篇目', author:'作者甲'}, {}, '', ''), []);
  assert.equal(g.calls(), 1);
});
