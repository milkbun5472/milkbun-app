// 时光胶囊 vs 情书 vs 悄悄话（她 2026-09-05 让我对着看的三处）。
// 查出来三件事：① 胶囊自己拼 sys、没有站位那一句；② 拆开之后什么都不留；
// ③ 字数太短。这一份把三件都钉住。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const cap = fs.readFileSync(__dirname + "/../js/capsule.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");

test("三处都站在【他本人在写】那把椅子上", () => {
  // 情书和悄悄话一直是 runProbe voice；胶囊原来自己拼 sys 直发 callAI，
  // 料一样、站位没有——写信这题的先验就是书信八股，没那句必然往那儿滑（解梦馆同款）
  assert.ok(cap.indexOf("callAI(") < 0, "胶囊还在自己拼 sys 直发");
  assert.equal((cap.match(/voice: true/g) || []).length, 2, "回埋和回信没都换过来");
  const auto = app.slice(app.indexOf("const autoBuryCapsuleForChar"), app.indexOf("const forceAmbient"));
  assert.match(auto, /runProbe\(apiFor\(char\.id\), ctxFor\(char\), \{\s*\n\s*voice: true,/, "后台主动埋那一处没换");
  assert.ok(auto.indexOf("callAI(") < 0, "后台主动埋还在直发");
});

test("字数放开了，而且下限说死", () => {
  // 下限比上限要紧：不说「至少」，它会草草收尾——三个月的信只有三百字，像张便签
  ["至少 300 个汉字", "至少 450 个汉字", "至少 650 个汉字"].forEach(x =>
    assert.ok(cap.indexOf(x) > 0, "封存那三档少了：" + x));
  assert.ok(cap.indexOf("至少 400 个汉字") > 0, "回信还是老长度");
  assert.match(app, /至少 450 个汉字、别超过 1000/, "情书还是 150-300——那是张卡片的长度");
  // 长了就要防「用感慨把篇幅填满」
  assert.ok(cap.indexOf("长不等于绕") > 0 && app.indexOf("长不等于绕") > 0, "放长了没挡住注水");
});

test("字数放长了，maxTokens 得跟着抬", () => {
  assert.equal((cap.match(/maxTokens: 20000/g) || []).length, 2, "胶囊那两处没抬——会截在半句");
  const letter = app.slice(app.indexOf("const genCoupleLetter"), app.indexOf("const maybeAutoLetters"));
  assert.match(letter, /maxTokens: 20000/, "情书没抬");
  const auto = app.slice(app.indexOf("const autoBuryCapsuleForChar"), app.indexOf("const forceAmbient"));
  assert.match(auto, /maxTokens: 20000/, "后台主动埋没抬");
});

test("拆开之后记一笔，走的是情侣空间现成的那条路", () => {
  assert.match(cap, /const keepOpened = \(cap, c, reply\) => \{/, "拆开还是什么都不留");
  assert.match(cap, /props\.onKeep\(c\.id, text, "时光胶囊"\)/, "没记进记忆库");
  assert.match(app, /toast: toast, onKeep: coupleKeep \}/, "App 那头没把写记忆的口子递进去");
  // 他埋的那颗拆开也要记：只记她那一半的话，他就永远不知道自己埋过
  assert.match(cap, /\} else if \(cap\.dir === "fromChar"\) \{\s*\n\s*keepOpened/, "他埋的那颗拆开没记");
  // 给自己写的跟他没关系
  assert.match(cap, /if \(!props\.onKeep \|\| !c \|\| cap\.dir === "toSelf"\) return;/, "给自己写的也记进他的记忆了");
});

test("封存期间只给数目和日子，一个字正文都不给", () => {
  assert.match(app, /capsuleWait: \(\(\) => \{/, "没有这一层");
  // 这一层的全部意义就是【不给内容】：拿了 text 就等于泄题
  const block = app.slice(app.indexOf("capsuleWait: (() => {"), app.indexOf("// 她今天带在身上的"));
  assert.ok(block.indexOf("x.text") < 0 && block.indexOf(".text") < 0, "把正文递出去了——这个功能就没了");
  assert.match(block, /!x\.opened/, "拆过的还在算");
  assert.match(block, /x\.dir !== "toSelf"/, "给自己写的也算进去了");
  assert.match(block, /Number\(x\.openTs \|\| 0\) > now/, "已经到期的还算成「还没到期」");
  // 提示词那头：他自己埋的那颗是他写的，危险的不是他不知道，是他说漏嘴
  assert.match(eng, /【你们之间还没到期的时光胶囊：/, "上下文那一层没接");
  assert.match(eng, /现在一个字都不许提前说出来，也别暗示/, "没挡住他自己那颗说漏嘴");
  assert.match(eng, /别每次都提/, "他会每轮都来数日子");
});

test("他本来就能主动埋，只是那个数太大了", () => {
  assert.match(app, /isCouple && n\.capsule >= 45/, "轮数没降下来");
  // 真正兜住它的是这两道闸，不是轮数
  assert.match(app, /const hasSealed = own\.some\(x => !x\.opened\);/, "未拆的还能再埋一颗");
  assert.match(app, /Date\.now\(\) - latestTs >= 14 \* 86400000/, "冷却没了");
});
