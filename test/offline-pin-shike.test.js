const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("线下的卡能多选收进时刻：单人、群线下同一套", () => {
  const card = comp.slice(comp.indexOf("function OffCard("), comp.indexOf("const editBox = ", comp.indexOf("function OffCard(")));
  assert.ok(/onPinShike \? h\("button", \{ onClick: \(\) => onPinShike\(m, spk\)/.test(card), "点星进入多选");
  assert.strictEqual((comp.match(/onPinShike: onPinShike \? \(\) => setPick\(\[i\]\) : null/g) || []).length, 2);
  // 3 = 单人线下 + 群线下 + 往期记录（v75.53x 起往期也能补收，她 2026-10-13）
  assert.strictEqual((comp.match(/offPickCard\(h\(OffCard/g) || []).length, 3);
  assert.strictEqual((comp.match(/pick \? h\(OffPickBar/g) || []).length, 3, "选的时候底栏换成多选条");
  assert.ok(/onPinShike: ms => pinToShike\(offlineChar\.id, ms,/.test(app));
  assert.ok(/onPinShike: ms => pinGroupToShike\(offlineGroup, ms\)/.test(app));
  assert.strictEqual((app.match(/saveJSON\("x_shikeGroupPins"/g) || []).length, 1, "群收时刻只有一处写");
});
