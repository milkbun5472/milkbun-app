const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const w = fs.readFileSync(__dirname + "/../js/weekly.js", "utf8");
// 她 2026-11-08：「点开了不是一次性请求，想退出没生成的请求不扣钱」「下次接着写是要点进去继续，而不是每次重进 app 重试」
test("一版写完就存草稿；退出周刊页停在下一枪之前", () => {
  assert.match(w, /const K_DRAFT = "x_weekly_draft";/);
  assert.match(w, /const go = function \(\) \{ if \(ctrl\.stopped && ctrl\.stopped\(\)\) throw new Error\(STOPPED\); \};/);
  assert.match(w, /return function \(\) \{ off\(\); window\.Weekly\.genStop\(\); \};/);
  assert.ok((w.match(/\bgo\(\);/g) || []).length >= 5, "每一枪之前都要问一句停没停");
});
test("写好的那几版下次直接用；有半本时不自己重来，等她点「接着写」", () => {
  assert.match(w, /let cover = D\.cover \|\| null;/);
  assert.match(w, /if \(ivDone\[c\.id\]\) \{ entries\.push\(ivDone\[c\.id\]\); done\+\+; continue; \}/);
  assert.match(w, /if \(window\.Weekly\.draftOf\(win\.key\)\) return;/);
  assert.match(w, /"写好了 " \+ props\.draftN \+ " 版，点一下接着写 →"/);
  assert.match(w, /saveJSON\(K_DRAFT, null\);/);
});
