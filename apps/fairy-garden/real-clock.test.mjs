import test from 'node:test';import assert from 'node:assert/strict';
import {restoreClock,realTime,clockArchive,workWindow,dailyRoutine} from './real-clock.mjs';
import {freshState,restoreState,nextDay,advanceTime} from './world.mjs';
const at=(day,h=10,m=0)=>new Date(2026,9,day,h,m).getTime();
test('one archive anchors once, keeps legacy progress and uses actual date, minute and weekday',()=>{const garden={...freshState(),day:8},pets={day:43},d=clockArchive({version:1,id:'writer',world:garden,worlds:{garden,pets}},at(4)),later=clockArchive(d,at(5));assert.equal(d.clock.startDay,43);assert.equal(later.clock.anchor,d.clock.anchor);const t=realTime(later.clock,at(5,14,37));assert.equal(t.day,44);assert.equal(t.minute,877);assert.equal(t.date,'2026-10-05');assert.equal(t.week,'周一');assert.equal(t.weekend,false);assert.equal(realTime(d.clock,at(4)).weekend,true);assert.equal(garden.day,8);});
test('fourteen actual dates change season; elapsed animation and backwards date cannot repeat a day',()=>{const clock=restoreClock(null,1,at(4));assert.equal(realTime(clock,at(17)).season,0);assert.equal(realTime(clock,at(18)).season,1);const high={...clock,day:15};assert.equal(realTime(high,at(4)).day,15);assert.equal(realTime(clock,at(4,23,59)).day,1);assert.equal(realTime(clock,at(5,0,0)).minute,0);});
test('calendar counts local dates across DST, rather than elapsed 24-hour blocks',()=>{const old=process.env.TZ;process.env.TZ='America/Winnipeg';try{const start=new Date(2026,2,7,12).getTime(),end=new Date(2026,2,9,12).getTime();assert.equal(end-start,47*3600000);assert.equal(realTime(restoreClock(null,1,start),end).day,3);}finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}});
test('workday windows, explicit weekend permission and distinct resident routines share the same clock',()=>{const c=restoreClock(null,1,at(4));assert.equal(workWindow(realTime(c,at(4))).open,false);assert.equal(workWindow(realTime(c,at(4)),{weekend:true}).open,true);assert.equal(workWindow(realTime(c,at(5,13))).open,false);assert.equal(workWindow(realTime(c,at(5,15)),{shift:'morning'}).open,false);assert.equal(workWindow(realTime(c,at(5,15)),{shift:'afternoon'}).open,true);assert.equal(dailyRoutine(realTime(c,at(5,2))).id,'sleep');assert.equal(dailyRoutine(realTime(c,at(5,18,5)),20).id,'free');assert.equal(dailyRoutine(realTime(c,at(5,18,25)),20).id,'dinner');});
test('only town receives the archive clock; existing garden and train dates survive migration',()=>{
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
