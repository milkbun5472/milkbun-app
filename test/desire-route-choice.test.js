// 群友 2026-10-09：后台心上走的线上 api——在「谁会自己动」心上那一行挑走线上还是后台
const assert = require("assert"), fs = require("fs");
const A = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), P = fs.readFileSync(__dirname + "/../js/auto-refresh-policy.js", "utf8");
assert.match(P, /id: "desire"[\s\S]{0,300}rates: \[\{ id: "online", zh: "走线上"[\s\S]{0,200}\{ id: "bg", zh: "走后台"/);
assert.match(P, /rateDefault: "online" \},/);
assert.match(A, /return onBg \? sumRoute\(apiFor\(id\)\) : apiFor\(id\);/);
assert.equal((A.match(/runProbe\(desireApiFor\(/g) || []).length, 2, "发呆、盘一盘两枪都要听这个开关");
const pol = require(__dirname + "/../js/auto-refresh-policy.js");
console.log("desire route ok");
