const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({p,r,f,refresh,out,result}){
 const {pan}=await require('./_post-office-camera.cjs')({p,r,f});
 const snap=()=>f.evaluate(()=>PostOfficeGame.snapshot());
 const drive=async({kind='talk',progress=0,stop=true}={})=>f.evaluate(({kind,progress,stop})=>{PostOfficeGame.pause(false);let s;for(let i=0;i<2600;i++){PostOfficeGame.step(.025);s=PostOfficeGame.snapshot();if(s.flow.meeting?.phase==='talk'&&s.performance?.action===kind&&s.performance.progress>=progress)break;}if(stop)PostOfficeGame.pause(true);PostOfficeGame.draw();return s;},{kind,progress,stop});
 const advance=()=>f.evaluate(()=>{PostOfficeGame.pause(false);for(let i=0;i<12;i++)PostOfficeGame.step(.025);PostOfficeGame.pause(true);PostOfficeGame.draw();return PostOfficeGame.snapshot();});
 async function seed(id,bench,rows){
  await p.clock.setFixedTime(new Date('2026-11-08T20:00:00-06:00'));
  await p.evaluate(async({id,bench,rows})=>{const sh={...shopFixture,phase:'open',period:'傍晚',roster:{柜台:'a',分拣:'b',看店:'d'},customers:[{id,visitor:true,charId:'c',fee:12},{id:'face-npc',name:'寄信客人',fee:12}],closing:[]};if(!bench)sh.decor=sh.decor.filter(n=>n!=='靠窗的长凳');saveJSON('x_stampShop',sh);
   await StampShop.run('meet',{id,characters:['a','b','c','d'].map(id=>({id,name:'店员'+id})),cards:loadJSON('x_stamps',{}).cards,onChat:async(id,data)=>{shopRequests.push({id,...data});return rows;}});
  },{id,bench,rows});await f.evaluate(()=>PostOfficeGame.pause(false));await refresh();
 }
 function pair(s,id){return [s.people.find(x=>x.id==='a'),s.people.find(x=>x.id===id)];}
 function check(s,id,seated=true){
  assert.equal(s.performance?.kind,'meet');const[a,b]=pair(s,id);assert.ok(a&&b);assert.equal(b.posture==='sit',seated);
  for(const [u,v]of [[a,b],[b,a]]){const dx=v.x-u.x,dz=v.z-u.z,flat=Math.hypot(u.forward[0],u.forward[2]),dot=(u.forward[0]*dx+u.forward[2]*dz)/(Math.hypot(dx,dz)*flat);assert.ok(dot>.97,JSON.stringify({id:u.id,dot,position:[u.x,u.z],forward:u.forward,other:[v.x,v.z],performance:s.performance}));}
  assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<1.2);return {index:s.performance.index,actor:[a.x,a.z],visitor:[b.x,b.z],forward:[a.forward,b.forward],seated};
 }
 async function framePair(id,width,height){
  await p.setViewportSize({width,height});await r.getByRole('button',{name:'全景',exact:true}).click();const box=await r.locator('iframe').boundingBox();
  await p.mouse.move(box.x+box.width*.72,box.y+box.height*.4);await p.mouse.down();await p.mouse.move(box.x+box.width*.72-140,box.y+box.height*.4,{steps:12});await p.mouse.up();
  for(let i=0;i<18;i++){const q=await f.evaluate(id=>{const s=PostOfficeGame.snapshot(),a=s.people.find(x=>x.id==='a'),b=s.people.find(x=>x.id===id);return PostOfficeGame.project((a.x+b.x)/2,.86,(a.z+b.z)/2);},id),dx=box.width/2-q.x,dy=box.height/2-q.y;if(Math.hypot(dx,dy)<2)break;await pan(Math.max(-55,Math.min(55,dx)),Math.max(-55,Math.min(55,dy)));}
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<3;i++)await p.mouse.wheel(0,-180);
 }
 async function end(){await f.getByRole('button',{name:'结束演出',exact:true}).click();await f.evaluate(()=>{PostOfficeGame.pause(false);for(let i=0;i<1400;i++)PostOfficeGame.step(.05);PostOfficeGame.draw();PostOfficeGame.pause(true);});assert.equal((await snap()).flow.meeting,null);}
 const texts=['刚才路过街角的小店，发现那里已经换了招牌。','我早上也经过了，原来那盆花还摆在门边。','今天的风很大，进来的时候差点没扶住门。','在这里坐一会儿，等风小一点再走。','那我慢慢说，你忙的时候就先忙。','这会儿没什么事，我听着。'];
 const rows=Array.from({length:24},(_,i)=>({speakerId:i%2?'a':'c',text:texts[i%texts.length]}));await seed('face-visitor',true,rows);let s=await drive();assert.equal(s.performance?.total,24);const original=await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null).customers[0].meetTurns));result.facing=[];
 for(let i=0;i<24;i++){
  if(i)await f.getByRole('button',{name:'下一句',exact:true}).click();
  if(i===8){await p.evaluate(()=>StampShop.run('serve',{id:'face-npc',characters:['a','b','c','d'].map(id=>({id,name:'店员'+id})),cards:loadJSON('x_stamps',{}).cards}));await refresh();}
  else if(i%3===0)await refresh();
  s=await advance();assert.equal(s.performance?.index,i);result.facing.push(check(s,'face-visitor'));
  if([0,9,16].includes(i)){const [w,h]=i===0?[320,568]:i===9?[390,844]:[430,932];await framePair('face-visitor',w,h);await p.screenshot({path:path.join(out,'visit-facing-'+w+'.png')});assert.equal(await r.evaluate(el=>el.scrollWidth>innerWidth),false);assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 }
 assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null).customers[0].meetTurns)),original);await end();s=await snap();assert.equal(s.people.find(x=>x.id==='a').phase,'working');assert.equal(s.people.find(x=>x.id==='face-visitor').posture,'sit');
 await seed('face-standing',false,rows.slice(0,4));s=await drive();check(s,'face-standing',false);await framePair('face-standing',390,844);await p.screenshot({path:path.join(out,'visit-standing.png')});await end();result.standingVisit=true;
 await seed('face-letter',true,[{speakerId:'c',text:'店员c笑了起来，接着把话说完。'},{speakerId:'a',text:'店员a把信递给店员c。'},{speakerId:'c',text:'谢谢，下一次再来。'}]);s=await drive({kind:'laugh',progress:.4});check(s,'face-letter');await f.getByRole('button',{name:'下一句',exact:true}).click();s=await drive({kind:'hand',progress:.44});check(s,'face-letter');assert.ok(s.pairContact?.giverDistance<.13&&s.pairContact?.receiverDistance<.13,JSON.stringify(s.pairContact));await framePair('face-letter',390,844);await p.screenshot({path:path.join(out,'visit-seated-hand.png')});await end();result.seatedPairContact=s.pairContact;
 await r.getByRole('button',{name:'全景',exact:true}).click();await f.evaluate(()=>PostOfficeGame.pause(false));result.visitReturnsHome=true;result.originalTextUnchanged=true;
};
