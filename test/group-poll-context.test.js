const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const cut = (a,b) => app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
function setup() {
  const requests=[],timers=[],notices=[];
  const b={Date,Math,Number,Set,console:{warn(){}},useRef:current=>({current}),fmtStampAI:()=>'',
    profile:{name:'用户'},characters:[{id:'a',name:'甲',persona:'甲设定'},{id:'b',name:'乙',persona:'乙设定'}],
    groups:[{id:'g',memberIds:['a','b']}],groupChatsRef:{current:{g:[]}},gsFor:()=>({ctxN:40,memoryInterop:false}),
    active:{},groupMembers:g=>b.characters.filter(c=>g.memberIds.includes(c.id)),
    isOocMsg:m=>m.kind==='ooc',contextAllowsMessage:m=>!m.failed,
    userName:p=>p.name,toast:s=>notices.push(s),setTimeout:(fn,ms)=>{if(ms===900)timers.push(fn);else fn()},
    pushGroupRich:(id,m)=>{b.groupChatsRef.current[id].push({...m,ts:Date.now()})},
    pGChat:(id,fn)=>{b.groupChatsRef.current[id]=fn(b.groupChatsRef.current[id]||[])},
    memLibRef:{current:[]},memCfgRef:{current:{}},memories:{a:'甲私密长期记忆',b:'乙私密长期记忆'},
    splitGroupMemories:()=>({shared:[],perChar:{}}),formatMemLib:x=>x.map(v=>v.text).join('\n'),
    groupPersonaText:p=>p,groupPersonaBudget:()=>1000,NPC_PERSONA_CAP:1000,
    groupNowSegs:()=>({mdSeg:'心情层'}),memberPrivLines:()=>{throw Error('封闭群不能读实时私聊')},
    groupBans:()=>'',loreForContext:()=>'',parseJSONLoose:JSON.parse,
    callAI:async(api,sys,hist,opts)=>{requests.push({sys,hist,opts});return JSON.stringify([{name:'甲',choice:'1',say:'选择第二项'}])}
  };
  vm.createContext(b);
  // v66.16：群通话回执现在把【逐句原话】也喂回去（她：「靠一个不靠谱的小结，
  //   说出来的话都是错的」），所以 groupHistLine 依赖 callTranscriptForOnline，
  //   连同它那道共用预算一起搬进沙盒。
  vm.runInContext(cut('  const TRANSCRIPT_CAP =','  useEffect(() => {\n    offlinesRef.current') +
    cut('  const pollVoteBusyRef =','  // ---- 群红包 ----') +
    cut('  const groupContextRows =','  // ---- 群里每位成员那一段') +
    '\nthis.ops={startPoll,castVote,genPollVotes,groupPoll,groupPollText,groupContextRows,groupHistLine};',b);
  return {b,requests,timers,notices};
}
test('用实际 startPoll 写入两张卡，自动投票分别投原卡，异步删除前文不串票',async()=>{
  const f=setup(),{b}=f;
  b.groupChatsRef.current.g.push({role:'user',content:'前文'});
  b.ops.startPoll('g','题一',['甲项','乙项'],false);
  b.ops.startPoll('g','题二',['丙项','丁项'],false);
  const polls=b.groupChatsRef.current.g.filter(m=>m.kind==='poll');
  assert.notEqual(polls[0].pollId,polls[1].pollId);
  b.groupChatsRef.current.g.shift();
  f.timers.forEach(fn=>fn()); await new Promise(setImmediate);
  assert.deepEqual(polls.map(p=>Array.from(b.ops.groupPoll('g',p.pollId).options[1].voters)),[['甲'],['甲']]);
  assert.equal(f.requests.length,2);
  assert.match(f.requests[0].sys,/甲项/); assert.match(f.requests[0].sys,/乙项/);
  assert.match(f.requests[0].sys,/甲私密长期记忆/);
  assert.match(f.requests[0].sys,/只有 甲 本人知道/);
  assert.equal(f.requests[0].opts.maxTokens,65535);
});
test('匿名历史只有票数；正常群聊和群通话使用相同窗口，回执读取实际归档 log',()=>{
  const {b}=setup(); b.ops.startPoll('g','匿名题',['选项一','选项二'],true);
  const poll=b.groupChatsRef.current.g[0]; b.ops.castVote('g',poll.pollId,0,'甲');
  const text=b.ops.groupHistLine(b.ops.groupPoll('g',poll.pollId));
  assert.match(text,/选项一｜1票/); assert.doesNotMatch(text,/甲/);
  // endCall 的真实存档字段：kind=callend, log[].role/senderName/act/content/ts。
  assert.match(app,/const bubble = \{ role: "system", kind: "callend".*id: callId, log \}/);
  const receipt={role:'system',kind:'callend',dur:'00:30',log:[{role:'user',content:'电话里约定',ts:1},{role:'char',senderName:'甲',act:false,content:'记住具体地址',ts:2}]};
  assert.match(b.ops.groupHistLine(receipt),/用户：电话里约定/);
  assert.match(b.ops.groupHistLine({...receipt,sum:'简略摘要'}),/甲：记住具体地址/);
  b.groupChatsRef.current.g=Array.from({length:50},(_,i)=>({role:'user',content:'第'+i+'条',ts:i}));
  b.groupChatsRef.current.g.push({kind:'ooc',content:'排除'},{recalled:true,content:'撤回'},{failed:true,content:'失败'});
  const rows=b.ops.groupContextRows('g'); assert.equal(rows.length,40); assert.equal(rows[0].content,'第10条');
  assert.match(app,/const _graw = groupContextRows\(groupId\)/);
  assert.match(app,/const gcChat = cur.groupId \? groupContextRows\(cur.groupId\)/);
});
test('无效票不落评论、不串卡；有效改票唯一；删除卡后迟到回应丢弃',async()=>{
  const {b}=setup(); b.ops.startPoll('g','问题',['一','二'],false); const id=b.groupChatsRef.current.g[0].pollId;
  for(const choice of [null,undefined,'',true,1.5,99]) {
    b.callAI=async()=>JSON.stringify([{name:'甲',choice,say:'无效票不能声称投了'}]);
    await b.ops.genPollVotes('g',id);
  }
  assert.equal(b.groupChatsRef.current.g.length,1);
  b.ops.castVote('g',id,0,'甲'); b.ops.castVote('g',id,1,'甲');
  assert.deepEqual(Array.from(b.ops.groupPoll('g',id).options,o=>o.voters.length),[0,1]);
  b.ops.castVote('g',id,-1,'甲'); assert.deepEqual(Array.from(b.ops.groupPoll('g',id).options,o=>o.voters.length),[0,0]);
  let release;b.callAI=()=>new Promise(r=>release=r);
  const pending=b.ops.genPollVotes('g',id);b.groupChatsRef.current.g=[];
  release(JSON.stringify([{name:'甲',choice:1,say:'晚到'}]));await pending;
  assert.equal(b.groupChatsRef.current.g.length,0);
});
test('普通群回复的 pollVote 字段真的落票，只能操作这轮上下文里的卡',()=>{
  const {b}=setup(); b.ops.startPoll('g','当前题',['一','二'],false);
  const poll=b.groupChatsRef.current.g[0];
  const start=app.indexOf('          if (item.pollVote && gPolls.some(');
  const code=app.slice(start,app.indexOf('          if (item.redpacket',start));
  b.gPolls=[poll]; b.groupId='g'; b.spk=b.characters[0];
  b.item={pollVote:{pollId:poll.pollId,choice:'1'}};
  vm.runInContext(code,b);
  assert.deepEqual(Array.from(b.ops.groupPoll('g',poll.pollId).options[1].voters),['甲']);
  b.ops.startPoll('g','不在这轮上下文',['三','四'],false);
  const other=b.groupChatsRef.current.g[1];b.item={pollVote:{pollId:other.pollId,choice:0}};
  vm.runInContext(code,b);assert.equal(b.ops.groupPoll('g',other.pollId).options[0].voters.length,0);
});
