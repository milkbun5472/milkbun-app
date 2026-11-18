import {createHandSurfaceQuery} from './hand-surface-query.mjs?v=fg-3bfd551167cb8a02';
import * as T from 'three';
import {loadMotionAsset} from './assets.mjs?v=fg-3bfd551167cb8a02';
import {createNumericCore} from './numeric-core.mjs?v=fg-3bfd551167cb8a02';
import {createCachedMotionUpdate} from './pose-cache.mjs?v=fg-3bfd551167cb8a02';
import {fitRigid} from './rigid-fit.mjs?v=fg-3bfd551167cb8a02';
import {createClothNormalUpdater,disposeClothNormalGeometry} from './cloth-normals.mjs?v=fg-3bfd551167cb8a02';
import {install as poseField} from './pose-field.mjs?v=fg-3bfd551167cb8a02';
import {install as dimensions} from './dimensions.mjs?v=fg-3bfd551167cb8a02';
import {install as surfaceFairing} from './surface-fairing.mjs?v=fg-3bfd551167cb8a02';
import {install as armShaft} from './arm-shaft.mjs?v=fg-3bfd551167cb8a02';
import {install as headClearance} from './head-clearance.mjs?v=fg-3bfd551167cb8a02';
import {install as shoulderRoot} from './shoulder-root.mjs?v=fg-3bfd551167cb8a02';
import {install as shoulderNormal} from './shoulder-normal.mjs?v=fg-3bfd551167cb8a02';
import {install as neckArea} from './neck-area.mjs?v=fg-3bfd551167cb8a02';
import {install as posedBuffer} from './posed-buffer.mjs?v=fg-3bfd551167cb8a02';
import {install as elbowFlow} from './elbow-flow.mjs?v=fg-3bfd551167cb8a02';
import {install as materialLength} from './material-length.mjs?v=fg-3bfd551167cb8a02';
import {install as elbowMetric} from './elbow-metric.mjs?v=fg-3bfd551167cb8a02';
import {install as torsoClearance} from './torso-clearance.mjs?v=fg-3bfd551167cb8a02';
import {install as contactMetric} from './contact-metric.mjs?v=fg-3bfd551167cb8a02';
import {install as skinSurface} from './skin-surface.mjs?v=fg-3bfd551167cb8a02';
import {install as coverage} from './coverage.mjs?v=fg-3bfd551167cb8a02';
import {install as clothDimensions} from './cloth-dimensions.mjs?v=fg-3bfd551167cb8a02';
import {install as clothTransport,advancePhoneCuffBlend} from './cloth-transport.mjs?v=fg-3bfd551167cb8a02';
import {install as clothSurface} from './cloth-surface.mjs?v=fg-3bfd551167cb8a02';
const sources=new WeakMap(),outfits=new Map();let numeric;
export async function prepareMotionSource(source){
 if(!numeric)numeric=fetch(new URL('./numeric-core.wasm'+new URL(import.meta.url).search,import.meta.url)).then(async r=>{if(!r.ok)throw Error('Motion kernel request failed');return createNumericCore(await r.arrayBuffer())}).catch(e=>{numeric=null;throw e});
 const [data,core]=await Promise.all([loadMotionAsset('body'),numeric]);sources.set(source,{data,core});return source;
}
export async function prepareOutfitMotion(id){const data=await loadMotionAsset(id);outfits.set(id,data);}
export function createAvatarMotion(source,root,model,rig,body,initialDims){
 const resources=sources.get(source);if(!resources||!body)return null;
 const {data,core}=resources,mesh=data.mesh,g=new T.BufferGeometry(),indices=[],weights=[];
 for(const row of mesh.weights)for(let k=0;k<4;k++){const [name,w]=row[k]||['body',0],i=body.skeleton.bones.findIndex(b=>b.name===name);if(i<0)throw Error('Motion bone missing: '+name);indices.push(i);weights.push(w);}
 for(const [key,values,width] of [['position',mesh.position,3],['normal',mesh.normal,3],['uv',mesh.uv,2],['repairSkin',mesh.repairSkin,1]])g.setAttribute(key,new T.Float32BufferAttribute(values,width));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(mesh.index);
 for(const [name,pick]of [['skinArmInfluence',n=>/Arm$|Forearm$/.test(n)],['skinLeftForearmInfluence',n=>n==='leftForearm'],['skinRightForearmInfluence',n=>n==='rightForearm']])g.setAttribute(name,new T.Float32BufferAttribute(mesh.weights.map(row=>row.reduce((s,[n,w])=>s+(pick(n)?w:0),0)),1));
 body.geometry=g;body.frustumCulled=false;
 const q={...data,T,body,doll:{root},numericCore:core,dimensionValues:{...initialDims},beforePose:[],createClothNormalUpdater:(...args)=>createClothNormalUpdater(...args,core),bindingGeneration:0};
 const baseP=new Float32Array(g.attributes.position.array),baseN=new Float32Array(g.attributes.normal.array),garments=new Map();
 const arms=rig.filter(({p})=>p.userData.forearm).map(({p,label})=>{const hand=model.getObjectByName(label==='leftArm'?'Left_hand':'Right_hand');return {p,hand,handRest:hand.position.clone()}});
 let apply=null,dead=false,handFrames=[];
 poseField(q);dimensions(q);skinSurface(q);coverage(q);
 const nearestHandSurface=createHandSurfaceQuery(body,q.dimensionCanonicalRest,(i,p)=>q.posedBuffer?p.fromArray(q.posedBuffer,i*3):body.getVertexPosition(i,p));
 function restore(){g.attributes.position.array.set(baseP);g.attributes.normal.array.set(baseN);g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;for(const [o,saved]of garments){o.geometry.attributes.position.array.set(saved.position);o.geometry.attributes.normal.array.set(saved.normal);o.geometry.attributes.position.needsUpdate=true;o.geometry.attributes.normal.needsUpdate=true;}}
 function beforeBind(dims){if(dead)return;apply=null;restore();q.dimensionValues={...dims};for(const {hand,handRest}of arms)hand.position.copy(handRest);q.beforePose=[];q.armTorsoOffsets=null;}
 function fitRest(){
  root.updateMatrixWorld(true);q.rigFit=[];
  for(const {p,hand}of arms){const upper=p.userData.bone,lower=p.userData.forearm,side=upper.name.startsWith('left')?'left':'right',sign=side==='left'?-1:1,old=body.worldToLocal(upper.getWorldPosition(new T.Vector3())),wrist=body.worldToLocal(hand.getWorldPosition(new T.Vector3())),shift=old.clone().sub(new T.Vector3(sign*.15924000655651094,.6549999713897705,0)),shoulder=new T.Vector3(sign*.11,.65,-.011).add(shift),elbow=shoulder.clone().lerp(wrist,.52),world=body.localToWorld(shoulder.clone());
   p.position.copy(p.parent.worldToLocal(world.clone()));upper.position.copy(upper.parent.worldToLocal(world));root.updateMatrixWorld(true);lower.position.copy(lower.parent.worldToLocal(body.localToWorld(elbow.clone())));root.updateMatrixWorld(true);hand.position.copy(hand.parent.worldToLocal(body.localToWorld(wrist.clone())));root.updateMatrixWorld(true);
   q.rigFit.push({side,old:old.toArray(),shoulder:shoulder.toArray(),elbow:elbow.toArray(),wrist:wrist.toArray(),group:p.position.clone()});
  }
 }
 function afterBind(id){
  if(dead)return;restore();q.bindingGeneration++;q.beforePose=[];q.armTorsoOffsets=null;root.updateMatrixWorld(true);body.skeleton.update();
  poseField(q);dimensions(q);
  for(const install of [surfaceFairing,armShaft,headClearance,shoulderRoot,shoulderNormal,neckArea,posedBuffer,elbowFlow,materialLength,elbowMetric,torsoClearance,contactMetric])install(q);
  q.outfits=[];root.traverse(o=>{if(o.isMesh&&o.userData.outfit===id)q.outfits.push(o)});
  const asset=outfits.get(id);q.bodyBackedCuffUniforms.enabled.value=0;
  if(asset&&q.outfits.length){
   q.bodyBackedClothData=structuredClone(asset.binding);
   const rows=[q.bodyBackedClothData,...q.bodyBackedClothData.parts];
   for(const row of rows){const o=q.outfits[row.meshId];if(!o||o.name!==row.name||o.geometry.attributes.position.count*3!==row.rest.length)throw Error('Outfit binding mismatch: '+id+'/'+row.meshId);
    if(!garments.has(o)){garments.set(o,{position:new Float32Array(o.geometry.attributes.position.array),normal:new Float32Array(o.geometry.attributes.normal.array)});}
   }
   clothDimensions(q);
   const previous=q.applyLiveFair;q.applyLiveFair=()=>{previous();for(const o of q.outfits){const saved=garments.get(o);if(!saved)continue;o.geometry.attributes.position.array.set(saved.position);o.geometry.attributes.normal.array.set(saved.normal);o.geometry.attributes.position.needsUpdate=true;o.geometry.attributes.normal.needsUpdate=true}};
   clothTransport(q,{materialCuff:asset.materialCuff});clothSurface(q);
  }
  handFrames=arms.map(({hand},side)=>{const fore=body.skeleton.bones.findIndex(b=>b.name===(side?'rightForearm':'leftForearm')),ids=[],seen=new Set(),grip=body.worldToLocal(hand.getWorldPosition(new T.Vector3()));
   // Keep the authored IK marker. Transport it with the corrected material palm;
   // moving the marker itself changes every reach/contact animation's target.
   for(let i=0;i<g.attributes.position.count;i++){let own=0;for(let k=0;k<4;k++)if(indices[i*4+k]===fore)own+=weights[i*4+k];if(own<=.999||q.dimensionCanonicalRest[i*3+1]>=.435)continue;const key=Array.from(q.dimensionCanonicalRest.slice(i*3,i*3+3),x=>Math.round(x/1e-6)).join(',');if(seen.has(key))continue;seen.add(key);ids.push(i);}
   if(ids.length<3)throw Error('Missing hand material anchors');return {hand,grip,ids,rest:ids.flatMap(i=>Array.from(q.dimensionRest.slice(i*3,i*3+3))),posed:new Float64Array(ids.length*3),localIds:ids.map((_,i)=>i),point:new T.Vector3(),generation:-1};
  });
  q.motionGeneration=0;
  apply=createCachedMotionUpdate(q,()=>{q.applyPoseCurve();q.applyLiveFair();q.motionGeneration++});
 }

 function update(){if(!dead&&apply)apply();}
 function handPoint(side,fallback){if(!apply)return fallback;update();const row=handFrames[side==='left'?0:1];if(row.generation!==q.motionGeneration){const point=new T.Vector3();for(let k=0;k<row.ids.length;k++){const i=row.ids[k];if(q.posedBuffer)point.fromArray(q.posedBuffer,i*3);else body.getVertexPosition(i,point);point.toArray(row.posed,k*3)}const fit=fitRigid(row.rest,row.posed,row.localIds);row.point.copy(row.grip).sub(new T.Vector3(...fit.restCenter)).applyQuaternion(new T.Quaternion(...fit.quaternion)).add(new T.Vector3(...fit.posedCenter));row.generation=q.motionGeneration;}return body.localToWorld(row.point.clone());}

 return {beforeBind,fitRest,afterBind,setClothPose(pose,blend){q.phoneCuffBlend=advancePhoneCuffBlend(q.phoneCuffBlend||0,pose?.phone,blend);},alignGroups(){arms.forEach(({p},i)=>p.position.copy(q.rigFit[i].group));},beforePose(){for(let i=q.beforePose.length-1;i>=0;i--)q.beforePose[i]();},update,handPoint,nearestHandPoint(side,target){update();return nearestHandSurface(side,target);},inspect:()=>q,dispose(){dead=true;apply=null;q.bodyPoseKernel?.dispose();q.torsoSurface?.dispose();for(const kernel of q.transportKernels?.values()||[])kernel.dispose();q.transportKernels?.clear();for(const o of garments.keys())disposeClothNormalGeometry(core,o.geometry);garments.clear();q.beforePose=[];handFrames=[];}};
}
