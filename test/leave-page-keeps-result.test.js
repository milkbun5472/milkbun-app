// 她 2026-10-01：「app 里所有这种生成回复的时候都要可以退出到 app 里别的功能，而不是得卡在这个界面等」
// 全 app 查下来两类：① 存档写在 setState 的 updater 里（页面关了 React 不跑它）；
//                    ② 结果只放在这一页自己的 state 里（走开就没地方放）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

test("后台生成：跑完的结果只交一次；还在跑的不交；走开时跑完的，下回进来照样交", async () => {
  delete require.cache[require.resolve("../js/background-generation.js")];
  const BG = require("../js/background-generation.js");
  let release; const gate = new Promise(r => { release = r; });
  const p = BG.start("t:1", { label: "x" }, async () => { await gate; return 42; });
  assert.equal(BG.take("t:1"), null, "还在跑就交出去了");
  release(); await p;
  assert.deepEqual(BG.take("t:1"), { status: "done", result: 42, error: null });
  assert.equal(BG.take("t:1"), null, "同一个结果交了两次");
  const q = BG.start("t:2", {}, async () => { throw new Error("坏了"); }); await q.catch(() => {});
  assert.equal(BG.take("t:2").error, "坏了");
  assert.equal(typeof BG.useTask, "function");
});

test("① 存档不再写在 setState 的 updater 里：现读存档、改完直接写回", () => {
  const th = R("theater.js"), tr = R("trpg.js"), imp = R("impression.js"), cap = R("capsule.js"), memo = R("memo.js");
  assert.match(th, /const update = fn => \{\n\s*const n = fn\(load\(\)\.slice\(\)\);\n\s*if \(!persist\(n\)\)/);
  assert.match(tr, /const update = fn => \{\n\s*const n = fn\(load\(\)\.slice\(\)\);\n\s*if \(!persist\(n\)\) return;/);
  assert.match(imp, /const put = fn => \{\n\s*const n = fn\(M\.load\(\) \|\| bookRef\.current\);\n\s*if \(!M\.save\(n\)\)/);
  assert.match(cap, /const updateAll = updater => \{\n\s*const next = typeof updater === "function" \? updater\(load\(\)\) : updater;\n\s*if \(!save\(next\)\)/);
  assert.match(memo, /const persist = updater => \{ const n = typeof updater === "function" \? updater\(loadData\(\)\) : updater; saveData\(n\); setData\(n\); \};/);
});

test("② 结果只在页面里的那几处，都交给后台生成跑、页面挂 useTask 接", () => {
  const cases = [
    ["read.js", "read:explain:", "BG.start(explainKey"],
    ["study.js", "study:drillword:", "BG.start(drillWordKey"],
    ["study.js", "study:unittest:", "BG.start(testKey"],
    ["study.js", "study:outline:", "BG.start(outlineKey"],
    ["fanfic.js", "fanfic:styleLabAB", "LAB_BG.start(LAB_KEY"],
    ["theater.js", "theater:draft", "DRAFT_BG.start(DRAFT_KEY"],
    ["trpg.js", "trpg:draft", "DRAFT_BG.start(DRAFT_KEY"]
  ];
  cases.forEach(([f, key, start]) => {
    const src = R(f);
    assert.ok(src.includes(key), f + " 没有 " + key);
    assert.ok(src.includes(start), f + " 没交给后台生成跑：" + start);
    assert.ok(/\.useTask\(/.test(src), f + " 页面没挂 useTask，走开回来接不住");
  });
  assert.equal((R("theater.js").match(/DRAFT_BG\.start\(DRAFT_KEY/g) || []).length, 2, "小剧场两种开局都要走");
  assert.equal((R("trpg.js").match(/DRAFT_BG\.start\(DRAFT_KEY/g) || []).length, 2, "跑团两种开团都要走");
});

test("庭院：这一季的安排还在路上就离开，那条 pending 当场标成没排完，回来可以直接重试", () => {
  const fg = R("fairy-garden.js");
  assert.match(fg, /planInFlight\.current=\{key,request\};/);
  assert.match(fg, /d\.plans\[f\.key\]\.request === f\.request\)\n\s*write\(storeKey\.current, \{ \.\.\.d, plans: \{ \.\.\.d\.plans, \[f\.key\]: \{ status: "failed"/);
});
