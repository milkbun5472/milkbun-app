const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-25 一次报了两件事：
// ①「新开了一个怎么还是这样」——新群里裴照川第一句就把只有他和用户知道的私聊
//   （酥酪）端上台面当弹药，顾朝顺手接了。隐私围栏一直只挡别人的私事，
//   从没挡过【自己的私事被当谈资】。
// ②「再给群也搞一个清除聊天记录的按钮吧」。

test("群清除聊天记录：只清本群线上+群线下，不碰成员各自的单聊", () => {
  const i = app.indexOf("const clearGroupChat = (groupId, wipeMem) =>");
  assert.ok(i > 0, "clearGroupChat 应该存在");
  const fn = app.slice(i, i + 1800);
  assert.match(fn, /pGChat\(groupId, \(\) => \[\]\)/);      // 线上
  assert.match(fn, /pGOffline\(groupId, \(\) => \[\]\)/);   // 群线下
  assert.match(fn, /lastSummarizedCount: 0/);               // 总结游标归零，不然清完立刻又去总结空记录
  assert.match(fn, /resetAutoChatCycle\(groupId/);          // 自发额度归零
  assert.match(fn, /clearUnread\(groupId\)/);               // 未读角标不能停在旧数字上
  // ⚠️铁律：绝不许连带删成员自己的单聊/单人线下
  assert.doesNotMatch(fn, /\bpChat\(/, "群清除不许动任何成员的单聊");
  assert.doesNotMatch(fn, /\bpOffline\(/, "群清除不许动任何成员的单人线下");
  assert.doesNotMatch(fn, /setMoods|setStates|setAff\b/, "心情/状态/好感属于角色本人，不随群清除");
});

test("群清除只在她勾了同步忘却时才摘记忆，而且只摘本群的", () => {
  const i = app.indexOf("const clearGroupChat = (groupId, wipeMem) =>");
  const fn = app.slice(i, i + 1800);
  assert.match(fn, /if \(wipeMem\)/, "不勾就不许碰记忆库");
  assert.match(fn, /String\(e\.groupId\) === String\(groupId\)/, "新条目按 groupId 认");
  assert.match(fn, /indexOf\("群聊"\) >= 0 && tg\.indexOf\(gName\) >= 0/, "旧条目退回群聊+群名这对 tag，两个都对上才删");
});

test("addMemEntry 是白名单式建对象——groupId 必须写在白名单里，不然传了也白传", () => {
  const i = app.indexOf("const addMemEntry = e => {");
  const fn = app.slice(i, i + 900);
  assert.match(fn, /groupId: String\(e\.groupId\)/);
});

test("群记忆的 tag 要带群名——groupId 是本地字段，同步一圈回来就没了", () => {
  const i = app.indexOf("const gTags = (group, ...extra) =>");
  assert.ok(i > 0, "要有 gTags 帮手");
  assert.match(app.slice(i, i + 300), /"群聊"/);
  // 群侧写记忆一律走 gTags，不许再手写 ["群聊"] 把群名漏掉
  app.split("\n").forEach((l, n) => {
    if (!/addMemEntry\(/.test(l)) return;
    if (!/"群聊"/.test(l)) return;
    assert.fail("第 " + (n + 1) + " 行群侧写记忆没走 gTags：" + l.trim().slice(0, 90));
  });
});

test("群总结进记忆库的条目要带 groupId，否则清除时认不出是哪个群的", () => {
  const gAdds = app.split("\n").filter(l => /addMemEntry\(/.test(l) && /gTags\(/.test(l));
  assert.ok(gAdds.length >= 3, "群侧 addMemEntry 调用至少三处");
  gAdds.forEach(l => assert.match(l, /groupId/, "群侧写记忆必须带 groupId：" + l.trim().slice(0, 90)));
});

test("清除按钮真的接到了 UI 上（app → GroupChat → GroupSettingsSheet）", () => {
  assert.match(app, /onClearGroupChat: wipeMem => clearGroupChat\(activeGroup\.id, wipeMem\)/);
  assert.match(comp, /^\s*onClearGroupChat,$/m, "GroupChat 要收下这个 prop");
  assert.match(comp, /onClearChat: onClearGroupChat/, "要传进 GroupSettingsSheet");
  assert.match(comp, /function GroupSettingsSheet\(\{[^}]*onClearChat[^}]*\}\)/);
  const i = comp.indexOf("onClearChat && h(\"div\"");
  assert.ok(i > 0, "设置面板里要有清除区块");
  const ui = comp.slice(i, i + 2600);
  assert.match(ui, /confirmClear/, "要两步确认，不能一点就清");
  assert.match(ui, /wipeMemToo/, "要有同步忘却记忆库的开关");
  assert.doesNotMatch(ui, /window\.confirm|[^.\w]confirm\(/, "她在 iPhone 上按不动 confirm 弹窗，只用页内两步确认");
});

test("私聊背景是背景不是弹药——这条规则本身要存在", () => {
  const i = engine.indexOf("const PRIVATE_IS_BACKGROUND_NOT_AMMO");
  assert.ok(i > 0, "要有这条共用常量");
  const rule = engine.slice(i, i + 900);
  assert.match(rule, /不是弹药/);
  assert.match(rule, /别拿它当开场/);
  assert.match(rule, /私底下/, "要点名『某人刚才私底下…』这种句式");
  assert.match(rule, /话题【自己走到那儿】/, "允许自然聊到，只禁主动端上台面");
});

// 四处一样喂（.claude/rules/four-surfaces-same-context.md）：
// 群线上有两条私聊入口（互通群走 interop、封闭群走 preJoin），群线下走 memberRecent。
// 三处都要挂，漏一处就是那一处又回到「可以说＝值得说」。
test("三处群私聊围栏都挂上了这条刀", () => {
  const preJoin = app.slice(app.indexOf("let preJoin = \"\";"), app.indexOf("const gPersonaCap"));
  assert.match(preJoin, /PRIVATE_IS_BACKGROUND_NOT_AMMO/, "封闭群的入群前私聊漏了");

  const interopI = app.indexOf("【每位成员各自和用户的私下往来");
  assert.ok(interopI > 0);
  assert.match(app.slice(interopI, interopI + 1400), /PRIVATE_IS_BACKGROUND_NOT_AMMO/, "互通群的实时私聊窗口漏了");

  const offI = engine.indexOf("【各成员最近在别处（和用户的私聊 / 单人线下）发生的事");
  assert.ok(offI > 0);
  assert.match(engine.slice(offI, offI + 1400), /PRIVATE_IS_BACKGROUND_NOT_AMMO/, "群线下漏了");
});
