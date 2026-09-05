const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const phone = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");

// v59.50：那三个页签名是别人家系统相册的原话（她 2026-09-01：「甚至都叫精选集」）。
// 这条要证的没变——**三页都在、三个 key 没动**；改的只是它们叫什么。
test("相册是三页完整界面", () => {
  assert.match(phone, /\["library", "全部"\]/);
  assert.match(phone, /\["collections", "他的几摞"\]/);
  assert.match(phone, /\["saved", "我收着的"\]/);
  assert.match(phone, /function AlbumNavIcon/);
  // 相册自己画整屏，不套外层 Head——v57.48 起这条由 FULL_BLEED_KEYS 表达
  assert.match(phone, /const FULL_BLEED_KEYS = \[[^\]]*"album"[^\]]*\];/);
  assert.match(phone, /FULL_BLEED_KEYS\.indexOf\(appKey\) < 0 && h\("div", \{\n    className: "shrink-0 px-4 pb-2 flex items-center gap-2"/);
});

// v59.50：名字换了、横滑改成竖排了，但**这五个 key 一个都不许动**——
// 回收站 30 天、五类保底、私密走 hidden 档全靠它们。这条钉的就是这个。
test("固定五类且二十五张时每类机械保底四张", () => {
  ["memory", "favorite", "saved", "private", "deleted"].forEach(k =>
    assert.match(phone, new RegExp('key: "' + k + '"'), "少了 " + k + " 这一摞"));
  assert.match(phone, /items\.length >= 20/);
  assert.match(phone, /buckets\[a\.key\]\.length < 4/);
  assert.match(phone, /正好 25 张互不重复的照片/);
  assert.match(phone, /memory或favorite或saved或private或deleted/);
});

test("图库按真实年月分组且禁止相对星期日期", () => {
  assert.match(phone, /m\[1\] \+ "年" \+ Number\(m\[2\]\) \+ "月"/);
  assert.match(phone, /date 必须写真实完整日期 YYYY-MM-DD HH:mm/);
  assert.match(phone, /禁止写周三、周五、昨天、最近等相对日期/);
});

test("相册底栏沿用聊天输入栏的四成安全区，不再垫高一截", () => {
  // 原来钉的是 "...* 0.4 + 4px" 加 minHeight:54——那还是在垫高，和这条测试自己的名字打架。
  // mobile-ui-layout.md §2 要求以主聊天输入栏为标尺：只吃 0.4 条安全区，不加 Npx、不用 minHeight。
  assert.match(phone, /paddingBottom: COMPOSER_PAD_BOTTOM, background: "rgba\(250,250,252,\.97\)"/);
  assert.doesNotMatch(phone, /safe-area-inset-bottom\) \* 0\.4 \+ 4px/);
  assert.doesNotMatch(phone, /padding: "7px 20px calc\(env\(safe-area-inset-bottom\) \+ 7px\)"/);
});

test("照片详情返回恢复进入前的滚动位置", () => {
  assert.match(phone, /returnScroll\.current = \{ top: scrollRef\.current \? scrollRef\.current\.scrollTop : 0/);
  assert.match(phone, /scrollRef\.current\.scrollTop = top/);
  // v62.60 详情往本尊靠（黑底满幅），顶栏改成这一页自己的一条，不再借 chrome()。
  // 但「返回要回到进入前那个位置」这件事没变，判词跟着换到新的返回键上。
  assert.match(phone, /onClick: closePhoto, "aria-label": "返回"/);
});

test("照片详情含日期、画面介绍、单独想法框和收藏按钮", () => {
  assert.match(phone, /photo\.date \|\| photo\.time/);
  assert.match(phone, /photo\.desc \|\| "没有留下介绍。"/);
  assert.match(phone, /对这张照片的想法/);
  assert.match(phone, /photo\.thought/);
  assert.match(phone, /onClick: \(\) => toggle\(photo\)/);
  // v62.60 起满幅照片压在黑底上（本尊就是这样），收藏键进顶栏右位。
  // 白底 + 圆角 20 缩略图 + #f2f2f7 圆角灰卡是通用详情页，换个 app 照样成立。
  assert.match(phone, /aspectRatio: "1 \/ 1\.12", overflow: "hidden" \} \}, art\(photo, 0, true\)\)/);
  assert.doesNotMatch(phone, /borderRadius: 17, background: "#f2f2f7"/);
});

test("收藏独立持久化且缩略图零 API 程序化渲染", () => {
  assert.match(phone, /loadJSON\("x_phoneKeep", \{\}\)/);
  assert.match(phone, /saveJSON\("x_phoneKeep", n\)/);
  assert.match(phone, /phoneStableHash\(\(it\.caption/);
  assert.match(phone, /linear-gradient/);
});
