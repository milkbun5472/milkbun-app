// 「为什么查手机会互通素材，这些都在陆衍手机里但是这些应该是沈屿白的信息」
// （她 2026-09-06）。
// 病根：查手机一直吃【整份 ctxFor】，里头的群回声/群线下回声全是别人在他面前说过的话。
// 他确实听见了——但听说过不等于发生在他身上。日记那一处早就把这两栏掐了，
// 查手机没跟上（「一层写在两处，第二处没跟上」）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const ph = fs.readFileSync(__dirname + "/../js/phone.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

test("查手机的取材比聊天窄一圈：别人的话不进他手机", () => {
  const i = app.indexOf("const phoneCtx = char =>");
  assert.ok(i > 0, "没有这一层");
  const blk = app.slice(i, app.indexOf("});", i));
  assert.match(blk, /groupEcho: "", groupOfflineEcho: ""/, "群回声还在往手机里灌");
  // ⚠️只掐【别人的事】那两栏。砍多了他会退化成一张标签（群里王爷变霸总那次）
  ["persona", "memLib: \\[\\]", "affinity", "mood"].forEach(k =>
    assert.ok(!new RegExp(k).test(blk), "砍过头了：" + k));
  assert.match(blk, /worldbook: loreFor\(char, "subjects"\)/, "世界书那一栏丢了");
  // 两个调用点都要走它，一处走一处不走＝手刷和周刷两个样
  // 查手机手刷 / 全刷 / 锁屏偷看，三处都得走它
  assert.equal((app.match(/runProbe\(bgActive, phoneCtx\(char\)/g) || []).length, 3, "三处没都换过来");
  assert.match(app, /window\.PhoneKit\.ownOnlyBlock\(char\.name\)/, "锁屏偷看那一处没接上围栏");
  assert.ok(app.indexOf('runProbe(bgActive, { ...ctxFor(char), worldbook: loreFor(char, "subjects") }') < 0,
    "还留着一处吃整份 ctxFor 的");
});

test("日记那一处早就这么做了——这条是补上落单的那一半", () => {
  assert.match(app, /groupEcho: "", groupOfflineEcho: "", offlineNow: "", schedNow: ""/, "参照的那一处变了，这条得重看");
});

test("提示词里说死「听说过 ≠ 发生在你身上」", () => {
  assert.match(ph, /function phoneOwnOnlyBlock\(name\) \{/, "没有这一段");
  const i = ph.indexOf("function phoneOwnOnlyBlock(name) {");
  const rule = ph.slice(i, ph.indexOf("\n}", i));
  assert.match(rule, /听说过绝不等于发生在他身上/, "没说死这一句");
  assert.match(rule, /绝不许.*把别人的职业、专业术语、项目、病人、同事、爱好、行程挪到他名下/, "没点名最容易被挪过来的那几样");
  // 判据而不是内容示范（prompt-no-content-samples）
  assert.match(rule, /搬到另一个角色的手机里也照样成立，那它就不该出现在这里/, "少了那条判据");
  assert.ok(!/羽毛球|BioRender|论文/.test(rule), "把她这次报的具体内容写成例子了——模型会照抄");
  // 别人还是可以出现，只是不能把事挪过来
  assert.match(rule, /别人可以作为【他生活里的人】出现/, "一刀切成「不许提别人」，那他手机里就没有人了");
});

test("这一段写在一处，十几个 app 一起合规", () => {
  assert.match(ph, /const _full = spec\.instruction \+ phoneOwnOnlyBlock\(char\.name\) \+/, "没拼进那份统一的 instruction");
  // 只此一份：定义 + 拼进 instruction + 导出给锁屏偷看
  assert.equal((ph.match(/phoneOwnOnlyBlock/g) || []).length, 4, "抄了第二份——新加一个 app 就会漏掉其中一份");
});

test("能挡住的和挡不住的，得分清楚", () => {
  // 记忆库有围栏：绑了角色的别人召不回。所以漏过去的只可能是【没绑角色】的那些
  assert.match(eng, /const canSee = e => Array\.isArray\(e\.knownBy\)/, "记忆库的围栏没了");
  assert.match(eng, /\(!e\.charIds \|\| e\.charIds\.length === 0 \|\| e\.charIds\.includes\(charId\)\)/, "「没绑角色＝全员可见」这条规则变了");
  // 世界书同理：没绑角色的条目对谁都开放
  assert.match(eng, /if \(bind\.length && !bind\.some\(id => charIds\.indexOf\(id\) >= 0\)\) return \{ on: false, code: "character"/, "世界书的绑定规则变了");
});
