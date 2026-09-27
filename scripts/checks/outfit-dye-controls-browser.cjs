// The real shared controls and ColorDot, mounted with React at mobile widths.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CLOTH_TEST_URL||'http://127.0.0.1:18927',out=process.env.CLOTH_TEST_OUT||'/tmp/lisa-dye-controls';fs.mkdirSync(out,{recursive:true});
const src=fs.readFileSync('js/fairy-garden.js','utf8'),components=fs.readFileSync('js/components.js','utf8');
const controls=src.slice(src.indexOf('function DressControls('),src.indexOf('const BUBBLE_WALL'));
const colorDot=components.slice(components.indexOf('const COLOR_DOT_FALLBACK'),components.indexOf('function stickerSrc('));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/dye-controls-test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#f0e8db}.flex{display:flex}.items-center{align-items:center}.flex-wrap{flex-wrap:wrap}.flex-1{flex:1}.min-w-0{min-width:0}.justify-between{justify-content:space-between}</style><main id="root"></main>'}));
 await page.goto(base+'/dye-controls-test');await page.addScriptTag({url:base+'/vendor/react.production.min.js'});await page.addScriptTag({url:base+'/vendor/react-dom.production.min.js'});
 await page.addScriptTag({content:`const h=React.createElement,{useState,useEffect}=React,F_BODY='sans-serif',HAIR_COLORS=[],G={ink:'#344936',deep:'#344936',line:'#cbd4bd',soft:'#657561'},useTheme=()=>G;${colorDot}\n${controls}`});
 await page.evaluate(async()=>{
  const {OUTFITS,mergeLook,outfitColors}=await import('/apps/fairy-garden/wardrobe.mjs');
  window.qa={outfit:'suit',skin:'#123456',hairColor:'#234567',dims:{shoulder:.96},wardrobe:{suit:{cloth:'#ff00ff'},academy:{cloth:'#abcdef'}}};
  window.show=()=>ReactDOM.render(h(DressControls,{who:'self',look:{self:qa},styles:{outfits:OUTFITS,hair:{}},game:()=>({getOutfit:()=>({id:qa.outfit,colors:outfitColors(qa)})}),pushLook:p=>{window.qa=mergeLook(qa,p);show();}}),document.getElementById('root'));show();
 });
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});const reset=page.getByRole('button',{name:'恢复本套默认配色'});await reset.scrollIntoViewIfNeeded();
  const b=await reset.boundingBox();assert.ok(b.height>=44&&b.x>=0&&b.x+b.width<=width);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.getByLabel('西装外套色号',{exact:true}).fill('#22ff44');await page.getByRole('button',{name:'恢复本套默认配色'}).click();
 await page.waitForFunction(()=>document.querySelector('[aria-label="西装外套色号"]').value==='#7e7c7a');
 assert.equal(await page.getByLabel('西装外套色号',{exact:true}).inputValue(),'#7e7c7a');
 const saved=await page.evaluate(()=>qa);assert.equal(saved.wardrobe.academy.cloth,'#abcdef');assert.equal(saved.skin,'#123456');assert.equal(saved.dims.shoulder,.96);
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'恢复本套默认配色'}).scrollIntoViewIfNeeded();await page.screenshot({path:out+'/mobile-controls.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({widths:[320,390,430],reset:true,errors}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
