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
  src + ';return { offlineSummarySource: offlineSummarySource, offlineSummaryChunks: offlineSummaryChunks, CAP: OFFLINE_SUM_FED_CAP };')(
  win, m => !!(m && m.kind === 'ooc'));

const line = m => '甲：' + (m.content || '');
const msgs = n => Array.from({ length: n }, (_, i) => ({ role: 'char', content: '第' + i + '句' + '字'.repeat(60) }));

// ⚠️v72.03：治「撞上限」的办法从【切尾巴】换成了【分段跑】（她 2026-09-20 拍的 A）。
//   切尾巴那一版的代价是她转来的那条反馈：总结丢上文、基本上只剩后半段的剧情。
//   所以这两条改钉新的契约：整场原样交出去，谁都不许被跳过；分块由 offlineSummaryChunks 做，
//   每一块仍然不超上限——撞上限那个老毛病照样治住了。
test('整场原样交给总结那一层，一句都不许先被切掉', () => {
  const { offlineSummarySource } = build({ ChatContextWindow });
  const out = offlineSummarySource({ msgs: msgs(400), summary: '' }, line);
  assert.match(out, /第0句/);
  assert.match(out, /第399句/);
});

test('长场次按块切，每块都不超上限，而且一个字不丢', () => {
  const { offlineSummarySource, offlineSummaryChunks, CAP } = build({ ChatContextWindow });
  const text = offlineSummarySource({ msgs: msgs(400), summary: '' }, line);
  assert.ok(text.length > CAP, '这个桩本来就该超上限，不然这条测试什么都没测');
  const chunks = offlineSummaryChunks(text, CAP);
  assert.ok(chunks.length > 1, '超了上限却没切块，那就会整枪撞上限抛错');
  chunks.forEach(c => assert.ok(c.length <= CAP + 200, '有一块超了上限：' + c.length));
  assert.equal(chunks.join('\n').length, text.length, '切完字数对不上——丢字了');
  assert.match(chunks[0], /第0句/);
  assert.match(chunks[chunks.length - 1], /第399句/);
});

// 这一条留着：不管有没有那把剪刀，交出去的都是整场（以前是「拿不到剪刀才整段发」）
test('拿不到公共那把剪刀也照样是整场', () => {
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
