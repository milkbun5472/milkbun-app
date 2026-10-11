// 她 2026-10-10：「电脑端怎么翻页啊」→ 选了 ①触控板/Shift+滚轮 ②方向键 ③鼠标拖；布局一个字不动
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");

test("三种手势都接在主屏那层外壳上，编辑模式不接", () => {
  assert.match(comp, /onTouchCancel: onTE,\n\s+onWheel: onWheelPage,\n\s+onMouseDown: onMouseDownPage\n/);
  const i = comp.indexOf("  const onWheelPage = e => {"), j = comp.indexOf("  // 渲染单个可摆放项", i);
  assert.ok(i > 0 && j > i, "抠不出那一段");
  const seg = comp.slice(i, j);
  assert.equal((seg.match(/editMode \|\| dragKeyRef\.current/g) || []).length, 3, "三处都要先看是不是在编辑");
  assert.match(seg, /e\.key !== "ArrowLeft" && e\.key !== "ArrowRight"/);
  assert.match(seg, /INPUT\|TEXTAREA\|SELECT/, "打字时方向键不许翻页");
  assert.match(seg, /const mv = ev => onTM\(fake\(ev\)\);/, "鼠标拖走手指那一套，不另写阈值");
  assert.match(seg, /nowT - flipRef\.current < 520/, "触控板惯性一下只翻一页");
});

test("主屏布局那几样没动", () => {
  assert.match(comp, /height: "100vh", \/\/ 保持 100vh（底部白边最终解法，勿改成 100%\/dvh）/);
  assert.match(comp, /className: "relative flex-1 min-h-0 overflow-hidden pt-3 flex flex-col",/);
});
