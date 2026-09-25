// 同一个人换个号：顾忌不同、人不变（她 2026-09-24：「语气和角度也要有点不一样但是不能ooc」）。
const assert = require("assert");
const app = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const i = app.indexOf("const FORUM_ID_VOICE = ");
const v = app.slice(i, app.indexOf(";\n", i));
assert(/变的是【顾忌】/.test(v) && /不变的是【这个人】/.test(v), "说清什么变、什么不变");
assert(/这确实像他会想的事/.test(v), "带可判定的那一句（防 OOC）");
const code = app.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
assert.strictEqual((code.match(/FORUM_ID_VOICE/g) || []).length, 3, "发帖和楼里冒泡共用一份");
console.log("forum-id-voice ok");
