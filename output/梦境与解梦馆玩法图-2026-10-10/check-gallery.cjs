const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/Users/lisa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=__dirname,errors=[],checks=[];
const server=http.createServer((req,res)=>{const requested=new URL(req.url,'http://localhost').pathname,p=path.resolve(root,'.'+decodeURIComponent(requested==='/'?'/index.html':requested));if(!p.startsWith(root+'/'))return res.writeHead(403).end();fs.readFile(p,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html;charset=utf-8':p.endsWith('.png')?'image/png':p.endsWith('.jpg')?'image/jpeg':'application/octet-stream'}).end(b));});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const viewport of [{width:1200,height:900},{width:390,height:844}]){
      const context=await browser.newContext({viewport,serviceWorkers:'block'});
      await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base);await page.evaluate(()=>Promise.all([...document.querySelectorAll('.thumb img')].map(i=>i.decode())));
      assert.equal(await page.locator('.thumb').count(),18);
      const summary=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,images:[...document.querySelectorAll('.thumb img')].map(i=>[i.naturalWidth,i.naturalHeight])}));
      assert.equal(summary.width,summary.scroll);assert(summary.images.every(i=>i[0]===1200&&i[1]===1600));
      await page.locator('.thumb').first().click();await page.locator('dialog').waitFor({state:'visible'});await page.locator('#full').evaluate(i=>i.decode());
      assert.match(await page.locator('#page-label').innerText(),/^01/);
      await page.locator('#zoom').click();
      const zoom=await page.locator('.viewer').evaluate(v=>({imageWidth:v.querySelector('img').getBoundingClientRect().width,scroll:v.scrollWidth,client:v.clientWidth,doc:document.documentElement.scrollWidth}));
      assert.equal(zoom.imageWidth,1200);assert(zoom.scroll>=1200);assert.equal(zoom.doc,viewport.width);
      await page.keyboard.press('ArrowRight');assert.match(await page.locator('#page-label').innerText(),/^02/);assert.equal(await page.locator('.viewer.actual').count(),0);
      await page.locator('#prev').click();await page.locator('#prev').click();assert.match(await page.locator('#page-label').innerText(),/^18/);
      assert.match(decodeURIComponent(await page.locator('#download').getAttribute('href')),/18-醒后聊天的余味.png$/);
      await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').isVisible(),false);
      await page.screenshot({path:path.join(root,'qa','gallery-'+viewport.width+'.png'),fullPage:false});
      checks.push({viewport,decoded:18,noHorizontalOverflow:true,originalSizeZoom:true,keyboardNavigation:true,wrapAround:true,downloadHref:true});await context.close();
    }
    const archive='梦境与解梦馆-18张玩法图.zip';const response=await browser.newPage();const received=await response.request.get(base+'/'+encodeURIComponent(archive));assert(received.ok());assert.equal(crypto.createHash('sha256').update(await received.body()).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,archive))).digest('hex'));await response.close();
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(root,'gallery-checks.json'),JSON.stringify({checks,errors,zipDownloadHash:'pass'},null,2)+'\n');console.log('18 images decoded; desktop/mobile bounds, zoom, keyboard and ZIP download hash passed.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
