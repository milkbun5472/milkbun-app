// 她 2026-09-18：「哈哈哈宝宝你的字怎么是从右往左读的，还有要不要做大点，三个字的塞不下」
//
// 花册右边那一列索引签是竖排（writing-mode: vertical-rl）。截图里「花册」显示成
// 「册花」、「碎片盒」显示成「盒碎片」——不是字写反了，是**每张签被压扁了**：
//   外面那个壳是 position:sticky + height:0，可用主轴尺寸＝0；
//   flex 项默认 flex-shrink:1，于是每张签被压到 min-content；
//   竖排的 min-content 就是【一列一个字】，两个字当场断成两列；
//   而中文竖排的列序是右→左，两列读起来正好反过来。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "js/fairy-garden.js"), "utf8");
const rail = () => {
  const i = src.indexOf('writingMode: "vertical-rl"');
  assert.ok(i > 0, "竖排索引签没了");
  const a = src.lastIndexOf('h("div", { style: { position: "sticky"', i);
  const b = src.indexOf('label + (n ? " " + n : "")', i);
  assert.ok(a > 0 && b > i, "抠不出那一列索引签");
  return src.slice(a, b);
};

// ⚠️这一条是整个修复：壳是 height:0，不关掉 shrink 就一定被压扁
test("每张签不许被压扁——外面那个壳可用高度是 0", () => {
  const seg = rail();
  assert.ok(seg.includes("flexShrink: 0"), "又会被压到 min-content，字还是从右往左读");
  assert.ok(/position: "sticky", top: headH \+ 10, height: 0/.test(seg),
    "壳的写法变了——shrink 那条的理由要跟着重看一遍");
});

test("第二道：竖排也不许断列", () => {
  const seg = rail();
  assert.ok(seg.includes('whiteSpace: "nowrap"'), "以后谁把 height:0 拿掉，它会再断一次列");
});

test("三个字的塞得下：高度是内容撑的，minHeight 只当地板", () => {
  const seg = rail();
  const m = /minHeight: (\d+)/.exec(seg);
  assert.ok(m, "minHeight 没了");
  // 两个字的那几张（屋里/邻居/相处）靠这个地板撑起可点区；三个字的由内容自己撑高
  assert.ok(Number(m[1]) >= 48, "地板比可点区还矮");
  assert.ok(!/maxHeight|height: \d+, minWidth/.test(seg), "给签子封了顶——封了顶就又要断列了");
  // 她要的「做大点」
  assert.ok(/fontSize: on \? 14 : 13/.test(seg), "字号没跟着大一档");
});

test("签子宽了，正文的右边距要让得开", () => {
  const seg = rail();
  const w = /minWidth: on \? (\d+) : (\d+)/.exec(seg);
  assert.ok(w, "宽度没了");
  const widest = Math.max(Number(w[1]), Number(w[2]) + 7);   // 没选中那几张往外探出 7px
  const pads = [...src.matchAll(/padding: "16px (\d+)px 40px 16px"/g)].map(x => Number(x[1]));
  assert.ok(pads.length >= 8, "各页的右边距只找到 " + pads.length + " 处，多半漏了几页");
  pads.forEach(p => assert.ok(p > widest, "有一页的正文会被索引签压住：右边距 " + p + " ≤ 签宽 " + widest));
});

test("七张是挨个排下来的，没有谁被挤出屏幕", () => {
  const seg = rail();
  assert.ok(/flexDirection: "column"/.test(seg), "变回横排就会把最后一张挤出屏幕");
  const labels = [...src.matchAll(/\["(?:notes|shards|things|museum|bottle|crew|bond)", "([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(labels, ["花册", "碎片盒", "屋里", "收藏馆", "漂流瓶", "邻居", "相处"], "七张签少了或改名了");
  // 最长的也就三个字：这是上面那条高度估算成立的前提
  labels.forEach(l => assert.ok(Array.from(l).length <= 3, "「" + l + "」有四个字了——那一列会长到屏幕外"));
});
