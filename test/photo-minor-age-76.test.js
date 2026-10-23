// 生图未成年判断：「21岁」不许被认成一岁（群里 2026-10-23）
const test = require("node:test"), assert = require("node:assert");
const src = require("fs").readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
const grab = name => new RegExp(src.match(new RegExp("const " + name + " = /(.+?)/(i?)\\.test"))[1], src.match(new RegExp("const " + name + " = /(.+?)/(i?)\\.test"))[2]);
const W = grab("_minorWord"), A = grab("_minorAge"), D = grab("_adultAge");
const minor = s => W.test(s) || (A.test(s) && !D.test(s));
test("adult ages are not minors", () => {
  for (const s of ["男性，21岁，医学生", "25岁", "今年31岁", "8岁那年父母离世，现年27岁"]) assert.equal(minor(s), false, s);
});
test("real minors still caught", () => {
  for (const s of ["16岁高中生", "12岁", "未成年", "一个小男孩"]) assert.equal(minor(s), true, s);
});
