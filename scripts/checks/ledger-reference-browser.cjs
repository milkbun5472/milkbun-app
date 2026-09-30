const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'), path=require('path'), assert=require('node:assert/strict');
const out=process.env.LEDGER_SHOTS || '/tmp/ledger-reference-shots/';fs.mkdirSync(out,{recursive:true});
(async()=>{
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('https://**',r=>r.abort());
await page.goto(process.env.LEDGER_TEST_URL || 'http://127.0.0.1:18945');await page.waitForFunction(()=>!!window.Ledger);
await page.evaluate(()=>{
 const d=new Date(), date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 const cats=[['餐饮','🍚'],['购物','🛍️'],['交通','🚌'],['日用','🧴'],['娱乐','🎮'],['学习','📚'],['医疗','💊'],['宠物','🐱'],['社交','🎁'],['住房','🏠'],['旅行','✈️'],['其他','✨']].map(([name,emoji])=>({name,emoji}));
 const items=[['餐饮','星巴克',36],['交通','地铁',4],['购物','淘宝',128],['工资','工资',5000],['宠物','猫咪用品',89],['娱乐','电影',48],['日用','超市',63.5],['住房','房租',1784]];
 const data={txns:items.map(([category,note,amount],i)=>({id:'fixture-'+i,ts:Date.now()-i*3600000,date,type:category==='工资'?'income':'expense',currency:'CNY',category,catEmoji:category==='工资'?'💰':cats.find(c=>c.name===category).emoji,note,amount,comments:[]})),settings:{skin:'glass',viewCur:'CNY',currencies:[{code:'CNY',label:'人民币',symbol:'¥'},{code:'CAD',label:'加币',symbol:'$'}],cats:{expense:cats,income:[{name:'工资',emoji:'💰'}]},visibleTo:[],budgets:{CNY:5000}}};
 saveJSON('x_ledger',data);
 document.getElementById('root').style.display='none';const el=document.createElement('div');el.id='ledger-test';el.style='position:fixed;inset:0;z-index:2147483647;--f-body:Arial,"PingFang SC",sans-serif;--f-display:Arial,"PingFang SC",sans-serif';document.body.append(el);
 ReactDOM.createRoot(el).render(React.createElement(ThemeContext.Provider,{value:DEFAULT_THEME},React.createElement(Ledger,{characters:[],profile:{name:'测试'},onBack:()=>{},toast:()=>{}})));
});
await page.waitForTimeout(600);
const snap=async name=>page.screenshot({path:path.join(out,name+'.png')});
const back=async()=>page.locator('#ledger-test [data-watch=back]:visible').last().click();
const root=page.locator('#ledger-test');
const layout=async()=>{
 const d=await root.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,bar:el.querySelector('[data-ledger-tabbar]').getBoundingClientRect().height}));
 assert.ok(d.scroll<=d.width+1,'no horizontal page overflow');assert.ok(d.bar>=54&&d.bar<=68,'compact bottom navigation');
};
await layout();assert.equal(await root.locator('[data-ledger-balance]').innerText(),'¥2,847.50');await snap('wallet');
await root.getByRole('button',{name:'藏起金额',exact:true}).click();assert.match(await root.locator('[data-ledger-balance]').innerText(),/\*{4}/);
await root.getByRole('button',{name:'显示金额',exact:true}).click();
await root.getByRole('button',{name:'记一笔',exact:true}).click();await root.getByRole('button',{name:'餐饮',exact:true}).click();
for(const k of ['3','6','.','0','0','7'])await root.getByRole('button',{name:k,exact:true}).click();
assert.match(await root.locator('[data-ledger-amount]').innerText(),/36\.00/);
await root.getByPlaceholder('备注：这一笔是什么（可留空）').fill('奶茶！今日快乐来源 ♡');await snap('entry');
await root.locator('[data-ledger-done]').click();
const stored=await page.evaluate(()=>loadJSON('x_ledger',null));const added=stored.txns[0];
assert.equal(added.amount,36);assert.equal(added.currency,'CNY');assert.equal(added.category,'餐饮');assert.equal(added.note,'奶茶！今日快乐来源 ♡');assert.equal(added.type,'expense');assert.deepEqual(added.comments,[]);
await root.getByRole('button',{name:'账单',exact:true}).click();await snap('bills');
await root.locator('[data-ledger-overlay=bills] [data-ledger-strip]').first().click();await snap('receipt');await back();
assert.equal(await root.locator('[data-ledger-overlay=bills]').count(),1);
await root.getByRole('button',{name:'收入',exact:true}).last().click();assert.equal(await root.locator('[data-ledger-overlay=bills] [data-ledger-strip]').count(),1);
await root.locator('[data-ledger-overlay=bills] [data-ledger-strip]').click();await back();
assert.equal(await root.locator('[data-ledger-overlay=bills] [data-ledger-strip]').count(),1,'income filter survives detail');
await root.getByRole('button',{name:'搜索账单',exact:true}).click();await root.getByPlaceholder('搜备注、分类或金额').fill('工资');
await root.locator('[data-ledger-overlay=bills] [data-ledger-strip]').click();await back();assert.equal(await root.getByPlaceholder('搜备注、分类或金额').inputValue(),'工资');await back();
await root.getByRole('button',{name:'统计',exact:true}).click();await snap('stats');await root.getByRole('button',{name:'日历',exact:true}).click();await snap('calendar');
await root.getByRole('button',{name:'钱包',exact:true}).click();await root.getByRole('button',{name:'换币种',exact:true}).click();assert.equal(await root.locator('[data-ledger-balance]').innerText(),'$0.00','currencies stay independent');
await root.getByRole('button',{name:'换币种',exact:true}).click();
// A tall list exercises preserved DOM, scroll position, selected filter and search together.
await page.evaluate(()=>{
 const d=loadJSON('x_ledger',null), txn=d.txns[0];
 d.txns=Array.from({length:35},(_,i)=>({...txn,id:'scroll-'+i,ts:txn.ts-i, note:'滚动测试 '+i})).concat(d.txns);
 d.txns.find(t=>t.type==='income').amount=125000;
 // Account form writes init (not initial), debit/credit type and the credit-cycle fields.
 d.settings.accounts=[{id:'test-debit',name:'储蓄卡',type:'debit',currency:'CNY',init:2000,limit:0,billDay:0,dueDay:0}];
 saveJSON('x_ledger',d);
});
// Switching skin remounts with the persisted record through the real settings writer.
await page.reload();await page.waitForFunction(()=>!!window.Ledger);
await page.evaluate(()=>{
 document.getElementById('root').style.display='none';const el=document.createElement('div');el.id='ledger-test';el.style='position:fixed;inset:0;z-index:2147483647';document.body.append(el);
 ReactDOM.createRoot(el).render(React.createElement(ThemeContext.Provider,{value:DEFAULT_THEME},React.createElement(Ledger,{characters:[],onBack:()=>{},toast:()=>{}})));
});
await root.getByRole('button',{name:'账单',exact:true}).click();
const list=root.locator('.lg-bills').locator('..');await list.evaluate(el=>el.scrollTop=640);const scroll=await list.evaluate(el=>el.scrollTop);assert.ok(scroll>500);
const row=root.locator('[data-ledger-overlay=bills] [data-ledger-strip]').nth(10);await row.click();await back();assert.equal(await list.evaluate(el=>el.scrollTop),scroll,'detail return preserves exact list scroll');
await back();
for(const [w,h] of [[320,568],[390,844],[430,932]]){
 await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);await layout();
 await root.locator('[data-ledger-scroll]').evaluate(el=>el.scrollTop=0);
 const primary=await root.getByRole('button',{name:'记一笔',exact:true}).boundingBox();
 const bar=await root.locator('[data-ledger-tabbar]').boundingBox();
 await snap('wallet-'+w);
 assert.ok(primary.y+primary.height<=bar.y,`primary action fits first viewport ${w}: ${primary.y+primary.height} <= ${bar.y}`);
 const eye=root.getByRole('button',{name:'藏起金额',exact:true});
 assert.ok(await eye.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'decoration does not intercept balance toggle');
 await eye.click();assert.match(await root.locator('[data-ledger-balance]').innerText(),/\*{4}/);
 await root.getByRole('button',{name:'显示金额',exact:true}).click();
 await root.getByRole('button',{name:'记一笔',exact:true}).click();
 const grid=root.locator('[data-ledger-catgrid]');assert.equal(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),4);
 const done=await root.locator('[data-ledger-done]').boundingBox();assert.ok(done.y>=0&&done.y+done.height<=h,'completion key stays on screen');
 const amount=await root.locator('[data-ledger-amount]').boundingBox();assert.ok(amount.y>70,'amount below header');
 if(w===320){const row2=await grid.locator('.lg-add-category').nth(7).boundingBox();assert.ok(row2.y+row2.height<=amount.y,'two complete category rows on short screens');}
 await grid.locator('button').last().scrollIntoViewIfNeeded();assert.ok(await grid.locator('button').last().isVisible(),'all categories reachable');
 await snap('entry-'+w);await back();
}
await page.setViewportSize({width:390,height:844});
await root.locator('[data-ledger-cardpack]').evaluate(el=>el.scrollLeft=el.clientWidth);await page.waitForTimeout(400);
await snap('account');assert.match(await root.locator('[data-ledger-acctface]').innerText(),/2,000\.00/);
await page.setViewportSize({width:390,height:844});await root.getByRole('button',{name:'我的',exact:true}).click();
await root.getByRole('button',{name:/账簿/}).click();assert.equal(await root.locator('.lg-reference').count(),0,'paper skin still available');await snap('paper');
assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:['boot','save real ledger shape','amount precision','mask balance','currency isolation','filter/search retention','detail scroll restoration','3 viewport layouts','reachable categories','paper skin'],errors}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
