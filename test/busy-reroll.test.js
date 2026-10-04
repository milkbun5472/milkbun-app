const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("忙时晚点回的子开关：每轮按忙碌度重掷，不看她隔了多久", () => {
  const gate = app.slice(app.indexOf("const busyGate = "), app.indexOf("const callCharGated = "));
  assert.ok(/busyReroll === true/.test(gate));
  assert.ok(/if \(!reroll\) \{[\s\S]*?BUSY_GAP_MIN[\s\S]*?\}/.test(gate));
  assert.ok(/busyReroll: s\.busyReroll === true/.test(app));
  assert.ok(/busyHold \? h\("div"[\s\S]{0,600}setBusyReroll/.test(comp));
  assert.ok(/busyReroll: busyReroll/.test(comp));
});
