// One catalogue supplies the editor, saved instances, geometry and activity anchors.
const item=(id,label,category,kind,w,d,extra={})=>({id,label,category,kind,w,d,...extra});
export const HOME_CATEGORIES={bed:'床',sofa:'沙发',dining:'桌椅',storage:'收纳',light:'灯具',plant:'绿植',kitchen:'厨房'};
export const HOME_CATALOG=[
 item('wood-bed','木框双人床','bed','bed',3,3.35),item('soft-bed','软包双人床','bed','bed',3,3.35,{variant:'soft'}),
 item('sofa','双人沙发','sofa','sofa',3.4,1),item('loveseat','小双人沙发','sofa','sofa',2.3,1.05,{variant:'soft'}),
 item('dining-table','长餐桌','dining','table',2.4,1.1,{dining:true}),item('round-table','圆餐桌','dining','table',1.4,1.4,{variant:'round',dining:true}),
 item('coffee-table','低茶几','dining','table',1.9,.75,{top:.56}),item('chair','软垫餐椅','dining','chair',.56,.57),item('wood-chair','木背餐椅','dining','chair',.56,.57,{variant:'slat'}),
 item('wardrobe','衣柜','storage','wardrobe',.8,2.1),item('bedside','床头柜','storage','cabinet',.65,.7),item('bookcase','书柜','storage','shelf',.75,1.65),
 item('dresser','矮斗柜','storage','cabinet',1.5,.65,{variant:'drawers'}),item('pantry','窄储物柜','storage','wardrobe',.75,1.15),
 item('floor-lamp','落地灯','light','light',.5,.5,{variant:'floor'}),item('table-lamp','矮台灯架','light','light',.55,.55,{variant:'short'}),
 item('plant','小盆栽','plant','plant',.5,.5),item('tall-plant','高绿植','plant','plant',.65,.65,{variant:'tall'}),
 item('kitchen','厨房台面','kitchen','kitchen',4.6,.8),item('bar','小料理台','kitchen','counter',2,.8,{variant:'home'})
];
export const HOME_MATERIALS={auto:'随小家',wood:'木纹',fabric:'织物',plain:'哑光',metal:'金属'};
export const HOME_COLORS=[{label:'奶油',color:'#e9dcc7'},{label:'浅木',color:'#cba77f'},{label:'深木',color:'#715749'},{label:'苔绿',color:'#8ca18b'},{label:'雾蓝',color:'#9fb9c6'},{label:'藕粉',color:'#cfa59b'}];
export const HOME_WALLS={auto:{label:'随小家'},cream:{label:'奶油墙',color:'#eee3d1'},sage:{label:'浅绿墙',color:'#d9e2d6'},rose:{label:'淡粉墙',color:'#eedad4'},stripe:{label:'细条墙纸',color:'#eee6d8',pattern:'stripe'},panel:{label:'木纹墙面',color:'#bc9d80',pattern:'panel'}};
export const HOME_FLOORS={auto:{label:'随小家'},warm:{label:'暖木地板',color:'#cfb79b',pattern:'wood'},light:{label:'浅木地板',color:'#ddd3bc',pattern:'wood'},dark:{label:'深木地板',color:'#977965',pattern:'wood'},tile:{label:'奶白瓷砖',color:'#e6dfd0',pattern:'tile'},sage:{label:'浅绿瓷砖',color:'#bdccbf',pattern:'tile'},stone:{label:'灰石地面',color:'#c7c6bb',pattern:'stone'}};
export const BASE_HOME=[
 ['double-bed','wood-bed',-4,-3,0,'双人床'],['wardrobe','wardrobe',-6.25,-2.7],['bedside','bedside',-2.05,-4.2],
 ['sofa','sofa',-3,1.4,0,'沙发'],['coffee-table','coffee-table',-3,3],['dining-table','dining-table',3,-.25],
 ['dining-chair','chair',3,.9,Math.PI,'餐椅'],['partner-chair','chair',3,-1.4,0,'另一把餐椅'],
 ['kitchen','kitchen',3.4,-4.65],['pantry','pantry',6.15,-3.1,0,'储物柜'],['home-plant','plant',6,3.8,0,'盆栽'],['bookcase','bookcase',-6.25,.7]
].map(([id,catalogId,x,z,heading=0,label])=>({...HOME_CATALOG.find(p=>p.id===catalogId),id,catalogId,x,z,heading,label:label||HOME_CATALOG.find(p=>p.id===catalogId).label}));
export const HOME_NAMES=Object.fromEntries(BASE_HOME.map(p=>[p.id,p.label]));
const hex=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)?x.toLowerCase():'';
export function furniturePrimary(p,palette){const field=['bed','sofa','chair','plant','light'].includes(p.kind)?'fabric':'wood';return {field,color:p.color||palette[field]};}
export const HOME_LIMIT=48;
export function homeRoom(raw){const q=raw?.$room||{};return {wall:Object.hasOwn(HOME_WALLS,q.wall)?q.wall:'auto',floor:Object.hasOwn(HOME_FLOORS,q.floor)?q.floor:'auto',wallColor:hex(q.wallColor),floorColor:hex(q.floorColor),uses:Object.fromEntries(Object.entries(q.uses||{}).filter(([k,v])=>['sleep','meal','tea','rest','read'].includes(k)&&typeof v==='string'))};}
function record(q={},p){q=q&&typeof q==='object'?q:{};return {catalogId:p.catalogId||p.id,x:Number.isFinite(q.x)?q.x:p.x,z:Number.isFinite(q.z)?q.z:p.z,heading:Number.isFinite(q.heading)?((Math.round(q.heading/(Math.PI/2))%4+4)%4)*Math.PI/2:p.heading||0,stored:q.stored===true,color:hex(q.color),material:Object.hasOwn(HOME_MATERIALS,q.material)?q.material:'auto'};}
export function homePlacements(raw={}){
 const result=Object.fromEntries(BASE_HOME.map(p=>[p.id,record(raw?.[p.id],p)]));
 for(const [id,q]of Object.entries(raw||{})){if(Object.keys(result).length>=HOME_LIMIT)break;if(!/^furniture-[1-9]\d{0,7}$/.test(id))continue;const p=HOME_CATALOG.find(p=>p.id===q?.catalogId);if(p)result[id]=record(q,{...p,x:0,z:0});}
 result.$room=homeRoom(raw);return result;
}
export function homeFurniture(raw){const placements=homePlacements(raw),counts={};return Object.entries(placements).filter(([id])=>id!=='$room').map(([id,q])=>{const p=HOME_CATALOG.find(p=>p.id===q.catalogId),n=counts[p.id]=(counts[p.id]||0)+1;return {...p,...q,id,label:HOME_NAMES[id]||p.label+' · '+n};});}
export const usesFor=p=>p?.kind==='bed'?['sleep']:p?.kind==='chair'?['meal']:p?.kind==='sofa'?['tea','rest','read']:[];
export function furniturePoint(p,q={x:0,z:0}){const h=p.heading||0,c=Math.cos(h),s=Math.sin(h);return {x:p.x+q.x*c+q.z*s,z:p.z-q.x*s+q.z*c};}
export function furnitureSeat(p,approach,offset){return {...furniturePoint(p,offset),rise:.45,heading:p.heading||0,approach,piece:p.id};}
export function homeAnchors(furniture,room){
 const defaults={sleep:'double-bed',meal:'dining-chair',tea:'sofa',rest:'sofa',read:'sofa'};
 const anchor=(p,action,id)=>p.kind==='bed'?{id,action,piece:p.id,approach:{x:p.w/2+.55,z:.8},bed:true}:p.kind==='chair'?{id,action,piece:p.id,approach:{x:-.85,z:0},seat:true}:{id,action,piece:p.id,approach:{x:p.w/2+.6,z:.25},seat:true,offset:{x:action==='read'?.6:-.6,z:.05}};
 const selected=Object.entries(defaults).flatMap(([action,id])=>{const candidates=furniture.filter(p=>usesFor(p).includes(action));const p=candidates.find(p=>p.id===room.uses[action])||candidates.find(p=>p.id===id)||candidates.find(p=>/^furniture-/.test(p.id))||candidates[0];return p?[anchor(p,action,action)]:[];});
 // Additional furniture's own approach must stay reachable even before choosing it.
 return [...selected,...furniture.filter(p=>/^furniture-/.test(p.id)).flatMap(p=>usesFor(p).map(action=>anchor(p,action,'use:'+p.id+':'+action)))];
}
