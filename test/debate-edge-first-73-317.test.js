// 先定这一轮的高下（edge）再投；不再把上几轮的票喂回去（她 2026-09-23：「连着三轮继续平票也不动」）。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/debate.js", "utf8");
const code = src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
assert(!/histLines/.test(code), "上几轮的票不再进提示词");
assert(/\\"edge\\":\{/.test(code), "输出里要有 edge");
assert(code.indexOf('\\"edge\\":{') < code.indexOf('\\"votes\\":[{'), "edge 写在 votes 前面，先判再投");
console.log("debate-edge-first ok");
