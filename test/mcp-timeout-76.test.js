const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const s = fs.readFileSync("js/mcp.js", "utf8");
test("转接和直连都有超时，被挡时不会一直「测试中」", () => {
  assert.match(s, /const WAIT_MS = 45000;/);
  assert.match(s, /r = await fetchT\(rl\.url,/);
  assert.match(s, /r = await fetchT\(srv\.url,/);
  assert.ok(!/await fetch\(/.test(s.replace("return await fetch(url", "")), "还有没超时的 fetch");
});
