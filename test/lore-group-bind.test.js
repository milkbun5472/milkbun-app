const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"); const vm = require("vm");
test("世界书绑在群上：只进那个群（小房间也算一个群），单聊和别的群不进", () => {
  const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" } }; vm.createContext(ctx);
  try { vm.runInContext(fs.readFileSync("js/engine.js", "utf8"), ctx); } catch (e) {}
  const sel = vm.runInContext("selectLore", ctx);
  const es = [{ id: "a", payload: "平行世界设定", alwaysOn: true, groupIds: ["g_room"] }, { id: "b", payload: "全局", alwaysOn: true }];
  assert.deepEqual(sel(es, { scope: "chat", charIds: ["c1"], groupId: "g_room" }).map(e => e.id).sort(), ["a", "b"]);
  assert.deepEqual(sel(es, { scope: "chat", charIds: ["c1"], groupId: "g_main" }).map(e => e.id), ["b"]);
  assert.deepEqual(sel(es, { scope: "chat", charIds: ["c1"] }).map(e => e.id), ["b"]);
});
