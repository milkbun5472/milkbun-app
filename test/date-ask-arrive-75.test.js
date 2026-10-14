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
