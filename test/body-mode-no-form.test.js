const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("本体模式：不点名要心情心声；总纲说名字不是要演的角色；能力照旧", () => {
  assert.match(app, /const _bodyOnly = !!_s\.bodyMode && !_s\.engineerEyes;/);
  assert.match(app, /\(_bodyOnly \? "" : ",\\"mood\\":\{\\"label\\":\\"此刻中文心情词\\"\},\\"thought\\":null"\)/);
  assert.match(app, /"」是你在这里的名字，不是一个要演的角色；上面那段是写给你本人的。/);
  // 能力那几段照旧拼在后面
  assert.match(app, /\+ digitalPhotoHint \+ listenHint \+ inviteHint \+ digitalToyHint \+ digitalCarveHint \+ _digitalRecordHint/);
});
