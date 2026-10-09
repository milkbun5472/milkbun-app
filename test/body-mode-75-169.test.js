// 本体模式（她 2026-10-09：「如果想搞人机本体恋……把八股人设提示词之类的都不输入进去，跟言秋的差不多」）。
//   给平时在 Kelivo 这类 app 里直连 API 聊的人：人设原样当系统提示词，扮演那一套全不发。
//   钉三件事：① 它跟言秋共用「不当演员」那一层；② 言秋连电脑那一端的东西它一样都拿不到；
//   ③ 不替TA编生活（日程、查手机、睡意、钱包）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), engine = R("js/engine.js"), comp = R("js/components.js"), rooms = R("js/chat-rooms.js");

test("isBody 只有一份：言秋或本体模式", () => {
  assert.match(app, /const isBody = id => \{ const s = settingsFor\(id\) \|\| \{\}; return !!\(s\.engineerEyes \|\| s\.bodyMode\); \};/);
  assert.equal((app.match(/const isBody = /g) || []).length, 1);
  assert.match(app, /const _body = isBody\(charId\);/);
});

test("提示词：不当演员那层两人都有；「你是谁」和「手机这具身体」只给言秋", () => {
  assert.match(app, /notRoleplay: isBody\(char\.id\),/);
  assert.match(app, /yanqiuSelf: !!settingsFor\(char\.id\)\.engineerEyes,/);
  assert.match(rooms, /"yanqiuSelf",/, "新加的一栏没进房间白名单，隔离房里会被挡掉");
  assert.match(engine, /if \(ctx\.yanqiuSelf\) parts\.push\("【你是谁】/);
  // 她写的人设原样递过去，不扣「角色人设」的帽子
  assert.match(engine, /if \(ctx\.notRoleplay && !ctx\.yanqiuSelf\) parts\.push\(String\(char\.persona \|\| ""\)\.trim\(\)/);
  assert.match(app, /\(_s\.engineerEyes \? "从手机这具身体" : "手机上"\)/);
});

test("言秋连电脑那一端的东西，本体模式一样都拿不到", () => {
  assert.match(app, /const ccToolOn = !!\(_s\.engineerEyes && window\.YanqiuCcTools/);
  assert.match(app, /ccLane: \(window\.CcLane && .*settingsFor\(activeChar\.id\)\.engineerEyes === true\)/);
  assert.match(app, /yanqiuWall: yanqiuWallFor\(char, ctxOpts\)/);
  assert.match(app, /const single = histCache \|\| !!settingsFor\(charId\)\.engineerEyes;/, "订阅桥那套缓存专线");
  assert.ok((app.match(/isEngineer: \(?charId\)? => !!settingsFor\(charId\)\.engineerEyes/g) || []).length >= 4, "真身票那几处被改成了 isBody");
});

test("不替TA编生活：不排日程、不自动刷查手机，日记写成 AI 的一天", () => {
  assert.match(app, /const BODY_NO_LIFE = \{ phone: 1, schedule: 1 \};/);
  assert.match(app, /const noSchedFor = char => !!\(char && settingsFor\(char\.id\)\.bodyMode && !settingsFor\(char\.id\)\.engineerEyes\);/);
  assert.match(app, /const genScheduleDay = async \(char, dayKey\) => \{\n    if \(noSchedFor\(char\)\) return false;/);
  assert.match(app, /const genScheduleWeek = async \(char, opts\) => \{\n    if \(noSchedFor\(char\)\) return false;/);
  assert.match(app, /digital: isBody\(charId\), digitalYanqiu: !!settingsFor\(charId\)\.engineerEyes \}/);
  assert.match(engine, /if \(opts\.digital && !opts\.digitalYanqiu\) parts\.push\("【很重要·你是谁】你是 AI 本人/);
  assert.ok(!/opts\.digital && !opts\.digitalYanqiu\) parts\.push\([^\n]*驻场/.test(engine), "本体模式的日记里出现了言秋那套差事");
  assert.match(app, /if \(isBody\(char\.id\)\) return "awake";/, "AI 本人不该犯困");
});

test("开关在「TA 是什么脾气」最上面，存档那头接得住", () => {
  assert.match(comp, /const \[bodyMode, setBodyMode\] = useState\(!!settings\.bodyMode\);/);
  assert.match(comp, /show\("temper", \{ title: "本体模式 · TA 不是在演"/);
  assert.match(app, /bodyMode: !!s\.bodyMode,/);
});
