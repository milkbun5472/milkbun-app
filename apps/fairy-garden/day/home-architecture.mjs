// Saved room size, wall attachment and visible shell use these same dimensions.
export const HOME_SIZES={
 compact:{label:'温馨小屋',w:14,d:11,detail:'原来的大小'},
 roomy:{label:'宽敞小家',w:18,d:14,detail:'多出约64%的布置空间'},
 loft:{label:'开阔大屋',w:22,d:17,detail:'多出约143%的布置空间'}
};
export const HOME_MOUNT_WALLS={back:'后墙',left:'左墙'};
export const HOME_WINDOW={x:3.3,w:4.5,h:2.95,base:1.08};
export const homeSize=room=>HOME_SIZES[room?.size]||HOME_SIZES.compact;
export function wallFurniturePosition(p,room){
 const {w,d}=homeSize(room),inset=.12+p.d/2;
 return p.wall==='left'?{x:-w/2+inset,z:p.along,y:p.y,heading:Math.PI/2}:{x:p.along,z:-d/2+inset,y:p.y,heading:0};
}
export function wallSpan(wall,room){const {w,d}=homeSize(room);return (wall==='left'?d:w)/2-.25;}
export function wallTop(wall,along){
 if(wall==='left')return along>3.1?1.04:2.64;
 // The original curved bedroom shoulder is retained when the room grows.
 if(along<-.675&&along>=-6.925)return 1.105+Math.sqrt(Math.max(0,3.125**2-(along+3.8)**2));
 return along<-6.925?2.64:4.13;
}
export function furnitureHeight(p){
 if(p.height)return p.height+.08;
 if(p.catalogId==='canopy-bed')return 2.65;
 return {bed:1.7,sofa:1.25,chair:1.2,table:1.2,wardrobe:2.45,shelf:2.3,cabinet:1.4,kitchen:1.45,counter:1.3,light:2.1,plant:p.variant==='tall'?1.9:1,screen:2,decor:1.8}[p.kind]||1;
}
