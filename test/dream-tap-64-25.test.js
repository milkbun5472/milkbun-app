// 解梦馆点不着（她 2026-09-06：「找ta解按了没反应」→「有时候可以有时候又点不到」）。
//
// 不是逻辑：onClick 一直是对的。在浏览器里量出来那颗键是 **37×18**，
// 旁边的「删」是 **12×17**——仓库自己的线是【可点区域别低于 40 高】
// （施工规则/tabs-not-plain-pills.md §2）。18 高不到一半，
// 手指落下去有一半在旁边的空白上，所以是「有时候」。
//
// ⚠️「有时候能有时候不能」这句话本身就是判据：能稳定复现的是逻辑，
//   时灵时不灵的多半是【可点区域】或【被别的东西盖住了】。这一次是前者。
// ⚠️两颗一起垫：只垫「找TA解」的话，它右边 10px 就是【删】，按歪了改成点到删。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "dreamjournal.js"), "utf8");

test("tap() 是一处定义，六处小动作都从它拿", () => {
  const body = src.slice(src.indexOf("const tap = (extra) =>"), src.indexOf("const PINK ="));
  assert.match(body, /minHeight: 40/, "垫的高度不到 40");
  assert.match(body, /display: "inline-flex", alignItems: "center"/, "只给 minHeight 不给 flex，字会贴在顶上");
  // 真跑一遍，别只看字面
  // 真跑：F_BODY 是那个文件里的全局，这儿当参数递进去
  const tap = new Function("F_BODY", "return " + body.slice(body.indexOf("(extra)"), body.lastIndexOf(";")))("body-font");
  assert.equal(tap().minHeight, 40);
  assert.equal(tap({ color: "#000" }).color, "#000", "extra 没合进去");
  assert.equal(tap({ minHeight: 12 }).minHeight, 12, "extra 该盖得住默认值（Object.assign 的顺序）");
  // 六处：找TA解 / 删 / 展开收起 / 选谁来解 / 推门进这场梦 / 展开这场梦
  assert.equal((src.match(/style: tap\(/g) || []).length, 6, "有小动作没接上 tap()");
});

test("那两颗最小的键：找TA解成了真的一颗键，删也垫开了", () => {
  const row = src.slice(src.indexOf('busyId === e.id ? "解梦中…" : "找TA解"') - 700, src.indexOf('}, "删")') + 12);
  assert.match(row, /style: tap\(\{ color: PINK, padding: "0 13px", borderRadius: 999, border:/, "找TA解 还是裸的一行小字");
  assert.match(row, /style: tap\(\{ color: PSUB \}\) \}, "删"\)/, "删 还没垫开");
  // 「撤掉东西要删除」——旧那个裸样式不许留着
  assert.equal(src.indexOf('style: { fontFamily: F_BODY, fontSize: 11.5, color: t.tint } }'), -1, "旧的裸样式还在");
});

test("纸卡上的字色不跟主题走", () => {
  // 这张纸在任何主题下都是同一张浅纸（paperCard 写死 #f4efe4）。
  // t.tint / t.fog 在深色主题里是【给夜色用的浅色】，落在浅纸上会淡到看不见。
  assert.match(src, /const paperCard = \(extra\) => Object\.assign\(\{ background: "#f4efe4"/);
  assert.match(src, /const PINK = "#6f6796", PSUB = "#8b8276";/);
  // 这一页别处早就在用这两个色，不是新调的
  assert.ok((src.match(/#6f6796/g) || []).length >= 3, "PINK 不是从这一页现成的色里来的");
  assert.ok(src.includes('color: "#8b8276"'), "PSUB 不是从这一页现成的色里来的");
});

test("三条书签：形状照旧（选中的长），可点的那个框一直是 46", () => {
  const rib = src.slice(src.indexOf("const ribbon = (k, label)"), src.indexOf("return h(\"div\", { className: \"h-full flex flex-col\", style: nightBg }"));
  assert.match(rib, /height: 46, background: "transparent"/, "键本身又跟着选中态缩了");
  assert.equal(rib.indexOf("height: on ? 46 : 36"), -1, "旧的那行还在");
  // 缩的是带子：没选中的往下少垂 10px，那 10px 仍然点得着
  assert.match(rib, /top: 0, bottom: on \? 0 : 10/, "带子没在缩，等于三条一样长");
  assert.match(rib, /clipPath: "polygon\(0 0,100% 0,100% 100%,50% calc\(100% - 7px\),0 100%\)"/, "燕尾没了");
});

test("记梦那三颗也够 40", () => {
  ["dream", "fragment", "none"].forEach(k => {
    const i = src.indexOf('addEntry("' + k + '")');
    assert.ok(i > 0, k + " 那颗不见了");
    const seg = src.slice(i, i + 260);
    assert.match(seg, /minHeight: 40/, k + " 那颗还是 py-2（量出来 37）");
    assert.equal(seg.indexOf("py-2"), -1, k + " 还挂着旧的 py-2");
  });
});
