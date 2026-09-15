// Isolated browser, synthetic records, network blocked; no real chat or model calls.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
const root=process.env.QA_ROOT||path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{let f=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(f))}catch{res.writeHead(404);res.end()}}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));const browser=await chromium.launch({channel:'chrome',headless:true});
try {for(const width of [320,390]){
 const ctx=await browser.newContext({viewport:{width,height:844},hasTouch:true,serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByText('翻 开',{exact:true}).click();await page.locator('#qiu-splash').waitFor({state:'hidden'});
 await page.evaluate(()=>{
  window.qaRoot=document.createElement('div');qaRoot.id='qa-new';qaRoot.style='position:fixed;inset:0;z-index:100;background:white;';document.body.appendChild(qaRoot);
  window.qaMount=fn=>{ReactDOM.unmountComponentAtNode(qaRoot);ReactDOM.render(React.createElement(fn),qaRoot)};
  window.qaChar={id:'fixture-char',name:'测试角色',gender:'她',persona:'虚构人物，仅用于测试'};
 });
 await page.evaluate(()=>qaMount(()=>React.createElement(TiesWalk,{startId:qaChar.id,me:{id:'user',name:'测试用户'},profile:{name:'测试用户'},allChars:[qaChar,{id:'fixture-other',name:'另一角色'}],rels:{'fixture-char->fixture-other':'朋友'},tiePos:{},onSaveTiePos(){},onEditEdge(){},onClose(){}})));
 const face=page.getByText('另一角色',{exact:true}).locator('..');const box=await face.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+24,box.y+box.height/2+24,{steps:6});await page.mouse.up();await page.getByText('测试角色 的关系',{exact:true}).waitFor();
 await page.getByText('另一角色',{exact:true}).locator('..').click();await page.getByText('另一角色 的关系',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({animations:'disabled',path:'/tmp/qiuqiu-0915-ties-'+width+'.png'});
  await page.evaluate(()=>{
    document.querySelector('#qa-new').remove();window.qaRoot=document.createElement('div');qaRoot.id='qa-phone';qaRoot.style='position:fixed;inset:0;z-index:9999;background:white;overflow:auto';document.body.appendChild(qaRoot);
    window.qaPaint=()=>ReactDOM.render(React.createElement(BrowserView,{d:{tabs:[{title:'A fictional English browser tab',site:'Fixture'}],searches:[{q:'A fictional English query',time:'09:00',results:[{title:'A fictional English result',excerpt:'This is a long fictional summary used only for the translation layout test.',source:'Fixture'}]}]},char:{id:'qa-char',name:'测试档案'},onBack(){},onRefresh(){}}),qaRoot);
    window.translateLongToZh=async()=>({zh:'这是一段隔离测试译文，保留原始内容，不消耗任何真实接口额度。',by:'测试'});
    qaPaint();
  });
  const phone=page.locator('#qa-phone');
  await phone.locator('[data-wk=translatebutton]').click();
  await phone.locator('[data-wk=translatebody]').getByText('这是一段隔离测试译文，保留原始内容，不消耗任何真实接口额度。',{exact:true}).waitFor();
  const unclipped=await phone.locator('[data-wk=translatebody]').evaluate(el=>{const r=el.getBoundingClientRect();for(let p=el.parentElement;p&&p.id!=='qa-phone';p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(['hidden','clip'].includes(s.overflowY)&&(r.bottom>b.bottom+1||r.top<b.top-1))return false;}return true;});
  assert.ok(unclipped,'标签页译文被列表原来的两行截断裁掉');
  await phone.locator('[data-watch="tab:search"]').click();
  const row=phone.locator('[data-watch="item:A fictional English query"]');
  await row.locator('[data-wk=translatebutton]').click();await row.locator('[data-wk=translatebody]').waitFor();
  await row.click({position:{x:10,y:10}});await phone.getByText('A fictional English result',{exact:true}).waitFor();
  await page.evaluate(()=>setOnlineTranslationAuto(true));
  await page.waitForFunction(()=>document.querySelectorAll('#qa-phone [data-wk=translatebody]').length>=3);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);await ctx.close();console.log(width+'px: home boot and relationship click/drag passed');
}}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
