import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const {createBoardStation}=await import('./board-station.mjs'),K=globalThis.CharDayKitchen;
test('放大砧板显示同一块真实食材，四尺寸投影能反向找到存档坐标、划切保留体积',()=>{
 const job={id:'board-test',recipeId:'tomato-egg',cooking:K.cookingSession('tomato-egg',{mode:'hands',lead:'ta'})},station=createBoardStation();let p=job.cooking.progress;const piece=p.table.items.find(q=>q.ingredient==='tomato'),Z=K.TABLE_ZONES.board;
 p=K.stepCooking(job,p,{kind:'drop',id:piece.id,point:Z});const volume=p.table.items.reduce((n,q)=>n+q.w*q.d*q.h,0);
 for(const [w,h]of [[320,450],[390,725],[430,812],[844,280]]){station.update(job,p,w,h);assert.equal(station.inspect().pieces,1);const q={x:Z.x+.04,z:Z.z-.02},screen=station.project(q),back=station.point(screen.x,screen.y);assert.ok(Math.abs(q.x-back.x)<1e-7&&Math.abs(q.z-back.z)<1e-7);const a=station.project({x:Z.x-piece.w/2,z:Z.z}),b=station.project({x:Z.x+piece.w/2,z:Z.z});assert.ok(Math.abs(a.x-b.x)>Math.min(w,h)*.45);}
 p=K.stepCooking(job,p,{kind:'slice',from:{x:Z.x-.15,z:Z.z},to:{x:Z.x+.15,z:Z.z}});assert.equal(p.table.items.filter(q=>q.zone==='board').length,2);assert.ok(Math.abs(p.table.items.reduce((n,q)=>n+q.w*q.d*q.h,0)-volume)<1e-9);station.update(job,p,390,725);assert.equal(station.inspect().pieces,2);
 const before=p.table.items.map(q=>[q.id,q.zone,q.x,q.z]);for(let i=0;i<40;i++)p=K.stepCooking(job,p,{kind:'tick',dt:.1,active:true,prepPaused:true});assert.deepEqual(p.table.items.map(q=>[q.id,q.zone,q.x,q.z]),before);
 for(const q of p.table.items.filter(q=>q.zone==='board'))p=K.stepCooking(job,p,{kind:'drop',id:q.id,point:K.TABLE_ZONES.pan});station.update(job,p,390,725);assert.equal(station.inspect().pieces,0);assert.ok(Math.abs(p.table.items.reduce((n,q)=>n+q.w*q.d*q.h,0)-volume)<1e-9);station.dispose();
});
test('划切期间锁住砧板镜头，食材变化不把正在滑动的手指投影挪走',()=>{
 const j={recipeId:'tomato-egg',cooking:K.cookingSession('tomato-egg',{lead:'ta'})},station=createBoardStation();let p=K.stepCooking(j,j.cooking.progress,{kind:'drop',id:'food-0',point:K.TABLE_ZONES.board});station.update(j,p,390,725);const before=station.point(210,350);
 p.table.items.push({...p.table.items[0],id:'new',x:K.TABLE_ZONES.board.x+.24});station.update(j,p,390,725,{path:[before]});assert.deepEqual(station.point(210,350),before);station.dispose();
});
