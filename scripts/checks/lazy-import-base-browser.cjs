// Execute the real lazy loader under a nested deployment URL; sourceURL must not stand in for a script base.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),http=require('node:http'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const prefix='/deployment/phone/',seen=[],files={
  [prefix+'index.html']:'<script src="lazy.js"></script><script type="text/lazy" data-lazy="g" data-src="js/first.js?v=1"></script><script type="text/lazy" data-lazy="g" data-src="js/importer.js?v=1"></script><script type="text/lazy" data-lazy="g" data-src="js/last.js?v=1"></script>',
  [prefix+'lazy.js']:fs.readFileSync('js/lazy-mods.js','utf8'),
  [prefix+'js/first.js']:'window.order=[1];',
  [prefix+'js/importer.js']:"window.order.push(2);window.answer=()=>import('../modules/answer.mjs');",
  [prefix+'js/last.js']:'window.order.push(3);',
  [prefix+'modules/answer.mjs']:'export const answer=42;'
 };
 const server=http.createServer((req,res)=>{const path=req.url.split('?')[0];seen.push(path);if(!Object.hasOwn(files,path)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',path.endsWith('.html')?'text/html':'text/javascript');res.setHeader('Cache-Control','max-age=600');res.end(files[path]);}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));let browser;
 try{browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+prefix+'index.html');const result=await page.evaluate(async()=>{await LazyMods.load('g');await LazyMods.load('g');return {order,answer:(await answer()).answer};});assert.deepEqual(result,{order:[1,2,3],answer:42});assert.ok(seen.includes(prefix+'modules/answer.mjs'));assert.ok(!seen.includes('/deployment/modules/answer.mjs'));assert.deepEqual(errors,[]);console.log('PASS real lazy loader: nested URL, dynamic import base, ordered execution, one load');}
 finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
