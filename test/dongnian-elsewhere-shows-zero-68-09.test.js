// 她 2026-09-14：「这俩的群设定一模一样，但其中一个不显示；而且裴照川的几个小时前还看得到」。
//
// 不是积累丢了，是【显示门槛】：那一行原来要 connection > 0.02 才画出来。
// 而群里刚有人说过话＝那一场刚清零＝整行消失——她刚在那个旁观群聊过天，
// 于是看起来像"进度没了"。有这一场就该有这一行，攒到哪儿是另一回事。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

test("刚清零的那一场也要露面，不能整行消失", () => {
  const seg = comp.slice(comp.indexOf("const renderDongnianElsewhere = () =>"), comp.indexOf("// 端不端着看"));
  assert.match(seg, /\.filter\(r => r && Number\.isFinite\(Number\(r\.connection\)\)\)/);
  assert.ok(!/Number\(r\.connection\) > 0\.02/.test(seg), "0.02 那道门槛还在，刚清零的那一场照样会整行不见");
  // 0 不写成 0.00，写成人话——不然她会以为是坏了
  assert.match(seg, /c > 0\.02 \? c\.toFixed\(2\) : "刚归零"/);
  // 一场都没有时才整段不出现（这条没变）
  assert.match(seg, /if \(!rows\.length\) return null;/);
});

test("有没有这一场，看的是【有没有存过状态】，不是攒到多少", () => {
  const seg = app.slice(app.indexOf("dongnianElsewhere: (() => {"), app.indexOf("activeRoomId: activeRoomId"));
  assert.match(seg, /const st = \(jw && jw\.state\) \|\| saved\[k\]/);
  assert.match(seg, /if \(!st\) return null;/, "没状态才不给这一行");
  assert.match(seg, /connection: Number\(st\.connection\) \|\| 0/);
});
