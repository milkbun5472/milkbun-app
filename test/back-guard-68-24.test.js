// 她 2026-09-14 转述朋友：「加了主屏幕还是会侧滑掉」。
// 病根：这个 App 从头到尾不往浏览器历史里记一笔（全库只有 notify.js 的
// replaceState，那一处不进栈），所以系统返回手势退的不是上一屏，是整个 App。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const { backDecide, BACK_EXIT_WINDOW } = require(path.join(root, "js/back-guard.js"));
const guardSrc = fs.readFileSync(path.join(root, "js/back-guard.js"), "utf8");
const appSrc = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const indexSrc = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("有人接住就停在他那儿，不许再往外退一格", () => {
  assert.equal(backDecide(true, 0, 1000), "handled");
  assert.equal(backDecide(true, 999, 1000), "handled");
});

test("一个都没接住：第一下只提示，第二下才真退出", () => {
  assert.equal(backDecide(false, 0, 10000), "hint");
  assert.equal(backDecide(false, 10000, 10500), "exit");
});

test("隔太久的那一下不算「再滑一次」——重新从提示开始", () => {
  assert.equal(backDecide(false, 10000, 10000 + BACK_EXIT_WINDOW + 1), "hint");
});

test("接住之后要把哨兵补回去，退出那一路才不补", () => {
  // 补回去 = 历史里永远还剩一格可退；不补 = 这一下真的放行
  assert.match(guardSrc, /if \(act === "exit"\) \{\s*exiting = true;\s*onPop\(\)/);
  assert.match(guardSrc, /if \(exiting\) \{[\s\S]{0,400}history\.back\(\)/);
  assert.match(guardSrc, /window\.removeEventListener\("popstate", onPop\)/);
  assert.match(guardSrc, /seed\(\);\n    if \(act === "handled"\)/);
});

test("栈顶先接手", () => {
  assert.match(guardSrc, /for \(var i = stack\.length - 1; i >= 0; i--\)/);
});

test("App 接住的是浮层和非主屏，主屏才交回去", () => {
  const i = appSrc.indexOf("backRef.current = () => {");
  assert.ok(i > 0);
  const body = appSrc.slice(i, i + 700);
  assert.match(body, /if \(stateCardOpen\)/);
  assert.match(body, /if \(offlineChar \|\| offlineGroup\)/);
  assert.match(body, /screen !== "home"/);
  assert.match(body, /return false;/);          // 主屏交回去，由 BackGuard 兜「再滑一次」
  assert.match(appSrc, /BackGuard\.arm\(\{ hint: \(\) => toast\("再滑一次退出"\) \}\)/);
});

test("只注册一次，靠 ref 读当前状态", () => {
  const i = appSrc.indexOf("window.BackGuard.arm(");
  const tail = appSrc.slice(i, i + 400);
  assert.match(tail, /\}, \[\]\);/);            // 依赖空数组：不许每次 setState 重装
  assert.match(appSrc, /backRef\.current \? backRef\.current\(\) === true : false/);
});

test("挂进 index.html，而且排在 app 之前", () => {
  const a = indexSrc.indexOf('<script src="js/back-guard.js');
  const b = indexSrc.indexOf('<script src="js/app.js');
  assert.ok(a > 0 && b > 0 && a < b);
});
