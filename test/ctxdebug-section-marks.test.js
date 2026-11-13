const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("段界记号只在带 marks 的诊断调用里出现，真实发送那条路不变", () => {
  assert.ok(/const BUNDLE_SEC_MARK = "\\u2063"/.test(eng));
  assert.ok(eng.includes('if (!(opts && opts.marks)) return _uniq.join("\\n\\n");'), "不带 marks 时不该动拼法");
  assert.ok(app.includes("buildBundle(gated, { marks: true })"));
  // 送出去那两处不许带 marks
  assert.strictEqual((app.match(/buildBundle\(gated\)/g) || []).length, 2);
});

test("诊断页照记号拆段：世界书正文里的【小标题】留在世界书这一段里", () => {
  const MARK = "\u2063";
  const stripMarks = s => String(s).split(MARK).join("");
  const bundleRaw = ["【角色人设】\nabc", "【世界书 · 常驻设定】\n【王都】首都。\n【禁术】不可提。", "【当前真实时间】2026年"].join("\n\n" + MARK);
  const text = stripMarks(bundleRaw);
  const marked = bundleRaw.includes(MARK);
  const chunks = marked ? bundleRaw.split(MARK) : text.split(/\n(?=【)/);
  const secs = chunks.map((p, i) => { const body = stripMarks(p).replace(/^\n+/, ""); const m = body.match(/^【[^】]*】/);
    return { title: m ? m[0] : "【段落 " + (i + 1) + "】", body }; }).filter(x => x.body.trim());
  assert.deepStrictEqual(secs.map(s => s.title), ["【角色人设】", "【世界书 · 常驻设定】", "【当前真实时间】"]);
  assert.ok(secs[1].body.includes("【禁术】不可提。"));
  assert.ok(!text.includes(MARK));
});

test("没有记号时退回老办法（别处调的 bundle 照旧能拆）", () => {
  assert.ok(scr.includes("const marked = one.includes(SEC_MARK)"));
  assert.ok(scr.includes('text.split(/\\n\\n(?=【)/)'), "没有记号时该按【空行＋行首【】】拆");
  assert.ok(scr.includes("if (marked) return raw;"));
  assert.ok(scr.includes("const splitBundleText = src =>"), "拆段没收在一处");
});

// 她 2026-11-13：「要一个查上一轮发了啥的跟线上一样的」——线下那份 system 是在 engine 里
// 一长串拼出来的，没有能照着重建的入口，所以在真发出去那一刻留收据，拆段和那张表跟线上共用一处。
test("线下：发出去那一刻留 system 收据，只在内存", () => {
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.ok(eng.includes("window.__offlineSysReceipt = window.__offlineSysReceipt || {}"));
  assert.ok(/window\.__offlineSysReceipt\[char\.id\] = \{ ts: Date\.now\(\)/.test(eng));
  // 不许落盘、不许进存档
  const i = eng.indexOf("window.__offlineSysReceipt");
  assert.ok(!/localStorage|idbSet|x_/.test(eng.slice(i - 200, i + 400)));
});

test("线下那张表跟线上同一处渲染、同一处拆段", () => {
  assert.ok(scr.includes("const secList = (list, totalLen, refresh, pre) =>"), "段列表没收在一处");
  assert.ok(scr.includes('secList(secs, PUB ? sumLen(secs) : text.length, () => load(cid), "on")'));
  assert.ok(/secList\(offSecs, PUB \? sumLen\(offSecs\) : stripMarks\(offReceipt\.system\)\.length/.test(scr));
  assert.ok(scr.includes("上一轮线下真的发了什么"));
  assert.ok(scr.includes("const offSecs = cid && offReceipt ? splitBundleText(offReceipt.system) : []"));
});

// 她 2026-11-13：「就家里版可以全部看 但是公共版提示词类的不给看」
test("内置规矩那几段带第二个记号，且只在一处登记", () => {
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.ok(/const BUNDLE_RULE_MARK = "\\u2062"/.test(eng));
  assert.ok(eng.includes("const pushRule = x =>"), "内置段没收在一处");
  for (const k of ["PERSONA_FIRST", "ANTI_CLICHE", "WORLDBOOK_RULE", "CHARCARD_RULE", "FOREIGN_TONGUE_RULE"])
    assert.ok(eng.includes("pushRule(" + k + ")"), k + " 没按内置标");
  assert.ok(eng.includes("ContentBoundaries.prompt);") && /pushRule\(ContentBoundaries\.prompt\)/.test(eng));
  assert.ok(eng.includes("rulePart.has(x) ? BUNDLE_RULE_MARK"));
});

test("公共版：内置那几段不列、抓请求不给；家里照旧全看", () => {
  assert.ok(scr.includes("const PUB = typeof window !== \"undefined\" && !!window.PUBLIC_BUILD"));
  assert.ok(scr.includes("filter(x => !(PUB && x.rule))"), "公共版没把内置段滤掉");
  assert.ok(scr.includes("PUB ? null : h(\"div\""), "公共版没关掉抓请求那一块");
  assert.ok(scr.includes("PUB ? sumLen(secs) : text.length"), "藏了段却还拿整份算占比");
  const rel = fs.readFileSync("/Users/lisa/yanqiu-den/qiuqiu-release/patches/patch-public-tweaks.py", "utf8");
  assert.ok(rel.includes('s.replace("const PUBLIC_BUILD = false;", "const PUBLIC_BUILD = true;", 1)'), "出货补丁没翻开关");
  const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
  assert.ok(eng.includes("const PUBLIC_BUILD = false;"), "家里那份必须是 false");
});
