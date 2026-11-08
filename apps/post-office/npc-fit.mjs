// GLB skin weights are Float32: a fully weighted arm can sum to 1.00000003.
// Treat that rounding as the boundary, rather than cutting little holes in it.
export const FIT_EPSILON=1e-6;
export const CLOTH_WAIST=.45,CLOTH_HEM=.32;
export const clothFall=y=>Math.max(0,Math.min(1,(CLOTH_WAIST-y)/(CLOTH_WAIST-CLOTH_HEM)));
// Sample every layer at the same height, irrespective of its final length.
// Otherwise a short inner shirt can flare through a longer outer coat.
export function drapeFitVertex(v,y,{cx,cz}){
 const t=clothFall(y),x=v.p[0]-cx,z=v.p[2]-cz,r=Math.hypot(x,z)||1,radial=[x/r,0,z/r];
 return {p:[v.p[0]+radial[0]*.01*t,y,v.p[2]+radial[2]*.004*t],n:v.n.map((q,i)=>q+(radial[i]-q)*t),w:v.w};
}
export function clothLevels(minY){
 const levels=[CLOTH_WAIST,minY,CLOTH_HEM];
 for(let i=1;CLOTH_WAIST-i*.05>minY;i++)levels.push(CLOTH_WAIST-i*.05);
 return [...new Set(levels.filter(y=>y>=minY&&y<=CLOTH_WAIST))].sort((a,b)=>b-a);
}
export function clipFitPolygon(polygon,field,lerp){
 const out=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],fa=field(a),fb=field(b),insideA=fa>=-FIT_EPSILON,insideB=fb>=-FIT_EPSILON;
  if(insideA)out.push(a);
  if(insideA!==insideB)out.push(lerp(a,b,Math.max(0,Math.min(1,fa/(fa-fb)))));
 }
 return out;
}
