const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require(path.join(__dirname, "..", "js", "phone.js"));
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const char = { id: "c1", name: "沈屿白", persona: "男" };
const known = { shelves: [{ name: "老头以为我在读的", books: [
  { title: "光学原理", author: "玻恩", readAt: "第 128/357 页", note: "旧批注" },
  { title: "人类简史", author: "赫拉利", readAt: "停在第三章", note: "旧批注2" }] }] };

// 她 2026-09-01：「图书应该算慢慢改的那类，不应该每周刷新的时候都更新，
// 最多更新一下读到哪儿了和批注」。
// 原来每一轮都让模型重出「正好 5 架 30 本」，累积层再并进去——
// 结果不是那几本往前读了，是**每周凭空多出三十本新书**。
test("例行刷新只问「这一周他动了哪几本」", () => {
  const w = P.phoneProbeSpec("reading", char, [], "", [], known, null, true);
  assert.match(w.instruction, /这一轮不要重摆/, "例行刷新还在让它重摆书架");
  assert.match(w.instruction, /不要新建书架、不要添新书、不要改书名/, "没挡住添新书");
  assert.match(w.instruction, /没动的一本都别写/, "会把没动的也报一遍");
  assert.match(w.instruction, /光学原理（现在：第 128\/357 页）/, "没把现有书目和进度发回去，title 照抄不了");
  assert.equal(w.schemaHint, '{"updates":[{"title":"从书目里原样照抄的书名","readAt":"新的进度","note":"读到这里新写下的批注"}]}');
  // ⚠️手动重刷仍然是整份重摆——那是她自己按的，意思就是「重来一遍」
  const m = P.phoneProbeSpec("reading", char, [], "", [], known, null, false);
  assert.match(m.instruction, /正好 5 个书架、正好 30 本书/, "手动重刷也不让重摆了");
  // ⚠️还没有书架时必须走整份那一路，否则这个 app 永远是空的
  const first = P.phoneProbeSpec("reading", char, [], "", [], {}, null, true);
  assert.match(first.instruction, /正好 5 个书架、正好 30 本书/, "第一次也只问 updates，书架永远摆不出来");
});

test("updates 按书名认人，只改这两栏，别的一概不动", () => {
  const now = 1756700000000;
  const out = P.phoneMergeShelves(known, { updates: [
    { title: "《光学原理》", readAt: "第 210/357 页", note: "新批注" },   // 带书名号也得认出来
    { title: "查无此书", readAt: "x" }
  ] }, now);
  const bs = out.shelves[0].books;
  assert.equal(bs.length, 2, "书目被改动了——这一路只许改两栏");
  assert.equal(bs[0].readAt, "第 210/357 页");
  assert.equal(bs[0].note, "新批注");
  assert.equal(bs[0].author, "玻恩", "把别的栏冲掉了");
  assert.equal(bs[0]._upd, now, "动过的那本没盖时间戳，红点就亮不起来");
  assert.equal(bs[1].readAt, "停在第三章", "没动的那本被改了");
  assert.equal(bs[1]._upd, undefined, "没动的那本也盖了戳，红点会全屏亮");
  assert.equal(out._lastUpd, now, "整份没记下这一轮的时间戳");
  // 两栏都没真变就别盖戳——不然红点天天亮，等于没有
  const same = P.phoneMergeShelves(known, { updates: [{ title: "光学原理", readAt: "第 128/357 页", note: "旧批注" }] }, now);
  assert.equal(same.shelves[0].books[0]._upd, undefined, "没真变也盖了戳");
  assert.equal(same._lastUpd, 0, "一本都没动，却记了新的时间戳");
  // 手动重刷（回的是 shelves）仍走老路：架子按名字认、书累积
  const full = P.phoneMergeShelves(known, { shelves: [{ name: "老头以为我在读的", books: [{ title: "新买的一本" }] }] }, now);
  assert.equal(full.shelves[0].books.length, 3, "整份重刷那一路被改坏了");
});

// 红点＝这一轮动过这本。比的是 _upd 和 _lastUpd 同一个时间戳，
// 所以下次刷新没动它，点自己就灭了——不用另存一份「看过没」。
test("动过的那本亮红点，下一轮没动就自己灭", () => {
  const view = ph.slice(ph.indexOf("function ReadingView("), ph.indexOf("function ShoppingView("));
  assert.match(view, /const lastUpd = Number\(d && d\._lastUpd\) \|\| 0;/, "没取这一轮的时间戳");
  assert.match(view, /\(b\._upd && b\._upd === lastUpd\) \? h\("span"/, "红点不是按「这一轮动过」亮的");
});
