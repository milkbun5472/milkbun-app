// 她 2026-09-11：「明明是写的皇帝×王爷的，怎么直接用了我和王爷的历史记录，
//   把我换成了一个男的精怪和他做爱，用的台词还是我跟他说过的，然后皇帝是一点没出场。」
//
// 三样病根叠在一起：
//  ① 这一段把【她说的话】也发了出去，还标成「对方」——一个没有名字的对话方，
//     模型顺手就给它安一个人，于是她的原话从别人嘴里说了出来。
//  ② 用途只写了「化用进文里，别照抄」——规则只降概率，它就照抄了。
//  ③ 只有王爷有聊天记录，整篇于是偏到他身上：皇帝一场都没出。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const code = fic.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
// ⚠️桩照【写聊天存档那一段】来（stub-from-the-writer）：js/app.js 里是
//   saveJSON("x_chat:" + id, n)，每条 { role:"user"|"assistant", content, ts }，
//   OOC 那几条带 kind:"ooc"（engine.js 的 isOocMsg）。
const LOG = {
  wang: [
    { role: "user", content: "你今天怎么不说话", ts: 1 },
    { role: "assistant", content: "在想事。", ts: 2 },
    { role: "user", content: "想我吗", ts: 3 },
    { role: "assistant", content: "……你猜。", ts: 4 },
    { role: "assistant", kind: "ooc", content: "〔这条是设定讨论〕", ts: 5 }
  ]
};
const box = {
  loadJSON: (k, fb) => (k === "x_chat:wang" ? LOG.wang : fb),
  isOocMsg: m => !!(m && m.kind === "ooc")
};
vm.createContext(box);
vm.runInContext(grab("chatMaterialFor") + "\nthis.f = chatMaterialFor;", box);
const f = box.f;
const WANG = { id: "wang", name: "王爷" };
const DI = { id: "di", name: "皇帝" };          // 她跟皇帝没聊过，所以一条样本都摘不到
const ME = { id: "me", name: "Lisa", isMe: true };

test("她说的话一句都不发出去", () => {
  const out = f([WANG, DI]);
  ["你今天怎么不说话", "想我吗", "对方"].forEach(w =>
    assert.ok(out.indexOf(w) < 0, "她的话／那个没名字的标签还在发：「" + w + "」"));
  // 他自己的话还在（要对的就是他的调子）
  assert.ok(out.indexOf("在想事。") > 0 && out.indexOf("……你猜。") > 0);
  assert.match(out, /「王爷」平时说话是这个调子/);
  // 代码这一道：只取 assistant
  assert.match(grab("chatMaterialFor"), /return m && m\.role === "assistant" && m\.content && !isOocMsg\(m\);/);
});

test("设定讨论那几条（OOC）不算他说的话", () => {
  assert.ok(f([WANG]).indexOf("这条是设定讨论") < 0);
});

test("她自己不需要「声纹样本」", () => {
  // 她在 CP 里的时候也一样：她的人设走的是面具那一份，不是把她的聊天记录搬进来
  assert.match(grab("chatMaterialFor"), /if \(!c \|\| c\.isMe \|\| !c\.id\) return;/);
  assert.equal(f([ME]), "");
});

test("用途钉死了：只对语气，不许进正文，也不许把那段聊天写成情节", () => {
  const out = f([WANG]);
  assert.match(out, /【声纹样本（只对语气，不是素材，也不是剧情）】/);
  assert.match(out, /只用来听清他说话的调子/);
  assert.match(out, /\*\*一句都不许出现在正文里\*\*/);
  assert.match(out, /也不许把那段聊天本身写成这一篇的情节——这一篇的事情是新发生的/);
  // 原来那句「化用进文里，别照抄」只是条规则，规则只降概率
  assert.ok(code.indexOf("化用进文里，别照抄") < 0);
  assert.ok(code.indexOf("【素材来源 · 角色真实聊天记录】") < 0);
});

test("谁有样本跟谁是主角没关系——皇帝那一条", () => {
  const out = f([WANG, DI]);
  // 皇帝一条样本都没有：不说清的话，整篇会偏到有样本的那位身上
  assert.ok(out.indexOf("皇帝") < 0, "没样本的那位不该在这一段里出现");
  assert.match(out, /谁有这几句、谁没有，跟谁是主角\*\*没有关系\*\*：没摘到句子的那一位不许因此变成配角，更不许一场都不出。/);
});

test("两条生成线都吃到这一段，没有就一个字都不发", () => {
  // 首发那一枪和续写／加笔那一枪走的是同一个 buildGenSystem
  assert.match(code, /if \(opts\.chatMaterial && opts\.chatMaterial\.trim\(\)\) parts\.push\(opts\.chatMaterial\.trim\(\)\);/);
  assert.equal(code.split("chatMaterial: chatMaterialFor(chars)").length - 1
    + code.split("chatMaterial: window.Fanfic.chatMaterialFor(chars)").length - 1, 2, "两条线少接了一条");
  // 一条样本都没有时不发一段空的
  assert.equal(f([DI]), "");
  assert.equal(f([]), "");
});

test("样本封顶：条数和每句长度都卡着", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ role: "assistant", content: "第" + i + "句" + "长".repeat(120), ts: i }));
  const b2 = {
    loadJSON: (k, fb) => (k === "x_chat:w2" ? many : fb),
    isOocMsg: () => false
  };
  vm.createContext(b2);
  vm.runInContext(grab("chatMaterialFor") + "\nthis.f = chatMaterialFor;", b2);
  const out = b2.f([{ id: "w2", name: "谁" }]);
  assert.equal(out.split("「第").length - 1, 10, "条数没封顶");
  assert.ok(out.indexOf("长".repeat(61)) < 0, "每句没截断");
  assert.ok(out.indexOf("第30句") > 0 && out.indexOf("第29句") < 0, "取的不是最近那几条");
});

// ── 她 2026-09-11 追报两条 ──────────────────────────────────────────
//  ①「另外两篇也是都不是皇帝做主角（他是王爷那边的 npc），主角完全都是王爷×精怪。」
//    三篇全跑就不是运气问题：配角出身的角色卡天生只有一句话，
//    模型按「谁的料多谁是主角」分篇幅，飘着的那位就被顶掉了。
//  ②「而且他们身份也不应该被带入同人文吧，同人文本来就是
//    『他们俩换了个身份世界观继续相爱』。」——这是她给同人文下的定义。
const ibox = { };
vm.createContext(ibox);
vm.runInContext(grab("worldIdentityLine") + grab("evenSidesLine") + "\nthis.M = { worldIdentityLine, evenSidesLine };", ibox);
const I = ibox.M;
const CP2 = [{ id: "di", name: "皇帝" }, { id: "wang", name: "王爷" }];

test("同人文是【换了身份世界观、继续是他们自己】", () => {
  const out = I.worldIdentityLine(CP2);
  assert.match(out, /【这一篇里他们各自是谁】/);
  assert.match(out, /\*\*这几个人换了一个身份、换了一个世界观，继续是他们自己\*\*/);
  // 照卡来的是【这个人】
  assert.match(out, /照卡来的是【这个人】——性格、说话的调子、在意什么、碰不得哪儿/);
  // 不照卡来的是【身份】——她原话：「他们身份也不应该被带入同人文吧」
  assert.match(out, /\*\*不照卡来的是身份\*\*：卡上写的职业、位分、所处的时代，在这一篇里不算数/);
  assert.match(out, /由你按本版世界观现安排/);
  // ⚠️两位都要安排到：飘着的那一位才是会被顶掉的那一位
  assert.match(out, /「皇帝」、「王爷」\*\*每一位都要安排到\*\*/);
  assert.match(out, /飘着的那一位下一步就会被别人顶掉/);
  // 一个人的时候没有「他们各自是谁」这回事
  assert.equal(I.worldIdentityLine([{ id: "a", name: "甲" }]), "");
});

test("把主线那一层搬进同人文的做法撤掉了，不是留着不发", () => {
  // ⚠️上一版我顺手加过「把他俩在主线里的关系发过去」——她当场否了。撤就是删。
  assert.ok(code.indexOf("cpRelLines") < 0, "那一段还在");
  assert.ok(code.indexOf("【他们本来是什么关系】") < 0);
  assert.ok(code.indexOf("x_rels") < 0, "同人文这一枪还在读主线的关系表");
  // 病历留着（注释里说明撤了什么、为什么），但不许被断言匹配到
  assert.match(fic, /上一版我顺手加的「把他俩在主线里的关系发过去」是反的，当场撤掉/);
});

test("戏份对半：卡的长短不是戏份的事", () => {
  const out = I.evenSidesLine(CP2);
  assert.match(out, /\*\*戏份是对半的\*\*/);
  assert.match(out, /卡上写得长的那一位不许因此多占篇幅，写得短的那一位也不是背景板/);
  assert.match(out, /卡的长短是卡的事，不是戏份的事/);
  // ⚠️一个字都不许提「谁是配角出身」——那正是她说的不该带进同人文的身份
  ["配角", "npc", "NPC", "从别人身边长出来"].forEach(w =>
    assert.ok(out.indexOf(w) < 0, "把主线里的身份说出来了：" + w));
  assert.equal(I.evenSidesLine([{ name: "甲" }]), "");
});

test("四种局面都接上了：一人配原创、双人、三人同框、群像", () => {
  const cb = grab("cpBlock");
  assert.equal(cb.split("worldIdentityLine(cpChars) + evenSidesLine(cpChars)").length - 1, 4,
    "少接一支，换个 CP 形状就又回到老样子（一人配原创／双人／三人同框／群像）");
  // 两位都得真的在场——这一条是另一族：上面那几条管的是别拉读者进来、别对调左右位
  assert.match(cb, /const bothPresent = "\\n【这两位都得真的在场】/);
  assert.match(cb, /\*\*不许临时造一个人（原创角色、路人、非人之物都算）顶掉其中任何一位的位置\*\*/);
  assert.match(cb, /这一篇里要添别的角色当然可以，但那位是配角，不是拿来替换他俩中的谁。/, "给出口，不给判决");
});

test("写完之后数一数：谁一次都没露面", () => {
  const abox = { };
  vm.createContext(abox);
  vm.runInContext(grab("cpChars") + grab("absentLeads") + "\nthis.M = { absentLeads };", abox);
  const A = abox.M.absentLeads;
  const CS = [{ id: "di", name: "皇帝" }, { id: "wang", name: "王爷" }];
  const long = t2 => t2 + "字".repeat(300);
  assert.equal(A({ cp: ["di", "wang"], chapters: [{ content: long("王爷推门进来，皇帝没抬头。") }] }, CS, "我").join(","), "");
  assert.equal(A({ cp: ["di", "wang"], chapters: [{ content: long("王爷推门进来，那只精怪没抬头。") }] }, CS, "我").join(","), "皇帝");
  // 正文还没写出来的时候别乱报
  assert.equal(A({ cp: ["di", "wang"], chapters: [{ content: "短" }] }, CS, "我").length, 0);
  // 一个人的文没有「谁没出场」这回事
  assert.equal(A({ cp: ["wang"], chapters: [{ content: long("谁都没有") }] }, CS, "我").length, 0);
  // 详情页上标出来
  assert.match(code, /从头到尾没出现过——这一篇多半被写跑了/);
});

// ── 她 2026-09-11 再追两条 ────────────────────────────────────────────
//  ①「而且 cp 主要就是爱情向的。」
//  ②「上一轮书评他们也都觉得皇帝和王爷不是 cp，写的是王爷和精怪」
//    「tag 他们也看不到也是编的」——查下来读者说的是实话：那一枪根本没告诉他们这篇挂的是谁。
test("CP 文默认就是爱情向：这件事以前一个字都没说过", () => {
  const lbox = {};
  vm.createContext(lbox);
  vm.runInContext(grab("loveLine") + "\nthis.f = loveLine;", lbox);
  const out = lbox.f();
  assert.match(out, /【这一篇写的是他们俩的感情】CP 文默认就是爱情向/);
  assert.match(out, /\*\*那是这一篇的主线\*\*/);
  assert.match(out, /外面发生的事（案子、灾变、朝局、山里的规矩）是台子，他们俩才是戏/,
    "不说这一句，世界观会把故事吃掉——她那三篇就是被志怪那套设定吃掉的");
  // ⚠️给出口不给判决：拦的是「不写感情」，不是规定「必须甜」
  assert.match(out, /⚠️不是要你写甜文：冷、克制、拧巴、求而不得、已经完了还没断干净，都算爱情向。/);
  // 左右位那条管的是别的事，不能拿来顶这一条
  assert.ok(out.indexOf("左攻右受") < 0);
  // 三处 CP 局面都发，群像那一支不发（它有自己那一向）
  const cb = grab("cpBlock");
  assert.equal(cb.split("loveLine()").length - 1, 3, "一人配原创／双人／三人同框，少一处就漏一处");
  const gi = cb.indexOf("if (cpChars.length >= 3) {"), ge = cb.indexOf("if (cpChars.length === 1)");
  assert.ok(gi > 0 && ge > gi);
  assert.ok(cb.slice(gi, ge).indexOf("loveLine()") < 0, "群像也被塞了爱情向——她那一向是自己选的");
});

test("书评那一枪现在知道这篇挂的是谁", () => {
  const g = fic.slice(fic.indexOf("async function genReviews("), fic.indexOf("  // ---- 加载/保存"));
  assert.ok(g.length > 400, "没切到 genReviews");
  assert.match(g, /async function genReviews\(active, fic, tab, worldbook, characters, userName\)/);
  assert.match(g, /const cpTxt = \(fic\.cp && fic\.cp\.length\) \? cpLabel\(fic\.cp, characters \|\| \[\], userName\) : "";/);
  assert.match(g, /"这一篇挂的是【" \+ cpTxt \+ "】"/);
  assert.match(g, /\+ cpLine \+/, "算出来了却没拼进去＝没写");
  // ⚠️这件事顺带是一根探针：对不上时读者会直说，她一眼就看得见这一篇写跑了
  assert.match(g, /正文写的跟挂的这一对对不上时，读者会直说/);
  assert.match(g, /对得上就一个字都别提这件事。/, "不给出口的话，每条书评都在挑标签");
  // 群像那一向也一起告诉他们
  assert.match(g, /wayTxt \? "（" \+ wayTxt \+ "）" : ""/);
  // 调用点真的把人递过去了
  assert.match(code, /window\.Fanfic\.genReviews\(props\.active, f, props\.tab, storyLore\("书评"\), props\.characters, props\.userName\)/);
});
