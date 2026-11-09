const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
module.exports=async({p,r,f,refresh,out,result})=>{
 const {pan}=await require('./_post-office-camera.cjs')({p,r,f}),snapshot=()=>f.evaluate(()=>PostOfficeGame.snapshot());
 const step=async(n=80)=>f.evaluate(n=>{PostOfficeGame.pause(false);for(let i=0;i<n;i++)PostOfficeGame.step(.025);PostOfficeGame.draw();PostOfficeGame.pause(true);return PostOfficeGame.snapshot();},n);
 await p.evaluate(()=>{const sh={...shopFixture,phase:'plan',badge:{柜台:'card1',分拣:'card2',送信:'card3',看店:'card4'}};saveJSON('x_stampShop',sh);const cards=loadJSON('x_stamps',{});cards.cards.forEach(c=>c.face='shop-test-image');saveJSON('x_stamps',cards);});await refresh();await step();
 async function look(outfit,dims={}){await p.evaluate(({outfit,dims})=>{const c=loadJSON('x_companion',{});c.looks.d={...c.looks.d,outfit,dims};saveJSON('x_companion',c);},{outfit,dims});await f.evaluate(()=>PostOfficeGame.pause(false));await refresh();await p.waitForFunction(outfit=>{const a=document.querySelector('#post-office-test iframe').contentWindow.PostOfficeGame.snapshot().people.find(a=>a.id==='d');return a?.costume===outfit&&a.badgeView?.attachment?.fitted&&a.badgeView.attachment.surfaces.some(n=>n.startsWith('outfit_'+outfit))&&a.badgeView.attachment.surfaces.every(n=>n==='DollBody'||n.startsWith('outfit_'+outfit));},outfit).catch(async e=>{fs.writeFileSync(path.join(out,'fit-stuck.json'),JSON.stringify(await snapshot(),null,2));await p.screenshot({path:path.join(out,'fit-stuck.png')});throw e;});return step();}
 function check(s,id,expected){const a=s.people.find(a=>a.id===id);assert.equal(a.posture,'sit');assert.equal(a.seatContact.surface,expected);assert.ok(Math.abs(a.seatContact.bottom-expected)<1e-5);assert.equal(a.seat.pose,id==='d'?'deep':'chair');if(a.badge){assert.ok(a.badgeView.attachment.fitted);assert.ok(a.badgeView.attachment.surfaces.every(n=>!n.startsWith('StaffBadge')));}return a;}
 async function frame(id,width,height,side=false){await p.setViewportSize({width,height});await r.getByRole('button',{name:'全景',exact:true}).click();const box=await r.locator('iframe').boundingBox();{await p.mouse.move(box.width*.65,box.y+box.height*.4);await p.mouse.down();await p.mouse.move(box.width*.65-(side?95:50),box.y+box.height*.4,{steps:10});await p.mouse.up();}
  for(let i=0;i<18;i++){const a=(await snapshot()).people.find(a=>a.id===id),q=await f.evaluate(({x,z})=>PostOfficeGame.project(x,.7,z),a),dx=box.width/2-q.x,dy=box.height/2-q.y;if(Math.hypot(dx,dy)<2)break;await pan(Math.max(-55,Math.min(55,dx)),Math.max(-55,Math.min(55,dy)));}
  await p.mouse.move(box.width/2,box.y+box.height/2);for(let i=0;i<6;i++)await p.mouse.wheel(0,-180);
 }
 result.chairFit=[];
 for(const outfit of ['academy','ranger','tee','suit','cardigan','jacket','garden']){
  // IDs are resolved by the existing wardrobe; no new outfit asset is added.
  const actual=await f.evaluate(async id=>{const q=new URL(document.querySelector('script[type=module]').src).search,{outfitId}=await import('../fairy-garden/wardrobe.mjs'+q);return outfitId({outfit:id});},outfit);
  for(const size of [.82,1.18]){const s=await look(actual,{height:size,build:size,legs:size,head:1}),a=check(s,'d',.53);result.chairFit.push({outfit:actual,size,contact:a.seatContact,attachment:a.badgeView.attachment});}
  await frame('d',390,844,true);await p.screenshot({path:path.join(out,'outfit-'+actual+'.png')});
 }
 await look('academy');
 for(const [width,height]of [[320,568],[390,844],[430,932]])for(const side of [false,true]){await frame('d',width,height,side);await p.screenshot({path:path.join(out,'chair-badge-'+width+(side?'-side':'-front')+'.png')});assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await p.clock.setFixedTime(new Date('2026-11-08T18:00:00-06:00'));
 result.benchFit=[];
 for(const level of [1,2,3]){await p.evaluate(level=>{const sh={...shopFixture,phase:'open',roster:{柜台:'a',看店:'d'},decorLv:{'靠窗的长凳':level},customers:[{id:'fit-visitor',visitor:true,charId:'c',fee:12}]};saveJSON('x_stampShop',sh);},level);await refresh();const s=await step(1800),a=check(s,'fit-visitor',level===1?.53:.625);result.benchFit.push({level,contact:a.seatContact});await frame('fit-visitor',390,844,true);await p.screenshot({path:path.join(out,'bench-level-'+level+'.png')});}
 // Standing, arm movement and a live wardrobe change share the same surface mount.
 for(const a of (await snapshot()).people.filter(a=>a.badge))assert.ok(a.badgeView.attachment.fitted);
 await r.getByRole('button',{name:'全景',exact:true}).click();await f.evaluate(()=>PostOfficeGame.pause(false));result.sharedSeatFit=true;result.bodyMountedBadges=true;
};
