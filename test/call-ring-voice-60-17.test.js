const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-02：「现在邀请通话和视频也是卡，能不能做顶部浮层的来电显示跟微信语音和视频
// 那样然后接听和没接听才有聊天记录卡片回执」
//
// 原来是聊天流里一张【常驻】的卡，上面挂着接听/拒绝：
//   · 电话是此刻在响的一件事，不是一条留在记录里的消息——那张卡十天后还写着「点接听」，按下去真会打起来；
//   · 只有正好开着那个聊天才看得见；
//   · 不接也不拒就永远「待接听」，聊天记录里根本没有「未接来电」这回事。

test("响着的电话不进聊天流——浮层在管它", () => {
  const i = comp.indexOf("function CallReceipt(");
  const body = comp.slice(i, comp.indexOf("\n}", comp.indexOf("return h(\"div\"", i)));
  assert.match(body, /if \(st === "ringing" \|\| st === "accepted"\) return null/,
    "响着的、和接通了的（回执是那条「通话已结束」）都不该在这儿再画一遍");
});

test("没人标记也要算未接——App 关着的时候没人来标它", () => {
  const i = comp.indexOf("function callInviteState(");
  const body = comp.slice(i, comp.indexOf("\n}", i));
  assert.match(body, /if \(m\.answered\) return m\.answered/);
  assert.match(body, /Date\.now\(\) - \(Number\(m\.ts\)[\s\S]{0,40}CALL_RING_MS \? "missed"/,
    "过了响铃时长还没标记的，一律按未接显示");
});

test("浮层按挂钟算还能响多久，不按倒计时累加", () => {
  const i = comp.indexOf("function CallRing(");
  const body = comp.slice(i, comp.indexOf("function CallReceipt("));
  assert.match(body, /setNow\(Date\.now\(\)\)/, "拿的是当前挂钟");
  assert.match(body, /CALL_RING_MS - \(now - \(Number\(ts\)/, "剩余由 ts 和此刻算出来");
  assert.match(body, /if \(left <= 0 && onMiss\) onMiss\(\)/, "响完自己报未接");
  assert.ok(!/setLeft\(l => l - 1\)|left - 1/.test(body),
    "不许自己减：切后台 setInterval 会被节流，回来会多响很久");
});

test("浮层挂在 App 根上——人在哪一页都看得见", () => {
  assert.match(app, /ringing && !call && h\(CallRing, \{/, "根节点挂载，且通话已经接起来时不再响");
  assert.match(comp, /function CallRing\([\s\S]{0,3000}ReactDOM\.createPortal/, "浮到 body 上，别被聊天页的 transform 锚住");
});

test("标记要落回它自己那条聊天记录（副本房有自己的一条）", () => {
  const i = app.indexOf("const markInvite");
  const body = app.slice(i, app.indexOf("const ringAccept"));
  assert.match(body, /if \(r\.gid\) pGChat\(r\.gid/);
  assert.match(body, /else pChat\(r\.cid/);
  assert.match(app, /setRinging\(\{ cid: chatKey,/, "记的是 chatKey 不是 charId");
});

test("接听/拒绝/未接三条路都真的标了", () => {
  ["accepted", "declined", "missed"].forEach(k =>
    assert.ok(new RegExp('markInvite\\(r, "' + k + '"\\)').test(app), k + " 那一路没标记"));
});

test("旧那张卡和它的两个入口都删干净了", () => {
  assert.ok(!/CallInviteCard/.test(comp), "旧卡不该还留着");
  assert.ok(!/onAcceptCall|onDeclineCall/.test(comp + app), "卡上那两个回调也一起删");
  assert.ok(!/你拒绝了 TA 的/.test(app), "拒绝后另开一条 system 消息的做法删掉——回执自己会说");
});

// ── 语音：她 2026-09-02「这个语音也是参考别人的，也改成我们自己的吧」 ──
test("AUDIO_MEMO.WAV 那套英文机器标签整套删掉", () => {
  const live = comp.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ["AUDIO_MEMO", "SYNTH…", "TRANSCRIPT"].forEach(x =>
    assert.ok(live.indexOf(x) < 0, x + " 还在——这条消息是一句话，不是硬盘上的一段采样"));
});

test("波形是这一条自己的，不是七根一成不变的贴纸", () => {
  assert.ok(!/\[4, 9, 6, 12, 7, 10, 5\]/.test(comp), "那七根固定柱子要删掉");
  const i = comp.indexOf("function voiceBars(");
  const body = comp.slice(i, comp.indexOf("function VoiceMsg("));
  assert.match(body, /charCodeAt/, "高低由这句话本身算出来");
  assert.match(body, /Number\(dur\)/, "根数跟时长走：说一个字和说三十个字不该长得一样");
  // 真跑一遍：两句不同的话不该画出同一条波形，同一句话两次要一样
  const fn = new Function("return " + comp.slice(i, comp.indexOf("\n}", i) + 2))();
  const a = fn("仓库这破地方回音大得要命", 6), b = fn("嗯。", 1);
  // ⚠️比长度不算数（时长不同本来就长短不同）：要在【同样时长】下比，只让话不一样
  assert.notDeepEqual(fn("仓库这破地方回音大得要命", 3), fn("嗯。", 3), "两句不同的话不该画出同一条波形");
  assert.ok(new Set(fn("仓库这破地方回音大得要命", 3)).size > 2, "一条平线不是波形");
  assert.deepEqual(fn("嗯。", 1), b, "同一句话每次画出来要一样");
  assert.ok(a.length > b.length, "说得久，柱子就该多");
  a.concat(b).forEach(x => assert.ok(x >= 4 && x <= 15, "柱高越界：" + x));
});

test("模型每条都标了语气，别再只喂给 TTS——她也该看得见", () => {
  const i = comp.indexOf("const VOICE_EMO_ZH");
  const map = comp.slice(i, comp.indexOf("\n", comp.indexOf("}", i)));
  ["happy", "sad", "angry", "fearful", "disgusted", "surprised"].forEach(k =>
    assert.ok(map.indexOf(k + ":") > 0, "少了 " + k));
  assert.ok(map.indexOf("neutral") < 0, "平常语气不用标——标了等于每条都挂一个没信息的词");
  assert.match(comp, /VOICE_EMO_ZH\[m\.emo\]/, "要真的用上");
});
