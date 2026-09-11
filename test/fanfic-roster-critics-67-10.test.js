// 她 2026-09-11：「让圈子里的作者们也有机会书评刷出来吧，但是也要注意他们的 cp 立场。」
// 讨论定下来的：代码定【谁来、什么立场】，模型定【她说什么】；封顶 2 位；
// 新人按笔名从她配好的 CP 里定一对本命；对家只阴阳不冲人；只把带刺的记进圈子那本账。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Axes = require("../js/axes.js");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const code = fic.split("\n").map(l => l.split("//")[0]).join("\n");
const grab = name => {
  const i = fic.indexOf("function " + name + "(");
  assert.ok(i > 0, "找不到 " + name);
  let d = 0, j = fic.indexOf("{", i);
  for (let k = j; k < fic.length; k++) { if (fic[k] === "{") d++; else if (fic[k] === "}") { d--; if (!d) { j = k + 1; break; } } }
  return fic.slice(i, j);
};
// ⚠️桩照【写存档那几处】来：作者库是 {id,name,style,sore,...}（upsertAuthor 写的），
//   文是 {author, cp, tabId,...}（genBatch 的 records 写的），
//   CP 预设是 {id,label,cp:[id,id]}（MineCP 的 save 写的）。
const AUTHORS = [{ id: "a1", name: "青梅", style: "短句", sore: "结尾" },
                 { id: "a2", name: "老陈", style: "长句", sore: "不许写崩" },
                 { id: "a3", name: "新来的", style: "还没写过" },
                 // ⚠️本篇作者也得在名册里，不然「排掉她自己」那道闸拆了也测不出来
                 { id: "a4", name: "本篇太太", style: "写这一篇的那位" }];
const FICS = [{ author: "青梅", cp: ["c1", "c2"] },      // 跟这一篇同一对
               { author: "老陈", cp: ["c1", "c3"] }];    // 拆了这一对
// ⚠️不止一对：只有一对的话，「本命按笔名定死」那道闸拆了也照样返回同一对
const CPS = [{ id: "p1", cp: ["c2", "c3"] }, { id: "p2", cp: ["c5", "c6"] },
             { id: "p3", cp: ["c7", "c8"] }, { id: "p4", cp: ["c4", "c5"] }];
const box = {
  Axes: Axes, loadFics: () => FICS, loadAuthors: () => AUTHORS, loadCPs: () => CPS,
  loadCircle: () => [], cpLabel: (cp) => cp.join("×"),
  authorName: a => String((a && a.name) || "").trim(),
  findAuthor: nm => AUTHORS.filter(a => a.name === nm)[0] || null,
  circleFeud: () => false, circleLines: () => "· 旧账一条"
};
vm.createContext(box);
vm.runInContext(grab("authorFics") + grab("authorCPStats") + grab("authorShipKey") + grab("criticStance")
  + grab("rosterCritics") + grab("criticBlock")
  + "\nconst CRITIC_MAX = 2;\nthis.M = { authorShipKey, criticStance, rosterCritics, criticBlock, CRITIC_MAX };", box);
const M = box.M;
const FIC = { author: "本篇太太", cp: ["c1", "c2"], title: "长夜" };

test("立场是算出来的：同好 / 对家 / 不沾边", () => {
  assert.equal(M.criticStance("青梅", FIC, FICS, [], "我", []), "same", "磕同一对的该是同好");
  assert.equal(M.criticStance("老陈", FIC, FICS, [], "我", []), "rival", "磕 c1×c3 的是拆这一对的对家");
  // 一篇没写过的：按笔名从她配好的那几对里定死一对（c2×c3 跟这一篇共用 c2 → 也是对家）
  assert.equal(M.criticStance("新来的", FIC, FICS, [], "我", []), "rival");
  assert.equal(M.criticStance("新来的", { author: "谁", cp: ["c9", "c8"] }, FICS, [], "我", []), "far");
  // 本命是定死的：同一个笔名，掷多少次都是同一对
  const k = M.authorShipKey("新来的", FICS, [], "我");
  for (let i = 0; i < 20; i++) assert.equal(M.authorShipKey("新来的", FICS, [], "我"), k, "本命每次都变，那就不是她的本命");
  // 一对 CP 都没配过的时候没有立场这回事
  const b2 = Object.assign({}, box, { loadCPs: () => [] });
  vm.createContext(b2);
  vm.runInContext(grab("authorFics") + grab("authorCPStats") + grab("authorShipKey") + "\nthis.f = authorShipKey;", b2);
  assert.equal(b2.f("新来的", FICS, [], "我"), "");
});

test("有旧账的压过 CP 立场：那一条冲的是人", () => {
  const b2 = Object.assign({}, box, { circleFeud: () => true });
  vm.createContext(b2);
  vm.runInContext(grab("authorFics") + grab("authorCPStats") + grab("authorShipKey") + grab("criticStance") + "\nthis.f = criticStance;", b2);
  assert.equal(b2.f("青梅", FIC, FICS, [], "我", []), "feud", "同好但有过节，那还是过节那一档");
});

test("谁来、来几位：封顶 2，多数篇 0-1，本篇作者自己不算", () => {
  const seen = {};
  let far = 0;
  for (let i = 0; i < 400; i++) {
    const got = M.rosterCritics(FIC, "n" + i, { characters: [], userName: "我" });
    assert.ok(got.length <= M.CRITIC_MAX, "一下来了 " + got.length + " 位");
    seen[got.length] = (seen[got.length] || 0) + 1;
    got.forEach(c => {
      assert.notEqual(c.name, FIC.author, "本篇作者自己被算成来串门的了");
      if (c.stance === "far") far++;
    });
    assert.equal(new Set(got.map(c => c.name)).size, got.length, "同一位来了两次");
  }
  assert.ok(seen[0] > 120 && seen[1] > 80 && seen[2] > 20, "分布塌了：" + JSON.stringify(seen));
  assert.equal(far, 0, "这一篇有同好也有对家，不沾边的不该来");
  // 只有一位够格的时候也不许把她排两遍
  const b3 = Object.assign({}, box, { loadAuthors: () => [AUTHORS[0], AUTHORS[3]] });
  vm.createContext(b3);
  vm.runInContext(grab("authorFics") + grab("authorCPStats") + grab("authorShipKey") + grab("criticStance") + grab("rosterCritics")
    + "\nconst CRITIC_MAX = 2;\nthis.f = rosterCritics;", b3);
  for (let i = 0; i < 300; i++) {
    const one = b3.f(FIC, "one" + i, { characters: [], userName: "我" });
    assert.equal(new Set(one.map(c => c.name)).size, one.length, "只有一位够格，却排了两遍");
  }
  // 名册空着的时候一位都不来
  const b2 = Object.assign({}, box, { loadAuthors: () => [] });
  vm.createContext(b2);
  vm.runInContext(grab("authorFics") + grab("authorCPStats") + grab("authorShipKey") + grab("criticStance") + grab("rosterCritics")
    + "\nconst CRITIC_MAX = 2;\nthis.f = rosterCritics;", b2);
  assert.equal(b2.f(FIC, "n1", {}).length, 0);
});

test("不沾边的多半不来——只有没人跟这篇有关系时才偶尔露面", () => {
  const FAR = { author: "本篇太太", cp: ["c8", "c9"], title: "别的" };   // 谁都不沾
  let came = 0, tries = 300;
  for (let i = 0; i < tries; i++) if (M.rosterCritics(FAR, "f" + i, { characters: [], userName: "我" }).length) came++;
  assert.ok(came > 0, "一次都不露面＝这一档白留了");
  assert.ok(came < tries * 0.2, "不沾边的来得太勤了（" + came + "/" + tries + "）");
});

test("给模型的是立场和她的卡，不是判语", () => {
  const blk = M.criticBlock([{ name: "青梅", stance: "same" }, { name: "老陈", stance: "rival" }], FIC);
  assert.match(blk, /【圈子里这几位也来了】/);
  assert.match(blk, /· 「青梅」——路数：短句；碰不得：结尾。立场：跟这一篇磕的是同一对/);
  assert.match(blk, /立场：她磕的是【拆了这一对】的另一对（共用其中一个人）/);
  // ⚠️只给立场不给判语：「她会阴阳你」这种话进去，它就只照着那个词演
  ["她会阴阳", "关系很差", "她讨厌"].forEach(w => assert.ok(blk.indexOf(w) < 0, "下判语了：" + w));
  // 必须署真名，不许现编
  assert.match(blk, /\*\*一位一条，不许多、不许少，也不许现编别的太太\*\*/);
  // 对家的分寸（她定的 A 档）
  assert.match(blk, /⚠️\*\*不许人身攻击、不许骂人\*\*。同人圈的对家就是这个火候，撕起来反而假。/);
  // 雷点那一栏终于用上了
  assert.match(blk, /要是这一篇正好动到了她「碰不得」的那一点，她那条就冲那一点去；没动到就别硬扯。/);
  assert.match(blk, /⚠️也不是每位来都为了夸。/, "不拦一句，八条全是商业互吹");
  // 输出要带的两栏
  // ⚠️断的是【跑出来的那段话】，那里头是真引号；源码里才是 \\" 转义
  assert.match(blk, /各加一个 "pen"：/);
  assert.match(blk, /带刺的（阴阳、冷嘲、挑刺、翻旧账）再加 "barbed":true/);
  // 一位都没来时一个字都不发
  assert.equal(M.criticBlock([], FIC), "");
});

test("接进那一枪了，而且只记带刺的那几条", () => {
  const g = fic.slice(fic.indexOf("async function genReviews("), fic.indexOf("  // ---- 我评论/回复"));
  assert.ok(g.length > 600, "没切到 genReviews");
  assert.match(g, /const critics = rosterCritics\(fic, uid\("rv"\) \+ Math\.random\(\), \{ characters: characters, userName: userName \}\);/);
  assert.match(g, /\+ criticBlock\(critics, fic\) \+/, "算出来了却没拼进去＝没写");
  // 只认真在名册里的笔名：模型现编的一律当普通读者
  assert.match(g, /const fromRoster = pen && roster\[pen\] && String\(x\.author \|\| ""\)\.trim\(\) === pen;/);
  assert.match(g, /pen: fromRoster \? pen : "",/);
  // ⚠️只记带刺的：夸的不记，不然这本账会被评论淹掉
  assert.match(g, /if \(fromRoster && x\.barbed && own\) \{/);
  assert.match(g, /circlePush\(\{ a: pen, b: own, kind: "snark", title: fic\.title, say: String\(x\.content\)\.trim\(\)\.slice\(0, 60\) \}\);/);
  // 圈子那本账认得出这一笔，也说得出来
  assert.match(code, /snark: "在对方的文底下阴阳过"/);
  assert.match(grab("circleLines"), /e\.kind === "snark"/, "记了却不往外说，那这笔账等于没记");
});

test("名册里那几位的名字点得进她的主页", () => {
  assert.match(code, /r\.pen && props\.onOpenAuthor/);
  assert.match(code, /onClick: function \(\) \{ props\.onOpenAuthor\(r\.pen\); \}/);
  assert.match(code, /onOpenAuthor: function \(nm\) \{ setAuthorStart\(nm\); setView\("authors"\); \}/);
  assert.match(code, /startName: authorStart, onStartUsed: function \(\) \{ setAuthorStart\(""\); \}/);
  // 那一页翻到她那一条；名册里查无此人时不炸、也不乱开一页
  const ap = fic.slice(fic.indexOf("function AuthorsPage(props)"), fic.indexOf("  // 一位作者的主页"));
  assert.match(ap, /const hit = window\.Fanfic\.loadAuthors\(\)\.filter\(function \(a\) \{ return String\(a\.name \|\| ""\)\.trim\(\) === nm; \}\)\[0\];/);
  assert.match(ap, /if \(hit\) setOpen\(hit\.id\);/);
  assert.match(ap, /props\.onStartUsed && props\.onStartUsed\(\);/, "不清掉的话返回列表会被当场又弹回她的主页");
});
