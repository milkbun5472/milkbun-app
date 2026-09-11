// 她 2026-09-09：「我想做一个线上可以开动描的开关，就是不用进完全线下走剧情
// 但是又不会一直觉得我们线上就是面对面发消息」，追问出来的病症是：
//   「我和他们在线上明明一起吃饭但是他们总是说为什么在对面还要发消息」。
//
// 查下来缺的只有两样（居中旁白线上本来就有，输入框那张模式单子第二档就是）：
//   ① 他不知道你俩此刻面对面——这一层代码里有，但只有【线下场次开着】这一个来源；
//   ② 他没地方放动作——ONLINE_CHAT_RULE_V2 第一句就把旁白/动作/神态全禁了。
//
// 所以这一版：那句禁令提成一份两处共用（多一个来源，不是多抄一段），
// 括号大法她那边和他那边共用同一个判据。
//
// ⚠️第一版把两件事焊成了一个开关，她当场纠正：「我只是举个例子不一定非要同处一室的
//   时候，就是我俩分开的时候要他动描自己在干啥也行」。所以拆成两个：
//   · 动描（actDesc）—— 设一次就不动，住聊天设置里，跟在不在一起【无关】；
//   · 同处一室（sameRoom）—— 一天开关好几回，住顶栏，只管【在场】那一层。
//
// ⚠️她第二次纠正：「我们状态卡里已经有动作了，是不是可以不要求他们重写，而是开关
//   就把动作那一块搬到屏幕中间也显示一次」——对。于是他那一侧【不再有任何写动作的
//   指令】，动作那一行直接来自每轮本来就填的 action；「没变就别刷屏」写在代码里。
// ⚠️她第三次纠正：「我自己聊天气泡带括号 比如这样 （笑着）你真可爱。这个笑着保留在
//   聊天里而不是变成上面一段居中」「他的居中不要那个叉，然后可以编辑重roll刷掉之类的
//   而不完全只是像系统的字」「然后动作放气泡前面」——于是：
//   · 她的括号【一律留在气泡里】，那条「整条括号→居中行」的路整个撤掉；
//   · 他那一行长按出菜单（编辑/重 Roll/撤回），不再是一颗 ✕；
//   · 那一行摆在这一轮气泡【前面】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const app = R("js/app.js"), eng = R("js/engine.js"), comp = R("js/components.js"), studio = R("js/theme-studio.js");

// 从 engine.js 里把那两个纯函数抠出来真跑（不猜它们拼出什么）
const grab = (src, name) => {
  const i = src.indexOf("function " + name + "(");
  assert.ok(i > 0, name + " 没了");
  let d = 0, j = src.indexOf("{", i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error(name + " 没闭合");
};

test("「你俩此刻面对面」那句禁令只有一份，两个来源共用", () => {
  // 它现在住在 engine.js
  assert.match(eng, /const FACING_BAN = "\*\*绝不许说「怎么还不来」/);
  assert.equal((eng.match(/绝不许说「怎么还不来」/g) || []).length, 1, "engine 里不止一份");
  // ⚠️线下那一处必须【搬过去】，不是各留一份——只开公共的、旧的留在原地是最坏的那种
  assert.equal((app.match(/绝不许说「怎么还不来」/g) || []).length, 0,
    "app.js 里还留着一份手抄的禁令：改一处另一处永远落单");
  assert.match(app, /【线下进行中】[\s\S]{0,200}?" \+ FACING_BAN \+ "/, "线下那一处没接到公共那份上");
  // 新来源也用同一份
  // ⚠️别冻签名（v66.30 多了一个 group：群里也接了同处一室，句子仍共用这一份）
  assert.match(eng, /function samePlacePresence\(uName, group\)[\s\S]{0,600}?\+ FACING_BAN \+/);
});

test("常驻指令里那个「你俩隔着屏幕」的前提摘掉了", () => {
  // 她 2026-09-09：「我们如果在同一个地方那肯定就是直接聊天而不是打字了吧」
  //   「常驻那个摘掉」——病根是这句每轮都发一遍，而她「（我过来抱抱你）」只说一次；
  //   一次的说不过每轮的。所以那三处只做减法，要说的话只在 ONLINE_CHAT_RULE_V2 说一遍。
  assert.ok(!/用手机即时通讯和用户聊天/.test(app), "任务那两句还在断言你俩隔着屏幕");
  assert.ok(!/用手机和 " \+ uName \+ " 一对一聊天/.test(app), "总纲那句还在断言你俩隔着屏幕");
  assert.match(app, /【聊天总纲】你就是上面的「" \+ char\.name \+ "」本人，和 " \+ uName \+ " 一对一说话。/);
  // v66.12 把那条不再发送的 A/B 基线删了，这句现在只剩 selfTask 一份
  assert.equal((app.match(/完全代入「" \+ char\.name \+ "」和用户说话。/g) || []).length, 1);
  // 前提交还给上下文，这句话只许有一份，单聊群聊共用
  const one = eng.match(/【你俩此刻在不在一个地方，看上下文，别默认隔着老远】/g) || [];
  assert.equal(one.length, 1);
  assert.match(eng, /const ONLINE_CHAT_RULE_V2 = `[\s\S]{0,600}?【你俩此刻在不在一个地方/,
    "这句得住在两边共用的那一份里，不然群聊吃不到");
  // 「都在对面了还发什么消息」那句禁令现在跟开关无关了，只许留在常驻这一份里
  assert.equal((eng.match(/都在对面了还发什么消息/g) || []).length, 1, "这句禁令又变成两份了");
  assert.ok(!/都在对面了还发什么消息/.test(grab(eng, "samePlacePresence")), "开关那一支还留着一份");
});

test("在场那一层走 offlineNow 同一个口子；真开着线下时不说两遍", () => {
  assert.match(app, /offlineNow: \(sameRoomFor\(char\.id\) && !offlineTogetherNow\(char\.id\)/,
    "同处一室没接进 ctxFor 那一个口子");
  assert.match(app, /\? samePlacePresence\(userName\(profile\)\)/);
  // 「地点以在一起为准」——日程写着他在公司也不算数，不然他会两头都信
  // v66.30：这句按【单聊/群里】分了两种说法，前半截仍是同一份
  assert.match(eng, /【地点以「在一起」为准】/);
  assert.match(eng, /你的日程这会儿写着你在别的地方也不算数——此刻你人就在 Ta 旁边/, "单聊那一句被改坏了");
  // 「都在对面了还发什么消息」正是她报的那句，必须点名禁掉
  assert.match(eng, /绝不许反问「都在对面了还发什么消息」/);
});

test("动描和同处一室是两件事，各挂各的开关", () => {
  assert.match(app, /const sameRoomFor = id => !!\(settingsFor\(id\) \|\| \{\}\)\.sameRoom;/);
  assert.match(app, /const actDescFor = id => !!\(settingsFor\(id\) \|\| \{\}\)\.actDesc;/);
  // ⚠️动描【不许】再看同处一室：她分开的时候也要他写自己在干嘛
  assert.match(app, /const _actDesc = !_s\.engineerEyes && actDescFor\(charId\);/);
  assert.ok(!/_sameRoom/.test(app), "动描那条路上还留着同处一室的判断，两件事又焊回去了");
  // v66.65：动描开着时那一行【就是描写】，所以管描写的那一族（INTIMATE_ACT_CLICHE）
  //   也跟着这同一个开关走——没开动描一个字都不发（线上只有台词，发过去是白发）。
  assert.match(app, /PERSONA_REGISTER_ANCHOR \+ \(_actDesc \? "\\n\\n" \+ ownActNoBracketRule\(uName\) \+ "\\n\\n" \+ INTIMATE_ACT_CLICHE : ""\)/,
    "动描那一段没挂在动描开关上，或者挤进了那三层中间");
  // 在场那一层反过来只认同处一室，不认动描
  assert.match(app, /offlineNow: \(sameRoomFor\(char\.id\)/);
  // 那三层的顺序不许被这一条打断（别处一堆测试盯着这条链）
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/);
});

test("他那一侧不再有写动作的指令：动作直接来自每轮本来就填的 action", () => {
  // 那一整条「怎么写括号」的规则要【删掉】，不是留在那儿再补一句「其实不用写」
  assert.ok(!/function actLineRule\(/.test(eng), "旧的写作指令还留着，等于两套动作来源并存");
  assert.ok(!/actLineRule\(/.test(app));
  const rule = grab(eng, "ownActNoBracketRule");
  // 只剩 app 自己才知道的那半句。她 2026-09-09：「rp 情境下模型应该都知道括号大法吧」——
  // 所以解释「她的括号是什么」那半句删了，语义交还给模型
  assert.match(rule, /【你自己不用写括号】/, "没拦住他跟着学，动作就会有两个来源");
  assert.match(rule, /你每轮照常填的 action 会原样显示给/);
  assert.ok(!/是她此刻的动作或神态/.test(rule), "又把解释括号那半句加回去了");
  // 生成协议里那两句是这一版的地基：没有它们，action 会每轮换个说法刷屏
  assert.match(app, /当前事实未变且原表述仍准确时，可以原样填写/);
  assert.match(app, /无需为了交字段换措辞、制造动作/);
});

test("动作那一行只在真变了的时候摆一次，而且这道闸在代码里", () => {
  const i = app.indexOf("if (_actDesc && onlineAction");
  assert.ok(i > 0, "动作那一行没接上");
  const blk = app.slice(i, i + 900);
  // 上一次摆出来的那条就存在聊天记录里，拿它比——不另存一份游标
  assert.match(blk, /const _rows = chatsRef\.current\[chatKey\] \|\| \[\];/);
  assert.match(blk, /m\.who === "char" && \(m\.role === "narration" \|\| m\.kind === "narration"\)/);
  // v67.18：裸比较换成了公共的 sameActLine——模型换个标点、句尾多个「了」，
  //   原来那道闸一次都拦不住（她 2026-09-11：「有我的群还是一句一个动作」）。
  assert.match(blk, /if \(!sameActLine\(_line, _prevAct\)\) pChat\(chatKey/, "没比就写＝每轮刷一行，两天就腻了");
  assert.match(blk, /who: "char"/);
  // 她 2026-09-09：「然后动作放气泡前面」——先看见他在干嘛，再看见他说什么
  assert.ok(app.indexOf("if (_actDesc && onlineAction") < app.indexOf("for (let i = 0; i < words.length; i++)"),
    "动作那一行又跑到气泡后面去了");
  assert.match(blk, /ts: Math\.max\(0, _tsOf\(0\) - 1\)/, "时间戳没排在头一泡前面，排序一变又会掉到后面");
  // ⚠️normalizeAction 只算一次：算两遍就是同一个形状写在两处
  assert.equal((app.match(/normalizeAction\(parsed\.action/g) || []).length, 1);
});

test("她自己打的括号一律留在气泡里，那条改道整个撤掉了", () => {
  // 她 2026-09-09：「（笑着）你真可爱。这个笑着保留在聊天里而不是变成上面一段居中」
  // ⚠️是【删掉】那条路，不是在它后面补一句「其实不该改道」
  assert.ok(!/actInner/.test(app), "「整条括号→居中行」那个判据还留着");
  assert.ok(!/asUserLine/.test(app), "她那两个入口还绕着改道那一层走");
  // 两个入口都回到普通 user 消息，一个字都不动
  assert.match(app, /const pushUser = \(charId, text, chatKey\) => \{[\s\S]{0,260}?role: "user",\n\s*content: text,/);
  assert.match(app, /if \(extraText != null && extraText !== ""\) \{\n\s*const um = \{\n\s*role: "user",\n\s*content: extraText,/);
  // 提示词里也不该再有「整条被一对括号包住」那种说法
  assert.ok(!/整条被一对括号/.test(eng), "还在说「整条包住」，跟她实际打的字对不上了");
});

test("他那一行是【消息】不是系统字：长按有菜单、没有那颗叉", () => {
  // 她 2026-09-09：「他的居中不要那个叉，然后可以编辑重roll刷掉之类的」
  const i = comp.indexOf('"data-wk": "narr"');
  const row = comp.slice(i, i + 1400);
  assert.match(row, /onTouchStart: selMode \? undefined : \(\) => startPress\(i\)/, "他那一行长按不出菜单");
  assert.match(row, /\(onDeleteMessages && m\.who !== "char"\) \?/, "他那一行还挂着那颗 ✕");
  // 菜单里真的有编辑和重 Roll
  assert.match(comp, /\? \[\["copy", "fav"\], \["edit", "reroll"\], \["multi", "recall"\]\]/);
  // 重 Roll 那道门要放他这一行过（原来只认 role==="assistant"）
  assert.match(app, /if \(m\.role !== "assistant" && m\.who !== "char"\) \{/, "他那一行点重 Roll 会被拦下");
});

test("他那边落成同一种消息，只多一个 who 标明是他做的", () => {
  // ⚠️他的动作绝不能被当成【她的旁白】喂回去，不然他以为那是她做的
  assert.match(app, /if \(\(m\.role === "narration" \|\| m\.kind === "narration"\) && m\.who !== "char"\) \{/);
  assert.match(app, /（这一条是你此刻做的动作／你那边的动静，不是你发出去的消息）/);
});

test("群聊也接上了：谁变了谁那几泡前面出一行，没变的不出", () => {
  // 她 2026-09-09：「群聊也接上动作吧。刚好如果一轮他们变了两次也都放进来
  // 比如第一句第三句变了那就是那俩气泡上有动作」
  assert.match(app, /const _gActDesc = !!gs\.actDesc;/);
  // ⚠️action 那一格原来只挂在【记忆互通】上：群里开了动描没开互通，模型压根不会填它，
  //   开关点了什么都不出现——正是「说改好了其实没变」那一类
  assert.match(app, /const gActionField = ",\\"action\\"/);
  assert.match(app, /: \(_gActDesc \? gActionField : ""\);/, "动描开着时没把 action 加进群协议");
  // 显示不看记忆互通：那是写不写状态卡的事
  assert.match(app, /const gActionNow = \(_rawGAction && window\.ThoughtVoiceGuard/);
  assert.match(app, /const gAction = gActionNow;/, "互通那一支又自己算了一遍");
  assert.equal((app.match(/normalizeAction\(_rawGAction/g) || []).length, 1);
  // 比的是【这个人自己上一次】，不是全群最后一条——不然 A 变了 B 没变会一起漏或一起出
  const i = app.indexOf("if (_gActDesc && gActionNow && spk)");
  assert.ok(i > 0, "群里那一行没接上");
  const blk = app.slice(i, i + 1100);
  assert.match(blk, /String\(mm\.senderId\) === String\(spk\.id\)/, "拿全群最后一条比，两个人的动作会互相盖掉");
  assert.match(blk, /if \(!sameActLine\(gActionNow, _gprevAct\)\) pGChat\(groupId/);
  assert.match(blk, /senderId: spk\.id, senderName: spk\.name/, "群里不写是谁做的，三个人就认不出来了");
  // 摆在这一条发言的气泡【前面】
  assert.ok(i < app.indexOf("for (let j = 0; j < gBubbles.length; j++)"));
  // 喂回去的时候不许被当成她写的旁白
  assert.match(app, /\(m\.role === "narration" && m\.who === "char"\) \? "【" \+ \(m\.senderName \|\| "某人"\) \+ " 当时正在做的｜不是 Ta 说出口的话】"/);
  // 群里那一行也能重 Roll
  assert.match(app, /if \(m\.role !== "assistant" && m\.who !== "char"\) \{ toast\("只能重Roll成员的消息"\)/);
  // 群渲染：跟单聊同一个待遇，且写出是谁做的
  const j = comp.indexOf('"data-wk": "narr"', comp.indexOf('"data-wk": "narr"') + 10);
  const row = comp.slice(j - 400, j + 1400);
  assert.match(row, /m\.who === "char" \? \(m\.senderName \|\| "TA"\) \+ " " \+ m\.content/);
  assert.match(row, /\(onDeleteMessages && m\.who !== "char"\) \?/, "群里那一行还挂着 ✕");
  // 群设置里那个开关（群设置是整份 patch 存的，不像单聊那头逐项手抄）
  assert.match(comp, /const \[gActDesc, setGActDesc\] = useState\(!!gs\.actDesc\);/);
  assert.match(comp, /defaultOffline: gDefaultOffline, actDesc: gActDesc, name: gName \}\);/);
  assert.match(comp, /row\("动描（居中那一行）"/);
});

test("两个开关各住各的地方，旁白那行有挂点", () => {
  // 存在 x_chatSettings 那一档里（跟别的每人设置同一处）
  assert.match(app, /const patchChatSetting = \(id, patch\) => \{[\s\S]{0,200}?saveJSON\("x_chatSettings", n\)/);
  assert.match(app, /patchChatSetting\(activeChar\.id, \{ sameRoom: on \}\);/);
  // 顶栏那颗键（不是塞进那张四档的模式单子——那四档是互斥的「这一条怎么发」）
  // v66.30 她：「换成svg按钮画个小房子之类的」，而且群聊顶栏也要有同一颗——
  // 所以它抽成了一个公共的 sameRoomButton，两处共用；两处各画一份迟早会走散。
  assert.match(comp, /function sameRoomButton\(\{ on, onToggle, t \}\)/, "那颗键没抽成公共的");
  assert.equal((comp.match(/"data-wk": "sameroom"/g) || []).length, 1, "那颗键被抄成了两份");
  // v66.64：开着那一档改用顶栏墨色（同上，主题红压在装修过的顶栏上很突兀）
  assert.match(comp, /h\(IHome, \{ size: 19, color: on \? t\.ink : t\.fog, wk: on \? "headink" : "headdim" \}\)/, "不是小房子图标了");
  assert.match(comp, /onToggleSameRoom \? sameRoomButton\(\{ on: sameRoom, onToggle: onToggleSameRoom, t: t \}\) : null/, "单聊顶栏没挂上");
  assert.ok(!/\["sameroom", "同处一室"/.test(comp), "别把它塞进那张模式单子里");
  // 她 2026-09-09：「键太显眼了」——细线图标、不带底盘，不许再是一颗描边药丸
  const key = comp.slice(comp.indexOf("function sameRoomButton("), comp.indexOf("function sameRoomButton(") + 1200);
  assert.ok(!/borderRadius: 999/.test(key) && !/border: "1px solid/.test(key), "那颗键又变回药丸了");
  // v66.64：开着那一档从主题强调色换成顶栏墨色（headink）——要证的还是【开关看得出来】
  assert.match(key, /color: on \? t\.ink : t\.fog, wk: on \? "headink" : "headdim"/, "开着看不出来就白做了");
  // 动描住在聊天设置的「窗」那一类里，不占顶栏
  assert.match(comp, /const \[actDesc, setActDesc\] = useState\(!!settings\.actDesc\);/);
  assert.match(comp, /show\("look", \{ title: "线上带不带动作", \.\.\.sec\("actdesc"\) \}/);
  assert.match(comp, /" · 动描 " \+ onOff\(actDesc\)/, "「窗」那一类的摘要里看不到它开没开");
  assert.match(comp, /\n      defaultOffline,\n      actDesc,\n/, "设置页没把它交出来");
  assert.match(app, /defaultOffline: !!s\.defaultOffline,\n\s*actDesc: !!s\.actDesc,/,
    "她 2026-09-09 报的「保存不了」就是这儿：存档那头逐项手抄，漏一项就悄悄丢");
  // 居中那行旁白/动作要能被主题台抓住，两边分得开
  assert.match(comp, /"data-wk": "narr",\s*\n\s*"data-me": m\.who === "char" \? "0" : "1",/);
  assert.match(comp, /"data-wk": "narrink",/);
  assert.match(studio, /\["narr", "居中那行旁白／动作/);
  assert.match(studio, /\["sameroom", "顶栏那个「同处一室」键/);
  // 她的括号不再改道之后，输入框那句特别提示也就没有存在的理由了
  assert.ok(!/括号＝动作/.test(comp), "输入框还挂着那句提示，但那条路已经撤了");
});
