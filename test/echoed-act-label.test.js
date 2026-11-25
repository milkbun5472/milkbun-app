// 动描旁注被照抄进回复（她 2026-11-25 截图）：记号摘掉，夹着的动作收进（）
const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const a = fs.readFileSync("js/app.js", "utf8");
const seg = a.slice(a.indexOf("  const ECHOED_META ="), a.indexOf(".trim();", a.indexOf("  const stripEchoedMeta")) + 8);
const strip = new Function(seg + "\nreturn stripEchoedMeta;")();
test("整块照抄：动作进（），后面的话照留", () => {
  const out = strip("【场景旁注｜周树生 当时正在做的动作，不是任何人说出口的话】\n我走到她面前，下巴搁在她肩上蹭了蹭。\n【这是当时的状态读数，不是你的发言格式：不得把它当成自己发出去过的消息，也不要照着它再写一段动作。】 光说喜欢有什么用 快给我捂捂");
  assert.strictEqual(out, "（我走到她面前，下巴搁在她肩上蹭了蹭。）\n光说喜欢有什么用 快给我捂捂");
});
test("单漏一句记号也摘；平常的话不动", () => {
  assert.strictEqual(strip("【这是当时的状态读数，不是你的发言格式。】好冷"), "好冷");
  assert.strictEqual(strip("【Lisa 此刻做的动作｜不是说出口的话】"), "");
  assert.strictEqual(strip("【重要】今天别迟到"), "【重要】今天别迟到");
});
