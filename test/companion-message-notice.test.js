const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={addEventListener(){}};vm.runInNewContext(fs.readFileSync('js/companion.js','utf8'),{window,Date});
const watch=()=>window.CompanionFace.makeMessageWatch();
// Shapes from pChat and pGChat writers: assistant role, ts, id/turnId and senderId.
test('初次旧消息与编辑不跳，新助手消息和卡片跳，用户与别的角色不跳',()=>{
 const read=watch(),now=100000,old={role:'assistant',content:'旧话',ts:1,turnId:'old'},chats={c1:[old]};assert.equal(read('c1',chats,{},now),false);
 const a={role:'assistant',content:'新话',ts:now,turnId:'t1'};chats.c1=[old,a];assert.equal(read('c1',chats,{},now),true);assert.equal(read('c1',chats,{},now+1),false);
 chats.c1=[old,{...a,content:'编辑这句话'}];assert.equal(read('c1',chats,{},now+1),false);
 chats.c1=[...chats.c1,{role:'user',content:'我的话',ts:now+2}];assert.equal(read('c1',chats,{},now+2),false);
 chats.c2=[{role:'assistant',ts:now+3}];assert.equal(read('c1',chats,{},now+3),false);
 chats.c1=[...chats.c1,{role:'assistant',kind:'photo',id:'photo1',ts:now+4}];assert.equal(read('c1',chats,{},now+4),true);
});
test('群消息按真实senderId归属，导入旧记录、切角色均不补跳',()=>{
 const read=watch(),groups={g:[]};read('c1',{},groups,100000);groups.g=[{role:'assistant',senderId:'c2',ts:100001}];assert.equal(read('c1',{},groups,100001),false);
 groups.g=[...groups.g,{role:'assistant',senderId:'c1',id:'m1',ts:100002}];assert.equal(read('c1',{},groups,100002),true);
 groups.g=[...groups.g,{role:'assistant',senderId:'c1',id:'old',ts:10}];assert.equal(read('c1',{},groups,100003),false);assert.equal(read('c2',{},groups,100004),false);
});
