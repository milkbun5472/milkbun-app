// 真 React 和 CallScreen，识别器/音频为桩；不申请真人麦克风，不连接识别服务。
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'js/components.js'),'utf8');
const fn=n=>{const i=src.indexOf('function '+n+'(');return src.slice(i,src.indexOf('\n}\n',i)+3);};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
  await page.setContent('<div id="root" style="position:relative;height:100dvh"></div>');
  for(const f of ['react.production.min.js','react-dom.production.min.js','tailwind.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,'vendor',f),'utf8')});
  await page.evaluate(()=>{
   Object.assign(window,{useState:React.useState,useRef:React.useRef,useEffect:React.useEffect,h:React.createElement,
    F_BODY:'sans-serif',F_DISPLAY:'serif',COMPOSER_PAD_BOTTOM:'calc(env(safe-area-inset-bottom) * 0.4)',
    useIdbImgUrl:()=>null,callBackdrop:()=> '#252a30',callBubble:()=>({background:'#abc',color:'#222'}),
    useCallAutoVoice:()=>[false],useTtsPlayer:()=>({stop(){}}),voiceEarsReady:()=>false,routeCallAudio(){},
    ttsReady:()=>false,prepareCallAudio:()=>{throw Error('开耳不该解锁播放');}});
   ['Svg','IPulse','ISend','CGlyph'].forEach(n=>window[n]=()=>h('svg',{width:18,height:18}));
   window.recs=[];window.sent=[];
   window.SpeechRecognition=class{
    constructor(){recs.push(this);}
    start(){this.started=true;if(this.onstart)this.onstart();}
    stop(){if(this.onend)this.onend();}
   };
   window.result=(text,rec=recs.at(-1))=>rec.onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});
  });
  await page.addScriptTag({content:['callActionsFor','CallSubtitle','CallScreen'].map(fn).join('\n')});
  await page.evaluate(()=>{
   window.props={mode:'video',stream:true,autoVoice:false,participants:[{id:'a',name:'甲'}],msgs:[
    {role:'char',turnId:'one',act:true,senderName:'甲',content:'他抬起手，把窗帘拉开。'},
    {role:'char',turnId:'one',content:'早上好'}],sending:false,onSend:t=>sent.push(t),onHangup(){},onMinimize(){},onRestore(){}};
   window.rr=ReactDOM.createRoot(document.getElementById('root'));
   window.draw=x=>{Object.assign(props,x);rr.render(h(CallScreen,props));};draw({});
  });
  await page.getByPlaceholder('说点什么…').waitFor();
  assert.equal(await page.locator('[data-call-actions]').count(),0);
  await page.getByRole('button',{name:'开启麦克风'}).click();
  await page.getByRole('button',{name:'关闭麦克风'}).waitFor();
  await page.evaluate(()=>result('测试识别'));
  assert.deepEqual(await page.evaluate(()=>sent),['测试识别']);
  await page.evaluate(()=>draw({sending:true}));
  await page.waitForTimeout(30);await page.evaluate(()=>result('这句先留着'));
  await page.waitForFunction(()=>document.querySelector('input').value==='这句先留着');
  assert.deepEqual(await page.evaluate(()=>sent),['测试识别']);
  await page.evaluate(()=>recs.at(-1).onerror({error:'not-allowed'}));
  await page.getByText(/麦克风权限被拒/).waitFor();
  await page.getByRole('button',{name:'开启麦克风'}).waitFor();
  await page.evaluate(()=>result('旧识别迟到'));assert.equal(await page.evaluate(()=>sent.length),1);
  await page.evaluate(()=>draw({sending:false}));
  await page.getByRole('button',{name:'开启麦克风'}).click();
  await page.evaluate(()=>recs.at(-1).onerror({error:'network'}));
  await page.getByText(/原生识别不可用/).waitFor();
  await page.getByRole('button',{name:'开启麦克风'}).waitFor();
  const box=await page.getByPlaceholder('说点什么…').boundingBox();
  assert.ok(box.y+box.height<=844 && box.y>700);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'/tmp/lisa-call-actions-'+width+'.png'});
  // 实际字幕组件：动作全文固定，只有台词按时钟逐字增长；小高度可滚而非压走输入栏。
  await page.evaluate(()=>{rr.unmount();rr=ReactDOM.createRoot(document.getElementById('root'));window.paintSubtitle=line=>rr.render(h('div',{style:{height:300,display:'flex',flexDirection:'column',background:'#252a30'}},h(CallSubtitle,{actions:[{senderName:'测试姓名',content:'固定动作全文'}],line})));paintSubtitle({text:'这是一句慢慢显示的台词',ms:3000,at:Date.now()});});
  await page.locator('[data-call-actions]').waitFor();assert.equal(await page.locator('[data-call-actions]').innerText(),'固定动作全文');
  await page.waitForTimeout(500);assert.equal(await page.locator('[data-call-actions]').innerText(),'固定动作全文');
  assert.ok(!(await page.locator('[data-call-subtitle]').innerText()).includes('这是一句慢慢显示的台词'));
  await page.screenshot({path:'/tmp/lisa-call-actions-speaking-'+width+'.png'});
  await page.evaluate(()=>paintSubtitle(null));
  await page.waitForFunction(()=>!document.querySelector('[data-call-actions]'));
  assert.equal(await page.locator('[data-call-subtitle]').innerText(),'');
  assert.equal(await page.locator('[data-call-subtitle]').count(),1);
  await page.evaluate(()=>rr.unmount());assert.deepEqual(errors,[]);await ctx.close();console.log(width+'px 动作固定/逐字台词/识别发送/忙时保留/权限与网络错误通过');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
