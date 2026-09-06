const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const ph = R("phone.js"), scr = R("screens.js");
const src = ph.slice(ph.indexOf("const PHONE_TA_KEEP"), ph.indexOf("function phoneProbeSpec("));
const K = new Function(src + "\nreturn { phoneTa, charTa };")();

// 她 2026-08-31：「把所有查手机里的『他』换成跟着实际性别走吧，我加了几个女生角色进来」。
// 这不只是称呼难看：查手机那一层通篇写死「他」，等于每一句提示词都在告诉模型这是个男的，
// 人设里写了女性也压不过一屏的「他」。
test("换称呼，但不许把不是代词的「他」也换掉", () => {
  const t = "他的钱：他对花钱的态度。其他人不知道，他们也不问。他弹吉他，还有他人送的。";
  assert.equal(K.phoneTa(t, "她"), "她的钱：她对花钱的态度。其他人不知道，他们也不问。她弹吉他，还有他人送的。");
  ["其他", "他们", "他人", "吉他"].forEach(w => assert.ok(K.phoneTa(t, "她").includes(w), w + " 被换坏了"));
  assert.equal(K.phoneTa("排他、利他、他杀、他乡、他律", "她"), "排他、利他、他杀、他乡、他律", "保护名单漏了");
  assert.equal(K.phoneTa("他去了他乡，其他他人他们他", "TA"), "TA去了他乡，其他他人他们TA");
});

test("默认那一档一个字都不动，也不许炸", () => {
  const t = "他的钱";
  assert.equal(K.phoneTa(t, "他"), t, "男性角色也被改写了一遍——白跑一趟");
  assert.equal(K.phoneTa(t, ""), t);
  assert.equal(K.phoneTa("", "她"), "");
  assert.equal(K.phoneTa(null, "她"), "");
  // 保护用的占位符不许漏在正文里
  // ⚠️这个 NUL 原来是【真的一个 0x00 字节】写在源码里，肉眼看不见。
  //   本身没坏（它就是要匹配那个占位符），但那正是 engine 里四条正则死掉的同一种写法，
  //   所以一并改成看得见的转义（no-control-chars-64-43 那道闸不留例外名单）。
  assert.ok(!/\x00/.test(K.phoneTa("其他他其他他", "她")), "占位符漏出来了");
  assert.equal(K.phoneTa("其他他其他他", "她"), "其他她其他她");
});

// ⚠️默认必须是「他」＝不改变现状。第一版我默认成了 TA，全量测试当场红了十三条——
// 那不是测试坏了，是它抓到「她已有的每一个角色的提示词都被悄悄改写了一遍」。
test("没设性别＝维持原样，一个已有角色都不动", () => {
  assert.equal(K.charTa({}), "他");
  assert.equal(K.charTa(null), "他");
  assert.equal(K.charTa({ gender: "" }), "他");
  assert.equal(K.charTa({ gender: "她" }), "她");
  assert.equal(K.charTa({ gender: "女" }), "她");
  assert.equal(K.charTa({ gender: "female" }), "她");
  assert.equal(K.charTa({ gender: "TA" }), "TA");
  assert.equal(K.charTa({ gender: "中性" }), "TA");
  // 默认那一档必须走快路，一个字都不碰
  assert.match(ph, /if \(!ta \|\| ta === "他"\) return String\(text \|\| ""\);/, "默认档也去跑一遍替换,白折腾还多一次保护还原");
});

// 只在一处改：211 行逐个手改必然漏，而且下次加一段又要重来
test("改在拼装的那一处，不是散在两百多行里", () => {
  assert.match(ph, /const _full = spec\.instruction \+/, "没先把整段拼出来");
  assert.match(ph, /instruction: phoneTa\(_full, charTa\(char\)\)/, "拼完没过称呼这一遍");
  const chunk = ph.slice(ph.indexOf("const _full = spec.instruction"), ph.indexOf("instruction: phoneTa(_full"));
  // ⚠️别把这几块的【先后顺序】冻进正则：中间插一块新的（v59.12 的 bondBlock）
  // 这条就红了，而「每一块都进了那一段」根本没坏。逐块查在不在就够。
  ["angle", "phoneMoneyBlock", "phoneIdentityBlock", "phoneEvolveBlock", "phoneRosterBlock", "phoneAvoidBlock"].forEach(b =>
    assert.ok(chunk.indexOf(b) > 0, "这一块没进那一段：" + b));
});

test("档案馆里有性别这一栏，存得下、默认不指定", () => {
  assert.match(scr, /const \[gender, setGender\] = useState\(initial && initial\.gender \|\| ""\);/, "没有这一栏的状态");
  assert.match(scr, /\n      gender: gender,/, "存的时候没带上");
  assert.match(scr, /\[\["", "他（默认）"\], \["她", "她"\], \["TA", "TA · 中性"\]\]/, "三档不全");
  assert.match(scr, /h\(LineField, \{ zh: "性别", en: "Gender" \}/, "界面上没有这一栏");
  assert.match(scr, /默认是「他」——不动你已有角色的任何东西/, "没跟她说清不填会怎样");
});

// 她 2026-08-31：「现在到了自动刷新时间，我就明确看到沈屿白的查手机刷新了其他都没动静」。
// v58.89 之前一次唤起只补一个（省调用），于是「没轮到」和「坏了」长得一模一样。
// 现在改成连着刷完这一周欠的所有人——这一条钉的是【别退回去只刷一个】。
const app = R("app.js");
test("每周刷新一次把这一周欠的全刷完", () => {
  const sweep = app.slice(app.indexOf("  const phoneWeeklySweep = async () => {"), app.indexOf("  const phoneAutoToggle = charId =>"));
  // v65.03 起周次游标走公共那把闸（AutoGate），规矩没变
  assert.match(sweep, /const pending = liveChars\.filter\(c => c && autoRefreshOn\("phone", c\.id\) && window\.AutoGate\.due\("phone\|" \+ c\.id, wk, \{ maxTries: 1 \}\)\)/, "没算出这一周还有谁欠着");
  assert.match(sweep, /for \(const due of pending\) \{/, "退回成一次只补一个了");
  assert.ok(sweep.indexOf("pending[0]") < 0, "还留着「只取第一个」");
  assert.match(sweep, /genPhoneAll\(due, true\)/, "没告诉生成侧这是例行刷新");
  // 每个人各自记游标、各自兜底：中途失败或关掉 app 都不该下次整轮重刷
  const loop = sweep.slice(sweep.indexOf("for (const due of pending)"));
  assert.ok(loop.indexOf('AutoGate.claim("phone|" + due.id, wk)') >= 0
    && loop.indexOf('AutoGate.claim("phone|" + due.id, wk)') < loop.indexOf("genPhoneAll(due, true)"),
    "先刷后记游标,失败一次就会重刷");
});
