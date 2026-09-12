const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/radio-timeline.js');

function fixture() {
  let branch = R.create({id:'c',name:'测试',persona:'测试人物'}, '分岔', '', '', 'b');
  const fragment = R.accept({title:'章节',lines:[{kind:'character',speaker:'测试',text:'第一句。第二句。第三句。'}]}, 'present', 'f');
  branch.fragments.push(fragment);
  const calls = [], states = [], errors = [];
  const player = R.createPlayback({cancel(){},state:x=>states.push(x),error:x=>errors.push(x),
    reveal:index=>{branch=R.reveal(branch,'f',index,'c');},
    speak:(text,end,fail)=>calls.push({text,end,fail})});
  return {player,fragment,calls,states,errors,branch:()=>branch};
}
test('连播仅在本句结束后揭示下一句，本章结束停下，陪听不提前知道后文',()=>{
  const x=fixture();x.player.start(x.fragment.lines,0,true);
  assert.equal(x.calls.length,1);assert.equal(R.companionContext(x.branch(),'c').heard.length,1);
  x.calls[0].end();x.calls[0].end();assert.equal(x.calls.length,2);
  x.calls[1].end();x.calls[2].end();assert.equal(x.calls.length,3);
  assert.equal(x.states.at(-1),false);assert.equal(x.branch().heard.length,3);
});
test('暂停后迟到的回调不能续播，重试从指定句开始并去重',()=>{
  const x=fixture();x.player.start(x.fragment.lines,0,true);x.player.stop();x.calls[0].end();
  assert.equal(x.calls.length,1);
  x.player.start(x.fragment.lines,0,true);x.calls[0].fail(Error('迟到'));
  assert.equal(x.errors.length,0);x.calls[1].end();assert.equal(x.calls.length,3);
  assert.equal(x.branch().heard.length,2);
});
test('单句播放不推进，播放报错停止不自动重试',()=>{
  const x=fixture();x.player.start(x.fragment.lines,1,false);x.calls[0].end();
  assert.equal(x.calls.length,1);assert.equal(x.states.at(-1),false);
  x.player.start(x.fragment.lines,1,true);x.calls[1].fail(Error('设备拒绝'));
  x.calls[1].end();assert.equal(x.calls.length,2);assert.equal(x.errors.length,1);
  assert.equal(x.states.at(-1),false);
});
