const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/app.js','utf8');
test('睡着时很想才发：一夜只掷一次，不是每轮都掷',()=>{
  assert.doesNotMatch(s,/if \(!forced \|\| Math\.random\(\) > 0\.12\) continue;/);
  assert.match(s,/nightRollRef\.current\[cid\] = \{ k: _nk, ok: Math\.random\(\) < 0\.12 \}/);
});
