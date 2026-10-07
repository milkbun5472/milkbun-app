const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const rooms = fs.readFileSync(path.join(root, "js/chat-rooms.js"), "utf8");

// 群里 2026-10-02：「char 可以反过来向 user 提出情侣申请让 user 拆开看吗」——她：「12 都做吧」
// ①说了再想想隔 3 天 ②聊天设置里能关。

test("在一起那一刻只写一份：她邀请他答应、他写信她答应都走 beginCouple", () => {
  assert.match(app, /const beginCouple = charId => \{/);
  const resp = app.slice(app.indexOf("const respondCoupleInvite"), app.indexOf("const beginCouple"));
  assert.match(resp, /beginCouple\(charId\);/);
  assert.ok(!/setCoupleFor\(charId, \{ status: "together"/.test(resp), "又在邀请那头另写了一份");
  const ans = app.slice(app.indexOf("const answerLoveLetter"), app.indexOf("const genWhisper"));
  assert.match(ans, /if \(yes\) \{ beginCouple\(charId\);/);
  assert.match(ans, /markLoveLetter\(charId, \{ declinedTs: Date\.now\(\) \}\)/, "再想想要记下来，冷却才算得出来");
  // 她 2026-10-06：「我拒绝了就直接说话了，我还没打完字」——点完不当场开口，等她按回复那一轮再接（答应、再想想一样）
  assert.doesNotMatch(ans, /replyNow\(/, "点完答应／再想想不许当场让他开口");
  assert.match(ans, /waitForHer\(charId, \{ loveLetterAnswer: yes \? "yes" : "no" \}\);/, "回信那一下要留到她按回复那一轮");
});

test("闸：已在一起／邀请挂着／关了／刚分手／再想想不到 3 天／一天一封／还有一封没拆", () => {
  const ready = app.slice(app.indexOf("const loveLetterReady"), app.indexOf("const markLoveLetter"));
  assert.match(ready, /settingsFor\(charId\)\.noLoveLetter/);
  assert.match(ready, /cp\.status === "together" \|\| cp\.status === "pending"/);
  assert.match(ready, /7 \* 864e5/);
  assert.match(app, /const LOVE_LETTER_DECLINE_COOL_MS = 3 \* 864e5;/);
  assert.match(ready, /rec\.declinedTs/);
  assert.match(ready, /Date\.now\(\) - Number\(rec\.ts \|\| 0\) < 864e5/);
  assert.match(ready, /m\.kind === "loveletter" && \(m\.state === "sealed" \|\| m\.state === "open"\)/);
});

test("能力只在闸开着时给，落地时再过一遍闸；侧房、言秋、查手机那几轮都不给", () => {
  assert.match(app, /!_peekTurn && !\(room && !room\.main\) && !_s\.engineerEyes && !\(opts && opts\.loveLetterAnswer\) && loveLetterReady\(charId\)\) \{\n\s*openCaps\.push\("loveLetter"\);/);
  assert.match(app, /loveLetter:"信的全文"=写给她的情侣申请信；/);
  assert.match(app, /if \(_letter && _letter\.toLowerCase\(\) !== "null" && !_peekTurn && !\(room && !room\.main\) && loveLetterReady\(charId\)\)/);
  assert.match(app, /kind: "loveletter", content: _letter\.slice\(0, 6000\), state: "sealed"/);
  assert.match(app, /parsed\.block = false; parsed\.loveLetter = null;/, "决定不回她的那一轮也别塞一封信");
  assert.match(rooms, /"coupleInvite", "loveLetter", "whisper"/);
});

test("他记得自己写过信、她怎么回的", () => {
  assert.match(app, /\(m && m\.kind === "loveletter"\) \? _letterRow\(m\)/);
  assert.match(app, /const dongnianHint = peekHint \+ letterHint \+ refuseHint/);
});

test("卡：先封着、拆开才读到；读完再选；设置里有开关，默认开", () => {
  assert.match(comp, /function LoveLetterCard\(\{ m, character, onOpen, onAnswer \}\)/);
  const card = comp.slice(comp.indexOf("function LoveLetterCard("), comp.indexOf("function PhoneAskCard("));
  assert.match(card, /if \(st === "sealed"\) return/);
  assert.ok(card.indexOf("m.content") > card.indexOf('if (st === "sealed")'), "封着的时候信的内容不许露出来");
  assert.match(card, /"再想想"/); assert.match(card, /"答应"/);
  assert.match(comp, /if \(m\.kind === "loveletter"\) return cardRow\(i, m, h\(LoveLetterCard,/);
  assert.match(comp, /const \[loveLetter, setLoveLetter\] = useState\(!settings\.noLoveLetter\)/);
  assert.match(comp, /noLoveLetter: !loveLetter,/);
  assert.match(app, /noLoveLetter: !!s\.noLoveLetter,/, "保存那头得接住，不然开关点了不算数");
  assert.match(app, /onLoveLetter: \(m, yes\) => answerLoveLetter\(activeChar\.id, m, yes\)/);
});

test("拿字假装发申请：能写信的那一轮，把「[情侣申请] …」收成真的信封卡", () => {
  const i = app.indexOf("拿字假装发了一张申请");
  assert.ok(i > 0);
  const blk = app.slice(i, i + 1400);
  assert.match(blk, /!\(typeof parsed\.loveLetter === "string" && parsed\.loveLetter\.trim\(\)\) && !_peekTurn && !\(room && !room\.main\) && loveLetterReady\(charId\)/, "只在本来就能写信的那几轮兜");
  const re = new RegExp(blk.match(/const _fakeRe = \/(.+)\/;/)[1]);
  for (const w of ["[情侣申请] 我想和你在一起", "【情侣申请】", "（表白信）你好", "[申请书]"]) assert.ok(re.test(w), w);
  for (const w of ["我想申请一下", "情侣申请是什么", "[转账] 100"]) assert.ok(!re.test(w), w);
  assert.match(blk, /parsed\.loveLetter = body;/, "收进去以后走原来那条落地路，不另写一份");
});
