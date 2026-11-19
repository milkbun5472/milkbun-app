import {createCovarianceRotation} from './covariance-rotation.mjs?v=fg-3fcf8e2dc9520f24';
const rotation=createCovarianceRotation();
export function fitRigid(rest,posed,ids){
 const x=[0,0,0],y=[0,0,0];for(const i of ids)for(let k=0;k<3;k++){x[k]+=rest[i*3+k]/ids.length;y[k]+=posed[i*3+k]/ids.length;}
 const S=new Float64Array(9);for(const i of ids)for(let a=0;a<3;a++)for(let b=0;b<3;b++)S[a*3+b]+=(rest[i*3+a]-x[a])*(posed[i*3+b]-y[b]);
 return {quaternion:rotation(S,new Array(4)),restCenter:x,posedCenter:y};
}
