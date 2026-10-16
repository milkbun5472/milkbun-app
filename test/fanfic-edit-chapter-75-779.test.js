const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const src=fs.readFileSync(__dirname+'/../js/fanfic.js','utf8');
test('同人文每一章都能改字，改完只换这一章的 content',()=>{
  assert.match(src,/"改这一章"/);
  const fn=src.slice(src.indexOf('function saveEditChapter'),src.indexOf('function saveMyChapter'));
  assert.match(fn,/content: txt/);
  assert.match(fn,/Object\.assign\(\{\}, chs\[i\]/);
  assert.doesNotMatch(fn,/endHook/);
});
