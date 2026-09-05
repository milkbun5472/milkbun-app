const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const codex = fs.readFileSync(path.join(root, "js/codex.js"), "utf8");

// v54.77（她 2026-08-22：「早安晚安也停了吧，就留真正挂念的时候发」）。
// 前情：v54.76 刚修好「午夜翻页导致晚安重发」，但她要的不是修准点，是根本不要打卡式问候。
// 定时问候到点必发、跟心情无关，本来就压着动念那套真实动机。

test("定时早晚安整块下线：判定、窗口、去重、投递四样都不在了", () => {
  ["greetSlotFor", "greetDayKey", "schedWakeSleep", "nearMin"].forEach(k =>
    assert.ok(!app.includes(k), "问候判定残留 " + k));
  assert.ok(!app.includes('greet: slot === "m" ? "morning" : "night"'), "还在派发问候");
  assert.ok(!app.includes('"greeting:"'), "投递锁还在");
  assert.ok(!/每个时段最多问候/.test(app), "名额逻辑还在");
  // opts.greet 这条线路没人再传，提示词与出口分类也不该再留着它
  assert.ok(!app.includes("opts.greet"), "opts.greet 线路残留");
  assert.ok(!app.includes("greetHint"), "问候提示词残留");
  assert.ok(!app.includes('"greeting"'), "outlet 里还留着 greeting 分类");
});

test("真正挂念的那条路一根都不许动：动念主动照旧", () => {
  assert.match(app, /dongnianFiredRef\.current\[cid\] = Date\.now\(\);/);
  assert.match(app, /replyNow\(cid, "", null, \{ proactive: true, dongnian: jwStyle,/, "线上主动");
  assert.match(app, /if \(activeOffScene\) \{ offlineReply\(cid\); _drain\(\); \}/, "线下自己动一拍");
  assert.match(app, /opts\.dongnian \? "dongnian"/, "出口分类还得认得动念");
  // 45 秒一轮的 tick 与 14 秒首踢都还在，动念靠它推进
  assert.match(app, /const kick = setTimeout\(tick, 14000\);/);
  assert.match(app, /const timer = setInterval\(tick, 45000\);/);
});

test("生日祝福不是打卡问候，要活着", () => {
  assert.match(app, /markGreet\(cid, "b", year\)/);
  assert.match(app, /bday: true/);
  assert.match(app, /opts\.bday \? "birthday"/);
  // markGreet 与 x_greetLog 仍被生日用着，别跟着问候一起删
  assert.match(app, /const markGreet = \(cid, slot, key\)/);
  assert.match(app, /saveJSON\("x_greetLog", n\)/);
});

test("tick 里留了字条，说明问候是【停掉的】不是【漏写的】", () => {
  assert.match(app, /定时早晚安已于 v54\.77 整块下线/);
  assert.match(app, /只剩两个理由：真攒够思念（动念，就在上面）、以及你生日/);
});

test("说明书跟着改口，别再写着有早晚安", () => {
  assert.ok(!/· 早晚安、你生日的祝福/.test(codex), "功能列表还写着早晚安");
  assert.ok(!/凌晨开 app 不会被一排早安糊脸/.test(codex), "旧的时段说明该退场");
  // v63.45 起攻略不再自存一份说明，数据搬进 assistant-manual.js（一个 app 一页）
  const man = fs.readFileSync(path.join(__dirname, "..", "js", "assistant-manual.js"), "utf8");
  assert.match(man, /没有定时早晚安/);
  assert.ok(!/没有定时早晚安/.test(codex), "攻略又自己存了一份说明");
});
