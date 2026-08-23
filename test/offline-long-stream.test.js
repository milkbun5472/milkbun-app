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
  assert.match(engine, /const wantStreamOffline = generationMaxTokens >= 3000;/);
  assert.match(engine, /两三分钟不吐一个字节/, "为什么要流式，得写在代码里");
  // 主调用 + 纯文本兜底 + 补写重试，三处都要带上
  assert.match(engine, /maxTokens: generationMaxTokens,\n      stream: wantStreamOffline,/, "主调用");
  assert.match(engine, /\{ maxTokens: generationMaxTokens, stream: wantStreamOffline, timeout: 180000, wireScope: "offline"/, "纯文本兜底");
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
