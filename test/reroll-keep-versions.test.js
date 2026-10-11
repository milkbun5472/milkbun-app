// 重 Roll 留版（她 2026-10-10 转群友：「重 roll 后保留前面的回复然后选最喜欢的那个」）
//   聊天设置开关默认关；最多 5 版；翻版只换气泡和轻的那几样；落了东西的那版不留
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");

const i = app.indexOf("  const REROLL_KEEP = "), j = app.indexOf("  const rerollFlip = ", i);
assert.ok(i > 0 && j > i, "抠不出留版那几个函数");
const lib = new Function("statesRef", "stateHistRef", "moodsRef", "affOf", app.slice(i, j) + "\nreturn { rerollKeepable, rerollStash, rerollNavOf, REROLL_KEEP };")({}, {}, {}, () => 50);

const u = { role: "user", content: "在吗" };
const v = n => [{ role: "assistant", content: "第" + n + "版", turnId: "t" + n }];

test("收一版、腾一格：眼前这版是 null，翻页器算得出第几版", () => {
  let list = [u].concat(v(1));
  // 重 Roll：第 1 版被截掉，收进 u 上
  list = lib.rerollStash([u], { msgs: v(1), st: {} }).concat(v(2));
  const nav = lib.rerollNavOf(list);
  assert.deepEqual({ ...nav }, { at: 0, pos: 1, n: 2 });
  assert.equal(list[0].rerollAlts[0].msgs[0].content, "第1版");
});

test("最多留 5 版，挤掉最早的", () => {
  let base = [u];
  for (let k = 1; k <= 7; k++) base = lib.rerollStash(base, { msgs: v(k), st: {} });
  const alts = base[0].rerollAlts;
  assert.equal(alts.length, lib.REROLL_KEEP);
  assert.equal(alts.filter(x => x === null).length, 1);
  assert.equal(alts[0].msgs[0].content, "第4版");
});

test("她发了新消息：这一组不再能翻；别处挂着的旧版收新的时候清掉", () => {
  let list = lib.rerollStash([u], { msgs: v(1), st: {} }).concat(v(2), [{ role: "user", content: "好" }]);
  assert.equal(lib.rerollNavOf(list), null);
  const next = lib.rerollStash(list, { msgs: v(3), st: {} });
  assert.equal(next.filter(x => x.rerollAlts).length, 1, "只留最后一组");
});

test("落了东西的那版不留：转账、照片、记账这类", () => {
  assert.equal(lib.rerollKeepable(v(1)), true);
  assert.equal(lib.rerollKeepable([{ role: "assistant", kind: "voice", content: "x" }, { role: "narration", who: "char", content: "在倒水" }]), true);
  assert.equal(lib.rerollKeepable([{ role: "assistant", content: "给你" }, { role: "assistant", kind: "transfer", amount: 5 }]), false);
  assert.equal(lib.rerollKeepable([{ role: "assistant", kind: "selfie" }]), false);
  assert.equal(lib.rerollKeepable([{ role: "system", kind: "recorded" }]), false);
});

test("接线：设置开关默认关、状态在回滚前拍下、只在主线上画翻页器", () => {
  assert.match(comp, /useState\(settings\.keepRerolls === true\)/);
  assert.match(app, /keepRerolls: s\.keepRerolls === true,/);
  const a = app.indexOf("const _keepAlt = "), b = app.indexOf("rollbackCharTurns(activeChar.id,removedTurns,false)", a);
  assert.ok(a > 0 && b > a, "拍状态要在回滚之前");
  assert.match(app, /const next=_keepAlt \? rerollStash\(liveBranch\.after, _keepAlt\) : liveBranch\.after;/);
  assert.match(app, /rerollNav: \(activeRoomId && activeRoomId !== "main"\) \|\| settingsFor\(activeChar\.id\)\.keepRerolls !== true \? null : rerollNavOf\(/);
  assert.match(comp, /"data-wk": "rerollnav"/);
  assert.match(ts, /\["rerollnav", /);
});

// 下一轮（她 2026-10-10：「继续继续」）：群聊、单人线下、群线下都接上，同一个翻版器、同一颗 RerollNav
test("群聊和线下：同一份翻版、群里拍全体成员、线下接着生成也不冲掉旧版", () => {
  assert.match(app, /const rerollFlipIn = \(list, write, snap, restore, dir\) => \{/);
  assert.equal((app.match(/alts\[nav\.pos\] = \{ msgs: list\.slice\(nav\.at \+ 1\), st: snap\(\) \}/g) || []).length, 1, "翻版只许一份");
  assert.match(app, /const _gKeep = gsFor\(groupId\)\.keepRerolls === true && rerollKeepable\(removed\) \? \{ msgs: removed, st: statesSnapMany\(groupStateIds\(groupId\)\) \}/);
  assert.match(app, /const _offKeep = !sideRoom && settingsFor\(charId\)\.keepRerolls === true && offRerollKeepable\(removed\)/);
  assert.match(app, /const _gOffKeep = gsFor\(groupId\)\.keepRerolls === true && offRerollKeepable\(removed\)/);
  assert.match(app, /if \(_offKeep\) truncated = rerollStash\(truncated, _offKeep\);/);
  // 四处界面都用公共那颗
  assert.match(comp, /function RerollNav\(\{ nav, onFlip, pad \}\)/);
  assert.equal((comp.match(/h\(RerollNav, \{ (?:key: "grnav", )?nav: rerollNav, onFlip: onRerollFlip/g) || []).length, 4);
  assert.equal((comp.match(/"data-wk": "rerollnav"/g) || []).length, 1);
  assert.match(comp, /onSave\(\{ actLong: gActLong, keepRerolls: gKeepRerolls, /);
});

test("线下留版：一拍正文、整段小说算轻的；她的话夹在中间不留", () => {
  const k = app.indexOf("  const offRerollKeepable = "), e = app.indexOf("\n", k);
  const offRerollKeepable = new Function("REROLL_LIGHT_KIND", app.slice(k, e) + "\nreturn offRerollKeepable;")({ text: 1, voice: 1, emote: 1, silence: 1, narration: 1 });
  assert.equal(offRerollKeepable([{ role: "char", content: "x" }, { role: "narration", content: "风" }]), true);
  assert.equal(offRerollKeepable([{ role: "char", kind: "novel", content: "x" }]), true);
  assert.equal(offRerollKeepable([{ role: "char", content: "x" }, { role: "user", content: "嗯" }, { role: "char", content: "y" }]), false);
  assert.equal(offRerollKeepable([{ role: "char", kind: "offshot" }]), false);
});
