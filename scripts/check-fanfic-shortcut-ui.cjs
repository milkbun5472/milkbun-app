// 独立浏览器、虚构聊天，只验证待写入口；不调用模型或真人存档。
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
      const host=document.createElement('div');host.id='fic-shortcut-qa';host.style='position:fixed;inset:0;z-index:99999;height:100dvh';document.body.append(host);
      window.qaRoot=ReactDOM.createRoot(host);window.qaWrites=[];
      const a={role:'assistant',kind:'ficinvite',ficId:'a',subject:'很长很长的测试书名'.repeat(5),ts:1};
      const b={role:'assistant',kind:'ficinvite',ficId:'b',subject:'另一本',ts:2};
      window.qaProps={character:{id:'fixture',name:'测试角色',color:'#789'},characters:[],groups:[],
        profile:{name:'测试用户'},messages:[a,b,...Array.from({length:60},(_,i)=>({role:i%2?'user':'assistant',content:'虚构讨论 '+i,ts:3+i}))],
        room:{id:'r1',main:false,name:'测试写作房',actions:{fanfic:true}},roomFics:[{id:'a',title:a.subject},{id:'b',title:b.subject}],roomFicId:'a',
        disp:{},emotes:[],onBack:()=>{},onOpenSettings:()=>{},onSend:()=>{},onReply:()=>{},onOOC:()=>{},
        onPickRoomFic:id=>{qaProps.roomFicId=id;qaRender();},
        onOpenFicInvite:m=>{qaWrites.push(m.ficId);qaProps.ficWriting=true;qaRender();}};
      window.qaRender=()=>qaRoot.render(h(ChatThread,qaProps));qaRender();
    });
    const shortcut=page.locator('[data-fic-write-shortcut]');await shortcut.waitFor();
    const input=page.locator('#fic-shortcut-qa [data-wk="composer"]');
    const before=await input.boundingBox(),bar=await shortcut.boundingBox();
    assert.ok(bar.y+bar.height<=before.y+2);assert.ok(bar.x>=0&&bar.x+bar.width<=width+1);
    // 顶部旧卡在滚动区外；入口一直跟着输入框。
    await page.locator('#fic-shortcut-qa [data-wk="body"]').evaluate(el=>{el.scrollTop=0;});
    assert.ok(Math.abs((await shortcut.boundingBox()).y-bar.y)<2);
    await shortcut.getByRole('button').click();assert.deepEqual(await page.evaluate(()=>qaWrites),['a']);
    assert.ok(await shortcut.getByRole('button').isDisabled());
    await page.evaluate(()=>{qaProps.ficWriting=false;qaRender();}); // 模拟失败仍可重试
    await shortcut.getByRole('button',{name:/商量好了/}).waitFor();assert.ok(await shortcut.getByRole('button').isEnabled());
    await page.evaluate(()=>{qaProps.messages=qaProps.messages.concat({role:'assistant',kind:'ficdone',ficId:'a',chapIdx:0,ts:100});qaRender();});
    await shortcut.waitFor({state:'detached'});
    await page.evaluate(()=>{qaProps.roomFicId='b';qaRender();});await shortcut.waitFor();
    assert.ok((await shortcut.innerText()).includes('另一本'));
    await page.locator('#fic-shortcut-qa [data-wk="chatinput"]').fill('输入时快捷入口还在');
    // 小高度模拟键盘挤压，可输入且底部不过界。
    await page.setViewportSize({width,height:540});
    const small=await input.boundingBox();assert.ok(small.y+small.height<=541);
    await page.screenshot({path:'/tmp/lisa-fic-shortcut-'+width+'.png'});
    assert.deepEqual(errors,[]);await ctx.close();console.log(width+'px: 常驻/长书名/滚动/忙碌/重试/完成/换书/窄高通过');
  }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
