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

test("「一起」是一整张封套，不是碟后面露的一牙（v62.81）", () => {
  // v62.46 把 TA 做成后面那张碟露一牙、碟整体右偏 22px、牙上贴一枚歪着的小头像——
  // 她 2026-09-05：「那个碟的页面还是有点丑，一起听这块也太小了」。
  // 所以：碟归碟——一张、居中、转着；「和谁听」另给一整张唱片封套。
  assert.doesNotMatch(CODE, /left: -46, top: 14, width: 204/, "后面那张碟又回来了");
  assert.doesNotMatch(CODE, /marginLeft: partner \? 22 : 0/, "碟又为了给 TA 让位往右偏了");
  assert.match(CODE, /const sleeveCard = h\("div"/, "封套没了");
  assert.match(CODE, /partner \? "和 " \+ partner\.name \+ " 一起听" : "自己听"/, "封套上没写跟谁听");
  // TA 为什么循环这一首：从 TA 的歌单里按这首歌找那句 note——查手机那张碟就是这么做的
  assert.match(CODE, /const nowNote = /);
  assert.match(CODE, /playlists\.find\(x => x\.charId === partner\.id\)/, "没去 TA 的歌单里找那句话");
  assert.match(CODE, /"TA 说：" \+ nowNote/);
  // 挑人在封套里翻开，不再是页脚一排半透明小头像
  assert.match(CODE, /const whoRow = /);
  assert.match(CODE, /pickWho \? h\("div", \{ style: \{ borderTop: "1px dashed "/, "封套翻不开");
  assert.doesNotMatch(CODE, /opacity: on \? 1 : 0\.5, border: on \? "2px solid "/, "页脚那排 0.5 透明度的小头像还在");
  // 封套排在队列前面：它是「一起」，比「接下来放什么」重要
  const play = LT.slice(LT.indexOf("  const playTab ="), LT.indexOf("  const homeTab ="));
  assert.ok(play.indexOf("sleeveCard,") > 0 && play.indexOf("sleeveCard,") < play.indexOf("// 当前队列（展开）"), "封套排到队列后面去了");
  // 开关的圆钮别写死 #fff（深色主题白底白钮）
  assert.doesNotMatch(CODE.slice(CODE.indexOf("const sleeveCard"), CODE.indexOf("const playTab")), /background: "#fff"/);
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

test("本地是曲目单、云村是碟——两样东西两张皮，但各自只有一张", () => {
  // v62.46：本地那套是描边圆角卡、云村那套是分隔线平铺行——那时它们是【同一样东西两张皮】，
  //   所以并成了一张曲目单。
  // v63.56 她要「发现」做成唱片店的新到架，这两处就不再是同一样东西了：
  //   · 本地曲库＝我已经有的歌，**手里没有封面** → 曲目单（trackShell）
  //   · 云村＝还不属于我的碟，**封面一直在手里**（toRes 从来就带 cover，只是没画出来）→ 碟（sleeve）
  //   判据没变，变的是答案：它俩现在真的不是一样东西。各自仍然只有一张皮。
  assert.match(CODE, /const trackShell = \(children, key, on\) =>/);
  assert.match(CODE, /const trackNo = \(n, on, source\) =>/);
  const songRow = LT.slice(LT.indexOf("  const songRow ="), LT.indexOf("  // \"加到歌单\"选择层"));
  const cloudRow = LT.slice(LT.indexOf("  const cloudRow ="), LT.indexOf("  const cvChip ="));
  assert.match(songRow, /return trackShell\(\[/, "本地那套没并进来");
  assert.match(cloudRow, /style: sleeve\(\{ gap: 8/, "云村那套没走碟套——它和「我的」那边的碟是同一个形状");
  assert.match(cloudRow, /\?param=100y100/, "碟上没画封面，那就还是一行字");
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
