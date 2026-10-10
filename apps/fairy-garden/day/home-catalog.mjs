import {HOME_SIZES,wallFurniturePosition} from './home-architecture.mjs?v=fg-163c7f71112cb39b';
// One catalogue supplies the editor, saved instances, geometry and activity anchors.
const item=(id,label,category,kind,w,d,extra={})=>({id,label,category,kind,w,d,...extra});
export const HOME_CATEGORIES={bed:'床',sofa:'沙发',dining:'桌椅',storage:'收纳',light:'灯具',plant:'绿植',kitchen:'厨房',rug:'地毯',screen:'屏风',decor:'装饰摆件',wallDecor:'墙上装饰'};
export const HOME_COLLECTIONS={
 craft:{label:'原木藤编',wood:'#c29c6b',dark:'#785c3b',fabric:'#c6b88b',paper:'#f0e8d7',accent:'#8a9672'},
 vintage:{label:'复古深木',wood:'#765041',dark:'#493a33',fabric:'#a07669',paper:'#e5d9be',accent:'#bb9759'},
 soft:{label:'圆润现代',wood:'#dbcfbd',dark:'#8d8578',fabric:'#ded6c9',paper:'#f4f0e7',accent:'#9cab9a'},
 studio:{label:'金属玻璃',wood:'#997858',dark:'#50585c',fabric:'#8c9da3',paper:'#e7e7df',accent:'#af9773',metal:'#a4afb2',glass:'#c5dee0'}
};
export function furniturePalette(a,base){return {...base,...HOME_COLLECTIONS[a.collection]};}
const decorItem=(collection,id,label,w,d,height,extra={})=>item(id,label,extra.mount?'wallDecor':'decor','ornament',w,d,{collection,height,primaryField:'accent',...extra});
const collectionItem=(collection,id,label,category,kind,w,d,extra={})=>item(id,label,category,kind,w,d,{collection,...extra});
export const HOME_CATALOG=[
 item('wood-bed','木框双人床','bed','bed',3,3.35),item('soft-bed','软包双人床','bed','bed',3,3.35,{variant:'soft'}),
 item('sofa','双人沙发','sofa','sofa',3.4,1),item('loveseat','小双人沙发','sofa','sofa',2.3,1.05,{variant:'soft'}),
 item('dining-table','长餐桌','dining','table',2.4,1.1,{dining:true}),item('round-table','圆餐桌','dining','table',1.4,1.4,{variant:'round',dining:true}),
 item('coffee-table','低茶几','dining','table',1.9,.75,{top:.56}),item('chair','软垫餐椅','dining','chair',.56,.57),item('wood-chair','木背餐椅','dining','chair',.56,.57,{variant:'slat'}),
 item('wardrobe','衣柜','storage','wardrobe',.8,2.1),item('bedside','床头柜','storage','cabinet',.65,.7),item('bookcase','书柜','storage','shelf',.75,1.65),
 item('dresser','矮斗柜','storage','cabinet',1.5,.65,{variant:'drawers'}),item('pantry','窄储物柜','storage','wardrobe',.75,1.15),
 item('floor-lamp','落地灯','light','light',.5,.5,{variant:'floor'}),item('table-lamp','矮台灯架','light','light',.55,.55,{variant:'short'}),
 item('plant','小盆栽','plant','plant',.5,.5),item('tall-plant','高绿植','plant','plant',.65,.65,{variant:'tall'}),
 item('kitchen','厨房台面','kitchen','kitchen',4.6,.8),item('bar','小料理台','kitchen','counter',2,.8,{variant:'home'}),
 collectionItem('craft','canopy-bed','四柱纱幔床','bed','bed',3,3.35),
 collectionItem('craft','rattan-sofa','藤编双人沙发','sofa','sofa',3.1,1.15),
 collectionItem('craft','trestle-table','横梁原木餐桌','dining','table',2.1,1.1,{dining:true}),
 collectionItem('craft','woven-chair','藤编圈背椅','dining','chair',.62,.65),
 collectionItem('craft','basket-shelf','藤篮开放架','storage','shelf',1.45,.48),
 collectionItem('craft','paper-lantern','竹脚纸灯笼','light','light',.65,.65,{primaryField:'paper'}),
 collectionItem('craft','braided-rug','编织椭圆毯','rug','rug',2.5,1.8,{walkThrough:true}),
 collectionItem('craft','lattice-screen','三扇藤格屏风','screen','screen',1.65,.45,{primaryField:'wood'}),
 collectionItem('vintage','spindle-bed','车木柱复古床','bed','bed',3,3.35),
 collectionItem('vintage','rolled-sofa','卷扶手绒布沙发','sofa','sofa',3.1,1.15),
 collectionItem('vintage','claw-table','雕脚圆餐桌','dining','table',1.5,1.5,{dining:true,variant:'round'}),
 collectionItem('vintage','windsor-chair','温莎木椅','dining','chair',.62,.65,{primaryField:'wood'}),
 collectionItem('vintage','apothecary','多抽屉药柜','storage','cabinet',1.45,.5),
 collectionItem('vintage','stained-lamp','彩玻璃花罩灯','light','light',.65,.65),
 collectionItem('vintage','medallion-rug','菱花边框地毯','rug','rug',2.5,1.8,{walkThrough:true}),
 collectionItem('vintage','record-console','唱片留声机柜','decor','decor',1.25,.6),
 collectionItem('soft','panel-bed','弧片软包床','bed','bed',3,3.35),
 collectionItem('soft','cloud-sofa','云团组合沙发','sofa','sofa',3.1,1.15),
 collectionItem('soft','pill-table','胶囊双柱餐桌','dining','table',2.1,1.1,{dining:true}),
 collectionItem('soft','shell-chair','贝壳一体椅','dining','chair',.62,.65),
 collectionItem('soft','cube-shelf','错格展示柜','storage','shelf',1.45,.48),
 collectionItem('soft','mushroom-lamp','蘑菇圆顶灯','light','light',.65,.65),
 collectionItem('soft','pebble-rug','拼块鹅卵石毯','rug','rug',2.5,1.8,{walkThrough:true}),
 collectionItem('soft','wave-screen','波浪曲面屏风','screen','screen',1.65,.45),
 collectionItem('studio','steel-bed','管架金属床','bed','bed',3,3.35),
 collectionItem('studio','tube-sofa','钢管皮垫沙发','sofa','sofa',3.1,1.15),
 collectionItem('studio','glass-table','玻璃交叉架餐桌','dining','table',2.1,1.1,{dining:true,primaryField:'glass'}),
 collectionItem('studio','cantilever-chair','悬臂钢管椅','dining','chair',.62,.65),
 collectionItem('studio','metal-rack','金属网格置物架','storage','shelf',1.45,.48,{primaryField:'dark'}),
 collectionItem('studio','arc-lamp','弯臂圆盘落地灯','light','light',.95,.75,{primaryField:'dark'}),
 collectionItem('studio','stripe-rug','条纹平织地毯','rug','rug',2.5,1.8,{walkThrough:true}),
 collectionItem('studio','terrarium','玻璃植物箱','decor','decor',1.05,.65),
 decorItem('craft','flower-basket','藤篮花束',.8,.7,1.05),
 decorItem('craft','dried-vases','陶罐与干花',.8,.55,1.2),
 decorItem('craft','botanical-frame','植物标本画框',.85,.13,1.1,{mount:true,primaryField:'wood'}),
 decorItem('craft','macrame','编绳流苏挂毯',1,.16,1.25,{mount:true,primaryField:'fabric'}),
 decorItem('craft','woven-wall-trio','三只编织壁盘',1.25,.14,.75,{mount:true,primaryField:'wood'}),
 decorItem('vintage','bust-pedestal','石膏像与雕花台',.65,.65,1.55),
 decorItem('vintage','candle-pedestal','三枝烛台',.6,.55,1.25),
 decorItem('vintage','oval-mirror','雕花椭圆镜',.9,.15,1.2,{mount:true,primaryField:'wood',mirror:true}),
 decorItem('vintage','pendulum-clock','木匣摆钟',.62,.22,1.05,{mount:true,primaryField:'wood'}),
 decorItem('vintage','landscape-frame','山野风景画',1.3,.13,.85,{mount:true,primaryField:'wood'}),
 decorItem('soft','loop-sculpture','圆环陶艺摆件',.7,.55,1.2),
 decorItem('soft','plush-bear','坐坐小熊',.7,.65,.85,{primaryField:'fabric'}),
 decorItem('soft','bubble-mirror','云朵曲边镜',1.15,.15,.9,{mount:true,primaryField:'fabric',mirror:true}),
 decorItem('soft','arch-art','拱门拼色画',.75,.14,1.1,{mount:true,primaryField:'fabric'}),
 decorItem('soft','cloud-wall-shelf','云朵小壁架',1.15,.38,.7,{mount:true,primaryField:'wood'}),
 decorItem('studio','kinetic-sculpture','平衡金属雕塑',.7,.55,1.45),
 decorItem('studio','glass-vase','玻璃瓶花与底座',.6,.55,1.15,{primaryField:'glass'}),
 decorItem('studio','geometric-poster','几何组合海报',1.15,.11,.8,{mount:true,primaryField:'fabric'}),
 decorItem('studio','rail-wall-shelf','金属双层壁架',1.2,.4,.8,{mount:true,primaryField:'dark'}),
 decorItem('studio','hanging-planter','吊篮垂叶盆栽',.7,.42,1.1,{mount:true,primaryField:'fabric'})
];
export const HOME_MATERIALS={auto:'随小家',wood:'木纹',fabric:'织物',plain:'哑光',metal:'金属'};
export const HOME_COLORS=[{label:'奶油',color:'#e9dcc7'},{label:'浅木',color:'#cba77f'},{label:'深木',color:'#715749'},{label:'苔绿',color:'#8ca18b'},{label:'雾蓝',color:'#9fb9c6'},{label:'藕粉',color:'#cfa59b'}];
export const HOME_WALLS={auto:{label:'随小家'},cream:{label:'奶油墙',color:'#eee3d1'},sage:{label:'浅绿墙',color:'#d9e2d6'},rose:{label:'淡粉墙',color:'#eedad4'},stripe:{label:'细条墙纸',color:'#eee6d8',pattern:'stripe'},panel:{label:'木纹墙面',color:'#bc9d80',pattern:'panel'},dots:{label:'小圆点墙纸',color:'#eee5d6',pattern:'dots'},botanical:{label:'枝叶墙纸',color:'#e3e8d9',pattern:'botanical'},wainscot:{label:'方格护墙板',color:'#c7d1c4',pattern:'wainscot'}};
export const HOME_FLOORS={auto:{label:'随小家'},warm:{label:'暖木地板',color:'#cfb79b',pattern:'wood'},light:{label:'浅木地板',color:'#ddd3bc',pattern:'wood'},dark:{label:'深木地板',color:'#977965',pattern:'wood'},tile:{label:'奶白瓷砖',color:'#e6dfd0',pattern:'tile'},sage:{label:'浅绿瓷砖',color:'#bdccbf',pattern:'tile'},stone:{label:'灰石地面',color:'#c7c6bb',pattern:'stone'},checker:{label:'棋盘格瓷砖',color:'#e7deca',pattern:'checker'},herringbone:{label:'人字拼木地板',color:'#c8ac85',pattern:'herringbone'},terrazzo:{label:'碎石水磨石',color:'#e5ded2',pattern:'terrazzo'}};
export const BASE_HOME=[
 ['double-bed','wood-bed',-4,-3,0,'双人床'],['wardrobe','wardrobe',-6.25,-2.7],['bedside','bedside',-2.05,-4.2],
 ['sofa','sofa',-3,1.4,0,'沙发'],['coffee-table','coffee-table',-3,3],['dining-table','dining-table',3,-.25],
 ['dining-chair','chair',3,.9,Math.PI,'餐椅'],['partner-chair','chair',3,-1.4,0,'另一把餐椅'],
 ['kitchen','kitchen',3.4,-4.65],['pantry','pantry',6.15,-3.1,0,'储物柜'],['home-plant','plant',6,3.8,0,'盆栽'],['bookcase','bookcase',-6.25,.7]
].map(([id,catalogId,x,z,heading=0,label])=>({...HOME_CATALOG.find(p=>p.id===catalogId),id,catalogId,x,z,heading,label:label||HOME_CATALOG.find(p=>p.id===catalogId).label}));
export const HOME_NAMES=Object.fromEntries(BASE_HOME.map(p=>[p.id,p.label]));
const hex=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x)?x.toLowerCase():'';
export function furniturePrimary(p,palette){const field=p.primaryField||(['bed','sofa','chair','plant','light','rug','screen'].includes(p.kind)?'fabric':'wood');return {field,color:p.color||furniturePalette(p,palette)[field]};}
export function furnitureFootprint(p){const c=Math.abs(Math.cos(p.heading||0)),s=Math.abs(Math.sin(p.heading||0));return {id:p.id,x:p.x,z:p.z,w:p.w*c+p.d*s,d:p.d*c+p.w*s};}
export const HOME_LIMIT=80;
// The renderer and the activity anchor own the same pot and preparation surface.
export const HOME_PREP={x:-1.05,z:.22,y:.995,contactZ:.30,contactY:1.04,handZ:.44,handY:1.19};
export const HOME_COOK={x:1.08,z:.22,y:1.09,r:.13,gripY:1.30,contactY:1.16};
export function homeRoom(raw){const q=raw?.$room||{};return {size:Object.hasOwn(HOME_SIZES,q.size)?q.size:'compact',originalRugs:q.originalRugs!==false,originalWallDecor:q.originalWallDecor!==false,wall:Object.hasOwn(HOME_WALLS,q.wall)?q.wall:'auto',floor:Object.hasOwn(HOME_FLOORS,q.floor)?q.floor:'auto',wallColor:hex(q.wallColor),floorColor:hex(q.floorColor),uses:Object.fromEntries(Object.entries(q.uses||{}).filter(([k,v])=>['sleep','meal','tea','rest','read','cook'].includes(k)&&typeof v==='string'))};}
function record(q={},p){q=q&&typeof q==='object'?q:{};return {...(p.mount?{wall:q.wall==='left'?'left':'back',along:Number.isFinite(q.along)?q.along:0,y:Number.isFinite(q.y)?q.y:2}:{}),catalogId:p.catalogId||p.id,x:Number.isFinite(q.x)?q.x:p.x,z:Number.isFinite(q.z)?q.z:p.z,heading:Number.isFinite(q.heading)?((Math.round(q.heading/(Math.PI/2))%4+4)%4)*Math.PI/2:p.heading||0,stored:q.stored===true,color:hex(q.color),material:Object.hasOwn(HOME_MATERIALS,q.material)?q.material:'auto'};}
export function homePlacements(raw={}){
 const result=Object.fromEntries(BASE_HOME.map(p=>[p.id,record(raw?.[p.id],p)]));
 for(const [id,q]of Object.entries(raw||{})){if(Object.keys(result).length>=HOME_LIMIT)break;if(!/^furniture-[1-9]\d{0,7}$/.test(id))continue;const p=HOME_CATALOG.find(p=>p.id===q?.catalogId);if(p)result[id]=record(q,{...p,x:0,z:0});}
 result.$room=homeRoom(raw);return result;
}
export function homeFurniture(raw){const placements=homePlacements(raw),counts={};return Object.entries(placements).filter(([id])=>id!=='$room').map(([id,q])=>{const p=HOME_CATALOG.find(p=>p.id===q.catalogId),n=counts[p.id]=(counts[p.id]||0)+1;return {...p,...q,...(p.mount?wallFurniturePosition({...p,...q},placements.$room):{}),id,label:HOME_NAMES[id]||p.label+' · '+n};});}
export const usesFor=p=>p?.kind==='bed'?['sleep']:p?.kind==='chair'?['meal']:p?.kind==='sofa'?['tea','rest','read']:p?.kind==='kitchen'?['cook']:[];
export function furniturePoint(p,q={x:0,z:0}){const h=p.heading||0,c=Math.cos(h),s=Math.sin(h);return {x:p.x+q.x*c+q.z*s,z:p.z-q.x*s+q.z*c};}
// The visible cushion, rather than the collision footprint, determines where
// the pelvis rests and the shin clears the edge. Geometry uses this same table.
export function furnitureSeatSurface(p){
 if(p.seatSurface)return p.seatSurface;
 if(p.kind==='sofa')return p.collection?{z:.035,d:p.d-(p.collection==='soft'?.14:.22)}:{z:.065,d:p.d-.31};
 return {z:0,d:p.kind==='chair'?p.d-(p.collection?.035:.018):p.d};
}
export function furnitureSeat(p,approach,offset){
 const surface=furnitureSeatSurface(p),z=surface.z+surface.d/2+.05;
 return {...furniturePoint(p,{x:offset?.x||0,z:Math.max(offset?.z||0,z)}),rise:.45,heading:p.heading||0,approach,piece:p.id,pose:'chair'};
}
export function homeAnchors(furniture,room){
 const defaults={sleep:'double-bed',meal:'dining-chair',tea:'sofa',rest:'sofa',read:'sofa',cook:'kitchen'};
 const anchor=(p,action,id)=>p.kind==='kitchen'?{id,action,label:'厨房料理',piece:p.id,approach:{x:HOME_COOK.x,z:p.d/2+.35},heading:Math.PI}:p.kind==='bed'?{id,action,piece:p.id,approach:{x:p.w/2+.55,z:.8},bed:true}:p.kind==='chair'?{id,action,piece:p.id,approach:{x:-.85,z:0},seat:true}:{id,action,piece:p.id,approach:{x:p.w/2+.6,z:.25},seat:true,offset:{x:action==='read'?.6:-.6,z:.05}};
 const selected=Object.entries(defaults).flatMap(([action,id])=>{const candidates=furniture.filter(p=>usesFor(p).includes(action));const p=candidates.find(p=>p.id===room.uses[action])||candidates.find(p=>p.id===id)||candidates.find(p=>/^furniture-/.test(p.id))||candidates[0];return p?[anchor(p,action,action)]:[];});
 // Additional furniture's own approach must stay reachable even before choosing it.
 return [...selected,...furniture.filter(p=>/^furniture-/.test(p.id)).flatMap(p=>usesFor(p).map(action=>anchor(p,action,'use:'+p.id+':'+action)))];
}
