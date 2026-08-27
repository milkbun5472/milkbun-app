const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
// 注释里会提到旧写法（「以前是 Math.random() < 0.85」），查真代码时要把注释行滤掉
const noComment = src => src.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
const app = noComment(R("app.js")), comp = R("components.js");

// 她 2026-08-27：「转账旁边没有头像」「等我转完账按回复按钮他们才回复」
// 「那个转账领取逻辑…应该要根据人设和情景决定收不收或者退回」
test("收不收不再掷骰子——Math.random 那两处都没了", () => {
  assert.doesNotMatch(app, /respondTransfer\(charId, tid, accept\);\n\s*\/\/ 盲盒/, "旧的自动结算还在");
  assert.doesNotMatch(app, /Math\.random\(\) < 0\.85/, "还在按 85% 概率随机收下");
  assert.doesNotMatch(app, /autoRespondTransfer/, "那个函数要删掉，不是留着没人叫");
});

test("转出去只是挂着，不自己触发一轮回复", () => {
  const i = app.indexOf("const sendTransfer = (charId, amount, note)");
  const seg = app.slice(i, app.indexOf("\n  };", i));
  assert.doesNotMatch(seg, /setTimeout/, "转完不该再安排任何自动动作");
  assert.match(seg, /toast\("转账已发出，等 TA 点开"\)/);
  const j = app.indexOf("const sendGroupTransfer = (groupId, memberId");
  assert.doesNotMatch(app.slice(j, app.indexOf("\n  };", j)), /setTimeout/, "群里也一样");
});

test("挂着那笔要喂给 TA，并说清由人设和情形决定", () => {
  const i = app.indexOf("const _pendingTf = (() => {");
  assert.ok(i > 0, "没有取挂着那一笔");
  const seg = app.slice(i, i + 2200);
  assert.match(seg, /m\.dir === "toChar" && m\.status === "pending"/, "只找她转出去、还没处理的那种");
  assert.match(seg, /由你这个人和此刻的情形定，不是默认收/);
  assert.match(seg, /退回尤其得让她知道你为什么退/);
  assert.match(seg, /这一轮还顾不上处理就【省略 transferAccept】/, "得留「这轮不处理」这个出口");
});

test("字段要真的开放出去，也要写进字典", () => {
  assert.match(app, /if \(tfHint\) \{ openCaps\.push\("transferAccept"\); capState\.push\(tfHint\.trim\(\)\); \}/, "没挂进本轮开放能力");
  assert.match(app, /transferAccept:true\|false=对【她转过来还挂着的那一笔】表态/, "字段字典里没写");
});

test("表态了才结算，省略就继续挂着", () => {
  const i = app.indexOf("let _tfTook = false;");
  assert.ok(i > 0, "没接结算");
  const seg = app.slice(i, i + 500);
  assert.match(seg, /parsed\.transferAccept === true \|\| parsed\.transferAccept === false/, "只认真的 true/false，省略不动");
  assert.match(seg, /respondTransfer\(charId, _pendingTf\.tid, parsed\.transferAccept === true\)/);
});

test("群里同样接上，而且只结算转给他本人那一笔", () => {
  assert.match(app, /const gPendingTf = /, "群里没取挂着那几笔");
  assert.match(app, /\+ gBiHint \+ gTfHint \+/, "取了却没拼进 system");
  assert.match(app, /const _mine = gPendingTf\.find\(x => x\.toId === spk\.id && x\.status === "pending"\)/,
    "得按发言人对上收款人，别替别人收钱");
});

// 她 2026-08-27：「转账旁边没有头像」
test("转账卡带头像，和位置卡同一个摆法", () => {
  assert.match(comp, /function TransferCard\(\{\n  m,\n  isU,\n  onRespond,\n  avatar,\n  myAvatar\n\}\)/, "卡片没收头像");
  const i = comp.indexOf("function TransferCard(");
  const seg = comp.slice(i, comp.indexOf("\nfunction ", i + 10));
  assert.match(seg, /className: "py-1 flex items-start gap-2 "/, "没照位置卡那套排");
  assert.match(seg, /\}, !isU && avatar, h\("div", \{/, "对方的头像该在左边");
  assert.match(seg, /\}, statusLabel\)\), isU && myAvatar\);/, "我的头像该在右边");
  // 两处调用各自都要把头像递进去（别的卡片也用同样的写法，所以要卡在 TransferCard 这两处上）
  const calls = [...comp.matchAll(/h\(TransferCard, \{/g)].map(x => comp.slice(x.index, x.index + 340));
  assert.equal(calls.length, 2, "单聊 + 群聊两处调用，现在有 " + calls.length + " 处");
  calls.forEach((c, k) => {
    assert.match(c, /avatar:/, "第 " + (k + 1) + " 处没传对方头像");
    assert.match(c, /myAvatar:/, "第 " + (k + 1) + " 处没传我的头像");
  });
});
