const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/fairy-garden.js','utf8'),app=fs.readFileSync('js/app.js','utf8');
function kit(){
 const a=source.indexOf('  const DIALOG_WORLDS'),b=source.indexOf('  function LegacyWorldDialogs(',a);assert.ok(a>0&&b>a);
 const ctx={root:{},write:(key,d)=>{ctx.saved=d;return d;}};vm.createContext(ctx);
 vm.runInContext(source.slice(a,b)+';root.test={worldRecord,worldHistory,storeWorldTurn};',ctx);
 return {ctx,...ctx.root.FairyWorldDialogs,...ctx.root.test};
}
function room(k){
 const a=app.indexOf('  const gardenHistory ='),b=app.indexOf('  const openGardenRoomFor =',a);assert.ok(a>0&&b>a);
 const chats={room:[]},ctx={chats,GARDEN_LOG:100,window:{FairyWorldDialogs:k,ChatRooms:{}},pChat:(key,fn)=>{chats[key]=fn(chats[key]);}};vm.createContext(ctx);
 vm.runInContext(app.slice(a,b)+';this.record=gardenRecord;this.recordFor=gardenRecordFor;',ctx);return ctx;
}
const data=()=>({id:'archive-a',partnerId:'cat-parent',worlds:{garden:{herbs:9},pets:{wallet:42},train:{distance:11}},journey:{look:{hair:'bun'}},dialogs:{}});
const contents=xs=>Array.from(xs,m=>m.content);
test('real room writer stamps every user/bubble; phone keeps all worlds while both entry routes filter before limiting',()=>{
 const k=kit(),r=room(k),d=data();
 for(const w of ['garden','train','pets'])k.storeWorldTurn('x_fairyGarden::room',()=>d,k.worldRecord({record:r.record('room')},'x',w,d),d.partnerId,w+' question',{parts:[w+' first',w+' second']},200,w);
 assert.equal(r.chats.room.length,9);
 for(const m of r.chats.room){assert.ok(['garden','train','pets'].includes(m.gameWorld));assert.equal(m.gameArchiveId,d.id);assert.equal(m.kind,'garden');}
 for(const w of ['garden','train','pets']){
  for(const p of [{record:r.record('room')},{recordFor:r.recordFor}])assert.deepEqual(contents(k.worldHistory(p,'x_fairyGarden::room',d,w)),[w+' question',w+' first',w+' second']);
 }
 const more={...d,id:'archive-b'};const record=k.worldRecord({record:r.record('room')},'x','pets',more);record.onTurn({text:'other archive',parts:['other reply']});
 assert.deepEqual(contents(k.worldHistory({record:r.record('room')},'x',d,'pets')),['pets question','pets first','pets second']);
 for(let i=0;i<160;i++)k.worldRecord({record:r.record('room')},'x','train',d).onTurn({text:'train '+i,parts:['reply '+i]});
 assert.deepEqual(contents(k.worldHistory({record:r.record('room')},'x',d,'pets')),['pets question','pets first','pets second']);
});
test('standalone writer isolates all worlds and archive ids, preserving legacy and other character/world progress through overflow and reload',()=>{
 const k=kit();let d=data();const old={role:'assistant',content:'untagged old reply',status:'done'};d.dialogs[d.partnerId]=[old];d.dialogs.other=[{content:'other person'}];
 for(const w of ['garden','train','pets']){k.storeWorldTurn('key',()=>d,null,d.partnerId,w,{parts:[w+' reply']},200,w);d=k.ctx.saved;}
 for(let i=0;i<220;i++){k.storeWorldTurn('key',()=>d,null,d.partnerId,'new '+i,{parts:['reply '+i]},200,'pets');d=k.ctx.saved;}
 d=JSON.parse(JSON.stringify(d));assert.equal(k.local(d,d.partnerId,'pets').length,200);
 assert.deepEqual(contents(k.worldHistory({},'key',d,'garden')),['garden','garden reply']);
 assert.deepEqual(contents(k.worldHistory({},'key',d,'train')),['train','train reply']);
 assert.ok(d.dialogs[d.partnerId].some(m=>m.content===old.content));assert.equal(d.dialogs.other[0].content,'other person');
 assert.deepEqual(d.worlds,data().worlds);assert.deepEqual(d.journey,data().journey);
 assert.equal(k.local({...d,id:'archive-b'},d.partnerId,'pets').length,0);
});
test('old pending garden retry keeps its request identity, upgrades only known writer scope and never sends old completed shared turns',()=>{
 const k=kit();let d=data();d.dialogs[d.partnerId]=[{id:'retry',request:'old',role:'user',content:'retry me',status:'failed'},{role:'assistant',content:'ambiguous completed',status:'done'}];
 assert.equal(k.local(d,d.partnerId,'garden').length,1);assert.equal(k.local(d,d.partnerId,'train').length,0);
 assert.equal(k.worldHistory({},'key',d,'garden').length,0);
 d=k.replace(d,d.partnerId,'garden',k.local(d,d.partnerId,'garden').map(m=>({...m,request:'new',status:'pending'})));
 assert.equal(k.local(d,d.partnerId,'garden')[0].id,'retry');assert.equal(k.local(d,d.partnerId,'garden')[0].request,'new');
 assert.equal(d.dialogs[d.partnerId].filter(m=>m.id==='retry').length,1);assert.ok(d.dialogs[d.partnerId].some(m=>m.content==='ambiguous completed'&&!m.gameWorld));
});
test('untagged room history is readable as legacy but never injected, and outside phone messages are not game history',()=>{
 const k=kit(),r=room(k),d=data();r.chats.room=[{role:'assistant',content:'old mixed turn',kind:'garden',ts:1},{role:'user',content:'phone only',ts:2}];
 const record=k.worldRecord({record:r.record('room')},'x','pets',d);
 assert.deepEqual(contents(record.legacy),['old mixed turn']);assert.equal(record.history.length,0);
 assert.equal(r.chats.room.length,2);assert.throws(()=>k.stamp('unknown',d.id));assert.throws(()=>k.stamp('pets',''));
});
test('all game readers and actual writers share the world scope; no alternate keys or root layout changes',()=>{
 assert.match(source,/worldRecord\(latest.current,key,'pets',current\(\)\)/);assert.match(source,/worldRecord\(latest.current,key,'train',current\(\)\)/);assert.match(source,/worldRecord\(props,storeKey.current,'garden',entry\)/);
 assert.match(source,/storeWorldTurn\(key,current,record\(\),cid,text,out,200,'pets'\)/);assert.match(source,/storeWorldTurn\(key,current,record,cid,automatic\?'':text,out,Infinity,'train'\)/);
 assert.match(source,/replaceDialogs\(old,cid,'garden'/);assert.match(source,/doneHistory\(current\(\),c.id\).slice\(-30\)/);
 assert.equal((source.match(/h\(LegacyWorldDialogs,/g)||[]).length,3);assert.match(app,/record: gardenRecord\(key\)/);
});

test('actual room context uses the scoped recent chat/query while keeping the existing permission gate',()=>{
 const k=kit(),r=room(k),d=data();
 for(const world of ['garden','train','pets'])k.worldRecord({record:r.record('room')},'key',world,d).onTurn({text:world+' question',parts:[world+' reply']});
 const a=app.indexOf('  const roomContextFor ='),b=app.indexOf('  const roomTurnsOf =',a);assert.ok(a>0&&b>a);
 const ctx={window:{ChatRooms:{allows:()=>false,scenarioSetting:()=> 'room setting'}},gardenHistory:(key,w,id)=>r.record(key).historyFor(w,id),ctxFor:(_c,opts)=>({queryText:opts.queryText,permission:opts.noMemory}),roomHistoryText:()=> 'ALL_WORLD_HISTORY',directives:{room:['this room only']},loreForContext:(_a,_b,text)=>text,gateRoomContext:x=>x,roomStatesRef:{current:{}},profile:{name:'你'}};
 vm.createContext(ctx);vm.runInContext(app.slice(a,b)+';this.run=roomContextFor;',ctx);
 for(const world of ['garden','train','pets']){const out=ctx.run({id:'cat-parent',name:'TA'},'room',{}, {chat:true,gameWorld:world,gameArchiveId:d.id});assert.ok(out.recentChat.includes(world+' question'));assert.equal(out.permission,true);assert.equal(out.sceneSetting,'room setting');assert.ok(!JSON.stringify(out).includes('ALL_WORLD_HISTORY'));for(const other of ['garden','train','pets'].filter(x=>x!==world))assert.ok(!JSON.stringify(out).includes(other+' question'));}
 assert.equal(ctx.run({id:'cat-parent',name:'TA'},'room',{}, {chat:true}).recentChat,'ALL_WORLD_HISTORY');
});
