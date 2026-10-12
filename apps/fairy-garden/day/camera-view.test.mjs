import test from 'node:test';import assert from 'node:assert/strict';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:n(s,c);}});
const paint=new Proxy({measureText:()=>({width:50})},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>paint})};
const T=await import('three');const {createRoomCutaway}=await import('./camera-view.mjs'),{CORE_SPACES,buildSpace}=await import('./spaces.mjs'),{createSpaceView}=await import('./space-view.mjs'),{DAY_FACTORIES}=await import('./places/factories.mjs'),{DAY_PLACES}=await import('./places/index.mjs');
for(const id of [...Object.keys(CORE_SPACES),...Object.keys(DAY_PLACES)])test(id+' actual batched room rotates with restorable walls and unchanged furniture',()=>{
 const map=CORE_SPACES[id]?buildSpace(id):DAY_PLACES[id],{root}=CORE_SPACES[id]?createSpaceView(id,'warm',map):DAY_FACTORIES[id]();const cutaway=createRoomCutaway();const furniture=[];root.traverse(n=>{if(n.userData.furnitureId)furniture.push({n,visible:n.visible,position:n.position.toArray()});});
 const before=new T.Box3().setFromObject(root).clone();cutaway.update(root,map.bounds,{x:10,z:16});assert.deepEqual(cutaway.snapshot().hidden,[]);
 cutaway.update(root,map.bounds,{x:-10,z:-16});if(!map.outdoor)assert.ok(cutaway.snapshot().hidden.length>=2,id+' outer walls separately retained through batching');
 for(const {n,visible,position}of furniture){assert.equal(n.visible,visible);assert.deepEqual(n.position.toArray(),position);}assert.deepEqual(new T.Box3().setFromObject(root),before);
 cutaway.update(root,map.bounds,{x:10,z:16});assert.deepEqual(cutaway.snapshot().hidden,[]);cutaway.update(root,map.bounds,{x:-10,z:-16});cutaway.restore();assert.deepEqual(cutaway.snapshot().hidden,[]);
});
