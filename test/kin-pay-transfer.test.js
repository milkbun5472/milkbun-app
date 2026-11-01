// 她 2026-11-01 群友许愿「转账/红包可以用亲属卡」：单聊转账、群转账、群红包都能挑一张亲属卡付
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
// 一处刷卡，购物也走它
assert.equal((app.match(/const kinCharge = /g) || []).length, 1);
assert.match(app.slice(app.indexOf("const payWithKinship ="), app.indexOf("const receiveUse =")), /kinCharge\(charId, total/);
// 单聊：收款人自己那张不能刷；收下那一刻才刷，刷不过就当退回
assert.match(app, /extra\.kin !== charId \? extra\.kin : null/);
assert.match(app, /card\.kin && !kinCharge\(card\.kin, card\.amount/);
// 群转账、群红包
assert.match(app, /const sendGroupTransfer = \(groupId, memberId, amount, note, kinId\)/);
assert.match(app, /if \(kin\) \{ if \(!kinCharge\(kin, a, "在群里发红包", "redpacket"\)\) return; \}/);
// 卡主读得懂：不是买东西就说「拿去」
assert.match(app, /m\.source && m\.source !== "shop" \? "拿去" : "买了"/);
// 面板：一个公共的选择排，三处都用
assert.equal((comp.match(/h\(KinPayPick, /g) || []).length, 2, "转账面板（单聊、群共用）+ 红包面板");
assert.match(comp, /function KinPayPick\(\{ value, onChange, exclude, accent \}\)/);
assert.match(comp, /filter\(c => c\.charId !== exclude\)/);
assert.match(ts, /\["kinpay", /);
console.log("ok");
// 选中靠 ✓ 认，不只靠底色（美化会把底色盖掉）
assert.match(comp, /const pickMark = \(on, label\) =>/);
assert.ok((comp.match(/pickMark\(/g) || []).length >= 4, "单聊两排、群聊一排照片 + 付款那排都用");
