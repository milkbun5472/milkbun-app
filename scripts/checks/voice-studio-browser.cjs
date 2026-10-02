// 真实 App + 虚构角色/本地模型桩。不会读取真人存档或调用上游。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),out=process.env.VS_SHOTS || '/tmp/voice-studio-shots';fs.mkdirSync(out,{recursive:true});
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

 const requests=[];let rejectPin=false;
 const wav=Buffer.alloc(44+16000*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 for(let i=0;i<16000;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/16000)*1000),44+i*2);
 await page.route('https://computer.example/**',async r=>{const req=r.request();requests.push({url:req.url(),headers:req.headers(),body:req.postData()});if(rejectPin)return r.fulfill({status:401,json:{detail:'PIN required'}});if(req.url().endsWith('/voices'))return r.fulfill({json:{voices:[{voice_id:'profile-a',name:'电脑声音甲',type:'profile'},{voice_id:'alloy',name:'Alloy',type:'openai_alias'}],engines:[]}});return r.fulfill({contentType:'audio/wav',body:wav});});
 await page.evaluate(()=>{saveTtsApi({enabled:true,provider:'voicestudio',vsBase:'https://computer.example',vsKey:'fixture',vsPin:'123456',vsVoice:'default'});__openFromNotif(null,'config');});
 await page.getByText('接哪些模型',{exact:true}).click();await page.getByText('语音 API',{exact:true}).click();
 const root=page.locator('[data-voice-studio="settings"]');await root.waitFor();assert.equal(requests.length,0,'opening settings never generates audio');
 await root.getByText('连接电脑 · 读取音色',{exact:true}).click();await root.getByText('电脑声音甲',{exact:true}).waitFor();assert.equal(requests.length,1);assert.equal(requests[0].headers['x-omnivoice-pin'],'123456');
 await root.getByText('用作默认声音',{exact:true}).click();assert.equal(await page.evaluate(()=>loadTtsApi().vsVoice),'profile-a');
 await root.getByText('给 角色甲',{exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('x_characters')).find(c=>c.id==='qa-a').voiceId),'profile-a');
 await page.getByText("已把这个声音给 角色甲",{exact:true}).waitFor({state:"hidden"});
 for(const width of [320,390,430]){await page.setViewportSize({width,height:width===320?568:844});await root.evaluate(el=>{const scroll=el.closest(".overflow-y-auto");if(scroll)scroll.scrollTop=0;});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');await page.screenshot({path:path.join(out,'settings-'+width+'.png')});}
 await page.getByRole('button',{name:/试听/}).first().click();await root.getByText(/音频准备用了/).waitFor();assert.equal(requests.filter(r=>r.url.endsWith('/speech')).length,1);const speech=requests.find(r=>r.url.endsWith('/speech'));assert.equal(JSON.parse(speech.body).voice,'profile-a');
 await page.evaluate(()=>ttsSpeak('你好呀，听听我的声音合不合适？','profile-a'));assert.equal(requests.filter(r=>r.url.endsWith('/speech')).length,1,'repeat playback uses audio cache');
 const keys=await page.evaluate(()=>{const k=ttsKeyFor('测试','profile-a').key;saveTtsApi({vsBase:'https://second.example'});const k2=ttsKeyFor('测试','profile-a').key;saveTtsApi({vsBase:'https://computer.example',vsModel:'other-engine'});const k3=ttsKeyFor('测试','profile-a').key;saveTtsApi({vsModel:'tts-1'});return[k,k2,k3];});assert.equal(new Set(keys).size,3,'computer and model have separate cache keys');
 rejectPin=true;await root.getByText('连接电脑 · 读取音色',{exact:true}).click();await root.getByText(/检查连接 PIN/).waitFor();
 await page.screenshot({path:path.join(out,'pin-error.png')});assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({passed:true,widths:[320,390,430],checks:['manual connection','upstream voice schema','pin/key headers','default voice','role assignment','actual shared synthesis','cache replay','computer/model cache isolation','authentication error','no overflow'],errors},null,2));console.log('VoiceStudio browser checks passed');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
