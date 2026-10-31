import {homeSize} from './home-architecture.mjs?v=fg-bf2a8f69e3079bf5';
export const BASIN_USE={approach:.20,z:.30,y:1.01,tapY:1.20,bowlZ:.13};
// The wing starts outside every previously accepted furnishing footprint.
// Geometry, saved fixture defaults, collision and walking regions share it.
export function homeBathroom(room){const {w}=homeSize(room);return {edge:w/2,x:w/2+2.6,z:0,w:5.2,d:5.8,door:1.9};}
export function bathroomDefault(p,room){const b=homeBathroom(room);return {...p,x:b.edge+p.bathX,z:p.bathZ};}
export function homeFloorContains(room,a,inset=.2){
 const s=homeSize(room),b=homeBathroom(room);
 return [-1,1].every(x=>[-1,1].every(z=>{const px=a.x+x*a.w/2,pz=a.z+z*a.d/2;return Math.abs(px)<=s.w/2-inset&&Math.abs(pz)<=s.d/2-inset||px>=b.edge+inset&&px<=b.edge+b.w-inset&&Math.abs(pz)<=b.d/2-inset;}));
}
export function bathroomStructure(room){const b=homeBathroom(room),span=(b.d-b.door)/2;
 return [-1,1].map(side=>({id:'bathroom-divider-'+side,x:b.edge+.32,z:side*(b.door/2+span/2),w:.14,d:span,h:1.7,bathroom:true}));
}
export function bathroomRegions(room){const s=homeSize(room),b=homeBathroom(room);return [{polygon:[{x:-s.w/2,z:-s.d/2},{x:s.w/2,z:-s.d/2},{x:s.w/2,z:-b.d/2},{x:s.w/2+b.w,z:-b.d/2},{x:s.w/2+b.w,z:b.d/2},{x:s.w/2,z:b.d/2},{x:s.w/2,z:s.d/2},{x:-s.w/2,z:s.d/2}]}];}
