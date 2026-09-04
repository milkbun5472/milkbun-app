const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const scr = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const grab = (a, b, why) => { const i = scr.indexOf(a), j = scr.indexOf(b, i); assert.ok(i >= 0 && j > i, "抠不出：" + why); return scr.slice(i, j); };
const load = (a, b, ret) => new Function(grab(a, b, a) + "\nreturn " + ret + ";")();

// 她 2026-08-30：「我就是不想要现在这版的底子，因为是参考了别人的，我想要一个我们自己的设计」
test("借来的那套版式不许再冒出来", () => {
  const dead = ["DiaryBarcode", "AUTHOR IDENTITY", "LAST SYNC", "TAP TO DECRYPT", "TAP THE BLURRED",
    "ENTRIES 收录", "ARCHETYPE:", "N° ", "diaryNoOf"];
  const back = dead.filter(k => scr.indexOf(k) >= 0);
  assert.deepEqual(back, [], "这几样是照着别人版式来的，又回来了：" + back.join("、"));
  // 日记那几页的顶栏一律走紧凑标题栏（mobile-ui-layout.md），不许再顶「BACK / INDEX」大字
  const entry = grab("function DiaryEntryView(", "\nfunction fmtClockShort", "全文页");
  assert.match(entry, /shrink-0 flex items-center px-4 pb-2/, "全文页没用紧凑标题栏");
  assert.match(entry, /safeTop\(10\)/, "顶栏没让开刘海");
  assert.ok(!/"BACK"|"INDEX"/.test(entry));
});

// B：划掉要有笔触，而且是画出来的
test("划掉的那句：手画的一道杠，从左到右画出来", () => {
  const inkStrokeUrl = load("function inkStrokeUrl(seed, rgb) {", "// 划掉的一句", "inkStrokeUrl");
  const a = inkStrokeUrl("d1_2", "43,38,34"), b = inkStrokeUrl("d9_7", "43,38,34");
  assert.match(a, /^url\("data:image\/svg\+xml,/, "不是 SVG 笔触");
  assert.ok(decodeURIComponent(a).indexOf("<path d='M0") >= 0, "画出来的不是一条路径");
  assert.notEqual(a, b, "每一句划出来都一模一样，那就不像手画的了");
  assert.equal(a, inkStrokeUrl("d1_2", "43,38,34"), "同一句每次渲染都换一道杠，会闪");
  const c = grab("function InkStruck(", "// 不肯说的那句", "InkStruck");
  assert.match(c, /backgroundSize: \(on \? 100 : 0\) \+ "% "/, "没有从 0 画到满的动画");
  assert.match(c, /transition: "background-size/, "没写过渡，等于直接蹦出来");
  assert.match(c, /backgroundRepeat: "repeat-y"/, "多行的段落只有第一行被划到");
  // 做成背景而不是绝对定位的兄弟节点：兄弟节点会盖住正文、换行还得自己算位置
  assert.ok(!/position: "absolute"/.test(c));
});

// B：秘密从「模糊」改成「墨块，点一下化开」
test("不肯说的那句：糊成墨块，点一下才化开", () => {
  const c = grab("function InkSecret(", "// 每个角色一种纸", "InkSecret");
  assert.match(c, /color: open \? ink : "transparent"/, "没把字盖住");
  assert.match(c, /radial-gradient/, "墨块是个纯色方块，不像手抹上去的");
  assert.match(c, /onClick: open \? undefined : \(\) => setOpen\(true\)/, "点不开，或者点开之后还能再点");
  assert.match(c, /boxDecorationBreak: "clone"/, "换行之后墨块会断成一长条");
  const entry = grab("function DiaryEntryView(", "\nfunction fmtClockShort", "全文页");
  assert.ok(!/filter: hidden \? "blur/.test(entry), "还留着旧的模糊做法");
  assert.match(entry, /点一下墨块，那句话会化开/, "没告诉她能点");
});

// C：每个角色一种纸
test("每个角色一种纸，而且是稳定的", () => {
  const src = grab("const DIARY_PAPERS = [", "function diaryPreview", "diaryPaperOf");
  const { diaryPaperOf, DIARY_PAPERS } = new Function(src + "\nreturn { diaryPaperOf, DIARY_PAPERS };")();
  assert.ok(DIARY_PAPERS.length >= 4, "纸的种类太少，几个角色就撞了");
  const a = diaryPaperOf({ id: "c1" });
  assert.equal(a, diaryPaperOf({ id: "c1" }), "同一个角色每次进来纸都不一样");
  assert.ok(DIARY_PAPERS.indexOf(a) >= 0);
  // 几个角色应当分得开
  const kinds = new Set(["c1", "c2", "c3", "c4", "c5"].map(id => diaryPaperOf({ id })));
  assert.ok(kinds.size >= 2, "几个角色全都是同一种纸");
  // 手动指定优先
  assert.equal(diaryPaperOf({ id: "c1", diaryPaper: "night" }), "night", "指定了纸也不听");
  assert.ok(DIARY_PAPERS.indexOf(diaryPaperOf({ id: "c1", diaryPaper: "乱写的" })) >= 0, "指定了不存在的纸没兜住");
});

test("封面、目录、全文三处都铺同一张纸", () => {
  const cover = grab("  const paper = diaryPaperOf(char);", "\nfunction DiaryStylePage", "封面");   // v62.18 文风编辑改名整页化，锚组件名
  assert.match(cover, /pageSkin\(paper, t, \{ corner: false \}\)/, "封面没铺纸");
  // 封面得是一本【本子】：有书脊、有贴上去的名签、有「收了 N 篇」
  assert.match(cover, /收了 " \+ list\.length \+ " 篇/, "封面上看不出这本收了几篇");
  assert.match(cover, /borderRadius: "3px 12px 12px 3px"/, "没有书脊那一侧的直角");
  assert.match(cover, /翻开/, "没有「翻开」这个动作");
  assert.match(cover, /px-4/, "外壳还留着太宽的边，日记本肉眼看不出放大");
  assert.match(cover, /maxWidth: "clamp\(280px, calc\(100vh - 362px\), 350px\)"/, "日记本没有大屏放大、小屏避让的尺寸兜底");
  assert.match(cover, /left: "13%", right: "9%", top: "18%"/, "只撑大了空纸，封面信息签没有跟着长大");
  assert.match(cover, /width: 74, height: 74/, "本子长大了，封面照片却还留在旧尺寸");
  assert.match(cover, /bottom: "calc\(env\(safe-area-inset-bottom\) \* \.4 \+ 18px\)"/, "翻页栏没有锚到底部安全区，整组居中会把下移量抵消");
  assert.match(cover, /size: 22/, "翻页箭头还是原来的小尺寸，变化看不出来");
  assert.ok(!/fontSize: 72|No\." \+/.test(cover), "又回到大字名字 + 编号那套了");
  const entry = grab("function DiaryEntryView(", "\nfunction fmtClockShort", "全文页");
  assert.match(entry, /pageSkin\(paper, t, \{ corner: false \}\)/, "全文页没铺纸");
  assert.match(entry, /const paper = isMe \? "paper" : diaryPaperOf\(char\)/, "全文页没按角色挑纸");
  assert.match(scr, /pageSkin\(isMe \? "paper" : diaryPaperOf\(curAuthor\)/, "目录页没铺纸");
});

test("摘要不许拿划掉的半句或票根开头（它们单看都不成句）", () => {
  const pv = grab("function diaryPreview(e) {", "\n\n// 全文页", "diaryPreview");
  assert.match(pv, /!x\.secret && !x\.struck && !x\.pasted/);
});
