// 隔离浏览器和虚构角色；不读取玩家数据、不调用模型。
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    const file=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
    if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
    try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':'text/plain');res.end(fs.readFileSync(file));}
    catch{res.writeHead(404);res.end();}
  }).listen(0,'127.0.0.1');
  await new Promise(r=>server.on('listening',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{for(const width of [320,390]){
    const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.getByText('翻 开',{exact:true}).click();
    await page.evaluate(()=>{
      const host=document.createElement('div');host.id='pronoun-qa';host.style='position:fixed;inset:0;z-index:99999;height:100dvh;background:#faf8f0';document.body.append(host);
      window.qaRoot=ReactDOM.createRoot(host);window.qaSaved=[];
      qaRoot.render(h(CastForm,{initial:{id:'qa',name:'测试角色',gender:''},onBack:()=>{},onSave:c=>qaSaved.push(c.gender)}));
    });
    const host=page.locator('#pronoun-qa');
    await host.getByRole('button',{name:'存档',exact:true}).click();
    assert.equal(await page.evaluate(()=>qaSaved.at(-1)),'他', '旧角色无需重选');
    assert.equal(await host.getByRole('button',{name:'未填写 · TA',exact:true}).count(),0);
    for(const [label,gender] of [['她','她'],['他','他'],['TA · 中性','TA']]){
      const button=host.getByRole('button',{name:label,exact:true});await button.click();
      const box=await button.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
      await host.getByRole('button',{name:'存档',exact:true}).click();
      assert.equal(await page.evaluate(()=>qaSaved.at(-1)),gender);
    }
    await host.getByRole('button',{name:'TA · 中性',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/lisa-pronoun-form-'+width+'.png'});
    await page.evaluate(()=>qaRoot.render(h(CastForm,{key:'new',initial:null,onBack:()=>{},onSave:c=>qaSaved.push(c.gender)})));
    await host.locator('input:not([type="file"])').first().fill('新建测试角色');
    await host.getByRole('button',{name:'存档',exact:true}).click();
    assert.equal(await page.evaluate(()=>qaSaved.at(-1)),'TA', '新角色默认TA并存档');
    for(const [gender,pronoun] of [['她','她'],['他','他'],['','他'],['TA','TA'],['她','她']]){
      await page.evaluate(gender=>{
        const character={id:'qa',name:'他山',gender};
        qaRoot.render(h('div',null,
          h(PhonePeekCard,{character,m:{peek:{tier:'hidden',text:'原文：他告诉TA，他们在弹吉他。'}}}),
          h(GachaCard,{character,card:{id:'qa',poolId:'r_photo',r:'R',ts:1,redeemedTs:2,result:{body:'原文：他告诉TA，他们在弹吉他。',where:'memlib'}}})));
      },gender);
      await host.getByText('这是'+pronoun+'藏起来的',{exact:true}).waitFor();
      const content=await host.innerText();assert.ok(content.includes(pronoun+'相册里的一张'));
      assert.ok(content.includes('以后'+pronoun+'会提起'));assert.ok(content.includes('原文：他告诉TA，他们在弹吉他。'));
      assert.equal(await page.evaluate(g=>{phoneViewTa({gender:g});return TALLY_DIR.mine.zh;},gender),pronoun+'欠');
    }
    assert.deepEqual(errors,[]);await ctx.close();console.log(width+'px: 性别设置/保存/四次切换/券面/账本/原文保护通过');
  }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
