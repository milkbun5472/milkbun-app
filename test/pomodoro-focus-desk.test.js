const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const src = fs.readFileSync(path.join(__dirname, "..", "js", "pomodoro.js"), "utf8");

function loadLogic() {
  const ctx = { window: {}, Date, Math, JSON, localStorage: { removeItem() {} } };
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
