const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
test('位置提示删除上门陪伴暗示，保留防止擅自推断异地的规则', () => {
  const src = fs.readFileSync('js/engine.js', 'utf8');
  const start = src.indexOf('  if (!ctx.notRoleplay && geo && geo.label)');
  const block = src.slice(start, src.indexOf('\n  // 他自己住在哪儿', start));
  assert.ok(start > 0);
  assert.doesNotMatch(block, /能约、能上门、能过去陪|默认你和/);
  assert.match(block, /绝不许据此推断成异地恋或异国恋/);
});
