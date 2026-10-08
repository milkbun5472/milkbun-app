// 她 2026-10-07：「为啥他给我重计了一遍」——「帮我记」之后已经记过一次，后面几轮不许再当成还在请他记
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const a = app.indexOf("  const askedRecently = ("), b = app.indexOf("\n  };", a) + 4;
const askedRecently = new Function(app.slice(a, b).replace("const askedRecently =", "return") )();
const RE = /帮我记/;
const stop = m => m && m.kind === "recorded";

test("记过之后，前面那句「帮我记」不再算数", () => {
  const rows = [{ role: "user", content: "你帮我记" }, { role: "assistant", content: "记上了" }, { role: "system", kind: "recorded", what: "health" },
    { role: "user", content: "沈总还要人伺候哦" }];
  assert.equal(askedRecently(rows, RE, 6, stop), false);
});

test("还没记、或记完她又说了一次，照旧算", () => {
  assert.equal(askedRecently([{ role: "user", content: "你帮我记" }, { role: "user", content: "快点" }], RE, 6, stop), true);
  assert.equal(askedRecently([{ role: "system", kind: "recorded" }, { role: "user", content: "再帮我记一杯" }], RE, 6, stop), true);
});

test("调用点用的是整份聊天（含那张记录卡），并且挂了 stopAt", () => {
  assert.match(app, /const _recRows = chatsRef\.current\[chatKey\] \|\| history, _recDone = m => m && m\.kind === "recorded";/);
  assert.match(app, /const _askedRecord = askedRecently\(_recRows, \/.*, 6, _recDone\);/);
});
