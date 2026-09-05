const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/trpg.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const components = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const { rollStats, personaNudge, gradeCheck, normChoices, applyTurnPayload, foldHist, findMember, shotSafeLines, mulberry32, hashStr, journeyLayout, jitterPts, itemsFix, fmtItem, hasItem, normRegions, mapBuild, mapAdjacent, findNode, decideOpposed, harmZh, growthRolls, normSceneMeta, normSiteActions } = require("../js/trpg.js");

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

test("applyTurnPayload:物品带归属计数,凭空失去不报账,线索去重", () => {
  const { camp, sysLine } = applyTurnPayload(camp0(), { gain: ["火漆信", { name: "铜钥匙", who: "裴照川" }], lose: ["不存在的东西"], clue: ["管家没说实话", "地窖有第二个出口"] });
  // 同名同持有人=叠数量(v57.17 起物品是 {name,holder,n},不再是去重字符串)
  assert.deepEqual(camp.items, [{ name: "火漆信", holder: "队伍", n: 2 }, { name: "铜钥匙", holder: "裴照川", n: 1 }]);
  assert.equal(camp.clues.length, 2);
  assert.match(sysLine, /铜钥匙/);
  assert.ok(!/不存在的东西/.test(sysLine));
});

test("物品转手 hand:to 必须在队,数量>1 拆一件;lose 优先扣指定持有人", () => {
  const base = Object.assign(camp0(), { items: [{ name: "绷带", holder: "队伍", n: 2 }, { name: "火漆信", holder: "Lisa", n: 1 }] });
  const r1 = applyTurnPayload(base, { hand: [{ name: "绷带", to: "裴照川" }, { name: "火漆信", from: "Lisa", to: "查无此人" }] });
  assert.deepEqual(r1.camp.items.find(it => it.holder === "裴照川"), { name: "绷带", holder: "裴照川", n: 1 }, "拆一件转给他");
  assert.equal(r1.camp.items.find(it => it.name === "绷带" && it.holder === "队伍").n, 1);
  assert.equal(r1.camp.items.find(it => it.name === "火漆信").holder, "队伍", "转给队里没有的人=归队伍公用");
  const r2 = applyTurnPayload(r1.camp, { lose: [{ name: "绷带", who: "裴照川" }] });
  assert.ok(!r2.camp.items.some(it => it.name === "绷带" && it.holder === "裴照川"), "指定了持有人就扣那个人的");
  assert.ok(r2.camp.items.some(it => it.name === "绷带" && it.holder === "队伍"), "队伍那件不受牵连");
});

test("itemsFix 老存档字符串就地升格;hasItem 认名不认归属", () => {
  assert.deepEqual(itemsFix(["铜钥匙", { name: "绷带", holder: "Lisa", n: 3 }]),
    [{ name: "铜钥匙", holder: "队伍", n: 1 }, { name: "绷带", holder: "Lisa", n: 3 }]);
  assert.equal(fmtItem({ name: "绷带", holder: "Lisa", n: 3 }), "绷带×3(Lisa)");
  assert.ok(hasItem(["铜钥匙"], "铜钥匙"), "旧格式也认");
  assert.ok(!hasItem([{ name: "绷带", holder: "Lisa", n: 1 }], "铜钥匙"));
});

// ---- Codex 五修的钉子 ----
test("HP 先按人聚合再封顶:同一轮三条 -40 也只掉 40", () => {
  const { camp } = applyTurnPayload(camp0(), { hp: [{ name: "裴照川", delta: -40 }, { name: "裴照川", delta: -40 }, { name: "照川", delta: -40 }] });
  assert.equal(camp.party[1].hp, 60, "别名也归并到同一个人,净变化封顶 ±40");
});

test("属性否定窗口:「不擅长交际」是减分不是加分", () => {
  const base = { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 };
  assert.equal(personaNudge(base, "他不擅长交际,常年独来独往。").cha, 40, "否定的长处按短板算");
  assert.equal(personaNudge(base, "她交际手腕圆滑老练。").cha, 60, "没否定照常加");
  assert.equal(personaNudge(base, "他不爱运动,体格却意外结实。").phy, 40, "「不爱/常年运动」的否定窗口");
});

test("骰子落地即铁案:失败不回滚、重试沿用原骰、撤回只给没掷过的拍", () => {
  const at = src.indexOf("const turn = async");
  const fn = src.slice(at, src.indexOf("const retractTail"));
  assert.ok(!/added\.indexOf/.test(fn), "失败路径不再按 id 撤消息");
  assert.match(fn, /骰子与宣言都还在/);
  assert.match(src, /沿用已掷的骰子/);
  assert.match(src, /tailHasRoll \? null|!tailHasRoll \?/, "撤回重写只在这一拍没掷过骰子时出现");
  assert.match(src, /tailHasCC/, "重试轮不重开言秋亲笔票");
});

test("推进/落幕否决留回执,守密人下一拍看得见", () => {
  assert.match(src, /判定:本章目标还没有真实达成/);
  assert.match(src, /判定:故事还没到落幕的时候/);
});

test("终章归还玩家主权:先问最后一笔,留空也不替她做主", () => {
  assert.match(src, /最后,你做什么、说什么/);
  assert.match(src, /不改写、不扩大、不替她追加任何新的决定/);
  assert.match(src, /绝不替她决定去留、原谅谁、选择谁/);
});

test("锁语义改诚实:缺物品叫硬闯,先确认再动手", () => {
  assert.match(src, /⚠缺/);
  assert.match(src, /硬闯试试\?守密人会让硬闯付出代价/);
  assert.ok(!/🔒/.test(src), "不再画一把点得开的锁");
});

test("休整拍:不推进主线,恢复封顶 +15,队友各提看法", () => {
  assert.match(src, /〔休整拍〕/);
  assert.match(src, /每人至多 \+15/);
  assert.match(src, /不报 stageDone/);
});

// 章要有呼吸(v60.16 代码闸,v63.17 收紧):开章后不到四拍、本章没掷过骰、或还有坎没过,
// 守密人报的 stageDone 一律丢掉。闲拍(幕间/探索)不算拍数——它们本来就不往章目标走
const ripe = () => Object.assign(camp0(), { stageAt: 0, msgs: [{ role: "gm" }, { role: "user" }, { role: "roll", tier: "ok" }, { role: "gm" }, { role: "gm", sceneType: "interlude" }, { role: "gm", lull: true }, { role: "gm" }, { role: "gm" }] });
test("章节闸:才开章或没掷过骰就报完成,丢掉并留幕后事实", () => {
  const bare = applyTurnPayload(camp0(), { stageDone: true, stageNote: "拿到了名册" });
  assert.equal(bare.camp.pendingStage, false, "第一拍就翻章,不放行");
  assert.match(bare.gate, /才开章/);
  const noRoll = Object.assign(camp0(), { stageAt: 0, msgs: [{ role: "gm" }, { role: "user" }, { role: "gm" }, { role: "gm" }, { role: "gm" }] });
  assert.match(applyTurnPayload(noRoll, { stageDone: true }).gate, /没掷过/);
  const young = Object.assign(camp0(), { stageAt: 0, msgs: [{ role: "gm" }, { role: "roll", tier: "ok" }, { role: "gm" }, { role: "gm", sceneType: "interlude" }, { role: "gm", sceneType: "explore" }, { role: "gm", lull: true }] });
  assert.match(applyTurnPayload(young, { stageDone: true }).gate, /才开章/, "幕间和探索拍不算章的拍数");
  assert.equal(applyTurnPayload(ripe(), { stageDone: true, stageNote: "拿到了名册" }).gate, null);
  assert.match(src, /stageIdx: Math\.min\(c\.stages\.length, c\.stageIdx \+ 1\), stageAt: c\.msgs\.length/, "翻章时要记下起点");
});

test("章节推进只挂待确认,只有一个计数器(参考项目两处计数会漂)", () => {
  const { camp } = applyTurnPayload(ripe(), { stageDone: true, stageNote: "拿到了名册" });
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

test("场景桌:场景类型、行动路数与地点动作都做严格归一", () => {
  const meta = normSceneMeta({ sceneMeta: { type: "investigation", objective: "查清谁换了货单", stakes: "巡夜人会封仓" } }, camp0());
  assert.deepEqual(meta, { type: "investigate", objective: "查清谁换了货单", stakes: "巡夜人会封仓" });
  assert.equal(normSceneMeta({ sceneMeta: { type: "nonsense" } }, Object.assign(camp0(), { sceneMeta: { type: "social", objective: "旧目标", stakes: "" } })).type, "social", "坏类型沿用旧场景,不把桌牌打空");
  assert.deepEqual(normSiteActions(["查值班册", "查值班册", { text: "敲空心墙" }, "摸排暗门", "第四条不要"]), ["查值班册", "敲空心墙", "摸排暗门"]);
  const choices = normChoices([{ text: "让裴照川拆锁", approach: "ally", risk: "会留下撬痕", payoff: "不惊动守卫" }], camp0().party);
  assert.equal(choices[0].approach, "ally");
  assert.equal(choices[0].risk, "会留下撬痕");
  assert.equal(choices[0].payoff, "不惊动守卫");
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

test("出图:封面不锁脸;当拍画面先试全员合照,退档只锁主角", () => {
  assert.match(src, /不描绘清晰五官/);
  assert.match(src, /generateSelfieImage\(prompt, null/, "封面海报仍不传参考照");
  assert.match(src, /其余同行者若入画,一律远景虚化/, "退档后:锁主角,别的脸不硬画");
  assert.match(src, /persona: visualPersona/, "只继承这张脸,不带主线职业装束(小剧场 if 线同一课)");
  assert.match(src, /lockChar: ch \? ch\.id : undefined/, "重画沿用同一位入镜人");
  // 全员合照(她 2026-08-28 要的):参考图逐张点名对照,人数封死;失败才退档
  assert.match(src, /张参考图=" \+ c2\.name/, "参考图按顺序逐张点名是谁的脸");
  assert.match(src, /人数不多不少/);
  assert.match(src, /全员合照没锁成,退而只锁/, "退档要说出口,不无声降级");
  assert.match(src, /nAll > \(duo \? 2 : 1\)/, "全员并不比只锁主角多脸时,不白烧一枪");
});

test("need 剥掉持有人/数量尾巴,hasItem 互相包含(有药不再显示缺)", () => {
  const party = camp0().party;
  const out = normChoices([{ text: "灌药", need: "浓缩催吐解毒剂(陆衍)" }, { text: "点数", need: "绷带×2" }], party);
  assert.equal(out[0].need, "浓缩催吐解毒剂", "守密人照抄物品表格式也不怕");
  assert.equal(out[1].need, "绷带");
  const items = [{ name: "浓缩催吐解毒剂", holder: "陆衍", n: 1 }];
  assert.ok(hasItem(items, "浓缩催吐解毒剂(陆衍)"));
  assert.ok(hasItem(items, "解毒剂"), "简称也认(互相包含)");
  assert.ok(!hasItem(items, "铜钥匙"));
  assert.match(src, /只写物品名本身】——绝不带持有人和数量/, "并且明令守密人别写尾巴");
});

test("休整贴场景:室内不支帐篷", () => {
  assert.match(src, /休整的形式必须贴合此刻身处的场景/);
  assert.match(src, /不要千篇一律地支帐篷/);
  assert.match(src, /队伍暂且停下,就地休整/, "宣言也不再写死「扎营」");
});

// ---- 数值角标:只从真落账的变化长出来,绝不渲染没生效的变化骗人(米娅的教训) ----
test("chips 与落账一一对应:被丢弃的伤害不出角标", () => {
  const { chips } = applyTurnPayload(camp0(), { hp: [{ name: "查无此人", delta: -30 }, { name: "裴照川", delta: -10 }], gain: ["铜钥匙", "火漆信"], clue: ["管家没说实话", "新线索一条"] });
  const txts = chips.map(c => c.txt).join("|");
  assert.ok(!/查无此人/.test(txts), "名字对不上→没落账→没角标");
  assert.match(txts, /裴照川 HP-10 →90/, "角标带落地后的现值");
  assert.match(txts, /火漆信/, "再得一件=叠数量,真落账了就有角标");
  assert.match(txts, /铜钥匙/);
  assert.ok(!/管家没说实话/.test(txts), "重复线索没落账,没角标");
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

// ---- 大地图:接壤驱动布局,路和可走图同一趟生成 ----
const RAW_REGIONS = [
  { name: "风语镇", terrain: "平原", adj: ["暗影林"], nodes: [{ name: "老磨坊", kind: "城镇", hook: "磨坊主见过那封信" }, { name: "河渡口", kind: "野外" }] },
  { name: "暗影林", terrain: "森林", adj: ["风语镇", "不存在的区"], nodes: [{ name: "猎人小屋", kind: "地标" }] },
  { name: "灰岩堡", terrain: "山地", adj: [], nodes: [{ name: "堡门", kind: "城郭不合法的kind" }] }
];

test("normRegions:接壤只认存在的名字并补对称,kind 不合法就归野外", () => {
  const rs = normRegions(RAW_REGIONS);
  assert.equal(rs.length, 3);
  assert.deepEqual(rs[0].adj, ["暗影林"]);
  assert.deepEqual(rs[1].adj, ["风语镇"], "不存在的区被过滤");
  assert.equal(rs[2].nodes[0].kind, "野外");
  assert.equal(normRegions([RAW_REGIONS[0]]), null, "少于 2 个区不成图");
});

test("mapBuild:同种子同图;节点在画布内;路的条数=可走边的条数(同一趟生成)", () => {
  const a = mapBuild("rpg_seed1", RAW_REGIONS), b = mapBuild("rpg_seed1", RAW_REGIONS);
  assert.deepEqual(a, b, "布局是 (种子,骨架) 的纯函数");
  assert.equal(a.nodes.length, 4);
  a.nodes.forEach(n => assert.ok(n.x > 0 && n.x < a.W && n.y > 0 && n.y < a.H));
  assert.equal(a.roads.length, a.edges.length, "画出来的路永远等于能走的边——两者同一循环里生成");
});

test("mapBuild:模型漏写接壤也不出孤岛,所有节点连通", () => {
  // 灰岩堡 adj 为空 → 靠并查集兜底补桥
  const m = mapBuild("rpg_seed2", RAW_REGIONS);
  const seen = { [m.nodes[0].name]: 1 };
  const queue = [m.nodes[0].name];
  while (queue.length) {
    const cur = queue.shift();
    mapAdjacent(m.edges, cur).forEach(nx => { if (!seen[nx]) { seen[nx] = 1; queue.push(nx); } });
  }
  assert.equal(Object.keys(seen).length, m.nodes.length, "从任一节点出发走得到全图");
});

test("位置只跟节点表走:前往优先,place 模糊对上也算,对不上不动", () => {
  const nodes = normRegions(RAW_REGIONS).flatMap(r => r.nodes);
  const base = Object.assign(camp0(), { pos: "老磨坊", visited: ["老磨坊"] });
  const r1 = applyTurnPayload(base, { place: "猎人小屋" }, { nodes });
  assert.equal(r1.camp.pos, "猎人小屋");
  assert.deepEqual(r1.camp.visited, ["老磨坊", "猎人小屋"]);
  assert.match(r1.chips.map(c => c.txt).join("|"), /抵达·猎人小屋/);
  const r2 = applyTurnPayload(base, { place: "没有这个地方" }, { nodes });
  assert.equal(r2.camp.pos, "老磨坊", "对不上节点名就不挪队伍");
  const r3 = applyTurnPayload(base, { place: "猎人小屋" }, { nodes, travelTo: "河渡口" });
  assert.equal(r3.camp.pos, "河渡口", "玩家亲点的「前往」优先于守密人的 place");
});

test("地图接线:迷雾不渲染未知节点,快照带位置,守密人不许自行挪队", () => {
  assert.match(src, /if \(!isV && !isF\) return null/, "没去过也没听说过的节点不进 DOM");
  assert.match(src, /pos: nc\.pos \|\| ""/, "每拍快照记位置,分支回溯不迷路");
  assert.match(src, /你不要自行把队伍挪去别的节点/);
  assert.match(src, /r: 16, fill: "transparent"/, "隐形大热区,手指点得准");
});

// ---- Codex 加菜:状态条/时钟/命运点/私念/线索板/单人团 ----
test("专属状态条:单拍夹 ±15,坏的那头角标才红", () => {
  const base = Object.assign(camp0(), { gauge: { name: "理智", val: 50, max: 100, bad: "low", rule: "" } });
  const r1 = applyTurnPayload(base, { gauge: -99 });
  assert.equal(r1.camp.gauge.val, 35, "-99 夹成 -15");
  assert.equal(r1.chips.find(c => c.txt.indexOf("理智") >= 0).k, "hp", "理智是 low 坏,跌=红");
  const r2 = applyTurnPayload(base, { gauge: 10 });
  assert.equal(r2.chips.find(c => c.txt.indexOf("理智") >= 0).k, "hpup", "理智涨=绿");
  const high = Object.assign(camp0(), { gauge: { name: "警戒", val: 50, max: 100, bad: "high" } });
  assert.equal(applyTurnPayload(high, { gauge: 10 }).chips[0].k, "hp", "警戒是 high 坏,涨=红");
  assert.equal(applyTurnPayload(camp0(), { gauge: -10 }).camp.gauge, undefined, "没配状态条的团不凭空长");
});

test("威胁时钟:建钟/推进夹±2/走满亮红/done 拆钟/至多3座", () => {
  const base = Object.assign(camp0(), { clocks: [] });
  const r1 = applyTurnPayload(base, { clock: [{ name: "仪式将成", delta: 1, max: 6 }] });
  assert.deepEqual(r1.camp.clocks, [{ name: "仪式将成", filled: 1, max: 6 }]);
  const r2 = applyTurnPayload(r1.camp, { clock: [{ name: "仪式将成", delta: 9 }] });
  assert.equal(r2.camp.clocks[0].filled, 3, "单拍至多 +2");
  const full = Object.assign(camp0(), { clocks: [{ name: "追兵", filled: 5, max: 6 }] });
  const r3 = applyTurnPayload(full, { clock: [{ name: "追兵", delta: 1 }] });
  assert.match(r3.chips.map(c => c.txt).join("|"), /追兵 6\/6·走满!/);
  const r4 = applyTurnPayload(r3.camp, { clock: [{ name: "追兵", done: true }] });
  assert.equal(r4.camp.clocks.length, 0, "爆发后拆钟");
  const three = Object.assign(camp0(), { clocks: [{ name: "a", filled: 0, max: 6 }, { name: "b", filled: 0, max: 6 }, { name: "c", filled: 0, max: 6 }] });
  assert.equal(applyTurnPayload(three, { clock: [{ name: "d", delta: 1 }] }).camp.clocks.length, 3, "第四座不收");
});

test("失败的代价由代码兜底:体魄/身手失败没见血就 -5,大失败 -10,协力者担一半", () => {
  const r1 = applyTurnPayload(camp0(), { hp: [] }, { roll: { role: "roll", who: "Lisa", statKey: "agi", tier: "fail" } });
  assert.equal(r1.camp.party[0].hp, 75);
  const r2 = applyTurnPayload(camp0(), {}, { roll: { role: "roll", who: "Lisa", assist: "裴照川", statKey: "phy", tier: "fumble" } });
  assert.equal(r2.camp.party[0].hp, 70); assert.equal(r2.camp.party[1].hp, 95, "协力共担后果");
  const r3 = applyTurnPayload(camp0(), { hp: [{ name: "Lisa", delta: -12 }] }, { roll: { role: "roll", who: "Lisa", statKey: "agi", tier: "fail" } });
  assert.equal(r3.camp.party[0].hp, 68, "守密人已经记了血就不再重复扣");
  const r4 = applyTurnPayload(camp0(), {}, { roll: { role: "roll", who: "Lisa", statKey: "cha", tier: "fail" } });
  assert.equal(r4.camp.party[0].hp, 80, "谈吐失败不掉血");
});

test("威胁钟不锈死:连着两个掷过骰的拍没人碰就自己走一格;闲逛拍、休整/攀谈拍不走", () => {
  const base = Object.assign(camp0(), { clocks: [{ name: "追兵", filled: 1, max: 6 }] });
  const roll = { roll: { role: "roll", who: "Lisa", statKey: "wit", tier: "ok" } };
  const idle = applyTurnPayload(base, {});
  assert.equal(idle.camp.clocks[0].idle, undefined, "没掷骰的闲逛拍连账都不记");
  const r1 = applyTurnPayload(base, {}, roll);
  assert.equal(r1.camp.clocks[0].filled, 1, "第一拍先忍");
  const r2 = applyTurnPayload(r1.camp, {}, roll);
  assert.equal(r2.camp.clocks[0].filled, 2, "第二个冒险拍自己走");
  assert.equal(r2.camp.clocks[0].idle, undefined);
  const calm = applyTurnPayload(r1.camp, {}, Object.assign({ calm: true }, roll));
  assert.equal(calm.camp.clocks[0].filled, 1, "休整拍不走");
  const touched = applyTurnPayload(r1.camp, { clock: [{ name: "追兵", delta: 0 }] }, roll);
  assert.equal(touched.camp.clocks[0].idle, undefined, "守密人碰过就清零");
});

// 探索态(v60.20,照 ai-virtual-phone 的两态循环):守密人不给选项=这一幕收了,屏上换成地点长出来的交互
test("探索态菜单:只列在这儿的活人、还能翻几次、开着的支线", () => {
  const { exploreMenu, pickSeed, regionOfNode } = require("../js/trpg.js");
  const c = Object.assign(camp0(), { pos: "驿站", searched: { 驿站: 2 },
    npcs: [{ name: "掌柜", alive: true, met: "驿站" }, { name: "游方僧", alive: true, met: "" }, { name: "死人", alive: false, met: "驿站" }, { name: "外地人", alive: true, met: "城郭" }],
    quests: [{ name: "找马", status: "open" }, { name: "还钱", status: "done" }],
    mapRegions: [{ name: "河谷", nodes: [{ name: "驿站" }] }, { name: "山里", nodes: [{ name: "山神庙" }] }],
    sideSeeds: [{ name: "山中野店", region: "山里" }, { name: "马贼", region: "河谷", used: true }, { name: "游商", region: "" }],
    siteActions: { 驿站: ["查马厩蹄印", "翻住客簿"] }, siteDone: { 驿站: ["查马厩蹄印"] } });
  const m = exploreMenu(c);
  assert.deepEqual(m.talk, ["掌柜", "游方僧"]);
  assert.equal(m.searchLeft, 1);
  assert.deepEqual(m.quests, ["找马"]);
  assert.deepEqual(m.siteActions, ["翻住客簿"], "此地专属动作只出现没做过的");
  assert.equal(regionOfNode(c, "山神庙"), "山里");
  assert.equal(pickSeed(c, "山里", () => 0).name, "山中野店", "先抽本区的");
  assert.equal(pickSeed(c, "河谷", () => 0).name, "游商", "本区用完了才抽没标区的;用过的不再抽");
  assert.equal(pickSeed(Object.assign({}, c, { sideSeeds: [] }), "山里"), null);
});

test("场景桌落账:场景轨迹、地点动作和已打出的地点牌一起进状态", () => {
  const c = Object.assign(camp0(), { pos: "驿站", sceneTrail: ["social"], siteActions: {}, siteDone: {} });
  const r = applyTurnPayload(c, { sceneMeta: { type: "investigate", objective: "查货单", stakes: "证据会被烧" }, siteActions: ["翻住客簿", "查马厩蹄印"], choices: [] }, { siteAction: "翻住客簿" });
  assert.equal(r.camp.sceneMeta.type, "investigate");
  assert.deepEqual(r.camp.sceneTrail, ["social", "investigate"]);
  assert.deepEqual(r.camp.siteActions["驿站"], ["翻住客簿", "查马厩蹄印"]);
  assert.deepEqual(r.camp.siteDone["驿站"], ["翻住客簿"]);
  assert.match(src, /这一拍打出的牌/);
  assert.match(src, /〔主动调用〕/);
  assert.match(src, /拿去验证/);
});

test("探索拍:四下看看记一次翻找;搜满三次就不再给这个按钮", () => {
  const c = Object.assign(camp0(), { pos: "驿站" });
  const r = applyTurnPayload(c, { scene: "x", choices: [] }, { explore: "search" });
  assert.equal(r.camp.searched["驿站"], 1);
  assert.equal(applyTurnPayload(r.camp, { choices: [] }, { explore: "search" }).camp.searched["驿站"], 2);
  assert.match(src, /stuck \? h\("div"/, "没选项时换成探索面板");
  assert.match(src, /四下看看/); assert.match(src, /让守密人接着讲/);
  assert.match(src, /choices 给【空数组】,队伍会落回探索态/, "守密人得知道收幕=空选项");
});

test("命运点:跟气运走;只在失败后可花;重掷只许一次;花掉立扣", () => {
  const { rollStats: rs } = require("../js/trpg.js");
  const fate = src.match(/const fateOf = luck =>[^;]+;/);
  assert.ok(fate, "fateOf 存在");
  assert.match(src, /offer = c\.fate > 0 && !c\.rerolled && \(grade\.tier === "fail" \|\| grade\.tier === "fumble"\)/, "成功不给花,重掷过不给再花");
  assert.match(src, /重掷\(花1枚,新结果必须认\)/);
  assert.match(src, /ceremony\.grade\.tier === "fumble" \? btn\("✦ 以失败论/, "以失败论只对大失败开放");
  assert.match(src, /spendFate\(c\.mKey\)/, "花掉立扣队伍账,不等回合结算");
  assert.match(src, /花" \+ res\.spent\.length \+ "枚命运点/, "花点记进检定行,守密人看得见");
});

test("线索板:守密人只裁值不值得查,绝不判对错", () => {
  assert.match(src, /绝不透露推测对错/);
  assert.match(src, /值得验证/);
  assert.match(src, /根基还不稳/);
  assert.match(src, /把线索拼成一条推论记下来/);
});

test("队友私念与单人团", () => {
  assert.match(src, /队友的私念\(同样保密/, "私念进秘典,守密人按它演");
  assert.match(src, /不许把队友演成只会附和的陪跑/);
  assert.match(src, /队友们一路藏着的私念/, "落幕解密时亮给她看");
  assert.match(src, /这是一场【单人团】/, "不拉队友也开得成");
  assert.ok(!/先拉至少一个队友入队/.test(src), "旧的人数门槛拆掉了");
  assert.match(src, /守密风格·/, "风格只进叙事口味");
  assert.match(src, /绝不改检定判定与规则公平/);
});

// ---- 2026-08-28 второй批体验修:大地图/闲聊/行头/背景锁脸/自由行动掷骰 ----
test("舆图可拖可捏:单套 pointer 处理两指,拖动不算点选,视口有夹紧", () => {
  assert.match(src, /touchAction: "none"/);
  assert.match(src, /ids\.length === 2/, "双指捏合与单指平移在同一套处理器里,两指时不再各自为政");
  assert.match(src, /const clampVB = /, "视口夹在地图边界内,拖不出白茫茫");
  assert.match(src, /if \(!mapPtr\.current\.moved\) setSelNode/, "拖完松手不误选节点");
  assert.match(src, /k: Math\.min\(6,/, "缩放有上限");
});

test("闲聊模式:说话走加戏不推进,行动按钮变闲聊", () => {
  assert.match(src, /if \(chatMode\) \{ clearPlayed\(\); return addBeat\(text\); \}/);
  assert.match(src, /让队友们自然接话/);
  assert.match(src, /闲聊两句\(不推进剧情、不动状态\)/);
});

test("闲聊是可折叠的气泡簇,不淹主剧情;喂回守密人时压成一行", () => {
  assert.match(src, /role: "chat", lines: \[\{ name: uName, text: text/, "她那句+队友接话合成一条簇");
  assert.match(src, /fold: !x\.fold/, "点头部折叠,折叠状态存进消息本身");
  assert.match(src, /💬 闲聊 · /, "折起来只剩一行");
  // foldHist 纯函数:闲聊压成一行标记喂回,守密人知道唠过什么但不当剧情正文
  const out = foldHist([{ role: "gm", content: "夜里下雨。" }, { role: "chat", lines: [{ name: "Lisa", text: "饿了", act: "" }, { name: "顾朝", text: "还有干粮", act: "翻包" }] }]);
  assert.equal(out.length, 2);
  assert.match(out[1].content, /〔闲聊〕Lisa:饿了 \/ 顾朝:还有干粮\(翻包\)/);
  assert.equal(out[1].role, "user");
});

test("队伍与线索是右侧抽屉,不再是 56vh 顶部条", () => {
  assert.match(src, /position: "fixed", top: 0, right: 0, bottom: 0/, "整条侧边高度都归它");
  assert.ok(!/maxHeight: "56vh"/.test(src), "旧顶部条退场");
});

test("行头:开团生成、出图锁定,合照里逐人标穿着", () => {
  assert.match(src, /\\"outfits\\":\[\{/, "开团设定里生成每人行头(SHAPE 里是转义引号)");
  assert.match(src, /photoOutfit: outfitOf\(ch\.name\)/, "单人/合照主角锁行头(小剧场 charOutfit 同一课)");
  assert.match(src, /outfit: outfitOf\(uName\)/, "她自己的行头也锁");
  assert.match(src, /服装严格按各自括号里的行头/);
});

test("锁脸不必挤前景:背景里的人也要认得出是谁", () => {
  assert.match(src, /人物不必都挤在前景/);
  assert.match(src, /远处的人也要凭对应参考图的五官发型看得出是谁/);
});

test("自由输入的行动也掷骰:守密人报 needCheck→客户端掷→续写,只许要一次", () => {
  assert.match(src, /scene 写到出手前的悬点就停住/, "先停在悬点,不许直接写成败");
  // 验行为不验长相(opus 8/29 抓的「冻源码」病):守卫必须同时含 declaration 与
  // mode!=="resolve",表达式怎么长(比如加了 ccTry 的「赌」)不冻
  {
    const guard = src.match(/nck &&[^\n]*&& mode !== "resolve"[^\n]*\{/);
    assert.ok(guard, "needCheck 守卫必须存在且以 mode!==\"resolve\" 拦住续写轮");
    assert.ok(/declaration/.test(guard[0]), "守卫必须认亲笔宣言轮");
    assert.ok(/!extra \|\| !extra\.length/.test(guard[0]), "选项轮(带 extra)不连环要骰");
  }
  assert.match(src, /绝不再报 needCheck/, "续写轮明令收口");
  assert.match(src, /\|\| camp\.party\[0\]/, "没点名兜底最终仍落到她自己");
});

// ---- Codex 第二批加菜:任务日志/名册/状态效果/专长/时间/修正/休团 ----
test("支线任务日志:add 开线,状态流转,凭空 done 不生线", () => {
  const r1 = applyTurnPayload(camp0(), { quest: [{ name: "齿轮与心跳", op: "add", note: "搜集发条零件" }] });
  assert.deepEqual(r1.camp.quests.map(q => [q.name, q.status]), [["齿轮与心跳", "open"]]);
  const r2 = applyTurnPayload(r1.camp, { quest: [{ name: "齿轮与心跳", op: "done" }] });
  assert.equal(r2.camp.quests[0].status, "done");
  assert.match(r2.chips.map(c => c.txt).join("|"), /齿轮与心跳·完成/);
  const r3 = applyTurnPayload(camp0(), { quest: [{ name: "没开过的线", op: "done" }] });
  assert.equal((r3.camp.quests || []).length, 0, "没 add 过的线不能凭空完成");
});

test("NPC 名册:按名 upsert,死亡出角标,note 只是玩家已知", () => {
  const r1 = applyTurnPayload(camp0(), { npc: [{ name: "奥菲利亚", role: "巡逻队长", stance: "友" }] });
  assert.equal(r1.camp.npcs[0].stance, "友");
  const r2 = applyTurnPayload(r1.camp, { npc: [{ name: "奥菲利亚", stance: "敌", alive: false }] });
  assert.equal(r2.camp.npcs.length, 1, "同名 upsert 不重复建档");
  assert.equal(r2.camp.npcs[0].alive, false);
  assert.match(r2.chips.map(c => c.txt).join("|"), /† 奥菲利亚/);
});

test("状态效果:每人至多4个,remove 解除,查无此人丢弃", () => {
  const r1 = applyTurnPayload(camp0(), { effect: [{ who: "裴照川", name: "中毒", note: "每拍隐痛,解药可解" }, { who: "查无此人", name: "恐惧" }] });
  assert.deepEqual(r1.camp.party[1].effects.map(e => e.name), ["中毒"]);
  assert.equal((r1.camp.party[0].effects || []).length, 0);
  const r2 = applyTurnPayload(r1.camp, { effect: [{ who: "裴照川", name: "中毒", op: "remove" }] });
  assert.equal(r2.camp.party[1].effects.length, 0);
  assert.match(r2.chips.map(c => c.txt).join("|"), /中毒解除/);
});

test("团内时间只向前:倒流丢弃,单拍至多跨两天", () => {
  const base = Object.assign(camp0(), { time: { day: 3, part: "暮" } });
  assert.equal(applyTurnPayload(base, { time: { day: 2, part: "晨" } }).camp.time.day, 3, "回到昨天?不行");
  assert.equal(applyTurnPayload(base, { time: { day: 3, part: "晨" } }).camp.time.part, "暮", "同日倒退时辰也不行");
  const r = applyTurnPayload(base, { time: { day: 9, part: "夜" } });
  assert.equal(r.camp.time.day, 5, "一拍最多跨 2 天");
  assert.equal(applyTurnPayload(base, { time: { day: 3, part: "夜" } }).camp.time.part, "夜", "正常往前走没问题");
});

test("专长:检定贴合时 +15,写进检定行", () => {
  assert.match(src, /const ceremonyEff = c => Math\.min\(95, c\.base/, "所有加成(专长/协力/交易)合计后封顶95");
  assert.match(src, /专长·" \+ res\.feat \+ "\+15/, "检定行写明专长加成");
  assert.match(src, /把机会点给有这门手艺的人/, "守密人被教了怎么用 feat");
  const party = camp0().party;
  const out = normChoices([{ text: "包扎", check: { stat: "wit", who: "裴照川", feat: "急救" } }], party);
  assert.equal(out[0].check.feat, "急救", "选项上的 feat 存下来了");
});

test("GM 手动修正:每笔都写〔修正〕系统行,守密人看得见", () => {
  assert.match(src, /修正·" \+ uName \+ " 手动/, "修正入史");
  assert.match(src, /✎ 修正/);
  assert.match(src, /点一条轮换状态/, "支线可改");
  assert.match(src, /补记一件/, "物品可补记");
});

test("休团回来横幅:12小时零成本,看完点掉", () => {
  assert.match(src, /12 \* 3600 \* 1000/, "隔半天以上才出现");
  assert.match(src, /休团回来 · 第/, "带时间地点");
  assert.match(src, /上回说到——/, "带最后一拍的尾巴");
  assert.match(src, /接上,继续/);
});

// ---- Codex 清单收尾 + 两段式开团 + 区域支线种子 ----
test("两段式开团:台前专心搭世界,幕后专心写底牌,幕后失败可单独补", () => {
  assert.match(src, /const SHAPE_A = /);
  assert.match(src, /const SHAPE_B = /);
  assert.match(src, /只写这些,写透它们;秘典底牌、队友私念、支线这些幕后另有一枪/, "台前不被幕后分心");
  assert.match(src, /专心写幕后底牌/);
  assert.match(src, /✎ 补幕后/, "幕后失败不废局,预览里单独补");
  assert.match(src, /一律【只补空,不覆盖】|只补空不覆盖/, "补幕后动不了已有的台本(模组导入靠这个保台)");
});

test("支线种子:端出即作废,fuzzy 同名也认", () => {
  const base = Object.assign(camp0(), { sideSeeds: [{ name: "齿轮与心跳", region: "钟楼", trigger: "到达钟楼", hook: "x", used: false }, { name: "另一条", region: "", trigger: "", hook: "", used: false }] });
  const r = applyTurnPayload(base, { quest: [{ name: "齿轮与心跳", op: "add" }] });
  assert.equal(r.camp.sideSeeds[0].used, true, "被端出来的种子作废");
  assert.equal(r.camp.sideSeeds[1].used, false, "别的种子不动");
  assert.match(src, /触发条件在剧情里【真实满足】时才把种子端出来/, "条件没满足不许硬塞");
});

test("支线随时暂离/重拾:零成本,写〔支线〕记录给守密人看", () => {
  assert.match(src, /⏸ 暂离/);
  assert.match(src, /▶ 重拾/);
  assert.match(src, /支线·" \+ uName \+ " 决定/, "她的决定入史");
  assert.match(src, /暂离的线留着钩子等她回头,别硬拽/);
});

test("简化先攻:只在危险拍出顺序标尺,名字要在队", () => {
  const r = applyTurnPayload(camp0(), { order: ["裴照川", "查无此人", "Lisa", "裴照川"] });
  assert.match(r.chips.map(c => c.txt).join("|"), /⚔ 顺序:裴照川→Lisa/, "去重+过滤陌生名");
  const r2 = applyTurnPayload(camp0(), { order: ["只有一个人"] });
  assert.ok(!r2.chips.some(c => c.txt.indexOf("顺序") >= 0), "凑不齐两人不出顺序");
  assert.match(src, /平时省略——别拿先攻打断叙事/);
});

test("安全线:最高优先级,淡出处理", () => {
  assert.match(src, /安全线\(最高优先级,压过一切风格与剧情需要\)/);
  assert.match(src, /淡出换景处理,不描写过程/);
  assert.match(src, /limits: limitsTxt\.trim\(\)/, "开团时存进战役");
});

test("玩家暗线:候选可挑可自写,守密人不点破,落幕给判词", () => {
  assert.match(src, /只有你和玩家知道,队友与 NPC 都不知道/);
  assert.match(src, /绝不替玩家推进、绝不点破/);
  assert.match(src, /暗线判词/, "终章评它走到了哪");
  assert.match(src, /已选暗线:/);
});

test("骰子账与模组包", () => {
  assert.match(src, /sect\("🎲", "骰子账"/, "检定历史单独可查（v58.61 起是面板里的一块）");
  assert.match(src, /kind: "trpg-module"/, "打包模组");
  assert.match(src, /用模组开团/, "可导入重开");
  assert.match(src, /sideSeeds: \(Array\.isArray\(mod\.seeds\) \? mod\.seeds : \[\]\)\.map\(x => Object\.assign\(\{\}, x, \{ used: false \}\)\)/, "导入时种子全部复位");
});

test("输出天花板统一给满:按次计费,上限不省钱只会截断", () => {
  assert.match(src, /const TOK_MAX = 65535/);
  assert.ok(!/maxTokens: \d/.test(src), "不再有零散的小上限");
  assert.ok((src.match(/maxTokens: TOK_MAX/g) || []).length >= 8, "所有调用全走天花板");
});

// ---- 骰子桌五件套 + 冒险小分队 ----
test("对抗骰:档高者胜,同档骰点小者胜,再平守方胜", () => {
  const g = (t2) => ({ tier: t2 });
  assert.equal(decideOpposed(g("hard"), 20, g("ok"), 10), "win", "档高压过点数");
  assert.equal(decideOpposed(g("ok"), 12, g("ok"), 40), "win", "同档掷得低=发挥好");
  assert.equal(decideOpposed(g("ok"), 30, g("ok"), 30), "lose", "全平守方胜——进攻要赢就得真赢");
  assert.equal(decideOpposed(g("fumble"), 96, g("fail"), 80), "lose");
  assert.match(src, /档高者胜;检定行里的「对抗胜\/负」是铁案/, "守密人被教了照对抗结果叙");
});

test("伤害骰口径与协力/交易的规则", () => {
  assert.equal(harmZh(3), "擦伤"); assert.equal(harmZh(12), "结结实实");
  assert.equal(harmZh(19), "重创"); assert.equal(harmZh(20), "几乎致命");
  assert.match(src, /hp 字段按这颗骰的轻重写,别自己另拍数/);
  assert.match(src, /大失败要连累协力者/, "协力共担后果");
  assert.match(src, /代价【无论成败必然兑现】/, "魔鬼交易不许赖账");
  assert.match(src, /协力\(共担后果\):/, "仪式里出手前可点协力");
  assert.match(src, /😈 魔鬼交易:\+15/, "开了价才有交易按钮");
});

test("重伤表与失控表:见底当场掷,重伤是 scar 会跟老卡走", () => {
  const base = camp0();
  base.party[1].hp = 10;
  const r = applyTurnPayload(base, { hp: [{ name: "裴照川", delta: -30 }] }, { rand: () => 0 });
  assert.equal(r.camp.party[1].hp, 0);
  assert.equal(r.camp.party[1].effects[0].name, "断了肋骨", "rand=0 取表第一条");
  assert.equal(r.camp.party[1].effects[0].scar, true, "重伤留疤");
  const gb = Object.assign(camp0(), { gauge: { name: "理智", val: 10, max: 100, bad: "low" } });
  const r2 = applyTurnPayload(gb, { gauge: -15 }, { rand: () => 0 });
  assert.equal(r2.camp.party[0].effects[0].name, "歇斯底里", "理智见底玩家掷失控表");
  const r3 = applyTurnPayload(Object.assign(camp0(), { gauge: { name: "理智", val: 0, max: 100, bad: "low" } }), { gauge: -5 }, { rand: () => 0 });
  assert.equal((r3.camp.party[0].effects || []).length, 0, "本来就见底不重复掷——只在跨线那拍");
});

test("成长骰:成功过的属性才有资格,d100 高于现值才 +5,封顶 90", () => {
  const party = camp0().party;
  const recs = [{ who: "Lisa", statKey: "agi", tier: "ok" }, { who: "Lisa", statKey: "wit", tier: "fail" }, { who: "裴照川", statKey: "wit", tier: "crit" }];
  const g = growthRolls(party, recs, () => 0.99);
  assert.deepEqual(g.map(x => [x.name, x.stat, x.to]), [["Lisa", "agi", 55], ["裴照川", "wit", 75]], "失败过的 wit 不给 Lisa 长");
  const g2 = growthRolls(party, recs, () => 0);
  assert.ok(g2.every(x => x.to === x.from), "掷不过现值就不长");
  const strong = [{ key: "u", name: "A", stats: { phy: 90, agi: 50, wit: 50, cha: 50, luck: 50 } }];
  assert.equal(growthRolls(strong, [{ who: "A", statKey: "phy", tier: "ok" }], () => 0.99).length, 0, "90 封顶不再长");
});

test("冒险小分队 v2:多队立户、数值建队掷定、成长只归所属队", () => {
  assert.match(src, /x_trpgSquads/, "多小分队库,跟随 x_ 云同步");
  assert.match(src, /x_trpgSquad"/, "旧单队库一次性迁移,老卡不丢");
  assert.match(src, /数值在【组建队伍时】就掷定/, "建队即定数值");
  assert.match(src, /小队A\n?.{0,10}体魄\+5,不影响他在小队B的卡|体魄\+5,不影响他在小队B/, "A队的成长进不了B队");
  assert.match(src, /homeSquad = sqv\.squads\.find\(x => x\.id === camp\.squadId\)/, "落幕只写回这团所属的队");
  assert.match(src, /解散「" \+ sq\.name/, "整队解散,不影响已开的团");
  assert.match(src, /先点右上角 ＋ 组建一支小分队/, "开团必须先有队");
  assert.match(src, /建队,去开团/, "组建页一键转开团");
  assert.ok(!/rerollDraftStats/.test(src), "预览页重掷退场——数值建队定");
});

test("收藏世界与图库", () => {
  assert.match(src, /x_trpgWorlds/, "世界收藏只存长期为真的世界观+地图");
  assert.match(src, /世界观与区域节点一个字不许改/, "用收藏开新局:世界不动,故事全新");
  assert.match(src, /🌍 收藏世界/);
  assert.match(src, /x_trpgGallery/, "图库独立存,删团不删图");
  assert.match(src, /galAdd\(\{ campId: camp\.id/, "封面与当拍画面出图即归档");
  assert.match(src, /删团也不丢/, "图库文案说清了这一点");
  assert.match(src, /🎲 开团\(带一支小分队进新世界\)/, "＋菜单:开团/组建队伍");
});

// ---- 秘典:开团即生成,落幕前不给看 ----
test("秘典落幕解密,不在过程中泄底", () => {
  assert.match(src, /玩家永远不可见/);
  assert.match(src, /秘典解密/);
  // 预览页只亮第一章,后面的章节走到才揭晓
  assert.match(src, /未揭晓,推进到才亮出|\?\?\?/);
});

// ============================================================
// 她 2026-09-03:「看看 codex 更新的跑团,看看有啥能更改的让它丰富一点」。
// 查下来缺的是【人】那一维——面板上全是 HP/属性/威胁钟/线索/支线,
// 队友只有「能力 + 一句私念」,没有任何东西记着他跟你这一路处得怎么样。
// 补了四样:羁绊 / 翻章的幕间 / NPC 人情账 / 队友手上的牌。
// ============================================================
const { bondVal, bondZh, bondBoost, BOND_HIGH, BOND_LOW, BOND_START } = require("../js/trpg.js");

const camp1 = () => Object.assign(camp0(), {
  party: [{ key: "user", name: "Lisa", hp: 80, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } },
          { key: "c1", name: "裴照川", hp: 100, maxHp: 100, stats: { phy: 60, agi: 55, wit: 70, cha: 65, luck: 40 } },
          { key: "c2", name: "陆衍", hp: 90, maxHp: 100, stats: { phy: 45, agi: 70, wit: 60, cha: 50, luck: 55 } }],
  npcs: [{ name: "老周", role: "船工", stance: "未明", alive: true }]
});

test("羁绊:开团 50,玩家自己不挂羁绊", () => {
  const c = camp1();
  assert.equal(bondVal(c.party[1]), BOND_START);
  assert.equal(bondVal(c.party[0]), null, "玩家头上不该有羁绊");
  assert.equal(bondZh(BOND_START), "同行");
});

test("羁绊:必须写清因为哪件事——没写 why 的整条丢掉", () => {
  const { camp, chips } = applyTurnPayload(camp1(), { bond: [
    { name: "裴照川", delta: 1, why: "你替他挡了那一刀" },
    { name: "陆衍", delta: 2 }] });
  assert.equal(bondVal(camp.party[1]), 55, "一档 5 点");
  assert.equal(bondVal(camp.party[2]), BOND_START, "没写 why 的不落账");
  assert.ok(chips.some(x => /🔗 裴照川\+5 · 你替他挡了那一刀/.test(x.txt)), "角标要把那件事一起钉上");
  assert.deepEqual(camp.party[1].bondLog.map(x => x.why), ["你替他挡了那一刀"]);
});

test("羁绊:单人夹 ±2 档,一拍最多动两个人,名字对不上丢弃", () => {
  const c = camp1();
  c.party.push({ key: "c3", name: "阿箬", hp: 100, maxHp: 100, stats: { phy: 50, agi: 50, wit: 50, cha: 50, luck: 50 } });
  const { camp } = applyTurnPayload(c, { bond: [
    { name: "裴照川", delta: 9, why: "他把命交给你了" },
    { name: "陆衍", delta: -9, why: "你当众驳了他" },
    { name: "阿箬", delta: 2, why: "你护着她" },
    { name: "查无此人", delta: 2, why: "凭空冒出来的" }] });
  assert.equal(bondVal(camp.party[1]), 60, "+2 档封顶");
  assert.equal(bondVal(camp.party[2]), 40, "-2 档封顶");
  assert.equal(bondVal(camp.party[3]), BOND_START, "第三个人这一拍不落账——一拍全队齐刷刷变动那是记账不是相处");
});

test("羁绊:是骰面上的差别,不是形容词", () => {
  assert.equal(bondBoost({ key: "c1", bond: BOND_HIGH }), 5, "交底的替你出手更卖力");
  assert.equal(bondBoost({ key: "c1", bond: BOND_LOW }), -5, "离心的没怎么使劲");
  assert.equal(bondBoost({ key: "c1", bond: BOND_START }), 0);
  assert.equal(bondBoost({ key: "user", name: "Lisa" }), 0, "玩家自己没有这一档");
  // 加成只在 ceremonyEff 这一个口子里算,别处只负责显示
  assert.match(src, /const ceremonyEff = c => Math\.min\(95, c\.base \+ \(c\.feat \? 15 : 0\) \+ \(c\.assist \? 10 : 0\) \+ \(c\.bargainOn \? 15 : 0\) \+ \(c\.bond \|\| 0\)\)/);
  assert.match(src, /bond: bondBoost\(member\)/, "掷骰那一刻要把这个人的羁绊算进去");
  assert.match(src, /res\.bond > 0 \? "羁绊\+5" : res\.bond < 0 \? "离心-5" : null/, "检定行里要写出来是哪一档给的");
});

test("羁绊要真的喂回守密人:状态表、规则块、落幕都得看得见", () => {
  assert.match(src, /羁绊" \+ bv \+ "\(" \+ bondZh\(bv\) \+ "\)"/, "状态表里要有羁绊");
  assert.match(src, /【羁绊·队友这一路怎么看你】/, "规则块没发出去");
  assert.match(src, /【队友那几段按羁绊来写】/, "落幕那几段要按羁绊写");
  // 只降概率不够:why 空的丢弃、±2 夹紧、一拍两人这三道都在代码里(见上面几条)
});

test("人情账:欠谁的记在名册上,两清了要能销账", () => {
  const r1 = applyTurnPayload(camp1(), { npc: [{ name: "老周", debt: "owed", debtNote: "你替他瞒了那船货" }] });
  assert.deepEqual(r1.camp.npcs[0].debt, { side: "owed", note: "你替他瞒了那船货" });
  assert.ok(r1.chips.some(x => /🤝 老周欠你·你替他瞒了那船货/.test(x.txt)));
  const r2 = applyTurnPayload(r1.camp, { npc: [{ name: "老周", debt: "clear" }] });
  assert.equal(r2.camp.npcs[0].debt, undefined, "还清了就销账");
  const r3 = applyTurnPayload(r2.camp, { npc: [{ name: "老周", debt: "胡写的" }] });
  assert.equal(r3.camp.npcs[0].debt, undefined, "只认 owe/owed/clear");
  assert.match(src, /【人情账】/, "规则块没发出去");
  assert.match(src, /debt\.side === "owe" \? uName \+ "欠他"/, "名册喂回去时要带上这笔账");
});

test("队友手上的牌:选项写明谁掏什么,点了真的从那个人身上扣", () => {
  const cs = normChoices([{ text: "让陆衍掏出解毒剂", approach: "ally", use: { name: "解毒剂(陆衍)×2", who: "陆衍" } },
                          { text: "不存在的人掏东西", use: { name: "绳索", who: "查无此人" } }],
                         camp1().party);
  assert.deepEqual(cs[0].use, { name: "解毒剂", who: "陆衍" }, "持有人和数量的尾巴要剥掉");
  assert.deepEqual(cs[1].use, { name: "绳索", who: null }, "人对不上就只丢 who,选项本身还在");
  const c = camp1();
  c.items = [{ name: "解毒剂", holder: "陆衍", n: 2 }];
  const { camp, chips } = applyTurnPayload(c, {}, { useItem: { name: "解毒剂", who: "陆衍" } });
  assert.equal(camp.items[0].n, 1, "真的扣掉一件");
  assert.ok(chips.some(x => /🃏 陆衍掏出·解毒剂/.test(x.txt)));
  assert.match(src, /【队友掏东西】/, "规则块没发出去");
  assert.match(src, /const useMode = c\.use && hasItem\(camp\.items, c\.use\.name\) \? \{ use: c\.use \} : null/, "点选项时要把这张牌传下去");
});

test("幕间:翻章之后那一拍,而且不能在 confirmStage 里直接开", () => {
  // ⚠那一刻闭包里的 camp 还是旧的(stageIdx 没加),直接调 turn 会把幕间写成上一章的戏
  assert.match(src, /const confirmStage = \(ok, withLull\) => \(withLull && ok && setLullDue\(true\)/);
  assert.match(src, /useEffect\(\(\) => \{\n\s*if \(!lullDue \|\| !camp \|\| busy \|\| camp\.ended\) return;/);
  assert.match(src, /turn\("\(这一章就此翻过——动身之前,队伍先松一口气\)", null, "lull"\)/);
  assert.match(src, /mode === "lull" \? "\\n〔幕间〕/, "幕间那一段提示词");
  // 幕间不掷骰、钟不走、落回自由活动
  assert.match(src, /calm: mode === "rest" \|\| mode === "lull"/, "幕间那一拍威胁钟不许走");
  assert.match(src, /\(mode === "rest" \|\| mode === "lull" \|\| \(mode && mode\.night\)\) \? "interlude"/, "场景型固定成休整(夜谈也是)");
  // 她可以不要这一拍(按次计费,别硬塞)
  assert.match(src, /confirmStage\(true, false\), style: S\.btn\(false\) \}, "翻过·直接接着演"/);
});

test("打出一张牌只是附注,不该顺手吃掉喘气拍", () => {
  // 原来是 !mode 才给喘气拍;use 走 mode 之后要显式排除,否则连着三拍绷着的间歇会被吞掉
  assert.match(src, /const specialMode = mode && \(typeof mode === "string" \|\| mode\.talk \|\| mode\.night \|\| mode\.pov \|\| mode\.travel \|\| mode\.explore \|\| mode\.seed\)/);
  assert.match(src, /const wantLull = !specialMode && !dice && tenseStreak >= 3/);
});
