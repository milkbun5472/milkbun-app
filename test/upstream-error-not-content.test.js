const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 把常量段抠出来跑真值，别只做字符串匹配
const seg = engine.slice(engine.indexOf("const UPSTREAM_ERROR_PATTERNS"),
                         engine.indexOf("function assertNotUpstreamError"));
const upstreamErrorInContent = new Function(seg + "\nreturn upstreamErrorInContent;")();

// 她 2026-08-25：flash 第一下经常失败，要么「The prompt could not be submitted. The p…」
// 要么「empty response from gemini api」，换 pro 才行。
// 这两句都不是我们写的——中转站没回 HTTP 错误、也没回 {error:…}，
// 而是把错误话塞进 choices[0].message.content 当【正文】200 回来。
// 于是群聊报的是「解析回复：模型没按 JSON 数组输出」，方向指错了：模型根本没跑。
test("中转站塞进正文的错误话要被认出来", () => {
  [
    "empty response from gemini api",
    "The prompt could not be submitted. The prompt contains content that is not allowed.",
    '{"error":{"message":"quota exceeded"}}',
    "当前分组 default 下对于模型 gemini-2.5-flash 无可用渠道",
    "Request failed with status code 503",
    "[GoogleGenerativeAI Error]: fetch failed",
    "Rate limit exceeded, retry later"
  ].forEach(t => assert.ok(upstreamErrorInContent(t), "该判成线路错误：" + t.slice(0, 40)));
});

// 判据必须收得紧：角色本人用英文说话、或正文里刚好提到这些词，绝不许被拦下来
test("角色真的说话不许被误伤", () => {
  [
    '[{"name":"裴照川","text":"谁拐谁还不一定"}]',
    "Sorry, I could not submit that report to my editor in time.",
    "The prompt on my screen just blinked. I stared at it for a while.",
    "Error 404 是个梗，他昨天还拿这个笑我",
    // 长正文里提到 empty response from：短语判定只在 300 字以内启用
    "He said the response was empty. Empty response from a machine is still a kind of answer, "
      + "he shrugged, and went back to typing. ".repeat(4)
      + "这段是角色在讲故事，里面刚好提到了那句话，但它是正文不是线路错误。"
      + "他把咖啡放下，窗外的雨还在下，键盘声一下一下的，像在数着什么。".repeat(3)
  ].forEach(t => assert.equal(upstreamErrorInContent(t), "", "误伤了正文：" + t.slice(0, 40)));
});

test("三种协议分支都要过这一关，不许有一条漏网", () => {
  assert.equal((engine.match(/return assertNotUpstreamError\(t, model, callDiag\(model, _promptChars, maxTokens, _t0\)\);/g) || []).length, 3,
    "anthropic / gemini / openai 三条 return t 都要包上");
  assert.doesNotMatch(engine, /\n    return t;\n  \}\n  if \(fmt === "gemini"\)/, "anthropic 那条别漏");
  const fn = engine.slice(engine.indexOf("function assertNotUpstreamError"),
                          engine.indexOf("function assertNotUpstreamError") + 700);
  assert.match(fn, /不是模型写的正文/, "报错要点破方向：不是模型不听话，是线路没跑起来");
  assert.match(fn, /换条线路或换个模型再试/, "要说下一步怎么办");
  assert.match(fn, /slice\(0, 300\)/, "原文要给够，40 字什么都读不出来");
});

test("群聊那条失败提示不再把原文砍到 40 字", () => {
  const i = app.indexOf("模型没按 JSON 数组输出");
  const line = app.slice(i - 120, i + 260);
  assert.match(line, /t\.slice\(0, 200\)/);
  assert.doesNotMatch(line, /t\.slice\(0, 40\)/);
});

// 她 2026-08-25 追报：flash 只有【第一轮】失败，第二轮开始就没问题。
// 上游是个黑盒，不该继续猜；她在手机上也看不到 console，只能看气泡。
// 所以每条失败都带上「发了多大、等了多久」——下次再失败一眼就能定性。
test("失败时要报清楚这一次到底发了多大、等了多久", () => {
  const seg2 = engine.slice(engine.indexOf("function callDiag"), engine.indexOf("function assertNotUpstreamError"));
  const callDiag = new Function(seg2 + "\nreturn callDiag;")();
  const fast = callDiag("gemini-2.5-flash", 15200, 5900, Date.now() - 800);
  assert.match(fast, /gemini-2\.5-flash/);
  assert.match(fast, /提示词约 15k 字/);
  assert.match(fast, /输出上限 5900 tok/);
  assert.match(fast, /上游直接打回来了/, "秒失败要判成打回，不是超时");
  const slow = callDiag("gemini-2.5-flash", 15200, 5900, Date.now() - 47000);
  assert.match(slow, /像超时或冷启动/);
  assert.doesNotMatch(slow, /上游直接打回来了/);
});

test("「模型返回为空」那三处也要带诊断，不然只剩一句空话", () => {
  assert.equal((engine.match(/callDiag\(model, _promptChars, maxTokens, _t0\)/g) || []).length, 6,
    "3 处 return + 3 处返回为空");
  // 提示词规模必须把 system 和 messages 都算上，只算一头会看不出真实体量
  assert.match(engine, /const _promptChars = String\(system \|\| ""\)\.length/);
  assert.match(engine, /reduce\(\(n, m\) => n \+ String\(\(m && m\.content\) \|\| ""\)\.length, 0\)/);
});
