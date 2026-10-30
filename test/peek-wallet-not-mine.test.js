// 群友 2026-10-20：TA 查她钱包，把她给别的面具那边的人买的东西全认成是给自己的
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(app, /流水上没写是给谁的/);
assert.match(app, /标了「就是你」的才是给你的；没写给谁的，你不知道是买给谁/);
// 别的面具那几个人的照旧整条不进
assert.match(app, /const log = \(walletLog \|\| \[\]\)\.filter\(w => !\(maskIds && maskIds\.length && walletMaskOf\(w\) !== maskKeyOf\(viewerId\)\) && !maskTrace\(w\.label\) && !\(w\.ref && \(\(w\.ref\.charId && maskSet\.has\(String\(w\.ref\.charId\)\)\) \|\| \(w\.ref\.groupId && maskSet\.has\(String\(w\.ref\.groupId\)\)\)\)/);
console.log("ok");

assert.match(app, /!peekMaskHit\(peekMaskView\(\), "", w\.ref && w\.ref\.groupId\)/);
