"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const game = require("node:fs").readFileSync("apps/fairy-garden/game.mjs", "utf8");

// 她 2026-09-19：「递东西我是说按了也有时候没反应要多按几次」
// 病根不是距离（距离会弹一句话），是这条路上有三处【悄悄什么都不做】：
// 问 TA 喜不喜欢那一枪要跑好几秒，这几秒里 giftAsking 把每一次点都吞掉，一声不吭。
const pick = game.slice(game.indexOf("async function pickGift(o){"), game.indexOf("// 邻居打招呼那句"));
assert.ok(pick.length > 400 && pick.length < 3000, "抠不出 pickGift");

test("递东西这条路上，一处静默 return 都不许有", () => {
  for (const m of pick.match(/if\([^)]*\)\s*return;/g) || [])
    assert.fail("又有一处拦下来不吭声：" + m);
  const btn = game.slice(game.indexOf("$('give-flower').onclick="), game.indexOf("// 递给谁："));
  assert.ok(btn.length > 80, "抠不出那颗按钮");
  for (const m of btn.match(/if\([^)]*\)\s*return;/g) || [])
    assert.fail("按钮上又有一处拦下来不吭声：" + m);
});

test("正在问 TA 的那几秒要看得见在忙", () => {
  assert.match(game, /function giftBusy\(on,text\)\{/);
  assert.match(pick, /giftBusy\(true,/, "点下去没有变成【在忙】");
  assert.match(game, /finally\{giftAsking=false;giftBusy\(false\);\}/, "忙完没恢复，按钮会一直灰着");
  const css = require("node:fs").readFileSync("apps/fairy-garden/style.css", "utf8");
  assert.match(css, /#gift-list button\[disabled\]/, "灰下去了却看不出来");
});
