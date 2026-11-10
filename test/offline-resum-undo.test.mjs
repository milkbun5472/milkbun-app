import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const cmp = readFileSync(new URL("../js/components.js", import.meta.url), "utf8");
const ts = readFileSync(new URL("../js/theme-studio.js", import.meta.url), "utf8");
test("重新总结留着上一版，撤回时一并撤掉这次新记的记忆", () => {
  assert.match(app, /prevSummary: _prevSum, resumTs: _resumTs/);
  const i = app.indexOf("const undoResummarizeOffline"), body = app.slice(i, i + 2500);
  assert.ok(i > 0);
  assert.match(body, /prevSummary/);
  assert.match(body, /saveMemLib\(/);
  assert.equal((app.match(/onUndoResummarizeOffline: i => undoResummarizeOffline\(/g) || []).length, 2);
});
test("卡上：重新总结先确认，有上一版时出「换回上一版总结」，单聊群聊都接上", () => {
  const i = cmp.indexOf("function OfflineLogCard"), body = cmp.slice(i, i + 4000);
  assert.match(body, /requestAppConfirm\("重新总结这一场？"/);
  assert.match(body, /onUndo && m\.prevSummary/);
  assert.equal((cmp.match(/onUndo: onUndoResummarizeOffline \?/g) || []).length, 2);
  assert.match(ts, /"offlogundo"/);
});
