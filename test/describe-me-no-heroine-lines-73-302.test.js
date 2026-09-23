// 开了「描写我的行动」后，替她写的话不许套言情女主现成台词（她 2026-09-23 转读者：「只要在床上，就一定要说你太重了」）。
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const i = eng.indexOf("  const desc = s.describeMe");
const desc = eng.slice(i, eng.indexOf("AGENCY_TAIL;", i));
assert(/【从她本人来】/.test(desc));
assert(/「你好重」「压死我了」「快起来」/.test(desc), "点名那一套");
assert(/拿不准她会怎么说，就只写她的动作，不替她开口/.test(desc));
console.log("describe-me-no-heroine-lines ok");
