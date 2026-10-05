// Continuous stories and career stages are facts of the original career save.
// They never complete work, create wages, or advance while the pet is away.
const bound=v=>Number.isFinite(v)?Math.max(0,Math.min(1e7,Math.floor(v))):0;
const profiles={
 bakery:{people:['每天买小餐包的林婆婆','放学来买面包的小岚','爱带保温杯的周叔'],thing:'柜台旁的小纸袋',task:'陪客人等面包打包'},
 florist:{people:['每周买一枝花的乔姐','给家人挑花的小禾','来换花瓶水的许伯'],thing:'一枝留在包花台的小花',task:'陪客人挑花'},
 store:{people:['夜班前来买水的阿宁','总找不到贴纸的小米','来取小包裹的顾叔'],thing:'贴在收银台的小爪贴纸',task:'陪店员收好客人的东西'},
 cafe:{people:['窗边看书的小榆','带素描本的南南','喝完咖啡慢慢散步的苏姨'],thing:'一张画着小爪子的杯垫',task:'在舒服的位置陪客人坐坐'},
 books:{people:['借完书总会道谢的小榆','来看画册的小岚','找老故事书的顾叔'],thing:'夹在书里的小书签',task:'陪客人找到原来的书架'},
 scent:{people:['找熟悉花香的乔姐','拿着香气卡的小禾','给家里挑花的许伯'],thing:'一张记着上次花香的小卡',task:'陪客人闻闻这一批花'},
 model:{people:['拍商品照的阿宁','带布景纸的南南','负责服饰的小禾'],thing:'上次用过的小方巾',task:'在熟悉的镜头前待一小段'},
 actor:{people:['负责排练的阿宁','整理道具的南南','给大家递水的小岚'],thing:'上次留下的小道具',task:'按舒服的节奏试一段镜头'},
 wedding:{people:['整理花篮的乔姐','负责彩排的小禾','给新人递花的南南'],thing:'一只熟悉的小花篮',task:'陪大家把花篮摆好'}
};
export const STORY_PROFESSIONS=Object.keys(profiles);
export function restoreCareerLife(raw,history=[]){
 const jobs={};for(const id of [...STORY_PROFESSIONS,'courier','stall','alley']){
  const r=raw?.jobs?.[id]||{},old=history.filter(x=>x.kind===id).reduce((n,x)=>n+(x.days||1),0);
  jobs[id]={completed:Math.max(bound(r.completed),old),stopped:bound(r.stopped),story:bound(r.story),lastOutcome:['welcome','space','pass'].includes(r.lastOutcome)?r.lastOutcome:'',customers:Object.fromEntries(Object.entries(r.customers||{}).filter(([k,x])=>/^[0-2]$/.test(k)&&x&&typeof x==='object').map(([k,x])=>[k,{visits:bound(x.visits),affinity:Math.max(0,Math.min(100,Number(x.affinity)||0)),outcome:['welcome','space','pass'].includes(x.outcome)?x.outcome:''}]))};
 }
 return {version:1,jobs,breakUntil:bound(raw?.breakUntil),restDays:bound(raw?.restDays),milestones:(Array.isArray(raw?.milestones)?raw.milestones:[]).filter(x=>typeof x?.text==='string'&&Number.isFinite(x.day)).slice(-24).map(x=>({text:x.text.slice(0,180),day:bound(x.day),at:Number.isFinite(x.at)?x.at:0}))};
}
export function restoreJobStory(raw,profession){return profiles[profession]&&raw&&Number.isInteger(raw.chapter)&&raw.chapter>=0&&raw.chapter<3&&Number.isInteger(raw.customer)&&raw.customer>=0&&raw.customer<3?{chapter:raw.chapter,customer:raw.customer,outcome:['welcome','space','pass'].includes(raw.outcome)?raw.outcome:'',previous:['welcome','space','pass'].includes(raw.previous)?raw.previous:''}:null;}
export function nextJobStory(life,id){if(!profiles[id])return null;const r=life.jobs[id],customer=Math.floor(r.story/3)%3;return {customer,chapter:r.story%3,outcome:'',previous:r.customers[customer]?.outcome||''};}
export function regularEvent(job){const t=job?.story,p=profiles[job?.profession];if(!p||!t||job.index!==0||job.phase!=='choice')return null;const name=p.people[t.customer],previous=t.previous==='space'?'上次你们留了舒服的距离，对方这次先在旁边等它。':t.previous==='pass'?'上次它没有营业，对方还记得要先问问它。':'对方记得上次和它待过的那一小段。';
 const title=t.chapter===0?'店里有位常来的客人':t.chapter===1?'熟悉的客人又来了':'这位熟客记住了它';
 const text=t.chapter===0?name+'带着'+p.thing+'停下来。先让它闻闻，再看看今天愿意怎么相处。':t.chapter===1?name+'又来'+p.task+'。'+previous:name+'还留着'+p.thing+'，这次特意给它留了一个安静位置。'+previous;
 return {id:job.id+':0',title,text,regular:name,chapter:t.chapter+1,options:[
  {id:'welcome',label:'愿意的话，陪熟客一小段',note:'和'+name+'完成了'+p.task+'；对方记住了它愿意靠近的方式。',tip:2,like:.05,trait:'social'},
  {id:'space',label:'留好距离，慢慢认识',note:'给它保留了舒服的距离，'+name+'也学会先等它回应。',tip:1,like:.08,energy:3,trait:'bold'},
  {id:'pass',label:'今天先让店员接待',note:'这次由店员接待'+name+'，没有勉强它；对方记得下次先问它。',tip:0,like:.06,energy:5}
 ]};
}
export function completeCareerLife(life,job,{day,at=0,name='它',title='这间小店',preference=0}={}){
 const r=life.jobs[job.profession];if(!r)return;const before=r.completed;r.completed++;
 if(job.story?.outcome){const t=job.story,c=r.customers[t.customer]||(r.customers[t.customer]={visits:0,affinity:0,outcome:''});c.visits++;c.affinity=Math.min(100,c.affinity+(t.outcome==='welcome'?3:t.outcome==='space'?2:1));c.outcome=t.outcome;r.lastOutcome=t.outcome;r.story++;}
 const threshold=[1,3,8,16].find(x=>before<x&&r.completed>=x);
 if(threshold){const stage=threshold===1?'完成了第一班':threshold===3?'已经熟悉这份工作':threshold===8?'成了熟悉岗位的小帮手':'留下了一段很长的职业经历';life.milestones.push({day,at,text:name+'在'+title+stage+'。'+(preference<-.2?'它仍更想有自己的空闲时间。':preference>.3?'按自己的节奏做这份工作，越来越自在。':'愿不愿意继续，还会看当天的心情。')});life.milestones=life.milestones.slice(-24);}
}
export function careerLifeView(life,id,{preference=0,energy=75,pressure=0}={}){const r=life.jobs[id],p=profiles[id],count=r?.completed||0;return {completed:count,stopped:r?.stopped||0,stage:count>=16?'熟悉的老伙伴':count>=8?'熟练的小帮手':count>=3?'已经熟悉岗位':count?'初来试过工作':'还在认识这份工作',wish:energy<35||pressure>.35?'想先休息一阵':preference<-.2&&count>=3?'想看看别的工作':count>=3&&preference>.3?'愿意再见见熟悉的客人':'今天想不想去，先问问它',regulars:p?Object.entries(r.customers).map(([index,c])=>({name:p.people[index],visits:c.visits,relation:c.affinity>=8?'认得它的小习惯':c.affinity>=3?'慢慢熟悉':'刚开始认识',outcome:c.outcome})):[],nextChapter:p?(r.story%3)+1:null,milestones:structuredClone(life.milestones).reverse()};}
