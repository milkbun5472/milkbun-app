// 她 2026-09-15：「随身物是不是没有专门设后台 api 选择了主模型就用不了，
// 能不能改改跟随主模型也能用，还有其他有这种症状的都改了」。
//
// 查下来三处解析线路的写法里，只有 bgActive 是另一种：
//   offlineActive / apiFor：(id && find(id)) || active   ← 找不到就退回主模型
//   bgActive（旧）        ：id ? (find(id) || null) : active ← **找不到就变成 null**
// 而一堆后台活是硬 guard 在 if (!bgActive) 上的，所以 bgApiId 指着一条被删掉的线路时，
// 记忆抽取/日程/钱包/查手机/随身物一起罢工，还报「请先到设置配置后台便宜 API」——
// 而设置里那一栏这时一档都不高亮，看起来就像「我选的是跟随主模型啊」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

const mk = profiles => {
  const ctx = { apiProfiles: profiles };
  vm.createContext(ctx);
  const i = app.indexOf("  const pickRoute = (id, fallback) =>");
  vm.runInContext(app.slice(i, app.indexOf("\n  const offlineActive", i))
    + "\nthis.pick = pickRoute; this.picked = routePicked;", ctx);
  return ctx;
};
const P = [{ id: "a", name: "主" }, { id: "b", name: "便宜的" }];

test("选了就用选的", () => {
  const k = mk(P);
  assert.equal(k.pick("b", P[0]).id, "b");
});

test("⚠️选的那条被删掉了 → 退回主模型，不是变成 null", () => {
  const k = mk(P);
  assert.equal(k.pick("没了这条", P[0]).id, "a", "又变回 null 了——后台那一堆会一起罢工");
  assert.equal(k.pick(null, P[0]).id, "a");
  assert.equal(k.pick("", P[0]).id, "a");
});

test("一条都没有时才给 null（那时确实没得用）", () => {
  const k = mk([]);
  assert.equal(k.pick("x", undefined), null);
  assert.equal(k.pick(null, null), null);
});

test("三处线路合到同一份，别再各写各的（one-public-mechanism）", () => {
  ["const offlineActive = pickRoute(offlineApiId, active);",
   "const bgActive = pickRoute(bgApiId, active);",
   "const apiFor = id => pickRoute((chatSettings[id] || {}).apiId, active);",
   "const offlineApiFor = id => pickRoute((chatSettings[id] || {}).apiId, offlineActive);"]
    .forEach(l => assert.ok(app.indexOf(l) >= 0, "没走公共那份：" + l));
  // 旧那个「找不到就 null」的写法不许回来
  assert.doesNotMatch(app, /bgApiId \? \(apiProfiles\.find/);
});

test("「用的是哪条」只影响说话，不参与选路", () => {
  const k = mk(P);
  assert.equal(k.picked("b"), true);
  assert.equal(k.picked("没了这条"), false, "选的那条没了还说是后台模型，就说了假话");
  assert.equal(k.picked(null), false);
  assert.match(app, /\(routePicked\(bgApiId\) && bgActive && p\.id === bgActive\.id\) \? "后台任务模型"/);
});

test("设置里那一栏：认不出来的就当没选，显示和实际用的对得上", () => {
  assert.match(scr, /const live = \(list \|\| \[\]\)\.some\(x => x && x\.id === selectedId\) \? selectedId : null;/);
  assert.match(scr, /const on = \(live \|\| null\) === \(p\.id \|\| null\);/);
});

test("那句误导的提示删干净了", () => {
  // 有了兜底之后，它只可能在【一条 API 都没有】时触发——那时该说的是「去配 API」，
  // 不是「去配后台便宜 API」（她照着那句话去配，配了也不解决问题）
  // ⚠️只看真的会说出口的那些（toast 里的），注释里复述病史不算
  const said = [...app.matchAll(/toast\("([^"]*)"/g)].map(m => m[1]);
  assert.ok(!said.some(x => /后台便宜 API|后台 API/.test(x)), "还有地方在让她去配后台 API");
  assert.ok((app.match(/请先到设置配置 API/g) || []).length >= 5);
});
