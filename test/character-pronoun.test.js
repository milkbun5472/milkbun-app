const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const P = require('../js/character-pronoun.js');
const phone = require('../js/phone.js');

test('称呼只读明确性别，不从名字、头像或设定猜性别', () => {
  for (const gender of ['他','男','男性','男生','m','male','man']) assert.equal(P.ta({gender}), '他');
  for (const gender of ['她','女','女性','女生','f','female','woman']) assert.equal(P.ta({gender}), '她');
  for (const gender of ['TA','中性','nonbinary','未知'])
    assert.equal(P.ta({gender,name:'王爷',persona:'男，皇子',avatar:'male.png'}), 'TA');
  assert.equal(P.ta(null), 'TA');
  assert.equal(P.ta({gender:' Female '}), '她');
  for (const gender of [undefined,null,'','  ']) assert.equal(P.ta({gender}), '他');
});

test('旧档无性别沿用他，新建明确存TA，已选性别与原对象不变', () => {
  const old = {id:'old',name:'旧角色',persona:'原设定'};
  assert.equal(P.ta(old), '他');
  assert.equal(Object.hasOwn(old,'gender'), false);
  const fresh = P.newCharacter({id:'new',name:'新角色'});
  assert.equal(fresh.gender, 'TA');
  assert.equal(P.ta(JSON.parse(JSON.stringify(fresh))), 'TA');
  for (const gender of ['她','他','TA','female']) {
    const selected = {id:'selected',gender};
    assert.equal(P.newCharacter(selected), selected);
  }
  const app = fs.readFileSync('js/app.js','utf8');
  assert.ok(app.includes(': [...p, CharacterPronoun.newCharacter(c)]'));
  assert.ok(app.includes('CharacterPronoun.newCharacter({ id, name: (parsed.name'));
  assert.ok(app.includes('pC(prev => [...prev, CharacterPronoun.newCharacter({'));
  assert.ok(app.includes('pC(p => p.some(x => x.id === c.id) ? p : [...p, c])'), '找回旧角色不当成新建');
});

test('复数与其他、吉他等词保持原样，TA模板也跟随设置', () => {
  const fixed = '他们、他俩、他倆、他两、他仨、其他、他人、吉他、利他、他乡、排他、他日再见';
  assert.equal(P.text({gender:'女'}, '他的手机；'+fixed), '她的手机；'+fixed);
  assert.equal(P.text({gender:'男'}, 'TA在写，TA的订单'), '他在写，他的订单');
  assert.equal(P.text({}, '他在写'), '他在写');
  assert.equal(P.text(P.newCharacter({}), '他在写'), 'TA在写');
  assert.equal(P.text({gender:'女'}, 'DATA与TABLE'), 'DATA与TABLE');
  assert.equal(P.text({gender:'女'}, '他日历、他日记'), '她日历、她日记');
});

test('兼容旧PhonePronoun入口，无第二套性别判断', () => {
  assert.equal(globalThis.PhonePronoun, P);
  assert.equal(globalThis.CharacterPronoun, P);
  for (const gender of ['', '他', '她', 'TA']) assert.equal(phone.charTa({gender}), P.ta({gender}));
});

test('查手机生成各用各的角色；引用与原存档原封不动', () => {
  const original = '他告诉他们：吉他是他的，TA是我的笔名。';
  const known = {cards:[{quote:original}]};
  const before = JSON.stringify(known);
  const run = gender => phone.phoneProbeSpec('health', {name:'他山',gender}, [], '', [], known).instruction;
  assert.match(run('女'), /给她打分/);
  assert.match(run('男'), /给他打分/);
  assert.match(run(''), /给他打分/);
  assert.match(run('TA'), /给TA打分/);
  for (const gender of ['女','男','']) {
    assert.ok(run(gender).includes('他山'));
    assert.ok(run(gender).includes(original));
  }
  assert.equal(JSON.stringify(known), before);
});

test('共享脚本在页面组件前加载', () => {
  const html = fs.readFileSync('index.html','utf8');
  const i = html.indexOf('js/character-pronoun.js');
  assert.ok(i >= 0 && i < html.indexOf('js/core.js'));
});
