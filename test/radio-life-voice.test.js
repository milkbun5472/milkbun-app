const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../js/radio-voice.js','utf8');
function setup(enabled=true){
 const calls=[],audios=[],revoked=[],utterances=[];
 const env={console,Promise,Math,Number,String,Array,ttsReady:()=>enabled,ttsSpeak:async(t,id)=>{calls.push({text:t,id});return {size:4};},speechSynthesis:{getVoices:()=>[],addEventListener:()=>{},speak:u=>utterances.push(u),cancel:()=>{}},SpeechSynthesisUtterance:function(t){this.text=t;},URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:u=>revoked.push(u)},Audio:function(url){this.url=url;this.play=()=>Promise.resolve();this.pause=()=>this.paused=true;audios.push(this);}};
 env.window=env;vm.runInNewContext(source,env);return{R:env.RadioVoice,env,calls,audios,revoked,utterances};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('radio speaks with actual per-character MiniMax voice, stops and releases cached audio URL',async()=>{
 const f=setup();let ended=0;const h=f.R.speak('这一句',{voiceId:'甲音色',end:()=>ended++});await flush();assert.deepEqual(f.calls,[{text:'这一句',id:'甲音色'}]);assert.equal(f.audios.length,1);h.cancel();assert.ok(f.audios[0].paused);assert.deepEqual(f.revoked,['blob:fixture']);f.audios[0].onended();assert.equal(ended,0,'cancel ignores late completion');
});
test('unconfigured MiniMax does not make a request; errors fall back to shared system speech',async()=>{
 const f=setup(false);f.R.speak('系统播放',{voiceId:'甲音色'});assert.equal(f.calls.length,0);assert.equal(f.utterances[0].text,'系统播放');
 const g=setup();g.env.ttsSpeak=async()=>{throw Error('fixture failure');};g.R.speak('重试语音',{voiceId:'甲音色'});await flush();assert.equal(g.utterances[0].text,'重试语音');
});
test('cancel during synthesis never starts a late audio',async()=>{
 const f=setup();let finish;f.env.ttsSpeak=()=>new Promise(r=>finish=r);const h=f.R.speak('尚未返回',{voiceId:'甲音色'});h.cancel();finish({size:2});await flush();assert.equal(f.audios.length,0);
});
