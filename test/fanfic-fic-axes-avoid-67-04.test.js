// 她 2026-09-11：「那个志怪板块怎么感觉写来写去都是一个套路，
//   都会有一篇是右位捡了一个小鬼或者精怪。」
//
// 两处病根：① 这一枪原来只有一句鲁布里克（「同一批里开场位置、核心推进方式、时间跨度、
// 叙述距离和收尾形状至少有三项彼此不同」）——说了五个维度，没说谁占哪一格；
// ② **它一个字都管不到上一批**。「写来写去」说的正是后者。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Axes = require("../js/axes.js");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
// ⚠️病历（那句鲁布里克的原文、「捡了个精怪」那几个字）写在注释里，不 strip 全是假红
const code = fic.split("\n").map(l => l.split("//")[0]).join("\n");
const box = { Axes, loadFics: () => [] };
vm.createContext(box);
const a = fic.indexOf("  const FIC_AXES = ["), b = fic.indexOf("  // ---- 批量生成 N 篇");
assert.ok(a > 0 && b > a, "没切到那一段");
vm.runInContext(fic.slice(a, b) + "\nthis.M = { FIC_AXES, AVOID_KEEP, ficAxesBlock, ficAvoidBlock };", box);
const M = box.M;
const F = (title, premise, tabId, at) => ({ tabId: tabId || "tab_yao", title: title, premise: premise, updatedAt: at || 1 });

test("那句鲁布里克删掉了，不是在它后面又加一句", () => {
  assert.ok(code.indexOf("同一批里开场位置、核心推进方式、时间跨度、叙述距离和收尾形状至少有三项彼此不同") < 0,
    "五个维度还摆在那儿当口号——说了没分，模型自己挑最顺手的几格");
  // 「别只换皮」那条禁令留着，但现在有出口了：各自那一条
  assert.match(code, /禁止只是换背景与人名却复用同一情节拍（开局位置、时间跨度、叙述距离、收尾形状那几样，上面已经按篇分好了，照各自那一条来）。/);
});

test("五个维度改成按篇掷，一格都不许写成剧情", () => {
  // ⚠️别用 deepEqual：vm 里出来的数组跟这边的原型不是同一个，永远不相等
  assert.equal(M.FIC_AXES.map(x => x.key).join(","), "open,engine,span,dist,close");
  // 一批最多 8 篇（生成弹窗那根滑杆 max:8），格子少于 8 就会撞
  M.FIC_AXES.forEach(ax => assert.ok(ax.opts.length >= 8, "「" + ax.zh + "」只有 " + ax.opts.length + " 格，八篇就撞"));
  assert.match(fic, /type: "range", min: 1, max: 8, value: n/, "滑杆改了上限，格子数也得跟着改");
  // ⚠️掷约束不掷答案：轴上不许出现具体的人、物、梗——写成剧情就是拿代码顶替想象力
  const flat = M.FIC_AXES.map(x => x.opts.join("｜")).join("｜");
  ["精怪", "小鬼", "狐", "捡", "妖", "鬼", "重生", "失忆", "契约", "标记"].forEach(w =>
    assert.ok(flat.indexOf(w) < 0, "轴上写了剧情：「" + w + "」"));
  const blk = M.ficAxesBlock(3, "n1");
  assert.match(blk, /⚠️这是【怎么写】，不是【写什么】：别把这几句话当梗写进正文，也别在文里点破。/);
  assert.equal(blk.split("· 第 ").length - 1, 3);
});

test("一批之内不重样（八篇也不撞）", () => {
  for (let i = 0; i < 60; i++) {
    const txt = M.ficAxesBlock(8, "s" + i);
    M.FIC_AXES.forEach(ax => ax.opts.forEach(o => {
      const n = txt.split(o).length - 1;
      if (n > 1) assert.fail("第 " + i + " 批里「" + o + "」出现了 " + n + " 次");
    }));
  }
});

test("天花板还给模型：出口没被掷没", () => {
  let free = 0, allFree = 0;
  for (let i = 0; i < 200; i++) {
    const txt = M.ficAxesBlock(3, "f" + i);
    if (txt.indexOf(Axes.FREE) >= 0) free++;
    if (txt.indexOf("你自己找一个跟上下几篇都不一样的角度") >= 0) allFree++;
  }
  assert.ok(free > 20, "「这一轴你自己想一个」几乎掷不到＝门关死了（" + free + "/200）");
  assert.ok(allFree > 0, "整组还回去那一档一次都没出现");
});

test("跨批那一半：这一版已经写过什么，得摆到它面前", () => {
  // 这才是「写来写去」那句话真正指的东西——按篇掷只管得住一批之内
  const list = [F("灯下客", "他捡回一只受伤的狐狸精，三年后它来还债。", "tab_yao", 3),
                F("庙祝", "庙里那位不肯走，说要等一个人。", "tab_yao", 2),
                F("别的版", "不该出现", "tab_abo", 9)];
  const blk = M.ficAvoidBlock({ id: "tab_yao" }, list);
  assert.match(blk, /【这一版已经写过这些】/);
  assert.match(blk, /· 《灯下客》：他捡回一只受伤的狐狸精，三年后它来还债。/);
  assert.ok(blk.indexOf("别的版") < 0, "别的版块的文混进来了——古风那几篇管不着志怪这一批");
  assert.match(blk, /上面这些里出现过的【开局、两个人凑到一起的理由、身份组合、收尾的收法】，这一批一个都不许重来。/);
  assert.match(blk, /\*\*换的是那件事本身，不是换个名字、换个天气、换个朝代。\*\*/,
    "不钉这一句，它会把「山里的狐狸」改成「湖里的鱼精」交差");
  // 空的时候不发一段空的
  assert.equal(M.ficAvoidBlock({ id: "tab_yao" }, []), "");
  assert.equal(M.ficAvoidBlock({ id: "tab_new" }, list), "");
});

test("avoid 单子只带标题和那一句设定，正文一个字都不进去", () => {
  const long = F("长的", "设".repeat(300));
  const blk = M.ficAvoidBlock({ id: "tab_yao" }, [long]);
  assert.ok(blk.indexOf("设".repeat(47)) < 0, "那一句没截断，十几篇就占掉一大块");
  assert.match(blk, /设{46}/);
  // 只留最近的那几篇：不封顶的话这一段会越长越大，她按次计费
  const many = Array.from({ length: 40 }, (_, i) => F("第" + i + "篇", "设定" + i, "tab_yao", i));
  const b2 = M.ficAvoidBlock({ id: "tab_yao" }, many);
  assert.equal(b2.split("· 《").length - 1, M.AVOID_KEEP);
  assert.ok(b2.indexOf("《第39篇》") > 0 && b2.indexOf("《第0篇》") < 0, "取的不是最近那几篇");
});

test("两样都真的接进了出一批文那一枪", () => {
  assert.match(code, /\+ ficAvoidBlock\(tab, loadFics\(\)\) \+ ficAxesBlock\(n, angleNonce\(\)\) \+ byBlock/);
  // 种子带时间：同一版连着出两批，不许两批掷到同一组角度
  assert.match(code, /function angleNonce\(\) \{ return String\(Date\.now\(\)\) \+ ":" \+ Math\.random\(\); \}/);
});

test("掷 + 一批之内不放回，抽成公共的了（旧的也搬过去）", () => {
  // one-public-mechanism：第二处出现时先开公共的，**已有的也搬过来**
  assert.match(fs.readFileSync(path.resolve(__dirname, "..", "js/axes.js"), "utf8"), /function batch\(groups, n, parts, sharedOpts\)/);
  assert.equal(code.split("Axes.batch(").length - 1, 2, "有一处还在自己写一套");
  // fanfic.js 里不许再留第二份「不放回」的实现
  assert.ok(code.indexOf("const seen = used[key] || (used[key] = {});") < 0, "旧的那份没搬走，同一层活在两处");
});
