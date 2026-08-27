const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scan = (() => {
  const i = app.indexOf("const scanAutoGroups = () => {");
  assert.ok(i > 0, "群自发巡检没了");
  return app.slice(i, app.indexOf("\n    };", i));
})();

// 她 2026-08-27：「群自发聊天他们主动发了一轮就不继续了，都没到设定的最大轮数或者次数」
// 病因是【每一轮】都要求有人此刻正想找她。认领动念的同时会给本人记 25 分钟冷却、
// 还泄掉 0.28 的 connection；自发间隔默认才 8 分钟——第二轮永远等不到人。

// —— 把真的那段巡检抠出来跑，别拿模型推理代替测量 ——
// 环境全是桩：群、设置、成员、额度卡、replyGroup 只记账不发请求。
function drive({ minutes, rounds, maxMsg, perRound = 5, jiwen = false, rand = 0.5, hours = 2 }) {
  const src = (() => {
    const i = app.indexOf("const scanAutoGroups = () => {");
    return app.slice(i, app.indexOf("\n    };", i) + 6);
  })();
  const G = "g1";
  const T0 = Date.UTC(2026, 7, 27, 2, 0, 0);   // 真实时间轴，别从 0 起（会假装每个人的认领冷却都没过）
  let NOW = T0;
  const store = {}, calls = [];
  const gs = { memoryInterop: true, autoChat: true, autoChatMin: minutes, autoChatRounds: rounds, autoChatMaxMsg: maxMsg, autoChatResetHours: 24 };
  const chat = [{ role: "user", ts: T0 }];      // 她先说了一句 → 开一张新额度卡
  const env = {
    groups: [{ id: G, memberIds: ["c1", "c2"] }],
    characters: [{ id: "c1", name: "顾朝" }, { id: "c2", name: "顾暮" }],
    gsFor: () => gs,
    laneBusy: () => false,
    offlineGroup: null,
    contextAllowsMessage: () => true,
    groupChatsRef: { current: { [G]: chat } },
    jiwenFiredRef: { current: {} },
    getJiwen: () => ({ applyDelta() {} }),
    autoChatCycleRef: { current: store },
    autoChatRoundsRef: { current: {} },
    autoChatMsgsRef: { current: {} },
    writeAutoChatCycle: (gid, c) => (store[gid] = c),
    resetAutoChatCycle: (gid, ts) => (store[gid] = { rounds: 0, msgs: 0, cappedAt: 0, resetAt: 0, lastUserTs: Number(ts) || 0 }),
    replyGroup: (gid, o) => calls.push({ at: NOW, ...o }),
    Math: Object.assign(Object.create(Math), { random: () => rand }),
    Date: { now: () => NOW },
    window: { __jiwen: jiwen ? { c1: { triggers: [{ action: "contact" }] }, c2: { triggers: [] } } : {} }
  };
  const scan = new Function(...Object.keys(env), src + "\nreturn scanAutoGroups;")(...Object.values(env));
  for (let t = 0; t < hours * 3600000; t += 20000) {
    NOW = T0 + t;
    const before = calls.length;
    scan();
    if (calls.length > before) {                 // 这一轮真的发了几条，额度卡照实扣
      for (let k = 0; k < perRound; k++) chat.push({ role: "assistant", ts: NOW + k * 700 });
      NOW += perRound * 700;
      const old = store[G] || {};
      store[G] = { ...old, msgs: (old.msgs || 0) + perRound };
    }
  }
  return calls.map(c => ({ minute: (c.at - T0) / 60000, budget: c.msgBudget }));
}

test("拿她的设置真跑一遍：5 轮一轮不少", () => {
  const got = drive({ minutes: 3, rounds: 5, maxMsg: 50 });
  assert.equal(got.length, 5, "轮数上限 5，实际只发了 " + got.length + " 轮");
  assert.deepEqual(got.map(x => x.budget), [50, 45, 40, 35, 30], "剩余条数预算要一轮轮递减");
});

test("有 jiwen 的群也一样跑满——动念只管起聊那一下", () => {
  assert.equal(drive({ minutes: 3, rounds: 5, maxMsg: 50, jiwen: true }).length, 5);
});

test("总条数上限先到就先停", () => {
  const got = drive({ minutes: 3, rounds: 20, maxMsg: 20, perRound: 5 });
  assert.equal(got.length, 4, "20 条 ÷ 每轮 5 条 = 4 轮");
});

// 她掐着表：「过了三分钟没有」。以前抖动是 1~1.5×，设 3 分钟实际 3~4.5、平均 3.75，
// 每一次都比她看到的数字晚。现在绕着那个数走，她设的数字是平均值。
test("设 3 分钟就该是 3 分钟上下，不是一律往后拖", () => {
  const early = drive({ minutes: 3, rounds: 5, maxMsg: 50, rand: 0 });   // 抖动最快那一头
  const late = drive({ minutes: 3, rounds: 5, maxMsg: 50, rand: 0.999 }); // 最慢那一头
  const step = a => a[1].minute - a[0].minute;
  assert.ok(step(early) < 3, "最快那一头该比 3 分钟早，实际 " + step(early));
  assert.ok(step(late) < 4, "最慢那一头也不该超过 4 分钟，实际 " + step(late));
});

test("动念只管起聊那一下，后面几轮不再要新的思念", () => {
  const i = scan.indexOf("let urgeChars = [];");
  assert.ok(i > 0, "urgeChars 的声明变了");
  const gate = scan.indexOf("if (rounds === 0) {", i);
  assert.ok(gate > i, "没有把动念这道门收进【第一轮】里");
  const seg = scan.slice(gate, gate + 1100);
  assert.match(seg, /if \(anyJiwen && !urgeChars\.length\) continue;/, "起聊仍要有人真想找她");
  assert.match(seg, /jiwenFiredRef\.current\[c\.id\] = now;/, "认领冷却要留在门里面");
  assert.match(seg, /applyDelta\(\{ connection: -0\.28 \}\)/, "泄思念也要留在门里面");
});

test("刹车还在：轮数上限、总条数上限、闲置间隔一个都不许少", () => {
  assert.match(scan, /const roundCap = Math\.max\(1, gs\.autoChatRounds \|\| 5\)/, "轮数上限没了");
  assert.match(scan, /const totalCap = Math\.max\(1, gs\.autoChatMaxMsg \|\| 50\)/, "总条数上限没了");
  assert.match(scan, /if \(rounds >= roundCap \|\| msgsSoFar >= totalCap\)/, "到顶不歇了");
  assert.match(scan, /if \(now - \(last\.ts \|\| 0\) < gap\) continue;/, "闲置间隔没了");
  // 上限判断必须排在动念那道门【之前】：先看额度够不够，再看有没有人想说话
  assert.ok(scan.indexOf("if (rounds >= roundCap") < scan.indexOf("let urgeChars = [];"), "顺序反了");
});

test("每一轮照旧记账，额度卡跨重开仍然有效", () => {
  assert.match(scan, /rounds: rounds \+ 1/, "轮数不加了");
  assert.match(app, /if \(rgOpts\.auto\) addAutoChatMessages\(groupId, safeArr\.length\)/, "条数不记了");
  assert.match(scan, /replyGroup\(gid, \{ auto: true, msgBudget: totalCap - msgsSoFar/, "剩余预算没往下传");
});

test("没配 jiwen 的群照旧纯闲置触发，一个字没变", () => {
  const gate = scan.indexOf("if (rounds === 0) {");
  const seg = scan.slice(gate, gate + 1100);
  assert.match(seg, /let anyJiwen = false;/, "没 jiwen 的群该直接放行");
});
