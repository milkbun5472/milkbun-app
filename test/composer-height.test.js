const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-28：「线下的输入框比线上高一截，能不能调到线上一样的高度」。
// 三条输入栏本来只差 paddingBottom 一个值：
//   线上        calc(env(safe-area-inset-bottom) * 0.4)
//   单聊线下    calc(env(safe-area-inset-bottom) + 4px)   ← 吃满整条安全区
//   群线下      calc(env(safe-area-inset-bottom) * 0.4 + 4px)
// iPhone 上安全区约 34px，单聊线下就比线上高了二十多像素。

test("聊天、两条线下和通话输入栏的下内边距共用常量", () => {
  assert.match(engine, /const COMPOSER_PAD_BOTTOM = "calc\(env\(safe-area-inset-bottom\) \* 0\.4\)"/);
  const uses = comp.match(/paddingBottom: COMPOSER_PAD_BOTTOM/g) || [];
  assert.equal(uses.length, 4, "线上单聊 / 单聊线下 / 群线下 / 通话，一处都不能漏");
  const callScreen = comp.slice(comp.indexOf('function CallScreen(')).split('\nfunction ')[0];
  assert.match(callScreen, /paddingBottom: COMPOSER_PAD_BOTTOM/);
  // 旧的三份各写各的必须已经删掉，不是在旁边留着
  assert.doesNotMatch(comp, /paddingBottom: "calc\(env\(safe-area-inset-bottom\)[^"]*\)", marginBottom: kbLift/);
});

test("外框和输入框本身的尺寸三处也一致", () => {
  const bars = comp.match(/className: "flex items-center gap-2 px-3 py-[\d.]+ shrink-0"[^\n]*paddingBottom: COMPOSER_PAD_BOTTOM/g) || [];
  assert.equal(bars.length, 2, "两条线下输入栏");
  bars.forEach(b => assert.match(b, /px-3 py-2\.5 shrink-0/, "和线上一样是 py-2.5：" + b.slice(0, 60)));
  // 输入框内边距原来靠三处手抄一致；2026-09-21 INP 手术后草稿输入框收进公共
  // DraftInput（打字不再重画整窗消息），尺寸只写那一份，一致性由构造保证。
  const draftInput = comp.slice(comp.indexOf("function DraftInput("), comp.indexOf("function ReplyKey("));
  assert.match(draftInput, /className: "flex-1 outline-none px-4 py-2\.5 rounded-full"/);
  // 例外只有通话屏：口述识别要从外面回填草稿，且一通字幕本来就短，留在原地（理由记在 DraftInput 注释）
  const callScreen = comp.slice(comp.indexOf("function CallScreen("), comp.indexOf("function ReplyKey("));
  assert.match(callScreen, /className: "flex-1 outline-none px-4 py-2\.5 rounded-full"/);
  assert.equal((comp.match(/className: "flex-1 outline-none px-4 py-2\.5 rounded-full"/g) || []).length, 2, "尺寸只许写在 DraftInput 和通话屏两处");
  // 四个面（线上单聊/群聊、单聊线下/群线下）都走公共输入组件
  assert.ok((comp.match(/h\(DraftInput, \{/g) || []).length >= 4, "四个面都要接 DraftInput");
});
