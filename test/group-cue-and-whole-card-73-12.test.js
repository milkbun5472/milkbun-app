// ① 她在群里、成员自己聊的时候也可以 cue 她（她 2026-09-23：「我在群里他们自己聊起来也没见到他们cue我啊」）；
//    要防的只是因为她没回而催、闹委屈。旁观群不给这句。
// ② 群里每个人按整张卡写，不是只放大最显眼的那个形容词（她：「你是他们每个人单独的化身，不是人设标签提取器」）。
const assert = require("assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = app.indexOf("if (!tail.length) userContent +=");
assert(i > 0);
const blk = app.slice(i, app.indexOf("\n      // 双语·每轮提醒", i));
assert(blk.length < 6000, "切片别切到文件尾");
assert(!/也不许因此闹脾气或反复提起 TA/.test(blk), "不再禁止提起她");
assert(/顺手 @ 一下/.test(blk), "允许想起她时 @ 她");
assert(/\(!gs\.spectate && !asPrivate\)\s*\?\s*"想起 TA 的时候/.test(blk), "旁观群不给这句");
assert(/催回应、闹委屈的话不要写/.test(blk), "仍然不许催回应");
const g0 = eng.indexOf("const GROUP_IN_CHARACTER");
const g = eng.slice(g0, eng.indexOf("`;", g0));
assert(/\$\{WHOLE_CARD_RULE\}/.test(g), "群里带整张卡那条");
const w0 = eng.indexOf("const WHOLE_CARD_RULE");
const w = eng.slice(w0, eng.indexOf("`;", w0));
assert(/不是人设标签提取器/.test(w));
assert(/换成另一个同类型的人/.test(w), "带可判定的那一句");
console.log("group-cue-and-whole-card-73-12 ok");
