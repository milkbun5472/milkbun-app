// 我的钱包（她 2026-10-09）：像角色钱包那样按类分开、每笔能追溯到来源、能换币种；钱一分不编。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const R = f => fs.readFileSync(__dirname + "/../js/" + f, "utf8");
const app = R("app.js"), scr = R("screens.js"), comp = R("components.js");
const wallet = scr.slice(scr.indexOf("function MyWallet("), scr.indexOf("const CUR_PRESETS"));

test("每一笔记账都带出处（凭证）", () => {
  assert.match(app, /const changeWallet = \(delta, label, kind, ref\) => \{/);
  assert.match(app, /ref: ref && typeof ref === "object" \? Object\.assign\(\{ ts: Date\.now\(\) \}, ref\) : null/);
  assert.ok(!/changeWallet\([^;\n]*, "[a-z_]+"\);/.test(app), "还有记账没带出处");
  assert.match(app, /"transfer", \{ where: "单聊", charId: charId, ts: card\.ts \}/);
  assert.match(app, /"redpacket", \{ where: "群聊", groupId: groupId, ts: rp\.ts \}/);
});

test("钱包页：按类分开、本月进出、点开是凭证、能跳回聊天", () => {
  assert.match(wallet, /const KIND_GROUPS = \[\["transfer", "转账"\]/);
  assert.match(wallet, /"data-wk": "walletmonth"/);
  assert.match(wallet, /"data-wk": "walletproof"/);
  assert.match(wallet, /"data-wk": "wallettrace", onClick: \(\) => onTrace\(r\)/);
  assert.ok(!/callAI|runProbe/.test(wallet), "钱包页不许叫模型编账");
});

test("币种走公共那一份（键 __me__），只换显示", () => {
  assert.match(wallet, /M\.fmt\(n, "__me__"\)/);
  assert.match(wallet, /M\.parse\(amt, "__me__"\)/, "改余额时把她看到的币种换回人民币");
  assert.match(app, /onSetMyCur: c => setCharCurrency\("__me__", c\)/);
});

test("跳回聊天：单聊和群聊都会按那一刻定位", () => {
  assert.match(comp, /function useLocateAt\(locateAt, onLocated, messages, revealMsg, ref, archCount, winStartRef, single\)/);
  assert.equal((comp.match(/useLocateAt\(locateAt, onLocated, messages, revealMsg, ref, archCount, winStartRef, (true|false)\);/g) || []).length, 2);
  assert.match(app, /setWalletTrace\(\{ type: type, id: id, ts: r\.ts, key: Date\.now\(\) \}\)/);
});
