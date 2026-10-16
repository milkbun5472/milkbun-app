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
  assert.match(src,/const p = personaOf\(c\) \+ lookOf\(c\);/);
  assert.match(src,/fic\.cp = next;/);
});
