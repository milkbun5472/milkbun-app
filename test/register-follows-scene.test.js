const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

// 她 2026-08-19 报：群规矩删掉了，露骨语域还是回不去。真凶是【聊天记录本身】——
// 线下单聊/小剧场有 offlineRegisterTransition 那套明确场景状态机，
// 线上群聊、群线下、线上单聊一样都没有，决定尺度的唯一信号就是上面几十条记录。
test("三条没有场景状态机的通道都要挂上「语域跟着场面走」", () => {
  assert.match(engine, /const REGISTER_FOLLOWS_SCENE = /);
  // 线上群聊
  // v54.21 起中间多了一条 PERSONA_REGISTER_ANCHOR，两条都得在；
  // v55.90 起「语域三件套」再加一条 CONDESCENDING_TONE_BAN，三条连成一片、顺序固定。
  assert.match(app, /ContentBoundaries\.prompt : ""\) \+ "\\n\\n" \+ GROUP_IN_CHARACTER \+ "\\n\\n" \+ CONDESCENDING_TONE_BAN \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR \+ "\\n\\n" \+ dir \+ common/);
  // 线上单聊
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/);
  // 群线下
  assert.match(engine, /"\\n\\n" \+ CHARCARD_RULE \+\n    "\\n\\n" \+ GROUP_IN_CHARACTER \+\n    "\\n\\n" \+ CONDESCENDING_TONE_BAN \+\n    "\\n\\n" \+ REGISTER_FOLLOWS_SCENE/);
  assert.match(engine, /REGISTER_FOLLOWS_SCENE \+\n    "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/);
});

test("这条规则必须是对称的：她带过去就不设限，她没带就别自己起头", () => {
  const i = engine.indexOf("const REGISTER_FOLLOWS_SCENE");
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /那属于【当时那个场面】/, "要点破记录里的露骨段落不是默认语域");
  assert.match(rule, /尺度不设限/, "她自己带过去时不许自我审查——这不是内容管制");
  assert.match(rule, /不许无来由起头/);
  assert.match(rule, /占有欲、吃醋、管束、下命令统统照旧/, "回落的是用词，不是性格与关系强度");
  // 绝不能退化成"检测到露骨就降温"的启发式：她在真场景里只回一句「继续」时会误伤
  assert.doesNotMatch(engine, /groupRegisterInertia|registerCooldownDetect/);
});

test("规矩可以是临时的，不必为了掰回日常长期挂一条", () => {
  assert.match(app, /const setDirectiveTurns = \(id, dirId, turns\)/);
  assert.match(app, /const tickDirectives = id =>/);
  assert.match(app, /\.filter\(d => !\(d && d\.turns != null && Number\(d\.turns\) <= 0\)\)/, "减到 0 当场移除");
  assert.match(app, /tickDirectives\(groupId\);/, "每回一轮少一轮");
  // 注入时要说清还剩几轮，否则模型会把临时的当永久执行
  assert.match(app, /临时约定，还剩 " \+ Number\(d\.turns\) \+ " 轮，到期后自动作废/);
  assert.doesNotMatch(app, /每一条【现在就生效、永久有效】/, "不再一律宣称永久有效");
  // UI 能切
  assert.match(components, /onSetDirectiveTurns\(d\.id, temp \? null : 10\)/);
  assert.match(components, /临时 · 还剩 " \+ Number\(d\.turns\) \+ " 轮（点回长期）/);
});

test("临时与长期在数据上分得开，旧规矩不受影响", () => {
  // turns 缺省 = 长期，行为同旧版
  const tick = new Function("list", `
    const next = list.map(d => (d && Number(d.turns) > 0) ? { ...d, turns: Number(d.turns) - 1 } : d)
      .filter(d => !(d && d.turns != null && Number(d.turns) <= 0));
    return next;`);
  let list = [{ id: "a", text: "长期" }, { id: "b", text: "临时", turns: 2 }];
  list = tick(list);
  assert.deepEqual(list.map(d => d.id), ["a", "b"]);
  assert.equal(list[1].turns, 1);
  list = tick(list);
  assert.deepEqual(list.map(d => d.id), ["a"], "临时的到期自己消失，长期的一动不动");
  assert.equal(list[0].turns, undefined);
});
