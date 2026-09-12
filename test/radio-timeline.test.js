const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/radio-timeline.js');
const make = () => R.create({id:'c', name:'测试角色', persona:'完整人物设定'}, '分岔', '边界', '世界书', 'b');
test('建线留存完整设定，频率共享分支连续性', () => {
  const b=make(); b.corrections.push('纠正');
  b.fragments.push(R.accept({title:'远处',lines:[{kind:'character',speaker:'测试角色',text:'未播放的未来'}]},'future','f'));
  const prompt=R.storyPrompt(b,'past');
  for(const s of ['完整人物设定','世界书','边界','纠正','未播放的未来']) assert.ok(prompt.includes(s));
  assert.equal(make().fragments.length,0);
  assert.throws(()=>R.create({},'','','','b'));
  assert.throws(()=>R.accept({lines:[{kind:'other',text:'x'}]},'past','x'));
  assert.throws(()=>R.accept({lines:[]},'past','x'));
});
test('陪听仅收到共同揭示的句子，不泄露全稿或独听内容', () => {
  let b=make();
  b.fragments.push(R.accept({lines:[{kind:'narrator',text:'独听'},{kind:'character',text:'共同听到'},{kind:'character',text:'未播秘密'}]},'present','f'));
  b=R.reveal(b,'f',0,'');
  assert.throws(()=>R.companionPrompt(b,'c','问题'));
  b=R.reveal(b,'f',1,'c');
  assert.equal(R.reveal(b,'f',1,'c'),b);
  assert.equal(R.reveal(b,'f',99,'c'),b);
  const prompt=R.companionPrompt(b,'c','问题');
  assert.ok(prompt.includes('共同听到'));
  for(const secret of ['独听','未播秘密','分岔','完整人物设定']) assert.ok(!prompt.includes(secret));
  assert.equal(R.companionContext(b,'other').heard.length,0);
  b.fragments[0].lines[1].text='改写';
  assert.equal(b.heard[1].text,'共同听到');
});
