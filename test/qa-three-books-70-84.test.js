// 她 2026-09-18：「问答小本加新题现在是在设置里弄，能不能把它搬到问答小本的右上角，
//   然后多几个 customize 选项比如单开一本单独放题，可以自定义封面，
//   然后把角色问的题显示单独一本」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 分本那几个函数抠出来真跑——分错了不会报错，只是页跑到别本去了
const F = (() => {
  const i = scr.indexOf("const clothLift = (hex, amt) =>");
  const j = scr.indexOf("// 情侣空间·问答小本：翻页书", i);
  const ctx = { qhash: s => String(s).length };   // 只要稳定就行，这几条不验哈希本身
  vm.createContext(ctx);
  vm.runInContext(scr.slice(i, j) + "\nthis.o = { QA_BOOKS, qaBookOf, qaPoolOf, clothLift };", ctx);
  return ctx.o;
})();

test("三本：题库的、自己加的、他出的", () => {
  assert.deepEqual(F.QA_BOOKS.map(x => x.key).join(","), "all,custom,his");
});

// ⚠️「他出的题」不是新数据：那些条目落库时就带着 byCharacter: true
test("一条记录归哪一本，只看它自己身上的标记", () => {
  assert.equal(F.qaBookOf({ qid: "q07" }), "all");
  assert.equal(F.qaBookOf({ qid: "cx_abc" }), "custom");
  assert.equal(F.qaBookOf({ qid: "his_123", byCharacter: true }), "his");
  // 他出的题即使 qid 看着像别的，也还是他那本——标记优先
  assert.equal(F.qaBookOf({ qid: "cx_zzz", byCharacter: true }), "his");
  assert.equal(F.qaBookOf(null), "all", "脏数据别把整本弄崩");
  // app.js 那头确实是这么落的
  assert.match(app, /source: characterText\(char, "他出的"\), sealed: true, byCharacter: true/);
});

test("抽题：各本抽各本的，他出的那本没有池子", () => {
  const bank = [{ id: "q01", q: "甲" }, { id: "q02", q: "乙" }];
  const custom = ["丙", "丁"];
  const answered = new Set(["q01"]);
  assert.equal(F.qaPoolOf("all", bank, custom, answered).map(x => x.id).join(","), "q02");
  const cp = F.qaPoolOf("custom", bank, custom, answered);
  assert.equal(cp.map(x => x.q).join(","), "丙,丁");
  assert.ok(cp.every(x => String(x.id).indexOf("cx_") === 0), "自己加的题 id 要带 cx_ 前缀，不然归本会归错");
  // ⚠️比长度不比数组：vm 里造出来的是另一个 realm 的 Array，deepEqual 会因为原型不同而红
  assert.equal(F.qaPoolOf("his", bank, custom, answered).length, 0, "他出的题不该由她抽");
});

test("布面提亮只吃六位色号，别的原样退回去", () => {
  assert.match(F.clothLift("#5e2635", 0.22), /^#[0-9a-f]{6}$/);
  assert.equal(F.clothLift("红色", 0.22), "红色", "拼出废值会把整块底弄没（深色主题 t.ink 同一个坑）");
  assert.equal(F.clothLift("", 0.22), "");
});

test("加新题搬到了右上角，设置里那一份删干净了", () => {
  assert.match(scr, /bookKey === "custom" \? h\("button", \{ onClick: \(\) => setAddOpen\(true\)/, "右上角没有加题");
  assert.match(scr, /function QAAddSheet\(\{ partner, customQ, onSave, onClose \}\)/);
  // 搬＝删掉旧的，不是两处都留
  assert.ok(!/function CoupleQAConfig\(/.test(scr), "设置里那份还在——同一件事活两处");
  assert.ok(!/page === "qa"/.test(scr), "设置里还有问答那一层");
  assert.ok(!/title: "情侣问答", sub: "按角色管理自定义题目"/.test(scr), "设置首页那一格还在");
});

test("封面能改：名字 + 布面色，改完立刻看得见", () => {
  assert.match(scr, /function QACoverSheet\(\{ partner, spec, cfg, onSave, onClose \}\)/);
  assert.match(scr, /onSave\(\{ title: \(title \|\| ""\)\.trim\(\), tint: tint \}\)/);
  assert.match(scr, /const QA_CLOTHS = \[/);
  assert.match(app, /const saveQABook = \(charId, bookKey, patch\) =>/);
  assert.match(app, /saveJSON\("x_coupleQABooks", n\)/);
});

// ⚠️存档键不许跟着改名（这个仓库的老规矩）：x_coupleQATitle 原来是 {charId:"标题"}
test("老存档里那个标题还读得出来，而且改名时两边一起写", () => {
  assert.match(app, /if \(bookKey === "all" && typeof legacy === "string" && legacy\.trim\(\)\) return \{ title: legacy\.trim\(\) \};/);
  assert.match(scr, /if \(bookKey === "all" && patch && patch\.title && onSaveTitle\) onSaveTitle\(partner\.id, patch\.title\);/);
  assert.match(app, /saveJSON\("x_coupleQATitle", n\)/, "老键不许停写，不然旧版本读不回来");
});

test("书架那一层：三本摆出来，点一本才进去", () => {
  assert.match(scr, /if \(!book\) \{/);
  assert.match(scr, /QA_BOOKS\.map\(bk => \{/);
  assert.match(scr, /onClick: \(\) => \{ setBook\(bk\.key\); setMode\("cover"\); \}/);
  // 从一本里退出来是回书架，不是一步退出问答小本
  assert.match(scr, /h\(Head, \{ zh: "问答小本", en: partner\.name, onBack: \(\) => setBook\(null\), bg: "transparent",/);
});

// ── 日期框那一排会顶出屏幕（她 2026-09-18：「这里记下也是超了的」）──────────
// ⚠️病根是 input[type=date] 有个缩不下去的最小宽度（要摆得下「年/月/日」）：
//   光给 flex:1 拉不动它，整行被撑宽，最右边那颗按钮被顶出去。
//   两件事一起治：日期框给 minWidth:0（真让得动），按钮别跟它挤一排。
test("有日期框的那几排，日期都能让步", () => {
  const rows = scr.match(/h\("input", \{ type: "date",[\s\S]{0,420}?\}\)/g) || [];
  assert.ok(rows.length >= 5, "date 输入框找不全了：" + rows.length);
  rows.forEach(r => {
    if (/flex: 1/.test(r)) assert.match(r, /minWidth: 0/, "这个日期框 flex:1 却没 minWidth:0，缩不动：" + r.slice(0, 90));
  });
});

test("我们说好的：两处按钮都从日期那一排挪下来了", () => {
  const i = scr.indexOf("function CouplePacts({");
  const seg = scr.slice(i, scr.indexOf("function CoupleWishes({", i));
  // 自己记一条：「记下」整行
  assert.match(seg, /className: "w-full active:opacity-70 disabled:opacity-40"[\s\S]{0,260}?"记下"/);
  assert.ok(!/flexShrink: 0, opacity: day \? 1 : \.45 \}\) \}\),\n\s*h\("button"/.test(seg), "记下又挤回日期那一排了");
  // 挑日子：「就这天」和「不催了」自己一行
  assert.match(seg, /h\("div", \{ className: "flex items-center", style: \{ gap: 8, marginTop: 9 \} \},\n\s*h\("button", \{ onClick: \(\) => \{ if \(dueVal\)/);
  assert.match(seg, /style: \{ fontFamily: F_BODY, fontSize: 11\.5, color: PFOG, minHeight: 44, padding: "0 12px" \} \}, "不催了"/);
});

// 她 2026-09-18 第二张截图：「到那天他 · 来找你说 / 打给你 / 视频找你」挤同一排，
// 三个四字词各自被折成两行（「来找你／说」）。卡里侧只有三百来像素，摆不下。
test("「到那天他」那三枚印平分整宽，一个字都不折", () => {
  const i = scr.indexOf("function CouplePacts({");
  const seg = scr.slice(i, scr.indexOf("function CoupleWishes({", i));
  // 那句话挪到上面自己一行了
  assert.match(seg, /h\("div", \{ style: \{ fontFamily: F_BODY, fontSize: 10\.5, color: PFOG, marginBottom: 6 \} \}, characterText\(partner, "到那天他"\)\)/);
  assert.ok(!/marginRight: 2 \} \}, characterText\(partner, "到那天他"\)\),/.test(seg), "又挤回那一排了");
  // 三枚印平分、不折行
  assert.match(seg, /className: "flex-1 min-w-0 active:opacity-75"/);
  assert.match(seg, /minHeight: 40, padding: "0 4px", whiteSpace: "nowrap"/);
  // 选中那枚仍旧是【盖下去的朱印】：形状/底/字色/歪不歪四样都变，不是只填个色
  // （tabs-not-plain-pills.md），别为了不折行把这个一起改没了
  assert.match(seg, /transform: on \? "rotate\(-3deg\)" : "none"/);
  assert.match(seg, /background: on \? "#a83c30" : "transparent"/);
  assert.match(seg, /"aria-pressed": on \? "true" : "false"/, "读屏读不出选了哪一个");
});
