import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../apps/fairy-garden/vendor/three.module.js';
import {capsuleDepth,makeHangingHair} from '../apps/fairy-garden/hanging-hair.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('capsule ray includes both rounded ends and handles a depth-aligned arm',()=>{
 assert.deepEqual(capsuleDepth(0,0,{x:0,y:0,z:-1},{x:0,y:0,z:2},.5),[-1.5,2.5]);
 assert.equal(capsuleDepth(1,0,{x:0,y:0,z:-1},{x:0,y:0,z:2},.5),null);
 const a={x:0,y:0,z:0},b={x:2,y:0,z:0};
 for(const x of [-.3,0,1,2,2.3]){const span=capsuleDepth(x,0,a,b,.5),d=Math.max(0,-x,x-2);near(span[0],-Math.sqrt(.25-d*d));near(span[1],-span[0]);}
});
test('oblique capsule bounds agree with an independent dense union of spheres',()=>{
 for(let k=0;k<20;k++){
  const a={x:-.3,y:.1,z:.25},b={x:.8,y:.7,z:-.6},r=.4,x=-.5+k*.075,y=.25;
  const exact=capsuleDepth(x,y,a,b,r);let lo=Infinity,hi=-Infinity;
  for(let i=0;i<=12000;i++){const t=i/12000,c={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},h=r*r-(x-c.x)**2-(y-c.y)**2;if(h>=0){lo=Math.min(lo,c.z-Math.sqrt(h));hi=Math.max(hi,c.z+Math.sqrt(h));}}
  if(lo===Infinity)assert.equal(exact,null);else{near(exact[0],lo,1e-5);near(exact[1],hi,1e-5);const reversed=capsuleDepth(x,y,b,a,r);near(exact[0],reversed[0]);near(exact[1],reversed[1]);}
 }
});
function fixture(source){
 const model=new T.Group(),anchor=new T.Group();anchor.name='HeadAnchor';model.add(anchor);
 const geometry=source||new T.BufferGeometry();if(!source){geometry.setAttribute('position',new T.Float32BufferAttribute([-.1,0,0,.1,0,0,-.1,-2,.2,.1,-2,.2],3));geometry.setAttribute('normal',new T.Float32BufferAttribute(Array(4).fill([0,0,1]).flat(),3));geometry.setIndex([0,2,1,1,2,3]);}
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial());mesh.userData.hair='fixture';anchor.add(mesh);const drape=makeHangingHair(T,model);drape.attach(mesh);return {model,anchor,mesh,drape,source:geometry};
}
test('head drape preserves the cap, source asset, second avatar and exact neutral reset',()=>{
 const a=fixture(),b=fixture(a.source),original=Array.from(a.source.attributes.position.array);a.anchor.rotation.x=.65;a.drape.update();
 assert.notDeepEqual(Array.from(a.mesh.geometry.attributes.position.array),original);
 assert.deepEqual(Array.from(a.mesh.geometry.attributes.position.array).slice(0,6),original.slice(0,6));
 assert.deepEqual(Array.from(a.source.attributes.position.array),original);assert.deepEqual(Array.from(b.mesh.geometry.attributes.position.array),original);
 a.anchor.rotation.x=0;a.drape.update();assert.deepEqual(Array.from(a.mesh.geometry.attributes.position.array),original);
 for(let i=0;i<20;i++){a.anchor.rotation.x=.65;a.drape.update();a.anchor.rotation.x=0;a.drape.update();}assert.deepEqual(Array.from(a.mesh.geometry.attributes.position.array),original);
});
test('short hair retains original geometry and does not acquire a drape',()=>{
 const source=new T.BoxGeometry(.5,.5,.5),a=fixture(source);assert.equal(a.mesh.geometry,source);assert.equal(a.mesh.userData.hairDrape,undefined);
});

// The hand invitation and accepted clap use one continuous route.
test('hand invitation joins the clap without jumping and returns to neutral',async()=>{
 const {emotionPose}=await import('../apps/fairy-garden/emotion-pose.mjs');
 for(const side of ['left','right']){
  assert.deepEqual(emotionPose('five-'+side,.5)[side],emotionPose('clap-'+side,0)[side]);
  for(const action of ['five','clap']){const end=emotionPose(action+'-'+side,1)[side];assert(end.every(x=>Math.abs(x)<1e-9));let previous;for(let i=0;i<=200;i++){const q=emotionPose(action+'-'+side,i/200)[side];if(previous)assert(Math.max(...q.map((v,k)=>Math.abs(v-previous[k])))<.1);previous=q;}}
 }
});
