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
  assert.match(engine, /draftScene = String\(parsed\.scene \|\| sp\.clean \|\| ""\)\.trim\(\)/);
  assert.match(engine, /let scene = draftScene/);
  assert.match(engine, /scene = await offlineRewriteScene/);
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
  assert.match(app, /if \(res\.wearing\) ost\.wearing = res\.wearing/);
  assert.match(app, /if \(res\.action\) ost\.action = res\.action/);
  assert.match(app, /if \(res\.thought\) ost\.thought = res\.thought;\s*else if \(liveState\.thought\) ost\.thought = null/);
  assert.match(app, /if \(res\.mood && res\.mood\.label\) setMoodFor/);
  assert.match(app, /Number\.isFinite\(res\.affinityDelta\)/);
  assert.match(engine, /action 仅在角色当前可持续的活动或所处状态发生有意义变化时填写/);
});

test("ordinary single offline establishes missing durable state exactly once", () => {
  assert.match(app, /const currentOfflineState = statesRef\.current\[charId\] \|\| \{\}/);
  assert.match(app, /oCtx\.curAction = currentOfflineState\.action \|\| ""/);
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
  assert.match(single, /const missingStateFields = \[\]/);
  assert.match(single, /!isDigital && !String\(ctx\.curWear \|\| ""\)\.trim\(\)/);
  assert.match(single, /!isDigital && !String\(ctx\.curAction \|\| ""\)\.trim\(\)/);
  assert.match(single, /【一次性状态建档】/);
  assert.match(single, /outputSpec \+ stateBootstrapHint/);
});

test("single offline latest-user tail no longer repeats the legacy ban checklist", () => {
  assert.match(engine, /〔本轮线下〕保持当前场景、人物位置、物件和状态连续/);
  assert.match(engine, /上一版只是需要避开的候选，不属于已经发生的剧情/);
  const single = engine.match(/async function generateOffline\([\s\S]*?async function summarizeOffline/)?.[0] || "";
  assert.doesNotMatch(single, /比喻限额·最要紧/);
  assert.doesNotMatch(single, /像只大型犬/);
  assert.doesNotMatch(single, /喉结滚动/);
});
