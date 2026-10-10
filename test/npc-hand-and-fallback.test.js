const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const i = eng.indexOf("async function generateNpc"), src = eng.slice(i, eng.indexOf("\n}\n", i) + 2);
const mk = raw => new Function("callAI", "parseJSONLoose", src + ";return generateNpc;")(async () => raw, () => null);
test("NPC generation survives stray quotes and truncation", async () => {
  const a = await mk('{"name":"裴鸣玉","brief":"你是户部侍郎裴鸣玉，夏萧因常说"数字不会骗人"，你记住了。","relFromHost":"我的账房","relToHost":"摄政王"}')({}, { name: "夏" }, "");
  assert.equal(a.name, "裴鸣玉"); assert.equal(a.relFromHost, "我的账房"); assert.match(a.brief, /数字不会骗人/);
  const b = await mk('{"name":"裴鸣玉","brief":"你是东洲户部侍郎裴鸣玉，三十二岁，在朝中做了七年账册')({}, { name: "夏" }, "");
  assert.match(b.brief, /七年账册$/);
});
test("hand-written NPC for a character host", () => {
  assert.match(scr, /\["gen", "按人设生成"\], \["hand", "自己写"\]/);
  assert.match(scr, /onAddMyNpc\(c\.npcName, c\.npcBrief, c\.npcRel, c\.meChar\)/);
  // 落成收进 addNpcLinked 一处（v75.27x）：角色名下手写的那一支传 ownerId: hostId、不连她
  assert.match(app, /const addMyNpc = \(name, brief, relLabel, hostId\) =>[\s\S]{0,500}addNpcLinked\(\{ name, brief, ownerId: hostId, links: \[\] \}\)/);
});
