const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
test("过往限时动态小格、精选圆是组件外的稳定组件，不会每次重画重新取图而闪", () => {
  const s = fs.readFileSync("js/stories.js", "utf8");
  assert.ok(/\n  const ArchCell = /.test(s) && /\n  const HlDot = /.test(s));
  assert.ok(!/\n    const (Cell|Dot) = /.test(s));
});
