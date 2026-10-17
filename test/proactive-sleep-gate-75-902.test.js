const test=require('node:test'),assert=require('node:assert');
const s=require('fs').readFileSync(__dirname+'/../js/app.js','utf8');
test('所有主动消息都在 replyNow 一处问睡没睡，只放行名单里那几种',()=>{
  const i=s.indexOf('const replyNow = async'),seg=s.slice(i,i+1500);
  assert.match(seg,/PROACTIVE_SLEEP_OK\.some\(k => opts\[k\]\)/);
  assert.match(seg,/sleepPhaseOf\(_c\) === "asleep"\) return false/);
  const ok=/const PROACTIVE_SLEEP_OK = \[([^\]]*)\]/.exec(s)[1];
  for(const k of ['wx','health','anniv','bloom','promise','tripEve'])assert.ok(!ok.includes('"'+k+'"'),k+' 不该放行');
});
