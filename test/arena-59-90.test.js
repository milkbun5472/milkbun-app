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
