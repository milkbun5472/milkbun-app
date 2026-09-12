const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const source = read('js/fanfic.js'), app = read('js/app.js');
const Rooms = require('../js/chat-rooms.js');
// 邀请与交稿字段钉在app的写入方，非新造的待办存档。
const invite = (id, ts) => ({ role: 'assistant', kind: 'ficinvite', ficId: id, subject: id, ts });
const done = (id, ts) => ({ role: 'assistant', kind: 'ficdone', ficId: id, chapIdx: 0, ts });
test('待写卡跨长聊天和重进仍在，换书隔离，交稿/撤回后收起', () => {
  assert.match(app, /kind: "ficinvite", ficId: roomFic.id/);
  assert.match(app, /kind: "ficdone", ficId: f.id/);
  const a = invite('a', 1), b = invite('b', 3);
  const rows = [a, { role: 'user', content: '继续商量', ts: 2 }, b];
  for (let i = 0; i < 80; i++) rows.push({ role: 'assistant', content: '讨论' + i, ts: 4 + i });
  assert.equal(Rooms.pendingFicInvite(rows, 'a'), a);
  assert.equal(Rooms.pendingFicInvite(rows, 'b'), b);
  assert.equal(Rooms.pendingFicInvite(rows, 'missing'), null);
  assert.equal(Rooms.pendingFicInvite(JSON.parse(JSON.stringify(rows)), 'a').ts, 1);
  assert.equal(Rooms.pendingFicInvite(rows.concat(done('a', 100)), 'a'), null);
  assert.equal(Rooms.pendingFicInvite(rows.concat(done('a', 100)), 'b'), b);
  assert.equal(Rooms.pendingFicInvite([{ ...a, recalled: true }], 'a'), null);
});

function fixture() {
  const calls = [], store = {};
  const box = { React: {}, window: {}, Axes: require('../js/axes.js'),
    loadJSON: (k, fallback) => store[k] || fallback, saveJSON: (k,v) => { store[k]=v; return true; },
    narrativeCore: () => '叙事底座', INTIMACY_WORLDNOTE: '', WORLDBOOK_RULE: '',
    isOocMsg: m => m.kind === 'ooc', parseJSONLoose: JSON.parse,
    callAI: async (p, sys, messages, opts) => {
      calls.push({sys, messages, opts});
      return JSON.stringify({ content: '正文', add: '续段', endHook: '新现场', facts: [], seed: '', paid: [],
        writerBrief: {voice:'执笔测试笔法', angle:'测试切入', stance:'测试立场', choice:'测试选择'} });
    } };
  vm.runInNewContext(source, box);
  return {K: box.window.Fanfic, calls, store};
}

test('超过14条、160字与1200字的本章讨论完整进入真实生成请求', async () => {
  const {K, calls} = fixture();
  const rows = [{kind:'ficshare',ficId:'a',ts:1},done('a',2)];
  for(let i=0;i<50;i++) rows.push({role:i%2?'assistant':'user',content:'讨论'+i+'：'+'细节'.repeat(100)+'尾部'+i,ts:i+3});
  rows.push({kind:'ficshare',ficId:'b',ts:100},{role:'user',content:'别本的秘密',ts:101});
  const start=app.indexOf('  const roomTalkOf = (chatKey'), end=app.indexOf('  const replyNow = async',start);
  const box={window:{ChatRooms:Rooms},chatsRef:{current:{room:rows}},roomFicPick:()=>null,isOocMsg:m=>m.kind==='ooc'};
  vm.runInNewContext(app.slice(start,end)+'this.talk=roomTalkOf;',box);
  const talk=box.talk('room','测试角色','测试用户',14,'a');
  const writer={id:'c1',name:'测试角色',persona:'写过小说，讲究节奏'};
  await K.genNextChapter({}, {id:'a',title:'测试文',cp:['c1'],chapters:[]}, {name:'测试'}, [writer], '测试用户', '', {byChar:writer,roomTalk:talk});
  assert.equal(calls.length,1);
  for(let i=0;i<50;i++){assert.ok(calls[0].sys.includes('讨论'+i+'：'));assert.ok(calls[0].sys.includes('尾部'+i));}
  assert.ok(!calls[0].sys.includes('别本的秘密'));
});

test('角色与作者的实发请求分流：笔法/立场先于正文，不套统一预设', async () => {
  const {K,calls}=fixture();
  const f={id:'a',title:'测试',cp:['c1'],chapters:[]}, writer={id:'c1',name:'测试角色',persona:'教育与写作经历标记'};
  const opts={byChar:writer,style:'统一文风标记'};
  const ch=await K.genNextChapter({},f,{name:'世界'},[writer],'用户','',opts);
  const sys=calls[0].sys;
  assert.ok(sys.includes('教育与写作经历标记'));
  assert.ok(sys.includes('你是「测试角色」本人'));
  assert.ok(!sys.includes('你是一位很会写的同人文作者'));
  assert.ok(!sys.includes('统一文风标记'));
  assert.ok(!sys.includes('他不写文，也不混同人圈'));
  assert.ok(sys.indexOf('"writerBrief":')<sys.indexOf('"content":'));
  assert.equal(ch.writerBrief.voice,'执笔测试笔法');
  assert.equal(calls[0].opts.maxTokens,65535);
  await K.genNextChapter({},f,{name:'世界'},[writer],'用户','',{style:'统一文风标记'});
  assert.ok(calls[1].sys.includes('统一文风标记'));
  assert.ok(calls[1].sys.includes('你是一位很会写的同人文作者'));
  assert.ok(!calls[1].sys.includes('"writerBrief":'));
  f.chapters=[{...ch,byCharId:'c1',byAuthor:writer.name}];
  await K.genChapterMore({},f,{name:'世界'},[writer],'用户','',opts,0);
  assert.ok(calls[2].sys.includes('执笔测试笔法'));
  assert.ok(!calls[2].sys.includes('统一文风标记'));
  await assert.rejects(K.genChapterMore({},f,{name:'世界'},[writer],'用户','',{},0),/找不到这一章的执笔角色/);
  assert.equal(calls.length,3);
});

test('真实交稿入口读取按下时的新讨论，保存失败不消耗邀请，成功后旧卡不能重写', async () => {
  const {K,calls}=fixture(), writer={id:'c1',name:'测试角色',persona:'喜欢写故事'};
  const card=invite('a',1), key=Rooms.chatKey('c1','r1');
  const chatsRef={current:{[key]:[card,{role:'user',content:'出卡之后刚补的决定',ts:2}]}};
  let fics=[{id:'a',title:'测试',cp:['c1'],chapters:[]}], canSave=false, busy=false;
  K.loadFics=()=>fics;K.saveFics=next=>{if(canSave)fics=next;return canSave;};
  const box={window:{Fanfic:K,ChatRooms:Rooms},activeChar:writer,activeRoomId:'r1',chatsRef,
    characters:[writer],profile:{name:'测试用户'},bgActiveRef:{current:{}},active:{},
    toast:()=>{},laneBusy:()=>busy,startLane:()=>{busy=true;},endLane:()=>{busy=false;},
    relOfChar:()=>({}),loreForContext:()=>'',roomFicPick:()=>null,isOocMsg:m=>m.kind==='ooc',
    pChat:(k,fn)=>{chatsRef.current[k]=fn(chatsRef.current[k]||[]);}};
  const t0=app.indexOf('  const roomTalkOf = (chatKey'),t1=app.indexOf('  const replyNow = async',t0);
  const s=app.indexOf('onOpenFicInvite: async m => {'),e=app.indexOf('\n    },',s);
  vm.runInNewContext(app.slice(t0,t1)+'this.write='+app.slice(s+'onOpenFicInvite: '.length,e+6)+';',box);
  await box.write(card);
  assert.equal(busy,false);assert.equal(Rooms.pendingFicInvite(chatsRef.current[key],'a'),card);
  assert.ok(calls[0].sys.includes('出卡之后刚补的决定'));
  canSave=true;await box.write(card);
  assert.equal(fics[0].chapters.length,1);assert.equal(fics[0].chapters[0].byCharId,'c1');
  assert.equal(Rooms.pendingFicInvite(chatsRef.current[key],'a'),null);
  await box.write(card);assert.equal(calls.length,2);
});
