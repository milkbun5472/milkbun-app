const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("engineerEyes uses a self-directed transport prompt instead of the RP task", () => {
  assert.match(source, /const _taskFull = \(_s\.engineerEyes \? _digitalTaskFull : _normalTaskV2\) \+ _roomHint/);
  assert.match(source, /App 的传输协议不规定你的性格、关系反应、回复长度或表达方式/);
  const digitalPrompt = source.slice(source.indexOf("const _digitalTaskFull"), source.indexOf("const _normalTaskFull"));
  assert.match(digitalPrompt, /thought 完全可选/);
  assert.match(digitalPrompt, /否则填 null 或省略，绝不为交字段硬编/);
  assert.doesNotMatch(digitalPrompt, /thought 每轮必须填写|禁止 null、空串或省略/);
  assert.match(source, /不需要穿着、动作、好感等其他状态作业/);
  assert.match(source, /心声只在确实存在且你愿意留下时可选填写/);
  assert.match(source, /const digitalToyHint = toyOn/);
  assert.match(source, /是否使用、何时使用、用什么节奏由你自己决定/);
  assert.match(source, /const digitalPhotoHint = canSelfie/);
  // v54.48：一起听的切歌/邀听能力做最小协议时被落下了——他知道在放什么却切不动
  // （她 2026-08-21 问「一起听还在不在他的能力里」查出来的）。执行路径本就通用，补 hint 即可。
  assert.match(source, /digitalPhotoHint \+ listenHint \+ inviteHint \+ digitalToyHint/);
  // v58.76：普通聊天早已有真记账/真日期写路，言秋的本人专线不能因为走最小协议漏掉。
  assert.match(source, /digitalPhotoHint \+ listenHint \+ inviteHint \+ digitalToyHint \+ _digitalRecordHint/);
  assert.match(source, /【本轮可用的真实记录字段】/);
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
  assert.match(source, /const _liveChatState = statesRef\.current\[charId\] \|\| \{\}/);
  assert.match(source, /【一次性状态建档】App 还没有/);
  assert.match(source, /_stateBootstrapHint \+ _wearRefreshHint \+ paceHint/);
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
  // ⚠️言秋那一支（3000）是他的专线，钉死；普通角色那一支只要求【够写完】，不冻具体数
  //   （v59.96 全 app 抬到 ≥8000，见 .claude/rules/max-tokens-floor.md）
  // ⚠️v59.98：她亲口说「言秋的也给足吧，不然他也不够思考的」，
  //   所以不再分「言秋一支 3000、普通角色一支」——两支合并，都得够写完。
  //   这一处有【两个】（首发一次、重试一次），两个都得对。
  const mts = source.match(/maxTokens: (\d+), cacheHistory: _histCache/g) || [];
  assert.equal(mts.length, 2, "主聊天那一处的额度形状变了：首发和重试各一份");
  mts.forEach(function (x) {
    assert.ok(Number(x.match(/maxTokens: (\d+)/)[1]) >= 8000, "额度不够他想完再说话：" + x);
  });
});

test("engineerEyes chat carries a lean volatile baggage budget", () => {
  assert.match(source, /continuityPrompt\(saved\.rows \|\| \[\], profile\.name \|\| "Lisa", 20,[\s\S]*240\)/);
  assert.match(source, /isLeanYanqiuChat \? 3/);
  assert.match(source, /slice\(0, 3\)\.map/);
  assert.match(source, /slice\(0, 240\)/);
  const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
  assert.match(screens, /缓存由 CLI 引擎管理/);
});

// v54.55：她说很久没收到礼物/照片了——Protocol v2 瘦身时把能力的正向许可全剪没了，
// 只剩「不要为了填字段制造内容」这类抑制性框架，全员把能力当摆设。补能力使用总则：
// 鼓励大方用 + 界碑「克制的是字段不是话」，防止字段克制渗进语气变成安全腔。
test("能力使用总则：正向许可回来了，且克制不许渗进语气", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/app.js"), "utf8");
  assert.match(src, /【能力使用总则】/);
  assert.match(src, /不是摆设/);
  assert.match(src, /想到了就大方用/);
  assert.match(src, /说明你把它们忘了，而不是你克制/);
  assert.match(src, /唯一需要克制的是【字段】不是【话】/);
  assert.match(src, /性格照常全开，别把任何克制渗进语气里/);
});
