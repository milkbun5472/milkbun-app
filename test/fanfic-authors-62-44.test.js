// v62.44 她 2026-09-04：「原来的地方放作者榜，可以自行生成一批作者和她们简介和文风，
// 生成同人文的时候也可以选择让某一位来写…不会被一键清掉相当于同人文固定 NPC，
// 还可以统计她们每一个 CP 产出多少…点进去她主页就可以看她写过哪些也可以直接从里面选改稿」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const fic = fs.readFileSync(__dirname + "/../js/fanfic.js", "utf8");
const core = fs.readFileSync(__dirname + "/../js/core.js", "utf8");

test("作者是单独一份名册，清空版块清不掉她们", () => {
  assert.match(fic, /const K_AUTHORS = "x_fanfic_authors";/);
  // 清空只按 tabId 挑 fics，一个字都碰不到作者库
  assert.match(fic, /loadFics\(\)\.filter\(function \(f\) \{ return f\.tabId !== curTab\.id \|\| protectedFic\(f\); \}\)/);
  assert.doesNotMatch(fic, /saveAuthors\(\[\]\)/, "没有任何一处会把作者库清空");
});

test("名册按笔名认人，同一个笔名不许攒出两条", () => {
  // .claude/rules/phone-data-layers.md：名册的身份是名字
  assert.match(fic, /const i = list\.findIndex\(function \(x\) \{ return authorName\(x\) === nm; \}\)/);
  // 空值不许抹掉旧值：已有的简介不被后来那份空的盖掉
  assert.match(fic, /bio: cur\.bio \|\| String\(a\.bio \|\| ""\)/);
});

test("产出不另存计数器，从 fics 现算", () => {
  // 存一份的话，文被清掉、被删、改了笔名，那个数就永远对不回来
  assert.match(fic, /function authorFics\(name, fics\)/);
  assert.match(fic, /function authorCPStats\(name, fics, characters, userName\)/);
  assert.doesNotMatch(fic, /a\.count \+\+|author\.count/, "不许存计数器");
});

test("生成同人文能点名让谁写；没点名也会把新笔名收进来", () => {
  assert.match(fic, /const by = opts\.author && authorName\(opts\.author\) \? opts\.author : null;/);
  assert.match(fic, /每一篇的 author 都填「" \+ authorName\(by\) \+ "」/);
  // 没点名时顺带要一份简介回来——⚠️不额外调一次模型，她按次计费
  assert.ok(fic.includes('const authorFields = by ? "" : ",\\"authorBio\\"'), "没点名时要顺带要一份作者简介");
  assert.match(fic, /upsertAuthor\(stripStrayCP\(\{ name: nm, bio: by \? by\.bio : x\.authorBio/);
  // 弹窗里那一排不是药丸：署名表上一行行的名字，选中那行落一个墨点
  assert.match(fic, /"让谁来写"/);
  assert.match(fic, /doGen\(n, cp, styleIds, includeMe, briefs, byAuthor\)/);
});

test("作者榜是一张署名表，不是一排卡片", () => {
  const page = fic.slice(fic.indexOf("function AuthorsPage"), fic.indexOf("function AuthorHome"));
  assert.match(page, /String\(i \+ 1\)\.padStart\(2, "0"\)/, "署名表要有序号");
  assert.doesNotMatch(page, /gridTemplateColumns/, "不许排成网格");
  assert.match(page, /genAuthors\(props\.active, 4/);
  // 主页：她是谁 + 都写了谁 + 写过哪几篇，每篇能直接加笔
  const home = fic.slice(fic.indexOf("function AuthorHome"), fic.indexOf("// ---------- 底 nav"));
  assert.match(home, /"她都写了谁"/);
  assert.match(home, /"她写过的"/);
  assert.match(home, /props\.onAddOn && props\.onAddOn\(f\.id\)/);
  assert.match(fic, /onAddOn: function \(id\) \{ setRpStart\(id\); setView\("rp"\); \}/);
  // 带着一篇进加笔：直接跳设定屏，别让她再翻一遍列表
  assert.match(fic, /if \(!props\.startFicId\) return;/);
});

test("底栏：中间让给加笔，＋写文挪进「我的」，原位放作者", () => {
  assert.match(fic, /\{ key: "rp", label: "加笔", center: true \}, \{ key: "authors", label: "作者", G: IAuthors \}/);
  assert.match(fic, /h\(IQuill, \{ size: 19, color: t\.bg2 \}\)/);
  assert.match(fic, /row\("自己写一篇"/);
  assert.match(fic, /onWrite: function \(\) \{ setView\("publish"\); \}/);
  assert.doesNotMatch(fic, /用底部加号自己写/, "＋ 已经不在底栏了，提示也要跟着改");
  assert.match(core, /const IQuill = /);
  assert.match(core, /const IAuthors = /);
});
