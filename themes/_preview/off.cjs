const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const pack = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const OUT = process.argv[3];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(4000);
  await p.evaluate(l => { saveJSON('x_characters', [{ id: 'c1', name: '小白' }]); saveJSON('x_chat:c1', [{ role: 'assistant', content: '汪', ts: Date.now() }]); saveJSON('x_chatSettings', { c1: Object.assign({ defaultOffline: true }, l) }); }, pack.look);
  await p.reload(); await p.waitForTimeout(4500);
  await p.evaluate(() => { const s = document.getElementById('qiu-splash'); if (s) s.remove(); window.__openFromNotif('c1', 'thread'); });
  await p.waitForTimeout(2500);
  await p.waitForTimeout(300);
  const opts = await p.$$eval('button', bs => bs.map(b => b.innerText.trim()).filter(t => /线下/.test(t)).slice(0, 5));
  for (const bt of await p.$$('button')) { const t = (await bt.innerText()).trim(); if (/^线下/.test(t)) { await bt.click(); break; } }
  await p.waitForTimeout(1200);
  for (const bt of await p.$$('button')) { const t = (await bt.innerText()).trim(); if (/进入线下/.test(t)) { await bt.click(); break; } }
  await p.waitForTimeout(2000);
  await p.screenshot({ path: OUT + '/off.png' });
  console.log(JSON.stringify({ opts, off: !!(await p.$('[data-wk="offline"]')), errs: errs.slice(0, 3) }));
  await b.close();
})();
