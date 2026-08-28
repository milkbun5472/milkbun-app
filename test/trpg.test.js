const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const { rollStats, personaNudge, gradeCheck, normChoices, applyTurnPayload, foldHist, findMember } = require("../js/trpg.js");

// ============================================================
// 跑团(v57.13):参考 ai-virtual-phone 冒险玩法的【思路】自研。
// 这里钉住的是当初决定「不照抄」的那几件事——参考项目的病:
//   状态靠正则从散文里抠(漂移)、上下文用开局快照用到烂、
//   章节两个计数器各记各的、模型自己编骰子结果。
// ============================================================

// ---- 接线:四个接入点一个都不能少,少一个就是「图标在但打不开」或反过来 ----
test("接线齐全:script 标签在 app.js 之前、REG、默认布局、路由", () => {
  const tagAt = html.indexOf("js/trpg.js?v=");
  assert.ok(tagAt > 0, "index.html 里要有 trpg.js 的 script 标签");
  assert.ok(tagAt < html.indexOf("js/app.js?v="), "trpg.js 必须排在 app.js 之前(app.js 读 window.TrpgApp)");
  // 依赖 core/engine/components,必须排在它们之后
  assert.ok(tagAt > html.indexOf("js/components.js?v="), "trpg.js 必须排在 components.js 之后");
  assert.match(components, /trpg: \{ kind: "app", zh: "跑团"/);
  // REG key 和 screen 字符串是同一个词,路由那边也要有
  assert.match(app, /screen === "trpg"/);
  // 默认布局里要有,否则新图标只对重置过布局的用户可见(REG 安全网虽会回填,但默认位要有)
  assert.match(components, /"games", "trpg"/);
});

test("沙箱纪律:跑团和小剧场一样不接主线记忆/世界书/好感", () => {
  const at = app.indexOf('screen === "trpg"');
  const branch = app.slice(at, app.indexOf('screen === "theater"', at));
  assert.ok(!/worldbook|moods|memor/i.test(branch), "路由分支不许传世界书/心情/记忆——平行时空沙箱");
  assert.match(branch, /offlineActive/, "走线下创作线路");
  assert.match(src, /x_trpg/, "存档走 x_ 前缀,跟随整包云同步");
});

test("玩家主权与骰子主权写死在提示词里", () => {
  assert.match(src, /玩家主权/);
  assert.match(src, /绝不自己编骰子结果/);
  // 状态只认字段不认散文——参考项目状态漂移的病根
  assert.match(src, /一切状态变化只通过 JSON 字段报告/);
});

// ---- 骰子:d100 五档 ----
test("gradeCheck 五档边界", () => {
  // 属性 60:大成功 ≤12,困难 ≤30,成功 ≤60,失败 61-95,大失败 >95
  assert.equal(gradeCheck(12, 60).tier, "crit");
  assert.equal(gradeCheck(13, 60).tier, "hard");
  assert.equal(gradeCheck(30, 60).tier, "hard");
  assert.equal(gradeCheck(31, 60).tier, "ok");
  assert.equal(gradeCheck(60, 60).tier, "ok");
  assert.equal(gradeCheck(61, 60).tier, "fail");
  assert.equal(gradeCheck(95, 60).tier, "fail");
  assert.equal(gradeCheck(96, 60).tier, "fumble");
  // 属性再高,96+ 也翻车——没有稳赢的检定才有戏
  assert.equal(gradeCheck(96, 90).tier, "fumble");
  // 属性极低时大成功地板是 1,不会因为 stat/5 取整成 0 而永无大成功
  assert.equal(gradeCheck(1, 4).tier, "crit");
});

test("rollStats 是 3d6×5:15~90 且是 5 的倍数", () => {
  for (let i = 0; i < 50; i++) {
    const s = rollStats();
    ["phy", "agi", "wit", "cha", "luck"].forEach(k => {
      assert.ok(s[k] >= 15 && s[k] <= 90 && s[k] % 5 === 0, k + "=" + s[k]);
    });
  }
  // 可注入随机源(测试与将来可能的种子团都用得上)
  const fixed = rollStats(() => 0.999);
  assert.equal(fixed.phy, 90);
});

test("personaNudge 按人设轻推,夹在 [15,90]", () => {
  const base = { phy: 90, agi: 50, wit: 15, cha: 20, luck: 40 };
  const s = personaNudge(base, "他自幼习武,身手矫健,却生性寡言。");
  assert.equal(s.phy, 90, "到顶不再加");
  assert.equal(s.agi, 60);
  assert.equal(s.cha, 15, "寡言 -10,但不穿地板");
  assert.equal(s.wit, 15, "没匹配到就原样");
});

// ---- 回合协议:名字校验、夹紧、单计数器 ----
const camp0 = () => ({
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } }],
  items: ["火漆信"], clues: ["管家没说实话"], place: "驿站", stageIdx: 1,
  stages: [{ goal: "a", done: true }, { goal: "b", done: false }, { goal: "c", done: false }],
  choices: [], pendingStage: false, pendingEnd: false
});

test("applyTurnPayload:名字对不上的伤害丢弃,绝不安错人", () => {
  const { camp } = applyTurnPayload(camp0(), { hp: [{ name: "不存在的人", delta: -30 }, { name: "裴照川", delta: -10 }] });
  assert.equal(camp.party[0].hp, 80, "没点到的人一滴血不掉");
  assert.equal(camp.party[1].hp, 90);
});

test("applyTurnPayload:单次增减夹 ±40,HP 落地夹 [0,上限]", () => {
  const { camp } = applyTurnPayload(camp0(), { hp: [{ name: "Lisa", delta: -999 }, { name: "裴照川", delta: 999 }] });
  assert.equal(camp.party[0].hp, 40, "-999 夹成 -40");
  assert.equal(camp.party[1].hp, 100, "满血封顶");
  const { camp: c2 } = applyTurnPayload(camp, { hp: [{ name: "Lisa", delta: -40 }] });
  assert.equal(c2.party[0].hp, 0, "见底是 0,不出负数");
});

test("applyTurnPayload:物品与线索去重,失去只减真有的", () => {
  const { camp, sysLine } = applyTurnPayload(camp0(), { gain: ["火漆信", "铜钥匙"], lose: ["不存在的东西"], clue: ["管家没说实话", "地窖有第二个出口"] });
  assert.deepEqual(camp.items, ["火漆信", "铜钥匙"], "重复获得不翻倍,凭空失去不报账");
  assert.equal(camp.clues.length, 2);
  assert.match(sysLine, /铜钥匙/);
  assert.ok(!/不存在的东西/.test(sysLine));
});

test("章节推进只挂待确认,只有一个计数器(参考项目两处计数会漂)", () => {
  const { camp } = applyTurnPayload(camp0(), { stageDone: true, stageNote: "拿到了名册" });
  assert.equal(camp.stageIdx, 1, "模型报 stageDone 不直接推进——由玩家点头才 +1");
  assert.equal(camp.pendingStage, "拿到了名册");
  // 源码层面钉死:确认推进只动 stageIdx 这一个计数器
  assert.match(src, /stageIdx: Math\.min\(c\.stages\.length, c\.stageIdx \+ 1\)/);
});

test("normChoices:坏检定只丢检定不丢选项,who 校验进队伍", () => {
  const party = camp0().party;
  const out = normChoices([
    "翻墙进去",
    { text: "让裴照川去谈", check: { stat: "cha", who: "裴照川" } },
    { text: "硬闯", check: { stat: "不存在的属性", who: "Lisa" } },
    { text: "撬锁", check: { stat: "agi", who: "查无此人" }, need: "铜钥匙" },
    { text: "第五个要被裁掉" }
  ], party);
  assert.equal(out.length, 4, "至多 4 个");
  assert.equal(out[0].check, null);
  assert.equal(out[1].check.who, "裴照川");
  assert.equal(out[2].check, null, "属性名不合法→只丢 check,选项还在");
  assert.equal(out[3].check.who, null, "队里没这人→降级成命运选人");
  assert.equal(out[3].need, "铜钥匙");
});

test("foldHist:守密人一侧 assistant,其余并入 user,连续同侧合并", () => {
  const out = foldHist([
    { role: "gm", content: "夜里下起了雨。" },
    { role: "user", content: "我推门进去" },
    { role: "roll", content: "Lisa 的「身手」检定:d100=7 / 50 → 困难成功" },
    { role: "sys", content: "获得「铜钥匙」" },
    { role: "gm", content: "门开了。" }
  ]);
  assert.equal(out.length, 3, "user+roll+sys 合成一条,绝不给上游连发同角色消息");
  assert.equal(out[1].role, "user");
  assert.match(out[1].content, /检定/);
  assert.match(out[1].content, /铜钥匙/);
});

test("findMember:全等优先,再互相包含,对不上返回 null", () => {
  const party = camp0().party;
  assert.equal(findMember(party, "裴照川").key, "c1");
  assert.equal(findMember(party, "照川"), party[1]);
  assert.equal(findMember(party, "王大锤"), null);
  assert.equal(findMember(party, ""), null);
});

// ---- 分支回溯按快照恢复(每拍 GM 消息带 snap),不带错账 ----
test("GM 消息带状态快照,分支从快照恢复", () => {
  assert.match(src, /snap: \{ hp: /, "每拍守密人消息要存状态快照");
  assert.match(src, /branchedFrom/, "分支要记来路");
  assert.match(src, /hp: snap\.hp\[m\.name\]/, "分支恢复 HP 按快照,不是照抄现值");
});

// ---- 秘典:开团即生成,落幕前不给看 ----
test("秘典落幕解密,不在过程中泄底", () => {
  assert.match(src, /玩家永远不可见/);
  assert.match(src, /秘典解密/);
  // 预览页只亮第一章,后面的章节走到才揭晓
  assert.match(src, /未揭晓,推进到才亮出|\?\?\?/);
});
