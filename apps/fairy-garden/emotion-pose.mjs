// 可选的整臂情绪表演；由 traveler 在同步骨架前应用，庭院原动作不传此参数。
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const beat=(p,a,b,c,d)=>ease((p-a)/(b-a))*(1-ease((p-c)/(d-c)));
export function emotionPose(face,p){
 const e=beat(p,0,.18,.76,1),late=beat(p,.42,.6,.78,1),q={left:[0,0,0],right:[0,0,0],tilt:0,roll:0,yaw:0,lift:0};
 switch(face){
 case 'default': // 一只手抬到身前，歪一下身子，像在问你要不要过来
  q.right=[-.95*e,0,-.3*e];q.roll=-.06*e;q.yaw=-.16*e;break;
 case 'happy': // 朝你招手，另一手自然张开，身体跟着招呼轻晃
  q.right=[-2.15*e,0,(.35+Math.sin(p*Math.PI*8)*.27)*e];q.left=[-.25*e,0,-.2*e];q.roll=.055*Math.sin(p*Math.PI*4)*e;break;
 case 'amazed':{ // 双手欢呼，起势后蹦一次，再停住看你
  q.left=[-2.55*e,0,-.5*e];q.right=[-2.55*e,0,.5*e];const j=(p-.24)/.3;q.lift=j>0&&j<1?.075*Math.sin(j*Math.PI)**2:0;q.tilt=-.025*e;break;}
 case 'cozy': // 两手向你打开，靠近一点，像邀你抱抱
  q.left=[-1.05*e,0,-.42*e];q.right=[-1.05*e,0,.42*e];q.tilt=.055*e;q.roll=.045*e;break;
 case 'relax': // 两臂舒展开，向一边伸再慢慢回来
  q.left=[-1.85*e,0,-.75*e];q.right=[-1.65*e,0,.75*e];q.roll=-.08*e+.1*late;q.tilt=-.035*e;break;
 case 'surprise':{ // 双手先抬起一缩，随后放低手凑过来看
  const start=beat(p,0,.12,.3,.55);q.left=[-1.3*start-.45*late,0,-.26*e];q.right=[-1.3*start-.45*late,0,.26*e];q.tilt=-.09*start+.075*late;q.yaw=.1*late;break;}
 case 'proud': // 手臂向外摆，挺胸亮相，留一拍等回应
  q.left=[-.12*e,0,-.42*e];q.right=[-.5*e,0,.5*e];q.tilt=-.065*e;q.yaw=-.28*e+.14*late;break;
 case 'gloomy': // 手垂在身前、低下身子，缓慢叹气后稍稍回望
  q.left=[-.32*e,0,.12*e];q.right=[-.32*e,0,-.12*e];q.tilt=.09*e-.05*late;q.yaw=-.2*e+.16*late;break;
 case 'sad': // 双手收在身前，低头后向你伸出一只手
  q.left=[-.55*e,0,.24*e];q.right=[-.55*e-.5*late,0,-.24*e];q.tilt=.1*e-.075*late;q.roll=.045*e;break;
 case 'irritated': // 手甩向两旁、别过身，停一会儿又回头看你
  q.left=[-.18*e,0,-.34*e];q.right=[-.18*e,0,.34*e];q.yaw=.62*e-.48*late;q.tilt=-.035*e;break;
 }
 return q;
}
