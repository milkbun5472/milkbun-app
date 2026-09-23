// 台边那一声冲着自己这一轮投的那个人＝帮腔；提示词里说清冲着同边/对面各是什么样
// （她 2026-09-23：「陆衍明明和顾暮理念相同为啥在台边还要对他说话」）。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/debate.js", "utf8");
assert(/冲着【自己这边】的，是帮腔、递话、给TA撑腰/.test(src));
assert(/if \(v && x\.at && v\.for === x\.at\) x\.ally = true;/.test(src));
assert(/x\.ally \? " 帮腔 " \+ x\.at : " → " \+ x\.at/.test(src));
console.log("debate-side-ally ok");
