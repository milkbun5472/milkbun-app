const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");

test("塔罗保留原入口并增加六种可选牌阵", () => {
  for (const mode of ["reading", "relation", "daily", "forchar"]) {
    assert.match(tarot, new RegExp(mode + ":\\s*\\{"));
  }
  for (const spread of ["guide", "single", "timeline", "love", "relation5", "choice"]) {
    assert.match(tarot, new RegExp(spread + ":\\s*\\{"));
  }
  assert.match(tarot, /const spread = m\.daily \? m\.spread/);
  assert.match(tarot, /const cards = draw\(spread\.length\)/);
});

test("角色可自己选问题，给角色算卦前允许接受犹豫或拒绝", () => {
  assert.match(tarot, /async function askReadingIntent/);
  assert.match(tarot, /accept\|hesitate\|refuse/);
  assert.match(tarot, /intent\.decision === "refuse"/);
  assert.match(tarot, /return \{ refused: true, intent: intent \}/);
  assert.match(tarot, /让 Ta 自己问/);
});

test("桌边追问单独留在塔罗存档，不直写正式记忆或主聊天", () => {
  assert.match(tarot, /async function continueAtTable/);
  assert.match(tarot, /小桌边继续聊/);
  assert.match(tarot, /followups: done/);
  const follow = tarot.slice(tarot.indexOf("async function continueAtTable"));
  assert.doesNotMatch(follow, /addMemEntry\(/);
  assert.doesNotMatch(follow, /saveJSON\("x_chat:/);
});

test("店主只作为低存在感环境，不替角色解牌", () => {
  assert.match(tarot, /const SHOP_MOMENTS/);
  assert.match(tarot, /店主退到书架后面，把这张小桌留给你们/);
  assert.match(tarot, /shopMoment: shopMoment/);
});
