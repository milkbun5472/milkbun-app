import {normalizeCase} from './case-schema.mjs?v=fg-dcb7068d4ae7c310';
// This is a town-fiction author, not the companion's reply: only this pet's public game facts enter.
export function modelCaseContext(world){const pet=world?.pet||{},career=world?.career||{};return {pet:{name:pet.name,species:pet.species,traits:pet.traits},day:career.day,completed:career.detective?.completed||0,avoid:career.detective?.avoid||[],places:['家里','公园',...(career.workplaces||[]).map(x=>x.title)]};}
export function casePrompt(context){
 const axes=[['安静细微','带一点笨拙的好笑','让人想多看一眼','由你决定语气'],['实物留下的痕迹','街坊各自看到的片段','事情发生的先后','由你决定证据角度']];
 const seed=Math.max(0,Math.floor(Number(context.day)||1)+Math.floor(Number(context.completed)||0));
 return ['为绒绒小镇创作一件宠物能参与的小谜题，写成完整、可保存的单篇卷宗。你在作者位置；街坊与事件属于这一篇小镇故事，主线人物仍由原来的角色聊天负责。',
  '【当前这只宠物与已查过的题目】\n'+JSON.stringify(context),
  '【创作轴】\n'+JSON.stringify({语气:axes[0][seed%4],证据角度:axes[1][Math.floor(seed/2)%4],规模:'小镇日常的一件小事',题材:'由你创造新的起因、东西和街坊'}),
  '主题、原因、街坊的打算由你发挥，题目与经过避开已查过的题目。三条线索是玩家先后能观察到的具体事实；三种解释应当都像是值得考虑的猜测，收齐线索后只剩一种解释成立。结局交代事情如何发生，每条线索怎样对应，故事在这里能停下来。',
  '用支持/排除关系表达证据：每条线索的 supports/excludes 填候选解释的 id。同一条证据的两张表互斥。正确解释由至少两条证据支持，三条证据合起来排除另两种解释。文字里的事实与这些关系一致；这层关系只用于检查与存档。',
  '【输出格式】一个 JSON 对象：title（2–48字短标题）、intro（4–360字现场开头）、clues（恰好三项，每项有 text：4–240字观察事实，supports：id数组，excludes：id数组）、options（恰好三项，每项 id：a/b/c 之一、label：3–100字解释）、answer（正确解释id）、ending（4–500字结局及线索对应）、hint（4–180字请玩家重看哪些事实）。现场开头留住谜题，线索里只放当前这一条能观察到的事实。工资、道具、玩家或角色状态由游戏结算。'
 ].join('\n\n');
}
export function parseModelCase(value,id){
 const raw={...value,id,source:'model',family:'model',clues:Array.isArray(value?.clues)?value.clues.map(x=>x?.text):null,proof:Array.isArray(value?.clues)?value.clues.map(x=>({supports:x?.supports,excludes:x?.excludes})):null};
 if(!Array.isArray(value?.options)||!value.options.every(x=>['a','b','c'].includes(x?.id)))return null;
 return normalizeCase(raw);
}
export async function generateModelCase({active,context,id,invoke,parse}){
 if(!active)throw Error('先在设置里配置创作线路，再接一封模型消息。');
 const raw=await invoke(active,casePrompt(context),[{role:'user',content:'写这一封小巷消息。'}],{maxTokens:65535,timeout:180000,noNetRetry:true,tag:'绒绒小镇侦探案'});
 try{const c=parseModelCase(parse(raw),id);if(!c)throw Error('这次返回的线索关系没有通过检查，先用本地小案吧。');if((context.avoid||[]).includes(c.title))throw Error('这个题目已经查过了，先接本地的新消息吧。');return c;}
 catch(error){error.detail=String(raw||'').slice(0,1600);throw error;}
}
