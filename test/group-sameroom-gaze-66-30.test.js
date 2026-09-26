// 她 2026-09-10 三件事：
//  ①「我的群聊能不能也影响 ta 眼里，不然如果只在群里聊永远改不了」
//  ②「群里也接共处一室吧」
//  ③「群聊单聊的按钮换成 svg 按钮画个小房子之类的」
//
// ⚠️①查下来【写】那一半群里早就有（impressionField + 落地那处），缺的是【读】：
//    单聊常驻发着 gazeText，模型是看着卡在改；群里一个字都没发过去，
//    等于让它凭空重写「更新后的整块正文」——它多半就省略了，所以她怎么聊都不动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), eng = R("js/engine.js"), comp = R("js/components.js");

test("印象卡只走私有往来一份，封闭群读主线但不写回", () => {
  assert.match(app, /const gazeFor = charId =>/);
  assert.match(app, /gazeText: gazeFor\(char.id\)/);
  assert.equal((app.match(/const gz = gazeFor\(c.id\)/g) || []).length, 1);
  assert.doesNotMatch(app, /gzSeg|GROUP_GAZE_CAP/);
  assert.match(app, /const impressionField = window\.Gaze && gs\.memoryInterop/);
  assert.match(app, /settingsFor\(charId\).engineerEyes/);
  assert.match(app, /〔以下只有 " \+ c\.name \+ " 本人知道，别的成员并不知情〕/);
});

test("群里的同处一室：句子跟单聊共用一份，只多传一个参数", () => {
  assert.match(eng, /function samePlacePresence\(uName, group\) \{/, "没做成一份两用");
  assert.equal((eng.match(/【同处一室·此刻真的面对面】/g) || []).length, 1, "句子被抄成了两份");
  assert.match(eng, /group \? "此刻在场的各位和" \+ uName \+ "都" : "你和" \+ uName \+ "此刻"/);
  assert.equal((app.match(/【同处一室·此刻真的面对面】/g) || []).length, 0, "app 里又手抄了一份");
  // 开关按【群】存，跟单聊那份按人存的分开；两行故意挨着写
  assert.match(app, /const gSameRoomFor = gid => !!\(gsFor\(gid\) \|\| \{\}\)\.sameRoom;/);
  assert.ok(app.indexOf("const sameRoomFor = id =>") < app.indexOf("const gSameRoomFor = gid =>"), "两处没挨着写，以后会只改一处");
  assert.match(app, /saveGroupSettings\(activeGroup\.id, \{ sameRoom: on \}\)/, "群那颗键存不下来");
  // 真发进群的 system 了，而且三个不发的情形都挡住
  assert.match(app, /const gSameRoomHint = \(gSameRoomFor\(groupId\) && !gs\.spectate && !\(offlineGroup && offlineGroup\.id === groupId\)\)/,
    "旁观群/线下正开着这两种情形没挡");
  assert.match(app, /samePlacePresence\(userName\(profile\), true\)/, "群里没传 group");
  assert.match(app, /dir \+ commonTurn \+ gSameRoomHint \+/, "算了却没发下去");
});

test("那颗键是一颗小房子，而且单聊群聊共用同一颗", () => {
  assert.match(comp, /function sameRoomButton\(\{ on, onToggle, t \}\)/, "没抽成公共的");
  assert.equal((comp.match(/"data-wk": "sameroom"/g) || []).length, 1, "两处各画了一份");
  assert.match(comp, /h\(IHome, \{ size: 19/, "不是小房子");
  assert.match(R("js/core.js"), /const IHome = p => h\(Svg, p,/, "IHome 不见了");
  // 两处都挂上了
  assert.equal((comp.match(/sameRoomButton\(\{ on: sameRoom, onToggle: onToggleSameRoom, t: t \}\)/g) || []).length, 2,
    "单聊和群聊没都挂上");
  // 旁观群不给：她根本不在场
  assert.match(comp, /onToggleSameRoom && !gs\.spectate && chatMode !== "ooc"/, "旁观群里也冒出来了");
  // 关着要一眼看得出（跟自发那颗同一个语汇：褪灰 + 一道斜杠）
  const key = comp.slice(comp.indexOf("function sameRoomButton("), comp.indexOf("function sameRoomButton(") + 1200);
  assert.match(key, /transform: "rotate\(-45deg\)"/, "关着没有那道斜杠，看不出开没开");
});

test("开着同处一室时，动作写屋里的事，不写「盯着屏幕回消息」", () => {
  // 她 2026-09-11 拿状态卡给我看：「我侧躺在床上，伸手把被子往 Lisa 肩头扯了扯，
  // 眼睛半眯着盯着发光的手机屏幕回消息」——前半句人在旁边，后半句又写回了隔着屏幕。
  // ⚠️单聊和群聊共用同一句（samePlacePresence 只此一份）。
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const fn = eng.slice(eng.indexOf("function samePlacePresence(uName, group) {"),
    eng.indexOf("// 动描（她 2026-09-09）"));
  assert.match(fn, /【动作写屋里的事】/);
  assert.match(fn, /手在哪、看着谁/);
  assert.match(fn, /盯着手机屏幕回消息/);
  assert.match(fn, /不是你此刻在做的事/);
  assert.equal((eng.match(/【动作写屋里的事】/g) || []).length, 1, "被抄成了第二份");
});
