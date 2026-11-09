const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({p,r,f,refresh,out,result})=>{
 const {pan}=await require('./_post-office-camera.cjs')({p,r,f}),actions=['wave','bow','hand'];
 await p.evaluate(actions=>{const s={...shopFixture,phase:'closed',customers:[],badge:{柜台:'card1',分拣:'card2',送信:'card3',看店:'card4'}};s.closingHistory=actions.map((action,i)=>({key:'date:2026-10-'+(i+1),date:'2026-10-'+(i+1),day:i+1,lines:['构造的工牌动作检查。'],turns:[{speakerId:'a',actorId:'a',targetId:action==='hand'?'b':null,action,text:'构造的工牌动作检查。'}],cast:{柜台:'a',分拣:'b',送信:'c',看店:'d'}}));saveJSON('x_stampShop',StampShop.restore(s));const st=loadJSON('x_stamps',{});st.cards.forEach(c=>c.face='shop-test-image');saveJSON('x_stamps',st);},actions);await refresh();await f.waitForFunction(()=>PostOfficeGame.snapshot().projection.stories.length===3);
 const archive=await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null)));result.badgeActions=[];
 for(const [i,action]of actions.entries()){
  await f.evaluate(key=>{PostOfficeGame.pause(false);window.badgeRun=PostOfficeGame.startClosing(key);window.badgeRun.catch(e=>window.badgeError=e.message);},'date:2026-10-'+(i+1));await f.waitForFunction(action=>PostOfficeGame.snapshot().performance?.action===action,action);
  const s=await f.evaluate(action=>{let s;for(let n=0;n<1800;n++){PostOfficeGame.step(.025);s=PostOfficeGame.snapshot();if(s.performance?.action===action&&s.performance.progress>=(action==='hand'?.43:.45))break;}PostOfficeGame.pause(true);PostOfficeGame.draw();return s;},action),a=s.people.find(a=>a.id==='a');
  assert.equal(s.performance.action,action);assert.ok(a.badgeView.attachment.fitted);assert.equal(a.badgeView.attachment.clearance,.003);
  await p.setViewportSize({width:390,height:844});await r.getByRole('button',{name:'全景',exact:true}).click();
  for(let n=0;n<16;n++){const b=(await f.evaluate(()=>PostOfficeGame.snapshot())).people.find(a=>a.id==='a').badgeView.bounds,box=await r.locator('iframe').boundingBox(),dx=box.width/2-(b.left+b.right)/2,dy=box.height/2-(b.top+b.bottom)/2;if(Math.hypot(dx,dy)<2)break;await pan(Math.max(-55,Math.min(55,dx)),Math.max(-55,Math.min(55,dy)));}
  const box=await r.locator('iframe').boundingBox();await p.mouse.move(box.width/2,box.y+box.height/2);for(let n=0;n<8;n++)await p.mouse.wheel(0,-180);await p.screenshot({path:path.join(out,'badge-'+action+'.png')});
  result.badgeActions.push({action,attachment:a.badgeView.attachment});await f.evaluate(()=>{PostOfficeGame.pause(false);for(let n=0;n<2000;n++)PostOfficeGame.step(.05);PostOfficeGame.draw();});await f.waitForFunction(()=>!PostOfficeGame.snapshot().performing);
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),archive);result.badgeActionsSaveUnchanged=true;
};
