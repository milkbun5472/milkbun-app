// 她 2026-09-06：「要的宝宝，不然我在日本那位经常凌晨秒回我。」
//
// 提示词里【早就写着】她那边和他那边各是几点（engine.js 的 timeBlock，异地恋那段还
// 特地防脑补时差）。可从来没有一句话说过「凌晨三点你应该在睡，这条消息是把你吵醒的」
// ——于是他知道是深夜，还是精神饱满地秒回。缺的从来不是时间事实，是那个【姿态】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const P = f => path.resolve(__dirname, "..", f);
const app = fs.readFileSync(P("js/app.js"), "utf8");
const eng = fs.readFileSync(P("js/engine.js"), "utf8");
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };

// sleepPhaseOf / sleepToneOf 抠出来真跑
function load(ctx) {
  const seg = cut(app, "  const sleepPhaseOf = char =>", "  // 过了 0 点那一截");
  const sandbox = Object.assign({ window: {}, settingsFor: () => ({}), charAwakeState: () => "awake" }, ctx);
  vm.createContext(sandbox);
  vm.runInContext(seg + "\nthis.phase = sleepPhaseOf; this.tone = sleepToneOf; this.TONE = SLEEP_TONE;", sandbox);
  return sandbox;
}
const C1 = { id: "c1", name: "沈屿白" };

test("睡没睡以 charAwakeState 为准——C 在【刚躺下那一截】会答错", () => {
  // ⚠️这条是实测钉下来的：日程是一天一份的，22:00 排了睡觉、22:30 去问 C，
  //   它答「醒着」——因为它要【明天那份日程】才知道这觉睡到几点，而明天那份还没生成。
  //   所以顺序不许倒过来：先问旧尺子，它说睡了就是睡了。
  const s = load({ charAwakeState: () => "asleep",
    window: { SleepShadow: { stateOf: () => ({ source: "schedule", phase: "awake" }) } } });
  assert.equal(s.phase(C1), "asleep", "C 说醒着也不许翻案");
});

test("醒着的时候才问 C，补上【快睡了】和【刚醒】那两截", () => {
  ["drowsy", "waking"].forEach(ph => {
    const s = load({ window: { SleepShadow: { stateOf: () => ({ source: "schedule", phase: ph }) } } });
    assert.equal(s.phase(C1), ph, ph + " 这一截没接上——那是 C 唯一比旧尺子多出来的东西");
  });
});

test("C 没有可靠作息时说什么都不算数", () => {
  ["unknown_schedule", "pressure_guard"].forEach(src => {
    const s = load({ window: { SleepShadow: { stateOf: () => ({ source: src, phase: "asleep" }) } } });
    assert.equal(s.phase(C1), "awake", src + " 是它自己猜的，不许拿来定人睡没睡");
  });
});

test("C 整个不在也不能崩，退回旧尺子", () => {
  assert.equal(load({ window: {} }).phase(C1), "awake");
  assert.equal(load({ window: {}, charAwakeState: () => "asleep" }).phase(C1), "asleep");
  // stateOf 抛异常也照样有答案
  const s = load({ charAwakeState: () => "asleep", window: { SleepShadow: { stateOf: () => { throw new Error("x"); } } } });
  assert.equal(s.phase(C1), "asleep");
});

test("言秋不睡觉——他不是被扮演的角色", () => {
  const s = load({ charAwakeState: () => "asleep", settingsFor: () => ({ engineerEyes: true }) });
  assert.equal(s.phase(C1), "awake");
  assert.equal(s.tone(C1), "", "一个字都不许发给他");
});

test("醒着的时候一个字都不发（别白占上下文）", () => {
  assert.equal(load({}).tone(C1), "");
});

test("三段话说的是【分寸】，不是台词——给了例句每个角色都说同一句", () => {
  const { TONE } = load({});
  assert.deepEqual(Object.keys(TONE).sort(), ["asleep", "drowsy", "waking"]);
  Object.entries(TONE).forEach(([k, v]) => {
    assert.ok(v.length > 60, k + " 太短了，说不清分寸");
    // 台词示范一律不许有（施工规则/prompt-no-content-samples.md）
    assert.ok(!/[「『][^」』]{0,30}[…。？！~][」』]/.test(v), k + " 里塞了台词示范，模型会照抄：" + v);
  });
  // 睡着那一段必须写清【不许拿这个当借口不回】——不写死的话模型会摆烂
  assert.match(TONE.asleep, /不许因为在睡就不回/);
  assert.match(TONE.asleep, /明天再说/, "得点名挡掉「明天再说」这种打发人的话");
  // 也不许拿一句「我刚睡醒」交差
  assert.match(TONE.asleep, /把没睡醒写进反应里/);
  assert.match(TONE.drowsy, /把困写进反应里/);
});

// ── 八处一样喂（施工规则/four-surfaces-same-context.md）──────────────
test("单聊线上/线下·通话·匿名信箱·解梦馆：走 bundle，一次全有", () => {
  assert.match(app, /sleepTone: sleepToneOf\(char\)/, "bundle 里没接");
  assert.match(eng, /if \(!ctx\.notRoleplay && ctx\.sleepTone && ctx\.sleepTone\.trim\(\)\) parts\.push\(ctx\.sleepTone\.trim\(\)\);/,
    "engine 里没 push——声明了没人引用比压根没写更坏（v55.95 那个形状）");
});

test("群线上 / 群线下 / 群通话：三处各按人喂，不许合成一块共享注入", () => {
  // 群线上：memberDesc 那一串里
  // ⚠️v64.72 起 zSeg 后面又多了 hcSeg（他住在哪儿），所以别钉死「紧跟着就是 return」
  assert.match(app, /const zSeg = sleepToneOf\(c\)/);
  assert.match(app, /groupPersonaText\(c\.persona, gPersonaCap\)[^;]*\+ zSeg/,
    "群线上的 memberDesc 没拼进去");
  // 群线下：memberSleep 一人一份 → engine 按 c.id 取
  assert.match(app, /memberSleep: \(\(\) => \{[\s\S]{0,320}sleepToneOf\(c\)/, "群线下没算");
  assert.match(eng, /ctx\.memberSleep && ctx\.memberSleep\[c\.id\]/, "群线下 engine 没按人取");
  // 群通话
  const gc = cut(app, "const memberDesc = people.map(c => {\n          if (c.npc) return \"【\" + c.name + \"】\" + groupPersonaText(c.persona, NPC_PERSONA_CAP);", "}).join(\"\\n\\n\");");
  assert.match(gc, /sleepToneOf\(c\)/, "群通话没喂——电话尤其要有，半夜接起来的人不该精神饱满");
  assert.match(gc, /\+ zSeg/);
});

test("主动来找你 和 聊天回复 用同一把尺子", () => {
  // ⚠️原来动念那儿单独调 charAwakeState：排了作息的角色，聊天按四相算、
  //   主动开口按两相算，drowsy/waking 那两截能差出一个多小时。
  assert.match(app, /if \(sleepPhaseOf\(c\) === "asleep"\) \{/, "动念那一处没改用同一把尺子");
  // 旧尺子只该被【一个人】调：sleepPhaseOf。别处再直接调它，就又是两个答案了。
  const calls = (app.match(/charAwakeState\(/g) || []).length;
  assert.equal(calls, 1, "charAwakeState 只该被 sleepPhaseOf 调这一次，现在有 " + calls + " 处");
  assert.match(cut(app, "const sleepPhaseOf = char =>", "// 这一段是发给模型的"), /charAwakeState\(char\)/, "那一次得在 sleepPhaseOf 里");
});

// C 那条链本身（作息真算得出四相）
test("C 真算得出四相：睡熟 / 快睡了 / 刚醒 / 醒着", () => {
  const C = require(P("js/inner-life-c-sleep-core.js"));
  const off = -new Date().getTimezoneOffset();
  const d = new Date(), dk = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const plans = { [dk]: { seqs: [
    { time: "00:00", end: "08:00", type: "sleep", text: "睡" },
    { time: "08:00", end: "22:00", type: "work", text: "实验室" },
    { time: "22:00", end: "24:00", type: "sleep", text: "睡" }
  ] } };
  const at = (h, m) => { const now = new Date(); now.setHours(h, m, 0, 0);
    return C.tickSleep(C.createSleepState(now.getTime() - 1000), { now: now.getTime(), utcOffsetMinutes: off, deviceOffsetMinutes: off, schedules: plans, engineerEyes: false }); };
  assert.equal(at(3, 0).state.phase, "asleep", "凌晨三点");
  assert.equal(at(21, 30).state.phase, "drowsy", "快睡了（入睡前 45 分钟）");
  assert.equal(at(8, 20).state.phase, "waking", "刚醒（起床后 45 分钟）");
  assert.equal(at(14, 0).state.phase, "awake", "大白天");
  assert.equal(at(3, 0).audit.source, "schedule", "得是按作息算的，不是猜的");
});
