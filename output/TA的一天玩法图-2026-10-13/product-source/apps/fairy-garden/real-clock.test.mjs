import test from 'node:test';import assert from 'node:assert/strict';
import {restoreClock,realTime,clockArchive,workWindow,dailyRoutine} from './real-clock.mjs';
import {freshState,restoreState,nextDay,advanceTime} from './world.mjs';
const at=(day,h=10,m=0)=>new Date(2026,9,day,h,m).getTime();
test('one archive anchors once, keeps legacy progress and uses actual date, minute and weekday',()=>{const garden={...freshState(),day:8},pets={day:43},d=clockArchive({version:1,id:'writer',world:garden,worlds:{garden,pets}},at(4)),later=clockArchive(d,at(5));assert.equal(d.clock.startDay,43);assert.equal(later.clock.anchor,d.clock.anchor);const t=realTime(later.clock,at(5,14,37));assert.equal(t.day,44);assert.equal(t.minute,877);assert.equal(t.date,'2026-10-05');assert.equal(t.week,'周一');assert.equal(t.weekend,false);assert.equal(realTime(d.clock,at(4)).weekend,true);assert.equal(garden.day,8);});
test('all archive ages share the fixed fourteen-day cycle without changing progress guards',()=>{
 const clocks=[restoreClock(null,1,at(4)),restoreClock(null,500,at(1)),{version:1,anchor:999,startDay:77,day:12345}];
 for(const [offset,season,seasonDay] of [[0,0,1],[13,0,14],[14,1,1],[27,1,14],[28,2,1],[41,2,14],[42,3,1],[55,3,14],[56,0,1],[57,0,2]]){
  const now=at(4+offset,12),times=clocks.map(c=>realTime(c,now));
  for(const t of times){assert.equal(t.season,season);assert.equal(t.seasonDay,seasonDay);assert.equal(t.seasonLength,14);assert.equal(t.calendarDay,times[0].calendarDay);assert.equal(t.date,times[0].date);assert.equal(t.seasonStart,times[0].seasonStart);}
 }
 const high={...clocks[0],day:15};assert.equal(realTime(high,at(4)).day,15);assert.equal(realTime(high,at(4)).seasonDay,1);
 assert.equal(realTime(clocks[0],at(4,23,59)).day,1);assert.equal(realTime(clocks[0],at(5,0,0)).calendarDay,realTime(clocks[0],at(4,23,59)).calendarDay+1);
});
test('cycles continue across midnight, before the shared epoch, calendar years and leap day',()=>{
 const read=(y,m,d,h=0,min=0)=>realTime(null,new Date(y,m-1,d,h,min).getTime());
 for(const day of [18,32,46,60]){const midnight=at(day,0,0),before=realTime(null,midnight-1),after=realTime(null,midnight);assert.equal(before.seasonDay,14);assert.equal(after.seasonDay,1);assert.equal(after.season,(before.season+1)%4);assert.equal(after.seasonStart,after.date);}
 assert.equal(read(2026,10,3).season,3);assert.equal(read(2026,10,3).seasonDay,14);assert.equal(read(2026,10,4).seasonEpoch,'2026-10-04');
 assert.equal(read(2027,1,1).season,2);assert.equal(read(2027,1,1).seasonDay,6);
 const leap=read(2028,2,29),march=read(2028,3,1);assert.equal(leap.season,0);assert.equal(leap.seasonDay,10);assert.equal(march.seasonDay,11);assert.equal(march.calendarDay-leap.calendarDay,1);
 // A new archive created during summer enters that same summer day immediately.
 const today=at(20,12),old=clockArchive({worlds:{pets:{day:987}}},at(4)),fresh=clockArchive({worlds:{pets:{day:1}}},today);
 assert.equal(realTime(old.clock,today).season,1);assert.equal(realTime(fresh.clock,today).season,1);assert.equal(realTime(fresh.clock,today).seasonDay,3);
});
test('calendar counts local dates across DST, rather than elapsed 24-hour blocks',()=>{const old=process.env.TZ;process.env.TZ='America/Winnipeg';try{const start=new Date(2026,2,7,12).getTime(),end=new Date(2026,2,9,12).getTime();assert.equal(end-start,47*3600000);assert.equal(realTime(restoreClock(null,1,start),end).day,3);assert.equal(realTime(null,end).calendarDay-realTime(null,start).calendarDay,2);const a=realTime(null,start),b=realTime(null,end);assert.equal(b.seasonCycle*14+b.seasonDay-(a.seasonCycle*14+a.seasonDay),2);const fallStart=new Date(2026,9,31,12).getTime(),fallEnd=new Date(2026,10,2,12).getTime();assert.equal(fallEnd-fallStart,49*3600000);assert.equal(realTime(null,fallEnd).calendarDay-realTime(null,fallStart).calendarDay,2);}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}});
test('workday windows, explicit weekend permission and distinct resident routines share the same clock',()=>{const c=restoreClock(null,1,at(4));assert.equal(workWindow(realTime(c,at(4))).open,false);assert.equal(workWindow(realTime(c,at(4)),{weekend:true}).open,true);assert.equal(workWindow(realTime(c,at(5,13))).open,false);assert.equal(workWindow(realTime(c,at(5,15)),{shift:'morning'}).open,false);assert.equal(workWindow(realTime(c,at(5,15)),{shift:'afternoon'}).open,true);assert.equal(dailyRoutine(realTime(c,at(5,2))).id,'sleep');assert.equal(dailyRoutine(realTime(c,at(5,18,5)),20).id,'free');assert.equal(dailyRoutine(realTime(c,at(5,18,25)),20).id,'dinner');});
test('only town receives the archive clock; existing garden and train dates survive migration',t=>{
 t.mock.method(Date,'now',()=>at(4));
 const garden={...freshState(),day:43,minute:800,herbs:17},train={day:365,minute:90},pets={day:7};
 const a=clockArchive({world:garden,worlds:{garden,train,pets}},at(4));assert.equal(a.clock.startDay,7);
 for(const id of ['garden','train']){const saved={...a,worlds:{...a.worlds,[id]:{...a.worlds[id],clock:a.clock}}};const w=globalThis.GameClock.world(saved,id);assert.equal(w.clock,undefined);assert.equal(w.day,a.worlds[id].day);assert.equal(w.minute,a.worlds[id].minute);}
 assert.deepEqual(globalThis.GameClock.world(a,'pets').clock,a.clock);assert.equal(garden.herbs,17);
});
test('town midnight leaves garden untouched; garden wait and sleep still advance its game time',()=>{
 const garden={...freshState(),day:43,minute:800,herbs:17},a=clockArchive({world:garden,worlds:{garden,pets:{day:7}}},at(4,23,58));
 const later=clockArchive(a,at(5,0,3));assert.equal(later.clock.day,8);assert.equal(later.worlds.garden.day,43);assert.equal(later.worlds.garden.minute,800);
 const saved=restoreState({...garden,clock:a.clock});assert.equal(saved.clock,undefined);assert.equal(advanceTime(saved,10).minute,810);assert.equal(nextDay(saved).day,44);assert.equal(nextDay(saved).herbs,17);
});
