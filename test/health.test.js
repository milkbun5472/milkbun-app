const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(root, f), "utf8");
const src = read("js/health.js"), app = read("js/app.js"), eng = read("js/engine.js"), comp = read("js/components.js");

// 她 2026-10-03：「按你说的先做健康app吧，页面简洁点方便操作但是不要没有设计感光秃秃」
// 存档是健康页自己写的（save → saveJSON("x_health")），桩就用它自己的 save 写进去（stub-from-the-writer.md）
function load() {
  const store = {};
  const window = { ScheduleClock: require("../js/schedule-clock.js") };
  const React = { useState: () => [], useMemo: f => f() };
  new Function("window", "React", "h", "loadJSON", "saveJSON", src)(window, React, () => null,
    (k, d) => (k in store ? JSON.parse(store[k]) : d), (k, v) => { store[k] = JSON.stringify(v); return true; });
  return { H: window.Health, C: window.HealthCtx, store };
}
const at = (hh, mm) => new Date(2026, 9, 3, hh, mm).getTime();

test("没开监督、或者没点他的名：一个字都不给", () => {
  const { H, C } = load();
  const d = H.load(); d.watch = { on: false, ids: ["c1"], nudge: true }; H.save(d);
  assert.equal(C.noteFor("c1", at(12, 0)), "");
  d.watch.on = true; H.save(d);
  assert.equal(C.noteFor("c2", at(12, 0)), "", "没点名的人看不见");
  assert.ok(C.noteFor("c1", at(12, 0)).length > 0, "点了名、在饭点：有一行");
});

test("按需：不在饭点、两小时内也没记过 → 空字符串；刚记过一餐 → 有", () => {
  const { H, C } = load();
  const d = H.load(); d.watch = { on: true, ids: ["c1"], nudge: false };
  assert.equal((H.save(d), C.noteFor("c1", at(15, 30))), "");
  d.meals.push({ id: "m1", day: "2026-10-03", meal: "snack", name: "苹果", kcal: 95, qty: 1, ts: at(14, 50) });
  H.save(d);
  const line = C.noteFor("c1", at(15, 30));
  assert.match(line, /95 千卡/);
  assert.match(line, /苹果/);
  assert.doesNotMatch(line, /不许|禁止|必须/, "只给事实和一个出口，不挂禁令");
});

test("主动来问：午饭没记才问、同一顿只问一次、一天最多两次、记了就不问", () => {
  const { H, C } = load();
  const d = H.load(); d.watch = { on: true, ids: ["c1"], nudge: true }; H.save(d);
  assert.equal(C.nudgeDue(at(8, 0)), null, "早饭不来问");
  const n = C.nudgeDue(at(12, 0));
  assert.equal(n.meal, "lunch"); assert.deepEqual(n.ids, ["c1"]);
  C.markNudged(n.day, n.meal);
  assert.equal(C.nudgeDue(at(12, 30)), null, "这一顿问过了");
  d.meals.push({ id: "m2", day: "2026-10-03", meal: "dinner", name: "米饭", kcal: 230, qty: 1, ts: at(17, 10) });
  H.save(d);
  assert.equal(C.nudgeDue(at(18, 0)), null, "晚饭已经记了");
  d.watch.nudge = false; d.meals = []; H.save(d);
  assert.equal(C.nudgeDue(at(18, 0)), null, "开关关着");
});

test("一天的合计按份数乘；一周七天从今天往回数", () => {
  const { H } = load();
  const d = H.load();
  d.meals = [{ day: "2026-10-03", meal: "lunch", name: "米饭", kcal: 230, p: 4, c: 51, f: 0.5, qty: 1.5 },
    { day: "2026-10-02", meal: "lunch", name: "苹果", kcal: 95, qty: 1 }];
  d.water["2026-10-03"] = 3;
  const t = H.dayTotals(d, "2026-10-03");
  assert.equal(t.kcal, 345); assert.equal(t.water, 3); assert.equal(t.n, 1);
  const w = H.weekOf(d, "2026-10-03");
  assert.equal(w.length, 7); assert.equal(w[0].day, "2026-09-27"); assert.equal(w[5].kcal, 95);
});

test("让模型估：料全在 system、user 只留一句；给足 65535；没估出来带上原文", () => {
  assert.match(src, /callAI\(api, sys, \[\{ role: "user", content: "开始。" \}\], \{ maxTokens: 65535, tag: "health" \}\)/);
  assert.match(src, /没估出来。模型回的是：\\n" \+ String\(raw \|\| ""\)\.slice\(0, 320\)/);
  assert.match(src, /runProbe\(p, ctx, \{ voice: true, maxTokens: 65535, tag: "health",/);
  assert.match(src, /probeVoiceTail\(\)/, "让 TA 看看那一枪也补上那三层");
});

test("那三层收成公共的一份，星测和塔罗都搬过去了", () => {
  assert.match(eng, /function probeVoiceTail\(\) \{/);
  for (const f of ["js/astro.js", "js/tarot.js"]) {
    const s = read(f);
    assert.match(s, /const voiceTail = \(\) => \(typeof probeVoiceTail === "function" \? probeVoiceTail\(\) : ""\);/, f);
    assert.doesNotMatch(s, /ECHO_QUESTION_BAN/, f + " 不许再自己抄一份");
  }
});

test("经期判断收成 periodPhaseNow 一处：聊天那条和健康页都用它", () => {
  assert.match(comp, /function periodPhaseNow\(period, now\) \{/);
  const i = app.indexOf("    periodNote: (() => {"), j = app.indexOf("healthNote:", i);
  assert.ok(i > 0 && j > i, "抠不出 periodNote");
  assert.match(app.slice(i, j), /const ph = periodPhaseNow\(period\);/);
  assert.doesNotMatch(app.slice(i, j), /dic < pLen/, "旧的那份算法不许留在原地");
  assert.match(src, /periodPhaseNow\(props\.period\)/);
  assert.match(app, /onRecordPeriod: recordPeriodStart,/, "健康页点「今天来了」走月事本同一个入口");
});

test("监督那一行接进上下文：ctxFor、buildBundle、隔离房、精简写作都认", () => {
  assert.match(app, /healthNote: window\.HealthCtx \? window\.HealthCtx\.noteFor\(char\.id\) : "",/);
  assert.match(eng, /if \(ctx\.healthNote && ctx\.healthNote\.trim\(\)\) parts\.push\(/);
  assert.match(eng, /periodNote: "", healthNote: ""/);
  assert.match(read("js/chat-rooms.js"), /"healthNote",/);
});

test("饭点来问接进主动那一路，出口单独记账", () => {
  assert.match(app, /const hn = window\.HealthCtx && window\.HealthCtx\.nudgeDue\(\);/);
  assert.match(app, /replyNow\(cand\.id, "", null, \{ proactive: true, health: \{ meal: hn\.label, line: hn\.line \} \}\)/);
  assert.match(app, /\(\) => window\.HealthCtx\.markNudged\(hn\.day, hn\.meal\)/);
  assert.match(app, /opts\.remind \? remindHint : opts\.health \? healthHint :/);
  assert.match(app, /opts\.health \? "health_meal" :/);
});

test("注册齐：REG、每日看、老用户搬一次、色相、名字、说明书、脚本、路由、挂点", () => {
  assert.match(comp, /health: \{ kind: "app", zh: "健康", G: window\.GHealth \|\| GTarot \},/);
  assert.match(comp, /f_def_daily: \{ name: "每日看", keys: \[[^\]]*"health"\] \}/);
  assert.match(comp, /st = placeNewAppOnce\(st, "health", "astro", "x_healthPlaced"\);/);
  assert.match(read("js/core.js"), /health: 108,/);
  assert.match(read("js/core.js"), /health: "健康",/);
  assert.match(read("js/assistant.js"), /health: "health",/);
  assert.match(read("js/assistant-manual.js"), /\{ id: "health", app: "health", zh: "健康",/);
  assert.match(read("index.html"), /<script src="js\/health\.js\?v=[\d.]+"><\/script>/);
  assert.match(app, /screen === "health"\) body = h\(window\.HealthApp, \{/);
  const ts = read("js/theme-studio.js");
  for (const k of src.match(/"data-wk": "(health\w*)"|wk: "(health\w*)"|wk \|\| "(health\w*)"/g).map(s => s.match(/health\w*/)[0]))
    assert.ok(ts.includes('["' + k + '"'), "挂点没进主题台名单：" + k);
});

test("界面：整页、紧凑顶栏透明、底纹铺外壳、tab 不是药丸、标题没有英文", () => {
  assert.doesNotMatch(src, /h\(Sheet,/, "默认不要半窗");
  assert.match(src, /h\(Head, \{ zh: "健康", onBack: props\.onBack, ink: S\.ink, bg: "transparent", noLine: true,/);
  assert.match(src, /"data-wk": "app", className: "h-full flex flex-col", style: \{ background: S\.bg, backgroundImage: GRID/);
  assert.match(src, /function PulseTabs\(/);
  assert.doesNotMatch(src, /#fff\b/, "深色主题里不许写死白");
});

test("运动和睡眠：消耗按体重估、跨午夜算睡眠、合进一天的账", () => {
  const { H } = load();
  assert.equal(H.burnOf(8, 30, 60), 240);
  assert.equal(H.sleepMin({ bed: "23:50", wake: "07:30" }), 460);
  assert.equal(H.sleepMin({ bed: "01:10" }), 0, "只填一头不算");
  const d = H.load();
  d.sport = [{ id: "s", day: "2026-10-03", kind: "快走", min: 40, kcal: 165 }];
  d.sleep = { "2026-10-03": { bed: "23:00", wake: "07:00" } };
  const t = H.dayTotals(d, "2026-10-03");
  assert.equal(t.sportMin, 40); assert.equal(t.burn, 165); assert.equal(t.sleep, 480);
});

test("框撤掉了：按钮和输入框不画边", () => {
  assert.doesNotMatch(src, /1px solid/);
  assert.match(src, /const inputS = S => \(\{[^}]*border: "none", borderBottom:/);
});

test("快捷指令那段字：认标题、认单位、认日期，没标题就不认", () => {
  const { H } = load();
  assert.equal(H.parseShortcut("步数：8000", "2026-10-03"), null, "没有「秋秋健康」那一行");
  const r = H.parseShortcut("秋秋健康\n日期：2026年10月2日\n步数：8,203\n睡眠：7.5\n活动能量：432 千卡\n体重：\n喝水：1.5 升", "2026-10-03");
  assert.equal(r.day, "2026-10-02"); assert.equal(r.steps, 8203); assert.equal(r.sleepMin, 450); assert.equal(r.kcal, 432);
  assert.equal(r.kg, undefined, "空着的不算"); assert.equal(r.waterMl, 1500);
  assert.equal(H.parseShortcut("秋秋健康\n睡眠：27000", "2026-10-03").sleepMin, 450, "秒");
  assert.equal(H.parseShortcut("秋秋健康\n睡眠：450 分钟", "2026-10-03").sleepMin, 450);
  assert.equal(H.parseShortcut("秋秋健康\n日期：\n步数：10", "2026-10-03").day, "2026-10-03", "日期空着算今天");
});

test("导进来：再导一次换掉手机那份，自己手记的不动", () => {
  const { H } = load();
  let d = H.load();
  d.sport = [{ id: "s1", day: "2026-10-03", kind: "瑜伽", min: 20, kcal: 50 }];
  d.water = { "2026-10-03": 7 };
  d = H.applyShortcut(d, { day: "2026-10-03", steps: 5000, kcal: 200, min: 15, waterMl: 1000, sleepMin: 400 });
  d = H.applyShortcut(d, { day: "2026-10-03", steps: 9000, kcal: 300, min: 30 });
  const t = H.dayTotals(d, "2026-10-03");
  assert.equal(t.steps, 9000); assert.equal(t.sportMin, 50); assert.equal(t.burn, 350);
  assert.equal(t.water, 7, "她自己点的七杯不被四杯盖掉"); assert.equal(t.sleep, 400);
  assert.ok(d.hkAt > 0);
});

test("导入不走服务器：只读剪贴板、读不到就去贴的那页", () => {
  assert.match(src, /navigator\.clipboard\.readText\(\)/);
  assert.equal((src.match(/fetch\(/g) || []).length, 1, "只有一处：去她自己填的网关拿");
  assert.match(src, /const res = await fetch\(gw\.url, /);
  assert.match(src, /if \(page && page\.kind === "import"\) return h\(ImportPage,/);
});

test("位置天气电量：只说在不在家，不给坐标；另开开关；三小时后就不算此刻", () => {
  const { H, C } = load();
  let d = H.load();
  d = H.applyShortcut(d, H.parseShortcut("秋秋健康\n纬度：31.2300\n经度：121.4737\n天气：小雨\n气温：18\n电量：0.15", "2026-10-03"));
  assert.equal(d.env.battery, 15, "快捷指令给 0.15 也认成 15%");
  d.home = { lat: 31.2, lon: 121.47 };
  d.watch = { on: true, ids: ["c1"], nudge: true, env: false };
  H.save(d);
  assert.match(C.whereText(d), /^不在家（离家约 3\.\d 公里）$/);
  const now = d.env.ts + 60000;
  const off = new Date(2026, 9, 3, 15, 30).getTime();
  d.env.ts = off - 60000; H.save(d);
  assert.equal(C.noteFor("c1", off), "", "这个开关关着：饭点外一个字不给");
  d.env.ts = now - 60000;
  d.watch.env = true; H.save(d);
  const line = C.envLine(d, now);
  assert.match(line, /不在家/); assert.match(line, /小雨 18°/); assert.match(line, /电量 15%/);
  assert.doesNotMatch(line, /31\.2|121\.4/, "坐标原数不进提示词");
  assert.equal(C.envLine(d, d.env.ts + 4 * 3600000), "", "过了三小时不算此刻");
});

test("会来问：电量低、下雨在外面各一天一次，饭点照旧", () => {
  const { H, C } = load();
  const base = new Date(2026, 9, 3, 15, 0).getTime();
  const d = H.load();
  d.watch = { on: true, ids: ["c1"], nudge: true, env: true };
  d.home = { lat: 31.2, lon: 121.47 };
  d.env = { ts: base, lat: 31.23, lon: 121.47, weather: "小雨", battery: 12 };
  H.save(d);
  const a = C.nudgeDue(base + 60000); assert.equal(a.meal, "battery");
  C.markNudged(a.day, a.meal);
  const b = C.nudgeDue(base + 60000); assert.equal(b.meal, "rain");
  C.markNudged(b.day, b.meal);
  assert.equal(C.nudgeDue(base + 60000), null);
  d.watch.env = false; d.env.ts = base; H.save(d);
});

test("网关：认那几行字，也认同样字段的 JSON", () => {
  const { C } = load();
  assert.match(C.gatewayText('{"steps":8000,"battery":40,"weather":"晴"}'), /^秋秋健康\n步数：8000\n电量：40\n天气：晴$/);
  assert.match(C.gatewayText('{"data":{"text":"步数：10"}}'), /^秋秋健康\n步数：10$/);
  assert.equal(C.gatewayText("<html>"), "");
});
