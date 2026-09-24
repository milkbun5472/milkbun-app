import test from 'node:test';
import assert from 'node:assert/strict';
import {JOURNEYS,JOURNEY_LENGTH,journeyAt,nextJourneyDistance} from './journey.mjs';
test('every route has ordered, non-overlapping encounters and a clean repeat boundary',()=>{
 for(const [route,entries] of Object.entries(JOURNEYS)){
  let end=0;
  for(const [id,,start,duration] of entries){assert.ok(start>=end);assert.ok(duration>0);end=start+duration;assert.ok(end<=JOURNEY_LENGTH);const e=journeyAt(route,start+duration/2);assert.equal(e.id,id);assert.equal(e.progress,.5);assert.equal(journeyAt(route,JOURNEY_LENGTH+start+duration/2).id,id);}
  assert.equal(journeyAt(route,0).id,'open');assert.equal(journeyAt(route,JOURNEY_LENGTH).id,'open');
 }
});
test('next segment is visibly underway even while playback is paused',()=>{
 for(const [route,entries] of Object.entries(JOURNEYS)){
  let distance=0;
  for(const [id] of [...entries,entries[0]]){const next=nextJourneyDistance(route,distance);assert.ok(next>distance);assert.equal(journeyAt(route,next).id,id);assert.ok(Math.abs(journeyAt(route,next).progress-.35)<1e-10);distance=next;}
 }
});
test('tunnel darkens and recovers gradually, including at its exact exit',()=>{
 for(const route of ['forest','coast']){
  const [,,start,duration]=JOURNEYS[route].find(e=>e[0]==='tunnel');
  assert.equal(journeyAt(route,start).tunnel,0);assert.ok(journeyAt(route,start+.1).tunnel>0);assert.equal(journeyAt(route,start+duration*.5).tunnel,1);assert.ok(journeyAt(route,start+duration-.1).tunnel<.1);assert.equal(journeyAt(route,start+duration).tunnel,0);
 }
});
