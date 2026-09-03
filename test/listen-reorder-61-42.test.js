// 她 2026-09-03：「宝宝你把云村重做一遍吧，我感觉好多功能都是一段一段加的
// 所以看起来很乱，你帮他重新排序一下让我容易看一点吧」→「哦哦哦我的意思是一整个一起听」
//
// 查下来乱在一处：**没有一句判据决定东西该放哪**，只能按加进来的先后往上摞。
// 于是「我喜欢的音乐」在三个地方各有一份、歌单散在两个 tab、
// 「曲库」这个名字底下装的全是设置。
// v61.42 立的判据是【这首歌已经是我的了吗】：
//   还不是 → 发现 / 已经是 → 我的 / 正在放 → 播放 / 压根不是歌 → 设置
// 这几条钉的是那句判据落没落地，不是长相。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const cut = (from, to, what) => {
  const i = src.indexOf(from); assert.ok(i > 0, "抠不出" + what);
  const j = src.indexOf(to, i); assert.ok(j > i, "抠不出" + what + "的结尾");
  return src.slice(i, j);
};
const MINE = cut("  const mineTab = h(\"div\"", "  // ============ 云村", "我的 tab");
const CLOUD = cut("  const cloudTab = h(\"div\"", "\n  return h(\"div\", { className: \"h-full flex flex-col relative\"", "发现 tab");
const NAVBAR = cut("    // 底部 tab。v61.42", "    h(\"input\", { ref: audioFileRef", "底 tab");

test("四个 tab 的名字对得上它们装的东西", () => {
  assert.match(NAVBAR, /navBtn\("cloud", "发现"/, "「推荐」没改名——它装的是搜索/日推/FM/榜单，是【还不是你的】");
  assert.match(NAVBAR, /navBtn\("home", \(apiBase && cookie\) \? "设置" : "首页"/,
    "「曲库」还叫曲库——里面全是接口/Cookie/登录，真正的曲库已经搬去「我的」了");
  // 判据写进代码里，下一个人加东西时不用再想一遍
  assert.match(NAVBAR, /这首歌已经是我的了吗/, "判据没写下来");
});

test("「我喜欢的音乐」只剩一份", () => {
  // 原来三份：发现 tab 的入口卡、我的 tab 的大卡、我的 tab 歌单列表里那一条同名的。
  assert.doesNotMatch(CLOUD, /"我喜欢的音乐"/, "「发现」里还摆着它——那是她已经有的东西");
  // ⚠️别去数字符串出现几次：一处是【滤掉它】的那行代码，一处是没连账号时
  //   本地收藏才顶用这个名——那两者永远不会同时出现在屏幕上。要数就数【画出来的卡】。
  const cards = (MINE.match(/fontSize: 16, color: t\.ink \} \}, ("我喜欢的音乐"|\(apiBase && cookie\) \? "本地收藏" : "我喜欢的音乐")/g) || []).length;
  assert.equal(cards, 2, "画出来的卡应该正好两张：网易云那张 + 本地那张（后者只在没连账号时才叫这个名）");
  assert.match(MINE, /\(apiBase && cookie\) \? "本地收藏" : "我喜欢的音乐"/,
    "连了账号时本地那张必须改叫「本地收藏」，否则屏幕上两张同名卡");
  // 账号自动建的那张同名歌单必须从列表里滤掉，否则大卡底下又是同一样东西
  assert.match(MINE, /p\.mine && p\.name !== "我喜欢的音乐"/, "歌单列表没把它滤掉");
});

test("歌单和最近播放都归到「我的」，不再散在两处", () => {
  assert.match(MINE, /"我建的 · "/, "我建的歌单不在「我的」里");
  assert.match(MINE, /"我收藏的 · "/, "收藏的歌单没单独一段——原来跟自建的混在一列");
  assert.match(MINE, /"最近播放"/, "最近播放没搬进「我的」");
  assert.doesNotMatch(CLOUD, /cvChip\("pls"|cvChip\("recent"/, "「发现」里那两个药丸还在");
  assert.match(CLOUD, /cvChip\("rec", "今天给你的"\), cvChip\("top", "大家在听"\)/, "「发现」不是两栏");
});

test("公共的行渲染器定义在 mineTab 之前——否则「我的」只能又抄一份", () => {
  // 这是「一段一段加」最直接的一处：cvPlRow 原来在云村区（mineTab 后面），
  // 于是「我的」里手抄了一份歌单行。两份实现，改一处必漏另一处。
  const iRow = src.indexOf("  const cvPlRow = pl =>");
  const iMine = src.indexOf("  const mineTab = h(\"div\"");
  assert.ok(iRow > 0 && iMine > 0 && iRow < iMine,
    "cvPlRow 又跑到 mineTab 后面去了——那样 mineTab 里引用它会 TDZ 白屏，只能再抄一份");
  assert.match(MINE, /mine\.map\(cvPlRow\)/, "「我的」没用公共的歌单行");
  assert.match(MINE, /fav\.map\(cvPlRow\)/, "收藏那一段也得用公共的");
  // ⚠️延迟调用的必须包一层箭头：onClick: loadRecent 是【立刻取引用】，照样 TDZ。
  assert.match(MINE, /onClick: \(\) => loadRecent\(\)/, "又写成直接传引用了，会白屏");
});

test("分栏不是一排药丸", () => {
  const chip = cut("  const cvChip = (k, label) =>", "  const cvPlRow = pl =>", "分栏");
  // 判据：原样搬到别的 app 还成立吗（tabs-not-plain-pills.md）
  assert.doesNotMatch(chip, /borderRadius: 999/, "又是圆角药丸");
  // 选中态不许只靠填个色——形状/高度/位置至少还要变一样
  assert.match(chip, /height: on \? 44 : 34/, "选中和没选一样高，色弱只剩形状可依");
  assert.match(chip, /borderRadius: on \? "10px 10px 0 0"/, "上圆下方那个形状没了");
  assert.match(chip, /alignSelf: "flex-end"/, "没选的那张没有往下沉");
  assert.match(chip, /marginBottom: -1/, "选中那张没长进底下的内容里");
  // 可点区域不许低于 40px（tabs-not-plain-pills.md 第 1 条）
  const hs = [...chip.matchAll(/height: on \? (\d+) : (\d+)/g)][0];
  assert.ok(Number(hs[1]) >= 40, "选中那张只有 " + hs[1] + "px，点不着");
});
