import {evaluatePose} from './pose-weights.mjs?v=fg-810d3c084a6e8474';
const attributesBySource=new WeakMap();
export function install(q){
 const T=q.T,o=q.body,g=o.geometry,data=q.poseCurveData;
 if(q.bodyCopies)throw Error('Pose curve requires the real SkinnedMesh');
 if(data.meshIndex.length!==g.index.count||data.meshIndex.some((v,i)=>v!==g.index.array[i]))throw Error('Curve topology mismatch');
 const rows=data.rows,names=o.skeleton.bones.map(b=>b.name),bi=names.indexOf('body');
 const pairs=['left','right'].flatMap(side=>[[bi,names.indexOf(side+'Arm')],[names.indexOf(side+'Arm'),names.indexOf(side+'Forearm')]]);
 const mats=names.map(()=>new T.Matrix4()),rel=new T.Matrix4(),quat=new T.Quaternion();
 q.poseAttributes??=attributesBySource.get(data);if(!q.poseAttributes){q.poseAttributes={position:rows.map(r=>new T.BufferAttribute(r.positionDelta instanceof Float32Array?r.positionDelta:new Float32Array(r.positionDelta),3)),normal:rows.map(r=>new T.BufferAttribute(r.normalDelta instanceof Float32Array?r.normalDelta:new Float32Array(r.normalDelta),3))};attributesBySource.set(data,q.poseAttributes)}g.morphAttributes.position=q.poseAttributes.position.slice();g.morphAttributes.normal=q.poseAttributes.normal.slice();g.morphTargetsRelative=true;o.updateMorphTargets();o.frustumCulled=false;
 const features=rows.map(r=>r.feature),stats=q.poseCurveStats={applied:0,outsideCurve:0,fadingSupport:0,maxFeatureError:0,maxWeightSum:0,totalMilliseconds:0,maxMilliseconds:0};
 function featuresNow(){
  q.doll.root.updateMatrixWorld(true);o.skeleton.update();
  for(let i=0;i<mats.length;i++)mats[i].fromArray(o.skeleton.boneMatrices,i*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);
  const f=[];
  for(const [parent,child]of pairs){rel.copy(mats[parent]).invert().multiply(mats[child]);quat.setFromRotationMatrix(rel).normalize();if(quat.w<0)quat.set(-quat.x,-quat.y,-quat.z,-quat.w);const r=Math.hypot(quat.x,quat.y,quat.z),angle=2*Math.atan2(r,quat.w),scale=r>1e-10?angle/r:2;f.push(quat.x*scale,quat.y*scale,quat.z*scale)}
  return f;
 }
 q.readMorphedNormal=(i,target)=>{const k=i*3,N=g.attributes.normal.array;let x=N[k],y=N[k+1],z=N[k+2];for(const row of q.activeNormalMorphs){const r=row.array,w=row.weight;x+=w*r[k];y+=w*r[k+1];z+=w*r[k+2]}return target.set(x,y,z)};
 q.applyPoseCurve=()=>{
  const start=performance.now(),current=evaluatePose(data,featuresNow());
  for(let i=0;i<current.weights.length;i++)o.morphTargetInfluences[i]=current.weights[i];
  q.activeNormalMorphs=[];for(let i=0;i<o.morphTargetInfluences.length;i++){const weight=o.morphTargetInfluences[i];if(weight)q.activeNormalMorphs.push({weight,array:g.morphAttributes.normal[i].array})}
  const sum=current.weights.reduce((a,b)=>a+b,0);if(!Number.isFinite(sum)||sum>1+1e-7)throw Error('Invalid pose field weights');
  if(!current.inside)stats.outsideCurve++;if(!current.fullySupported)stats.fadingSupport++;
  stats.applied++;stats.maxFeatureError=Math.max(stats.maxFeatureError,current.distance);stats.maxWeightSum=Math.max(stats.maxWeightSum,sum);
  const elapsed=performance.now()-start;stats.totalMilliseconds+=elapsed;stats.maxMilliseconds=Math.max(stats.maxMilliseconds,elapsed);q.poseCurveCurrent=current;
 };

}
