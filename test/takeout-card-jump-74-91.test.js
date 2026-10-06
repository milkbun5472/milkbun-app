// 她 2026-10-06：「外卖单子点了跳转不过去」——聊天里那张外卖卡原来根本没有点击动作
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const cmp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
test("TA 给你点的外卖卡点一下 → 外卖 app 的订单页，返回回到聊天", () => {
  assert.match(cmp, /onOpen: m\.role !== "user" && onOpenTakeout \? onOpenTakeout : null,/);
  assert.match(cmp, /"data-kind": "takeout", onClick: onOpen \|\| undefined/);
  assert.match(app, /onOpenTakeout: \(\) => \{ setTakeoutNav\("orders"\); setTakeoutBack\("thread"\); setScreen\("takeout"\); \},/);
  assert.match(scr, /useState\(initialNav === "orders" \? "orders" : "near"\)/);
  assert.equal((app.match(/screen === "takeout"\) body = h\(Takeout, \{[\s\S]*?\}\);else/)[0].match(/onBack:/g) || []).length, 1, "只留一个 onBack");
});
