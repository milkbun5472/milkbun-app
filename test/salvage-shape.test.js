// 模型回来的东西差一点对不上时照一份 spec 重新认（salvageShape，engine.js）：只改形状、不编内容
const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"); const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const a = src.indexOf("function salvageShape"), b = src.indexOf("if (typeof window", a);
const ex = t => { try { const m = String(t).match(/[\[{][\s\S]*[\]}]/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } };
const salvageShape = new Function("extractJSON", src.slice(a, b) + ";return salvageShape;")(ex);
test("别名字段也收", () => assert.strictEqual(salvageShape('{"content":"梦里下雨"}', { str: { scene: ["scene", "content"] }, need: ["scene"] }).scene, "梦里下雨"));
test("数组给成一串字：按 split 拆", () => assert.deepStrictEqual(salvageShape('{"words":"嘴硬、温柔，慢热"}', { arr: { words: { from: ["words"], split: /[、，]/ } }, need: ["words"] }).words, ["嘴硬", "温柔", "慢热"]));
test("直接回了数组：root 接住", () => assert.deepStrictEqual(salvageShape('["猫","狗"]', { arr: { words: {} }, root: "words", need: ["words"] }).words, ["猫", "狗"]));
test("wrap 把字符串项包成 {text}", () => assert.deepStrictEqual(salvageShape('{"choices":["走","留"]}', { arr: { options: { from: ["options", "choices"], wrap: "text" } } }).options, [{ text: "走" }, { text: "留" }]));
test("没有 JSON、一段正文：进 prose 字段", () => { const r = salvageShape("TA 打牌很稳，算得清楚，就是不敢冒险。", { str: { skill: ["skill"] }, prose: "skill", proseMin: 10, need: ["skill"] }); assert.ok(r._salvaged); assert.match(r.skill, /打牌很稳/); });
test("什么都认不出：null", () => {
  assert.strictEqual(salvageShape("", { need: ["x"] }), null);
  assert.strictEqual(salvageShape("嗯", { str: { skill: ["skill"] }, prose: "skill", proseMin: 10, need: ["skill"] }), null);
  assert.strictEqual(salvageShape('{"foo":1}', { str: { scene: ["scene"] }, need: ["scene"] }), null);
});
test("不编内容：没写的字段照样空着", () => assert.strictEqual(salvageShape('{"scene":"x"}', { arr: { options: { from: ["options"] } } }).options, undefined));
test("梦：scene 换名、options 是字符串数组也接得上", () => {
  const spec = { str: { scene: ["scene", "content", "text", "narration", "story", "body"] }, arr: { options: { from: ["options", "choices", "replies"], wrap: "text" } } };
  const p = salvageShape('{"narration":"雾里有灯","choices":["靠近","停下","回头"]}', spec);
  assert.strictEqual(p.scene, "雾里有灯"); assert.strictEqual(p.options.length, 3); assert.strictEqual(p.options[0].text, "靠近");
  assert.match(fs.readFileSync(path.join(__dirname, "..", "js", "dream.js"), "utf8"), /salvageShape\(sp\.clean/);
});
test("学习计划：直接回了 days 数组也收", () => {
  const d = salvageShape('[{"date":"2026-11-23","task":"第一章"}]', { arr: { days: { from: ["days", "plan", "schedule", "items"], split: /$^/ } }, str: { say: ["say", "message", "comment", "note"] }, root: "days" });
  assert.strictEqual(d.days[0].task, "第一章");
});
test("日记走这一份", () => assert.match(src, /salvageShape\(text, DIARY_SHAPE\)/));
