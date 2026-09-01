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
  assert.match(dbt, /const HEAD_H = 50;/, "台面那条线没有一个固定的高度，几个人就会各站各的高度");
  assert.match(src, /top: HEAD_H, bottom: 0[\s\S]{0,180}borderTop: "3px solid " \+ t\.ink/, "没有台面那条线／台裙");
  assert.match(src, /boxShadow: "0 5px 9px -6px rgba\(38,34,28,\.85\)"/, "台面底下没有影子，就只是一条分割线");
  assert.match(src, /width: 1, height: 7, background: p\.color/, "立场牌没有挂绳，它是浮着的不是挂着的");
  assert.match(src, /WebkitLineClamp: 4/, "立场牌没锁行数，长短不一会把台面撑得参差");
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

test("台下：一片黑压压的后脑勺，喊声从不同位置冒出来，不是一份名单", () => {
  const i = dbt.indexOf("const audienceBlock = function (crowd, k) {");
  const src = dbt.slice(i, dbt.indexOf("\n    };", i));
  assert.match(src, /radial-gradient\(circle at 9px 12px, rgba\(255,255,255,\.085\) 8px, transparent 8\.5px\)/, "没有那一排后脑勺");
  assert.match(src, /marginLeft: CROWD_IN\[i % CROWD_IN\.length\]/, "每条都顶格，还是一份名单");
  // ⚠️缩进表必须是定死的：用 Math.random 的话每次重画位置都会跳
  assert.match(dbt, /const CROWD_IN = \[0, 15, 30, 8, 22, 0, 34, 12, 26, 4\];/);
  assert.ok(src.indexOf("Math.random") < 0, "缩进用了随机数，重画一次弹幕就会自己跳位置");
  assert.match(src, /"台 下 · " \+ crowd\.length \+ " 个人在喊"/);
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
  assert.match(dbt, /const budget = Math\.min\(32000, 12000 \+ chars\.length \* 3000 \+ o\.count \* 300\);/, "台上那一轮是全场最长的一次输出，底给薄了会写一半停住");
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
  assert.match(dbt, /const hasSomething = \(s\.rounds \|\| \[\]\)\.some\(function \(r\) \{ return \(r\.turns \|\| \[\]\)\.some\(function \(x\) \{ return x && !x\.skipped && x\.text; \}\); \}\);/);
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
test("两颗收台键的字要一样（本轮没生成完那颗、和本轮已完成那颗）", () => {
  assert.equal((dbt.match(/"收台判胜负"/g) || []).length, 2, "两颗收台键的字不一样");
  const live = dbt.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(live.indexOf("结束判定") < 0, "还有一颗键留着旧名字");
});
