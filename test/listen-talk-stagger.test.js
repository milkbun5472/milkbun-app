const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/listen-talk.js", "utf8");
assert.match(s, /showAt: t0 \+ i \* STEP_MS/, "好几句要错开冒出来");
assert.match(s, /return r\.showAt \|\| r\.ts \|\| 0;/, "气泡的钟要从它冒出来那刻算");
assert.match(s, /rows\.filter\(r => clockOf\(r\) <= now && now - clockOf\(r\) < BUBBLE_MS\)/, "还没轮到的那几句先别显示");
console.log("listen stagger ok");
