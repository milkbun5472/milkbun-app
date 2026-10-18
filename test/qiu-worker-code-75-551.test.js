// 秋秋能发现成的 Worker 代码（她 2026-10-13）：模型只报哪一段，代码从 App 里原样取
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "../js/assistant.js"), "utf8");
test("code 字段只认 health / fish，代码取自 HealthCtx.GATEWAY_WORKER 和 FISH_RELAY_CODE", () => {
  assert.match(src, /health: \(\) => window\.HealthCtx && window\.HealthCtx\.GATEWAY_WORKER/);
  assert.match(src, /fish: \(\) => typeof FISH_RELAY_CODE === "string"/);
  assert.match(src, /const outFile = codeFile \|\|/);
  assert.match(src, /"code":"（可选）health \/ fish \/ mcp"/);
});
test("那两段代码真在：health.js 挂出去了、screens.js 是顶层常量", () => {
  assert.match((fs.readFileSync(path.join(__dirname, "../js/health-core.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../js/health.js"), "utf8")), /g\.HealthCtx = \{ GATEWAY_WORKER,/);
  assert.match((fs.readFileSync(path.join(__dirname, "../js/screens.js"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../js/screens-ui.js"), "utf8")), /^const FISH_RELAY_CODE = relayCodeFor\(/m);
});
test("MCP 转接也能发：跟设置里那颗同一份文件", () => {
  assert.match(src, /mcp: async \(\) => \{ try \{ const c = await \(await fetch\("tools\/mcp-relay-worker\.js"/);
  assert.match(src, /await WORKER_CODE\[codeKey\]\(\)/);
  assert.ok(fs.existsSync(path.join(__dirname, "../tools/mcp-relay-worker.js")));
});
