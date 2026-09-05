// 她 2026-09-05：「这个同人文作者介绍，首先他这个界面太普通了没有头像，粉丝量之类的
// 小说网页有的排版。然后它还会生成莫名其妙的 cp，介绍里面不要生成奇奇怪怪的 cp」。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const P = f => path.resolve(__dirname, "..", f);
const fan = fs.readFileSync(P("js/fanfic.js"), "utf8");
const cut = (a, b) => { const i = fan.indexOf(a), j = fan.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return fan.slice(i, j); };

// 把那三个纯函数抠出来跑（cpLabel 是它们的依赖，一起带上）
function load(cps) {
  const seg = cut("  function cpLabel(", "  // CP 下拉里的选项")
    + cut("  function allowedCPLabels(", "  // ---- 请一批新作者进来");
  const sandbox = { loadCPs: () => cps || [] };
  vm.createContext(sandbox);
  vm.runInContext(seg + "\nthis.API = { allowedCPLabels, cpRuleBlock, stripStrayCP };", sandbox);
  return sandbox.API;
}
const CHARS = [{ id: "c1", name: "裴照川" }, { id: "c2", name: "许言秋" }, { id: "c3", name: "沈屿白" }];

test("一对都没配过时，提示词里是【一个配对都不许写】", () => {
  const API = load([]);
  // vm 里造的数组跨 realm，deepEqual 过不了——比字符串
  assert.equal(API.allowedCPLabels(CHARS, "Lisa").join("|"), "");
  const r = API.cpRuleBlock([]);
  assert.match(r, /一个配对都不许写/);
  assert.match(r, /不许把名单里的两个人凑成一对/);
});

test("配过的那几对才许提，而且明说不许自己再凑新的", () => {
  const API = load([["c1", "me"]]);
  assert.equal(API.allowedCPLabels(CHARS, "Lisa").join("|"), "裴照川 × Lisa");
  const r = API.cpRuleBlock(API.allowedCPLabels(CHARS, "Lisa"));
  assert.match(r, /只许提这几对里的：裴照川 × Lisa/);
  assert.match(r, /不许自己把圈子里的人凑成新的一对/);
});

test("代码这一道：没配过的配对整句删掉，配过的留着", () => {
  const API = load([]);
  // 她截图里那一句，一字不改
  const got = API.stripStrayCP({
    bio: "高产的都市与ABO中短篇快手，白天赶早八晚上产粮，是圈子里裴照川×许言秋这一对的固定供粮大户。",
    style: "节奏极快，擅长写合租屋。", sore: "最护着骨气。"
  }, CHARS, "Lisa");
  assert.equal(got.bio.indexOf("裴照川"), -1, "拉郎配那一句还在");
  assert.equal(got.bio, "高产的都市与ABO中短篇快手，白天赶早八晚上产粮。", "删完没收尾，留了个吊着的逗号");
  assert.equal(got.style, "节奏极快，擅长写合租屋。", "没配对的句子被误伤了");

  const API2 = load([["c1", "me"]]);
  const keep = API2.stripStrayCP({ bio: "只写裴照川×Lisa，顺手也嗑许言秋×沈屿白。" }, CHARS, "Lisa");
  assert.match(keep.bio, /裴照川×Lisa/, "她自己配好的那一对被删了");
  assert.equal(keep.bio.indexOf("沈屿白"), -1, "没配过的那一对留下来了");
});

test("各种写法的配对都要认出来，不只是 ×", () => {
  const API = load([]);
  ["×", "x", "X", "✕", "/", "／", "&", "·", "*"].forEach(sep => {
    const got = API.stripStrayCP({ bio: "圈子里裴照川" + sep + "许言秋的大户。" }, CHARS, "Lisa");
    assert.equal(got.bio, "", "分隔符「" + sep + "」没被认出来：" + got.bio);
  });
});

test("两条生成线都要吃到这条规则，而且落库前都过一道兜底", () => {
  // 请太太那一枪
  const ga = cut("  async function genAuthors(", "  // ---- 批量生成 N 篇");
  assert.match(ga, /const okCPs = allowedCPLabels\(cpChars, userName\);/);
  assert.match(ga, /\+ cpRuleBlock\(okCPs\)/, "提示词里没有这条规则");
  assert.match(ga, /upsertAuthor\(stripStrayCP\(x, cpChars, userName\)\)/, "落库前没兜底");
  // 生成一批文时顺带交简介那一路（她报的那句就是从这儿出来的）
  const gb = cut("  async function genBatch(", "  // ---- 追更：append 一章");
  assert.match(gb, /const authorCPRule = by \? "" : "\\n\\n" \+ cpRuleBlock\(allowedCPLabels\(cpChars, userName\)\)/);
  assert.match(gb, /briefBlock \+ byBlock \+ authorCPRule/, "拼进去了没？声明了却没引用等于没写");
  assert.match(gb, /upsertAuthor\(stripStrayCP\(\{ name: nm/, "这一路落库前没兜底");
});

// v63.80（她 2026-09-05：「页面还是无聊」）
//
// 上一版给它补了头像和一行数字，可那还是【一张个人资料卡】——那种东西换到任何
// app 里都成立（tabs-not-plain-pills.md 的同一条判据）。
// 这一页在现实里是什么？是**她那本个人志的扉页 + 目录**。
test("作者页是一本个人志的扉页 + 目录，不是一张通用资料卡", () => {
  const ah = cut("  function AuthorHome(props)", "  // ---------- 底 nav ----------");
  // 扉页：双线框 + 头像 + 落款闲章
  assert.match(ah, /boxShadow: "inset 0 0 0 3px " \+ \(t\.bg2 \|\| t\.bg\) \+ ", inset 0 0 0 4px " \+ t\.line/, "扉页的双线框没了");
  assert.match(ah, /window\.Fanfic\.authorFace\(a\.name, 52\)/, "没有头像");
  assert.match(ah, /window\.Fanfic\.authorSeal\(a\.name, 34\)/, "落款那枚闲章没了");
  assert.match(ah, /"@" \+ ficPenId\(a\.name\)/, "没有 @id");
  // 那一行数排成一行小字——五个并排的大数字是社交 app 的长相
  assert.match(ah, /stat\("作品", st\.works\), stat\("字", st\.words\), stat\("被喜欢", st\.kudos\), stat\("粉丝", st\.fans\), stat\("关注", st\.following\)/);
  // 目录：卷号（汉字）+ 引点线 + 字数
  assert.match(ah, /cnIndex\(ix \+ 1\)/, "目录没有卷号");
  assert.match(ah, /borderBottom: "1px dotted " \+ t\.line, transform: "translateY\(-3px\)"/, "目录那根引点线没了");
  assert.match(ah, /\(f\.tags \|\| \[\]\)\.slice\(0, 3\)/, "作品下面没有标签");
  // 写了谁：正字计数（一根填色横条换到任何 app 里都成立，这个换不了）
  assert.match(ah, /window\.Fanfic\.zhengTally\(c\.n, t\.ink, 17\)/, "又退回那几根横条了");
  assert.doesNotMatch(ah, /background: t\.accent, opacity: \.75/, "旧的横条留在原地了");
});

test("正字是按笔顺一笔笔划的，五笔一个字", () => {
  const seg = cut("  const ZHENG_STROKES = [", "  const CN_NUM =");
  const f = new Function(seg + "\nreturn { ZHENG_STROKES: ZHENG_STROKES, zhengTally: zhengTally };")();
  assert.equal(f.ZHENG_STROKES.length, 5, "正是五笔");
  // 笔顺：① 上横 ② 中竖 ③ 中短横 ④ 左竖 ⑤ 下横
  assert.equal(f.ZHENG_STROKES[0], "M3 3 H17");
  assert.equal(f.ZHENG_STROKES[1], "M10 3 V17");
  assert.equal(f.ZHENG_STROKES[4], "M3 17 H17");
  const cn = new Function(cut("  const CN_NUM =", "  // 闲章") + "\nreturn cnIndex;")();
  assert.equal(cn(1), "一"); assert.equal(cn(10), "十"); assert.equal(cn(12), "十二"); assert.equal(cn(23), "二十三");
});

test("闲章刻的是笔名末一个字——头一个已经在圆头像上了", () => {
  const seal = cut("  function authorSeal(name, size)", "  // ⚠️这一页不是");
  assert.match(seal, /const ch = nm\.slice\(-1\) \|\| "\?";/, "两处刻同一个字，那枚印就白盖了");
  const face = cut("  function authorFace(name, size)", "  // 同人站上作者页那一行数");
  assert.match(face, /String\(name \|\| "\?"\)\.trim\(\)\.slice\(0, 1\)/);
});

test("能把一位太太请出名册，而且【只删人不删文】", () => {
  const rm = cut("  function removeAuthor(name)", "  function findAuthor(name)");
  assert.match(rm, /const left = list\.filter\(function \(x\) \{ return authorName\(x\) !== nm; \}\);/);
  assert.match(rm, /if \(left\.length === list\.length\) return false;/, "没删到人也说删了");
  assert.doesNotMatch(rm, /saveFics|loadFics/, "删人的时候把文也动了——文和人是两份东西");
  assert.match(fan, /removeAuthor: removeAuthor,/, "没暴露出去，界面调不到");
  // 界面：先问一句再删，而且说清文会留着
  const ah = cut("  function AuthorHome(props)", "  // ---------- 底 nav ----------");
  assert.match(ah, /"把这位请出名册"/);
  assert.match(ah, /ask\n?\s*\?/, "点一下就删了，没有那句确认");
  assert.match(ah, /"她写过的 " \+ mine\.length \+ " 篇文【留着】/, "没说清文会不会跟着没");
  assert.match(fan, /window\.Fanfic\.removeAuthor\(nm\);\n\s*setOpen\(null\); refresh\(\);/, "删完没退回名册页 / 没刷新");
});

test("头像和数字都是【定死的】，不是每次进来重摇一次", () => {
  const face = cut("  function authorFace(name, size)", "  // 同人站上作者页那一行数");
  assert.match(face, /ficHash\("face:" \+ name\)/, "头像颜色是随机的，同一个人每次不一样");
  assert.doesNotMatch(face, /Math\.random/);
  const st = cut("  function authorStats(name, fics)", "  // 正字计数");
  assert.match(st, /const seed = ficHash\("au:" \+ name\);/);
  assert.doesNotMatch(st, /Math\.random/);
  // ⚠️篇数和字数必须是真的（从她的文现算），不许也拿 hash 编
  assert.match(st, /works: mine\.length/);
  // ⚠️v63.92 修：这条原来跟代码一起错——章节存的那一栏叫 content，不叫 body，
  //   于是「字」这一栏一直是 0，还没有任何报错（.claude/rules/stub-from-the-writer.md）。
  //   现在钉在【写存档的那一处】上：写的人哪天改了字段名，这条当场红。
  assert.match(st, /words \+= ficWords\(f\);/);
  assert.match(fan, /chapters: \[\{ content: x\.body, endHook: x\.endHook/, "写入方改了字段名");
  // ⚠️不另存计数器：存了之后文被清掉／改笔名就永远对不回来
  assert.doesNotMatch(st, /saveJSON/);
});
