const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync(require('node:path').join(__dirname, '../js/app.js'), 'utf8');
const a = app.indexOf('  const neteaseSearchOne ='), b = app.indexOf('\n  };', a) + 5;
function fixture(fetch) {
  const ctx = { fetch, neteaseApi: 'https://music.invalid', Date: { now: () => 123 }, encodeURIComponent };
  vm.createContext(ctx); vm.runInContext(app.slice(a, b) + '\nthis.search = neteaseSearchOne;', ctx);
  return ctx.search;
}
test('五条业务链共用一个请求入口，错误策略显式保留', () => {
  assert.equal((app.match(/\/search\?keywords=/g) || []).length, 1);
  assert.match(app, /neteaseSearchOne\(want, \{ throwOnError: true \}\)/);
  assert.match(app, /neteaseSearchOne\(query, \{ throwOnError: true \}\)/);
  assert.match(app, /neteaseSearchOne\(tt, \{ cacheBust: false \}\)/);
  assert.match(app, /neteaseSearchOne\(q\)/);
  assert.match(app, /neteaseSearchOne\(w.title\)/);
});
test('中文及特殊字符编码、缓存参数、原始歌曲对象不变', async () => {
  const urls = [], song = { id: 1, name: '歌曲', ar: [{ name: '歌手' }], al: { picUrl: 'cover' } };
  const search = fixture(async url => { urls.push(url); return { json: async () => ({ result: { songs: [song, { id: 2 }] } }) }; });
  assert.equal(await search('歌 & A'), song);
  await search('邀请', { cacheBust: false });
  assert.equal(urls[0], 'https://music.invalid/search?keywords=' + encodeURIComponent('歌 & A') + '&limit=1&timestamp=123');
  assert.equal(urls[1], 'https://music.invalid/search?keywords=' + encodeURIComponent('邀请') + '&limit=1');
});
test('空结果返回 null，网络和解析错误按调用策略处理且不自动重试', async () => {
  for (const data of [null, {}, { result: {} }, { result: { songs: [] } }]) {
    assert.equal(await fixture(async () => ({ json: async () => data }))('x'), null);
  }
  for (const parse of [false, true]) {
    const error = new Error('offline'); let calls = 0;
    const search = fixture(async () => { calls++; if (!parse) throw error; return { json: async () => { throw error; } }; });
    assert.equal(await search('x'), null); assert.equal(calls, 1);
    await assert.rejects(search('x', { throwOnError: true }), e => e === error);
    assert.equal(calls, 2);
  }
});
