const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// 规则原文只从这一处拿（路径写在 test/_rules.js 那一行，搬家改一处就够）
const { ruleText } = require("./_rules.js");
const root = path.join(__dirname, "..");
const ph = fs.readFileSync(path.join(root, "js", "phone.js"), "utf8");
const view = ph.slice(ph.indexOf("function TallyView({"), ph.indexOf("// 时间线视图"));
const tabs = view.slice(view.indexOf("TALLY_TABS.map(x => h(\"button\""), view.indexOf("h(\"div\", { className: \"flex-1 min-h-0 overflow-y-auto px-5\""));

// 她 2026-09-01：「这几个 tab 药丸形状还是有点普通。以后这些 tab 尽量不要只是这种
// 基础款，之前留下来的我们慢慢改。」→ 施工规则/tabs-not-plain-pills.md
test("账本的五栏是账簿的索引标签，不是一排药丸", () => {
  assert.ok(tabs.indexOf("borderRadius: 99") < 0, "还是药丸");
  assert.match(tabs, /borderRadius: "9px 9px 0 0"/, "不是上圆下方的索引标签");
  // 选中那张满高、纸色，直接长进底下的账页里；没选中的往下缩一截
  assert.match(tabs, /marginTop: tab === x\.k \? 0 : 6/, "没选中的没往下缩，五张一样高就还是一排按钮");
  assert.match(tabs, /background: tab === x\.k \? TALLY_BG : "rgba\(244,242,238,\.08\)"/,
    "选中那张不是纸色的——它得跟底下那页是同一张纸");
  assert.match(tabs, /padding: tab === x\.k \? "10px 15px 9px" : "8px 13px 7px"/, "选中和没选中一样高");
});

test("那道朱线是这一行自己的底色，选中那张把自己那一段盖住", () => {
  // 线断在哪儿，就说明翻开的是哪一页。单独一条 div 的话，选中那张只能浮在线上面。
  assert.match(view, /background: "linear-gradient\(to top,rgba\(156,63,52,\.55\) 0 2px,transparent 2px\)"/,
    "朱线不是这一行的底色");
  assert.ok(view.indexOf('h("div", { style: { height: 2, background: TALLY_RED') < 0,
    "还留着单独那条朱线——它会横穿过选中那张标签底下");
  // overflow-x:auto 会连带把纵向也裁掉，所以标签不能靠负 margin 探出去
  assert.ok(tabs.indexOf("marginBottom: -") < 0, "标签想靠负 margin 探出去，横滑容器会把它裁掉");
});

test("选中态不只靠一个色差", () => {
  // 色弱和阳光下看屏幕的人只剩形状可依
  const varies = ["padding: tab === x.k", "marginTop: tab === x.k", "background: tab === x.k", "color: tab === x.k"]
    .filter(s => tabs.indexOf(s) > 0);
  assert.ok(varies.length >= 3, "选中态只变了颜色，形状和高度都没动");
  assert.match(tabs, /"aria-pressed": tab === x\.k \? "true" : "false"/, "读屏读不出哪一栏是开着的");
  // 深色底上写死 #fff 会白底白字（v59.62 抓到过）
  assert.ok(tabs.indexOf('"#fff"') < 0, "字色写死了 #fff");
});

test("界面上那句「这本账不记钱」撤了", () => {
  // 她 2026-09-01：「这段话删了吧有点挡住了」。撤掉就是删掉，不是留着改小。
  assert.ok(view.indexOf("这本账不记钱") < 0, "界面上那段话还在");
  assert.ok(view.indexOf("跟谁的都有，你只是其中一个") < 0, "界面上那段话还在");
  // 但取材层和推演任务那两处必须还钉着——模型那边不许写钱
  assert.match(ph, /【取材层】[\s\S]{0,200}这本账不记钱/, "取材层里的那句也被顺手删了");
  assert.match(ph, /\*\*这本账不记钱\*\*——钱是钱包的事/, "推演任务里的那句也被顺手删了");
  // 这一栏记的是什么，改由每一栏自己的抬头说
  ["句盖过章的话", "样他估过价的东西"].forEach(s => assert.ok(view.indexOf(s) > 0, "抬头没接住这件事：" + s));
});

test("规矩写下来了，放任何施工的都能看到", () => {
  const rule = ruleText("tabs-not-plain-pills");
  assert.match(rule, /这一组 tab 原样搬到另一个 app 里，还成立吗/, "没给判据");
  assert.match(rule, /新写的一律不许直接摆一排药丸/, "没说新写的怎么办");
  assert.match(rule, /改到哪一处、哪一处顺手换掉/, "没说旧的怎么办");
  // v59.66 时间线那两格改完了，规矩里那条挂号换成教训本身：
  // 位置对了不等于形状对了，判据要对着形状问
  assert.match(rule, /「位置有意义了」不等于改完了/, "那次「只改了一半」的教训没留下来");
  assert.match(rule, /判据要对着【形状】问，不是对着【摆放】问/, "没说清判据问的是什么");
});
