const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
function fixture(){
 let now=1000000;const states={},hist=[],seen=new Set();
 const box={window:{ThoughtVoiceGuard:require('../js/thought-voice-guard')},Date:{now:()=>now},settingsFor:id=>({engineerEyes:id==='engineer'}),statesRef:{current:states},setStateFor:(id,s)=>states[id]=s,pushStateHist:(id,s)=>{if(s.thought)hist.push({id,thought:s.thought});}};
 vm.createContext(box);const i=app.indexOf('  const sameStateValue ='),j=app.indexOf('  const freshLiveStateValue =',i);
 vm.runInContext(app.slice(i,j)+';this.write=writeGroupLiveState;',box);
 return {states,hist,seen,tick:()=>now+=1000,write:(c,data)=>box.write(c,data,'turn',50,seen)};
}
test('群线上与群线下共用出口，空/被拒心声清旧快照，后续同角色气泡不抹新心声',()=>{
 const f=fixture(),a={id:'a'},b={id:'b'};
 f.states.a={thought:'过时心声',thoughtUpdatedAt:1};f.states.b={thought:'乙的旧心声',thoughtUpdatedAt:1};
 f.write(a,{});assert.equal(f.states.a.thought,null);
 f.write(a,{thought:'我有点想她。'});f.write(a,{mood:'开心'});assert.equal(f.states.a.thought,'我有点想她。');
 f.write(b,{thought:'我需要表现出一种镇定的感觉'});assert.equal(f.states.b.thought,null);
 const next=fixture();next.states.a={thought:'上一轮'};next.write(a,{});assert.equal(next.states.a.thought,null);
 assert.match(app,/writeGroupLiveState\(spk, \{ thought: item.thought/);
 assert.match(app,/if \(!gOffSealed\) writeGroupLiveState\(characters.find/);
 assert.match(app,/goTurnId, affinityBefore, _offThoughtOnce\)/);
});
test('NPC心声与动作正常保存，不写心情好感；工程师保留自主心声',()=>{
 const f=fixture(),npc={id:'n',npc:true};
 f.write(npc,{thought:'我有点想她。',mood:'开心',wearing:'外套',action:'看书'});
 assert.equal(f.states.n.thought,'我有点想她。');assert.equal(f.hist[0].id,'n');
 assert.equal(f.states.n.wearing,'外套');assert.equal(f.states.n.action,'看书');
 assert.equal(f.states.n.mood,undefined);assert.equal(f.states.n.affinityBefore,undefined);
 f.write(npc,{action:'放下书'});assert.equal(f.states.n.thought,'我有点想她。');
 f.seen.clear();f.write(npc,{});assert.equal(f.states.n.thought,null);
 f.states.engineer={thought:'自主心声'};f.write({id:'engineer'},{mood:'平静'});assert.equal(f.states.engineer.thought,'自主心声');
});
test('群里反复报告同一套衣服不续时间；换衣刷新，动作保留逐拍规则',()=>{
 const f=fixture(),c={id:'a'};f.write(c,{wearing:'白衬衫',action:'坐着'});
 const old=f.states.a.wearingUpdatedAt,oldAction=f.states.a.actionUpdatedAt;
 f.tick();f.write(c,{wearing:'白衬衫',action:'坐着'});assert.equal(f.states.a.wearingUpdatedAt,old);assert.ok(f.states.a.actionUpdatedAt>oldAction);
 f.tick();f.write(c,{wearing:'黑外套'});assert.ok(f.states.a.wearingUpdatedAt>old);
});
