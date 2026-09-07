// 独立浏览器数据，不读真实用户档案、不调用模型。
// 先在仓库根运行 python3 -m http.server 8765 --bind 127.0.0.1
// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/check-page-colors.cjs tarot
// 六页逐个运行；截图放 os.tmpdir()/lisa-pagecolor-qa。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(require('node:os').tmpdir(), 'lisa-pagecolor-qa');
fs.mkdirSync(output, {recursive:true});
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765',{waitUntil:'load'});
 await page.addStyleTag({content:'#qiu-splash {display:none!important}'});
 await page.evaluate(()=>{document.getElementById('root').style.display='none'; document.body.insertAdjacentHTML('beforeend','<div id="qa" style="height:100vh"></div>');});
 await page.evaluate(()=>window.eval(`window.qaTokens={bg:'#ffffff',bg2:'#f4f4f4',ink:'#202020',sub:'#444444',fog:'#666666',line:'#bbbbbb',accent:'#713b91',tint:'#655020'}; window.qaRender=(name,props={})=>ReactDOM.render(h(ThemeContext.Provider,{value:ThemeStudio.themeFor(name,DEFAULT_THEME)},h(window[{tarot:'Tarot',ledger:'Ledger',weekly:'WeeklyApp',dreamjournal:'DreamJournalApp',impression:'ImpressionApp',fanfic:'FanficApp'}[name]],{characters:[{id:'qa-char',name:'测试角色',color:'#556677'}],profile:{name:'测试'},toast:()=>{},onBack:()=>{},...props})),document.getElementById('qa')); window.qaApply=(name,tokens)=>{ThemeStudio.apply({...ThemeStudio.fresh(),pageTokens:{[name]:tokens}});qaRender(name)};`));
 const name=process.argv[2]||'tarot';
 await page.evaluate(name=>{
 const now=Date.now();
 if(name==='impression') Impression.save({'qa-char':[{id:'qa-im',monthKey:'2026-08',title:'测试印象',tags:['安静','认真','明亮'],quote:'这是用来检查相纸与正文颜色的一段文字。',silhouette:'测试',img:'',turn:0,ts:now}]});
 if(name==='fanfic') Fanfic.saveFics([{id:'qa-fic',tabId:Fanfic.loadTabs()[0].id,cp:[],title:'测试文章',author:'测试作者',tags:['测试'],chapters:[{content:'检查正文颜色。'.repeat(80),endHook:''}],source:'user',onShelf:true,sharedTo:[],stats:{kudos:0,hits:0,bookmarks:0},reviews:[],createdAt:now,updatedAt:now,paper:'night'}]);
 if(name==='weekly') {const win=Weekly.reportWindow();Weekly.saveIssues([{id:'qa-issue',weekOf:{start:win.start,end:win.end},key:win.key,label:win.label,issueNumber:1,createdAt:now,sections:[{id:'qa-cover',type:'cover',headline:'测试周刊',lead:'检查封面正文',items:[]},{id:'qa-interview',type:'interview',entries:[]},{id:'qa-media',type:'media',voiceId:'editorial',articles:[{title:'测试报道',body:'检查栏目颜色。'.repeat(60)}]}]}]);}
 },name);
 await page.evaluate(name=>qaApply(name,{}),name);await page.waitForTimeout(250);
 await page.screenshot({path:`${output}/${name}-default.png`});
 await page.evaluate(name=>qaApply(name,qaTokens),name);await page.waitForTimeout(250);
 await page.screenshot({path:`${output}/${name}-white.png`});
 if(name==='tarot') await page.locator('svg g').filter({hasText:'角色为你解牌'}).locator('circle[fill="transparent"]').click();
 if(name==='ledger') await page.getByText('记一笔',{exact:true}).click();
 if(name==='impression') {await page.getByText('测试角色',{exact:true}).click();await page.getByText('2026 年 8 月',{exact:true}).click();}
 if(name==='fanfic') {await page.getByText('我的',{exact:true}).click();await page.getByText('我发布的',{exact:true}).click();await page.getByText('测试文章',{exact:true}).first().click();}
 if(name==='weekly') {await page.getByText('点开来读 →',{exact:true}).click();await page.getByText('严肃大报社论',{exact:true}).first().click();}
 if(name==='dreamjournal') {await page.locator('textarea').fill('测试梦境正文。');await page.getByText('记完整的梦',{exact:true}).click();await page.getByText('找TA解',{exact:true}).click();}
 await page.waitForTimeout(300); await page.screenshot({path:`${output}/${name}-detail.png`});
 // Recolor the mounted detail, then cancel. Existing local form/navigation state must survive.
 const inputs = await page.locator('#qa input, #qa textarea').evaluateAll(els=>els.map(el=>el.value));
 const text = await page.locator('#qa').innerText();
 await page.evaluate(name=>{ThemeStudio.preview({...ThemeStudio.fresh(),pageTokens:{[name]:{...qaTokens,bg:'#171717',bg2:'#292929',ink:'#eeeeee',sub:'#dddddd',fog:'#bbbbbb'}}},60000);qaRender(name);},name);
 await page.waitForTimeout(80);
 assert.deepEqual(await page.locator('#qa input, #qa textarea').evaluateAll(els=>els.map(el=>el.value)),inputs);
 assert.equal(await page.locator('#qa').innerText(),text);
 await page.screenshot({path:`${output}/${name}-detail-dark.png`});
 assert.ok(await page.locator('#qa').evaluate(el=>[...el.querySelectorAll('*')].some(n=>getComputedStyle(n).backgroundColor==='rgb(23, 23, 23)')),name+' deep background did not change');
 assert.ok(await page.locator('#qa [data-wk="headink"]').evaluateAll(els=>els.some(n=>getComputedStyle(n).color==='rgb(238, 238, 238)')),name+' header ink did not change');
 await page.evaluate(name=>{ThemeStudio.cancelPreview();qaRender(name);},name);
 assert.deepEqual(await page.locator('#qa input, #qa textarea').evaluateAll(els=>els.map(el=>el.value)),inputs);
 assert.deepEqual(errors,[],name+' browser errors');
 assert.ok(await page.locator('#qa').evaluate(el=>el.scrollWidth<=390),name+' horizontal overflow');
 console.log(JSON.stringify({name,errors,metrics:await page.locator('#qa').evaluate(el=>({text:el.innerText.slice(0,180),width:el.scrollWidth,background:getComputedStyle(el.firstElementChild).backgroundColor,ink:getComputedStyle(el.querySelector('header')||el.firstElementChild).color}))}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
