// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债第 1 条：一起听（她点名的那一页）。
//
// 审计的判词：「它现在是一个做得挺认真的『网易云 lite』，不是『一起听』。」
// 整页搬进任何一个音乐 app，除了底纹那圈沟，没有一样东西不成立；而这一页跟别的
// 音乐 app 唯一的区别——**和某个人一起听**——只剩页脚一排 30px、半透明 0.5 的头像。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const LT = src.slice(src.indexOf("function ListenTogether("), src.indexOf("// 设置·情侣问答自定义题库"));
const CODE = LT.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("「一起」升到碟这一层，不再只是页脚一排小头像", () => {
  // 两个人一起听，在唱机上本来就有说法：碟不止一张。
  assert.match(CODE, /partner \? h\("div", \{ "aria-hidden": "true", style: \{ position: "absolute", left: -46/,
    "后面那张 TA 的碟没了");
  // ⚠️头像不能放在【后面那张的圆心】：前面那张 232 的碟会把它整个盖住，
  //   看上去只剩一道黑边（第一版就是这样）。露出来的那一牙才是能贴东西的地方。
  assert.match(CODE, /left: -40, top: 98, width: 36, height: 36, borderRadius: 999/, "TA 那枚小圆照没贴在露出来的那一牙上");
  assert.match(CODE, /h\(Avatar, \{ character: partner, size: 36, radius: 999 \}\)/);
  // 自己听就只有一张碟：这一层得是条件的，不能永远画两张
  assert.equal((CODE.match(/partner \? h\("div"/g) || []).length >= 2, true, "没选人的时候也画了第二张碟");
  assert.match(CODE, /partner \? "点唱片换封面 · 后面那张是 " \+ partner\.name : "点唱片换封面"/);
});

test("进度是唱针的行程，不是一根系统滑条", () => {
  // 一页程序画的唱片沟纹中间躺着一根 iOS 系统滑块——整页最裸的一件东西。
  const play = LT.slice(LT.indexOf("  const playTab ="), LT.indexOf("  const homeTab ="));
  assert.doesNotMatch(play, /type: "range"/, "那根原生 range 还在");
  assert.match(play, /role: "slider", "aria-label": "播放进度"/, "换掉之后没留可读的语义");
  assert.match(play, /onPointerDown: e => \{ const r = e\.currentTarget\.getBoundingClientRect\(\)/, "拖不动了");
  // 支点、臂、针：三样都在才是一条唱臂，少一样就是一根普通进度条
  assert.match(play, /width: 10, height: 10, borderRadius: 999, background: t\.ink, opacity: \.55/, "唱臂的轴没了");
  assert.match(play, /width: "calc\(\(100% - 18px\) \* " \+ frac\.toFixed\(4\)/, "走过的那截没上墨");
  assert.match(play, /transform: "rotate\(11deg\)"/, "针头没了");
  // 可点区不低于 40（tabs-not-plain-pills 那两条不许牺牲的之一）
  assert.match(play, /position: "relative", height: 40, cursor: "pointer", touchAction: "none"/);
});

test("一首歌只有一张皮：两套歌行并成一张曲目单", () => {
  // 本地那套是描边圆角卡、云村那套是分隔线平铺行——同一样东西两张皮，
  // 她说的「一段一段加的所以看起来很乱」在纸上就是这两行。
  assert.match(CODE, /const trackShell = \(children, key, on\) =>/);
  assert.match(CODE, /const trackNo = \(n, on, source\) =>/);
  // 两个调用点都得走同一张壳，否则又是两套
  const songRow = LT.slice(LT.indexOf("  const songRow ="), LT.indexOf("  // \"加到歌单\"选择层"));
  const cloudRow = LT.slice(LT.indexOf("  const cloudRow ="), LT.indexOf("  const cvChip ="));
  assert.match(songRow, /return trackShell\(\[/, "本地那套没并进来");
  assert.match(cloudRow, /return trackShell\(\[/, "云村那套没并进来");
  // 来源不靠两种长相区分，靠号位上那一枚小标记
  assert.match(CODE, /ic\(source === "netease" \? "cloud" : "note", t\.fog, 14\)/);
  // 正在放的那一首是跳动的竖杠，不是一个 ▶ 字符
  assert.match(CODE, /\[9, 12, 7\]\.map/, "正在放那一格的竖杠没了");
  assert.doesNotMatch(CODE, /playing \? "▶ " : ""/, "又拿字符当图标了");
});

test("行内动作全走 ic()，一页不许两种笔", () => {
  // 走场控制是自画 SVG，行内动作是 Unicode 字符（♥ ♡ ＋ × ✎ ☁＋ － 🗑 🌙）——
  // 同一页两种笔。字符钮还有个更实在的毛病：大小由字体定，同一行里高矮不齐，
  // 而 🗑 🌙 这类在她机器上会渲成豆腐块。
  ["moon", "plus", "minus", "pen", "trash", "cloudplus"].forEach(k =>
    assert.ok(CODE.indexOf('kind === "' + k + '"') > 0, "ic() 里没有 " + k));
  assert.match(CODE, /const rowBtn = \(kind, color, onClick, title, size\) =>/);
  assert.match(CODE, /width: 34, minHeight: 40/, "行内钮的可点区不够");
  // 界面文案里一个 emoji/字符图标都不许剩。
  // ⚠️展开必须用 [...str]，不能用 .split("")：后者把 🌙 这种四字节字符拆成两半代理，
  //   两半都落在下面那几段区间外——那条断言就成了永远抓不到 emoji 的空转
  //   （第一版正是这样，变异测试里它是唯一活下来的那个）。
  const inUI = [...(CODE.match(/"[^"\n]*"/g) || []).join("")].filter(ch => {
    const c = ch.codePointAt(0);
    return (c >= 0x1F000 && c <= 0x1FAFF) || (c >= 0x2600 && c <= 0x27BF) || c === 0xFE0F
      || "♥♡＋－✎☁▶".indexOf(ch) >= 0;
  });
  assert.deepEqual([...new Set(inUI)], [], "界面上还留着这些字符当图标：" + inUI.join(""));
});

test("三段 tab 照同页已有的分隔卡抄形状，底栏选中态不只换个色", () => {
  // 同一页的云村那排早就做成了「唱片架里的分隔卡」（cvChip），这三段没跟上。
  const tb = LT.slice(LT.indexOf("  const tabBtn ="), LT.indexOf("  // 三段【不是药丸】") + 1200);
  assert.match(LT, /borderRadius: "8px 8px 0 0", marginBottom: on \? -1 : 0/, "还是一排填色药丸");
  assert.match(LT, /height: on \? 44 : 36/, "没选的那张没往下缩——那就只剩色差了");
  // 底栏：选中的那一格顶上落一枚针头，形状和位置都变
  assert.match(LT, /const navBtn = \(k, label, iconEl\) => \{ const on = nav === k;/);
  assert.match(LT, /width: 18, height: 3, borderRadius: 2, background: t\.accent \|\| t\.ink/, "底栏选中态还是只换个色");
  assert.match(LT, /transform: on \? "translateY\(-1px\)" : "none"/);
});
