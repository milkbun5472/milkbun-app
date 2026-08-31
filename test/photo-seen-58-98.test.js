const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const app = R("app.js");
const helpers = app.slice(app.indexOf("  const AVATAR_COOLDOWN_MS ="), app.indexOf("  // ── 照相馆 ──"));

// 她 2026-08-31：「做把我发过的图换上，但是不要每次都触发不然我给他发个什么食物图他也换了，
// 要真的觉得好才换。然后生成图的时候一般不也会有描述提示词的吗，能不能把那个提示词作为
// 文字保留住上下文」。
//
// ⚠️浏览器里抓到的第一个真问题：我一开始把这段挂在 _normalTaskFull 上，而那一行旁边
// 写着「暂留作 A/B 回滚基线，但不再发送给普通角色」——挂在死路上，一个字都发不出去。
// 真正在跑的是 Protocol v2（openCaps + capState）。
test("挂在真正在跑的那条协议上，不是那条死路", () => {
  assert.match(app, /openCaps\.push\("photoSeen"\);/, "没进本轮开放能力");
  assert.match(app, /capState\.push\(photoSeenHint\(_seenAvatarOk, uName\)\.trim\(\)\);/, "没进本轮能力状态");
  // 那条 A/B 基线上不许再挂
  const dead = app.slice(app.indexOf("      const _normalTaskFull = ("), app.indexOf("      // 旧 _normalTaskFull 暂留作"));
  assert.ok(dead.indexOf("seenHint") < 0 && dead.indexOf("seenField") < 0, "又挂回那条不再发送的基线上了");
});

// 十轮里九轮用不上的层不该常驻（跟论坛回声同一条判据）
test("她这一轮没发照片就一个字都不发", () => {
  assert.match(app, /const _seenMsg = opts\.proactive \? null : freshUserPhoto\(charId\);/, "没按需算");
  assert.match(app, /if \(_seenMsg\) \{\n        openCaps\.push\("photoSeen"\);/, "没发照片也照发");
  // 主动问候那种轮次不发：他没在看照片
  assert.match(app, /opts\.proactive \? null :/, "主动轮也发了");
});

// 「真觉得好才换」——提示词只能降概率，代码这一道给的是硬闸
test("三道硬闸：只认刚发的真照片 / 冷却 / 主动轮不发", () => {
  assert.match(helpers, /if \(m && m\.role === "user" && m\.kind === "photo" && m\.imageRef\) return m;/,
    "描述式照片（没有 imageRef）也算数了");
  assert.match(helpers, /const tail = rows\.slice\(-FRESH_PHOTO_LOOKBACK\);/, "翻了整本聊天记录——几个月前那张也会被当成「刚发的」");
  assert.match(helpers, /const AVATAR_COOLDOWN_MS = 7 \* 86400000;/, "没有冷却");
  assert.match(helpers, /const avatarCoolOk = charId => \(Date\.now\(\) - Number\(\(avatarSwapRef\.current\[charId\] \|\| \{\}\)\.ts \|\| 0\)\) >= AVATAR_COOLDOWN_MS;/, "冷却算错");
  // 冷却里连那半句都不发下去，而且代码这一道也不认
  assert.match(helpers, /\+ \(canAvatar\n      \? "\\n· avatar：/, "冷却里还把 avatar 那半句发下去");
  assert.match(helpers, /if \(!canAvatar \|\| seen\.avatar !== true\) return;/, "模型硬填 avatar 就换了——闸得在代码这一道");
  assert.match(helpers, /默认 false/, "没把默认说死");
});

// ⚠️浏览器里抓到的第二个真问题：聊天里好些消息没有 id，写成 m.id === msg.id 的话
// undefined === undefined 会把所有没 id 的消息一起认成同一条（实跑时同一句写进了三条）。
test("认那一条要认得准，别 undefined 撞 undefined", () => {
  assert.match(helpers, /const same = m => m && m\.kind === "photo" && m\.imageRef && m\.imageRef === msg\.imageRef\n      && \(msg\.id \? m\.id === msg\.id : m\.ts === msg\.ts\);/,
    "又写回 m.id === msg.id 了——没 id 的消息会一起被认成同一条");
  // 本轮回复自己也在写同一个 durable 键，两笔挨太近会撞 WAL 读回自检
  assert.match(helpers, /setTimeout\(\(\) => pChat\(chatKey \|\| charId, p => p\.map\(m => same\(m\) \? \{ \.\.\.m, seenNote: note \} : m\)\), 400\)/,
    "跟本轮其他写挨在一起了");
});

test("换头像留住旧那张，而且不许把她踢出聊天", () => {
  assert.match(helpers, /const prev = ch\.avatarImage \|\| "";/, "没留旧头像，换了就回不去");
  assert.match(helpers, /\[charId\]: \{ ts: Date\.now\(\), prev: prev \}/, "没记下换的时间和旧那张");
  // saveChar 顺手 setScreen("cast")：后台换个头像会把她从聊天里踢到档案馆去
  assert.ok(helpers.indexOf("saveChar(") < 0, "用了 saveChar——它会顺手切屏");
  assert.match(helpers, /pC\(p => p\.map\(x => x\.id === charId \? \{ \.\.\.x, avatarImage: msg\.imageRef \} : x\)\)/, "没真换上");
  assert.match(app, /setAvatarSwap\(loadJSON\("x_avatarSwap", \{\}\)\);/, "重开 App 冷却就忘了");
});

// 她那半句：「生成图的时候一般不也会有描述提示词的吗，能不能把那个提示词作为文字保留住上下文」
// 他自己发的照片本来就留了（desc → 历史行的「照片内容：」）；缺的是她发的这一半。
test("她发的那张，画面记成文字留在历史行里", () => {
  assert.match(app, /\(m\.seenNote \? "\\n（你当时记下的画面：" \+ m\.seenNote \+ "）" : ""\)/, "历史行没带上那句");
  // 他自己那半本来就有，别改坏了
  assert.match(app, /"【你在这里已经实际发出一张"[\s\S]{0,200}\(m\.desc \? "\\n照片内容：" \+ m\.desc : ""\)/, "他自己发的那半被改坏了");
  assert.match(helpers, /写给以后的自己看的/, "没说清这句是留给以后用的");
  assert.match(helpers, /别写观后感、别写夸奖、别复述配文/, "没挡住写成读后感");
});

// .claude/rules/four-surfaces-same-context.md：差异必须是显式的、写着理由的
test("四处的差异登记写清楚了", () => {
  const reg = app.slice(app.indexOf("      // ── 他刚看见的那张照片（她 2026-08-31）"), app.indexOf("      const _seenMsg ="));
  assert.match(reg, /单聊线上 ✅/);
  assert.match(reg, /单聊线下 ❌[\s\S]*?这是欠的，不是有理由不给/, "线下没登记，或者没说清是欠的");
  assert.match(reg, /群聊两处 ❌ 有真理由/, "群里那两处没写理由");
  assert.match(reg, /记成谁的说不清/, "群里的理由没说到点上");
});
