// 线上发一张生成的自己的自拍（群友 2026-10-25 许愿）：跟「他帮我拍」同一条出图路，自拍那一档；她的、他的各认各的上一张
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "../js", f), "utf8");
const app = R("app.js"), comp = R("components.js");
test("照片里多一个「生成我的自拍」，交给 app 那一处出图", () => {
  assert.match(comp, /\.\.\.\(onShootMe \? \[\["selfme", "生成我的自拍"\]\] : \[\]\)/);
  assert.match(comp, /photoSendMode === "selfme"\) \{[\s\S]{0,200}onShootMe && onShootMe\(v, selfThird\)/);
  assert.match(app, /onShootMe: \(scene, third\) => shootMeOnline\(activeChar\.id, window\.ChatRooms \? window\.ChatRooms\.chatKey\(activeChar\.id, activeRoomId\) : activeChar\.id, scene, third\)/);
});
test("画的是她、自拍那一档、没有他的视角；没配好就说清缺什么", () => {
  const seg = app.slice(app.indexOf("const shootMeOnline"), app.indexOf("const drawChatSelfie"));
  assert.match(seg, /canShootMe\(charId\)/); assert.match(seg, /role: "user", kind: "selfie"[\s\S]{0,80}photoKind: pk/);
  assert.match(app, /if \(meShot\) photoKind = photoKind === "myself" \? "self" : "other";/);
  assert.match(app, /pov: meShot && !mySelf \? povFor\(realChar\) : null/);
  assert.match(app, /\(m\.photoKind === "me" \|\| m\.photoKind === "myself" \|\| m\.photoKind === "myshot"\) === meShot\)/);
});
test("他那边看得到是她发来的自拍；气泡靠右", () => {
  assert.match(app, /m\.kind === "selfie" \? qpfx \+ \(m\.failed \? /);
  assert.match(comp, /if \(m\.kind === "selfie"\) return h\("div", \{ key: i,[^\n]*?className: "py-1 flex items-start gap-2 " \+ \(m\.role === "user" \? "justify-end" : "justify-start"\) \}/);
});
test("她的自拍画好后存进图片仓库挂 imageRef，他回话时真的看得到（2026-10-25）", () => {
  assert.match(app, /if \(mySelf\) \{ try \{ const ref = await imgToVault\(await blobToDataUrl\(out\.blob\)\)/);
  assert.match(app, /if \(\(m\.kind === "photo" \|\| m\.kind === "selfie"\) && m\.imageRef\) \(lu\._imageRefs/);
  assert.match(app, /_imageRefs: \(m\.kind === "photo" \|\| m\.kind === "selfie"\) && m\.imageRef \? \[m\.imageRef\] : \[\]/);
});
test("也能选「别人拍的」第三人角度（2026-10-25「比如我在做饭」）：画她、别人拍的那一档、没有他的视角", () => {
  assert.match(comp, /\[\[false, "自拍", "手机举在面前"\], \[true, "别人拍的", "第三人角度，拍你在做的事"\]\]/);
  assert.match(comp, /onShootMe && onShootMe\(v, selfThird\)/);
  assert.match(app, /const pk = third \? "myshot" : "myself";/);
  assert.match(app, /if \(meShot\) photoKind = photoKind === "myself" \? "self" : "other";/);
  assert.match(app, /pov: meShot && !mySelf \? povFor\(realChar\) : null/);
});
test("她的生成自拍跟真照片一样能被他换成锁屏、头像、情头（2026-10-25）", () => {
  const a = app.slice(app.indexOf("const freshPhotoIn"), app.indexOf("const freshUserPhoto"));
  assert.match(a, /\(m\.kind === "photo" \|\| m\.kind === "selfie"\) && m\.imageRef\) return m;/);
  const b = app.slice(app.indexOf("const freshPhotoPairIn"), app.indexOf("const freshPhotoPairIn") + 600);
  assert.match(b, /\(m\.kind === "photo" \|\| m\.kind === "selfie"\) && m\.imageRef\) got\.unshift\(m\)/);
});
