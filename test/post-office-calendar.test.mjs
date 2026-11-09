import test from 'node:test';import assert from 'node:assert/strict';
import {calendarEnvironment,townEnvironment,CALENDAR_WEATHER} from '../apps/pets/environment.mjs';
import {realTime} from '../apps/fairy-garden/real-clock.mjs';
import {calendarSeason,gameBirthday} from '../apps/fairy-garden/world.mjs';
import {environmentAt} from '../apps/fairy-garden/day/environment.mjs';
const time=(month,day=8,hour=8,minute=0)=>realTime(null,new Date(2026,month-1,day,hour,minute).getTime());
test('all twelve actual local months choose one calendar season, independent of the town cycle or save age',()=>{
 const expected=[3,3,0,0,0,1,1,1,2,2,2,3];
 for(let month=1;month<=12;month++){
  const t=time(month),before=structuredClone(t),env=calendarEnvironment(t,1234);
  assert.equal(env.season,expected[month-1]);assert.equal(calendarSeason(month),env.season);
  assert.equal(Math.floor((gameBirthday(month,8)-1)/14),env.season);
  assert.equal(env.date,t.date);assert.equal(env.time,'08:00');assert.deepEqual(t,before);
  assert.deepEqual(calendarEnvironment({...t,season:(env.season+1)%4,day:999},1234),env);
 }
 for(const bad of [0,13,1.5,NaN])assert.equal(calendarSeason(bad),null);
});
test('three-hour weather rolls are stable on reload, vary across slots and days, and use the seasonal probabilities',()=>{
 for(const [season,month]of [4,7,10,1].entries()){
  const counts={};
  for(let seed=1;seed<=4000;seed++){
   const a=calendarEnvironment(time(month,8,7,1),seed),b=calendarEnvironment(time(month,8,8,59),seed);
   assert.equal(a.kind,b.kind);assert.equal(a.weatherSlot,b.weatherSlot);
   counts[a.kind]=(counts[a.kind]||0)+1;
  }
  assert.equal(Object.values(CALENDAR_WEATHER[season]).reduce((a,b)=>a+b),100);
  for(const [kind,chance]of Object.entries(CALENDAR_WEATHER[season]))assert.ok(Math.abs(counts[kind]/40-chance)<3,kind+' probability');
  assert.equal(counts['细雪']>0,season===3);
 }
 const slots=new Set(),days=new Set();for(let i=0;i<28;i++)for(let hour=0;hour<24;hour+=3){const e=calendarEnvironment(time(1,i+1,hour),1234);slots.add(e.weatherSlot);days.add(e.kind);}
 assert.equal(slots.size,28*8);assert.deepEqual([...days].sort(),Object.keys(CALENDAR_WEATHER[3]).sort());
 assert.notEqual(calendarEnvironment(time(12,31,23,59),1).weatherSlot,calendarEnvironment(time(1,1,0),1).weatherSlot);
});
test('winter dawn and seasonal dusk drive the same rendered light, preserving the original town cycle',()=>{
 const winter=calendarEnvironment(time(1,8,7,30),1234),summer=calendarEnvironment(time(7,8,7,30),1234);
 assert.ok(winter.light<summer.light);assert.equal(winter.phase,'清晨');
 assert.equal(calendarEnvironment(time(1,8,19),1).night,true);
 assert.equal(calendarEnvironment(time(7,8,19),1).night,false);
 for(const month of [1,4,7,10])for(const hour of [1,6,8,12,17,20]){
  const env=calendarEnvironment(time(month,8,hour),1),render=environmentAt(env.minute,{source:'world',code:0,lighting:env});
  assert.equal(render.daylight,env.light);assert.equal(render.warmth,env.warmth);assert.equal(render.phase,env.phase);
 }
 // Explicitly supplied calendar lighting does not affect normal character weather.
 assert.deepEqual(environmentAt(720,{source:'real',code:0,lighting:winter}),environmentAt(720,{source:'real',code:0}));
 const ordinary=realTime(null,new Date(2026,9,5,12).getTime());assert.equal(townEnvironment(ordinary,1).season,ordinary.season);
});
