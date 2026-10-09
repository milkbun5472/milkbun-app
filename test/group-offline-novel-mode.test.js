// 她 2026-10-08：群线下加「写法」——一人一拍（原来那样）／整段小说（一次一整段、全员一起写），
//   心声照常写，在那一段的头像框里点选看谁的；写不写她的动作跟原来那个「描写我」开关走。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const eng = R("engine.js"), app = R("app.js"), comp = R("components.js");
const i = eng.indexOf("async function generateOfflineGroup("), j = eng.indexOf("\nasync function ", i + 10);
assert.ok(i > 0 && j > i, "抠不出 generateOfflineGroup");
const fn = eng.slice(i, j);

test("引擎：整段小说换的只是输出形状，规矩层和人设是同一份", () => {
  assert.match(fn, /const novel = session\.writeMode === "novel";/);
  assert.match(fn, /\(novel \? novelOut : "\\n【输出】/, "一人一拍那份输出规格得原样留着");
  assert.match(fn, /\\"scene\\":\\"这一轮的整段小说正文/);
  assert.match(fn, /\\"cast\\":\[\{\\"name\\"/, "每个出场的人得各有一份心声");
  // 解析：一整段一条，kind=novel，cast 逐人认成成员 id
  assert.match(fn, /kind: "novel", senderId: null, senderName: nCast\.map\(x => x\.senderName\)\.join\("、"\)/);
  assert.match(fn, /offlineGroupSpeaker\(members, String\(x\.name \|\| ""\)\.trim\(\), ""\)/);
  // 描写我那个开关走的是 narrativeDirective(session.narr)，两种写法共用
  assert.match(fn, /narrativeDirective\(session\.narr\)/);
});

test("app：开关传进去；出场的每个人各算心情好感状态卡，各自一个 turnId 能回滚", () => {
  assert.match(app, /writeMode: osFor\("g_" \+ group\.id\)\.writeMode === "novel" \? "novel" : "beats"/);
  assert.match(app, /const novelCast = b\.kind === "novel" \? \(b\.cast \|\| \[\]\)\.map\(\(x, k\) => \(\{ \.\.\.x, turnId: goTurnId \+ "_" \+ k \}\)\) : null;/);
  assert.match(app, /for \(const a of \(novelCast \|\| \[\{ \.\.\.b, turnId: goTurnId \}\]\)\) \{/);
  assert.match(app, /bumpAff\(a\.senderId, a\.affinityDelta\)/);
  assert.match(app, /removed\.filter\(m => m && m\.kind === "novel"\)\.forEach\(m => \(m\.cast \|\| \[\]\)\.forEach/, "重写时小说那一拍的状态没回滚");
});

test("界面：设置里能选写法；那一段点头像框选看谁的心声", () => {
  assert.match(comp, /useState\(os\.writeMode === "novel" \? "novel" : "beats"\)/);
  assert.match(comp, /writeMode: sWriteMode/, "保存时没把写法存进去");
  assert.match(comp, /\[\{ v: "beats", t: "一人一拍" \}, \{ v: "novel", t: "整段小说" \}\]/);
  const a = comp.indexOf("function OffCard("), b = comp.indexOf("function OfflineLengthModeSection(", a);
  assert.ok(a > 0 && b > a, "抠不出 OffCard");
  const card = comp.slice(a, b);
  assert.match(card, /"data-wk": "offcastfaces", onClick: \(\) => setCastOpen/);
  assert.match(card, /"data-wk": "offcastpick"/);
  assert.match(card, /castPick\.x\.thought/);
});

test("userName 先声明再拼 novelOut：不然一进群线下就报「before initialization」", () => {
  assert.ok(fn.indexOf("const userName =") > 0 && fn.indexOf("const userName =") < fn.indexOf("const novelOut ="));
});
