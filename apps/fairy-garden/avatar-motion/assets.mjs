const cache=new Map();
const types={B:[Uint8Array,1],H:[Uint16Array,2],I:[Uint32Array,4],i:[Int32Array,4],d:[Float64Array,8],f:[Float32Array,4]};
export function decodeMotion(bytes){
 const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(data.length<8||String.fromCharCode(...data.subarray(0,4))!=='LMOT')throw Error('Invalid motion data');
 const size=new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(4,true),start=8+size;
 if(start>data.length)throw Error('Truncated motion metadata');
 const meta=JSON.parse(new TextDecoder().decode(data.subarray(8,start)));
 const typedKeys=new Set(['position','normal','uv','repairSkin','positionDelta','normalDelta','ptr','col','value','permR','permC','diagonal']);
 function decode(x,key=''){
  if(Array.isArray(x))return x.map(v=>decode(v,key));
  if(x&&typeof x==='object'){
   if(Object.hasOwn(x,'$array')){
    const [code,offset,count]=x.$array,type=types[code];
    if(!type||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(count)||count<0||start+offset+count*type[1]>data.length)throw Error('Invalid motion array');
    const [Type,width]=type,raw=new Uint8Array(count*width);
    for(let j=0;j<width;j++)for(let i=0;i<count;i++)raw[i*width+j]=data[start+offset+j*count+i];
    // Keep ordinary array semantics for nested maps/flatMaps in geometry setup.
    const values=new Type(raw.buffer);return typedKeys.has(key)?values:Array.from(values);
   }
   return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v,k)]));
  }
  return x;
 }
 return decode(meta);
}
export async function loadMotionAsset(id){
 if(!/^(body|linen|heritage|bamboo|argyle|cardigan|ranger|garden|jacket|suit|tee|academy|berry)$/.test(id))throw Error('Unknown motion asset');
 if(!cache.has(id))cache.set(id,(async()=>{
  const url=new URL('./data/'+id+'.bin.gz'+new URL(import.meta.url).search,import.meta.url),response=await fetch(url);
  if(!response.ok)throw Error('Motion data request failed: '+response.status);
  let bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes[0]===31&&bytes[1]===139)bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return decodeMotion(bytes);
 })().catch(e=>{cache.delete(id);throw e}));
 return cache.get(id);
}
