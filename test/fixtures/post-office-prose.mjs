import {readFileSync} from 'node:fs';
import vm from 'node:vm';
// Synthetic people only. No phone archive, API configuration, chats or memories.
export const people=[
 {id:'test-a',name:'甲',persona:'做事细致，习惯把细节记在心里，话不多。和熟人相处时会露出一点干燥的幽默，关心人时常先处理眼前的小事。与乙共事很久，熟悉对方的脾气；丙是最近加入的同事。'},
 {id:'test-b',name:'乙',persona:'外向，观察敏锐，喜欢随口聊起刚留意到的事情。做错了会承认，被认真感谢时有一点不自在。与甲共事多年，能自在地争论小事，也知道什么时候该停。'},
 {id:'test-c',name:'丙',persona:'刚加入店里，认真也有一点急，遇到不明白的事情会直接问。熟悉以后说话很快，乐意帮忙，却不愿别人总替自己把事情做完。对甲乙已有的默契仍在慢慢了解。'}
];
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export async function writerCases(){
 const g={console,structuredClone};g.window=g;for(const file of ['apps/fairy-garden/story-actions.js','js/stamp-duel.js','js/stamp-shop.js'])vm.runInNewContext(read(file),g);
 const cards=people.map((c,i)=>({id:'fixture-card-'+i,charId:c.id,rarity:'R',lv:1,text:{name:['远方邮路','窗边一刻','新邮戳'][i],gist:'一张构造的测试卡'}}));
 const base={day:8,date:'2026-11-8',coins:210,earned:187,roster:{柜台:'test-a',分拣:'test-b',送信:'test-c'},badge:{柜台:cards[0].id},window:cards.map(c=>c.id),decor:['旧木招牌','一盆绿萝','暖黄的吊灯','靠窗的长凳'],decorLv:{},phase:'open',period:'傍晚',customers:[{id:'傍晚c0',name:'寄包裹的学生',fee:12,got:12,done:true},{id:'傍晚c1',name:'审查员',tough:true,won:true,fee:18,got:27,done:true}]};
 const cases=[];
 for(const kind of ['close','meet']){
  let saved=structuredClone(base),request=null;
  if(kind==='meet'){saved.roster={柜台:'test-a',分拣:'test-b'};saved.customers=[{id:'傍晚v0',visitor:true,charId:'test-c',fee:12}];}
  const service=g.StampShop.create({read:()=>structuredClone(saved),write:async value=>(saved=structuredClone(value),true),now:()=>new Date(2026,10,8,19),seed:()=>1234});
  await service.run(kind,{characters:people,cards,id:kind==='meet'?'傍晚v0':undefined,onChat:async(charId,data)=>{request={charId,data:structuredClone(data)};return [{speakerId:charId,text:'仅用于截取请求参数，不是生成对比样本。'}];}});
  if(!request)throw Error('The actual writer did not emit '+kind+' request');
  cases.push({id:kind,description:kind==='close'?'三位同事共同打烊':'同一位角色来访，与柜台店员交谈',...request});
 }
 return cases;
}
export function extractShopFunction(source){
 const a=source.indexOf('const stampShopChat ='),b=source.indexOf('const openStamps =',a);if(a<0||b<=a)throw Error('Missing stampShopChat code anchors');return source.slice(a,b).trim();
}
export async function captureShopProbe(source,fixture,reply={lines:[]}){
 const g={console,liveChars:people,profile:{name:'玩家'},active:{},apiFor:()=>({}),ctxFor:id=>({char:people.find(c=>c.id===id),profile:{name:'玩家'}}),userName:p=>p.name,meOf:()=>({name:'玩家'})};g.window=g;
 vm.runInNewContext(read('apps/fairy-garden/story-actions.js'),g);let captured;
 g.runProbe=async(_api,ctx,probe)=>(captured={ctx,probe}, structuredClone(reply));
 const fn=vm.runInNewContext('(()=>{'+extractShopFunction(source)+';return stampShopChat;})()',g);const rows=await fn(fixture.charId,structuredClone(fixture.data));if(!captured)throw Error('No probe captured');return {...structuredClone(captured),rows:structuredClone(rows)};
}
export function probeMessages(capture){
 const source=read('js/engine.js'),a=source.indexOf('async function runProbeInner('),b=source.indexOf('const want =',a);if(a<0||b<=a)throw Error('Missing shared runProbeInner code anchors');
 // Use the real common system builder. Only buildBundle is an explicit fictional context.
 const make=vm.runInNewContext('('+source.slice(a,b)+'return system;})',{
  buildBundle:()=>['【测试上下文】','用户是玩家。此处没有聊天历史、世界书或记忆。',...people.map(p=>p.name+'：'+p.persona)].join('\n'),probeBiLine:()=>''
 });
 return Promise.resolve(make({},capture.ctx,capture.probe)).then(system=>[{role:'system',content:system},{role:'user',content:'开始。'}]);
}
