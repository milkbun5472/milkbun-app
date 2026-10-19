// 群里 2026-10-19：好几个人的线上回复整段变成「他松开了扣着她手腕的手」这种线下小说体，一句一泡。
//   线下那几段原样掺在线上上下文里，模型顺着那个写法往下接。聊天那条路上说清两边是两种写法。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("聊天那条路（thinOnline）掺了线下段时，提醒线上照打字的样子说", () => {
  const i = app.indexOf("if (usedOff && thinOnline) rendered.unshift(");
  assert.ok(i > 0);
  assert.match(app.slice(i, i + 300), /照你平时打字的样子说话/);
});

test("反八股里「拿标准小动作替情绪」写明只管写神态的地方，线上发消息不写旁白", () => {
  const eng = require("fs").readFileSync(require("path").join(__dirname, "../js/engine.js"), "utf8");
  const i = eng.indexOf("【拿标准小动作替情绪】");
  assert.match(eng.slice(i, i + 200), /线上发消息本来就不写旁白/);
});
