import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,segmentClear} from '../world.mjs';
import {registerCoreSpaces,CORE_SPACES} from './spaces.mjs';
import {DAY_PLACES} from './places/maps.mjs';
import {createSceneVisit,visitNear} from './visit.mjs';
registerCoreSpaces(MAPS);Object.assign(MAPS,DAY_PLACES);
test('独自出门没有隐形TA，24处沿实际可走路线坐下和起身，快照保持手选',()=>{
 for(const id of [...Object.keys(CORE_SPACES),...Object.keys(DAY_PLACES)]){
  const map=MAPS[id],avatar={root:{visible:false,position:{set(x,y,z){this.x=x;this.y=y;this.z=z;},toArray(){return [this.x,this.y,this.z];}},rotation:{},userData:{}},animate(){}},v=createSceneVisit({avatar,ta:()=>null,choice:'manual',map:()=>map});
  assert.equal(visitNear(map.spawn,null,map),null);assert.equal(v.join({restore:{control:'manual',manualAction:'manual'}}),true);assert.equal(v.inspect().route.length,0);assert.equal(v.inspect().following,false);assert.equal(v.act('rest'),true,id+'存在可走到的座位');
  for(let i=0;i<1600&&v.inspect().busy;i++){const before=v.inspect().position;v.tick(.05,i*.05);assert.ok(segmentClear(before,v.inspect().position,id),id+'不切穿家具');}v.tick(.05,100);assert.equal(v.inspect().busy,false,id);assert.equal(v.inspect().seated,true,id);assert.equal(v.inspect().activity,'rest');
  const pause=v.pauseState();v.close();assert.equal(v.restore(pause),true);assert.deepEqual(v.inspect().position,pause.position);assert.equal(v.inspect().manualAction,'rest');assert.equal(v.act('near'),false);assert.equal(v.inspect().route.length,0);assert.equal(v.act('stand'),true);assert.equal(v.inspect().seated,false);v.close();
 }
});
