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
test('回放按原句序去重，独听也可回放，未播句不入回放', () => {
  let b=make();
  b.fragments.push(R.accept({lines:[{kind:'character',text:'一'},{kind:'character',text:'二'},{kind:'character',text:'三'}]},'past','f'));
  b=R.reveal(b,'f',1,'c'); b=R.reveal(b,'f',0,''); b=R.reveal(b,'f',0,'c');
  assert.deepEqual(R.heardLines(b,'f').map(x=>x.text),['一','二']);
  assert.deepEqual(R.heardLines(b,'other'),[]);
  assert.equal(R.heardLines(JSON.parse(JSON.stringify(b)),'f').length,2);
});
test('完整章节不裁字、不截句，提示改为人物独白而非对用户小对话', () => {
  const lines=Array.from({length:90},(_,i)=>({kind:'character',speaker:'测试角色',text:('这是完整叙述。').repeat(4)+i}));
  const f=R.accept({title:'章节',lines},'present','f');
  assert.equal(f.lines.map(x=>x.text).join(''),lines.map(x=>x.text).join(''));
  assert.ok(f.lines.length>lines.length, '生成器把多句塞进一项时，仍按句界显示且不丢正文');
  const prompt=R.storyPrompt(make(),'present');
  for(const s of ['第一人称','完整故事章节','1200—2200','用户是收听者','不重复开场','每项是一句完整的话']) assert.ok(prompt.includes(s));
  for(const s of ['每次只展开一小段','少量第三人称场景交代与人物直接台词交替','过去补一个片刻']) assert.ok(!prompt.includes(s));
  const app=require('node:fs').readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
  assert.match(app,/onFragment: \(branch, era\) => radioAsk\(narrativeCore\(\{ intimate: true, register: false \}\)/);
});

// 她 2026-09-12（看着 v67.41 的已听回放）：「我想要长一点的第一人称独白关于他自己的事，
// 但是现在还是短的对着我说话的小节」。截图里那几句正是三样都占：
//   「他把降噪耳机的单侧耳罩拨开一点」——第三人称旁白
//   「姐姐，你戴上听听看。」——对着屏幕外的她说话
//   一句一张卡——那是播放器的形状，不是这一条要管的
test('独白只有他一个声音：没有旁白、没有第三人称交代', () => {
  const prompt = R.storyPrompt(make(), 'present');
  assert.ok(prompt.includes('全篇只有他一个人的声音'));
  assert.ok(prompt.includes('**不要旁白、不要第三人称交代**'));
  assert.ok(prompt.includes('不是「他把耳罩拨开一点」，是「我把耳罩拨开一点」'), '给判据就要给得看得出差别');
  assert.ok(prompt.includes('**不要输出kind=narrator的项**'));
  // 占位值里也不许再摆着 narrator——摆着它模型就会用
  const app = require('node:fs').readFileSync(require('node:path').join(__dirname, '../js/app.js'), 'utf8');
  assert.match(app, /"kind":"character","speaker":"讲述这段经历的角色姓名"/);
  assert.ok(!/"kind":"character或narrator"/.test(app), '占位值里的旁白那一档又回来了');
  // accept 那头照旧认 narrator：旧存档里那些行还在，别把它们判成坏数据
  assert.doesNotThrow(() => R.accept({ lines: [{ kind: 'narrator', text: '旧存档里的一行' }] }, 'past', 'x'));
});

test('不对着屏幕外的人说话——称呼、提问、等回应都不要', () => {
  const prompt = R.storyPrompt(make(), 'present');
  assert.ok(prompt.includes('用户是收听者'), 'Codex v67.41 那句还在');
  assert.ok(prompt.includes('他不是在对谁说话'));
  assert.ok(prompt.includes('没有称呼（姐姐、宝宝、名字、你，一个都不要）'), '她截图里那句就是「姐姐，你戴上听听看」');
  assert.ok(prompt.includes('这段独白仍然不是说给她听的'), '她进了故事也还是故事里的一个人，不是收件人');
});

test('「现在」这一档也是讲完一段，不是同步播报此刻', () => {
  const prompt = R.storyPrompt(make(), 'present');
  assert.ok(prompt.includes('不是现场直播'));
  assert.ok(prompt.includes('哪怕频率是「现在」'), '不点名的话，「现在」那一档会被读成实况');
  // v67.41 的篇幅和连续性要求一条都没动
  for (const s of ['1200—2200', '不重复开场', '每项是一句完整的话']) assert.ok(prompt.includes(s), '顺手把 Codex 那几条改掉了：' + s);
});
