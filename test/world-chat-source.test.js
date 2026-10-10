const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=fs.readFileSync('js/engine.js','utf8'),app=fs.readFileSync('js/app.js','utf8'),host=fs.readFileSync('js/fairy-garden.js','utf8'),components=fs.readFileSync('js/components.js','utf8');
function between(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(i,j);}
function fn(s,name){const i=s.indexOf('function '+name+'('),j=s.indexOf('\n}',i);assert.ok(i>=0&&j>i,name);return (s.slice(i-6,i)==='async '?'async ':'')+s.slice(i,j+2);}
function setup(){
 const c={window:{},calls:[],extractJSON:JSON.parse};vm.createContext(c);
 vm.runInContext(between(host,'  const WORLDS =','  const INDEX_KEY')+';window.FairyWorlds=WORLDS;',c);
 vm.runInContext(between(engine,'function gameChatSource(','async function summarizeGroup('),c);
 c.callAI=async(p,sys,msg,opts)=>{c.calls.push({p,sys,msg,opts});return '[]';};
 for(const name of ['summarizeGroup','extractMemories','extractGroupMemories','summarizeChat','summarizeChatBlock'])vm.runInContext(fn(engine,name),c);
 c.window.FairyWorldDialogs={select:(rows,w,id)=>rows.filter(m=>m.gameWorld===w&&m.gameArchiveId===id)};
 c.chats={room:[]};c.GARDEN_LOG=100;c.pChat=(key,f)=>{c.chats[key]=f(c.chats[key]||[])};
 vm.runInContext(between(app,'  const gardenHistory =','  const openGardenRoomFor =')+';this.record=gardenRecord;',c);
 // Fixtures come from the actual writer, including its multipart assistant bubbles.
 for(const w of c.window.FairyWorlds)c.record('room').onTurn({text:'问题 '+w.name,parts:['回答 '+w.name,'再说一句'],gameWorld:w.id,gameArchiveId:'archive-source'});
 c.chats.room.push({role:'assistant',content:'旧话',kind:'garden',ts:1},{role:'user',content:'普通聊天',ts:2});
 return c;
}
test('actual writer sources share the world catalog, leave verbatim content and archive ids intact, and never guess old sources',()=>{
 const c=setup(),rows=c.chats.room,before=JSON.stringify(rows);
 for(const m of rows.slice(0,9)){assert.equal(c.gameChatSource(m),'小世界 · '+c.window.FairyWorlds.find(w=>w.id===m.gameWorld).name);assert.ok(c.gameChatText(m).endsWith(m.content));assert.ok(!c.gameChatText(m).includes('archive-source'));}
 assert.equal(c.gameChatSource(rows[9]),'小世界 · 来源未记录');assert.equal(c.gameChatText(rows[10]),'普通聊天');assert.equal(c.gameChatSource({kind:'garden',gameWorld:'bad'}),'小世界 · 来源未记录');assert.equal(c.gameChatSource(null),'');assert.equal(c.gameChatSummaryContext([rows[10]]),'');assert.equal(JSON.stringify(rows),before);
 c.window.FairyWorlds.find(w=>w.id==='pets').name='改名测试';assert.equal(c.gameChatSource(rows[6]),'小世界 · 改名测试');
});
test('rolling, cumulative, group and memory summaries receive every source, preserve evidence ids, and work with actual context shape',async()=>{
 const c=setup(),rows=c.chats.room,ctx={char:{name:'同行者'},profile:{name:'你'},memory:'原记忆'};
 await c.summarizeChatBlock({},ctx,rows);await c.summarizeChat({},ctx,rows);await c.summarizeGroup({},ctx,rows);await c.extractMemories({},ctx,rows);await c.extractGroupMemories({},ctx,rows,[ctx.char]);
 assert.equal(c.calls.length,5);
 for(const call of c.calls){for(const w of c.window.FairyWorlds)assert.ok(call.sys.includes('【小世界 · '+w.name+'】'));assert.ok(call.sys.includes('【小世界 · 来源未记录】旧话'));assert.ok(call.sys.includes('普通聊天'));assert.ok(call.sys.includes('保留对应世界名'));assert.equal(call.msg.length,1);assert.equal(call.msg[0].content,'整理这段记录。');assert.equal(call.opts.maxTokens,65000);}
 assert.ok(c.calls[3].sys.includes('[消息ID ts_'+rows[0].ts+']'));assert.ok(c.calls[1].sys.includes('原记忆'));
});
test('real room handoff source formatting respects its cursor/recalled gate and writes the existing summary record',async()=>{
 const c=setup();c.characters=[];c.chatsRef={current:c.chats};c.loadJSON=()=>[];c.toast=()=>{};c.profile={name:'你'};c.userName=p=>p.name;c.apiFor=id=>({id});c.added=[];c.window.ChatRooms={chatKey:()=> 'room',addSummary:r=>c.added.push(r),save:(_id,r)=>r};
 vm.runInContext(between(app,'  const summarizeChatRoom =','  const createChatRoomFromStart =')+';this.run=summarizeChatRoom;',c);
 const cursor=c.chats.room[0].ts;c.chats.room.push({role:'user',kind:'garden',gameWorld:'train',gameArchiveId:'archive-source',content:'撤回测试',recalled:true,ts:cursor+20});
 await c.run({id:'test',name:'同行者'},{id:'room',name:'测试房',summaryCursorTs:cursor},'');
 assert.equal(c.calls.length,1);assert.ok(c.calls[0].sys.includes('小世界 · 绒绒小镇'));assert.ok(!c.calls[0].sys.includes('撤回测试'));assert.equal(c.calls[0].msg[0].content,'整理这段记录。');assert.equal(c.added.length,1);assert.equal(c.added[0].fromTs,cursor);
});
test('chat, search, archive, copy and forwarding retain the same source formatter with a scoped theme hook',()=>{
 assert.ok(between(components,'function ChatThread(','function ChatSearchSheet(').includes('h(GameChatSource, { m })'));
 assert.ok(between(components,'function ChatSearchSheet(','function callInviteState(').includes('gameChatText({ ...m'));
 assert.match(components,/const body = .*gameChatText\(m\)/);assert.match(app,/copyText\(gameChatText\(m\)\)/);assert.match(app,/text: who \+ "：" \+ gameChatText\(m\)/);assert.match(app,/text: gameChatText\(m\),\n        ts:/);
 const studio=fs.readFileSync('js/theme-studio.js','utf8');assert.match(studio,/\["messagesource", "游戏对话上方的世界来源/);
});

test('actual phone copy action keeps source and waits for clipboard success/failure',async()=>{
 const c=setup();c.activeChar={id:'room'};c.window.ChatRooms={isSideKey:()=>false};c.notices=[];c.toast=t=>c.notices.push(t);c.copied=[];let resolveCopy;
 c.copyText=text=>{c.copied.push(text);return new Promise(r=>{resolveCopy=r;});};
 vm.runInContext(between(app,'  const handleMsgAction =','  const gsFor =')+';this.copyAction=handleMsgAction;',c);
 c.copyAction('copy',6,'room');assert.ok(c.copied[0].includes('【小世界 · 绒绒小镇】'));assert.equal(c.notices.length,0);resolveCopy(false);await Promise.resolve();assert.ok(c.notices[0].includes('复制不了'));
 c.copyAction('copy',10,'room');assert.equal(c.copied[1],'普通聊天');assert.equal(c.notices.length,1);resolveCopy(true);await Promise.resolve();assert.equal(c.notices[1],'已复制');
});
