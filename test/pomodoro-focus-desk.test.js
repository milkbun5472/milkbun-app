const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "pomodoro.js"), "utf8");

function loadLogic(extra) {
  const ctx = { window: {}, Date, Math, JSON, localStorage: { removeItem() {} } };
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "pomodoro.js" });
  return ctx.window.PomodoroLogic;
}

test("计时锚定真实结束时间，切后台后不会停在旧秒数", () => {
  const logic = loadLogic();
  const s = { min: 25, startTs: 1_000, endTs: 1_501_000, pausedAt: null };
  assert.equal(logic.remainingSec(s, 301_000), 1200);
  assert.equal(logic.focusedSec(s, 301_000), 300);
});

test("暂停冻结剩余时间，恢复时把暂停时长顺延到 endTs", () => {
  const logic = loadLogic();
  const paused = { min: 25, startTs: 1_000, endTs: 1_501_000, pausedAt: 301_000 };
  assert.equal(logic.remainingSec(paused, 901_000), 1200);
  const resumed = logic.resumeSession(paused, 901_000);
  assert.equal(resumed.pausedAt, null);
  assert.equal(resumed.endTs, 2_101_000);
  assert.equal(logic.remainingSec(resumed, 901_000), 1200);
});

test("安静同桌不换纸条，其他模式只在进度节点换", () => {
  const logic = loadLogic();
  const base = { min: 20, pack: {}, mode: "quiet" };
  assert.equal(logic.noteIndex(base, 1200), 0);
  assert.equal(logic.noteIndex(base, 30), 0);
  assert.equal(logic.noteIndex({ ...base, mode: "notes" }, 550), 1);
  assert.equal(logic.noteIndex({ ...base, mode: "notes" }, 300), 2);
});

test("新玩法不再生成退出暗号，也不轮播催促文案", () => {
  assert.doesNotMatch(src, /password|wrongPass|normPass|trySubmit|setLineIdx|7000/);
  assert.match(src, /你不是监督员，也不要把专注写成服从测试/);
  assert.match(src, /安静同桌/);
  assert.match(src, /偶尔递纸条/);
  assert.match(src, /节点提醒/);
});

test("当前场次持久化，记录实际专注与正常收桌原因", () => {
  assert.match(src, /x_pomodoro_active/);
  assert.match(src, /persistSession\(next\)/);
  assert.match(src, /focusedMinutes/);
  assert.match(src, /interruptReason/);
  assert.match(src, /"中间停了"/);   // v61.40 结算改成单据口吻
  assert.match(src, /临时有事/);
  assert.match(src, /今天先到这里/);
});

test("准备页和记录页复用标准 Head，正文只有一个主滚动区", () => {
  // v61.40：标题不留英文（施工规则/no-english-titles.md），记录页也改了名
  assert.match(src, /h\(Head, \{ zh: "番茄钟", onBack: props\.onBack/);
  assert.match(src, /h\(Head, \{ zh: "坐过的那些", onBack: \(\) => setView\("setup"\)/);
  assert.match(src, /flex-1 min-h-0 overflow-y-auto px-6/);
  assert.match(src, /safe-area-inset-bottom\) \* 0\.4/);
});

test("三种模式的轻戳字幕兼容旧场次，报时使用真实剩余时间", () => {
  const { companionSubtitle } = loadLogic();
  const base = { task: "校稿", min: 25, endTs: 1501000, pack: { notes: ["开场", "半程", "收尾"], taps: ["回应一", "回应二"], pause: "留座" } };
  assert.equal(companionSubtitle({ ...base, mode: "quiet" }, 1200, 1, "tap").text, "回应二");
  assert.equal(companionSubtitle({ ...base, mode: "quiet" }, 100, 0, "node").text, "开场");
  assert.equal(companionSubtitle({ ...base, mode: "notes" }, 600, 0, "node").text, "半程");
  assert.equal(companionSubtitle({ ...base, mode: "checkpoints" }, 1200, 0, "tap").label, "已专注 05:00 · 还剩 20:00");
  assert.equal(companionSubtitle({ ...base, mode: "notes", pausedAt: 301000 }, 1200, 0, "tap").text, "留座");
  const legacy = { ...base, mode: "quiet", pack: { notes: ["旧开场"] } };
  assert.equal(companionSubtitle(legacy, 1200, 0, "tap").text, "嗯，我在。");
  assert.equal(companionSubtitle({ ...legacy, pack: { taps: [null, {}, ""] } }, 1200, 0, "tap").text, "嗯，我在。");
});


test("补句沿共用角色上下文，携带已有纸条/类别/准确时间，暂停不算专注", async () => {
  const requests = [], bundle = { char: { id: "a", name: "甲", persona: "完整设定" }, recentChat: "近期对话原文", memory: "已有记忆", profile: { name: "读者" } };
  const logic = loadLogic({ runProbe: async (active, ctx, probe) => { requests.push({ ctx, probe }); return { lines: [" 新的一句 ", "旧纸条。", "新的一句！", "再聊一小段"] }; } });
  const s = { task: "校稿", category: "work", mode: "notes", min: 25, startTs: 1000, endTs: 1501000, pausedAt: 301000, pack: { notes: ["旧纸条"], taps: ["旧回应"], done: "尚未用的收桌话" }, extraLines: [{ id: "e", text: "上一批的话" }] };
  const lines = await logic.genMore({}, { bundle, uName: "读者", course: "稿件课" }, s, 901000);
  assert.deepEqual(Array.from(lines), ["新的一句", "再聊一小段"]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].ctx, bundle);
  const { probe } = requests[0];
  assert.equal(probe.once, true); assert.equal(probe.voiceScene, true); assert.equal(probe.maxTokens, 100000);
  for (const text of ["工作", "校稿", "稿件课", "05:00", "20:00", "已暂停", "旧纸条", "上一批的话", "尚未用的收桌话"]) assert.ok(probe.instruction.includes(text), text);
  assert.match(probe.instruction, /不能据此声称任务已经完成/);
});

test("补句去掉空项和整句重复，失败不伪装成新的固定台词", async () => {
  const logic = loadLogic({ runProbe: async () => ({ lines: [null, {}, "", "旧句。"] }) });
  assert.deepEqual(Array.from(logic.uniqueCompanionLines([null, "新话", "新话！", "  ", "旧句。"], ["旧句"])), ["新话"]);
  await assert.rejects(logic.genMore({}, { uName: "读者" }, { min: 25, endTs: 1501000, task: "阅读", pack: { notes: ["旧句"] } }, 301000), /没有取到新的回应/);
});

test("补出的新话进入轻戳轮次，用独立键回听，旧场次仍可用", () => {
  const logic = loadLogic();
  const s = { min: 25, mode: "notes", task: "校稿", pack: { taps: ["原回应"] }, extraLines: [{ id: "new-a", text: "补的一段" }, { id: "new-b", text: "另一段" }] };
  assert.equal(logic.companionSubtitle(s, 1200, 1, "tap").text, "补的一段");
  assert.equal(logic.companionSubtitle(s, 1200, 1, "tap").extraId, "new-a");
  assert.equal(logic.companionSubtitle(s, 1200, 2, "tap").key, "extra-new-b");
});
