// 刻歌卡被通用「系统」那一行先接走，显示成空的系统条（她 2026-10-13）
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "../js/components.js"), "utf8");
test("通用系统条放过 carved，让它走自己的卡", () => {
  const sys = comp.indexOf('if ((m.kind === "system" || m.role === "system") && m.kind !== "carved") return h(SysNote');
  const card = comp.indexOf('if (m.kind === "carved") return h(');
  assert.ok(sys > 0 && card > 0);
});
