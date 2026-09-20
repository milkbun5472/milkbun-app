// 转账谁给谁，别再认反（她 2026-09-20：「他给我转钱老是说是我给他」）。
//
// 病根：聊天里存的那条正文是写给【她】看的旁白——「[转账] 你向 沈清和 转了 ¥200」。
// 它原样进了模型历史，可在一条 role:"user" 的消息里，「你」按全库惯例指的是【角色】
// （送礼那条「当面给你：」就是这个惯例）。于是每一笔她转出去的钱都自相矛盾；
// 他自己转的那条又用第三人称自称，像在转述别人的事。
//
// 喂给模型的那一份现在一律点名，一个第二人称都不留；屏幕上那句不动（TransferCard 从
// amount/dir/status 画，压根不读 content）。
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// ---- 1. 那句话本身：两个方向都点名，状态跟着卡走 ----
const i = app.indexOf("  const transferLineForModel = (m, fromName, toName, charId) => {");
const j = app.indexOf("\n  };", i);
assert.ok(i > 0 && j > i, "app.js 里抠不出 transferLineForModel");
const src = app.slice(i, j + 4).replace(/^\s*const transferLineForModel = /, "");
const make = new Function("moneyText", "return (" + src.trim().replace(/;$/, "") + ")");
const line = make((a) => "¥" + a);

const toChar = line({ amount: 200, note: "打车回去", status: "pending" }, "Lisa", "沈清和", "c1");
assert.ok(toChar.includes("Lisa 把 ¥200 转给 沈清和"), "她转出去那笔没点名：" + toChar);
assert.ok(toChar.includes("还挂着没点"), "挂着的状态没带上：" + toChar);
assert.ok(toChar.includes("打车回去"), "附言丢了：" + toChar);

const toMe = line({ amount: 200, status: "accepted" }, "你（沈清和）", "Lisa", "c1");
assert.ok(toMe.includes("你（沈清和） 把 ¥200 转给 Lisa"), "他转过来那笔没点名：" + toMe);
assert.ok(toMe.includes("已经收下"), "收了还是退了没带上：" + toMe);
assert.ok(line({ amount: 5, status: "returned" }, "A", "B", "c1").includes("退回"), "退回的状态没带上");

// 状态必须来自卡本身：结算那条是 kind:"system"，而 system 那一类压根不进模型历史
assert.match(app.slice(i, j), /m\.status === "accepted"/, "状态不是从卡上读的");

// ---- 2. 三个入口都接上了，而且都不再把 content 原样喂过去 ----
// 钉的是函数名和 kind 判断，不钉注释也不钉整行（anchor-on-code.md）
const calls = app.match(/transferLineForModel\(/g) || [];
assert.ok(calls.length >= 4, "transferLineForModel 只被调了 " + calls.length + " 处，接漏了");

// 单聊·她做的事那一侧
assert.match(app, /m\.kind === "transfer" \? transferLineForModel\(m, uName, char\.name, charId\)/,
  "单聊里她转出去那条没走 transferLineForModel");
// 单聊·他自己做的事那一侧（自述里不许再用第三人称叫自己名字）
assert.match(app, /transferLineForModel\(m, "你（" \+ char\.name \+ "）", uName, charId\)/,
  "单聊里他转过来那条没走 transferLineForModel");
// buildBundle 白送的那一层：单聊线上/线下/通话/穿书/匿名箱/解梦馆一次全有
const r = app.indexOf("const body = m.kind === \"transfer\"");
assert.ok(r > 0, "recentChat 那一层没接上——线下/通话还在吃原样的 content");
// 群聊
assert.ok(/m\.kind === "transfer" \? transferLineForModel\(m, m\.role === "user"/.test(app),
  "群聊那一层没接上");

// ---- 3. 亲属卡和代付：同一个形状，一起补 ----
assert.match(app, /m\.kind === "kinship" \? "【你给 " \+ uName \+ " 发了一张亲属卡/,
  "他发的亲属卡还在用第三人称自称");
assert.match(app, /m\.kind === "paylater" \? "【" \+ uName \+ "把一张购物清单推给你/,
  "代付请求没告诉他是谁推过来的、付没付");

// ---- 4. 屏幕上那句不许动：TransferCard 不读 content，正文原样留着给搜索/收藏 ----
assert.match(app, /content: "\[转账\] 你向 " \+ char\.name/, "屏幕上那条正文被改了——她说了只改模型看的");

console.log("✓ 转账方向：两个方向都点名、状态跟着卡走，四处入口都接上了");
