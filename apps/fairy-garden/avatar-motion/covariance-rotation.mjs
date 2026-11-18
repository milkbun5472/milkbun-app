// Horn's unit-quaternion fit, with caller-owned reusable scratch storage.
// Both body rigid fits and local cloth rotations use this same solve.
export function createCovarianceRotation(){
 const A=new Float64Array(16),V=new Float64Array(16);
 return (S,out)=>{
  const [a,b,c,d,e,f,g,h,j]=S,tr=a+e+j;
  A.set([tr,f-h,g-c,b-d,f-h,a-e-j,b+d,c+g,g-c,b+d,-a+e-j,f+h,b-d,c+g,f+h,-a-e+j]);V.fill(0);for(let i=0;i<4;i++)V[i*4+i]=1;
  for(let iter=0;iter<64;iter++){
   let p=0,q=1,m=0;for(let i=0;i<4;i++)for(let k=i+1;k<4;k++)if(Math.abs(A[i*4+k])>m){m=Math.abs(A[i*4+k]);p=i;q=k;}
   if(m<1e-14)break;
   const t=.5*Math.atan2(2*A[p*4+q],A[q*4+q]-A[p*4+p]),c=Math.cos(t),s=Math.sin(t),pp=A[p*4+p],qq=A[q*4+q],pq=A[p*4+q];
   for(let k=0;k<4;k++)if(k!==p&&k!==q){const kp=A[k*4+p],kq=A[k*4+q];A[k*4+p]=A[p*4+k]=c*kp-s*kq;A[k*4+q]=A[q*4+k]=s*kp+c*kq;}
   A[p*4+p]=c*c*pp-2*c*s*pq+s*s*qq;A[q*4+q]=s*s*pp+2*c*s*pq+c*c*qq;A[p*4+q]=A[q*4+p]=0;
   for(let k=0;k<4;k++){const kp=V[k*4+p],kq=V[k*4+q];V[k*4+p]=c*kp-s*kq;V[k*4+q]=s*kp+c*kq;}
  }
  let k=0;for(let i=1;i<4;i++)if(A[i*4+i]>A[k*4+k])k=i;
  out[0]=V[4+k];out[1]=V[8+k];out[2]=V[12+k];out[3]=V[k];if(out[3]<0)for(let i=0;i<4;i++)out[i]*=-1;return out;
 };
}
