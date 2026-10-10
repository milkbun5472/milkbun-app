import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-b8fac1ac2a1bdca7';
import {cabinet} from './work-room-kit.mjs?v=fg-b8fac1ac2a1bdca7';
import {soupPot,preparationSurface} from './kitchen-kit.mjs?v=fg-b8fac1ac2a1bdca7';
const FLOOR=.08,SIZE={w:14,d:11};
const furniture=[
 {id:'prep-counter',kind:'counter',x:-4.8,z:-3.83,w:2.7,d:1,top:.85,work:{prep:{x:.12,y:.93,z:.30}}},
 {id:'stove-counter',kind:'counter',x:-1.65,z:-3.83,w:2.6,d:1,top:.85,work:{cook:{x:.22,y:1.08,z:.26}}},
 {id:'wash-counter',kind:'counter',x:1.48,z:-3.83,w:2.6,d:1,top:.85,work:{wash:{x:.12,y:.90,z:.27}}},
 {id:'cold-storage',kind:'cabinet',x:5.49,z:-3.77,w:1.5,d:1.06,h:1.9},
 {id:'service-bar',kind:'counter',x:-.7,z:-.18,w:7.4,d:1.0,top:.85,work:{coffee:{x:-2.33,y:1.07,z:-.37},mix:{x:.12,y:.94,z:-.26},serve:{x:2.48,y:.91,z:-.26}}},
 {id:'cash-counter',kind:'counter',x:4.86,z:-.18,w:1.35,d:1,top:.85,work:{cashier:{x:.12,y:.99,z:-.29}}},
 {id:'staff-table',kind:'table',x:-4.6,z:2.77,w:2.1,d:1.10,top:.85,color:'#caa67f'},
 {id:'staff-chair',kind:'chair',x:-4.6,z:3.53,w:.56,d:.57,heading:Math.PI,color:'#b9b68f'},
 {id:'break-bench',kind:'bench',x:3.93,z:3.75,w:2.85,d:.65,heading:0,seat:.45,color:'#c49b7a'},
 {id:'front-plant',kind:'plant',x:-6.08,z:.94,w:.55,d:.55}
];
const seats={meal:roomSeat(furniture,'staff-chair',{x:-3.77,z:3.53}),rest:roomSeat(furniture,'break-bench',{x:3.93,z:2.93})};
const stand=(id,label,description,target,furn,heading=Math.PI)=>({id,label,description,action:'work',gesture:'rest',target,heading,furniture:furn});
export const serviceMap={label:'后厨／操作吧台',renderer:'dayService',radius:12,bounds:SIZE,floor:FLOOR,spawn:{x:0,z:4.87},view:{x:0,z:0},furniture,seats,obstacles:roomObstacles(furniture,SIZE),spots:[
 {id:'entrance',label:'店内开工入口',description:'从店门沿吧台侧边走进实际操作区。',action:'rest',gesture:'rest',target:{x:0,z:4.6},heading:Math.PI},
 stand('storage','冷藏柜取材料','打开后厨冷柜，取放本次制作需要的材料。',{x:5.49,z:-2.79},'cold-storage'),
 stand('prep','砧板前备料','在实际砧板上切配食材，手持短厨刀。',{x:-4.68,z:-3.13},'prep-counter'),
 stand('cook','灶台前出菜','站在灶台前用汤勺翻搅，工作间隙检查锅里。',{x:-1.43,z:-3.06},'stove-counter'),
 stand('wash','清洗与整理操作台','在后厨水槽边清洗、整理本次用过的器具。',{x:1.48,z:-3.06},'wash-counter'),
 stand('coffee','咖啡机前制作','在吧台内侧操作咖啡机，制作当前订单的咖啡。',{x:-3.03,z:-.90},'service-bar',0),
 stand('mix','吧台调制饮品','双手握住调饮器，摇匀后放回操作台。',{x:-.7,z:-.90},'service-bar',0),
 stand('serve','出餐与递饮品','在出餐口整理托盘，将做好的一份递向吧台外侧。',{x:1.78,z:-.90},'service-bar',0),
 stand('cashier','柜台核对订单','站在柜台内侧，操作收银屏、核对订单。',{x:4.86,z:-.90},'cash-counter',0),
 {id:'meal',label:'员工餐与短休',description:'在侧边员工桌坐下吃饭，属于原日程的用餐安排。',action:'meal',gesture:'eat',target:seats.meal.approach,heading:seats.meal.heading,seat:seats.meal,furniture:'staff-table'},
 {id:'rest',label:'收工间隙歇脚',description:'在店门旁的长椅歇一会儿，再回到本次工作。',action:'rest',gesture:'rest',target:seats.rest.approach,heading:seats.rest.heading,seat:seats.rest,furniture:'break-bench'},
 {id:'exit',label:'交接后离店',description:'收好器具，从吧台侧边走回店门。',action:'rest',gesture:'rest',target:{x:0,z:4.87},heading:0}
],tour:['entrance','storage','prep','cook','wash','coffee','mix','serve','cashier','meal','rest','exit']};
function counter(k,p){
 const g=k.group(p.id,{x:p.x,z:p.z}),bar=p.id==='service-bar'||p.id==='cash-counter';
 k.box('CounterToe',{y:.18,w:p.w-.1,h:.20,d:p.d-.07,color:'#a9866f'},g);k.box('CounterBody',{y:.54,w:p.w-.06,h:.67,d:p.d-.04,color:bar?'#b27e67':'#92a09a'},g);k.box('CounterTop',{y:FLOOR+p.top-.04,w:p.w,h:.08,d:p.d,color:bar?'#e3cfb1':'#d7ddd6'},g);
 for(let x=-p.w/2+.18;x<p.w/2-.10;x+=.19)k.box(bar?'BarFluting':'SteelPanelSeam',{x,y:.52,z:p.d/2+.005,w:bar?.04:.008,h:.62,d:.014,color:bar?'#c99879':'#b7c0b5',radius:.003},g);
 return g;
}
export function createService(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#e2cfac',wallColor:'#f0e2ca',accent:'#b57c60',joins:false});
 k.box('KitchenTileField',{x:0,y:.09,z:-3.19,w:13.4,h:.014,d:4.34,color:'#b5c3b8'});
 for(let x=-6.45;x<6.5;x+=.63)k.box('KitchenTileJoint',{x,y:.100,z:-3.18,w:.011,h:.002,d:4.29,color:'#d5ddd1',radius:0});for(let z=-5.27;z<-1.09;z+=.63)k.box('KitchenTileJoint',{y:.101,z,w:13.3,h:.002,d:.011,color:'#d5ddd1',radius:0});
 for(const p of furniture){if(p.kind==='counter')counter(k,p);else if(p.kind==='cabinet')cabinet(k,p,'#91a6a0');else if(p.kind==='table')k.table(p);else if(p.kind==='chair')k.chair(p);else if(p.kind==='bench')k.bench(p);else if(p.kind==='plant'){const g=k.plant(p.x,p.z);g.name=p.id;}}
 const prep=furniture.find(p=>p.id==='prep-counter'),prepGroup=k.root.getObjectByName(prep.id),a=prep.work.prep;
 preparationSurface(k,prepGroup,{x:a.x,z:.22,y:.965,contactY:FLOOR+a.y-.005,contactZ:a.z,board:'#b8956a',food:'#d1a16f'});
 const stove=furniture.find(p=>p.id==='stove-counter'),stoveGroup=k.root.getObjectByName(stove.id),b=stove.work.cook;
 k.box('Cooktop',{y:.944,w:1.55,h:.025,d:.66,color:'#536b6d'},stoveGroup);for(const x of [-.47,.22])k.cylinder('CookingRing',{x,y:.964,z:.26,r:.15,h:.015,color:'#95aaa4'},stoveGroup);
 soupPot(k,stoveGroup,{x:b.x,z:b.z,y:1.09,contactY:FLOOR+b.y,body:'#a3b7ae',soup:'#dbbc83',lid:'#dce4d9'});
 k.box('ExtractorHood',{x:stove.x,y:2.56,z:-4.66,w:2.38,h:.27,d:1.1,color:'#a5b7b0'});for(let i=0;i<7;i++)k.box('ExtractorVent',{x:stove.x-.84+i*.28,y:2.415,z:-4.49,w:.13,h:.012,d:.39,color:'#7e9994',radius:0});
 const wash=k.root.getObjectByName('wash-counter');k.box('SinkRim',{y:.947,w:.95,h:.018,d:.52,color:'#7d9692'},wash);k.box('SinkBowl',{y:.95,w:.81,h:.012,d:.40,color:'#b4d0d0'},wash);k.tube('KitchenTap',{points:[[.05,.95,-.27],[.05,1.25,-.27],[.05,1.28,-.08],[.05,1.17,.08]],r:.025,color:'#718d88'},wash);
 const bar=k.root.getObjectByName('service-bar'),coffee=k.group('EspressoMachine',{x:-2.38,y:.93,z:-.10},bar);
 k.box('EspressoBody',{y:.29,w:.82,h:.58,d:.48,color:'#6e9594'},coffee);k.box('EspressoSteelFace',{y:.27,z:-.252,w:.72,h:.42,d:.026,color:'#c6d1c8'},coffee);k.box('CoffeeDripTray',{y:.025,z:-.28,w:.74,h:.045,d:.34,color:'#819b97'},coffee);
 for(const x of [-.18,.18]){k.cylinder('CoffeeSpout',{x,y:.18,z:-.30,r:.025,h:.12,color:'#637f7c'},coffee);k.cylinder('CounterCoffeeCup',{x,y:.083,z:-.32,r:.055,h:.1,color:'#eee4cf'},coffee);const stream=k.replaceableGroup('CoffeeStream',{x,y:.125,z:-.32},coffee);stream.userData.daySignal={furniture:'service-bar',spot:'coffee',kinds:['barista']};k.cylinder('CoffeeFlow',{r:.008,h:.08,color:'#8f694e'},stream);}
 k.box('EspressoButton',{x:.05,y:.22,z:-.27,w:.08,h:.035,d:.018,color:'#d6b785'},coffee);
 const trays=k.replaceableGroup('PassTray',{x:2.48,y:.965,z:-.25},bar);trays.userData.dayPass='service-bar';k.box('ServingTray',{w:.50,h:.025,d:.34,color:'#b19770'},trays);k.cylinder('ServicePlate',{y:.025,r:.14,h:.022,color:'#eee4cf'},trays);k.ellipsoid('PlatedMeal',{y:.060,w:.22,h:.065,d:.18,color:'#b9b37d'},trays);
 for(let i=0;i<4;i++){k.cylinder('MixBottle',{x:-.40+i*.25,y:1.14,z:.24,r:.056,h:.40,color:['#a3b5a0','#c9a377','#819ba8','#b7ad98'][i]},bar);k.cylinder('BottleNeck',{x:-.40+i*.25,y:1.37,z:.24,r:.027,h:.10,color:'#dde0cc'},bar);}
 const till=k.root.getObjectByName('cash-counter');k.box('TillScreen',{x:.12,y:1.10,z:-.08,w:.50,h:.30,d:.06,color:'#688e88'},till);k.box('TillDisplay',{x:.12,y:1.10,z:-.115,w:.42,h:.22,d:.015,color:'#d8e3d0'},till);
 k.sign('MenuBoard',{text:'今日出餐',x:-4.6,y:2.43,z:-5.36,w:2.12,h:.52,color:'#6a8c81',ink:'#eee7d5'});k.sign('ServiceSign',{text:'从备料到出餐',x:-6.87,y:2.0,z:1.72,w:2.6,h:.38,heading:Math.PI/2,color:'#f0e2ca',ink:'#a16c54'});
 k.root.userData.furniture=furniture.map(p=>({...p}));for(const p of furniture){const g=k.root.getObjectByName(p.id);if(g)g.userData.furnitureId=p.id;}
 const result=k.finish();result.root.name='DayService';return result;
}
