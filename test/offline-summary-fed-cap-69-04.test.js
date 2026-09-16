// 她 2026-09-16：「宝宝为什么线下总结会失败」
// 查出来的病根：喂进总结的那一段【一个上限都没有】——存档那份该存全的没错，
// 可通话记录、线上注入的 transcript 都是「存全的、喂回去只切尾巴」，
// 唯独线下总结这一路把整场原样塞进一次 callAI，长了就直接撞模型输入上限、整枪抛错。
// 而 app 那头 catch (e) {} 把错吞了，界面照说「已结束」，于是失败长得像「悄悄没总结」。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const ChatContextWindow = require('../js/chat-context-window.js');

const src = engine.slice(
  engine.indexOf('const OFFLINE_SUM_FED_CAP'),
  engine.indexOf('async function summarizeOffline(p, ctx, session, already)'));
const build = win => new Function('window', 'isOocMsg',
  src + ';return { offlineSummarySource: offlineSummarySource, CAP: OFFLINE_SUM_FED_CAP };')(
  win, m => !!(m && m.kind === 'ooc'));

const line = m => '甲：' + (m.content || '');
const msgs = n => Array.from({ length: n }, (_, i) => ({ role: 'char', content: '第' + i + '句' + '字'.repeat(60) }));

test('线下总结喂回去的那一段有上限，超了只发尾巴', () => {
  const { offlineSummarySource, CAP } = build({ ChatContextWindow });
  const long = { msgs: msgs(400), summary: '' };
  const out = offlineSummarySource(long, line);
  assert.ok(out.length <= CAP, '切完还超上限：' + out.length);
  // 切的是头不是尾：最后一句必须在，第一句必须不在
  assert.match(out, /第399句/);
  assert.doesNotMatch(out, /第0句字/);
});

test('切掉的早段由前情提要顶上，没切时不多插一段', () => {
  const { offlineSummarySource } = build({ ChatContextWindow });
  const pre = '滚动总结攒下的前情提要';
  assert.match(offlineSummarySource({ msgs: msgs(400), summary: pre }, line), new RegExp(pre));
  // 短的一场原样发，不该凭空多出「前情提要」那一段（她点开看的完整经过不是这条路，但别让模型读到假分段）
  const short = offlineSummarySource({ msgs: msgs(3), summary: pre }, line);
  assert.doesNotMatch(short, /前情提要/);
  assert.match(short, /第0句/);
});

test('拿不到公共那把剪刀就整段发，不自己乱切', () => {
  const { offlineSummarySource } = build({});
  const out = offlineSummarySource({ msgs: msgs(400), summary: '' }, line);
  assert.match(out, /第0句/);
  assert.match(out, /第399句/);
});

test('OOC 两路都不进总结，单人和群共用同一个取材口', () => {
  const { offlineSummarySource } = build({ ChatContextWindow });
  const out = offlineSummarySource({ msgs: [{ role: 'char', content: '正文' }, { role: 'char', kind: 'ooc', content: 'OOC私话' }] }, line);
  assert.doesNotMatch(out, /OOC私话/);
  // 一份取材口喂两处（施工规则/one-public-mechanism.md）：两个 summarize 都不许再自己 map 一遍
  assert.equal((engine.match(/const text = offlineSummarySource\(session,/g) || []).length, 2);
  assert.doesNotMatch(engine, /\(session\.msgs \|\| \[\]\)\.filter\(m => m\.kind !== "ooc"\)\.map/);
});

test('总结失败要说真话，不许吞了还说「已结束」', () => {
  // ⚠️吞掉的代价不是少一条提示，是她根本不知道这一场没进记忆库
  assert.doesNotMatch(app, /summarizeOffline\(offlineApiFor[\s\S]{0,400}?\} catch \(e\) \{\}/);
  assert.equal((app.match(/catch \(e\) \{ sumErr = \(e && e\.message\) \|\| String\(e\); \}/g) || []).length, 2);
  assert.equal((app.match(/sumErr \? "这场没记进记忆库：" \+ sumErr/g) || []).length, 2);
});
