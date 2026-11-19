// Fit only fabric distorted by the bend. The rest mesh supplies seam
// correspondence and edge lengths; the incoming pose supplies the arm path.
export function createSleeveEase(T,entries,cuffs=null){
 const reinforce=entries.some(({row})=>/^outfit_(heritage|bamboo|linen|berry)_/.test(row.name));
 const correctionLimit=reinforce ? .035 : .012;
 const nodes=[],byPoint=new Map(),edges=[],known=new Set(),pieces=[];
 const pointKey=(rest,i)=>[0,1,2].map(n=>Math.round(rest[i*3+n]*1e6)).join(',');
 for(const {row,o} of entries){
  if(!o.visible)continue;
  const rest=row.rest,local=new Map(),indices=o.geometry.index.array;
  const opposite=new Map();
  const nodeFor=i=>{
   if(local.has(i))return local.get(i);
   const key=pointKey(rest,i);
   let node=byPoint.get(key);
   if(node===undefined){node=nodes.length;byPoint.set(key,node);nodes.push({members:[],free:1,blend:1});}
   let arm=0;
   for(let j=4*i;j<4*i+4;j++)if([1,2,4,5].includes(row.skinIndex[j]))arm+=row.skinWeight[j];
   nodes[node].free=Math.min(nodes[node].free,Math.min(1,arm*2));
   if(cuffs){
    // Leave the wide opening and its separate piping on the fitted arm.
    const cuff=cuffs[Number(rest[3*i]>0)];
    let depth=0;
    for(let axis=0;axis<3;axis++)depth+=(cuff.center[axis]-rest[3*i+axis])*cuff.normal[axis];
    const t=Math.max(0,Math.min(1,(depth-.055)/.085));
    nodes[node].blend=Math.min(nodes[node].blend,t*t*(3-2*t));
   }
   nodes[node].members.push({i,piece:pieces.length});
   local.set(i,node);return node;
  };
  for(let t=0;row.followArms&&!row.linear&&t<indices.length;t+=3){
   const tri=[indices[t],indices[t+1],indices[t+2]];
   if(!tri.some(i=>rest[3*i+1]>.42&&[0,1,2,3].some(k=>[1,2,4,5].includes(row.skinIndex[i*4+k])&&row.skinWeight[i*4+k]>.1)))continue;
   const face=tri.map(nodeFor);
   for(let j=0;j<3;j++){
    const a=face[j],b=face[(j+1)%3];if(a===b)continue;
    const key=Math.min(a,b)+','+Math.max(a,b);
    // Adjacent triangles can hinge around an edge without changing any
    // of their three edge lengths. Preserve the fabric across that hinge.
    const tip=tri[(j+2)%3],other=opposite.get(key);
    if(reinforce&&other!==undefined&&local.get(other)!==local.get(tip)){
     const i=3*tip,k=3*other;
     const span=Math.hypot(rest[i]-rest[k],rest[i+1]-rest[k+1],rest[i+2]-rest[k+2]);
     if(span>.001)edges.push({a:local.get(other),b:local.get(tip),length:span});
    }else if(reinforce&&other===undefined)opposite.set(key,tip);
    if(known.has(key))continue;known.add(key);
    const x=3*tri[j],y=3*tri[(j+1)%3],length=Math.hypot(rest[x]-rest[y],rest[x+1]-rest[y+1],rest[x+2]-rest[y+2]);
    if(length>.0001)edges.push({a,b,length});
   }
  }
  pieces.push({o,p:new Float64Array(rest.length),local,rest});
 }
 // UV, material and normal seams may have a second vertex outside the
 // selected triangles. Move both copies, including matching trim edges.
 for(const [piece,{rest,local}] of pieces.entries())for(let i=0;i<rest.length/3;i++){
  if(local.has(i))continue;
  const node=byPoint.get(pointKey(rest,i));
  if(node!==undefined)nodes[node].members.push({piece,i});
 }
 const positions=new Float64Array(nodes.length*3),original=new Float64Array(positions.length),v=new T.Vector3(),delta=new T.Vector3(),skin=new T.Matrix3(),bone=new T.Matrix4();
 return amount=>{
  if(!amount)return;
  const frames=pieces.map(({o})=>{
   o.skeleton.update();
   return o.skeleton.bones.map((_,i)=>new T.Matrix3().setFromMatrix4(bone.fromArray(o.skeleton.boneMatrices,16*i).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix)));
  });
  for(let n=0;n<nodes.length;n++){
   const k=n*3,members=nodes[n].members;positions.fill(0,k,k+3);
   for(const {piece,i} of members){
    const {o,p}=pieces[piece];o.getVertexPosition(i,v).toArray(p,3*i);
    positions[k]+=v.x;positions[k+1]+=v.y;positions[k+2]+=v.z;
   }
   for(let j=0;j<3;j++)positions[k+j]/=members.length;
  }
  original.set(positions);
  for(let pass=0;pass<16;pass++)for(const {a,b,length} of edges){
   const x=a*3,y=b*3,dx=positions[y]-positions[x],dy=positions[y+1]-positions[x+1],dz=positions[y+2]-positions[x+2];
   const dist=Math.sqrt(dx*dx+dy*dy+dz*dz),max=length*1.45,min=length*.65;
   if(dist<1e-9||dist>=min&&dist<=max)continue;
   const wa=nodes[a].free,wb=nodes[b].free;if(!wa&&!wb)continue;
   const step=(dist-Math.max(min,Math.min(max,dist)))*.7/(dist*(wa+wb));
   positions[x]+=dx*step*wa;positions[x+1]+=dy*step*wa;positions[x+2]+=dz*step*wa;
   positions[y]-=dx*step*wb;positions[y+1]-=dy*step*wb;positions[y+2]-=dz*step*wb;
  }
  // Keep each material point close to the body-fitted pose. Long runs of
  // tiny triangles must not pull an entire elbow or shoulder away from it.
  for(let n=0;n<nodes.length;n++){
   const k=n*3;
   delta.fromArray(positions,k).sub(v.fromArray(original,k)).clampLength(0,correctionLimit);
   v.add(delta).toArray(positions,k);
  }
  for(let n=0;n<nodes.length;n++)for(const {piece,i} of nodes[n].members){
   const {o,p}=pieces[piece],g=o.geometry.attributes;
   delta.fromArray(positions,3*n).sub(v.fromArray(p,3*i)).multiplyScalar(amount*nodes[n].blend);
   if(delta.lengthSq()<1e-16)continue;
   skin.elements.fill(0);
   for(let j=0;j<4;j++){
    const w=g.skinWeight.getComponent(i,j);if(!w)continue;
    const e=frames[piece][g.skinIndex.getComponent(i,j)].elements;
    for(let k=0;k<9;k++)skin.elements[k]+=w*e[k];
   }
   if(Math.abs(skin.determinant())<1e-8)continue;
   delta.applyMatrix3(skin.invert()).add(v.fromBufferAttribute(g.position,i));
   g.position.setXYZ(i,delta.x,delta.y,delta.z);
  }
  for(const {o} of pieces)o.geometry.attributes.position.needsUpdate=true;
 };
}
