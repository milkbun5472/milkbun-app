const test=require('node:test'),assert=require('node:assert');const fs=require('fs');
const eng=fs.readFileSync(__dirname+'/../js/engine.js','utf8'),app=fs.readFileSync(__dirname+'/../js/app.js','utf8'),cp=fs.readFileSync(__dirname+'/../js/components.js','utf8');
test('语音写成一串 JSON：拆包是公共一份，单聊、群聊、已存的语音条都走它',()=>{
  const i=eng.indexOf('function unwrapVoiceJson(w) {');assert.ok(i>0);
  const fn=new Function(eng.slice(i,eng.indexOf('\nfunction markPauseVoice',i))+'\nreturn unwrapVoiceJson;')();
  assert.deepEqual(fn('{"voice":"(sighs) 哼，不过你高兴就好。","emo":"neutral"}'),{voice:"(sighs) 哼，不过你高兴就好。",emo:"neutral"});
  assert.equal(fn('普通一句'),'普通一句');
  assert.match(eng,/raw\.map\(unwrapVoiceJson\)/);
  assert.match(app,/const _uj = unwrapVoiceJson\(item\.text\)/);
  assert.match(cp,/unwrapVoiceJson\(raw\)/);
});
