import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-26440ea7ab90732d';
const FLOOR=.08;
const furniture=[
 {id:'produce-display',kind:'counter',x:-3.5,z:-2.55,w:2.4,d:1.05,top:.50,work:{produce:{x:.06,y:.64,z:.50}}},
 {id:'grocery-aisle',kind:'shelf',x:0,z:-2.45,w:1.45,d:2.45,top:1.35,work:{groceries:{x:.73,y:.60,z:.69}}},
 {id:'cold-cabinet',kind:'cabinet',x:3.6,z:-3.25,w:2.6,d:.74,top:1.78,work:{cold:{x:-.14,y:.60,z:.38}}},
 {id:'basket-stack',kind:'shelf',x:-4,z:1.2,w:.8,d:.8,top:.58,work:{basket:{x:.35,y:.66,z:-.04}}},
 {id:'checkout-counter',kind:'counter',x:3.16,z:1.1,w:2.4,d:.86,top:.58,work:{checkout:{x:-.55,y:.64,z:.40},cashier:{x:.32,y:.64,z:-.39}}},
 {id:'packing-table',kind:'table',x:-1.45,z:2.15,w:1.55,d:.85,top:.58,work:{packing:{x:.06,y:.70,z:.40}}},
 {id:'market-bench',kind:'bench',x:4.25,z:3.25,w:1.8,d:.64,seat:.45,heading:Math.PI,color:'#b8b5a2'}
];
const seats={rest:roomSeat(furniture,'market-bench',{x:4.25,z:2.38})};
export const marketMap={label:'超市',renderer:'dayMarket',radius:10,bounds:{w:11,d:9},floor:FLOOR,spawn:{x:0,z:4},view:{x:0,z:-.2},furniture,obstacles:roomObstacles(furniture,{w:11,d:9}),seats,
 spots:[
  {id:'entrance',label:'走进超市',description:'从入口走入，中央和两侧通道连到蔬果、日用品、冷柜与收银区。',action:'rest',gesture:'rest',target:{x:0,z:3.25},heading:Math.PI,furniture:'Threshold'},
  {id:'basket',label:'拿取购物篮',description:'在入口旁的低架前拿篮子，沿通道提着篮子挑选物品。',action:'shop',gesture:'rest',target:{x:-3.42,z:1.2},heading:-Math.PI/2,furniture:'basket-stack'},
  {id:'produce',label:'蔬果台前挑选',description:'站在蔬果台前伸手挑选，拿起一件后放入购物篮；台面按小人的高度搭建。',action:'shop',gesture:'rest',target:{x:-3.4,z:-1.84},heading:Math.PI,furniture:'produce-display'},
  {id:'groceries',label:'货架旁挑日用品',description:'从右侧通道查看低层商品，伸手拿取，再放入随身购物篮。',action:'shop',gesture:'rest',target:{x:.91,z:-1.8},heading:-Math.PI/2,furniture:'grocery-aisle'},
  {id:'cold',label:'冷柜前挑选',description:'站在冷柜前打开柜门，取出低层商品后关门，保留绕回收银台的路线。',action:'shop',gesture:'rest',target:{x:3.5,z:-2.68},heading:Math.PI,furniture:'cold-cabinet'},
  {id:'checkout',label:'收银台前结账',description:'在收银台前把商品放到台面；再走到出口旁整理购物袋。',action:'shop',gesture:'rest',target:{x:2.65,z:1.72},heading:Math.PI,furniture:'checkout-counter'},
  {id:'cashier',label:'收银工位',description:'在柜台内侧操作收银台，供在超市工作的日程使用。',action:'work',gesture:'rest',target:{x:3.44,z:.48},heading:0,furniture:'checkout-counter'},
  {id:'packing',label:'整理购物袋',description:'在出口旁的低桌前把物品装入购物袋，随后沿门口通道离开。',action:'shop',gesture:'rest',target:{x:-1.35,z:2.77},heading:Math.PI,furniture:'packing-table'},
  {id:'rest',label:'入口长椅歇脚',description:'坐在入口侧边的长椅休息，起身时仍保留到收银台和出口的通道。',action:'rest',gesture:'rest',target:seats.rest.approach,heading:Math.PI,seat:seats.rest,furniture:'market-bench'},
  {id:'exit',label:'提袋离开超市',description:'挑选与整理结束，提着购物袋从南侧入口离开。',action:'rest',gesture:'rest',target:{x:0,z:4},heading:0,furniture:'Threshold'}
 ],tour:['entrance','basket','produce','groceries','cold','checkout','packing','exit']};
function product(kit,name,{x=0,y=0,z=0,color='#c9af80',fruit=false}={},parent){
 const g=kit.group(name,{x,y,z},parent);if(fruit){kit.sphere('Fruit',{r:.09,color},g);kit.box('FruitLeaf',{y:.085,x:.015,w:.055,h:.014,d:.035,color:'#879f70'},g);}else{kit.box('Package',{w:.15,h:.22,d:.13,color},g);kit.box('PackageLabel',{y:.025,z:.068,w:.10,h:.075,d:.006,color:'#f0e8d6',radius:.003},g);}return g;
}
function shoppingBasket(kit,parent,x,y,z){
 const g=kit.group('Basket',{x,y,z},parent);kit.box('BasketBody',{w:.74,h:.25,d:.42,color:'#b7c6a8'},g);for(const a of [-1,1])kit.box('BasketHandle',{x:a*.34,y:.17,w:.026,h:.25,d:.03,color:'#809d87'},g);kit.box('BasketGrip',{y:.30,w:.70,h:.035,d:.04,color:'#809d87'},g);return g;
}
export function createMarket(){
 const kit=createRoomKit();kit.room({w:11,d:9,floorColor:'#ddd4bd',wallColor:'#f0e9d7',accent:'#acb79b'});kit.root.name='DayMarket';kit.root.userData.furniture=furniture;
 for(const x of [-2.06,1.48])kit.box('AisleLine',{x,y:FLOOR+.004,z:-.6,w:.045,h:.006,d:5.4,color:'#bfc4aa',radius:0});
 for(const p of furniture){
  if(p.kind==='bench')kit.bench(p);
  else if(p.id==='produce-display'){
   const g=kit.table(p);for(const x of [-.77,0,.77]){kit.box('ProduceCrate',{x,y:FLOOR+p.top+.06,w:.69,h:.12,d:.86,color:'#c5ae85'},g);for(let i=0;i<6;i++)product(kit,'CrateFruit',{x:x+(i%2-.5)*.24,y:FLOOR+p.top+.17,z:-.25+Math.floor(i/2)*.25,color:x<0?'#c79779':x>0?'#c5bc72':'#8eb28b',fruit:true},g);}
   const selected=kit.replaceableGroup('MarketProduct:produce',{x:p.work.produce.x,y:FLOOR+p.work.produce.y,z:p.work.produce.z},g);selected.userData.marketProduct='produce';product(kit,'PickableFruit',{fruit:true,color:'#c79779'},selected);
   kit.sign('ProduceLabel',{text:'新鲜蔬果',y:.47,z:.536,w:1.48,h:.19,color:'#c5ae85'},g);
  }else if(p.id==='grocery-aisle'){
   const g=kit.group(p.id,{x:p.x,z:p.z});kit.box('ShelfSpine',{y:FLOOR+.7,w:.07,h:1.4,d:p.d,color:'#b9bca3'},g);
   for(const y of [.15,.47,1.07,1.35]){kit.box('ShelfBoard',{y:FLOOR+y,w:p.w,h:.04,d:p.d,color:'#d2c7a8'},g);if(y<1.35)for(const side of [-1,1])for(let i=0;i<6;i++)product(kit,'GroceryProduct',{x:side*.48,y:FLOOR+y+.13,z:-.99+i*.39,color:['#a8b79b','#c6b18d','#b4c6ba'][i%3]},g);}
   const selected=kit.replaceableGroup('MarketProduct:groceries',{x:p.work.groceries.x,y:FLOOR+p.work.groceries.y,z:p.work.groceries.z},g);selected.userData.marketProduct='groceries';product(kit,'PickablePackage',{},selected);
  }else if(p.id==='cold-cabinet'){
   const g=kit.group(p.id,{x:p.x,z:p.z});kit.box('ColdBack',{y:FLOOR+.89,z:-.30,w:p.w,h:1.78,d:.13,color:'#adbeb0'},g);
   for(const x of [-1.25,1.25])kit.box('ColdSide',{x,y:FLOOR+.89,w:.08,h:1.78,d:p.d,color:'#a3b6a7'},g);
   for(const y of [.16,.47,1.10,1.73]){kit.box('ColdShelf',{y:FLOOR+y,w:2.48,h:.045,d:p.d,color:'#d1dccc'},g);if(y<1.73)for(let i=0;i<10;i++)product(kit,'ColdProduct',{x:-1.04+i*.23,y:FLOOR+y+.13,color:i%2?'#d7d0b9':'#b7cabc'},g);}
   const hinge=kit.replaceableGroup('MarketColdDoor',{x:-1.27,z:.39},g);hinge.userData.dayDoor={furniture:p.id,swing:-1.05};for(const x of [0,2.5])kit.box('ColdDoorFrame',{x,y:FLOOR+.93,w:.035,h:1.61,d:.035,color:'#96b2a0'},hinge);for(const y of [.13,1.73])kit.box('ColdDoorFrame',{x:1.25,y:FLOOR+y,w:2.5,h:.035,d:.035,color:'#96b2a0'},hinge);kit.box('ColdDoorHandle',{x:2.4,y:FLOOR+.85,w:.035,h:.32,d:.08,color:'#809d8e'},hinge);
   const selected=kit.replaceableGroup('MarketProduct:cold',{x:p.work.cold.x,y:FLOOR+p.work.cold.y,z:p.work.cold.z},g);selected.userData.marketProduct='cold';product(kit,'PickableColdPackage',{color:'#b7cabc'},selected);
  }else if(p.id==='basket-stack'){
   const g=kit.group(p.id,{x:p.x,z:p.z});kit.box('BasketStand',{y:FLOOR+.15,w:p.w,h:.3,d:p.d,color:'#cabba0'},g);for(let i=0;i<3;i++)shoppingBasket(kit,g,0,FLOOR+.36+i*.10,0);kit.sign('BasketLabel',{text:'购物篮',y:.85,z:.40,w:.8,h:.18},g);
  }else if(p.id==='checkout-counter'){
   const g=kit.table(p);kit.box('CheckoutFront',{y:FLOOR+.35,z:.39,w:p.w,h:.64,d:.07,color:'#a8b99d'},g);kit.box('CheckoutBelt',{x:-.45,y:FLOOR+p.top+.006,w:1.18,h:.012,d:.69,color:'#90a496'},g);
   kit.box('RegisterBase',{x:.63,y:FLOOR+p.top+.06,z:-.10,w:.44,h:.12,d:.34,color:'#c8cbbb'},g);kit.box('RegisterScreen',{x:.63,y:FLOOR+p.top+.27,z:-.17,w:.46,h:.31,d:.05,color:'#96afa1'},g);kit.box('RegisterDisplay',{x:.63,y:FLOOR+p.top+.27,z:-.204,w:.38,h:.22,d:.01,color:'#6a897e'},g);
   const item=kit.replaceableGroup('CheckoutProduct',{x:p.work.checkout.x,y:FLOOR+p.work.checkout.y,z:p.work.checkout.z},g);item.userData.marketPlaced='checkout';product(kit,'CheckoutPackage',{fruit:true},item);
   kit.sign('CheckoutLabel',{text:'收银',y:.38,z:.435,w:1.2,h:.22,color:'#a8b99d'},g);
  }else if(p.id==='packing-table'){
   const g=kit.table(p);const item=kit.replaceableGroup('PackingProduct',{x:p.work.packing.x,y:FLOOR+p.work.packing.y,z:p.work.packing.z},g);item.userData.marketPlaced='packing';product(kit,'PackingPackage',{},item);
   kit.box('PaperBagStack',{x:-.43,y:FLOOR+p.top+.025,w:.40,h:.05,d:.48,color:'#c6b08c'},g);
  }
 }
 kit.sign('MarketTitle',{text:'日常小超市',x:0,y:2.53,z:-4.34,w:3.2,h:.55,color:'#acb79b',ink:'#f8efdd'});
 kit.sign('ColdSign',{text:'冷藏',x:3.6,y:2.13,z:-4.34,w:1.6,h:.25});kit.sign('ProduceSign',{text:'蔬果',x:-3.5,y:2.13,z:-4.34,w:1.6,h:.25});
 kit.sign('MarketExit',{text:'出口 · 整理购物袋',x:-1.9,y:1.74,z:3.83,w:2.1,h:.23});
 return kit.finish();
}
