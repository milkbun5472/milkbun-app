// 她 2026-10-02 转群友的三张图：① 世界加一张生图参考 ② 聊天＋面板里能直接邀约
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), map = R("js/map.js"), engine = R("js/engine.js");

test("世界表单的生图参考：最多六张风景照、每张标注；重画不丢图", () => {
  assert.match(map, /"生图参考"/);
  assert.match(map, /onGen\(name\.trim\(\), brief\.trim\(\), picked, refs\.length \? refs : null\)/);
  assert.match(map, /placeholder: "这张是哪儿"/);
  assert.match(app, /refImgs !== undefined \? \{ refImgs: Array\.isArray\(refImgs\) \? refImgs\.slice\(0, 6\)/);
  assert.match(app, /refImgs: \(old && old\.refImgs\) \|\| null/);
  const M = require("../js/map.js");
  const w = { refImgs: [{ img: "a", label: "花街" }, { img: "b", label: "旧港码头·傍晚" }] };
  assert.equal(M.pickWorldRef(w, "在旧港码头吹风").img, "b", "按画面挑对得上的那张");
  assert.equal(M.pickWorldRef(w, "随便哪").img, "a", "都对不上就第一张");
  assert.equal(M.worldRefList({ refImg: "old" })[0].img, "old", "旧版单张照样认");
  assert.match(app, /const saveWorlds = list => \{ worldsRef\.current = list;/, "新世界刚画完就存图，要读得到");
});

test("住在世界里的人拍照：人像和风景照都喂世界参考，只露一截身体那档不喂", () => {
  assert.equal((engine.match(/worldRefLine\(opts\.worldRefIndex, opts\.worldRefLabel\)/g) || []).length, 2);
  assert.equal((app.match(/const wRef = /g) || []).length, 2);
  assert.match(app, /const wRef = isPart \? null : worldRefFor\(char, /);
  assert.match(app, /buildScenePrompt\(char, photoScene, \{ forText: false, worldRefIndex: wRef/);
});

test("＋面板有邀约：挑地方（我们的城市＋TA的世界）或自己写，发约会卡", () => {
  assert.match(comp, /\["dateinvite", "邀约", "invite"\]/);
  assert.match(comp, /function DateComposeDialog\(\{ place, places, members, who, onCancel, onSend \}\)/);
  assert.match(comp, /disabled: !finalPlace/);
  assert.match(app, /onDateInvite: \(place, v\) => sendDateInvite\(activeChar, place, v\)/);
  const i = app.indexOf("const invitePlacesFor");
  const seg = app.slice(i, app.indexOf("const pendingInviteOf", i));
  assert.match(seg, /DatePlaces/);
  assert.match(seg, /charRealm/);
});

test("群里也能邀约：挑请谁，带答应了的人出发进群线下", () => {
  assert.match(comp, /\["rp", "红包", "packet"\], \.\.\.\(onGroupDateInvite \? \[\["dateinvite", "邀约", "invite"\]\] : \[\]\)/);
  assert.match(comp, /function DateComposeDialog\(\{ place, places, members, who, onCancel, onSend \}\)/);
  assert.match(comp, /"带答应的人出发 →"/);
  assert.match(app, /const sendGroupDateInvite = /);
  const i = app.indexOf("const groupDateGo");
  const seg = app.slice(i, app.indexOf("const groupInvitePlacesFor", i));
  assert.match(seg, /some\(x => x && !x\.endTs\)/, "还有一场没结束就别盖掉");
  assert.match(seg, /\(inv\.replies \|\| \{\}\)\[x\.id\] === "yes"/, "只带答应了的人");
  assert.match(seg, /startGroupOffline\(groupId, \{ present: going\.map/);
  // 没选、没答应的人进不了那一场：群线下一开头就把成员表收窄
  assert.match(app, /memberIds: \(groupIn\.memberIds \|\| \[\]\)\.filter\(id => workSess\.present\.includes\(id\)\)/);
});

test("回执单聊群聊共用一套：问法、认去不去、回执长相各一份", () => {
  assert.equal((app.match(/const rsvpReceipt = /g) || []).length, 1);
  assert.match(app, /capState\.push\("dateReply：" \+ inviteAskText\(_inv, "她"\)\)/);
  assert.match(app, /pChat\(charId, p => \[\.\.\.p, rsvpReceipt\(inv, null\)\]\)/);
  assert.match(app, /pushGroupRich\(groupId, rsvpReceipt\(_gInv, spk\)\)/);
  assert.match(app, /gTfHint \+ gInviteHint \+ gPollHint/);
  assert.match(app, /没被约到的人不填/);
  assert.match(comp, /if \(m\.kind === "datereceipt"\) return h\(DateInviteCard/);
  assert.match(comp, /grp \? "想约大家一起出去。" : "想和你一起去约会。"/, "群里那张不叫约会");
});

test("群聊＋面板在输入框下面", () => {
  const i = comp.indexOf("function GroupThread");
  const composer = comp.indexOf('"data-wk": "composer"', i), panel = comp.indexOf("}, CHAT_PANEL_SCROLL)", i);
  assert.ok(composer > 0 && panel > composer, "面板又跑到输入框上面去了");
});

test("＋面板单聊群聊共用一个矮高度，能往下滑", () => {
  assert.match(comp, /const CHAT_PANEL_SCROLL = \{ maxHeight: \d+, overflowY: "auto"/);
  assert.equal((comp.match(/\}, CHAT_PANEL_SCROLL\)/g) || []).length, 2);
});

test("我们的城市能切手绘/现实/架空，现实架空就是好友地图那两张，不另画", () => {
  const dw = R("js/dwell.js");
  assert.match(dw, /\[\["draw", "手绘"\], \["real", "现实"\], \["story", "架空"\]\]/);
  assert.match(dw, /h\(K\.MapWidget, \{ characters: \[char\]/);
  assert.match(dw, /h\(K\.WorldMapEmbed, \{ world: r\.world/);
  assert.match(map, /function WorldMapEmbed\(\{ world, characters, status, me, ops \}\) \{\n    const o = ops \|\| \{\};\n    return h\(WorldMap, \{/, "嵌进去的就是同一个 WorldMap");
  assert.match(app, /worldOps: \{ busy: worldBusy, onPin: pinWorld/);
});

test("我们的城市每个人一份：换人就换城，旧版共用的按来往认领、认不出的留着让她捡", () => {
  global.localStorage = (() => { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; })();
  global.window = global.window || {};
  const src = R("js/dwell.js");
  const i = src.indexOf("  const DP_KEY"), j = src.indexOf("  window.DatePlaces = DatePlaces;");
  const DatePlaces = new Function("localStorage", src.slice(i, j) + "\nreturn DatePlaces;")(global.localStorage);
  localStorage.setItem("x_datePlaces", JSON.stringify([{ id: "a", name: "御马监跑马场", note: "", by: "" }, { id: "b", name: "面馆", by: "qz" }, { id: "c", name: "无主", by: "" }]));
  localStorage.setItem("x_dateVisits", JSON.stringify({ "御马监跑马场": [{ charId: "wy", ts: 1 }] }));
  DatePlaces.migrate(() => []);
  assert.deepEqual(DatePlaces.list("wy").map(x => x.name), ["御马监跑马场"]);
  assert.deepEqual(DatePlaces.list("qz").map(x => x.name), ["面馆"], "王爷的地点不许跑到齐周这里");
  assert.deepEqual(DatePlaces.unclaimed().map(x => x.name), ["无主"], "认不出的不丢");
  assert.equal(DatePlaces.list(undefined).length, 0);
  assert.equal(DatePlaces.visits("御马监跑马场", "qz").length, 0, "去过几次也只数跟这个人的");
});

test("群邀约散场：在场的人各记一次去过、群里留「那天」；手写的地方钉进去了的人的城；没来的人不记得这一场", () => {
  const i = app.indexOf("const endGroupOffline = async groupId => {");
  const seg = app.slice(i, app.indexOf("\n  };\n", i));
  assert.match(seg, /memberIds: \(groupAll\.memberIds \|\| \[\]\)\.filter\(id => sess\.present\.includes\(id\)\)/, "总结和记忆只算在场的人");
  assert.match(seg, /saveJSON\("x_dateVisits", v\)/);
  assert.match(seg, /kind: "datememory"/);
  const g = app.slice(app.indexOf("const groupDateGo"), app.indexOf("const groupInvitePlacesFor"));
  assert.match(g, /window\.DatePlaces\.add\(pl\.name, pl\.note \|\| "", "", x\.id\)/);
  assert.match(g, /datePlace: pl\.name \?/);
  const gt = comp.slice(comp.indexOf("function GroupThread"));
  assert.ok(gt.indexOf('m.kind === "datememory"') > 0 && gt.indexOf('m.kind === "datememory"') < gt.indexOf('if (m.kind === "system" || m.role === "system")'), "「那天」要排在系统提示前面，不然被吞成一行字");
});
