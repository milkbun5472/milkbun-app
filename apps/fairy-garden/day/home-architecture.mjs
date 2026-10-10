// Saved room size, wall attachment and visible shell use these same dimensions.
export const HOME_SIZES={
 compact:{label:'温馨小屋',w:14,d:11,detail:'原来的大小'},
 roomy:{label:'宽敞小家',w:18,d:14,detail:'多出约64%的布置空间'},
 loft:{label:'开阔大屋',w:22,d:17,detail:'多出约143%的布置空间'}
};
export const HOME_MOUNT_WALLS={back:'后墙',left:'左墙'};
export const HOME_BEDROOM_WALL={x:-3.8,w:6.25,h:4.15,base:.08};
export const HOME_LEFT_WALL={split:3.1,h:2.56,base:.08,low:.96};
export const HOME_WINDOW={x:3.3,w:4.5,h:2.95,base:1.08};
export const homeSize=room=>HOME_SIZES[room?.size]||HOME_SIZES.compact;
export function wallFurniturePosition(p,room){
 const {w,d}=homeSize(room),inset=.12+p.d/2;
 return p.wall==='left'?{x:-w/2+inset,z:p.along,y:p.y,heading:Math.PI/2}:{x:p.along,z:-d/2+inset,y:p.y,heading:0};
}
export function wallSpan(wall,room){const {w,d}=homeSize(room);return (wall==='left'?d:w)/2-.25;}
export function wallTop(wall,along){
 const left=HOME_LEFT_WALL,bed=HOME_BEDROOM_WALL,r=bed.w/2;
 if(wall==='left')return left.base+(along>left.split?left.low:left.h);
 // The original curved bedroom shoulder is retained when the room grows.
 if(along<bed.x+r&&along>=bed.x-r)return bed.base+bed.h-r+Math.sqrt(Math.max(0,r*r-(along-bed.x)**2));
 return along<bed.x-r?left.base+left.h:4.13;
}
export function furnitureHeight(p){
 if(p.height)return p.height+.08;
 if(p.catalogId==='canopy-bed')return 2.65;
 return {bed:1.7,sofa:1.25,chair:1.2,table:1.2,wardrobe:2.45,shelf:2.3,cabinet:1.4,kitchen:1.45,counter:1.3,light:2.1,plant:p.variant==='tall'?1.9:1,screen:2,decor:1.8}[p.kind]||1;
}
