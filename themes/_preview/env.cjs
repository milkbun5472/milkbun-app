const { chromium } = require('playwright'); const fs = require('fs');
const [OUT, PACK, EXTRA] = process.argv.slice(2);
(async () => { const pack = JSON.parse(fs.readFileSync(PACK,'utf8')); const extra = JSON.parse(fs.readFileSync(EXTRA,'utf8'));
 const b = await chromium.launch(); const p = await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
 await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(4000);
 await p.evaluate(({look,extra})=>{saveJSON('x_characters',[{id:'c1',name:'小白',persona:'狗',avatar:'🐶'}]);saveJSON('x_chat:c1',extra.map((m,i)=>Object.assign({ts:Date.now()-9e5+i*1000},m)));saveJSON('x_chatSettings',{c1:look});},{look:pack.look,extra});
 await p.reload(); await p.waitForTimeout(4500); await p.evaluate(()=>{const s=document.getElementById('qiu-splash'); if(s) s.remove();});
 await p.evaluate(()=>window.__openFromNotif('c1','thread')); await p.waitForTimeout(2500);
 await p.click('[data-wk="rpcard"]'); await p.waitForTimeout(800); await p.screenshot({path:OUT+'/env-closed.png'}); const ob=await p.$('[data-wk="rpopenbtn"]'); if(ob){await ob.click(); await p.waitForTimeout(2500); await p.screenshot({path:OUT+'/env-open.png'});}
 await b.close(); })();
