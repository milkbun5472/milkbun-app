const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/radio-timeline.js');
function fixture() {
  const b = R.create({id:'c',name:'角色',persona:'人设'},'话题','','','b');
  b.fragments.push(R.accept({lines:[{kind:'character',speaker:'角色',text:'第一句。第二句。'},{kind:'character',speaker:'角色',text:'第三句。第四句。'}]},'present','story'));
  return b;
}
const call = id => R.acceptCall({lines:[{text:'回答。回到刚才的事。'}]},'present',id,{name:'马甲'},'提问。','角色');
test('插播不改正文引用、原句索引和已有语音字段；重载后仍接回原文',()=>{
  const b=fixture(), original=b.fragments[0]; original.audioCache={0:'已有语音'};
  const next=R.insertCall(b,{fragmentId:'story',index:0},call('call'));
  assert.equal(next.fragments[0],original);assert.equal(b.fragments.length,1);
  const list=R.playlist(JSON.parse(JSON.stringify(next)),'story');
  assert.deepEqual(list.map(x=>x.text),['第一句。','提问。','回答。','回到刚才的事。','第二句。','第三句。','第四句。']);
  assert.deepEqual(list.filter(x=>x.fragmentId==='story').map(x=>x.index),[0,1,2,3]);
  assert.equal(next.fragments[0].audioCache[0],'已有语音');
  assert.throws(()=>R.insertCall(b,{fragmentId:'story',index:99},call('bad')));
});
test('连续介入支持插播内再插播，旧独立电话仍可回放',()=>{
  let b=R.insertCall(fixture(),{fragmentId:'story',index:-1},call('a'));
  b=R.insertCall(b,{fragmentId:'a',index:1},call('b'));
  assert.equal(R.playlist(b,'story').length,10);
  b.fragments.push(call('old'));
  assert.equal(R.playlist(b,'old').length,3);
  assert.equal(R.playlist(b,'story').length,10);
});
test('回放按自然段合并，未听句不泄露，插播和陪听仍按真实来源落库',()=>{
  let b=R.insertCall(fixture(),{fragmentId:'story',index:1},call('call'));
  const queue=R.playlist(b,'story');
  queue.slice(0,4).forEach(row=>{b=R.reveal(b,row.fragmentId,row.index,'c');});
  const ps=R.replayParagraphs(b,'story');
  assert.deepEqual(ps[0].map(x=>x.text),['第一句。','第二句。']);
  assert.ok(!JSON.stringify(ps).includes('第三句'));assert.ok(!JSON.stringify(ps).includes('回到刚才'));
  assert.equal(R.companionContext(b,'other').heard.length,0);
  assert.ok(!R.companionPrompt(b,'c','问题').includes('第四句'));
  assert.equal(R.heardLines(b,'call').length,2);
});
test('插播提示收到当前定位和有限衔接原文，不带别章未播内容；陪听不进入故事',()=>{
  const b=fixture();b.fragments.push(R.accept({lines:[{kind:'character',text:'远处的秘密'}]},'future','future'));
  const p=R.callPrompt(b,'present',{name:'马甲'},'你好',{fragmentId:'story',index:0,rootId:'story'});
  for(const s of ['第一句','第二句','插播约定','陪听者在广播外']) assert.ok(p.includes(s));
  assert.ok(!p.includes('远处的秘密'));
});
test('发送前等本句结束，不切半句；停止与迟到结束都不会续播',async()=>{
  let end; const spoken=[], ended=[];
  const player=R.createPlayback({cancel(){},state(){},error(){},reveal(){},ended:i=>ended.push(i),speak:(s,cb)=>{spoken.push(s);end=cb;}});
  player.start([{text:'一句'},{text:'下一句'}],0,true);
  let resolved=false;const paused=player.pauseAfterLine().then(()=>{resolved=true;});
  await Promise.resolve();assert.equal(resolved,false);end();await paused;
  assert.deepEqual(spoken,['一句']);assert.deepEqual(ended,[0]);end();assert.equal(spoken.length,1);
  player.start([{text:'重试'}],0,true);const cancelled=player.pauseAfterLine();player.stop();await cancelled;
});
