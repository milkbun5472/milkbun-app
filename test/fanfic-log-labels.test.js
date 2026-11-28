const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/fanfic-core.js", "utf8");
// 她 2026-11-28：出本那次调用记录里叫「其他 · $r」——同人文每一枪都挂上自己的名字
const calls = s.match(/await callAI\(/g).length, labeled = (s.match(/logLabel: "同人文·/g) || []).length;
assert.equal(labeled, calls, "还有没挂名字的同人文调用");
console.log("ok fanfic-log-labels");
