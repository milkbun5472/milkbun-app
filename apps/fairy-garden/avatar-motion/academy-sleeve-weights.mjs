import {academySleeveSamples} from './academy-sleeve-samples.mjs?v=fg-0cb4be96109fd8f6';

export function bindAcademySleeve(q,entries,cuffs){
 const T=q.T,byPoint=new Map(),nodes=[],pieces=[];
 const lengths=q.rigFit.map((arm,i)=>Math.hypot(...arm.shoulder.map((s,k)=>s-cuffs[i].center[k])));
 for(const {row,o} of entries){
  if(!row.followArms||row.linear||!o.visible)continue;
  const rest=row.rest,local=new Int32Array(rest.length/3).fill(-1),piece=pieces.length;
  for(let i=0;i<local.length;i++){
   const p=Array.from(rest.slice(i*3,i*3+3)),side=Number(p[0]>0),plane=cuffs[side],delta=p.map((x,k)=>x-plane.center[k]);
   if(Math.abs(p[0])<.065||p[1]<plane.center[1]-.055||p[1]>q.rigFit[side].shoulder[1]+.10)continue;
   const key=p.map(x=>Math.round(x*1e6)).join(',');
   if(!byPoint.has(key)){byPoint.set(key,nodes.length);nodes.push({p,side,d:Infinity,edges:new Map(),members:[]});}
   const n=local[i]=byPoint.get(key),node=nodes[n];node.members.push([piece,i]);
   const depth=delta.reduce((v,x,k)=>v+x*plane.normal[k],0);
   let arm=0;for(let j=i*4;j<i*4+4;j++)if(row.skinIndex[j]===(side?5:2))arm=Math.max(arm,row.skinWeight[j]);
   if(arm>.65&&Math.abs(depth)<.014&&Math.hypot(...delta)<.10)node.d=Math.min(node.d,Math.max(0,-depth));
  }
  const idx=o.geometry.index.array;
  for(let k=0;k<idx.length;k++){
   const a=local[idx[k]],b=local[idx[k-k%3+(k+1)%3]];
   if(a<0||b<0||a===b||nodes[a].edges.has(b))continue;
   const len=Math.hypot(...nodes[a].p.map((p,j)=>p-nodes[b].p[j]));
   nodes[a].edges.set(b,len);nodes[b].edges.set(a,len);
  }
  pieces.push({o,transform:new T.Matrix4(),toBody:new T.Matrix4()});
 }
 // Distances follow the cut sleeve, including its inside wall. A vest panel
 // close in space to the cuff cannot inherit its motion across open air.
 const heap=[];
 const push=n=>{let j=heap.length;heap.push(n);while(j){const p=(j-1)>>1;if(heap[p][0]<=n[0])break;heap[j]=heap[p];j=p;}heap[j]=n;};
 nodes.forEach((v,i)=>{if(Number.isFinite(v.d))push([v.d,i]);});
 while(heap.length){
  const [d,i]=heap[0],last=heap.pop();
  if(heap.length){let j=0;while(j*2+1<heap.length){let c=j*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[j]=heap[c];j=c;}heap[j]=last;}
  if(d!==nodes[i].d||d>1.65*lengths[nodes[i].side])continue;
  for(const [j,len] of nodes[i].edges)if(d+len<nodes[j].d){nodes[j].d=d+len;push([d+len,j]);}
 }
 for(const node of nodes){
  const span=node.d/lengths[node.side];
  if(span>=1.65)continue;
  const shoulder=q.rigFit[node.side].shoulder,cuff=cuffs[node.side].center;
  const axis=cuff.map((v,j)=>(v-shoulder[j])/lengths[node.side]);
  const diff=node.p.map((v,j)=>v-shoulder[j]);
  const along=diff.reduce((sum,v,j)=>sum+v*axis[j],0);
  const radial=Math.hypot(...diff.map((v,j)=>v-along*axis[j]));
  const t=Math.min(1,Math.max(0,along/lengths[node.side]));
  const sign=node.side?1:-1;
  const sx=.11+(sign*node.p[0]-Math.abs(shoulder[0]))*.125788/(Math.abs(cuff[0])-Math.abs(shoulder[0]));
  const sy=.65+(node.p[1]-shoulder[1])*.172097/(shoulder[1]-cuff[1]);
  const sz=node.p[2]-(shoulder[2]+.011)*(1-t)-cuff[2]*t;
  let upper=0,fore=0,total=0;
  const closest=[0,0,0];
  for(const [x,y,z,u,f] of academySleeveSamples){
   const dist=(sx-x*.0001)**2+(sy-y*.0001)**2+(sz-z*.0001)**2;
   const w=1/(dist+.00008)**3;
   upper+=w*u;fore+=w*f;total+=w;
   closest[0]+=w*x;closest[1]+=w*y;closest[2]+=w*z;
  }
  upper/=1000*total;fore/=1000*total;
  const weight=[Math.max(0,1-upper-fore),upper,fore];
  const tube=Math.max(0,Math.min(1,(.111-radial)/.043));
  // Preserve the bodice below the armhole, including the robe belt.
  // A continuous sleeve and front panel can belong to the same mesh island.
  const inside=Math.max(0,Math.min(1,(Math.abs(node.p[0])-Math.abs(shoulder[0])+.004)/.036));
  const above=Math.max(0,Math.min(1,(node.p[1]-shoulder[1]+.095)/.05));
  const fade=Math.max(inside,above)*tube*Math.max(0,Math.min(1,(1.65-span)/.35));
  const template=node.p.slice();
  template[0]+=sign*(closest[0]*.0001/total-sx)*(Math.abs(cuff[0])-Math.abs(shoulder[0]))/.125788;
  template[1]+=(closest[1]*.0001/total-sy)*(shoulder[1]-cuff[1])/.172097;
  template[2]+=closest[2]*.0001/total-sz;
  node.reference={t,weight,template,fade:fade*fade*(3-2*fade)};
 }
 const active=nodes.filter(n=>n.reference);
 const work=new Set(active);
 // Sample a wider neighborhood along the same piece of fabric. Counting
 // immediate edges alone leaves circular creases on densely tessellated coats.
 for(const n of active){
  const seen=new Set([n]),queue=[[n,0]],near=[];
  for(let cursor=0;cursor<queue.length;cursor++){
   const [v,hop]=queue[cursor];if(hop===5)continue;
   for(const j of v.edges.keys()){
    const neighbor=nodes[j];if(seen.has(neighbor))continue;
    seen.add(neighbor);
    const dist=Math.hypot(...neighbor.p.map((x,k)=>x-n.p[k]));
    if(dist>.033)continue;
    queue.push([neighbor,hop+1]);
    if(hop===0||hop===2||hop===4)near.push([neighbor,dist]);
   }
  }
  n.near=near.length>18?Array.from({length:18},(_,j)=>near[Math.floor((j+.5)*near.length/18)]):near;
  for(const [neighbor] of n.near)work.add(neighbor);
 }
 for(const n of work){
  n.current=new T.Vector3();n.posed=new T.Vector3();
  if(!n.reference)continue;
  const neighbors=[],detail=new T.Vector3(...n.p),sum=new T.Vector3();let total=0;
  for(const [neighbor,length] of n.near){
   const w=1/Math.max(.006,length);neighbors.push([neighbor,w]);total+=w;
   const v=neighbor.p;sum.x+=w*v[0];sum.y+=w*v[1];sum.z+=w*v[2];
  }
  if(total){detail.addScaledVector(sum,-1/total);for(const pair of neighbors)pair[1]/=total;}
  Object.assign(n.reference,{neighbors,detail,rotated:new T.Vector3(),goal:new T.Vector3(),next:new T.Vector3()});
 }
 const p=new T.Vector3(),v=new T.Vector3(),matrix=new T.Matrix4(),skin=new T.Matrix3();
 const guides=cuffs.map((cuff,side)=>{
  const fit=q.rigFit[side],start=new T.Vector3(...fit.shoulder),end=new T.Vector3(...cuff.center);
  return {start,end,elbow:new T.Vector3(...fit.elbow),axis:end.clone().sub(start).normalize(),
   a:start.clone(),b:start.clone(),c:end.clone(),tangent:end.clone(),center:end.clone()};
 });
 const r=new T.Quaternion(),dq=new T.Quaternion(),dual=new T.Quaternion(),inv=new T.Quaternion(),base=new T.Vector3();
 return (amount,virtual)=>{
  if(!amount)return;
  const rotations=virtual.map(m=>new T.Quaternion().setFromRotationMatrix(m).normalize());
  const translations=virtual.map((m,i)=>new T.Quaternion(...m.elements.slice(12,15),0).multiply(rotations[i]));
  guides.forEach((g,side)=>{
   const upper=side?4:1,fore=upper+1;
   g.a.copy(g.start).applyMatrix4(virtual[upper]);
   g.b.copy(g.elbow).applyMatrix4(virtual[upper]).lerp(v.copy(g.elbow).applyMatrix4(virtual[fore]),.5);
   g.c.copy(g.end).applyMatrix4(virtual[fore]);
  });
  for(const piece of pieces){
   const {o,transform}=piece;
   transform.copy(o.matrixWorld).invert().multiply(q.body.matrixWorld);
   piece.toBody.copy(transform).invert();o.skeleton.update();
   piece.frames=o.skeleton.bones.map((_,i)=>new T.Matrix3().setFromMatrix4(matrix.fromArray(o.skeleton.boneMatrices,i*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix)));
  }
  for(const n of work){
   const [piece,i]=n.members[0];
   pieces[piece].o.getVertexPosition(i,n.current).applyMatrix4(pieces[piece].toBody);
   n.posed.copy(n.current);
   if(!n.reference)continue;
   const ref=n.reference,g=guides[n.side],t=ref.t,u=1-t;
   // Sweep each rest section around the posed arm. The wrist can turn
   // inside the cuff without rolling the whole upper sleeve with it.
   g.center.copy(g.a).multiplyScalar(u*u).addScaledVector(g.b,2*u*t).addScaledVector(g.c,t*t);
   // Anchor both interfaces to their already fitted surfaces. The bent
   // tube guides the intervening fabric without displacing the cuff rim.
   const root=Math.min(1,t/.35),end=Math.min(1,Math.max(0,n.d/lengths[n.side]/.36));
   const blend=root*root*(3-2*root)*end*end*(3-2*end)*ref.fade;
   const upper=n.side?4:1;
   dq.set(0,0,0,0);dual.set(0,0,0,0);
   for(let j=0;j<3;j++){
    const bone=j?upper+j-1:0,real=rotations[bone],d=translations[bone];
    const w=ref.weight[j]*(rotations[upper].dot(real)<0?-1:1);
    dq.x+=w*real.x;dq.y+=w*real.y;dq.z+=w*real.z;dq.w+=w*real.w;
    dual.x+=w*d.x;dual.y+=w*d.y;dual.z+=w*d.z;dual.w+=w*d.w;
   }
   const length=dq.length();dq.normalize();dual.multiply(inv.copy(dq).conjugate());
   const mid=Math.sin(Math.PI*t)**2;
   base.fromArray(n.p).lerp(p.fromArray(ref.template),.75*mid)
    .applyQuaternion(dq).add(p.set(dual.x/length,dual.y/length,dual.z/length));
   base.sub(n.current).clampLength(0,.045);
   n.posed.addScaledVector(base,ref.fade);
   // Use a common centre and orientation around each ring. Keep the
   // cuff and the shoulder seam anchored while the sleeve spans the elbow.
   const chord=g.tangent.copy(g.c).sub(g.a).normalize();
   r.setFromUnitVectors(g.axis,chord);
   const endRoll=Math.min(1,Math.max(0,(t-.45)/.55));
   r.slerp(rotations[upper+1],endRoll*endRoll*(3-2*endRoll));
   base.fromArray(n.p).sub(p.copy(g.start).lerp(g.end,t)).applyQuaternion(r);
   g.center.lerp(p.copy(g.a).lerp(g.c,t),.65);
   base.add(g.center).sub(n.posed).clampLength(0,.07);
   n.posed.addScaledVector(base,blend);
   r.copy(dq).slerp(inv.setFromUnitVectors(g.axis,chord),blend);
   ref.goal.copy(n.posed);ref.rotated.copy(ref.detail).applyQuaternion(r);
  }
  // Carry the original local folds through the bend. Shared seam vertices
  // have one goal; the neighboring bodice remains a boundary for the sleeve.
  for(let pass=0;pass<8;pass++){
   for(const n of active){
    const ref=n.reference;
    if(!ref.neighbors.length){ref.next.copy(ref.goal);continue;}
    ref.next.copy(ref.rotated);
    for(const [neighbor,w] of ref.neighbors)ref.next.addScaledVector(neighbor.posed,w);
    ref.next.lerp(ref.goal,1-.94*ref.fade);
   }
   for(const n of active)n.posed.copy(n.reference.next);
  }
  for(const n of active)for(const [piece,i] of n.members){
   const {o,frames,transform}=pieces[piece],g=o.geometry.attributes;
   o.getVertexPosition(i,p);
   v.copy(n.posed).applyMatrix4(transform).sub(p).multiplyScalar(amount);
   skin.elements.fill(0);
   for(let j=0;j<4;j++){
    const w=g.skinWeight.getComponent(i,j);if(!w)continue;
    const m=frames[g.skinIndex.getComponent(i,j)].elements;
    for(let k=0;k<9;k++)skin.elements[k]+=m[k]*w;
   }
   if(Math.abs(skin.determinant())<1e-8)continue;
   v.applyMatrix3(skin.invert()).add(p.fromBufferAttribute(g.position,i));
   g.position.setXYZ(i,v.x,v.y,v.z);
  }
  for(const {o} of pieces)o.geometry.attributes.position.needsUpdate=true;
 };
}
