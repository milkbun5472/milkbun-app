// 票＝这一轮谁说得好、可弃权、立场慢慢变；裁判说人话、不端水（她 2026-09-23）。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/debate.js", "utf8");
assert(!/justSwitched/.test(src), "强制投回去那条撤了");
assert(/投给台上【这一轮】说得更好的那一个/.test(src));
assert(/TA不是解说员、不是写评析/.test(src));
assert(/不许端水/.test(src));
assert(/还没吵拢的那个分歧】，用大白话说/.test(src));
console.log("debate-votes-judge-73-312 ok");
