// 她 2026-09-05（对着心上那一页的截图）：
//   「心上还是一个个框，改改吧，然后这套词也改改：盒子，根，刻痕，蜕变轴，生长时间线，
//     火苗，毕业，枯萎，告别小诗。还有这一页好多 emoji 也改掉。
//     还有这个告别小诗我也从来没收到」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const heart = fs.readFileSync(path.join(__dirname, "..", "js", "heart.js"), "utf8");
// 文件头那一整段【就是在解释这些词为什么被换掉】，照原文搜会把解释本身当成违规
const code = heart.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("告别小诗从来没收到：毕业原来被一个附带字段吞掉了", () => {
  // 抠出 applyMellow 真跑一遍
  const i = heart.indexOf("function applyMellow(box, d, todayKey)");
  const j = heart.indexOf("// ---- 回头看 probe", i);
  assert.ok(i > 0 && j > i, "抠不出 applyMellow");
  const applyMellow = new Function("box", "d", "todayKey",
    heart.slice(heart.indexOf("{", i) + 1, j).replace(/return box;[\s\S]*$/, "return box;"));
  const mk = () => ({ list: [{ id: "d1", text: "想学着煮茶", status: "active", weight: .5, born: 1 }], persona: [], lastMellow: "" });

  // ⚠️病灶：模型只交了 id 和那句话、没交自我认知——原来整件事连同那句话一起被丢掉
  let box = mk();
  applyMellow(box, { graduate: { id: "d1", poem: "煮了三个月，水开的声音记住了。" } }, "2026-09-05");
  assert.equal(box.list[0].status, "graduated", "少一个 persona 就不算长成了——那句话跟着一起没了");
  assert.equal(box.list[0].poem, "煮了三个月，水开的声音记住了。", "他留下的那句话丢了");
  assert.ok(box.list[0].gradTs > 0);
  assert.deepEqual(box.persona, [], "没交自我认知就不该硬添一行");

  // 三样都交齐时照旧
  box = mk();
  applyMellow(box, { graduate: { id: "d1", poem: "一句话", persona: "我是一个会等的人" } }, "2026-09-05");
  assert.equal(box.persona.length, 1);
  assert.equal(box.persona[0].text, "我是一个会等的人");
  assert.equal(box.persona[0].poem, "一句话");
  assert.equal(box.echoPending.persona, "我是一个会等的人");

  // 连那句话都没有也照样算长成（他就是没留话）
  box = mk();
  applyMellow(box, { graduate: { id: "d1" } }, "2026-09-05");
  assert.equal(box.list[0].status, "graduated");
  assert.equal(box.list[0].poem, "");

  // id 对不上 / 没有 graduate 的时候不许乱动
  box = mk();
  applyMellow(box, { graduate: { poem: "只有一句话没有 id" } }, "2026-09-05");
  assert.equal(box.list[0].status, "active");
  box = mk();
  applyMellow(box, { graduate: null }, "2026-09-05");
  assert.equal(box.list[0].status, "active");
});

test("刚长成的那一条端到最上面——攒着和收到是两件事", () => {
  const seg = code.slice(code.indexOf('const fresh = (b.list || [])'), code.indexOf("TA 长出来的自我"));
  assert.match(seg, /e\.status === "graduated" && e\.gradTs && Date\.now\(\) - e\.gradTs < 14 \* 86400000/,
    "没有「最近一个盘点周期内」这道筛子");
  assert.match(seg, /\.sort\(\(x, y\) => \(y\.gradTs \|\| 0\) - \(x\.gradTs \|\| 0\)\)\[0\]/, "不是取最新那一条");
  assert.match(seg, /"他刚放下一件事 · "/);
  assert.match(seg, /fresh\.poem\s*\?/, "他留下的那句话没端出来");
  assert.match(seg, /"这次他没留下话。"/, "没留话的时候没有交代，那一块会空着");
  assert.match(seg, /"他自己写的 · 攒了 "/, "没说清这是他自己写的");
});

test("那九个词一个都不许再出现在界面和提示词里", () => {
  ["盒子", "刻痕", "蜕变轴", "生长时间线", "火苗", "告别小诗"].forEach(w =>
    assert.ok(!code.includes(w), "还留着旧词：" + w));
  // 「毕业」「枯萎」「根：」这三个要连着看：存档里的英文值不许动，只换给人看的那一面
  assert.ok(!/"毕业"|毕业成|毕业，|没有毕业|绝不许毕业/.test(code), "界面/提示词里还在说「毕业」");
  assert.ok(!/枯萎/.test(code), "还留着「枯萎」");
  assert.ok(!/"根：" \+/.test(code), "还留着「根：」");
  // 换成的说法都在
  ["心上 · ", "打哪儿来：", "做过的：", "他这一路（", "长成了", "放下了"].forEach(w =>
    assert.ok(code.includes(w), "新说法没接上：" + w));
  // ⚠️存进档的英文值一个都不许动——改了几个月的念想全读不回来
  ["graduated", "withered", "active", "ash", "echo", "spark", "vine"].forEach(v =>
    assert.ok(code.includes('"' + v + '"'), "存档里的值被改了：" + v));
});

test("提示词那一头跟着一起换了——不然界面和模型各说各的", () => {
  // 只改界面的话，模型照旧写「刻痕」「毕业」，一页上会同时出现两套说法
  const specs = code.slice(code.indexOf("function museSpec"), code.indexOf("function timelineOf"));
  ["刻痕", "盒子", "毕业", "枯萎"].forEach(w => assert.ok(!specs.includes(w), "提示词里还在教模型说「" + w + "」"));
  assert.match(specs, /上次做过的/);
  assert.match(specs, /大多数盘点日没有谁长成/);
});

test("这一页不许再有 emoji", () => {
  // 分层注释里那几个（🔒🌱📚♻️）是仓库规矩自己的记号，不是界面上的东西
  const ui = code;
  // ⚠️✕ 不算：它是这个 app 通用的关闭符号（八个文件都在用），不是这一页的装饰
  const bad = (ui.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu) || []).filter(c => "🔒🌱📚♻️⚠️✕".indexOf(c) < 0);
  assert.deepEqual([...new Set(bad)], [], "界面上还有 emoji：" + bad.join(" "));
  // 换成的是【程序画的】和【汉字】
  assert.match(code, /icon: e\.source === "vine" \? "岔" : e\.source === "spark" \? "闪" : "起"/);
  assert.match(code, /icon: "成"/);
  assert.match(code, /icon: "放"/);
});

test("念想不再是一个个一样的框：形状本身说清了轻重和状态", () => {
  const i0 = code.indexOf('const dim = e.status === "ash"');
  assert.ok(i0 > 0, "找不到那张纸条");
  const seg = code.slice(i0, code.indexOf("b.avoid.length ?", i0));
  // 左边那条竖杠＝分量（高度按 weight 算），不再另摆一排火苗
  assert.match(seg, /const barH = 22 \+ Math\.round\(Math\.max\(0, Math\.min\(1, e\.weight \|\| 0\)\) \* 52\)/);
  assert.match(seg, /height: grown \? "calc\(100% - 22px\)" : barH/, "竖杠的高度没跟着分量走");
  // 圆角只在右边——左边是压着盒沿的那一边
  assert.match(seg, /borderRadius: "2px 13px 13px 2px"/);
  assert.match(seg, /borderLeft: "none"/);
  // 还在心上的浮起来、落灰的贴回去：靠形状分，不只靠色差
  assert.match(seg, /boxShadow: dim \? "none" :/);
  // 长成了盖一枚印、放下了一道横杠——都不是 emoji
  assert.match(seg, /fontSize: 9\.5, color: ACCENT \} \}, "成"\)/);
  assert.ok(!/weightBar/.test(code), "那个没人用的分量控件还留着（撤东西要删，不是留着）");
  // 长出来的自我不能跟念想长一个样
  const per = code.slice(code.indexOf("b.persona.slice().reverse().map"), code.indexOf("心上 · "));
  assert.match(per, /borderLeft: "3px double "/, "长出来的自我还是跟念想同一个框");
  assert.match(per, /borderRadius: 0/);
});
