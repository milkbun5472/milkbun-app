const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const RP = require("../js/reply-pacing.js");

// 桩照写入方:addDirective 存的是 {id,text,ts}(app.js 的 directives 状态注释)
const hist = [{ role: "user", content: "嗯" }];

test("准则定了条数:这一轮不再报 1～3 的区间,照准则走", () => {
  const d = [{ id: "d1", text: "每次回复至少12条，最多666条，保持热情活泼，发信息要密", ts: 1 }];
  const g = RP.pacing(hist, { directives: d });
  assert.doesNotMatch(g, /参考区间/);
  assert.match(g, /至少12条/);
});

test("准则跟条数长短无关:走分量和性格,也不报区间", () => {
  const g = RP.pacing(hist, { directives: [{ text: "少用敬语，对她随意一点" }] });
  assert.doesNotMatch(g, /参考区间|长期准则来/);
});

test("单聊线上把这个角色的准则递给节奏", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
  assert.match(app, /window\.ReplyPacing\.guidance\(history, \{[^}]*directives: directives\[char\.id\] \|\| \[\] \}\)/);
});
