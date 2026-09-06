const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const codeOnly = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
const wb = (() => {
  const i = src.indexOf("function WorldBook({ entries");
  // v64.24：词条编辑从半窗改成整页，组件也跟着改了名（WorldBookEntrySheet → …Page）。
  const j = src.indexOf("function WorldBookEntryPage(", i);
  assert.ok(i > 0 && j > i);
  return src.slice(i, j);
})();

// 她 2026-09-03：「codex 重新做了一版世界书变得好平淡你改改」。
// 那一版是一张通用索引页：编号 + 标题 + 摘要 + 一行「去往：A / B / C」+ 一排药丸筛选，
// 原样搬到任何后台管理界面都成立（tabs-not-plain-pills 那把尺子）。

test("八个去向各有一个字的章，页面靠它立骨架", () => {
  assert.match(src, /const LORE_STAMP = \{ chat: "聊", subjects: "机", lifestyle: "生", diary: "记", study: "读", creative: "创", social: "世", debate: "擂" \}/);
  // 一排章：去的那几处盖上，没去的留空格
  assert.match(wb, /const stampRow = e => \{/);
  assert.match(wb, /background: on \? t\.ink : "transparent"/);
  assert.match(wb, /LORE_STAMP\[x\[0\]\] \|\| "\?"/);
  // 旧的那行「去往：A / B / C」整个删掉，不是留着说它不好
  assert.equal(codeOnly.indexOf('"去往：" + scopes.join'), -1, "旧的那行文字清单还在");
  // ⚠只在世界书这一段里找：别处（另一个页面的编号列表）也用 padStart，扫全文件会假红
  assert.equal(wb.indexOf('String(i + 1).padStart(2, "0")'), -1, "旧的那个 01/02 编号还在");
});

test("一处也没盖＝这条根本发不出去，整排转红并写明白", () => {
  assert.match(wb, /const none = !LORE_SCOPE_UI\.some\(x => loreScopeEnabled\(e, x\[0\]\)\)/);
  assert.match(wb, /一处也没盖 · 发不出去/);
  assert.match(wb, /color: on \? t\.bg : \(none \? t\.accent : t\.fog\)/);
});

test("筛选就是那排章：顶上那一排既是筛选器，也是这些字的对照表", () => {
  const filt = wb.slice(wb.indexOf('[["all", "全部"]]'), wb.indexOf('"全部状态"'));
  assert.equal(filt.indexOf("borderRadius: 999"), -1, "又摆回一排药丸了");
  assert.match(filt, /const ch = x\[0\] === "all" \? "全" : \(LORE_STAMP\[x\[0\]\] \|\| "\?"\)/, "筛选上印的就是词条上那个字");
  assert.match(filt, /background: on \? t\.ink : "transparent", border: "1px solid " \+ \(on \? t\.ink : t\.line\)/, "选中是盖了章，不是换个填色");
  assert.match(filt, /whiteSpace: "nowrap"/, "名字要一行放得下，换行会把整排顶歪");
  assert.match(src, /const LORE_STAMP_ZH = \{ chat: "聊天线下"/);
});

test("「什么时候翻出来」写在最显眼的位置：常驻是一枚签，关键词就把那个词写出来", () => {
  assert.match(wb, /const always = e\.alwaysOn \|\| !kw/);
  assert.match(wb, /clipPath: "polygon\(0 0,100% 0,100% 100%,50% 74%,0 100%\)"/, "常驻那枚是书签形，不是一个字");
  assert.match(wb, /\(e\.regex \? "\/" \+ kw \+ "\/" : "「" \+ kw \+ "」"\) \+ " 才翻出来"/);
});

test("「给谁看」用脸，不用一串名字——这个 app 里谁是有脸的", () => {
  assert.match(wb, /h\(Avatar, \{ character: c, size: 19, radius: 999 \}\)/);
  assert.match(wb, /marginLeft: ix \? -6 : 0/, "叠着排");
  assert.match(wb, /people\.length > 4 \? h\("span"[\s\S]{0,120}"\+" \+ \(people\.length - 4\)/, "超过四个要收口");
  assert.match(wb, /: h\("span", \{ style: \{ fontFamily: F_BODY, fontSize: 10\.5, color: t\.fog \} \}, "所有角色"\)/);
});

test("顶上那块大标语也撤了（子页面用紧凑标题栏）", () => {
  assert.equal(codeOnly.indexOf('"设定只去该去的地方"'), -1);
  assert.equal(codeOnly.indexOf('"INJECTION MAP"'), -1);
  assert.equal(codeOnly.indexOf('"LORE INDEX"'), -1);
  assert.match(wb, /fontFamily: F_DISPLAY, fontSize: 16\.5, color: t\.ink \} \}, "世界书"\)/);
  assert.match(wb, /一条设定要盖够章才送得出去/, "该说的那句话要留着，只是不再当大标语");
});
