const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/app.js','utf8');
test('她点名换壁纸／锁屏：前几条的图也认；说换好了就一定要填',()=>{
  // 2026-10-20 起没点名壁纸的「换上／设成这张」也算（图得在最近几条里），点名那一支照旧
  assert.match(s,/\/壁纸\|锁屏\|屏保\|桌面背景\|手机背景\/\.test\(String\(lastU && lastU\.content/);
  assert.match(s,/\/换上\|换成\|设成\|设为\|用这张\|当背景\|设一下\/\.test\([^\n]*all\.slice\(-8\)\.some\(m => m && m\.role === "user" && m\.imageRef\)/);
  assert.match(s,/说了换就一定要填/);
  assert.match(s,/const rows = all\.slice\(-6\);/);
});
