import {createRoomKit,roomSeat} from './room-kit.mjs?v=fg-81bec85526a50316';
const floor=.08;
const furniture=[
 {id:'crop-bed',kind:'plot',x:-3,z:-2.3,w:3.4,d:2.5},
 {id:'farm-desk',kind:'table',x:1.4,z:-2.1,w:2.5,d:1.1,top:.85,work:{records:{x:.12,y:.92,z:.43}}},
 {id:'farm-chair',kind:'chair',x:1.4,z:-1.12,w:.56,d:.57,heading:Math.PI,seat:.45},
 {id:'farm-shelf',kind:'shelf',x:-4.2,z:1.8,w:1.4,d:.65,top:1.05},
 {id:'farm-water',kind:'pond',x:4,z:1.6,w:2,d:3.6},
 {id:'farm-bench',kind:'bench',x:.5,z:3,w:2,d:.64,heading:Math.PI,seat:.45}
];
const records=roomSeat(furniture,'farm-chair',{x:2.3,z:-1.12}),rest=roomSeat(furniture,'farm-bench',{x:.5,z:2.1});
export const farmMap={label:'农场／田边记录处',renderer:'dayFarm',radius:10,bounds:{w:11,d:9},floor,spawn:{x:0,z:4},view:{x:0,z:-.3},outdoor:true,furniture,obstacles:furniture.map(({id,x,z,w,d})=>({id,x,z,w,d})),seats:{records,rest},spots:[
 {id:'entrance',label:'农场入口',description:'沿田间小路走进来，左右通道连接菜地、记录桌与码头。',action:'rest',gesture:'rest',target:{x:0,z:3.65}},
 {id:'records',label:'整理作物与钓鱼记录',description:'坐回田边的记录桌，翻看和写下作物、收成或钓鱼笔记。',action:'work',gesture:'read',target:records.approach,seat:records,heading:records.heading,furniture:'farm-desk'},
 {id:'crops',label:'查看田间作物',description:'站在菜畦旁观察作物，记录工作可以随后回到桌前继续。',action:'work',gesture:'rest',target:{x:-3,z:-.75},heading:Math.PI,furniture:'crop-bed'},
 {id:'supplies',label:'田边工具与资料',description:'站在小架前取用、整理田间笔记与随手工具。',action:'work',gesture:'rest',target:{x:-4.2,z:2.55},heading:Math.PI,furniture:'farm-shelf'},
 {id:'dock',label:'码头旁观察',description:'在水边的安全步道观察水面，再回记录桌整理钓鱼笔记。',action:'work',gesture:'rest',target:{x:2.7,z:1.6},heading:Math.PI/2,furniture:'farm-water'},
 {id:'rest',label:'田边歇息',description:'坐在长椅上休息或翻书，再沿主路回到工位。',action:'rest',gesture:'rest',target:rest.approach,seat:rest,heading:rest.heading,furniture:'farm-bench'},
 {id:'exit',label:'离开农场',description:'从中央田间路离开，保留通向各区域的路线。',action:'rest',gesture:'rest',target:{x:0,z:4}}
],tour:['entrance','crops','records','supplies','dock','rest','exit']};
export function createFarm(){
 const k=createRoomKit();k.root.name='DayFarm';k.root.userData.furniture=furniture;
 k.box('FarmGround',{y:-.07,w:11.3,h:.3,d:9.3,color:'#a8b994'});
 k.box('FarmPath',{y:.09,w:2,h:.02,d:9,color:'#d4c5a1'});k.box('FarmCrossPath',{z:.2,y:.09,w:10.8,h:.02,d:1.1,color:'#d4c5a1'});
 for(const p of furniture){
  if(p.kind==='chair')k.chair({...p,color:'#94aa88'});else if(p.kind==='bench')k.bench({...p,color:'#8c9f81'});
  else if(p.kind==='table'){const g=k.table({...p,color:'#b79972'});k.box('FarmLedger',{x:.12,z:.43,y:floor+p.top+.025,w:.56,h:.045,d:.31,color:'#eee8d5'},g);for(let n=0;n<4;n++)k.box('LedgerLine',{x:.22,z:.34+n*.05,y:floor+p.top+.051,w:.22,h:.004,d:.01,color:'#9daf9e',radius:0},g);k.book('FishingJournal',{x:-.7,z:-.15,y:floor+p.top+.06,w:.36,d:.44,color:'#89a8a3',flat:true},g);k.cylinder('FarmCup',{x:.84,z:-.15,y:floor+p.top+.10,r:.065,h:.19,color:'#e1dcc8'},g);}
  else if(p.kind==='plot'){const g=k.group(p.id,{x:p.x,z:p.z});k.box('Soil',{y:.12,w:p.w,h:.08,d:p.d,color:'#8e765c'},g);for(let a=-1;a<=1;a++)for(let b=-2;b<=2;b++){const crop=k.group('Crop',{x:b*.58,z:a*.65,y:.17},g);k.sphere('Vegetable',{r:.11,color:a%2?'#b79969':'#a7b278'},crop);for(let i=0;i<4;i++){const leaf=k.box('Leaf',{x:Math.sin(i*1.6)*.1,z:Math.cos(i*1.6)*.1,y:.13,w:.12,h:.28,d:.07,color:i%2?'#7d9869':'#91a875'},crop);leaf.rotation.z=Math.sin(i*1.6)*.45;}}}
  else if(p.kind==='pond'){k.box('PondBank',{x:p.x,z:p.z,y:.09,w:p.w,h:.02,d:p.d,color:'#b8c5a8'});k.box('FarmWater',{x:p.x+.08,z:p.z,y:.106,w:p.w-.25,h:.012,d:p.d-.2,color:'#93b4b2'});for(let n=0;n<5;n++)k.box('WaterRipple',{x:p.x+.25+(n%2)*.5,z:p.z-1.3+n*.55,y:.115,w:.45,h:.004,d:.025,color:'#bfd3c6',radius:0});}
  else if(p.kind==='shelf'){const g=k.group(p.id,{x:p.x,z:p.z});for(const y of [.15,.65,1.05])k.box('FarmShelfBoard',{y:floor+y,w:p.w,h:.06,d:p.d,color:'#b7a27c'},g);for(const x of [-.64,.64])k.box('ShelfPost',{x,y:.6,w:.08,h:1.1,d:.52,color:'#9b865f'},g);for(let n=0;n<4;n++)k.book('FarmGuide',{x:-.47+n*.28,y:.89,w:.18,h:.36,d:.28,color:n%2?'#8ba28b':'#b5a783'},g);}
 }
 for(let n=0;n<7;n++){k.box('FarmFencePost',{x:-4.7+n*1.5,z:-4.2,y:.55,w:.09,h:.94,d:.09,color:'#b5a585'});if(n<6)for(const y of [.36,.7])k.box('FarmFenceRail',{x:-3.95+n*1.5,z:-4.2,y,w:1.5,h:.065,d:.065,color:'#c4b594'});}
 k.sign('FarmSign',{text:'田边笔记',x:1.5,y:1.8,z:-3.8,w:2,h:.4});return k.finish();
}
