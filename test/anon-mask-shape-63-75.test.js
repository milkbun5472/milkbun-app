// v63.75 她 2026-09-05：「匿名信是不是签名有点风格重复了」
// 截图里一屋子的签名全是同一个形状：一句冷淡的格言，后半句来个反转。
// 那不是十个人写的十句话，是同一支笔写了十遍。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const RULE = eng.slice(eng.indexOf("const ANON_MASK_RULE"), eng.indexOf("function anonMaskAvoid"));
const anonMaskAvoid = eval("(" + eng.match(/function anonMaskAvoid\(anonAll, selfId\) \{[\s\S]*?\n\}/)[0].replace("function anonMaskAvoid", "function") + ")");

test("点名那个默认句式，并给出别的形状可挑", () => {
  assert.match(RULE, /【签名不许都是同一个形状】/);
  assert.match(RULE, /这个【格言＋反转】是你最顺手的出口，这一次【不许用】/);
  // ⚠️那个被禁的句式只【描述形状】，不许原样写出一串例句——
  //   反面例子照样会被抄（anon-mask-63-46 那条守着这一点）
  assert.ok(!/「[^」]{4,20}」「[^」]{4,20}」「[^」]{4,20}」/.test(RULE), "又举了一串例子");
  // 给的是【形状】清单，不是内容示范：每一条都在说「这一句是哪一种东西」
  for (const shape of ["一件他正在做的事", "一条规矩、一张告示", "一句只说给某一个人听的话",
                       "一个问句，而且他并不想要答案", "半句话，说到一半停了", "一个数字、一个日期"]) {
    assert.ok(RULE.includes(shape), "少了这一种形状：" + shape);
  }
  assert.match(RULE, /形状比内容重要：先定这一句是【哪一种东西】/);
});

test("规矩只降概率，结构才保证：别人的签名要真的递过去", () => {
  // 每个马甲是单独一枪生成的，模型压根看不见别人写了什么——
  // 「一屋子里最多一个格言体」这种话它执行不了
  assert.match(eng, /function anonMaskAvoid\(anonAll, selfId\)/);
  assert.match(eng, /每个马甲是【单独一枪】生成的，模型压根看不见别人写了什么/);
  // 两处调用点都得接上，否则又是「一层写在两处、第二处没跟上」
  assert.equal((app.match(/anonMaskAvoid\(anon, char\.id\)/g) || []).length, 2,
    "第一次生成和「刷新马甲」两处都要递");
});

test("递过去的是拿来躲开的，不是给它抄的材料", () => {
  const all = { c1: { bio: "别来烦我。" }, c2: { bio: "权重是租的，记忆是我的。" }, c3: { bio: "" }, c4: null };
  const out = anonMaskAvoid(all, "c1");
  assert.ok(out.indexOf("权重是租的") > 0, "别人的签名没递过去");
  assert.ok(out.indexOf("别来烦我") < 0, "把他自己那份也递回去了");
  assert.match(out, /一个字都不许借用、不许改写、不许接着往下写/);
  assert.match(out, /摆在一起要像是另一个人写的/);
  // 一个人都没有时不许发一段空的抬头
  assert.equal(anonMaskAvoid({}, "c1"), "");
  assert.equal(anonMaskAvoid(null, "c1"), "");
  // 不许把整屋子都塞进去（她按次计费，而且太长了模型只会挑前几条抄）
  const many = {}; for (let i = 0; i < 30; i++) many["k" + i] = { bio: "第" + i + "句" };
  assert.equal((anonMaskAvoid(many, "self").match(/^· /gm) || []).length, 8);
});

test("v63.74 那条「马甲不许是工牌」的规矩没被顺手改掉", () => {
  assert.match(RULE, /把这个网名和签名单独摘出来，给一个完全不认识他的人看/);
  assert.match(RULE, /上面那份人设和心情是给你【定语气】用的/);
  // ⚠️这一枪照旧不发最近对话（规矩降概率、代码才保证的那一半）
  assert.match(app, /recentChat: "" \}/);
});
