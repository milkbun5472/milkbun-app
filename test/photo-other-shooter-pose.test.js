// 她 2026-10-02：她在马上拍他牵马走路，出图却是他骑马——拍照者的动作被安到了 TA 身上。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.resolve(__dirname, "..", "js/engine.js"), "utf8");

test("other 出图：拍照的人在做的事只定机位，不是 TA 的姿势", () => {
  const i = engine.indexOf('} else if (kind === "other") {', engine.indexOf("function buildPhotoPrompt"));
  const seg = engine.slice(i, engine.indexOf("} else {", i));
  assert.match(seg, /拍照的人不在画面里/);
  assert.match(seg, /不是 TA 的姿势/);
});

test("线下 photo 格式：other 要把 TA 的样子和拍的人的位置分开写", () => {
  assert.match(engine, /other 是别人拿着手机拍你：scene 里分开写清/);
});

test("duo 合照：前后站位和谁掌镜照描述摆", () => {
  assert.match(engine, /谁前谁后、谁左谁右、谁举的手机，描述里写了就严格照它摆/);
  assert.match(engine, /duo 合照：scene 里写清你俩谁在前谁在后、谁举的手机/);
});
