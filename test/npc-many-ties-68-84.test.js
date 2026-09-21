// 她 2026-09-15：「现在我们 npc 只能绑定一个人，但是如果做关系网的话有可能 npc 跟 ab 都认识，
// 这种怎么解决呢」＋「如果我想把他连 b 我得自己写了」＋「万一 npc 是我和 ab 的共友那不认识也不成立」。
//
// ⚠️查下来「只能绑定一个人」【不是 ownerId 的问题】：
//   ownerId 是【户口】（挂在谁的花名册下、群成员表里报哪一位、拉群时推荐谁），
//   关系一直住在 x_rels 那张任意多边的有向图里，从来不限对数。
//   真正卡住的是四处各自写死了「只认户口」。所以这一刀【绝不把 ownerId 改成数组】——
//   一旦它变成数组，「这是谁身边的人」就没有答案了。户口是一个人，关系是一张网。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("js/app.js", "utf8");
const screens = fs.readFileSync("js/screens.js", "utf8");
const engine = fs.readFileSync("js/engine.js", "utf8");

test("⚠️ownerId 仍然是一个人，没被改成数组", () => {
  assert.match(app, /npc: true, ownerId: hostId/);
  assert.match(app, /const npcsOf = hostId => characters\.filter\(c => c && c\.npc && String\(c\.ownerId\) === String\(hostId\)\);/,
    "户口一旦变成多值，花名册该挂谁、群里报哪一位、拉群推荐谁，全都没有答案了");
});

test("① 「角色之间」的名单放开了配角——这才是「只能绑定一个人」的真正来源", () => {
  assert.match(screens, /const npcList = \(all \|\| \[\]\)\.filter\(c => c && c\.npc\);/);
  assert.match(screens, /\(c\.tab === "chars" && npcList && npcList\.length\) \? h\(Fragment, null,/);
  assert.match(screens, /h\(Eyebrow, \{ style: \{ marginBottom: 8 \} \}, "配角也能连"\)/);
  // 单独一组，不跟主角色混着排（它们本来就是另一档东西）
  const i = screens.indexOf('"配角也能连"');
  assert.match(screens.slice(i, i + 400), /npcList\.map\(ch => pickCard\(ch\.id, c\.pair\.includes\(ch\.id\), \(\) => togglePair\(ch\.id\)\)\)/);
});

test("② 群成员表那一行跟着关系走，不只报户口", () => {
  const fn = app.match(/  const npcRosterLine = \(c, presentIds\) => \{[\s\S]*?\n  \};/)[0];
  const make = (chars, rels) => new Function("characters", "rels", "userName", "profile",
    fn + " return npcRosterLine;")(chars, rels, () => "读者", {});
  const npc = { id: "n", name: "陆闻", npc: true, ownerId: "a" };
  const chars = [npc, { id: "a", name: "甲" }, { id: "b", name: "乙" }];
  const plain = make(chars, {})(npc, ["a", "b", "n"]);
  assert.match(plain, /〔这是 甲 身边的人；只在群里出场〕/);
  assert.doesNotMatch(plain, /也认得/, "没有边就不许凭空说 TA 认得谁");
  const both = make(chars, { "n->b": { label: "旧同学" } })(npc, ["a", "b", "n"]);
  assert.match(both, /在场的这几位 TA 也认得：乙（旧同学）/,
    "不说的话，模型只知道 TA 是甲的人，跟乙说话时还是当陌生人");
  // 不在场的人不提（她只关心这一场里的关系）
  assert.doesNotMatch(make(chars, { "n->b": { label: "旧同学" } })(npc, ["a", "n"]), /乙/);
  // 四处一样喂：群线上 / 群线下 / 群通话 / 旁观群 都读这一份。
  // ⚠️v72.06 起它们读的是【外面那一层 npcGroupLine】（户口那一行 + 配角那四样），
  //   所以 npcRosterLine 本身只被调一次——四处共用这件事改由下面那条盯着。
  assert.equal((app.match(/npcRosterLine\(c, /g) || []).length, 1, "户口那一行只许有一个调用点（收在 npcGroupLine 里）");
  assert.equal((app.match(/npcGroupLine\(c, /g) || []).length, 4, "四处少了一处：群线上 / 旁观群 / 群通话 / 群线下（递进 ctx 那一处）");
  assert.match(app, /npcRoster: \(\(\) => \{/, "群线下那一路没把它递进 ctx");
  assert.match(engine, /\(ctx\.npcRoster && ctx\.npcRoster\[c\.id\]\) \? ctx\.npcRoster\[c\.id\]/);
});

test("⚠️共友认识她，不等于知道她的私事", () => {
  const fn = app.match(/  const npcRosterLine = \(c, presentIds\) => \{[\s\S]*?\n  \};/)[0];
  const line = new Function("characters", "rels", "userName", "profile", fn + " return npcRosterLine;")(
    [{ id: "n", name: "陆闻", npc: true, ownerId: "a", knowsUser: true, knowsUserNote: "一块儿打过两年球" }, { id: "a", name: "甲" }],
    {}, () => "读者", {})({ id: "n", name: "陆闻", npc: true, ownerId: "a", knowsUser: true, knowsUserNote: "一块儿打过两年球" }, ["a", "n"]);
  assert.match(line, /TA 也认识 读者 本人：一块儿打过两年球/);
  // 共友同时认识她和 A、B，就是一条现成的泄漏通道——围栏必须贴着这句一起发
  assert.match(line, /她跟在场每一位各自是什么关系，TA 一概不知道/);
  assert.match(line, /除非那位自己在群里说了出来/);
  // 这一格默认是关的：多数配角确实是角色那边的人
  assert.match(app, /onSaveNpcKnows: \(id, patch\) => pC/);
  assert.match(screens, /n\.knowsUser \? "✓ 也认识我" : "跟我不认识"/);
});

test("④ 「让 TA 写」：两边人设都要给，已有那段也要给，而且必须留出口", () => {
  const fn = engine.match(/async function generateRelation\(p, a, b, opts\) \{[\s\S]*?\n\}/)[0];
  assert.match(fn, /【甲的设定】/); 
  assert.match(fn, /【乙的设定】/, "不给 B 的人设，模型只能照名字瞎编");
  assert.match(fn, /【已经写好的、不许推翻的】/, "他是 A 的副将，就不该被写成跟 B 素不相识");
  // ⚠️掷轴别掷答案：不许写死「不认识」，给判据让它自己落档（bans-make-it-dumber.md）
  assert.match(fn, /这两个人有没有理由碰上过/);
  assert.match(fn, /只是从别人嘴里听说过这个名字/);
  assert.match(fn, /本来就是一块儿的/, "共友那一档没给，「我和 ab 的共友」就落不进去");
  assert.match(fn, /宁可写「不认识」，也不要为了交差编一段穿越关系/);
  // 人设可能几千字，截住；不截的话长的那份会把短的压没
  assert.match(fn, /cut\(a\.persona, 1800\)/);
  assert.match(fn, /cut\(b\.persona, 1800\)/);
  // 隐私铁律照旧带上
  assert.match(fn, /不许提到玩家\/用户本人/);
  // 写完落进输入框给她改，不是直接存
  assert.match(screens, /onDraftRel\(c\.pair\[0\], c\.pair\[1\], d => set\(\{/);
  assert.ok(screens.indexOf("onDraftRel(c.pair[0], c.pair[1], onSave") < 0);
  // 不是配角专用：主角色之间同样能先拟一版
  assert.match(screens, /\(onDraftRel && c\.tab === "chars" && c\.pair\.filter\(Boolean\)\.length === 2\)/);
});
