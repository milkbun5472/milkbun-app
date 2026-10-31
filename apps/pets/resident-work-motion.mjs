import {workroomFurniture} from './resident-workroom.mjs?v=fg-90b53e2779ab7a1c';
// Standing positions, facing and hand contact all refer to the rendered furniture.
export function professionalStation(form,stage=0){
 const furniture=workroomFurniture(form),f=furniture.find(x=>x.id===(form==='business'?'shop-counter':form==='clinic'&&stage===1?'exam':form==='studio'&&stage===1?'easel':form==='classroom'&&stage===1?'board':'desk'));
 const point=f.kind==='bed'?{x:f.x-f.w/2-.52,z:f.z}:{x:f.x,z:f.z+f.d/2+.52};
 const contact={x:f.x,y:f.h+.02,z:f.z+f.d/2-.12};
 if(f.kind==='easel'){point.z=f.z+.5;contact.x=f.x-.22;contact.y=f.h-.75;contact.z=f.z+.06;}
 if(form==='classroom'&&stage===1){point.x=f.x;point.z=f.z+.37;Object.assign(contact,{x:f.x-.28,y:f.y-.4,z:f.z+f.d/2+.015});}
 return {point,contact,heading:Math.atan2(contact.x-point.x,contact.z-point.z)};
}
export function residentWorkPose(c,stage,elapsed,position){
 if(c.form==='clinic'||c.form==='field'||c.role==='doctor'||c.role==='field'||c.place==='home'&&c.role==='artist')return {gesture:'rest',task:{kind:'clipboard',elapsed,supportHeight:0},nativeTool:true};
 if(c.place!=='workroom')return {};
 if(c.role==='teacher'&&stage!==1)return {gesture:'read',nativeTool:true};
 const s=professionalStation(c.form,stage);
 // A displaced worker can review the portable notes while the surface is busy.
 if(position&&Math.hypot(position.x-s.contact.x,position.z-s.contact.z)>1)return {gesture:'read',nativeTool:true};
 const board=c.form==='classroom'&&stage===1,painting=c.form==='studio',kind=board||painting?'paint':c.form==='business'?'write':'type';
 return {gesture:'rest',nativeTool:true,task:{kind,elapsed,workSurface:true,supportHeight:0,tool:board?'chalk':undefined,contact:s.contact,target:{...s.contact,y:s.contact.y+(board||painting&&stage===1?.10:.20),z:s.contact.z+(board?.10:painting&&stage===1?.12:0)}}};
}
