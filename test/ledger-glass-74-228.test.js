// 记账改版（她 2026-09-28 给的晶透样张）：四格底栏 + 记一笔键盘 + 账单/日历/统计 + 小票，两套皮共用一份排版
const fs = require("fs"), assert = require("node:assert/strict"), vm = require("vm");
const src = fs.readFileSync(__dirname + "/../js/ledger.js", "utf8");
const grab = n => { const i = src.indexOf("function " + n + "("); let d = 0, j = src.indexOf("{", i); for (; j < src.length; j++) { if (src[j] === "{") d++; else if (src[j] === "}" && --d === 0) break; } return src.slice(i, j + 1); };
// 金额：两位小数、负号在符号前
const sb = {}; vm.runInNewContext(grab("fmtMoney") + ";this.f=fmtMoney;", sb);
assert.equal(sb.f(3174.8, { symbol: "¥" }), "¥3,174.80");
assert.equal(sb.f(-3174.8, { symbol: "¥" }), "-¥3,174.80");
assert.equal(sb.f(0, { symbol: "$" }), "$0.00");
// 四格底栏，只吃 0.4 条底部安全区（mobile-ui-layout §2）
assert.match(src, /\["wallet", "钱包", "wallet"\], \["stats", "统计", "chart"\], \["cal", "日历", "cal"\], \["me", "我的", "me"\]/);
// 底栏只吃 0.4 条安全区（mobile-ui-layout §2）：玻璃皮是一条浮起的玻璃条，用 margin 吃；账簿皮照旧用 padding
assert.match(src, /margin: "0 12px calc\(env\(safe-area-inset-bottom\) \* 0\.4\)"/);
assert.match(src, /Object\.assign\(\{ padding: "6px 10px calc\(env\(safe-area-inset-bottom\) \* 0\.4\)" \}, sk\.tabBar\)/);
// 叠页不卸底下那层：滚动位置保得住
assert.match(src, /stack\.map\(\(v, i\) => h/);
assert.match(src, /renderOverlay\(v\)/);
// 两套皮
assert.match(src, /const SKIN_LIST = \[\s*\{ id: "glass"/);
assert.match(src, /settings && settings\.skin === "paper" \? "paper" : "glass"/);
assert.match(src, /onSkin: id => setSetting\(\{ skin: id \}\)/);
// 键盘：两位小数封顶、开头 0 被顶掉
const press = src.slice(src.indexOf("const press = k => setAmount(a => {"), src.indexOf("const canSave"));
const run = (seq) => { let a = ""; const ctx = { setAmount: f => { a = f(a); } }; vm.runInNewContext(press + ";" + seq.map(k => "press(" + JSON.stringify(k) + ");").join(""), ctx); return a; };
assert.equal(run(["0", "5"]), "5");
assert.equal(run(["1", ".", "2", "3", "4"]), "1.23");
assert.equal(run([".", "5"]), "0.5");
assert.equal(run(["9", "del"]), "");
// 新页都在
["BillsView", "CalView", "MeView", "Receipt", "Barcode", "Donut", "CandySeg"].forEach(n => assert.ok(src.indexOf(n) > 0, n));
// 本轮用户明确要求复制参考图，英文卡面是该图的一部分。
assert.match(src, /MY WALLET/);
assert.match(src, /QIUQIU WALLET/);
assert.match(src, /function CategoryGlyph\(/);
assert.match(src, /"data-ledger-tray": true/);
assert.match(src, /h\("style", null, JELLY_CSS\)/);
console.log("ledger reference structure ok");
// 第九轮（她：「要开始给东西做材质，不是上颜色」）：三级玻璃材质 + 环境光，卡片不再是白色实体
{
  const s2 = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
  assert.match(s2, /const GLASS = \{\s*A: \{/, "没有统一的玻璃材质了");
  // 第十三轮去卡片化：账单条和摘要不再是玻璃卡，而是机身表面 + 细线（见下面 ledger-decard）
  assert.match(s2, /style: glass \? Object\.assign\(glassTinted\(a, b\)/, "三颗主键不是透明亚克力");
  const white = [...s2.slice(s2.indexOf("const GLASS = {"), s2.indexOf("function glassTinted(")).matchAll(/background: "linear-gradient\([^"]*"/g)].map(m => m[0]);
  white.forEach(b => { const ops = [...b.matchAll(/rgba\(255,255,255,(\.\d+)\)/g)].map(m => +m[1]); assert.ok(ops.every(o => o <= .3), "玻璃底又变成白色实体了：" + b); });
  assert.ok(!/0 [1-9]px [0-9]+px rgba\(0,0,0/.test(s2.slice(s2.indexOf("const GLASS = {"), s2.indexOf("function ledgerSkin("))), "材质里出现了灰黑投影");
}
console.log("ledger-material ok");
// 第十轮（她：统计和账单打通；emoji 全换成自己画的）
{
  const s3 = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
  assert.match(s3, /onOpenCat: \(cat, kind, mk\) => push\(\{ k: "bills", cat, kind, mk \}\)/, "排行点不进账单了");
  assert.match(s3, /const \[catF, setCatF\] = useState\(props\.initCat \|\| ""\)/);
  assert.match(s3, /"data-ledger-catfilter": catF/);
  assert.ok(!/" · 💬"/.test(s3), "账单行又出现 emoji 了");
  assert.ok(!/label: "Emoji/.test(s3), "新建分类又让她填 emoji 了");
  assert.match(s3, /f\.type === "icon" \? h\("div", \{ "data-ledger-iconpick": true/, "新建分类没有图标可挑");
  assert.ok(!/return h\("span", \{ style: \{ fontSize: size \* \.65 \} \}, emoji \|\| "•"\)/.test(s3), "认不出的分类又退回 emoji 了");
}
console.log("ledger-icons ok");
// 第十一轮（她：「每个框都搞外面的线，做不出真的玻璃反而很土」）：B、C 两级和键一条线都不画
{
  const s4 = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
  const G = s4.slice(s4.indexOf("const GLASS = {"), s4.indexOf("function ledgerSkin("));
  assert.equal((G.match(/border: "none"/g) || []).length, 4, "玻璃材质又描边了");
  assert.ok(!/0 0 0 1px/.test(G), "玻璃材质又加了一圈轮廓线");
}
console.log("ledger-noline ok");
// 第十二轮（她：六样 Y2K 记号全都要，英文可以破例）
{
  const s5 = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
  assert.match(s5, /\.lg-gloss::before\{[^}]*radial-gradient\(ellipse 52% 100% at 50% 0%/, "高光不是她选的那种柔光了");
  assert.match(s5, /-5px -4px 14px rgba\(255,186,226/, "虹彩光没了");
  ["function Heart(", "function Bunny(", "function Clip(", "function WordMark("].forEach(n => assert.ok(s5.indexOf(n) > 0, n));
  ["STATISTICS", "MY CALENDAR", "MY STUFF", "MY BILLS"].forEach(w => assert.ok(s5.indexOf('word: "' + w + '"') > 0, w));
  assert.match(s5, /\.lg-hand\{font-family:'Dancing Script'/, "手写字体没了");
  assert.match(s5, /"Manage money,"/);
}
console.log("ledger-y2k-marks ok");
// 第十三轮（她：「下一轮目标是去卡片化」）：信息直接印在机身上，细线分区；粉只给操作/选中
{
  const s6 = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
  assert.match(s6, /card: Object\.assign\(\{\}, FLAT, \{ borderBottom: "1px solid " \+ LINE \}\), shell: Object\.assign\(\{\}, FLAT, \{ borderTop: "1px solid " \+ LINE \}\)/, "又回到一个模块一个圆角矩形了");
  assert.match(s6, /backgroundColor: pageColor\("ledger", "bg", "#e9e9f2"\)/, "机身不是样张的冷白了");
  assert.match(s6, /lilac: \["#e4e3f2", "#a9a7cc"\]/, "账单键又变回紫粉了");
  assert.match(s6, /\.lg-reference \.lg-add-category\{[^}]*background:transparent/, "分类又变回十二张小白卡了");
}
console.log("ledger-decard ok");
// 第十四轮（她：别再删了，往骨架上装透明硬件零件）
{
  const s7 = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
  assert.match(s7, /"data-ledger-rail": true/, "预算不是凹槽了");
  assert.equal((s7.match(/rail: true \}\)/g) || []).length, 2, "钱包和统计的预算都要是凹槽");
  assert.match(s7, /"data-ledger-cd": true/, "统计没有光盘仪表了");
  assert.match(s7, /"data-ledger-slider": true/, "切换不是滑轨了");
  assert.match(s7, /\.lg-add-category \.lg-cattile\{width:48px!important;height:48px!important;border-radius:50%!important/, "分类图标没有圆底座了");
  assert.match(s7, /const GROTESK = /, "数字不是 grotesk 了");
  assert.match(s7, /outline: k === today \? "1px solid "/, "今天不是细粉线了");
}
console.log("ledger-hardware ok");
// 第十五轮（她：「抄作业吧」，给了一整张首页样张）：首页照样张逐块做
{
  const s8 = require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8");
  ["function WalletHomeY2K(", "Keep going :)", 'const IMG = "assets/ledger/"', 'IMG + "card.png"', '"k1", "记一笔"', 'IMG + "note.png"', 'IMG + "tube.png"', 'IMG + "stub.png"', 'pic("foot", 60, 850'].forEach(k => assert.ok(s8.indexOf(k) > 0, k));
  assert.match(s8, /h\(sk\.id === "glass" \? WalletHomeY2K : WalletHome,/, "玻璃皮首页没走样张那版");
}
console.log("ledger-home-mock ok");
// 第十六轮（她：「我让你完全复制没让你自己画」）：首页实物部件直接用样张裁下来的图
["card", "note", "k1", "k2", "k3", "tube", "stub", "foot"].forEach(n => assert.ok(require("fs").existsSync(__dirname + "/../assets/ledger/" + n + ".png"), n + ".png 不见了"));
console.log("ledger-home-assets ok");
// 第二页素材（她 2026-09-29 给的）：玻璃面板九宫格、滑轨、标题、星星、挂件
["panel", "rail", "slider", "title-stats", "star-gold", "star-purple", "charm1", "charm4"].forEach(n => assert.ok(require("fs").existsSync(__dirname + "/../assets/ledger/" + n + ".png"), n));
assert.match(require("fs").readFileSync(__dirname + "/../js/ledger.js", "utf8"), /border-image:url\(assets\/ledger\/panel\.png\?v=\d+\) 120 fill/);
console.log("ledger-stats-assets ok");

// 六个月柱子：她给的空柱 / 满柱素材，满柱按金额从上裁（不再九宫格挤压）
{
  const fs2 = require("fs"), path2 = require("path");
  const src2 = fs2.readFileSync(path2.join(__dirname, "..", "js", "ledger.js"), "utf8");
  for (const f of ["col-empty.png", "col-full.png"]) {
    if (!fs2.existsSync(path2.join(__dirname, "..", "assets", "ledger", f))) throw new Error("missing " + f);
  }
  if (!/col-full\.png[\s\S]{0,400}clipPath: "inset\("/.test(src2)) throw new Error("full column must be clipped, not squashed");
  console.log("ok six-month glass columns");
}

// 光污染收一档 + 装饰不对称（她 2026-09-29）
{
  const src3 = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "ledger.js"), "utf8");
  const a = src3.indexOf("function CurView"), body = src3.slice(a, src3.indexOf("\n  function ", a + 10));
  if (!/\.lg-pnl::before\{[^}]*opacity:\.[0-9]+/.test(src3) && /h\("style", null, PNL_CSS\)/.test(body)) throw new Error("panel glass must be dimmed via ::before opacity");
  if (!/lg-pnl-hero::before\{[^}]*mask-image/.test(src3)) throw new Error("hero panel must fade its lower corners");
  if ((body.match(/deco\("star-gold"/g) || []).length > 2) throw new Error("at most 2 gold stars per page");
  if ((body.match(/deco\("charm/g) || []).length > 1) throw new Error("clip only one panel");
  console.log("ok stats glass dimmed & asymmetric deco");
}

// 装饰不许把统计页撑长；玻璃皮统计页顶栏不再写「统计」（标题图已经说了）
{
  const src4 = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "ledger.js"), "utf8");
  if (!/className: "px-5 pb-8 lg-stats", style: \{ position: "relative", overflow: glassP \? "clip"/.test(src4)) throw new Error("stats page must clip deco on both axes");
  if (!/zh: sk\.id === "glass" \? "" : tabTitle/.test(src4)) throw new Error("glass stats header must drop duplicate title");
  console.log("ok stats clip & no dup title");
}

// 月份切换在玻璃皮下是一枚胶囊，不再是裸的一行
{
  const src5 = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "ledger.js"), "utf8");
  const i = src5.indexOf("const MonthNav");
  if (!/rail\.png/.test(src5.slice(i, i + 700))) throw new Error("glass MonthNav must sit on the rail asset");
  console.log("ok monthnav capsule");
}

// 日历页素材（她 2026-09-29 给的）：标题、三种键帽、邮戳、圆孔、便签
{
  const fs6 = require("fs"), src6 = fs6.readFileSync(__dirname + "/../js/ledger.js", "utf8");
  ["tag", "title-cal", "day-hi", "day-lo", "day-today", "stamp", "holes", "note-good"].forEach(n => { if (!fs6.existsSync(__dirname + "/../assets/ledger/" + n + ".png")) throw new Error("missing " + n); });
  const i = src6.indexOf("function CalView"), body = src6.slice(i, src6.indexOf("function MeView"));
  if (!/"day-today" : lit \? \(lv > \.5 \? "day-hi" : "day-lo"\)/.test(body)) throw new Error("day caps must follow spend level");
  if (!/className: glass \? "lg-pnl"/.test(body)) throw new Error("calendar must sit in the shared glass panel");
  if (!/\[\[sy\.slice\(2\)/.test(body)) throw new Error("stamp must print the selected date");
  console.log("ok calendar assets");
}

// 「我的」页素材（她 2026-09-29 给的）
{
  const fs7 = require("fs"), src7 = fs7.readFileSync(__dirname + "/../js/ledger.js", "utf8");
  ["title-me", "skin-glass", "skin-paper", "ic-piggy", "ic-lock", "ic-coin", "ic-folder", "side-tabs"].forEach(n => { if (!fs7.existsSync(__dirname + "/../assets/ledger/" + n + ".png")) throw new Error("missing " + n); });
  const i = src7.indexOf("function MeView"), body = src7.slice(i, src7.indexOf("function TxnRow"));
  if (!/"✓ 当前使用"/.test(body) || !/props\.onSkin\(x\.id\)/.test(body)) throw new Error("skin cards must stay tappable with current mark");
  if ((body.match(/minHeight: 62/g) || []).length < 1) throw new Error("me rows need big touch targets");
  console.log("ok me assets");
}
