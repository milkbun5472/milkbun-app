// 聊的是明天的安排，不许改今天此刻（群友 2026-11-04）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("schedNow 标题或理由写着以后的日子就不动今天", () => {
  const m = app.match(/const SCHED_LATER_RE = (\/[^\n]+\/);/); assert.ok(m);
  const re = eval(m[1]);
  assert.ok(re.test("明天早上去图书馆 约好了"));
  assert.ok(re.test("陪她 下周一起去看展"));
  assert.ok(!re.test("留下来陪她吃饭 临时改了"));
  assert.match(app, /if \(SCHED_LATER_RE\.test\(String\(change\.title \|\| ""\) \+ " " \+ String\(change\.reason \|\| ""\)\)\) return;/);
});
test("schedNow 说明里写明：聊的是明天、以后的安排不填", () => {
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.match(eng, /聊的是明天、以后的安排也不填，那不是此刻的事。';/);
});
test("以后的安排：日子照 TA 那只钟换算，那天排过就插进去、没排就先记着，排那天时补上", () => {
  const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  const grab = (src, a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
  const spliceSrc = grab(scr, "function schedSpliceNow", "function schedFillEnds") + grab(scr, "function schedFillEnds", "\n}\n") + "\n}\n";
  const store = {};
  const env = new Function("loadJSON", "saveJSON", spliceSrc + grab(app, "  const schedLaterDay = ", "  const applySchedLater = ") + "return { schedLaterDay, schedPinIn, schedPinsTake };");
  const keyOf = d => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  global.schedParseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  global.schedShiftDayKey = (k, n) => { const d = schedParseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
  global.schedLocalDayKey = () => "2026-11-4";   // 周三
  const f = env(k => store[k], (k, v) => { store[k] = v; });
  assert.equal(f.schedLaterDay({}, "明天"), "2026-11-5");
  assert.equal(f.schedLaterDay({}, "后天晚上"), "2026-11-6");
  assert.equal(f.schedLaterDay({}, "周五"), "2026-11-6");
  assert.equal(f.schedLaterDay({}, "下周一"), "2026-11-9");
  assert.equal(f.schedLaterDay({}, "11月8日"), "2026-11-8");
  assert.equal(f.schedLaterDay({}, "到时候再说"), null);
  const seqs = [{ time: "09:00", end: "12:00", title: "实验室", type: "work" }, { time: "14:00", end: "18:00", title: "上课" }];
  const out = f.schedPinIn(seqs, { time: "10:00", until: "11:30", title: "陪她去图书馆", reason: "说好了" });
  const ins = out.find(x => x.title === "陪她去图书馆");
  assert.ok(ins && ins.deviation.agreed && ins.time === "10:00" && ins.end === "11:30");
  assert.ok(out.some(x => x.title === "上课"), "别的时段不动");
  store.x_schedPins = { c1: { "2026-11-5": [{ time: "19:00", title: "看电影" }] } };
  assert.equal(f.schedPinsTake("c1", "2026-11-5").length, 1);
  assert.deepEqual(store.x_schedPins.c1, {}, "补上就清掉");
  assert.match(eng, /const SCHED_LATER_SPEC = 'schedLater:/);
  assert.match(eng, /schedLater: normSchedLater\(parsed\.schedLater\),/);
  assert.match(app, /applySchedLater\(charId, normSchedLater\(parsed\.schedLater\)\)/);
  assert.match(app, /applySchedLater\(charId, res\.schedLater\)/);
  assert.match(app, /applySchedLater\(spk\.id, normSchedLater\(item\.schedLater\)\)/);
  assert.match(app, /applySchedLater\(a\.senderId, a\.schedLater\)/);
});
