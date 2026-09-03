const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/fanfic.js'), 'utf8');

test('同人文预设只住代码，存储只保留用户自定义版块', () => {
  assert.match(source, /return SEED_TABS\.concat\(custom\)/);
  assert.match(source, /saveJSON\(K_TABS, custom\)/);
  assert.match(source, /new Set\(SEED_TABS\.map/);
  // v61.21 起退役版块也不许写回存储：它露不露面只由「底下还有没有文章」决定
  assert.match(source, /filter\(function \(t\) \{ return t && !seedIds\.has\(t\.id\) && !retiredId\(t\.id\); \}\)/);
  assert.doesNotMatch(source, /saveJSON\(K_TABS, SEED_TABS\)/);
});
