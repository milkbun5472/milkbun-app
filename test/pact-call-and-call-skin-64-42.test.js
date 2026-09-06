// 两件事（她 2026-09-06）：
// ① 「电话聊天的皮肤可以选择跟聊天气泡皮肤挂钩吧」
// ② 「我们现在应该是有约定好了会自动发信息，但是约好了打电话没做」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js"), scr = R("screens.js"), cmp = R("components.js");

// ── ① 通话皮肤 ──────────────────────────────────────────────────────────────
// 那几个纯函数真跑一遍：写死的 #16330a / #fff 正是「深色主题白底白字」那条
// 老规矩要挡的东西，光看正则挡不住算错的取色。
function skinFns(BUBBLE_SKIN, on) {
  const seg = cmp.slice(cmp.indexOf("function callSkinOn()"), cmp.indexOf("// OOC 有两种历史形态"));
  const ctx = {
    BUBBLE_SKIN, localStorage: { getItem: () => (on ? "1" : "0"), setItem() {} },
    skinRGB: hex => { const f = String(hex).replace("#", ""); return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)); },
    // core.js 那一份（负数往黑里压）——这里照搬它的算法，别在 components 里另写一个
    skinShade: (hex, k) => { const f = String(hex).replace("#", ""); const c = [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16))
      .map(v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))); return "rgb(" + c.join(",") + ")"; },
    skinAlpha: (c, a) => (typeof c === "string" && c[0] === "#" && c.length === 7) ? c + a : c,
    String, Number, Math
  };
  vm.createContext(ctx);
  vm.runInContext(seg + "\nglobalThis.__f = { callBackdrop, callBubble, skinFirstHex, skinInkOn };", ctx);
  return ctx.__f;
}

test("跟着皮肤走：底被染色但【仍然是暗的】", () => {
  // 通话屏上一堆 rgba(255,255,255,…) 的小字，底一旦被调亮就全瞎了
  const f = skinFns({ myBg: "#f7b6c2", charBg: "#a8c8e8" }, true);
  const bd = f.callBackdrop(false);
  assert.match(bd, /^linear-gradient\(180deg,rgb\(/, "没按皮肤染色");
  const nums = bd.match(/\d+/g).slice(1).map(Number);   // 跳过 180
  nums.forEach(v => assert.ok(v <= 90, "染出来的底太亮了（" + v + "），白色小字会瞎掉"));
});

test("关掉开关＝原样，一个像素都不动", () => {
  const f = skinFns({ myBg: "#f7b6c2", charBg: "#a8c8e8" }, false);
  assert.equal(f.callBackdrop(false), "linear-gradient(180deg,#3a4a52,#1c2429)");
  assert.equal(f.callBackdrop(true), "linear-gradient(180deg,#2a2a2e,#111114)");
  assert.equal(f.callBubble(true).background, "#f7b6c2eb");
  assert.equal(f.callBubble(true).color, "#16330a");
  assert.equal(f.callBubble(false).background, "#a8c8e824");
  assert.equal(f.callBubble(false).color, "#fff");
});

test("字色不许写死：底深了自己换白字，皮肤指定过就听她的", () => {
  const dark = skinFns({ myBg: "#1a1a22", charBg: "#20303a" }, true);
  assert.equal(dark.callBubble(true).color, "#ffffff", "深色皮肤上还是那个写死的墨绿＝黑底黑字");
  const light = skinFns({ myBg: "#f7f2e8", charBg: "#eee6d8" }, true);
  assert.equal(light.callBubble(true).color, "#1d1a16", "浅色皮肤上给了白字");
  const told = skinFns({ myBg: "#1a1a22", myText: "#c9b27a", charBg: "#20303a" }, true);
  assert.equal(told.callBubble(true).color, "#c9b27a", "她自己指定的字色被覆盖了");
});

test("皮肤填的是一整段渐变时也认得出色号，认不出就退回原样", () => {
  const f = skinFns({ myBg: "linear-gradient(180deg, #CDE2F8 0%, #E4EFFB 100%)", charBg: "linear-gradient(180deg,#B7D0EA,#DCE9F7)" }, true);
  assert.equal(f.skinFirstHex("linear-gradient(180deg, #CDE2F8 0%, #E4EFFB 100%)"), "#cde2f8");
  assert.match(f.callBackdrop(false), /^linear-gradient\(180deg,rgb\(/);
  const none = skinFns({ myBg: "papayawhip", charBg: "rebeccapurple" }, true);
  assert.equal(none.callBackdrop(false), "linear-gradient(180deg,#3a4a52,#1c2429)", "抠不出色号时没退回原样");
});

test("通话屏真的用上了这几个函数（不是定义了没人引用）", () => {
  assert.match(cmp, /background: callBackdrop\(isVideo\)/, "底还写死在那儿");
  assert.match(cmp, /background: callBubble\(isU\)\.background/);
  assert.match(cmp, /color: callBubble\(isU\)\.color/);
  assert.equal(cmp.indexOf('color: isU ? "#16330a" : "#fff"'), -1, "写死的那两个字色还在");
  // 开关得有个地方能拧，而且拧了当场生效（不进那份要按「保存」的草稿）
  assert.match(scr, /h\(CallFollowSkinRow, null\)/, "设置里没有这一行");
  assert.match(cmp, /function CallFollowSkinRow\(\)/);
  assert.match(cmp, /callSkinSet\(v\)/, "拧了不落盘");
});

// ── ② 约好了打电话 ──────────────────────────────────────────────────────────
test("约定能约成打电话，而且到点走的是【响铃】不是发消息", () => {
  assert.match(app, /const PACT_VIA = \{ chat: "发消息", voice: "语音电话", video: "视频电话" \};/);
  assert.match(app, /const v = PACT_VIA\[via\] \? via : "chat";/, "via 没兜底，写坏一个值就静默变成别的");
  assert.match(app, /dueTs, memId, via: v/, "via 没存进那条约里");
  // 到期那一段：电话在 replyNow 之前就 return，不许先花一次调用生成文字
  const seg = app.slice(app.indexOf("const due = (promisesRef.current || [])"), app.indexOf("} catch (e) {}\n      try {\n        for (const c of characters)"));
  const iRing = seg.indexOf("ringFromChar(c, pm.via");
  const iReply = seg.indexOf("replyNow(pm.charId");
  assert.ok(iRing > 0 && iRing < iReply, "打电话这一路没排在发消息前面");
  assert.match(seg, /if \(pm\.via === "voice" \|\| pm\.via === "video"\) \{\s*\n\s*ringFromChar\(c, pm\.via, pm\.dueTs, late\);\s*\n\s*return;/,
    "电话那一支没有当场 return，会接着再发一条消息（两次）");
});

test("响铃这一路一次模型都不调", () => {
  const i = app.indexOf("const ringFromChar = (char, mode, whenTs, lateMin) => {");
  assert.ok(i > 0, "找不到 ringFromChar");
  const body = app.slice(i, app.indexOf("\n  };", i));
  ["replyNow", "callAI", "runProbe", "runTurn"].forEach(bad =>
    assert.equal(body.indexOf(bad), -1, "响个铃还调了 " + bad + "——接不接都花钱了"));
  // 迟太久就不响：她可能几小时没开 app，这时突然响起来像是刚打的
  assert.match(body, /const missed = late > RING_LATE_MAX_MIN;/);
  assert.match(body, /ts: \(missed && whenTs\) \? whenTs : Date\.now\(\)/, "补的未接来电没落在【说好的那一刻】");
  assert.match(body, /if \(missed\) inv\.answered = "missed";/);
  assert.match(body, /if \(!missed\) setRinging\(/, "迟到很久的也照样响了");
});

test("界面上能选「怎么来」，而且选中态不是只填个色", () => {
  assert.match(scr, /\["chat", "voice", "video"\]\.map\(k => \{/, "三选一那一排没有");
  assert.match(scr, /onSetDue\(m\.id, m\.text, toTs\(dueVal\), dueVia\)/, "选了怎么来，没传下去");
  assert.match(scr, /onSetDue: \(mid, about, ts, via\) => onSetPactDue\(mid, partner\.id, about, ts, via\)/, "中间那一层把 via 吃掉了");
  // 选中/没选中至少还要差【形状】——色差之外的东西（tabs-not-plain-pills 第 2 点）
  const seg = scr.slice(scr.indexOf('["chat", "voice", "video"].map(k => {'), scr.indexOf('k === "chat" ? "来找你说"'));
  ["transform: on ?", "border: on ?", "fontSize: on ?"].forEach(k =>
    assert.ok(seg.indexOf(k) > 0, "选中态少了一样：" + k));
  assert.match(seg, /minHeight: 40/, "点不着（低于 40px）");
  // 已经约好的那条要看得出是哪一种，不然改完看不出改没改
  assert.match(scr, /d\.via === "voice" \? "他会打给你" : d\.via === "video" \? "他会视频找你" : "他会来找你说"/);
});
