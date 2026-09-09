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
  assert.match(eng, /function samePlacePresence\(uName\)[\s\S]{0,400}?\+ FACING_BAN \+/);
});

test("在场那一层走 offlineNow 同一个口子；真开着线下时不说两遍", () => {
  assert.match(app, /offlineNow: \(sameRoomFor\(char\.id\) && !offlineTogetherNow\(char\.id\)/,
    "同处一室没接进 ctxFor 那一个口子");
  assert.match(app, /\? samePlacePresence\(userName\(profile\)\)/);
  // 「地点以在一起为准」——日程写着他在公司也不算数，不然他会两头都信
  assert.match(eng, /【地点以「在一起」为准】你的日程这会儿写着你在别的地方也不算数/);
  // 「都在对面了还发什么消息」正是她报的那句，必须点名禁掉
  assert.match(eng, /绝不许反问「都在对面了还发什么消息」/);
});

test("动描和同处一室是两件事，各挂各的开关", () => {
  assert.match(app, /const sameRoomFor = id => !!\(settingsFor\(id\) \|\| \{\}\)\.sameRoom;/);
  assert.match(app, /const actDescFor = id => !!\(settingsFor\(id\) \|\| \{\}\)\.actDesc;/);
  // ⚠️动描【不许】再看同处一室：她分开的时候也要他写自己在干嘛
  assert.match(app, /const _actDesc = !_s\.engineerEyes && actDescFor\(charId\);/);
  assert.ok(!/_sameRoom/.test(app), "动描那条路上还留着同处一室的判断，两件事又焊回去了");
  assert.match(app, /PERSONA_REGISTER_ANCHOR \+ \(_actDesc \? "\\n\\n" \+ userActLineRule\(uName\) : ""\)/,
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
  const rule = grab(eng, "userActLineRule");
  // 只剩他【读】那一侧的两句
  assert.match(rule, /整条被一对括号从头包到尾的，是 Ta 此刻做的动作/, "他会把她的括号当台词回");
  assert.match(rule, /【你自己不用写这种括号】/, "没拦住他跟着学，动作就会有两个来源");
  assert.match(rule, /你每轮照常填的 action 会原样显示给 Ta 看/);
  // 他那边的括号分支要撤掉：动作只从 action 那一格来
  assert.ok(!/const _act = _actDesc \? actInner\(words\[i\]\)/.test(app), "他那边还留着括号分支");
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
  assert.match(blk, /if \(_line !== _prevAct\) pChat\(chatKey/, "没比就写＝每轮刷一行，两天就腻了");
  assert.match(blk, /who: "char"/);
  // 摆在【状态落库那一段】而不是气泡循环里：他说完话、发完东西之后才看到他在干嘛
  assert.ok(app.indexOf("if (_actDesc && onlineAction") > app.indexOf("for (let i = 0; i < words.length; i++)"));
});

test("括号大法两种坏法都试过：该吞的吞、不该吞的一条都不许吞", () => {
  const src = app.match(/const actInner = text => \{[\s\S]*?\n  \};/);
  assert.ok(src, "actInner 没了");
  const actInner = new Function("return " + src[0].replace(/^const actInner = /, "").replace(/;$/, ""))();
  // 该当动作的
  assert.equal(actInner("（把外套扔在沙发上）"), "把外套扔在沙发上");
  assert.equal(actInner("  (puts the bowl down)  "), "puts the bowl down", "半角括号也算");
  assert.equal(actInner("（他说「（小声）」）"), "他说「（小声）」", "嵌套的还是一条动作");
  // ⚠️不该当动作的：前半截就闭合了，那是一句话里带了括号
  assert.equal(actInner("（笑）行吧（叹气）"), null, "这条被整条吞成动作了，她那句话就没了");
  assert.equal(actInner("在呢"), null);
  assert.equal(actInner("（）"), null, "空括号不该变成一条空旁白");
  assert.equal(actInner("（没关上"), null);
  assert.equal(actInner(""), null);
  assert.equal(actInner(null), null);
});

test("她那边两个入口共用一个出口，关着的时候还是普通消息", () => {
  // 直接发 / 带着输入框的字让 TA 回复——两处都得走 asUserLine
  assert.match(app, /const m = asUserLine\(charId, text\);/, "pushUser 没走公共那份");
  assert.match(app, /const um = asUserLine\(charId, extraText\);/, "replyNow 那处没走公共那份");
  assert.match(app, /const asUserLine = \(charId, text\) => \{/, "公共那份没了");
  assert.equal((app.match(/asUserLine\(/g) || []).length, 2, "asUserLine 只该有那两处调用");
  // 判据挂在开关上：关着就永远是普通 user 消息
  assert.match(app, /const act = actDescFor\(charId\) \? actInner\(text\) : null;/);
  assert.match(app, /\? \{ role: "narration", kind: "narration", content: act, ts: Date\.now\(\), read: true \}/);
});

test("他那边落成同一种消息，只多一个 who 标明是他做的", () => {
  // ⚠️他的动作绝不能被当成【她的旁白】喂回去，不然他以为那是她做的
  assert.match(app, /if \(\(m\.role === "narration" \|\| m\.kind === "narration"\) && m\.who !== "char"\) \{/);
  assert.match(app, /（这一条是你此刻做的动作／你那边的动静，不是你发出去的消息）/);
  // 开着的时候，她的那几条要说清是【她做的动作】，不是无主的场景
  assert.match(app, /_actDesc \? "【" \+ uName \+ "此刻做的动作／她那边的动静｜不是 Ta 说出口的话】/);
});

test("两个开关各住各的地方，旁白那行有挂点", () => {
  // 存在 x_chatSettings 那一档里（跟别的每人设置同一处）
  assert.match(app, /const patchChatSetting = \(id, patch\) => \{[\s\S]{0,200}?saveJSON\("x_chatSettings", n\)/);
  assert.match(app, /patchChatSetting\(activeChar\.id, \{ sameRoom: on \}\);/);
  // 顶栏那颗键（不是塞进那张四档的模式单子——那四档是互斥的「这一条怎么发」）
  assert.match(comp, /"data-wk": "sameroom",\s*\n\s*"data-on": sameRoom \? "1" : "0",/);
  assert.match(comp, /onToggleSameRoom \? \/\*#__PURE__\*\/React\.createElement\("button"/);
  assert.ok(!/\["sameroom", "同处一室"/.test(comp), "别把它塞进那张模式单子里");
  // 她 2026-09-09：「键太显眼了」——退成小字，不许再是一颗描边药丸
  const key = comp.slice(comp.indexOf('"data-wk": "sameroom"'), comp.indexOf('"data-wk": "sameroom"') + 700);
  assert.ok(!/borderRadius: 999/.test(key) && !/border: "1px solid/.test(key), "那颗键又变回药丸了");
  assert.match(key, /color: sameRoom \? t\.accent : t\.fog/, "开着看不出来就白做了");
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
  // 输入框那行提示得能一眼读完（原来那句在 390 宽的屏上被截掉了半截）
  const ph = comp.match(/actDesc \? "(发一条消息[^"]*)"/);
  assert.ok(ph && ph[1].length <= 16, "输入框提示太长，手机上会被截断：" + (ph && ph[1]));
});
