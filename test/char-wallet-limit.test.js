const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

// 她 2026-08-26：「之前阿屿给我转账了15000结果他负债-14000多还在累积这对吗宝宝！
// 额度应该得让他们控制一下」
test("角色得知道自己有多少钱——原来他对自己的余额一无所知", () => {
  assert.match(app, /ownWalletNote: \(\(\) => \{/);
  const i = app.indexOf("ownWalletNote: (() => {");
  const seg = app.slice(i, i + 1200);
  assert.match(seg, /你自己卡里现在有/);
  assert.match(seg, /绝不许承诺或转出超过你余额的钱/);
  assert.match(seg, /\*\*你已经透支了\*\*/, "欠钱要说清楚，不然他照旧大手大脚");
  assert.match(engine, /ctx\.ownWalletNote && ctx\.ownWalletNote\.trim\(\)\) parts\.push\("【你自己的钱】"/, "得真的拼进 system，不能声明完没人引用");
});

// 提示词降概率，代码才保证
test("代码这一道：转不出超过余额的钱", () => {
  const i = app.indexOf("const postCharTransfer = (charId, amount, note) =>");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /let a = Math\.round/, "要能改写金额，不能是 const");
  assert.match(seg, /if \(bal <= 0\) return;/, "一分没有就别转");
  assert.match(seg, /if \(a > bal\) a = Math\.round\(bal \* 100\) \/ 100;/, "超了就封顶到他真有的钱");
});

test("透支的人日常消费也要收敛，代码封顶 40", () => {
  const i = app.indexOf("const genDailySpend = async");
  const seg = app.slice(i, app.indexOf("const applyWalletDay", i));
  assert.match(seg, /const broke = bal <= 0;/);
  assert.match(seg, /已经透支】/, "提示词要告诉它");
  assert.match(seg, /if \(broke\) \{\s*let left = 40, out = \[\];/, "模型不听时代码兜住");
  assert.match(seg, /if \(broke\) return \[\{ item: "只买了口吃的"/, "没 API 的兜底也要跟着收敛");
});

// 她 2026-08-26：「我的钱包新角色过了好几天还是没出现日常消费」
test("补账不再只在打开钱包页时跑", () => {
  assert.match(app, /const walletCatchAllToday = async \(\) => \{/);
  const i = app.indexOf("const walletCatchAllToday = async");
  const seg = app.slice(i, i + 700);
  assert.match(seg, /for \(const c of liveChars\)/, "走 liveChars，别把 NPC 卷进会花钱的循环");
  assert.match(seg, /if \(!rec \|\| !rec\.init\) continue;/, "没建档的不动，建档要她自己点");
  // 开机那一拍和跨天那一拍都要接上：只接跨天的话，隔夜再开就赶不上了
  assert.equal((app.match(/\.then\(\(\) => walletCatchAllToday\(\)\)/g) || []).length, 2,
    "开机 + 跨天各一处");
});

test("补账本身的守卫还在：只补到昨天，最多 14 天", () => {
  const i = app.indexOf("const catchUpWallet = async char =>");
  const seg = app.slice(i, i + 900);
  assert.match(seg, /if \(lastKey >= cutoffKey\) return;/, "补过就空跑——所以挂到开机上也不费钱");
  assert.match(seg, /guard < 14/);
  assert.match(seg, /now\.getTime\(\) - 86400000/, "今天还没过完，不许提前把今天的钱花了");
});
