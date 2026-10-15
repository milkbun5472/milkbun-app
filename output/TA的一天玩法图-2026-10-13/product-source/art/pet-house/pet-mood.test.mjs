import test from 'node:test';
import assert from 'node:assert/strict';
import {moodFromCare,normalizePetMood,samplePetMood,PET_MOODS} from './pet-mood.mjs';
import {createPetCare} from '../../apps/pets/care.mjs';
test('body language follows actual accepted care and foreground energy, without changing saved care',()=>{
 const c=createPetCare();const before=JSON.stringify(c.state);
 assert.equal(moodFromCare(c.state).id,'relaxed');assert.equal(JSON.stringify(c.state),before);
 assert.equal(c.request('play',{toy:'mouse'}).accepted,true);c.arrive();assert.equal(moodFromCare(c.state).id,'happy');
 c.cancel();assert.equal(c.request('rest').accepted,true);c.arrive();assert.equal(moodFromCare(c.state,true).id,'sleepy');
 assert.equal(moodFromCare({energy:20,mood:100}).id,'sleepy');assert.equal(moodFromCare({energy:80,mood:20}).id,'gloomy');
 assert.equal(moodFromCare({task:{kind:'watch',phase:'doing'}}).id,'curious');assert.equal(moodFromCare({energy:80},true).id,'guarded');
});
test('unknown and corrupt preview moods are bounded, every channel stays finite',()=>{
 assert.deepEqual(normalizePetMood({id:'bad',intensity:Infinity}),{id:'neutral',intensity:1});
 for(const species of ['cat','dog'])for(const m of PET_MOODS)for(const intensity of [-5,0,.5,1,10])for(const time of [0,1,100,NaN]){
  assert.ok(Object.values(samplePetMood(species,{id:m.id,intensity},time)).every(Number.isFinite));
  if(intensity<=0)assert.deepEqual(samplePetMood(species,{id:m.id,intensity},time),samplePetMood(species,'neutral',time));
 }
});
