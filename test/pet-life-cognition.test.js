const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const host=fs.readFileSync('js/fairy-garden.js','utf8'),engine=fs.readFileSync('js/engine.js','utf8'),app=fs.readFileSync('js/app.js','utf8');
function between(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
function service(extra={}){const c={React:{},WeakMap,JSON,Error,extractJSON:JSON.parse,narrativeCore:()=> '原文风',CONDESCENDING_TONE_BAN:'',REGISTER_FOLLOWS_SCENE:'',STOCK_REPLY_BAN:'',ECHO_QUESTION_BAN:'',userName:p=>p?.name||'你',calls:[],...extra};c.window=c;c.callAI=async(...args)=>{c.calls.push(args);return JSON.stringify({reply:['我过去看看。'],action:{kind:'pet',petId:'active'}});};vm.runInNewContext(fs.readFileSync('apps/fairy-garden/rules.js','utf8'),c);vm.runInNewContext(host,c);vm.runInNewContext(between(engine,'function gameChatSource(','async function summarizeGroup('),c);return c;}
test('manual and event pet replies share the living premise, full persona/permitted context and unchanged pending facts',async()=>{
 const c=service(),world={map:'pet-home',activePetId:'active',pet:{id:'active',name:'团子',task:{kind:'play',target:'you',phase:'walking'}},pets:[{id:'active',name:'团子'}],career:{wallet:42},home:{parcels:{waiting:[],carrying:[{id:'bag'}],placed:[]}},companion:{place:'home',job:null}};
 const before=JSON.stringify(world),character={name:'甲',persona:'完整人设，不一定喜欢照料'},history=[{role:'user',content:'过去说过的原话'}];
 for(const event of [false,true]){await c.FairyGardenService.ask({active:{},character,profile:{name:'你'},world,history,text:'看看它',event});const sys=c.calls.at(-1)[1];assert.ok(sys.includes(c.FairyWorldDialogs.cognition('pets')));assert.ok(sys.includes(character.persona));assert.ok(sys.includes('尚在路上'));assert.ok(sys.includes('拒绝'));assert.ok(sys.includes('"wallet":42'));assert.ok(sys.includes('carrying'));assert.ok(sys.includes(history[0].content));for(const stale of ['宠物小游戏','一起生活在魔法庭院','刚发生的游戏事件','游戏中的生活按游戏经历'])assert.ok(!sys.includes(stale),stale);assert.ok(sys.includes(event?'刚发生的生活小事':'对方刚说'));}
 assert.equal(JSON.stringify(world),before);
 c.calls=[];await c.FairyGardenService.ask({active:{},character,profile:{name:'你'},world,history,text:'你好',mainline:'这间房准许的上下文'});assert.ok(c.calls[0][1].includes('这间房准许的上下文'));assert.equal(c.calls[0][3].maxTokens,65000);
});
test('true seat receives the same factual life setting without changing the original world or action contract',async()=>{
 let ticket;const c=service({Cloud:{},CCSeat:{ask:async x=>{ticket=x;return {reply:['我来摸摸。'],action:{kind:'pet',petId:'active'}};}}}),world={map:'pet-home',activePetId:'active'},before=JSON.stringify(world);
 const out=await c.FairyGardenService.ask({engineer:true,character:{id:'a'},world,history:[],text:'摸摸它'});assert.equal(ticket.world.lifeContext,c.FairyWorldDialogs.cognition('pets'));assert.equal(JSON.stringify(world),before);assert.equal(out.petId,'active');assert.equal(out.petAction,'pet');assert.equal(c.calls.length,0);
});
test('garden/train cognition and existing gameplay framing stay separate from the pet life setting',async()=>{
 const c=service();for(const [world,label]of [[{map:'garden'},'这是你们在玩的一个小游戏'],[{map:'carriage'},'你们正在列车小游戏里旅行']]){await c.FairyGardenService.ask({active:{},character:{name:'甲'},profile:{name:'你'},world,history:[],text:'你好'});assert.ok(c.calls.at(-1)[1].includes(label));assert.ok(!c.calls.at(-1)[1].includes('一起养宠的日常'));}
 assert.equal(c.FairyWorldDialogs.cognition('garden'),'');assert.equal(c.FairyWorldDialogs.cognition('train'),'');assert.equal(c.FairyWorldDialogs.cognition('bad'),'');
});
test('actual room writer provenance supplies the shared living setting to summaries without recasting unknown old records',()=>{
 const c=service();c.chats={room:[]};c.GARDEN_LOG=100;c.pChat=(key,fn)=>{c.chats[key]=fn(c.chats[key]||[]);};
 vm.runInNewContext(between(app,'  const gardenHistory =','  const openGardenRoomFor =')+';this.record=gardenRecord;',c);
 c.record('room').onTurn({text:'今天的家务',parts:['现在去换水'],gameWorld:'pets',gameArchiveId:'one'});
 const rows=c.chats.room,before=JSON.stringify(rows);assert.ok(c.gameChatSummaryContext(rows).includes(c.FairyWorldDialogs.cognition('pets')));assert.ok(c.gameChatSummaryContext(rows).includes('不补造旧经历'));assert.equal(JSON.stringify(rows),before);
 for(const world of ['garden','train']){c.record('room').onTurn({text:'其他世界',parts:['原话'],gameWorld:world,gameArchiveId:'one'});assert.ok(!c.gameChatSummaryContext(c.FairyWorldDialogs.select(c.chats.room,world,'one')).includes('一起养宠的日常'));}
 assert.ok(!c.gameChatSummaryContext([{role:'assistant',kind:'garden',content:'没有来源的旧话'}]).includes('一起养宠的日常'));assert.equal(c.gameChatSummaryContext([{role:'user',content:'普通手机聊天'}]),'');
});
