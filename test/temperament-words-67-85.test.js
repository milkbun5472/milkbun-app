// 她 2026-09-13 拿自己的角色截图问：「为啥认不出这几个词哈哈」——
// 五个词（机敏跳脱／分享欲强／坦率真诚／好奇心盛／松弛自洽）只有「好奇心盛」命中。
//
// 病根是两头对不上：这一枪【让模型提词】，而数值只认本地那张【字面】表，
// 模型爱造的四字新词一个都不沾。两边各补一半：表里加同义说法，提词那头把表摆给它看。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const dn = fs.readFileSync(path.join(root, "js/dongnian.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 真跑那张表 + 推词的那两行
const mk = () => {
  const i = dn.indexOf("const A_TEMPERAMENT_RULES=");
  const j = dn.indexOf("function temperamentFromAnchorsA");
  assert.ok(i > 0 && j > i, "抠不出性情词典那一份");
  const seg = dn.slice(i, j) + dn.slice(j, dn.indexOf("function migrateLegacyFiveA"));
  return new Function("clamp", seg + "\nreturn { temperamentFromAnchorsA, temperamentWordHintA, A_TEMPERAMENT_WORD_GROUPS };")(
    (v, lo, hi) => Math.min(hi, Math.max(lo, v)));
};

test("她截图里那五个词，现在一个不剩全认得", () => {
  const K = mk();
  const words = ["机敏跳脱", "分享欲强", "坦率真诚", "好奇心盛", "松弛自洽"];
  const out = K.temperamentFromAnchorsA(words, false);
  assert.deepEqual(out.unmatched, [], "还有认不出的：" + out.unmatched.join("、"));
  assert.equal(out.anchors.length, 5);
  // 认得不等于有分量：各自落到该落的那一栏
  assert.ok(out.socialBias > 0.4, "分享欲强该把社交偏置抬起来");
  assert.ok(out.curiosityBias > 0.45, "好奇心盛该把好奇偏置抬起来");
  assert.ok(out.sensitivity.hurt < 1, "松弛自洽＝钝感那一族，受伤敏感度该往下");
  assert.ok(out.sensitivity.arousal > 1, "机敏跳脱＝活泼那一族，唤起该往上");
});

test("老词一个都没被挤掉", () => {
  const K = mk();
  ["敏感", "嘴硬", "黏人", "温柔", "克制", "慢热", "急躁", "焦虑", "钝感", "活泼", "好奇", "负责", "自省"]
    .forEach(w => assert.deepEqual(K.temperamentFromAnchorsA([w], false).unmatched, [], w + " 不认了"));
});

test("认不出的词照旧留着，只是不给数值", () => {
  const K = mk();
  const out = K.temperamentFromAnchorsA(["爱吃辣"], false);
  assert.deepEqual(out.anchors, ["爱吃辣"]);
  assert.deepEqual(out.unmatched, ["爱吃辣"]);
  assert.deepEqual(out.sensitivity, {});
});

test("摆给模型看的那串代表词，是从表现推的，不是另抄一份", () => {
  const K = mk();
  const hint = K.temperamentWordHintA();
  assert.equal(K.A_TEMPERAMENT_WORD_GROUPS.length, 15);
  // 每一族的每一个说法都在串里，没有漏族
  K.A_TEMPERAMENT_WORD_GROUPS.forEach(g => g.forEach(w => assert.ok(hint.includes(w), "漏了 " + w)));
  assert.ok(!/[()?:]/.test(hint), "正则的壳没剥干净：" + hint);
  // app.js 那一处只许去问它要，不许自己写一串词
  assert.match(app, /window\.DongnianEmotionA\.temperamentWordHint\(\)/);
  assert.ok(!/敏感\/易感/.test(app), "app.js 里又抄了一份词表");
});

test("提词那头给的是出口不是判决（不许把它逼成只能填表里的词）", () => {
  assert.match(app, /贴切就优先从里面挑/);
  assert.match(app, /就照你自己的话写，别为了凑进表里写一个不像他的词/);
  assert.ok(!/只能从|必须从上面|不许自己写/.test(app.slice(app.indexOf("你只做角色性情词提取"), app.indexOf("你只做角色性情词提取") + 900)));
});
