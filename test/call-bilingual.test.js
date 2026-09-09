const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const engine = fs.readFileSync('js/engine.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const comp = fs.readFileSync('js/components.js', 'utf8');
const functions = engine.slice(engine.indexOf('function splitBilingual('), engine.indexOf('const TRANS_CACHE_KEY'));
const { callBilingualLines, callBilingualRule } = new Function(functions + ';return {callBilingualLines,callBilingualRule};')();
const body = app.slice(app.indexOf('const splitSayLine = str => {'), app.indexOf('const pushMsg = line =>'));
const split = new Function('stripName', 'return ' + body.replace(/^const splitSayLine = /, '').replace(/;\s*$/, ''))(s => String(s || '').trim());

test('通话双语先拆中译，译文括号不冒充动作；原文保留供朗读', () => {
  assert.deepEqual(callBilingualLines('Hello | 你好（轻声）', true, split), [{ speech: 'Hello', zh: '你好（轻声）' }]);
  assert.deepEqual(callBilingualLines('（微笑）Hello | 你好', true, split), [{ act: '微笑' }, { speech: 'Hello', zh: '你好' }]);
  assert.deepEqual(callBilingualLines('你好', true, split), [{ speech: '你好' }]);
  assert.deepEqual(callBilingualLines('Hello | 你好', false, split), split('Hello | 你好'));
  assert.deepEqual(callBilingualLines('价格3|5元', true, split), split('价格3|5元'));
});
test('单人和混合群按说话人的双语设置注入，无开关不发', () => {
  const people = [{id:'a',name:'甲'}, {id:'b',name:'乙'}, {id:'c',name:'丙'}];
  const settings = {a:{bilingual:true},b:{},c:{bilingual:true,engineerEyes:true}};
  const rule = callBilingualRule(people, id => settings[id]);
  assert.match(rule, /「甲」/);
  assert.doesNotMatch(rule, /「乙」|「丙」/);
  assert.match(rule, /say.*text/);
  assert.equal(callBilingualRule(people, () => ({})), '');
});
test('流式、尾部对账和群通话均走同一拆分出口，字幕随真实转录写入', () => {
  assert.match(app, /callSystem = sys \+ roomPromptFor\(char.id, cur.room\) \+ callBiHint/);
  assert.match(app, /callAI\(active, sys \+ callBiHint, hist/);
  assert.match(app, /callLines\(stripName\(sy\) \|\| "", char\)/);
  assert.match(app, /acc.concat\(callLines\(sy, char\)\)/);
  assert.match(app, /callLines\(arr\[i\].text, spk\)/);
  const writer = app.match(/const log = \(cur.msgs \|\| \[\]\).map\(m => \((.*?)\)\);/)[1];
  const saved = new Function('m', 'return (' + writer + ')')({role:'char',content:'Hello',zh:'你好',ts:1});
  assert.equal(saved.content, 'Hello'); assert.equal(saved.zh, '你好');
  assert.match(app, /ttsSpeak\(ln.speech, char.voiceId\)/);
});
test('通话现场与两处回看复用译键，深色通话传自己的前景色', () => {
  assert.match(comp, /h\(TransText, \{ text: m.content, isU, zhReady: m.zh, ink: callBubble\(isU\).color \}\)/);
  assert.equal((comp.match(/h\(TransText, \{ text: l.content, isU: l.role === "user", zhReady: l.zh, ink: t.ink \}\)/g)||[]).length,2);
  assert.match(comp, /tp.toggle\(i, m.content, spk.voiceId\)/);
});
