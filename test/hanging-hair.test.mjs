import test from 'node:test';
import {readFileSync} from 'node:fs';
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
function fixture(source,support){
 const model=new T.Group(),anchor=new T.Group();anchor.name='HeadAnchor';model.add(anchor);
 const geometry=source||new T.BufferGeometry();if(!source){geometry.setAttribute('position',new T.Float32BufferAttribute([-.1,0,0,.1,0,0,-.1,-2,.2,.1,-2,.2],3));geometry.setAttribute('normal',new T.Float32BufferAttribute(Array(4).fill([0,0,1]).flat(),3));geometry.setIndex([0,2,1,1,2,3]);}
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial());mesh.userData.hair='fixture';if(support)mesh.userData.hairNapeSupport=support;anchor.add(mesh);const drape=makeHangingHair(T,model);drape.attach(mesh);return {model,anchor,mesh,drape,source:geometry};
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

// Use a small real surface patch to check normals independently of the formula.
test('authored nape stays attached while front strands fall, with smooth surface normals',()=>{
 const e=.001,g=new T.BufferGeometry(),p=[.4,-1.45,.25];
 g.setAttribute('position',new T.Float32BufferAttribute([...p,p[0]+e,p[1],p[2],p[0],p[1]+e,p[2],.4,-2,.3,-.3,-1,0],3));
 g.setAttribute('normal',new T.Float32BufferAttribute(Array(5).fill([0,0,1]).flat(),3));g.setIndex([0,1,2]);
 const a=fixture(g,{back:.05,front:.45,bottom:-1.3,tip:-1.8}),rest=Array.from(g.attributes.position.array);
 a.anchor.rotation.set(.6,0,.25);a.drape.update();const pos=a.mesh.geometry.attributes.position;
 assert.deepEqual(Array.from(pos.array).slice(12),rest.slice(12));
 assert.notDeepEqual(Array.from(pos.array).slice(9,12),rest.slice(9,12));
 const at=i=>new T.Vector3().fromBufferAttribute(pos,i),normal=at(1).sub(at(0)).cross(at(2).sub(at(0))).normalize();
 assert(normal.dot(new T.Vector3().fromBufferAttribute(a.mesh.geometry.attributes.normal,0))>.9999);
 a.anchor.rotation.set(0,0,0);a.drape.update();assert.deepEqual(Array.from(pos.array),rest);
});

test('exported braid attachment stays unfolded through nod and turn transitions',()=>{
 const bytes=readFileSync(new URL('../apps/fairy-garden/hair/braids.glb',import.meta.url)),asset=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const support=asset.nodes.find(n=>n.extras?.hairNapeSupport)?.extras.hairNapeSupport;assert(support,'missing authored attachment zone');
 const e=.001,points=[];
 for(const y of [-.8,-1,-1.3,-1.5,-1.7,-2,-2.3])for(const z of [-.1,.05,.075,.1,.25,.5,1])points.push(.4,y,z,.4+e,y,z,.4,y+e,z,.4,y,z+e);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('normal',new T.Float32BufferAttribute(Array(points.length/3).fill([0,0,1]).flat(),3));
 const a=fixture(g,support);
 for(const rotation of [[.8,0,.25],[-.45,.6,-.25],[0,.6,0]]){
  a.anchor.rotation.set(...rotation);a.drape.update();const p=a.mesh.geometry.attributes.position,at=i=>new T.Vector3().fromBufferAttribute(p,i);
  for(let i=0;i<p.count;i+=4){const v=at(i),dx=at(i+1).sub(v).divideScalar(e),dy=at(i+2).sub(v).divideScalar(e),dz=at(i+3).sub(v).divideScalar(e),det=dx.dot(dy.cross(dz));assert(det>.1,'folded attachment at '+points.slice(i*3,i*3+3)+': '+det);}
 }
});
