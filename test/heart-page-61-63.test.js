// 她 2026-09-04：「先把念想做了吧宝宝」——上一句是「我在想这个念想是继续放在
// 通讯录那边还是找别的地方给他放呢」。
//
// 挪之前它是【聊天资料卡里掀起来的一个半窗】：要先点进某个人的聊天、再开资料卡、
// 再往下翻，才摸得到。可它装的是念想列表＋长出来的自我＋蜕变轴＋旁人纸条＋
// 不想碰的＋季度自述——没有一样是三行能说完的，正是 no-half-sheet.md 点名
// 不许用半窗的那种内容。
//
// 挪之后：主入口是【人格档案馆】那张卡（「你写的卷宗」和「他自己长出来的」
// 本来就是同一份档案的两半），资料卡那条老路留着不动。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const heart = fs.readFileSync(path.join(root, "js/heart.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");

const PAGE = heart.slice(heart.indexOf("window.HeartPage = function"));
assert.ok(PAGE.length > 3000, "抠不出 HeartPage");

test("心上是整页，不是半窗", () => {
  // no-half-sheet.md：判据是「这一层的内容，需要同时看见它下面那一层吗」。
  // 念想列表不需要——上一层是资料卡或档案馆，看不看得见都不影响读这一页。
  assert.doesNotMatch(PAGE, /h\(Sheet,/, "又掀回半窗了（Sheet＝下半屏那种）");
  assert.match(PAGE, /ReactDOM\.createPortal\(/, "整屏浮层要 portal 到 body，不然会被上一层的 overflow 裁掉");
  assert.match(PAGE, /position: "fixed", inset: 0/, "没铺满整屏");
  // 顶栏 shrink-0 / 正文 flex-1 min-h-0 overflow-y-auto（mobile-ui-layout.md §3）
  assert.match(PAGE, /className: "h-full flex flex-col"/, "外壳不是 h-full flex flex-col，正文就撑不开");
  assert.match(PAGE, /className: "flex-1 min-h-0 overflow-y-auto"/, "正文没有独立滚动区");
});

test("顶栏用公共的那条紧凑栏，不自己另写一份", () => {
  // mobile-ui-layout.md §1：「那条紧凑栏就是 components.js 的 Head，别再自己写一条」
  assert.match(PAGE, /h\(Head, \{[^}]*onBack: onClose/, "没用 Head，或者 Head 上没接返回键");
  assert.doesNotMatch(PAGE, /paddingTop: safeTop\(/, "自己又垫了一条状态栏空带——Head 已经吃过刘海了");
});

test("旧名字一处不剩（撤掉东西是删掉，不是留着说它错了）", () => {
  // 她 2026-08-31：「撤掉东西要删除而不是在它后面说 xxx 是错的应该 yyyy」
  for (const [name, src] of [["js/heart.js", heart], ["js/app.js", app], ["js/screens.js", screens]]) {
    assert.doesNotMatch(src, /DesireBoxSheet/, name + " 里还留着旧名 DesireBoxSheet");
  }
});

test("档案馆那张卡上有心上这一格，点它不会连带翻进人设表单", () => {
  const CAST = screens.slice(screens.indexOf("function Cast({"), screens.indexOf("function Cast({") + 9000);
  assert.match(CAST, /heartCountOf, onOpenHeart/, "Cast 收不到心上那两个口子");
  // ⚠️别只钉「那串字还在」——把 onOpenHeart ? 改成 false ? 之后字还在，格子已经不渲染了
  //  （「冻的是长相不是行为」）。这一条钉的是那道闸挂在【prop 本身】上。
  assert.match(CAST, /\n\s*onOpenHeart \? h\("button", \{/, "心上那一条的闸不是挂在 onOpenHeart 上");
  assert.match(CAST, /条念想/, "卡上没有心上那一条");
  // ⚠️外层卡片整块可点，这一格是它里面的一个按钮：不 stopPropagation 就会连带
  //   触发外层的 onOpenChar，人一点心上反而跳去改人设。
  assert.match(CAST, /onClick: e => \{ e\.stopPropagation\(\); onOpenHeart\(c\); \}/, "心上那一格没挡住冒泡");
  // button 套 button 是非法 HTML（浏览器会把内层拆到外面去），所以外层换成了 div
  assert.match(CAST, /role: "button", tabIndex: 0/, "外层没留可点语义");
  assert.doesNotMatch(CAST.slice(0, CAST.indexOf("卷宗的书脊")), /return h\("button", \{/, "外层还是 button，里面再套 button 是非法 HTML");
});

test("从档案馆点进来的那个人，不会被当成正在聊的那个人", () => {
  // 老代码只认 activeChar（资料卡那条路天然就是当前这个人）。档案馆点的可能是
  // 完全没在聊的另一位——照抄 activeChar 会打开【别人的】心上，还能写进别人的盒子。
  assert.match(app, /const hc = heartChar \|\| activeChar; return desireBoxOpen && hc && window\.HeartPage/);
  const OV = app.slice(app.indexOf("const hc = heartChar || activeChar"), app.indexOf("editMsg && /*#__PURE__*/React.createElement(MsgEditSheet"));
  assert.ok(OV.length > 400 && OV.length < 3000, "抠不出那段浮层");
  assert.doesNotMatch(OV, /activeChar\.id/, "浮层里还有 activeChar.id——档案馆点别人会写进当前聊天那个人的盒子");
  assert.ok((OV.match(/hc\.id/g) || []).length >= 5, "四个回调加 box 都得认 hc");
  // 关掉时要把指定清空，否则下次从资料卡进还是上一次那个人
  assert.match(OV, /setDesireBoxOpen\(false\); setHeartChar\(null\);/, "关掉没清 heartChar");
  assert.match(app, /onOpenHeart: c => \{ setHeartChar\(c\); setDesireBoxOpen\(true\); \}/);
});

test("资料卡那条老路留着（挪主入口不等于把旧入口拆了）", () => {
  assert.match(app, /onOpenDesires: \(\) => setDesireBoxOpen\(true\)/, "资料卡那条路断了");
  assert.match(comp, /onClick: onOpenDesires/, "资料卡上那颗心上没了");
});

test("档案馆卡上的眉标不留英文", () => {
  // .claude/rules/no-english-titles.md：纯英文眉标一律换成中文，除非这一处压根没有中文。
  // 这一页的眉标不走 Head（Head 那一处已经统一挡掉了），是卡片自己摆的小字，得单独看。
  const CAST = screens.slice(screens.indexOf("function Cast({"), screens.indexOf("function Cast({") + 9000);
  // 全大写的拉丁串就是那种装饰眉标（TIMEZONE / BIRTHDAY / PERSONA / DOSSIER / CATALOGUE）
  const caps = [...CAST.matchAll(/"([A-Z][A-Z ]{3,})"/g)].map(m => m[1]);
  assert.deepEqual(caps, [], "这几个眉标还是纯英文：" + caps.join(" / "));
  // 换过去的中文得真在（不然把英文删光也算过）
  for (const zh of ["卷宗", "心上", "时区", "生日", "人设"]) {
    assert.ok(CAST.includes('"' + zh + '"'), "眉标「" + zh + "」不见了");
  }
});

test("眉标不许把同一句话说两遍", () => {
  // 「TA 长出来的自我 · 长出来的自我」——后半截原来是英文，按「标题不留英文」换成中文时
  // 直接照译，于是同一句写了两遍。换英文眉标别硬翻：该说的是这一栏在干嘛。
  const dup = [...PAGE.matchAll(/h\(Eyebrow, \{[^}]*\} \}, "([^"]+)"/g)].map(m => m[1])
    .filter(s => { const p = s.split(" · "); return p.length === 2 && p[1] && p[0].includes(p[1]); });
  assert.deepEqual(dup, [], "这几个眉标前后半截是同一句：" + dup.join(" / "));
});
