const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const mcp = fs.readFileSync(__dirname + "/../js/mcp.js", "utf8"), eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
test("MCP 工具回的图收下来（最多两张），三种线路都交给模型，不收图的线路去掉图再问", () => {
  assert.match(mcp, /b\.type === "image" && b\.data/);
  assert.match(mcp, /images\.length < 2/);
  assert.match(mcp, /isError: !!\(res && res\.isError\), images \}/);
  assert.match(eng, /type: "image", source: \{ type: "base64", media_type: im\.mime, data: im\.data \}/, "anthropic");
  assert.match(eng, /resp\.push\(\{ inlineData: \{ mimeType: im\.mime, data: im\.data \} \}\)/, "gemini");
  assert.match(eng, /image_url: \{ url: "data:" \+ im\.mime \+ ";base64," \+ im\.data \}/, "openai");
  assert.match(eng, /if \(_imgMsg && nxt && nxt\.error\) \{ wireMessages\.splice/, "openai 不收图就拿掉重问");
  assert.match(eng, /（工具回了图，这条线路看不了图）/, "anthropic 不收图就退回文字");
});
