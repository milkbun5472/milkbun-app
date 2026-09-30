const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/ledger.js'), 'utf8');
function setup() {
  // Hand-entered transaction shape comes from AddSheet.save, accounts from AccountEdit.save.
  let data = { txns: [
    { id:'l1', ts:100, date:'2026-09-30', type:'expense', amount:36, currency:'CNY', category:'娱乐', catEmoji:'🎮', catIcon:'', account:'bank', note:'买了想玩的游戏', refunds:[{date:'2026-09-30',amount:6,note:''}], comments:[{charId:'a',text:'你自己的批注'},{charId:'b',text:'别人的私密批注'}] },
    { id:'l2', ts:101, date:'2026-09-30', type:'expense', amount:99, currency:'CNY', category:'购物', account:'bank', note:'没有分享的秘密', comments:[] }
  ], settings:{ visibleTo:[], shareAcct:false, currencies:[{code:'CNY',label:'人民币',symbol:'¥'}], accounts:[{id:'bank',type:'debit',init:10000,name:'秘密银行'}] } };
  const context = { window:{}, loadJSON:()=>JSON.parse(JSON.stringify(data)), saveJSON:(k,d)=>{assert.equal(k,'x_ledger');data=JSON.parse(JSON.stringify(d));}, pageColor:(p,k,f)=>f };
  vm.runInNewContext(src, context);
  return { api:context.window, get:()=>data, set:d=>{data=d;} };
}
test('single bill share contains net amount and recipient comment, excludes account and other bills',()=>{
  const {api,get}=setup();const before=JSON.stringify(get());
  assert.equal(api.ledgerShareMessage('missing','a'),null);
  assert.equal(api.ledgerShareMessage('l1',''),null);
  const msg=api.ledgerShareMessage('l1','a');
  assert.equal(msg.role,'user');assert.equal(msg.kind,'ledgershare');assert.match(msg.title,/30\.00/);
  assert.match(msg.content,/你自己的批注/);
  assert.doesNotMatch(JSON.stringify(msg),/秘密银行|10000|别人的私密批注|没有分享的秘密/);
  assert.equal(JSON.stringify(get()),before,'building the message does not write or duplicate transactions');
});
test('explicit share grants only its snapshot; later edits and global permission do not leak',()=>{
  const {api,get,set}=setup();assert.equal(api.ledgerNoteFor('a'),'');
  api.ledgerMarkShared('l1','a');api.ledgerMarkShared('l1','a');
  assert.equal(get().txns.length,2);assert.equal(Object.keys(get().txns[0].sharedWith).length,1);
  assert.match(api.ledgerNoteFor('a'),/买了想玩的游戏/);assert.doesNotMatch(api.ledgerNoteFor('a'),/秘密|银行|批注/);
  assert.equal(api.ledgerNoteFor('b'),'');
  const d=get();d.txns[0].note='后来改成的私密备注';set(d);
  assert.match(api.ledgerNoteFor('a'),/买了想玩的游戏/);assert.doesNotMatch(api.ledgerNoteFor('a'),/后来改成/);
  d.settings.visibleTo=['b'];set(d);assert.match(api.ledgerNoteFor('b'),/后来改成的私密备注/);
  assert.doesNotMatch(api.ledgerNoteFor('b'),/秘密银行|10,000/);
  d.settings.visibleTo=[];set(d);assert.equal(api.ledgerNoteFor('b'),'');
  d.txns=d.txns.filter(t=>t.id!=='l1');set(d);assert.equal(api.ledgerNoteFor('a'),'');
});
test('share callback uses the existing chat writer then opens that character, without an AI call',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const start=app.indexOf('  const forwardLedgerToChat ='),end=app.indexOf('  const forwardFicToChat =',start);
  assert.ok(start>0&&end>start);
  const {api,get}=setup(), calls=[], messages=[];
  const fn=new Function('window','liveChars','pChat','openChatById','toast',app.slice(start,end)+'return forwardLedgerToChat;')(
    api,[{id:'a'}],(id,write)=>{calls.push('write:'+id);messages.push(...write([]));},id=>calls.push('open:'+id),()=>{});
  assert.equal(fn('l1','missing'),false);assert.equal(fn('missing','a'),false);assert.equal(messages.length,0);
  assert.equal(fn('l1','a'),true);assert.deepEqual(calls,['write:a','open:a']);assert.equal(messages[0].ledgerId,'l1');
  assert.ok(get().txns[0].sharedWith.a);
});
test('group online, call and offline each keep the bill inside the authorized member context',()=>{
  const {engine,cut,fixture,evaluate,wire,sections}=require('./_group-background-fixture.cjs');
  const {api}=setup();api.ledgerMarkShared('l1','a');
  for(const surface of ['online','call','offline']){
    const env=wire(fixture());env.window.ledgerNoteFor=api.ledgerNoteFor;
    env.ledgerContextBlock=evaluate(cut(engine,'function ledgerContextBlock(','function buildBundle('),env,'ledgerContextBlock');
    env.ctx.memberFinance={a:api.ledgerNoteFor('a'),b:api.ledgerNoteFor('b')};
    const text=evaluate(sections[surface],env,'memberDesc');
    const a=text.slice(text.indexOf('【甲】'),text.indexOf('【乙】'));
    const b=text.slice(text.indexOf('【乙】'));
    assert.match(a,/买了想玩的游戏/);assert.match(a,/以下账单仅 甲 知道/);assert.doesNotMatch(b,/买了想玩的游戏/);
    assert.doesNotMatch(text,/秘密银行|没有分享的秘密|别人的私密批注/);
  }
});
