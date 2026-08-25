const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const ONLINE = engine.match(/const ONLINE_CHAT_RULE_V2 = `([\s\S]*?)`;/)[1];

// 她 2026-08-25 把两边摆在一起看：同一个裴照川，
// 单聊「好好好，妻主大人」「别让本王卡在窗台上给您请安」——本王只在自嘲时用；
// 群里句句「本王」，「让本王去洗碗，你那厨房怕是不想要了」，全程拿身份挡回去。
// 前几版补的都是【喂什么】，这次的差别在【站的位置】：
//   单聊任务句 = 「完全代入『裴照川』」→ 你就是他
//   群聊任务句 = 「你在导演一个群聊」  → 你在旁边写他

test("群聊的任务句不许再把模型放在导演位上", () => {
  const i = app.indexOf("else dir =");
  const line = app.slice(i, i + 220);
  assert.doesNotMatch(line, /导演/, "「你在导演一个群聊」正是问题本身");
  assert.match(line, /也是群里的一员/);
});

test("「完全代入当前角色」在群里是空转的——要点名在场的人才有指代", () => {
  assert.match(ONLINE, /完全代入当前角色，/, "单聊那句原文还在");
  const i = app.indexOf("const groupOnlineRuntime");
  const blk = app.slice(i, i + 700);
  assert.match(blk, /完全代入当前角色，/, "群聊要把这句换掉");
  assert.match(blk, /写谁那一条你就是谁/);
  assert.match(blk, /members\.map\(c => c\.name\)/, "要真的点名在场的人，不能只换个说法");
  // 字段名那次替换不能被顺手弄丢
  assert.match(blk, /"word 只包含", "每条 text 只包含"/);
});

test("群里的人是人，不是身份标签的展览", () => {
  const i = engine.indexOf("const GROUP_IN_CHARACTER");
  assert.ok(i > 0);
  const rule = engine.slice(i, engine.indexOf("`;", i));
  assert.match(rule, /你就【是】那个人在打字、在场，不是站在旁边替他写台词/);
  assert.match(rule, /不是从「他这种人该有的样子」里出来/);
  // 她要的不是把王爷阉掉：自称本身不禁，禁的是【因为人多就端起来】
  assert.match(rule, /自称和称谓不许因为人多就端起来/);
  assert.match(rule, /自嘲、耍赖、开玩笑地摆谱都算/, "单聊里那句「别让本王卡在窗台上」必须仍然合法");
  // 拿位分压回去——群聊那几句的原样
  assert.match(rule, /你那X怕是不想要了/);
  // 判据要可判定
  assert.match(rule, /把这一条里的头衔和身份词全删掉/);
  // 顾朝顾暮和王爷之间没设定过关系，这条以前只写在 asPrivate 那一支里
  assert.match(rule, /没有明确设定过两个人之间关系的，就按刚认识／萍水相逢/);
});

test("这条刀群线上群线下都挂上了", () => {
  assert.match(app, /GROUP_IN_CHARACTER \+ "\\n\\n" \+ CONDESCENDING_TONE_BAN/, "群线上");
  assert.match(engine, /GROUP_IN_CHARACTER \+\n\s*"\\n\\n" \+ CONDESCENDING_TONE_BAN/, "群线下");
  assert.equal((engine.match(/GROUP_IN_CHARACTER/g) || []).length +
               (app.match(/GROUP_IN_CHARACTER/g) || []).length, 3,
    "1 处定义 + 群线上 + 群线下；数字变了就核对是新通道接上了还是哪条掉了");
});

// 「彼此不熟就照不熟来」以前只活在 asPrivate（两人旁观局）那一支里，
// 普通群一个字都吃不到——又是「这一层当初只写在一处」。
test("旧的 asPrivate 那份还在，但普通群不再靠它", () => {
  const i = app.indexOf("if (asPrivate) dir =");
  assert.match(app.slice(i, i + 700), /萍水相逢/, "两人旁观局那份别删");
});
