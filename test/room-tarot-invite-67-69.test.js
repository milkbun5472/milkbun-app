// 她 2026-09-13 拍板那条的后一半：「给房间开可以算塔罗」。
//
// 形状照一起学／一起玩／一起读那三样来：房里一格开关 → 提示词里一格 tarotInvite →
// 他开口时落一张邀请卡 → 她点卡才真的开始。
// ⚠️牌是代码发的（塔罗那头洗牌、定正逆），所以这一格准他【开口】，不准他报牌面：
//   他在房里说出「我看见死神逆位」，她点开看到的还是另一副——回执是个承诺，
//   承诺不了的就别让他开口（一起读那条「没有书就不给这一格」是同一个道理）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require("../js/chat-rooms.js");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const tarot = fs.readFileSync(path.join(root, "js/tarot.js"), "utf8");

test("房间那一格开关在名单里，默认是关的", () => {
  const keys = K.GROUPS.actions.map(x => x[0]);
  assert.deepEqual(keys, ["study", "games", "fanfic", "read", "tarot"], "开关名单变了（设置页是照这张名单画的）");
  const row = K.GROUPS.actions.filter(x => x[0] === "tarot")[0];
  assert.equal(row[1], "他可以给你抽一张");
  // 预设里跟着那一档本来的规矩走，不给自己开小灶：
  // everyday 那一档就是「什么都可以」（四样本来全开），别的几档一样都不开。
  assert.equal(K.PRESETS.everyday.actions.tarot, K.PRESETS.everyday.actions.games);
  ["focused", "isolated", "alternate"].forEach(k => {
    assert.ok(!K.PRESETS[k].actions.tarot, k + " 这一档默认就开着塔罗");
  });
});

test("提示词那一格：准他开口，不准他报牌面", () => {
  const seg = app.slice(app.indexOf('const roomTarotOn = roomActionOn("tarot");'), app.indexOf("// ⚠️这一条必须挂在【Protocol v2】上"));
  assert.ok(seg.length > 0, "抠不出那一段");
  assert.match(seg, /openCaps\.push\("tarotInvite"\)/);
  assert.match(seg, /mode:\\"reading\|relation\|daily\\"/);
  assert.match(seg, /不许写出任何一张牌的名字、正逆或解读/, "没挡住他自己报牌面");
  assert.match(seg, /也不能声称已经抽过了/);
  // 开关关着就一个字都不发（openCaps 都不给）
  assert.match(seg, /if \(roomTarotOn\) \{/);
});

test("他开口 → 落一张卡；档位乱填的落回 reading", () => {
  const seg = app.slice(app.indexOf('if (roomTarotOn && parsed.tarotInvite'), app.indexOf("if (roomGamesOn && parsed.gameInvite"));
  assert.match(seg, /\["reading", "relation", "daily"\]\.indexOf\(String\(tv\.mode \|\| ""\)\) >= 0 \? String\(tv\.mode\) : "reading"/);
  assert.match(seg, /kind: "tarotinvite", mode: mode,/);
  assert.match(seg, /ask: String\(tv\.ask \|\| ""\)\.trim\(\)\.slice\(0, 120\)/);
  assert.match(seg, /delivered = true;/);
  // 卡上没有、也不许有牌面：这张卡只带档位、该问的那件事和他说的话
  assert.ok(!/cards|reads|summary/.test(seg), "邀请卡上带了牌面——那是她点开之后才有的东西");
});

test("卡面走已有那张（一起学/一起玩/一起读同一张），不另画一张", () => {
  assert.match(comp, /m\.kind === "readinvite" \|\| m\.kind === "tarotinvite"/);
  assert.match(comp, /const eyebrow = isTarot \? "算一卦"/);
  assert.match(comp, /const go = isTarot \? "去摊开这几张"/);
  assert.match(comp, /isTarot && m\.ask \? h\("div"/, "他想替她问的那句没露出来");
  assert.match(comp, /if \(isTarot\) \{ onOpenTarotInvite && onOpenTarotInvite\(m\); \}/);
  assert.match(comp, /\n  onOpenTarotInvite,/, "ChatThread 压根没收这个回调");
});

test("点开就落在他提的那一档，角色和该问的那件事替她填好", () => {
  assert.match(app, /onOpenTarotInvite: m => \{/);
  assert.match(app, /setTarotEntry\(\{ key: "tarot_" \+ Date\.now\(\), mode: String\(m\.mode \|\| "reading"\), charId: activeChar\.id, ask: String\(m\.ask \|\| ""\) \}\)/);
  assert.match(app, /entry: tarotEntry,\n\s*onEntryUsed: \(\) => setTarotEntry\(null\),/);
  // 塔罗那头：认得这一戳，而且用完就还回去（不然下次进塔罗还会自己跳进去）
  assert.match(tarot, /const mk = MODES\[e\.mode\] \? e\.mode : "reading";/);
  assert.match(tarot, /setView\("mode:" \+ mk\);/);
  assert.match(tarot, /props\.onEntryUsed && props\.onEntryUsed\(\);/);
  // 填好的那两样是【默认值】，不是锁死：她照样能改
  assert.match(tarot, /const \[charId, setCharId\] = useState\(props\.initCharId \|\| ""\);/);
  assert.match(tarot, /const \[q, setQ\] = useState\(props\.initQ \|\| ""\);/);
  assert.match(tarot, /onCancel: \(\) => \{ setSeed\(null\); setView\("home"\); \}/);
});
