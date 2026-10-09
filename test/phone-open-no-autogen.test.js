// 查手机点开 app 不再自己生成（群友 2026-10-09）：先给一页「还没生成」，按了才调模型；桌面图标标出没生成的
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("node:fs").readFileSync(require.resolve("../js/phone.js"), "utf8");
const body = src.slice(src.indexOf("function PhoneApp("), src.indexOf("function PhoneApp(") + 9000);

test("点开不再自动生成", () => {
  assert.doesNotMatch(body, /Promise\.resolve\(onGen\(char, appKey\)\)\.then/);
  assert.match(body, /const notYet = !data && !isLive && !spinning;/);
  assert.match(body, /"data-wk": "phonenotyet"/);
  assert.match(body, /onClick: \(\) => onGen\(char, appKey\), disabled: !!busyKey/);
});

test("满屏出血的 app 在「还没生成」那页也有返回", () => {
  assert.match(body, /\(spinning \|\| notYet\) && h\(Head,/);
});

test("桌面图标标出没生成过的", () => {
  assert.match(src, /PHONE_LIVE_KEYS\.indexOf\(a\.key\) < 0 && !data\[a\.key\] && h\("span", \{ "data-wk": "phonenotyetdot"/);
});
