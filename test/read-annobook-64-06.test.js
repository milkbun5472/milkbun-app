// 一起读的「单调」那一半（她 2026-09-05：「继续吧宝宝然后做好看点」）。
//
// 单调的病根有两个，提示词那个上一版修了；剩下这个是：**写完的东西没有去处**。
// 批注和讲解写完就散在几十页里，翻回去只能一页页找——「一起读过这本书」这件事
// 在界面上不留任何痕迹。这一版补的就是那个痕迹（批注册），顺带把阅读页做成一张真的书页。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = fs.readFileSync(path.join(__dirname, "..", "js", "read.js"), "utf8");
const code = read.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

// 分组那一段抠出来真跑：这是这一页唯一有逻辑的地方
const group = (() => {
  // ⚠️从 AnnoBook 往后找：文件里别处也有 `const rows = []`，
  //   照第一处切会切出完全不相干的一段（第一版就是这么切出个语法错误的）。
  const a0 = read.indexOf("function AnnoBook(props)");
  assert.ok(a0 > 0, "找不到批注册");
  const i = read.indexOf("    const rows = [];", a0), j = read.indexOf("    const TONE = {", a0);
  assert.ok(i > 0 && j > i, "抠不出分组那一段");
  const body = read.slice(i, j)
    .replace(/\(book\.annotations \|\| \[\]\)/, "(B.annotations || [])")
    .replace(/book\.explains \|\| \{\}/g, "B.explains || {}")
    .replace(/book\.explains\[k\]/g, "B.explains[k]");
  return new Function("B", body + "\nreturn byPage;");
})();

test("收拢成【页 → 段 → 这一段上写过的几条】，不是一条一行", () => {
  // ⚠️这份桩是照【会出错的那一种形状】摆的，不是随手编的：
  //   第 0 页的最后一段和第 2 页的第一段【都是第 1 段】。
  //   换页时不把「当前段」清掉的话，第 2 页那条会被挂进第 0 页的段组里——
  //   页码就错了，而且不抛任何错。段号不撞的桩根本测不出这一条。
  const B = {
    annotations: [
      { page: 0, para: 0, note: "甲", charName: "他", ts: 1 },
      { page: 0, para: 0, note: "乙", charName: "他", ts: 2 },   // 同一段第二条
      { page: 0, para: 1, note: "丙", who: "user", ts: 4 },
      { page: 2, para: 1, note: "丁", charName: "他", channel: "read", ts: 5 }
    ],
    explains: { "0_1": { text: "戊", charName: "他", ts: 3 }, "2_1": { text: "己", charName: "他", ts: 6 } }
  };
  const g = group(B);
  assert.deepEqual(g.map(p => p.page), [0, 2], "页没有按顺序收拢");
  assert.deepEqual(g[0].paras.map(p => p.para), [0, 1], "段没有按顺序收拢");
  // 同一段上的两条要落在同一组里——原文才只印一次
  assert.equal(g[0].paras[0].items.length, 2, "同一段的两条被拆成了两组，那句原文会重复印两遍");
  assert.equal(g[0].paras[1].items.length, 2);
  assert.deepEqual(g[0].paras[0].items.map(x => x.text), ["甲", "乙"]);
  // 三种来路各自认得出来
  assert.equal(g[0].paras[0].items[0].kind, "ann");
  assert.equal(g[0].paras[1].items[0].kind, "ex", "讲解没被认出来");
  assert.equal(g[0].paras[1].items.map(x => x.kind).join(","), "ex,me", "同一段上的讲解和你记的没并在一起");
  assert.ok(g[1].paras[0].items.some(x => x.kind === "read"), "言秋亲读没被认出来");
  // 换页要把「当前段」清掉：第 0 页有第 1 段、第 2 页也有第 1 段，
  // 不清的话第 2 页那条会被挂进第 0 页的段组里
  assert.deepEqual(g[1].paras.map(p => p.para), [1], "第 2 页的第 1 段没有独立成组");
  assert.equal(g[1].paras[0].items.length, 2, "第 2 页第 1 段上那两条丢了");
  assert.equal(g[0].paras[1].items.length, 2, "上一页第 1 段被下一页的东西挤进来了（换页时没清「当前段」）");
  assert.equal(g[0].paras[1].items[1].name, "你", "你自己记的那条没标成「你」");
});

test("坏数据不许把这一册整个搞塌", () => {
  assert.deepEqual(group({}), []);
  assert.deepEqual(group({ annotations: [], explains: {} }), []);
  // explains 的键不是「页_段」的，跳过而不是算成 NaN 页
  const g = group({ annotations: [], explains: { "乱写": { text: "x" }, "1_2": { text: "y", ts: 1 } } });
  assert.deepEqual(g.map(p => p.page), [1]);
});

test("原文只印一次，挂在这一段那几条的上面", () => {
  const seg = code.slice(code.indexOf("function AnnoBook(props)"), code.indexOf("function SelExplainSheet"));
  assert.match(seg, /const quote = \(pa\.items\[0\] && pa\.items\[0\]\.anchor\) \|\| paraOf\(g\.page, pa\.para\);/);
  // 印在【段】这一层，不是印在每一条上
  assert.match(seg, /g\.paras\.map\(function \(pa\) \{[\s\S]{0,400}quote \? h\("div"/, "原文又印回每一条上了");
  assert.ok(!/pa\.items\.map\(function \(r, i\) \{[\s\S]{0,300}quote/.test(seg), "每一条里还在印原文");
});

test("左边那一列页码是可以点的——点了就翻到那一页", () => {
  const seg = code.slice(code.indexOf("function AnnoBook(props)"), code.indexOf("function SelExplainSheet"));
  assert.match(seg, /h\("button", \{ onClick: function \(\) \{ props\.onGoto\(g\.page\); \}/, "页码点不动");
  assert.match(seg, /h\("div", \{ style: \{ width: 1, flex: 1, minHeight: 12, background: t\.line/, "那条顺着页往下走的细轴没了");
  // 挂上去的那一头：跳完要把这一册关掉，不然人还停在册子里
  assert.match(code, /onGoto: function \(pg\) \{ setBookOpen\(false\); gotoPage\(pg\); \}/);
  // 整页（no-half-sheet），底纹铺外壳、顶栏透明（§3.5）
  assert.match(seg, /position: "fixed", inset: 0, zIndex: 60 \},\s*typeof pageSkin === "function" \? pageSkin\("paper"/);
  assert.match(seg, /h\(Head, \{ zh: "批注册", sub: book\.title, bg: "transparent"/);
  assert.match(seg, /这本还没有一条批注。/, "空的时候没有交代");
});

test("阅读页是一张真的书页：铺纸 + 页边记号，不再整段刷色", () => {
  const seg = code.slice(code.indexOf("const reader = h(\"div\", { ref: scrollRef"), code.indexOf("// ---- 底部翻页"));
  assert.match(seg, /pageSkin\("paper", t, \{ corner: false, strength: \.85 \}\)/, "正文区没铺纸");
  // 记号记在页边：批过的实线、只讲解过的点线，两种一眼分得开
  assert.match(seg, /borderLeft: hot \? \("2px " \+ \(anns\.length \? "solid" : "dotted"\) \+ " " \+ skinAlpha\(t\.tint, anns\.length \? "bb" : "77"\)\) : "2px solid transparent"/);
  assert.ok(!/background: hot \? \(t\.tint \+ "12"\)/.test(seg), "又整段刷底色了——一页几段就成花的");
  // ⚠️没记号的那一档也得占同样的宽度，否则有记号的段会整段横move一下
  assert.match(seg, /"2px solid transparent"/);
});

test("顶栏一行放得下：设定收进去，常驻只留读到哪儿 / 讲解 / 批注册", () => {
  const seg = code.slice(code.indexOf("const topbar = h(\"div\""), code.indexOf("const reader = h(\"div\", { ref: scrollRef"));
  // 原来「每次批 N 条」「范围 N 页」「讲解显示中」「批注册 N」硬塞一行，窄屏折成两行、词都断开
  assert.match(seg, /const \[setOpen, setSetOpen\]|setSetOpen\(!setOpen\)/, "设定没有收起来那个开关");
  assert.match(seg, /\(partner && setOpen\) \? h\("div"/, "那两个步进器还常驻在顶栏里");
  assert.match(seg, /whiteSpace: "nowrap"/, "钮上的字没锁住，还会断行");
  // 读到哪儿改成一条进度轴：比「3 / 47」看得出这本书有多厚
  assert.match(seg, /width: Math\.round\(\(\(pageIdx \+ 1\) \/ Math\.max\(1, totalPages\)\) \* 100\) \+ "%"/);
  assert.match(seg, /"第 " \+ \(pageIdx \+ 1\) \+ " 页 \/ 共 " \+ totalPages/);
  const cnt = code.slice(code.indexOf("const annoCount ="), code.indexOf("const annoCount =") + 160);
  assert.match(cnt, /\(book\.annotations \|\| \[\]\)\.length \+ Object\.keys\(book\.explains \|\| \{\}\)\.length/, "条数只数了批注，没算讲解");
});

test("阅读页顶栏那行死掉的英文眉标删了（no-english-titles）", () => {
  // Head 对纯拉丁的 en 本来就不发，所以 "Reading" 是一行死字——留着只会被下一个人抄走
  assert.ok(!/en: "Reading"/.test(read));
  assert.match(code, /h\(Head, \{ zh: book\.title, sub: partner \? "和 " \+ partner\.name \+ " 一起读" : "还没邀人", onBack: props\.onBack \}\)/);
});
