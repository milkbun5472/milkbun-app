// 她 2026-09-22 转群里读者（! YOLO）：「我感觉线上说话挺正常的，到线下他就是总是会流露出
//   那种霸总气息」「这个我是应该改人设还是去改那个文风呀？」
//
// 查下来有个现成的东西一直【只记不用】：offlineRendererScore 每轮都在给线下正文的网文腔打分，
// 分数进了诊断面板，然后就没有然后了。真正能点着「自我修订」那一道的，只有【角色卡里的词】
// （offlineArchetypePerformanceRisk）——卡里没写「霸道」二字的人，写出一整段霸总腔也没人管。
// 现在让那一分有牙：写出来的正文也算证据。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

// 照真正在跑的那段取打分器，不另抄一份
const score = (() => {
  const i = engine.indexOf("function offlineRendererScore(text) {");
  assert.ok(i > 0, "抠不出打分器");
  return new Function(engine.slice(i, engine.indexOf("\n}", i) + 2) + "\nreturn offlineRendererScore;")();
})();

test("打分器认得出那一套腔，也不误伤普通正文", () => {
  assert.ok(score("他扣住她的手腕，喉结滚了一下，眼底是压不住的火") >= 2, "这么明显的都认不出");
  assert.equal(score("我把伞收起来，站在雨棚下甩了甩水，问她今天忙不忙"), 0, "普通日常被判成网文腔了");
});

test("这一拍写出了网文腔，就记在本场上", () => {
  const i = app.indexOf("      if (!offlineIsRoom(scopeKey)) {\n        const _nwHot");
  assert.ok(i > 0, "没有把那一分存回本场");
  const seg = app.slice(i, i + 320);
  assert.match(seg, /\(Number\(res\.rendererScoreAfter\) \|\| 0\) >= 2/, "阈值/取值不对");
  assert.match(seg, /pOffline\(scopeKey, list => list\.map\(x => !x\.endTs \? \{ \.\.\.x, nwHot: _nwHot \} : x\)\)/,
    "没写进【还没结束】的那一场");
  // 每轮都要覆盖，不能只置真不置假——不然一次网文腔之后永远多跑一道
  assert.ok(!/if \(_nwHot\)/.test(seg), "只在为真时才写，那这面旗子就再也降不下来了");
});

test("下一拍据此多走一道自我修订，而且不额外多花一次调用", () => {
  assert.match(engine, /const archetypeRevisionRequested = !isDigital && \(!!archetypePerformanceRisk \|\| !!session\.nwHot\);/,
    "证据那一路没接上——只认角色卡里的词");
  // 那一道改写是折叠进同一次 completion 的（draftScene → scene），别退回两次请求
  assert.match(engine, /折叠进同一次 completion/, "单枪折叠那条注释没了，说明这一路被改成两次请求了");
});
