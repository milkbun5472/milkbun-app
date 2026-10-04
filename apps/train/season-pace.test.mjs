import test from 'node:test';import assert from 'node:assert/strict';
import {travelEnvironment,calendarDay,advanceTrip,restoreTrip,startTrip,SEASON_DAYS} from './travel.mjs';
import {restoreClock} from '../fairy-garden/real-clock.mjs';
const base={version:1,map:'carriage',day:1,startDay:1,minute:600,epoch:'t',distance:0,routeStart:0};
test('train motion never fast-forwards a real date',()=>{const at=new Date(2026,9,5,10,0).getTime(),old=Date.now;Date.now=()=>at;try{let s={...base,clock:restoreClock(null,1,at)};for(let i=0;i<2405;i++)s=advanceTrip(s,.1);assert.equal(s.day,1);assert.equal(s.minute,600);assert.ok(s.distance>240);}finally{Date.now=old;}});
test('all worlds use fourteen days per season and wrap through all four seasons',()=>{assert.equal(SEASON_DAYS,14);const seasons=[1,14,15,29,43,57].map(day=>travelEnvironment({...base,day}).season);assert.deepEqual(seasons,['spring','spring','summer','autumn','winter','spring']);});
test('legacy trips retain their calendar and new boarding inherits the shared clock',()=>{const t=startTrip({day:20,minute:0,epoch:'e'},()=>0);assert.equal(t.startDay,20);assert.equal(travelEnvironment({...t,day:28}).season,'summer');assert.equal(travelEnvironment({...t,day:29}).season,'autumn');const old=restoreTrip({...base,day:9,startDay:undefined});assert.equal(old.startDay,9);assert.equal(calendarDay(old),9);});
