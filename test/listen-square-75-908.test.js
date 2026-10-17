const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),sc=fs.readFileSync(__dirname+'/../js/screens.js','utf8');
test('音乐广场：她点了才刷、歌逐首去网易云搜真的、存进 listen.square',()=>{
  const g=app.slice(app.indexOf('const genSquare = async'),app.indexOf('const genCharPlaylist = async'));
  assert.match(g,/maxTokens: 8000/);
  assert.match(g,/neteaseSearchOne\(/);
  assert.match(g,/square: \[\.\.\.out, \.\.\.\(p\.square \|\| \[\]\)\]\.slice\(0, 60\)/);
  assert.doesNotMatch(g,/bgJob\(/);
  assert.match(app,/onPlaySquare: post => post && post\.song && playSong\(post\.song\)/);
  assert.match(sc,/navBtn\("square", "广场"/);
  assert.match(sc,/nav === "square" \? squareTab/);
});
