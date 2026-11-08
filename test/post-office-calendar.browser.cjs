const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({p,r,f,out,result})=>{
 const snapshot=()=>f.evaluate(()=>PostOfficeGame.snapshot());
 const advance=()=>f.evaluate(()=>{for(let i=0;i<800;i++)PostOfficeGame.step(.05);PostOfficeGame.draw();});
 const samples=await f.evaluate(async()=>{const q=new URL(document.querySelector('script[type=module]').src).search,{realTime}=await import('../fairy-garden/real-clock.mjs'+q),{calendarEnvironment}=await import('../pets/environment.mjs'+q);return ['细雪','大风','阴天'].map(kind=>{for(let day=1;day<=31;day++){const at=new Date(2026,0,day,7,30).getTime();if(calendarEnvironment(realTime(null,at),1234).kind===kind)return {kind,at};}throw Error('missing winter fixture '+kind);});});
 result.realCalendar=[];
 for(const sample of samples){
  await p.clock.setFixedTime(new Date(sample.at));
  await p.evaluate(()=>{const d=new Date(),s=loadJSON('x_stampShop',null);saveJSON('x_stampShop',{...s,date:d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(),phase:'plan',period:'',customers:[],roster:{柜台:'a',分拣:'b',送信:'c',看店:'d'}});});
  await f.evaluate(()=>PostOfficeGame.refresh());await advance();let s=await snapshot();
  assert.equal(s.projection.environment.season,3);assert.equal(s.projection.environment.time,'07:30');assert.equal(s.projection.environment.phase,'清晨');assert.equal(s.projection.environment.kind,sample.kind);assert.equal(s.people.length,4);
  assert.ok(s.weather.daylight>0&&s.weather.daylight<1);assert.ok(s.lighting.lamp>0,'winter morning keeps the purchased lamps lit');assert.equal(s.weather.indoorParticles,0);
  if(sample.kind==='细雪'){
   assert.ok(s.weather.outsideSnow);for(const [width,height]of [[320,568],[390,844],[430,932]]){await p.setViewportSize({width,height});await r.getByRole('button',{name:'全景',exact:true}).click();await p.screenshot({path:path.join(out,'calendar-winter-snow-'+width+'.png')});const box=await f.locator('.shop-weather').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width);assert.equal(await f.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  }
  if(sample.kind==='大风'){
   assert.equal(s.exterior.windStreaks,16);assert.ok(s.exterior.wind>3);
   const before=s.exterior.treeSway;await f.evaluate(()=>{PostOfficeGame.step(.37);PostOfficeGame.draw();});s=await snapshot();assert.notDeepEqual(s.exterior.treeSway,before);
  }
  if(sample.kind==='阴天')assert.equal(s.weather.kind,'overcast');
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(out,'calendar-winter-'+sample.kind+'.png')});
  const saved=await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),env=s.projection.environment;
  await f.evaluate(()=>PostOfficeGame.refresh());assert.equal(await p.evaluate(()=>JSON.stringify(loadJSON('x_stampShop',null))),saved);
  await r.getByRole('button',{name:'去柜台',exact:true}).click();await r.locator('[data-wk=duelshop]').waitFor();await r.locator('[data-wk=head] button').first().click();await p.waitForFunction(()=>document.querySelector('#post-office-test iframe')?.contentWindow.PostOfficeGame?.ready);f=p.frames().find(frame=>frame.url().includes('/apps/post-office/'));await advance();
  assert.deepEqual((await snapshot()).projection.environment,env,'re-entering the scene keeps the same weather roll');
  await p.clock.setFixedTime(new Date(sample.at+50*60*1000));await f.evaluate(()=>PostOfficeGame.refresh());const later=(await snapshot()).projection.environment;assert.equal(later.kind,env.kind);assert.equal(later.weatherSlot,env.weatherSlot);assert.equal(later.time,'08:20');
  await p.clock.setFixedTime(new Date(sample.at+90*60*1000));await f.evaluate(()=>PostOfficeGame.refresh());assert.notEqual((await snapshot()).projection.environment.weatherSlot,env.weatherSlot);
  result.realCalendar.push({kind:sample.kind,season:3,time:'07:30',reloadStable:true,threeHourSlot:true});
 }
 await p.clock.setFixedTime(new Date('2026-01-31T00:30:00-06:00'));await f.evaluate(()=>PostOfficeGame.refresh());await advance();const night=await snapshot();assert.equal(night.weather.daylight,0);assert.equal(night.people.length,0);assert.equal(night.closedSign,true);await p.screenshot({path:path.join(out,'calendar-winter-midnight.png')});result.realCalendarNight=true;
};
