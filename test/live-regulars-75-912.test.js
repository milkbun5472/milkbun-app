const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const lv=fs.readFileSync(__dirname+'/../js/live.js','utf8'),app=fs.readFileSync(__dirname+'/../js/app.js','utf8');
test('直播接上片刻那批熟面孔：同一份名单、同一本碰面账',()=>{
  assert.match(app,/regulars: shuaRegulars, regularPairs: shuaPairs, touchRegular:/);
  assert.match(app,/FORUM_NPC_REGISTRY\.filter\(n => n\.shua\)\.map\(n => \(\{ id: n\.id, name: n\.shua\.name/);
  assert.match(lv,/props\.touchRegular\(r\.famId, "theirs", ""\)/);
  assert.match(lv,/ses\.as !== "mask"/);
});
test('看 TA 播：开播时 1~2 个常客从熟面孔里来，对这个主播的态度记下来、下回照着',()=>{
  assert.match(lv,/常客 regulars 里有 1~2 个从这几位熟面孔里来/);
  assert.match(lv,/const REG_KEY = "x_liveRegStance"/);
  assert.match(lv,/\[hk\]: \{ lean: r\.lean \|\| o0\.lean \|\| "", n: \(o0\.n \|\| 0\) \+ 1/);
});
test('她自己开播：熟面孔也来，跟她碰得多的先来；不发私信、不扣谁的钱包',()=>{
  assert.match(lv,/const names = chars\.map\(c => c\.name\)\.concat\(famNames\)/);
  assert.match(lv,/filter\(x => famNames\.indexOf\(x\.name\) < 0\)/);
});
