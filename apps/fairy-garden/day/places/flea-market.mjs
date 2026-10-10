import {createRoomKit,roomSeat} from './room-kit.mjs?v=fg-0ea83b85ae5ca55e';
const floor=.08;
const furniture=[
 {id:'fabric-stall',kind:'table',x:-3,z:-2,w:2.5,d:1.1,top:.58,work:{fabric:{x:.12,y:.66,z:.51}}},
 {id:'antique-stall',kind:'table',x:1,z:-2.7,w:2.4,d:1.1,top:.58,work:{antiques:{x:.12,y:.66,z:.51}}},
 {id:'checkout-stall',kind:'table',x:3.8,z:.6,w:1.6,d:1,top:.58,work:{checkout:{x:.12,y:.65,z:.48}}},
 {id:'packing-stall',kind:'table',x:-2.6,z:1.5,w:1.8,d:.8,top:.58,work:{packing:{x:.12,y:.65,z:.38}}},
 {id:'market-rest',kind:'bench',x:3.7,z:3.3,w:1.9,d:.64,heading:Math.PI,seat:.45}
];
const rest=roomSeat(furniture,'market-rest',{x:3.7,z:2.4});
export const fleaMarketMap={label:'复古市集／旧货摊',renderer:'dayFleaMarket',radius:10,bounds:{w:11,d:9},floor,spawn:{x:0,z:4},view:{x:0,z:-.3},outdoor:true,furniture,obstacles:furniture.map(({id,x,z,w,d})=>({id,x,z,w,d})),seats:{rest},spots:[
 {id:'entrance',label:'走进市集',description:'从石板路走进摊位之间，两侧保留挑选和离开的通道。',action:'rest',gesture:'rest',target:{x:0,z:3.2}},
 {id:'fabric',label:'挑选布料',description:'在布料摊前查看折好的旧布料，拿起一件再放回；这里适合挑布和手作材料。',action:'shop',gesture:'rest',target:{x:-2.88,z:-1.22},heading:Math.PI,furniture:'fabric-stall'},
 {id:'antiques',label:'查看古董杂货',description:'走到陶器、旧书和小摆件摊前逐件查看，之后可以换到布料摊。',action:'shop',gesture:'rest',target:{x:1.12,z:-1.92},heading:Math.PI,furniture:'antique-stall'},
 {id:'checkout',label:'摊前付款',description:'在小柜台前交付所挑的物品，随后到出口边整理袋子。',action:'shop',gesture:'rest',target:{x:3.92,z:1.35},heading:Math.PI,furniture:'checkout-stall'},
 {id:'packing',label:'整理随身袋',description:'在低桌前整理买到的小物和布料，保留回到主路的路线。',action:'shop',gesture:'rest',target:{x:-2.48,z:2.14},heading:Math.PI,furniture:'packing-stall'},
 {id:'rest',label:'市集长椅歇脚',description:'坐在摊位边歇一会儿，起身可以继续看摊或离开。',action:'rest',gesture:'rest',target:rest.approach,heading:rest.heading,seat:rest,furniture:'market-rest'},
 {id:'exit',label:'离开市集',description:'沿摊位之间的石板路离开，随身袋跟着小人。',action:'rest',gesture:'rest',target:{x:0,z:4}}
],tour:['entrance','fabric','antiques','checkout','packing','rest','exit']};
export function createFleaMarket(){
 const k=createRoomKit();k.root.name='DayFleaMarket';k.root.userData.furniture=furniture;
 k.box('MarketGround',{y:-.07,w:11.3,h:.3,d:9.3,color:'#c5bba4'});
 for(let x=-5;x<=5;x++)for(let z=-4;z<=4;z++)k.box('Paving',{x,y:.085,z,w:.94,h:.012,d:.94,color:(x+z)%2?'#d3c8b2':'#d9cfbb',radius:.045});
 for(const p of furniture){if(p.kind==='bench'){k.bench({...p,color:'#829785'});continue;}const g=k.table({...p,color:'#ae8b65'});
  if(['fabric-stall','antique-stall'].includes(p.id)){
   // Canopy poles stay inside the same obstacle as their stall.
   for(const x of [-p.w/2+.08,p.w/2-.08])k.box('AwningPole',{x,z:-.46,y:1.2,w:.07,h:2.3,d:.07,color:'#8c7358'},g);
   for(let n=0;n<7;n++)k.box('StripedAwning',{x:(n-3)*p.w/7,z:-.08,y:2.32,w:p.w/7+.015,h:.08,d:1.05,color:n%2?'#ede0c1':'#a8b6a0'},g);
   k.sign('StallSign',{text:p.id==='fabric-stall'?'旧布与手作':'古董与旧书',y:1.95,z:-.38,w:1.65,h:.29},g);
  }
  if(p.id==='fabric-stall')for(let i=0;i<5;i++)for(let j=0;j<2;j++)k.box('FoldedFabric',{x:-.86+i*.40,z:-.25+j*.35,y:floor+p.top+.04+(i%2)*.03,w:.33,h:.08,d:.28,color:['#9fac8b','#c59d8b','#b7b1c2','#d8bc89','#8da8a5'][i]},g);
  if(p.id==='antique-stall'){for(const [i,x]of [-.80,-.2,.45].entries()){k.cylinder('CeramicVase',{x,y:floor+p.top+.12,r:.085+i*.025,h:.24,color:['#c3b290','#8a9c8a','#c7a38b'][i]},g);k.cylinder('VaseNeck',{x,y:floor+p.top+.26,r:.045,h:.08,color:'#b7aa91'},g);}for(let n=0;n<3;n++)k.book('OldBook',{x:.9,z:-.05,y:floor+p.top+.07+n*.09,w:.35,d:.4,color:['#839784','#b5a07b','#a68879'][n],flat:true},g);}
  if(p.id==='packing-stall')k.box('FoldedPaperBags',{x:-.44,y:floor+p.top+.03,w:.55,h:.06,d:.5,color:'#c8af89'},g);
  if(p.id==='checkout-stall')k.box('CashTray',{x:-.32,z:-.2,y:floor+p.top+.035,w:.4,h:.07,d:.27,color:'#8b7760'},g);
 }
 for(const [x,z]of [[-4.8,3.5],[4.8,-3.9]])k.plant(x,z);
 return k.finish();
}
