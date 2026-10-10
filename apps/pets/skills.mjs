import {homePoint} from './initiative.mjs?v=fg-6a186babf51cdda8';
export const PET_SKILLS={come:{label:'听名字过来',cue:'叫它过来',duration:3},stay:{label:'坐好等一等',cue:'请它等一等',duration:6},fetch:{label:'把玩具叼回来',cue:'请它叼回来',duration:1.2}};
const known=id=>Object.hasOwn(PET_SKILLS,id);
const count=v=>Number.isFinite(v)?Math.max(0,Math.min(10000,Math.floor(v))):0;
const key=v=>v==='you'||typeof v==='string'&&/^companion:.{1,80}$/.test(v);
export function restoreSkills(raw){return {version:1,progress:Object.fromEntries(Object.keys(PET_SKILLS).map(id=>{const r=raw?.progress?.[id]||{};return [id,{practice:count(r.practice),shown:count(r.shown),teachers:Object.fromEntries(Object.entries(r.teachers||{}).filter(([k])=>key(k)).slice(-40).map(([k,v])=>[k,{name:typeof v?.name==='string'?v.name.slice(0,24):k==='you'?'你':'TA',practice:count(v?.practice),shown:count(v?.shown)}]))}];}))};}
export const skillTask=t=>t?.kind==='skill'&&known(t.skill)&&['you','companion'].includes(t.source)&&(t.source==='you'?t.target==='you':typeof t.actor==='string'&&!!t.actor&&t.target==='companion:'+t.actor)&&key(t.target)&&['practice','show'].includes(t.mode);
export const skillDuration=t=>known(t?.skill)?PET_SKILLS[t.skill].duration:3;
export function startSkill(s,id,{mode='practice',source='you',actor='',name='你',toy='ball'}={},random=()=>0){
 if(!known(id)||!['practice','show'].includes(mode)||!['you','companion'].includes(source)||source==='companion'&&(typeof actor!=='string'||!actor||actor.length>80))return {accepted:false,text:'没找到这次练习。'};
 if(mode==='show'&&s.skills.progress[id].practice<3)return {accepted:false,text:'先一起练几次，让它慢慢记住这个口令。'};
 if(s.helper||s.task&&!(s.task.source==='self'&&['watch','wander'].includes(s.task.kind)&&!s.task.socialId))return {accepted:false,text:s.task?.kind==='sleep'?'正睡得香，等醒来再一起练。':'它正在忙自己的事，等空下来再练。'};
 if(s.energy<30||s.satiety<25||s.mood<25)return {accepted:false,text:s.energy<30?'有点累了，先歇一会儿。':s.satiety<25?'肚子空空，先让它吃些粮。':'这会儿想自己静一静，晚一点再试。'};
 const willingness=.68+s.mood*.0015+(id==='stay'?(1-s.traits.active)*.13:s.traits.active*.10)+s.traits.social*.1;
 if(random()>Math.min(.98,willingness))return {accepted:false,text:'看了看你们，这次还不想跟着口令做。'};
 const target=source==='companion'?'companion:'+String(actor).slice(0,80):'you';
 s.task={kind:'skill',skill:id,mode,phase:'walking',time:0,place:'person',source,actor:String(actor).slice(0,80),name:String(name||'你').slice(0,24),target,toy:toy==='mouse'?'mouse':'ball',stage:id==='fetch'?'fetch':'waiting'};s.idle=0;
 return {accepted:true,text:(mode==='practice'?'一起练「':'请它试试「')+PET_SKILLS[id].label+'」，实际做完才记下来。'};
}
export function completeSkill(s,t,delivered=false){
 if(!skillTask(t)||t.phase!=='doing')return null;if(t.skill==='fetch'){if(!delivered||t.stage!=='waiting')return null;}else if(t.time<skillDuration(t))return null;
 const r=s.skills.progress[t.skill],who=r.teachers[t.target]||(r.teachers[t.target]={name:t.name||'你',practice:0,shown:0}),field=t.mode==='practice'?'practice':'shown';r[field]=Math.min(10000,r[field]+1);who[field]=Math.min(10000,who[field]+1);who.name=t.name||who.name;s.energy=Math.max(0,s.energy-2);s.mood=Math.min(100,s.mood+2);
 return (t.name||'你')+'和它'+(t.mode==='practice'?'练完了':'做完了')+'「'+PET_SKILLS[t.skill].label+'」。'+(t.mode==='practice'&&r.practice===3?'它已经记住这个小技能了。':'');
}
export function cancelOfflineSkill(s){const t=s.task;if(!skillTask(t))return false;if(t.skill==='fetch'&&['carry','lower'].includes(t.stage)){const p=homePoint(s.position);if(p)s.toyPlaces[t.toy]={...p};}s.task=null;s.idle=0;return true;}
export function skillFacts(s){const skills=s.skills||restoreSkills();return Object.entries(PET_SKILLS).map(([id,x])=>({id,...x,learned:skills.progress[id].practice>=3,practice:skills.progress[id].practice,shown:skills.progress[id].shown,status:skills.progress[id].practice>=3?'已经学会':skills.progress[id].practice?'慢慢记住了 · 已练成 '+skills.progress[id].practice+' 次':'还没一起练过',teachers:Object.values(skills.progress[id].teachers).filter(x=>x.practice).map(x=>({...x})),active:skillTask(s.task)&&s.task.skill===id}));}
