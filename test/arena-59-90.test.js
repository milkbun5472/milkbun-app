const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const dbt = R("debate.js"), comp = R("components.js"), scr = R("screens.js"), ts = R("theme-studio.js"), core = R("core.js");
const drm = R("dream.js"), trt = R("tarot.js");
const live = dbt.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 她 2026-09-01：「装修一下辩论吧，然后给他改个名再看看代码逻辑有没有问题」

// ===== 改名：辩论 → 擂台 =====
// 「辩论」是个通用类目词（换个 app 照样成立），而且它只说得了一半——
// 这里另一半的局是【随便吵】：谁先把对方逗笑、谁把话题带跑偏，那压根不是辩论。
test("改名叫「擂台」，而且五处都跟上了（一层写在五处，别只改一处）", () => {
  assert.match(dbt, /h\(Head, \{ zh: "擂台", en: "Arena"/, "落地页顶栏没改名");
  assert.match(comp, /debate: \{ kind: "app", zh: "擂台", G: GDebate \}/, "首页那格还叫辩论");
  assert.match(scr, /\["debate", "擂台"\]/, "世界书的适用范围那一栏没跟上");
  assert.match(scr, /\["x_debate_saves", "擂台存档"\]/, "存档清单那一栏没跟上");
  assert.match(ts, /\["debate","擂台"\]/, "主题工坊那一栏没跟上");
  // ⚠️存档键不许改：改了她之前的场次全部消失
  assert.match(dbt, /loadJSON\("x_debate_saves"/, "存档键被一起改了，旧存档会全丢");
  assert.match(dbt, /saveJSON\("x_debate_saves"/);
  // 图标也得跟着换：天平是「辩论」的图，说不了「上台吵」那一半
  assert.ok(core.indexOf('const GDebate = p => h(Svg, p, h("path", { d: "M12 3v18M6 21h12M4 7h16M12 4l-7 3M12 4l7 3" })') < 0, "图标还是那把天平");
  assert.match(core, /const GDebate = p => h\(Svg, p, h\("path", \{ d: "M9\.5 2\.6v1\.8M14\.5 2\.6v1\.8" \}\)/, "图标没画成台子");
});

// ===== 逻辑 =====
// engine.js 那句：「所有角色视角的取材都用它过滤」。这一处只挡了 OOC。
test("取材过滤要和别处一致：撤回的、被排除的都不许喂进来，而且先过滤再取尾", () => {
  const i = dbt.indexOf("function recentChatSnippet(charId, uName, charName) {");
  const src = dbt.slice(i, dbt.indexOf("\n  }", i));
  assert.match(src, /!m\.recalled/, "撤回的那句角色本来就不该记得");
  assert.match(src, /typeof contextAllowsMessage !== "function" \|\| contextAllowsMessage\(m\)/, "被上下文开关排除的那些照样喂进去了");
  // ⚠️顺序：先 filter 再 slice(-12)。反过来的话，一段撤回的能把真正有用的几句挤没
  const fi = src.indexOf(".filter("), si = src.indexOf(".slice(-12)");
  assert.ok(fi > 0 && si > fi, "先取尾再过滤——一段撤回的就能把有用的挤光");
});

test("立场分配：名字对不上要按顺序兜底，否则全场没有立场", () => {
  const i = dbt.indexOf("async function assignStances(");
  const src = dbt.slice(i, dbt.indexOf("\n  }", i));
  // 模型给名字加书名号／多空格／写成「角色1」都很常见，对不上就【所有人】都变「自行把握」
  // ⚠️咬住整段：只 match 一句 `const byIdx = list[i]` 的话，中间被人塞一句提前 return 也照样绿
  assert.match(src, /chars\.forEach\(function \(c, i\) \{\s*if \(out\[c\.name\]\) return;\s*const byIdx = list\[i\];\s*const txt = byIdx \? String\(byIdx\.stance \|\| ""\)\.trim\(\) : "";\s*if \(txt\) out\[c\.name\] = txt;\s*\}\);/,
    "没有按顺序兜底那一手，或者中间被人塞了一句提前 return");
  assert.match(src, /out\[String\(s\.name\)\.trim\(\)\]/, "名字没 trim，带空格就永远对不上");
});

test("赛后感言：名字对不上也要按顺序兜底，别整栏空着", () => {
  const i = dbt.indexOf("async function genResult(");
  const src = dbt.slice(i, dbt.indexOf("\n  }", i));
  assert.match(src, /if \(!closings\.length && raws\.length === chars\.length\) closings = raws\.map\(\(c, i\) => \(\{ name: chars\[i\]\.name, text: c\.text \}\)\)/,
    "一个都匹配不上就全丢了——那一栏会整个空着，看着像模型没答");
});

// app.js 那层 requestAppConfirm 就是为这个立的：iOS/PWA 里勾一次「不再显示」，
// 原生 confirm/prompt 会被【永久】吞掉，那颗键从此按下去毫无反应。
test("不许再用原生 confirm / prompt——PWA 会把它们永久吞掉", () => {
  assert.equal(live.indexOf("window.confirm"), -1, "收台那颗键会在 PWA 里变成死键");
  assert.equal(live.indexOf("window.prompt"), -1, "自定义立场那颗键会在 PWA 里变成死键");
  assert.match(dbt, /const endDebate = \(\) => requestAppConfirm\("收台，判胜负？"/);
  // 自定义立场改成就地输入
  assert.match(dbt, /const \[sideDraft, setSideDraft\] = useState\(null\)/);
  assert.match(dbt, /onClick: \(\) => setSideDraft\(""\)/, "「自己写一个」点了不出输入框");
  assert.match(dbt, /onKeyDown: e => \{ if \(e\.key === "Enter" && sideDraft\.trim\(\)\) setMySide\(sideDraft\.trim\(\)\); \}/, "回车提交不了");
});

test("连点两下不许白花两次钱（她按次计费）", () => {
  ["const runGen = async (myText, skip) => {", "const submitRound = async skip => {", "const runEnd = async () => {"].forEach(function (k) {
    const i = dbt.indexOf(k);
    assert.ok(i > 0, "找不到：" + k);
    assert.match(dbt.slice(i, i + 260), /if \(busy\) return;/, k + " 没挡住连点");
  });
});

test("发言卡里不许再套一层滚动（mobile-ui-layout §3：一个区域只留一个主滚动容器）", () => {
  const i = dbt.indexOf("const turnCard = function (tn, k) {");
  const src = dbt.slice(i, dbt.indexOf("\n    };", i));
  assert.ok(src.indexOf("maxHeight: 300") < 0 && src.indexOf("overflowY") < 0, "卡片里又套了个小滚动区，会跟整页抢手势");
  assert.match(src, /whiteSpace: "pre-wrap"/, "换行丢了");
});

test("底栏只吃 0.4 条安全区（mobile-ui-layout §2：不许 env + Npx 垫高一截）", () => {
  assert.equal((dbt.match(/env\(safe-area-inset-bottom\) \* 0\.4/g) || []).length, 2, "两条底栏没都按标尺来");
  assert.ok(!/calc\(1[02]px \+ env\(safe-area-inset-bottom\)\)/.test(dbt), "又把底栏整条垫高了");
});

// ===== 装修：这个 app 在现实里是【一个搭起来的台子】 =====
// 判据（tabs-not-plain-pills.md）：一排头像＋一列左边带色条的卡片＋一个深色评论区，
// 原样搬进任何一个 app 都成立——那就是没设计。
test("台子：台面那条线横过所有人，立场牌挂在台前的台裙上", () => {
  const i = dbt.indexOf("const stage = h(");
  const src = dbt.slice(i, dbt.indexOf("\n    // ── 发言", i));
  // ⚠️冻的是「所有人共用同一个高度」，不是某个数字：v59.97 起它随收/放两档变
  assert.match(dbt, /const HEAD_H = stageOpen \? \d+ : \d+;/, "台面那条线没有一个固定的高度，几个人就会各站各的高度");
  assert.match(src, /top: HEAD_H, bottom: 0[\s\S]{0,180}borderTop: "3px solid " \+ t\.ink/, "没有台面那条线／台裙");
  assert.match(src, /boxShadow: "0 5px 9px -6px rgba\(38,34,28,\.85\)"/, "台面底下没有影子，就只是一条分割线");
  assert.match(src, /width: 1, height: stageOpen \? 7 : 4, background: p\.color/, "立场牌没有挂绳，它是浮着的不是挂着的");
  // ⚠️v59.97 起立场牌【不锁行数】了——锁行数正是「看不全」那个病（见下面 v59.97 那两条）。
  //   长短不一本来就该长短不一：牌子是挂着的，本来就挂得有长有短。
  // 横幅：底边中间收一个尖口，是布幡不是标题栏
  assert.match(dbt, /clipPath: "polygon\(0 0,100% 0,100% 100%,50% calc\(100% - 7px\),0 100%\)"/);
  // 旧的那一排「头像 · 头像 · 头像」不许回来
  assert.ok(src.indexOf('"VS"') < 0, "又摆回一排头像加 VS 了");
});

test("发言：台上那个人面前那块名牌，不是左边一条色边的通用卡片", () => {
  const i = dbt.indexOf("const turnCard = function (tn, k) {");
  const src = dbt.slice(i, dbt.indexOf("\n    };", i));
  assert.match(src, /borderRadius: "5px 5px 0 0", borderBottom: "3px solid " \+ tn\.color/, "名牌不是名牌");
  assert.match(src, /borderRadius: "0 11px 11px 11px"/, "卡片左上角没有被名牌压住，两块就接不上");
  assert.ok(src.indexOf('borderLeft: "3px solid " + tn.color') < 0, "又变回左边一条色边的通用卡片了");
});

// v60.26 Codex 把整个台下换成了一张「客观未决争点卡」。删掉路人弹幕是对的，
// 但换来的那张卡是【记账】不是【活的】：一个没有主人的客观记录员，
// 而且「下一轮可追问」替她想好了下一句该问什么——那是她的活。
// 按这个 app 自己的尺子（tabs-not-plain-pills.md）它还更通用了：
// 那张卡原样搬进任何一个辩论 app 都成立。
// v60.41 把台下拿回来，但只留【她自己的、没上台的角色】：
// 借来的是「直播间弹幕＋网感路人」这个形状，不是「有认识的人在旁边看着」这件事。
test("台下回来了，但只有她的人——路人弹幕那一套不许回来", () => {
  const i = dbt.indexOf("async function genRound(");
  const gen = dbt.slice(i, dbt.indexOf("async function genResult", i));
  const live = gen.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(live.indexOf('"crowd"') < 0 && live.indexOf("观众弹幕") < 0 && live.indexOf("随机路人") < 0
    && live.indexOf("网感") < 0 && live.indexOf("正好 \" + o.count") < 0,
    "又变回『台上说完、台下刷一批弹幕』那一套了");
  assert.match(gen, /不要路人、不要昵称、不要弹幕/);
  assert.match(gen, /都是认识台上这几位的熟人，不是路人/);
  // 至多两条：它是配角，不许比台上响
  assert.match(gen, /挑【至多两位】各出一声/);
  assert.match(dbt, /\.slice\(0, 2\);/, "没封顶，一轮又能刷出一屏");
  // 判据写死：换个人说照样成立的那种话，一句都不要
  assert.match(gen, /这一句必须【只有他说才成立】/);
  assert.match(gen, /换个人说照样成立的那种话/);
  // 只认名单里的人：模型凭空多出一个路人就丢掉
  assert.match(dbt, /return c\.text && names\[c\.name\];/, "模型编个路人也照收，那名单就是摆设");
  // 「下一轮可追问」删掉：她要问什么是她自己的事
  const dl = dbt.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(dl.indexOf("focus.question") < 0 && dl.indexOf("可追问") < 0, "又替她想好下一句该问什么了");
  assert.match(gen, /不替 " \+ uName \+ " 想下一句该问什么/);
  // 分歧本身留着：下一轮才接得住
  assert.match(dbt, /last\.focus = r\.focus;/, "争点没存进本轮，刷新就丢了");
  assert.match(dbt, /focus: prior && prior\.focus/, "下一轮没有吃到上一轮争点，那它就是摆设");
  assert.ok(dbt.indexOf("const audienceBlock =") < 0, "旧那个台下评论区不许回来");
});

test("场边那一声长在台边上，不是又一列气泡；分歧只是一行注脚", () => {
  const i = dbt.indexOf("const sideBlock = function");
  const side = dbt.slice(i, dbt.indexOf("const focusBlock = function", i));
  assert.match(side, /borderLeft: "2px solid " \+ t\.line/, "台子那条边没了，它就成了又一列气泡");
  assert.match(side, /"台边 · "/);
  assert.match(side, /fontSize: 12/, "比台上还大就喧宾夺主了");
  // 分歧从「一张带字距标签的卡」降成一行小字
  const fb = dbt.slice(dbt.indexOf("const focusBlock = function"), dbt.indexOf("// 旧存档不删数据"));
  assert.ok(fb.indexOf("未 决 争 点") < 0, "又做成一张比台上还抢眼的卡了");
  assert.match(fb, /"还没吵拢的是——"/);
  assert.match(fb, /fontSize: 11\.5/);
  assert.match(dbt, /sideBlock\(r\.side, ri2\),\n\s*focusBlock\(r\.focus, ri2\)/, "两块都要真的画出来");
});

test("旧存档的台下评论不删除，只默认折叠成旧看台记录", () => {
  const i = dbt.indexOf("const legacyAudience = function");
  const src = dbt.slice(i, dbt.indexOf("\n    };", i));
  assert.match(src, /h\("details"/, "旧弹幕没有折叠，会继续长得像参考图");
  assert.match(src, /"旧看台记录 · " \+ crowd\.length \+ " 条"/);
  assert.match(dbt, /legacyAudience\(r\.audience, ri2\)/, "旧存档数据彻底看不见了");
});

test("判定：吊在台子上方那块记分牌", () => {
  const i = dbt.indexOf("ended && s.verdict ?");
  const src = dbt.slice(i, i + 1600);
  assert.match(src, /left: "26%", top: -18, width: 1, height: 18/, "少了吊绳，牌子就不是吊着的");
  assert.match(src, /right: "26%", top: -18, width: 1, height: 18/);
  assert.match(src, /background: "#1e1d1b"[\s\S]{0,200}boxShadow: "0 12px 26px rgba\(0,0,0,\.3\)"/, "记分牌不是牌子");
  assert.match(src, /color: "#f0c67a"/, "胜者名字没有单独立起来");
  assert.ok(src.indexOf("⚖ 裁判判定") < 0 && src.indexOf("胜者：") < 0, "还是原来那张通用卡片");
});

test("落地页：一场是一张场次单，判完的盖一枚歪着的章", () => {
  assert.match(dbt, /transform: "rotate\(-9deg\)"[\s\S]{0,260}"胜"/, "判完那场没有印章，只是又一个圆角徽章");
  assert.match(dbt, /borderLeft: "4px solid " \+ modeInk, borderRadius: "4px 13px 13px 4px"/, "场次单没有那条模式色的边条");
  // 两处都要改：场次单上那一行，和擂台顶栏那颗牌
  assert.equal((dbt.match(/s\.mode === "free" \? "随便吵" : "讲道理"/g) || []).length, 2,
    "模式名只改了一处——这里一半的局压根不是辩论");
});

// 同一份代码抄在三个文件里，同一个毛病。擂台改完，梦境和塔罗也得改
// ——「一层写在三处，第三处没跟上」正是这个 app 反复犯的那一个。
test("梦境和塔罗那两份取材，用的是同一条过滤线", () => {
  [["梦境", drm, "function recentChatSnippet(charId, uName, charName) {", "12"],
   ["塔罗", trt, "function recentChat(charId, uName, charName) {", "10"]].forEach(function (row) {
    const name = row[0], src0 = row[1], head = row[2], n = row[3];
    const i = src0.indexOf(head);
    assert.ok(i > 0, name + "：找不到取材那一段");
    const src = src0.slice(i, src0.indexOf("\n  }", i));
    assert.match(src, /!m\.recalled/, name + "：撤回的那句还在喂");
    assert.match(src, /typeof contextAllowsMessage !== "function" \|\| contextAllowsMessage\(m\)/, name + "：被排除的那些还在喂");
    const fi = src.indexOf(".filter("), si = src.indexOf(".slice(-" + n + ")");
    assert.ok(fi > 0 && si > fi, name + "：先取尾再过滤——一段撤回的就能把有用的挤光");
  });
});

// ===== v59.92：她 2026-09-01「maxtoken 也放开了吧宝宝，这里擂台还有论坛还有一起学」=====
// 思考型模型的思考预算是从 maxTokens 里扣的：给紧了，它想完就没配额写正文，
// 直接空返回或者写一半停在半句。而她按【次】计费、输出不另外收钱——
// 省这几千 token 一分钱省不到，换来的是一次空返回再重来一次，反而多花一次调用。
const app = R("app.js"), stu = R("study.js");
test("三处的 maxTokens 都放开了，而且写在一个地方、写清了为什么", () => {
  // ⚠️不许再有散落的小数字：改一处漏一处正是这个 app 反复犯的那一个
  [["擂台", dbt, /const TOK = \{ stance: 8000 \};/],
   ["一起学", stu, /const TOK = \{ turn: 12000, plan: 20000, quiz: 12000, small: 8000 \};/],
   ["论坛", app, /const FTOK = \{[\s\S]{0,420}floors: 14000,/]].forEach(function (row) {
    assert.match(row[1], row[2], row[0] + "：额度没有收在一个地方");
    assert.match(row[1], /思考预算是从 maxTokens 里扣的/, row[0] + "：没写清为什么，下一个人又会把它调回去省钱");
  });
  // 论坛十处全部改用那份表，一个散落的小数字都不许留
  assert.equal((app.match(/maxTokens: FTOK\./g) || []).length, 10, "论坛还有没接上那份表的");
  assert.equal((stu.match(/maxTokens: TOK\./g) || []).length, 8, "一起学还有没接上那份表的");
  // 擂台两处按人数算的，底要够厚
  assert.match(dbt, /const budget = Math\.min\(32000, 12000 \+ chars\.length \* 3000\);/, "台上那一轮是全场最长的一次输出，底给薄了会写一半停住");
  assert.match(dbt, /maxTokens: Math\.min\(24000, 10000 \+ chars\.length \* 1500\)/, "判词加每人一段感言，一次出，给紧了会断在感言中间");
  // 仓库铁律：这三个文件里不许再出现低于 6000 的 maxTokens
  [["擂台", dbt], ["一起学", stu]].forEach(function (row) {
    (row[1].match(/maxTokens: (\d+)/g) || []).forEach(function (m) {
      assert.ok(Number(m.split(" ")[1]) >= 6000, row[0] + "：又有一处低于 6000 —— " + m);
    });
  });
  // 一起学那个 6400 是【摘要字数上限】，不是 token，不许被一起改掉
  assert.match(stu, /\.slice\(0, 6400\)/, "把摘要的字数上限当成 token 一起改了");
});

// ===== v59.93 =====
// 她 2026-09-01：「宝宝字数这几个改了吧，你刚刚说的裁判加的话也加吧。
// 然后再加一个可以分享给角色，既然这个是可以多人的，那就群和单聊都可以分享吧」

// 人设按固定字数砍，正是 v55.87 群里王爷变霸总那个病：
// 只剩「一个古代王爷」这一个标签，空白由训练先验补上，那就是网文霸总。
// 擂台是【一次同时扮几个人】，最容易犯同一个病。
test("字数：人设不许再按固定字数砍，照群聊那套按在场人数分预算", () => {
  assert.match(dbt, /const personaFor = \(persona, n\) => \(typeof groupPersonaBudget === "function" && typeof groupPersonaText === "function"\)\s*\? groupPersonaText\(persona, groupPersonaBudget\(n\)\)/,
    "没有复用群聊那份预算表，又自己拍了一个数");
  // 三处吃人设的都要走它：分立场、上台发言、赛后感言
  assert.equal((dbt.match(/personaFor\(/g) || []).length, 3, "吃人设的三处（分立场／上台发言／赛后感言）没都走它");
  assert.ok(!/persona \|\| "（无设定）"\)\.slice\(0, 400\)/.test(dbt), "分立场那一处还在砍到 400 字");
  assert.ok(!/\.slice\(0, 500\) \+/.test(dbt), "上台发言那一处还在砍到 500 字");
  assert.ok(!/\.slice\(0, 120\) \+ "）"/.test(dbt), "赛后感言那一处还在砍到 120 字");
  // 实录窗口、世界书、注入的聊天也跟着放开——maxTokens 都给足了，判词就该看得见全场
  assert.match(dbt, /return lines\.join\("\\n"\)\.slice\(-24000\);/, "全场实录窗口太窄，判词看不全");
  assert.match(dbt, /return lines\.join\("\\n"\)\.slice\(-12000\);/, "前几回合的实录窗口太窄");
  assert.equal((dbt.match(/worldbook\.trim\(\)\.slice\(0, 6000\)/g) || []).length, 2, "世界书还在砍到几百字");
  assert.match(dbt, /\(m\.role === "user" \? uName : charName\) \+ "：" \+ String\(m\.content\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, 400\)/, "注入的那几句聊天还砍在 80 字");
  // 塔罗和同人文那两处反应也放开（上一版点名剩下的）
  const tarot = app.slice(app.indexOf("const forwardTarotToChat = async (session) => {"), app.indexOf("const forwardFicToGroup"));
  assert.match(tarot, /maxTokens: 8000 \}\);/, "塔罗那条反应还卡在 900");
  assert.match(app, /schemaHint: "\{\\"say\\":\[\\"气泡1\\"\]\}", maxTokens: 8000/, "同人文新章那条反应还卡在 700");
});

// 只写「谁赢了」的话，这一场吵完什么都没留下。
test("裁判多答两栏：他们其实在吵的是什么、最狠的那一句", () => {
  const i = dbt.indexOf("async function genResult(");
  const src = dbt.slice(i, dbt.indexOf("\n  }", i));
  assert.match(src, /crux：这一场他们【真正】在吵的是什么/);
  assert.match(src, /⚠不是把辩题复述一遍/, "不点破的话它只会把题目抄一遍");
  assert.match(src, /best：全场最狠的那一句/);
  assert.match(src, /【逐字照抄】某个人真的说过的一句/);
  assert.match(src, /\\"crux\\":\\"他们其实在吵的那件事\\",\\"best\\":\{\\"name\\"/, "输出形状里没有这两栏");
  // ⚠️代码这一道：引的必须是台上真说过的话，对不上就整块丢掉
  assert.match(src, /said\.some\(function \(x\) \{ return x\.indexOf\(bq\) >= 0; \}\)/,
    "没核对原句——裁判会「引用」一句自己顺手改写过的，那就成了替选手编台词");
  assert.match(src, /: null;/);
  // 存进存档，不然刷新就没了
  assert.match(dbt, /verdict: \{ winner: r\.winner, reason: r\.reason, crux: r\.crux, best: r\.best \}/);
  // 记分牌上要显示，而且那一句要看得出是【谁说过的话】不是裁判的话
  assert.match(dbt, /"他们其实在吵的是"/);
  assert.match(dbt, /"最狠的那一句"/);
  assert.match(dbt, /borderLeft: "2px solid #f0c67a"[\s\S]{0,140}s\.verdict\.best\.quote/, "那一句没跟裁判自己的话分开");
});

test("分享：单聊和群聊都能发；发的是纯文本，不另起一种卡片", () => {
  // app 侧：两条路 + 一份共用的正文
  assert.match(app, /const arenaShareText = \(session\) =>/);
  assert.match(app, /const shareArenaToChat = \(session, toChar\) =>[\s\S]{0,220}pChat\(toChar\.id/);
  assert.match(app, /const shareArenaToGroup = \(session, group\) =>[\s\S]{0,240}pGChat\(group\.id/);
  // ⚠️群里那条必须带 senderName，否则群里认不出是谁发的
  assert.match(app, /pGChat\(group\.id, p => \[\.\.\.p, \{ role: "user", senderName: profile\.name \|\| "我"/);
  // 正文里要带上判词那三栏，转过去才是完整的一场
  assert.match(app, /v\.crux \? "\\n【他们其实在吵的是】" \+ v\.crux : ""/);
  assert.match(app, /v\.best && v\.best\.quote \? "\\n【最狠的那一句】"/);
  assert.match(app, /"\\n\\n（还没收台）"/, "没收台就分享的话，得说清这是半场");
  // 接线：groups 和两个回调都传下去了
  assert.match(app, /groups: groups,[\s\S]{0,200}onShareToChat: shareArenaToChat,\n\s*onShareToGroup: shareArenaToGroup,/);
  assert.match(dbt, /groups: props\.groups,[\s\S]{0,120}onShareToChat: props\.onShareToChat, onShareToGroup: props\.onShareToGroup,/);
  // 面板：居中框，不是半窗（no-half-sheet.md）
  assert.match(dbt, /const sharePanel = shareOpen && typeof CenterCard === "function" \? h\(CenterCard/);
  assert.ok(dbt.indexOf("items-end") < 0, "分享面板又掀成半窗了");
  assert.match(dbt, /"把这一场发给谁"/);
  assert.match(dbt, /\(props\.groups \|\| \[\]\)\.length \? h\("div"[\s\S]{0,180}"群 聊"/, "群聊那一档没列出来");
  // 一句话都还没说的时候不该有分享键
  // v59.97 起这一判走 spoke()——「牌子要不要收上去」和「有没有东西可分享」问的是同一件事
  assert.match(dbt, /const hasSomething = spoke\(s\);/);
  assert.match(dbt, /return \(\(\(sess && sess\.rounds\) \|\| \[\]\)\)\.some\(function \(r\) \{ return \(r\.turns \|\| \[\]\)\.some\(function \(x\) \{ return x && !x\.skipped && x\.text; \}\); \}\);/);
  assert.match(dbt, /hasSomething \? h\("button", \{ onClick: function \(\) \{ setShareOpen\(true\); \}/);
  // NPC 没有聊天窗口，转不过去
  // ⚠️只看分享面板这一段：这条滤在面板里出现两次（列名单 + 判空），
  //   笼统 match 一下的话，把列名单那一处的滤撤掉照样绿
  const pi = dbt.indexOf("const sharePanel = shareOpen");
  const panel = dbt.slice(pi, dbt.indexOf("\n    return h(\"div\", { className: \"h-full flex flex-col\" },", pi));
  assert.equal((panel.match(/\(props\.characters \|\| \[\]\)\.filter\(function \(c\) \{ return c && !c\.npc; \}\)/g) || []).length, 2,
    "配角（npc）没有自己的聊天窗口，转不过去，两处都得滤掉");
});

// ===== v59.94 =====
// 她 2026-09-01 截图：「这个返回键又太上了」——返回键和右边那两颗牌直接压在时钟和电量上。
// 病根：擂台的顶栏是【手写的】，只写了 pt-4＝16px，没吃刘海。
// 全 app 别的顶栏都走 Head（里面有 safeTop(20)），只有这一处自己写了一份。
test("擂台顶栏自己吃刘海，返回键还要点得着", () => {
  const i = dbt.indexOf('h("div", { className: "shrink-0", style: { background: t.bg } },');
  // 注释里要留着病因（那句话里就有 pt-4），所以只看活着的代码
  const hdr = dbt.slice(i, dbt.indexOf("stage),", i)).split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(hdr.indexOf("pt-4") < 0, "顶栏又只写了 pt-4，在刘海屏上让不开");
  assert.match(hdr, /className: "flex items-center justify-between px-4 pb-2", style: \{ paddingTop: safeTop\(10\) \}/,
    "顶栏没用公共 safeTop 吃刘海（mobile-ui-layout §1）");
  // ⚠️返回键得有 40×40 的可点区：一个 19px 的图标点不着
  assert.match(hdr, /"aria-label": "返回", className: "active:opacity-50 flex items-center justify-center", style: \{ width: 40, height: 40, marginLeft: -8 \}/,
    "返回键还是一个光秃秃的 19px 图标");
});

// 一层写在两处，第二处没跟上——v59.90 改名时「结束判定」有两颗键，只换了一颗。
test("每一颗收台键的字都要一样（v59.99 起有三颗：旁观局那颗、没生成完那颗、已完成那颗）", () => {
  assert.equal((dbt.match(/"收台判胜负"/g) || []).length, 3, "有一颗收台键的字跟别的不一样");
  const live = dbt.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(live.indexOf("结束判定") < 0, "还有一颗键留着旧名字");
});

// ===== v59.97 =====
// 她 2026-09-01 截图（四个人那一局）：「显示不出来他们全部立场，
// 而且占位太多看不到实际擂台了嘤」。
// 两件其实是同一件：立场牌【常驻】在顶上——长立场必须锁行数才不撑爆屏（＝看不全），
// 锁了行数它还占掉大半屏（＝看不见台上）。真实的台子本来就不是这样：
// 牌子开场放下来给你看一眼，看完就收上去，你才好看戏。
test("立场牌会收起来：放下来时不锁行数，收起来时只占一条", () => {
  const i = dbt.indexOf("const HEAD_H = stageOpen");
  const st = dbt.slice(i, dbt.indexOf("\n\n    // ── 发言", i));
  // ⚠️放下来的时候【不许锁行数】——锁了就是「看不全」
  assert.ok(st.indexOf("WebkitLineClamp") < 0, "立场牌又锁行数了，长立场还是看不全");
  assert.match(st, /stageOpen \? null : \{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" \}/,
    "收起来那一档没有收成一条");
  // 台子整体跟着缩：头像那一段和挂绳都要变矮，不然「收起来」省不下多少
  assert.match(dbt, /const HEAD_H = stageOpen \? 50 : 42;/);
  assert.match(dbt, /const AV = stageOpen \? 29 : 24;/);
  assert.match(st, /height: stageOpen \? 7 : 4/);
  // 人一多要能挤：写死 width 的话四个人就撑出屏幕
  assert.match(st, /flex: "1 1 0", minWidth: 0, maxWidth: 104/, "列宽写死了，人一多就撑出去");
  assert.ok(st.indexOf("width: 98,") < 0, "还留着写死的列宽");
  // 把手
  assert.match(st, /stageOpen \? "把牌子收上去 ▲" : "各人站哪边 ▼"/);
  assert.match(st, /minHeight: 26/, "把手点不着");
});

test("默认：还没人开口就放下来，台上一开口就自己收上去；她动过手就不再替她动", () => {
  // 「台上有没有人开过口」只写一处，两边共用
  assert.match(dbt, /const spoke = function \(sess\) \{/);
  assert.equal((dbt.match(/spoke\(/g) || []).length, 2, "spoke() 的调用处不是两处（收牌子那一处 + 分享键那一处）");
  // 那句判断只许写一遍
  assert.equal((dbt.match(/x && !x\.skipped && x\.text/g) || []).length, 1, "「有没有人开过口」又写了第二遍");
  assert.match(dbt, /const \[stageOpen, setStageOpen\] = useState\(function \(\) \{ return !spoke\(props\.session\); \}\);/,
    "新开一局默认没把牌子放下来——那正是要看谁站哪边的时候");
  assert.match(dbt, /useEffect\(function \(\) \{ if \(!stageTouched\.current && hasSomething\) setStageOpen\(false\); \}, \[hasSomething\]\);/,
    "第一句话落下来之后牌子不会自己收——新开一局从头到尾还是占掉那半屏");
  assert.match(dbt, /stageTouched\.current = true; setStageOpen/, "她自己收放过之后，代码还会跟她抢");
});

// ===== v59.98 =====
// 她 2026-09-01：「言秋的也给足吧，不用担心，不然他也不够思考的。
// 然后擂台这个生成角色评论喊话也把他摘了。」
test("言秋那一支也给足了（她亲口点名放开的）", () => {
  const app2 = R("app.js");
  assert.ok(app2.indexOf("_engineerChat ? 3000") < 0, "言秋那一支还卡在 3000，他想完就没配额说话");
  assert.equal((app2.match(/maxTokens: 14000, cacheHistory: _histCache/g) || []).length, 2,
    "主聊天首发和重试两处没都给足");
  const rule = fs.readFileSync(path.join(__dirname, "..", ".claude", "rules", "max-tokens-floor.md"), "utf8");
  assert.ok(rule.indexOf("那个 3000 是言秋本人的通道，一个字不许动") < 0,
    "规矩里那条例外没撤掉——撤掉东西要删除，不是在后面补一句它作废了");
  assert.match(rule, /言秋那一支也给足/, "没写清这条是她亲口点名放开的");
});

// v60.21 不再自动抓任何角色去台下编评论；她自己挑谁上台，谁才会进模型。
test("上台的人只认她亲手挑的名单，不再另抓角色去台下编评论", () => {
  const app2 = R("app.js");
  // ⚠️只看擂台那一段：别的 app 的挂载也写着 characters: liveChars，拿整份 app.js 找会被它们顶住
  const mi = app2.indexOf('else if (screen === "debate") body = h(Debate, {');
  const mount = app2.slice(mi, app2.indexOf("onBack:", mi));
  assert.match(mount, /characters: liveChars,/, "characters 那份被滤了——存档里已有的头像会变成无名氏");
  // v60.41：场边名单回来了，但它只喂【场边】那一层；上台仍是她一个一个挑的
  assert.match(mount, /crowdChars: liveChars\.filter\(c => !settingsFor\(c\.id\)\.engineerEyes && !c\.npc\)/,
    "场边名单要滤掉言秋和配角（v59.99：言秋可以上台，但不当看客）");
  // 上台那一栏走全的（她自己一个一个挑）
  assert.match(dbt, /const chars = picked\.map\(id => props\.characters\.find\(c => c\.id === id\)\)/, "上台那一栏又被滤了");
  assert.match(dbt, /props\.characters\.map\(c => \{/, "上台的人那份名单又被滤了");
  // 分享那一栏照旧列他
  const pi = dbt.indexOf("const sharePanel = shareOpen");
  const panel = dbt.slice(pi, dbt.indexOf("\n    return h(\"div\", { className: \"h-full flex flex-col\" },", pi));
  assert.ok(panel.indexOf("crowdChars") < 0, "分享名单不该再认已经废掉的台下名单");
  // v60.41：crowdChars 回来了，但它【只】喂场边那一层——
  //   Root 往下传两处 + Arena 里算 bench 那一处，就这三处；
  //   出现在上台名单或分享名单里就说明它又被当成「自动抓人」用了。
  assert.equal((dbt.match(/crowdChars/g) || []).length, 3,
    "只该出现在【往 Arena 传一次】和【算 bench 那一处】；Setup 用不到，传了就是死参数");
  assert.match(dbt, /bench: \(props\.crowdChars \|\| \[\]\)\.filter/, "场边名单没接上");
  assert.match(dbt, /!orderedChars\.some\(function \(x\) \{ return String\(x\.id\) === String\(c\.id\); \}\)/,
    "上台的人不该同时又在场边看着自己");
});

// 她 2026-09-01：「擂台再加一个把我去除的功能纯看他们吵」
test("旁观局：她不上台，一按就让他们吵，没有「先等你开口」这一步", () => {
  // 开关 + 拦法
  assert.match(dbt, /const \[watchOnly, setWatchOnly\] = useState\(false\)/);
  assert.match(dbt, /"我不上台，纯看他们吵"/);
  assert.match(dbt, /if \(watchOnly && picked\.length < 2\)[\s\S]{0,120}"你不上台的话，台上得有两个人才吵得起来"/,
    "开了旁观还只拉一个人，就没得吵了");
  // 存进存档：台上没有「我」这一位，也就不用选边
  assert.match(dbt, /spectate: watch,\n(?:\s*\w+: [^\n]*\n)*\s*parts: watch \? parts : \[me\]\.concat\(parts\), order: order,\n\s*myOptions: watch \? \[\] : assigned\.myOptions, mySet: watch,/);
  // 回合流程：没有「我先说」这一步
  assert.match(dbt, /const watch = !!s\.spectate;/);
  assert.match(dbt, /const myTurnNow = !watch && s\.mySet && !roundMyDone\(cr\);/, "旁观局还在等她先开口");
  assert.match(dbt, /const needGen = \(watch \|\| roundMyDone\(cr\)\) && !roundGen\(cr\);/);
  assert.match(dbt, /\(watch && needGen\) \? h\("div"[\s\S]{0,700}roundNo === 1 \? "开吵 →" : "让他们接着吵 →"/, "旁观局底下那颗键不对");
  // 提示词：她只旁观，别对着她说话
  assert.match(dbt, /o\.watch\s*\? "\\n\\n【旁观局】"/, "旁观局还在跟他们说「她刚说了什么」");
  assert.match(dbt, /别对着她说话、别问她怎么看，也别等她表态/);
  assert.match(dbt, /focus: prior && prior\.focus, watch: watch/, "watch 没传进这一轮的生成");
  // 判词：这一场她没上台，不许判她赢
  assert.match(dbt, /session\.spectate \? "只在台上这几位里判——「" \+ uName \+ "」这一场没上台，不许判她赢"/);
  // 重试那一路也得知道这是旁观局（本来就没有我这一句）
  assert.match(dbt, /runGen\(t2 && !t2\.skipped \? t2\.text : "", !!\(watch \|\| \(t2 && t2\.skipped\)\)\)/);
});

// 她 2026-09-02：「这个顾朝怎么就叫我小姑娘了」——场边那位管她叫「人家小姑娘」。
// 病根：整场只发了她一个【名字】，没有人设，也没有一句话说过「这些人都认识她」。
// 场边那几位更是只拿到一个名字，开口只能把她当路过的第三方。
test("擂台得说清她是谁，而且在场每个人都认识她", () => {
  const i = dbt.indexOf("async function genRound(");
  const gen = dbt.slice(i, dbt.indexOf("async function genResult", i));
  assert.match(gen, /【和你们吵的这个人】/, "整场还是只发了她一个名字");
  assert.match(gen, /o\.mePersona/, "她的人设没发进去");
  assert.match(gen, /台上台下【每一个人都认识她】，她不是路过的陌生人/);
  assert.match(gen, /绝不许把她说成第三方路人/);
  assert.match(gen, /「那姑娘」「小姑娘」/, "得把最容易滑进去的那几个说法点出来");
  // 判据不是「要礼貌」，是【那个称呼本身就该看得出你俩什么关系】
  assert.match(gen, /用你自己平时叫她的那个称呼/);
  assert.match(dbt, /mePersona: String\(\(props\.profile && props\.profile\.persona\) \|\| ""\)/, "没接上");
  // 场边那几位也得知道自己平时怎么跟她说话，不然只有一个名字
  assert.match(gen, /平时跟 " \+ uName \+ " 是这么说话的，照这个口气来/);
  assert.match(dbt, /injection: s\.inject \? recentChatSnippet\(c\.id, uName, c\.name\) : ""/, "场边那份没接上");
  assert.match(dbt, /inject: inject,/, "开关没存进存档，老局重开就丢了");
  // 台上那份长、场边那份短：他是配角，不值当占那么多
  assert.match(gen, /\.slice\(-300\)/, "场边那份没收着给");
});
