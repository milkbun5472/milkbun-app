// 2026-10-18 起 char-day.js / fairy-garden.js 拆出 -core.js（开机那半）：读源码、跑沙盒都先带上 core
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){const e={window:null,Date,JSON,Math,React:{createElement(){},useState(){},useRef(){},useEffect(){}}};e.window=e;vm.createContext(e);for(const f of ['apps/fairy-garden/day/kitchen.js','js/char-day-life.js','js/char-day-core.js','js/char-day.js','js/char-day-kitchen-chat.js','js/fairy-garden-core.js','js/fairy-garden.js'])vm.runInContext(fs.readFileSync(f,'utf8'),e);let stored={version:3,future:{keep:true},kitchenChats:{b:{rows:[{id:'b1',role:'assistant',content:'乙的记录'}],future:1}},kitchens:{b:{ingredients:{egg:7}}}},fail=false;
 e.loadJSON=(key)=>{assert.equal(key,'x_charDayHomes');return stored;};e.commitJSONDurable=async(key,v)=>{assert.equal(key,'x_charDayHomes');if(fail)return {durable:false,live:false};stored=JSON.parse(JSON.stringify(v));return {durable:true,live:true};};return {e,get:()=>stored,fail:v=>fail=v};}
test('厨房对话走真实home writer，重试不重存、角色与未知字段保留、历史不删',async()=>{
 const f=setup(),C=f.e.CharDayKitchenChat,write=a=>f.e.CharDayKit.saveHomeChange('a','kitchenChats',r=>C.chatChange(r,a));
 for(let i=0;i<90;i++)await write({kind:'user',id:'u'+i,content:'厨房这句话'+i,at:i});
 await write({kind:'reply',requestId:'u89',parts:['接第一句','接第二句'],at:100});await write({kind:'reply',requestId:'u89',parts:['重复回复'],at:101});assert.equal(f.get().kitchenChats.a.rows.length,92);assert.ok(f.get().kitchenChats.a.rows.filter(m=>m.role==='user').every(m=>m.status==='done'));
 assert.equal(f.get().kitchenChats.b.rows[0].content,'乙的记录');assert.equal(f.get().kitchenChats.b.future,1);assert.equal(f.get().kitchens.b.ingredients.egg,7);assert.equal(f.get().future.keep,true);
 const before=JSON.stringify(f.get());f.fail(true);await assert.rejects(write({kind:'user',id:'u90',content:'失败这句',at:102}));assert.equal(JSON.stringify(f.get()),before);f.fail(false);await write({kind:'user',id:'u90',content:'失败这句',at:102});await write({kind:'user',id:'u90',content:'失败这句',at:102});assert.equal(f.get().kitchenChats.a.rows.length,93);
});
test('回复只结算本次已读消息，正在生成时后来写的下一句仍等待',async()=>{
 const {e,get}=setup(),C=e.CharDayKitchenChat,write=a=>e.CharDayKit.saveHomeChange('a','kitchenChats',r=>C.chatChange(r,a));
 await write({kind:'user',id:'u1',content:'先说',at:1});await write({kind:'user',id:'u2',content:'接着说',at:2});await write({kind:'reply',requestId:'u1',parts:['接先说'],at:3});assert.equal(get().kitchenChats.a.rows[1].status,'pending');await assert.rejects(write({kind:'reply',requestId:'gone',parts:['不能写'],at:4}));
});
test('厨房发送保留完整人设和公共文风，只取厨房上下文、一次请求、65000输出额度',async()=>{
 const {e}=setup();Object.assign(e,{userName:p=>p.name,narrativeCore:()=> '公共叙事规则',CONDESCENDING_TONE_BAN:'公共反居高临下',REGISTER_FOLLOWS_SCENE:'公共声纹',STOCK_REPLY_BAN:'公共反模板',ECHO_QUESTION_BAN:'公共反复问',extractJSON:JSON.parse});const calls=[];e.callAI=async(...args)=>{calls.push(args);return '{"reply":["厨房的一句"]}';};
 const persona='完整人设'.repeat(1400)+'人设尾部',profile={name:'我',persona:'完整用户设定'},world={map:'day-kitchen',meal:'实际这桌虾仁，清淡，不辣'},history=[{role:'user',content:'厨房旧话'},{role:'user',content:'我想尝一口'}];
 const out=await e.FairyGardenService.ask({active:{id:'fixture'},character:{id:'a',name:'甲',persona},profile,world,history,text:'我想尝一口',mainline:'主线私有资料不应进入'});assert.equal(out.parts[0],'厨房的一句');assert.equal(calls.length,1);const [,sys,msg,opt]=calls[0];assert.ok(sys.includes(persona)&&sys.includes(profile.persona));assert.match(sys,/公共叙事规则/);assert.match(sys,/实际这桌虾仁/);assert.match(sys,/厨房旧话/);assert.doesNotMatch(sys,/主线私有资料|CC票/);assert.equal(msg.length,1);assert.ok(msg[0].content.length<30);assert.equal(opt.maxTokens,65000);assert.equal(opt.tag,'小家厨房');
});
