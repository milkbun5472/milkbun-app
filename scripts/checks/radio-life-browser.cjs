// 真实 App + 虚构角色/本地模型桩。不会读取真人存档或调用上游。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),out=process.env.RADIO_SHOTS || '/tmp/radio-life-shots';fs.mkdirSync(out,{recursive:true});
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
 await page.evaluate(()=>{
  window.qaPrompts=[];window.qaTts=[];window.qaAudios=[];window.qaRevoked=[];
  const original=window.RadioLifeScreen;window.RadioLifeScreen=function(p){window.qaRadioProps=p;return original(p);};
  window.callAI=async(p,system,messages,opts)=>{
   window.qaPrompts.push({system,messages,tag:opts?.tag});
   if(opts?.tag==='电台现场'){
    if(window.qaFailLife){window.qaFailLife=false;throw Error('本地测试：信号暂时中断');}
    if(window.qaLong) return JSON.stringify({title:'独处长段',lines:[{speakerId:'qa-a',speaker:'角色甲',text:(window.qaLongCount++ ? '乙':'甲').repeat(450)}]});
    if(window.qaPrompts.filter(x=>x.tag==='电台现场').length>1) return JSON.stringify({title:'开始装订',progress:{reached:'稿页已校对，开始装订',open:'装订仍在进行'},lines:[{speakerId:'qa-a',speaker:'角色甲',text:'校对好了，接下来把这些页装订成册。'}]});
    return JSON.stringify({title:'稿件的最后一页',progress:{reached:'第二页与末行已完成校对',open:'尚未装订'},lines:[{speakerId:'qa-a',speaker:'角色甲',text:'第二页的标注要改回去。'},{speakerId:'qa-b',speaker:'角色乙',text:'我把最后一行一起校对。'},{speakerId:'qa-a',speaker:'角色甲',text:'等核对完再装订。'}]});
   }
   if(opts?.tag==='共同电台')return JSON.stringify({lines:[{text:'这回的题目由你定，我先说刚才校稿时想到的一件事。'},{text:'你想从哪儿聊起？'}]});
   if(opts?.tag==='聊天')return JSON.stringify({word:['那份稿子确实刚校对过。你怎么听到的？'],mood:'平静',thought:'她怎么知道这件事。'});
   throw Error('浏览器测试不生成其他内容：'+opts?.tag);
  };
  window.ttsSpeak=async(text,voiceId)=>{window.qaTts.push({text,voiceId});return new Blob(['fixture'],{type:'audio/mpeg'});};
  window.Audio=function(url){this.url=url;this.play=()=>Promise.resolve();this.pause=()=>{this.paused=true;};window.qaAudios.push(this);};
  const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.qaRevoked.push(url);revoke(url);};
  window.__openFromNotif(null,'radio');
 });
 const root=page.locator('[data-radio-life]');await page.waitForTimeout(500);await root.waitFor();
 assert.equal(await page.evaluate(()=>qaPrompts.filter(x=>x.tag==='电台现场').length),0,'open does not generate');
 for(const [width,height] of [[320,568],[390,844],[430,932]]){
  await page.setViewportSize({width,height});assert.equal(await root.locator('.rl-receiver').count(),1);
  assert.ok(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'receiver stays inside width');
  assert.ok((await root.getByLabel('调到谁的频率').boundingBox()).height>=40);
  assert.ok(await root.locator('.rl-invitation').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'tap invitation visible in first screen');
  await page.screenshot({path:path.join(out,'receiver-'+width+'.png')});
 }
 await page.setViewportSize({width:390,height:844});
 await root.locator('[data-radio-scene]').click();
 await root.getByText('第二页的标注要改回去。',{exact:true}).waitFor();
 assert.equal(await root.getByText('我把最后一行一起校对。',{exact:true}).count(),0,'unheard lines stay hidden');
 const scenePrompt=await page.evaluate(()=>qaPrompts.find(x=>x.tag==='电台现场'));
 assert.match(scenePrompt.system,/虚构的装订师/);assert.match(scenePrompt.system,/虚构的校对师/);assert.doesNotMatch(scenePrompt.system,/没有参加校对的虚构角色/);
 assert.match(scenePrompt.system,/不知道有人正在收听/);assert.ok(scenePrompt.messages.length===1&&scenePrompt.messages[0].content.length<50);
 assert.equal(await root.getByRole('button',{name:/继续听下一句|接着听现场后续|连续收听|听第.*句/}).count(),0,'live stream has no boxed advance or per-line buttons');
 assert.equal(await page.evaluate(()=>RadioLife.contextFor('qa-c')),'');assert.equal(await page.evaluate(()=>qaTts.length),0,'receive does not charge TTS until play');
 await root.getByRole('button',{name:'朗读',exact:true}).click();await page.waitForFunction(()=>qaTts.length===1);
 await page.evaluate(()=>qaAudios.at(-1).onplaying());await root.getByText('正在说…',{exact:true}).waitFor();
 assert.equal(await root.locator('[data-radio-stage]').getAttribute('data-speaking'),'1');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await root.locator('.rl-wave i').first().evaluate(el=>getComputedStyle(el).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 assert.equal(await root.locator('.rl-wave i').first().evaluate(el=>getComputedStyle(el).animationName),'rl-wave');
 const custom=await page.addStyleTag({content:'[data-wk="radiocaption"] { color: rgb(210, 180, 140) !important; }'});assert.equal(await root.locator('[data-radio-transcript]').evaluate(el=>getComputedStyle(el).color),'rgb(210, 180, 140)');await custom.evaluate(el=>el.remove());
 await page.screenshot({path:path.join(out,'speaking.png')});
 assert.deepEqual(await page.evaluate(()=>qaTts[0]),{text:'第二页的标注要改回去。',voiceId:'qa-voice-a'});
 await page.evaluate(()=>qaAudios.at(-1).onended());
 await root.getByText('这句说完了 · 轻点继续',{exact:true}).waitFor();assert.equal(await root.locator('[data-radio-stage]').getAttribute('data-speaking'),'0');await page.screenshot({path:path.join(out,'stage-ended.png')});
 assert.equal(await page.evaluate(()=>qaTts.length),1,'speech completion does not advance the stream');
 await root.locator('[data-radio-transcript]').click();await page.waitForFunction(()=>qaTts.length===2);
 assert.equal(await root.getByText('第二页的标注要改回去。',{exact:true}).count(),0,'previous paragraph leaves the screen');
 assert.equal(await page.evaluate(()=>qaTts[1].voiceId),'qa-voice-b');
 await root.getByRole('button',{name:'静音',exact:true}).click();assert.ok(await page.evaluate(()=>qaAudios.at(-1).paused));
 assert.equal(await page.evaluate(()=>qaRevoked.length),2,'finished and canceled object URLs are released');
 await root.getByRole('button',{name:'收藏',exact:true}).click();await root.getByRole('button',{name:'已收藏',exact:true}).waitFor();
 const own=await page.evaluate(()=>RadioLife.contextFor('qa-a'));assert.match(own,/第二页的标注/);assert.doesNotMatch(own,/等核对完再装订/);
 assert.match(await page.evaluate(()=>RadioLife.contextFor('qa-b')),/最后一行/);assert.equal(await page.evaluate(()=>RadioLife.contextFor('qa-c')),'');
 await root.getByRole('button',{name:'聊聊',exact:true}).click();await page.waitForFunction(()=>document.documentElement.getAttribute('data-lisa-screen')==='thread');
 await page.getByPlaceholder('发一条消息…').fill('你刚才是不是跟角色乙说第二页的标注要改回去？');await page.getByTitle('让 TA 回复',{exact:true}).click();
 await page.waitForFunction(()=>qaPrompts.some(x=>x.tag==='聊天'));
 const chat=await page.evaluate(()=>qaPrompts.find(x=>x.tag==='聊天'));assert.match(chat.system,/第二页的标注要改回去/);assert.match(chat.system,/没有收到任何通知/);assert.doesNotMatch(chat.system,/等核对完再装订/);
 await page.getByText('那份稿子确实刚校对过。你怎么听到的？',{exact:true}).waitFor();
 await page.evaluate(()=>__openFromNotif(null,'radio'));await root.waitFor();
 await root.locator('[data-radio-scene]').click();await root.getByText('我把最后一行一起校对。',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>qaPrompts.filter(x=>x.tag==='电台现场').length),1,'re-enter reuses scene without charging');
 await root.locator('[data-radio-transcript]').click();await root.getByText('等核对完再装订。',{exact:true}).waitFor();
 await root.getByText('本段已结束',{exact:true}).waitFor();
 for(let i=0;i<3;i++)await root.locator('[data-radio-transcript]').click();
 assert.equal(await page.evaluate(()=>qaPrompts.filter(x=>x.tag==='电台现场').length),1,'tapping the last line does not generate a fresh segment');
 await root.getByRole('button',{name:'接着听后续',exact:true}).click();await page.waitForFunction(()=>qaPrompts.filter(x=>x.tag==='电台现场').length===2);
 await root.getByText('校对好了，接下来把这些页装订成册。',{exact:true}).waitFor();
 const continuation=await page.evaluate(()=>qaPrompts.filter(x=>x.tag==='电台现场')[1].system);assert.match(continuation,/第二页与末行已完成校对/);assert.match(continuation,/尚未装订/);
 await page.screenshot({path:path.join(out,'segment-ended.png')});
 // Populate collection through the actual radio writer, then verify full-page return restores its scroll.
 await page.evaluate(()=>{
  const p=qaRadioProps,c=p.characters[0],s=p.sceneFor(c);
  const d=RadioLife.read();for(let i=0;i<18;i++){const e=RadioLife.accept({title:'收藏测试 '+i,lines:[{speakerId:c.id,text:'已保存的独立片段 '+i}]},{...s,key:s.key+'-collection-fixture-'+i},[c],i+100);d.events.push({...e,heard:1,savedAt:Date.now()});}saveJSON(RadioLife.KEY,d);
 });
 await root.locator('[data-watch=back]').click();
 await root.getByRole('button',{name:'录音架',exact:true}).click();const scroll=root.locator('[data-radio-life-scroll]');
 await scroll.evaluate(el=>el.scrollTop=350);const top=await scroll.evaluate(el=>el.scrollTop);await page.screenshot({path:path.join(out,'tapes.png')});
 await root.getByRole('button',{name:/收藏测试 13/}).evaluate(el=>el.click());await root.getByRole('button',{name:'回听这段',exact:true}).waitFor();
 await root.locator('[data-watch=back]').click();assert.ok(Math.abs(await scroll.evaluate(el=>el.scrollTop)-top)<2,'collection scroll preserved');
 for(const [width,height] of [[320,568],[390,844],[430,932]]){
  await page.setViewportSize({width,height});if(await root.getByRole('button',{name:'生活频率',exact:true}).count()){await root.getByRole('button',{name:'生活频率',exact:true}).click();await root.locator('[data-radio-scene]').click();}
  await root.locator('[data-radio-scene]').waitFor();
  const sizes=await root.evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,height:el.clientHeight,body:el.querySelector('[data-radio-life-scroll]').clientHeight}));
  assert.ok(sizes.scroll<=sizes.width+1,'no horizontal overflow at '+width);assert.ok(sizes.body>100);assert.ok(sizes.height<=height+1);
  assert.equal(await root.locator('[data-radio-transcript]').count(),1,'one paragraph per screen');
  assert.ok(await root.locator('[data-radio-life-scroll]').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'full-screen stage has no vertical scroll at '+width);
  const stageBox=await root.locator('[data-radio-transcript]').boundingBox();assert.ok(stageBox.y+stageBox.height<height-60,'paragraph fits above controls');
  assert.ok((await root.getByRole('button',{name:/^(已收藏|收藏)$/}).boundingBox()).height>=40);
  await page.screenshot({path:path.join(out,'live-'+width+'.png')});
 }
 await root.locator('[data-watch=back]').click();
 await page.evaluate(()=>{qaLong=true;qaLongCount=0;saveJSON(RadioLife.KEY,{...RadioLife.read(),events:RadioLife.read().events.filter(e=>e.savedAt).map(e=>({...e,scene:{...e.scene,key:e.scene.key+"-archived-fixture"}}))});});
 await root.locator('[data-radio-scene]').click();await root.getByText('甲'.repeat(90),{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>RadioLife.read().events.at(-1).heard),0,'long original line stays out of facts before all pages are shown');
 await page.setViewportSize({width:320,height:568});
 const longBounds=await root.locator('[data-radio-transcript]').boundingBox(),toolsBounds=await root.locator('.rl-tools').boundingBox();
 assert.ok(longBounds.y>=70 && longBounds.y+longBounds.height<toolsBounds.y,'90-character screen fits at 320px');
 assert.ok(await root.locator('[data-radio-life-scroll]').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'long screen does not scroll');
 await page.screenshot({path:path.join(out,'long-320.png')});await page.setViewportSize({width:430,height:932});
 for(let i=0;i<4;i++)await root.locator('[data-radio-transcript]').click();
 assert.equal(await page.evaluate(()=>RadioLife.read().events.at(-1).heard),1,'last page commits the full original line');
 assert.equal(await root.locator('[data-radio-transcript]').innerText(),'甲'.repeat(90));
 await page.setViewportSize({width:320,height:568});
 const endCaption=await root.locator('[data-radio-transcript]').boundingBox(),endControls=await root.locator('.rl-tools').boundingBox();
 assert.ok(endCaption.y+endCaption.height<endControls.y,'90-character last sentence fits above controls');
 assert.ok(await root.locator('[data-radio-life-scroll]').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'end of long segment does not scroll');
 await page.screenshot({path:path.join(out,'long-ended-320.png')});await page.setViewportSize({width:430,height:932});
 await page.evaluate(()=>qaFailLife=true);await root.getByRole('button',{name:'接着听后续',exact:true}).click();await root.getByRole('alert').waitFor();
 assert.ok(await root.locator('[data-radio-life-scroll]').evaluate(el=>el.scrollHeight<=el.clientHeight+1),'failed receive does not push controls off stage');
 await root.getByRole('button',{name:'接着听后续',exact:true}).click();await root.getByText('乙'.repeat(90),{exact:true}).waitFor();await root.getByRole('alert').waitFor({state:'hidden'});
 await root.locator('[data-watch=back]').click();
 await root.getByRole('button',{name:'录音间',exact:true}).click();await root.getByLabel('你们的台名').fill('校稿间隙');await root.getByRole('button',{name:'建好录音间',exact:true}).click();
 await root.getByLabel('今天想聊什么').fill('我们怎么选第一期主题');await root.getByRole('button',{name:'一起试播',exact:true}).click();
 await root.getByText('你想从哪儿聊起？',{exact:true}).waitFor();await root.getByLabel('递话题／插一句').fill('我想先聊你那本装订册。');await root.getByRole('button',{name:'递给搭档',exact:true}).click();
 await root.getByText('我想先聊你那本装订册。',{exact:true}).waitFor();await root.getByLabel('给这一期起个名字').fill('从装订册聊起');
 await page.screenshot({path:path.join(out,'studio.png')});
 await root.getByRole('button',{name:'收麦，留下这一期',exact:true}).click();await root.getByRole('button',{name:'去找搭档聊聊',exact:true}).waitFor();
 assert.match(await page.evaluate(()=>RadioLife.contextFor('qa-a')),/从装订册聊起/);assert.equal(await page.evaluate(()=>RadioLife.contextFor('qa-c')),'');
 await root.locator('[data-watch=back]').click();await root.getByRole('button',{name:'从装订册聊起',exact:true}).click();await root.getByRole('button',{name:'回听本期',exact:true}).waitFor();
 // Actual reload hydrates the new durable IDB key and keeps the original heard/save state.
 await page.reload();if(await flip.count())await flip.click();await page.waitForFunction(()=>typeof __openFromNotif==='function');
 assert.ok(await page.evaluate(()=>RadioLife.read().events.some(e=>e.savedAt&&e.title==='稿件的最后一页')));
 assert.ok(await page.evaluate(()=>RadioLife.read().shows[0].episodes[0].status==='finished'));
 await page.evaluate(()=>__openFromNotif(null,'radioArchive'));await page.getByLabel('想听谁的时间线').waitFor();
 const result={passed:['real App radio generation/full persona','no auto requests','participant isolation','MiniMax character voice switching','cancel/revoke','same-schedule chat original facts','re-enter single generation','segment end stops taps/explicit continuation with saved progress','collection scroll return','320/390/430 receiver and full-screen/90-character no scroll','joint recording/archive','IDB reload','legacy archive'],errors};
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(result,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
 await ctx.close();
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
