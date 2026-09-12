// 她 2026-09-12：「比如我今天和他看三章，下次第四章他也能记得前面说过啥」
//   「讨论内容能隔离到房间不漏主房间直到我主动总结出来就行」。
//
// 原来讨论是个纯 useState：点「结束并记入记忆」那一下 → 打一枪浓缩成 1~3 句
// → **原件当场销毁**，那 1~3 句直接进主记忆库。于是第四章的时候他手上只有
// 第四章正文 + 第四章那几条批注（还是当「别重复」用的）——前三章一个字都没有。
//
// 现在：原件和滚动摘要都存在【这本书】上，六处提示词一起灌回去；
// 出门那条路只剩一条——她按「把这本记住」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = fs.readFileSync(path.join(__dirname, "..", "js/read.js"), "utf8");
const code = read.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 真跑那三支纯函数
const F = (() => {
  const i = read.indexOf("  const TALK_KEEP =");
  const j = read.indexOf("  // ---- 模型：让角色对给定段落");
  assert.ok(i > 0 && j > i, "抠不出 talk 那三支");
  return new Function(read.slice(i, j) + "\nreturn { TALK_KEEP, TALK_LEAVE, TALK_FEED, talkOf, talkPatch, talkBlock };")();
})();

const turns = n => Array.from({ length: n }, (_, k) => ({ role: k % 2 ? "char" : "user", content: "第" + (k + 1) + "句", ts: k }));

test("讨论存在这本书上，按搭档分开——换个人不串味", () => {
  const book = { talks: { c1: { digest: "记下来的", recent: turns(2) } } };
  assert.deepEqual(F.talkOf(book, "c1").recent.map(x => x.content), ["第1句", "第2句"]);
  assert.deepEqual(F.talkOf(book, "c9"), { digest: "", recent: [] }, "别人的讨论不许串过来");
  assert.deepEqual(F.talkOf({}, "c1"), { digest: "", recent: [] });
  // 存档坏了也不能炸（recent 被写成别的东西）
  assert.deepEqual(F.talkOf({ talks: { c1: { recent: "坏了" } } }, "c1").recent, []);
});

test("落库是【追加】，而且别人那一栏一个字都不动", () => {
  const book = { talks: { c1: { digest: "d1", recent: turns(1) }, c9: { digest: "别人的", recent: turns(3) } } };
  const patch = F.talkPatch("c1", t => ({ digest: t.digest, recent: t.recent.concat([{ role: "user", content: "新的" }]) }))(book);
  assert.deepEqual(patch.talks.c1.recent.map(x => x.content), ["第1句", "新的"]);
  assert.equal(patch.talks.c1.digest, "d1");
  assert.deepEqual(patch.talks.c9, book.talks.c9, "顺手把别人那一栏盖了");
  assert.ok(patch.lastReadTs > 0, "聊过也算读过这本书（书架排序要用）");
});

test("灌回去的那一块：记下来的 + 最近几句，而且说明白它不是这一轮的问题", () => {
  const book = { talks: { c1: { digest: "上次读到他退学那儿", recent: turns(20) } } };
  const b = F.talkBlock(book, "c1", "我", "他");
  assert.match(b, /【你俩读这本书到现在聊过的｜已经发生过的事，不是这一轮要回应的话】/);
  assert.match(b, /上次读到他退学那儿/);
  // 只喂最近那几句，不是整本都倒进去
  assert.ok(b.includes("第20句") && b.includes("第" + (20 - F.TALK_FEED + 1) + "句"), "最近几句没喂全");
  assert.ok(!b.includes("第" + (20 - F.TALK_FEED) + "句"), "喂过头了：原件全倒进去每一枪都会变贵");
  assert.match(b, /不要复述它，也不要当成她刚问的问题/, "不说破的话他会把上次那句当成她刚说的");
  // 名字要用真的那两个
  assert.ok(b.includes("我：") && b.includes("他："));
  // 什么都没有的时候一个字都不发
  assert.equal(F.talkBlock({}, "c1", "我", "他"), "");
  assert.equal(F.talkBlock({ talks: { c1: { digest: "", recent: [] } } }, "c1", "我", "他"), "");
});

test("六处提示词都吃到这一块（四处一样喂：批注／讲这页／讲这段／讲这句／讨论／记住这本）", () => {
  assert.equal((code.match(/talkTail\(\)\)/g) || []).length, 6, "有一处没灌回去——那一处他就会突然失忆");
  // 批注和讲解那几支得真把它拼进 sys，不是收了参数不用
  ["genAnnotations", "genExplains", "genExplainSnippet", "discussReply"].forEach(fn => {
    const seg = code.slice(code.indexOf("async function " + fn + "("), code.indexOf("const raw = await callAI", code.indexOf("async function " + fn + "(")));
    assert.ok(seg.indexOf("(talk || \"\") +") > 0, fn + " 收了 talk 却没拼进 sys");
  });
});

test("先落库再打枪：这一枪失败、她中途退出，她说过的话都还在", () => {
  const seg = code.slice(code.indexOf("    const sendDiscuss ="), code.indexOf("    const endSession ="));
  const put = seg.indexOf("props.onPatch(talkPatch(partner.id");
  const shot = seg.indexOf("await discussReply(");
  assert.ok(put > 0 && shot > put, "先打枪后落库＝这一枪炸了她刚说的话就没了");
  assert.match(seg, /const mine = \{ role: "user", content: v, ts: now \}/);
});

test("「收进这本书」只折进这本书，一个字都不进记忆库", () => {
  const fn = code.slice(code.indexOf("    const endSession = async function"), code.indexOf("    const annoCount ="));
  assert.ok(fn.length > 200, "没切到那一段");
  assert.ok(!/onAddMemory/.test(fn), "结束讨论又往主记忆库掉东西了——她要的是「直到我主动总结出来」");
  assert.match(fn, /await foldNow\(chat\)/);
  assert.match(fn, /收进这本书里了/);
  // 按钮上的字得跟它真做的事对上
  assert.ok(!/结束并记入记忆/.test(read), "按钮还写着「记入记忆」，可它已经不记了");
  assert.match(code, /props\.ending \? "收拢中…" : "收进这本书"/);
});

test("折的那一下只出新的一段，合并交给房间那一份现成的", () => {
  const fn = code.slice(code.indexOf("  async function foldTalk("), code.indexOf("  // ---- 模型：结束时把这次共读总结成记忆 ----"));
  // ⚠️钉的是【真的叫了它】：只钉名字的话，把调用换成自己拼字符串也照样绿
  //   （条件里那半个 window.ChatRooms && … 还在，变异测试里它活下来过）。
  assert.match(fn, /window\.ChatRooms\.digestMerge\(prevDigest, seg\)/, "又自己写了第二个合并器");
  assert.match(fn, /不要重写它，只写这一次新添的/);
  assert.match(fn, /别复述书里的情节/);
  // 折不动就把旧的原样还回来，别把记录清空
  assert.match(fn, /if \(!seg\) return String\(prevDigest \|\| ""\);/);
  assert.match(fn, /if \(!text\.trim\(\)\) return String\(prevDigest \|\| ""\);/);
});

test("她一直不按那个键也不许丢话：攒过上限自己折一次", () => {
  const seg = code.slice(code.indexOf("    const sendDiscuss ="), code.indexOf("    const endSession ="));
  assert.match(seg, /if \(all\.length > TALK_KEEP\) \{ try \{ await foldNow\(all\); \}/);
  assert.ok(F.TALK_KEEP > F.TALK_LEAVE && F.TALK_LEAVE > F.TALK_FEED, "这三个数的大小关系反了");
  // 折完留一截原话：下次读的时候既有「记下来的」也有「上次最后说的那几句」
  const fold = code.slice(code.indexOf("    const foldNow = async function"), code.indexOf("    const doAnnotate"));
  assert.match(fold, /recent: t2\.recent\.slice\(-TALK_LEAVE\)/);
});

test("「把这本记住」是唯一的出门路，而且要把读过的讨论算进去", () => {
  const fn = code.slice(code.indexOf("    const rememberBook = async function"), code.indexOf("    // ---- 顶栏 ----"));
  // v67.55 起还带上「这本算哪间房的」：侧房里读的书，这一下落在那间房自己的往事里
  assert.match(fn, /props\.onAddMemory && props\.onAddMemory\(summary, partner\.id, book\.roomId\)/);
  assert.match(fn, /chat\.slice\(-24\), props\.ctxFor, talkTail\(\)\)/, "又变回只看批注的读后感了");
  assert.match(fn, /if \(!annoCount && !chat\.length && !talk\.digest\)/, "只聊过没批注过的书被卡住了");
  // 全库只有这一处往记忆库写
  // 真往记忆库写的只有这一处（数的是【调用】，不是那个名字出现过几次）
  assert.equal((code.match(/props\.onAddMemory\(/g) || []).length, 1, "一起读里往记忆库写的地方不止这一处");
});
