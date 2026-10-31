const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const root = __dirname + "/../";
const app = fs.readFileSync(root + "js/app.js", "utf8"), comp = fs.readFileSync(root + "js/components.js", "utf8");
const src = fs.readFileSync(root + "js/ask-slip.js", "utf8");
const AskSlip = new Function(src.split("if (typeof window")[0] + "; return AskSlip;")();

test("请示那一行：没批只说事；批了带上谁批、批了什么", () => {
  assert.equal(AskSlip.line({ what: "买相机", amount: 3999, reason: "想拍你" }, "我"), "[请示] 我：买相机（3999 块）；理由：想拍你");
  assert.match(AskSlip.line({ what: "请假", status: "rejected", judge: "阿秋", note: "不准" }), /阿秋 批：驳（不准）$/);
  assert.match(AskSlip.line({ what: "买", amount: 5, status: "paid" }), /批：我出$/);
});

test("群里过半才准，一样多算驳", () => {
  const p = (y, n) => ({ options: [{ voters: y }, { voters: n }] });
  assert.equal(AskSlip.tally(p(["a", "b"], ["c"])).status, "approved");
  assert.equal(AskSlip.tally(p(["a"], ["c"])).status, "rejected");
  assert.equal(AskSlip.amountOf("-12.345"), 12.35);
  assert.equal(AskSlip.amountOf(""), 0);
});

test("单聊群里都接上：递、批、TA自己递；钱只在结案那一处动", () => {
  ["const sendAsk = (", "const settleAsk = (", "const startAsk = (", "const postAsk = (", "const settleGroupAsk = ("].forEach(k => assert.ok(app.includes(k), k));
  assert.match(app, /openCaps\.push\("askVerdict"\)/);
  assert.match(app, /openCaps\.push\("askNew"\)/);
  assert.match(app, /item\.askNew && typeof item\.askNew === "object" && spk/);
  assert.match(app, /onStartAsk: a => startAsk\(activeGroup\.id, a\)/);
  const seg = app.slice(app.indexOf("const settleGroupAsk = ("), app.indexOf("// 成员自己发起的投票"));
  assert.match(seg, /groupClosed\(groupId\)/, "闭群是过家家，不动钱");
  assert.ok(comp.includes('["ask", "请示", "checklist"]'));
});

test("被驳了再递：第几次、前几回的理由和批语都带上", () => {
  const a2 = AskSlip.again({ aid: "x", what: "买相机", amount: 10, reason: "想拍你", note: "太贵" }, "我出一半");
  assert.equal(a2.round, 2); assert.equal(a2.prevAid, "x");
  assert.deepEqual(a2.before, [{ reason: "想拍你", note: "太贵" }]);
  assert.equal(AskSlip.again({ ...a2, note: "还是贵" }, "求你").round, 3);
  assert.match(AskSlip.line(a2, "我"), /^\[请示·第2次递\].*前几回：理由「想拍你」被驳（太贵）/);
});

test("准，但是：条件写进那一行，之后能被翻出来", () => {
  assert.match(AskSlip.line({ what: "通宵", status: "approved", cond: "明天早起", judge: "他" }), /批：准，但是：明天早起$/);
  assert.match(app, /_askConds = \(chatsRef\.current\[charId\] \|\| \[\]\)\.filter/);
  assert.match(app, /askNew（再递）/);
});

test("第二批：群里吵、批了交差、钱包档案", () => {
  assert.match(app, /if \(poll\.ask && v\.after\) \{ banter\.push\(v\); continue; \}/, "呛的那几句不算票");
  assert.match(app, /askFollow: \{ what: fa\.what/);
  assert.match(app, /opts\.askFollow \? askFollowHint :/);
  assert.match(app, /asks: peekMaskView\(\) \? null : askArchive\(\)/, "被翻手机时不给档案");
  const ui = fs.readFileSync(root + "js/screens-ui.js", "utf8");
  assert.match(ui, /view === "asks" && asks/);
});

test("批复存根：他批的跟转账一样在那一轮最上面结，群里结案也落一张", () => {
  const tf = app.indexOf("respondTransfer(charId, _pendingTf.tid"), av = app.indexOf("if (parsed.askVerdict && !(room && !room.main))");
  const words = app.indexOf("for (let i = 0; i < words.length; i++) {", tf);
  assert.ok(tf > 0 && av > tf && av < words, "批示要在他开口之前结");
  assert.match(app, /askReceipt: \{ aid, what: card\.what/);
  assert.match(app, /askReceipt: \{ aid: pollId, what: poll\.ask\.what, status: tl\.status, group: true/);
  assert.match(comp, /if \(m\.askReceipt\) \{ const meSide/);
  assert.equal(AskSlip.no("ask_1"), AskSlip.no("ask_1"));
});

test("请示能附一张图：卡上看得见，单聊批的那轮、群里投票那一枪都给模型看", () => {
  assert.match(src, /＋ 加一张图（可以不加）/);
  assert.match(src, /row\("附图"/);
  assert.match(app, /\(m\.kind === "photo" \|\| m\.kind === "selfie" \|\| m\.kind === "ask"[^)]*\) && m\.imageRef \? \[m\.imageRef\] : \[\]/);   // 后面可以再接别的（购物图 goodsImg，v88.831）
  assert.match(app, /_imageRefs: \[poll\.ask\.imageRef\] \}\], 1\)/);
  assert.match(AskSlip.line({ what: "买", imageRef: "iv_x" }), /附了一张图/);
});
