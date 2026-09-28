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
assert.match(src, /"data-ledger-tabbar": true, style: Object\.assign\(\{ padding: "6px 10px calc\(env\(safe-area-inset-bottom\) \* 0\.4\)" \}/);
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
  assert.match(s2, /card: Object\.assign\(\{\}, GLASS\.C/, "账单条不是薄玻璃");
  assert.match(s2, /shell: Object\.assign\(\{\}, GLASS\.B/, "摘要卡不是磨砂玻璃");
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
