// 她 2026-10-04：「以后做东西不准放小仓库！全给我搬过去」
// Arlota 的地图和 API 线路挤在 localStorage 那 5MB 里，满了写不进去；文字早在 IDB 所以一条没少。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const eng = read("js/engine.js");

function grab(name, end) {
  const i = eng.indexOf(name), j = eng.indexOf(end, i);
  assert.ok(i >= 0 && j > i, "抠不出 " + name);
  return eng.slice(i, j);
}
// 把路由那一段原样跑起来：桩照写存档的那段（lsRaw 只认一张 Map）
function router(pinned) {
  const src = grab("const DURABLE_TEXT_KEYS", "function isDurableTextKey");
  const store = new Map(pinned ? [["qq_lsPinned", JSON.stringify(pinned)]] : []);
  const lsRaw = { get: k => store.has(k) ? store.get(k) : null, set: (k, v) => store.set(k, String(v)), del: k => store.delete(k) };
  const _txtGate = { done: false };
  return new Function("lsRaw", "_txtGate", "console", src + "; return { isIdbTextKey, txtEarlyTouch, store: () => lsRaw };")(lsRaw, _txtGate, { warn() {} });
}

test("所有 x_ 键默认进 IDB，地图和线路首当其冲", () => {
  const r = router();
  ["x_worlds", "x_api", "x_characters", "x_health", "x_forumLikes", "x_someFutureFeature"].forEach(k =>
    assert.equal(r.isIdbTextKey(k), true, k + " 还在小仓库"));
  // 不带 x_ 的标记不归存档管
  assert.equal(r.isIdbTextKey("qq_lsPinned"), false);
  assert.equal(r.isIdbTextKey("memory_table_authority_v1"), false);
});

test("只有开机前就要读的那几把留在 localStorage", () => {
  const r = router();
  ["x_theme", "x_firstDayTs", "x_theme_studio", "x_bubbleSkin", "x_radioDial", "x_errlog", "x_neteaseCookie", "x_cloudApplyFailed_v1"]
    .forEach(k => assert.equal(r.isIdbTextKey(k), false, k + " 开机前就要读，不能搬"));
});

test("灌库前被碰到的小键钉回 localStorage；大正文绝不钉", () => {
  const r = router();
  r.txtEarlyTouch("x_lateFlag");
  assert.equal(r.isIdbTextKey("x_lateFlag"), false, "早读的键没钉回去，下次开机会读成空");
  r.txtEarlyTouch("x_chat:c1"); r.txtEarlyTouch("x_offline:c1"); r.txtEarlyTouch("x_moments");
  assert.equal(r.isIdbTextKey("x_chat:c1"), true, "聊天被钉回 5MB 了");
  assert.equal(r.isIdbTextKey("x_moments"), true);
  // 钉过的记在本机，下次开机还认
  assert.equal(router(["x_lateFlag"]).isIdbTextKey("x_lateFlag"), false);
});

test("老代码直连 localStorage 也被转进大仓库", () => {
  const b = grab("(function installLsBridge()", "})();");
  assert.match(b, /P\.getItem = function/);
  assert.match(b, /P\.setItem = function/);
  assert.match(b, /if \(isIdbTextKey\(k\)\) \{ txtWrite\(k, String\(v\)\); return; \}/);
  assert.match(b, /if \(isIdbTextKey\(k\)\) \{ dropStored\(k\); return; \}/);
  assert.match(b, /o === localStorage/, "sessionStorage 也被转了");
});

test("文字库自己不经过转接层", () => {
  const w = grab("function txtWrite(", "function saveJSON(");
  assert.doesNotMatch(w, /localStorage\.(get|set|remove)Item/, "txtWrite 里还有直连，会被转回自己");
  const h = grab("async function hydrateTxtVault", "function storedJSONText");
  assert.doesNotMatch(h, /localStorage\.(get|set|remove)Item/);
});

test("文字库打不开时，写入不落盘", () => {
  const w = grab("function txtWrite(", "function saveJSON(");
  assert.match(w, /_txtGate\.done && !_txtGate\.ok\) \{ _txtMirror\(\)\.set\(k, s\); return true; \}/);
  // 读失败必须抛，不能当成空仓
  assert.doesNotMatch(grab("async function idbTxtAll", "\n"), /res\(\[\]\)/);
});

test("批量清 localStorage 的地方裸删，不连 IDB 一起删", () => {
  const cloud = read("js/cloud.js"), app = read("js/app.js");
  const n = s => (s.match(/lsRaw\.del\(k\)/g) || []).length;
  assert.ok(n(cloud) >= 3, "云恢复/回滚/退出要裸删");
  assert.ok(n(app) >= 2, "导入/清空要裸删");
  assert.match(cloud, /localStorage\.getItem\("qq_vaultHasData"\) === "1"/, "老设备会被当成新设备");
});

test("线路列表等文字库灌完再解密", () => {
  const app = read("js/app.js");
  assert.match(app, /Promise\.resolve\(txtP\)\.catch\(\(\) => 0\)\.then\(\(\) => window\.CredentialVault\.hydrateApiCredentials\(\)\)/);
});
