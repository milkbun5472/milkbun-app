// 进群验证（她 2026-10-28：「上传支付宝年龄截图，过 18 给 Q 群链接；用她们自己的 API 读图，正好验证会不会接 API」）
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs"), path = require("path");
const nest = fs.readFileSync(path.join(__dirname, "../js/nest.js"), "utf8");
const i = nest.indexOf("function VerifyPanel("), j = nest.indexOf("function Login(", i);
const V = nest.slice(i, j);
test("记录只在管理中看得到，入口挂在管理那一行", () => {
  assert.ok(i > 0 && j > i, "抠不出 VerifyPanel");
  assert.match(nest, /onVerify: \(\) => push\(\{ v: "verify" \}\)/);
  assert.match(nest, /if \(top && top\.v === "verify"\) return h\(VerifyPanel,/);
  for (const p of ['"/verify/log?off="', '"/verify/conf"', '"/verify/shot?id="', '"/verify/drop"']) assert.ok(V.includes(p), "少了 " + p);
});
test("留底那张：点开才取、能单张删、能一键清空，删之前都问一句", () => {
  assert.match(V, /const openShot = async id =>/, "没有「点开才取」那一步");
  assert.doesNotMatch(V, /d\.rows[^\n]*\.data/, "名单不该把图一起发下来");
  assert.match(V, /requestAppConfirm\(all \? "清空留底" : "删掉这一张"/);
  assert.match(V, /body: all \? \{ all: true \} : \{ id \}/);
});
test("说清楚了这儿看不到是谁，以及开关关了会怎样", () => {
  assert.ok(V.includes("手写那张和她们的密钥都不到这儿来。留底那张只有你看得到，"));
  assert.ok(V.includes("谁来都只看到「去群里找群主」"));
  assert.ok(V.includes("还没设群号：验过了也拿不到"));
});
// 她 2026-10-29：「加个看得到总数的」——次数之外要报人数（同一个号验两次只算一个人）
test("验这页报的是次数和人数两个", () => {
  assert.match(V, /d\.people \|\| 0\) \+ " 个人/);
  assert.ok(V.includes("同一个号验两次只算一个人"), "没说清人数是怎么算的");
});

// 入群答案（她 2026-11-02：「门审核通过了，给她们 QQ 群答案才能进群」）
test("入群答案：管理里能设、能看，设了才在门上给", () => {
  assert.match(V, /const setAns = \(\) =>/, "没有设答案那一步");
  assert.match(V, /body: \{ answer: String\(v \|\| ""\)\.trim\(\) \}/, "答案没原样存");
  assert.ok(V.includes("留空＝只给群号。"), "没说清留空会怎样");
  assert.ok(V.includes('"设答案"'), "管理面上没有那颗");
});

test("门那一页：答案单独一块、能单独复制，群主没设就不出现", () => {
  const door = fs.readFileSync(path.join(process.env.HOME, "yanqiu-den/qiuqiu-door/public/index.html"), "utf8");
  assert.match(door, /if \(v\.answer\) \{/, "没接住 answer");
  assert.ok(door.includes('$("ansBox").style.display = "none"'), "没设答案时那一块没藏起来");
  assert.match(door, /\$\("copyAns"\)\.onclick = copier\("ans",/, "答案没有自己的复制键");
  assert.ok(!/autumn-drawer|qiuqiu-machine/.test(door), "门那一页不许出现秋秋的地址");
});

// 查一个连挂十几次的号时，这一行什么都看不出来（她 2026-11-04）
test("验证记录：模型抄出来的那句话摆出来，站子和模型不许被截掉", () => {
  assert.match(V, /"模型抄出来的：" \+ r\.seen/, "没把模型抄出来的那句话摆出来");
  assert.ok(V.includes("r.seen ?"), "没过才有那句话，这儿应当按有没有来显示");
  const row = V.slice(V.indexOf('"nestverifyrow"'));
  const line = row.slice(row.indexOf("when(r.at)") - 400, row.indexOf("when(r.at)"));
  assert.ok(!/className: "truncate"/.test(line), "带站子和模型那一行又被 truncate 截掉了");
});
