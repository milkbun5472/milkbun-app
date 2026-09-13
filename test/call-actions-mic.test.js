const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('js/components.js','utf8');
const i=src.indexOf('function callActionsFor(');
const actions=new Function(src.slice(i,src.indexOf('\n}\n',i)+3)+';return callActionsFor;')();
test('视频动作按真实写入的轮次固定，多句台词和群成员不串到别轮',()=>{
 const rows=[{role:'user',content:'hi'},{role:'char',act:true,content:'甲动作',senderId:'a',turnId:'t1'},
 {role:'char',content:'第一句',senderId:'a',turnId:'t1'},{role:'char',content:'第二句',senderId:'a',turnId:'t1'},
 {role:'char',act:true,content:'乙动作',senderId:'b',turnId:'t1'},{role:'char',content:'乙台词',senderId:'b',turnId:'t1'},
 {role:'user',content:'下一轮'},{role:'char',act:true,content:'新动作',turnId:'t2'}];
 assert.deepEqual(actions(rows,2).map(m=>m.content),['甲动作','乙动作']);
 assert.deepEqual(actions(rows,3),actions(rows,2));
 assert.deepEqual(actions(rows,6),[]);assert.deepEqual(actions(rows).map(m=>m.content),['新动作']);
 const old=rows.slice(0,4).map(({turnId,...m})=>m);assert.equal(actions(old).length,1);
 assert.match(fs.readFileSync('js/app.js','utf8'),/turnId: callTurnId, \.\.\.line/);
});
test('备用识别等待麦克风权限时关麦，迟到的流立即释放',async()=>{
 const at=src.indexOf('  const workletStart =');const body=src.slice(at,src.indexOf('  const stopCallAudio =',at));
 let resolve,stopped=0;const lv={current:{session:1}},liveRef={current:true};
 const worklet=new Function('lv','liveRef','navigator',body+';return workletStart;')(lv,liveRef,{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}});
 const task=worklet();liveRef.current=false;lv.current.session++;
 resolve({getTracks:()=>[{stop:()=>stopped++}]});await task;
 assert.equal(stopped,1);assert.equal(lv.current.stream,undefined);
 assert.match(body,/st.node.connect\(st.mute\); st.mute.connect\(st.ctx.destination\)/);
 assert.match(body,/URL.revokeObjectURL\(moduleUrl\)/);
});
test('开麦不等待播放解锁；识别忙时保留输入，停止立即失效',()=>{
 const start=src.slice(src.indexOf('  const lvStart ='),src.indexOf('  const lvStop ='));
 assert.ok(start.indexOf('liveRef.current = true')<start.indexOf('recStart()'));
 assert.doesNotMatch(start,/await unlockCallAudio/);
 const can=src.match(/const canLive = ([\s\S]*?);/)[1];assert.doesNotMatch(can,/voiceId|ttsReady|!isGroup/);
 const at=src.indexOf('  const lvCommitFinal =');const body=src.slice(at,src.indexOf('  const lvEncode =',at));
 let input='',sent=[];const st={session:1,lastFinal:'',lastFinalAt:0,turn:0};const liveRef={current:true},sendingRef={current:true};
 const commit=new Function('lv','liveRef','sendingRef','setInput','setLiveSt','onSend',body+';return lvCommitFinal;')({current:st},liveRef,sendingRef,f=>input=f(input),()=>{},t=>sent.push(t));
 assert.equal(commit('保留这句',1),true);assert.equal(input,'保留这句');assert.deepEqual(sent,[]);
 assert.equal(commit('保留这句',1),false);sendingRef.current=false;
 commit('空闲发送',1);assert.deepEqual(sent,['空闲发送']);liveRef.current=false;
 assert.equal(commit('迟到',1),false);
});
