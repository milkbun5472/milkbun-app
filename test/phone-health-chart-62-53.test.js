// v62.53 审美审计（2026-09-04）点名健康这一页：
// 「注释写着『病历不是仪表盘：一份病历只有一种墨』，纸上却是白卡 + 顶部 4px 色条 +
//   33px 大数 + chip，就是仪表盘卡」。
//
// 判据只有一句：**这一页原样搬到别的 app 里还成立，它就是坏了。**
// 圆角白卡 + 彩条 + 大数 + 药丸标签，搬到任何一个健康 app 都成立；
// 化验单（姓名抬头、粗线、项目/结果两列、引导点）、处方笺、体温单、病程记录
// 都不成立——它们只在病历里成立。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const SRC = fs.readFileSync("js/phone.js", "utf8");
// ⚠️断言别撞上我自己写的中文注释——注释里提一句「HEALTH_HUES 删掉了」，
// doesNotMatch 就会当成它还在（这一处今天已经绊过一次）。
const NOC = SRC.split("\n").map(l => l.split("//")[0]).join("\n");
const HV = SRC.slice(SRC.indexOf("function HealthView("), SRC.indexOf("// 视频（仿 bilibili）"));

test("读数长在化验单上：姓名抬头 + 粗线 + 项目/结果两列", () => {
  assert.match(HV, /const labSheet = \(title, list\) => \{/);
  // 抬头是姓名和日期，不是把 tab 名再写一遍——顶栏已经写着「体征」了
  assert.match(HV, /\(char && char\.name\) \|\| "本人"/);
  assert.match(HV, /"项目"/);
  assert.match(HV, /"结果"/);
  // 粗线（2px）是化验单最认得出的那个记号
  assert.match(HV, /borderBottom: "2px solid " \+ HEALTH_INK/);
});

test("一份病历只有一种墨：三档色相整个删掉，异常才许动用赭石", () => {
  // HEALTH_HUES 当初存在的理由是「让卡片不至于完全一样」——一份文书本来就该处处一样。
  // 留着它等于把病改回去的路口开着，所以是【删掉】，不是【不再引用】。
  assert.doesNotMatch(NOC, /HEALTH_HUES/, "色相表还在，迟早有人再拿它去染卡片");
  assert.doesNotMatch(HV, /hueOf/);
  // 异常判定走 tag 的字面，赭石只出现在这一条路上
  assert.match(HV, /const alert = \/异常\|偏\[高低\]/);
  assert.match(HV, /const ink = alert \? HEALTH_ALERT : HEALTH_INK;/);
});

test("仪表盘那几件都不在了：33px 大数、4px 彩带、药丸标签", () => {
  assert.doesNotMatch(HV, /fontSize: 33/, "大数是仪表盘的主角");
  assert.doesNotMatch(HV, /height: 4, background: hue/, "卡顶那条彩带");
  // 读数行里的 tag 是小字，不是圆角药丸
  const row = HV.slice(HV.indexOf("const labRow = "), HV.indexOf("const labSheet = "));
  assert.doesNotMatch(row, /borderRadius: 11/, "tag 又做成药丸了");
});

test("趋势是体温单：格纸 + 折线 + 点，不是一排柱子", () => {
  assert.match(HV, /"体温单"/);
  assert.match(HV, /h\("polyline", \{ points:/);
  assert.doesNotMatch(HV, /height: Math\.max\(4, Math\.round\(v \* 0\.54\)\)/, "柱状图还在");
  // ⚠️等比缩放：preserveAspectRatio:"none" 会把点拉成横躺的椭圆、最后那个还被切掉一半
  const tr = HV.slice(HV.indexOf("const trendSec ="), HV.indexOf("// ── 今日轨迹 ──"));
  assert.doesNotMatch(tr, /preserveAspectRatio: "none"/);
  assert.match(tr, /const W = 300, H = 84, PAD = 5/, "不留边距的话首末两个点会贴边被切");
});

test("今日轨迹是病程记录：左边一列时刻，中间一条贯穿的分栏线", () => {
  assert.match(HV, /"病程记录"/);
  const tl = HV.slice(HV.indexOf("const timelineSec ="), HV.indexOf("// ⚠️「健康洞察」"));
  assert.match(tl, /alignSelf: "stretch"/, "那条线要贯穿整段，不是每条各画一截");
  assert.doesNotMatch(tl, /borderLeft: "4px solid "/, "左边 4px 彩条是通知列表的形状");
});

test("英文眉标和不在调色板里的紫都清掉了", () => {
  assert.doesNotMatch(HV, /"CHART"/);
  assert.doesNotMatch(HV, /"TIMELINE"/);
  assert.doesNotMatch(HV, /#5b4a8c/, "底栏选中色得用草药调色板里的苔绿");
});
