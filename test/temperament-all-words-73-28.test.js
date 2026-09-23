// 底色那一行把她写的词都带上（最多 10 个），不再只取前 3 个；
// 平稳时照旧零增量（她 2026-09-23：「你觉得真的需要每轮都放吗我觉得没必要吧」）。
const assert = require("node:assert/strict");
const { DongnianEmotionA: A } = require("../js/dongnian.js");
const T0 = Date.UTC(2026, 8, 23, 12, 0, 0);
const words = ["外冷内热", "睚眦必报", "口是心非", "护短", "慢热", "嘴硬心软", "说一不二", "藏锋守拙"];
const state = A.createState("char", T0);
state.emotion.temperament = A.temperamentFromAnchors(words, true);
Object.assign(state.emotion.current, { hurt: .8, anger: .7 });
const out = A.displayProjection(state);
assert.ok(out.text.startsWith("底色：" + words.join("、") + "；"), "八个词都要在：" + out.text);
const many = A.createState("char", T0);
many.emotion.temperament = A.temperamentFromAnchors(Array.from({ length: 14 }, (_, i) => "词" + i), true);
Object.assign(many.emotion.current, { hurt: .8 });
assert.equal(A.displayProjection(many).bottomLine.split("、").length, 10, "封顶 10 个");
const calm = A.createState("char", T0);
calm.emotion.temperament = A.temperamentFromAnchors(words, true);
assert.equal(A.displayProjection(calm).text, "", "心情平稳时这一行照旧不发");
console.log("temperament-all-words-73-28 ok");
