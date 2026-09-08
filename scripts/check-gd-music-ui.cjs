// 独立浏览器、虚构存档/音乐响应；不调用模型，不读用户浏览器数据。
const { chromium } = require('playwright');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(root + '/')) { res.writeHead(403); return res.end(); }
    try {
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
      res.end(fs.readFileSync(file));
    } catch (_) { res.writeHead(404); res.end(); }
  }).listen(0, '127.0.0.1');
  await new Promise(r => server.on('listening', r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [390, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await ctx.newPage(), errors = [], calls = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('https://**/*', route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'music-api.gdstudio.xyz') {
          calls.push(url);
          const type = url.searchParams.get('types');
          const data = type === 'search' ? [{ id: '123', name: '测试曲', artist: ['测试歌手'], pic_id: '456', lyric_id: '123', source: 'netease' }]
            : type === 'lyric' ? { lyric: '[00:00]测试歌词' } : { url: 'https://music-fixture.invalid/' + (type === 'pic' ? 'cover.svg' : 'song.wav') };
          return route.fulfill({ json: data, headers: { 'access-control-allow-origin': '*' } });
        }
        if (url.hostname === 'music-fixture.invalid') {
          if (url.pathname.endsWith('.svg')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#447788"/></svg>' });
          const wav = Buffer.alloc(44 + 160000); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(160000, 40);
          return route.fulfill({ contentType: 'audio/wav', body: wav });
        }
        return route.abort();
      });
      await page.goto('http://127.0.0.1:' + server.address().port);
      await page.getByText('翻 开', { exact: true }).click();
      await page.getByText('点这里添加你们在听的歌', { exact: true }).click();
      assert.equal(await page.locator('#listen-music-provider').inputValue(), 'netease');
      await page.locator('#listen-music-provider').selectOption('gd');
      const bounds = await page.locator('#listen-music-provider').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.getByText('发现', { exact: true }).click();
      await page.getByPlaceholder('搜网易云全库：歌名 / 歌手').fill('测试曲');
      await page.getByRole('button', { name: '搜', exact: true }).click();
      await page.getByRole('button', { name: '测试曲 测试歌手', exact: true }).waitFor();
      assert.equal(await page.getByTitle('加进网易云歌单', { exact: true }).count(), 0);
      await page.getByTitle('收进咱家歌库', { exact: true }).click();
      await page.getByRole('button', { name: '测试曲 测试歌手', exact: true }).click();
      await page.waitForFunction(() => { const a = document.querySelector('audio'); return a && !a.paused && a.duration > 0; });
      await page.getByText('播放', { exact: true }).click();
      await page.getByText('词', { exact: true }).click();
      await page.getByText('测试歌词', { exact: true }).waitFor();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('x_listen')));
      assert.equal(saved.musicProvider, 'gd'); assert.equal(saved.songs[0].gdPicId, '456');
      assert.equal(saved.songs[0].neteaseId, '123');
      await page.screenshot({ path: '/tmp/lisa-gd-ui-' + width + '.png' });
      await page.reload();
      const splash = page.getByText('翻 开', { exact: true });
      if (await splash.isVisible()) await splash.click();
      // 从存档验证开关与曲库不丢，不替换用户原来的存储键。
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('x_listen')).musicProvider), 'gd');
      assert.ok(calls.every(u => !u.searchParams.has('cookie')));
      assert.deepEqual(errors, []);
      console.log(width + 'px：开关、搜索、收藏、播放、歌词、保存重开通过；GD 请求 ' + calls.length);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exit(1); });
