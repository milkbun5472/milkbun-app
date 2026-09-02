// 群里那一摞规矩的【真跑】把手（v60.39）。
// 三处群（线上/线下/通话）共用 engine.js 的 groupBans()，所以测它该测【它吐出哪几层】，
// 而不是去 grep「这个常量拼在那一行的哪个位置」——后者正是那一整轮反复误报的那类断言：
// 一改拼法就红，可行为一个字没变。
//
// ⚠️v60.45：常量名原来是手写一张 names 表喂进沙箱的，于是 groupBans 里【新加一层】
// 就会让这个把手直接 ReferenceError——同一层写在两处、第二处没跟上，
// 这个病连测试脚手架自己都得了一次。改成【从函数体里认出来】：
// 加层不再需要有人记得回来改表，只有真正断言「就该是这几层」的 deepEqual 会红，
// 而那一红是我们要的信号。
const fs = require("node:fs");
const path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const i = eng.indexOf("function groupBans(opts) {");
const body = eng.slice(i, eng.indexOf("\n}", i) + 2);
// 函数体里所有裸的大写常量引用（ContentBoundaries / ReplyPacing 另外给桩）
const NAMES = [...new Set(body.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || [])];
const fn = new Function(...NAMES, "ContentBoundaries", "ReplyPacing", body + "\nreturn groupBans;")(
  ...NAMES.map(n => "<" + n + ">"), { prompt: "<CB>" }, { reading: () => "<RP>" });
// 三处群各自的调用参数，跟真代码保持一致
const ONLINE = { echo: false };
const CALL = { echo: true };
const OFFLINE = { narrative: true, mood: true, echo: true, worldbook: true };
const layers = o => fn(o).split("\n\n");
const has = (o, name) => layers(o).indexOf("<" + name + ">") >= 0;
// 三处群都吃得到某一层
const allGroupsHave = name => has(ONLINE, name) && has(CALL, name) && has(OFFLINE, name);
module.exports = { layers, has, allGroupsHave, ONLINE, CALL, OFFLINE, NAMES };
