// v61.27 她 2026-09-03：「情侣空间和某个人一起的主页，感觉风格不是很统一，
// 有些有 emoji 有些还是一个方框」。
//
// 两件事一起坏了：
//  ① 「最近发生」那一列每行挂一个 emoji（💌📔📅🖼️✦）装在圆角小方块里。彩色 emoji 和
//     单色符号（✦）混在一排本来就不是一套；🖼️ 这类带变体选择符的字还会渲染成豆腐块。
//  ② 「我们的档案」用汉字水印「档」，旁边「愿望板」用符号「✦」——并排两张卡两套语言。
//
// 修法照仓库自己那条：不用 Unicode 方块/爱心字符当临时图标，要么复用现成 SVG，
// 要么根本不放字符。这一页底下「收着的」那一列书脊已经有一套语言了：一条色带认一样东西。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

const src = fs.readFileSync("js/screens.js", "utf8");
// 只看情侣空间那一段的【代码】，注释里出现这些字是在说明病情，不算犯规
const seg = (() => {
  const a = src.indexOf("function Us({ characters, couples,");
  const b = src.indexOf("// —— 名册视图（默认，v60.55 重做）——", a);
  return src.slice(a, b).split("\n").map(l => l.split("//")[0]).join("\n");
})();

test("情侣空间主页的代码里没有 emoji，也没有靠字体撑的符号图标", () => {
  const bad = seg.match(/[←-⯿\u{1F000}-\u{1FAFF}️]/gu) || [];
  assert.deepEqual([...new Set(bad)], [], "还留着这些字符当图标：" + [...new Set(bad)].join(" "));
});

test("最近发生长成一叠通知，不跟底下的书脊撞版式（v61.29）", () => {
  assert.match(seg, /const BAND = \{ letters: "#b08d52", exdiary: "#b08a66", timeline:/);
  // app 小图标是汉字（一定渲得出来），不是 emoji
  assert.match(seg, /const APPCH = \{ letters: "信", exdiary: "记", timeline: "日", album: "照", wishes: "愿", qa: "问" \};/);   // v62.10 加了他出的题
  assert.match(seg, /APPCH\[x\.sub\] \|\| "·"/);
  // 通知的两件套：毛玻璃、右上角写「多久以前」而不是日期
  assert.match(seg, /backdropFilter: "blur\(10px\)"/);
  assert.match(seg, /const notifyAgo = ts =>/);
  assert.match(seg, /return "刚刚";/);
  // 老的 icon 字段整条链都不许再有
  assert.ok(seg.indexOf("icon:") < 0, "recentItems 还在挂 icon");
  assert.ok(seg.indexOf("x.icon") < 0, "还在渲染 x.icon");
  // 那条 4px 色带只该留在【今天】那两行和书脊上，不该再出现在通知里
  assert.ok(seg.indexOf('height: 26, borderRadius: 99, background: BAND') < 0, "通知里还挂着书脊色带");
});

// v61.31 她：「这个通知栏做小一点吧，每次只显示三条固定高度，然后可以 scroll 看历史 15 条」
test("通知只露三条、高度写死、里面自己滚，历史留 15 条", () => {
  assert.match(src, /const NOTIFY_ROW = 50, NOTIFY_GAP = 7, NOTIFY_SHOW = 3, NOTIFY_KEEP = 15;/);
  // 高度必须由行高算出来：另拍一个像素值就是「一层写在两处」，一改行高第三条会露半截
  assert.match(src, /const NOTIFY_H = NOTIFY_ROW \* NOTIFY_SHOW \+ NOTIFY_GAP \* \(NOTIFY_SHOW - 1\);/);
  assert.match(seg, /height: NOTIFY_H, overflowY: "auto", overscrollBehavior: "contain"/);
  assert.match(seg, /height: NOTIFY_ROW,/);
  assert.match(seg, /recentItems\.slice\(0, NOTIFY_KEEP\)/);
});

test("能滚之后，越往下越淡越窄那一层必须去掉", () => {
  // 那是给「只有五条、一眼看全」做的；一旦能滚，第 8 条会淡到看不见、窄得对不齐。
  assert.ok(seg.indexOf("(0.82 - i * 0.09)") < 0, "还留着越往下越淡");
  assert.ok(seg.indexOf('width: (100 - i * 2.2)') < 0, "还留着越往下越窄");
  assert.ok(seg.indexOf("(0.12 - i * 0.018)") < 0, "还留着按序号算的阴影");
});

test("没到头的时候底下压一层渐隐，而且是主题色不是写死的粉", () => {
  assert.match(seg, /bRecent\.length > NOTIFY_SHOW \?/);
  assert.match(seg, /"linear-gradient\(transparent," \+ bgA\(0\.9\) \+ "\)"/);
});

test("能复用现成 SVG 的地方就复用（打卡、起始日）", () => {
  assert.match(seg, /h\(IHeart, \{ size: 13, color: "#c02a52", filled: true \}\), "打卡"/);
  assert.match(seg, /h\(IPencil, \{ size: 11, color: t\.tint \}\), "起始日"/);
});

// v62.31：这条的前提变了，所以整条重写（这个文件自己那句「检查一下这条还成不成立」
// 就是留给今天的）。原来两张卡靠【同一种水印】（各压一个 82px 的汉字）凑成一对；
// 她 2026-09-04 说「还是有点平淡」——病根正是那个：水印是装饰，两张卡本身还是圆角框，
// 原样搬到别的 app 里照样成立（tabs-not-plain-pills.md 的判据）。
// 现在两张各自【真的是那样东西】：档案是牛皮纸档案夹，愿望板是软木板上钉着的便签。
// 配成一对靠的不再是同一种装饰，是两样都从「点进去那一页是什么」长出来的。
test("并排那两张卡各自是一样真东西，不是压了个水印的圆角框", () => {
  assert.ok(seg.indexOf("fontSize: 82, lineHeight: 1") < 0, "那两个大水印字又回来了");
  // 档案＝档案夹：伸出来的索引标签 + 露出来的纸边 + 绕线扣（跟点进去那一页同一套语言）
  const a = seg.slice(seg.indexOf('openSub("archive")'), seg.indexOf('openSub("wishes")'));
  assert.match(a, /borderRadius: "0 0 7px 7px"/, "档案夹上那枚索引标签没了");
  assert.match(a, /background: "linear-gradient\(90deg,#fbf6ea,#efe6d2\)"/, "右边露出来的纸边没了");
  assert.match(a, /background: "#b09468"/, "绕线扣没了");
  // 愿望板＝软木板 + 歪着的便签 + 一枚真图钉
  const w = seg.slice(seg.indexOf('openSub("wishes")'), seg.indexOf('openSub("wishes")') + 1800);
  assert.match(w, /backgroundSize: "7px 7px, 11px 11px"/, "软木那层颗粒没了");
  assert.match(w, /transform: "rotate\(-1\.4deg\)"/, "便签摆正了就不像钉上去的");
  assert.match(w, /radial-gradient\(circle at 34% 30%,#f0899f,#b83b5c\)/, "图钉没了");
});
