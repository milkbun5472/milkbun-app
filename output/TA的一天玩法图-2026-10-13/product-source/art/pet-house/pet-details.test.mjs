import test from 'node:test';
import assert from 'node:assert/strict';
import {catLooseFragmentIndices} from './pet-skin.mjs';
import {createPetEyes} from './pet-eyes.mjs';

test('remove detached hind-leg scraps while keeping connected paws across UV seams',()=>{
 const p=[.12,.10,-.22, .13,.11,-.22, .12,.11,-.23,
  -.12,.10,-.22, -.13,.11,-.22, -.12,.11,-.23,
  .12,.10,-.22, .20,.30,-.10, .10,.20,-.10,
  .20,.30,-.10, .30,.40,.10, .20,.40,.10,
  .20,.10,-.22, .21,.11,-.22, .20,.11,-.23];
 // The first spur shares a position with the connected body and must stay.
 const index=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14],r=catLooseFragmentIndices(p,index);
 assert.deepEqual(r.index,[0,1,2,6,7,8,9,10,11,12,13,14]);
 assert.equal(r.removedTriangles,1);
 assert.deepEqual(catLooseFragmentIndices(p,r.index).index,r.index);
});
test('both detached fragments disappear without removing an unrelated island',()=>{
 const p=[.12,.10,-.22,.13,.11,-.22,.12,.11,-.23,-.12,.10,-.22,-.13,.11,-.22,-.12,.11,-.23,0,.5,.4,.01,.5,.4,0,.51,.4];
 const r=catLooseFragmentIndices(p,[0,1,2,3,4,5,6,7,8]);
 assert.deepEqual(r.index,[6,7,8]);assert.equal(r.components,2);
});
test('cat and dog eyelids never share a species-specific shader program',()=>{
 const materials=['cat','dog'].map(species=>{const material={onBeforeCompile(){},customProgramCacheKey:()=>'fur'};createPetEyes({traverse(fn){fn({isMesh:true,material})}},species);return material;});
 assert.notEqual(materials[0].customProgramCacheKey(),materials[1].customProgramCacheKey());
});
test('blink reaches fully closed then returns to the authored open eye',()=>{
 const eyes=createPetEyes({traverse(){}},'cat');eyes.update(0,6.59);assert.ok(eyes.closed>.999999);eyes.update(0,2);assert.equal(eyes.closed,0);eyes.update(1,2);assert.equal(eyes.closed,1);
});
