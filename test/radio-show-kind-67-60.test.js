// 她 2026-09-12 排的第三条：电台加「节目类型」那一栏（比如他讲恐怖故事）。
//
// 原来整份 storyPrompt 钉死在【他讲他自己的经历】上，而且里头那句
// 「广播那头没有人、没有听众」正好把「讲故事给人听」整个禁死了。
// 她点名这一栏要管四件事：讲自己还是讲故事／有没有听众／根基那条管谁／章与章连不连。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const R = require("../js/radio-timeline.js");
const ui = fs.readFileSync(path.join(root, "js/radio-timeline-ui.js"), "utf8");

const char = { id: "he", name: "广播里那个", persona: "人设" };
const mk = show => R.create(char, "想听的事", "边界", "世界书", "b", show);
const 怪谈 = { label: "深夜怪谈", tell: "story", audience: "listeners", roots: "teller", chain: "standalone" };

test("这一栏不填＝今天的样子：老存档一个字都不变", () => {
  const old = { ...mk(null) };
  delete old.show;                      // v67.60 之前存下来的那几条线
  const p = R.storyPrompt(old, "past");
  assert.ok(p.includes("以广播中角色的第一人称，讲述自己的一段经历"));
  assert.ok(p.includes("广播那头没有人"));
  assert.ok(p.includes("他的来历、身份、已有的关系这些根基不改写"));
  assert.ok(p.includes("接着已有进展往下走"));
  assert.ok(!p.includes("【这档节目是什么】"));
  assert.deepEqual(R.showOf(old), { label: "", tell: "self", audience: "none", roots: "self", chain: "serial" });
  // 乱填的值也落回默认，不许把一个认不得的档位原样发出去
  assert.equal(R.normalizeShow({ tell: "随便什么" }).tell, "self");
});

test("四件事一起换：讲故事／有听众／根基只管他／一章一个", () => {
  const p = R.storyPrompt(mk(怪谈), "past");
  // ① 讲的不是他自己的事
  assert.ok(p.includes("你在广播里讲一个故事——**不是你自己的事**"));
  assert.ok(!p.includes("讲述自己的一段经历"));
  // ② 有人在听——「广播那头没有人」这句话没了，可真正要防的那件事还在
  assert.ok(!p.includes("广播那头没有人"));
  assert.ok(p.includes("广播那头有人在听"));
  assert.ok(p.includes("不点她的名字"), "把「没有听众」拆掉之后，真正拦的那件事跟着一起没了");
  assert.ok(p.includes("不停下来等谁回答"));
  // ③ 根基那条改管他这个讲的人
  assert.ok(p.includes("不改写的是**你这个讲的人**"));
  assert.ok(p.includes("故事里的人物、地方、来龙去脉和结局都归你编"));
  assert.ok(!p.includes("他的来历、身份、已有的关系这些根基不改写"));
  // ④ 章与章各讲各的
  assert.ok(p.includes("一章一个，各讲各的"));
  assert.ok(!p.includes("接着已有进展往下走"));
  // 顺带两句跟着换：第三人称是他在讲别人，主角也不再是他
  assert.ok(p.includes("故事里的人物他当然用第三人称讲"));
  assert.ok(!p.includes("**不要旁白、不要第三人称交代**"));
  assert.ok(p.includes("但不要另起一个旁白"));
  assert.ok(p.includes("故事里那个人是怎么被卷进去的"));
  // 节目名进了提示词
  assert.ok(p.includes("【这档节目是什么】深夜怪谈"));
});

test("四根轴各管各的：只换一根，别的照旧", () => {
  const onlyAudience = R.storyPrompt(mk({ audience: "listeners" }), "past");
  assert.ok(onlyAudience.includes("广播那头有人在听"));
  assert.ok(onlyAudience.includes("讲述自己的一段经历"), "只换了听众那一根，讲什么也跟着变了");
  assert.ok(onlyAudience.includes("他的来历、身份、已有的关系这些根基不改写"));
  // 讲故事、但根基照旧管他本人（她要一档「他讲他自己家的怪事」也说得通）
  const rooted = R.storyPrompt(mk({ tell: "story", roots: "self" }), "past");
  assert.ok(rooted.includes("你在广播里讲一个故事"));
  assert.ok(rooted.includes("他的来历、身份、已有的关系这些根基不改写"));
});

test("连线和陪听都跟着这一栏走", () => {
  const b = mk(怪谈);
  assert.ok(R.callPrompt(b, "past", { name: "空瓶子" }, "喂").includes("【这档节目是什么】深夜怪谈"));
  let withHeard = b;
  withHeard.fragments.push(R.accept({ title: "章", lines: [{ kind: "character", speaker: "广播里那个", text: "那天夜里。" }] }, "past", "f"));
  withHeard = R.reveal(withHeard, "f", 0, "旁边那位");
  const p = R.companionPrompt(withHeard, "旁边那位", "吓人吗");
  assert.ok(p.includes("讲的一个故事"));
  assert.ok(!p.includes("不是你真实经历过的事实"), "讲的是个故事，却还按「那不是你的经历」说");
  // 广播里那个人自己来陪听时同理
  const self = R.companionPrompt(R.reveal(withHeard, "f", 0, "he"), "he", "你编的？");
  assert.ok(self.includes("**那不是谁的经历**"));
});

test("界面：名字那一格自由填，四根轴照 SHOW_AXES 发，建线时交给 create", () => {
  assert.match(ui, /R\.create\(c, topic, limits, p\.loreFor\(c, topic\), uid\(\), show\)/);
  assert.match(ui, /R\.SHOW_AXES\.map\(ax => field\(ax\.zh,/, "四根轴不是照 SHOW_AXES 长出来的——又多了一份要同步的表");
  assert.match(ui, /"data-radio-show"/);
  assert.match(ui, /placeholder: "比如：深夜怪谈"/);
  // 纯英文标题一个都不许有（施工规则/no-english-titles.md）
  R.SHOW_AXES.forEach(ax => {
    assert.ok(/[一-龥]/.test(ax.zh));
    ax.opts.forEach(o => assert.ok(/[一-龥]/.test(o.zh)));
  });
});
