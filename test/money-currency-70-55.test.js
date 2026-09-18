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
