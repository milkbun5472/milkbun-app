import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_CATALOG,homePlacements} from './home-catalog.mjs';
import {furniturePartDefinitions,patchPartColors} from './home-parts.mjs';
import {addHomeFurniture,changeHomeFurniture,restoreHomeLayout} from './home-layout.mjs';

test('全部80款部件色沿原实例writer保存，旧布局不添空字段',()=>{
 assert.equal(HOME_CATALOG.length,80);assert.equal(homePlacements().sofa.partColors,undefined);
 for(const p of HOME_CATALOG){
  const added=addHomeFurniture({},p.id),id=added.selected,keys=furniturePartDefinitions(p).map(q=>q.id);
  assert.equal(new Set(keys).size,keys.length,p.id);
  const changed=changeHomeFurniture(added.placements,id,{partColors:{[keys[0]]:'#ABC123',[keys[1]]:'#765432'}});assert.ok(changed.ok,p.id);
  assert.deepEqual(changed.placements[id].partColors,{[keys[0]]:'#abc123',[keys[1]]:'#765432'});
  assert.deepEqual(restoreHomeLayout(JSON.parse(JSON.stringify(changed.placements))),changed.placements);
  const stored=changeHomeFurniture(changed.placements,id,'store'),restored=changeHomeFurniture(stored.placements,id,'restore');assert.deepEqual(restored.placements[id].partColors,changed.placements[id].partColors);
  const extra=addHomeFurniture(changed.placements,p.id);assert.equal(extra.placements[extra.selected].partColors,undefined);
  const reset=changeHomeFurniture(changed.placements,id,{partColors:{[keys[0]]:''}});assert.deepEqual(reset.placements[id].partColors,{[keys[1]]:'#765432'});
  assert.equal(changeHomeFurniture(reset.placements,id,{partColors:null}).placements[id].partColors,undefined);
 }
});
test('部件色合并不改主要颜色、其他部件或原稿，非法键色不入库',()=>{
 const raw=homePlacements(),next=changeHomeFurniture(raw,'sofa',{color:'#e9dcc7',material:'fabric',partColors:{seat:'#112233',back:'#445566',wrong:'#aabbcc',feet:'red',arms:'#abcd',cushionLeft:'#123456'}});
 assert.ok(next.ok);assert.deepEqual(next.placements.sofa.partColors,{seat:'#112233',back:'#445566',cushionLeft:'#123456'});assert.equal(raw.sofa.partColors,undefined);
 const patched=changeHomeFurniture(next.placements,'sofa',{partColors:{seat:'#AABBCC',back:undefined,cushionLeft:''}}).placements.sofa;
 assert.equal(patched.color,'#e9dcc7');assert.equal(patched.material,'fabric');assert.deepEqual(patched.partColors,{seat:'#aabbcc',back:'#445566'});
 assert.deepEqual(patchPartColors(HOME_CATALOG.find(p=>p.id==='sofa'),patched.partColors,['red']),patched.partColors);
 assert.deepEqual(homePlacements({sofa:{partColors:{seat:'#00FF88',__bad__:'#aabbcc',feet:'transparent'}}}).sofa.partColors,{seat:'#00ff88'});
});
