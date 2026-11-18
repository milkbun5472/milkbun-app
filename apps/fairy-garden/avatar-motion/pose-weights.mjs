
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
 function evaluate(data,f){
  if(f.length!==12||f.some(x=>!Number.isFinite(x)))throw Error('Invalid bone feature');
  const weights=new Array(data.rows.length).fill(0),projected=[];let distance=Infinity;
  for(const [a,b] of data.segments){
   const A=data.rows[a].feature,B=data.rows[b].feature;let length=0,dot=0;
   for(let k=0;k<12;k++){const v=B[k]-A[k];length+=v*v;dot+=(f[k]-A[k])*v}
   if(length<1e-16)throw Error('Degenerate pose segment');
   const t=Math.max(0,Math.min(1,dot/length));let error=0;
   for(let k=0;k<12;k++){const v=f[k]-A[k]-t*(B[k]-A[k]);error+=v*v}
   const d=Math.sqrt(error);distance=Math.min(distance,d);projected.push({a,b,t,d});
  }
  let angle=0;for(let k=0;k<12;k+=3)angle=Math.max(angle,Math.hypot(f[k],f[k+1],f[k+2]));
  const [start,full]=data.activationRange,[inner,outer]=data.supportRange;
  const activation=smooth((angle-start)/(full-start)),support=1-smooth((distance-inner)/(outer-inner));let total=0;
  if(activation*support>0){
   for(const p of projected){const w=distance<1e-10?(p.d<1e-10?1:0):Math.pow(distance/p.d,4);weights[p.a]+=w*(1-p.t);weights[p.b]+=w*p.t;total+=w}
   if(total<=0)throw Error('Invalid pose field normalization');
   for(let i=0;i<weights.length;i++)weights[i]*=activation*support/total;
  }
  return {feature:f,weights,distance,activation,support,inside:distance<=outer,fullySupported:distance<=inner};
 }
 
export {evaluate as evaluatePose};
