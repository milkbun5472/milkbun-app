const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("线下的卡也能收进时刻：单人、群线下都走 pinToShike 那一处", () => {
  const card = comp.slice(comp.indexOf("function OffCard("), comp.indexOf("const editBox = ", comp.indexOf("function OffCard(")));
  assert.ok(/onPinShike \? h\("button", \{ onClick: \(\) => onPinShike\(m, spk\)/.test(card));
  assert.strictEqual((comp.match(/onPinShike: onPinShike/g) || []).length, 2, "两种线下都把它递给卡");
  assert.ok(/onPinShike: m => pinToShike\(offlineChar\.id, m\)/.test(app));
  assert.ok(/onPinShike: \(m, spk\) => \{[^\n]*pinToShike\(cid, m\)/.test(app));
});
