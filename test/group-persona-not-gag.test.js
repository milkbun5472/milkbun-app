// 她 2026-10-08 截图：私聊里会问她晚上吃什么的人，到群里只剩跟另一位比梗——身份成了道具。
const assert = require("assert"), fs = require("fs");
const A = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const i = A.indexOf("const common = "), line = A.slice(i, A.indexOf("\n", i));
assert.ok(i > 0);
assert.ok(!/接梗、跑题、互相调侃或反驳/.test(line), "群聊那段又把接梗调侃写成了默认");
assert.match(line, /每个人在群里还是他私聊里那个人/);
assert.match(line, /身份和职业是他的生活，不是他每句话的梗/);
const g = A.slice(A.indexOf("const G_EACH_OTHER"), A.indexOf("\n", A.indexOf("const G_EACH_OTHER")));
assert.ok(!/补刀/.test(g));
assert.match(g, /看这几个人本来什么性子、彼此什么交情/);
console.log("group persona ok");
