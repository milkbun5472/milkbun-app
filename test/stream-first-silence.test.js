// 群友 2026-11-27：同人文「流式回复中途静默超过 90 秒」——思考型模型正文开始前先想很久，那段不算断线
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
assert.match(eng, /const FIRST_SILENCE_MS = \(opts && opts\.streamFirstSilenceMs\) \|\| \(opts && opts\.timeout >= 300000 \? 300000 : SILENCE_MS\);/, "只有写长文的多等");
assert.match(eng, /const LONG_WRITE = Object\.freeze\(\{ timeout: 600000, stream: true \}\);/, "长文那几枪的总时限够格");
assert.match(eng, /grace != null \? grace : \(gotBytes > 2048 \? SILENCE_MS : FIRST_SILENCE_MS\)/);
assert.match(eng, /gotBytes \+= \(chunk\.value && chunk\.value\.length\) \|\| 0;/);
console.log("ok");
