// 擂台越吵越抽象（她 2026-09-23：「感觉越来越抽象了」）：每一轮都要落回地上，别接对面的术语。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/debate.js", "utf8");
const i = src.indexOf("【说人话 · 每一轮都落回地上】");
assert(i > 0);
assert(i < src.indexOf("【本次任务】"), "要在任务之前、全场都吃得到");
const blk = src.slice(i, src.indexOf("【本次任务】"));
assert(/看得见摸得着/.test(blk) && /别去接对面的术语/.test(blk) && /投票理由、裁判判语/.test(blk));
console.log("debate-plain-talk ok");
