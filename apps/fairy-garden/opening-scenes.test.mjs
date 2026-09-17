import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAPS,freshState,fillVein,takeShard,castSpell,OPENINGS,SPELLS,opened,openingReady,walkable,findPath,segmentClear,restoreState,floorHeight,onLakeIce} from './world.mjs';
import {openingTag} from './opening-view.mjs';
import {makeCompanionController} from './companion.mjs';
import {createNavigator} from './navigation.mjs';
const cases={fallenTree:{map:'garden',plan:MAPS.garden.oldTower.fallenTree,file:'opening-fallen-tree'},reedBridge:{map:'garden',plan:MAPS.garden.lake.reedBridge,file:'opening-reed-bridge'},towerVines:{map:'oldTower',plan:MAPS.oldTower.plan.vines,file:'opening-tower-vines'}};
function armed(key){const spell=OPENINGS[key].spell;const s=takeShard(fillVein(freshState(),[{kind:SPELLS[spell].need,text:'用于验证开路的碎片'}]),1);return {...s,spells:[spell]};}
for(const [key,{map,plan:q,file}] of Object.entries(cases)){
 test(key+' has both exported meshes, a real blocking gate, and a persistent reachable destination',()=>{
  const data=readFileSync(new URL('./'+file+'.glb',import.meta.url));assert.equal(data.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
  for(const side of ['shut','open']){const node=json.nodes.find(n=>n.name===side+':'+key);assert.ok(node,side+' named mesh');assert.ok(json.meshes[node.mesh]?.primitives.length);}
  assert.equal(openingReady(key),true);let s=armed(key);assert.equal(segmentClear(q.approach,q.beyond,map,[],s),false);assert.equal(findPath(q.approach,q.beyond,map,[],s),null);
  s=castSpell(s,OPENINGS[key].spell,s.shards[0].id,key);assert.equal(opened(s,key),true);assert.equal(segmentClear(q.approach,q.beyond,map,[],s),true);
  const path=findPath(q.approach,q.beyond,map,[],s);assert.ok(path?.length);let prev=q.approach;for(const p of path){assert.ok(segmentClear(prev,p,map,[],s));prev=p;}
  s={...s,map,position:{...q.beyond},companion:{...s.companion,map,mode:'follow',position:{x:q.approach.x,z:q.approach.z+.6}}};assert.ok(walkable(s.companion.position.x,s.companion.position.z,map,s));
  const controller=makeCompanionController();for(let i=0;i<200;i++)s=controller.tick(s,.1).state;assert.ok(Math.hypot(s.companion.position.x-q.beyond.x,s.companion.position.z-q.beyond.z)<1.5,'companion follows through '+key);
  s={...s,map,position:{...q.beyond}};const saved=restoreState(JSON.parse(JSON.stringify(s)));assert.deepEqual(saved.position,q.beyond);assert.equal(opened(saved,key),true);
 });
}
test('loader-sanitized names use original glTF metadata for the visibility contract',()=>{
 assert.deepEqual(openingTag({name:'shutfallenTree',userData:{name:'shut:fallenTree'}}),{side:'shut',key:'fallenTree'});
 assert.deepEqual(openingTag({name:'open:reedBridge'}),{side:'open',key:'reedBridge'});assert.equal(openingTag({name:'ordinary tree'}),null);
});
test('the reed bridge has small actual steps, and stays a walking deck in winter',()=>{
 const q=cases.reedBridge.plan;let s=armed('reedBridge');s=castSpell(s,'sense',s.shards[0].id,'reedBridge');
 let last=floorHeight('garden',q.approach,s);
 for(let z=q.approach.z;z>q.beyond.z;z-=.037){const p={x:q.x,z},height=floorHeight('garden',p,s);assert.ok(walkable(p.x,p.z,'garden',s));assert.ok(Math.abs(height-last)<=.151,'height discontinuity '+JSON.stringify({z,height,last}));last=height;}
 assert.equal(floorHeight('garden',q.beyond,s),.68);assert.equal(onLakeIce('garden',{x:q.x,z:0},{...s,day:43}),false);
 assert.equal(walkable(q.x+1.5,0,'garden',s),false,'bridge opens only its own strip');
 assert.equal(walkable(MAPS.garden.oldTower.x,MAPS.garden.oldTower.z,'garden',s),false,'tower still solid');
});
test('a closed destination pocket is rejected locally, without flooding the whole map',()=>{
 let samples=0;const wall=(x,z)=>Math.abs(x-8)<.12&&Math.abs(z)<1.2||x>8&&Math.abs(z)>1.05;
 const open=(x,z)=>{samples++;return x>-30&&x<10&&z>-30&&z<30&&!wall(x,z);};
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06));for(let i=0;i<=n;i++)if(!open(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;};
 const nav=createNavigator({garden:{radius:32}},open,clear,(x,z)=>x>-30&&x<10&&z>-30&&z<30);
 assert.equal(nav({x:0,z:0},{x:9,z:0}),null);assert.ok(samples<20000,'must not explore the large outside component: '+samples);
});
