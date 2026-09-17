// 她 2026-09-17：「上下滑的时候很容易误触让那一堆状态栏跳出来然后误触到撤回」。
//
// 两个毛病叠在一起，缺一个都不会这么容易中：
//  ① 【手指动了不取消】原来只有 touchstart 起表、touchend/mouseup 清表，
//     **全库没有一处听 touchmove**。于是「按着屏幕往上滑一段」只要超过 450ms
//     就被当成长按——而看聊天记录时这个动作一天要做几百次。
//  ② 【弹出来那一下正好在她指头底下】菜单是在手指还按着的时候弹的，
//     她一抬手，那一下 click 就落在刚渲染出来的菜单上，最上面那项往往是撤回。
//     所以「弹出来」和「点中撤回」其实是同一次触摸的两半。
//
// ⚠️同一个形状写了两遍（单聊 / 群聊），抽成一份公共的
//   （施工规则/one-public-mechanism.md：开了公共的就把已有的也搬过去）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const hook = comp.slice(comp.indexOf("const LONG_PRESS_MS = 450;"), comp.indexOf("function TransTextState("));

test("长按判据只有一份，单聊和群聊都搬过去了", () => {
  assert.match(comp, /function useLongPressMenu\(onFire\) \{/);
  assert.equal((comp.match(/const \{ startPress, endPress \} = useLongPressMenu\(setMenu\);/g) || []).length, 2,
    "单聊和群聊都要走公共那一份");
  // 原地不许留第二份手表（只开公共的、旧的留着是最坏的一种）
  assert.ok(!/pressTimer\.current = setTimeout\(\(\) => setMenu\(idx\), 450\)/.test(comp), "还留着手写的那份");
  assert.ok(!/const pressTimer = useRef\(null\);/.test(comp), "搬完了还留着没人用的 ref");
});

test("手指动过就不算长按", () => {
  assert.match(hook, /const LONG_PRESS_SLOP = 10;/);
  assert.match(hook, /Math\.abs\(p\.clientX - from\.current\.x\) > LONG_PRESS_SLOP/);
  assert.match(hook, /\|\| Math\.abs\(p\.clientY - from\.current\.y\) > LONG_PRESS_SLOP/);
  assert.match(hook, /document\.addEventListener\("touchmove", move, \{ passive: true \}\);/);
  // 惯性滚动时手指已经离开屏幕，touchmove 不再来——滚动本身也得能掐掉
  assert.match(hook, /document\.addEventListener\("scroll", off, true\);/);
  assert.match(hook, /document\.addEventListener\("touchcancel", off, \{ passive: true \}\);/);
});

test("取消挂在 document 上，不是一处处补 onTouchMove", () => {
  // 调用点有十七处，一处处补迟早漏，而且以后新加的气泡还会再漏一次
  assert.ok((comp.match(/onTouchStart: selMode \? undefined : \(\) => startPress/g) || []).length >= 15);
  assert.ok(!/onTouchMove: .*startPress/.test(comp), "又回到一处处补的老路了");
});

test("菜单弹出后吞掉抬手那一下——不然直接点中撤回", () => {
  assert.match(hook, /const LONG_PRESS_MUTE_MS = 350;/);
  assert.match(hook, /const swallow = e => \{ e\.stopPropagation\(\); e\.preventDefault\(\); \};/);
  assert.match(hook, /document\.addEventListener\("click", swallow, true\);/);
  // 吞完要摘掉，不能一直挂着
  assert.match(hook, /setTimeout\(\(\) => document\.removeEventListener\("click", swallow, true\), LONG_PRESS_MUTE_MS\);/);
});

test("卸载时把监听器全摘干净", () => {
  ["touchstart", "mousedown", "touchmove", "touchcancel", "scroll"].forEach(k =>
    assert.ok(hook.indexOf('removeEventListener("' + k + '"') > 0, "没摘 " + k));
});

test("按下去的位置从 document 拿，所以十七处调用点一个都不用改签名", () => {
  assert.match(hook, /document\.addEventListener\("touchstart", down, true\);/);
  assert.match(hook, /const startPress = idx => \{/, "签名还是 startPress(idx)，不带事件");
});

// ⚠️真实手势在 Chromium 里跑过（scripts 之外的一次性验证，结论记在这儿）：
//   按住不动 600ms → 弹（1 次）；按住往上滑 60px / 600ms → 不弹（0 次）；
//   只抖 4px 按住 600ms → 照样弹（1 次）。三种都对。
test("长按时长没改，只是加了取消", () => {
  assert.match(hook, /const LONG_PRESS_MS = 450;/);
  assert.match(hook, /\}, LONG_PRESS_MS\);/);
});
