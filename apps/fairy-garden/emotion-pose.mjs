// 可选的整臂情绪表演；由 traveler 在同步骨架前应用，庭院原动作不传此参数。
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const beat=(p,a,b,c,d)=>ease((p-a)/(b-a))*(1-ease((p-c)/(d-c)));
export function emotionPose(face,p){
 const e=beat(p,0,.18,.76,1),late=beat(p,.42,.6,.78,1),q={left:[0,0,0],right:[0,0,0],tilt:0,roll:0,yaw:0,lift:0};
 switch(face){
 case 'chin': { // 收手托住下巴，歪头听一会儿，再轻轻点头收势
  const hold=beat(p,0,.24,.72,1),nod=beat(p,.58,.64,.68,.76);
  q.right=[-.32*hold,0,.35*hold];q.left=[-.12*hold,0,-.08*hold];q.rightElbow=-1.65*hold;q.chinHold=hold;
  q.roll=-.055*hold;q.tilt=.025*hold+.025*nod;q.yaw=-.045*hold;break;}
 case 'headpat': { // 先低头靠近手心，停留后抬起来
  const lean=beat(p,0,.24,.5,.88),look=beat(p,.62,.76,.84,1);
  q.tilt=.1*lean-.035*look;q.roll=-.035*lean;q.yaw=.07*look;
  q.left=[-.2*lean,0,-.08*lean];q.right=[-.3*lean,0,.08*lean];break;}
 case 'show': { // 展开手臂，左右转给你看，最后回正亮相
  const l=beat(p,.12,.3,.36,.5),r=beat(p,.42,.62,.7,.84);
  q.left=[-.35*e,0,-.4*e];q.right=[-.35*e,0,.4*e];q.yaw=-.8*l+.8*r;q.tilt=-.035*late;break;}
 case 'five-left':case 'five-right':case 'clap-left':case 'clap-right': {
  const side=face.endsWith('left')?'left':'right',sign=side==='left'?-1:1,clap=face.startsWith('clap-');
  const reach=clap?1-ease((p-.55)/.45):beat(p,0,.22,.85,1);
  q[side]=[(-1.95-(clap?.16*Math.sin(p*Math.PI*2):0))*reach,0,sign*.65*reach];
  q[side==='left'?'right':'left']=[-.15*reach,0,-sign*.12*reach];q.roll=sign*.035*reach;break;}
 case 'dodge-left':case 'dodge-right': {
  const sign=face.endsWith('left')?-1:1,away=beat(p,0,.16,.35,.66);
  q.roll=sign*.11*away;q.yaw=sign*.25*away;q.tilt=-.06*away;
  q.right=[-.7*late,0,.2*late];q.left=[-.2*e,0,-.1*e];break;}

 case 'beckon': { // 先伸手邀请，再朝自己收两次，最后留手等你
  const call=beat(p,.2,.32,.65,.82),curl=(.5-.5*Math.cos((p-.2)*Math.PI*8))*call;
  q.right=[-1.15*e-.48*curl,0,-.18*e];q.left=[-.2*e,0,-.12*e];q.tilt=.055*e;q.yaw=-.12*e;break;}
 case 'dance': { // 左右交替摆臂，身体轻轻跟拍，脚下保持原位
  const sway=Math.sin(p*Math.PI*6)*e;
  q.left=[(-.8+.48*Math.sin(p*Math.PI*6))*e,0,-.42*e];q.right=[(-.8-.48*Math.sin(p*Math.PI*6))*e,0,.42*e];q.roll=.09*sway;q.yaw=.13*sway;break;}
 case 'bow': // 双臂略展开，欠身停一拍，抬起来再伸手致意
  q.left=[-.25*e,0,-.32*e];q.right=[-.25*e-.7*late,0,.32*e];q.tilt=.15*beat(p,.1,.3,.48,.7);q.yaw=-.13*late;break;
 case 'shrug': { // 摊开两手，向左右各歪一下，再收回来
  const first=beat(p,.12,.28,.4,.56),second=beat(p,.45,.6,.72,.9);
  q.left=[-.95*e,0,-.62*e];q.right=[-.95*e,0,.62*e];q.roll=.075*first-.075*second;q.tilt=-.025*e;break;}
 case 'peek': { // 向两侧探看，最后转回你这边并抬一下手
  const left=beat(p,.05,.22,.3,.5),right=beat(p,.35,.53,.65,.85);
  q.yaw=-.38*left+.38*right;q.roll=-.055*left+.055*right;q.right=[-.8*late,0,.16*late];q.left=[-.15*e,0,-.14*e];break;}

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
