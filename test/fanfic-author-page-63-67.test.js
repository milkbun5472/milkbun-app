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

test("作者主页是一张同人站的作者名片，不是三段光秃秃的字", () => {
  const ah = cut("  function AuthorHome(props)", "  // ---------- 底 nav ----------");
  assert.match(ah, /window\.Fanfic\.authorFace\(a\.name, 58\)/, "没有头像");
  assert.match(ah, /"@" \+ ficPenId\(a\.name\)/, "没有 @id");
  assert.match(ah, /num\(st\.works, "作品"\), num\(st\.words, "字"\), num\(st\.kudos, "被喜欢"\), num\(st\.fans, "粉丝"\), num\(st\.following, "关注"\)/,
    "那一行数字不全");
  assert.match(ah, /\(f\.tags \|\| \[\]\)\.slice\(0, 4\)/, "作品下面没有标签");
  assert.match(ah, /" 章 · " \+ fmtNum\(w\) \+ " 字 · ♡ " \+ fmtNum\(hh\.kudos\)/, "作品那一行少了字数或喜欢数");
});

test("头像和数字都是【定死的】，不是每次进来重摇一次", () => {
  const face = cut("  function authorFace(name, size)", "  // 同人站上作者页那一行数");
  assert.match(face, /ficHash\("face:" \+ name\)/, "头像颜色是随机的，同一个人每次不一样");
  assert.doesNotMatch(face, /Math\.random/);
  const st = cut("  function authorStats(name, fics)", "  function AuthorHome(props)");
  assert.match(st, /const seed = ficHash\("au:" \+ name\);/);
  assert.doesNotMatch(st, /Math\.random/);
  // ⚠️篇数和字数必须是真的（从她的文现算），不许也拿 hash 编
  assert.match(st, /works: mine\.length/);
  assert.match(st, /words \+= String\(\(c && c\.body\) \|\| ""\)\.length/);
  // ⚠️不另存计数器：存了之后文被清掉／改笔名就永远对不回来
  assert.doesNotMatch(st, /saveJSON/);
});
