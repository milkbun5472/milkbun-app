// 总结这一族也走后台线路（她 2026-09-21：重新总结一场 9.4k 字的线下，Gemini 整段返空）
//
// 记忆抽取那两枪 v64.43 起就走后台线路了，总结这九枪一直没跟上——
// 又是「一层写在两处，第二处没跟上」。判据：这一枪是不是【把一大段材料打包成
// 一条发出去、产出给系统吃的摘要】；聊天是一来一回、角色本人落笔，不在此列。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");

test("选路只有一份，九处总结都问它要", () => {
  assert.equal((app.match(/const sumRoute = /g) || []).length, 1, "选路不许有第二份");
  assert.equal((app.match(/sumRoute\(/g) || []).length, 9, "九枪各问一次（闸和调用共用一个局部变量，别调两遍）");
});

// ⚠️没挑过后台线路时 bgActive 就是主模型，直接顶上去会把原来走角色专线/线下线路的
// 那几处悄悄换掉——那不是修，是偷偷改行为。
test("只有她真的挑过后台线路才改道", () => {
  const fn = app.match(/const sumRoute = [^\n]+/)[0];
  assert.match(fn, /routePicked\(bgApiId\)/, "没判「她挑过没有」，没配后台线路的人行为会被悄悄改掉");
  assert.match(fn, /bgActiveRef\.current/, "异步回调里要读 ref，不读渲染期那份");
  assert.match(fn, /\|\| fallback \|\| null/, "没挑后台线路时要原样退回原来那条");
  // 真跑一遍：挑过 / 没挑过，两条路各走一次
  const make = picked => new Function("routePicked", "bgApiId", "bgActiveRef",
    fn + "; return sumRoute;")(() => picked, "bg1", { current: { id: "bg" } });
  assert.deepEqual(make(true)({ id: "线下" }), { id: "bg" }, "挑过就该改道");
  assert.deepEqual(make(false)({ id: "线下" }), { id: "线下" }, "没挑过就该原样");
  assert.equal(make(false)(null), null);
});

test("九枪一个都不许落下", () => {
  [
    [/summarizeOffline\(sumRoute\(offlineApiFor\(charId\)\)/g, 1, "单人线下滚动总结"],
    [/const sumP = sumRoute\(offlineApiFor\(charId\)\);/g, 1, "单人线下收尾"],
    [/summarizeOfflineGroup\(sumRoute\(offlineActive\)/g, 1, "群线下滚动总结"],
    [/const gSumP = sumRoute\(offlineActive\);/g, 1, "群线下收尾"],
    [/const route = sumRoute\(isG \? offlineActive : offlineApiFor\(ownerId\)\);/g, 1, "重新总结这一场"],
    [/summarizeChatBlock\(sumRoute\(/g, 2, "单聊线上：侧房 digest + 滚动浓缩"],
    [/summarizeGroup\(sumRoute\(active\)/g, 2, "群聊线上：手动总结 + 自动滚动"]
  ].forEach(([re, n, who]) => assert.equal((app.match(re) || []).length, n, who + " 没接上"));
});

// ⚠️那两处还兼着【跑不跑】的闸：闸也要跟着换成 sumRoute，
//   否则没配线下线路、只配了后台线路的人，总结仍旧被跳过。
test("收尾那两处的闸也跟着换了，不然配了后台线路照样跳过", () => {
  assert.match(app, /if \(!sideRoom && sumP\) \{/);
  assert.match(app, /if \(gSumP && group\) \{/);
});

// 一层挪了地方、说明没跟上，也是漏（gaze-which-route-66-82 立的那条）
test("设置里那一栏要说出总结也走这条", () => {
  const i = screens.indexOf('routeBox("后台任务模型"');
  const box = screens.slice(i, i + 400);
  assert.match(box, /线上线下的各种总结/);
  assert.match(box, /总结不出来/);
});
