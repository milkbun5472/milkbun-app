const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8'),Rooms=require('../js/chat-rooms'),Guard=require('../js/thought-voice-guard');
const cut=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i);return app.slice(i,j);};
// v68.88：心声守卫的调用点收成 app.js 里的公共 TVG（守卫没加载时原样放行，不再整轮抛异常）。
// 这儿接【真的那一份】而不是打桩：它现在是四条心声通道唯一的入口，打桩就等于没测。
const realTVG = guard => {
  const src = require('node:fs').readFileSync('js/app.js', 'utf8');
  const code = src.slice(src.indexOf('const TVG = {'), src.indexOf('\n};', src.indexOf('const TVG = {')) + 3);
  return new Function('window', code + ' return TVG;')({ ThoughtVoiceGuard: guard });
};
function fixture(opts={}){
 let now=1000000;const session={sessionId:'call1',...opts},states={},moods=[],history=[],local=[];
 const box={Date:{now:()=>now},cur:session,callRef:{current:session},window:{ChatRooms:Rooms,ThoughtVoiceGuard:Guard},TVG:realTVG(Guard),
  gsFor:()=>({memoryInterop:opts.interop!==false}),settingsFor:()=>({engineerEyes:!!opts.engineer}),statesRef:{current:states},
  setStateFor:(id,v)=>states[id]=v,setMoodFor:(id,v)=>moods.push(v),pushStateHist:(id,v)=>{if(v.thought)history.push(v);},setRoomThought:(...a)=>local.push(a)};
 vm.createContext(box);
 vm.runInContext(cut('const LIVE_STATE_TTL =','  // 心声历史：')+cut('  const callCanWriteMain =','  const callSend =')+cut('      const callThoughtDone =','      const uName =')+';this.put=callPutState;this.can=callCanWriteMain;this.fresh=freshLiveStateValue;',box);
 return {box,session,states,moods,history,local,tick:()=>now+=1000,put:d=>box.put('a',d,'turn1')};
}
test('封闭群通话不改主线状态/心情/记忆，互通群允许写入',()=>{
 for(const interop of [false,true]){
  const f=fixture({groupId:'g',interop});f.put({thought:'我有点想她。',mood:'开心',wearing:'白衬衫',action:'坐着'});
  assert.equal(!!f.states.a,interop);assert.equal(f.moods.length,Number(interop));assert.equal(f.history.length,Number(interop));
  assert.equal(f.box.can(f.session,'memoryCandidate'),interop);
 }
 assert.match(app,/if \(!cur.room && callCanWriteMain\(cur, "state"\)\) noteTidalUser/);
 assert.match(app,/if \(callCanWriteMain\(cur, "memoryCandidate"\)\)/);
});
test('通话新状态有字段时间戳，原样重复不续命，恢复身体状态与换场景清理旧值',()=>{
 const f=fixture();f.put({wearing:'白衬衫',action:'坐着',place:'家',condition:'累',thought:'我有点想她。'});
 for(const k of ['wearing','action','place','condition'])assert.equal(f.box.fresh(f.states.a,k),f.states.a[k]);
 const ts=f.states.a.wearingUpdatedAt;f.tick();f.put({wearing:'白衬衫',action:'坐着'});assert.equal(f.states.a.wearingUpdatedAt,ts);
 f.put({place:'公司',condition:null});assert.equal(f.states.a.wearing,null);assert.equal(f.states.a.condition,null);
 assert.equal(f.states.a.wearingUpdatedAt,0);assert.equal(f.states.a.conditionUpdatedAt,0);
});
test('无有效心声清旧心声；同轮后续气泡不抹掉刚写的新心声',()=>{
 const f=fixture();f.states.a={thought:'上一轮心声',thoughtUpdatedAt:1};f.put({mood:'null'});
 assert.equal(f.states.a.thought,null);assert.equal(f.moods.length,0);
 f.put({thought:'我有点想她。'});f.put({action:'走到窗边'});assert.equal(f.states.a.thought,'我有点想她。');
 const g=fixture();g.states.a={thought:'旧心声'};g.put({thought:'我需要表现出一种镇定的感觉'});assert.equal(g.states.a.thought,null);
 const e=fixture({engineer:true});e.states.a={thought:'自主心声'};e.put({action:'写字'});assert.equal(e.states.a.thought,'自主心声');
});
test('侧房记忆权限独立于状态权限；迟到结果不写新通话',()=>{
 for(const sharedState of [false,true]) for(const memoryCandidate of [false,true]){
  const room=Rooms.normalize({id:'r',...Rooms.PRESETS.isolated,writeback:{sharedState,memoryCandidate,stateMood:false}},'a');
  const f=fixture({room,chatKey:'a::r'});f.put({thought:'本房心声',wearing:'外套',mood:'开心'});
  assert.equal(!!f.states.a,sharedState);assert.equal(f.moods.length,0);assert.equal(f.local.length,1);
  assert.equal(f.box.can(f.session,'memoryCandidate'),memoryCandidate);
  if(f.states.a)assert.equal(f.states.a.thought,undefined);
 }
 const f=fixture();f.box.callRef.current={sessionId:'new'};f.put({wearing:'旧通话衣服'});assert.equal(f.states.a,undefined);
});

test('身体状态清空共用三态规则，通话不把 null 字符串保留成旧病况',()=>{
 for(const value of [null,'null',' NULL ']){
  const f=fixture();f.put({condition:'疲惫'});f.tick();f.put({condition:value});
  assert.equal(f.states.a.condition,null);assert.equal(f.states.a.conditionUpdatedAt,0);
 }
 const f=fixture();f.put({condition:'疲惫'});const ts=f.states.a.conditionUpdatedAt;f.tick();
 for(const value of [undefined,'','  ',{},false]){
  f.put({condition:value});assert.equal(f.states.a.condition,'疲惫');assert.equal(f.states.a.conditionUpdatedAt,ts);
 }
 f.put({condition:'疲惫'});assert.equal(f.states.a.conditionUpdatedAt,ts);
 const patch={};f.box.patch=patch;
 vm.runInContext('putLiveCondition(patch, statesRef.current.a, "疲惫", Date.now(), true)',f.box);
 assert.equal(patch.conditionUpdatedAt,ts+1000);
 assert.match(app,/putLiveCondition\(st, _live0, parsed.condition, stateNow, true\)/);
 assert.match(app,/putLiveCondition\(local, prev, meta && meta.state \? meta.state.condition : undefined, ts\)/);
});
