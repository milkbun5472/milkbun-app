import {homePoint} from './initiative.mjs?v=fg-aa215f3b04f25467';
// Parcel obligations are separate from the pet's own inventory and work souvenirs.
export const COURIER_DOORS=[{id:'bakery',title:'面包店',label:'麦穗门牌'},{id:'florist',title:'花店',label:'小花门牌'},{id:'cafe',title:'咖啡店',label:'杯子门牌'}];
const kinds=['一包新的纸杯','一卷包花纸','一盒烘焙纸'];
const door=id=>COURIER_DOORS.find(d=>d.id===id);
const bounded=(n,max=10000)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
export function restoreDelivery(raw){
 if(!raw||typeof raw.id!=='string'||!raw.id||raw.id.length>80||!door(raw.to)||!door(raw.wrong)||raw.to===raw.wrong||!kinds.includes(raw.parcel))return null;
 return {id:raw.id,to:raw.to,wrong:raw.wrong,parcel:raw.parcel,issue:['normal','absent','wrong'].includes(raw.issue)?raw.issue:'normal',pickup:raw.pickup==='home'?'home':'store',picked:raw.picked===true,status:['sealed','carrying','delivered','returning','returned','holding'].includes(raw.status)?raw.status:'sealed',activeWrong:raw.activeWrong===true,revisit:['away','back'].includes(raw.revisit)?raw.revisit:'',attempts:bounded(raw.attempts,1),revision:bounded(raw.revision,20),followup:typeof raw.followup==='string'?raw.followup.slice(0,200):'',holdPlaced:raw.holdPlaced===true&&!!homePoint(raw.position),position:homePoint(raw.position)};
}
export function restoreCourier(raw){
 const pending=restoreDelivery(raw?.pending);
 return {pending:pending&&['carrying','holding'].includes(pending.status)?pending:null,routes:Object.fromEntries(COURIER_DOORS.map(d=>[d.id,{visits:bounded(raw?.routes?.[d.id]?.visits),like:Math.max(-1,Math.min(1,Number(raw?.routes?.[d.id]?.like)||0))}])),log:(Array.isArray(raw?.log)?raw.log:[]).filter(x=>typeof x?.id==='string'&&door(x.to)&&['delivered','returned','holding'].includes(x.status)).slice(-30).map(x=>({id:x.id.slice(0,80),to:x.to,status:x.status,day:bounded(x.day,1e7),text:String(x.text||'').slice(0,240)}))};
}
export function newDelivery(id,random,courier){
 if(courier.pending)return {...structuredClone(courier.pending),issue:'normal',pickup:courier.pending.holdPlaced?'home':'store',picked:false,status:'sealed',activeWrong:false,revisit:'',attempts:0,revision:0,holdPlaced:false};
 const weights=COURIER_DOORS.map(d=>Math.max(.4,1+courier.routes[d.id].like*.5));let pick=random()*weights.reduce((a,b)=>a+b,0),index=0;
 while(index<weights.length-1&&pick>=weights[index])pick-=weights[index++];
 const last=courier.log.at(-1),followup=last?.status==='returned'?'上次送到'+door(last.to).title+'的包裹已交回柜台；店员记得这次先和它核对门牌。':last?.status==='delivered'?'上次它送好了'+door(last.to).title+'的包裹，柜台还留着那张签收回执。':'';
 return restoreDelivery({id,followup,to:COURIER_DOORS[index].id,wrong:COURIER_DOORS[(index+1)%3].id,parcel:kinds[Math.floor(random()*kinds.length)],issue:['normal','absent','wrong'][Math.floor(random()*3)]});
}
export function courierStop(job){const d=job?.delivery;if(!d)return 'store';return job.index===0?d.pickup:job.index===1?d.revisit==='away'?'store':d.activeWrong?d.wrong:d.to:d.status==='holding'&&!d.holdPlaced?'home':'store';}
const option=(id,label,note,tip=0,like=.05,extras={})=>({id,label,note,tip,like,...extras});
export function courierEvent(job){
 const d=job?.delivery;if(!d||job.phase!=='choice')return null;const to=door(d.to);
 let title,text,options;
 if(job.index===0){title=d.pickup==='home'?'把暂放的包裹带上':'代收点交来一份小包裹';text=d.parcel+'，标签写着「'+to.title+' · '+to.label+'」。'+(d.pickup==='home'?'这是上次没人收件时留在家里的原包裹。':'先认清标签，再沿街区送过去。');options=[option('check','核对门牌再出发','仔细核对了收件门牌，再把原包裹带上。',2,.07,{trait:'bold'}),option('memory','让它按记住的方向试试','把包裹带上，先按记住的方向找门牌。',0,.04,{trait:'active'})];}
 else if(job.index===2){title='回到代收点交回执';text=d.status==='delivered'?'原包裹已经交到'+to.title+'，回执上留好了这一趟的门牌。':d.status==='holding'?'原包裹已实际带回家暂放，柜台记下明天继续送。':'原包裹带回了代收点，可以交回柜台。';options=[option('receipt','核对并收好这趟回执','在代收点核对了这一趟的回执。',2,.06,{routeLike:.03}),option('easy','慢慢收尾，歇一会儿','交回这一趟的回执，给它留了一点喘口气的时间。',0,.08,{energy:5,routeLike:.06})];}
 else if(d.activeWrong){title='门牌对不上';text='走到了'+door(d.wrong).title+'，门牌和原标签不一样。包裹还封着，得再拿个主意。';options=[option('redirect','核对标签，重新送到原地址','在门边核对了标签，包裹保持原封，准备重新送。'+(d.wrong==='florist'?'花店把落下的花瓣留给了它。':''),0,.07,{trait:'bold',...(d.wrong==='florist'?{petals:1}:{}),routeLike:-.02}),option('return','把原包裹带回代收点','这次先把原包裹带回代收点，不留给错误的门牌。',0,.05,{routeLike:-.04})];}
 else if(d.issue==='absent'&&!d.attempts){title='这会儿没人收件';text=to.title+'的门牌核对好了，门边留着稍后回来的小牌子。原包裹仍在它身边。';options=[option('revisit','回代收点看看，再送一趟','先带原包裹回代收点，稍后再走到同一扇门。',0,.04,{routeLike:.02}),option('hold','带回家暂放，下一班继续送','准备把原包裹带回家暂放；它仍属于收件人。',0,.08,{routeLike:-.02}),option('return','把原包裹交回代收点','这次准备把原包裹交回代收点，交由店里安排。',0,.04,{routeLike:-.03})];}
 else{title=d.attempts?'第二趟等到了收件人':'到了标签上的门口';text=to.title+' · '+to.label+'。'+(d.attempts?'门边的小牌子收起来了，这次有人确认标签。':'收件人核对了标签，可以把原包裹交过去。');options=[option('deliver','确认门牌，把包裹交过去','在正确门牌交出了原包裹，收好签收记录。',4,.05,{trait:'social',routeLike:.05}),option('gentle','给它缓一会儿，再交给收件人','在正确门牌缓了缓，再把原包裹交给收件人。',2,.09,{energy:3,routeLike:.09})];}
 if(job.index===0&&d.followup)text=d.followup+' '+text;
 return {id:job.id+':'+job.index+':'+d.revision,title,text,options};
}
export function chooseCourier(job,id){const d=job.delivery;let next=true;
 if(job.index===0){d.picked=true;d.status='carrying';d.activeWrong=id==='memory'&&d.issue==='wrong';}
 else if(job.index===1){if(id==='redirect'){d.activeWrong=false;next=false;}else if(id==='revisit'){d.revisit='away';next=false;}else if(id==='return')d.status='returning';else if(id==='hold')d.status='holding';else d.status='delivered';}
 else if(d.status==='returning')d.status='returned';
 d.revision++;return next;
}
// Only the actual arrival room can advance a detour or place an entrusted parcel.
export function courierArrival(job,courier,position){const d=job.delivery;
 if(job.index===1&&d.revisit==='away'){d.revisit='back';d.attempts=1;d.revision++;return '回到代收点看过了，再沿原路送到收件门牌。';}
 if(job.index===2&&d.status==='holding'&&!d.holdPlaced){if(!homePoint(position))return null;d.holdPlaced=true;d.position=position?{...position}:null;courier.pending=structuredClone(d);return '原包裹已经带回家暂放，回代收点交回执吧。';}
 return '';
}
export function keepCourierParcel(job,courier){const d=job?.delivery;if(!d?.picked||!['carrying','holding','returning'].includes(d.status))return;courier.pending={...structuredClone(d),status:d.holdPlaced?'holding':'carrying'};}
export function finishCourier(job,courier,day){const d=job.delivery,route=courier.routes[d.to];if(d.status==='delivered'){route.visits++;if(courier.pending?.id===d.id)courier.pending=null;}route.like=Math.max(-1,Math.min(1,route.like+(d.status==='delivered'?.04:0)));const text=d.status==='delivered'?'送到'+door(d.to).title+'，原包裹已签收。':d.status==='holding'?'原包裹暂放家里，下一班继续送到'+door(d.to).title+'。':'原包裹已交回代收点。';courier.log.push({id:job.id,to:d.to,day,status:d.status,text});courier.log=courier.log.slice(-30);return text;}
export function deliveryView(job){const d=job?.delivery;if(!d)return null;const target=courierStop(job);return {id:d.id,parcel:d.parcel,to:d.to,address:door(d.to).title+' · '+door(d.to).label,destination:target,destinationTitle:target==='home'?'家里':target==='store'?'便利店代收点':door(target).title,status:d.status,picked:d.picked,holdPlaced:d.holdPlaced,attempts:d.attempts};}
export function courierView(c){return {pending:c.pending?{id:c.pending.id,parcel:c.pending.parcel,address:door(c.pending.to).title+' · '+door(c.pending.to).label,location:c.pending.holdPlaced?'家里暂放':'仍随身带着',position:c.pending.position}:null,routes:COURIER_DOORS.map(d=>({...d,...c.routes[d.id]})),log:structuredClone(c.log)};}
