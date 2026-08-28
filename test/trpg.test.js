const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const { rollStats, personaNudge, gradeCheck, normChoices, applyTurnPayload, foldHist, findMember, shotSafeLines, mulberry32, hashStr, journeyLayout, jitterPts } = require("../js/trpg.js");

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

// ---- 出图:敏感句不进图像 prompt(上游审核读的就是原文),群像不锁脸 ----
test("shotSafeLines 过滤暴力/亲密句,过滤空了由调用方给中性备胎", () => {
  const kept = shotSafeLines(["队伍围着篝火分粮食", "他拔刀抵住来人的喉咙", "血顺着石阶流下来"], () => false);
  assert.deepEqual(kept, ["队伍围着篝火分粮食"]);
  // 亲密判定走注入的函数(浏览器里接 offlineRegisterExplicitText)
  assert.deepEqual(shotSafeLines(["普通一句", "亲密一句"], t => t === "亲密一句"), ["普通一句"]);
  assert.deepEqual(shotSafeLines([], () => false), []);
});

test("出图不锁脸:跑团是群像,人物远景/背影/剪影", () => {
  assert.match(src, /不描绘清晰五官/);
  assert.match(src, /generateSelfieImage\(prompt, null/, "封面与当拍画面都不传参考照——多张脸锁一半更吓人");
});

// ---- 数值角标:只从真落账的变化长出来,绝不渲染没生效的变化骗人(米娅的教训) ----
test("chips 与落账一一对应:被丢弃的伤害不出角标", () => {
  const { chips } = applyTurnPayload(camp0(), { hp: [{ name: "查无此人", delta: -30 }, { name: "裴照川", delta: -10 }], gain: ["铜钥匙", "火漆信"], clue: ["管家没说实话", "新线索一条"] });
  const txts = chips.map(c => c.txt).join("|");
  assert.ok(!/查无此人/.test(txts), "名字对不上→没落账→没角标");
  assert.match(txts, /裴照川 HP-10 →90/, "角标带落地后的现值");
  assert.ok(!/火漆信/.test(txts), "重复获得没落账,也没角标");
  assert.match(txts, /铜钥匙/);
  assert.ok(!/管家没说实话/.test(txts), "重复线索同理");
});

// ---- 旅程图:纯函数、种子稳定 ----
test("journeyLayout:同种子同路,x 单调向右,y 不出画布", () => {
  const a = journeyLayout("rpg_test1", 5), b = journeyLayout("rpg_test1", 5);
  assert.deepEqual(a, b, "同一场团永远画同一条路");
  assert.equal(a.length, 6, "起点 + 5 章");
  for (let i = 1; i < a.length; i++) assert.ok(a[i].x > a[i - 1].x, "小径向右走");
  a.forEach(nd => assert.ok(nd.y >= 20 && nd.y <= 100, "y 在画布留白内"));
  const c = journeyLayout("rpg_test2", 5);
  assert.notDeepEqual(a, c, "不同的团长不同的路");
});

test("jitterPts:端点纹丝不动——路必须真的从节点出发到节点为止", () => {
  const pts = [{ x: 10, y: 50 }, { x: 100, y: 30 }, { x: 200, y: 70 }];
  const out = jitterPts(pts, mulberry32(hashStr("seed")), 2);
  assert.deepEqual(out[0], pts[0]);
  assert.deepEqual(out[out.length - 1], pts[pts.length - 1]);
  assert.ok(out.length > pts.length, "中间重采样加密了");
});

// ---- 追加一笔:加戏不推进 ----
test("追加一笔:不动状态、不换选项、时钟原地", () => {
  const at = src.indexOf("const addBeat");
  const fn = src.slice(at, src.indexOf("const confirmStage"));
  assert.match(fn, /只加戏,不推进/);
  assert.ok(!/applyTurnPayload/.test(fn), "追加一笔绝不走状态落账");
  assert.match(fn, /choices: c\.choices/, "快照里选项原样保留");
});

// ---- 秘典:开团即生成,落幕前不给看 ----
test("秘典落幕解密,不在过程中泄底", () => {
  assert.match(src, /玩家永远不可见/);
  assert.match(src, /秘典解密/);
  // 预览页只亮第一章,后面的章节走到才揭晓
  assert.match(src, /未揭晓,推进到才亮出|\?\?\?/);
});
