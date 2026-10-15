// A visual acting profile: no schedule, identity or narrative is written here.
export const MOTION_STYLES={
 natural:{label:'自然',description:'动作舒展，节奏平稳',tempo:1,walk:1,lean:.018,sway:.004,gaze:.025,habit:12},
 calm:{label:'安静',description:'动作轻缓，坐姿收敛',tempo:.84,walk:.91,lean:.010,sway:.002,gaze:.014,habit:16},
 brisk:{label:'利落',description:'动作干脆，坐得端正',tempo:1.16,walk:1.08,lean:.005,sway:.002,gaze:.020,habit:10},
 relaxed:{label:'松弛',description:'慢慢来，偶尔舒展肩膀',tempo:.91,walk:.94,lean:.045,sway:.012,gaze:.035,habit:14},
 lively:{label:'活泼',description:'动作轻快，时不时看看四周',tempo:1.09,walk:1.04,lean:.022,sway:.012,gaze:.055,habit:8}
};
const words={calm:['沉稳','安静','内敛','寡言','稳重','沉静','慢条斯理'],brisk:['利落','干脆','雷厉风行','动作迅速','行事果断'],relaxed:['松弛','慵懒','随性','懒散','不疾不徐'],lively:['活泼','灵动','好动','跳脱','外向','动作轻快']};
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function inferMotionStyle(persona=''){
 // Only explicit temperament words count; profession, gender and wealth do not.
 const clauses=String(persona).split(/[。！？；\n]/),scores=Object.fromEntries(Object.keys(words).map(k=>[k,0]));
 for(const [style,keys]of Object.entries(words))for(const clause of clauses)for(const word of keys){
  let at=clause.indexOf(word);while(at>=0){const before=clause.slice(Math.max(0,at-6),at);if(!/(?:不|不是|并非|不算|并不|不太|并非很|不怎么|不像|不再|毫不|缺少|讨厌|不喜欢)\s*$/.test(before))scores[style]++;at=clause.indexOf(word,at+word.length);}
 }
 const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);return ranked[0][1]&&ranked[0][1]>ranked[1][1]?ranked[0][0]:'natural';
}
export function motionProfile({id='',persona='',style='auto'}={}){
 const key=Object.hasOwn(MOTION_STYLES,style)?style:inferMotionStyle(persona),seed=hash(id),base=MOTION_STYLES[key];
 return {id:String(id),style:key,source:Object.hasOwn(MOTION_STYLES,style)?'chosen':'persona',...base,tempo:base.tempo*(.98+(seed%401)/10000),phase:.7+(seed%1501)/1000+(String(id).endsWith(':me')?3.2:0)};
}
export const motionClock=(time,profile)=>profile?Math.max(0,time)*profile.tempo+profile.phase:time;
export function motionPosture(profile,time){
 if(!profile)return {tilt:0,roll:0,yaw:0};const t=motionClock(time,profile),q=(t%profile.habit)/profile.habit,pulse=q>.72?Math.sin((q-.72)/.28*Math.PI):0;
 return {tilt:profile.lean,roll:Math.sin(t*.63)*profile.sway,yaw:Math.sin(t*.39)*profile.gaze*pulse};
}

export const PAIR_STYLES={
 gentle:{label:'温柔',description:'缓缓靠近，轻轻接住',delay:.35,reach:1.1,lean:.10,sway:.008},
 shy:{label:'害羞',description:'先看看你，迟一点伸手',delay:1.65,reach:1.6,lean:.045,sway:.003},
 active:{label:'主动',description:'直接伸手，靠近得更快',delay:.08,reach:.65,lean:.14,sway:.012},
 clingy:{label:'黏人',description:'靠久一点，轻轻晃一晃',delay:.22,reach:.95,lean:.20,sway:.028}
};
function hasPairTrait(persona,words){return String(persona).split(/[。！？；\n]/).some(clause=>words.some(word=>{const at=clause.indexOf(word);return at>=0&&!/(?:不|不是|并非|不算|并不|不太|不怎么|不像|不再|讨厌|不喜欢)\s*$/.test(clause.slice(Math.max(0,at-6),at));}));}
export function pairProfile(profile,persona='',chosen='auto'){
 let style=Object.hasOwn(PAIR_STYLES,chosen)?chosen:null;
 const source=style?'chosen':'persona';
 if(!style){
  const inferred=inferMotionStyle(persona);
  style=profile?.source==='chosen'?({calm:'shy',brisk:'active',relaxed:'gentle',lively:'active'}[profile.style]||'gentle'):
   hasPairTrait(persona,['黏人','粘人','喜欢贴贴','爱撒娇'])?'clingy':hasPairTrait(persona,['害羞','腼腆','羞涩'])?'shy':({calm:'shy',brisk:'active',lively:'active'}[inferred]||'gentle');
 }
 return {...PAIR_STYLES[style],style,source,phase:profile?.phase||0};
}
export function pairProgress(elapsed,profile){const n=Math.max(0,Math.min(1,(elapsed-profile.delay)/profile.reach));return n*n*(3-2*n);}
