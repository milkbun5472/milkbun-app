import test from 'node:test';
import assert from 'node:assert/strict';
import {professionalStation,residentWorkPose} from './resident-work-motion.mjs';
import {createTownNavigation} from './town-life.mjs';
import {workroomFurniture} from './resident-workroom.mjs';
test('every professional stance is on clear floor and faces its real work surface at all three stages',()=>{
 for(const form of ['office','clinic','classroom','studio','business'])for(let stage=0;stage<3;stage++){const q=professionalStation(form,stage),n=createTownNavigation('workroom',1.4,form);assert.ok(n.walkable(q.point.x,q.point.z),form+stage);assert.ok(n.path({x:0,z:2.25},q.point),form+stage);assert.ok(Math.abs(Math.atan2(q.contact.x-q.point.x,q.contact.z-q.point.z)-q.heading)<1e-8);assert.ok(workroomFurniture(form).some(f=>Math.abs(q.contact.x-f.x)<=f.w/2&&Math.abs(q.contact.z-f.z)<=f.d/2+.1));}
});
test('doctor, field notes, drawing and board writing reuse the shared hand props with grounded task support',()=>{
 for(const role of ['doctor','field','artist']){const q=residentWorkPose({role,place:role==='artist'?'home':'workroom'},1,4);assert.equal(q.task.kind,'clipboard');assert.equal(q.nativeTool,true);assert.equal(q.task.supportHeight,0);}
 assert.equal(residentWorkPose({role:'custom',form:'clinic',place:'workroom'},1,4).task.kind,'clipboard');
 const q=residentWorkPose({role:'teacher',form:'classroom',place:'workroom'},1,4);assert.equal(q.task.kind,'paint');assert.equal(q.task.tool,'chalk');assert.equal(q.task.contact.z,-2.48);assert.equal(q.task.supportHeight,0);assert.equal(residentWorkPose({role:'teacher',place:'workroom'},0,4).gesture,'read');
});
