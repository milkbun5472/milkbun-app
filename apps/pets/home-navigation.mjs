import {createNavigator,segmentIntersectsRect} from '../fairy-garden/navigation.mjs?v=fg-f9b5eaf0e166eac2';
import {floorHeight} from '../../art/pet-house/cat-motion.mjs?v=fg-f9b5eaf0e166eac2';
// Authored furniture footprints in the existing room (Y-up world coordinates).
export const HOME_PLACES={feeding:{x:1.55,z:1.4,yaw:Math.PI/2},rug:{x:0,z:.55,yaw:0},bed:{x:-1.2,z:-.82,yaw:-2.3},sofa:{x:1.1,z:-.5,yaw:Math.PI},window:{x:-.55,z:-1.9,yaw:Math.PI}};
const obstacles=[{x:1.52,z:-1.76,w:2.56,d:1.27},{x:-1.89,z:-1.64,w:1.28,d:.98},{x:-2.51,z:-.25,w:.88,d:.82},{x:2.36,z:1.12,w:.87,d:1.08},{x:-2.45,z:1.75,w:.9,d:.65}];
export function createHomeNavigation(size=1){
 const pad=.16*size;
 const walkable=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>-2.98+pad&&x<3.05-pad&&z>-2.48+pad&&z<2.55-pad&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+pad&&Math.abs(z-o.z)<o.d/2+pad);
 const clear=(a,b)=>walkable(a.x,a.z)&&walkable(b.x,b.z)&&!obstacles.some(o=>segmentIntersectsRect(a,b,o,pad));
 const route=createNavigator({home:{radius:3.3}},walkable,clear);
 return {walkable,ground:floorHeight,path:(a,b)=>route(a,b,'home'),restore:p=>walkable(p?.x,p?.z)?{x:p.x,z:p.z}:{x:-.28,z:.55}};
}
