const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');
const engine = read('engine.js'), a = engine.indexOf('function neteaseTrackInfo('), b = engine.indexOf('\n}', a) + 2;
const ctx = {}; vm.createContext(ctx); vm.runInContext(engine.slice(a, b), ctx);
const info = (s, opts) => ctx.neteaseTrackInfo(s, opts);
test('长短字段格式得到同样歌手封面，保留 ID 与标题', () => {
  for (const fields of [{ artists: [{ name: '甲' }, { name: '' }, { name: '乙' }], album: { picUrl: 'cover' } },
    { ar: [{ name: '甲' }, { name: '' }, { name: '乙' }], al: { picUrl: 'cover' } }]) {
    const s = { id: 123, name: '歌', ...fields }, before = JSON.stringify(s);
    assert.deepEqual(JSON.parse(JSON.stringify(info(s))), { id: 123, name: '歌', artist: '甲 / 乙', cover: 'cover' });
    assert.equal(JSON.stringify(s), before);
  }
});
test('两格式同时存在保留原优先级，空字段不偷偷替换', () => {
  const s = { artists: [{ name: '长' }], ar: [{ name: '短' }], album: { picUrl: 'long' }, al: { picUrl: 'short' } };
  assert.equal(info(s).artist, '长'); assert.equal(info(s).cover, 'long');
  assert.equal(info(s, { preferShort: true }).artist, '短'); assert.equal(info(s, { preferShort: true }).cover, 'short');
  assert.equal(info({ artists: [], ar: s.ar }).artist, '');
  assert.equal(info({}).artist, ''); assert.equal(info({}).cover, undefined);
});
test('业务入口接公共映射，存档 ID 和候选回退仍由调用方决定', () => {
  const app = read('app.js'), screens = read('screens.js');
  assert.equal((app.match(/neteaseTrackInfo\(/g) || []).length, 5);
  assert.match(screens, /neteaseTrackInfo\(s, \{ preferShort: true \}\)/);
  assert.doesNotMatch(app, /\(\w+\.artists \|\| \w+\.ar \|\| \[\]\)\.map/);
  assert.match(app, /const artist = info.artist \|\| \(w.artist \|\| ""\)/);
  assert.match(app, /id: "sgd_" \+ sr.id/);
  assert.match(app, /title: hit.name \|\| w.title/);
});
