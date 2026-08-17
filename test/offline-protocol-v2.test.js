const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

test("ordinary single offline uses short narrative runtime and protocol v2", () => {
  assert.match(engine, /const OFFLINE_NARRATIVE_RUNTIME = `【线下叙事 · 自然生成准则】/);
  assert.match(engine, /const OFFLINE_PROTOCOL_V2 = `【线下生成与输出】/);
  assert.match(engine, /buildBundle\(ctx\) \+\s*"\\n\\n" \+ OFFLINE_NARRATIVE_RUNTIME/);
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
  assert.doesNotMatch(single, /"\\n\\n" \+ OFFLINE_INTIMATE_RUNTIME/);
  assert.doesNotMatch(engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "", /"\\n\\n" \+ NARRATIVE_ANTI_CLICHE/);
  assert.match(engine, /const singlePassRevisionRequested = !isDigital && !!rewriteRequested/);
  assert.match(engine, /draftScene = String\(singlePassRevisionRequested \? parsed\.draftScene/);
  assert.match(engine, /let scene = singlePassRevisionRequested \? singlePassFinalScene : draftScene/);
  assert.doesNotMatch(single, /await offlineRewriteScene\(/);
  assert.match(engine, /registerTransition\.inputBeat && !!registerTransition\.active/);
  assert.match(engine, /if \(!draftScene\) throw new Error/);
});

test("legacy narrative bans remain archived while group offline still uses them", () => {
  assert.match(engine, /const NARRATIVE_ANTI_CLICHE_LEGACY_V1 = `/);
  assert.match(engine, /const INTIMATE_ANTI_CLICHE_LEGACY_V1 = `/);
  assert.match(engine, /const INTIMATE_ANTI_CLICHE = INTIMATE_ANTI_CLICHE_LEGACY_V1/);
  assert.match(engine, /const NARRATIVE_ANTI_CLICHE = NARRATIVE_ANTI_CLICHE_LEGACY_V1/);
  const group = engine.match(/async function generateOfflineGroup\([\s\S]*?async function summarizeOfflineGroup/)?.[0] || "";
  assert.match(group, /INTIMATE_ANTI_CLICHE/);
  assert.match(group, /NARRATIVE_ANTI_CLICHE/);
});

test("intimacy context has explicit activation, continuity and reset gates", () => {
  assert.match(engine, /function offlineIntimacyContextActive\(session\)/);
  assert.match(engine, /const explicit = \/接吻/);
  assert.doesNotMatch(engine.match(/const explicit = \/[\s\S]*?\/i;/)?.[0] || "", /拥抱|牵手/);
  assert.match(engine, /const reset = \/第二天/);
  assert.match(engine, /4 \* 3600000/);
  assert.match(engine, /after\.length <= 3/);
});

test("single offline keeps intimacy state but intentionally injects no dedicated runtime", () => {
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
  assert.match(single, /const intimacyContextActive = !isDigital && offlineIntimacyContextActive\(session\)/);
  assert.doesNotMatch(single, /intimacyContextActive\s*\?/);
  assert.doesNotMatch(single, /OFFLINE_INTIMATE_RUNTIME/);
});

test("intimacy runtime stays a domain-neutral scene continuity patch", () => {
  const runtime = engine.match(/const OFFLINE_INTIMATE_RUNTIME = `([\s\S]*?)`;/)?.[1] || "";
  assert.match(runtime, /【场景连续补充】/);
  assert.match(runtime, /不因身体距离或互动性质变化而切换文体/);
  assert.match(runtime, /按实际动作直接、准确地写清楚/);
  assert.match(runtime, /不额外回避已经成立的事实/);
  assert.match(runtime, /不要把一个连续动作逐拍拆开/);
  assert.match(runtime, /遇到需要对方作出新的选择时再停下/);
  assert.doesNotMatch(runtime, /成人文|性张力|性感|情色|刺激|生理升级|呼吸紊乱|青筋|沙哑|咬牙|失控/);
});

test("offline null state semantics preserve durable state and clear stale thought", () => {
  assert.match(app, /if \(res\.wearing\) \{ ost\.wearing = res\.wearing; ost\.wearingUpdatedAt = stateNow; \}/);
  assert.match(app, /if \(offlineAction\) \{ ost\.action = offlineAction; ost\.actionUpdatedAt = stateNow; \}/);
  assert.match(app, /if \(offlineThought\) \{ ost\.thought = offlineThought; ost\.thoughtUpdatedAt = stateNow; ost\.thoughtSkips = 0; \}/);
  assert.match(app, /else if \(liveState\.thought\) \{ ost\.thought = null; ost\.thoughtUpdatedAt = 0; \}/);
  assert.match(app, /if \(res\.mood && res\.mood\.label\) setMoodFor/);
  assert.match(app, /Number\.isFinite\(res\.affinityDelta\)/);
  assert.match(engine, /action 仅在角色当前可持续的活动或所处状态发生有意义变化时填写/);
});

test("ordinary single offline establishes missing durable state exactly once", () => {
  assert.match(app, /const currentOfflineState = statesRef\.current\[charId\] \|\| \{\}/);
  assert.match(app, /oCtx\.curWear = freshLiveStateValue\(currentOfflineState, "wearing"\)/);
  assert.match(app, /oCtx\.curAction = freshLiveStateValue\(currentOfflineState, "action"\)/);
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
  assert.match(single, /const missingStateFields = \[\]/);
  assert.match(single, /!isDigital && !String\(ctx\.curWear \|\| ""\)\.trim\(\)/);
  assert.match(single, /!isDigital && !String\(ctx\.curAction \|\| ""\)\.trim\(\)/);
  assert.match(single, /【一次性状态建档】/);
  assert.match(single, /outputSpec \+ stateBootstrapHint/);
});

test("wearing and action expire independently instead of becoming permanent facts", () => {
  assert.match(app, /const LIVE_STATE_TTL = \{ wearing: 18 \* 3600000, action: 3 \* 3600000, thought: 90 \* 60000, place: 3 \* 3600000 \}/);
  assert.match(app, /state\[field \+ "UpdatedAt"\]/);
  assert.match(app, /age >= 0 && age <= LIVE_STATE_TTL\[field\]/);
});

test("single offline latest-user tail no longer repeats the legacy ban checklist", () => {
  assert.match(engine, /〔本轮线下〕保持当前场景、人物位置、物件和状态连续/);
  assert.match(engine, /上一版只是需要避开的候选，不属于已经发生的剧情/);
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
  assert.doesNotMatch(single, /比喻限额·最要紧/);
  assert.doesNotMatch(single, /像只大型犬/);
  assert.doesNotMatch(single, /喉结滚动/);
});

// 小剧场自由发挥的多样性(2026-08-18 Lisa:空关键词生成仍大同小异)。
// 题材骰子本来就在转,但张力核心是写死的四选一(旧账/秘密/对立/欠债),
// 全是阴谋味,题材换了情绪形状没换——所以张力与基调也必须入骰。
test("取景骰子必须覆盖张力性质与基调，且题材只掷一个", () => {
  const th = fs.readFileSync(path.join(__dirname, "..", "js", "theater.js"), "utf8");
  assert.match(th, /const POOL_TENSION = \[/, "张力性质要入骰");
  assert.match(th, /const POOL_TONE = \[/, "基调要入骰");
  assert.match(th, /题材:" \+ pick\(POOL_GENRE\)/, "题材单掷,不给三选一的逃跑余地");
  assert.doesNotMatch(th, /pick3\(POOL_GENRE\)/, "旧的三选一必须已移除");
  assert.match(th, /【基调决定味道,不决定重量】/, "基调不得被读成可以把目标写软");
  assert.doesNotMatch(th, /一段未清算的过去、一个不能说的秘密、互相冲突的立场、一笔没还清的债/,
    "写死的阴谋味张力配方必须已解绑");
});

// 目标尺度(2026-08-18 Lisa 拿商业乙游关卡对照):那边的目标是「让他喂你吃排骨」
// 「让他同意你帮他换衬衫」这类日常小动作,却一点不轻——重量来自处境。
// 原先写死的「禁止事务级小目标」把整类好目标一刀切了。
test("目标契约共用一份，且允许日常尺度", () => {
  const th = fs.readFileSync(path.join(__dirname, "..", "js", "theater.js"), "utf8");
  assert.match(th, /const GOAL_RULE = /, "四处生成必须共用一份目标契约");
  assert.equal((th.match(/【门槛的重量来自处境,不来自动作大小】/g) || []).length, 1);
  assert.match(th, /【目标必须具体、可判定】/, "小目标更要可判定，否则达成判断会飘");
  // 该短语只允许留在注释里（记录为什么废掉），不许再出现在任何提示词字符串中
  const banLines = th.split("\n").filter(l => l.includes("禁止事务级小目标"));
  assert.equal(banLines.length, 1, "一刀切的禁令只该剩注释那一处");
  assert.match(banLines[0].trim(), /^\/\//, "剩下那处必须是注释，不是提示词");
  assert.equal((th.match(/GOAL_RULE/g) || []).length, 5, "一处定义 + 四处引用，不许再各写各的");
});
