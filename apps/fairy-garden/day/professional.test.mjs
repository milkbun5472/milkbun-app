import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const T=await import('three');
const {DAY_FACTORIES,DAY_PLACES}=await import('./places/index.mjs');
const {updateWorkScene}=await import('./work-scene.mjs');
const {professionalOptions}=await import('./professional.mjs');
const doors=root=>{const all=[];root.traverse(o=>{if(o.userData.dayDoor)all.push(o);});return all;};
test('柜门合批后保留真实铰链与内部物件，取阅开启、走路关闭',()=>{
 for(const id of ['dayLaboratory','dayClinic','dayStudio']){
  const {root}=DAY_FACTORIES[id](),door=doors(root)[0];assert.ok(door,id);assert.ok(door.children.some(o=>o.isMesh));root.updateMatrixWorld(true);
  const before=new T.Box3().setFromObject(door);updateWorkScene(root,{kind:'select',furniture:door.userData.dayDoor.furniture,progress:.5},false,1);root.updateMatrixWorld(true);
  assert.ok(Math.abs(door.rotation.y)>.8);const after=new T.Box3().setFromObject(door);assert.ok(before.min.distanceTo(after.min)+before.max.distanceTo(after.max)>.05,id+'门体实际转动');
  updateWorkScene(root,{kind:'select',furniture:door.userData.dayDoor.furniture,progress:.5},true,1);assert.equal(Math.abs(door.rotation.y),0);
 }
});
test('耗材拿走与实际归还同一阶段同步，成品留下已有创作进度',()=>{
 const lab=DAY_FACTORIES.dayLaboratory().root,stock=lab.getObjectByName('LabConsumableStock:0');assert.ok(stock);
 for(const [kind,progress,visible]of [['select',.5,false],['experiment',.5,false],['tidy',.5,false],['tidy',.9,true]]){updateWorkScene(lab,{kind,progress,carry:true,carryType:'sample'},false,1);assert.equal(stock.visible,visible);}
 const studio=DAY_FACTORIES.dayStudio().root;updateWorkScene(studio,{kind:'paint',progress:.95},false,1);const work=studio.getObjectByName('WorkStroke:10');assert.equal(work.visible,true);assert.equal(studio.getObjectByName('WorkCraftResult').visible,false);updateWorkScene(studio,null,true,2);assert.equal(work.visible,true);
});
test('按研究方向与排练需要开关器材；列车停在真实候车边界外再沿轨道驶离',()=>{
 assert.deepEqual(professionalOptions({dayLaboratory:{equipment:'invalid'}},'dayLaboratory'),{equipment:'general'});
 const microscopy=DAY_FACTORIES.dayLaboratory({equipment:'microscope'}).root,chem=DAY_FACTORIES.dayLaboratory({equipment:'chemistry'}).root;
 assert.equal(microscopy.getObjectByName('Microscope').visible,true);assert.equal(microscopy.getObjectByName('TestTubeRack').visible,false);assert.equal(chem.getObjectByName('Microscope').visible,false);
 assert.deepEqual(professionalOptions({dayRehearsal:{mode:'dance'}},'dayRehearsal'),{instruments:false,mirror:true,mode:'dance'});
 const station=DAY_FACTORIES.dayStation().root,train=station.getObjectByName('DayStationTrain');station.updateMatrixWorld(true);const box=new T.Box3().setFromObject(train);assert.ok(box.min.x>DAY_PLACES.dayStation.bounds.w/2-.45);
 updateWorkScene(station,{kind:'wait',phase:'work',elapsed:3},false,1);assert.equal(train.position.z,0);updateWorkScene(station,{kind:'wait',phase:'exit',elapsed:3},false,1);assert.equal(train.position.z,6);updateWorkScene(station,null,true,2);assert.equal(train.position.z,0);
});

test('滴管接触点与实验台真实样品位置同源，站位仍可走到',async()=>{
 const {taskAt,activityPhase}=await import('./workflow.mjs'),map=DAY_PLACES.dayLaboratory,spot=map.spots.find(p=>p.id==='bench'),task=taskAt(activityPhase({map:'dayLaboratory',spot:'bench'},null,null),spot,map,3),root=DAY_FACTORIES.dayLaboratory().root;root.updateMatrixWorld(true);const sample=root.getObjectByName('ActiveSample').getWorldPosition(new T.Vector3());sample.y+=.04;assert.ok(sample.distanceTo(new T.Vector3(task.contact.x,task.contact.y,task.contact.z))<1e-6);
});
