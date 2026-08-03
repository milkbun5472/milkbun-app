const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cloud = fs.readFileSync(path.join(__dirname, "../js/cloud.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8");

test("退出前云备份失败必须中止，不得继续清空本机", () => {
  const body = cloud.match(/async signOut\(\) \{([\s\S]*?)\n    \},\n\n    \/\/ 把本地存档推到云端/);
  assert.ok(body, "signOut body should remain inspectable");
  const pushAt = body[1].indexOf("await this.push()");
  const clearAt = body[1].indexOf('startsWith("x_")');
  assert.ok(pushAt >= 0 && clearAt > pushAt, "verified push must happen before local deletion");
  assert.doesNotMatch(body[1], /try\s*\{\s*await this\.(?:autoPush|push)\(\);?\s*\}\s*catch\s*\([^)]*\)\s*\{\s*\}/,
    "backup failure must not be swallowed");
});

test("退出被安全闸拦住时界面明说本机数据已保留", () => {
  assert.match(screens, /未退出：最新数据还没安全备份/);
  assert.match(screens, /本机内容已保留/);
});
