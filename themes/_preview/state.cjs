const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{const pack=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const OUT=process.argv[3];const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/index.html');await p.waitForTimeout(4000);
await p.evaluate(l=>{saveJSON('x_characters',[{id:'c1',name:'小白',affection:72,state:{thought:'四五个小时一条消息都不回，车间里吵得心烦',wearing:'深灰色连帽卫衣',action:'坐在工具箱上转着旋钮'}}]);const n=Date.now();saveJSON('x_states',{c1:{thought:'四五个小时一条消息都不回，车间里吵得心烦，平时嫌我话多，真没人理了又觉得空荡荡的',thoughtUpdatedAt:n,wearing:'深灰色连帽卫衣配黑色工装裤',wearingUpdatedAt:n,action:'坐在工具箱上转着旋钮',actionUpdatedAt:n,affection:72,updatedAt:n}});saveJSON('x_stateHist',{c1:[{thought:'今天下雨了不知道她带伞没',ts:n-9e6}]});saveJSON('x_chat:c1',[{role:'assistant',content:'汪',ts:Date.now()}]);saveJSON('x_chatSettings',{c1:Object.assign({gaze:true},l)});},pack.look);
await p.reload();await p.waitForTimeout(4500);await p.evaluate(()=>{const s=document.getElementById('qiu-splash');if(s)s.remove();window.__openFromNotif('c1','thread')});await p.waitForTimeout(2500);
const av=await p.$('button[data-wk="avatar"]'); if(av){await av.click();await p.waitForTimeout(1200);}
await p.screenshot({path:OUT+'/state-now.png'});
const tab=await p.$('[data-wk="statecard"] button[aria-pressed="false"]'); if(tab){await tab.click();await p.waitForTimeout(1500);await p.screenshot({path:OUT+'/state-gaze.png'});}
const more=await p.$('[data-wk="statehistbtn"]'); if(more){await p.click('[data-wk="statecard"] button[aria-pressed="false"]').catch(()=>{});} console.log(JSON.stringify({card:!!(await p.$('[data-wk="statecard"]')),tab:!!tab,errs:errs.slice(0,3)}));await b.close();})();
