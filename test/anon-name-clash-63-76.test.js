// v63.76 她 2026-09-05：「三个碳水置换xx」——她的箱子里同时挂着三个几乎一样的网名。
// 病根：v63.75 说好「把别人写过的递过去躲开」，可【只递了签名，网名一个字都没递】。
// 同一个坑的另一半：说要躲开的那一层，只送了一半材料。
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const G = re => eval("(" + eng.match(re)[0].replace(/^function (\w+)/, "function") + ")");
const anonMaskAvoid = G(/function anonMaskAvoid\(anonAll, selfId\) \{[\s\S]*?\n\}/);
const anonMaskNames = G(/function anonMaskNames\(anonAll, selfId\) \{[\s\S]*?\n\}/);
const anonNameClash = G(/function anonNameClash\(name, taken\) \{[\s\S]*?\n\}/);

test("别人已经用了的网名要真的递过去", () => {
  const all = { c1: { netname: "碳水置换实验", bio: "下楼买两个包子。" }, c2: { netname: "塑料吸管", bio: "" }, c3: {} };
  assert.deepEqual(anonMaskNames(all, "c1"), ["塑料吸管"]);
  const out = anonMaskAvoid(all, "c2");
  assert.ok(out.includes("碳水置换实验"), "别人的网名没递过去");
  assert.match(out, /不许跟上面任何一个【一样，也不许只差一两个字】/);
  assert.match(out, /连词根都别沾/);
  // 只有网名没有签名时也得发（原来 rows 空就整段不发，那网名也跟着没了）
  assert.ok(anonMaskAvoid({ c1: { netname: "只有名字" } }, "c9").includes("只有名字"));
  assert.equal(anonMaskAvoid({}, "c1"), "");
});

test("撞的判据不是「一模一样」——她报的那三个字面并不相等", () => {
  const taken = ["碳水置换实验", "塑料吸管", "未行注释"];
  assert.equal(anonNameClash("碳水置换实验", taken), true, "完全一样");
  assert.equal(anonNameClash("碳水置换计划", taken), true, "同一个头，只换了尾巴");
  assert.equal(anonNameClash("碳水置换", taken), true, "别人的名字是它的延长");
  assert.equal(anonNameClash("偏航修正", taken), false);
  assert.equal(anonNameClash("七级还原", taken), false);
  // 标点和空格不算数
  assert.equal(anonNameClash("碳水·置换 实验", taken), true);
  // 短名字不许误伤（两个字的名字满大街，按前三字比会连坐）
  assert.equal(anonNameClash("No.", ["Nо"]), false);
  assert.equal(anonNameClash("", taken), false);
  assert.equal(anonNameClash("随便", []), false);
});

test("规矩降概率、代码兜死：第一次生成撞了就再要一次，还撞就退回她的名字", () => {
  assert.match(app, /anonNameClash\(mask\.netname, taken0\)/);
  assert.match(app, /跟这一屋子里已经有的撞了，这次换一个【完全不同】的说法/);
  assert.match(app, /else mask = \{ \.\.\.mask, netname: "" \};/, "还撞就别落这个名字");
  assert.match(app, /netname: mask\.netname \|\| char\.name/);
  // 只补这一次：她按次计费，不许在这儿转圈
  assert.equal((app.match(/await runProbe\(apiFor\(char\.id\), \{ \.\.\.ctxFor\(char\), recentChat: "" \}/g) || []).length, 3,
    "第一次生成 + 撞了那一次补发 + 刷新马甲，正好三枪");
});

test("「刷新马甲」那一路撞了就不落新网名，旧的留着", () => {
  assert.match(app, /const clash1 = typeof anonNameClash === "function" && anonNameClash\(d\.netname, taken1\);/);
  assert.match(app, /netname: \(clash1 \? "" : d\.netname\) \|\| cur\.netname \|\| char\.name/);
  // 得说清为什么名字没变，不然她以为按钮坏了
  assert.match(app, /网名跟别人撞了，先留着原来那个——再按一次试试/);
});
