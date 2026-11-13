const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");

test("段界记号只在带 marks 的诊断调用里出现，真实发送那条路不变", () => {
  assert.ok(/const BUNDLE_SEC_MARK = "\\u2063"/.test(eng));
  assert.ok(eng.includes('_uniq.join(opts && opts.marks ? "\\n\\n" + BUNDLE_SEC_MARK : "\\n\\n")'));
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
  assert.ok(/window\.__offlineSysReceipt\[char\.id\] = \{ ts: Date\.now\(\), system:/.test(eng));
  // 不许落盘、不许进存档
  const i = eng.indexOf("window.__offlineSysReceipt");
  assert.ok(!/localStorage|idbSet|x_/.test(eng.slice(i - 200, i + 400)));
});

test("线下那张表跟线上同一处渲染、同一处拆段", () => {
  assert.ok(scr.includes("const secList = (list, totalLen, refresh, pre) =>"), "段列表没收在一处");
  assert.ok(scr.includes('secList(secs, text.length, () => load(cid), "on")'));
  assert.ok(/secList\(offSecs, stripMarks\(offReceipt\.system\)\.length/.test(scr));
  assert.ok(scr.includes("上一轮线下真的发了什么"));
  assert.ok(scr.includes("const offSecs = cid && offReceipt ? splitBundleText(offReceipt.system) : []"));
});
