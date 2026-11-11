const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = R("app.js"), eng = R("engine.js"), comp = R("components.js");
test("群线下：只重写一个人这一段，原地换、后面的不动", () => {
  const i = app.indexOf("const groupOfflineRerollOne = async"), body = app.slice(i, i + 1500);
  assert.match(body, /const before = sess\.msgs\.slice\(0, idx\);/);
  assert.match(body, /onlyName: name, onlyOne: \{ msgId, senderId: m\.senderId, name \}/);
  assert.match(app, /if \(workSess && workSess\.onlyOne\) \{[\s\S]{0,900}m\.id !== o\.msgId \? m : \{ \.\.\.m, content: scene/);
  assert.match(app, /onRerollOne: mid => groupOfflineRerollOne\(offlineGroup\.id, mid\)/);
});
test("引擎：只写那一个人时照分段写", () => {
  assert.match(eng, /const novel = session\.writeMode === "novel" && !session\.onlyName;/);
  assert.match(eng, /const gTail = gOnlyTail \+ gContinueCue/);
});
test("卡片上「只重写这段」只在群线下、有说话人的那几段出现", () => {
  assert.match(comp, /\(moreKeys && onRerollOne && m\.senderId && !isUser && !isNarr && !isNovel\)/);
  const g = comp.indexOf("function GroupOfflineMode(");
  assert.ok(comp.indexOf("onReroll: onRerollMsg, onRerollOne: onRerollOne,", g) > g);
});
