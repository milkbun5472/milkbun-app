import test from 'node:test';
import assert from 'node:assert/strict';
import {precipitationRoofed,environmentAt} from '../apps/fairy-garden/day/environment.mjs';
const roofs=[{min:[-4.65,0,-3.55],max:[4.65,4,3.55]}];
test('the final snow position is roof-masked after wind moves it indoors',()=>{
 assert.equal(precipitationRoofed(roofs,{x:4.7,z:0}),false);
 assert.equal(precipitationRoofed(roofs,{x:4.7-.07,z:0}),true);
 assert.equal(precipitationRoofed(roofs,{x:0,z:-4}),false);
 assert.equal(precipitationRoofed([],{x:0,z:0}),false);
});
test('a slanted rain streak is hidden when its end or middle crosses the roof',()=>{
 assert.equal(precipitationRoofed(roofs,{x:4.7,z:0},{x:4.64,z:-.015}),true);
 assert.equal(precipitationRoofed(roofs,{x:4.8,z:0},{x:4.74,z:-.015}),false);
 assert.equal(precipitationRoofed(roofs,{x:-5,z:0},{x:5,z:0}),true);
 assert.equal(environmentAt(750,{source:'world',code:73}).kind,'snow');
});
