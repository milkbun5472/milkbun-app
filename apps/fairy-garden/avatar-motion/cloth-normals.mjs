import {Matrix4} from 'three';
const kernelCache=new WeakMap();
export function disposeClothNormalGeometry(core,geometry){const cache=kernelCache.get(core),state=cache?.get(geometry);if(!state)return;for(const [ptr,bytes]of state.allocations)core.release(ptr,bytes);cache.delete(geometry);}

// Reuse buffers and direct attribute access. The output is the same posed-face
// normal blend as the authoring preview, including UV-seam welding and morphs.
export function createClothNormalUpdater(mesh,mask,weld,groupCount,core=null){
 const geometry=mesh.geometry,count=geometry.attributes.position.count;
 const values=a=>{if(!a)return null;if(!a.normalized&&!a.isInterleavedBufferAttribute)return a.array;const out=new Float64Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)out[i*a.itemSize+k]=a.getComponent(i,k);return out;};
 const morphPositions=geometry.morphAttributes.position?.map(values)||[],morphNormals=geometry.morphAttributes.normal?.map(values)||[];
 const bones=mesh.skeleton.bones.map(()=>new Matrix4()),exactBones=mesh.skeleton.bones.map(()=>new Matrix4());
 const indices=new Uint32Array(count*4),weights=new Float64Array(count*4),faces=geometry.index.array;
 for(let i=0;i<count;i++)for(let k=0;k<4;k++){indices[i*4+k]=geometry.attributes.skinIndex.getComponent(i,k);weights[i*4+k]=geometry.attributes.skinWeight.getComponent(i,k);}
 if(core){
  let cache=kernelCache.get(core);if(!cache){cache=new WeakMap();kernelCache.set(core,cache)}
  const morphCount=Math.max(morphPositions.length,morphNormals.length);let state=cache.get(geometry);
  if(!state){
   const allocations=[],reserve=bytes=>{const ptr=core.reserve(bytes);allocations.push([ptr,bytes]);return ptr},store=(Type,values)=>{const ptr=reserve(values.length*Type.BYTES_PER_ELEMENT);new Type(core.memory.buffer,ptr,values.length).set(values);return ptr},alloc=n=>reserve(n*8),write=(ptr,values)=>new Float64Array(core.memory.buffer,ptr,values.length).set(values),flatten=rows=>{const values=new Float64Array(morphCount*count*3);rows.forEach((row,k)=>{if(row)values.set(row,k*count*3)});return store(Float64Array,values)};
   state={pos:alloc(count*3),normal:alloc(count*3),mp:flatten(morphPositions),mn:flatten(morphNormals),mw:alloc(morphCount),si:store(Int32Array,indices),sw:store(Float64Array,weights),bones:alloc(bones.length*16),exact:alloc(bones.length*16),bind:alloc(16),unbind:alloc(16),faces:store(Int32Array,faces),weld:store(Int32Array,weld),mask:alloc(count),posed:alloc(count*3),skin:alloc(count*12),normals:alloc(count*3),joined:alloc(count*3),write,allocations};cache.set(geometry,state);
  }
  const r=state;new Int32Array(core.memory.buffer,r.weld,weld.length).set(weld);r.write(r.mask,mask);
  return activation=>{if(!activation)return;mesh.skeleton.update();r.write(r.pos,geometry.attributes.position.array);r.write(r.normal,geometry.attributes.normal.array);r.write(r.mw,mesh.morphTargetInfluences||[]);r.write(r.bind,mesh.bindMatrix.elements);r.write(r.unbind,mesh.bindMatrixInverse.elements);
   for(let k=0;k<bones.length;k++){bones[k].fromArray(mesh.skeleton.boneMatrices,k*16).premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);exactBones[k].multiplyMatrices(mesh.skeleton.bones[k].matrixWorld,mesh.skeleton.boneInverses[k]);r.write(r.bones+k*128,bones[k].elements);r.write(r.exact+k*128,exactBones[k].elements);}
   core.exports.clothNormals(count,faces.length,groupCount,morphCount,r.pos,r.normal,r.mp,r.mn,r.mw,r.si,r.sw,r.bones,r.exact,r.bind,r.unbind,r.faces,r.weld,r.mask,activation,r.posed,r.skin,r.normals,r.joined);
   geometry.attributes.normal.array.set(new Float64Array(core.memory.buffer,r.normal,count*3));geometry.attributes.normal.needsUpdate=true;
  };
 }
 const posed=new Float64Array(count*3),normals=new Float64Array(count*3),joined=new Float64Array(groupCount*3),skin=new Float64Array(count*12);
 return function update(activation){
  if(!activation)return;
  const position=geometry.attributes.position.array,normal=geometry.attributes.normal.array,active=[];
  for(let k=0;k<(mesh.morphTargetInfluences?.length||0);k++){
   const weight=mesh.morphTargetInfluences[k];
   if(weight)active.push({weight,position:morphPositions[k],normal:morphNormals[k]});
  }
  mesh.skeleton.update();
  for(let k=0;k<bones.length;k++){bones[k].fromArray(mesh.skeleton.boneMatrices,k*16).premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);exactBones[k].multiplyMatrices(mesh.skeleton.bones[k].matrixWorld,mesh.skeleton.boneInverses[k]);}
  const bind=mesh.bindMatrix.elements,unbind=mesh.bindMatrixInverse.elements;
  for(let i=0;i<count;i++){
   const p=i*3,h=i*12;let dx=0,dy=0,dz=0;
   for(const row of active)if(row.position){dx+=row.weight*row.position[p];dy+=row.weight*row.position[p+1];dz+=row.weight*row.position[p+2];}
   const x=position[p]+dx,y=position[p+1]+dy,z=position[p+2]+dz,bw=1/(bind[3]*x+bind[7]*y+bind[11]*z+bind[15]),bx=(bind[0]*x+bind[4]*y+bind[8]*z+bind[12])*bw,by=(bind[1]*x+bind[5]*y+bind[9]*z+bind[13])*bw,bz=(bind[2]*x+bind[6]*y+bind[10]*z+bind[14])*bw;let px=0,py=0,pz=0;
   skin.fill(0,h,h+12);
   for(let k=0;k<4;k++){
    const w=weights[i*4+k];if(!w)continue;const m=bones[indices[i*4+k]].elements;
    const e=exactBones[indices[i*4+k]].elements,ew=1/(e[3]*bx+e[7]*by+e[11]*bz+e[15]);px+=(e[0]*bx+e[4]*by+e[8]*bz+e[12])*ew*w;py+=(e[1]*bx+e[5]*by+e[9]*bz+e[13])*ew*w;pz+=(e[2]*bx+e[6]*by+e[10]*bz+e[14])*ew*w;
    skin[h]+=w*m[0];skin[h+1]+=w*m[1];skin[h+2]+=w*m[2];skin[h+3]+=w*m[4];skin[h+4]+=w*m[5];skin[h+5]+=w*m[6];skin[h+6]+=w*m[8];skin[h+7]+=w*m[9];skin[h+8]+=w*m[10];skin[h+9]+=w*m[12];skin[h+10]+=w*m[13];skin[h+11]+=w*m[14];
   }
   const uw=1/(unbind[3]*px+unbind[7]*py+unbind[11]*pz+unbind[15]);posed[p]=(unbind[0]*px+unbind[4]*py+unbind[8]*pz+unbind[12])*uw;posed[p+1]=(unbind[1]*px+unbind[5]*py+unbind[9]*pz+unbind[13])*uw;posed[p+2]=(unbind[2]*px+unbind[6]*py+unbind[10]*pz+unbind[14])*uw;
  }
  normals.fill(0);joined.fill(0);
  for(let k=0;k<faces.length;k+=3){
   const a=faces[k]*3,b=faces[k+1]*3,c=faces[k+2]*3;
   const ux=posed[b]-posed[a],uy=posed[b+1]-posed[a+1],uz=posed[b+2]-posed[a+2],vx=posed[c]-posed[a],vy=posed[c+1]-posed[a+1],vz=posed[c+2]-posed[a+2];
   const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
   normals[a]+=nx;normals[a+1]+=ny;normals[a+2]+=nz;normals[b]+=nx;normals[b+1]+=ny;normals[b+2]+=nz;normals[c]+=nx;normals[c+1]+=ny;normals[c+2]+=nz;
  }
  for(let i=0;i<count;i++){const j=weld[i]*3,p=i*3;joined[j]+=normals[p];joined[j+1]+=normals[p+1];joined[j+2]+=normals[p+2];}
  for(let i=0;i<count;i++){
   const blend=mask[i]*activation;if(!blend)continue;const h=i*12,p=i*3,j=weld[i]*3;
   const a=skin[h],b=skin[h+3],c=skin[h+6],d=skin[h+1],e=skin[h+4],f=skin[h+7],g=skin[h+2],h1=skin[h+5],k=skin[h+8];
   const A=e*k-f*h1,B=c*h1-b*k,C=b*f-c*e,D=f*g-d*k,E=a*k-c*g,F=c*d-a*f,G=d*h1-e*g,H=b*g-a*h1,I=a*e-b*d,det=a*A+b*D+c*G;
   let x=0,y=0,z=0;
   if(det!==0){x=(A*joined[j]+B*joined[j+1]+C*joined[j+2])/det;y=(D*joined[j]+E*joined[j+1]+F*joined[j+2])/det;z=(G*joined[j]+H*joined[j+1]+I*joined[j+2])/det;const length=Math.hypot(x,y,z)||1;x/=length;y/=length;z/=length;}
   for(const row of active)if(row.normal){x-=row.weight*row.normal[p];y-=row.weight*row.normal[p+1];z-=row.weight*row.normal[p+2];}
   normal[p]+=(x-normal[p])*blend;normal[p+1]+=(y-normal[p+1])*blend;normal[p+2]+=(z-normal[p+2])*blend;
  }
  geometry.attributes.normal.needsUpdate=true;
 };
}
