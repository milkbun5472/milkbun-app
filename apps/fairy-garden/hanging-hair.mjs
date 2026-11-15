const ROOT=-.65,BEND=.7,CLEAR_BEND=.45,MAX_CLEARANCE=.32;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const slope=x=>x>0&&x<1?6*x*(1-x):0;
const updates=new WeakMap();
export function updateHangingHair(mesh){updates.get(mesh)?.();}

// Intersection of a Z-directed line with a capsule, including its round ends.
// Keeping this exact avoids gaps between the elbow and upper-arm obstacles.
export function capsuleDepth(x,y,a,b,r){
 const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,A=ux*ux+uy*uy,px=x-a.x,py=y-a.y;
 if(A<1e-12){const h=r*r-px*px-py*py;if(h<=0)return null;const d=Math.sqrt(h);return [Math.min(a.z,b.z)-d,Math.max(a.z,b.z)+d];}
 const t0=(px*ux+py*uy)/A,perp=px*px+py*py-t0*t0*A,h=r*r-Math.max(0,perp);
 if(h<=0)return null;
 const span=Math.sqrt(h/A),lo=Math.max(0,t0-span),hi=Math.min(1,t0+span);if(lo>hi)return null;
 const shift=uz*Math.sqrt(h)/Math.sqrt(A*(A+uz*uz));
 const at=(t,sign)=>a.z+uz*t+sign*Math.sqrt(Math.max(0,h-A*(t-t0)**2));
 return [at(Math.max(lo,Math.min(hi,t0-shift)),-1),at(Math.max(lo,Math.min(hi,t0+shift)),1)];
}

// Gravity drape and arm clearance share one deformation, including accessories,
// shadow passes and photo readback. No source/cached geometry is changed.
export function makeHangingHair(T,model){
 const down=new T.Vector3(0,-1,0),anchor=model.getObjectByName('HeadAnchor');
 if(!anchor)return {attach(){},update(){},fitArms(){}};
 const hairs=[],styles=new Map(),arms=[];let fitVersion=0;
 const v=new T.Vector3(),tmp=new T.Vector3(),toModel=new T.Matrix4();
 function segmentDistance(p,a,b){tmp.copy(b).sub(a);const t=Math.max(0,Math.min(1,v.copy(p).sub(a).dot(tmp)/Math.max(1e-12,tmp.lengthSq())));return v.copy(a).addScaledVector(tmp,t).distanceTo(p);}
 // Called in the real bind frame whenever clothes/body dimensions change.
 // Measure the actual morphed sleeve and arm surface, rather than guessing a
 // radius from a hairstyle or maintaining separate per-outfit magic numbers.
 function fitArms(rig,meshes){
  arms.length=0;model.updateWorldMatrix(true,true);toModel.copy(model.matrixWorld).invert();
  for(const {p,label} of rig){if(!label.endsWith('Arm'))continue;
   const upper=p.userData.bone,lower=p.userData.forearm,hand=model.getObjectByName(label==='leftArm'?'Left_hand':'Right_hand');if(!upper||!lower||!hand)continue;
   const side=label.startsWith('left')?'left':'right',a=upper.getWorldPosition(new T.Vector3()).applyMatrix4(toModel),b=lower.getWorldPosition(new T.Vector3()).applyMatrix4(toModel),c=hand.getWorldPosition(new T.Vector3()).applyMatrix4(toModel);
   const arm={upper,lower,hand,skin:0,sleeves:[],restLift:Math.max((b.y-a.y)/b.distanceTo(a),(c.y-a.y)/c.distanceTo(a))};
   for(const mesh of meshes){const sleeve=mesh.userData.sleeveSide===side;if(!sleeve&&!mesh.userData.skinBase)continue;
    mesh.skeleton.update();let radius=0;const point=new T.Vector3(),weights=mesh.geometry.attributes.skinWeight,indices=mesh.geometry.attributes.skinIndex,bones=mesh.skeleton.bones;
    const frame=toModel.clone().multiply(mesh.matrixWorld);
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     if(!sleeve){let w=0;for(let k=0;k<4;k++){const bone=bones[indices.getComponent(i,k)];if(bone===upper||bone===lower)w+=weights.getComponent(i,k);}if(w<.7)continue;}
     mesh.getVertexPosition(i,point).applyMatrix4(frame);radius=Math.max(radius,Math.min(segmentDistance(point,a,b),segmentDistance(point,b,c)));
    }
    if(sleeve)arm.sleeves.push({mesh,radius});else arm.skin=Math.max(arm.skin,radius);
   }
   arms.push(arm);
  }
  fitVersion++;
 }
 const headInverse=new T.Matrix4(),modelInverse=new T.Matrix4(),worldScale=new T.Vector3(),headScale=new T.Vector3();
 function capsules(){
  if(!arms.length)return [];
  anchor.updateWorldMatrix(true,false);headInverse.copy(anchor.matrixWorld).invert();modelInverse.copy(model.matrixWorld).invert();
  model.getWorldScale(worldScale);anchor.getWorldScale(headScale);const scale=Math.max(worldScale.x,worldScale.y,worldScale.z)/Math.min(headScale.x,headScale.y,headScale.z),out=[];
  for(const arm of arms){
   const wa=arm.upper.getWorldPosition(new T.Vector3()),wb=arm.lower.getWorldPosition(new T.Vector3()),wc=arm.hand.getWorldPosition(new T.Vector3());
   const a=wa.clone().applyMatrix4(modelInverse),b=wb.clone().applyMatrix4(modelInverse),c=wc.clone().applyMatrix4(modelInverse);
   const elevation=Math.max((b.y-a.y)/Math.max(1e-6,b.distanceTo(a)),(c.y-a.y)/Math.max(1e-6,c.distanceTo(a)));
   // Start before the sleeve sweeps into a front strand; cap the response so
   // small counter-motions cannot stretch the root into a horizontal strip.
   const lift=smooth((elevation-arm.restLift-.005)/.06);
   if(lift<1e-5)continue;
   let radius=arm.skin;for(const sleeve of arm.sleeves)if(sleeve.mesh.visible)radius=Math.max(radius,sleeve.radius);
   radius=(radius+.008)*scale;wa.applyMatrix4(headInverse);wb.applyMatrix4(headInverse);wc.applyMatrix4(headInverse);
   out.push({a:wa,b:wb,r:radius,lift},{a:wb,b:wc,r:radius,lift});
  }
  return out;
 }
 function clearance(style,c,obstacles){
  const key=[fitVersion,c.x,c.y,c.z,...obstacles.flatMap(o=>[o.a.x,o.a.y,o.a.z,o.b.x,o.b.y,o.b.z,o.r,o.lift])].map(n=>n.toFixed(6)).join(',');
  if(style.key===key)return style.offsets;style.key=key;const offsets=[0,0];
  if(!obstacles.length){style.offsets=offsets;return offsets;}
  for(const {p,fall,clearWeight:weight} of style.probes){if(weight<.2)continue;
   const x=p.x+c.x*fall,y=p.y+c.y*fall,z=p.z+c.z*fall,index=p.x>=0?1:0;
   for(const o of obstacles){const span=capsuleDepth(x,y,o.a,o.b,o.r);if(!span)continue;
    const fade=.16,near=smooth((z-span[0]+fade)/fade)*smooth((span[1]-z+fade)/fade);
    const amount=(span[1]+.035-z)*near*o.lift/weight;
    offsets[index]=Math.max(offsets[index],Math.min(MAX_CLEARANCE,amount));
   }
  }
  style.offsets=offsets;return offsets;
 }
 function attach(mesh){
  if(mesh.userData.hairDrape)return;model.updateWorldMatrix(true,true);
  const toHead=anchor.matrixWorld.clone().invert().multiply(mesh.matrixWorld),toMesh=toHead.clone().invert(),normalHead=new T.Matrix3().getNormalMatrix(toHead),normalMesh=new T.Matrix3().setFromMatrix4(toHead).transpose();
  const support=mesh.userData.hairNapeSupport;
  const source=mesh.geometry,position=source.attributes.position,normal=source.attributes.normal,points=[],cap=new T.Box3(),v=new T.Vector3();
  for(let i=0;i<position.count;i++){
   v.fromBufferAttribute(position,i).applyMatrix4(toHead);
   if(v.y<ROOT){const depth=ROOT-v.y,t=Math.min(1,depth/BEND),weight=smooth(t),fall=depth>=BEND?depth-BEND/2:BEND*(t*t*t-.5*t*t*t*t),n=new T.Vector3().fromBufferAttribute(normal,i).applyMatrix3(normalHead).normalize();
    // The attachment zone comes from the asset, shared by hair and bands.
    // Blend its boundary in both depth and height, including the normal Jacobian.
    const freedom=(frontLimit,tip)=>{
     if(!support)return [1,0,0];
     const tz=(v.z-support.back)/(frontLimit-support.back),ty=(support.bottom-v.y)/(support.bottom-tip),front=smooth(tz),low=smooth(ty);
     return [1-(1-front)*(1-low),-(1-front)*slope(ty)/(support.bottom-tip),(1-low)*slope(tz)/(frontLimit-support.back)];
    };
    // Gravity uses a longer bend than arm clearance to avoid folding at a nod.
    const [free,freeY,freeZ]=freedom(support?.drapeFront??support?.front,support?.drapeTip??support?.tip);
    const [clearFree,clearFreeY,clearFreeZ]=freedom(support?.front,support?.tip);
    const clear=smooth(depth/CLEAR_BEND);
    points.push({i,p:v.clone(),n,fall:fall*free,fallY:-weight*free+fall*freeY,fallZ:fall*freeZ,clearWeight:clear*clearFree,clearY:-slope(depth/CLEAR_BEND)/CLEAR_BEND*clearFree+clear*clearFreeY,clearZ:clear*clearFreeZ});}
   else cap.expandByPoint(v.clone().applyMatrix4(toMesh));
  }
  if(!points.some(p=>p.p.y<-1.65))return;
  const id=mesh.userData.hair||mesh.name;let style=styles.get(id);if(!style){style={probes:[],key:null,offsets:[0,0]};styles.set(id,style);}
  // Keep each side together: the strand stays in front of the moving arm.
  // Probe every fourth actual surface vertex; enlarge the arm capsule above to
  // cover the tiny gaps. Both materials contribute and use the same solution.
  for(let i=0;i<points.length;i+=4)style.probes.push(points[i]);
  style.key=null;
  const geometry=source.clone(),pos=geometry.attributes.position,norm=geometry.attributes.normal;
  geometry.setAttribute('hairRest',position.clone());pos.setUsage(T.DynamicDrawUsage);norm.setUsage(T.DynamicDrawUsage);mesh.geometry=geometry;
  const restP=position.array.slice(),restN=normal.array.slice(),last=new T.Vector3(Infinity,0,0),gravity=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),q=new T.Quaternion();const deformationNormal=new T.Matrix3();let lastOffsets=[];
  function update(){
   anchor.getWorldQuaternion(q);gravity.copy(down).applyQuaternion(q.invert());
   const support=smooth((-gravity.y-.06)/.22);gravity.lerp(down,1-support);c.copy(gravity).sub(down);
   const offsets=clearance(style,c,capsules());
   if(gravity.distanceToSquared(last)<1e-10&&offsets.every((x,i)=>Math.abs(x-(lastOffsets[i]??Infinity))<1e-7))return;
   last.copy(gravity);lastOffsets=offsets.slice();geometry.boundingBox=cap.clone();
   if(c.lengthSq()<1e-12&&offsets.every(x=>x===0)){pos.array.set(restP);norm.array.set(restN);geometry.computeBoundingBox();}
   else for(const point of points){
    const p=point.p,u=(p.x+.25)/.5,sx=smooth(u);
    const left=offsets[0],right=offsets[1],amount=left*(1-sx)+right*sx;
    const fx=(right-left)*slope(u)/.5*point.clearWeight;
    const fy=amount*point.clearY,fz=amount*point.clearZ;
    v.copy(p).addScaledVector(c,point.fall);v.z+=amount*point.clearWeight;v.applyMatrix4(toMesh);pos.setXYZ(point.i,v.x,v.y,v.z);geometry.boundingBox.expandByPoint(v);
    const gy=point.fallY,gz=point.fallZ;
    deformationNormal.set(1,c.x*gy,c.x*gz,0,1+c.y*gy,c.y*gz,fx,c.z*gy+fy,1+c.z*gz+fz).invert().transpose();
    n.copy(point.n).applyMatrix3(deformationNormal).applyMatrix3(normalMesh).normalize();norm.setXYZ(point.i,n.x,n.y,n.z);
   }
   mesh.userData.hairClearance=offsets.slice();pos.needsUpdate=norm.needsUpdate=true;geometry.computeBoundingSphere();
  }
  const render=mesh.onBeforeRender,shadow=mesh.onBeforeShadow;mesh.onBeforeRender=function(...args){update();render?.apply(this,args);};mesh.onBeforeShadow=function(...args){update();shadow?.apply(this,args);};
  mesh.userData.hairDrape={root:ROOT,bend:BEND,vertices:points.length};updates.set(mesh,update);hairs.push(mesh);
 }
 return {attach,fitArms,update(){for(const mesh of hairs)if(mesh.visible)updateHangingHair(mesh);}};
}
