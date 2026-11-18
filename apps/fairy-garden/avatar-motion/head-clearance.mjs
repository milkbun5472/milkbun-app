
export function install(q){
 const T=q.T,o=q.body,g=o.geometry,R=q.dimensionRest,SI=g.attributes.skinIndex.array,SW=g.attributes.skinWeight.array,F=g.index.array;
 const names=o.skeleton.bones.map(b=>b.name),head=names.indexOf('neck');if(head<0)throw Error('Head bone missing');
 const H=new T.Matrix4(),HI=new T.Matrix4(),tmpM=new T.Matrix4(),v=new T.Vector3(),cp=new T.Vector3(),tri=new T.Triangle(),normals=new Float64Array(R.length),headFaces=[];
 const weight=(i,ids)=>{let w=0;for(let j=0;j<4;j++)if(ids.includes(SI[4*i+j]))w+=SW[4*i+j];return w};
 for(let j=0;j<F.length;j+=3){const ids=[F[j],F[j+1],F[j+2]];if(ids.every(i=>weight(i,[head])>.999)){const a=new T.Vector3().fromArray(R,ids[0]*3),b=new T.Vector3().fromArray(R,ids[1]*3),c=new T.Vector3().fromArray(R,ids[2]*3),n=b.clone().sub(a).cross(c.clone().sub(a));for(const i of ids){normals[i*3]+=n.x;normals[i*3+1]+=n.y;normals[i*3+2]+=n.z}headFaces.push({ids,a,b,c,box:new T.Box3().setFromPoints([a,b,c]),center:a.clone().add(b).add(c).multiplyScalar(1/3)})}}
 function build(rows){const box=new T.Box3();for(const r of rows)box.union(r.box);if(rows.length<=10)return {box,rows};const size=box.getSize(new T.Vector3()),axis=size.x>size.y?(size.x>size.z?'x':'z'):(size.y>size.z?'y':'z');rows.sort((a,b)=>a.center[axis]-b.center[axis]);const m=rows.length>>1;return {box,left:build(rows.slice(0,m)),right:build(rows.slice(m))}}
 const tree=build(headFaces),bary=new T.Vector3(),na=new T.Vector3(),nb=new T.Vector3(),nc=new T.Vector3();
 function nearest(point){let best=.018*.018,found=null;function visit(node){if(node.box.distanceToPoint(point)**2>best)return;if(node.rows){for(const r of node.rows){tri.set(r.a,r.b,r.c);tri.closestPointToPoint(point,cp);const d=cp.distanceToSquared(point);if(d<best){best=d;tri.getBarycoord(cp,bary);na.fromArray(normals,r.ids[0]*3).normalize();nb.fromArray(normals,r.ids[1]*3).normalize();nc.fromArray(normals,r.ids[2]*3).normalize();const n=na.clone().multiplyScalar(bary.x).addScaledVector(nb,bary.y).addScaledVector(nc,bary.z).normalize();found={n,d:point.clone().sub(cp).dot(n)}}}}else{const a=node.left.box.distanceToPoint(point),b=node.right.box.distanceToPoint(point);visit(a<b?node.left:node.right);visit(a<b?node.right:node.left)}}visit(tree);return found}
 const arms=['left','right'].map(side=>{const a=names.indexOf(side+'Arm'),f=names.indexOf(side+'Forearm'),bone=o.skeleton.bones[a],ids=[];const cells=new Set();for(let i=0;i<g.attributes.position.count;i++){if(weight(i,[a,f])<.95)continue;const key=[R[i*3],R[i*3+1],R[i*3+2]].map(x=>Math.round(x/.003)).join(',');if(!cells.has(key)){cells.add(key);ids.push(i)}}return {bone,base:bone.position.clone(),offset:new T.Vector3(),ids}});
 // Remove only our previous translation. Authored torso lean/IK owns the base.
 function reset(){for(const a of arms){a.bone.position.sub(a.offset);a.offset.set(0,0,0)}}
 const previous=q.applyLiveFair;let inside=false,lastKey=null,lastOffsets=null,lastCurrent=null;
 function place(shifts){for(let side=0;side<2;side++){const a=arms[side],worldDelta=shifts[side].clone().applyMatrix3(new T.Matrix3().setFromMatrix4(o.matrixWorld));tmpM.copy(a.bone.parent.matrixWorld).invert();a.offset.copy(worldDelta).applyMatrix3(new T.Matrix3().setFromMatrix4(tmpM));a.bone.position.copy(a.base).add(a.offset)}}const stats=q.armClearanceStats={calls:0,activeCalls:0,maxOffset:0,maxMs:0,probes:arms.map(a=>a.ids.length)};
 q.applyLiveFair=()=>{if(inside)return;inside=true;const started=performance.now();try{reset();for(const a of arms)a.base.copy(a.bone.position);q.applyPoseCurve();stats.calls++;const key=[...o.skeleton.boneMatrices,...o.morphTargetInfluences];if(lastKey&&key.every((x,i)=>Math.abs(x-lastKey[i])<1e-12)){place(lastOffsets);q.applyPoseCurve();previous();q.armClearanceCurrent=lastCurrent;q.poseCurveCurrent.armClearance=lastCurrent;stats.cacheHits=(stats.cacheHits||0)+1;return}previous();const shifts=arms.map(()=>new T.Vector3());let iterations=0,violations=0;
  for(let pass=0;pass<3;pass++){H.fromArray(o.skeleton.boneMatrices,head*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);HI.copy(H).invert();let moved=false;
   for(let side=0;side<2;side++){const a=arms[side],feature=q.poseCurveCurrent.feature;if(Math.hypot(...feature.slice(side*6,side*6+3))<.03)continue;const constraints=[];for(const i of a.ids){o.getVertexPosition(i,v);v.applyMatrix4(HI);const hit=nearest(v);if(!hit)continue;const x=.0015-hit.d,eps=.001,need=x>=eps?x:x<=-eps?0:(x+eps)*(x+eps)/(4*eps);if(need>1e-7)constraints.push({n:hit.n,d:need})}violations+=constraints.length;if(!constraints.length)continue;
    const delta=new T.Vector3();for(let k=0;k<8;k++)for(const c of constraints){const d=c.d-c.n.dot(delta);if(d>0)delta.addScaledVector(c.n,d)}if(delta.length()<1e-6)continue;
    // Vector (not point) from head rest coordinates into body local coordinates.
    delta.applyMatrix3(new T.Matrix3().setFromMatrix4(H));shifts[side].add(delta);if(shifts[side].length()>.016)shifts[side].setLength(.016);
    const worldDelta=shifts[side].clone().applyMatrix3(new T.Matrix3().setFromMatrix4(o.matrixWorld));tmpM.copy(a.bone.parent.matrixWorld).invert();a.offset.copy(worldDelta).applyMatrix3(new T.Matrix3().setFromMatrix4(tmpM));a.bone.position.copy(a.base).add(a.offset);moved=true;
   }
   if(!moved)break;iterations++;q.applyPoseCurve();previous();
  }
  const amounts=shifts.map(s=>s.length()),max=Math.max(...amounts);if(max>0)stats.activeCalls++;stats.maxOffset=Math.max(stats.maxOffset,max);stats.maxMs=Math.max(stats.maxMs,performance.now()-started);q.armClearanceCurrent={bodyOffsets:shifts.map(s=>s.toArray()),iterations,nearConstraints:violations};q.poseCurveCurrent.armClearance=q.armClearanceCurrent;lastKey=key;lastOffsets=shifts.map(s=>s.clone());lastCurrent=q.armClearanceCurrent;
 }finally{inside=false}};

 q.beforePose.push(reset);

}
