const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('/Users/lisa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = __dirname;
const count = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"))).count;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream';
  fs.readFile(file, (err, data) => err ? res.writeHead(404).end() : res.writeHead(200, { 'Content-Type': type }).end(data));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  const errors = [], checks = [];
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    page.on('pageerror', err => errors.push(err.message));
    const url = 'http://127.0.0.1:' + server.address().port;
    for (const width of [1200, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(url + '/index.html');
      await page.evaluate(() => Promise.all([...document.images].filter(img => img.getAttribute('src')).map(img => img.decode())));
      assert.equal(await page.locator('.thumb').count(), count);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      for (let i = 0; i < count; i++) {
        await page.locator('.thumb').nth(i).click();
        await page.locator('#main').evaluate(img => img.decode());
        assert.ok((await page.locator('#label').textContent()).startsWith((i + 1) + ' / ' + count));
        const file = await page.locator('#one').getAttribute('href');
        assert.ok(fs.existsSync(path.join(root, file)));
      }
      await page.locator('.thumb').nth(0).click();
      await page.locator('#main').click();
      assert.ok(await page.locator('#zoom').evaluate(el => el.open));
      await page.locator('#zoomimg').evaluate(img => img.decode());
      assert.deepEqual(await page.locator('#zoomimg').evaluate(img => [img.naturalWidth, img.naturalHeight]), [1200, 1600]);
      await page.locator('#close').click();
      assert.equal(await page.locator('#zoom').evaluate(el => el.open), false);
      await page.keyboard.press('ArrowRight');
      assert.ok((await page.locator('#label').textContent()).startsWith('2 / ' + count));
      await page.keyboard.press('ArrowLeft');
      for (const file of await page.locator('.links a').evaluateAll(links => links.map(a => a.getAttribute('href')))) assert.ok(fs.existsSync(path.join(root, file)));
      await page.screenshot({ path: path.join(root, 'qa', 'gallery-' + width + '.png'), fullPage: true });
      checks.push({ width, pages: count, decode: true, noHorizontalOverflow: true, navigation: true, zoomOriginal: true, downloadFilesExist: true });
    }
    await page.setViewportSize({ width: 1284, height: 1250 });
    await page.goto(url + '/contact.html');
    await page.evaluate(() => Promise.all([...document.images].map(img => img.decode())));
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(root, count + '页总览.jpg'), fullPage: true, quality: 92 });
    fs.writeFileSync(path.join(root, 'gallery-checks.json'), JSON.stringify({ checks, errors }, null, 2));
    assert.deepEqual(errors, []);
    console.log('PASS full gallery at desktop/mobile, navigation, original-size zoom, download paths and contact image');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
