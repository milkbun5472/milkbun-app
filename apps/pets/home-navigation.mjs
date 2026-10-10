import {createNavigator,segmentIntersectsRect} from '../fairy-garden/navigation.mjs?v=fg-83edfa27f119ba5e';
import {floorHeight} from '../../art/pet-house/cat-motion.mjs?v=fg-83edfa27f119ba5e';
import {clearActorSegment} from './actor-spacing.mjs?v=fg-83edfa27f119ba5e';
// Authored furniture footprints in the existing room (Y-up world coordinates).
import {roomBounds,roomPoint} from './room-layout.mjs?v=fg-83edfa27f119ba5e';
export {HOME_PLACES,PET_STATIONS,petHomePlaces} from './room-layout.mjs?v=fg-83edfa27f119ba5e';

const oldObstacles=[{x:1.52,z:-1.76,w:2.56,d:1.27},{x:-1.89,z:-1.64,w:1.28,d:.98},{x:-2.51,z:-.25,w:.88,d:.82},{x:2.36,z:1.12,w:.87,d:1.08},{x:-2.45,z:1.75,w:.9,d:.65}];
const zones=['sofa','bed','tree','feeding','toys'];
const obstacles=oldObstacles.map((o,i)=>roomPoint('home',zones[i],o));
export function createHomeNavigation(size=1){
 const b=roomBounds('home');
 const pad=.16*size;
 const walkable=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>b.minX+pad&&x<b.maxX-pad&&z>b.minZ+pad&&z<b.maxZ-pad&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+pad&&Math.abs(z-o.z)<o.d/2+pad);
 const clear=(a,b,map,avoid=[])=>walkable(a.x,a.z)&&walkable(b.x,b.z)&&!obstacles.some(o=>segmentIntersectsRect(a,b,o,pad))&&clearActorSegment(a,b,avoid);
 const route=createNavigator({home:{radius:5}},walkable,clear);
 return {walkable,ground:floorHeight,path:(a,b,avoid=[])=>route(a,b,'home',avoid),restore:p=>walkable(p?.x,p?.z)?{x:p.x,z:p.z}:{x:-.28,z:.55}};
}
