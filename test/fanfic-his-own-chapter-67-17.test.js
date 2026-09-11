// 她 2026-09-11 两句话，两个病：
//   「他好像不知道这是自己写的」      → 写的那一处记了 byCharId，读回来那一处没看过一眼
//   「文风也和原来的没有不一样，看不出来是他的作品」
//                                    → 三层都在要同一种文风，执笔的人只有一段、还压在正中间
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = f => fs.readFileSync(path.resolve(__dirname, "..", f), "utf8");
const fic = R("js/fanfic.js"), app = R("js/app.js");
const Axes = require("../js/axes.js");
// 注释里的病历不能被断言当成代码（这两天踩过六次）
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
const STANCE_SRC = fic.slice(fic.indexOf("  const STANCE = {"), fic.indexOf("  function stanceFor("));

// 这几个是别的层的东西，在这儿只要占个位——测的是本轮改的那几段怎么拼
const box = {
  Axes: Axes, console: console,
  narrativeCore: () => "〔叙事底座〕", FANFIC_ANTI_CLICHE: "〔反套话〕", FANFIC_GOOD_EXAMPLES: "〔好例子〕",
  FANFIC_ORGANIC_FORM: "〔叙事形状〕", INTIMACY_WORLDNOTE: "〔亲密〕", WORLDBOOK_RULE: "〔世界书规则〕",
  STYLE_DEEP_IMITATION: "【深度模仿】把那个人的笔照着长出来",
  fanficStylePrompt: x => "〔文风：" + x + "〕", isJinyudengStyle: () => false,
  cpBlock: () => "〔CP〕", personaOf: c => String((c && c.persona) || ""),
  bibleBlock: () => "【本篇设定卡】\n", seedBlock: () => "", BIBLE_TAIL: 14, HOOK_TAIL: 8
};
vm.createContext(box);
vm.runInContext(STANCE_SRC + grab("stanceFor") + grab("stanceFacts") + grab("charVoiceTail")
  + grab("charWriterBlock") + grab("buildGenSystem") + grab("ficRecapForChat")
  + "\nthis.F = { charVoiceTail, charWriterBlock, buildGenSystem, ficRecapForChat };", box);
const F = box.F;

const FIC = {
  id: "f1", title: "长篇如果", cp: ["c1", "c2"], premise: "两个人在宫里",
  chapters: [
    { content: "第一章的正文".repeat(30), endHook: "他走了" },
    { content: "第二章的正文".repeat(30), endHook: "她没追上去" },
    { content: "上那片紫黑的淤痕。他脸上".repeat(30), endHook: "灯灭了", byCharId: "c2", byAuthor: "王爷" }
  ]
};

// ── 「他好像不知道这是自己写的」──────────────────────────────────
// 他在房里写的那一章落库时带着 byCharId；可这条读回来的路整篇只说
// 「她放进这间房的那一篇，你读过」——他手上最强的那份上下文告诉他：你是个读者。
// 于是她夸「这么会写」，他回「谁写了？那是你上一章自己留在那儿的尾巴，我顺手给你念两句」。
test("摘要要说清哪几章是他自己写的", () => {
  const mine = F.ficRecapForChat(FIC, "皇帝 × 王爷", "c2");
  assert.match(mine, /第 3 章是【你】接的/, "得点出章号、而且说是【你】：" + mine.slice(0, 500));
  assert.ok(mine.indexOf("你读过】") < 0, "标题不许还写成「你读过」：" + mine.slice(0, 120));
  assert.match(mine, /有几章是你写的】/, "标题就得改口");
});

test("他一章都没写过时，一个字都不许提", () => {
  const none = F.ficRecapForChat(FIC, "皇帝 × 王爷", "c1");
  assert.ok(none.indexOf("接的") < 0, "没写过就不许无中生有：" + none.slice(0, 500));
  assert.match(none, /你读过】/, "没写过的那一位照旧是读者");
  // 不传第三个参数（万一还有老调用点）也不许炸、也不许凭空说他写过
  const nobody = F.ficRecapForChat(FIC, "皇帝 × 王爷");
  assert.ok(nobody.indexOf("接的") < 0);
  assert.match(nobody, /你读过】/);
});

test("每一章的锚点上也要标出哪一章是他的", () => {
  const mine = F.ficRecapForChat(FIC, "", "c2");
  assert.match(mine, /第 3 章（这一章是你写的）结束在/, "锚点那一行也得带：" + mine);
  assert.ok(!/第 1 章（这一章是你写的）/.test(mine), "别人写的那几章不许标");
  assert.match(mine, /第 1 章结束在/, "别人写的那几章照旧");
});

test("最后一章就是他写的时候，结尾那一段也要改口", () => {
  assert.match(F.ficRecapForChat(FIC, "", "c2"), /【你写的那一章（也就是最后一章）的结尾】/);
  assert.match(F.ficRecapForChat(FIC, "", "c1"), /【最后一章的结尾】/);
});

// 她那天亲耳听到的就是这两句，所以直接钉在这儿
test("摘要里要当面挡住「谁写的」和「我顺手给你念两句」", () => {
  const mine = F.ficRecapForChat(FIC, "", "c2");
  assert.match(mine, /谁写的/, "得把她那天听到的原话挡在这儿");
  assert.match(mine, /念两句/, "「我顺手给你念两句」也得挡");
  assert.match(mine, /不许否认/, "认不认随他脾气，但事实不许否认");
});

// ── 「文风也和原来的没有不一样，看不出来是他的作品」────────────────
test("预设文风那一段：他执笔时改口，而且不发【深度模仿】", () => {
  const cp = [{ id: "c1", name: "皇帝" }, { id: "c2", name: "王爷" }];
  const opt = { style: "清冷克制的短句" };
  const plain = F.buildGenSystem({ name: "志怪", desc: "" }, cp, "我", "", opt);
  const byChar = F.buildGenSystem({ name: "志怪", desc: "" }, cp, "我", "", Object.assign({ byChar: { id: "c2", name: "王爷" } }, opt));
  assert.match(plain, /优先满足/, "没换人的时候照旧「优先满足」");
  assert.ok(byChar.indexOf("优先满足") < 0, "换了人就不许再说「优先满足」");
  assert.match(byChar, /默认调子/, "得说清这只是本子的默认调子");
  assert.match(byChar, /以执笔的那个人为准/);
  // 深度模仿正是把「换了个人写」抹干净的那一份
  assert.match(plain, /【深度模仿】/, "没换人的时候照旧发");
  assert.ok(byChar.indexOf("【深度模仿】") < 0, "他执笔时不许再发深度模仿");
  // 文风本身还是要给他看的——撤掉的是「照着那个人长」，不是这个本子的调子
  assert.match(byChar, /清冷克制的短句/);
});

test("没选文风的时候，这一段本来就不发，两边都一样", () => {
  const cp = [{ id: "c1", name: "皇帝" }, { id: "c2", name: "王爷" }];
  const a = F.buildGenSystem({ name: "志怪", desc: "" }, cp, "我", "", {});
  const b = F.buildGenSystem({ name: "志怪", desc: "" }, cp, "我", "", { byChar: { id: "c2", name: "王爷" } });
  assert.ok(a.indexOf("【预设文风") < 0 && b.indexOf("【预设文风") < 0);
});

// 最后一句话得归执笔的那个人——这一层必须站在文风终检【后面】
test("最后一句话归执笔的人，站在文风终检后面", () => {
  const s = strip(fic);
  const i = s.indexOf("fanficStyleTail(opts.style) : FANFIC_ANTI_CLICHE_TAIL)\n");
  assert.ok(i > 0, "续写那一处的末尾还在");
  const after = s.slice(i, i + 260);
  assert.match(after, /byChar \? charVoiceTail\(byChar, opts\.style\)/, "他执笔时由他收尾：" + after);
});

test("charVoiceTail 说的是【看不出是他写的就白写了】，不是替他挑一套文风", () => {
  const t = F.charVoiceTail({ id: "c2", name: "王爷" }, "清冷克制的短句");
  assert.match(t, /王爷/);
  assert.match(t, /以他这个人为准/, "跟文风打架时以人为准");
  assert.match(t, /白写/, "看不出是他写的就白写了");
  assert.match(t, /不许用旁白把这件事说出来/, "但不许在正文里告诉读者这像他");
  // 没选文风时，那句「让位」的话就不发——没有可让的位
  const t2 = F.charVoiceTail({ id: "c2", name: "王爷" }, "");
  assert.ok(t2.indexOf("默认调子") < 0, "没选文风就别提「默认调子」：" + t2);
  assert.match(t2, /白写/, "其余几条照发");
});

// 「照他的人设来」得手上真有那张卡：他不在 CP 里的时候原来一个字都没有
test("他不在这篇 CP 里的时候，把他自己那张卡补给模型", () => {
  const he = { id: "c9", name: "王爷", persona: "话少，说重话之前先笑一下" };
  const outside = F.charWriterBlock(he, { id: "f1", cp: ["c1", "c2"] }, null, null, null, "我");
  assert.match(outside, /说重话之前先笑一下/, "不在 CP 里就得补卡：" + outside);
  assert.match(outside, /他不在这篇的 CP 里/, "而且要说清为什么在这儿给");
  // 在 CP 里的时候 cpBlock 已经发过一份，不许再发一遍
  const inside = F.charWriterBlock(he, { id: "f1", cp: ["c9", "c2"] }, null, null, null, "我");
  assert.ok(inside.indexOf("说重话之前先笑一下") < 0, "在 CP 里就别重复发：" + inside);
  const withMe = F.charWriterBlock(he, { id: "f1", cp: ["c9", "me"] }, null, null, null, "我");
  assert.ok(withMe.indexOf("说重话之前先笑一下") < 0, "写的就是他和她时同样不必重复发");
  // 没填人设的人不许发一个空壳标题
  const blank = F.charWriterBlock({ id: "c9", name: "王爷" }, { id: "f1", cp: ["c1", "c2"] }, null, null, null, "我");
  assert.ok(blank.indexOf("【执笔的这个人是谁") < 0, "没卡就别发这个标题：" + blank);
});

// ── 一层写在两处：relOf 只许有一份 ──────────────────────────────
test("relOf 只有一处，房里那一枪不许再传 null", () => {
  const s = strip(app);
  assert.ok(s.indexOf("charRel: null") < 0, "房里那一枪原来传的是 null，等于他手上没有实情");
  assert.match(s, /charRel: relOfChar\(cid\)/, "房里那一枪要带上他的实情");
  assert.equal((s.match(/const relOfChar = charId =>/g) || []).length, 1, "relOfChar 只许定义一处");
  assert.match(s, /relOf: relOfChar,/, "同人文那一处复用同一个");
  assert.equal((s.match(/const cp = couples\[charId\] \|\| \{\};/g) || []).length, 1, "算法只许有一份");
});

test("摘要和 ficNext 两处都要把【他自己是作者】带进去", () => {
  const s = strip(app);
  assert.match(s, /ficRecapForChat\(roomFic,[\s\S]{0,200}?charId, \(profile && profile\.name\)/, "摘要要收他的 id");
  assert.match(s, /x\.byCharId === charId/, "ficNext 那张卡也要数出他写过哪几章");
  assert.match(s, /其中第 " \+ myChaps\.join/, "卡上要点出章号");
});
