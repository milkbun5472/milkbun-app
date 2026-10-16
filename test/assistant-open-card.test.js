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
  assert.equal(X.TARGETS.open.write("map", {}, { onOpenPage: (a, id, sub) => { went.push(a + ":" + id + ":" + (sub || "")); return true; } }), 1);
  assert.deepEqual(went, ["map:map:"]);
  // 进那一格：id 斜杠后面那一截原样交给 app
  X.TARGETS.open.write("map/story", {}, { onOpenPage: (a, id, sub) => { went.push(a + ":" + id + ":" + sub); return true; } });
  assert.equal(went[1], "map:map:story");
  assert.match(X.TARGETS.open.before({ id: "map/story" }, {}), /架空地图/);
  assert.throws(() => X.TARGETS.open.write("map/xx", {}, { onOpenPage: () => false }), /没法直接跳过去/);
  assert.match(X.docLines(), /config\/data\/backup＝导入与导出/);
  assert.throws(() => X.TARGETS.open.write("nope", {}, { onOpenPage: () => true }), /没有/);
  assert.ok(X.okWithoutText({ target: "open", id: "map" }));
  assert.match(X.docLines(), /open 带她去那一页/);
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /onOpenPage: \(app, entryId, sub\) => \{/);
  assert.match(app, /if \(parts\[0\] === "data" && parts\[1\]\) window\.__dataPart = parts\[1\];/);
  assert.match(app, /openChatById\(hit\.id, entryId === "group" \? "group" : "char"\)/);
  const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
  assert.match(scr, /const p0 = w\.__dataPart \|\| ""; w\.__dataPart = "";/);
  const as = fs.readFileSync(path.join(root, "js/assistant.js"), "utf8");
  assert.match(as, /p\.target === "open" \? \(String\(p\.text/);
});

// 她 2026-10-16：「别的 app 不能都搞具体跳转吗」「我的 xx app 在哪儿，她可以说在第几页」
test("别的 app 里那一格：app.js 挂 __openSub，各 app 头一次画时取一次；秋秋看得见桌面布局", () => {
  const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
  assert.match(eng, /function takeOpenSub\(screen, allowed\)/);
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.match(app, /window\.__openSub = \{ screen: app, sub: parts\[0\] \};/);
  assert.match(app, /setUsLand\(\{ view: hit\.id, sub: parts\[1\] \|\| null \}\)/);
  [["fanfic.js", "fanfic"], ["study.js", "study"], ["ledger.js", "ledger"], ["memo.js", "memo"], ["weekly.js", "weekly"], ["dreamjournal.js", "dreamjournal"],
   ["style-lab.js", "stylelab"], ["health.js", "health"], ["astro.js", "astro"], ["debate.js", "debate"], ["dream.js", "dream"], ["theater.js", "theater"], ["trpg.js", "trpg"]]
    .forEach(([f, sc]) => assert.match(fs.readFileSync(path.join(root, "js", f), "utf8"), new RegExp('takeOpenSub\\("' + sc + '"'), f + " 没接"));
  const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
  assert.match(comp, /window\.__homeNow = function \(\)/);
  const ex = fs.readFileSync(path.join(root, "js/assistant-extras.js"), "utf8");
  assert.match(ex, /o\.桌面布局 = rows/);
});
