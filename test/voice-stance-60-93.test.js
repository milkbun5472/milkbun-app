const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const engine = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-03：「匿名问答角色回答感觉很容易被压成标签，
// 你看看要不要像小游戏那样可以注入当下心情和最近聊天」。
// 查下来料一直是够的——匿名箱走 ctxFor(char)，心情、最近对话、印象卡、好感都在 bundle 里。
// 错的是【站的位置】：runProbe 开场白把模型按在分析师的椅子上
//（「不要扮演角色对话，冷静推演」），那张椅子上写出来的必然是判词体。
// 这是 four-surfaces-same-context 里 v55.91 那一条的又一次复发：喂的不只是料，还有站位。

test("runProbe 多一档【本人在打字】的站位，默认那档一个字没动", () => {
  assert.match(engine, /const head = probe\.voice\n?\s*\? "你就是「" \+ \(\(ctx\.char && ctx\.char\.name\) \|\| "TA"\) \+ "」本人。/);
  assert.match(engine, /你不是在分析这个人，你【就是】这个人，正拿着手机打字。/);
  // 绝大多数推演（行程/钱包/相册/书架）本来就该坐分析师那把椅子
  assert.match(engine, /: "你是角色状态推演引擎。不要扮演角色对话，而是基于背景冷静推演，严格输出 JSON。";/);
  // 料一个字不少：两档共用同一个 bundle
  assert.match(engine, /const system = head \+ "\\n\\n" \+ buildBundle\(ctx\)/);
  assert.match(engine, /\【" \+ \(probe\.voice \? "这一次要写什么" : "推演任务"\) \+ "\】/);
});

test("匿名箱两条路都换成本人站位", () => {
  const box = app.slice(app.indexOf("const openAnonBox = async char =>"), app.indexOf("const askAnon = async (char, q)"));
  const one = app.slice(app.indexOf("const askAnon = async (char, q)"), app.indexOf("const askAnon = async (char, q)") + 2200);
  assert.match(box, /voice: true,/, "一次答一箱那条路");
  assert.match(one, /voice: true,/, "手机里随手问一句那条路");
  // 站位换了，人称也得跟着换——「他」是分析师的说法
  assert.ok(box.indexOf('"「" + char.name + "」(网名:" + nn + ")打开了') < 0, "指令里还在用第三人称说他");
  assert.match(box, /"你\(网名:" \+ nn \+ "\)打开了自己的匿名箱/);
});

test("不许答成一台判词机器：长短、不下结论、心情、说人话", () => {
  const box = app.slice(app.indexOf("const openAnonBox = async char =>"), app.indexOf("const askAnon = async (char, q)"));
  assert.match(box, /别把自己答成一台判词机器/);
  assert.match(box, /长短要不一样/, "每条一样长就是标签化最明显的样子");
  assert.match(box, /绝不许每条都是同样长度、同样节奏的一句陈述句/);
  assert.match(box, /不是每条都要盖章定性/);
  assert.match(box, /你此刻的心情写在上面/, "心情就在 bundle 里，得让它真的影响这几条");
  assert.match(box, /别用『其实\/本质上\/无非是』这种给人上课的开场/);
});

test("凡是【他亲口说的话】都换了站位，凡是推演数据的照旧坐分析师那把椅子", () => {
  // 她 2026-09-03：「都改了吧宝宝我不知道是谁放的嘤」——同一个病根扫一遍。
  const has = (fn, zh) => { const i = app.indexOf(fn); assert.ok(i > 0, "抠不出：" + zh);
    const seg = app.slice(i - 900, i + 40); assert.ok(seg.indexOf("voice: true") >= 0, zh + " 还坐在分析师的椅子上"); };
  // 他亲口说 / 亲手写的那些
  [["instruction: GACHA_SR_ASK[card.kind]", "扭蛋SR"],
   ["instruction: GACHA_SSR_ASK[card.act]", "扭蛋SSR"],
   ['的身份去论坛随手发一个帖', "论坛发帖"],
   ['身份发一条朋友圈', "朋友圈"],
   ['身份在贴吧「" + board + "」发一条帖', "贴吧发帖"],
   ['你之前被分享看过的那篇同人文', "同人文更新的反应"],
   ['【这一轮发生在贴吧的私信框里】', "贴吧私信·大号"],
   ['里放一张给用户的小纸条', "悄悄话（v61.35 起放进抽屉，不再是便签墙）"],
   ['但记在这儿的是【', "交换记忆"],
   ['你走到你俩共同的那个小空间里', "情侣空间留东西"],
   ['你们要一起出门。给这一次配两身衣服', "挑衣服"],
   ['你俩有一个「情侣问答小本」', "情侣问答"],
   ['里回答了一道题', "情侣问答·接话"],
   ['共用一本【交换日记】', "交换日记"],
   ['为你俩的恋爱时间轴写一条此刻的「感慨」', "时间轴感慨"],
   ['给用户写一封**情书**', "情书"],
   ['在情书里一来一回', "情书回应"],
   ['你们有一张【我们的唱片】', "唱片刻歌"],
   ['你自己私下真会单曲循环', "私下的歌单"],
   ['把决定交给了手机主屏上的「命运转盘」', "命运转盘"],
   // ⚠️只钉「发呆走的是 museSpec 那把椅子」，不钉参数长什么样——
   //   v61.60 给它加了第三个参数（你俩真做过的事），锚点写死整个调用就抠不到了。
   //   那冻的是长相不是站位。
   ['HeartKit.museSpec(char, box', "发呆（本体亲笔）"]].forEach(x => has(x[0], x[1]));
  assert.match(app, /Object\.assign\(\{ voice: true \}, spec\)\); \/\/ 盘一盘盘点/, "盘一盘盘点/回头看自述（本体亲笔）");
  assert.match(app, /\{ voice: true, instruction: instruction, schemaHint: "\{\\"say\\"/, "转发给他之后那一句反应");
  // 推演数据那些不许跟着改：坐错椅子会让行程/账本开始「说话」
  const notVoice = (fn, zh) => { const i = app.indexOf(fn); assert.ok(i > 0, "抠不出：" + zh);
    assert.equal(app.slice(i - 700, i + 40).indexOf("voice: true"), -1, zh + " 不该换站位——它产出的是数据不是话"); };
  [['推演此刻「" + char.name + "」手机屏幕的真实状态', "查手机"],
   ['推演「" + char.name + "」的财务档案', "财务档案"],
   ['为「" + char.name + "」设计 Ta 在匿名社交', "马甲设计"],
   ['为「" + c.name + "」设计 Ta 的贴吧资料', "贴吧资料"],
   ['你在给一个人刷购物 App 的信息流', "购物信息流"]].forEach(x => notVoice(x[0], x[1]));
});

test("匿名箱照旧不许知道问的是谁", () => {
  const one = app.slice(app.indexOf("const askAnon = async (char, q)"), app.indexOf("const askAnon = async (char, q)") + 2200);
  assert.match(one, /你不知道问的其实是/, "这一层是这个玩法的根，不许在改口吻时弄丢");
  const box = app.slice(app.indexOf("const openAnonBox = async char =>"), app.indexOf("const askAnon = async (char, q)"));
  assert.match(box, /你不知道这人是谁/);
  assert.match(box, /把那个念头写进 guess/, "猜错人那一档也得留着");
});
