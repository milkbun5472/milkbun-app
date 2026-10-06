const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 她 2026-10-06：「为啥他的情侣空间申请我拒绝了就直接说话了，我还没打完字……全局还有哪些是这样的都改掉，
//   然后搞测试以后加新功能都必须等我」——规矩在 施工规则/wait-for-her.md。
// 她在聊天里点了一张卡片上的按钮之后，TA 不当场开口：料交给 waitForHer，等她发消息或按回复那一轮再带上。
const body = (startAnchor, endAnchor) => {
  const i = app.indexOf(startAnchor), j = app.indexOf(endAnchor, i + startAnchor.length);
  assert.ok(i > 0 && j > i, "抠不出 " + startAnchor);
  return app.slice(i, j);
};
const TAP_HANDLERS = [
  ["const answerLoveLetter = (", "const genWhisper = async"],          // 回申请信：答应／再想想
  ["const answerSneak = (", "const waitHerRef = useRef"],                // 偷翻被撞见：当面问
  ["const answerPhoneAsk = (", "// 删好友／拉黑"],                       // TA要手机：给／不给
  ["const forwardTarotToChat = async (", "// ───────── 擂台"]           // 塔罗转发进聊天
];

test("她点完卡片按钮，TA 不当场开口（不调 replyNow / runProbe / callAI）", () => {
  TAP_HANDLERS.forEach(([a, b]) => {
    const seg = body(a, b);
    assert.doesNotMatch(seg, /\breplyNow\(|\brunProbe\(|\bcallAI\(/, a + " 里又在替TA当场开口了——改用 waitForHer");
  });
});

test("递完手机回来：本人那句也等她（别的会话被冒名回的那几位照旧会接）", () => {
  const i = app.indexOf("openChatById(p.charId);");
  const seg = app.slice(i, app.indexOf("const _replyTurn = async", i));
  assert.match(seg, /waitForHer\(p\.charId, \{ peekPhone:/);
  assert.doesNotMatch(seg, /replyNow\(p\.charId/);
});

test("waitForHer 只有一份，被她按出来的那一轮带上、送到才清；主动消息不带", () => {
  assert.equal((app.match(/const waitForHer = /g) || []).length, 1);
  assert.match(app, /const _wh = !opts\.room && !opts\.proactive && waitHerRef\.current\[charId\];/);
  assert.match(app, /if \(delivered && _wh\) delete waitHerRef\.current\[charId\]/);
  assert.ok(!/peekPendingRef\.current\[/.test(app), "递手机那份私有的料又回来了——走 waitForHer");
});

test("规矩写进了施工规则，README 点了名", () => {
  const { ruleText } = require("./_rules.js");
  assert.match(ruleText("wait-for-her"), /waitForHer/);
  const readme = ruleText("README");
  assert.match(readme, /wait-for-her\.md/);
});
