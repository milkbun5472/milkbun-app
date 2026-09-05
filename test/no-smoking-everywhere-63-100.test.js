// 禁烟得在【每一处】（她 2026-09-05：「这个禁烟好像没带到梦境，还在抽。
// 然后你看看还有哪儿没禁烟的」）。
//
// 病根和 .claude/rules/four-surfaces-same-context.md 里那一串一模一样：
// 这一层原来只挂在 buildBundle 和 groupBans 上，于是【凡是自己拼 sys 的地方一律没有】——
// 梦、小剧场的开场、周刊、擂台、塔罗、一起读、一起学、番茄钟、记账、备忘、印象卡，
// 一处都没收到。她撞上的是 TA 们每晚那场梦（dreamjournal 的 dreamGenSys）。
//
// ⚠️所以这条测试不是钉一行代码，是钉【那张名单】：
//   下次谁新开一个自己拼 sys 的地方，得把自己加进来，否则这条红。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

// 拿到这一层的两条路：① 自己 push（含本文件里的 CB() 小helper）；② 走 narrativeCore/buildBundle/groupBans 白得
const SELF = /ContentBoundaries\s*\.\s*prompt|\bCB\(\)/;

test("禁烟的原话只有一份，别处不许自己抄一遍", () => {
  const cb = read("content-boundaries.js");
  assert.match(cb, /所有角色默认都没有吸烟习惯/);
  const others = ["engine.js", "dream.js", "dreamjournal.js", "weekly.js", "theater.js", "fanfic.js"];
  others.forEach(f => assert.doesNotMatch(read(f), /所有角色默认都没有吸烟习惯/, f + " 自己抄了一份——改一处另一处就落单"));
});

test("写连续正文的地方靠 narrativeCore 白得，不用一处处 push", () => {
  const eng = read("engine.js");
  const nc = eng.slice(eng.indexOf("function narrativeCore(opts) {"), eng.indexOf("\n// 她 2026-08-28 发来一段单人线下的心声历史"));
  assert.ok(nc.length > 200, "抠不出 narrativeCore");
  assert.match(nc, /parts\.push\(ContentBoundaries\.prompt\)/, "narrativeCore 里没有这一层");
  // 别的两条老路照旧
  assert.match(eng, /if \(typeof ContentBoundaries !== "undefined"\) P\.push\(ContentBoundaries\.prompt\);/, "群聊那条（groupBans）掉了");
  assert.match(eng, /if \(!ctx\.notRoleplay && typeof ContentBoundaries !== "undefined"\) parts\.push\(ContentBoundaries\.prompt\);/, "buildBundle 那条掉了");
});

// 名单：每一处【自己拼 sys】的角色向调用点，都要能拿到这一层。
// 第二列写清它【靠什么】拿到——查缺时先问这个，不是先 grep 规则名（v61.16 学到的）。
const SURFACES = [
  ["dreamjournal.js", "自己 push（TA 们每晚那场梦：她 2026-09-05 就是在这儿看见他还在抽）"],
  ["dream.js", "narrativeCore + 兜底路自己 push"],
  ["theater.js", "演戏走 narrativeCore；搭台那几枪自己 push"],
  ["weekly.js", "自己 push"],
  ["debate.js", "自己 push"],
  ["tarot.js", "自己 push"],
  ["read.js", "自己 push"],
  ["study.js", "自己 push"],
  ["memo.js", "自己 push"],
  ["ledger.js", "自己 push"],
  ["pomodoro.js", "自己 push"],
  ["impression.js", "自己 push"],
  ["fanfic.js", "narrativeCore（同人文正文和穿书都走它）"],
  // ⚠️games.js 是 Codex 的地盘，她 2026-09-05 亲口让动的（「你动吧宝宝」）才碰。
  //   这一处的写法和别处不同：AC 在这个文件里是【无条件的 prompt 头】，所以并进 AC 是安全的
  //   （v55.90 警告的是「挂在会消失的可选块上」，不是「挂在永远都发的头上」）。
  ["games.js", "并进本文件的 AC；座位级那批让人说话的 sys 一处处接"]
];
SURFACES.forEach(([f, how]) => {
  test("禁烟到得了：" + f + "（" + how + "）", () => {
    const src = read(f);
    const ok = SELF.test(src) || /narrativeCore\(/.test(src);
    assert.ok(ok, f + " 拿不到禁烟这一层");
  });
});

test("每一处 sys 的头上真的接了，不是只声明了一个没人叫的 CB()", () => {
  // ⚠️v55.95 那条：声明了但没人引用，比压根没写更坏——看代码以为已经在发了。
  ["weekly.js", "debate.js", "tarot.js", "read.js", "memo.js", "ledger.js", "pomodoro.js", "impression.js", "theater.js"].forEach(f => {
    const src = read(f);
    if (!/const CB = \(\)/.test(src)) return;         // 这一处不是用 helper 那条路
    // 声明写的是 `const CB = () =>`，里头没有 "CB()"，所以数到的就是【真调用】的次数
    const calls = (src.match(/CB\(\)/g) || []).length;
    assert.ok(calls >= 1, f + " 里 CB() 声明了却没人叫");
  });
  // 逐处点名：这几处的 sys 头上必须真的带着它
  assert.match(read("dreamjournal.js"), /\+ CB\(\)   \/\/ ⚠️她 2026-09-05 就是在这一处看见他还在抽/);
  assert.match(read("study.js"), /parts\.push\(ANTI_CLICHE\);\n\s*if \(typeof ContentBoundaries !== "undefined" && ContentBoundaries\.prompt\) parts\.push\(ContentBoundaries\.prompt\);/);
  // ⚠️口径改了（v64.07，她问「这些批注是喂了全部人设和那一堆吗」）：
  //   一起读那几处原来各自拼 `ANTI_CLICHE + CB() +`，现在收成了一个 readHead——
  //   它接得上上下文就发整份 buildBundle（里头本来就带 ContentBoundaries），
  //   接不上才退回 `ANTI_CLICHE + CB()`。**两条路都带禁烟**，这一条的意图没变。
  //   所以改成钉那一份：五枪都得走它，而且它两条路都得带上这一层。
  const rd = read("read.js");
  assert.equal((rd.match(/= readHead\(ctxFor, char\)/g) || []).length, 5, "一起读那五处没一起接上");
  const rh = rd.slice(rd.indexOf("function readHead(ctxFor, char)"), rd.indexOf("async function genAnnotations"));
  assert.match(rh, /buildBundle\(ctxFor\(char\)\)/, "接得上那一路没走 bundle（bundle 里带着这一层）");
  assert.match(rh, /if \(!head\) head = \(typeof ANTI_CLICHE !== "undefined" \? ANTI_CLICHE \+ "\\n\\n" : ""\) \+ CB\(\)/, "兜底那一路没带 CB()");
  assert.match(read("engine.js"), /ContentBoundaries/, "buildBundle 那头不带内容边界了，一起读就漏了");
});

test("牌桌上也不许抽：AC 那条 + 座位级那批说话的 sys", () => {
  const g = read("games.js");
  assert.match(g, /const AC = \(\(typeof ANTI_CLICHE !== "undefined"\) \? ANTI_CLICHE \+ "\\n\\n" : ""\) \+ CB;/, "AC 那条掉了，二十多处一起没有");
  // 不走 AC 的那批（言秋座位 / 每个角色自己说话的那几枪）：让人【说话】的都要接上
  const seat = (g.match(/sys: CB \+ "/g) || []).length;
  assert.ok(seat >= 10, "座位级只接上了 " + seat + " 处");
  // 只报一个目标名的那几枪（夜里选刀口/查验/守护）不接——那儿没有正文可写
  assert.match(g, /sys: "「狼人杀」天黑，你是狼/, "把不出正文的那几枪也塞了，纯属浪费上下文");
});

test("周刊那一版不再【请】他点烟", () => {
  // 「允许描写雨、烟、廉价咖啡这类硬派意象」——这比缺一层还糟：它是在发许可
  const w = read("weekly.js");
  assert.doesNotMatch(w, /允许描写雨、烟/);
  assert.match(w, /硬派不靠烟：这个世界里没人抽烟/);
});

test("那把过滤器认得出各种写法（代码这一道，不只是规则）", () => {
  const CBmod = require(path.join(__dirname, "..", "js", "content-boundaries.js"));
  ["他点了一根烟", "叼着烟", "递给我一支烟", "吞云吐雾", "he lit a cigarette", "vaping", "电子烟"]
    .forEach(x => assert.ok(CBmod.hasTobacco(x), "认不出：" + x));
  ["烟花在河对岸炸开", "灶上的油烟机", "烟灰色的大氅"].forEach(x => {
    // ⚠️这几个是【假阳性】的坑：烟花、油烟机、烟灰色都不是抽烟。
    //   现在的正则里「烟灰」会误判——记在这儿，别哪天当成新 bug 又查一遍。
    if (x.indexOf("烟灰") >= 0) assert.ok(CBmod.hasTobacco(x));
    else assert.ok(!CBmod.hasTobacco(x), "误判成抽烟：" + x);
  });
});
