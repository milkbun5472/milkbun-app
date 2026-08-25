const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const codeOnly = src => src.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");

// 她 2026-08-25 定的四条：① 没有心情/好感 ② 只能进主人的群
// ③ 跟着主人一起删 ④ 群里不加视觉标记。
// 生成方式：她在主角色档案里填一句「要谁」（陆闻 / 他的属下），一次调用出简介+关系。

test("NPC 就是角色，只多两个字段", () => {
  assert.match(app, /npc: true, ownerId: hostId/, "别另起一张表——群聊/记忆/头像全是绕 characters 转的");
  assert.match(app, /const liveChars = characters\.filter\(c => c && !c\.npc\);/);
});

// ⚠️这条是整个功能最贵的地方：13 处遍历全部角色，其中 6 处每天每人烧一次 API。
// 五个配角＝每天白烧十次调用，而且陆闻会开始发朋友圈、有日程、长出自己的欲望。
test("NPC 绝不许掉进任何会花钱的后台循环", () => {
  const code = codeOnly(app);
  const stray = code.split("\n")
    .map((l, n) => ({ l, n: n + 1 }))
    .filter(x => /\bcharacters\.(forEach|filter|map)\(/.test(x.l))
    // 这两处是有意用全量的：清理孤儿数据要认得所有 id；npcsOf 本来就是找配角
    .filter(x => !/const valid = new Set/.test(x.l) && !/const npcsOf/.test(x.l) && !/const liveChars/.test(x.l));
  assert.deepEqual(stray.map(x => x.n), [],
    "这些行还在遍历全量 characters，必须走 liveChars：\n" + stray.map(x => x.n + ": " + x.l.trim().slice(0, 80)).join("\n"));
});

// 递给 UI 的一律是 liveChars —— 这样「不显示 NPC」是默认，漏一处只是少显示，
// 而不是 NPC 漏进通讯录/聊天列表/朋友圈。让遗漏往安全那边掉。
test("递给 UI 的角色列表默认不含 NPC", () => {
  assert.equal(codeOnly(app).indexOf("characters: characters,"), -1, "还有地方把全量递给了 UI");
  assert.ok((app.match(/characters: liveChars,/g) || []).length > 30);
  // 只有真的要按 id 找群成员的两处显式拿全量
  assert.equal((app.match(/allChars: characters,/g) || []).length, 3, "聊天列表的群头像 + 群聊页 + 关系页");
  assert.match(comp, /const memberById = id => \(allChars \|\| characters\)\.find/);
});

test("① 没有心情、没有好感度", () => {
  assert.match(app, /if \(spk && !spk\.npc && !isNaN\(aDelta\)\) bumpAff/, "群线上");
  assert.match(app, /if \(spk && !spk\.npc && moodLabel\) setMoodFor/, "群线上");
  assert.match(app, /const _bNpc = .*\.npc;/, "群线下");
  // 上下文也别喂：配角没有心情/好感/印象卡/年龄/行程/情侣状态这些层
  ["配角没有心情", "配角没有好感度", "配角没有印象卡", "配角没有年龄这一层", "配角没有行程", "配角跟用户没有关系线"]
    .forEach(x => assert.ok(app.indexOf(x) > 0, "群线下 ctx 少挡了一层：" + x));
  assert.match(app, /if \(c\.npc\) \{/, "群线上 memberDesc 要有配角分支");
});

// 她 2026-08-25 第二轮：「找不到」——原先塞在资料卡里。
// NPC 本来就是「某个角色身边的一段关系」，入口该跟「我和角色」「角色之间」并排。
test("入口在【关系】的 + 里，跟另外两种并排；资料卡里那份要撤干净", () => {
  assert.match(screens, /seg\("npc", c\.tab, \(\) => set\(\{ tab: "npc" \}\), "NPC"\)/);
  assert.match(screens, /c\.tab === "npc" \? h\(Fragment, null,/);
  assert.match(screens, /placeholder: "陆闻 \/ 他的属下 \/ 她师姐"/);
  // NPC 那一支没有「关系」可存，右上角的勾要藏起来，别让她按了没反应
  assert.match(screens, /c\.tab !== "npc" && h\("button", \{ onClick: onSave/);
  // 两个入口只留一个
  assert.equal(comp.indexOf("npcPanel"), -1, "资料卡那份没撤干净");
  assert.equal(app.indexOf("onOpenNpc"), -1);
  assert.match(app, /npcsOf: npcsOf,/, "关系页要拿得到某个角色身边已有的人");
});

// 「添加群聊的时候要放宽，可以只放我和角色进去，进去再拉人」
test("建群只要一个角色就能建", () => {
  assert.match(comp, /if \(name\.trim\(\) && sel\.length >= 1\) onCreate/);
  assert.match(comp, /disabled: !name\.trim\(\) \|\| sel\.length < 1/);
  assert.equal((comp.match(/sel\.length >= 2|sel\.length < 2/g) || []).length, 0, "还留着两人起的门槛");
});

// 「进去再拉人，可以从他已有关系里面拉」
test("加人选单把有关系的排在前面单独一组", () => {
  assert.match(comp, /const relatedTo = id => \(memberIds \|\| \[\]\)\.some/);
  assert.match(comp, /const nearby = pool\.filter\(c => c\.npc \|\| relatedTo\(c\.id\)\)/);
  assert.match(comp, /"和群里的人有关系的"/);
  assert.match(comp, /"其他角色"/, "其余角色仍要列出来，不砍掉");
  assert.match(app, /rels: rels,/, "群设置要拿得到关系表");
});

// 她 2026-08-25：裴照川的关系页显示「TIES · 0」——陆闻明明已经生成了。
// 真凶是 exists() 拿不含 NPC 的列表去校验关系两头，整条被滤掉。
test("配角那段关系要在角色的关系页里显示出来", () => {
  assert.match(screens, /const all = allChars \|\| characters;/);
  assert.match(screens, /const exists = id => id === "me" \|\| all\.some\(c => c\.id === id\);/);
  assert.match(screens, /const nameOf = id => id === "me" \? me : \(all\.find/);
  // 名册（左边那张角色列表）仍然只列真角色，配角只作为伙伴出现在详情里
  assert.match(screens, /const participants = \[\{ id: "me" \}, \.\.\.characters\.map/);
});

// 她 2026-08-25：「简介打不开看全部」。配角没有自己的资料页，
// 读全文和改都只能落在关系页里。
test("简介能展开看全文，也能就地改", () => {
  assert.match(screens, /function NpcBrief\(\{ npc, onSave, compact \}\)/);
  assert.match(screens, /open \? "收起" : "展开简介"/);
  assert.match(screens, /WebkitLineClamp: 2/, "收起时只显示两行");
  assert.match(screens, /✏️ 改简介/);
  assert.match(app, /onSaveNpcBrief: \(id, text\) =>/);
  // 关系详情里和生成清单里用的是同一个框
  assert.equal((screens.match(/h\(NpcBrief, \{/g) || []).length, 2);
  // ⚠️外层原本是 <button>，简介框里有 textarea 和按钮，嵌不进去
  const wrap = screens.slice(screens.indexOf("const DetailRowWrap"), screens.indexOf("// ---- 详情视图 ----"));
  assert.doesNotMatch(wrap, /h\("button", \{ onClick: \(\) => openEdit/, "关系卡本体不能再是 button");
});

// 她 2026-08-25 看到陆闻也有一张实时状态卡，问是不是正常的。
// 三样是真写的（穿着/动作/心声，跟群里那一轮同一次调用带回来，白得的，留着）；
// 两样是【假的】——心情显示默认「平静」、好感显示默认 50，而写入早被挡掉了，
// 它们永远不会动。卡上还写着「默认，聊几句会变化」——那是在骗人，比不显示更坏。
test("配角的状态卡不许摆出永远不会动的心情和好感", () => {
  assert.match(app, /isNpc: !!scc\.npc,/);
  assert.match(comp, /dm && !isNpc && /, "实时心情那张卡");
  assert.match(comp, /默认，聊几句会变化"\)\)\), !isNpc && /, "好感度那张卡");
  // 穿着/动作/心声照旧显示——那些是真的
  assert.doesNotMatch(comp, /!isNpc && .*hideWearAction/);
});

// 印象卡是「从私下往来长出来的」，而配角跟她根本没有私聊——这一处的【写】之前漏挡了
test("配角长不出印象卡", () => {
  assert.match(app, /if \(spk && !spk\.npc && item\.impression && window\.Gaze/);
  assert.match(app, /gazeOn: .*&& !scc\.npc,/);
});

test("② 只能进主人的群", () => {
  assert.match(comp, /c\.npc && !memberIds\.includes\(c\.id\) && memberIds\.includes\(c\.ownerId\)/,
    "主人不在这个群里，配角就不该出现在加人选单里");
  // 建群时也进不来：NewGroupSheet 拿的是 liveChars（不含配角）
  assert.match(comp, /const pool = outsiders\.concat\(npcOutsiders\);/);
  assert.match(comp, /const addable = nearby\.concat\(rest\);/);
});

test("③ 跟着主人一起删，并从所有群里摘干净", () => {
  const fn = app.slice(app.indexOf("const delChar = id =>"), app.indexOf("const saveRemark"));
  assert.match(fn, /const doomed = new Set\(\[id, \.\.\.npcsOf\(id\)\.map\(c => c\.id\)\]\)/);
  assert.match(fn, /memberIds: \(g\.memberIds \|\| \[\]\)\.filter\(x => !doomed\.has\(x\)\)/,
    "不摘的话群成员列表会留一串找不到人的 id");
});

// 她点名要的：NPC 在群里的互动进【主角色】的记忆库。
// 不用新造机制——knownBy 已经在了。
test("记忆归主角色，配角只记得自己在场的那些", () => {
  assert.match(app, /const memOwners = ids =>.*!c\.npc/s);
  assert.equal((app.match(/charIds: memOwners\(/g) || []).length, 7, "群侧七处写记忆都要归属真角色");
  // ⚠️knownBy 以前被 addMemEntry 的白名单丢掉了（各处它都恰好等于 charIds 所以没人发现）；
  // NPC 一来两者就分家，非补不可，否则配角什么都记不住。
  const add = app.slice(app.indexOf("const addMemEntry = e =>"), app.indexOf("const addMemEntry = e =>") + 1500);
  assert.match(add, /Array\.isArray\(e\.knownBy\) \? \{ knownBy: e\.knownBy\.map\(String\) \}/);
});

test("人设额度：配角走小额度，不参与按人数平分", () => {
  assert.match(engine, /const NPC_PERSONA_CAP = 900;/);
  assert.equal((app.match(/groupPersonaBudget\(members\.filter\(c => !c\.npc\)\.length\)/g) || []).length, 1, "群线上");
  assert.equal((engine.match(/groupPersonaBudget\(members\.filter\(c => !c\.npc\)\.length\)/g) || []).length, 1, "群线下");
});

test("生成器：按主角色的世界观来，且绝不许碰用户", () => {
  const fn = engine.slice(engine.indexOf("async function generateNpc"), engine.indexOf("// ==== 外语气泡按需翻译"));
  assert.match(fn, /人设里已经提到过的人/, "填名字＝把已有的补完整");
  assert.match(fn, /一个【位置或身份】/, "填「他的属下」＝造一个具体的人");
  assert.match(fn, /他不认识用户/);
  assert.match(fn, /不许给他安排和用户的感情线/, "否则配角一进群就开始争宠");
  assert.match(fn, /世界观、时代、称谓一律跟着主角色走/);
  assert.match(fn, /别写成「忠心耿耿、办事得力」这种履历/, "要具体到能照着演");
  assert.match(fn, /relFromHost.*relToHost/s, "双向关系——群里的【成员间关系】那段就读它");
});

test("④ 群里不加视觉标记（她说她自己知道）", () => {
  assert.doesNotMatch(codeOnly(comp), /npc \?.*配角|isNpc.*badge/i);
});
