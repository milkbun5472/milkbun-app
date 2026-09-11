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
