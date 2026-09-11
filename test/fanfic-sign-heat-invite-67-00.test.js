// 她 2026-09-11 三条：
//  ① 作者主页扉页底下那一块「应该是她自己的签名而不是第三人称描述」
//  ② 「作者汇总这里要不要下面加一个热度让我可以看得见」
//  ③ 「写作者要求那个框能不能放进请人里面，点击请人打开输入再生成」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
// ⚠️注释里写着这一轮的病历（「第三人称描述」那几个字），不 strip 会断出假绿
const strip = s => s.split("\n").map(l => l.split("//")[0]).join("\n");
const code = strip(fic);
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
const box = {};
vm.createContext(box);
vm.runInContext(fic.slice(fic.indexOf("  const HEAT = {"), fic.indexOf("  // 她的脾气有多容易被点着"))
  + grab("heatNow") + grab("authorFics") + grab("authorHeatOf") + grab("heatBand")
  // authorFics 没拿到数组时会回头问 loadFics——这儿一律显式传，桩只是让它不崩
  + "\nfunction loadFics() { return []; }"
  + "\nthis.M = { HEAT, heatNow, authorFics, authorHeatOf, heatBand };", box);
const M = box.M;
// ⚠️桩照【写热度那一段】抄（stub-from-the-writer）：js/fanfic.js 里写的是
//   fic.authorHeat = …；fic.heatTs = Date.now()；作者靠 f.author 认
const mkFic = (author, heat, title) => ({ id: "f" + heat, title: title || "篇", author: author, authorHeat: heat, heatTs: Date.now() });

// ── ① 签名 ────────────────────────────────────────────────
test("签名是【她自己写的】，从头到尾走通了一条路", () => {
  // 请人那一枪：要这一栏，而且说清了第一人称、不是介绍她的话
  assert.match(code, /· sign：\*\*她自己挂在个人页上的那一句签名\*\*/);
  assert.match(code, /⚠️第一人称，是【她写的】/);
  assert.match(code, /「这位作者擅长…」那种一个字都不许有/, "不点名这个病，它会照旧写成第三人称介绍");
  assert.match(code, /\\"name\\":\\"\\",\\"sign\\":\\"\\"/, "输出格式里没这一栏，说了也白说");
  // 出一批文那一枪是同一层（four-surfaces-same-context）
  assert.match(code, /\\"authorSign\\":\\"她自己挂在个人页上的那一句签名，第一人称/);
  assert.match(code, /也不要再交 authorSign／authorBio／authorStyle。/, "点了名还让它再交一份签名");
  assert.match(code, /sign: by \? by\.sign : x\.authorSign/, "出一批文时签名没落库");
  // 落库：新人存、老人不覆盖（空值不许抹掉旧值）
  const up = grab("upsertAuthor");
  assert.match(up, /sign: cur\.sign \|\| String\(a\.sign \|\| ""\)\.trim\(\)\.slice\(0, 40\)/);
  assert.match(up, /\n        sign: String\(a\.sign \|\| ""\)\.trim\(\)\.slice\(0, 40\),/);
  // 配对兜底也要洗这一栏：签名里照样能冒出她没配过的 CP
  assert.match(grab("stripStrayCP"), /sign: clean\(a\.sign\)/);
  // 掷：不掷的话四位的签名会一起长成同一句
  assert.match(code, /\{ key: "sign", zh: "她那句签名是什么样的（这是 sign 那一栏）"/);
});

test("扉页底下那一块画的是签名，老存档不拿路数去顶", () => {
  const a0 = fic.indexOf("function AuthorHome(props)");
  assert.ok(a0 > 0, "找不到 AuthorHome");
  const page = fic.slice(a0);
  const at = page.indexOf("borderLeft: \"2px solid \" + t.line");
  assert.ok(at > 260, "没找到扉页底下那一块（引用那一道竖线）");
  const quote = page.slice(at - 260, at + 60);
  assert.match(quote, /a\.sign \?/, "那一块画的还是第三人称那段");
  assert.ok(quote.indexOf("a.style") < 0, "没有签名时拿路数顶上去——顶上去就又是第三人称");
  // 路数没被删掉，只是挪去跟「碰不得」「你动她的文」排一列
  assert.match(page, /\}, "她的文"\),/);
  assert.match(page, /h\("span", \{ style: \{ fontFamily: F_BODY, fontSize: 11\.5, lineHeight: 1\.7, color: t\.sub \} \}, a\.style\)/);
});

// ── ② 热度 ────────────────────────────────────────────────
test("热度取她最烫的那一篇，并且说得出是哪一篇", () => {
  const fics = [mkFic("青梅", 20, "甲"), mkFic("青梅", 74, "乙"), mkFic("老陈", 90, "丙")];
  const r = M.authorHeatOf("青梅", fics, Date.now());
  assert.equal(r.heat, 74, "取的不是最烫那篇");
  assert.equal(r.fic.title, "乙", "不说是为哪一篇气的，看见一个数也没用");
  assert.equal(r.n, 2);
  // 一篇都没写过的没有热度可言——热度是按篇记的
  const none = M.authorHeatOf("新来的", fics, Date.now());
  assert.equal(none.n, 0);
  assert.equal(none.fic, null);
  // 放着不动会自己降：这一条本来就在 heatNow 里，authorHeatOf 不许绕开它
  const old = [{ id: "f", title: "丁", author: "青梅", authorHeat: 80, heatTs: Date.now() - 10 * 86400000 }];
  assert.ok(M.authorHeatOf("青梅", old, Date.now()).heat < 80, "热度不过 heatNow，十天前的火气原样端出来");
});

test("热度那几档从 HEAT 里读，界面上不许再抄一遍 45／70", () => {
  assert.equal(M.heatBand(M.HEAT.QUIT_AT).key, "quit");
  assert.equal(M.heatBand(M.HEAT.QUIT_AT - 1).key, "grab");
  assert.equal(M.heatBand(M.HEAT.GRAB_AT).key, "grab");
  assert.equal(M.heatBand(M.HEAT.GRAB_AT - 1).key, "warm");
  assert.equal(M.heatBand(0).key, "calm");
  assert.equal(M.heatBand(-5).v, 0);
  assert.equal(M.heatBand(999).v, M.HEAT.CAP);
  assert.ok(M.heatBand(M.HEAT.QUIT_AT).zh.indexOf("撂挑子") >= 0);
  // 档位是从 HEAT 读的，不是把数字抄进 heatBand
  const hb = grab("heatBand");
  assert.match(hb, /HEAT\.QUIT_AT/);
  assert.match(hb, /HEAT\.GRAB_AT/);
  assert.ok(!/\b45\b|\b70\b/.test(strip(hb)), "阈值被抄进了界面这一侧：以后调 HEAT 永远漏这一处");
});

test("两处共用同一道朱笔，不许各画各的", () => {
  // one-public-mechanism：名册那一页和她的主页是同一个形状的两处
  assert.equal(code.split("function heatMark(").length - 1, 1, "热度画了不止一处");
  assert.match(code, /mine\.length \? heatMark\(window\.Fanfic\.authorHeatOf\(a\.name, fics\)\.heat, t\) : null\)/, "名册那一页没画热度");
  assert.match(code, /return hb\.n \? heatMark\(hb\.heat, t, hb\.fic \? "《" \+ hb\.fic\.title \+ "》" : ""\) : null;/, "她主页上没画热度");
  // 条 + 话 + 数三样都在：光一条看不出烫到哪儿，光一个数她得自己记阈值
  const hm = grab("heatMark");
  assert.match(hm, /width: Math\.max\(3, b\.v\) \+ "%"/);
  assert.match(hm, /\}, b\.zh\)/);
  assert.match(hm, /fontFamily: "monospace"[^}]*\} \}, b\.v\)/);
});

// ── ③ 点了请人才掀条子 ─────────────────────────────────────
test("稿约条是那颗键底下长出来的，不是又开一层", () => {
  const page = fic.slice(fic.indexOf("function AuthorsPage(props)"), fic.indexOf("  // 一位作者的主页"));
  assert.ok(page.length > 500, "没切到 AuthorsPage");
  assert.match(page, /const \[asking, setAsking\] = useState\(false\);/);
  assert.match(page, /asking \? h\("div", \{ style: \{ border: "1px dashed "/);
  assert.ok(page.indexOf("h(Sheet") < 0, "开成了半窗（no-half-sheet.md：这一层根本不用看见底下那一层）");
  assert.match(page, /autoFocus: true/, "掀开了还得她再点一下才能打字");
  assert.match(page, /refresh\(\); setAsking\(false\);/, "请完不收起来，条子一直挡着名册");
  assert.match(page, /busy \? "请人中…" : \(asking \? "算了" : "＋ 请人"\)/);
  // 写过的记着：她多半连着请几批同一个方向
  assert.match(page, /localStorage\.setItem\("x_ficAuthorWant"/);
  assert.match(page, /window\.Fanfic\.loadAuthors\(\), want\)/, "输入框写了，可没递进那一枪");
});
