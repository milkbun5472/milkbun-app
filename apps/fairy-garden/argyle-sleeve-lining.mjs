// Ordered welded boundaries of the two shoulder openings in the decoded
// argyle shirt. Reuse the seam vertices so the lining follows every fit.
const openings = [
  [5481, 5488, 5500, 5520, 7162, 7163, 7167, 7169, 6524, 6523, 6521, 6512, 6522, 6178, 6150, 6140, 6109, 6106, 6354, 6186, 6185, 6206, 6228, 6229, 6337, 6389, 7168, 7153, 7154, 8067, 7146, 7145, 7144, 7147, 7148, 7149, 7150, 7151, 7152, 7155, 8127, 7156, 7157, 7158, 8073, 7159, 7160, 7161, 7166, 7164, 7165, 8066, 5814, 5789, 5797, 5806, 5811, 5810, 5808, 5809, 5735, 5734, 5730, 5602, 5585, 5573, 5552, 5536, 5563, 5564],
  [184, 739, 716, 717, 4483, 4482, 4480, 4508, 4521, 4533, 4696, 4575, 4573, 4598, 6018, 6019, 6002, 6008, 6004, 6009, 6036, 6035, 6060, 6010, 6011, 6012, 6015, 6040, 6970, 6969, 6968, 6979, 6980, 6985, 6987, 6971, 6986, 7974, 6983, 6981, 6972, 7995, 7067, 7059, 7058, 7056, 6973, 6974, 6975, 6976, 6984, 6977, 6982, 6978, 6988, 4236, 4223, 4215, 4201, 4261, 4311, 4224, 4266, 4293, 4310, 4432, 412, 368, 342, 307, 272, 251, 465, 216, 409, 405],
];

// Float mode uses only the authored skeleton. Keep the sleeve opening
// attached to the vest and taper the arm influence towards the free cuff.
export function anchorArgyleSleeves(shirt){
 const {position,skinIndex,skinWeight}=shirt.geometry.attributes;
 const torso=shirt.skeleton.bones.findIndex(b=>b.name==='body');
 if(torso<0)return;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  if(Math.abs(x)<.07||y<.42)continue;
  const ring=openings.find(ids=>Math.sign(position.getX(ids[0]))===Math.sign(x));
  let distanceSq=Infinity;
  for(const j of ring){
   const dx=x-position.getX(j),dy=y-position.getY(j),dz=z-position.getZ(j);
   distanceSq=Math.min(distanceSq,dx*dx+dy*dy+dz*dz);
  }
  const t=Math.min(1,Math.sqrt(distanceSq)/.064);
  if(t===1)continue;
  const retain=t*t*(3-2*t);
  let bodySlot=-1,transferred=0;
  for(let k=0;k<4;k++){
   if(skinIndex.getComponent(i,k)===torso){bodySlot=k;break;}
   if(!skinWeight.getComponent(i,k))bodySlot=k;
  }
  if(bodySlot<0)continue;
  for(let k=0;k<4;k++){
   if(k===bodySlot)continue;
   const weight=skinWeight.getComponent(i,k);
   transferred+=weight*(1-retain);
   skinWeight.setComponent(i,k,weight*retain);
  }
  skinIndex.setComponent(i,bodySlot,torso);
  skinWeight.setComponent(i,bodySlot,skinWeight.getComponent(i,bodySlot)+transferred);
 }
 skinIndex.needsUpdate=true;skinWeight.needsUpdate=true;
}

// Round the shirt over its open shoulder edge toward the vest insert.
export function lineArgyleSleeves(T, shirt, knitMaterial) {
 const raw = shirt.geometry.attributes.position;
 const positions = [], textures = [], indices = [], sleeves = [];
 for (const ring of openings) {
  const sign = Math.sign(raw.getX(ring[0]));
  let tip = ring[0];
  for (let i=0;i<raw.count;i++) {
   if (sign*raw.getX(i)>sign*raw.getX(tip)) tip=i;
  }
  const start = positions.length/3;
  for (let j=0;j<ring.length;j++) {
   const id=ring[j], a=start+j*3, b=start+((j+1)%ring.length)*3;
   const u=.080+raw.getZ(id)*.22, v=.030+(raw.getY(id)-.60)*.09;
   positions.push(0,0,0,0,0,0,0,0,0);
   textures.push(u,v,u,v+.004,u,v+.009);
   indices.push(a,b,a+1,b,b+1,a+1,a+1,b+1,a+2,b+1,b+2,a+2);
  }
  const end=positions.length/3;
  positions.push(0,0,0);
  textures.push(.080,.041);
  for(let j=0;j<ring.length;j++) indices.push(start+j*3+2,start+((j+1)%ring.length)*3+2,end);
  sleeves.push({ring,tip,start,end});
 }
 const geometry = new T.BufferGeometry();
 const position = new T.Float32BufferAttribute(positions,3);
 geometry.setAttribute('position',position);
 geometry.setAttribute('uv',new T.Float32BufferAttribute(textures,2));
 geometry.setIndex(indices);
 shirt.material.side=T.DoubleSide;
 knitMaterial.side=T.DoubleSide;
 const lining = new T.Mesh(geometry,knitMaterial);
 lining.name='Argyle inner sleeve lining';
 lining.frustumCulled=false;
 shirt.add(lining);
 const point=new T.Vector3(), center=new T.Vector3(), axis=new T.Vector3();
 const normal=new T.Vector3(), previous=new T.Vector3(), next=new T.Vector3();
 return () => {
  for(const {ring,tip,start,end} of sleeves) {
   center.set(0,0,0);
   for(let j=0;j<ring.length;j++) {
    shirt.getVertexPosition(ring[j],point);
    center.add(point);
    position.setXYZ(start+3*j,point.x,point.y,point.z);
   }
   center.divideScalar(ring.length);
   axis.copy(center).sub(shirt.getVertexPosition(tip,point)).clampLength(0,.095);
   normal.set(0,0,0);
   for(let j=0;j<ring.length;j++) {
    previous.fromBufferAttribute(position,start+3*j).sub(center);
    next.fromBufferAttribute(position,start+3*((j+1)%ring.length)).sub(center);
    normal.add(previous.cross(next));
   }
   normal.normalize();
   if(normal.dot(axis)<0) normal.negate();
   // Ease raw-edge pleats into a single rounded cloth surface. Keep every
   // boundary point sewn to the posed sleeve while relaxing the inner rings.
   for(let j=0;j<ring.length;j++) {
    const i=start+3*j;
    point.fromBufferAttribute(position,i);
    previous.fromBufferAttribute(position,start+3*((j+ring.length-3)%ring.length));
    next.fromBufferAttribute(position,start+3*((j+3)%ring.length));
    point.multiplyScalar(.5).addScaledVector(previous,.25).addScaledVector(next,.25);
    point.sub(center);
    point.addScaledVector(normal,-.7*point.dot(normal)).multiplyScalar(.81)
     .add(center).addScaledVector(normal,.009);
    position.setXYZ(i+1,point.x,point.y,point.z);
    point.lerp(center,.48).addScaledVector(normal,.011);
    position.setXYZ(i+2,point.x,point.y,point.z);
   }
   point.copy(center).addScaledVector(normal,.018);
   position.setXYZ(end,point.x,point.y,point.z);
  }
  position.needsUpdate=true;
  geometry.computeVertexNormals();
 };
}
