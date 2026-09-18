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
  vm.runInContext(scr.slice(i, j) + "\nthis.o = { QA_FIXED, qaCustomBooks, qaAllBooks, qaBookOf, qaPoolOf, clothLift };", ctx);
  return ctx.o;
})();

// ⚠️v70.88 起「自己加的题」是【几本】，由她自己开（她 2026-09-18：
//   「我想要能多开几本自己按类型分」）。固定的只有题库那本和他出的那本。
test("书架：题库那本 → 自己加的那几本 → 他出的那本", () => {
  assert.equal(F.QA_FIXED.map(x => x.key).join(","), "all,his");
  // 一本都没开过（或者老存档）：那份扁平数组就是第一本
  assert.equal(F.qaAllBooks(["甲"], null).map(x => x.key).join(","), "all,cxb_cx,his");
  // 开了三本
  const cbs = [{ id: "b1", name: "轻的" }, { id: "b2", name: "重的" }, { id: "b3", name: "没敢问的" }];
  assert.equal(F.qaAllBooks([], cbs).map(x => x.key).join(","), "all,cxb_b1,cxb_b2,cxb_b3,his");
  assert.equal(F.qaAllBooks([], cbs).map(x => x.zh).join(","), "关于我们,轻的,重的,没敢问的,他出的题");
  // 每本自己一个布面色，别三本一个样
  const tints = F.qaCustomBooks([], cbs).map(x => x.tint);
  assert.equal(new Set(tints).size, 3, "几本用了同一个布面色");
});

// ⚠️「他出的题」不是新数据：那些条目落库时就带着 byCharacter: true
test("一条记录归哪一本", () => {
  const cbs = F.qaCustomBooks([], [{ id: "b1", name: "轻的", qs: ["甲"] }, { id: "b2", name: "重的", qs: ["乙乙"] }]);
  assert.equal(F.qaBookOf({ qid: "q07" }, cbs), "all");
  assert.equal(F.qaBookOf({ qid: "his_123", byCharacter: true }, cbs), "his");
  // 他出的题即使 qid 看着像别的，也还是他那本——标记优先
  assert.equal(F.qaBookOf({ qid: "cx_zzz", byCharacter: true }, cbs), "his");
  // ⚠️自定义题的 id 只跟【题目原文】有关，所以挪到别本，答过的那一页跟着走
  assert.equal(F.qaBookOf({ qid: "cx_" + 1 }, cbs), "cxb_b1", "「甲」在第一本");
  assert.equal(F.qaBookOf({ qid: "cx_" + 2 }, cbs), "cxb_b2", "「乙乙」在第二本");
  // 题目被删了：归到第一本，别让答过的那一页凭空消失
  assert.equal(F.qaBookOf({ qid: "cx_999" }, cbs), "cxb_b1");
  assert.equal(F.qaBookOf(null, cbs), "all", "脏数据别把整本弄崩");
  // app.js 那头确实是这么落的
  assert.match(app, /source: characterText\(char, "他出的"\), sealed: true, byCharacter: true/);
});

test("抽题：各本抽各本的，他出的那本没有池子", () => {
  const bank = [{ id: "q01", q: "甲" }, { id: "q02", q: "乙" }];
  const cbs = F.qaCustomBooks([], [{ id: "b1", name: "轻的", qs: ["丙", "丁"] }, { id: "b2", name: "重的", qs: ["戊"] }]);
  const answered = new Set(["q01"]);
  assert.equal(F.qaPoolOf("all", bank, cbs, answered).map(x => x.id).join(","), "q02");
  const cp = F.qaPoolOf("cxb_b1", bank, cbs, answered);
  assert.equal(cp.map(x => x.q).join(","), "丙,丁");
  assert.equal(F.qaPoolOf("cxb_b2", bank, cbs, answered).map(x => x.q).join(","), "戊", "抽到别本的题去了");
  assert.ok(cp.every(x => String(x.id).indexOf("cx_") === 0), "自己加的题 id 要带 cx_ 前缀，不然归本会归错");
  // ⚠️比长度不比数组：vm 里造出来的是另一个 realm 的 Array，deepEqual 会因为原型不同而红
  assert.equal(F.qaPoolOf("his", bank, cbs, answered).length, 0, "他出的题不该由她抽");
});

test("布面提亮只吃六位色号，别的原样退回去", () => {
  assert.match(F.clothLift("#5e2635", 0.22), /^#[0-9a-f]{6}$/);
  assert.equal(F.clothLift("红色", 0.22), "红色", "拼出废值会把整块底弄没（深色主题 t.ink 同一个坑）");
  assert.equal(F.clothLift("", 0.22), "");
});

test("加新题搬到了右上角，设置里那一份删干净了", () => {
  assert.match(scr, /isCustom \? h\("button", \{ onClick: \(\) => setAddOpen\(true\)/, "右上角没有加题");
  assert.match(scr, /function QAAddSheet\(\{ partner, bookName, customQ, onSave, onClose \}\)/);
  // 搬＝删掉旧的，不是两处都留
  assert.ok(!/function CoupleQAConfig\(/.test(scr), "设置里那份还在——同一件事活两处");
  assert.ok(!/page === "qa"/.test(scr), "设置里还有问答那一层");
  assert.ok(!/title: "情侣问答", sub: "按角色管理自定义题目"/.test(scr), "设置首页那一格还在");
});

test("封面能改：名字 + 布面色，改完立刻看得见", () => {
  assert.match(scr, /function QACoverSheet\(\{ partner, spec, cfg, ownBook, onDelete, onSave, onClose \}\)/);
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
  assert.match(scr, /shelf\.map\(bk => \{/);
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

// ── 自己加的题：多开几本按类型分（她 2026-09-18）─────────────────────────
// ⚠️存的形状变了，但存档键不许跟着改名：x_coupleQACustom 原来是 {charId:["题"]}，
//   那一份照旧读得出来、也照旧【被写】，旧版本读回去还是原来那个数组。
test("老存档那份扁平数组：读得出来，而且不停写", () => {
  assert.equal(F.qaCustomBooks(["甲", "乙"], null)[0].qs.join(","), "甲,乙", "老存档读不出来了");
  assert.equal(F.qaCustomBooks(["甲"], [])[0].key, "cxb_cx", "一本都没开时也得有一本兜着");
  // 有分本数据时以分本为准，老数组不再参与
  assert.equal(F.qaCustomBooks(["甲"], [{ id: "b1", name: "轻的", qs: ["丙"] }])[0].qs.join(","), "丙");
  // 界面那头每次存分本，都把第一本回写成那个扁平数组
  assert.match(scr, /if \(onSaveCustom\) onSaveCustom\(partner\.id, \(next\[0\] && next\[0\]\.qs\) \|\| \[\]\);/);
  assert.match(app, /saveJSON\("x_coupleQACustomBooks", n\)/);
  assert.match(app, /saveJSON\("x_coupleQACustom", n\)/, "老键停写了，旧版本读回去会空一片");
});

test("脏数据别把书架弄崩", () => {
  assert.equal(F.qaCustomBooks(null, null).length, 1);
  assert.equal(F.qaCustomBooks(["", "  ", "甲"], null)[0].qs.join(","), "甲", "空行也当成题了");
  // 没有 id 的那种不算一本
  assert.equal(F.qaCustomBooks([], [{ name: "没 id" }])[0].key, "cxb_cx");
  assert.equal(F.qaCustomBooks([], [{ id: "b1" }])[0].qs.length, 0, "qs 不是数组时应该当空的");
});

test("再开一本 / 改名 / 删本，都从同一个出口走", () => {
  const i = scr.indexOf("function CoupleQABook({");
  const seg = scr.slice(i, scr.indexOf("function QAAddSheet(", i));
  assert.match(seg, /const putCustomBooks = next => \{/, "存题本的路不只一条");
  assert.equal((seg.match(/onSaveCustomBooks\(partner\.id/g) || []).length, 1, "界面里又多写了一处存法");
  assert.match(seg, /"＋ 再开一本　"/);
  // 自己开的那几本，名字和布面色存在【题本自己身上】，不走封面那份配置——
  // 不然书架上读一处、翻开读另一处，迟早对不上
  assert.match(seg, /ownBook: isCustom,/);
  assert.match(seg, /\? \{ id: b\.id, name: \(patch\.title \|\| ""\)\.trim\(\) \|\| b\.zh, tint: patch\.tint \|\| b\.tint, qs: b\.qs \}/);
  // 最后一本不许删
  assert.match(seg, /onDelete: isCustom && cbs\.length > 1 \?/);
  assert.match(seg, /requestAppConfirm\("删掉「" \+ spec\.zh \+ "」这一本？"/);
});

test("加题只动当前这一本，不会把别本的题冲掉", () => {
  const i = scr.indexOf("function CoupleQABook({");
  const seg = scr.slice(i, scr.indexOf("function QAAddSheet(", i));
  assert.match(seg, /putCustomBooks\(cbs\.map\(b => b\.key === bookKey\n\s*\? \{ id: b\.id, name: b\.zh, tint: b\.tint, qs: arr\./, "存的时候没按本分");
  assert.match(seg, /customQ: \(curCB && curCB\.qs\) \|\| \[\],/, "加题框里装的不是这一本的题");
});
