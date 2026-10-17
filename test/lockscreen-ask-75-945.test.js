const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/app.js','utf8');
test('她点名换壁纸／锁屏：前几条的图也认；说换好了就一定要填',()=>{
  assert.match(s,/\/壁纸\|锁屏\|屏保\|桌面背景\|手机背景\/\.test\(String\(lastU\.content/);
  assert.match(s,/说了换就一定要填/);
  assert.match(s,/const rows = all\.slice\(-6\);/);
});
