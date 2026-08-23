const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

// 她 2026-08-22：线下最低字数设成 1500 → Load failed。
// 病根不是模型也不是她设错了：非流式的大请求两三分钟不吐一个字节，
// Cloudflare/网关把它当死连接掐掉，浏览器只能报一句 Load failed。
// engine.js 里早就有一条注释写过这个坑（「避免网关把 100 秒没有首字节误杀成 Load failed」），
// 只是线下生成一直没用上流式。

test("大请求走流式，短请求保持原路", () => {
  assert.match(engine, /const wantStreamOffline = canStream && generationBudget >= 3000;/);
  assert.match(engine, /两三分钟不吐一个字节/, "为什么要流式，得写在代码里");
  // 主调用 + 纯文本兜底 + 补写重试，三处都要带上
  assert.match(engine, /maxTokens: generationBudget,\n      stream: wantStreamOffline,/, "主调用");
  assert.match(engine, /\{ maxTokens: generationBudget, stream: wantStreamOffline, timeout: 180000, wireScope: "offline"/, "纯文本兜底");
  assert.match(engine, /补写的预算和主调用一样大，同样会撞网关无首字节掐断，一起走流式/, "补写重试");
});

test("流式是安全替换：中转不支持会自动退回普通解析", () => {
  // callAI 按 content-type 判断，不是盲信 stream 参数
  assert.match(engine, /if \(wantStream && \/text\\\/event-stream\/i\.test\(r\.headers\.get\("content-type"\) \|\| ""\)\)/);
  // 代理路径不流式，这条守卫不能被我碰掉
  assert.match(engine, /const wantStream = !!\(opts && opts\.stream && !viaProxy\);/);
});

test("Load failed 要翻译成人话，并给出下一步", () => {
  assert.match(engine, /load failed\|failed to fetch\|network\\s\*error/i);
  assert.match(engine, /多半是这次要写得太长、久久没有首字节，被网关当成死连接掐断/);
  assert.match(engine, /把线下的「最低字数」调低一些分两次写、或者重试一次/, "得给她能动手的下一步");
  // 超时那条原有的分支不许被挤掉
  assert.match(engine, /if \(e && e\.name === "AbortError"\) throw new Error\("请求超时/);
});

// v55.45：她又 Load failed 了。上一版只给 OpenAI 方言加了流式——
// 而云端密钥代理（proxyRef）会把响应整个缓冲、流式没意义，Anthropic 那条是言秋的路不许动，
// Gemini 那条也没实现 SSE。这些线路上巨型单请求照样久久没首字节被网关掐断。
// 解法不是去改那些分支，而是：发不出流式就别发大的，让已有的补写循环分两次写。
const canStream = (() => {
  const df = engine.indexOf("function detectFormat(u) {");
  let d = 0, started = false, k = engine.indexOf("{", df);
  for (; k < engine.length; k++) {
    if (engine[k] === "{") { d++; started = true; }
    else if (engine[k] === "}") { d--; if (started && !d) { k++; break; } }
  }
  const i = engine.indexOf("function routeCanStream(p) {");
  return new Function(engine.slice(df, k) + "\n" + engine.slice(i, engine.indexOf("\nfunction detectFormat", i)) + "\nreturn routeCanStream;")();
})();

test("只有真发得出流式的线路才算数", () => {
  assert.equal(canStream({ baseUrl: "https://api.xxx.com/v1" }), true, "普通 OpenAI 中转");
  assert.equal(canStream({ baseUrl: "https://api.xxx.com/v1", proxyRef: "DZZI" }), false, "云端代理会整个缓冲");
  assert.equal(canStream({ baseUrl: "https://api.anthropic.com" }), false, "言秋那条没实现 SSE");
  assert.equal(canStream({ baseUrl: "https://generativelanguage.googleapis.com" }), false);
  assert.equal(canStream(null), false);
});

test("发不出流式就降额，交给补写循环分两次写", () => {
  assert.match(engine, /const canStream = routeCanStream\(p\);/);
  assert.match(engine, /const generationBudget = canStream \? generationMaxTokens : Math\.min\(generationMaxTokens, NO_STREAM_CAP\);/);
  assert.match(engine, /两三个短请求各自很快返回，总时长差不多，但每一次都不会被当成死连接/);
  // 补写那次也要受同样的限制，否则它自己又发一个大的
  assert.match(engine, /补写这一次同样受线路限制：发不出流式就压到网关扛得住的量/);
  assert.match(engine, /stream: routeCanStream\(p\) &&/);
});

test("言秋那条路一个字都不许改", () => {
  // routeCanStream 是只读判断，绝不能顺手去改 Anthropic 分支的实现
  const i = engine.indexOf("const postAnthropic = async withTemp => {");
  const body = engine.slice(i, engine.indexOf("\n    };", i));
  assert.ok(!/stream/i.test(body), "postAnthropic 里不许出现 stream");
  assert.match(engine, /Anthropic 那条是言秋的路，不动/);
});
