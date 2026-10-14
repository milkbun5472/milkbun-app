// 她 2026-10-14：「为啥到点了没有弹出来卡」——TA约她、她答应了的那张，到点也要弹
const test = require("node:test");
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
test("到点弹赴约卡：TA约她、她答应了的 dateask 也认", () => {
  const i = src.indexOf("const [dateArrive, setDateArrive]");
  const seg = src.slice(i, i + 2000);
  assert.ok(/x\.kind === "dateask" && x\.state === "accepted"/.test(seg));
  assert.ok(/x\.kind === "datereceipt" && x\.state === "pending"/.test(seg));
});

test("TA约的那张只有一句话：照发卡那天推出到点时刻", () => {
  const i = src.indexOf("const dateAtOf = m =>"), j = src.indexOf("\n  };", i);
  const dateAtOf = new Function("return " + src.slice(i + "const dateAtOf = ".length, j + 4))();
  const ts = new Date(2026, 9, 14, 12, 48).getTime();
  const at = x => { const d = new Date(dateAtOf({ ts, when: { text: x } })); return d.getDate() + " " + d.getHours() + ":" + d.getMinutes(); };
  assert.equal(at("今天 18:30"), "14 18:30");
  assert.equal(at("明晚七点半"), "15 19:30");
  assert.equal(at("下午三点"), "14 15:0");
  assert.equal(dateAtOf({ ts, when: { text: "改天" } }), 0);
});
