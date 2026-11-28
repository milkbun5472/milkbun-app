const test = require("node:test"), assert = require("node:assert"), fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("重roll 把这一轮贴在她气泡上的表情一起撤（单聊、群聊）", () => {
  assert.match(app, /theirStick: \{ \.\.\._st, ts: Date\.now\(\), turnId \}/);
  assert.match(app, /const next=\(_keepAlt \? rerollStash\(liveBranch\.after, _keepAlt\) : liveBranch\.after\)\.map\(_unStick\);/);
  assert.match(app, /by: spk\.id, name: spk\.name, ts: Date\.now\(\) \}/);
  assert.match(app, /\.map\(_gUnStick\);/);
});
test("贴上去的表情包地址过 stickerSrc，本机存的不裂图", () => {
  assert.match(comp, /"data-wk": "msgstick", ref: msgStickFit, "data-out": outside \? "1" : undefined, src: stickerSrc\(st\.url\)/);
});
