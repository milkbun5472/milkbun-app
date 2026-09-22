// 线上聊天掉格式：整轮全是身体动作描写、一句话没说（她 2026-09-22 读者样张）。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const G = require("../js/bubble-act-guard.js");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("她那张样张：四条全挪进动作行，一条气泡都不剩", () => {
  const sample = ["我把脸颊在她怀里贴紧了蹭两下", "白发全蹭乱了堆在她锁骨边", "环在她后腰的手微微收紧", "不让她滑下去"];
  const r = G.split(sample, {});
  assert.deepStrictEqual(r.words, [], "这一轮没有一句话，不该留下气泡");
  assert.deepStrictEqual(r.acts, sample, "正文要原样留着，只是换个地方显示");
});

test("正经聊天一个字都不许动", () => {
  [
    ["在干嘛呢", "我刚下班"],
    ["我妈今天来了", "她带了汤"],          // 第三方的「她」，没有身体动作
    ["你到了吗", "我在楼下等你"],
    ["她说明天不来了", "所以我们改后天吧"]
  ].forEach(list => {
    const r = G.split(list, {});
    assert.deepStrictEqual(r.words, list, "误判了：" + list.join(" / "));
    assert.deepStrictEqual(r.acts, []);
  });
});

test("只有一条时不落刀，宁可漏判", () => {
  assert.deepStrictEqual(G.split(["环在她后腰的手微微收紧"], {}).acts, []);
});

test("称谓设成第三人称的场次整把刀不落", () => {
  const sample = ["我把脸颊在她怀里蹭了蹭", "环在她后腰的手收紧"];
  assert.deepStrictEqual(G.split(sample, { secondPerson: false }).words, sample);
});

test("一条里出现「你」就说明在跟她说话，整轮都不算掉格式", () => {
  const list = ["我把脸颊在她怀里蹭了蹭", "你别动"];
  assert.deepStrictEqual(G.split(list, {}).words, list);
});

test("单聊线上接上了这把刀，动作行不看动描开关", () => {
  const app = R("js/app.js");
  const i = app.indexOf("      const _actGuard = window.BubbleActGuard");
  assert.ok(i > 0, "单聊线上没接 BubbleActGuard");
  const j = app.indexOf("      const onlineAction = TVG.normalizeAction(", i);
  assert.ok(j > i, "抠不出单聊那一段");
  const seg = app.slice(j, j + 1400);
  assert.match(seg, /if \(rescuedActLines\.length\)/, "救回来的几行没摆出去");
  assert.match(seg, /\} else if \(_actDesc && onlineAction/, "救回来之后还要再摆一次状态卡的动作，会重复");
});

test("群聊线上走的是同一个模块（四处一样喂）", () => {
  const app = R("js/app.js");
  const i = app.indexOf("            const _gGuard = window.BubbleActGuard");
  assert.ok(i > 0, "群聊线上没接 BubbleActGuard");
  const seg = app.slice(i, i + 2600);
  assert.match(seg, /if \(gRescuedActs\.length && spk\)/, "群里救回来的几行没摆出去");
  assert.match(seg, /if \(!gRescuedActs\.length && _gActDesc/, "群里也会摆两次");
});

test("index.html 装了这个文件", () => {
  assert.match(R("index.html"), /js\/bubble-act-guard\.js\?v=/);
});
