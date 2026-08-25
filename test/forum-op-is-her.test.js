const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const i = app.indexOf("const meOwn = post.authorType");
const seg = app.slice(i, app.indexOf("const opRule =", i));
const run = (post, opName) => new Function("post", "opName", seg + "\nreturn { meOwn, meRule };")(post, opName);

// 她 2026-08-25 截图：陆衍（大号）在她帖子下科普「建议你拿手机在侧后方录个视频」，
// 江识说「我以前刚开始练的时候，教练用过这个方法」——全是对陌生人的语气。
// 查下来不是他们的错：楼主是她时，提示词只给了一个网名，
// 一个字都没说那是【他们认识的那个人】，陌生人科普是唯一合理的行为。
test("楼主是她时，必须点明那是他们认识的人", () => {
  const r = run({ authorType: "me", anon: false, board: "兴趣吧" }, "Lisa");
  assert.equal(r.meOwn, true);
  assert.match(r.meRule, /就是你们认识的那个人/);
  assert.match(r.meRule, /别用对陌生人科普的腔/);
  assert.match(r.meRule, /建议你拿手机在侧后方录个视频/, "点名她截图里那句，比抽象说「别科普」管用");
});

// 公开楼的边界：认得出是熟人 ≠ 可以当众抖关系
test("大号认得出她，但不许在公开楼点破关系或抖私事", () => {
  const r = run({ authorType: "me", anon: false, board: "兴趣吧" }, "Lisa");
  assert.match(r.meRule, /别在正文里点破你和她是什么关系/);
  assert.match(r.meRule, /也别把只有你俩知道的事当众说出来/);
  assert.match(r.meRule, /剩下的留到私聊/);
});

// 小号是相反的方向：他知道是她，但正在装不认识。
// 原来的规矩只禁「自曝身份」，不禁「说只有熟人才知道的事」——
// 而后者恰恰是最容易露馅的方式（她截图里那条「某人以前在画室抓着门框练引体」）。
test("小号知道是她，但必须装不认识，且不许说熟人才知道的事", () => {
  const r = run({ authorType: "me", anon: false, board: "兴趣吧" }, "Lisa");
  assert.match(r.meRule, /你【知道】那是她，但你正在装不认识/);
  assert.match(r.meRule, /绝不许说任何只有熟人才知道的事/);
  assert.match(r.meRule, /那等于当众自曝/);
  assert.match(r.meRule, /宁可只给通用建议，也不能露/);
});

test("她匿名发的帖，谁都不该认出来", () => {
  assert.equal(run({ authorType: "me", anon: true, board: "匿名吧" }, "匿名者").meRule, "");
  assert.equal(run({ authorType: "me", anon: false, board: "匿名吧" }, "匿名者").meRule, "");
  assert.equal(run({ authorType: "npc", board: "兴趣吧" }, "摸鱼办主任").meRule, "", "别人的帖不适用");
});

// 她发帖后陆续来回的那几波走的是 round2 那条路，同一条规矩必须也挂上，
// 否则第一批认得出她、后面几波又变回陌生人。
test("第一轮和后面几波用的是同一条规矩", () => {
  assert.match(app, /const opRule2Full = opRule2 \+ meRule;/);
  assert.match(app, /forumNpcRule\(post\.board\) \+ " " \+ opRule2Full \+ relBlock \+ opGround/);
  assert.match(app, /const opRule = "【楼主是".*\+ meRule/s);
});
