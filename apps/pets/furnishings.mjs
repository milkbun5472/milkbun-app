import {homePoint} from './room-layout.mjs?v=fg-f607296e23d1060e';
import {petHomePlaces,PET_STATIONS} from './room-layout.mjs?v=fg-f607296e23d1060e';

// Inventory owns purchases; this records only how the same objects are used.
export const PET_HOME_GOODS=[
 {id:'cloudBed',name:'云朵软窝',selfName:'自己挑的云朵软窝',cost:38,count:1,max:1,icon:'home',kind:'rest',text:'低低的软窝，摆好以后可以自己走过去趴睡。'},
 {id:'roundMat',name:'焦糖圆垫',selfName:'自己挑的焦糖圆垫',cost:18,count:1,max:1,icon:'home',kind:'rest',text:'软软的小圆垫，可以换一个舒服角落。'},
 {id:'bellBall',name:'铃铛小球',selfName:'自己挑的铃铛小球',cost:16,count:1,max:1,icon:'ball',kind:'toy',text:'带小铃铛的球，选好后用它陪玩和练叼回来。'},
 {id:'bandana',name:'雾蓝小方巾',selfName:'自己挑的小方巾',cost:12,count:1,max:1,icon:'paw',kind:'wear',text:'系在胸前的小方巾，动作时跟着它一起动。'},
 {id:'bow',name:'莓果小领结',selfName:'自己挑的小领结',cost:12,count:1,max:1,icon:'paw',kind:'wear',text:'小小的莓果色领结，随时可以摘下。'},
 {id:'wreath',name:'花童小花环',count:1,max:1,icon:'leaf',kind:'wear',text:'陪完婚礼布花后带回的小花环。'}
];
export const HOME_SLOTS=[{id:'corner',name:'自己的角落'},{id:'rug',name:'地毯旁'}];
export const homeGood=id=>PET_HOME_GOODS.find(x=>x.id===id);
export function restoreFurnishings(raw,inventory={}){
 const placements=Object.fromEntries(PET_HOME_GOODS.filter(x=>x.kind==='rest'&&inventory[x.id]>0).map(x=>[x.id,raw?.placements?.[x.id]==='free'&&homePoint(raw?.positions?.[x.id])?'free':HOME_SLOTS.some(p=>p.id===raw?.placements?.[x.id])?raw.placements[x.id]:'corner']));
 const positions=Object.fromEntries(Object.entries(raw?.positions||{}).filter(([id,p])=>placements[id]&&homePoint(p)).map(([id,p])=>[id,{...homePoint(p),yaw:Number.isFinite(p.yaw)?p.yaw:0}]));return {placements,positions,sleep:placements[raw?.sleep]?raw.sleep:Object.keys(placements)[0]||'',toy:raw?.toy==='bellBall'&&inventory.bellBall>0?'bellBall':'',wear:homeGood(raw?.wear)?.kind==='wear'&&inventory[raw.wear]>0?raw.wear:'',recent:Array.isArray(raw?.recent)?raw.recent.filter(x=>typeof x?.text==='string').slice(-8).map(x=>({text:x.text.slice(0,180),by:typeof x.by==='string'?x.by.slice(0,24):'你'})):[]};
}
export function furniturePoint(state,index=0,item=state.furnishings?.sleep){
 const custom=state.furnishings?.positions?.[item];if(custom&&homePoint(custom))return {...custom};const places=petHomePlaces(PET_STATIONS[index]),slot=state.furnishings?.placements?.[item];
 return slot==='rug'?{x:places.rug.x+(index%2?-.75:.75),z:places.rug.z+.65,yaw:-.5}:index?{...places.bed}:{x:-.85,z:1.8,yaw:-.5};
}
export function furnishingFacts(state={}){
 return {sleep:homeGood(state.furnishings?.sleep)?.name||'',toy:homeGood(state.furnishings?.toy)?.name||'',wear:homeGood(state.furnishings?.wear)?.name||'',items:PET_HOME_GOODS.filter(x=>state.inventory?.[x.id]>0).map(x=>({...x,slot:state.furnishings?.placements?.[x.id]||'',slotName:state.furnishings?.placements?.[x.id]==='free'?'自己挑的位置':HOME_SLOTS.find(p=>p.id===state.furnishings?.placements?.[x.id])?.name||'',active:[state.furnishings?.sleep,state.furnishings?.toy,state.furnishings?.wear].includes(x.id)})),slots:HOME_SLOTS.map(x=>({...x})),recent:structuredClone(state.furnishings?.recent||[])};
}
export function arrangeFurnishing(state,action,{item,slot,point,by='你'}={},care,{atHome=false,canPlace=()=>true,startRest}={}){
 if(!atHome)return {accepted:false,text:'先实际回到家里，再摆好自己的东西。'};
 const idle=care.task?.source==='self'&&['watch','wander'].includes(care.task.kind)&&!care.task.socialId&&!care.task.target;
 if(state.job||care.task&&!idle||care.helper)return {accepted:false,text:'等它空下来，再换小窝或配饰。'};
 const good=homeGood(item),f=state.furnishings;
 if(action==='undress'){f.wear='';f.recent.push({by:'你',text:'你把小配饰摘下收好了。'});f.recent=f.recent.slice(-8);return {accepted:true,text:'小配饰摘下收好了。'};}
 if(!good||!state.inventory[item])return {accepted:false,text:'先用自己的钱买下，或把工作袋带回家拆开。'};
 let text='';
 if(action==='move-furniture'&&good.kind==='rest'){const p=homePoint(point);if(!p||!canPlace(item,{...p,yaw:point.yaw||0}))return {accepted:false,text:'这里会挤到家具、同伴或门口，换个空一点的位置。'};f.positions=f.positions||{};f.positions[item]={...p,yaw:Number.isFinite(point.yaw)?point.yaw:0};f.placements[item]='free';f.sleep=item;text='把'+good.name+'挪到自己挑的角落，它可以实际走过去睡。';}
 else if(action==='furnish'&&good.kind==='rest'&&(HOME_SLOTS.some(x=>x.id===slot)||slot==='free'&&homePoint(f.positions?.[item]))){
  if(!canPlace(item,slot))return {accepted:false,text:'这个角落现在放不下，换一个位置试试。'};
  f.placements[item]=slot;if(slot!=='free'&&f.positions)delete f.positions[item];f.sleep=item;text='把'+good.name+'摆在'+(slot==='free'?'自己挑的位置':HOME_SLOTS.find(x=>x.id===slot).name)+'，留给它自己选择休息。';
 }else if(action==='furnish'&&good.kind==='toy'){f.toy=item;text='把'+good.name+'拿出来，陪玩和叼回都用这颗球。';}
 else if(action==='wear'&&good.kind==='wear'){f.wear=item;text='给它戴好'+good.name+'。';}
 else if(action==='own-rest'&&good.kind==='rest'){
  if(!f.placements[item]||!canPlace(item,f.placements[item]))return {accepted:false,text:'先找个能走过去的位置摆好小窝。'};
  const previous=f.sleep;f.sleep=item;const r=startRest?.('own');if(!r?.accepted){f.sleep=previous;return r||{accepted:false,text:'这会儿还不想休息。'};}text='它准备走到自己的'+good.name+'里歇歇。';
 }else return {accepted:false,text:'选好想摆放或穿戴的东西吧。'};
 by=typeof by==='string'?by.slice(0,24):'你';f.recent.push({by,text:by+text});f.recent=f.recent.slice(-8);return {accepted:true,text};
}
