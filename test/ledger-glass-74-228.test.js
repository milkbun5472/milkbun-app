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
assert.match(src, /stack\.map\(\(v, i\) => i === stack\.length - 1/);
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
// 标题不留英文（no-english-titles）
assert.doesNotMatch(src, /MY WALLET|THANK YOU|QIUQIU/);
console.log("ledger-glass ok");
// 第二轮（她：主题只在背景上）：设计语言是一台果冻电子钱包——外壳 / LCD / 果冻键 / 能量格 四样零件
{
  ["function jellyKey(", "function Cells(", "const JELLY_CSS", "function StripSlot(", "const silk ="].forEach(n => assert.ok(src.indexOf(n) > 0, n));
  assert.match(src, /h\("style", null, JELLY_CSS\)/, "按下去那一下的样式没挂上");
  // 第三轮（她：「一屏四块灰 LCD，像血糖仪」）：LCD 只点睛——整个记账只剩余额主屏、金额屏两块
  const views = src.slice(src.indexOf("function WalletHome("), src.indexOf("function SettingsSheet("));
  assert.equal((views.match(/\}, sk\.screen\)/g) || []).length, 2, "LCD 屏又铺开了");
  assert.match(src, /"data-ledger-cal": true, style: Object\.assign\(\{ padding: "10px 8px" \}, sk\.acrylic\)/, "日历又变回计算器屏了");
  assert.match(src, /const CAL_RAMP = \[/, "日历不是糖果色深浅了");
  // 第四轮（她：参考图是「轻薄的现代界面 + 少量 Y2K 实体装饰」，不是万物皆果冻）
  assert.ok(!/h\(Cells, \{/.test(views), "进度又变回一格一格的仪器了");
  assert.match(src, /底栏轻薄：只有选中那一格底下垫一小块果冻高光/);
  const jellyUses = (views.match(/jellyKey\(sk/g) || []).length;
  assert.ok(jellyUses <= 8, "果冻键又铺开了：" + jellyUses + " 处（只该有首页三颗大键和记一笔的键盘/完成）");
  assert.match(src, /acrylic: \{ background: "transparent" \}/, "数据又开始容器套容器");
  assert.match(src, /backgroundColor: pageColor\("ledger", "bg", "#f3f2f8"\)/, "背景又铺成大片粉紫了");
}
console.log("ledger-y2k ok");
// 第五轮（她拿样张对比：「太死了不够透、加号要更大」）：三颗主键是透明玻璃软糖 + 大果冻图标
assert.match(src, /function JellyGlyph\(/);
assert.match(src, /bigKey\("记一笔", "pink", "plus"/);
assert.match(src, /h\(JellyGlyph, \{ k: glyph, tone, size: glass \? 30 : 26 \}\)/, "主键图标又放大成了 App 大图标");
assert.match(src, /backdropFilter: "blur\(4px\)"/, "主键不透了");
console.log("ledger-bigkey ok");
// 第七轮（她：「不要重新设计、不要做成现代高清 3D」）：照第一张样张的视觉语法——小、扁、泛白、糊一点
assert.match(src, /minHeight: 74, gap: 2, borderRadius: 15/, "主键又变大变圆了");
assert.match(src, /fontSize: 11\.5, fontWeight: 500, color: glass \? ink/, "主键的字又变大变粗了");
assert.match(src, /pink: "#8c3a4f"/, "记一笔的字不是酒红了");
assert.ok(!/translate\(1\.2 2\.6\)/.test(src), "果冻符号又长出高清的硬侧面了");
console.log("ledger-y2k-soft ok");
