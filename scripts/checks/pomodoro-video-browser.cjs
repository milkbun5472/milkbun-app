// Full App with isolated fictional storage and local API/video fixtures; no paid calls.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),out=process.env.POM_VIDEO_SHOTS||'/tmp/pomodoro-video-shots';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const cp=require('node:child_process');if(!fs.existsSync(process.env.POM_VIDEO_FIXTURE||'/tmp/pomodoro-video-fixture.mp4'))cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x8d9d87:s=384x512:r=24','-t','1','-vf','drawbox=x=145:y=150:w=94:h=110:color=0xefcfaa:t=fill','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','/tmp/pomodoro-video-fixture.mp4','-y']);if(!fs.existsSync(process.env.POM_IMAGE_FIXTURE||'/tmp/pomodoro-image-fixture.png'))cp.execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-i',process.env.POM_VIDEO_FIXTURE||'/tmp/pomodoro-video-fixture.mp4','-frames:v','1','/tmp/pomodoro-image-fixture.png','-y']);
 const server=http.createServer((req,res)=>{
  if(req.url==='/fixture.png'){res.setHeader('Content-Type','image/png');return res.end(fs.readFileSync(process.env.POM_IMAGE_FIXTURE||'/tmp/pomodoro-image-fixture.png'));}
  if(req.url==='/fixture.mp4'){res.setHeader('Content-Type','video/mp4');return res.end(fs.readFileSync(process.env.POM_VIDEO_FIXTURE||'/tmp/pomodoro-video-fixture.mp4'));}
  const file=path.resolve(repo,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(repo+path.sep)){res.writeHead(403);return res.end();}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404);res.end();}
 }).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],calls=[];let pending=false,queryCount=0,failDownload=false;
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.route('https://**/*',async route=>{
  const url=new URL(route.request().url()),req=route.request();
  if(url.pathname==='/v1/video_generation'){calls.push({host:url.host,method:req.method(),body:JSON.parse(req.postData())});return route.fulfill({json:{task_id:'1234567890123456789',base_resp:{status_code:0}}});}
  if(url.pathname==='/v1/query/video_generation'){queryCount++;calls.push({host:url.host,method:req.method(),query:true});return route.fulfill({json:{status:pending?'Processing':'Success',file_id:'1234567890123456788',base_resp:{status_code:0}}});}
  if(url.pathname==='/v1/files/retrieve'){return route.fulfill({json:{file:{download_url:origin+'/fixture.mp4'},base_resp:{status_code:0}}});}
  return route.abort();
 });
 await page.route(origin+'/fixture.mp4',route=>failDownload?route.fulfill({status:503,body:'offline'}):route.continue());
 await page.addInitScript(()=>{
  if(localStorage.getItem('qa-pom-video'))return;
  const data={x_characters:[{id:'qa-a',name:'角色甲',persona:'虚构的装订师，今天准备校对书稿。',voiceId:'qa-voice'},{id:'qa-b',name:'角色乙',persona:'虚构的校对师。'}],x_profile:{name:'测试读者'},x_api:[{id:'qa',name:'虚构模型',baseUrl:'https://fixture.invalid/v1',apiKey:'fixture',model:'fixture'}],x_activeApi:'qa',x_videoApi:{enabled:true,baseUrl:'https://api.minimax.io',apiKey:'fixture',model:'MiniMax-Hailuo-2.3-Fast',duration:6,resolution:'768P'},x_ttsApi:{enabled:true,baseUrl:'https://fixture.invalid',apiKey:'fixture',groupId:'fixture',model:'fixture'},x_settings:{timeAware:true,autoDiary:false},x_autoRefreshPolicy_v1:{version:2,legacyMerged:true,features:Object.fromEntries(['phone','weekly','diary','wallet','schedule','desire','impression','moments','forum','whisper','capsule','gaze','proactive','letter','react','groupChat','listen','watch'].map(id=>[id,{global:false,chars:{}}]))}};
  Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,JSON.stringify(v)));localStorage.setItem('qa-pom-video','1');
 });
 async function open(expectFocus=false){await page.goto(origin);const flip=page.getByText('翻 开',{exact:true});if(await flip.count())await flip.click();await page.waitForFunction(()=>typeof window.__openFromNotif==='function'&&!!window.PomodoroVideoEditor);if(await flip.count())await flip.click();await page.evaluate(()=>{
  window.qaImages=[];window.generateSelfieImage=async(prompt,refs,opts)=>{qaImages.push({prompt,refs,opts});return {blob:await (await fetch('/fixture.png')).blob()};};
  window.qaTts=[];window.ttsSpeak=async(text,voiceId)=>{qaTts.push({text,voiceId});return new Blob(['fixture'],{type:'audio/mpeg'});};window.Audio=function(){this.play=()=>Promise.resolve();this.pause=()=>{this.paused=true;};};
  window.callAI=async()=>JSON.stringify({notes:['稿页先从第一行看起。','这页的标点核对好了。','把最后一行看完就收桌。'],done:'今天的稿页校对完了。',left:'这页留着，下次接着看。',pause:'我把稿页放在这里。'});window.__openFromNotif(null,'pomodoro');});if(expectFocus)await page.getByLabel('听桌边纸条').waitFor();else await page.locator('[data-pomodoro-video-entry]').waitFor();}
 await open();assert.equal(calls.length,0,'open does not call paid video API');
 await page.locator('[data-pomodoro-video-entry]').click();const editor=page.locator('[data-pomodoro-video-editor]');
 await editor.locator('input[type=file]').first().setInputFiles(process.env.POM_IMAGE_FIXTURE||'/tmp/pomodoro-image-fixture.png');await page.getByText('原图已选好，点生成才会制作视频。',{exact:true}).waitFor();
 await editor.getByRole('button',{name:'用图像 API 生成新图',exact:true}).click();await page.getByText('新图已保存。喜欢这张图，再点生成动画。',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>qaImages.length),1);assert.equal(calls.length,0,'image generation does not automatically create a video');
 for(const [width,height] of [[320,568],[390,844],[430,932]]){await page.setViewportSize({width,height});assert.ok(await editor.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await editor.getByRole('button',{name:/生成动画/}).scrollIntoViewIfNeeded();assert.ok((await editor.getByRole('button',{name:/生成动画/}).boundingBox()).height>=40);await page.screenshot({path:path.join(out,'editor-'+width+'.png')});}
 await page.setViewportSize({width:390,height:844});
 // Configuration full-page return restores editor scroll; all three presets use shared URLs.
 const beforeScroll=await editor.locator('.overflow-y-auto').evaluate(el=>el.scrollTop);
 await editor.getByRole('button',{name:'接口',exact:true}).click();const config=page.locator('[data-video-api-config]');
 await page.screenshot({path:path.join(out,'config-before.png')});
 for(const label of ['国内 minimaxi.com','老国内站','国际版 platform.minimax.io']){await config.getByRole('button',{name:label,exact:true}).click();assert.equal(await config.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');}
 assert.equal(await config.locator('input[type=password]').inputValue(),'fixture');await page.screenshot({path:path.join(out,'config.png')});
 await page.locator('[data-wk="head"] button').first().click();assert.ok(Math.abs(await editor.locator('.overflow-y-auto').evaluate(el=>el.scrollTop)-beforeScroll)<3);
 pending=true;await editor.getByRole('button',{name:/生成动画/}).click();await page.getByText('正在生成动作…',{exact:true}).waitFor();assert.equal(calls.filter(c=>c.body).length,1);assert.equal(calls[0].body.duration,6);assert.equal(calls[0].body.resolution,'768P');assert.match(calls[0].body.first_frame_image,/^data:image\/png;base64,/);
 await page.locator('[data-wk="head"] button').first().click();pending=false;await page.locator('[data-pomodoro-video-entry]').click();await editor.getByRole('button',{name:'满意，就一直用这段',exact:true}).waitFor();assert.equal(calls.filter(c=>c.body).length,1,'resume only queries original task');
 await editor.locator('video').evaluate(v=>v.play());await page.screenshot({path:path.join(out,'preview.png')});
 await editor.getByRole('button',{name:'满意，就一直用这段',exact:true}).click();await page.locator('[data-pomodoro-video-entry]').waitFor();assert.ok(await page.evaluate(()=>VideoApi.media('qa-a').videoRef));assert.equal(await page.evaluate(()=>VideoApi.media('qa-b')),null);
 await page.getByRole('button',{name:/坐下，上发条/}).click();await page.getByLabel('听桌边纸条').waitFor();await page.waitForFunction(()=>!!document.querySelector('[data-pomodoro-video] video')?.src);const video=page.locator('[data-pomodoro-video] video');
 await video.evaluate(v=>v.play());assert.deepEqual(await video.evaluate(v=>[v.loop,v.muted,v.playsInline]),[true,true,true]);
 const motionBox=await page.getByRole('button',{name:'暂停画面',exact:true}).boundingBox(),clockBox=await page.getByRole('button',{name:'暂停',exact:true}).boundingBox();assert.ok(motionBox.y+motionBox.height<=clockBox.y,'video controls do not overlap timer controls');
 await page.getByLabel('点击陪伴画面听语音').click({position:{x:100,y:450}});await page.waitForFunction(()=>qaTts.length===1);assert.equal(await page.evaluate(()=>qaTts[0].voiceId),'qa-voice');assert.equal(calls.filter(c=>c.body).length,1,'voice does not regenerate video');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-pomodoro-video] video').paused);await page.emulateMedia({reducedMotion:'no-preference'});
 for(const [width,height] of [[320,568],[390,844],[430,932]]){await page.setViewportSize({width,height});assert.ok(await page.locator('[data-pomodoro-video]').evaluate(el=>el.getBoundingClientRect().width<=innerWidth+1));await page.screenshot({path:path.join(out,'focus-'+width+'.png')});}
 await open(true);await page.getByLabel('听桌边纸条').waitFor();await page.waitForFunction(()=>!!document.querySelector('[data-pomodoro-video] video')?.src);assert.equal(calls.filter(c=>c.body).length,1,'reload restores saved local video without a new task');
 // Download failure keeps task/file identifiers and current selected video; only GET is retried.
 await page.evaluate(()=>{localStorage.removeItem('x_pomodoro_active');window.__openFromNotif(null,'home');});await page.evaluate(()=>window.__openFromNotif(null,'pomodoro'));await page.locator('[data-pomodoro-video-entry]').click();
 failDownload=true;await page.evaluate(()=>VideoApi.patchMap(VideoApi.keys.JOBS,'qa-a',{taskId:'retry',baseUrl:VideoApi.load().baseUrl,imageRef:VideoApi.media('qa-a').imageRef}));
 await page.locator('[data-wk="head"] button').first().click();await page.locator('[data-pomodoro-video-entry]').click();await page.getByText(/下载视频失败/).waitFor();assert.ok(await page.evaluate(()=>VideoApi.job('qa-a').fileId));failDownload=false;await editor.getByRole('button',{name:'查询原任务 / 重试下载',exact:true}).click();await editor.getByRole('button',{name:'满意，就一直用这段',exact:true}).waitFor();assert.equal(calls.filter(c=>c.body).length,1);
 await page.evaluate(()=>window.__openFromNotif(null,'config'));await page.getByText('接哪些模型',{exact:true}).click();await page.getByText('视频 API',{exact:true}).click();await page.locator('[data-video-api-config]').waitFor();await page.screenshot({path:path.join(out,'settings-video-api.png')});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks:"image/create/resume/adopt/reload/voice/download retry/settings/mobile layout",errors,createCalls:1,queryCount,calls},null,2));console.log('PASS: Full App video create/resume/adopt/reload/voice/download retry and 320/390/430px layouts.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
