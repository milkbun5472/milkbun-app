const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GARDEN_TEST_URL || 'http://127.0.0.1:18897';
const out = process.env.HAIR_GALLERY || '/tmp/garden-source-hair/gallery';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1030, height: 1070 } });
    await page.goto(base + '/art/fairy-garden/source-hairstyles/preview.html');
    await page.waitForFunction(() => window.bodySliderReview?.hairstyles?.length === 12, null, { timeout: 90000 });
    await page.addStyleTag({ content: '.angles,#current-style{visibility:hidden}.shell{grid-template-columns:720px 310px}' });
    const styles = await page.evaluate(() => bodySliderReview.hairstyles);
    for (const [angle, turn, label] of [['front', 0, '正面'], ['side', Math.PI/2, '侧面'], ['back', Math.PI, '背面']]) {
      for (const style of styles) {
        await page.evaluate(({ id, turn }) => { bodySliderReview.setStyle(id); bodySliderReview.setView(turn, turn === 0 ? 2.6 : 3.75, turn === 0 ? 1.18 : .87); }, { id: style.id, turn });
        await page.locator('#view canvas').screenshot({ path: path.join(out, style.id + '-' + angle + '.png') });
      }
      const html = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#eee6d8;color:#604632;font:16px system-ui;padding:24px}h1{font-size:22px;margin:0 0 18px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}figure{margin:0}img{width:100%;display:block;border-radius:12px}figcaption{text-align:center;padding:10px 0 14px;font-size:14px}</style><h1>十二款发型 · ${label}</h1><main>${styles.map(s=>`<figure><img src="${s.id}-${angle}.png"><figcaption>${s.code} · ${s.label}</figcaption></figure>`).join('')}</main>`;
      fs.writeFileSync(path.join(out, angle + '.html'), html);
      const sheet = await browser.newPage({ viewport: { width: 1560, height: 850 } });
      // Local review files are generated screenshots, never replacement artwork.
      await sheet.goto('file://' + path.join(out, angle + '.html'));
      await sheet.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
      await sheet.screenshot({ path: path.join(out, 'gallery-' + angle + '.png'), fullPage: true });
      await sheet.close();
    }
    for (const [name, angle] of [['front', 0], ['side', Math.PI/2], ['back', Math.PI]]) {
      await page.evaluate(angle => { bodySliderReview.setStyle('curtains'); bodySliderReview.setView(angle, 2.6, 1.18); }, angle);
      await page.locator('#view canvas').screenshot({ path: path.join(out, 'm02-' + name + '.png') });
    }
    console.log('Captured 36 GLB views, three sheets and M02 close-ups:', out);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
