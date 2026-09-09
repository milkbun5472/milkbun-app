const fs = require('fs');
// 无用户数据、无网络翻译或模型调用的真实 React 浏览器回归。
// PLAYWRIGHT_MODULE 可指向环境已有的 playwright 包，无需新增项目依赖。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = require('path').resolve(__dirname, '..') + '/';
const src = fs.readFileSync(root+'js/components.js','utf8');
const trans = src.slice(src.indexOf('function TransText('),src.indexOf('// 语音消息（',src.indexOf('function TransText(')));
const start=src.indexOf('recent.map((m, i) => {');
const render=src.slice(start,src.indexOf('\n  }),',start)+5);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.setContent('<div id="root"></div>');
 await page.addScriptTag({path:root+'vendor/react.production.min.js'});
 await page.addScriptTag({path:root+'vendor/react-dom.production.min.js'});
 await page.evaluate(({trans,render})=>{
  Object.assign(window,{h:React.createElement,useState:React.useState,useEffect:React.useEffect,
   useTheme:()=>({ink:'#222',line:'#999',fog:'#777'}),F_BODY:'sans-serif',BUBBLE_SKIN:{myText:'#222'},
   translatableLang:()=> '日文',transCacheGet:()=>null,
   translateLongToZh:text=>new Promise(resolve=>{window.pending={text,resolve}})});
  (0,eval)(trans);
  window.renderRows=new Function('list',`const recent=list.slice(-16),people=[],isGroup=false,primary=null,onPhoto=false,litText={},tp={play:null},callBubble=()=>({background:'#a8c7df',color:'#222'});return ${render};`);
  window.messages=Array.from({length:16},(_,i)=>({role:'char',content:'Japanese '+i,zh:'中文 '+i,ts:i}));
  window.paint=()=>ReactDOM.render(h('div',{},renderRows(messages)),document.getElementById('root'));
  paint();
 },{trans,render});
 await page.locator('[data-wk=translatebutton]').nth(1).click();
 if(await page.locator('[data-wk=translatebody]').count()!==1)throw Error('not opened');
 await page.evaluate(()=>{messages.push({role:'user',content:'不用ゼミ吗',ts:16});paint()});
 let text=await page.locator('[data-wk=translatebody]').allTextContents();
 if(text.length!==1||!text[0].includes('中文 1'))throw Error('window shifted translation');
 if(await page.locator('[data-wk=translatebutton]').last().textContent()!=='译')throw Error('new user inherited open state');
 await page.locator('[data-wk=translatebutton]').last().click();
 await page.waitForFunction(()=>!!window.pending);
 await page.evaluate(()=>{window.oldRequest=pending;messages[16]={role:'char',content:'New Japanese',zh:'新消息译文',ts:16};paint()});
 await page.evaluate(()=>oldRequest.resolve({zh:'过期错误译文',by:'免费'}));
 await page.locator('[data-wk=translatebutton]').last().click();
 text=await page.locator('[data-wk=translatebody]').allTextContents();
 if(text.some(t=>t.includes('过期错误'))||!text.some(t=>t.includes('新消息译文')))throw Error('async stale result');
 // 同一原文的模型中译晚到，也要替换旧实例。
 await page.evaluate(()=>{messages[16]={...messages[16],zh:'修订译文'};paint()});
 await page.locator('[data-wk=translatebutton]').last().click();
 if(!(await page.locator('[data-wk=translatebody]').last().textContent()).includes('修订译文'))throw Error('updated zh stale');
 if(process.env.QA_SCREENSHOT) await page.screenshot({path:process.env.QA_SCREENSHOT,fullPage:true});
 console.log('PASS: actual React window shift, user/character reuse, delayed translation, changed zh');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
