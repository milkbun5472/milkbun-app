// 朋友圈「↻ 更多评论」（她 2026-09-29 要的）
//
// 她点明两条，这份测试守的就是这两条：
//   1.「现在生成的回复逻辑就很好，回复就是继续这个逻辑」
//      → 不许另开一套生成器。commentMoment 必须是【调用 momentReplies】，
//        而不是自己再写一遍 roster / prompt / 落盘。
//   2.「朋友圈应该只有共友，不要随机 NPC 之类的，要人设里有的合理的」
//      → 名单只从跟发帖人真有关系的角色算；模型报回名单外的人一律丢掉；
//        回复对象只认【评论区里真出现过的名字】。
//
// ⚠️桩照【写存档的那一段】写（施工规则/stub-from-the-writer）：
//   落盘口只有 pMom → saveJSON("x_moments")，评论项就是 {author, text} 两格，
//   定向回复是把 "回复 X：" 拼进 text —— 不是我以为的 replyToId。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const app = fs.readFileSync('js/app.js', 'utf8');

// 锚只钉函数名/常量名（施工规则/anchor-on-code）
const i = app.indexOf('  const momentReplies = async (mom, opts) => {');
const j = app.indexOf('  // 我发一条朋友圈（可带图描述、可选可见范围）');
assert.ok(i > 0 && j > i, '抠不出 momentReplies 那一段');
const src = app.slice(i, j);

test('① 回复逻辑只有一份：commentMoment 和刷更多都走 momentReplies', () => {
  assert.match(src, /const commentMoment = async \(id, text, replyTo\) => \{/);
  assert.match(src, /await momentReplies\(moments\.find\(m => m\.id === id\), \{ text, replyTo \}\)/,
    'commentMoment 必须转交给 momentReplies，不许自己再写一遍');
  assert.match(src, /await momentReplies\(mom, \{ more: true \}\)/,
    '刷更多也必须走同一条');
  // 整段里只许出现一处 callAI —— 出现第二处就是又抄了一份生成逻辑
  assert.equal((src.match(/await callAI\(/g) || []).length, 1,
    '评论区的生成调用只许有一处（one-public-mechanism）');
  // roster / 兜底 / 容错解析都只许有一份
  assert.equal((src.match(/const roster =|roster = /g) || []).length > 0, true);
  assert.equal((src.match(/const fallbackText = /g) || []).length, 1);
});

test('② 刷更多不许伪造「回复我」，失败就是这一轮没人说话', () => {
  assert.match(src, /if \(more\) return;\s*\/\/ 刷更多失败就是这一轮没人说话/,
    'catch 兜底必须在 more 档直接退出');
  // 前缀那一处：more 档不许写死 "回复 " + meName
  const pre = src.slice(src.indexOf('const prefixFor ='), src.indexOf('reps.forEach('));
  assert.ok(pre.includes('if (!more) return "回复 " + meName'), '原档前缀不变');
  assert.ok(pre.includes('inThreadNames.includes(to)'),
    'more 档的「回复谁」只许认评论区里真出现过的名字');
});

test('③ 只有共友：提示里把「不许出现名单外的人」写明', () => {
  const ask = src.slice(src.indexOf('const moreAsk ='), src.indexOf('const system ='));
  assert.ok(ask.includes('只许是这几个人'), '必须点明只许名单内');
  assert.ok(/没有路人|没有陌生网友/.test(ask), '必须点明没有路人 NPC');
  assert.ok(ask.includes('roster.join'), '名单必须就是算好的 roster，不许另造');
});

test('④ 进行中锁：重复点不叠发', () => {
  const g = app.slice(app.indexOf('  const genMoreMomentComments = async id =>'), j);
  assert.match(g, /momentMoreInflight\.current\[id\]/);
  assert.match(g, /finally \{[\s\S]*momentMoreInflight\.current\[id\] = false/);
});

test('⑤ 按钮接到底：app → 聊天页 → MomentsFeed 三段都串上了', () => {
  const comp = fs.readFileSync('js/components.js', 'utf8');
  assert.match(app, /onMoreMomentComments: genMoreMomentComments/);
  assert.match(app, /momentMoreBusy: gen\.momentMore \|\| null/);
  assert.match(comp, /onMore: onMoreMomentComments/);
  assert.match(comp, /moreBusy: momentMoreBusy/);
  assert.match(comp, /"↻ 更多评论"/);
});

// ── 真跑一遍：more 档的落盘形状 ───────────────────────────────────
// 把 prefixFor 那一小段单独抠出来跑，验「名单外的人不给前缀」。
test('⑥ 模型凭空造一个人当 replyTo：当它没填，不许写出「回复 路人：」', () => {
  const comments = [{author:'阿川', text:'先来一条'}, {author:'我', text:'嗯'}];
  const momentWho = x => String(x == null ? '' : x).trim();
  const more = true, meName = '我';
  const inThreadNames = [...new Set(comments.map(c => momentWho(c && c.author)).filter(Boolean))];
  const prefixFor = r => {
    if (!more) return "回复 " + meName + "：";
    const to = momentWho(r.replyTo);
    return to && to !== momentWho(r.author) && inThreadNames.includes(to) ? "回复 " + to + "：" : "";
  };
  assert.equal(prefixFor({author:'沈屿白', replyTo:'阿川'}), '回复 阿川：');
  assert.equal(prefixFor({author:'沈屿白', replyTo:'路过的网友'}), '', '名单外 → 当它在回这条动态本身');
  assert.equal(prefixFor({author:'阿川', replyTo:'阿川'}), '', '不许自己回自己');
  assert.equal(prefixFor({author:'沈屿白', replyTo:null}), '', '回动态本身没有前缀');
});
