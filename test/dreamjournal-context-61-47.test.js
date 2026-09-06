// v61.47 她 2026-09-03 问：「解梦馆……人设心情最近聊天防八股那些有全部喂进去吗」
// 答案是【一条都没有】：它自己拼 sys 直发 callAI，人设还截到 400 字。
// 那是 v55.87「群里的王爷变霸总」的病根形状——人设只剩一个标签，
// 空白由训练先验补上，而解梦这一题的先验就是心理测试小作文。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
// 规则原文只从这一处拿（路径写在 test/_rules.js 那一行，搬家改一处就够）
const { ruleText } = require("./_rules.js");
const dj = fs.readFileSync("js/dreamjournal.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");
const code = dj.split("\n").map(l => l.split("//")[0]).join("\n");

test("解梦走 runProbe(voice)，buildBundle 那一整份是白得的", () => {
  assert.match(code, /runProbe\(p, ctx, \{\s*\n?\s*voice: true,/);
  // 老的那条自拼 sys 不许再当主路
  assert.ok(code.indexOf("interpretSys(") < 0, "还留着旧的自拼 sys");
});

test("ctxFor 从 App 传进来了——不接这条线，换个入口就什么都没有", () => {
  assert.match(app, /screen === "dreamjournal"\)[\s\S]{0,400}ctxFor: ctxFor,/);
  assert.match(code, /const ctx = props\.ctxFor \? props\.ctxFor\(char\) : null;/);
  // 没拿到 ctx 也别整个坏掉
  assert.match(code, /\} else \{[\s\S]{0,300}callAI\(p, interpretInstruction/);
});

test("那三条只能靠调用点 push 的也补上了", () => {
  assert.match(code, /ECHO_QUESTION_BAN/);
  assert.match(code, /REGISTER_FOLLOWS_SCENE/);
  assert.match(code, /window\.ReplyPacing \? "\\n\\n" \+ window\.ReplyPacing\.reading\(\)/);
});

test("人设不许再按字数截断", () => {
  // 解梦那一路已经交给 buildBundle 了（那边按预算给全）；他自己做梦那一路也从 300 抬上来
  assert.ok(code.indexOf("char.persona || \"\").slice(0, 400)") < 0, "解梦还截着 400 字");
  assert.ok(code.indexOf("char.persona || \"\").slice(0, 300)") < 0, "他自己的梦还截着 300 字");
  assert.match(code, /String\(char\.persona \|\| ""\)\.slice\(0, 6000\)/);
  // 他自己做梦那一路也得有反八股（那是文风地板，在哪儿都该有）
  assert.match(code, /ANTI_CLICHE[\s\S]{0,120}NARRATIVE_ANTI_CLICHE/);
});

test("梦签单独一栏，而且真显示出来了", () => {
  assert.match(code, /\\"sign\\":\\"今日梦签/);
  assert.match(code, /sign: sign, ts: Date\.now\(\)/);
  assert.match(code, /it\.sign \? h\("div"/, "存了却没画出来（那是 v55.95 那个形状）");
});

test("这条规矩自己也得改：名单从七处变八处", () => {
  const rule = ruleText("four-surfaces-same-context");
  assert.match(rule, /名单是【八处】/);
  assert.match(rule, /解梦馆是第八处/);
  assert.match(rule, /\| v61\.47 \| \*\*解梦馆也不在这张名单上\*\*/);
});
