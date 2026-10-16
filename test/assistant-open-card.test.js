const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
// 她 2026-10-16：秋秋出一张跳转卡，按了就带到那一页
test("open 卡：照攻略那一条的 app 开页面，不认得的就报错，不进撤回本", () => {
  const win = { AssistantManual: { byId: id => ({ map: { id: "map", app: "map", zh: "好友地图", where: "主屏上的地图组件" } })[id] || null } };
  const sb = { window: win, console, loadJSON: () => null, saveJSON: () => {}, localStorage: { getItem: () => null } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, "js/assistant-extras.js"), "utf8"), sb);
  const X = win.AssistExtras;
  const went = [];
  assert.equal(X.TARGETS.open.write("map", {}, { onOpenPage: (a, id) => { went.push(a + ":" + id); return true; } }), 1);
  assert.deepEqual(went, ["map:map"]);
  assert.throws(() => X.TARGETS.open.write("nope", {}, { onOpenPage: () => true }), /没有/);
  assert.ok(X.okWithoutText({ target: "open", id: "map" }));
  assert.match(X.docLines(), /open 带她去那一页/);
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /onOpenPage: \(app, entryId\) => \{/);
  const as = fs.readFileSync(path.join(root, "js/assistant.js"), "utf8");
  assert.match(as, /p\.target === "open" \? \(String\(p\.text/);
});
