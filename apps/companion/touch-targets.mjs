// 屏幕触点只负责命中判定；坐标由当前帧的真实手握点和头锚投影提供。
export function targetAt(x,y,targets){
 const hands=targets.filter(t=>t.kind==='hand'&&t.visible!==false).map(t=>({t,d:Math.hypot(x-t.x,y-t.y)/t.radius})).filter(v=>v.d<=1).sort((a,b)=>a.d-b.d);
 if(hands.length)return {...hands[0].t};
 const face=targets.find(t=>t.kind==='face'&&t.visible!==false&&((x-t.x)/t.rx)**2+((y-t.y)/t.ry)**2<=1);
 return face?{...face,side:x<face.x?'left':'right'}:null;
}
export function highFiveHit(act,side,now,duration){
 if(!act||act.kind!=='emotion-five-'+side)return false;
 const p=(now-act.start)/duration;
 return p>=.22&&p<=.85;
}
