const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.WORLD_SOURCE_URL||'http://127.0.0.1:18961',out=process.env.WORLD_SOURCE_EVIDENCE||'/tmp/world-chat-source';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true}),result={widths:[],errors:[]};try{
 const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>result.errors.push(e.message));await p.goto(base+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.FairyWorlds&&window.txtVaultState?.().done);
 await p.evaluate(async()=>{
  const src=await(await fetch('js/app.js')).text(),a=src.indexOf('  const gardenHistory ='),z=src.indexOf('  const openGardenRoomFor =',a);if(a<0||z<a)throw Error('missing real writer');
  const chats={test:[]},pChat=(key,fn)=>chats[key]=fn(chats[key]||[]);
  const factory=new Function('chats','GARDEN_LOG','pChat','characters','buildBundle','roomContextFor','roomPromptFor',src.slice(a,z)+';return gardenRecord;')(chats,100,pChat,[],()=>'',()=>{},()=> '');
  for(const w of FairyWorlds)factory('test').onTurn({text:'我们在这里做了什么？',parts:['记下今天的经历。'],gameWorld:w.id,gameArchiveId:'source-browser-archive'});
  chats.test.push({role:'assistant',kind:'garden',content:'这一句是分开前的旧记录。',ts:1},{role:'user',content:'这一句来自普通手机聊天。',ts:2});
  window.sourceRows=chats.test;window.sourceBefore=JSON.stringify(sourceRows);
  const el=document.createElement('div');el.id='source-chat-root';el.style.cssText='position:fixed;inset:0;z-index:999999;height:100dvh;display:flex;flex-direction:column;background:#f7f3ee';document.body.append(el);window.sourceRoot=ReactDOM.createRoot(el);
  window.mountSource=(mode='chat',dark=false)=>{const value=dark?{...DEFAULT_THEME,bg:'#25222a',bg2:'#302b34',ink:'#f0e7e8',sub:'#cbc0c4',fog:'#b3a5ae',line:'#645b68',tint:'#b892a0'}:DEFAULT_THEME;
   const character={id:'source-person',name:'同行者',persona:'温柔',avatar:'🍞'};
   const view=mode==='search'?React.createElement(ChatSearchSheet,{messages:sourceRows,chars:[character],meName:'你',onClose:()=>mountSource()}):React.createElement(ChatThread,{character,characters:[character],messages:sourceRows,profile:{name:'你'},disp:{},onBack:()=>{},onSend:()=>{},onReply:()=>{},toast:()=>{},emotes:[],emotePacks:[],groups:[],archCount:1,onLoadOlder:async()=>sourceRows});
   sourceRoot.render(React.createElement(ThemeContext.Provider,{value},view));
  };mountSource();
 });
 const root=p.locator('#source-chat-root');await root.locator('[data-wk=messagesource]').first().waitFor();
 for(const width of [320,390,430]){
  const height=width===320?568:width===390?844:932;await p.setViewportSize({width,height});await p.waitForTimeout(120);
  const sources=await root.locator('[data-wk=messagesource]').allTextContents();assert.equal(sources.length,7);for(const name of ['微光庭院','远行列车','绒绒小镇'])assert.equal(sources.filter(s=>s.includes(name)).length,2);assert.equal(sources.filter(s=>s.includes('来源未记录')).length,1);
  assert.ok(!await root.innerText().then(s=>s.includes('source-browser-archive')));
  const layout=await root.evaluate(el=>({overflow:el.scrollWidth>innerWidth,input:el.querySelector('[data-wk=chatinput]')?.getBoundingClientRect().toJSON(),labels:[...el.querySelectorAll('[data-wk=messagesource]')].map(n=>n.getBoundingClientRect().toJSON())}));assert.equal(layout.overflow,false);assert.ok(layout.input&&layout.input.bottom<=height&&layout.input.left>=0&&layout.input.right<=width);for(const r of layout.labels)assert.ok(r.left>=0&&r.right<=width);
  await root.locator('[data-wk=messagesource]').first().scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'chat-'+width+'.png')});result.widths.push({width,height,sources,layout});
 }
 await p.evaluate(()=>mountSource('chat',true));await p.waitForTimeout(150);await root.locator('[data-wk=messagesource]').first().scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,'chat-dark.png')});
 // Search the world name rather than only original content; open the same dated records.
 await p.evaluate(()=>mountSource('search'));await root.getByPlaceholder('关键词').fill('绒绒小镇');await p.waitForTimeout(100);assert.ok((await root.innerText()).includes('【小世界 · 绒绒小镇】'));await p.screenshot({path:path.join(out,'search.png')});
 await root.locator('button').filter({hasText:'【小世界 · 绒绒小镇】'}).first().click();assert.ok((await root.innerText()).includes('【小世界 · 绒绒小镇】'));
 // Cloud archives preserve the same source without mutating original messages.
 await p.evaluate(()=>mountSource());await root.getByRole('button',{name:/更早的 1 条聊天/}).click();await root.getByText('共 8 条 · 只读回看（不占本地空间）').waitFor();assert.ok((await root.innerText()).includes('【小世界 · 微光庭院】'));assert.ok((await root.innerText()).includes('来源未记录'));await p.screenshot({path:path.join(out,'archive.png')});
 assert.equal(await p.evaluate(()=>JSON.stringify(sourceRows)===sourceBefore),true);assert.deepEqual(result.errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log('PASS actual writer → mobile chat labels 320/390/430, dark theme, world-name search/day, cloud archive, unchanged records, zero page errors');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
