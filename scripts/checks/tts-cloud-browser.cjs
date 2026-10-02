// 真实 App + 虚构角色/本地模型桩。不会读取真人存档或调用上游。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),out=process.env.TTS_SHOTS || '/tmp/tts-cloud-shots';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const server=http.createServer((req,res)=>{
  const f=path.resolve(repo,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!f.startsWith(repo+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404);res.end();}
 }).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(()=>{
  if(localStorage.getItem('qa-radio-seeded'))return;
  const chars=[{id:'qa-a',name:'角色甲',persona:'虚构的装订师，今日和同事校对稿件。',tz:'0',voiceId:'qa-voice-a'},{id:'qa-b',name:'角色乙',persona:'虚构的校对师，和角色甲是同事。',tz:'0',voiceId:'qa-voice-b'},{id:'qa-c',name:'角色丙',persona:'没有参加校对的虚构角色。',tz:'0'}];
  const now=new Date(),day=now.toISOString().slice(0,10);
  const data={x_characters:chars,x_profile:{name:'测试听众'},x_rels:{'qa-a->qa-b':{label:'同事'},'qa-b->qa-a':{label:'同事'}},
   x_schedules:Object.fromEntries(chars.map(c=>[c.id,{[day]:{load:'NORMAL',generatedAt:Date.now(),seqs:[{seq:1,time:'00:00',end:'24:00',title:'一起校对装订稿',location:'工作室',type:'work',deviation:null}]}}])),
   x_api:[{id:'qa',name:'虚构模型',baseUrl:'https://fixture.invalid/v1',apiKey:'fixture-not-a-secret',model:'fixture'}],x_activeApi:'qa',
   x_autoRefreshPolicy_v1:{version:2,legacyMerged:true,features:Object.fromEntries(['phone','weekly','diary','wallet','schedule','desire','impression','moments','forum','whisper','capsule','gaze','proactive','letter','react','groupChat','listen','watch'].map(id=>[id,{global:false,chars:{}}]))},
   x_settings:{timeAware:true,autoDiary:false},x_ttsApi:{enabled:true,groupId:'fixture',apiKey:'fixture',baseUrl:'https://fixture.invalid',model:'fixture'}};
  Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));localStorage.setItem('qa-radio-seeded','1');
 });
 await page.goto('http://127.0.0.1:'+server.address().port);
 const flip=page.getByText('翻 开',{exact:true});if(await flip.count())await flip.click();
 await page.waitForFunction(()=>typeof window.__openFromNotif==='function' && !!window.RadioLifeScreen);
 if(await flip.count())await flip.click();

 await page.evaluate(()=>__openFromNotif(null,'config'));await page.getByText('接哪些模型',{exact:true}).click();await page.getByText('语音 API',{exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'自己的电脑',exact:true}).count(),0);
 for(const [label,provider] of [['Fish Audio','fish'],['ElevenLabs','elevenlabs'],['MiniMax','minimax']]){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.evaluate(()=>loadTtsApi().provider),provider);}
 for(const width of [320,390,430]){await page.setViewportSize({width,height:width===320?568:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'cloud-'+width+'.png')});}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({passed:true,providers:['minimax','elevenlabs','fish'],widths:[320,390,430],errors},null,2));console.log('Cloud TTS settings regression passed');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
