const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fic = fs.readFileSync(path.join(__dirname, '../js/fanfic.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

test('跳章消费后的空值不覆盖阅读位置，普通打开保留已读章', () => {
  const end = fic.indexOf('}, [props.startChap]);');
  const start = fic.lastIndexOf('useEffect(function () {', end);
  const effect = new Function('props', 'setChapIdx', fic.slice(start + 'useEffect(function () {'.length, end));
  let chapter = 3, consumed = false;
  const props = { fic: { chapters: [{}, {}, {}, {}, {}] }, startChap: null,
    onStartChapUsed() { consumed = true; props.startChap = null; } };
  const run = () => effect(props, value => { chapter = value; });
  run(); assert.equal(chapter, 3); assert.equal(consumed, false);
  props.startChap = 2; run(); assert.equal(chapter, 2); assert.equal(consumed, true);
  run(); assert.equal(chapter, 2);
  props.startChap = 0; run(); assert.equal(chapter, 0);
  props.startChap = 99; run(); assert.equal(chapter, 4);
  for (const invalid of [undefined, '', -1, NaN, Infinity, 1.5]) {
    props.startChap = invalid; run(); assert.equal(chapter, 4);
  }
});

test('阅读页作者按钮离开Reader的提前返回分支', () => {
  const body = fic.match(/onOpenAuthor: function \(nm\) \{([^}]+)\}/)[1];
  let openId = 'book', view = 'feed', author = '';
  new Function('nm', 'setOpenId', 'setAuthorStart', 'setView', body)(
    '作者甲', v => { openId = v; }, v => { author = v; }, v => { view = v; });
  assert.equal(openId, null); assert.equal(view, 'authors'); assert.equal(author, '作者甲');
});

test('房间交稿真实落库段合并facts/seed/paid，保留正文署名及另一篇', () => {
  const metaStart = fic.indexOf('function applyChapterMeta(');
  const metaEnd = fic.indexOf('\n  // ---- 追更', metaStart);
  const applyChapterMeta = new Function('BIBLE_CAP', 'SEED_CAP', fic.slice(metaStart, metaEnd) + ';return applyChapterMeta;')(100, 100);
  // 字段来自genNextChapter的解析出口，署名来自房间交稿写入方。
  assert.match(fic, /facts: Array\.isArray\(d\.facts\) \? d\.facts : \[\]/);
  const ch = { content: '新正文', facts: ['新事实'], seed: '新伏笔', paid: ['旧伏笔'] };
  const f = { id: 'book', chapters: [{ content: '旧正文' }], bible: ['旧事实'], seeds: ['旧伏笔'] };
  const other = { id: 'other', chapters: [] };
  const K = { loadFics: () => [f, other], applyChapterMeta, heatFields: () => ({ authorHeat: 10 }) };
  const start = app.indexOf('const fics = K.loadFics().map', app.indexOf('onOpenFicInvite: async'));
  const end = app.indexOf('K.saveFics(fics);', start);
  const result = new Function('K', 'f', 'ch', 'nm', 'cid', 'activeChar', app.slice(start, end) + 'return fics;')(K, f, ch, '角色甲', 'c1', { id: 'c1' });
  assert.deepEqual(result[0].bible, ['旧事实', '新事实']);
  assert.deepEqual(result[0].seeds, ['新伏笔']);
  assert.equal(result[0].chapters[1].byCharId, 'c1');
  assert.equal(result[0].chapters[1].content, '新正文');
  assert.equal(result[1], other);
  assert.deepEqual(f.bible, ['旧事实']); assert.deepEqual(f.seeds, ['旧伏笔']);
});
