import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createNumericCore} from '../apps/fairy-garden/avatar-motion/numeric-core.mjs';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
const bytes=readFileSync(new URL('../apps/fairy-garden/avatar-motion/numeric-core.wasm',import.meta.url));
const identity={ptr:[0,1,2],col:[0,1],value:[1,1]};
const factors={permR:[0,1],permC:[0,1],rhs:identity,L:{ptr:[0,1,3],col:[0,0,1],value:[1,.5,1]},U:{ptr:[0,2,3],col:[0,1,1],value:[4,1,2.5]}};
test('sparse solve agrees with the analytic inverse for independent XYZ inputs',()=>{
 const core=createNumericCore(bytes),solver=core.make(factors),input=new Float64Array([3,-4,11,7,5,-2]),out=solver.solve(input);
 for(let k=0;k<3;k++){assert.ok(Math.abs(out[k]-(3*input[k]-input[k+3])/10)<1e-14);assert.ok(Math.abs(out[k+3]-(-2*input[k]+4*input[k+3])/10)<1e-14)}
 const memory=core.allocatedBytes();assert.equal(core.make(factors),solver);for(let i=0;i<50;i++)solver.solve(input);assert.equal(core.allocatedBytes(),memory);
 const copy=out.slice();solver.solve(new Float64Array(6));[.2,-1.7,3.5,2.2,2.8,-3].forEach((v,i)=>assert.ok(Math.abs(copy[i]-v)<1e-14));assert.deepEqual([...out],[0,0,0,0,0,0]);
});
test('invalid sparse factors fail before WASM memory access',()=>{
 for(const invalid of [{...factors,permR:[0,0]},{...factors,L:{ptr:[0,1,3],col:[1,0,1],value:[1,.5,1]}},{...factors,U:{ptr:[0,2,3],col:[0,1,1],value:[0,1,2.5]}}])assert.throws(()=>createNumericCore(bytes).make(invalid));
});
test('joint flow preserves stationary points and follows analytic rigid rotation away from the elbow',()=>{
 const apply=createNumericCore(bytes).makeJointFlow(3),points=new Float64Array([.3,.1,.2,.3,.1,-.2,0,0,0]),planes=new Float64Array(99);for(let j=0;j<33;j++)planes[j*3+2]=1;
 const angle=1.4,out=apply(points,planes,[0,0,angle],.025),expected=[.3*Math.cos(angle)-.1*Math.sin(angle),.3*Math.sin(angle)+.1*Math.cos(angle),.2];
 for(let k=0;k<3;k++)assert.ok(Math.abs(out[k]-expected[k])<3e-7);
 assert.deepEqual([...out.slice(3)],[.3,.1,-.2,0,0,0]);assert.throws(()=>apply(points,planes,[0,0,angle],0));
});
test('packed motion data preserves arbitrary Float64 values and validates boundaries',()=>{
 const values=[Math.PI,-0,Number.MIN_VALUE,1e-30,-123.456],source=Buffer.from(new Float64Array(values).buffer),shuffled=Buffer.alloc(source.length);
 for(let k=0;k<8;k++)for(let i=0;i<values.length;i++)shuffled[k*values.length+i]=source[i*8+k];
 const meta=Buffer.from(JSON.stringify({values:{$array:['d',0,values.length]}})),head=Buffer.alloc(8);head.write('LMOT');head.writeUInt32LE(meta.length,4);const raw=Buffer.concat([head,meta,shuffled]);
 assert.deepEqual(decodeMotion(raw).values,values);assert.throws(()=>decodeMotion(raw.subarray(0,raw.length-1)));assert.throws(()=>decodeMotion(Buffer.from('bad')));
});
test('all garment assets have stable mesh identifiers and complete normalized influences',()=>{
 const ids=['linen','heritage','bamboo','argyle','cardigan','ranger','garden','jacket','suit','tee','academy','berry'];
 for(const id of ids){const data=decodeMotion(gunzipSync(readFileSync(new URL('../apps/fairy-garden/avatar-motion/data/'+id+'.bin.gz',import.meta.url)))).binding;
  for(const row of [data,...data.parts]){assert.ok(Number.isInteger(row.meshId));assert.equal(row.skinWeight.length,row.rest.length/3*4);for(let i=0;i<row.skinWeight.length;i+=4){assert.ok(Math.abs(row.skinWeight.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-6);if(row.bentSkinWeight)assert.ok(Math.abs(row.bentSkinWeight.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-6)}}
 }
});
test('constant-region shortcut matches full 16-step RK4 across moving elbow planes',()=>{
 const core=createNumericCore(bytes),count=250,flow=core.makeJointFlow(count);let state=19887;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
 function normalize(a){const n=Math.hypot(...a);return a.map(x=>x/n)}
 function rotate(p,axis,t){const c=Math.cos(t),s=Math.sin(t),dot=p.reduce((sum,x,k)=>sum+x*axis[k],0),v=cross(axis,p);return p.map((x,k)=>x*c+v[k]*s+axis[k]*dot*(1-c))}
 for(const angle of [.02,.4,1.3,2.5,Math.PI])for(const width of [.005,.025,.08]){
  const axis=normalize([random()-.5,random()-.5,random()-.5]),direction=normalize([random()-.5,random()-.5,random()-.5]),rotation=axis.map(x=>x*angle),planes=Float64Array.from(Array.from({length:33},(_,j)=>rotate(direction,axis,angle*j/64)).flat()),points=Float64Array.from({length:count*3},()=>random()*.6-.3),actual=flow(points,planes,rotation,width);
  const velocity=(p,j)=>{const t=Math.max(0,Math.min(1,(p.reduce((sum,x,k)=>sum+x*planes[j*3+k],0)+width)/(2*width))),weight=t*t*(3-2*t);return cross(rotation,p).map(x=>x*weight)};
  for(let i=0;i<count;i++){let p=[...points.slice(i*3,i*3+3)];for(let step=0;step<16;step++){const k1=velocity(p,step*2),k2=velocity(p.map((x,k)=>x+k1[k]/32),step*2+1),k3=velocity(p.map((x,k)=>x+k2[k]/32),step*2+1),k4=velocity(p.map((x,k)=>x+k3[k]/16),step*2+2);p=p.map((x,k)=>x+(1/16)/6*(k1[k]+2*k2[k]+2*k3[k]+k4[k]))}for(let k=0;k<3;k++)assert.ok(Math.abs(actual[i*3+k]-p[k])<1e-12,`RK4 mismatch at ${angle}/${width}/${i}/${k}: ${actual[i*3+k]-p[k]} from ${Array.from(points.slice(i*3,i*3+3))}`);}
 }
});
test('symmetric factor uses one triangle and agrees with the full matrix inverse',()=>{
 const data={...factors,symmetricFactor:true,diagonal:[4,2]},core=createNumericCore(bytes),solver=core.make(data),input=new Float64Array([3,-4,11,7,5,-2]),out=solver.solve(input);
 for(let k=0;k<3;k++){assert.ok(Math.abs(out[k]-(3*input[k]-2*input[k+3])/8)<1e-14);assert.ok(Math.abs(out[k+3]-(-2*input[k]+4*input[k+3])/8)<1e-14)}
 assert.throws(()=>core.make({...data,diagonal:[4,-2]}));assert.throws(()=>core.make({...data,permC:[1,0]}));
});
