import {roomPoint,HOME_DETAILS} from './room-layout.mjs?v=fg-83edfa27f119ba5e';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const RESIDENT_ACTS={
 read:{label:'翻一会儿书',gesture:'read',seated:true,point:{x:-.65,z:.55},tags:['reading','quiet'],duration:18},
 tea:{label:'慢慢喝一杯茶',gesture:'tea',seated:true,point:{x:-.65,z:.55},tags:['tea','quiet'],duration:16},
 stretch:{label:'站起来舒展一下',gesture:'stretch',point:{x:0,z:1.15},tags:['active'],duration:8},
 plants:{label:'看看架上的植物',gesture:'rest',point:{x:-1.65,z:-.25},face:{x:-2.88,z:-.24},tags:['plants','nature'],duration:10},
 window:{label:'看看窗外的光和天气',gesture:'rest',point:{x:-.55,z:-1.1},face:{x:-.55,z:-2},tags:['quiet','nature'],duration:14},
 pets:{label:'坐下来看看小家伙们',gesture:'rest',seated:true,point:{x:-.65,z:.55},tags:['animals','social'],duration:14},
 rest:{label:'安静歇一会儿',gesture:'rest',seated:true,point:{x:-.65,z:.55},tags:['quiet','rest'],duration:16},
 stroll:{label:'在家里走走',gesture:'rest',tags:['active','explore'],duration:8},
 look:{label:'慢慢看看家里',gesture:'rest',tags:['explore'],duration:12}
};
for(const [kind,zone]of [['plants','shelf'],['window','window']]){const act=RESIDENT_ACTS[kind];act.point=kind==='plants'?{...HOME_DETAILS.plantStand}:roomPoint('home',zone,act.point);act.face=roomPoint('home',zone,act.face);}
// Independent cues bias choices, rather than assigning a character to a personality template.
const PREFERENCE_VERSION=2;
const CUES={reading:/读书|阅读|看书|书籍|翻书|reading|\bbooks?\b/gi,tea:/喝茶|饮茶|品茶|茶香|\btea\b/gi,coffee:/咖啡|\bcoffee\b/gi,quiet:/安静|喜静|内向|沉静|独处|\bquiet\b|\bintrovert/gi,active:/活泼|活力|运动|锻炼|散步|户外|\benergetic\b|\bexercise\b|\bactive\b/gi,plants:/植物|养花|花草|园艺|花香|\bgardening\b|\bplants?\b|\bflowers?\b/gi,nature:/自然|风景|看雨|听雨|赏雨|晒太阳|\bnature\b|\bscenery\b/gi,animals:/小动物|猫咪|猫猫|狗狗|宠物|动物|猫(?!妖|耳)|狗(?!头)|\bcats?\b|\bdogs?\b|\bpets?\b|\banimals?\b/gi,social:/外向|健谈|热情|社交|与人相处|sociable|extrovert|outgoing/gi,tidy:/整洁|爱干净|有条理|井井有条|tidy|organised|organized/gi,explore:/好奇|探索|逛店|探究|\bcurious\b|\bexplor/gi,gentle:/温柔|轻柔|柔和|\bgentle\b/gi,attentive:/细心|细致|周到|体贴|照顾人|\battentive\b|\bthoughtful\b/gi,patient:/耐心|沉稳|慢条斯理|\bpatient\b/gi,cautious:/谨慎|小心|慎重|\bcautious\b|\bcareful\b/gi,rest:/慵懒|悠闲|慢生活|lazy|leisure/gi};
const NEGATIVE=/不(?:太|怎么)?喜欢|不(?:太)?爱|不愿|讨厌|厌恶|排斥|害怕|恐惧|怕|远离|避免|抗拒|dislikes?|hates?|avoids?|afraid of|not fond of|\bnot\s+$|并不$|不(?:太)?$/i;
const POSITIVE=/喜欢|喜爱|热爱|爱好|兴趣|爱|享受|痴迷|钟爱|擅长|常常|经常|loves?|likes?|enjoys?|fond of|hobbies/i;
const CONTRAST=/但是|然而|不过|但|而|却|but\b|however\b/i;
export function preferenceSource(person){return typeof person?.persona==='string'?person.persona:'';}
const fingerprint=s=>{let n=2166136261;for(const ch of s)n=Math.imul(n^ch.codePointAt(0),16777619);return (n>>>0).toString(36);};
export function deriveResidentPreferences(person){const source=preferenceSource(person),scores={},evidence={};
 for(const [tag,re] of Object.entries(CUES)){let score=0;for(const match of source.matchAll(re)){
  const prefix=source.slice(Math.max(0,match.index-240),match.index).split(/[。！？!?；;，,.\n]/).at(-1).split(CONTRAST).at(-1).slice(-60),neg=[...prefix.matchAll(new RegExp(NEGATIVE.source,'gi'))].at(-1),pos=[...prefix.matchAll(new RegExp(POSITIVE.source,'gi'))].at(-1),negative=!!neg&&(!pos||neg.index+neg[0].length>=pos.index+pos[0].length),positive=!!pos&&!negative;
  // Explicit likes/dislikes get more weight than a bare interest or temperament word.
  const temperament=['quiet','active','social','tidy','explore','rest','attentive','patient','cautious','gentle'].includes(tag);const value=negative?-2:positive?2:temperament?1:0;score+=value;
 }scores[tag]=clamp(score,-4,4);if(score)evidence[tag]=score<0?'avoid':'prefer';}
 return {version:PREFERENCE_VERSION,source:fingerprint(source),scores,evidence};
}
export function restoreResidentChoices(raw){const scores={};for(const tag of Object.keys(CUES))scores[tag]=Number.isFinite(raw?.preferences?.scores?.[tag])?clamp(raw.preferences.scores[tag],-4,4):0;return {preferences:{version:raw?.preferences?.version===PREFERENCE_VERSION?PREFERENCE_VERSION:1,source:typeof raw?.preferences?.source==='string'?raw.preferences.source:'',scores,evidence:raw?.preferences?.evidence&&typeof raw.preferences.evidence==='object'?Object.fromEntries(Object.entries(raw.preferences.evidence).filter(([k,v])=>Object.hasOwn(CUES,k)&&['prefer','avoid'].includes(v))):{}},recent:Array.isArray(raw?.recent)?raw.recent.filter(x=>x&&typeof x.kind==='string'&&Object.hasOwn(RESIDENT_ACTS,x.kind)&&typeof x.label==='string'&&Number.isFinite(x.at)).slice(-12).map(x=>({kind:x.kind,label:x.label.slice(0,80),at:x.at})):[]};}
export function syncResidentPreferences(resident,person){if(resident.id&&person?.id&&String(resident.id)!==String(person.id))return restoreResidentChoices(resident.choices).preferences;resident.name=String(person?.name||resident.name||'TA').slice(0,80);const next=deriveResidentPreferences(person);resident.choices=restoreResidentChoices(resident.choices);if(resident.choices.preferences.source!==next.source||resident.choices.preferences.version!==next.version)resident.choices.preferences=next;return resident.choices.preferences;}
export function rememberResidentAct(resident,kind,at){if(!Object.hasOwn(RESIDENT_ACTS,kind))return false;const act=RESIDENT_ACTS[kind];resident.choices=restoreResidentChoices(resident.choices);resident.choices.recent.push({kind,label:act.label,at});resident.choices.recent=resident.choices.recent.slice(-12);return true;}
export function weightedChoice(candidates,random){const total=candidates.reduce((n,c)=>n+c.weight,0);if(!total)return null;let at=clamp(random(),0,.999999999)*total;for(const c of candidates){at-=c.weight;if(at<0)return c.id;}return candidates.at(-1)?.id||null;}
export function activityWeights(resident,{minute=720,kind='晴日',pets=true,available=()=>true}={}){
 const choices=restoreResidentChoices(resident.choices),scores=choices.preferences.scores,last=choices.recent.slice(-3);
 return Object.entries(RESIDENT_ACTS).filter(([id])=>available(id)&&(id!=='pets'||pets)).map(([id,act])=>{
  let bias=act.tags.reduce((n,t)=>n+scores[t],0)*.36;if(id==='tea'&&minute<600)bias+=.4;if(id==='window'&&['细雨','细雪'].includes(kind))bias+=.5;if(id==='rest'&&minute>=1200)bias+=.5;
  const repeated=last.filter(x=>x.kind===id).length,weight=Math.exp(clamp(bias,-3,3))*(last.at(-1)?.kind===id?.15:Math.pow(.65,repeated));return {id,weight};
 });
}
export function chooseResidentAct(resident,context,random){return weightedChoice(activityWeights(resident,context),random);}
export function destinationWeights(resident,{kind='晴日',minute=720}={}){const s=restoreResidentChoices(resident.choices).preferences.scores;const weights={home:(s.quiet+s.reading+s.rest)*.3,outside:(s.active+s.nature+s.explore)*.3,cafe:(s.coffee+s.tea+s.social)*.35,store:(s.explore+s.social)*.25,alley:s.explore*.4,bakery:(s.social+s.explore)*.2,florist:(s.plants+s.nature)*.4};return Object.entries(weights).map(([id,bias])=>({id,weight:Math.exp(clamp(bias,-3,3))*(id==='outside'&&kind!=='晴日'?.25:1)*(id==='outside'&&minute>=1200?.35:1)}));}
export const residentGoalClear=(point,peers)=>peers.every(p=>Math.hypot(point.x-p.position.x,point.z-p.position.z)>.55*(p.size||1));
export const residentStepClear=(from,next,peers)=>peers.every(p=>Math.hypot(next.x-p.position.x,next.z-p.position.z)>=.45*(p.size||1)||Math.hypot(next.x-p.position.x,next.z-p.position.z)>Math.hypot(from.x-p.position.x,from.z-p.position.z));
export function planResidentAct(resident,{nav,position,context={},clear=()=>true,randomRoute},random){
 const routes=new Map(),available=id=>{const target=RESIDENT_ACTS[id].point;if(!target)return true;if(!nav.walkable(target.x,target.z)||!clear(target))return false;const route=nav.path(position,target);if(!route?.length&&Math.hypot(target.x-position.x,target.z-position.z)>.15)return false;routes.set(id,{goal:target,route:route||[]});return true;};
 const kind=chooseResidentAct(resident,{...context,available},random);if(!kind)return null;const next=routes.get(kind)||randomRoute?.(random);if(!next)return null;
 return {activity:{kind,phase:next.route.length?'walking':'doing',goal:{...next.goal},time:0,duration:RESIDENT_ACTS[kind].duration*(.8+random()*.4)},route:next.route};
}
export const chooseResidentDestination=(resident,context,random)=>weightedChoice(destinationWeights(resident,context),random);
const CUE_LABELS={reading:'阅读',tea:'喝茶',coffee:'咖啡',quiet:'安静独处',active:'运动散步',plants:'花草园艺',nature:'自然风景',animals:'小动物',social:'热闹交往',tidy:'整洁有序',explore:'探索新鲜事',rest:'悠闲休息',gentle:'温柔相处',attentive:'细心照料',patient:'耐心相处',cautious:'谨慎靠近'};
export function residentPreferenceFacts(resident){const choices=restoreResidentChoices(resident.choices);return {basis:'本地读取人设中的兴趣、喜恶与性格词，未写明的保持中性',cues:choices.preferences.evidence,likes:Object.entries(choices.preferences.evidence).filter(([,v])=>v==='prefer').map(([k])=>CUE_LABELS[k]),avoids:Object.entries(choices.preferences.evidence).filter(([,v])=>v==='avoid').map(([k])=>CUE_LABELS[k]),recent:choices.recent.slice(-5)};}
