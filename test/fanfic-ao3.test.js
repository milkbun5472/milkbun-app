const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.join(__dirname, "..", "js", "fanfic.js"), "utf8");
// 那几个纯函数抠出来真跑（不碰 React、不碰 DOM）
const F = (() => {
  const a = fic.indexOf("  function fmtNum(n)");
  const b = fic.indexOf("  // cp token：charId");
  assert.ok(a > 0 && b > a, "抠不出同人文那几个纯函数");
  return new Function(fic.slice(a, b) + "\nreturn { fmtNum, ficHash, ficTagKind, ficPenName, ficWords, ficHasMe };")();
})();

// 她 2026-08-30：「参考 ao3 的页面再加点我们之间的设计」
test("标签按【它在提醒你什么】分色，不是随便配色", () => {
  assert.equal(F.ficTagKind("BE预警"), "warn");
  assert.equal(F.ficTagKind("刀子"), "warn");
  assert.equal(F.ficTagKind("HE"), "sweet");
  assert.equal(F.ficTagKind("治愈"), "sweet");
  assert.equal(F.ficTagKind("IF线"), "form");
  assert.equal(F.ficTagKind("书信体"), "form");
  assert.equal(F.ficTagKind("暗恋"), "plain", "认不出就走中性，别硬安一档");
  // 四档各有各的样子
  assert.match(fic, /function ficTagStyle\(kind, t\)/);
  ["warn", "sweet", "form"].forEach(k => assert.ok(fic.indexOf('kind === "' + k + '"') > 0, k + " 这一档没有"));
});

test("作者有笔名了——一整页「佚名」像没人写过", () => {
  assert.match(fic, /function ficPenName\(seed\)/);
  // 同一篇永远同一个人
  assert.equal(F.ficPenName("f1"), F.ficPenName("f1"));
  // ⚠️两截各用一个独立种子：同一个 hash 移位的话，相邻 id 会撞出同一个后缀
  assert.match(fic, /PEN_A\[ficHash\("pen:" \+ seed\) % PEN_A\.length\]/);
  assert.match(fic, /PEN_B\[ficHash\("nib:" \+ seed\) % PEN_B\.length\]/);
  const names = Array.from({ length: 12 }, (_, i) => F.ficPenName("f" + (i + 1)));
  assert.ok(new Set(names).size >= 10, "十二篇撞了太多个笔名：" + names.join("/"));
  names.forEach(n => {
    assert.ok(!/undefined/.test(n), "笔名里有 undefined：" + n);
    assert.ok(n.length >= 2, "笔名太短：" + n);
  });
  // 卡片、阅读页、生成书评三处用的是同一份笔名
  assert.equal((fic.match(/ficPenName\(f\.id\)/g) || []).length, 2, "卡片和阅读页各一处");
  assert.match(fic, /const authorName = fic\.author \|\| ficPenName\(fic\.id\)/);
  assert.doesNotMatch(fic, /f\.author \|\| \(f\.source === "user" \? \(props\.userName \|\| "我"\) : "佚名"\)/, "还有地方写着「佚名」");
});

test("热度数字得散开——一整列全是「3.2k」一眼假", () => {
  // ficHeat 原来自己写了一份 h*31+c：id 只差 1，取模之后还是只差 1
  assert.doesNotMatch(fic, /function ficHeat\(seed\) \{\n\s*let h2 = 0;/);
  assert.match(fic, /ficHash\("kudos:" \+ seed\)/);
  assert.match(fic, /ficHash\("hits:" \+ seed\)/, "两项各一个独立种子，别拿同一个 hash 移位");
  const heat = seed => ({ kudos: 30 + F.ficHash("kudos:" + seed) % 4000, hits: 500 + F.ficHash("hits:" + seed) % 90000 });
  const ids = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"];
  const shown = ids.map(i => F.fmtNum(heat(i).kudos));
  assert.ok(new Set(shown).size >= 7, "相邻 id 的热度撞成一样：" + shown.join("/"));
  assert.ok(new Set(ids.map(i => F.fmtNum(heat(i).hits))).size >= 7, "点击数也得散开");
  ids.forEach(i => assert.equal(heat(i).kudos, heat(i).kudos, "同一篇每次得一样"));
});

test("字数是真数出来的，不是编的热度", () => {
  const f = { chapters: [{ content: "一二三四五" }, { content: "六七八九十\n\n十一" }] };
  assert.equal(F.ficWords(f), 12);
  assert.equal(F.ficWords({ body: "只有 body 的老数据" }), "只有body的老数据".length);
  assert.equal(F.ficWords({}), 0);
});

test("「我们之间的设计」＝CP 里有没有我，一眼看得出", () => {
  assert.ok(F.ficHasMe({ cp: ["c1", "me"] }));
  assert.ok(!F.ficHasMe({ cp: ["c1", "c2"] }));
  assert.ok(!F.ficHasMe({}));
  // 卡片左边那道色条 + 角上那个「有我」
  assert.match(fic, /background: hasMe \? t\.accent : t\.line/);
  assert.match(fic, /"有我"/);
  // 阅读页也有同一道
  assert.match(fic, /background: _hasMe \? t\.accent : t\.line/);
});

test("AO3 的 work header：标题 by 作者 / 关系 / 标签 / 统计", () => {
  const i = fic.indexOf("    const metaRow = function (label, node)");
  assert.ok(i > 0, "找不到 work header");
  const seg = fic.slice(i, fic.indexOf("        h(\"div\", { style: { height: 1, background: t.line", i));
  assert.match(seg, /"RELATION"/);
  assert.match(seg, /"TAGS"/);
  assert.match(seg, /"STATS"/);
  assert.match(seg, /fmtNum\(_words\) \+ " 字"/);
  assert.match(seg, /"by " \+ authorName/);
});

test("正文按段落排，不是一整块 pre-wrap", () => {
  // AO3 是不缩进＋段间距那一派，中文长文这样读着最不累
  assert.match(fic, /String\(ch\.content \|\| ""\)\.split\(\/\\n\\s\*\\n\|\\n\/\)/);
  assert.match(fic, /h\("p", \{ key: pi, style: \{ margin: "0 0 1\.05em" \} \}/);
  assert.match(fic, /fontSize: 16, lineHeight: 2\.05/);
});

test("两页都换了紧凑标题栏（mobile-ui-layout §1）", () => {
  // 列表页原先是 30px「同人文」＋「FANFIC」副标，一屏先被吃掉五分之一
  assert.match(fic, /\/\/ 紧凑标题栏（\.claude\/rules\/mobile-ui-layout\.md §1）/);
  assert.equal((fic.match(/paddingTop: safeTop\(10\)/g) || []).length, 2, "列表页和阅读页各一个");
  // 阅读页原先大标题写的是「阅读」，作品名反而排在下面
  assert.doesNotMatch(fic, /zh: "阅读", en: props\.tab\.name/);
  assert.doesNotMatch(fic, /zh: view === "shelf" \? "书架" : "同人文"/);
});

// ── 功能（她 2026-08-30：「你再看看同人文有什么可以加的功能」）──
test("记得读到哪一章了", () => {
  assert.match(fic, /const K_READ = "x_fanfic_read"/);
  assert.match(fic, /function markRead\(ficId, chap\)/);
  // 打开时回到那一章
  assert.match(fic, /const r = loadRead\(\)\[props\.fic && props\.fic\.id\]/);
  assert.match(fic, /return r && r\.chap > 0 && r\.chap < n \? r\.chap : 0/);
  // 翻章要记，进来也要记——只看了第一章的文否则永远不留记录
  assert.match(fic, /setChapIdx\(to\); markRead\(f\.id, to\);/);
  assert.match(fic, /useEffect\(function \(\) \{ markRead\(f\.id, chapIdx\); \}, \[f\.id\]\)/);
  // 只进不出就是坟场：留最近 200 篇
  assert.match(fic, /if \(keys\.length > 200\)/);
  // 卡片上看得见，且关掉阅读页要重取一次
  assert.match(fic, /readAt: rd \? \(chN > 1 && rd\.chap > 0 \? "读到 "/);
  assert.match(fic, /setOpenId\(null\); setReadMap\(loadRead\(\)\)/);
});

test("点标签只看这个标签的，而且取消得掉", () => {
  assert.match(fic, /const \[tagFilter, setTagFilter\] = useState\(""\)/);
  assert.match(fic, /if \(tagFilter && \(f\.tags \|\| \[\]\)\.indexOf\(tagFilter\) < 0\) return false/);
  // 同一个标签再点一次＝取消
  assert.match(fic, /setTagFilter\(tag === tagFilter \? "" : tag\)/);
  // 正在筛的时候得看得见，不然点进去就出不来了
  assert.match(fic, /tagFilter \? h\("div", \{ className: "px-5 pb-2 flex items-center"/);
  assert.match(fic, /\}, "取消"\)\) : null,/);
});
