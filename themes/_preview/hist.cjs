const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const pack = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const OUT = process.argv[3];
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(4000);
  await p.evaluate(l => {
    const n = Date.now();
    saveJSON('x_characters', [{ id: 'c1', name: '小白' }]);
    saveJSON('x_states', { c1: { thought: '想她了', thoughtUpdatedAt: n, mood: '欢实', updatedAt: n } });
    saveJSON('x_stateHist', { c1: [
      { thought: '转了一块钱说我是真的狗，转头就伸手要红包，理直气壮成这样', mood: '欢实', action: '盘腿坐在椅子上，随手把那块钱点进零钱', wearing: '宽松的灰色落肩卫衣配黑运动裤', ts: n - 12e5 },
      { thought: '她怎么突然对着我汪汪叫……先汪回去再说', mood: '欢实', action: '趴在桌子前捧着手机看她刚换的头像', wearing: '宽松的灰色落肩卫衣配黑运动裤', ts: n - 33e5 }] });
    saveJSON('x_chat:c1', [{ role: 'assistant', content: '汪', ts: n }]);
    saveJSON('x_chatSettings', { c1: l });
  }, pack.look);
  await p.reload(); await p.waitForTimeout(4500);
  await p.evaluate(() => { const s = document.getElementById('qiu-splash'); if (s) s.remove(); window.__openFromNotif('c1', 'thread'); });
  await p.waitForTimeout(2500);
  await p.click('button[data-wk="avatar"]'); await p.waitForTimeout(1200);
  const more = await p.$('[data-wk="statehistbtn"][data-part="more"]');
  if (more) { await more.click(); await p.waitForTimeout(1000); }
  await p.screenshot({ path: OUT + '/hist.png' });
  console.log(JSON.stringify({ more: !!more, items: (await p.$$('[data-wk="statehistitem"]')).length, errs: errs.slice(0, 3) }));
  await b.close();
})();
