import {skillTask} from './skills.mjs?v=fg-337e28073d0dffaf';
// Local habits are earned by actual work/choices and share the pet's career save.
export const WORK_HABITS = {
 model:{label:'在窗边坐好等人',done:'在窗边安稳坐了一会儿，像拍摄时等熟悉的人。',pose:'sit',target:'florist'},
 actor:{label:'看看门边的小动静',done:'轻轻探头看了看门边，像在等自己的小出场。',pose:'look',target:'courier'},
 wedding:{label:'看看窗边的小花',done:'在小花旁慢慢待了一会儿，记着布花时的安静。',pose:'sniff',target:'florist'},
 books:{label:'在沙发边安静守一会儿',done:'安静守在沙发边，像陪人翻书的小管理员。',pose:'sit',target:'cafe'},
 scent:{label:'闻闻门边的小痕迹',done:'在门边低头闻闻，带着花店寻香时的认真。',pose:'sniff',target:'courier'},
 bakery:{label:'在饭碗边等人',done:'像守面包柜台一样，在饭碗边安静等了一会儿。',pose:'look'},
 store:{label:'闻闻玩具角',done:'像检查便利店货架一样，低头闻过了自己的玩具角。',pose:'sniff'},
 florist:{label:'到窗边看看',done:'在窗边慢慢看了一会儿，带着花店里学来的好奇。',pose:'look'},
 cafe:{label:'到沙发边歇歇',done:'在沙发边悠闲待了一会儿，像在咖啡店守自己的位置。',pose:'look'},
 alley:{label:'闻闻玩具再叼来',done:'认真闻过玩具，又把它叼到你们身边，像交来一件小线索。',pose:'sniff'},
 courier:{label:'去门边看看',done:'走到门边闻了闻，又看看门口；送件以后留下了这个小习惯。',pose:'sniff'},
 stall:{label:'把玩具藏到窝边',done:'把自己的小球叼到窝边，低头看了看，今天想给自己留着。',pose:'sniff'}
};
const bound=(x,a=0,b=1)=>Number.isFinite(x)?Math.max(a,Math.min(b,x)):0;
export function restoreWorkHabits(raw,history=[],day=1){
 const old=raw&&typeof raw==='object'?raw:null;
 return {day:Math.max(1,Math.floor(bound(old?.day,1,1e7)||day)),scores:Object.fromEntries(Object.keys(WORK_HABITS).map(id=>[id,bound(old?old.scores?.[id]:history.filter(x=>x.kind===id).reduce((n,x)=>n+Math.min(5,x.days||1)*.12,0))])),pressure:Object.fromEntries(Object.keys(WORK_HABITS).map(id=>[id,bound(old?.pressure?.[id])]))};
}
export function fadeWorkHabits(h,day,working=''){
 if(!Number.isFinite(day)||day<=h.day)return false;const days=day-h.day;
 for(const id of Object.keys(WORK_HABITS)){if(id!==working)h.scores[id]=Math.max(0,h.scores[id]-.025*days);h.pressure[id]=Math.max(0,h.pressure[id]-.035*days);}h.day=day;return true;
}
export function learnWorkHabit(h,id,{finished=false,choice='',pressured=false}={}){
 if(!WORK_HABITS[id])return;
 h.scores[id]=bound(h.scores[id]+(finished?.22:pressured?0:.025)+(id==='stall'&&choice==='keep'?.065:0));
 if(pressured)h.pressure[id]=bound(h.pressure[id]+.12);
}
export const carriesToy=t=>skillTask(t)&&t.skill==='fetch'||t?.kind==='invitePlay'||t?.kind==='habit'&&['alley','stall'].includes(t.habit);
export const habitTask=t=>t?.kind==='habit'&&!!WORK_HABITS[t.habit]&&t.source==='self';
export function chooseWorkHabit(care,career,people,random){
 if(!career?.habits||career.job||care.helper||care.habitCooldown>0||care.energy<50||care.satiety<55||care.mood<35)return null;
 const candidates=Object.keys(WORK_HABITS).filter(id=>career.habits.scores[id]>=.12&&(id!=='stall'||career.inventory?.toy===1)&&(id!=='alley'||people?.some(p=>p.available!==false)));
 if(!candidates.length||random()>.35)return null;
 const recent=care.recent.filter(x=>x.type==='habit').slice(-2),weights=candidates.map(id=>career.habits.scores[id]*(id==='stall'?.7:1)*(recent.some(x=>x.habit===id)?.3:1));let pick=random()*weights.reduce((a,b)=>a+b,0);let id=candidates.at(-1);for(let i=0;i<candidates.length;i++){pick-=weights[i];if(pick<0){id=candidates[i];break;}}
 const person=id==='alley'?people.find(p=>p.available!==false):null;
 return {kind:'habit',habit:id,source:'self',phase:'walking',time:0,place:'rug',toy:id==='stall'?'ball':care.toys.mouse>care.toys.ball?'mouse':'ball',stage:['alley','stall'].includes(id)?'fetch':'waiting',target:person?.key||'',actor:person?.id||'',name:person?.name||'',spot:null};
}
export function workHabitsView(h){return Object.keys(WORK_HABITS).filter(id=>h.scores[id]>=.12).sort((a,b)=>h.scores[b]-h.scores[a]).map(id=>({profession:id,label:WORK_HABITS[id].label,strength:h.scores[id],pressured:h.pressure[id]}));}
