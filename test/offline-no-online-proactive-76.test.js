const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 她 2026-11-21 反过来了：「主动消息当成在一起说话来发不是不发」「我从来没有触发过线下写新的一拍」
test("在一起（同处一室、线下没结束）时主动照样在线上来，改成当面开口", () => {
  assert.ok(!/opts\.proactive && !opts\.room && offlineTogetherNow\(charId\)\) return null;/.test(src), "线下开着又挡回去了");
  assert.ok(!/togetherNoPro/.test(src));
  assert.match(src, /opts\.proactive && currentlyTogetherWithChar\(charId\)\n\s+\? "\\n【此刻你们在一起】/);
  assert.match(src, /const activeOff = null;/, "想你又落回线下一拍了");
  const i = src.indexOf("const offlineTogetherSess = charId =>");
  assert.ok(src.slice(i, i + 400).includes('loadJSON("x_offline:" + charId'), "没缓存时也要读存档");
});
