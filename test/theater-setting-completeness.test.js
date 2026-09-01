const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const theater = fs.readFileSync(path.join(__dirname, "..", "js/theater.js"), "utf8");

// 她 2026-08-18 报的「生成失败:设定生成不完整」。真凶不是模型不会写，是正文被 max_tokens
// 截断——JSON 尾部的键先死，而必填的 goal 恰好排在最后一个。
test("必填字段必须排在最长的 opening 之前，截断先砍掉的是可选内容", () => {
  // 形状既有内联的，也有抽成 SHAPE_ 常量的（生成提示词与「整理回来」共用一份，防漂移）
  const shapes = (theater.match(/只输出 JSON:\{[^}]*\}/g) || [])
    .concat(theater.match(/const SHAPE_[A-Z]+ = "[^;]*;/g) || []);
  assert.ok(shapes.length >= 4, "至少四处设定/开局的输出形状");
  shapes.forEach(shape => {
    const o = shape.indexOf('\\"opening\\"'), g = shape.indexOf('\\"goal\\"');
    if (o < 0 || g < 0) return;
    assert.ok(g < o, "goal 必须排在 opening 前面，否则一截断就先没了：" + shape.slice(0, 60));
  });
});

test("截断后拿已付费的半份去补缺键，不整局重来", () => {
  assert.match(theater, /const completeSetting = async \(partial, raw, need, hint\)/);
  assert.match(theater, /const lack = need\.filter\(k => !String\(\(partial && partial\[k\]\) \|\| ""\)\.trim\(\)\)/);
  assert.match(theater, /if \(!lack\.length\) return partial;/, "字段齐了就不该多花一次调用");
  // 补写失败必须静默退回原件，绝不能把一次生成失败升级成抛错
  assert.match(theater, /\} catch \(e\) \{ return partial; \}/);
  assert.match(theater, /if \(!fix\) return partial;/);
});

test("报错要说清缺了哪个字段，别只甩一句「不完整」", () => {
  const thrown = (theater.match(/throw new Error\("[^"]*"\)/g) || []).join("\n");
  assert.doesNotMatch(thrown, /设定生成不完整/);
  assert.doesNotMatch(thrown, /开局生成不完整/);
  assert.match(theater, /设定缺了「" \+ lack\.join\("、"\) \+ "」/);
  assert.match(theater, /开局缺了「本轮目标」/);
  assert.match(theater, /模型没吐出 JSON/, "彻底没 JSON 和缺字段是两种毛病，要分得开");
});

test("设定与开局的输出额度要够写完九个字段", () => {
  // 冻的是「够不够写完九个字段」，不是某个具体数字（v59.96 全 app 抬到 ≥8000）
  const budgets = (theater.match(/maxTokens: (\d+), timeout: 150000/g) || []).map(x => Number(x.match(/\d+/)[0]));
  // ⚠️原来靠「4800 / 4000」两个不一样的数把这两支认出来；v59.96 抬额度之后
  //   同一条 timeout 下有四支了（还有重开那两支），认不出谁是谁——
  //   但这一条在意的本来就是「够不够写完」，那就对着这一条问：这几支一个都不许太小。
  assert.ok(budgets.length >= 2, "if 线设定 + 基线开局这两支的额度声明找不着了");
  budgets.forEach(function (b) { assert.ok(b >= 8000, "额度不够写完九个字段：" + b); });
});

// 「模型没吐出 JSON」的两种真实坏法，scene 那边早就治过，设定这几支以前是裸奔的。
test("设定解析走和 scene 同一套抢救梯队，不再是裸 extractJSON", () => {
  assert.match(theater, /const parseSettingPayload = \(raw, keys\)/);
  assert.match(theater, /const salvageByKeys = \(raw, keys\)/);
  // 生成侧一处都不许再拿裸 extractJSON 去接模型返回
  // 唯一允许留着裸 extractJSON 的是账本压缩：形状不同（四个数组），且失败是静默的、下一轮自愈
  const bare = (theater.match(/const \w+ = extractJSON\(raw\)[^\n]*/g) || []);
  assert.deepEqual(bare, ["const p2 = extractJSON(raw) || {};"], "设定/开局/目标这几支必须全部走 parseSettingPayload");
  assert.equal((theater.match(/parseSettingPayload\(/g) || []).length, 6, "六处调用：四支生成 + 截断补写 + 散文整理");
});

test("整理不回来才认输，且要说出模型到底回了什么", () => {
  assert.match(theater, /const reformatSetting = async \(raw, shape, keys\)/);
  assert.match(theater, /内容一个字都不许改写、不许润色、不许自己另编/, "整理只能搬运，不许趁机另编一份");
  assert.match(theater, /\} catch \(e\) \{ return null; \}/, "整理失败要静默返回 null，不许把它变成新的抛错");
  assert.match(theater, /const rawHint = raw =>/);
  assert.equal((theater.match(/rawHint\(raw\)/g) || []).length, 4, "四处生成的认输文案都要带上原文片段");
  assert.doesNotMatch(theater, /throw new Error\("模型没吐出 JSON/, "这句已经换成能查下去的版本");
});

// 行为验证：把真实的两种坏法喂进抢救梯队，确认真的救得回来。
// 抽 theater.js / engine.js 的源码片段现场跑，不复刻实现。
test("控制字符与裸引号两种坏 JSON 都能抢救出必填字段", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");
  const fn = (src, name) => {
    const i = src.indexOf("function " + name);
    return src.slice(i, src.indexOf("\n}\n", i) + 3);
  };
  const body = theater.slice(theater.indexOf("  const decodeLooseJsonText"),
    theater.indexOf("  // v53.61 以前若已经把协议原文存进历史"));
  const mod = new Function(fn(engine, "repairJSON") + fn(engine, "extractJSON") +
    fn(engine, "escapeJsonStringControls") + body +
    "\nreturn { parseSettingPayload, extractJSON };")();
  const KEYS = ["title", "charRole", "userRole", "world", "hook", "charOutfit", "userOutfit", "goal", "opening"];
  const base = '"title":"宅斗","userRole":"你","world":"侯府","hook":"账房失窃",' +
    '"charOutfit":"石青直裰","userOutfit":"藕荷比甲","goal":"让他当众认下这笔账"';

  // ① opening 里直接写了真换行（5-9 句的开场最容易踩）
  const withNewline = '{"charRole":"他是二房嫡子。\n心思极深。",' + base + ',"opening":"你站在廊下。\n雨声很大。"}';
  assert.equal(mod.extractJSON(withNewline), null, "裸 extractJSON 本来就死在这里");
  assert.equal(mod.parseSettingPayload(withNewline, KEYS).goal, "让他当众认下这笔账");

  // ② 正文里用了未转义的英文引号（中文对白最爱）
  const withQuote = '{"charRole":"他说"我不认"，便再无下文。",' + base + ',"opening":"你站在廊下。"}';
  assert.equal(mod.extractJSON(withQuote), null);
  const q = mod.parseSettingPayload(withQuote, KEYS);
  assert.equal(q.goal, "让他当众认下这笔账");
  assert.equal(q.charRole, '他说"我不认"，便再无下文。', "抠出来的正文要连引号一起保住");

  // ③ 彻底是散文：不许硬猜，必须返回 null 交给 reformatSetting
  assert.equal(mod.parseSettingPayload("好的，这条宅斗线是这样的：他是二房嫡子……", KEYS), null);
});
