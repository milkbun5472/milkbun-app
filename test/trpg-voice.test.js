// 跑团队友参考聊天口气（她 2026-11-04），跟小剧场同一份 stampVoice
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const t = fs.readFileSync(__dirname + "/../js/trpg.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("队友人设后面挂他平时说过的话，只借口气；app 传同一份", () => {
  assert.match(app, /screen === "trpg"\) body = h\(window\.TrpgApp, \{\n\s+voiceOf: char => stampVoice\(char\),/);
  assert.match(t, /String\(props\.voiceOf\(ch\) \|\| ""\)\.split\("\\n"\)\.slice\(1\)/);
  assert.match(t, /平时说话的样子\(只借口气,不引用里面发生过的任何事\)】/);
  assert.match(t, /\(ch \? personaOf\(ch\) : m\.name\) \+ \(voice \? "\\n" \+ voice\.trim\(\) : ""\)/);
});
