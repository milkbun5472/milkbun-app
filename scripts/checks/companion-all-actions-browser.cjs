const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {cases,variants,channelCases}=require('../../test/fixtures/companion-action-prose.cjs');
const base=process.env.COMPANION_TEST_URL||'http://127.0.0.1:18946';
const out=process.env.COMPANION_EVIDENCE||'/tmp/companion-all-actions';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const source=fs.readFileSync('js/companion.js','utf8'),rows=variants(),report={modes:[],actions:Object.keys(cases).length,variantsPerAction:256,variantsPerMode:rows.length},errors=[];
 for(const mode of ['full','float']){
  const page=await browser.newPage({viewport:{width:390,height:700}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/apps/companion/?mode='+mode);await page.waitForFunction(()=>window.petDebug);await page.evaluate(()=>petDebug.ready());
  await page.addScriptTag({content:'window.useEffect=fn=>fn();'+source.replace('window.CompanionFace =','window.bindCompanionChat = useChatAct; window.CompanionFace =')});
  await page.evaluate(()=>{window.chatMessages=[];window.bindCompanionChat('check-c1',{current:{contentWindow:{postMessage(message){chatMessages.push(message);window.postMessage(message,'*');}}}});});
  const coverage=await page.evaluate(rows=>{
   const counts={};for(const {kind,text} of rows){const actual=CompanionFace.actForText(text);if(actual!==kind)throw Error(kind+' → '+actual+' '+text);counts[kind]=(counts[kind]||0)+1;}return counts;
  },rows);
  const played=[];
  for(const [kind,lines] of Object.entries(cases)){
   const text='早安。'+lines[1]+'。';
   await page.evaluate(text=>dispatchEvent(new CustomEvent('companion-chat',{detail:{charId:'check-c1',act:text,said:''}})),text);await page.waitForTimeout(130);
   assert.equal(await page.evaluate(()=>petDebug.snapshot().action),kind,mode+' '+text);played.push(kind);
  }
  const channels=await page.evaluate(rows=>{
   for(const {act='',said='',kind} of rows){const actual=CompanionFace.actForChat(act,said);if(actual!==kind)throw Error('Channel '+kind+' → '+actual+' '+JSON.stringify({act,said}));}return rows.length;
  },channelCases);
  // 穿过真实角色隔离事件入口；否定句／普通台词不会向小人发送动作。
  for(const row of channelCases){
   const messages=await page.evaluate(({act='',said='',kind})=>{chatMessages.length=0;dispatchEvent(new CustomEvent('companion-chat',{detail:{charId:'check-c1',act,said}}));return chatMessages.map(m=>m.kind);},row);
   assert.deepEqual(messages,row.kind?[row.kind]:[],mode+' channel event '+JSON.stringify(row));
   if(row.kind){await page.waitForTimeout(130);assert.equal(await page.evaluate(()=>petDebug.snapshot().action),row.kind);}
  }
  await page.evaluate(()=>{chatMessages.length=0;dispatchEvent(new CustomEvent('companion-chat',{detail:{charId:'other-character',act:'他大笑出声。'}}));});
  assert.equal(await page.evaluate(()=>chatMessages.length),0,mode+' character isolation');
  report.modes.push({mode,coverage,played,channels});await page.screenshot({path:path.join(out,mode+'.png')});await page.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log({actions:report.actions,variantsPerAction:256,variantsPerMode:rows.length,modes:report.modes.map(m=>({mode:m.mode,played:m.played.length,channels:m.channels}))});
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
