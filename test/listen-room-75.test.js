// 一起听房（她 2026-10-15）：从这间房进去听，边听边说落进这间房、TA读这间房；别的入口照旧落单聊
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const rd = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = rd("app.js"), lt = rd("listen-talk.js"), rooms = rd("chat-rooms.js"), comp = rd("components.js");
test("房间有「一起听」这个样子，from 记成 listen", () => {
  assert.match(rooms, /listen: \{ label: "一起听"[^\n]*from: "listen" \}/);
  assert.match(rooms, /from: \["study", "train", "pets", "listen"\]\.includes\(src\.from\)/);
  assert.match(comp, /\["listen", "一起听", /);
  assert.match(comp, /onEnterListen && h\(RoomListenBanner/);
});
test("从房里进去：落进房的 chatKey，TA 读房的上下文；主屏和邀请卡进来解绑", () => {
  assert.match(app, /onEnterListen: listenRoomOf\(activeChar\.id, activeRoomId\) \? \(\) => \{ setListenPartner\(activeChar\.id\); goListen\(\{ charId: activeChar\.id, roomId: activeRoomId \}\); \}/);
  const body = app.slice(app.indexOf('else if (screen === "listen") body = h(ListenTogether'), app.indexOf("listen: listen,", app.indexOf('else if (screen === "listen") body')));
  assert.match(body, /roomContextFor\(c, key, room, \{ chat: true \}\)/);
  assert.match(body, /window\.ChatRooms\.chatKey\(lr\.charId, lr\.roomId\) : charId/);
  assert.match(app, /onOpenApp: k => k === "listen" \? goListen\(null\)/);
  assert.match(app, /if \(bind !== undefined\) setListenRoom\(bind\);/);
});
test("边听边说那份记录按房分开", () => {
  assert.match(lt, /const tk = props\.talkKey \|\| \(partner && partner\.id\);/);
  assert.match(lt, /push\(tk, list\); setRows\(talkOf\(tk\)\);/);
  assert.match(lt, /talkOf\(p\.talkKey \|\| char\.id\)/);
});
test("一起听里说话也更新状态卡：心情/动作/心声跟 say 同一份 JSON", () => {
  const lt2 = rd("listen-talk.js");
  const parseState = new Function(lt2.slice(lt2.indexOf("function parseState"), lt2.indexOf("// mode：reply")) + "\nreturn parseState;")();
  assert.deepEqual(parseState('{"say":["嗯"],"mood":{"label":"安心"},"action":"靠在你肩上","thought":"null"}'), { mood: "安心", action: "靠在你肩上" });
  assert.equal(parseState('{"say":["嗯"]}'), null);
  assert.match(lt2, /if \(st && p\.onState\) try \{ p\.onState\(char\.id, st\); \}/);
  assert.match(app, /onListenState: \(charId, st\) => \{[\s\S]{0,400}setRoomThought\([\s\S]{0,200}writeGroupLiveState\(c, st,/);
});
test("选人底下那格：开着就不落单聊，房里进来的照旧落房；播放页能翻「刚才说的」", () => {
  assert.match(app, /if \(!inRoom && listen\.talkStay\) \{[\s\S]{0,200}pChat\(charId, p => \{[\s\S]{0,300}last\.kind === "listenlog" && last\.stay[\s\S]{0,600}kind: "listenlog", stay: true[\s\S]{0,200}return;/);
  assert.match(app, /onSetTalkStay: on => saveListen\(p => \(\{ \.\.\.p, talkStay: !!on \}\)\)/);
  assert.match(rd("screens.js"), /"说的话只留在一起听里"/);
  assert.match(rd("listen-talk.js"), /"刚才说的"/);
});
test("小条也能关：talkNote 关掉单聊一个字都不落", () => {
  assert.match(app, /if \(listen\.talkNote === false\) return;/);
  assert.match(rd("screens.js"), /"单聊里留一张小条"/);
});
