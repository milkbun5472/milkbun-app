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

test("群里把那张印象卡发下去了，模型才有的可改", () => {
  const seg = app.slice(app.indexOf("      gzSeg: (() => {"), app.indexOf("      sbSeg: (() =>", app.indexOf("      gzSeg: (() => {")));
  assert.ok(seg.length > 0, "群里那一段没有印象卡");
  // v66.62：封顶交给 Gaze.text（它只砍内容行、末尾那段守则一个字不砍）
  assert.match(seg, /window\.Gaze\.text\(c\.id, userName\(profile\), \{ cap: GROUP_GAZE_CAP \}\)/, "没去取这位成员那张卡");
  // 跟【写】那一半同一道闸：这张卡讲的是「你们之间」，封闭群不给
  assert.match(seg, /if \(!o\.interop \|\| !window\.Gaze/, "封闭群也把私事发出去了");
  assert.match(app, /const impressionField = window\.Gaze && gs\.memoryInterop/, "写那一半的闸变了，读这一半要跟着看");
  // 言秋不塑形（跟单聊 gazeText 同一条判据）
  assert.match(seg, /settingsFor\(c\.id\)\.engineerEyes/, "言秋那条线也被塑形了");
  // 别的成员不许知道（同 cpSeg 的隐私铁律）
  assert.match(seg, /只有 TA 本人知道，别的成员并不知情/, "群里成了公开的心里话");
  // 封顶：群预算按人数平分，一人一整张卡会把主角色的人设额度吃掉
  // v66.62：这个数只管【内容那几行】了（守则不在封顶之内），所以放宽到 700
  assert.match(app, /const GROUP_GAZE_CAP = 700;/);
  // ⚠️v66.62：封顶不许再整段 slice——砍掉的正好是末尾那段守则（见 Gaze.text 里那条病历）。
  //   现在封顶交给 Gaze.text，它只砍内容行、按整行收。
  assert.ok(seg.indexOf(".slice(0, GROUP_GAZE_CAP)") < 0, "又把整段腰斩了，守则会被砍掉");
  assert.match(seg, /cap: GROUP_GAZE_CAP/, "没封顶");
  // v66.63：那句她让删了（「有时候又可以接话，应该是模型问题。不然一堆禁令会变笨的」）——
  //   卡末尾那段守则本来就管着这件事，再加一句是同一件事说两遍。
  assert.ok(seg.indexOf("不是这一轮的话题") < 0, "那句多余的禁令又加回来了");
  // 真拼进那位成员那一段了
  assert.match(app, /\+ cpSeg \+ _now\.gzSeg \+ caSeg \+/, "算了却没拼进去");
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
  assert.match(app, /dir \+ common \+ gSameRoomHint \+/, "算了却没发下去");
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
