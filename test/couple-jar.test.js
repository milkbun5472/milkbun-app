// 她 2026-10-10 转群友：「情侣空间能不能开个共同账户，那种互相往里放钱的」——只给情侣、两个人都能自己取、要目标、TA 发工资会自己存
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");

function load({ together = true, wallet = 500, charBal = 300, jar } = {}) {
  const i = app.indexOf("  const JAR_LOG_KEEP = "), j = app.indexOf("  const setCoupleImg = ", i);
  assert.ok(i > 0 && j > i, "抠不出存钱罐那一段");
  const st = { home: { c1: { wishes: [], jar } }, my: [], his: [], chat: [], toasts: [] };
  const lib = new Function("coupleHomeRef", "couples", "characters", "walletRef", "charBalanceOf", "changeWallet", "adjustCharBalance", "saveCoupleHome", "pChat", "toast", "userName", "profile",
    app.slice(i, j) + "\nreturn { jarMove, jarSetGoal, jarSetAuto, jarContext, jarOf };")(
    { get current() { return st.home; } }, { c1: { status: together ? "together" : "dating" } }, [{ id: "c1", name: "陆闻" }],
    { current: wallet }, () => charBal,
    (d, label) => st.my.push([d, label]), (cid, d, label) => st.his.push([d, label]),
    (cid, fn) => { st.home = { ...st.home, [cid]: fn(st.home[cid] || {}) }; },
    (cid, fn) => { st.chat = fn(st.chat); }, m => st.toasts.push(m), () => "Lisa", {});
  return { lib, st };
}

test("她放进去扣她的钱包、TA 取出来回 TA 的钱包；罐子和聊天里都记一笔", () => {
  const { lib, st } = load();
  assert.equal(lib.jarMove("c1", "me", 200, "先放点"), true);
  assert.equal(st.my[0][0], -200);
  assert.equal(st.home.c1.jar.balance, 200);
  assert.equal(st.home.c1.jar.ledger[0].who, "me");
  assert.match(st.chat[0].content, /Lisa 往你们的存钱罐里放了 200（先放点），罐子里现在 200/);
  assert.equal(lib.jarMove("c1", "char", -50, "买咖啡"), true);
  assert.equal(st.his[0][0], 50, "TA 取出来进 TA 的钱包");
  assert.equal(st.home.c1.jar.balance, 150);
});

test("钱不够就不动：她的钱包、TA 的钱包、罐子三处都查", () => {
  const { lib, st } = load({ wallet: 100, charBal: 20 });
  assert.equal(lib.jarMove("c1", "me", 200), false);
  assert.equal(lib.jarMove("c1", "char", 50), false);
  assert.equal(lib.jarMove("c1", "me", -10), false);
  assert.equal(st.my.length + st.his.length, 0);
});

test("只给正式在一起的", () => {
  const { lib, st } = load({ together: false });
  assert.equal(lib.jarMove("c1", "me", 10), false);
  assert.equal(lib.jarContext("c1"), "");
});

test("攒到目标落一行灰字，只报一次", () => {
  const { lib, st } = load({ jar: { balance: 900, goal: { name: "海边", amount: 1000 }, autoPct: 10, ledger: [] } });
  lib.jarMove("c1", "me", 150);
  assert.ok(st.home.c1.jar.goal.hitTs);
  assert.equal(st.chat.filter(m => /攒到目标/.test(m.content)).length, 1);
  lib.jarMove("c1", "me", 10);
  assert.equal(st.chat.filter(m => /攒到目标/.test(m.content)).length, 1);
});

test("TA 的手、发工资自己存、页面和挂点都接上", () => {
  assert.match(app, /if \(isCouple && !sideRoom\) \{\n\s+openCaps\.push\("jar"\);/);
  assert.match(app, /parsed\.jar && typeof parsed\.jar === "object" && !sideRoom && jarOpen\(charId\)/);
  assert.match(app, /const amt = Math\.floor\(inc \* _paidN \* pct \/ 100\);/);
  assert.match(app, /parsed\.transfer = null; parsed\.jar = null;/, "不回话那一轮也不许偷偷动罐子");
  assert.match(scr, /function CoupleJar\(\{ partner, data, wishes, myWallet, myName, onMove, onGoal, onBack \}\)/);
  assert.match(scr, /wall\("jar", \{/);
  assert.match(scr, /\["jar", "存钱罐"\]/, "我的钱包认得这一类");
  assert.match(ts, /\["jarpage", /); assert.match(ts, /\["jarglass", /); assert.match(ts, /\["jarrow", /);
});
