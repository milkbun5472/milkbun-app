// 陪伴整页和悬浮窗共用；脚下不持续弹跳，情绪动作之间留出休息。
export const MOODS={
 default:{tilt:0,yaw:0,sway:.025,every:9,acts:['emotion-default']},
 happy:{tilt:-.008,yaw:0,sway:.04,every:9,acts:['emotion-happy']},
 amazed:{tilt:-.018,yaw:0,sway:.035,every:9,acts:['emotion-amazed']},
 cozy:{tilt:.012,yaw:.035,sway:.035,every:9,acts:['emotion-cozy']},
 relax:{tilt:.015,yaw:-.025,sway:.02,every:9,acts:['emotion-relax']},
 surprise:{tilt:-.018,yaw:0,sway:.012,every:9,acts:['emotion-surprise']},
 proud:{tilt:-.025,yaw:.09,sway:.025,every:9,acts:['emotion-proud']},
 gloomy:{tilt:.03,yaw:-.04,sway:.012,every:9,acts:['emotion-gloomy']},
 sad:{tilt:.045,yaw:.07,sway:.008,every:9,acts:['emotion-sad']},
 irritated:{tilt:.008,yaw:.16,sway:.012,every:9,acts:['emotion-irritated']}
};
export const DUR={wave:3.4,stretch:4.8,tea:5,read:7,sit:8,hop:1.8,jolt:1.8,nod:2.6,sigh:4,stomp:2.2,turn:3.6,look:3,shy:3.2,yawn:4.8,wake:2.8,land:1};
for(const face of Object.keys(MOODS))DUR['emotion-'+face]=['sad','gloomy','relax'].includes(face)?5.6:4.6;
export const EXTRA_ACTIONS={
 beckon:{duration:4.8,moods:['default','cozy','sad']},
 dance:{duration:5.2,moods:['happy','amazed','proud']},
 bow:{duration:4.8,moods:['happy','cozy','relax','proud']},
 shrug:{duration:4.8,moods:['surprise','gloomy','irritated']},
 peek:{duration:5.2,moods:['default','relax','surprise','gloomy','sad','irritated']}
};
for(const [name,action] of Object.entries(EXTRA_ACTIONS)){
 const key='emotion-'+name;DUR[key]=action.duration;
 for(const mood of action.moods)MOODS[mood].acts.push(key);
}
// 待机和单点共用选片：只有一个候选时才允许重复，不改角色心情。
export function chooseAction(pool,last,random=Math.random){
 const fresh=pool.filter(k=>k!==last),choices=fresh.length?fresh:pool;
 return choices[Math.floor(random()*choices.length)];
}
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// 到位后稍作停留，收势比起势慢；两端速度为零。
export const pulse=(p,inEnd=.25,outStart=.52)=>smooth(p/inEnd)*(1-smooth((p-outStart)/(1-outStart)));
export function moodBase(face,t){const m=MOODS[face]||MOODS.default;return {y:0,tilt:m.tilt,yaw:m.yaw+Math.sin(t*.38)*m.sway};}
export function accent(kind,p){
 const e=pulse(p),a={dy:0,dtilt:0,dyaw:0};
 switch(kind){
 case 'hop':{const q=(p-.2)/.48;a.dy=q>0&&q<1?.045*Math.sin(Math.PI*q)**2:0;a.dtilt=.025*pulse(p,.15,.2)-.018*pulse(p,.55,.65);break;}
 case 'jolt':a.dtilt=-.035*pulse(p,.15,.28);break;
 case 'nod':a.dtilt=.045*pulse(p,.3,.4);break;
 case 'sigh':a.dtilt=.025*pulse(p,.42,.55);break;
 case 'stomp':a.dtilt=.012*e;a.dyaw=-.055*e;break; // 不再借用走路循环在原地踏步
 case 'turn':a.dyaw=.22*e;a.dtilt=.012*e;break;
 case 'shy':a.dtilt=.04*e;a.dyaw=.12*e;break;
 case 'land':a.dtilt=.025*e;break;
 }
 return a;
}
