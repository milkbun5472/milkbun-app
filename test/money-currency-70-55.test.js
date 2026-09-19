// 她 2026-09-18：「那就把钱收入公共然后后续任何交易都走一层汇率怎么样？
//   就比如让他转50 换算成日元转账卡直接写50×汇率的数」
//   「每个角色一个，按对方币种写，然后不要忘记按钮同时可以设置币种符号，
//    就放钱包右上角刷新那里」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../js/money.js");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const phone = fs.readFileSync(path.join(root, "js/phone.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const JP = { c1: { code: "JPY", symbol: "円", rate: 20, pos: "post", dec: 0 } };
const book = b => { M.setBook(b); };

test("她举的那个例子：转 50，卡上写 50×汇率", () => {
  book(JP);
  assert.equal(M.conv(50, "c1"), 1000);
  assert.equal(M.fmt(50, "c1"), "1,000 円");
  assert.equal(M.say(50, "c1"), "1000 円", "喂模型那份不许带千分位——逗号会被读成分隔符");
});

test("每个角色一个：没设过的还是人民币，一个字没变", () => {
  book(JP);
  assert.equal(M.fmt(50, "别人"), "¥50.00");
  assert.equal(M.fmt(50, null), "¥50.00");
  assert.equal(M.conv(50, "别人"), 50);
});

// ⚠️这一条是整个功能里唯一会【改坏她的钱】的地方：
//   她在屏幕上看着日元敲一个数，存下去的必须是人民币。漏了就是十万日元被当成十万人民币。
test("改余额是唯一允许折回去的地方，而且要真的折回去", () => {
  book(JP);
  assert.equal(M.parse("100000", "c1"), 5000);
  assert.equal(M.parse("1,000 円", "c1"), 50, "符号和千分位要能吃掉");
  assert.equal(M.parse("", "c1"), null, "空的别当成 0 存进去");
  assert.equal(M.parse("哈哈", "c1"), null);
  // 界面那头真的走了 parse，不是 Number(amt)
  assert.match(screens, /const v = \(typeof Money !== "undefined" && Money\) \? Money\.parse\(amt, char\.id\) : Number\(amt\);/);
  assert.ok(!/const saveEdit = \(\) => \{ const v = Number\(amt\);/.test(screens), "旧的那句还在，日元会被当人民币存");
  // 打开输入框时先换算过去，不然她看到的是人民币数、单位却写着円
  assert.match(screens, /setAmt\(String\(\(typeof Money !== "undefined" && Money\) \? Money\.conv\(rec \? rec\.balance : 0, char\.id\)/);
});

test("来回一趟不掉钱", () => {
  book(JP);
  [0, 1, 12.5, 50, 3000, 99999].forEach(n =>
    assert.equal(M.parse(String(M.conv(n, "c1")), "c1"), Math.round(n * 100) / 100, "来回之后对不上：" + n));
});

test("汇率填坏了不许把钱变成 0 或负数", () => {
  book({ c1: { rate: 0, symbol: "?" }, c2: { rate: -5, symbol: "?" }, c3: { rate: "哈", symbol: "?" } });
  ["c1", "c2", "c3"].forEach(id => {
    assert.equal(M.of(id).rate, 1, id + " 的汇率没被兜住");
    assert.equal(M.conv(50, id), 50);
  });
});

test("符号她想填什么都行，前后都能放", () => {
  book({ a: { symbol: "灵石", rate: 2, pos: "post", dec: 0 }, b: { symbol: "NT$", rate: 4.4, pos: "pre", dec: 0 } });
  assert.equal(M.fmt(10, "a"), "20 灵石");
  assert.equal(M.fmt(10, "b"), "NT$44");
});

test("换算只有一个方向：存的永远是人民币", () => {
  // 存档里没有任何地方写换算后的数——除了 parse 那一处（上面单独钉了）
  assert.ok(!/saveJSON\("x_charWallet"[^)]*Money\.conv/.test(app), "把换算后的数写回存档了");
  assert.ok(!/Money\.conv[^\n]*balance:/.test(app));
  // 日常消费那条「币种铁律」必须留着：它守的正是【进来的一律人民币】
  assert.match(app, /【币种铁律】amount 一律按【人民币】量级/, "这条删了，模型会开始交日元原币数字回来");
});

test("转账那条链三个触点都换了：卡面、聊天正文、喂给模型那句", () => {
  assert.match(comp, /const _tfAmt = typeof Money !== "undefined" && Money \? Money\.conv\(m\.amount, charId\) : m\.amount;/, "卡面");
  assert.match(app, /转了 " \+ moneyText\(a, charId\)/, "聊天正文");
  assert.match(app, /（金额 " \+ moneyText\(_pendingTf\.amount, charId\) \+ "）/, "喂给模型那句——漏了他嘴里说的数就对不上");
  // 两处调用点都得把「对方是谁」传进去，不然卡面永远是人民币
  assert.match(comp, /charId: character && character\.id,/, "单聊那张卡");
  assert.match(comp, /charId: m\.toId \|\| m\.senderId,/, "群里那张卡");
});

test("只有一份：fmtMoney 转交给 Money，页面里不许再自己拼 ¥", () => {
  assert.match(phone, /const fmtMoney = \(n, charId\) => \(typeof Money !== "undefined" && Money\)\n  \? Money\.fmt\(n, charId\)/);
  assert.match(html, /<script src="js\/money\.js\?v=/, "没挂进 index.html，线上就是 undefined");
  // 钱包那一屏每一处金额都得说清是谁的钱，不然混着人民币和日元
  const wallet = screens.slice(screens.indexOf("function CharWallet({"), screens.indexOf("function CurrencyBook") > 0 ? screens.length : screens.length);
  const bare = (wallet.match(/fmtMoney\((?:[^()]|\([^()]*\))*\)/g) || []).filter(x => !/char\.id|c\.id/.test(x));
  assert.deepEqual(bare, [], "钱包里还有不知道是谁的钱：" + bare.join(" / "));
  const bareP = (phone.match(/fmtMoney\((?:[^()]|\([^()]*\))*\)/g) || []).filter(x => !/char\.id/.test(x) && !/n, charId/.test(x));
  assert.deepEqual(bareP, [], "手机里还有：" + bareP.join(" / "));
});

test("设置入口在钱包右上角、跟刷新并排，而且是整页不是半窗", () => {
  assert.match(screens, /h\("button", \{ onClick: \(\) => setCurOpen\(true\)/);
  assert.match(screens, /onClick: \(\) => onRefresh\(char\), disabled: loading/);
  assert.match(screens, /if \(curOpen\) return h\(CurrencyBook, \{/, "做成半窗了（施工规则/no-half-sheet.md）");
  assert.ok(!/curOpen && h\(Sheet/.test(screens));
  assert.match(screens, /function CurrencyBook\(\{ char, cur, onSave, onBack \}\)/);
  // 符号是她自己填的，不是只能从列表里挑（她点名要这个）
  assert.match(screens, /field\("符号", input\(sym, v => setSym\(String\(v\)\.slice\(0, 4\)\)\)/);
});

test("这本册子存得下、开机读得回、改完立刻推给公共层", () => {
  assert.match(app, /saveJSON\("x_charCurrency", n\);/);
  assert.match(app, /loadJSON\("x_charCurrency", \{\}\); setCharCur\(cc\); if \(window\.Money\) window\.Money\.setBook\(cc\);/);
  assert.equal((app.match(/window\.Money\.setBook\(/g) || []).length, 2, "开机一处、改完一处；多出来的那处多半又抄了一遍");
});

// ── 换算之后位数变多，一行放不下（她 2026-09-18：「还有这个塞不下一行咋办」）──
const vm = require("node:vm");
const fitCtx = (() => {
  const i = comp.indexOf("const _wideChar");
  const seg = comp.slice(i, comp.indexOf("function requestAppConfirm"));
  const c = {}; vm.createContext(c);
  vm.runInContext(seg + "\nthis.fit = fitFont; this.cells = textCells;", c);
  return c;
})();

test("数的是宽度不是字符数：円、원 这种一个顶两个", () => {
  assert.equal(fitCtx.cells("1000"), 4);
  assert.equal(fitCtx.cells("円"), 2, "只按 length 算的话全角字会被少算一半，照样掉行");
  assert.equal(fitCtx.cells("원"), 2);
  // ⚠️₩（U+20A9）跟「원」不一样，它是窄的——韩元预设 v70.72 换成了它
  //   （她 2026-09-18：「韩元 换这个₩ 就更好了」），别跟着当全角算。
  assert.equal(fitCtx.cells("₩"), 1);
  assert.equal(fitCtx.cells("-273,362 円"), 11);
  assert.equal(fitCtx.cells("¥1,000.00"), 9, "¥ 是窄的（U+00A5），别当全角");
});

test("放得下就不动，放不下才缩，缩到地板为止", () => {
  assert.equal(fitCtx.fit("¥1,000.00", 38, 9, 20), 38, "本来放得下的被缩了");
  assert.ok(fitCtx.fit("-273,362 円", 38, 9, 20) < 38);
  assert.ok(fitCtx.fit("₩-25,970,000", 38, 9, 20) < fitCtx.fit("-273,362 円", 38, 9, 20), "越长该越小");
  assert.equal(fitCtx.fit("-".repeat(400), 38, 9, 20), 20, "再长也不许小过地板");
  assert.equal(fitCtx.fit("", 38, 9, 20), 38);
  assert.equal(fitCtx.fit(null, 38, 9, 20), 38, "没有数的时候别算出 NaN 字号");
});

test("钱包那几个大数都接上了缩放，而且一律不许换行", () => {
  assert.match(screens, /fontSize: fitFont\(txt, 38, 9, 20\), lineHeight: 1, color: NOTE_INK, whiteSpace: "nowrap"/, "大余额");
  assert.match(screens, /fitFont\(fmtMoney\(rec \? rec\.balance : 0, char\.id\), 28, 14, 17\)/, "存款概览");
  assert.match(screens, /fitFont\(fmtMoney\(\(rec && rec\.investAssets\) \|\| 0, char\.id\), 24, 15, 15\)/, "投资");
  assert.match(comp, /fontSize: fitFont\(String\(_tfAmt\), 32, 8, 16\), color: INK, lineHeight: 1, whiteSpace: "nowrap"/, "转账卡");
  // ⚠️卡上那个数不许再用 break-all：折在千分位逗号上是最难认的那种
  assert.ok(!/wordBreak: "break-all" \} \}, _tfAmt\)/.test(comp));
});

test("收入来源那一行：名目让步，金额一个字都不许折", () => {
  const seg = screens.slice(screens.indexOf('secTitle("收入来源")'), screens.indexOf('secTitle("收入来源")') + 1400);
  assert.match(seg, /className: "flex items-center min-w-0", style: \{ flex: 1, marginRight: 10 \}/, "名目那半边不会让步");
  assert.match(seg, /textOverflow: "ellipsis", whiteSpace: "nowrap" \} \}, s\.name\)/, "名目该省略号，不该换行");
  assert.match(seg, /color: t\.ink, flexShrink: 0, whiteSpace: "nowrap" \} \}, "\+" \+ fmtMoney\(s\.amount, char\.id\)\)/, "金额那半边会被挤折");
});

// ── A 类：她和【某一个角色】之间的钱，一处都不许再写死 ¥（她 2026-09-18「先a吧」）──
test("亲属卡整条链跟着角色的币种走", () => {
  // 卡面、刷卡通知、提额申请单
  assert.match(comp, /mTight\(remain == null \? \(limit \|\| 0\) : remain, character && character\.id\)/, "卡面额度");
  assert.match(comp, /"已用 " \+ mTight\(used \|\| 0, character && character\.id\)/, "已用/总额度");
  assert.match(comp, /"-" \+ mTight\(m\.amount \|\| 0, c && c\.id\)/, "刷卡通知的金额");
  assert.match(comp, /"账上扣除 · 还剩 " \+ mTight\(m\.remain, c && c\.id\)/);
  assert.match(comp, /"已加 " \+ mTight\(m\.add \|\| 0, c && c\.id\)/, "提额批复");
  assert.match(comp, /"想加 " \+ mTight\(m\.ask, c && c\.id\)/);
  // 喂给模型那几句也要换，不然他嘴里说的数跟卡上写的对不上
  assert.match(app, /"，想加 " \+ moneyText\(m\.ask, charId\)/);
  assert.match(app, /"；你加了 " \+ moneyText\(m\.add \|\| 0, charId\)/);
  assert.match(app, /"」，" \+ moneyText\(m\.amount \|\| 0, charId\) \+ " 从你账上扣了"/);
  // 商城结账那一屏的剩余额度
  assert.match(screens, /"剩余额度 " \+ \(\(typeof Money !== "undefined" && Money\) \? Money\.say\(remaining, cd\.charId\)/);
});

test("他手机里的购物、心愿单、问他这件东西、结欠账，都按他那边的钱", () => {
  assert.match(phone, /const shopMoney = \(n, charId\) => \(typeof Money !== "undefined" && Money\)/);
  const bareShop = (phone.match(/shopMoney\((?:[^()]|\([^()]*\))*\)/g) || [])
    .filter(x => !/char\.id/.test(x) && !/\(n, charId\)/.test(x));
  assert.deepEqual(bareShop, [], "他手机里还有不知道是谁的钱：" + bareShop.join(" / "));
  assert.match(app, /const wishFor = charId =>/, "心愿单是念给某个角色听的");
  assert.match(app, /wishFor\(char\.id\)/);
  assert.match(app, /\(isFinite\(price\) \? "｜" \+ moneyText\(price, charId\) : ""\)/, "问他这件商品");
  assert.match(app, /\+ moneyText\(Math\.round\(amt\), charId\) \+ "，已记进余额"/, "结欠账那句 toast");
  assert.match(app, /转给「" \+ who \+ "」" \+ moneyText\(m\.amount, m\.toId\)/, "群里转账喂给模型那句");
});

test("代付：清单、合计、他的余额一律同一个单位——最怕的是混着", () => {
  const seg = app.slice(app.indexOf("用你自己的钱帮 Ta 结账"), app.indexOf("用你自己的钱帮 Ta 结账") + 400);
  assert.match(seg, /moneyText\(x\.price, charId\)/, "清单");
  assert.match(seg, /"，合计 " \+ moneyText\(total, charId\)/);
  assert.match(seg, /"。你当前余额约 " \+ moneyText\(Math\.round\(bal\), charId\)/);
  assert.ok(!/合计 ¥" \+ total \+ "。你当前余额约 ¥/.test(app), "还混着两种单位，他没法拿余额跟合计比");
});

// ⚠️B 类是【定下来不收】的，不是漏的：说不清这笔钱是谁的。
//   哪天要收，得先定它跟谁走（群红包按发的人还是按抢的人？）。
test("B 类仍旧是人民币，而且是有意的", () => {
  assert.match(comp, /"钱包余额 ¥"/, "她自己的钱包（发红包那一屏）");
  // v71.62 那句前面多了专属红包那一档；B 类的口径没变：红包这一屏仍旧是人民币
  assert.match(app, /"红包已发出 ¥" \+ a/, "红包发给一群人，说不清是谁的币");
  assert.match(screens, /"钱包里还有 ¥"/, "商城是她在逛");
});

// C 类：入口方向，删了就坏了
test("解析模型交回来的金额时照旧吃掉 ¥——那是【进来】的方向", () => {
  assert.match(app, /replace\(\/\[,，\\s¥￥\$元\]\/g, ""\)/);
});

// ── 转账那一屏（她 2026-09-18：「转账是个半窗改一下，还有那个 cny 也改成符号」）──
// ⚠️v70.67 改口径，这一条上一版钉错了。她说「转账是个半窗改一下」，我照
//   no-half-sheet.md 改成了整页——可那条规矩的判据是「需不需要同时看见底下那一层」，
//   而这一层只有金额和附言两样，正是它自己写明的例外：「选一下就走的」。
//   何况改出来的连整页都不是：h-full 长在聊天区的 flex 里，只占输入栏底下那一半，
//   下面空掉一大截（她 2026-09-18：「我让你做框你给我做了个什么东西」）。
//   现在是【居中的框】，走全库共用的 appDialogPortal。
test("转账是个居中的框，而且走公共那一层挂载", () => {
  const seg = comp.slice(comp.indexOf("function TransferComposeSheet("), comp.indexOf("// 发位置:写一个地名"));
  assert.ok(!/h\(Sheet, \{/.test(seg), "又变回半窗了");
  assert.match(seg, /return appDialogPortal\(/, "自己写了一个居中的盒子——那就是第二份挂载层");
  assert.ok(!/h-full flex flex-col/.test(seg), "整页那一版又回来了：它会长在聊天区的 flex 里，只占半屏");
  assert.ok(!/h\(Head, \{/.test(seg), "框不需要顶栏");
  assert.match(seg, /onClick: e => e\.stopPropagation\(\)/, "点框里面会把框点没");
  assert.match(seg, /appDialogPortal\([\s\S]*?,\n    onClose\);/, "点遮罩关不掉");
});

test("整个框统一按对方的币种，不再一处 CNY 一处 ¥ 一处 円", () => {
  const seg = comp.slice(comp.indexOf("function TransferComposeSheet("), comp.indexOf("// 发位置:写一个地名"));
  assert.ok(!/"CNY"/.test(seg), "写死的 CNY 还在");
  assert.match(seg, /cur\.pos === "pre" \? sym : null/, "符号要跟着前后位置走");
  assert.match(seg, /cur\.pos === "post" \? sym : null/);
  assert.match(seg, /const balText = myBalance == null \? "—" : \(M \? M\.fmt\(myBalance, charId\) : "¥" \+ myBalance\)/, "余额还写死 ¥");
  // 两个调用点都得告诉它对方是谁
  assert.match(comp, /charId: character && character\.id,\n    myBalance: myBalance,/, "单聊那个入口");
  assert.match(comp, /charId: xferMember\.id,\n    myBalance: myBalance,/, "群里那个入口");
});

// ⚠️这一条是会真的转错钱的地方：她按【他那边的数】敲，扣的是人民币。
test("她敲的数要折回人民币再送出去，而且当场告诉她钱包会扣多少", () => {
  const seg = comp.slice(comp.indexOf("function TransferComposeSheet("), comp.indexOf("// 发位置:写一个地名"));
  assert.match(seg, /const cny = M \? M\.parse\(amount, charId\) : \(Number\(amount\) \|\| null\);/);
  assert.match(seg, /const submit = \(\) => \{ if \(enough\) onSend\(cny, note\.trim\(\)\); \};/, "把没折算的数直接送出去了");
  assert.ok(!/onSend\(a, note\.trim\(\)\)/.test(seg), "旧的 Number(amount) 那条路还在");
  assert.match(seg, /"从你钱包扣 ¥" \+ cny\.toFixed\(2\)/, "不是人民币时没说清真正扣多少");
  // 余额不够就按不下去——原来一按就是一条「余额不足」的 toast，钱先发出去了才知道
  assert.match(seg, /const enough = cny != null && cny > 0 && \(myBalance == null \|\| cny <= Number\(myBalance\) \+ 1e-9\);/);
  assert.match(seg, /disabled: !enough/);
});

test("韩元预设用 ₩，而且是前置的（₩1,000，不是 1,000 ₩）", () => {
  assert.match(screens, /\{ code: "KRW", symbol: "₩", rate: 190, pos: "pre", dec: 0, zh: "韩元" \}/);
  assert.ok(!/symbol: "원"/.test(screens), "원 那一版还在");
  M.setBook({ k: { code: "KRW", symbol: "₩", rate: 190, pos: "pre", dec: 0 } });
  assert.equal(M.fmt(3000, "k"), "₩570,000");
  assert.equal(M.say(50, "k"), "₩9500");
});

test("改余额那个框里，各家的符号都要认得出来", () => {
  M.setBook({ k: { symbol: "₩", rate: 190, dec: 0 }, j: { symbol: "円", rate: 20, pos: "post", dec: 0 } });
  assert.equal(M.parse("₩570,000", "k"), 3000);
  assert.equal(M.parse("570000", "k"), 3000);
  // 她手敲一个「원」进来也得认——预设换成 ₩ 了，可键盘上打出来的多半还是这个
  assert.equal(M.parse("9,500 원", "k"), 50);
  assert.equal(M.parse("1,000 円", "j"), 50);
});
