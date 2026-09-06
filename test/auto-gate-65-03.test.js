// v65.03：她 2026-09-06 报「api 站子 24 小时能用 8 块钱，每次调用只有 1 分钱，
// 我昨天都在修 bug，绝对没调用 800 次」。她的站子确实是【按次】收费的，所以 8 块 = 800 次。
//
// 实测出来就是那个量级：**自动补刷失败之后没留下任何痕迹，于是每刷新一次就把所有角色
// 重打一遍**。三个角色、什么都不点、连刷四次 → 3→6→9→12 枪。
//
// 她当轮定的规矩：**这种形状一律先开公共的、已有的也搬过来，不许照着已有的再新开一个**。
// 所以这一版立了 AutoGate（闸）+ ApiMeter（记账），六条链全搬进去——
// 包括查手机和日程那两份【本来就写对了的】手写闸：留着它们就等于同一层规则活在三处。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), engine = R("engine.js"), screens = R("screens.js"), gateSrc = R("auto-gate.js");

// 真跑一遍，不是只看长相
function fresh() {
  const store = {};
  const win = { localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    AutoRefreshPolicy: { FEATURES: [{ id: "diary", title: "日记" }, { id: "phone", title: "查手机" }] } };
  const mod = { exports: {} };
  new Function("window", "globalThis", "module", gateSrc)(win, win, mod);
  return { AutoGate: win.AutoGate, ApiMeter: win.ApiMeter, store };
}

test("闸：这一轮成过就不再跑，没成也留痕迹、隔两小时才重试、最多三次", async () => {
  const { AutoGate } = fresh();
  const K = "diary|c1", P = "2026-09-06";
  assert.equal(AutoGate.due(K, P), true, "头一回该跑");
  assert.equal(await AutoGate.run(K, P, async () => false), "fail");
  // ⚠️这一条就是那 800 次调用的病根：失败之后【立刻还能再跑】的话，刷新一次就重来一遍
  assert.equal(AutoGate.due(K, P), false, "失败之后没被冷却拦住——刷新一次就会重打一遍");
  assert.equal(AutoGate.rowOf(K).tries, 1, "没记下试过一次");
  AutoGate.mark(K, P, false); AutoGate.mark(K, P, false);
  assert.equal(AutoGate.rowOf(K).tries, 3);
  assert.equal(AutoGate.due(K, P, { cooldownMs: 0 }), false, "试满三次之后还在试");
  assert.equal(AutoGate.due(K, "2026-09-07"), true, "换一天该重新开始");
  assert.equal(await AutoGate.run(K, "2026-09-07", async () => true), "ok");
  assert.equal(AutoGate.due(K, "2026-09-07"), false, "成了之后还在跑");
  assert.equal(await AutoGate.run(K, "2026-09-07", async () => true), "skip", "成了之后 run 该直接跳过");
  AutoGate.clear(K);
  assert.equal(AutoGate.due(K, "2026-09-07"), true, "她手动重刷时闸不该拦着");
});

test("闸：抛异常跟返回 false 一样算没成——两种都要留痕迹", async () => {
  const { AutoGate } = fresh();
  assert.equal(await AutoGate.run("wallet|c1", "d", async () => { throw new Error("上游炸了"); }), "fail");
  assert.equal(AutoGate.due("wallet|c1", "d"), false, "抛异常那次没留下痕迹");
});

test("闸：一次十几枪的那种先占坑，中途关掉浏览器也不整份重跑", async () => {
  const { AutoGate } = fresh();
  AutoGate.claim("phone|c1", "2026-W36");
  assert.equal(AutoGate.due("phone|c1", "2026-W36", { maxTries: 1 }), false, "占了坑还会再跑一遍");
  assert.equal(AutoGate.due("phone|c1", "2026-W37", { maxTries: 1 }), true, "换一周该重新来");
});

test("记账：数得准，而且两件活儿同时开着时不许张冠李戴", async () => {
  const { AutoGate, ApiMeter } = fresh();
  await AutoGate.run("diary|c1", "d", async () => { ApiMeter.note(); return true; });
  await AutoGate.tagged("查手机", async () => { ApiMeter.note(); ApiMeter.note(); });
  await Promise.all([
    AutoGate.tagged("甲", async () => { await new Promise(r => setTimeout(r, 8)); ApiMeter.note(); }),
    AutoGate.tagged("乙", async () => { await new Promise(r => setTimeout(r, 12)); })
  ]);
  ApiMeter.note("聊天");
  const d = ApiMeter.today();
  assert.equal(d.n, 5, "总数不对");
  assert.deepEqual(d.by, { "日记": 1, "查手机": 2, "其它": 1, "聊天": 1 },
    "同时开着两件活儿的时候把那一枪算给了其中一件——宁可记成「其它」也不许猜");
  // 名字不另立一份：直接问那十二项自动刷新自己的标题
  assert.equal(AutoGate.labelOf("diary|c1"), "日记");
});

test("记账数在【发出去】那一刻，不是进 callAI 那一刻", () => {
  // ⚠️没填密钥、地址填错这些压根没发出去，中转站不收钱；数进来就成了比账单还大的假数。
  const i = engine.indexOf("async function callAI(");
  const seg = engine.slice(i, engine.indexOf("\n  if (fmt === \"anthropic\")", i));
  const guard = seg.indexOf('if (!p.apiKey && !p.proxyRef) throw');
  const note = seg.indexOf("window.ApiMeter.note(opts.tag)");
  assert.ok(guard > 0 && note > 0, "记账那一行不见了");
  assert.ok(note > guard, "记账排在「没填密钥就抛」前面了——会数出比账单还大的数");
  assert.ok(note > seg.indexOf('!/^https?:\\/\\/\\S+$/i.test(base)'), "记账排在 baseUrl 那道检查前面了");
  // runProbe 把 tag 带下去（它自己还会重试一次，那一次也要算）
  assert.match(engine, /const _tag = probe\.tag \|\| "";/);
  assert.equal((engine.match(/tag: _tag/g) || []).length, 3, "runProbe 三处调用没都带上 tag");
});

test("六条链逐个点名走公共闸（少一处才红）", () => {
  const want = [
    ['window.AutoGate.run("diary|" + c.id, dayKey', "日记"],
    ['window.AutoGate.run("wallet|" + char.id, dk', "钱包补账"],
    ['window.AutoGate.due("impression|" + char.id, monthKey)', "月度印象·闸"],
    ['window.AutoGate.mark("impression|" + char.id, monthKey, _impOk)', "月度印象·记账"],
    ['window.AutoGate.run("desire|" + c.id, today', "心上"],
    ['window.AutoGate.due("schedule|" + c.id, weekKey)', "角色日程·闸"],
    ['window.AutoGate.run("schedule|" + j.c.id, j.weekKey', "角色日程·跑"],
    ['window.AutoGate.mark("schedule|" + c.id, schedMondayOf(today), ok)', "角色日程·她手动重排那一下"],
    ['window.AutoGate.due("phone|" + c.id, wk, { maxTries: 1 })', "查手机·闸"],
    ['window.AutoGate.claim("phone|" + due.id, wk)', "查手机·先占坑"]
  ];
  const miss = want.filter(([n]) => !app.includes(n)).map(([, w]) => w);
  assert.deepEqual(miss, [], "这几条掉队了：\n" + miss.join("\n"));
  // 判据是【真落盘了吗】，不是【没报错】——genDiary 不抛异常不等于日记写下来了
  assert.match(app, /await genDiary\(c\.id, \{ manual: false \}\);\s*\n\s*return diaryWroteFor\(c\.id, targetTs\);/,
    "日记那一条又变成「没报错就算成」了");
  assert.match(app, /return !!\(now2 && now2\.lastDailyKey >= dk\);/, "钱包那一条没核对真补上了没有");
});

test("原来那两份手写闸删干净了，不是留在原地", () => {
  // 「撤掉东西要删除，而不是在它后面说 xxx 是错的」
  assert.ok(!/SCHED_WEEK_MARK_KEY|SCHED_WEEK_RETRY_MS|SCHED_WEEK_MAX_TRIES/.test(app), "日程那份手写闸还留着");
  assert.ok(!/x_schedWeekMark/.test(app), "旧存档键还在被写");
  const i = app.indexOf("const phoneWeeklySweep");
  const seg = app.slice(i, app.indexOf("\n  };", app.indexOf("phoneWeekRunRef.current = false", i)));
  assert.ok(!/\(box\.done \|\| \{\}\)\[c\.id\] !== wk/.test(seg), "查手机那份 done 游标还在当闸用");
});

test("设置里那张卡：她能自己看今天打了几枪", () => {
  assert.match(screens, /function ApiMeterCard\(/, "卡不见了");
  assert.match(screens, /h\(ApiMeterCard, \{ toast: props\.toast \}\)/, "卡没挂进「谁会自己动」那一页");
  const i = screens.indexOf("function ApiMeterCard(");
  const seg = screens.slice(i, screens.indexOf("\n}\n", i));
  assert.match(seg, /"今天往上游打了几枪"/);
  assert.match(seg, /数的是发出去的次数——失败和重试那几次也算，因为账单上也算。/, "没说清数的是什么");
  assert.match(seg, /window\.ApiMeter\.recent\(7\)/, "看不了前几天");
});
