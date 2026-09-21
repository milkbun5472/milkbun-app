// 她 2026-09-15：「亲密度涨幅有没有 bug，感觉有时候不涨」。
// 查出来两条，都是【结算那一步悄悄吞掉了】——回复照常落地，屏幕上看不出异样：
//   ① 带引号的数字被整条丢掉（"affinityDelta":"2"）。群那一路一直在 Number() 转，
//      单聊/单人线下/群线下/收礼那四处用的是 typeof === "number"。
//   ② 模型这一轮的 JSON 坏掉时，兜底补捞只救 action/wearing/thought/mood 四样字符串，
//      好感那一栏从来没人救过——气泡照发，好感悄悄归零。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("读成数这一步只有一份，五个调用点都问它", () => {
  assert.match(app, /const affDelta = v => \{/);
  assert.equal((app.match(/const affDelta = /g) || []).length, 1);
  // 原来那四种写法一个都不许留在结算这条链上
  assert.doesNotMatch(app, /typeof parsed\.affinityDelta === "number"/);
  assert.doesNotMatch(app, /typeof d\.affinityDelta === "number"/);
  assert.doesNotMatch(app, /typeof b\.affinityDelta === "number"/);
  assert.doesNotMatch(app, /Number\.isFinite\(res\.affinityDelta\)/);
  assert.doesNotMatch(app, /Number\.isFinite\(aDelta\)/);
});

test("五个入口都还在（别把闸一起拆了）", () => {
  assert.match(app, /if \(!sideRoom\) bumpAff\(charId, res\.affinityDelta\);/, "单人线下");
  assert.match(app, /if \(!gOffSealed && !_bNpc && b\.senderId\) bumpAff\(b\.senderId, b\.affinityDelta\);/, "群线下·闭群仍封死");
  assert.match(app, /const _affD = affDelta\(parsed\.affinityDelta\);\s*\n\s*bumpAff\(charId, _affD\);/, "单聊线上");
  assert.match(app, /const aDelta = affDelta\(item\.affinityDelta\);/, "群线上");
  // v72.06 配角有了心情，好感这一层【照旧没有】——判据从 spk.npc 换成同一轮算好的 _npcSpk
  assert.match(app, /if \(spk && !_npcSpk\) bumpAff\(spk\.id, aDelta\);/, "群线上·配角仍没有好感");
  assert.match(app, /bumpAff\(charId, d\.affinityDelta\);/, "收到礼物那一枪");
  // 动念和 A 系统跟着用同一个数，别各自再转一遍
  assert.match(app, /if \(!sideRoom && _affD\) \{ const eng = getDongnian\(char\)/);
  assert.match(app, /observeEmotionAShadow\(charId, _affD,/);
});

test("坏 JSON 时好感也要救得回来", () => {
  assert.match(app, /const salvageNum = key =>/);
  assert.match(app, /if \(parsed\.affinityDelta == null\) \{ const v = salvageNum\("affinityDelta"\); if \(v != null\) parsed\.affinityDelta = v; \}/);
  // 救回来这一步必须排在【房间权限】那道闸前面，否则侧房/不共享状态的房会被绕过
  assert.ok(app.indexOf('salvageNum("affinityDelta")') < app.indexOf("if (!_roomSharesState) {"),
    "补捞要排在房间那道闸之前，闸才盖得住它");
  // 带不带引号、带不带正号都认
  const m = app.match(/const salvageNum = key => \{[\s\S]*?\};/);
  const salvageNum = raw => new Function("raw", "return (" + m[0].replace(/^const salvageNum = /, "").replace(/;$/, "") + ")")(raw);
  ["\"affinityDelta\": 3,", "\"affinityDelta\":\"3\",", "\"affinityDelta\": \"+3\" ", "\"affinityDelta\":3}"]
    .forEach(raw => assert.equal(salvageNum(raw)("affinityDelta"), 3, raw));
  assert.equal(salvageNum("\"affinityDelta\":-2,")("affinityDelta"), -2);
  assert.equal(salvageNum("{\"word\":[\"嗯\"]}")("affinityDelta"), null, "没写就是没写，别瞎猜一个数");
});
