const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');
const source = read('music-source.js');
function fixture(answer, initial = []) {
  let now = 1000000;
  const calls = [], storage = { x_gdMusicCalls: JSON.stringify(initial) };
  const ctx = { URL, Map, Promise, AbortController, setTimeout, clearTimeout,
    Date: { now: () => now }, localStorage: { getItem: k => storage[k], setItem: (k, v) => storage[k] = v },
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => answer(url) }; } };
  vm.createContext(ctx); vm.runInContext(source + '\nthis.api = MusicSource;', ctx);
  return { ...ctx, calls, storage, tick: n => now += n };
}
const gd = { provider: 'gd', base: 'https://private.invalid', cookie: 'MUSIC_U=private' };
test('GD 搜索按官方返回映射，带上封面/歌词 ID，不泄漏私有接口和 Cookie', async () => {
  // https://music-api.gdstudio.xyz/api.php 搜索写出的字段，与实测响应一致。
  const raw = { id: '381849', name: '西湖', artist: ['痛仰乐队'], album: '不要停止我的音乐', pic_id: '109951169200439396', lyric_id: '381849', source: 'netease' };
  const f = fixture(() => [raw]);
  const d = await f.api.request(gd, '/cloudsearch?keywords=' + encodeURIComponent('西湖 & 痛仰') + '&limit=30');
  assert.equal(d.result.songs[0].gdPicId, raw.pic_id);
  assert.equal(d.result.songs[0].gdLyricId, raw.lyric_id);
  assert.equal(d.result.songs[0].artists[0].name, '痛仰乐队');
  const req = f.calls[0], url = new URL(req.url);
  assert.equal(url.searchParams.get('name'), '西湖 & 痛仰');
  assert.equal(url.hostname, 'music-api.gdstudio.xyz');
  assert.equal(req.options.credentials, 'omit');
  assert.doesNotMatch(JSON.stringify(req), /MUSIC_U|private|cookie/);
});
test('GD 音频、歌词、封面共用请求缓存，并且拒绝危险音频地址', async () => {
  const f = fixture(url => {
    const type = new URL(url).searchParams.get('types');
    return type === 'lyric' ? { lyric: '[00:01]测试', tlyric: '' } : { url: 'https://audio.invalid/track.mp3', br: 320 };
  });
  const [a, b] = await Promise.all([f.api.request(gd, '/song/url/v1?id=1'), f.api.request(gd, '/song/url/v1?id=1')]);
  assert.equal(a.data[0].url, b.data[0].url); assert.equal(f.calls.length, 1);
  await f.api.request(gd, '/song/url/v1?id=1'); assert.equal(f.calls.length, 1);
  f.tick(61000); await f.api.request(gd, '/song/url/v1?id=1'); assert.equal(f.calls.length, 2);
  assert.equal((await f.api.request(gd, '/lyric?id=1')).lrc.lyric, '[00:01]测试');
  assert.equal(await f.api.cover('pic'), 'https://audio.invalid/track.mp3');
  assert.equal((await fixture(() => ({ url: 'javascript:bad' })).api.request(gd, '/song/url?id=1')).data[0].url, '');
});
test('账号接口在 GD 模式不发请求；错误不自动重试；本机限流跨刷新保留', async () => {
  const f = fixture(() => []);
  await assert.rejects(f.api.request(gd, '/user/account'), /不提供网易云账号功能/);
  assert.equal(f.calls.length, 0);
  const limited = fixture(() => [], Array(45).fill(999999));
  await assert.rejects(limited.api.request(gd, '/search?keywords=x'), /限额/);
  assert.equal(limited.calls.length, 0);
  limited.tick(300001); await limited.api.request(gd, '/search?keywords=x');
  assert.equal(limited.calls.length, 1);
  const bad = fixture(() => { throw new Error('offline'); });
  await assert.rejects(bad.api.request(gd, '/search?keywords=x'), /offline/);
  assert.equal(bad.calls.length, 1);
  await assert.rejects(bad.api.request(gd, '/search?keywords=x'), /offline/);
  assert.equal(bad.calls.length, 2, '失败 promise 不可永久挂住');
});
test('原接口仍用原地址和账号；不开 GD 不产生 GD 请求', async () => {
  const f = fixture(() => ({ lrc: { lyric: 'old' } }));
  const d = await f.api.request({ provider: 'netease', base: 'https://my.invalid', cookie: 'MUSIC_U=x' }, '/lyric?id=1');
  assert.equal(d.lrc.lyric, 'old');
  assert.equal(new URL(f.calls[0].url).hostname, 'my.invalid');
  assert.equal(new URL(f.calls[0].url).searchParams.get('cookie'), 'MUSIC_U=x');
  await assert.rejects(f.api.request({ provider: 'netease', base: '' }, '/search?keywords=x'), /先配置/);
});
test('写入方保留 GD 元数据，收藏/歌单/唱片不会丢；旧网易云 ID 不迁移', () => {
  const app = read('app.js'), engine = read('engine.js'), screens = read('screens.js');
  assert.match(app, /const resultToSong = s => \(\{[^\n]*source: "netease", neteaseId: String\(s.id\)[^\n]*gdPicId: s.gdPicId, gdLyricId: s.gdLyricId/);
  assert.match(app, /const cloneSong = s => \(\{ \.\.\.s,/);
  assert.match(app, /added.push\(\{[^\n]*gdPicId: info.gdPicId, gdLyricId: info.gdLyricId/);
  assert.match(engine, /gdPicId: s.gdPicId/);
  assert.match(app, /saveListen\(p => \(\{ \.\.\.p, musicProvider: value === "gd"/);
  assert.match(screens, /musicRead\("\/lyric\?id=/);
  assert.match(app, /musicRequest\("\/lyric\?id=/);
  assert.match(screens, /canSearch \? navBtn\("cloud"/);
  assert.match(screens, /!gdMusic \? rowBtn\("cloudplus"/);
  assert.match(screens, /来源：GD 音乐台（music.gdstudio.xyz）/);
});

test('批量搜歌遇到 GD 限流立即向调用方报错，不把失败变成下一轮模型候选', async () => {
  const app = read('app.js'), start = app.indexOf('  const neteaseSearchOne =');
  const fn = app.slice(start, app.indexOf('\n  };', start) + 5);
  const error = new Error('GD 限流'); let calls = 0;
  const ctx = { musicProvider: 'gd', encodeURIComponent, musicRequest: async () => { calls++; throw error; } };
  vm.createContext(ctx); vm.runInContext(fn + '\nthis.search = neteaseSearchOne;', ctx);
  await assert.rejects(ctx.search('测试'), e => e === error);
  assert.equal(calls, 1);
});
