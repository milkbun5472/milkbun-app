// 审美审计（AUDIT-AESTHETIC-2026-09-04）还债③：设置整块。
//
// 审计判词：设置首页和它底下二十二个子页共用一个【没有 style 的外壳】，上面摆的是
// 「圆角行卡＋一个字＋右箭头」和「大圆角卡＋一个几何符号＋箭头」——这两样放进
// 任何 app 的设置页都成立，所以它们没从「这一页是什么东西」里长出来。
// 设置现实里是【这台机器的那张登记表】：一格一格填、每格有栏号。
// 改三个公共件 + 外壳一处，二十二个子页一起有底。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const CFG = src.slice(src.indexOf("function Config(props)"), src.indexOf("function ApiConfig"));
const CODE = CFG.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");

test("外壳是一张工程格纸，铺在最外层、顶栏透上来", () => {
  // 铺在滚动区上的话顶栏那一条还是平色，顶上横一道没盖住的带子（mobile-ui-layout §3.5）
  assert.match(CFG, /return h\("div", \{ className: "h-full flex flex-col", style: sheet \}/, "底纹没铺在最外那层外壳上");
  assert.match(CFG, /bg: "transparent"/, "顶栏没让底纹透上来");
  assert.match(CFG, /className: "flex-1 min-h-0 overflow-y-auto/);
  // 细格 + 每五格一道重线：只有一套等距线的话那是稿纸，不是工程格纸
  const fine = (CFG.match(/00 0 7px," \+ t\.ink \+ "07 7px 8px\)/g) || []).length;
  const bold = (CFG.match(/00 0 39px," \+ t\.ink \+ "14 39px 40px\)/g) || []).length;
  assert.equal(fine, 2, "细格不是横竖各一套");
  assert.equal(bold, 2, "每五格那道重线不是横竖各一套");
  // ⚠️深色/自定义主题下 t.ink 未必是六位色号，拼透明度后缀会拼出废值、整层静默消失
  assert.match(CFG, /const _hex6 = \/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(t\.ink \|\| ""\)\)/);
  assert.match(CFG, /const sheet = !_hex6 \? \{ background: t\.bg \}/, "验不过没退回纯色");
  // 底不跟着滚：内容在动，底不该动
  assert.doesNotMatch(CFG, /backgroundAttachment/);
});

test("三个公共件都是表上的格子，不是浮起来的圆角卡", () => {
  const shared = src.slice(src.indexOf("// ── 设置这一整块：一张登记表"), src.indexOf("function AutoRefreshConfig"));
  assert.ok(shared.length > 1200, "取到的那一段不对");
  // 方角 + 发丝细边 + 不浮起来（表格是印在纸上的，不是贴上去的）
  assert.equal((shared.match(/borderRadius: 3/g) || []).length, 3, "三个件里有没改成方角的");
  assert.equal((shared.match(/boxShadow: "none"/g) || []).length, 2, "还留着浮起来的那层阴影");
  assert.doesNotMatch(shared, /boxShadow: "0 9px 24px/, "旧那层阴影还在");
  // 线用的是同一份，别各写各的
  assert.match(shared, /const CFG_LINE = t2 => \(\/\^#\[0-9a-f\]\{6\}\$\/i\.test\(String\(t2\.ink \|\| ""\)\) \? t2\.ink \+ "24" : t2\.line\)/);
  assert.equal((shared.match(/CFG_LINE\(t\)/g) || []).length, 2, "有件没用那份公共线");
  // 栏号牌一处画、两处用（首页那一列和子页的格子）
  assert.match(shared, /function ConfigMark\(\{ char, tint, size \}\)/);
  assert.match(CFG, /h\(ConfigMark, \{ char: row\.char, tint: row\.tint \}\)/, "首页那一列没用这枚栏号牌");
  assert.match(shared, /h\(ConfigMark, \{ char: icon \|\| "·", tint: c, size: 28 \}\)/, "子页的格子没用这枚栏号牌");
});

test("首页那一列是表上的行：连着的，不是一张张卡", () => {
  assert.match(CFG, /flexDirection: "column", gap: 0/, "行之间还留着缝——那就又读成一张张卡片了");
  // 只有第一行有上边，其余靠上一行的下边接住；不然每行两条线、看着是分开的框
  assert.match(CFG, /borderTop: ri === 0 \? "1px solid " \+ CFG_LINE\(t\) : "none"/);
  assert.match(CFG, /minHeight: 44/, "行的可点区不够");
  // 右边那个 › 撤掉了：一整列都能点，箭头只是噪音
  assert.doesNotMatch(CFG, /color: t\.line \} \}, "›"/, "那个右箭头还在");
});

test("几何符号全换成汉字栏号", () => {
  // ◐ ◒ ✦ ⌨ ▧ ◖ ∞ ◉ ≋ 都是靠字体撑的字符，跟 emoji 同一个毛病；
  // 而且「◖」说明不了那是语音、「≋」说明不了那是额度。
  const icons = [...CFG.matchAll(/h\(ConfigTile, \{ icon: "([^"]+)"/g)].map(m => m[1]);
  assert.ok(icons.length >= 11, "只数到 " + icons.length + " 个格子");
  icons.forEach(c => assert.match(c, /^[一-鿿]$/, "「" + c + "」不是汉字栏号"));
  assert.equal(new Set(icons).size, icons.length, "栏号撞车了：" + icons.join(" "));
});

test("英文眉标和那二十个没人看得见的英文副标题一起清掉", () => {
  // 自动刷新那两条眉标是 no-english-titles 点名要删的那种；
  // 换的时候别硬翻——眉标该说这一栏在干嘛，不是把英文原样译回来。
  const auto = src.slice(src.indexOf("function AutoRefreshConfig"), src.indexOf("function ConfigLine") > 0 ? src.indexOf("function ConfigLine") : src.indexOf("function AutoRefreshConfig") + 6000);
  assert.doesNotMatch(auto, /AUTO CONTENT|SOCIAL PULSE/, "英文眉标还在");
  assert.match(auto, /eyebrow: "不用你点，它自己补上的"/);
  assert.match(auto, /eyebrow: "他们自己会做的那些事"/);
  assert.doesNotMatch(auto, /fontFamily: "'Archivo',sans-serif", fontSize: 8, letterSpacing: "\.24em"/, "还是英文眉标那套字");
  // meta 里那二十个纯英文副标题：v61.29 起 Head 有 zh 时就不发纯拉丁 en，
  // 它们一个都没显示过。留着只会让下一个人照着继续加英文。
  assert.match(CFG, /const meta = \{\n\s*home: "设置", api: "接哪些模型"/);
  // ⚠️对着剥掉注释的代码问：注释里正写着「原来挂在顶栏那行英文（"Config"）上」，
  //   直接 grep 会把说明当违规抓出来（这个仓库栽过一次）。
  assert.doesNotMatch(CODE, /"Config"|"API Settings"|"Bubble Skin"|"Automation"/, "旧那份带英文的 meta 还留着");
  assert.match(CFG, /h\(Head, \{ zh: m, onBack: back, bg: "transparent"/);
});
