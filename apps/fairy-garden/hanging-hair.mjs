const ROOT=-.65,BEND=.7;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const updates=new WeakMap();
export function updateHangingHair(mesh){updates.get(mesh)?.();}

// Hair above the jaw stays attached to the head. Below it, integrate a smooth
// turn from the head's downward direction to gravity, so tips hang instead of
// rotating out as one solid hat. This changes the actual vertices and normals:
// colour, shadow passes and photo readback all see the same shape.
export function makeHangingHair(T,model){
 const down=new T.Vector3(0,-1,0);
 const anchor=model.getObjectByName('HeadAnchor');
 if(!anchor)return {attach(){},update(){}};
 const hairs=[];
 function attach(mesh){
  if(mesh.userData.hairDrape)return;
  model.updateWorldMatrix(true,true);
  const toHead=anchor.matrixWorld.clone().invert().multiply(mesh.matrixWorld),toMesh=toHead.clone().invert(),normalHead=new T.Matrix3().getNormalMatrix(toHead),normalMesh=new T.Matrix3().setFromMatrix4(toHead).transpose();
  const source=mesh.geometry,position=source.attributes.position,normal=source.attributes.normal,points=[],cap=new T.Box3(),v=new T.Vector3();
  for(let i=0;i<position.count;i++){
   v.fromBufferAttribute(position,i).applyMatrix4(toHead);
   if(v.y<ROOT){const depth=ROOT-v.y,t=Math.min(1,depth/BEND),weight=smooth(t),fall=depth>=BEND?depth-BEND/2:BEND*(t*t*t-.5*t*t*t*t),n=new T.Vector3().fromBufferAttribute(normal,i).applyMatrix3(normalHead).normalize();points.push({i,p:v.clone(),n,fall,weight});}
   else cap.expandByPoint(v.clone().applyMatrix4(toMesh));
  }
  // Short cuts keep their authored silhouette; the tiny jaw edge is attached.
  if(!points.some(p=>p.p.y<-1.65))return;
  const geometry=source.clone(),pos=geometry.attributes.position,norm=geometry.attributes.normal;
  geometry.setAttribute('hairRest',position.clone());pos.setUsage(T.DynamicDrawUsage);norm.setUsage(T.DynamicDrawUsage);mesh.geometry=geometry;
  const restP=position.array.slice(),restN=normal.array.slice(),last=new T.Vector3(Infinity,0,0),gravity=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),q=new T.Quaternion();
  function update(){
   anchor.getWorldQuaternion(q);gravity.copy(down).applyQuaternion(q.invert());
   // A head lying on a pillow has support. Fade the hanging shape before the
   // head is horizontal rather than folding it through the bed or flattening it.
   const support=smooth((-gravity.y-.06)/.22);gravity.lerp(down,1-support);
   if(gravity.distanceToSquared(last)<1e-10)return;
   last.copy(gravity);c.copy(gravity).sub(down);geometry.boundingBox=cap.clone();
   if(c.lengthSq()<1e-12){pos.array.set(restP);norm.array.set(restN);geometry.computeBoundingBox();}
   else for(const point of points){
    v.copy(point.p).addScaledVector(c,point.fall).applyMatrix4(toMesh);pos.setXYZ(point.i,v.x,v.y,v.z);geometry.boundingBox.expandByPoint(v);
    // Inverse transpose of the same bend Jacobian, including the root blend.
    const w=point.weight,dy=1-c.y*w;n.copy(point.n);n.y=(n.y+w*(c.x*n.x+c.z*n.z))/dy;n.applyMatrix3(normalMesh).normalize();norm.setXYZ(point.i,n.x,n.y,n.z);
   }
   pos.needsUpdate=norm.needsUpdate=true;geometry.computeBoundingSphere();
  }
  const render=mesh.onBeforeRender,shadow=mesh.onBeforeShadow;
  mesh.onBeforeRender=function(...args){update();render?.apply(this,args);};
  mesh.onBeforeShadow=function(...args){update();shadow?.apply(this,args);};
  mesh.userData.hairDrape={root:ROOT,bend:BEND,vertices:points.length};
  updates.set(mesh,update);hairs.push(mesh);
 }
 return {attach,update(){for(const mesh of hairs)if(mesh.visible)updateHangingHair(mesh);}};
}
