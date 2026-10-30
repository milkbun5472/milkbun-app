// 她 2026-10-29：「本体模式搞个开关可以拆气泡的吧，然后注释改一下，开了也会提醒 ai 分气泡」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("本体模式「拆成短气泡」：开关存得下、拆泡放行、提示词改说一句一条", () => {
  assert.match(comp, /const \[bodySplit, setBodySplit\] = useState\(settings\.bodySplit === true\);/);
  assert.match(comp, /h\(Toggle, \{ on: bodySplit, onChange: \(\) => setBodySplit\(v => !v\) \}\)/);
  assert.match(comp, /默认每次回一整条长消息（想要短气泡，打开下面「拆成短气泡」）/, "说明改了");
  assert.match(app, /bodySplit: s\.bodySplit === true,/);
  assert.match(app, /const _oneLong = !!_s\.bodyMode && !_s\.engineerEyes && _s\.bodySplit !== true;/);
  assert.match(app, /把你要说的拆成几条短消息发：word 里一句一条，像发微信那样连着发。/);
  assert.match(app, /"你想说的话，一句一条"/);
});
