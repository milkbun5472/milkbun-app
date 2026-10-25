// 世界书文件夹、多选、每个人挑用哪几条（2026-10-26 群友许愿）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const eng = R("js/engine.js");
const sel = eng.slice(eng.indexOf("function selectLore("), eng.indexOf("\n}\n", eng.indexOf("function selectLore(")) + 3);

const pick = (entries, charIds) => new Function("loreScopeOn", "loreKeywordHit", "getQueryVec", "_loreVecCache", sel + "\nreturn selectLore;")(
  () => true, () => true, () => null, () => ({}))(entries, { scope: "chat", charIds, text: "" });

test("聊天设置里对某人关掉的那条，TA 单聊里不进；别人照用", () => {
  const e = [{ id: "a", payload: "x", alwaysOn: true, offFor: ["c1"] }];
  const ids = r => (Array.isArray(r) ? r : (r && r.list) || []).map(x => x.id);
  assert.deepEqual(ids(pick(e, ["c1"])), []);
  assert.deepEqual(ids(pick(e, ["c2"])), ["a"]);
  assert.deepEqual(ids(pick(e, ["c1", "c2"])), ["a"], "群里还有人用着就照常进");
});

test("世界书页有按文件夹、长按多选；导入的 json 整本收进一个文件夹", () => {
  const ui = R("js/screens-ui.js"), app = R("js/app.js");
  assert.match(ui, /\["folder", "按文件夹"\]/);
  assert.match(ui, /data-wk": "loreselbar"/);
  assert.match(ui, /onImportMany\(list, file\.name\)/);
  assert.match(app, /onImportMany: \(list, charIds, bookName\) =>/);
  assert.match(app, /onBulkDelete: ids =>/);
});

test("聊天设置里有「世界书 · TA 用哪几条」", () => {
  const comp = R("js/components.js");
  assert.match(comp, /世界书 · TA 用哪几条/);
  assert.match(comp, /function ChatLorePicker/);
});
