const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const extract = name => src.match(new RegExp('  const '+name+' = [\\s\\S]*?\\n  \\};'))[0];
const parse = new Function(extract('parseSongWants')+';return parseSongWants')();
test('歌曲感想完整保留英文、中文及多语言尾句，兼容旧字段',()=>{
  for(const field of ['note','thought','why','mood']) {
    const note = 'The fire escape. Neither of us said anything for almost an hour. '+ '这句也要完整保留。'.repeat(12)+' おやすみ。';
    assert.equal(parse({songs:[{title:'Fixture',artist:'Test',[field]:note}]})[0].note,note);
  }
  assert.equal(parse({songs:[{title:'Fixture',note:'  short\n note  '}]})[0].note,'short note');
});
test('共用搜歌落库对象保留完整感想，唱片与歌单都走这条链',async()=>{
  const note = 'A long English note that must never stop halfway through the last word. '.repeat(5);
  const collect = new Function('neteaseSearchOne','neteaseTrackInfo',extract('collectRealSongs')+';return collectRealSongs')(
    async()=>({id:123,name:'Fixture'}),()=>({artist:'Test',cover:null}));
  const result=await collect({probeOnce:async()=>parse({songs:[{title:'Fixture',note}]}),mkId:id=>'sgd_'+id,target:1,cap:1,rounds:1});
  assert.equal(JSON.parse(JSON.stringify(result.added))[0].note,note.trim());
  assert.match(src,/const stamped = added\.map/);
  assert.match(src,/songs: \[\.\.\.old, \.\.\.fresh\]/);
  assert.match(src,/songs: \[\.\.\.\(existing\.songs \|\| \[\]\), \.\.\.fresh\]/);
  assert.equal((src.match(/await collectRealSongs\(/g)||[]).length,2);
});
