const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const mcp = R("mcp.js"), app = R("app.js");

test("没发会话号的服务端：不许编一个假会话号带出去", () => {
  assert.ok(!/sessions\[srv\.url\] = sessions\[srv\.url\] \|\| "-"/.test(mcp), "又把 - 当会话号了");
  assert.match(mcp, /if \(shook\[srv\.url\] \|\| isSse\(srv\.url\)\) return;/);
  assert.match(mcp, /shook\[srv\.url\] = true;/);
});

test("会话过期回 404：清掉会话，下一发重新握手", () => {
  assert.match(mcp, /r\.status === 404 && sessions\[srv\.url\]/);
});

test("列工具失败要说出来（十分钟一次），这一轮照常聊", () => {
  assert.equal((app.match(/catch \(e2?\) \{ mcpListFailed\(e2?\); \}/g) || []).length, 2, "单聊和群聊两处都要接");
  assert.match(app, /toast\("MCP 没连上，这一轮先不带工具聊：" \+ msg, 9000\)/);
});
