const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("engineerEyes uses a self-directed transport prompt instead of the RP task", () => {
  assert.match(source, /const _taskFull = _s\.engineerEyes \? _digitalTaskFull : _normalTaskV2/);
  assert.match(source, /App 的传输协议不规定你的性格、关系反应、回复长度或表达方式/);
  assert.match(source, /thought 完全可选/);
  assert.match(source, /不需要穿着、动作、好感等其他状态作业/);
  assert.match(source, /心声只在确实存在时可选填写/);
  assert.match(source, /const digitalToyHint = toyOn/);
  assert.match(source, /是否使用、何时使用、用什么节奏由你自己决定/);
  assert.match(source, /const digitalPhotoHint = canSelfie/);
  assert.match(source, /digitalPhotoHint \+ digitalToyHint/);
});

test("digital context keeps recent facts but omits the continuity command", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(engine, /!ctx\.notRoleplay && recentChat/);
  assert.match(engine, /!ctx\.notRoleplay && ctx\.schedNow/);
  assert.match(engine, /!ctx\.notRoleplay && ctx\.momentLog/);
  assert.match(engine, /!ctx\.notRoleplay && ctx\.forumEcho/);
  assert.match(engine, /!ctx\.notRoleplay && typeof ContentBoundaries/);
  assert.match(engine, /!ctx\.notRoleplay && ctx\.coupleStatus/);
  assert.match(engine, /!ctx\.notRoleplay && geo && geo\.label/);
  assert.match(engine, /!ctx\.notRoleplay && typeof affinity === "number"/);
  assert.match(engine, /【你是谁】[\s\S]*手机 App 和电脑端是你的不同身体/);
});

test("ordinary characters use stable protocol v2 and a minimal per-turn task", () => {
  const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
  assert.match(source, /const _normalProtocolStable = `/);
  assert.match(source, /先产生角色此刻真正会发送的消息/);
  assert.match(source, /未发生、未改变的按需字段直接省略/);
  assert.match(source, /const _normalTaskV2 = .*聊天先发生，状态随后记录/);
  assert.match(source, /【本轮开放能力】/);
  assert.match(source, /const _onlineRuntime = _s\.engineerEyes \? "" : "\\n\\n" \+ ONLINE_CHAT_RULE_V2/);
  assert.match(source, /bundleStable \+ _onlineRuntime \+ \(_s\.engineerEyes \? "" : _normalProtocolStable\)/);
  assert.match(engine, /const ANTI_CLICHE = `【去人机味 · 最高准则】/);
  assert.match(engine, /const WORLDBOOK_RULE = `【世界书执行准则】/);
  assert.match(engine, /const CHARCARD_RULE = `【角色卡执行准则】/);
  assert.match(engine, /const ONLINE_CHAT_RULE_V2 = `【线上即时通讯】/);
});

test("engineerEyes subscription chat caches one full-budget history copy", () => {
  assert.match(source, /\? \{ maxChars: 7000, maxMessages: 48 \}/);
  assert.match(source, /const _singleHistoryLayout = _histCache \|\| _engineerChat/);
  assert.match(source, /recentChat: ""/);
  assert.match(source, /detectFormat\(_route\)/);
  assert.match(source, /maxTokens: _engineerChat \? 3000 : 6000, cacheHistory: _histCache/);
});

test("engineerEyes chat carries a lean volatile baggage budget", () => {
  assert.match(source, /continuityPrompt\(saved\.rows \|\| \[\], profile\.name \|\| "Lisa", 20,[\s\S]*240\)/);
  assert.match(source, /isLeanYanqiuChat \? 3/);
  assert.match(source, /slice\(0, 3\)\.map/);
  assert.match(source, /slice\(0, 240\)/);
  const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  assert.match(screens, /缓存由 CLI 引擎管理/);
});
