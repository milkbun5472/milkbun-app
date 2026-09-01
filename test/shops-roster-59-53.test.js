const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/phone.js");
const NOW = Date.now();

// 她 2026-09-01 同意：常去的店也该是「慢慢改」的那一类。
// 原来挂在纯累积层：模型每轮凭空写四五家新店，一路攒到十八家——
// 那不是「他常去的店」，那是「他去过的所有店」；而且他真不去了的那几家永远退不出。
test("常去的店走名册，不是日志", () => {
  ["shopping", "takeout"].forEach(app => {
    assert.equal((P.PHONE_RETIRE[app] || {}).shops, "常去的店", app + " 的店没登记成名册");
    assert.ok((P.PHONE_GROW[app] || {}).shops <= 10, app + " 的店还能攒到十几家");
  });
  // 名册那几栏必须【只】收到「照抄回来」这一句，不能同时收到「别再写一遍」
  const known = { shops: [{ name: "旧书铺" }, { name: "楼下那家" }], orders: [{ shop: "旧书铺", main: "牛肉面" }] };
  const ins = P.phoneProbeSpec("takeout", { id: "c1", name: "沈屿白", persona: "男" }, [], "", [], known).instruction;
  assert.match(ins, /常去的店（shops）：旧书铺｜楼下那家/, "现有的店没发回去，模型只能另编一份");
  const avoid = ins.slice(ins.indexOf("【这个 app 里已经攒着这些了，不要再写一遍】"));
  assert.ok(avoid.indexOf("shops：") < 0, "同一栏又收到了「别再写一遍」——两句相反的话，模型必然写歪");
  // 不去了的那家要能退出
  assert.match(ins, /已经不去了的那家店/, "没告诉它店也能退出名单");
});

test("照抄回来的不重复攒，写进 retired 的真会消失", () => {
  const old = { shops: [{ name: "旧书铺", why: "掌柜会留书" }, { name: "楼下那家", why: "快" }] };
  // 照抄回来 → 还是两家，不变四家
  const same = P.phoneGrowMerge("takeout", old, { shops: [{ name: "旧书铺", why: "掌柜会留书" }, { name: "楼下那家", why: "快" }] }, NOW);
  assert.deepEqual(same.shops.map(x => x.name), ["旧书铺", "楼下那家"], "照抄回来却攒成了四家");
  // 新开一家 → 三家
  const grew = P.phoneGrowMerge("takeout", old, { shops: [{ name: "旧书铺" }, { name: "楼下那家" }, { name: "新发现的那家" }] }, NOW);
  assert.equal(grew.shops.length, 3, "真新增的那家没进来");
  // 不去了的写进 retired → 真的消失
  const gone = P.phoneGrowMerge("takeout", old, { shops: [{ name: "旧书铺" }], retired: { shops: ["楼下那家"] } }, NOW);
  assert.deepEqual(gone.shops.map(x => x.name), ["旧书铺"], "写进 retired 了却还留着");
  // ⚠️只是没写不算删掉——累积层里「没写」等于「还在」
  const silent = P.phoneGrowMerge("takeout", old, { shops: [{ name: "旧书铺" }] }, NOW);
  assert.equal(silent.shops.length, 2, "模型漏写一家就把它删了——那是累积层最不该有的事");
});
