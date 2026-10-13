// 她 2026-10-13：杂志排版的照片接进周刊——本周画报（不花钱）、封面（本期受访的人上封面）、专访照
const test = require("node:test");
const assert = require("node:assert/strict");
const R = f => require("fs").readFileSync(require("path").join(__dirname, "..", "js", f), "utf8");
const wk = R("weekly.js"), app = R("app.js");
test("app 递一个 onShoot：封面照头版排杂志、专访是单人大片，都是点了才拍", () => {
  assert.match(app, /const weeklyShoot = async \(kind, p\) =>/);
  assert.match(app, /onShoot: weeklyShoot,/);
  assert.match(app, /window\.PosterLayout\.plan\("magazine", cp\)/);
  assert.match(app, /kind: cast \? "group" : "self", cast: cast, closet: closetTextFor\(lead\.id\), editorial: "magazine"/);
});
test("周刊：封面照存在这一期上，专访照存在那一条采访上，画报读这一周的照相馆", () => {
  assert.match(wk, /iss\.coverPhoto = key/);
  assert.match(wk, /Object\.assign\(\{\}, x, \{ photo: key \}\)/);
  assert.match(wk, /loadJSON\("x_studio", \[\]\)/);
  assert.match(wk, /\{ key: "pics", label: "本周画报", sub: \{ kind: "pics" \} \}/);
  assert.match(wk, /onShoot: props\.onShoot/);
});
