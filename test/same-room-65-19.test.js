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
  assert.match(app, /PERSONA_REGISTER_ANCHOR \+ \(_actDesc \? "\\n\\n" \+ actLineRule\(uName\) : ""\)/,
    "动描规则没挂在动描开关上，或者挤进了那三层中间");
  // 在场那一层反过来只认同处一室，不认动描
  assert.match(app, /offlineNow: \(sameRoomFor\(char\.id\)/);
  // 那三层的顺序不许被这一条打断（别处一堆测试盯着这条链）
  assert.match(app, /ONLINE_CHAT_RULE_V2 \+ "\\n\\n" \+ REGISTER_FOLLOWS_SCENE \+ "\\n\\n" \+ PERSONA_REGISTER_ANCHOR/);
});

test("动描规则该有的闸一个都不少，而且不塞内容示范", () => {
  const rule = grab(eng, "actLineRule");
  assert.match(rule, /一轮至多一条/, "没有频率闸——他会每句话前面都配一个动作");
  assert.match(rule, /只在【处境真的变了】的时候写/);
  // ⚠️措辞不许假定「你俩在一个屋里」：分开时它写的是「他那边在干嘛」
  assert.match(rule, /你此刻手上在做的事、或者你那边的动静/);
  assert.ok(!/同处一室|面对面/.test(rule), "动描规则里混进了「在一起」的前提，分开时就说不通了");
  assert.match(rule, /只写你自己这一侧/, "少了对方主权：他会替她写动作");
  assert.match(rule, /心里怎么想仍然只走 thought/, "没挡住心理活动往括号里跑");
  assert.match(rule, /不等于改写成散文/, "没挡住它长成线下长文");
  // 她发来的那几条括号是【动作】不是台词，得说清楚
  assert.match(rule, /整条被括号包住的那几条，是 Ta 此刻做的动作/);
  // 施工规则/prompt-no-content-samples.md：留格式示范、删内容示范
  assert.match(rule, /形如「（……）」/, "格式示范没了");
  assert.ok(!/（把碗端/.test(rule), "又把内容示范塞回去了——模型会逐字照抄那个动作");
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
  assert.match(app, /const _act = _actDesc \? actInner\(words\[i\]\) : null;/, "他那边另写了一套判据");
  assert.match(app, /role: "narration", kind: "narration", who: "char", content: _act/);
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
  assert.match(comp, /\n      defaultOffline,\n      actDesc,\n/, "动描没存进去，关掉 app 就丢了");
  // 居中那行旁白/动作要能被主题台抓住，两边分得开
  assert.match(comp, /"data-wk": "narr",\s*\n\s*"data-me": m\.who === "char" \? "0" : "1",/);
  assert.match(comp, /"data-wk": "narrink",/);
  assert.match(studio, /\["narr", "居中那行旁白／动作/);
  assert.match(studio, /\["sameroom", "顶栏那个「同处一室」键/);
  // 输入框那行提示得能一眼读完（原来那句在 390 宽的屏上被截掉了半截）
  const ph = comp.match(/actDesc \? "(发一条消息[^"]*)"/);
  assert.ok(ph && ph[1].length <= 16, "输入框提示太长，手机上会被截断：" + (ph && ph[1]));
});
