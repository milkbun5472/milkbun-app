// 角色替她记健康（她 2026-10-05：「跟记账一样触发关键词才记」）
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm"), fs = require("node:fs"), path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
function load() {
  const store = {}, events = [];
  const win = { ScheduleClock: { deviceDayKey: () => "2026-10-05", shiftDayKey: (k, n) => k }, dispatchEvent: e => events.push(e.type), addEventListener() {}, removeEventListener() {} };
  const ctx = { window: win, loadJSON: (k, d) => store[k] ?? d, saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; }, React: { useEffect() {} }, useState: () => [], h: () => null,
    CustomEvent: function (t) { this.type = t; }, console, Date, Math, JSON };
  ctx.globalThis = win; vm.createContext(ctx); vm.runInContext(read("health.js"), ctx);
  return { add: win.healthAddByChar, store, events };
}
test("一句话里几样一起记：一餐、喝水、运动、体重、睡眠、步数、心情各落进同一份 x_health", () => {
  const { add, store, events } = load();
  const r = add("c1", [
    { kind: "meal", meal: "午饭", name: "牛肉面", kcal: 550 }, { kind: "water", cups: 2 }, { kind: "sport", sport: "跑步", min: 30 },
    { kind: "weight", kg: 52.34 }, { kind: "sleep", bed: "23:40", wake: "07:20" }, { kind: "steps", steps: 8000 }]);
  const d = store.x_health;
  assert.equal(r.n, 6);
  assert.equal(d.meals[0].meal, "lunch", "中文的「午饭」要认成 lunch"); assert.equal(d.meals[0].byChar, "c1");
  assert.equal(d.water["2026-10-05"], 2); assert.equal(d.sport[0].min, 30); assert.ok(d.sport[0].kcal > 0, "运动没估热量");
  assert.equal(d.weight[0].kg, 52.3); assert.equal(d.sleep["2026-10-05"].wake, "07:20"); assert.equal(d.steps["2026-10-05"], 8000);
  assert.ok(events.includes("qq-health-updated"), "健康页开着的话要跟着刷新");
});
test("认不出的不猜着记；一条都没记上就返回 null（不出「记好了」的卡）", () => {
  const { add, store } = load();
  assert.equal(add("c1", [{ kind: "meal", name: "", kcal: 300 }, { kind: "water", cups: 99 }, { kind: "weight", kg: 5 }, { kind: "sleep", bed: "晚上", wake: "早上" }, { kind: "?" }]), null);
  assert.equal(store.x_health, undefined);
  const r = add("c1", { kind: "mood", v: 3, date: "2026-10-04" });
  assert.equal(r.sub, "不错"); assert.equal(store.x_health.mood["2026-10-04"].v, 3);
});
test("单聊跟记账同一把闸开 health 字段，落盘出「已记进健康」的卡；侧房不开", () => {
  const app = read("app.js"), comp = read("components.js"), rooms = read("chat-rooms.js");
  assert.match(app, /if \(_askedRecord && typeof window\.healthAddByChar === "function"\) \{\s*openCaps\.push\("health"\)/);
  assert.match(app, /window\.healthAddByChar\(charId, parsed\.health\)/);
  assert.match(app, /what: "health"/);
  assert.match(comp, /isHealth \? "已记进健康"/);
  assert.match(rooms, /"memo", "ledger", "health"\]/);
});
