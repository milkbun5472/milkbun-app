const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

// 她 2026-08-22：「线下重 roll 出来的东西和上一把几乎一模一样」
//              「放了个自定义文风进去也没参考」

const grab = name => {
  const i = engine.indexOf("function " + name + "(");
  return engine.slice(i, engine.indexOf("\n}", i) + 2);
};

// —— 自定义文风 ——
// 病根两层：① offlineStyleText 只在内置表里找，自定义文风住 localStorage，查不到就返回空串；
//          ② session.stylePrompt 存着空串时 "" != null 成立，按 key 回退那条路也被堵死。
const styleText = (key, stored) => new Function("loadJSON",
  engine.slice(engine.indexOf("const OFFLINE_STYLES = ["), engine.indexOf("\n}", engine.indexOf("function offlineStyleText(")) + 2) +
  "\nreturn offlineStyleText;")(() => stored)(key);

test("自定义文风查得到——它不在内置表里", () => {
  const mine = [{ key: "custom_1", name: "我的", prompt: "写得像半夜的日记，句子短，别抒情。" }];
  assert.equal(styleText("custom_1", mine), "写得像半夜的日记，句子短，别抒情。");
  // 内置的一个都不能坏
  assert.match(styleText("film", mine), /电影镜头语言/);
  assert.equal(styleText("default", mine), "");
  // 查不到的 key 仍然安全返回空串
  assert.equal(styleText("nope", mine), "");
  assert.equal(styleText("custom_1", null), "", "读不到存储时不许抛");
});

test("空串不许堵住按 key 回退", () => {
  // 源码层面：两处都要用真值判断，不是 != null
  const hits = engine.match(/const styleText = session\.stylePrompt \? session\.stylePrompt : offlineStyleText\(session\.styleKey\);/g) || [];
  assert.equal(hits.length, 2, "单人线下与群线下各一处");
  assert.ok(!/session\.stylePrompt != null \? session\.stylePrompt/.test(engine), "旧的 != null 判断不许留着");
  assert.match(engine, /"" != null 成立会把按 key 回退整个堵死/, "为什么改，得写在代码里");
});

test("文风真的会被拼进提示词", () => {
  assert.equal((engine.match(/\(styleText \? "\\n【文风要求】" \+ styleText : ""\)/g) || []).length, 2);
});

// —— reroll ——
const excerpt = new Function(grab("offlineRerollExcerpt") + "\nreturn offlineRerollExcerpt;")();

test("reroll 要避开的原文给足，不再截到 220 字", () => {
  assert.equal(excerpt("他推门进来。"), "他推门进来。");
  const long = "甲".repeat(1800);
  const out = excerpt(long);
  assert.ok(out.length > 1300, "只给 " + out.length + " 字还是太少");
  assert.ok(out.includes("（中略）"), "太长时取头+尾，中间明示省略");
  assert.ok(out.endsWith("甲"), "结尾那一拍最容易原样重来，必须覆盖到");
  // 空白统一压掉，别让换行把额度吃光
  assert.equal(excerpt("他 说\n\n  话"), "他 说 话");
  assert.equal(excerpt(null), "");
});

test("单人与群 reroll 都换成新的摘要函数", () => {
  assert.equal((engine.match(/offlineRerollExcerpt\(session\.rerollAvoid\)/g) || []).length, 2);
  assert.ok(!/rerollAvoid\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, 220\)/.test(engine), "220 字截断不许留着");
  assert.match(engine, /模型只看得到开头 15%，后面照抄一遍也不算违规/, "病因写在代码里");
});
