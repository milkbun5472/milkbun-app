// 她 2026-10-02 转群友的三张图：① 世界加一张生图参考 ② 聊天＋面板里能直接邀约
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), comp = R("js/components.js"), map = R("js/map.js"), engine = R("js/engine.js");

test("世界表单有生图参考，存进 refImg；重画不丢图", () => {
  assert.match(map, /"生图参考"/);
  assert.match(map, /onGen\(name\.trim\(\), brief\.trim\(\), picked, refImg\)/);
  assert.match(app, /refImg !== undefined \? \{ refImg: refImg \|\| null \}/);
  assert.match(app, /refImg: \(old && old\.refImg\) \|\| null/);
  assert.match(app, /const saveWorlds = list => \{ worldsRef\.current = list;/, "新世界刚画完就存图，要读得到");
});

test("住在世界里的人拍照：线上线下都喂世界参考；空景局部不喂", () => {
  assert.equal((engine.match(/worldRefLine\(opts\.worldRefIndex\)/g) || []).length, 1);
  assert.equal((app.match(/const wRef = /g) || []).length, 2);
  assert.match(app, /const wRef = noFace \? null : worldRefFor\(char\)/);
  assert.equal((app.match(/worldRefIndex: wRef \? refs\.length : 0/g) || []).length, 2);
});

test("＋面板有邀约：挑地方（我们的城市＋TA的世界）或自己写，发约会卡", () => {
  assert.match(comp, /\["dateinvite", "邀约", "invite"\]/);
  assert.match(comp, /function DateComposeDialog\(\{ place, places, who, onCancel, onSend \}\)/);
  assert.match(comp, /disabled: !finalPlace/);
  assert.match(app, /onDateInvite: \(place, v\) => sendDateInvite\(activeChar, place, v\)/);
  const i = app.indexOf("const invitePlacesFor");
  const seg = app.slice(i, app.indexOf("const pendingInviteOf", i));
  assert.match(seg, /DatePlaces/);
  assert.match(seg, /charRealm/);
});
