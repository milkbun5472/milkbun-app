// 推剧情按这个人自己的方式推，不只给「摊牌/动手/起身就走」那一种强势推法
// （她 2026-09-23：「为什么线下还是会默认霸总啊」）。
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const code = eng.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const t0 = code.indexOf("const AGENCY_TAIL = ");
const tail = code.slice(t0, code.indexOf(";\n", t0));
assert(/按你这个人自己的方式推/.test(tail));
assert(!/摊牌、动手、起身就走/.test(tail), "尾部不许只列强势推法");
const r0 = code.indexOf("const OFFLINE_AGENCY_RULE = `");
const rule = code.slice(r0, code.indexOf("`;", r0));
assert(!/摊牌、把话戳破、动手、起身就走/.test(rule));
assert(/怎么推，是这个人自己的样子/.test(rule));
console.log("offline-push-own-way-73-29 ok");
