import test from 'node:test';import assert from 'node:assert/strict';
import {travelEnvironment,calendarDay,ROUTE_LENGTH,SEASON_ROUTES} from './travel.mjs';
const base={version:1,map:'carriage',day:1,minute:600,epoch:'t',distance:0,routeStart:0};
test('列车上一年约一小时：每六段路换一季，四季轮完回到春天',()=>{const step=ROUTE_LENGTH*SEASON_ROUTES;assert.ok(step*4<=3900&&step*4>=3000,'一年约一小时（距离≈秒）');
 const seasons=[0,1,2,3,4].map(i=>travelEnvironment({...base,distance:i*step+1}).season);assert.deepEqual(seasons,['spring','summer','autumn','winter','spring']);
 assert.equal(travelEnvironment({...base,distance:step-1}).season,'spring');});
test('日子本身不跳，换季只落在换路段处',()=>{assert.equal(calendarDay({...base,distance:ROUTE_LENGTH*SEASON_ROUTES}),15);assert.equal(base.day,1);assert.equal((ROUTE_LENGTH*SEASON_ROUTES)%ROUTE_LENGTH,0);});
