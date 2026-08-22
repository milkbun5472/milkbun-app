const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const rd = f => fs.readFileSync(path.join(root, f), "utf8");
const engine = rd("js/engine.js"), theater = rd("js/theater.js"), fanfic = rd("js/fanfic.js"), index = rd("index.html");

// 她 2026-08-22：「把我们线下那一堆提示词确保它接上了同人文和小剧场那堆的」。
// 审出来三份配方各自漂了：
//   · 同人文 缺【线下叙事·自然生成准则】和【反陈词滥调】——明喻限额、别把情绪列成清单、
//     叙述者不替读者定情绪分量，这几条一条都没吃到
//   · 小剧场演出 缺【语气与年龄感锚】——if 线换了身份最容易把年下演成兄长
//   · 小剧场谢幕戏 配方最薄，连【角色卡执行准则】都没有，而那是整条线的最后一幕
// 手工补四处清单治标不治本，所以并成一个底座：加规则只改一处。

// 把 narrativeCore 抠出来真跑一遍，别只验源码里有这几个字
const core = (() => {
  const i = engine.indexOf("function narrativeCore(opts) {");
  const body = engine.slice(i, engine.indexOf("\n}", i) + 2);
  const stub = ["ANTI_CLICHE", "CHARCARD_RULE", "OFFLINE_NARRATIVE_RUNTIME",
    "NARRATIVE_ANTI_CLICHE", "INTIMATE_ANTI_CLICHE", "PERSONA_REGISTER_ANCHOR"]
    .map(n => "const " + n + ' = "<' + n + '>";').join("\n");
  return new Function(stub + "\n" + body + "\nreturn narrativeCore;")();
})();
const has = (s, n) => s.includes("<" + n + ">");

test("底座默认成分：去人机味 + 角色卡 + 自然生成准则 + 反陈词滥调 + 语气锚", () => {
  const s = core();
  ["ANTI_CLICHE", "CHARCARD_RULE", "OFFLINE_NARRATIVE_RUNTIME", "NARRATIVE_ANTI_CLICHE",
   "PERSONA_REGISTER_ANCHOR"].forEach(n => assert.ok(has(s, n), "默认该带 " + n));
  assert.ok(!has(s, "INTIMATE_ANTI_CLICHE"), "亲密反模板默认不带，免得给非亲密内容套规则");
  // 标题里带「线下」会让模型以为不适用于同人文，得先声明一句
  assert.match(s, /标题里的「线下」只是出处，不是适用范围/);
});

test("三个开关各自管用", () => {
  assert.ok(has(core({ intimate: true }), "INTIMATE_ANTI_CLICHE"));
  assert.ok(!has(core({ register: false }), "PERSONA_REGISTER_ANCHOR"));
  assert.ok(!has(core({ bans: false }), "NARRATIVE_ANTI_CLICHE"));
  // 关掉一个不许连累别的
  const s = core({ register: false });
  ["ANTI_CLICHE", "CHARCARD_RULE", "OFFLINE_NARRATIVE_RUNTIME", "NARRATIVE_ANTI_CLICHE"]
    .forEach(n => assert.ok(has(s, n), "register:false 误伤了 " + n));
});

test("小剧场两处正文都接上了底座", () => {
  assert.match(theater, /const sys = \[narrativeCore\(\{ intimate: true \}\),/, "演出");
  assert.match(theater, /const sys = narrativeCore\(\{ intimate: true \}\) \+ "\\n\\n【谢幕】/, "谢幕戏");
  assert.equal((theater.match(/narrativeCore\(/g) || []).length, 2);
  // 手拼的旧清单不许留着，留着就等于又有一份会漂的配方
  assert.ok(!/\[ANTI_CLICHE, CHARCARD_RULE, OFFLINE_NARRATIVE_RUNTIME/.test(theater));
});

test("同人文两个构建器都接上了，纯写故事时不带语气锚", () => {
  assert.match(fanfic, /parts\.push\(narrativeCore\(\{ intimate: true, register: false \}\)\);/, "纯生成");
  assert.match(fanfic, /const parts = \[narrativeCore\(\{ intimate: true \}\), FANFIC_ANTI_CLICHE\];/, "穿越RP");
  assert.equal((fanfic.match(/narrativeCore\(/g) || []).length, 2);
  // 同人文自己那两套仍然要在——底座是补充，不是替换
  ["FANFIC_ANTI_CLICHE", "FANFIC_ORGANIC_FORM"].forEach(n =>
    assert.ok(fanfic.includes(n), "误伤了同人文自己的 " + n));
});

test("线下故意不走这个底座，别替 Codex 做没验证的迁移", () => {
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
  assert.ok(!single.includes("narrativeCore"), "单人线下不许被顺手并进来");
  // Codex 的 Phase A：单人线下【刻意】不带旧的反陈词滥调清单，这条不能被推翻
  assert.ok(!/"\\n\\n" \+ NARRATIVE_ANTI_CLICHE/.test(single));
  assert.match(engine, /⚠️线下【不走这里】/, "为什么不并进来，得在代码里说清楚");
});

test("加载顺序：engine.js 必须排在 theater 与 fanfic 前面，不然 narrativeCore 是 undefined", () => {
  const at = f => index.indexOf('src="js/' + f + '.js');
  assert.ok(at("engine") > 0 && at("engine") < at("theater"), "engine 要在 theater 之前");
  assert.ok(at("engine") < at("fanfic"), "engine 要在 fanfic 之前");
});
