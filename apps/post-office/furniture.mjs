import {furnitureSeat} from '../fairy-garden/day/home-catalog.mjs?v=fg-dbb1a66fa5e524fe';

// Scene facts only: the same chair/bench definitions feed geometry and TA's
// shared furnitureSeat. The shop only adds an unobstructed walking approach.
export const SHOP_FLOOR=.08;
export const SHOP_CHAIR={id:'WindowStool',kind:'chair',x:3,z:-.6,w:.56,d:.6,seat:.45,color:'#899a7f'};
export const SHOP_BENCH={id:'Decor:bench',kind:'bench',x:2.7,z:-2.6,w:2.25,d:.65,seat:.45,color:'#769084'};
export const SHOP_CUSHIONS=[0,1].map(i=>({x:2.2+i*.9,y:.58,z:-2.58,w:.75,h:.09,d:.48,color:i?'#d4bd8b':'#bd906d'}));
function walkingSeat(piece,approach,offset){
 const seat={...furnitureSeat(piece,approach,offset),rise:piece.seat};
 return {...seat,seatX:seat.x,seatZ:seat.z,x:approach.x,z:approach.z};
}
export const windowSeat=()=>walkingSeat(SHOP_CHAIR,{x:3,z:.15});
export function visitorSeat(i,level=1){
 const slot=i%2,pad=level>slot+1?SHOP_CUSHIONS[slot]:null;
 const piece=pad?{...SHOP_BENCH,seat:pad.y+pad.h/2-SHOP_FLOOR,seatSurface:{z:pad.z-SHOP_BENCH.z,d:pad.d}}:SHOP_BENCH;
 return walkingSeat(piece,{x:2.7+(slot?.48:-.48),z:-1.7},{x:slot?.48:-.48});
}
