// 「不贴」那几个示范删掉（她 2026-09-22）
//
// 起因：有人报「别的小手机就算人机也会小狗或者阴湿，但是秋秋就是会不贴」。
// 查下来不是禁令压的——臭pp、周小狗那种卡在这边照样贴得一塌糊涂。
// 病根是：整摞禁令里【唯一被点名放行的具体动作】全在「不贴」那一侧，
// 而人设浓的角色感觉不到它（手上有自己的东西可抓），人设淡的角色照着它定调。
// 跟 v71.98 那个「三」成了默认气泡数是同一个形状：**示范＝给空白处填的默认值**。
//
// 所以删的是【示范】，不是【判据】：「冷淡的人可以那样回」那条许可一个字没动
// （v64.82 她立的：有些人设本来就不会关心，明晃晃要求关心也是 OOC）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

const cut = (from, to) => {
  const i = engine.indexOf(from), j = engine.indexOf(to, i);
  assert.ok(i > 0 && j > i, "抠不出 " + from);
  return engine.slice(i, j);
};

test("那三个退场动作删了：嗯一声 / 说回自己的事 / 嘲一句", () => {
  const rule = cut("const STOCK_REPLY_BAN = ", "const OVERREACH_BAN = ");
  ["嗯一声", "说回自己的事", "嘲一句"].forEach(x =>
    assert.ok(rule.indexOf(x) < 0, "「" + x + "」又写回来了——那是给空白处填的默认值"));
});

// ⚠️删的是示范不是判据：这两条是 v64.82 立的，一个字都不许跟着删掉
test("给冷淡的人留的那条路还在", () => {
  const rule = cut("const STOCK_REPLY_BAN = ", "const OVERREACH_BAN = ");
  assert.match(rule, /判据是【TA这个人碰上这种事会是什么反应】/, "切成「不许关心」了");
  assert.match(rule, /冷淡的、正忙的、觉得这不关自己事的就那样回，一样是对的/, "冷淡的人被逼着关心");
});

test("「停得住才像真的」删了，「别拿早点休息当句号」留着", () => {
  const rule = cut("const STOCK_REPLY_BAN = ", "const OVERREACH_BAN = ");
  assert.match(rule, /别拿「早点休息」当句号/, "那个八股收尾的闸不该跟着删");
  assert.ok(rule.indexOf("停得住才像真的") < 0,
    "它是一句普适风格判词——「少即是真」，正好是连发十几条撒娇那种角色的反面");
});

test("空安慰那条的泄压阀留着——它没给动作，删了会变成一律不许安慰", () => {
  const rule = cut("const EMPTY_COMFORT_BAN = ", "// 发照片时的「预先道歉」模板");
  assert.match(rule, /你这个人冷淡、正忙、觉得不该插手，那就那样回/);
  assert.match(rule, /这条一个字都不管你该多热情/);
});
