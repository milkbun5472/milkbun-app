export function createNumericCore(bytes){const instance=new WebAssembly.Instance(new WebAssembly.Module(bytes),{}),memory=instance.exports.memory,cache=new WeakMap();let end=1024;const free=[],memoryListeners=new Set();
function reserve(bytes){bytes=Math.ceil(bytes/8)*8;const available=free.findIndex(r=>r.size>=bytes);if(available>=0){const row=free[available],start=row.start;row.start+=bytes;row.size-=bytes;if(!row.size)free.splice(available,1);return start}const start=(end+7)&~7;end=start+bytes;if(end>memory.buffer.byteLength){memory.grow(Math.ceil((end-memory.buffer.byteLength)/65536));for(const notify of memoryListeners)notify();}return start}
function release(start,bytes){const size=Math.ceil(bytes/8)*8;if(start<1024||start+size>end||start%8)throw Error('Invalid numeric allocation');free.push({start,size});free.sort((a,b)=>a.start-b.start);for(let i=free.length-1;i>0;i--){const a=free[i-1],b=free[i];if(a.start+a.size>b.start)throw Error('Numeric allocation released twice');if(a.start+a.size===b.start){a.size+=b.size;free.splice(i,1)}}}
function store(Type,values){const ptr=reserve(values.length*Type.BYTES_PER_ELEMENT);new Type(memory.buffer,ptr,values.length).set(values);return ptr}
function sparse(a,n,triangular){if(a.ptr.length!==n+1||a.col.length!==a.value.length||a.ptr[n]!==a.col.length)throw Error('Invalid CSR');for(let i=0;i<n;i++){let diagonal=false;if(a.ptr[i]>a.ptr[i+1])throw Error('CSR pointers unordered');for(let j=a.ptr[i];j<a.ptr[i+1];j++){const c=a.col[j],v=a.value[j];if(!Number.isInteger(c)||c<0||!Number.isFinite(v)||triangular&&(c>=n||(triangular<0?c>i:c<i)))throw Error('Invalid CSR entry');if(c===i&&v!==0)diagonal=true}if(triangular&&!diagonal)throw Error('Singular triangular factor')}return [store(Int32Array,a.ptr),store(Int32Array,a.col),store(Float64Array,a.value)]}
function make(data){let prepared=cache.get(data);if(prepared)return prepared;
 const n=data.permR.length;for(const p of [data.permR,data.permC])if(p.length!==n||new Set(p).size!==n||p.some(x=>!Number.isInteger(x)||x<0||x>=n))throw Error('Invalid permutation');
 let inputs=0;for(const c of data.rhs.col)inputs=Math.max(inputs,c+1);
 const R=sparse(data.rhs,n,0),L=sparse(data.L,n,-1),pr=store(Int32Array,data.permR);let run,args;
 if(data.symmetricFactor){
  if(data.diagonal.length!==n||data.diagonal.some(v=>!Number.isFinite(v)||v<=0)||data.permR.some((v,i)=>v!==data.permC[i]))throw Error('Invalid symmetric factor');
  for(let i=0;i<n;i++)for(let j=data.L.ptr[i];j<data.L.ptr[i+1];j++)if(data.L.col[j]===i&&data.L.value[j]!==1)throw Error('Symmetric factor is not unit triangular');
  args=[n,...R,...L,pr,store(Float64Array,data.diagonal)];run=instance.exports.solveSymmetric;
 }else {const U=sparse(data.U,n,1),pc=store(Int32Array,data.permC);args=[n,...R,...L,...U,pr,pc];run=instance.exports.solve;}
 const q=reserve(inputs*24),work=reserve(n*24),out=reserve(n*24),answer=new Float64Array(n*3);
 // Calls are synchronous; shared factor/scratch storage never escapes solve.
 prepared={solve(Q){if(Q.length<inputs*3)throw Error('Sparse input too short');new Float64Array(memory.buffer,q,inputs*3).set(Q.subarray?Q.subarray(0,inputs*3):Q.slice(0,inputs*3));run(...args,q,work,out);answer.set(new Float64Array(memory.buffer,out,n*3));return answer;}};cache.set(data,prepared);return prepared;
}
const flows=new Map();
function makeJointFlow(count){
 if(flows.has(count))return flows.get(count);
 if(!Number.isSafeInteger(count)||count<1)throw Error('Invalid joint-flow point count');
 const input=reserve(count*24),planes=reserve(33*24),output=reserve(count*24),answer=new Float64Array(count*3);
 const apply=(points,directions,rotation,width)=>{if(points.length!==count*3||directions.length!==99||rotation.length!==3||!Number.isFinite(width)||width<=0)throw Error('Invalid joint-flow input');new Float64Array(memory.buffer,input,count*3).set(points);new Float64Array(memory.buffer,planes,99).set(directions);instance.exports.jointFlow(count,input,planes,...rotation,width,output);answer.set(new Float64Array(memory.buffer,output,count*3));return answer;};flows.set(count,apply);return apply;
}

return {onMemoryGrow(fn){memoryListeners.add(fn);return ()=>memoryListeners.delete(fn)},make,makeJointFlow,reserve,release,store,memory,exports:instance.exports,allocatedBytes:()=>end};}
