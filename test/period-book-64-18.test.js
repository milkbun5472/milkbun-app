// 月事本（她 2026-09-05：「我的头像没带进来，还有经期记录这块是不是可以多点能记的，
// 参考别的经期记录软件，还有还是个半窗也要改」）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const book = comp.slice(comp.indexOf("function PeriodBook({"), comp.indexOf("// ── 日历（v56.31 重做）"));

test("经期那一层是【整页】，不再是半窗", () => {
  // .claude/rules/no-half-sheet.md：这一层需要同时看见底下那张月历吗？不需要 → 整页。
  assert.match(comp, /if \(pSet\) return h\(PeriodBook, \{/, "还没换成整页");
  assert.doesNotMatch(comp, /pSet && h\(Sheet/, "半窗那份还留着（撤东西要删干净）");
  assert.match(book, /className: "h-full flex flex-col"/);
  assert.match(book, /pageSkin\("paper", t\)/, "外壳没铺底纹");
  assert.match(book, /h\(Head, \{ bg: "transparent"/, "顶栏没让底纹透上来（mobile-ui-layout §3.5）");
  assert.match(book, /className: "flex-1 min-h-0 overflow-y-auto/, "正文不是那一个主滚动容器");
  // 撤下来的那两个 state 也删干净了
  assert.doesNotMatch(comp, /const \[pCyc, setPCyc\]/);
  assert.doesNotMatch(comp, /const \[pLen, setPLen\]/);
});

test("能记的东西真的多了：量、疼、身上、心情、一句话", () => {
  assert.match(comp, /const PERIOD_FLOW = \[/);
  assert.match(comp, /const PERIOD_PAIN = \[/);
  ["腰酸", "小腹坠", "犯困", "睡不着"].forEach(x => assert.ok(comp.indexOf('"' + x + '"') > 0, "身上那栏少了 " + x));
  ["低落", "烦躁", "想哭"].forEach(x => assert.ok(comp.indexOf('"' + x + '"') > 0, "心情那栏少了 " + x));
  assert.match(book, /saveLog\(\{ note: e\.target\.value\.slice\(0, 80\) \}\)/, "没有那一行备注");
  // 每天各记各的，key 用的是补零的那种（跟 daySel 一致，别和 periodMap 那套混了）
  assert.match(book, /const logs = periodLogsOf\(per\)/);
  assert.match(book, /calPadKey\(d\.getFullYear\(\), d\.getMonth\(\), d\.getDate\(\)\)/);
  // 全空的那天不留一条空记录（不然存档里全是 {}）
  assert.match(book, /if \(empty\) delete next\[key\]; else next\[key\] = row;/);
});

test("量和疼不是一排药丸：形状本身在说这一栏是什么", () => {
  // tabs-not-plain-pills.md：换个 app 还成立的形状等于没设计
  assert.match(comp, /function FlowDrops\(\{ n, on, color, dim \}\)/, "量那一栏没有水滴");
  assert.match(comp, /M4\.5 1 C7 4\.5 8 6\.2 8 7\.8 A3\.5 3\.5 0 0 1 1 7\.8 C1 6\.2 2 4\.5 4\.5 1 Z/);
  // 疼是一道由细到粗的横杠
  assert.match(book, /height: Math\.max\(1, pn\.n \* 2\.2\)/, "疼那一栏没有由细到粗的杠");
  // 选中态不只靠颜色：还有填实/描边、底色、边框
  // FlowDrops 住在 PeriodBook 外面（它是自己的一个小部件），所以对着整份文件认
  assert.match(comp, /fill: lit \? \(on \? color : dim\) : "transparent"/);
});

test("这一轮那张卡说得清：第几天、几号起、离下次还有几天", () => {
  assert.match(book, /function periodDayOf|const cur = periodDayOf\(per, key\)/);
  assert.match(comp, /function periodDayOf\(period, key\)/);
  assert.match(book, /"这一轮第 " \+ cur\.day \+ " 天"/);
  assert.match(book, /"离下次大约还有 " \+ nextIn \+ " 天"/);
  // 那颗按钮的字跟着状态走：第一天 / 最后一天 / 取消
  assert.match(book, /记为这次的最后一天/);
  assert.match(book, /记为这次的第一天/);
  assert.match(book, /不是开始那天/);
});

test("日历上那一排人里，「我」也有脸了", () => {
  // profile 一直在参数里，只是这一处从来没用过它
  assert.match(comp, /: h\(Avatar, \{ character: \{ name: \(profile && profile\.name\) \|\| "我", avatarImage: profile && profile\.avatarImage, color: profile && profile\.color \}, size: 38, radius: 999 \}\)\)/);
  assert.doesNotMatch(comp, /h\("span", \{ style: \{ fontFamily: F_DISPLAY, fontSize: 15, color: t\.sub \} \}, "我"\)/, "还画着那个「我」字");
});
