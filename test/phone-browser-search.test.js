// 浏览器：dock 上要写名字 + 搜索记录点进去看结果页
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadPhone, FIXTURES } = require("./helpers/phone-render.js");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "phone.js"), "utf8");
const P = loadPhone();
const char = { name: "某人", id: "c1" };

test("dock 那排也要写名字，否则只在 dock 的 app 等于不存在", () => {
  // 浏览器在四套布局里有三套【只在 dock】，dock 图标又不写字——
  // 她 2026-08-29：「我的查手机浏览器怎么找不到了」。
  const layouts = P.PHONE_DESKTOP_LAYOUTS;
  const dockOnly = [];
  layouts.forEach(L => {
    const pages = [].concat(...L.pages);
    L.dock.forEach(k => { if (pages.indexOf(k) < 0 && dockOnly.indexOf(k) < 0) dockOnly.push(k); });
  });
  assert.ok(dockOnly.length, "本来就该有只在 dock 的 app，这条测试才有意义");
  // 所以 appIcon 的文字不许再挂在 !compact 上
  assert.ok(SRC.indexOf('})), !compact && h("span", {') < 0, "dock 图标又没名字了");
  assert.match(SRC, /fontSize: compact \? 9\.5 : 11/, "dock 的名字要小一号，但必须有");
});

test("搜索记录点进去带上结果和「他点开了哪条」", () => {
  assert.match(SRC, /setOpen\(\{ title: x\.q,[^}]*results: x\.results, opened: x\.opened \}\)/,
    "点搜索记录没把结果带过去，详情页永远是空的");
});

test("搜索走自己的结果页，不再落进那个通用弹层", () => {
  assert.match(SRC, /const searchPage2 = open && open\._search \?/);
  assert.match(SRC, /const detail = open && !open\._search \?/, "两个都会渲染的话会叠两层");
  assert.match(SRC, /page\.body\),\n    searchPage2, detail\);/, "结果页没挂进渲染树");
});

test("结果条数是算出来的稳定值，不问模型要也不每次跳", () => {
  // 它只是页面上的装饰。为它多花一次调用不值，每次刷新跳一个数更假。
  assert.match(SRC, /phoneStableHash\(open\.title \|\| ""\) % 880000/);
  const P2 = new Function(SRC + "; return { phoneStableHash };")();
  const a = P2.phoneStableHash("她说算了是什么意思");
  const b = P2.phoneStableHash("她说算了是什么意思");
  assert.equal(a, b, "同一个搜索词每次进来必须是同一个数");
  assert.notEqual(a, P2.phoneStableHash("羊肉膻味怎么去干净"));
});

test("推演任务和 schema 都要了 results 和 opened", () => {
  const spec = P.phoneProbeSpec("browser", char, [], "", []);
  ["results", "opened", "source", "excerpt"].forEach(k =>
    assert.ok(spec.instruction.indexOf(k) > 0, k + " 没写进推演任务"));
  assert.ok(spec.schemaHint.indexOf("results") > 0);
  assert.ok(spec.schemaHint.indexOf("opened") > 0);
  // 判据：点开了哪条才是这一栏真正的东西
  assert.match(spec.instruction, /opened 才是这一栏真正的东西/);
  assert.match(spec.instruction, /搜索引擎会返回什么/, "没说清这层要写成搜索结果，会写成他的心里话");
});

test("结果页渲染得出来，脏数据不炸", () => {
  const props = { d: FIXTURES.browser, char, t: {}, onBack: () => {}, onRefresh: () => {}, refreshing: false, onPeek: () => {} };
  const sr = FIXTURES.browser.searches[1];
  const openObj = { title: sr.q, time: sr.time, _search: true, results: sr.results, opened: sr.opened };
  assert.doesNotThrow(() => loadPhone({ 1: openObj }).BrowserView(props), "结果页炸了");
  // 没有 results 的老数据（v57.74 之前存下来的）也得能开
  assert.doesNotThrow(() => loadPhone({ 1: { title: "旧的搜索记录", _search: true } }).BrowserView(props), "老数据没有 results 就炸了");
  [{ results: "不是数组" }, { results: [null, 3] }, { results: [{ title: {} }] }, { opened: {} }].forEach((bad, i) =>
    assert.doesNotThrow(() => loadPhone({ 1: { title: "q", _search: true, ...bad } }).BrowserView(props), "脏数据 " + i + " 炸了"));
});
