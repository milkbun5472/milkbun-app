import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,seasonOf,weather} from '../fairy-garden/world.mjs';
import {startTrip,restoreTrip,travelEnvironment,advanceTrip,travelContext,WEATHER_CODES} from './travel.mjs';
test('boarding carries the actual garden clock and climate, without changing its inventory',()=>{
 for(const day of [1,14,15,28,29,42,43,56]){const garden={...freshState(),day,minute:1137,herbs:17,epoch:'real-writer'};const s=startTrip(garden,()=>.7);const env=travelEnvironment(s);assert.equal(s.day,garden.day);assert.equal(s.minute,garden.minute);assert.equal(s.epoch,garden.epoch);assert.equal(env.weather,WEATHER_CODES[weather(day,garden.epoch)]);assert.equal(env.season,['spring','summer','autumn','winter'][seasonOf(day).index%4]);assert.equal(garden.herbs,17);assert.equal(s.herbs,undefined);assert.deepEqual(restoreTrip(JSON.parse(JSON.stringify(s))),s);}
});
test('direct entries vary initial time and both entry paths can start on all three routes',()=>{
 const times=new Set();for(const n of [.01,.4,.8]){const s=startTrip(null,()=>n);times.add(s.minute);assert.equal(s.routeStart,Math.floor(n*3));assert.equal(startTrip(freshState(),()=>n).routeStart,s.routeStart);}assert.equal(times.size,3);
});
test('time advances through midnight, all seasons and year wrap, independently of scenic slowing',()=>{
 for(const day of [14,28,42,56]){const s={...startTrip(freshState()),day,startDay:day,minute:1439.9};const next=advanceTrip(s,.1,.36);assert.equal(next.day,day+1);assert.ok(next.minute<.61);assert.ok(Math.abs(next.distance-.036)<1e-10);assert.notEqual(travelEnvironment(next).season,travelEnvironment(s).season);assert.equal(advanceTrip(s,0),s);}
});
test('each route signals the next for forty distance units and swaps without losing mileage',()=>{
 const s=startTrip(null,()=>0);for(let i=0;i<3;i++){const before=travelEnvironment({...s,distance:i*160+120});const middle=travelEnvironment({...s,distance:i*160+140});const edge=travelEnvironment({...s,distance:i*160+159.999});const next=travelEnvironment({...s,distance:(i+1)*160});assert.equal(before.routeBlend,0);assert.equal(middle.routeBlend,.5);assert.ok(edge.routeBlend>.999);assert.equal(edge.nextRoute,next.route);assert.equal(next.routeBlend,0);}
});

test('chat describes actual landmarks, tunnel occlusion and slowing without repeating landmarks during blends',()=>{
 const s={...startTrip(null,()=>0),day:43,startDay:43,minute:1234.9};
 let c=travelContext({...s,distance:80});assert.equal(c.time,'20:34');assert.equal(c.timeOfDay,'夜晚');assert.equal(c.season,'冬天');assert.equal(c.passing,'穿过山洞');assert.equal(c.tunnel.darkness,1);
 c=travelContext({...s,distance:98});assert.equal(c.sightseeing.place,'山中湖泊');assert.ok(c.sightseeing.speedFactor<.4);
 c=travelContext({...s,distance:140});assert.equal(c.passing,'沿途');assert.equal(c.tunnel,null);assert.equal(c.sightseeing,null);assert.deepEqual([c.transition.from,c.transition.to,c.transition.progress],['林间山谷','田野村落',.5]);
 c=travelContext({...s,routeStart:2,distance:27});assert.equal(c.passing,'海边小镇');assert.equal(c.sightseeing.place,'海边小镇');
 assert.equal(travelContext({...s,routeStart:1,distance:24}).passing,'风车与麦田');
});
test('chat weather and seasons follow the same clock as boarding and contain no saved image payloads',()=>{
 for(const day of [1,15,29,43,57]){const s=startTrip({day,minute:361,epoch:'test'},()=>0),c=travelContext({...s,photos:[{src:'PRIVATE_IMAGE'}]});assert.equal(c.time,'06:01');assert.equal(c.weather,{'晴日':'晴天','细雨':'下雨','细雪':'飘雪','薄雾':'薄雾'}[weather(day,s.epoch)]);assert.equal(c.season,['春天','夏天','秋天','冬天'][seasonOf(day).index%4]);assert.ok(!JSON.stringify(c).includes('PRIVATE_IMAGE'));}
});
