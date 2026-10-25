// 线上发一张生成的自己的自拍（群友 2026-10-25 许愿）：跟「他帮我拍」同一条出图路，自拍那一档；她的、他的各认各的上一张
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const app = R("app.js"), comp = R("components.js");
test("照片里多一个「生成我的自拍」，交给 app 那一处出图", () => {
  assert.match(comp, /\.\.\.\(onShootMe \? \[\["selfme", "生成我的自拍"\]\] : \[\]\)/);
  assert.match(comp, /photoSendMode === "selfme"\) \{[\s\S]{0,200}onShootMe && onShootMe\(v\)/);
  assert.match(app, /onShootMe: scene => shootMeOnline\(activeChar\.id, window\.ChatRooms \? window\.ChatRooms\.chatKey\(activeChar\.id, activeRoomId\) : activeChar\.id, scene\)/);
});
test("画的是她、自拍那一档、没有他的视角；没配好就说清缺什么", () => {
  const seg = app.slice(app.indexOf("const shootMeOnline"), app.indexOf("const drawChatSelfie"));
  assert.match(seg, /canShootMe\(charId\)/); assert.match(seg, /role: "user", kind: "selfie"[\s\S]{0,80}photoKind: "myself"/);
  assert.match(app, /if \(meShot\) photoKind = mySelf \? "self" : "other";/);
  assert.match(app, /pov: meShot && !mySelf \? povFor\(realChar\) : null/);
  assert.match(app, /\(m\.photoKind === "me" \|\| m\.photoKind === "myself"\) === meShot\)/);
});
test("他那边看得到是她发来的自拍；气泡靠右", () => {
  assert.match(app, /m\.kind === "selfie" \? qpfx \+ \(m\.failed \? /);
  assert.match(comp, /if \(m\.kind === "selfie"\) return h\("div", \{ key: i, className: "py-1 flex items-start gap-2 " \+ \(m\.role === "user" \? "justify-end" : "justify-start"\) \}/);
});
