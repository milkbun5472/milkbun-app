// 预览：种一个角色和几条消息，把美化写进这个人的聊天设置，打开聊天截图
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2], PACK = process.argv[3], EXTRA = process.argv[4] || '';
(async () => {
  const pack = JSON.parse(fs.readFileSync(PACK, 'utf8'));
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(4000);
  const now = Date.now();
  const extraMsgs = EXTRA ? JSON.parse(fs.readFileSync(EXTRA, 'utf8')) : [];
  await p.evaluate(({ look, now, extraMsgs }) => {
    saveJSON('x_characters', [{ id: 'c1', name: '小白', persona: '一只小白狗', avatar: '🐶' }]);
    const msgs = [
      { role: 'user', content: '今天下雨了，你出门带伞没', ts: now - 600000 },
      { role: 'assistant', content: '带了！还给你也带了一把', ts: now - 590000 },
      { role: 'assistant', content: '在楼下等你', ts: now - 580000 },
      { role: 'user', content: '你怎么这么好🥺', ts: now - 570000 }
    ].concat(extraMsgs.map((m, i) => Object.assign({ ts: now - 500000 + i * 1000 }, m)));
    saveJSON('x_chat:c1', msgs);
    saveJSON('x_chatSettings', { c1: Object.assign({ showMyAvatar: true }, look) });
  }, { look: pack.look, now, extraMsgs });
  await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(4500);
  // 开机那张「翻开」：点掉，或者直接拿掉
  await p.evaluate(() => { const sp = document.getElementById('qiu-splash'); if (sp) sp.remove(); });
  await p.waitForTimeout(300);
  if (process.argv[5]) await p.evaluate(() => { window.Astro = window.Astro || {}; window.Astro.isGoodDay = () => true; });
  await p.evaluate(() => window.__openFromNotif && window.__openFromNotif('c1', 'thread'));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/puppy-chat.png' });
  // 点开加号面板
  const plus = await p.$('[data-wk="chatplus"]'); if (plus) { await plus.click(); await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/puppy-panel.png' }); const vb=await p.$('text=语音通话'); if(vb){await vb.click(); await p.waitForTimeout(4000); await p.screenshot({path: OUT+'/call.png'}); console.log(await p.evaluate(()=>{const c=document.querySelector('[data-wk="call"]');return c?c.outerHTML.replace(/data:[^"]*/g,'').slice(0,3000):'nocall'}));} }
  const info = await p.evaluate(() => ({ screen: document.documentElement.getAttribute('data-lisa-screen'), bubbles: document.querySelectorAll('[data-wk="bubble"]').length, kinds: [...new Set([...document.querySelectorAll('[data-wk="bubble"]')].map(x => x.getAttribute('data-kind')))] }));
  const hd = await p.evaluate(() => { const a = document.querySelector('[data-wk="chathead"] [data-wk="avatar"]'); return a ? a.outerHTML.slice(0, 200) + ' | ' + getComputedStyle(a).borderRadius + ' | halo:' + document.querySelectorAll('[data-halo]').length + ' | astro:' + typeof (window.Astro && window.Astro.isGoodDay) : 'none'; }); console.log(hd);
  const nc = await p.evaluate(() => { const c = document.querySelector('[data-wk="namecard"] img'); return c ? c.outerHTML.slice(0, 120) + ' | ' + getComputedStyle(c).borderRadius : 'none'; }); console.log(nc);
  console.log(JSON.stringify({ info, errs: errs.slice(0, 5) }));
  await b.close();
})();
