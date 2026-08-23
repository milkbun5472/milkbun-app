const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = fs.readFileSync(path.join(__dirname, "..", "js/engine.js"), "utf8");

// 她 2026-08-22：「线下重 roll 出来的东西和上一把几乎一模一样」
//              「放了个自定义文风进去也没参考」

const grab = name => {
  const i = engine.indexOf("function " + name + "(");
  return engine.slice(i, engine.indexOf("\n}", i) + 2);
};

// —— 自定义文风 ——
// 病根两层：① offlineStyleText 只在内置表里找，自定义文风住 localStorage，查不到就返回空串；
//          ② session.stylePrompt 存着空串时 "" != null 成立，按 key 回退那条路也被堵死。
const styleText = (key, stored) => new Function("loadJSON",
  engine.slice(engine.indexOf("const OFFLINE_STYLES = ["), engine.indexOf("\n}", engine.indexOf("function offlineStyleText(")) + 2) +
  "\nreturn offlineStyleText;")(() => stored)(key);

test("自定义文风查得到——它不在内置表里", () => {
  const mine = [{ key: "custom_1", name: "我的", prompt: "写得像半夜的日记，句子短，别抒情。" }];
  assert.equal(styleText("custom_1", mine), "写得像半夜的日记，句子短，别抒情。");
  // 内置的一个都不能坏
  assert.match(styleText("film", mine), /电影镜头语言/);
  assert.equal(styleText("default", mine), "");
  // 查不到的 key 仍然安全返回空串
  assert.equal(styleText("nope", mine), "");
  assert.equal(styleText("custom_1", null), "", "读不到存储时不许抛");
});

test("空串不许堵住按 key 回退", () => {
  // 源码层面：两处都要用真值判断，不是 != null
  const hits = engine.match(/const styleText = session\.stylePrompt \? session\.stylePrompt : offlineStyleText\(session\.styleKey\);/g) || [];
  assert.equal(hits.length, 2, "单人线下与群线下各一处");
  assert.ok(!/session\.stylePrompt != null \? session\.stylePrompt/.test(engine), "旧的 != null 判断不许留着");
  assert.match(engine, /"" != null 成立会把按 key 回退整个堵死/, "为什么改，得写在代码里");
});

test("文风真的会被拼进提示词", () => {
  // v55.41 起前面多了一段优先级声明，所以只钉「以 styleText 结尾、条件是 styleText」
  assert.equal((engine.match(/\(styleText \? "[\s\S]{0,600}?" \+ styleText : ""\)/g) || []).length, 2);
});

// —— reroll ——
const excerpt = new Function(grab("offlineRerollExcerpt") + "\nreturn offlineRerollExcerpt;")();

test("reroll 要避开的原文给足，不再截到 220 字", () => {
  assert.equal(excerpt("他推门进来。"), "他推门进来。");
  const long = "甲".repeat(1800);
  const out = excerpt(long);
  assert.ok(out.length > 1300, "只给 " + out.length + " 字还是太少");
  assert.ok(out.includes("（中略）"), "太长时取头+尾，中间明示省略");
  assert.ok(out.endsWith("甲"), "结尾那一拍最容易原样重来，必须覆盖到");
  // 空白统一压掉，别让换行把额度吃光
  assert.equal(excerpt("他 说\n\n  话"), "他 说 话");
  assert.equal(excerpt(null), "");
});

test("单人与群 reroll 都换成新的摘要函数", () => {
  assert.equal((engine.match(/offlineRerollExcerpt\(session\.rerollAvoid\)/g) || []).length, 2);
  assert.ok(!/rerollAvoid\)\.replace\(\/\\s\+\/g, " "\)\.slice\(0, 220\)/.test(engine), "220 字截断不许留着");
  assert.match(engine, /模型只看得到开头 15%，后面照抄一遍也不算违规/, "病因写在代码里");
});

// 她 2026-08-22 贴了两版 reroll 对照 + 一份四千字的自定义文风：
// 两版事件顺序完全相同（走进马场→灰马→伸手→被咬→拉进怀里→训斥→揉手腕→德顺楼说书），
// 最后那句邀约几乎逐字一样；而那份文风（雨雾缱绻、禁一切明喻、情绪不叫名字）一个字没生效，
// 正文里还留着「铁钳似的」这种明喻。

test("自定义文风要压过内置叙事准则——它俩本来就打架", () => {
  assert.equal((engine.match(/【文风要求 · 文体层最高优先】/g) || []).length, 2, "单人与群线下各一处");
  assert.match(engine, /在【句式、意象、比喻、格式、节奏、禁用词、段落安排】这些【怎么写】的事情上，它高于上文任何通用叙事准则/);
  // 拿她那条真实冲突当例子，模型才知道该听谁的
  assert.match(engine, /它若禁止一切明喻，那就一个「像／似的／仿佛」都不许有，上文的「每段最多一次」不作数/);
  // 但硬规矩不许被文风带走
  assert.match(engine, /人称、视角归属、场景与事实的连续性、不替用户做决定这些硬规矩不受它影响/);
});

test("长文风要在尾部重申，否则被前面几千字稀释", () => {
  assert.match(engine, /const styleTail = !isDigital && styleText && styleText\.length > 200/);
  assert.match(engine, /〔再说一遍·文体以用户设定的文风为准〕/);
  assert.match(engine, /写完扫一眼它的禁区清单再交/);
  // 必须真的挂进最终尾注
  assert.match(engine, /const finalNudge = tailNudge \+ \(isDigital \? "" : userActionTail\) \+ characterSupplyTail \+ styleTail;/);
  // 短文风不折腾（内置那几条一句话的没必要重申）
  assert.match(engine, /styleText\.length > 200/);
});

test("reroll 要换的是节拍，不是措辞", () => {
  assert.match(engine, /〔重写要换的是【这一拍怎么走】，不是措辞〕/);
  assert.match(engine, /上一版把句子写得更细、更长，但事件顺序一模一样，那不算重写/, "她两版正是这个情况");
  // 给出可勾选的四项，别只说「要不一样」
  ["从哪儿切入", "按什么顺序推进", "重心落在谁身上", "停在哪里"].forEach(k =>
    assert.ok(engine.includes(k), "换节拍的清单少了：" + k));
  // 收尾是最容易原样重来的地方，单独点名
  assert.match(engine, /【尤其是收尾】上一版最后那句邀约／提议／反问，连同它提到的地点、人名、吃食，这次一个都不许重复出现/);
  assert.match(engine, /同义替换、把同样的事写得更华丽，都不算换/);
});
