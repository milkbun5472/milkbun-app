const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/theater.js", "utf8");
const a = src.indexOf("const decodeLooseJsonText"), b = src.indexOf("function parseTheaterPayload");
const salvage = new Function(src.slice(a, b) + "\nreturn salvageTheaterPayload;")();

test("小剧场抢救：正文里有中文引号把 JSON 弄坏，照样抠出 scene", () => {
  const p = salvage('{"scene":"我说"你来了"然后停下","goalReached":false,"goalFailed":false,"goalNote":null}');
  assert.equal(p.scene, '我说"你来了"然后停下');
});
test("小剧场抢救：输出被截断，没写到 goalReached 也收下已写的正文", () => {
  const p = salvage('{"scene":"我在楼梯口等，背对着楼梯口，看走廊尽头那扇"窗"');
  assert.ok(p && p.scene.startsWith("我在楼梯口等"));
  assert.equal(p.goalReached, false);
});
test("小剧场抢救：字段顺序调换、scene 排最后也认", () => {
  const p = salvage('{"goalReached":true,"goalNote":"他说出口了","scene":"我"终于"说了"}');
  assert.equal(p.scene, '我"终于"说了');
  assert.equal(p.goalReached, true);
});
test("小剧场：没套 JSON 的纯正文照收，带协议痕迹的仍拦住", () => {
  assert.match(src, /let p = parseTheaterPayload\(raw\);[\s\S]{0,400}scene: bare/);
});
