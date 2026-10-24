// 可选的整臂情绪表演；由 traveler 在同步骨架前应用，庭院原动作不传此参数。
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const beat=(p,a,b,c,d)=>ease((p-a)/(b-a))*(1-ease((p-c)/(d-c)));
export function emotionPose(face,p){
 const e=beat(p,0,.18,.76,1),late=beat(p,.42,.6,.78,1),q={left:[0,0,0],right:[0,0,0],tilt:0,roll:0,yaw:0,lift:0};
 switch(face){
 case 'heart': // 双手在胸前围成心形，停留后轻轻收回
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[-.34,-1.48,1.65];q.headPoint=[.34,-1.48,1.65];}
  q.heart=e;q.headRoll=-.045*e;break;
 case 'thumb': // 屈肘把大拇指举到肩前，朝你点一下
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[1.1,-1.5+.08*late,1.45];q.thumb=e;q.tilt=-.025*e;q.headNod=.025*late;break;
 case 'wink':
  q.wink=beat(p,.16,.24,.52,.68);q.headRoll=-.075*e;q.right=[-.5*e,0,.2*e];q.left=[-.12*e,0,-.12*e];break;
 case 'tongue':
  q.tongue=beat(p,.16,.27,.57,.76);q.headRoll=.055*e;q.headNod=-.025*e;q.right=[-.15*e,0,.12*e];break;
 case 'cry': { // 眼泪滑落，抬手抹一边眼角，缓一缓再收手
  const wipe=beat(p,.2,.36,.64,.86),hiccup=Math.sin(p*Math.PI*10)*beat(p,.18,.3,.65,.84);
  q.right=[-.32*wipe,0,.35*wipe];q.rightElbow=-1.65*wipe;q.headHold=wipe;
  if(wipe)q.headPoint=[.62+.08*Math.sin(p*Math.PI*8),-.48,1.55];
  q.cry=e;q.tearPhase=(p*2%1)*e;q.headNod=.055*e+.018*hiccup;q.roll=.012*hiccup;break;}
 case 'tilt':
  q.headRoll=-.23*e+.12*late;q.headNod=.025*e;q.left=[-.12*e,0,-.1*e];q.right=[-.12*e,0,.1*e];break;
 case 'poke':case 'pinch': { // 朝屏幕前伸出食指，或把拇指与食指轻轻捏合
  const reach=beat(p,.16,.4,.66,.9),tap=Math.sin(p*Math.PI*8)*beat(p,.36,.44,.64,.78);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.68-.4*reach,-1.45,1.15+1.55*reach+.08*tap];
  q[face]=e;q.pinchTap=face==='pinch'?tap:0;q.headRoll=-.045*e;break;}
 case 'lie':case 'prone': {
  const down=beat(p,.04,.32,.68,.98),prone=face==='prone';
  q.roll=-1.42*down;q.tilt=(prone?.92:-.14)*down;q.ground=down;
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=prone?[-.6,-1.15,1.25]:[-1.5,-1.25,.4];q.headPoint=prone?[.6,-1.15,1.25]:[.7,-1.75,1.1];}
  q.headNod=prone?-.24*down:0;break;}
 case 'phone':
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[-.25,-1.85,1.1];q.headPoint=[.35,-1.4,1.7];}
  q.phone=e;q.phoneTap=(.5-.5*Math.cos(p*Math.PI*18))*beat(p,.2,.32,.66,.82);q.headNod=.12*e;break;
 case 'eat': {
  const bite=beat(p,.18,.38,.53,.73),chew=Math.sin(p*Math.PI*14)*beat(p,.43,.52,.72,.86);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.9-.7*bite,-1.95+.85*bite,1.3+.25*bite];
  q.cookie=e;q.bite=e*ease((p-.43)/.12);q.headNod=.018*chew;q.headRoll=-.03*e;break;}
 case 'hips': // 两手搭在腰侧，手肘向外，挺直身子得意地看过来
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;
  q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[-.85,-2.35,.6];q.headPoint=[.85,-2.35,.6];}
  q.elbowsOut=e;q.tilt=-.055*e;q.yaw=-.18*e+.1*late;break;
 case 'selfhug': { // 双手环向自己的两侧，慢慢晃一晃，再松开
  const sway=Math.sin((p-.18)*Math.PI*4)*beat(p,.18,.3,.67,.84);
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;
  q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[.78,-1.28,1.25];q.headPoint=[-.78,-1.43,1.12];}
  q.roll=.065*sway;q.tilt=.035*e;q.yaw=.06*sway;break;}
 case 'peekaboo': { // 先捂住双眼，再向两旁打开手，露出脸停一拍
  const reveal=ease((p-.43)/.22);
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;
  q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[-.55-1.05*reveal,-.06-.6*reveal,1.6-.3*reveal];q.headPoint=[.55+1.05*reveal,-.06-.6*reveal,1.6-.3*reveal];}
  q.roll=-.04*e+.085*reveal*e;q.tilt=.025*e;break;}
 case 'sneeze': { // 手先掩住鼻口，蓄一口气，短促地向前打一次喷嚏
  const inhale=beat(p,.12,.24,.3,.4),achoo=beat(p,.32,.39,.41,.56);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.18,-.45,1.50];
  q.left=[-.22*e,0,-.16*e];q.tilt=-.045*inhale+.16*achoo;q.roll=-.025*e;q.yaw=-.04*achoo;break;}
 case 'gift': { // 双手托着礼盒从胸前送出来，留一会儿再收回
  const offer=beat(p,.19,.43,.72,.94);
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;
  q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[-.53,-1.85,1.15+1.15*offer];q.headPoint=[.53,-1.85,1.15+1.15*offer];}
  q.gift=beat(p,.08,.18,.84,.98);q.tilt=.035*offer;break;}
 case 'sign': { // 从身侧举起写着「想你」的小纸牌，轻轻晃给你看
  const raise=beat(p,.12,.36,.74,.94),sway=Math.sin(p*Math.PI*6)*beat(p,.35,.46,.69,.82);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[1.32+.10*sway,-2.12+.48*raise,1.3+.3*raise];
  q.left=[-.14*e,0,-.14*e];q.sign=beat(p,.08,.18,.84,.98);q.signSway=.08*sway;q.roll=-.03*e;break;}
 case 'cheeks': // 双手贴在脸颊两侧，歪过头停一会儿，再慢慢收手
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;
  q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[-.75,-.78,1.10];q.headPoint=[.75,-.78,1.10];}
  q.roll=-.065*e+.035*late;q.yaw=.035*e;break;
 case 'plead': { // 双手合在胸前，身体轻轻欠下，再抬眼等回应
  const bow=beat(p,.24,.42,.56,.78);
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;
  q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[-.14,-.95,1.25];q.headPoint=[.14,-.95,1.25];}
  q.tilt=.075*bow;q.roll=.025*late;break;}
 case 'crossarms': // 两手搭向相对的手臂，一前一后交叉，偏身等一会儿再看回来
  q.left=[-.32*e,0,-.35*e];q.right=[-.32*e,0,.35*e];q.leftElbow=q.rightElbow=-1.65*e;
  q.leftHeadHold=q.headHold=e;
  if(e){q.leftHeadPoint=[.64,-1.47,1.38];q.headPoint=[-.64,-1.65,1.12];}
  q.yaw=.22*e-.16*late;q.tilt=-.025*e;break;
 case 'scratch': { // 手绕到后脑勺，小幅挠两下，再落回身侧
  const rub=Math.sin(p*Math.PI*10)*beat(p,.24,.34,.64,.78);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[1.05,.06+.06*rub,-.90+.045*rub];
  q.left=[-.15*e,0,-.10*e];q.roll=-.045*e;q.yaw=-.17*e;q.tilt=.03*e;break;}
 case 'rubeyes': { // 低头把手停在眼前，揉两下后慢慢放下来
  const rub=beat(p,.24,.34,.62,.78),phase=p*Math.PI*12;
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.50+.055*Math.sin(phase)*rub,.04+.045*Math.cos(phase)*rub,1.38];
  q.left=[-.15*e,0,-.08*e];q.tilt=.065*e-.025*late;q.roll=-.025*e;break;}
 case 'flower': { // 先拿在身侧，再伸到面前等你收，最后把手收回来
  const offer=beat(p,.18,.42,.72,.92);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.9-.22*offer,-1.95+.1*offer,1.0+1.35*offer];
  q.left=[-.14*e,0,-.14*e];q.flower=beat(p,.08,.18,.84,.98);q.tilt=.035*offer;q.roll=-.025*e;break;}
 case 'kiss': { // 手先停在嘴前，再把飞吻送出去，最后收手
  const send=ease((p-.34)/.3);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.18,-.45-.6*send,1.36+.92*send];
  q.left=[-.18*e,0,-.16*e];q.tilt=.035*e;q.roll=-.035*e;break;}
 case 'giggle': { // 捂住嘴边，肩膀轻轻笑两下
  const laugh=Math.sin(p*Math.PI*10)*beat(p,.22,.32,.62,.78);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.48,-.35,1.36];
  q.left=[-.16*e,0,-.1*e];q.tilt=.045*e+.012*laugh;q.roll=-.045*e+.012*laugh;break;}
 case 'listen': // 把手拢到耳边，侧过头听，停一拍再点头
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[1.38,-.12,.6];
  q.left=[-.12*e,0,-.12*e];q.roll=-.065*e;q.yaw=-.12*e;q.tilt=.04*late;break;
 case 'promise': { // 屈肘收手到胸前，拍两下，再挺直身子
  const tap=beat(p,.2,.28,.32,.4)+beat(p,.44,.52,.56,.64);
  q.right=[-.32*e,0,.35*e];q.rightElbow=-1.65*e;q.headHold=e;
  if(e)q.headPoint=[.38,-1.27,1.04-.12*tap];
  q.left=[-.1*e,0,-.22*e];q.tilt=-.045*e;q.yaw=-.08*e;break;}
 case 'cheer': { // 两只手屈肘举起来，交替向上打气
  const pump=Math.sin(p*Math.PI*6)*beat(p,.16,.28,.64,.8);
  q.left=[(-1.8-.25*pump)*e,0,-.5*e];q.right=[(-1.8+.25*pump)*e,0,.5*e];
  q.leftElbow=-1.15*e;q.rightElbow=-1.15*e;q.roll=.04*pump;q.tilt=-.025*e;break;}
 case 'refuse': { // 手在身前左右摆，身体跟着摇头的方向轻转
  const shake=Math.sin((p-.14)*Math.PI*8)*beat(p,.12,.24,.64,.84);
  q.right=[-1.65*e,0,(.34+.26*shake)*e];q.left=[-.12*e,0,-.14*e];
  q.yaw=.17*shake;q.roll=.025*shake;break;}
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
