import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,seasonOf,weather} from '../fairy-garden/world.mjs';
import {startTrip,restoreTrip,travelEnvironment,advanceTrip,WEATHER_CODES} from './travel.mjs';
test('boarding carries the actual garden clock and climate, without changing its inventory',()=>{
 for(const day of [1,14,15,28,29,42,43,56]){const garden={...freshState(),day,minute:1137,herbs:17,epoch:'real-writer'};const s=startTrip(garden,()=>.7);const env=travelEnvironment(s);assert.equal(s.day,garden.day);assert.equal(s.minute,garden.minute);assert.equal(s.epoch,garden.epoch);assert.equal(env.weather,WEATHER_CODES[weather(day,garden.epoch)]);assert.equal(env.season,['spring','summer','autumn','winter'][seasonOf(day).index%4]);assert.equal(garden.herbs,17);assert.equal(s.herbs,undefined);assert.deepEqual(restoreTrip(JSON.parse(JSON.stringify(s))),s);}
});
test('direct entries vary initial time and both entry paths can start on all three routes',()=>{
 const times=new Set();for(const n of [.01,.4,.8]){const s=startTrip(null,()=>n);times.add(s.minute);assert.equal(s.routeStart,Math.floor(n*3));assert.equal(startTrip(freshState(),()=>n).routeStart,s.routeStart);}assert.equal(times.size,3);
});
test('time advances through midnight, all seasons and year wrap, independently of scenic slowing',()=>{
 for(const day of [14,28,42,56]){const s={...startTrip(freshState()),day,minute:1439.9};const next=advanceTrip(s,.1,.36);assert.equal(next.day,day+1);assert.ok(next.minute<.11);assert.ok(Math.abs(next.distance-.036)<1e-10);assert.notEqual(travelEnvironment(next).season,travelEnvironment(s).season);assert.equal(advanceTrip(s,0),s);}
});
test('each route signals the next for forty distance units and swaps without losing mileage',()=>{
 const s=startTrip(null,()=>0);for(let i=0;i<3;i++){const before=travelEnvironment({...s,distance:i*160+120});const middle=travelEnvironment({...s,distance:i*160+140});const edge=travelEnvironment({...s,distance:i*160+159.999});const next=travelEnvironment({...s,distance:(i+1)*160});assert.equal(before.routeBlend,0);assert.equal(middle.routeBlend,.5);assert.ok(edge.routeBlend>.999);assert.equal(edge.nextRoute,next.route);assert.equal(next.routeBlend,0);}
});
