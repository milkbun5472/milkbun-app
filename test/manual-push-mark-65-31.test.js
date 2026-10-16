// 手动备份必须盖成功戳（她 2026-09-07 报：toast 成功、横幅仍警告 5 小时前）。
// 钉法照 stub-from-the-writer：直接对着 cloud.js 的 push() 源文验证两件事同在——
// upsert 成功后调用 markSynced，且用的是同一枚时间戳（不是各自 new Date）。
const assert = require("node:assert");
const test = require("node:test");
const fs = require("node:fs");

test("Cloud.push 成功路径盖 MARK 且与 upsert 同戳", () => {
  const src = fs.readFileSync(__dirname + "/../js/cloud.js", "utf8");
  const m = src.match(/async push\(\) \{([\s\S]*?)\n    \},/);
  assert.ok(m, "找不到 push()");
  const body = m[1];
  assert.match(body, /const ts = new Date\(\)\.toISOString\(\)/, "缺统一时间戳 ts");
  assert.match(body, /updated_at: ts/, "upsert 没用 ts");
  assert.match(body, /this\.markSynced\(ts\)/, "成功后没盖 markSynced(ts)");
  // v75.7xx 起这一句里多了「这次要传多少 MB」的提示，判据还是同一件事：先查错、再盖戳
  const errIdx = body.indexOf("if (error) {");
  const markIdx = body.indexOf("this.markSynced(ts)");
  assert.ok(errIdx >= 0 && markIdx > errIdx, "markSynced 必须在 error 检查之后（失败不许盖戳）");
});
