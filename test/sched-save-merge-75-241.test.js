// 群友 2026-10-09：排好的一整周突然只剩今天（「问题是为什么会突然空」）。
//   saveSchedDay 存的是「内存里整本 + 这一天」——内存那本那一刻要是空的或旧的，
//   一写就把存档里别的日子全盖没。改成先合存档再写：最坏多写一天，不再抹掉别的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");

function load(disk) {
  const i = app.indexOf("  const saveSchedDay = "), j = app.indexOf("\n  });", i);
  assert.ok(i > 0 && j > i, "抠不出 saveSchedDay");
  const store = { x_schedules: disk };
  let state = {};
  const box = {
    loadJSON: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    saveJSON: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); return true; },
    setSchedules: fn => { state = fn(state); },
    schedulesRef: { current: {} }
  };
  const fn = new Function(...Object.keys(box), app.slice(i, j + 6) + "\nreturn saveSchedDay;")(...Object.values(box));
  return { fn, store };
}

test("内存里那本是空的时候存今天，存档里别的日子还在", () => {
  // 桩照写入方 saveSchedDay 的形状：x_schedules[charId][dayKey] = { load, seqs, ... }
  const disk = { c1: { "2026-10-10": { load: "NORMAL", seqs: [{ seq: 1, title: "明天" }] }, "2026-10-11": { load: "NORMAL", seqs: [{ seq: 1, title: "后天" }] } },
                 c2: { "2026-10-09": { load: "NORMAL", seqs: [{ seq: 1, title: "别人的" }] } } };
  const { fn, store } = load(disk);
  fn("c1", "2026-10-09", { load: "NORMAL", seqs: [{ seq: 1, title: "今天" }] });
  assert.deepEqual(Object.keys(store.x_schedules.c1).sort(), ["2026-10-09", "2026-10-10", "2026-10-11"], "以后那几天被盖掉了");
  assert.ok(store.x_schedules.c2, "别的角色的日程被盖掉了");
});

test("同一天以这次写的为准", () => {
  const { fn, store } = load({ c1: { "2026-10-09": { load: "NORMAL", seqs: [{ seq: 1, title: "旧的" }] } } });
  fn("c1", "2026-10-09", { load: "NORMAL", seqs: [{ seq: 1, title: "新的" }] });
  assert.equal(store.x_schedules.c1["2026-10-09"].seqs[0].title, "新的");
});
