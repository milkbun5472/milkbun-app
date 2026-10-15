// 她 2026-10-11：「拍照能不能搞一类他帮我拍，然后在所有生图地方都支持」
//   单聊、群聊、单人线下、群线下四处都认 me；画的时候被拍的人换成她，照「别人拍的」那一档画
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js");

test("被拍的人换成她：她的外貌、参考照、衣柜、固定服装，画风跟着拍照的 TA", () => {
  assert.match(app, /const meSubject = \(char, fallbackName, who\) => \{ const m = photoMe\(fallbackName, who \|\| \(char && char\.id\)\);/);
  assert.match(app, /return \{ id: "__me", name: m\.name, appearance: m\.appearance \|\| "", refPhoto: m\.refPhoto \|\| null, photoOutfit: m\.outfit \|\| "", photoStyle: char && char\.photoStyle,/);
  assert.match(app, /const canShootMe = who => \{ const P = meOf\(who\); return !!\(P && \(P\.appearance \|\| P\.refPhoto\)\); \};/);
});

test("四处出图都认 me：单聊、群聊、线下（单人和群共用 runOfflineShot）", () => {
  assert.match(app, /const char = meShot \? meSubject\(realChar, uName, charId\) : realChar;\n    if \(meShot\) photoKind = "other";/);
  assert.match(app, /const sub = meShot \? meSubject\(spk, "对方", "g:" \+ groupId\) : spk;\n    if \(meShot\) gPhotoKind = "other";/);
  assert.match(app, /const sub = kind === "me" \? \{ \.\.\.meSubject\(char, "我", meWho\), photoOutfit: me\.outfit \|\| "" \} : char;/);
  assert.match(app, /\["self", "other", "duo", "me", "view", "part", "none"\]\.includes/);
  assert.match(app, /\["self", "other", "duo", "group", "me", "view", "part", "none"\]\.includes/);
});

test("四处都告诉模型有 me 这一档；她资料里没外貌也没参考照就不给", () => {
  assert.match(engine, /\.concat\(o\.me \? \["me（你给 " \+ uName \+ " 拍的照片/);
  assert.equal((app.match(/photoCapLine\([^\n]*me: canShootMe\([^)]+\)/g) || []).length, 2, "单聊、群聊的 photoCapLine 都要传");
  assert.match(app, /photoMe: _offPhotoOn && canShootMe\(char\.id\) \? \(\(povFor\(char\) \|\| \{\}\)\.tier \|\| true\) : false,/);
  assert.match(app, /photoMe: _gShooters\.length > 0 && canShootMe\("g:" \+ group\.id\)/);
  assert.match(engine, /if \(canMe\) kinds\.push\("\*\*me\*\*="/);
  assert.match(engine, /\(session\.photoMe \? "｜me" : ""\)/);
  assert.match(app, /kind === "me" && !canShootMe\(char && char\.id\)\n      \? "TA 帮你拍的这张画的是你/);
});

// 她 2026-10-11：「约会视角、男友视角」→「拍照的不一定是男友」→「亲密度看吧」
test("TA 的视角：机位按关系分三层，越亲近能抽的越多", () => {
  const i = engine.indexOf("const POV_SLOTS = [");
  const k = engine.indexOf("const povSlotsFor = tier =>");
  const seg = engine.slice(i, engine.indexOf("\n", k) + 1);
  const f = new Function(seg + "\nreturn { POV_SLOTS, povSlotsFor };")();
  assert.equal(f.povSlotsFor(1).length, f.POV_SLOTS[0].length);
  assert.equal(f.povSlotsFor(3).length, f.POV_SLOTS.flat().length);
  assert.ok(!f.povSlotsFor(1).some(x => /牵着她的手|靠在/.test(x)), "普通关系抽不到恋人那层");
  assert.match(engine, /const list = opts\.pov \? povSlotsFor\(opts\.pov\.tier\) :/);
  assert.match(engine, /\} else if \(kind === "other" && opts\.pov\) \{/);
});

test("层从关系和好感来：在一起/恋人＝3，暧昧闺蜜挚友或好感≥70＝2，其余 1；三处出图都带上", () => {
  assert.match(app, /const tier = \(cp && cp\.status === "together"\) \|\| POV_LOVE_RE\.test\(label\) \? 3\n      : POV_CLOSE_RE\.test\(label\) \|\| affOf\(char\.id\) >= 70 \? 2 : 1;/);
  assert.match(app, /pov: meShot \? povFor\(realChar\) : null/);
  assert.match(app, /pov: meShot \? povFor\(spk\) : null/);
  assert.match(app, /pov: kind === "me" \? povFor\(char\) : null/);
});

// 她 2026-10-11：「也还要跟场景契合，在家和在游乐园拍出来的不一样，喝咖啡和看电影也不一样，要根据上下文来」
test("TA 的视角跟着场景走：模型照场景挑拍法；描述里写了从哪儿拍就照描述，没写才掷、对不上就换", () => {
  assert.match(engine, /if \(opts\.pov && POV_SCENE_ANGLE_RE\.test\(String\(sceneDesc \|\| ""\)\)\) parts\.push\("【这一张的机位】照上面「场景\/正在做什么」里写的拍照位置和距离来/);
  // 她 2026-10-15：「不是说不给具体机位吗，应该像照相馆那样」——没写拍法时也不掷了，他照这一刻自己定，池子只当灵感
  assert.match(engine, /【这一张怎么拍·他自己定】/);
  assert.match(engine, /\(o\.meTier \? "——照你俩现在的关系，拍法可以是：" \+ povSlotsFor\(o\.meTier\)\.join\("／"\)/);
  assert.match(engine, /typeof canMe === "number" \? "；照关系，拍法可以是：" \+ povSlotsFor\(canMe\)/);
  assert.match(app, /meTier: canShootMe\(char\.id\) \? \(povFor\(char\) \|\| \{\}\)\.tier : 0/);
});

// 她 2026-10-12：「线下他帮我拍的按钮在哪儿」
test("线下照片那一格多一个「Ta 帮我拍」，要她自己有外貌或参考照", () => {
  const comps = R("components.js");
  assert.match(comps, /\["me", "Ta 帮我拍", !!canShootMe\]/);
  assert.match(app, /canShootMe: canShootMe\(offlineChar && offlineChar\.id\),/);
  assert.match(app, /if \(kind === "me"\) \{\n      if \(!\(typeof imgApiReady === "function" && imgApiReady\(\)\)\)/);
});
