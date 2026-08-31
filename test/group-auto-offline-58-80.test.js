const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const IC = require("../js/interaction-clock.js");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const grab = (a, b, cap) => {
  const i = app.indexOf(a), j = app.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return app.slice(i, j);
};
const N = Date.now(), MSG = [{ role: "user", content: "x" }];

// 她 2026-08-31：「我和顾朝顾暮在群线下，然后他们同一个群线上又在继续聊和线下发生的无关的东西」
// 病因不在提示词（replyGroup 早就有 gOfflineHint，也确实拼进了 system），
// 而在那道守卫盯错了东西：它盯的是【线下浮层开着】，可下拉「回线上群」只是
// setOfflineGroup(null) 收浮层，那一场并没有结束——浮层一收，自发聊立刻放行。
test("「还在进行」看的是场次，不是浮层开没开", () => {
  assert.equal(IC.offlineSceneLive([{ startTs: N - 6e5, msgs: MSG }]), true, "演过一拍、没结束的，就是还在进行");
  assert.equal(IC.offlineSceneLive([{ startTs: N - 6e5, endTs: N - 1000, msgs: MSG }]), false, "已经结束的还算在进行");
  assert.equal(IC.offlineSceneLive([{ startTs: N - 6e5, msgs: [] }]), false, "开了但一拍没演，不算在进行");
  assert.equal(IC.offlineSceneLive([]), false);
  assert.equal(IC.offlineSceneLive(null), false, "没这一栏就炸了");
});

test("一场忘了结束的线下，不许把自发聊永远关死", () => {
  assert.equal(IC.offlineSceneLive([{ startTs: N - 9 * 3600e3, msgs: MSG }]), false, "9 小时前那场还算在进行——自发聊就再也不动了");
  assert.equal(IC.offlineSceneLive([{ startTs: N - 7 * 3600e3, msgs: MSG }]), true, "7 小时还在窗口里");
  // 上限跟 isTogetherNow 用同一个数：同一件事别在两处各定一个
  const src = fs.readFileSync(path.join(__dirname, "..", "js", "interaction-clock.js"), "utf8");
  assert.match(src, /const OFFLINE_LIVE_MS = 8 \* 60 \* 60 \* 1000;/);
  assert.match(src, /now - \(Number\(s\.startTs\) \|\| 0\) < 8 \* 60 \* 60 \* 1000/, "isTogetherNow 那边的上限被改成别的了");
});

test("群聊自发这条链真的按场次挡了", () => {
  const scan = grab("    const scanAutoGroups = () => {", "        const msgs = (groupChatsRef.current[gid] || [])");
  assert.match(scan, /if \(offlineGroup && offlineGroup\.id === gid\) continue;/, "浮层开着那一档也不能丢");
  assert.match(scan, /window\.InteractionClock\.offlineSceneLive\(gOffList, Date\.now\(\)\)/, "没按场次挡——浮层一收就放行了");
  // 场次是懒加载的：她这次没打开过那个群的线下，ref 里就是空的，必须回落到本地盘
  assert.match(scan, /groupOfflinesRef\.current\[gid\] \|\| loadJSON\("x_goffline:" \+ gid, \[\]\)/, "没回落到本地盘,重开 App 后这道守卫就是摆设");
});

// 她同一轮里点名纠正过的：单人线下【不该】停群——他们当然可以在群里跟别人聊微信
test("单人线下不停群：那不是矛盾，人本来就能一边相处一边刷手机", () => {
  const scan = grab("    const scanAutoGroups = () => {", "        const msgs = (groupChatsRef.current[gid] || [])");
  assert.ok(!/offlineChar/.test(scan), "又把单人线下也拿来停群了——她 2026-08-31 明确说那是对的行为");
  assert.ok(!/\bcall\b/.test(scan), "通话也不该停群");
});

// 线上那边知道大家此刻正面对面——这一半本来就通，别在修守卫时把它弄丢
test("线上群回复仍然知道「此刻正在一场群线下」", () => {
  const rg = grab("  const replyGroup = async (groupId, rgOpts = {}) => {", "      const raw = await callAI(active, system, [{");
  assert.match(rg, /const gOffSess = \(groupOfflinesRef\.current\[groupId\] \|\| \[\]\)\.find\(s => s && !s\.endTs && \(s\.msgs \|\| \[\]\)\.length\)/, "不看有没有正在进行的群线下了");
  assert.match(rg, /【你们此刻正在一场群线下相处 · 进行中】/, "那句提示没了");
  // ⚠️声明了却没被拼进 system，比没写更坏（v55.95 那一课）
  assert.match(app, /gBusyHint \+ gOfflineHint \+ gBiHint/, "gOfflineHint 没被拼进 system——声明了没人引用");
});
