// GLB skin weights are Float32: a fully weighted arm can sum to 1.00000003.
// Treat that rounding as the boundary, rather than cutting little holes in it.
export const FIT_EPSILON=1e-6;
export function clipFitPolygon(polygon,field,lerp){
 const out=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],fa=field(a),fb=field(b),insideA=fa>=-FIT_EPSILON,insideB=fb>=-FIT_EPSILON;
  if(insideA)out.push(a);
  if(insideA!==insideB)out.push(lerp(a,b,Math.max(0,Math.min(1,fa/(fa-fb)))));
 }
 return out;
}
