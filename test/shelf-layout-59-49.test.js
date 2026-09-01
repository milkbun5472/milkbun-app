const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require(path.join(__dirname, "..", "js", "phone.js"));
const ph = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const view = ph.slice(ph.indexOf("function ReadingView("), ph.indexOf("function ShoppingView("));

// 她 2026-09-01：「书架也是……we can keep the prompt of what we generate,
// but the layout is just straight up plagiarism」。抄的是三样：
// 大号编号 01/02、「/ english_slug」那行、一排横滑的书脊卡片。
test("编号、英文 slug、横滑书脊，三样都撤掉", () => {
  assert.ok(view.indexOf('String(si + 1).padStart(2, "0")') < 0, "大号编号还在");
  assert.ok(view.indexOf('"NO. " + no') < 0, "角上那个 NO. 标还在");
  assert.ok(view.indexOf('"/ " + (sh.slug') < 0, "那行英文 slug 还在");
  assert.ok(view.indexOf("const spine = (b, sh, i, pal)") < 0, "横滑书脊卡还在");
  // 书架那一段不许再有横滑容器（阅读档案那两条横滑不归这条管）
  const i = view.indexOf("const shelfCard = ");
  const seg = view.slice(i, view.indexOf("const shelfPage", i));
  assert.ok(seg.indexOf("overflow-x-auto") < 0, "一架书还是横着滑的——那是书店的陈列方式");
  // slug 连生成层一起撤：它只为了画那行装饰而存在
  const spec = P.phoneProbeSpec("reading", { id: "c1", name: "沈屿白", persona: "男" }, [], "", []);
  assert.ok(spec.instruction.indexOf("slug") < 0 && spec.schemaHint.indexOf("slug") < 0, "生成层还在要 slug");
});

// 一个人自己的书架和书店的区别只有一样：他读到哪儿了、哪本放着没动。
test("把书店没有的那样东西摆出来：走了多远、哪本停住了", () => {
  assert.match(view, /const readPct = txt =>/, "没有把「读到哪儿」折成进度");
  assert.match(view, /const stalled = txt =>/, "认不出哪本停住了");
  assert.match(view, /const bookRow = \(b, sh, i, pal\) =>/, "没有一本一行");
  assert.match(view, /pct != null \? h\("div"/, "没画走了多远那条线");
  assert.match(view, /本放着没动/, "一架的小字里没说有几本停住了");
  const spec = P.phoneProbeSpec("reading", { id: "c1", name: "沈屿白", persona: "男" }, [], "", []);
  assert.match(spec.instruction, /这一栏是这一页的主角/, "没告诉它 readAt 现在是主角");
  assert.match(spec.instruction, /每一架里至少有一本是停住的/, "没要求写出停住的那本");
});

// 真跑一遍：各种写法都要能折出进度，折不出就不画（不画比画错强）
test("真跑一遍：读到哪儿折成走了多远", () => {
  const src = view.slice(view.indexOf("const readPct = txt =>"), view.indexOf("const stalled = txt =>"));
  const readPct = new Function("return " + src.replace(/^\s*const readPct = /, "").replace(/;\s*$/, ""))();
  assert.equal(readPct("读到 62%"), 62);
  assert.equal(readPct("第 128/357 页"), 36);
  assert.equal(readPct("读完了，重读第二遍"), 100);
  assert.equal(readPct("买来就放着，一页都没翻"), 0);
  assert.equal(readPct("快看完了"), 92);
  assert.equal(readPct("刚开了个头"), 8);
  // ⚠️认不出来的必须返回 null——画一条瞎猜的线比不画更糟
  assert.equal(readPct("卷七·饮食果子"), null);
  assert.equal(readPct(""), null);
  assert.equal(readPct(null), null);
  // 分母是 0 不能炸，也不能画
  assert.equal(readPct("第 5/0 页"), null);
});
