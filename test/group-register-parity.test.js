const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GB = require("./_group-bans.js");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

// 她 2026-08-25：「不是酥酪的问题宝宝是还是很霸总」。
// v55.87 补的是人设被砍到 200 字，那只是缺口之一。把单聊线上的 buildBundle
// 和群线上的 system 一层层对下来，群里还少四样，每一样都在直接决定他用什么语气说话。

test("霸总【语气】禁令要单独站着，不许再埋在行程块里当从句", () => {
  const i = engine.indexOf("const CONDESCENDING_TONE_BAN");
  assert.ok(i > 0, "要有独立常量");
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /别闹了/);
  assert.match(rule, /听话/);
  assert.match(rule, /禁的是【现成模子】，不是强势的人物/, "不许把它写成『一律温柔』的新模板");
  // 判据要可判定，不能只是「别霸总」
  assert.match(rule, /换成【另一个同样强势的角色】说，一个字都不用改也成立/);
  // 行程块里那句从句必须不再是唯一载体：schedNow 为空时整段不 push，
  // 从前它就跟着一起消失了。
  const sched = engine.slice(engine.indexOf("今天的行程 / 此刻在做什么"), engine.indexOf("今天的行程 / 此刻在做什么") + 900);
  assert.doesNotMatch(sched, /网文霸总的通用语料/, "从句已经抽走，别留两份各说各的");
});

test("四处都吃得到这条刀（言秋那支不发扮演类规则）", () => {
  // 单聊线上／一切走 buildBundle 的通道：跟扮演三件套同一支
  const bb = engine.slice(engine.indexOf("function buildBundle"), engine.indexOf("function buildBundle") + 3000);
  assert.match(bb, /parts\.push\(ANTI_CLICHE\);\n\s*parts\.push\(CONDESCENDING_TONE_BAN\);/);
  // 必须落在 notRoleplay 的 else 里——言秋不是被扮演的角色，扮演类规则一律不发
  const nr = bb.indexOf("if (ctx.notRoleplay)");
  assert.ok(nr > 0 && bb.indexOf("CONDESCENDING_TONE_BAN") > nr, "要在 notRoleplay 分支之后的 else 里");
  // 单聊线下：走 buildBundle(ctx) + OFFLINE_NARRATIVE_RUNTIME，已经从上面那支吃到了，
  // 不许再插一份（重复注入＝白烧 token，她按次计费）
  // ⚠️只数代码行：注释里提到这个常量名不算一处（v60.45 的情欲反八股在注释里
  // 引用了它当教训，这一句就误报成 4 了）。
  const codeOnly = src => src.split("\n").filter(l => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  assert.equal((codeOnly(engine).match(/CONDESCENDING_TONE_BAN/g) || []).length, 3,
    "1 处定义 + buildBundle + 群线下；数字变了就核对是新通道接上了还是插重了");
  // v60.39 起三处群共用 groupBans：别再 grep「这个常量拼在那一行的哪个位置」，
  // 对着【它到底吐出哪几层】问（改拼法不该红，掉一层才该红）。
  assert.ok(GB.allGroupsHave("CONDESCENDING_TONE_BAN"), "三处群都要有");
});

test("群线上补上【用户是谁】——以前群里只有她一个名字", () => {
  const i = app.indexOf("【成员】\\n\" + memberDesc");
  assert.ok(i > 0);
  const seg = app.slice(i, i + 600);
  assert.match(seg, /profile\.persona/, "用户人设要进群线上");
  // 群线下一直有这一层，别退回去
  assert.match(engine, /【用户「" \+ userName \+ "」的设定】/);
});

// ⭐最要命的一条：关系网里可能还写着旧标签，单聊靠 coupleStatus 盖过去，
// 群聊压根没这层——于是王爷在群里不知道自己是她男朋友，只好按
// 「一个王爷遇上一个姑娘」演，那个先验就是网文霸总。
test("群里每个人都要知道自己和用户是不是恋人（而且只有他自己知道）", () => {
  assert.match(app, /const coupleLineFor = \(charId, uName\) =>/);
  const fn = app.slice(app.indexOf("const coupleLineFor"), app.indexOf("const ageLineFor"));
  assert.match(fn, /已经在一起了/);
  assert.match(fn, /当前真实的关系/, "要点破它压过关系网里的旧标签");
  assert.match(fn, /pending/, "暧昧待定那一档也要有");

  // 群线上：必须落在这位成员自己那一段里，走隐私围栏
  const online = app.slice(app.indexOf("const cpSeg ="), app.indexOf("const cpSeg =") + 400);
  assert.match(online, /只有 " \+ c\.name \+ " 本人知道，别的成员并不知情/);
  // 群线下：同款围栏
  const off = engine.slice(engine.indexOf("ctx.memberCouple"), engine.indexOf("ctx.memberCouple") + 300);
  assert.match(off, /只有 " \+ c\.name \+ " 本人知道，别的成员并不知情/);
  assert.match(app, /memberCouple: \(\(\) => \{/, "群线下的 ctx 要喂这一层");
});

test("群里也要知道自己多大——她刚做的生日字段群里一口没吃到", () => {
  assert.match(app, /const ageLineFor = char =>/);
  const fn = app.slice(app.indexOf("const ageLineFor"), app.indexOf("const schedBriefFor"));
  assert.match(fn, /charAge/);
  assert.match(fn, /人设里写死的岁数是旧数字，以这个为准/);
  assert.match(app, /〔你现在〕/, "群线上");
  assert.match(app, /memberAge: \(\(\) => \{/, "群线下的 ctx");
  assert.match(engine, /ctx\.memberAge/, "群线下真的用上了");
});

// 显式差异（四处一样喂允许，但必须写着理由）：群里一人一份完整行程会撑爆上下文、
// 而且她按次计费，所以群里只保留「此刻正在做什么」这一行。
test("群里带的是此刻在做什么这一行，不是整张行程表——差异写在代码里", () => {
  const i = app.indexOf("const schedBriefFor");
  const near = app.slice(Math.max(0, i - 400), i + 700);
  assert.match(near, /按次计费|撑爆|封顶|只取/, "差异要有写下来的理由");
  const fn = app.slice(i, app.indexOf("const ctxFor = (char"));
  assert.doesNotMatch(fn, /今日安排/, "整张行程表留给单聊");
  assert.match(fn, /cur\.title/);
  assert.match(app, /〔此刻在做什么〕/);
  assert.match(engine, /ctx\.memberSched/);
});
