// 她 2026-09-12（看着「红外传感器的第三种解法」的已听回放，第 37–41 句）：
//   「现在电台好点了但是还是没头没尾。然后也没有剧情宝宝」
//
// v67.42 把三样里的两样治好了：确实长了（四十来句），也确实是第一人称讲他自己
// （没有「姐姐你听听看」了）。剩下的那一样是【形状】——整章是一串等重的句子，
// 「我做了什么……后来那个项目拿到了资助」，没有一件事、没有代价、没有落点。
//
// 三处病根，都是这个仓库反复见过的形状：
//  ① **只准编小事**：「改变人物根基的经历只采用用户明确给出的设定」＝不许发生有后果的事。
//     可这条分支本来就是沙盒（文件头第一行）。
//  ② 唯一一句管剧情的话（v67.41「有可辨认的起因、过程、人物选择及实际结果」）
//     夹在字数要求中间当从句；九段里八段在管形式。规则只降概率，位置决定它被不被看见。
//  ③ **一句一项**：accept() 本来就会再按句界拆一遍，所以这条一个字都没多换来——
//     换来的是模型连着吐四十个 JSON 对象，每句都写成能单独立住的样子。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = require("../js/radio-timeline.js");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
const make = () => R.create({ id: "c", name: "测试角色", persona: "完整人物设定" }, "分岔", "边界", "世界书", "b");
const P = () => R.storyPrompt(make(), "present");

test("这一章要是一件事：有头、有代价、有落点，还给了判据", () => {
  const p = P();
  assert.ok(p.includes("**这一章要是一件事，不是一段生平。**"), "剧情那条得自己独立成段，不是夹在字数里的从句");
  assert.ok(p.includes("它自己有头有尾"), "她报的就是「没头没尾」");
  assert.match(p, /开头落在某一天真正发生的一个场面上/);
  assert.match(p, /中间他得做点什么，而且做了要付出代价/);
  assert.match(p, /结尾停在一个看得见的画面、或一句真说出口的话上/);
  // 判据，不是样例（施工规则/prompt-no-content-samples.md）：说的是「怎么算成了」，
  // 不是「写成什么样」——照抄判据不会让每章长一个样。
  assert.match(p, /这一章单独播给一个没听过前文的人，他能说出「这讲的是什么事、最后怎么了」/);
  // Codex v67.41 的长线连续性没被这条挤掉
  assert.match(p, /本章落点之后，长线仍能往下走/);
});

test("轻重要分开：点名「后来……再后来……」那种交代过去的写法", () => {
  const p = P();
  assert.match(p, /同一章里【轻重要分开】/);
  assert.match(p, /别让全章每一句都是同一个分量、同一个速度/);
  assert.match(p, /别用「后来……再后来……」把关键的地方交代过去/, "她截图第 38 句就是这个：「后来那个项目拿到了学院的优选资助」");
});

test("沙盒里可以真的出事：钉的是根基，不是「只准编小事」", () => {
  const p = P();
  assert.ok(!p.includes("改变人物根基的经历只采用用户明确给出的设定"),
    "这句还在——它等于「不许发生有后果的事」，那就长不出剧情");
  assert.match(p, /他的来历、身份、已有的关系这些根基不改写/, "根基照旧不许动");
  assert.match(p, /他的决定可以有代价，事情可以往不好的方向去，可以留下收不回来的后果/);
  assert.match(p, /不必替他把风险都绕开/);
});

test("人称那条不再带一串节拍——那串正是「流水账」的骨架", () => {
  const p = P();
  assert.ok(p.includes("全篇只有他一个人的声音"), "人称这一层本身要在");
  assert.ok(!p.includes("我怎么到的那儿"), "节拍清单又回来了：它会被整串当成每一章的骨架照抄");
  assert.ok(!p.includes("我当时怎么判断"));
  // 人称说清楚靠的是这句对照，不是那串节拍
  assert.ok(p.includes("不是「他把耳罩拨开一点」，是「我把耳罩拨开一点」"));
});

test("拆句归代码、成文归模型：提示词要一段一项，占位值也得跟着改", () => {
  const p = P();
  assert.ok(!p.includes("每项是一句完整的话"), "一句一项又回来了");
  assert.match(p, /按【自然段】放进lines：一段一项/);
  assert.match(p, /\*\*不要一句一项\*\*/);
  assert.match(p, /播放器自己会按句子拆开来播，不用你替它拆/, "得说破「代码已经在做了」，否则它以为不拆就没人拆");
  // ⚠️一层写在两处：占位值是【形状】，散文和形状打架时模型信形状。
  assert.match(app, /"text":"本章正文的一个自然段（他的第一人称，整段照原样放，不要替播放器拆成一句一项）"/);
  assert.ok(!/完整章节按句界拆分后的这一句正文/.test(app), "占位值还写着「这一句」，那它照旧一句一项");
});

test("整段丢进来照样一句一张卡——有没有 Intl.Segmenter 都要拆得开", () => {
  const para = "那天下午下着雨。我把伞收了，站在门口等了十分钟。他一直没出来。";
  const withSeg = R.accept({ title: "章", lines: [{ kind: "character", speaker: "测试角色", text: para }] }, "past", "f");
  assert.deepEqual(withSeg.lines.map(x => x.text), ["那天下午下着雨。", "我把伞收了，站在门口等了十分钟。", "他一直没出来。"]);

  // 没有 Intl.Segmenter 的那条路：以前一段一项会整段变成一张两千字的卡
  const keep = Intl.Segmenter;
  delete Intl.Segmenter;
  delete require.cache[require.resolve("../js/radio-timeline.js")];
  try {
    const R2 = require("../js/radio-timeline.js");
    const mixed = "第一句在这儿。他说：「这事我不干。」你问呢？行！最后一句没有标点";
    const out = R2.accept({ title: "章", lines: [{ kind: "character", speaker: "测试角色", text: mixed }] }, "past", "f");
    assert.deepEqual(out.lines.map(x => x.text),
      ["第一句在这儿。", "他说：「这事我不干。」", "你问呢？", "行！", "最后一句没有标点"]);
    assert.equal(out.lines.map(x => x.text).join(""), mixed, "兜底那条路把字弄丢了");
  } finally {
    Intl.Segmenter = keep;
    delete require.cache[require.resolve("../js/radio-timeline.js")];
  }
});
