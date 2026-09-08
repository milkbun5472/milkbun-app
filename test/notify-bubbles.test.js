const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function boot() {
  const sent = [], store = new Map();
  const Notification = {permission:'granted', requestPermission:async()=> 'granted'};
  const context = {URL, Notification, setTimeout, document:{visibilityState:'hidden'},
    localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
    navigator:{serviceWorker:{controller:{postMessage:p=>sent.push(p)}}},
    window:{Notification, location:{href:'https://fixture.test/?keep=1&notifChar=c&notifRoom=side'},
      history:{replaceState(_a,_b,url){this.url=url;}}}};
  vm.runInNewContext(fs.readFileSync('js/notify.js','utf8'),context);
  return {context,sent,api:context.window.Notify};
}
test('enabled hidden chat bubbles have stable separate room/turn/bubble tags',async()=>{
  const b=boot();await b.api.enable();
  const opts={title:'fixture',body:'one',chatKey:'c::side',charId:'c',roomId:'side',turnId:'t',bubbleId:'word-0'};
  for(const next of [opts,{...opts,bubbleId:'word-1'},{...opts,turnId:'t2'},{...opts,chatKey:'c'},opts]) await b.api.chatBubble(next);
  assert.equal(b.sent.length,5);assert.equal(new Set(b.sent.map(p=>p.tag)).size,4);
  assert.equal(b.sent[0].tag,b.sent[4].tag);assert.equal(b.sent[0].roomId,'side');
  b.context.document.visibilityState='visible';await b.api.chatBubble(opts);assert.equal(b.sent.length,5);
  b.context.document.visibilityState='hidden';b.api.disable();await b.api.chatBubble(opts);assert.equal(b.sent.length,5);
  await b.api.enable();b.context.Notification.permission='denied';await b.api.chatBubble(opts);assert.equal(b.sent.length,5);
});
test('first registration fallback rechecks visibility after await and contains failures',async()=>{
  const b=boot();await b.api.enable();const sw=b.context.navigator.serviceWorker;sw.controller=null;
  sw.getRegistration=async()=>({showNotification:async(title,data)=>b.sent.push({title,...data})});
  assert.equal(await b.api.push({body:'voice',roomId:'side'}),true);assert.equal(b.sent[0].data.roomId,'side');
  sw.getRegistration=async()=>{b.context.document.visibilityState='visible';return {showNotification(){throw Error('foreground');}};};
  assert.equal(await b.api.push({body:'no'}),false);
  b.context.document.visibilityState='hidden';sw.getRegistration=async()=>{throw Error('unavailable');};
  assert.equal(await b.api.push({body:'no'}),false);
});
test('cold notification target waits in memory and is removed from address',()=>{
  const b=boot();assert.equal(b.context.window.__pendingNotif.roomId,'side');
  assert.equal(b.context.window.__pendingNotif.charId,'c');
  assert.equal(b.context.window.history.url,'https://fixture.test/?keep=1');
});
test('app notification routing retains unloaded target and rejects deleted side rooms',()=>{
  const src=fs.readFileSync('js/app.js','utf8');
  const start=src.indexOf('    window.__openFromNotif =');
  const code=src.slice(start,src.indexOf('    if (window.__pendingNotif)',start));
  const seen={}, context={window:{__pendingNotif:{charId:'c'},ChatRooms:{get:(_c,id)=>({id:id==='side'?'side':'main'}),chatKey:(c,r)=>c+':'+r}},
    characters:[],notificationRoomRef:{current:null},toast:s=>seen.toast=s,
    setActiveChar:c=>seen.char=c.id,setActiveRoomId:r=>seen.room=r,setChatRoomsOpen:()=>{},clearUnread:k=>seen.unread=k,setScreen:s=>seen.screen=s};
  vm.runInNewContext(code,context);
  context.window.__openFromNotif('c','','side');assert.ok(context.window.__pendingNotif);assert.equal(seen.screen,undefined);
  context.characters.push({id:'c'});context.window.__openFromNotif('c','','side');
  assert.equal(seen.room,'side');assert.equal(seen.screen,'thread');assert.equal(seen.unread,'c:side');
  assert.equal(context.notificationRoomRef.current.roomId,'side');
  seen.screen=null;context.window.__openFromNotif('c','','deleted');assert.equal(seen.screen,null);assert.ok(seen.toast);
});
test('service worker keeps notification work alive and routes warm/cold side rooms',async()=>{
  const handlers={}, shown=[], messages=[], opened=[];let clients=[];
  const self={addEventListener:(name,fn)=>handlers[name]=fn,
    registration:{scope:'https://fixture.test/app/',showNotification:async(t,o)=>shown.push(o)},
    clients:{matchAll:async()=>clients,openWindow:async url=>opened.push(url)}};
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,URL});
  let work;const waitUntil=p=>work=p;
  handlers.message({data:{type:'SHOW_LOCAL_NOTIFICATION',charId:'c',roomId:'side',tag:'bubble'},waitUntil});await work;
  assert.equal(shown[0].data.roomId,'side');assert.equal(shown[0].tag,'bubble');
  const event={notification:{close(){},data:{charId:'c',roomId:'side'}},waitUntil};
  clients=[{url:'https://fixture.test/app/',focus:async()=>{},postMessage:p=>messages.push(p)}];
  handlers.notificationclick(event);await work;assert.equal(messages[0].roomId,'side');assert.equal(opened.length,0);
  clients=[];handlers.notificationclick(event);await work;
  const url=new URL(opened[0]);assert.equal(url.searchParams.get('notifChar'),'c');assert.equal(url.searchParams.get('notifRoom'),'side');
});
