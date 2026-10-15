import test from 'node:test';
import assert from 'node:assert/strict';
import {destinationState as state} from './destinations.mjs';
test('only authored route destinations slow travel, smoothly recovering at both ends',()=>{
 for(const [route,id] of [['forest','lake'],['coast','village']]){
  for(const progress of [0,1]){assert.equal(state(route,{id,progress}).reveal,0);assert.equal(state(route,{id,progress}).speedFactor,1);}
  assert.equal(state(route,{id,progress:.5}).speedFactor,.36);
  assert.ok(state(route,{id,progress:.001}).speedFactor>.999);
  assert.ok(state(route,{id,progress:.999}).speedFactor>.999);
 }
 for(const [route,id] of [['country','lake'],['coast','lake'],['forest','village'],['forest','open']])assert.equal(state(route,{id,progress:.5}).speedFactor,1);
});
