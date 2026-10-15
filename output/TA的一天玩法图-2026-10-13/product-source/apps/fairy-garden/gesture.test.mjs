import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,gestureError,MAPS,perform,targetFor} from './world.mjs';
test('wave requires an awake companion within sight on the same map; stretching is independent',()=>{
 const s=freshState();s.companion.position={x:s.position.x+2,z:s.position.z};assert.equal(gestureError(s,'wave'),'');assert.equal(gestureError(s,'stretch'),'');
 assert.ok(gestureError({...s,companion:{...s.companion,map:'forest'}},'wave'));assert.ok(gestureError({...s,companion:{...s.companion,position:{x:s.position.x+5,z:s.position.z}}},'wave'));
 const seated=perform({...s,position:targetFor(s,'sit','pond')},'sit','pond');assert.ok(gestureError(seated,'stretch'));assert.ok(gestureError(seated,'wave'));
 const bed=Object.keys(MAPS.home.beds)[0];const sleeping=perform({...s,map:'home',position:MAPS.home.beds[bed].approach.player},'bed',bed,'together');assert.ok(gestureError(sleeping,'stretch'));
});
