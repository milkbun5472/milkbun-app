import test from 'node:test';import assert from 'node:assert/strict';
import {travelEnvironment,calendarDay,advanceTrip,restoreTrip,startTrip,SEASON_DAYS} from './travel.mjs';
const base={version:1,map:'carriage',day:1,startDay:1,minute:600,epoch:'t',distance:0,routeStart:0};
test('列车一天现实 4 分钟',()=>{let s={...base,minute:0};for(let i=0;i<2405;i++)s=advanceTrip(s,.1);assert.equal(s.day,2);assert.ok(s.minute<5);});
test('四天一季，四季轮完回到春天',()=>{assert.equal(SEASON_DAYS,4);const seasons=[1,4,5,9,13,17].map(day=>travelEnvironment({...base,day}).season);assert.deepEqual(seasons,['spring','spring','summer','autumn','winter','spring']);});
test('从上车那天的季节接着数；旧存档补上 startDay',()=>{const t=startTrip({day:20,minute:0,epoch:'e'},()=>0);assert.equal(t.startDay,20);assert.equal(travelEnvironment(t).season,'summer');assert.equal(travelEnvironment({...t,day:23}).season,'summer');assert.equal(travelEnvironment({...t,day:24}).season,'autumn');const old=restoreTrip({...base,day:9,startDay:undefined});assert.equal(old.startDay,9);assert.equal(calendarDay(old),9);});
