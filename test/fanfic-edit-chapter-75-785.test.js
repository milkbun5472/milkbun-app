const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../js/fanfic.js','utf8');
test('同人文每一章都能改字，改完只换这一章的 content',()=>{
  assert.match(src,/"改这一章"/);
  const fn=src.slice(src.indexOf('function saveEditChapter'),src.indexOf('function saveMyChapter'));
  assert.match(fn,/content: txt/);
  assert.match(fn,/Object\.assign\(\{\}, chs\[i\]/);
  assert.doesNotMatch(fn,/endHook/);
});
test('同人文给模型的人带外貌（我那份也带），CP 能在读文页改',()=>{
  assert.match(src,/function meChar\(profile\)[^\n]*appearance: \(profile && profile\.appearance\)/);
  assert.match(src,/外貌（务必贴合/);
  assert.match(src,/fic\.cp = next;/);
});
test('同人文里的「我」按这篇第一位角色认的面具取人设和外貌',()=>{
  const app=fs.readFileSync(__dirname+'/../js/app.js','utf8');
  assert.match(app,/FanficApp, \{[\s\S]{0,3000}meOf: meOf/);
  // v75.84x：取「我」那一截抽成 ficMeProfile（续写「他俩 × 我」那几枪也要用），cpChars 照它取
  assert.match(src,/function cpChars\(cp, characters, profile\) \{\n    const me = ficMeProfile\(cp, profile\);/);
  const fn=src.slice(src.indexOf('function ficMeProfile'),src.indexOf('function ficMeProfile')+700);
  assert.match(fn,/ficMeOf\(lead\)/);
  assert.match(fn,/appearance: mask\.appearance/);
});
