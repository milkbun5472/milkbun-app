const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("image api can post to chat/completions", () => {
  assert.match(eng, /apiFormat: "auto"/);
  assert.match(eng, /root \+ "\/chat\/completions"[\s\S]{0,300}modalities: \["image", "text"\]/);
  assert.match(eng, /a\.apiFormat === "chat"\) r = await chatFetch\(\)/);
  assert.match(eng, /r\.status === 404 \|\| r\.status === 405\)\) r = await chatFetch\(\)/);
  assert.match(scr, /value: "chat" \}, "聊天接口 \/chat\/completions"/);
});
test("empty chat reply retries as stream and stitches SSE", () => {
  assert.match(eng, /usedChat && r\.ok[\s\S]{0,300}chatFetch\(true, c2\.signal\)[\s\S]{0,120}sseToJson\(raw2\)/);
  assert.match(eng, /const sseToJson = raw =>/);
});
