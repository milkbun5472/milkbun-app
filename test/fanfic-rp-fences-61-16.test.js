// 她 2026-09-03：「穿书这块是不是没有喂禁八股那一堆，一堆八股。还有『生成降落节点』
// 也改一下。然后生成穿书的时候也给作者一个迷你人设吧用于她吐槽的语气。
// 然后宝宝格式会掉，那一大块穿书中的标题也没弄掉」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const fic = fs.readFileSync(path.join(root, "js/fanfic.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const rule = fs.readFileSync(path.join(root, ".claude/rules/four-surfaces-same-context.md"), "utf8");

// 穿书那条链抠出来真跑（parseJSONLoose 照 engine.js 里真的那两个函数来）
const F = (() => {
  const a = fic.indexOf("  const RP_WINDOW_CHARS = 9000;");
  const b = fic.indexOf("\n  // 编个热度数字");
  assert.ok(a > 0 && b > a, "抠不出穿书引擎");
  // ⚠️桩必须是【真的】那两个：extractJSON 不管裸换行，parseJSONLoose 才管。
  //   桩写成一样的话，这一版修的那个病压根测不出来。
  const ea = eng.indexOf("function escapeJsonStringControls("), eb = eng.indexOf("\nfunction parseJSONLoose(");
  const pa = eng.indexOf("function parseJSONLoose("), pb = eng.indexOf("\nfunction extractJSON(");
  const xa = eng.indexOf("function extractJSON(");
  assert.ok(ea > 0 && pa > 0 && xa > 0, "engine.js 里那几个解析函数找不到了");
  const xb = eng.indexOf("\nfunction ", xa + 10);
  const helpers = eng.slice(ea, eb) + "\n" + eng.slice(pa, pb) + "\n" + eng.slice(xa, xb);
  // ⚠️extractJSON 内部会调 repairJSON（截断兜底），所以它也得是真的那一个
  const ra = eng.indexOf("function repairJSON(");
  assert.ok(ra > 0, "engine.js 里 repairJSON 找不到了");
  const rb = eng.indexOf("\nfunction ", ra + 10);
  return new Function("ficPenName", "ficHeat", "uid", "callAI", "buildRPSystem", "rpAnchorLine",
    eng.slice(ra, rb) + "\n" + helpers + "\n" + fic.slice(a, b) + "\nreturn {rpParseTurn, rpSalvage, rpJSON};")(
    i => "笔名", () => ({}), p => p, async () => "", () => "", () => "");
})();

// ── ① 反八股那一堆：穿书是第六处 ──────────────────────────────
test("穿书补上了别处一条条 push 进去的那几条", () => {
  const seg = fic.slice(fic.indexOf("function buildRPSystem("), fic.indexOf("  // 生成可选降落节点"));
  assert.ok(seg.length > 500, "抠不出 buildRPSystem");
  // narrativeCore 白送的那几层照旧
  assert.match(seg, /narrativeCore\(\{ intimate: true \}\)/);
  assert.match(seg, /FANFIC_ANTI_CLICHE/);
  // 这几条以前一条都没有
  [["ContentBoundaries.prompt", "内容边界"], ["CONDESCENDING_TONE_BAN", "居高临下的训话腔"],
   ["REGISTER_FOLLOWS_SCENE", "语域跟场面走"], ["STOCK_REPLY_BAN", "标准男友三件套"],
   ["ECHO_QUESTION_BAN", "回声式反问"], ["ReplyPacing.reading()", "读懂这句话在做什么"]].forEach(([k, zh]) =>
    assert.ok(seg.indexOf(k) > 0, "穿书还是没吃到「" + zh + "」（" + k + "）"));
  // 全都要挡一道 typeof：这几个常量住在 engine.js，加载顺序变了不许整页白屏
  ["ContentBoundaries", "CONDESCENDING_TONE_BAN", "REGISTER_FOLLOWS_SCENE", "STOCK_REPLY_BAN", "ECHO_QUESTION_BAN", "ReplyPacing"].forEach(k =>
    assert.ok(seg.indexOf('typeof ' + k + ' !== "undefined"') > 0, k + " 没挡 typeof"));
});

test("那张名单上补了穿书，不然下一个人照样漏", () => {
  // 病因和 v60.27 通话那次一字不差：它当初就没在名单上，
  // 于是「五处都接上了」每次都是真的。
  // 别钉总数（每补一处就变一次）；钉的是穿书在不在名单上
  assert.match(rule, /名单是【[一二三四五六七八九十]+处】[^\n]*穿书/);
  assert.match(rule, /\*\*穿书\*\*/);
  assert.match(rule, /穿书是第六处/);
  assert.match(rule, /反八股那一堆不是记忆，是文风地板/, "没写清沙盒身份为什么不能当理由");
  assert.match(rule, /先问\*\*这一处是靠什么把这层拿到手的\*\*/, "没写清那条判据");
});

// ── ② 格式会掉 ────────────────────────────────────────────────
test("scene 里的裸换行不再让整串 JSON 糊到她眼前", () => {
  // 她截图里正文直接从 `{"scene":"药片落在…` 开始。
  // scene 是分段正文，段与段之间必然有真换行——那在 JSON 里非法，
  // extractJSON 每次都失败，而兜底是「整段当正文」。
  const bad = '{"scene":"第一段。\n\n第二段。\n\n第三段。","hit":"b2","dev":41,"note":"这句不是我写的"}';
  const r = F.rpParseTurn(bad);
  assert.doesNotMatch(r.text, /^\{|"scene"/, "还是把一串 JSON 当正文端上去了");
  assert.equal(r.text.split("\n\n").length, 3, "段落被压平了");
  assert.equal(r.hit, "b2"); assert.equal(r.dev, 41); assert.equal(r.note, "这句不是我写的");
  // 解析走的必须是 parseJSONLoose，不是光板的 extractJSON
  assert.match(fic, /if \(typeof parseJSONLoose === "function"\) \{ const d = parseJSONLoose\(txt\); /);
});

// parseJSONLoose 挡不住的就这几种（裸换行和截断它自己能治，所以那两条不算数）——
// 一串 JSON 糊到她眼前，就是从这几种里漏出来的。
const BROKEN = {
  "正文里没转义的引号": '{"scene":"他说"走"，然后走了。\n\n她没动。","hit":""}',
  "键名没加引号": '{scene:"一段。\n\n二段。"}',
  "用了单引号": "{'scene':'一段。\n\n二段。'}",
  "一口气两个对象": '{"scene":"三更的梆子刚敲过。"}\n{"scene":"后半夜下起雪。"}',
  "整份被截断": '{"scene":"他说「还不走？」\n\n你没答话。\n\n后半夜'
};
test("解析不出来的那几种，也不许把一串 JSON 端上去", () => {
  Object.keys(BROKEN).forEach(k => {
    const txt = F.rpParseTurn(BROKEN[k]).text;
    assert.doesNotMatch(txt, /^\{|"scene"|scene"?\s*:/, k + "：还带着 JSON 壳 → " + txt.slice(0, 40));
    assert.ok(txt.length > 3, k + "：正文被洗没了");
  });
  // 中文正文里「"」太常见了，这一种最容易发生：不许截在第一个引号上
  assert.equal(F.rpParseTurn(BROKEN["正文里没转义的引号"]).text, '他说"走"，然后走了。\n\n她没动。');
  assert.equal(F.rpParseTurn(BROKEN["整份被截断"]).text, "他说「还不走？」\n\n你没答话。\n\n后半夜");
  // 走到救正文这条路的时候，转义还得自己还原一遍——
  // 不还原的话段落之间会杵着两个字面的反斜杠 n，正文当场变成一坨。
  // （上面那几条用的是真换行，测不到这一档，得单挑一条转义过的。）
  const esc = '{"scene":"他说"走"。\\n\\n她没动，只是把茶推了回去。","hit":""}';
  assert.equal(F.rpParseTurn(esc).text, '他说"走"。\n\n她没动，只是把茶推了回去。');
  assert.doesNotMatch(F.rpParseTurn(esc).text, /\\n/, "转义没还原，正文里杵着字面的 \\n");
  // 收尾要认【结构上那个引号】（后面跟着下一个键或收尾括号），不是见引号就收
  assert.match(fic, /\(\?:hit\|dev\|note\|beats\|verdict\|author\)/, "收尾没按结构找");
  assert.equal(F.rpSalvage("压根没有 scene 这一栏"), null);
});

test("压根不是 JSON 的那次照旧原样当正文——这条不许坏", () => {
  assert.equal(F.rpParseTurn("他推门进来的时候，肩上还落着雪。").text, "他推门进来的时候，肩上还落着雪。");
  assert.equal(F.rpParseTurn('{"scene":"一段\n\n两段","dev":250}').dev, 100, "偏离度没夹在 0-100 里");
});

test("穿书这条链上四处解析全换过来了，不许只治一半", () => {
  ["genRPStart", "genRPTurn", "genRPEnding", "genRPIdentity", "genLandings"].forEach(fn => {
    const i = fic.indexOf("async function " + fn + "(");
    assert.ok(i > 0, "找不到 " + fn);
    const seg = fic.slice(i, i + 3200);
    assert.doesNotMatch(seg, /let d = extractJSON\(/, fn + " 还在用光板的 extractJSON");
  });
  // 会出长正文的那三处还要有救回正文的那条路
  ["genRPStart", "genRPEnding"].forEach(fn => {
    const i = fic.indexOf("async function " + fn + "(");
    assert.match(fic.slice(i, i + 3200), /rpSalvage\(txt\)/, fn + " 解析失败之后没救正文");
  });
});

// ── ③ 作者的迷你人设 ─────────────────────────────────────────
test("作者不是一个类型，是一个人——开场顺手给她一张小卡", () => {
  const st = fic.slice(fic.indexOf("async function genRPStart("), fic.indexOf("  // 玩家行动 →"));
  assert.match(st, /【同时给这篇文的作者/);
  ["who", "why", "sore"].forEach(k => assert.ok(st.indexOf('\\"' + k + '\\"') > 0, "输出形状里缺 " + k));
  assert.match(st, /不是随便一个网文作者都成立的话/, "没写清判据，三行会写成通用的");
  // 还是同一次调用，别多花她一次钱
  assert.equal((st.match(/await callAI\(/g) || []).length, 1);
  // 落进存档，而且页边批注真的用上了
  assert.match(fic, /ss\.authorCard = r\.authorCard \|\| null;/, "小卡没落库");
  assert.match(fic, /function rpAuthorCard\(session\)/);
  assert.match(fic, /rpAuthorCard\(session\)/);
  const blk = fic.slice(fic.indexOf("function rpAuthorBlock("), fic.indexOf("  // 一拍的输出契约"));
  assert.match(blk, /rpAuthorCard\(session\)/, "批注那一段没吃到小卡，等于白生成");
  // 老存档没有这一栏：一个字都不多发
  const card = fic.slice(fic.indexOf("function rpAuthorCard("), fic.indexOf("function rpAuthorBlock("));
  assert.match(card, /if \(!c \|\| !\(c\.who \|\| c\.why \|\| c\.sore\)\) return "";/);
  // 不许给内容示范（prompt-no-content-samples.md）
  assert.doesNotMatch(st.slice(st.indexOf("【同时给这篇文的作者")), /如「|比如「|例如「/);
});

// ── ④ 那几句话 + 那一大块标题 ─────────────────────────────────
test("「生成降落节点」换成人话了", () => {
  // 整条链一起换掉，不止那个按钮：提示词里也不许再说「降落节点」
  //（那是从工程那边搬来的词，读起来像在填表；这是一本书，进去的是某一页某一处）
  assert.doesNotMatch(fic, /生成降落节点/);
  assert.doesNotMatch(fic, /推演降落点中/);
  assert.doesNotMatch(fic, /选一个降落节点/);
  assert.doesNotMatch(fic, /重新生成降落点/);
  assert.doesNotMatch(fic, /挑【降落节点】/);
  assert.doesNotMatch(fic, /给降落节点。/);
  assert.match(fic, /翻翻这本书，看能从哪儿进去/);
  assert.match(fic, /"正在翻这本书…"/);
  assert.match(fic, /"从哪儿进去"/);
  assert.match(fic, /"换几个地方看看"/);
});

test("穿书中那一页不再顶着一块 30px 大标题", () => {
  const th = fic.slice(fic.indexOf("  // 穿书会话（互动叙事）"), fic.indexOf("  // ---------- 底 nav ----------"));
  assert.ok(th.length > 2000, "抠不出 RPThread");
  // v61.27：Head 本身已经改成紧凑标题栏了（components.js），所以这一页改回用 Head——
  // 同一层东西不许有两个实现，不然下次只会改到其中一处。
  assert.match(th, /h\(Head, \{\n\s+zh: s\.ficTitle \|\| "穿书中",/);
  assert.match(th, /sub: window\.Fanfic\.rpModeShort/, "副标题没接上");
  assert.doesNotMatch(th, /paddingTop: safeTop\(8\)/, "自己那份紧凑栏还留着，成了第二个实现");
  // 书名只写一遍——底下那份重复的抬头撤掉了
  assert.equal((th.match(/s\.ficTitle/g) || []).length, 1, "书名还是连着写了两遍");
  // 收尾在顶栏右侧那个等宽位；照旧要点两下
  assert.match(th, /endAsk \? "确定？" : "收尾"/);
  assert.match(th, /再点一下右上角就定稿/);
  assert.doesNotMatch(th, /"收尾 · 把这一版放回书架"/);
});
