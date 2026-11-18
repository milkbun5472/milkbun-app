// One owned buffer set per avatar; it survives rest fitting and is released on dispose.
const sources=new WeakMap();
export function createBodyPoseKernel(core,geometry,boneCount,source=null){
 const n=geometry.attributes.position.count,morphs=geometry.morphAttributes.position,allocations=[];
 const reserve=bytes=>{const ptr=core.reserve(bytes);allocations.push([ptr,bytes]);return ptr},store=(Type,values)=>{const ptr=reserve(values.length*Type.BYTES_PER_ELEMENT);new Type(core.memory.buffer,ptr,values.length).set(values);return ptr};
 let cache=sources.get(core);if(!cache){cache=new WeakMap();sources.set(core,cache)}let immutable=source?cache.get(source):null;
 if(!immutable){const ownCount=allocations.length,mp=reserve(n*12*morphs.length),si=store(Int32Array,geometry.attributes.skinIndex.array),sw=store(Float64Array,geometry.attributes.skinWeight.array);for(let j=0;j<morphs.length;j++)new Float32Array(core.memory.buffer,mp+j*n*12,n*3).set(morphs[j].array);immutable={n,morphCount:morphs.length,boneCount,mp,si,sw,indices:new Uint16Array(geometry.attributes.skinIndex.array)};if(source){cache.set(source,immutable);allocations.splice(ownCount)}}
 if(immutable.n!==n||immutable.morphCount!==morphs.length||immutable.boneCount!==boneCount||immutable.indices.some((v,i)=>v!==geometry.attributes.skinIndex.array[i]))throw Error('Body kernel source binding differs');
 const {mp,si,sw}=immutable,src=reserve(n*12),mw=reserve(morphs.length*8),mats=reserve(boneCount*128),linear=reserve(n*72),inverse=reserve(n*72),translation=reserve(n*24),buffer=reserve(n*24);
 const views=()=>{const memory=core.memory.buffer;return {linear:new Float64Array(memory,linear,n*9),inverse:new Float64Array(memory,inverse,n*9),translation:new Float64Array(memory,translation,n*3),buffer:new Float64Array(memory,buffer,n*3)}};
 let refresh=null;const unsubscribe=core.onMemoryGrow(()=>refresh?.(views()));
 return {setViewCallback(fn){refresh=fn;fn(views());},apply(matrices,weights,same){
  const memory=core.memory.buffer;new Float32Array(memory,src,n*3).set(geometry.attributes.position.array);new Float64Array(memory,mw,morphs.length).set(weights);
  for(let j=0;j<matrices.length;j++)new Float64Array(memory,mats+j*128,16).set(matrices[j].elements);
  if(!core.exports.bodyPose(n,src,mp,mw,morphs.length,si,sw,mats,linear,inverse,translation,buffer,same))throw Error('Shared posed transform is singular');
  return views();
 },dispose(){unsubscribe();refresh=null;for(const [ptr,bytes]of allocations)core.release(ptr,bytes);allocations.length=0;}};
}
