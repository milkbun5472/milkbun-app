// 「这一轮说得好」不挂标签；比分连着两轮冻住就推一把（她 2026-09-23：「哈哈清一色的这一轮说得好」）。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/debate.js", "utf8");
assert(/v\.why === "round" \|\| v\.why === "value" \? "" : \(VOTE_WHY\[v\.why\]/.test(src));
assert(/hh\.length >= 2 && hh\[hh\.length - 1\] === hh\[hh\.length - 2\]/.test(src));
assert(/上两轮台下一票都没动过/.test(src) && /\(frozen \? /.test(src));
console.log("debate-vote-label-frozen ok");
